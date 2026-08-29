"""Tests for the economy reference implementation.

These cover the properties the game depends on rather than restating the formulas: that
bulk buying never overcharges, that time can never be invented, that an unautomated shop
earns nothing while closed.
"""

from __future__ import annotations

import math
import unittest

import economy as econ


class UpgradeCostTests(unittest.TestCase):
    def test_first_purchase_costs_the_base(self) -> None:
        self.assertAlmostEqual(econ.upgrade_cost(25.0, 1.09, 0), 25.0)

    def test_cost_compounds_geometrically(self) -> None:
        self.assertAlmostEqual(econ.upgrade_cost(25.0, 1.09, 3), 25.0 * 1.09 ** 3)

    def test_range_matches_the_sum_of_its_levels(self) -> None:
        base, growth, start, count = 90.0, 1.12, 4, 30
        expected = sum(
            econ.upgrade_cost(base, growth, level)
            for level in range(start, start + count)
        )
        self.assertAlmostEqual(
            econ.upgrade_cost_range(base, growth, start, count), expected, places=6
        )

    def test_empty_range_is_free(self) -> None:
        self.assertEqual(econ.upgrade_cost_range(90.0, 1.12, 4, 0), 0.0)

    def test_growth_outside_the_band_is_rejected(self) -> None:
        for bad in (0.5, 1.0, 1.5, 2.0):
            with self.subTest(growth=bad), self.assertRaises(ValueError):
                econ.upgrade_cost(25.0, bad, 0)

    def test_negative_level_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            econ.upgrade_cost(25.0, 1.09, -1)


class MaxAffordableTests(unittest.TestCase):
    def test_nothing_affordable_with_no_cash(self) -> None:
        self.assertEqual(econ.max_affordable_levels(25.0, 1.09, 0, 0.0), 0)
        self.assertEqual(econ.max_affordable_levels(25.0, 1.09, 0, 24.99), 0)

    def test_exactly_enough_buys_exactly_one(self) -> None:
        self.assertEqual(econ.max_affordable_levels(25.0, 1.09, 0, 25.0), 1)

    def test_never_overspends(self) -> None:
        """The property that matters: a bulk buy must never cost more than the player has.

        Swept across bases, growths, starting levels and purses, including purses sitting
        exactly on a boundary where the closed-form inverse is most likely to round up.
        """
        for base in (25.0, 90.0, 1234.5):
            for growth in (1.07, 1.10, 1.15):
                for start in (0, 5, 30):
                    for count in (1, 3, 17):
                        exact = econ.upgrade_cost_range(base, growth, start, count)
                        for cash in (exact, exact * 0.999999, exact * 1.000001, exact + 1):
                            with self.subTest(
                                base=base, growth=growth, start=start, cash=cash
                            ):
                                affordable = econ.max_affordable_levels(
                                    base, growth, start, cash
                                )
                                spent = econ.upgrade_cost_range(
                                    base, growth, start, affordable
                                )
                                self.assertLessEqual(
                                    spent, cash * (1.0 + econ.BOUNDARY_TOLERANCE) + 1e-9
                                )

    def test_buys_as_many_as_it_can(self) -> None:
        """Not overspending is trivially satisfied by always returning zero."""
        base, growth, start = 25.0, 1.09, 2
        cash = econ.upgrade_cost_range(base, growth, start, 7)
        self.assertEqual(econ.max_affordable_levels(base, growth, start, cash), 7)

    def test_one_more_level_would_overspend(self) -> None:
        base, growth, start, cash = 45.0, 1.10, 3, 5000.0
        affordable = econ.max_affordable_levels(base, growth, start, cash)
        self.assertGreater(
            econ.upgrade_cost_range(base, growth, start, affordable + 1), cash
        )


class LocationCostTests(unittest.TestCase):
    def test_first_location_costs_the_base(self) -> None:
        self.assertAlmostEqual(econ.location_unlock_cost(85_000.0, 250.0, 0), 85_000.0)

    def test_accepts_growth_far_outside_the_upgrade_band(self) -> None:
        self.assertAlmostEqual(
            econ.location_unlock_cost(85_000.0, 250.0, 1), 85_000.0 * 250.0
        )

    def test_rejects_non_growth(self) -> None:
        for bad in (1.0, 0.9, 0.0):
            with self.subTest(growth=bad), self.assertRaises(ValueError):
                econ.location_unlock_cost(85_000.0, bad, 0)


class ProductionTests(unittest.TestCase):
    def test_level_zero_produces_the_base_rate(self) -> None:
        self.assertAlmostEqual(
            econ.station_output_per_second(0.8, 1, 1.07, 0), 0.8
        )

    def test_parallel_units_multiply(self) -> None:
        self.assertAlmostEqual(
            econ.station_output_per_second(0.8, 3, 1.07, 0), 2.4
        )

    def test_a_serial_chain_runs_at_its_slowest_stage(self) -> None:
        self.assertAlmostEqual(econ.chain_throughput([0.8, 0.7, 0.45, 0.9]), 0.45)

    def test_an_empty_chain_produces_nothing(self) -> None:
        self.assertEqual(econ.chain_throughput([]), 0.0)


