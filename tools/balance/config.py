"""Balance configuration — the single source of truth for every tunable number.

Change a value here, run ``python3 generate_tables.py``, and the CSVs in ``data/balance/``
plus the golden-value file consumed by the C# tests all move together. Nothing else in the
project should contain a balance literal.

Growth factors follow the band language set out in the GDD:

    1.06-1.09  cheap, frequent, bought without thinking
    1.10-1.12  considered purchases, the pacing spine
    1.13-1.15  power spikes, saved for
"""

from __future__ import annotations

from dataclasses import dataclass

# --------------------------------------------------------------------------------------
# Stations
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StationConfig:
    """One stage of the production chain."""

    id: str
    display_name: str
    base_cost: float
    cost_growth: float
    base_output: float
    """Units per second at level 0 with one unit owned and no staff bonus."""
    speed_per_level: float
    output_buffer: int
    """Finished units the station holds before it blocks."""
    ingredient_capacity: int
    """Zero means the station consumes no restockable ingredient."""
    requires_worker: bool
    """Whether somebody must stand here for the station to produce.

    The Oven is the exception: it is a machine, it bakes unattended once loaded, and it
    therefore cannot be staffed. That is what makes it a pure throughput ceiling rather than
    a claim on the player's attention, and it is why upgrading it is the obvious first
    purchase without also being the one that frees the player's hands.
    """
    staff_hire_cost: float
    staff_cost_growth: float
    staff_speed_multiplier: float
    """Throughput of a hired worker relative to the player working the station."""


# The Oven is the intentional level-0 bottleneck at 0.45/s against Dough's 0.80/s: a new
# player watches dough pile up and learns the upgrade system without being told. Its higher
# cost growth (1.12) means solving it once does not solve it forever — the bottleneck moves
# back and forth across the chain as levels are bought, which is what keeps the chain
# interesting rather than a set of four independent timers.
STATIONS: tuple[StationConfig, ...] = (
    StationConfig(
        id="dough",
        display_name="Dough",
        base_cost=25.0,
        cost_growth=1.09,
        base_output=0.80,
        speed_per_level=1.07,
        output_buffer=6,
        ingredient_capacity=40,
        requires_worker=True,
        staff_hire_cost=250.0,
        staff_cost_growth=1.12,
        staff_speed_multiplier=0.85,
    ),
    StationConfig(
        id="topping",
        display_name="Topping",
        base_cost=45.0,
        cost_growth=1.10,
        base_output=0.70,
        speed_per_level=1.07,
        output_buffer=6,
        ingredient_capacity=35,
        requires_worker=True,
        staff_hire_cost=400.0,
        staff_cost_growth=1.12,
        staff_speed_multiplier=0.85,
    ),
    StationConfig(
        id="oven",
        display_name="Oven",
        base_cost=90.0,
        cost_growth=1.12,
        base_output=0.45,
        speed_per_level=1.08,
        output_buffer=8,
        ingredient_capacity=0,
        requires_worker=False,
        staff_hire_cost=0.0,
        staff_cost_growth=1.12,
        staff_speed_multiplier=0.90,
    ),
    StationConfig(
        id="boxing",
        display_name="Boxing",
        base_cost=70.0,
        cost_growth=1.09,
        base_output=0.90,
        speed_per_level=1.06,
        output_buffer=10,
        ingredient_capacity=25,
        requires_worker=True,
        staff_hire_cost=550.0,
        staff_cost_growth=1.12,
        staff_speed_multiplier=0.85,
    ),
)

# --------------------------------------------------------------------------------------
# Pricing and combo
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PriceConfig:
    base_price: float = 3.0
    price_growth: float = 1.07
    upgrade_base_cost: float = 120.0
    upgrade_cost_growth: float = 1.15
    combo_step: float = 0.05
    combo_cap: int = 10
    """Rush Hour lifts this cap entirely."""

    max_level_per_location: int = 12
    """Price levels each unlocked location grants.

    A menu has a ceiling: past a point the neighbourhood will not pay more, whatever the
    signage says. Without this cap a single shop scales forever and expansion becomes
    decorative — which is exactly what the first tuning pass produced. Capping price per
    location is what makes opening the next street the only real way to grow."""


PRICE = PriceConfig()

# --------------------------------------------------------------------------------------
# Player capabilities
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class CarryConfig:
    base_capacity: int = 4
    capacity_per_level: int = 1
    max_level: int = 16
    upgrade_base_cost: float = 150.0
    upgrade_cost_growth: float = 1.13


CARRY = CarryConfig()


