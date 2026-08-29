"""Reference implementation of the Sizzle Street economy.

This module is the specification. The C# runtime in
``unity/Assets/_Project/Scripts/Economy`` implements the same formulas, and
``generate_tables.py`` emits a golden-value file that the C# edit-mode tests assert
against, so the two implementations cannot drift silently.

Every function here is pure: no global state, no clock access, no I/O. That is what makes
the economy testable and what lets the same formulas run in a headless balance sweep and on
a phone.
"""

from __future__ import annotations

import math

# Guard band for the geometric growth factor. Values outside it are a balance mistake, not a
# deliberate choice: at or below 1.0 costs never rise and progression is unbounded; above
# ~1.30 the second upgrade is already unaffordable.
MIN_GROWTH = 1.0000001
MAX_GROWTH = 1.30

#: Relative slack when comparing a purse against an exact cost boundary. Sized well above
#: double-precision noise and far below anything a player could notice.
BOUNDARY_TOLERANCE = 1e-9


def upgrade_cost(base_cost: float, growth: float, level: int) -> float:
    """Cost to buy the upgrade that moves ``level`` to ``level + 1``.

    ``level`` is the *current* level, zero-indexed, so the first purchase costs exactly
    ``base_cost``.
    """
    _validate(base_cost, growth, level)
    return base_cost * (growth ** level)


def upgrade_cost_range(base_cost: float, growth: float, level: int, count: int) -> float:
    """Total cost of buying ``count`` consecutive levels starting from ``level``.

    This is the geometric sum. Summing ``upgrade_cost`` in a loop gives the same answer but
    accumulates rounding error over long ranges and is O(n) on a hot path.
    """
    _validate(base_cost, growth, level)
    if count < 0:
        raise ValueError(f"count must be non-negative, got {count}")
    if count == 0:
        return 0.0
    return base_cost * (growth ** level) * ((growth ** count) - 1.0) / (growth - 1.0)


def max_affordable_levels(base_cost: float, growth: float, level: int, cash: float) -> int:
    """How many consecutive levels ``cash`` buys starting from ``level``.

    Inverts the geometric sum, then corrects the result in both directions against
    ``upgrade_cost_range``.

    Both corrections are needed. The closed form can land a level low — two logarithms and a
    division leave the quotient a fraction of an ulp under an integer, and ``floor`` then
    throws a whole level away, so a player holding exactly enough for seven levels is sold
    six. It can equally land a level high on a different input. Neither is acceptable: the
    first is a visible cheat, the second overcharges.

    ``BOUNDARY_TOLERANCE`` is relative because the purse spans many orders of magnitude over
    a run. The consequence is that on an exact boundary this may return a count costing a
    relative 1e-9 more than ``cash`` — a fraction of a penny against a bank of millions.
    Callers must clamp the resulting charge to the available balance; ``EconomyManager`` in
    the Unity runtime does.
    """
    _validate(base_cost, growth, level)
    if cash <= 0.0:
        return 0
    first = upgrade_cost(base_cost, growth, level)
    if cash < first:
        return 0

    budget = cash * (1.0 + BOUNDARY_TOLERANCE)
    ratio = 1.0 + (cash * (growth - 1.0)) / first
    count = int(math.floor(math.log(ratio) / math.log(growth)))

    while upgrade_cost_range(base_cost, growth, level, count + 1) <= budget:
        count += 1
    while count > 0 and upgrade_cost_range(base_cost, growth, level, count) > budget:
        count -= 1
    return count


def location_unlock_cost(base_cost: float, growth: float, index: int) -> float:
    """Cost to open the location after ``index``.

    Deliberately not ``upgrade_cost``. Upgrade growth is guarded to a narrow band because a
    per-level factor above about 1.3 makes the second level unreachable. A location is not a
    level: there are three of them in v1, each is meant to be a multi-session goal, and the
    step between them is correspondingly enormous. Sharing the guard band would either
    reject a legitimate location curve or widen the band far enough to let a broken upgrade
    curve through unnoticed.
    """
    if base_cost < 0.0:
        raise ValueError(f"base_cost must be non-negative, got {base_cost}")
    if growth <= 1.0:
        raise ValueError(f"growth must exceed 1.0, got {growth}")
    if index < 0:
        raise ValueError(f"index must be non-negative, got {index}")
    return base_cost * (growth ** index)


def station_output_per_second(
    base_output: float,
    count: int,
    speed_per_level: float,
    level: int,
    staff_multiplier: float = 1.0,
) -> float:
    """Units per second produced by one kind of station.

    ``count`` is the number of parallel units owned — a second oven is a purchase, not an
    upgrade, and it multiplies rather than adding a level.
    """
    if base_output < 0.0:
        raise ValueError(f"base_output must be non-negative, got {base_output}")
    if count < 0:
        raise ValueError(f"count must be non-negative, got {count}")
    if level < 0:
        raise ValueError(f"level must be non-negative, got {level}")
    if staff_multiplier < 0.0:
        raise ValueError(f"staff_multiplier must be non-negative, got {staff_multiplier}")
    return base_output * count * (speed_per_level ** level) * staff_multiplier


def combo_bonus(combo: int, combo_step: float, combo_cap: int) -> float:
    """Income multiplier from the current combo chain.

    ``combo_cap`` bounds the chain during normal play. Rush Hour passes a cap of ``None`` to
    lift the bound entirely, which is the whole point of Rush Hour.
    """
    if combo < 0:
        raise ValueError(f"combo must be non-negative, got {combo}")
    effective = combo if combo_cap is None else min(combo, combo_cap)
    return 1.0 + combo_step * effective