class ComboTests(unittest.TestCase):
    def test_no_combo_is_no_bonus(self) -> None:
        self.assertAlmostEqual(econ.combo_bonus(0, 0.05, 10), 1.0)

    def test_bonus_is_capped_during_normal_play(self) -> None:
        self.assertAlmostEqual(econ.combo_bonus(10, 0.05, 10), 1.5)
        self.assertAlmostEqual(econ.combo_bonus(400, 0.05, 10), 1.5)

    def test_rush_hour_lifts_the_cap(self) -> None:
        self.assertAlmostEqual(econ.combo_bonus(40, 0.05, None), 3.0)


class OfflineTests(unittest.TestCase):
    def test_accrues_linearly_below_the_cap(self) -> None:
        self.assertAlmostEqual(
            econ.offline_earnings(3600, 4 * 3600, 10.0, 0.5), 3600 * 10.0 * 0.5
        )

    def test_flattens_at_the_cap(self) -> None:
        capped = econ.offline_earnings(4 * 3600, 4 * 3600, 10.0, 0.5)
        beyond = econ.offline_earnings(48 * 3600, 4 * 3600, 10.0, 0.5)
        self.assertAlmostEqual(capped, beyond)

    def test_the_doubler_doubles(self) -> None:
        base = econ.offline_earnings(3600, 4 * 3600, 10.0, 0.5)
        doubled = econ.offline_earnings(3600, 4 * 3600, 10.0, 0.5, reward_multiplier=2.0)
        self.assertAlmostEqual(doubled, base * 2.0)

    def test_a_shop_that_cannot_run_itself_earns_nothing(self) -> None:
        self.assertEqual(
            econ.offline_earnings(10 * 3600, 4 * 3600, 0.0, 0.5), 0.0
        )

    def test_negative_absence_earns_nothing(self) -> None:
        self.assertEqual(econ.offline_earnings(-500, 4 * 3600, 10.0, 0.5), 0.0)

    def test_efficiency_outside_the_unit_range_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            econ.offline_earnings(60, 3600, 1.0, 1.5)

    def test_a_reward_multiplier_below_one_is_rejected(self) -> None:
        """A "doubler" that pays less than the base reward is always a bug."""
        with self.assertRaises(ValueError):
            econ.offline_earnings(60, 3600, 1.0, 0.5, reward_multiplier=0.5)


class ClockTests(unittest.TestCase):
    def test_normal_absence_is_credited(self) -> None:
        self.assertAlmostEqual(econ.elapsed_seconds(1_000_600.0, 1_000_000.0), 600.0)

    def test_a_backwards_clock_credits_nothing(self) -> None:
        self.assertEqual(econ.elapsed_seconds(1_000_000.0, 1_000_600.0), 0.0)

    def test_a_wildly_backwards_clock_credits_nothing(self) -> None:
        """Setting the device clock to 1970 must not pay out, nor go negative."""
        self.assertEqual(econ.elapsed_seconds(0.0, 1_700_000_000.0), 0.0)


class IdleRateTests(unittest.TestCase):
    def test_a_fully_automated_shop_earns(self) -> None:
        rate = econ.idle_rate([0.8, 0.7, 0.45, 0.9], [True] * 4, 10.0, 4.0)
        self.assertAlmostEqual(rate, 0.45 * 4.0)

    def test_one_unautomated_station_stops_the_chain(self) -> None:
        rate = econ.idle_rate([0.8, 0.7, 0.45, 0.9], [True, True, False, True], 10.0, 4.0)
        self.assertEqual(rate, 0.0)

    def test_serving_capacity_can_bind_before_production(self) -> None:
        rate = econ.idle_rate([0.8, 0.7, 0.45, 0.9], [True] * 4, 0.2, 4.0)
        self.assertAlmostEqual(rate, 0.2 * 4.0)

    def test_mismatched_inputs_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            econ.idle_rate([0.8, 0.7], [True], 1.0, 1.0)


class PrestigeTests(unittest.TestCase):
    def test_a_run_that_earned_nothing_grants_nothing(self) -> None:
        self.assertAlmostEqual(econ.prestige_multiplier(0.0, 1.0, 1e6), 1.0)

    def test_the_documented_anchor_points_hold(self) -> None:
        self.assertAlmostEqual(econ.prestige_multiplier(1e6, 1.0, 1e6), 2.0)
        self.assertAlmostEqual(econ.prestige_multiplier(4e6, 1.0, 1e6), 3.0)

    def test_returns_diminish(self) -> None:
        """Each doubling of earnings must be worth less than the one before it, or prestige
        becomes the only action worth taking."""
        first = econ.prestige_multiplier(1e6, 1.0, 1e6) - 1.0
        second = econ.prestige_multiplier(2e6, 1.0, 1e6) - econ.prestige_multiplier(1e6, 1.0, 1e6)
        self.assertLess(second, first)


class MarginalValueTests(unittest.TestCase):
    def test_a_useless_purchase_is_worthless(self) -> None:
        self.assertEqual(econ.marginal_value(0.0, 100.0), 0.0)
        self.assertEqual(econ.marginal_value(-1.0, 100.0), 0.0)

    def test_a_free_improvement_is_infinitely_good(self) -> None:
        self.assertEqual(econ.marginal_value(1.0, 0.0), math.inf)

    def test_cheaper_is_better_for_the_same_gain(self) -> None:
        self.assertGreater(econ.marginal_value(1.0, 10.0), econ.marginal_value(1.0, 20.0))


if __name__ == "__main__":
    unittest.main()