@dataclass(frozen=True)
class MarketingConfig:
    """Signage and decor — the only way to raise demand inside a single location.

    Demand is the ceiling that stops production upgrades from compounding forever. This is
    the release valve on that ceiling, and it is priced as a power spike (1.16) precisely so
    that it relieves the pressure without removing it.
    """

    arrivals_per_level: float = 1.08
    upgrade_base_cost: float = 300.0
    upgrade_cost_growth: float = 1.16
    max_level_per_location: int = 10
    """Capped per location for the same reason prices are: a street only holds so many
    customers, however loud the sign."""


MARKETING = MarketingConfig()


@dataclass(frozen=True)
class ChannelConfig:
    """One serving channel.

    The Drive-Thru is not a second counter: shorter patience, smaller orders, a higher price
    band, and an unserved car blocks the cars behind it, so one missed order costs more than
    one sale.
    """

    id: str
    display_name: str
    base_patience: float
    min_order: int
    max_order: int
    price_multiplier: float
    base_arrivals_per_second: float
    base_slots: int
    slot_base_cost: float
    slot_cost_growth: float
    staff_hire_cost: float
    serve_seconds: float
    """Time to hand over one order, which bounds throughput independently of production."""


CHANNELS: tuple[ChannelConfig, ...] = (
    ChannelConfig(
        id="counter",
        display_name="Counter",
        base_patience=30.0,
        min_order=2,
        max_order=5,
        price_multiplier=1.0,
        base_arrivals_per_second=0.22,
        base_slots=3,
        slot_base_cost=400.0,
        slot_cost_growth=1.14,
        staff_hire_cost=800.0,
        serve_seconds=0.8,
    ),
    ChannelConfig(
        id="drive_thru",
        display_name="Drive-Thru",
        base_patience=18.0,
        min_order=1,
        max_order=2,
        price_multiplier=1.35,
        base_arrivals_per_second=0.13,
        base_slots=2,
        slot_base_cost=650.0,
        slot_cost_growth=1.14,
        staff_hire_cost=1200.0,
        serve_seconds=1.2,
    ),
)

# --------------------------------------------------------------------------------------
# Locations
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class LocationConfig:
    count: int = 3
    """Locations shipping in v1. Adding more is data, not code."""
    unlock_base_cost: float = 85_000.0
    unlock_cost_growth: float = 250.0
    price_band_growth: float = 8.0
    cost_band_growth: float = 40.0
    """How much more every upgrade costs at each successive location.

    Without this, opening a location was anticlimactic: the player arrived holding the
    enormous sum they had saved for the unlock, and every remaining upgrade in the game was
    affordable at once. A new shop has to come with a new price band on its equipment, or
    expansion spends itself in a single tap."""
    arrival_growth: float = 1.35
    patience_scale: float = 0.92
    """Patience tightens slightly per location, so later shops demand more attention."""


LOCATIONS = LocationConfig()

# --------------------------------------------------------------------------------------
# Idle, offline and progression
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class OfflineConfig:
    cap_seconds: float = 4 * 60 * 60
    """Remote-Config overridable: ``offline_cap_seconds``."""
    efficiency: float = 0.5
    """Half rate keeps active play strictly better than closing the app."""
    rewarded_multiplier: float = 2.0
    ftue_welcome_bundle: float = 250.0
    """Scripted first-return reward, granted only before any station is automated."""


OFFLINE = OfflineConfig()


@dataclass(frozen=True)
class StartConfig:
    """What a brand-new save begins with.

    The starting purse is small on purpose. It is sized so the first Dough upgrade becomes
    affordable roughly 40 seconds into earning — which, allowing for the ~15 seconds before
    the first customer pays, puts the FTUE's first-upgrade beat where the GDD wants it. A
    larger purse makes an upgrade affordable before the player has served anyone, which
    teaches them that upgrades are free rather than earned.
    """

    cash: float = 10.0
    gems: int = 0


START = StartConfig()


@dataclass(frozen=True)
class LevelConfig:
    threshold_base: float = 60.0
    threshold_growth: float = 1.50
    max_level: int = 60


LEVELS = LevelConfig()


@dataclass(frozen=True)
class PrestigeConfig:
    """Reserved in the save schema for v1; the system itself ships later."""

    k: float = 1.0
    scale: float = 1_000_000.0


PRESTIGE = PrestigeConfig()


@dataclass(frozen=True)
class RushHourConfig:
    duration_seconds: float = 120.0
    cooldown_seconds: float = 900.0
    arrival_multiplier: float = 3.0
    unlock_level: int = 6


RUSH_HOUR = RushHourConfig()

