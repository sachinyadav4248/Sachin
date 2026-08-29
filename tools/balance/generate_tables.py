"""Generate the balance tables, the golden-value file and the balance report.

Run from this directory::

    python3 generate_tables.py

Output goes to ``data/balance/`` at the repository root:

``*.csv``
    Human-readable balance tables. The Unity editor importer reads these into
    ScriptableObjects, so they are the seam between tuning and the game.

``golden_values.json``
    Cases the C# edit-mode tests assert against, so the Python specification and the C#
    runtime cannot drift apart silently.

``REPORT.md``
    The simulated progression, written out in prose and checked against the pacing targets.

Generation is deterministic. Regenerating without editing ``config.py`` produces
byte-identical files, so any diff under ``data/balance/`` is a real balance change and
shows up in review as one.
"""

from __future__ import annotations

import csv
import json
import pathlib

import config as cfg
import economy as econ
import simulate

OUTPUT_DIR = pathlib.Path(__file__).resolve().parents[2] / "data" / "balance"

#: Significant figures for every generated number. Enough to reproduce a double closely,
#: few enough that the files stay readable and stable across platforms.
PRECISION = 8


def num(value: float) -> str:
    """Format a number for a generated file, deterministically."""
    return f"{value:.{PRECISION}g}"


def write_csv(name: str, header: list[str], rows: list[list[object]]) -> pathlib.Path:
    path = OUTPUT_DIR / name
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
    return path


# ---------------------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------------------


def station_upgrades() -> pathlib.Path:
    rows: list[list[object]] = []
    for station in cfg.STATIONS:
        cumulative = 0.0
        for level in range(cfg.SIMULATION.levels_per_table):
            cost = econ.upgrade_cost(station.base_cost, station.cost_growth, level)
            cumulative += cost
            rate_now = econ.station_output_per_second(
                station.base_output, 1, station.speed_per_level, level
            )
            rate_next = econ.station_output_per_second(
                station.base_output, 1, station.speed_per_level, level + 1
            )
            rows.append([
                station.id,
                level,
                num(cost),
                num(cumulative),
                num(rate_now),
                num(rate_next - rate_now),
                num(econ.marginal_value(rate_next - rate_now, cost)),
            ])
    return write_csv(
        "station_upgrades.csv",
        [
            "station_id",
            "level",
            "cost",
            "cumulative_cost",
            "output_per_second",
            "output_gain",
            "gain_per_cash",
        ],
        rows,
    )


def price_upgrades() -> pathlib.Path:
    rows: list[list[object]] = []
    cumulative = 0.0
    for level in range(cfg.SIMULATION.levels_per_table):
        cost = econ.upgrade_cost(
            cfg.PRICE.upgrade_base_cost, cfg.PRICE.upgrade_cost_growth, level
        )
        cumulative += cost
        multiplier = econ.price_multiplier(cfg.PRICE.price_growth, level)
        rows.append([
            level,
            num(cost),
            num(cumulative),
            num(multiplier),
            num(econ.income_per_item(cfg.PRICE.base_price, multiplier)),
            level // cfg.PRICE.max_level_per_location,
        ])
    return write_csv(
        "price_upgrades.csv",
        [
            "level",
            "cost",
            "cumulative_cost",
            "price_multiplier",
            "income_per_item",
            "requires_location_index",
        ],
        rows,
    )


def carry_upgrades() -> pathlib.Path:
    rows: list[list[object]] = []
    cumulative = 0.0
    for level in range(cfg.CARRY.max_level + 1):
        cost = (
            0.0
            if level == 0
            else econ.upgrade_cost(
                cfg.CARRY.upgrade_base_cost, cfg.CARRY.upgrade_cost_growth, level - 1
            )
        )
        cumulative += cost
        capacity = cfg.CARRY.base_capacity + cfg.CARRY.capacity_per_level * level
        rows.append([level, num(cost), num(cumulative), capacity])
    return write_csv(
        "carry_upgrades.csv", ["level", "cost", "cumulative_cost", "capacity"], rows
    )