def price_multiplier(
    price_growth: float,
    price_level: int,
    location_band: float = 1.0,
    prestige_multiplier: float = 1.0,
) -> float:
    """Combined multiplier applied to an item's base price."""
    if price_level < 0:
        raise ValueError(f"price_level must be non-negative, got {price_level}")
    return (price_growth ** price_level) * location_band * prestige_multiplier


def income_per_item(
    base_price: float,
    price_mult: float,
    combo_mult: float = 1.0,
    channel_multiplier: float = 1.0,
) -> float:
    """Cash paid for a single served item."""
    return base_price * price_mult * combo_mult * channel_multiplier


def chain_throughput(station_rates: list[float]) -> float:
    """Items per second delivered by a serial station chain.

    A serial chain runs at the rate of its slowest stage. An empty chain produces nothing
    rather than raising, because a location with no stations built is a legal state during
    expansion.
    """
    if not station_rates:
        return 0.0
    if any(rate < 0.0 for rate in station_rates):
        raise ValueError("station rates must be non-negative")
    return min(station_rates)


def idle_rate(
    station_rates: list[float],
    automated: list[bool],
    serve_capacity_per_second: float,
    average_income_per_item: float,
) -> float:
    """Cash per second the shop earns with the player absent.

    An unautomated station contributes a rate of zero, which drives the whole chain to zero.
    That is deliberate: it is the game's strongest argument for hiring staff, and it means
    offline income can never be earned by a shop that visibly could not run itself.
    """
    if len(station_rates) != len(automated):
        raise ValueError("station_rates and automated must be the same length")
    if serve_capacity_per_second < 0.0:
        raise ValueError("serve_capacity_per_second must be non-negative")

    effective = [
        rate if is_automated else 0.0
        for rate, is_automated in zip(station_rates, automated)
    ]
    throughput = chain_throughput(effective)
    if throughput <= 0.0:
        return 0.0
    served = min(throughput, serve_capacity_per_second)
    return served * average_income_per_item


def elapsed_seconds(now_unix: float, last_save_unix: float) -> float:
    """Seconds of credited absence between two timestamps.

    Negative elapsed time means the device clock moved backwards, whether by travel, a
    manual change or a deliberate exploit. It is credited as zero. The caller is responsible
    for repairing the stored timestamp forward; this function does not decide policy, it
    only refuses to invent time.
    """
    delta = now_unix - last_save_unix
    return delta if delta > 0.0 else 0.0


def offline_earnings(
    elapsed: float,
    cap_seconds: float,
    rate_per_second: float,
    efficiency: float,
    reward_multiplier: float = 1.0,
) -> float:
    """Cash granted for an absence.

    Accrual is linear up to ``cap_seconds`` and flat thereafter. ``efficiency`` below 1.0
    keeps active play strictly better than closing the app; ``reward_multiplier`` is the
    rewarded-ad doubler.
    """
    if cap_seconds < 0.0:
        raise ValueError(f"cap_seconds must be non-negative, got {cap_seconds}")
    if rate_per_second < 0.0:
        raise ValueError(f"rate_per_second must be non-negative, got {rate_per_second}")
    if not 0.0 <= efficiency <= 1.0:
        raise ValueError(f"efficiency must be within [0, 1], got {efficiency}")
    if reward_multiplier < 1.0:
        raise ValueError(f"reward_multiplier must be at least 1, got {reward_multiplier}")
    credited = min(max(elapsed, 0.0), cap_seconds)
    return credited * rate_per_second * efficiency * reward_multiplier


def prestige_multiplier(total_earned: float, k: float, scale: float) -> float:
    """Permanent multiplier granted by resetting a run.

    Square root rather than linear, so each successive reset is worth less than the last and
    prestige never becomes the only action worth taking.
    """
    if scale <= 0.0:
        raise ValueError(f"scale must be positive, got {scale}")
    if total_earned <= 0.0:
        return 1.0
    return 1.0 + k * math.sqrt(total_earned / scale)


def level_threshold(base: float, growth: float, level: int) -> float:
    """Cumulative earnings needed to reach ``level``.

    Level 1 is the starting state and costs nothing, so the curve is anchored there.
    """
    if level <= 1:
        return 0.0
    return base * (growth ** (level - 2))


def marginal_value(delta_rate: float, cost: float) -> float:
    """Income gained per unit of cash spent — the greedy purchase heuristic.

    A zero-cost improvement is infinitely good and a zero-improvement purchase is worthless;
    both are returned as such rather than raising, because the purchase planner ranks
    candidates and needs a total order.
    """
    if delta_rate <= 0.0:
        return 0.0
    if cost <= 0.0:
        return math.inf
    return delta_rate / cost


def _validate(base_cost: float, growth: float, level: int) -> None:
    if base_cost < 0.0:
        raise ValueError(f"base_cost must be non-negative, got {base_cost}")
    if not MIN_GROWTH <= growth <= MAX_GROWTH:
        raise ValueError(
            f"growth must be within [{MIN_GROWTH}, {MAX_GROWTH}], got {growth}"
        )
    if level < 0:
        raise ValueError(f"level must be non-negative, got {level}")