# --------------------------------------------------------------------------------------
# Simulation assumptions
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SimulationConfig:
    """Assumptions the progression simulation makes about how a real session plays.

    These are not game rules. They are the modelling assumptions that turn the formulas into
    a predicted time-to-afford curve, and they are the least trustworthy numbers in this
    file — every one of them should be replaced with a measured value once telemetry from a
    playable build exists.
    """

    tick_seconds: float = 1.0
    horizon_seconds: float = 30 * 60 * 60
    """Long enough to reach the end of v1 content, which the run exhausts at around 20
    hours of active play. A shorter horizon silently reports later milestones as "never"."""
    counter_share: float = 0.7
    """Fraction of served items going to the Counter rather than the Drive-Thru."""
    average_combo: float = 5.0
    """Combo a typical player sustains — well short of the cap of 10."""
    attention_efficiency: float = 0.72
    """Throughput actually achieved against the theoretical chain minimum, accounting for
    walking between stations and split attention across two channels."""
    saving_horizon_seconds: float = 300.0
    """Stop buying incremental upgrades once the cheapest unowned gate is within this many
    seconds of earnings.

    Without a saving rule the planner spends every coin the moment it lands and the first
    hire slips past the hundred-minute mark, because a 25-cash speed upgrade is always
    affordable and a 250-cash hire never is. Expressing the rule as a time horizon rather
    than a fraction of the price is what makes it behave like a person: you start saving
    when the thing you want is close enough to feel reachable, and how close that is depends
    on how fast you are earning, not on the price tag."""

    prefer_unlocks: bool = True
    """Buy any affordable first-time unlock — a hire, a slot, a location — ahead of a
    better-returning incremental upgrade.

    Pure return-on-investment greedy is a model of one player, the optimiser, and it defers
    hires for hours because a stream of cheap speed upgrades always looks marginally better.
    Real players buy the thing that visibly changes the shop the moment they can afford it.
    This flag models that, and turning it off is a useful way to see the optimiser's curve."""

    wall_threshold_seconds: float = 180.0
    """How long the next *gated* purchase — a hire, a slot, a location — has to be
    unaffordable before it counts as a wall.

    An earlier version of this model defined a wall as having nothing at all affordable,
    which never once happened in six simulated hours: with several cheap upgrade tracks
    running in parallel there is always something to buy. That definition measured the wrong
    thing. What players experience as a wall is the next *meaningful* step being out of
    reach while small purchases keep dribbling out."""
    levels_per_table: int = 30


SIMULATION = SimulationConfig()

# --------------------------------------------------------------------------------------
# Remote Config surface
# --------------------------------------------------------------------------------------

REMOTE_CONFIG_DEFAULTS: dict[str, object] = {
    "econ_growth_rate_scale": 1.0,
    "offline_cap_seconds": OFFLINE.cap_seconds,
    "offline_efficiency": OFFLINE.efficiency,
    "rewarded_multiplier": OFFLINE.rewarded_multiplier,
    "interstitial_cap_per_hour": 6,
    "interstitial_min_gap_seconds": 180,
    "interstitial_first_unlock_serves": 60,
    "price_multiplier_scale": 1.0,
    "starter_pack_enabled": True,
    "starter_pack_trigger_wall_index": 1,
    "rush_hour_enabled": True,
    "event_id": "",
}


# --------------------------------------------------------------------------------------
# Pacing targets
# --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PacingTargets:
    """The pacing the design promises, expressed as numbers a test can check.

    ``test_simulate.py`` asserts the simulation against these, so a balance change that
    quietly pushes the first hire past half an hour fails CI instead of shipping. They are
    windows rather than points because balance is not that precise; they are here rather
    than in the test because a target is a design decision, not a test detail.
    """

    first_purchase_max_seconds: float = 60.0
    """The FTUE promises a first upgrade inside the first minute."""

    level_4_max_seconds: float = 240.0
    """Three level-up celebrations inside the first four minutes."""

    first_hire_min_seconds: float = 300.0
    """Earlier than this and automation arrives before the player understands what it
    replaces."""

    first_hire_max_seconds: float = 1200.0
    fully_automated_max_seconds: float = 5400.0

    longest_hire_wall_max_seconds: float = 1500.0
    """A long save for the next street is the design working. A long save for the next hire
    is the design failing."""

    location_2_min_seconds: float = 5400.0
    location_2_max_seconds: float = 21600.0

    content_min_seconds: float = 15 * 3600
    """Active play before every purchase in v1 is exhausted.

    At roughly 25 minutes a day this is about six weeks, which is what the D30 target needs.
    The simulation is what says whether v1 actually has that much content in it."""

    max_income_rate: float = 1e9
    """Runaway guard. An early tuning pass reached 470,000 cash per second within six hours
    and made every location unlock trivial; this fails that build."""


PACING = PacingTargets()