def marketing_upgrades() -> pathlib.Path:
    rows: list[list[object]] = []
    cumulative = 0.0
    total_levels = cfg.MARKETING.max_level_per_location * cfg.LOCATIONS.count
    for level in range(total_levels):
        cost = econ.upgrade_cost(
            cfg.MARKETING.upgrade_base_cost, cfg.MARKETING.upgrade_cost_growth, level
        )
        cumulative += cost
        rows.append([
            level,
            num(cost),
            num(cumulative),
            num(cfg.MARKETING.arrivals_per_level ** level),
            level // cfg.MARKETING.max_level_per_location,
        ])
    return write_csv(
        "marketing_upgrades.csv",
        [
            "level",
            "cost",
            "cumulative_cost",
            "arrival_multiplier",
            "requires_location_index",
        ],
        rows,
    )


def staff_table() -> pathlib.Path:
    rows: list[list[object]] = []
    for location in range(cfg.LOCATIONS.count):
        band = cfg.LOCATIONS.cost_band_growth ** location
        for station in cfg.STATIONS:
            if not station.requires_worker:
                continue
            rows.append([
                location,
                station.id,
                "station",
                num(band * station.staff_hire_cost),
                num(station.staff_speed_multiplier),
            ])
        for channel in cfg.CHANNELS:
            rows.append([
                location,
                channel.id,
                "channel",
                num(band * channel.staff_hire_cost),
                num(1.0),
            ])
    return write_csv(
        "staff.csv",
        ["location_index", "post_id", "post_kind", "hire_cost", "speed_multiplier"],
        rows,
    )


def locations_table() -> pathlib.Path:
    rows: list[list[object]] = []
    for index in range(cfg.LOCATIONS.count):
        rows.append([
            index,
            0.0 if index == 0 else num(
                econ.location_unlock_cost(
                    cfg.LOCATIONS.unlock_base_cost, cfg.LOCATIONS.unlock_cost_growth,
                    index - 1,
                )
            ),
            num(cfg.LOCATIONS.price_band_growth ** index),
            num(cfg.LOCATIONS.arrival_growth ** index),
            num(cfg.LOCATIONS.cost_band_growth ** index),
            num(cfg.LOCATIONS.patience_scale ** index),
            (index + 1) * cfg.PRICE.max_level_per_location,
            (index + 1) * cfg.MARKETING.max_level_per_location,
        ])
    return write_csv(
        "locations.csv",
        [
            "location_index",
            "unlock_cost",
            "price_band",
            "arrival_multiplier",
            "cost_band",
            "patience_scale",
            "price_level_cap",
            "marketing_level_cap",
        ],
        rows,
    )


def patience_table() -> pathlib.Path:
    rows: list[list[object]] = []
    for index in range(cfg.LOCATIONS.count):
        scale = cfg.LOCATIONS.patience_scale ** index
        for channel in cfg.CHANNELS:
            rows.append([
                index,
                channel.id,
                num(channel.base_patience * scale),
                channel.min_order,
                channel.max_order,
                num(channel.price_multiplier),
                num(
                    channel.base_arrivals_per_second
                    * (cfg.LOCATIONS.arrival_growth ** index)
                ),
            ])
    return write_csv(
        "customer_patience.csv",
        [
            "location_index",
            "channel_id",
            "patience_seconds",
            "min_order",
            "max_order",
            "price_multiplier",
            "arrivals_per_second",
        ],
        rows,
    )


def level_table() -> pathlib.Path:
    rows: list[list[object]] = []
    for level in range(1, cfg.LEVELS.max_level + 1):
        rows.append([
            level,
            num(
                econ.level_threshold(
                    cfg.LEVELS.threshold_base, cfg.LEVELS.threshold_growth, level
                )
            ),
        ])
    return write_csv("player_levels.csv", ["level", "cumulative_earnings"], rows)


