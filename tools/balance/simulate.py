"""Progression simulation.

Turns the formulas in ``economy.py`` and the tunables in ``config.py`` into a predicted
session: what a player buys, when they can afford it, and where they stall. The output is
what makes claims like "the first wall lands at 25-35 minutes" checkable rather than
aspirational.

The model has three ideas in it.

**Attention.** A station only produces while somebody works it, and the player has one pair
of hands. Work the player must do personally is *serial* — the seconds add up across every
unstaffed post. Work that proceeds without them is *parallel* — the Oven, which is a
machine, and any post with a hire on it. These cap throughput individually instead of
adding. Hiring therefore does something no speed upgrade can: it moves a term out of the
serial sum into the parallel set, which is why the first hire is the biggest felt jump in
the game.

**Demand.** Customers arrive at a finite rate, so production upgrades cannot compound
forever. Without this ceiling the model produces a runaway — an early version reached
470,000 cash per second within six hours and made every location unlock trivial. Demand is
what makes expansion, rather than optimisation, the thing that actually grows the business,
and it is the reason the GDD's progression invariant holds.

**Behaviour.** Players buy the thing that visibly changes the shop as soon as they can
afford it. Pure return-on-investment greedy defers the first hire for over two hours
because a stream of cheap speed upgrades always looks marginally better. Both policies are
available; ``SIMULATION.prefer_unlocks`` selects between them.

What the model does *not* capture, and where its numbers should be distrusted:

* Carry capacity and walking distance. There is no geometry here, so carry upgrades are
  excluded from the planner entirely rather than being valued badly.
* Queue dynamics. Arrivals are a smooth rate, so patience never expires and combos never
  break. The average combo is an assumption, not an outcome.
* Locations are modelled in aggregate — unlocking one raises the price band and demand of a
  single simulated shop rather than adding a second one to manage.
* Rush Hour, events, offline collection, and every gem spend.

Every assumption here should be replaced by a measured value once a playable build produces
telemetry. Until then this is a tuning aid, not a forecast.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import config as cfg
import economy as econ

#: Purchases that unlock something for the first time, as opposed to incrementing a level.
#: These are the steps players experience as progress, so they are what wall timing is
#: measured against.
GATE_PREFIXES = ("staff:", "location:")


@dataclass
class Purchase:
    """A candidate the planner can buy this tick."""

    key: str
    label: str
    cost: float
    apply: object
    """Callable taking the state and mutating it to reflect the purchase."""

    @property
    def is_gate(self) -> bool:
        return self.key.startswith(GATE_PREFIXES)


@dataclass
class SimState:
    cash: float = cfg.START.cash
    total_earned: float = 0.0
    station_levels: dict[str, int] = field(default_factory=dict)
    station_staffed: dict[str, bool] = field(default_factory=dict)
    channel_slot_levels: dict[str, int] = field(default_factory=dict)
    channel_staffed: dict[str, bool] = field(default_factory=dict)
    price_level: int = 0
    marketing_level: int = 0
    location_index: int = 0

    @staticmethod
    def new() -> "SimState":
        state = SimState()
        for station in cfg.STATIONS:
            state.station_levels[station.id] = 0
            state.station_staffed[station.id] = False
        for channel in cfg.CHANNELS:
            state.channel_slot_levels[channel.id] = 0
            state.channel_staffed[channel.id] = False
        return state

    def clone(self) -> "SimState":
        return SimState(
            cash=self.cash,
            total_earned=self.total_earned,
            station_levels=dict(self.station_levels),
            station_staffed=dict(self.station_staffed),
            channel_slot_levels=dict(self.channel_slot_levels),
            channel_staffed=dict(self.channel_staffed),
            price_level=self.price_level,
            marketing_level=self.marketing_level,
            location_index=self.location_index,
        )


@dataclass
class Event:
    time_seconds: float
    kind: str
    detail: str
    income_rate: float
    cumulative_earned: float
    player_level: int


# ---------------------------------------------------------------------------------------
# The model
# ---------------------------------------------------------------------------------------


def channel_share(channel: cfg.ChannelConfig) -> float:
    """Fraction of all items that leave through this channel."""
    if channel.id == "counter":
        return cfg.SIMULATION.counter_share
    return 1.0 - cfg.SIMULATION.counter_share


def average_order_size(channel: cfg.ChannelConfig) -> float:
    return (channel.min_order + channel.max_order) / 2.0


def station_rate(state: SimState, station: cfg.StationConfig) -> float:
    """Units per second this station produces at its current level and staffing."""
    staffed = state.station_staffed[station.id]
    multiplier = station.staff_speed_multiplier if staffed else 1.0
    return econ.station_output_per_second(
        station.base_output,
        count=1,
        speed_per_level=station.speed_per_level,
        level=state.station_levels[station.id],
        staff_multiplier=multiplier,
    )


def cost_band(state: SimState) -> float:
    """Multiplier applied to every upgrade price at the current location."""
    return cfg.LOCATIONS.cost_band_growth ** state.location_index


def price_cap(state: SimState) -> int:
    """Price levels available at the current expansion stage."""
    return (state.location_index + 1) * cfg.PRICE.max_level_per_location


def marketing_cap(state: SimState) -> int:
    """Signage levels available at the current expansion stage."""
    return (state.location_index + 1) * cfg.MARKETING.max_level_per_location


def demand_per_second(state: SimState) -> float:
    """Items per second customers actually ask for.

    This is the ceiling on everything. A shop cannot sell faster than people walk in, and no
    amount of production upgrading changes that — only marketing, which raises arrivals
    within a location, and expansion, which opens a bigger one.
    """
    marketing = cfg.MARKETING.arrivals_per_level ** state.marketing_level
    location = cfg.LOCATIONS.arrival_growth ** state.location_index
    total = 0.0
    for channel in cfg.CHANNELS:
        total += channel.base_arrivals_per_second * average_order_size(channel)
    return total * marketing * location


def throughput(state: SimState) -> float:
    """Items per second the shop completes end to end."""
    serial_seconds_per_item = 0.0
    parallel_limits: list[float] = [demand_per_second(state)]

    for station in cfg.STATIONS:
        rate = station_rate(state, station)
        if rate <= 0.0:
            return 0.0
        if not station.requires_worker or state.station_staffed[station.id]:
            parallel_limits.append(rate)
        else:
            serial_seconds_per_item += 1.0 / rate

    for channel in cfg.CHANNELS:
        share = channel_share(channel)
        if share <= 0.0:
            continue
        slots = channel.base_slots + state.channel_slot_levels[channel.id]
        if state.channel_staffed[channel.id]:
            # A server handles only this channel's share of items, so its capacity converts
            # to a whole-chain limit by dividing by that share.
            parallel_limits.append((slots / channel.serve_seconds) / share)
        else:
            serial_seconds_per_item += share * channel.serve_seconds

    if serial_seconds_per_item > 0.0:
        parallel_limits.append(
            cfg.SIMULATION.attention_efficiency / serial_seconds_per_item
        )

    return econ.chain_throughput(parallel_limits)


def average_income_per_item(state: SimState) -> float:
    """Blended payout per item across both channels at the assumed combo."""
    price_mult = econ.price_multiplier(
        cfg.PRICE.price_growth,
        state.price_level,
        location_band=cfg.LOCATIONS.price_band_growth ** state.location_index,
    )
    combo = econ.combo_bonus(
        int(cfg.SIMULATION.average_combo), cfg.PRICE.combo_step, cfg.PRICE.combo_cap
    )
    counter, drive_thru = cfg.CHANNELS
    blended_channel = (
        cfg.SIMULATION.counter_share * counter.price_multiplier
        + (1.0 - cfg.SIMULATION.counter_share) * drive_thru.price_multiplier
    )
    return econ.income_per_item(cfg.PRICE.base_price, price_mult, combo, blended_channel)


def income_rate(state: SimState) -> float:
    """Cash per second the shop currently earns."""
    return throughput(state) * average_income_per_item(state)


def idle_income_rate(state: SimState) -> float:
    """Cash per second with the player absent — the basis for offline earnings.

    Any unstaffed post that needs a worker stops the chain dead, so this stays at zero until
    the shop can genuinely run itself.
    """
    automated = all(
        state.station_staffed[station.id]
        for station in cfg.STATIONS
        if station.requires_worker
    ) and any(state.channel_staffed[channel.id] for channel in cfg.CHANNELS)
    if not automated:
        return 0.0
    return income_rate(state)


def player_level(total_earned: float) -> int:
    level = 1
    while level < cfg.LEVELS.max_level:
        threshold = econ.level_threshold(
            cfg.LEVELS.threshold_base, cfg.LEVELS.threshold_growth, level + 1
        )
        if total_earned < threshold:
            break
        level += 1
    return level


# ---------------------------------------------------------------------------------------
# Purchase planning
# ---------------------------------------------------------------------------------------


def candidates(state: SimState) -> list[Purchase]:
    """Everything the player could buy right now, at any price.

    Carry-capacity upgrades are deliberately absent: this model has no geometry, so it
    cannot value them, and a purchase valued at zero would never be bought and would
    silently distort the cash curve.
    """
    result: list[Purchase] = []
    band = cost_band(state)

    for station in cfg.STATIONS:
        level = state.station_levels[station.id]
        result.append(
            Purchase(
                key=f"station:{station.id}",
                label=f"{station.display_name} to level {level + 1}",
                cost=band * econ.upgrade_cost(
                    station.base_cost, station.cost_growth, level
                ),
                apply=lambda target, sid=station.id: target.station_levels.__setitem__(
                    sid, target.station_levels[sid] + 1
                ),
            )
        )

        if station.requires_worker and not state.station_staffed[station.id]:
            result.append(
                Purchase(
                    key=f"staff:{station.id}",
                    label=f"Hire {station.display_name} cook",
                    cost=band * station.staff_hire_cost,
                    apply=lambda target, sid=station.id: target.station_staffed.__setitem__(
                        sid, True
                    ),
                )
            )

    for channel in cfg.CHANNELS:
        level = state.channel_slot_levels[channel.id]
        result.append(
            Purchase(
                key=f"slot:{channel.id}",
                label=f"{channel.display_name} slot {channel.base_slots + level + 1}",
                cost=band * econ.upgrade_cost(
                    channel.slot_base_cost, channel.slot_cost_growth, level
                ),
                apply=lambda target, cid=channel.id: target.channel_slot_levels.__setitem__(
                    cid, target.channel_slot_levels[cid] + 1
                ),
            )
        )

        if not state.channel_staffed[channel.id]:
            result.append(
                Purchase(
                    key=f"staff:{channel.id}",
                    label=f"Hire {channel.display_name} server",
                    cost=band * channel.staff_hire_cost,
                    apply=lambda target, cid=channel.id: target.channel_staffed.__setitem__(
                        cid, True
                    ),
                )
            )

    def bump_price(target: SimState) -> None:
        target.price_level += 1

    if state.price_level < price_cap(state):
        result.append(
        Purchase(
            key="price",
            label=f"Menu price to level {state.price_level + 1}",
            cost=band * econ.upgrade_cost(
                cfg.PRICE.upgrade_base_cost, cfg.PRICE.upgrade_cost_growth, state.price_level
            ),
            apply=bump_price,
        )
        )

    if state.marketing_level < marketing_cap(state):

        def bump_marketing(target: SimState) -> None:
            target.marketing_level += 1

        result.append(
            Purchase(
                key="marketing",
                label=f"Signage to level {state.marketing_level + 1}",
                cost=band * econ.upgrade_cost(
                    cfg.MARKETING.upgrade_base_cost,
                    cfg.MARKETING.upgrade_cost_growth,
                    state.marketing_level,
                ),
                apply=bump_marketing,
            )
        )

    if state.location_index < cfg.LOCATIONS.count - 1:

        def open_location(target: SimState) -> None:
            target.location_index += 1

        result.append(
            Purchase(
                key=f"location:{state.location_index + 1}",
                label=f"Open location {state.location_index + 2}",
                cost=econ.location_unlock_cost(
                    cfg.LOCATIONS.unlock_base_cost,
                    cfg.LOCATIONS.unlock_cost_growth,
                    state.location_index,
                ),
                apply=open_location,
            )
        )

    return result


def best_purchase(state: SimState) -> Purchase | None:
    """The purchase a player would make right now, or ``None`` if nothing is affordable.

    Under ``prefer_unlocks`` any affordable gate wins outright, cheapest first. Otherwise
    the choice is the best income gained per unit of cash spent, breaking ties towards the
    cheaper option — which is what players do when two upgrades look equally good.
    """
    options = candidates(state)
    affordable = [option for option in options if option.cost <= state.cash]
    if not affordable:
        return None

    if cfg.SIMULATION.prefer_unlocks:
        gates = [option for option in affordable if option.is_gate]
        if gates:
            return min(gates, key=lambda option: option.cost)

        # Saving up. Once the cheapest unowned gate is within reach, stop spending on
        # anything else so it actually arrives.
        unowned_gates = [option for option in options if option.is_gate]
        if unowned_gates:
            target = min(unowned_gates, key=lambda option: option.cost)
            reachable = state.cash + income_rate(state) * cfg.SIMULATION.saving_horizon_seconds
            if target.cost <= reachable:
                return None

    current = income_rate(state)
    best: Purchase | None = None
    best_value = 0.0

    for option in affordable:
        projected = state.clone()
        option.apply(projected)
        value = econ.marginal_value(income_rate(projected) - current, option.cost)
        if value <= 0.0:
            continue
        if best is None or value > best_value or (
            math.isclose(value, best_value) and option.cost < best.cost
        ):
            best = option
            best_value = value

    return best


# ---------------------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------------------


def run(horizon_seconds: float | None = None) -> list[Event]:
    """Simulate a session and return every notable event in order."""
    horizon = (
        horizon_seconds if horizon_seconds is not None else cfg.SIMULATION.horizon_seconds
    )
    tick = cfg.SIMULATION.tick_seconds
    state = SimState.new()
    events: list[Event] = [
        Event(0.0, "start", "Session begins", income_rate(state), 0.0, 1)
    ]

    level = 1
    last_gate_time = 0.0
    elapsed = 0.0

    while elapsed < horizon:
        elapsed += tick
        earned = income_rate(state) * tick
        state.cash += earned
        state.total_earned += earned

        new_level = player_level(state.total_earned)
        while new_level > level:
            level += 1
            events.append(
                Event(elapsed, "level_up", f"Player level {level}", income_rate(state),
                      state.total_earned, level)
            )

        while True:
            purchase = best_purchase(state)
            if purchase is None:
                break
            state.cash -= purchase.cost
            purchase.apply(state)

            if purchase.is_gate:
                gap = elapsed - last_gate_time
                if gap >= cfg.SIMULATION.wall_threshold_seconds:
                    events.append(
                        Event(elapsed, "wall",
                              f"{gap / 60.0:.1f} min to reach: {purchase.label}",
                              income_rate(state), state.total_earned, level)
                    )
                last_gate_time = elapsed

            events.append(
                Event(elapsed, "purchase", purchase.label, income_rate(state),
                      state.total_earned, level)
            )

    events.append(
        Event(elapsed, "end", "Horizon reached", income_rate(state), state.total_earned,
              level)
    )
    return events


def walls(events: list[Event]) -> list[Event]:
    return [event for event in events if event.kind == "wall"]


def summary(events: list[Event]) -> dict[str, object]:
    """Headline numbers for the balance report."""
    purchases = [event for event in events if event.kind == "purchase"]
    level_ups = [event for event in events if event.kind == "level_up"]
    wall_events = walls(events)

    def first_time(predicate) -> float | None:
        return next(
            (event.time_seconds for event in purchases if predicate(event.detail)), None
        )

    return {
        "purchases": len(purchases),
        "first_purchase_seconds": purchases[0].time_seconds if purchases else None,
        "levels_reached": events[-1].player_level,
        "level_4_seconds": next(
            (event.time_seconds for event in level_ups if event.player_level == 4), None
        ),
        "first_hire_seconds": first_time(lambda detail: detail.startswith("Hire")),
        "fully_automated_seconds": first_time(
            lambda detail: detail == "Hire Counter server"
        ),
        "location_2_seconds": first_time(lambda detail: detail == "Open location 2"),
        "location_3_seconds": first_time(lambda detail: detail == "Open location 3"),
        "first_wall_seconds": wall_events[0].time_seconds if wall_events else None,
        "wall_count": len(wall_events),
        # Location walls are reported separately. A long save for the next street is the
        # design working; a long save for the next hire is the design failing.
        "longest_hire_wall_minutes": max(
            (
                float(event.detail.split(" min")[0])
                for event in wall_events
                if "Open location" not in event.detail
            ),
            default=0.0,
        ),
        "longest_location_wall_minutes": max(
            (
                float(event.detail.split(" min")[0])
                for event in wall_events
                if "Open location" in event.detail
            ),
            default=0.0,
        ),
        "content_exhausted_seconds": purchases[-1].time_seconds if purchases else None,
        "final_income_rate": events[-1].income_rate,
        "total_earned": events[-1].cumulative_earned,
    }
