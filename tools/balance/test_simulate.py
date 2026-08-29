"""Balance regression tests.

These assert the simulated progression against the pacing targets in ``config.PACING``. A
tuning change that quietly pushes the first hire past half an hour, or lets income run away
again, fails here rather than in soft launch.

They are slow relative to the economy unit tests — a full run simulates thirty hours at one
tick per second — so the run is shared across the whole class.
"""

from __future__ import annotations

import unittest

import config as cfg
import simulate


class PacingTests(unittest.TestCase):
    events: list[simulate.Event]
    summary: dict[str, object]

    @classmethod
    def setUpClass(cls) -> None:
        cls.events = simulate.run(30 * 3600)
        cls.summary = simulate.summary(cls.events)

    def test_the_first_upgrade_is_affordable_within_the_first_minute(self) -> None:
        self.assertLessEqual(
            self.summary["first_purchase_seconds"], cfg.PACING.first_purchase_max_seconds
        )

    def test_the_player_reaches_level_four_inside_four_minutes(self) -> None:
        self.assertIsNotNone(self.summary["level_4_seconds"])
        self.assertLessEqual(
            self.summary["level_4_seconds"], cfg.PACING.level_4_max_seconds
        )

    def test_the_first_hire_lands_in_its_window(self) -> None:
        first_hire = self.summary["first_hire_seconds"]
        self.assertIsNotNone(first_hire, "no staff was ever hired")
        self.assertGreaterEqual(first_hire, cfg.PACING.first_hire_min_seconds)
        self.assertLessEqual(first_hire, cfg.PACING.first_hire_max_seconds)

    def test_the_shop_becomes_self_running_within_the_first_session_or_two(self) -> None:
        automated = self.summary["fully_automated_seconds"]
        self.assertIsNotNone(automated, "the shop never became fully staffed")
        self.assertLessEqual(automated, cfg.PACING.fully_automated_max_seconds)

    def test_no_wall_before_a_hire_is_punishing(self) -> None:
        self.assertLessEqual(
            self.summary["longest_hire_wall_minutes"] * 60.0,
            cfg.PACING.longest_hire_wall_max_seconds,
        )

    def test_the_second_location_is_a_multi_session_goal(self) -> None:
        opened = self.summary["location_2_seconds"]
        self.assertIsNotNone(opened, "the second location was never opened")
        self.assertGreaterEqual(opened, cfg.PACING.location_2_min_seconds)
        self.assertLessEqual(opened, cfg.PACING.location_2_max_seconds)

    def test_v1_has_enough_content_to_reach_day_thirty(self) -> None:
        exhausted = self.summary["content_exhausted_seconds"]
        self.assertIsNotNone(exhausted)
        self.assertGreaterEqual(exhausted, cfg.PACING.content_min_seconds)

    def test_income_does_not_run_away(self) -> None:
        """The progression invariant, checked rather than asserted in prose.

        Demand caps throughput and price is capped per location, so income must plateau
        instead of compounding without bound.
        """
        self.assertLess(self.summary["final_income_rate"], cfg.PACING.max_income_rate)

    def test_income_never_decreases(self) -> None:
        """No purchase may make the player poorer per second.

        A negative-value purchase is always a bug — either a formula sign error or a cost
        band applied to the wrong term — and it is invisible without this check because the
        planner would simply decline to buy it.
        """
        rates = [event.income_rate for event in self.events]
        for previous, current in zip(rates, rates[1:]):
            self.assertGreaterEqual(current, previous - 1e-9)

    def test_every_gate_is_eventually_reachable(self) -> None:
        """Every hire and every location must actually be bought within the horizon.

        A gate priced out of reach is content the player paid attention for and never
        received.
        """
        bought = {
            event.detail
            for event in self.events
            if event.kind == "purchase"
        }
        for station in cfg.STATIONS:
            if station.requires_worker:
                self.assertIn(f"Hire {station.display_name} cook", bought)
        for channel in cfg.CHANNELS:
            self.assertIn(f"Hire {channel.display_name} server", bought)
        for index in range(1, cfg.LOCATIONS.count):
            self.assertIn(f"Open location {index + 1}", bought)


class ModelTests(unittest.TestCase):
    """Properties of the model itself, independent of tuning."""

    def test_a_new_shop_earns_something(self) -> None:
        self.assertGreater(simulate.income_rate(simulate.SimState.new()), 0.0)

    def test_a_new_shop_earns_nothing_while_closed(self) -> None:
        self.assertEqual(simulate.idle_income_rate(simulate.SimState.new()), 0.0)

    def test_offline_income_starts_only_once_the_shop_can_run_itself(self) -> None:
        state = simulate.SimState.new()
        for station in cfg.STATIONS:
            if station.requires_worker:
                state.station_staffed[station.id] = True
        self.assertEqual(
            simulate.idle_income_rate(state),
            0.0,
            "stations are staffed but nobody is serving",
        )

        state.channel_staffed["counter"] = True
        self.assertGreater(simulate.idle_income_rate(state), 0.0)

    def test_hiring_helps_more_than_the_speed_upgrade_it_costs_more_than(self) -> None:
        """The first hire should be the biggest jump available at that moment.

        This is the central claim of the attention model. If a cheap speed upgrade ever
        beats a hire outright, the serial-versus-parallel distinction has collapsed and the
        game has lost the moment it is built around.
        """
        state = simulate.SimState.new()
        before = simulate.income_rate(state)

        hired = state.clone()
        hired.station_staffed["dough"] = True

        upgraded = state.clone()
        upgraded.station_levels["dough"] += 5

        self.assertGreater(
            simulate.income_rate(hired) - before,
            simulate.income_rate(upgraded) - before,
        )

    def test_demand_caps_production(self) -> None:
        """However fast the kitchen gets, it cannot sell to customers who never arrive."""
        state = simulate.SimState.new()
        for station in cfg.STATIONS:
            state.station_levels[station.id] = 200
            state.station_staffed[station.id] = True
        for channel in cfg.CHANNELS:
            state.channel_staffed[channel.id] = True
            state.channel_slot_levels[channel.id] = 50

        self.assertAlmostEqual(
            simulate.throughput(state), simulate.demand_per_second(state), places=6
        )

    def test_expansion_raises_the_ceiling(self) -> None:
        state = simulate.SimState.new()
        expanded = state.clone()
        expanded.location_index = 1
        self.assertGreater(
            simulate.demand_per_second(expanded), simulate.demand_per_second(state)
        )
        self.assertGreater(
            simulate.average_income_per_item(expanded),
            simulate.average_income_per_item(state),
        )


if __name__ == "__main__":
    unittest.main()