def progression_table(events: list[simulate.Event]) -> pathlib.Path:
    rows = [
        [
            num(event.time_seconds),
            num(event.time_seconds / 60.0),
            event.kind,
            event.detail,
            num(event.income_rate),
            num(event.cumulative_earned),
            event.player_level,
        ]
        for event in events
    ]
    return write_csv(
        "progression.csv",
        [
            "time_seconds",
            "time_minutes",
            "kind",
            "detail",
            "income_per_second",
            "cumulative_earned",
            "player_level",
        ],
        rows,
    )


# ---------------------------------------------------------------------------------------
# Golden values for the C# tests
# ---------------------------------------------------------------------------------------


def golden_values() -> pathlib.Path:
    """Cases the C# implementation must reproduce.

    Chosen for coverage of the awkward parts rather than the easy ones: level zero, exact
    cost boundaries, the offline cap, a backwards clock, an unautomated shop.
    """
    cases: list[dict[str, object]] = []

    def case(function: str, args: dict[str, object], expected: float, note: str = "") -> None:
        cases.append(
            {"function": function, "args": args, "expected": expected, "note": note}
        )

    for station in cfg.STATIONS:
        for level in (0, 1, 7, 29):
            case(
                "UpgradeCost",
                {"baseCost": station.base_cost, "growth": station.cost_growth, "level": level},
                econ.upgrade_cost(station.base_cost, station.cost_growth, level),
                f"{station.id} level {level}",
            )

    case(
        "UpgradeCostRange",
        {"baseCost": 90.0, "growth": 1.12, "level": 4, "count": 30},
        econ.upgrade_cost_range(90.0, 1.12, 4, 30),
        "bulk buy must equal the geometric sum, not a loop of individual costs",
    )
    case(
        "UpgradeCostRange",
        {"baseCost": 25.0, "growth": 1.09, "level": 0, "count": 0},
        0.0,
        "buying nothing is free",
    )

    boundary = econ.upgrade_cost_range(25.0, 1.09, 2, 7)
    case(
        "MaxAffordableLevels",
        {"baseCost": 25.0, "growth": 1.09, "level": 2, "cash": boundary},
        7,
        "exactly enough for seven levels must buy seven, not six",
    )
    case(
        "MaxAffordableLevels",
        {"baseCost": 25.0, "growth": 1.09, "level": 0, "cash": 24.99},
        0,
        "just short of the first level buys nothing",
    )
    case(
        "MaxAffordableLevels",
        {"baseCost": 45.0, "growth": 1.10, "level": 3, "cash": 5000.0},
        econ.max_affordable_levels(45.0, 1.10, 3, 5000.0),
    )

    for level in (0, 5, 20):
        case(
            "StationOutputPerSecond",
            {
                "baseOutput": 0.45,
                "count": 1,
                "speedPerLevel": 1.08,
                "level": level,
                "staffMultiplier": 1.0,
            },
            econ.station_output_per_second(0.45, 1, 1.08, level),
            f"oven at level {level}",
        )

    for combo in (0, 5, 10, 400):
        case(
            "ComboBonus",
            {"combo": combo, "step": cfg.PRICE.combo_step, "cap": cfg.PRICE.combo_cap},
            econ.combo_bonus(combo, cfg.PRICE.combo_step, cfg.PRICE.combo_cap),
            "combo is capped outside Rush Hour",
        )
    case(
        "ComboBonusUncapped",
        {"combo": 40, "step": cfg.PRICE.combo_step},
        econ.combo_bonus(40, cfg.PRICE.combo_step, None),
        "Rush Hour lifts the cap",
    )

    for elapsed, note in (
        (0.0, "no absence"),
        (3600.0, "an hour, below the cap"),
        (cfg.OFFLINE.cap_seconds, "exactly at the cap"),
        (48 * 3600.0, "two days, far beyond the cap"),
        (-5000.0, "a backwards clock earns nothing"),
    ):
        case(
            "OfflineEarnings",
            {
                "elapsed": elapsed,
                "capSeconds": cfg.OFFLINE.cap_seconds,
                "ratePerSecond": 10.0,
                "efficiency": cfg.OFFLINE.efficiency,
                "rewardMultiplier": 1.0,
            },
            econ.offline_earnings(
                elapsed, cfg.OFFLINE.cap_seconds, 10.0, cfg.OFFLINE.efficiency
            ),
            note,
        )
    case(
        "OfflineEarnings",
        {
            "elapsed": 3600.0,
            "capSeconds": cfg.OFFLINE.cap_seconds,
            "ratePerSecond": 10.0,
            "efficiency": cfg.OFFLINE.efficiency,
            "rewardMultiplier": cfg.OFFLINE.rewarded_multiplier,
        },
        econ.offline_earnings(
            3600.0,
            cfg.OFFLINE.cap_seconds,
            10.0,
            cfg.OFFLINE.efficiency,
            cfg.OFFLINE.rewarded_multiplier,
        ),
        "the rewarded doubler",
    )

    case(
        "ElapsedSeconds",
        {"nowUnix": 1_700_000_600.0, "lastSaveUnix": 1_700_000_000.0},
        600.0,
    )
    case(
        "ElapsedSeconds",
        {"nowUnix": 0.0, "lastSaveUnix": 1_700_000_000.0},
        0.0,
        "device clock set to 1970 must not pay out",
    )

    case(
        "IdleRate",
        {
            "stationRates": [0.8, 0.7, 0.45, 0.9],
            "automated": [True, True, True, True],
            "serveCapacityPerSecond": 10.0,
            "averageIncomePerItem": 4.0,
        },
        econ.idle_rate([0.8, 0.7, 0.45, 0.9], [True] * 4, 10.0, 4.0),
    )
    case(
        "IdleRate",
        {
            "stationRates": [0.8, 0.7, 0.45, 0.9],
            "automated": [True, True, False, True],
            "serveCapacityPerSecond": 10.0,
            "averageIncomePerItem": 4.0,
        },
        0.0,
        "one unautomated post stops the chain dead",
    )

    for earned in (0.0, 1e6, 4e6):
        case(
            "PrestigeMultiplier",
            {"totalEarned": earned, "k": cfg.PRESTIGE.k, "scale": cfg.PRESTIGE.scale},
            econ.prestige_multiplier(earned, cfg.PRESTIGE.k, cfg.PRESTIGE.scale),
        )

    for index in range(cfg.LOCATIONS.count):
        case(
            "LocationUnlockCost",
            {
                "baseCost": cfg.LOCATIONS.unlock_base_cost,
                "growth": cfg.LOCATIONS.unlock_cost_growth,
                "index": index,
            },
            econ.location_unlock_cost(
                cfg.LOCATIONS.unlock_base_cost, cfg.LOCATIONS.unlock_cost_growth, index
            ),
        )

    payload = {
        "description": (
            "Golden values generated by tools/balance/generate_tables.py. The C# economy "
            "must reproduce every one of these. Regenerate after any change to config.py "
            "and review the diff: a changed expected value is a changed game."
        ),
        "tolerance_relative": 1e-9,
        "cases": cases,
    }
    path = OUTPUT_DIR / "golden_values.json"
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return path


# ---------------------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------------------


def minutes(seconds: object) -> str:
    if seconds is None:
        return "never"
    value = float(seconds)
    if value < 90:
        return f"{value:.0f} s"
    if value < 5400:
        return f"{value / 60.0:.1f} min"
    return f"{value / 3600.0:.1f} h"


def report(events: list[simulate.Event]) -> pathlib.Path:
    summary = simulate.summary(events)
    targets = cfg.PACING

    def verdict(actual: object, low: float | None, high: float | None) -> str:
        if actual is None:
            return "FAIL — never happened"
        value = float(actual)
        if low is not None and value < low:
            return f"FAIL — earlier than {minutes(low)}"
        if high is not None and value > high:
            return f"FAIL — later than {minutes(high)}"
        return "pass"

    checks = [
        ("First upgrade affordable", summary["first_purchase_seconds"], None,
         targets.first_purchase_max_seconds),
        ("Player level 4", summary["level_4_seconds"], None, targets.level_4_max_seconds),
        ("First staff hire", summary["first_hire_seconds"], targets.first_hire_min_seconds,
         targets.first_hire_max_seconds),
        ("Shop fully staffed", summary["fully_automated_seconds"], None,
         targets.fully_automated_max_seconds),
        ("Second location open", summary["location_2_seconds"],
         targets.location_2_min_seconds, targets.location_2_max_seconds),
        ("All v1 content bought", summary["content_exhausted_seconds"],
         targets.content_min_seconds, None),
    ]

    lines: list[str] = [
        "# Balance report",
        "",
        "Generated by `tools/balance/generate_tables.py`. Do not edit by hand — change",
        "`tools/balance/config.py` and regenerate.",
        "",
        "All times are **active play**. Offline earnings are not modelled here, so real",
        "elapsed time to each milestone is shorter for anyone collecting an idle reward a",
        "few times a day.",
        "",
        "## Pacing against target",
        "",
        "| Milestone | Simulated | Target | Verdict |",
        "| --- | --- | --- | --- |",
    ]

    for name, actual, low, high in checks:
        if low is not None and high is not None:
            window = f"{minutes(low)} – {minutes(high)}"
        elif high is not None:
            window = f"≤ {minutes(high)}"
        else:
            window = f"≥ {minutes(low)}"
        lines.append(f"| {name} | {minutes(actual)} | {window} | {verdict(actual, low, high)} |")

    lines += [
        "",
        "## Shape of the run",
        "",
        f"- Purchases made: **{summary['purchases']}**",
        f"- Player level reached: **{summary['levels_reached']}**",
        f"- Income at the end: **{float(summary['final_income_rate']):,.0f} cash/sec**",
        f"- Total earned: **{float(summary['total_earned']):,.0f} cash**",
        f"- Longest wait for a hire: **{summary['longest_hire_wall_minutes']:.1f} min**",
        f"- Longest wait for a location: "
        f"**{float(summary['longest_location_wall_minutes']) / 60.0:.1f} h**",
        "",
        "Income plateaus rather than compounding: demand caps throughput, and price and",
        "signage are capped per location. That is the progression invariant holding — the",
        "only way past the ceiling is to open the next street.",
        "",
        "## Gates",
        "",
        "| Time | Wait | Unlock |",
        "| --- | --- | --- |",
    ]

    for event in events:
        if event.kind == "wall":
            wait, _, unlock = event.detail.partition(" to reach: ")
            lines.append(f"| {minutes(event.time_seconds)} | {wait} | {unlock} |")

    lines += [
        "",
        "## What this does not tell you",
        "",
        "The simulation has no geometry, so carry capacity and walking distance are absent",
        "and carry upgrades are excluded from the purchase planner entirely. Arrivals are a",
        "smooth rate, so no customer ever runs out of patience and no combo ever breaks —",
        "the average combo is an input, not a result. Locations are aggregated into one",
        "shop with a rising band rather than several to manage. Rush Hour, events, offline",
        "collection and every gem spend are unmodelled.",
        "",
        "Treat these numbers as a tuning aid. Replace the assumptions in",
        "`SimulationConfig` with measured values as soon as a playable build produces",
        "telemetry.",
        "",
    ]

    path = OUTPUT_DIR / "REPORT.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    events = simulate.run()

    written = [
        station_upgrades(),
        price_upgrades(),
        carry_upgrades(),
        marketing_upgrades(),
        staff_table(),
        locations_table(),
        patience_table(),
        level_table(),
        progression_table(events),
        golden_values(),
        report(events),
    ]

    root = OUTPUT_DIR.parents[1]
    for path in written:
        print(f"wrote {path.relative_to(root)}")


if __name__ == "__main__":
    main()
