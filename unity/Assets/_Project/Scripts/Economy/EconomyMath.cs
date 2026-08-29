using System;
using System.Collections.Generic;

namespace SizzleStreet.Economy
{
    /// <summary>
    /// Every formula the economy runs on. Pure, static, and free of Unity.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is a port. The specification is <c>tools/balance/economy.py</c>, and
    /// <c>data/balance/golden_values.json</c> pins the two together: the Python generates the
    /// expected values, and <c>EconomyMathGoldenValueTests</c> asserts this class reproduces
    /// every one of them. Change a formula here without changing it there and the tests fail,
    /// which is the point.
    /// </para>
    /// <para>
    /// Everything is <see cref="double"/>. Late-game balances leave <see cref="float"/>
    /// precision behind long before they approach the limits of a double, and a rounding
    /// error in a balance is a player's progress quietly evaporating.
    /// </para>
    /// </remarks>
    public static class EconomyMath
    {
        /// <summary>
        /// Guard band for a per-level growth factor. At or below 1.0 costs never rise and
        /// progression is unbounded; much above 1.3 and the second level is already out of
        /// reach. Either is a balance mistake rather than a deliberate choice, so it throws.
        /// </summary>
        public const double MinGrowth = 1.0000001;

        /// <inheritdoc cref="MinGrowth"/>
        public const double MaxGrowth = 1.30;

        /// <summary>
        /// Relative slack when comparing a purse against an exact cost boundary. Well above
        /// double-precision noise, far below anything a player could notice.
        /// </summary>
        public const double BoundaryTolerance = 1e-9;

        /// <summary>Cost of the upgrade that moves <paramref name="level"/> to the next.</summary>
        /// <param name="level">The current level, zero-indexed, so the first purchase costs
        /// exactly <paramref name="baseCost"/>.</param>
        public static double UpgradeCost(double baseCost, double growth, int level)
        {
            Validate(baseCost, growth, level);
            return baseCost * Math.Pow(growth, level);
        }

        /// <summary>Total cost of <paramref name="count"/> consecutive levels from <paramref name="level"/>.</summary>
        /// <remarks>
        /// The closed-form geometric sum. Looping <see cref="UpgradeCost"/> gives the same
        /// answer but accumulates rounding error across long ranges and costs O(n) on a path
        /// the bulk-buy UI hits every time the player's balance ticks up.
        /// </remarks>
        public static double UpgradeCostRange(double baseCost, double growth, int level, int count)
        {
            Validate(baseCost, growth, level);
            if (count < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(count), count, "Count must be non-negative.");
            }

            if (count == 0)
            {
                return 0.0;
            }

            return baseCost * Math.Pow(growth, level) * (Math.Pow(growth, count) - 1.0) / (growth - 1.0);
        }

        /// <summary>How many consecutive levels <paramref name="cash"/> buys from <paramref name="level"/>.</summary>
        /// <remarks>
        /// <para>
        /// Inverts the geometric sum, then corrects the result in both directions against
        /// <see cref="UpgradeCostRange"/>. Both corrections are needed. Two logarithms and a
        /// division can leave the quotient a fraction of an ulp below an integer, and
        /// <c>Floor</c> then discards a whole level — a player holding exactly enough for
        /// seven is sold six, which reads as the game cheating them. The opposite error
        /// overcharges, which is worse.
        /// </para>
        /// <para>
        /// Because the tolerance is relative, the returned count can cost up to a relative
        /// 1e-9 more than <paramref name="cash"/> when the purse sits exactly on a boundary.
        /// Callers must clamp the charge to the available balance;
        /// <see cref="EconomyManager"/> does.
        /// </para>
        /// </remarks>
        public static int MaxAffordableLevels(double baseCost, double growth, int level, double cash)
        {
            Validate(baseCost, growth, level);
            if (cash <= 0.0)
            {
                return 0;
            }

            var first = UpgradeCost(baseCost, growth, level);
            if (cash < first)
            {
                return 0;
            }

            var budget = cash * (1.0 + BoundaryTolerance);
            var ratio = 1.0 + cash * (growth - 1.0) / first;
            var count = (int)Math.Floor(Math.Log(ratio) / Math.Log(growth));

            while (UpgradeCostRange(baseCost, growth, level, count + 1) <= budget)
            {
                count++;
            }

            while (count > 0 && UpgradeCostRange(baseCost, growth, level, count) > budget)
            {
                count--;
            }

            return count;
        }

        /// <summary>Cost to open the location after <paramref name="index"/>.</summary>
        /// <remarks>
        /// Deliberately not <see cref="UpgradeCost"/>. Upgrade growth is guarded to a narrow
        /// band; a location is not a level. There are three of them, each is a multi-session
        /// goal, and the step between them is enormous by design. Sharing the guard band
        /// would mean either rejecting a legitimate location curve or widening the band far
        /// enough to let a broken upgrade curve through unnoticed.
        /// </remarks>
        public static double LocationUnlockCost(double baseCost, double growth, int index)
        {
            if (baseCost < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(baseCost), baseCost, "Base cost must be non-negative.");
            }

            if (growth <= 1.0)
            {
                throw new ArgumentOutOfRangeException(nameof(growth), growth, "Location growth must exceed 1.");
            }

            if (index < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(index), index, "Index must be non-negative.");
            }

            return baseCost * Math.Pow(growth, index);
        }

        /// <summary>Units per second produced by one kind of station.</summary>
        /// <param name="count">Parallel units owned. A second oven is a purchase, not a
        /// level, and it multiplies output rather than compounding the level curve.</param>
        public static double StationOutputPerSecond(
            double baseOutput, int count, double speedPerLevel, int level, double staffMultiplier = 1.0)
        {
            if (baseOutput < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(baseOutput));
            }

            if (count < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(count));
            }

            if (level < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(level));
            }

            if (staffMultiplier < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(staffMultiplier));
            }

            return baseOutput * count * Math.Pow(speedPerLevel, level) * staffMultiplier;
        }

        /// <summary>Income multiplier from the current combo chain, capped for normal play.</summary>
        public static double ComboBonus(int combo, double comboStep, int comboCap)
        {
            if (combo < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(combo));
            }

            var effective = combo < comboCap ? combo : comboCap;
            return 1.0 + comboStep * effective;
        }

        /// <summary>Combo bonus with no cap — Rush Hour, and only Rush Hour.</summary>
        public static double ComboBonusUncapped(int combo, double comboStep)
        {
            if (combo < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(combo));
            }

            return 1.0 + comboStep * combo;
        }

        /// <summary>Combined multiplier applied to an item's base price.</summary>
        public static double PriceMultiplier(
            double priceGrowth, int priceLevel, double locationBand = 1.0, double prestigeMultiplier = 1.0)
        {
            if (priceLevel < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(priceLevel));
            }

            return Math.Pow(priceGrowth, priceLevel) * locationBand * prestigeMultiplier;
        }

        /// <summary>Cash paid for a single served item.</summary>
        public static double IncomePerItem(
            double basePrice, double priceMultiplier, double comboMultiplier = 1.0, double channelMultiplier = 1.0)
        {
            return basePrice * priceMultiplier * comboMultiplier * channelMultiplier;
        }

        /// <summary>Items per second delivered by a serial chain — the rate of its slowest stage.</summary>
        /// <remarks>
        /// An empty chain produces nothing rather than throwing: a location mid-construction
        /// legitimately has no stations yet.
        /// </remarks>
        public static double ChainThroughput(IReadOnlyList<double> stationRates)
        {
            if (stationRates == null || stationRates.Count == 0)
            {
                return 0.0;
            }

            var slowest = double.MaxValue;
            for (var i = 0; i < stationRates.Count; i++)
            {
                var rate = stationRates[i];
                if (rate < 0.0)
                {
                    throw new ArgumentOutOfRangeException(nameof(stationRates), rate, "Rates must be non-negative.");
                }

                if (rate < slowest)
                {
                    slowest = rate;
                }
            }

            return slowest;
        }

        /// <summary>Cash per second the shop earns with the player absent.</summary>
        /// <remarks>
        /// An unautomated post contributes a rate of zero, which takes the whole chain to
        /// zero. That is deliberate on two counts: it is the strongest argument the game makes
        /// for hiring staff, and it means a shop that visibly could not run itself can never
        /// earn while closed.
        /// </remarks>
        public static double IdleRate(
            IReadOnlyList<double> stationRates,
            IReadOnlyList<bool> automated,
            double serveCapacityPerSecond,
            double averageIncomePerItem)
        {
            if (stationRates == null)
            {
                throw new ArgumentNullException(nameof(stationRates));
            }

            if (automated == null)
            {
                throw new ArgumentNullException(nameof(automated));
            }

            if (stationRates.Count != automated.Count)
            {
                throw new ArgumentException("Station rates and automation flags must be the same length.");
            }

            if (serveCapacityPerSecond < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(serveCapacityPerSecond));
            }

            var throughput = double.MaxValue;
            for (var i = 0; i < stationRates.Count; i++)
            {
                var rate = automated[i] ? stationRates[i] : 0.0;
                if (rate < throughput)
                {
                    throughput = rate;
                }
            }

            if (stationRates.Count == 0 || throughput <= 0.0)
            {
                return 0.0;
            }

            var served = Math.Min(throughput, serveCapacityPerSecond);
            return served * averageIncomePerItem;
        }

        /// <summary>Seconds of absence that may be credited between two timestamps.</summary>
        /// <remarks>
        /// A negative interval means the device clock moved backwards — travel, a manual
        /// change, or a deliberate exploit. It credits zero. This function refuses to invent
        /// time; repairing the stored timestamp is the caller's job.
        /// </remarks>
        public static double ElapsedSeconds(double nowUnix, double lastSaveUnix)
        {
            var delta = nowUnix - lastSaveUnix;
            return delta > 0.0 ? delta : 0.0;
        }

        /// <summary>Cash granted for an absence: linear to the cap, flat beyond it.</summary>
        public static double OfflineEarnings(
            double elapsed, double capSeconds, double ratePerSecond, double efficiency, double rewardMultiplier = 1.0)
        {
            if (capSeconds < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(capSeconds));
            }

            if (ratePerSecond < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(ratePerSecond));
            }

            if (efficiency < 0.0 || efficiency > 1.0)
            {
                throw new ArgumentOutOfRangeException(nameof(efficiency), efficiency, "Efficiency must be within [0, 1].");
            }

            if (rewardMultiplier < 1.0)
            {
                // A "doubler" that pays less than the base reward is always a bug, and one
                // that would be very hard to spot from the outside.
                throw new ArgumentOutOfRangeException(
                    nameof(rewardMultiplier), rewardMultiplier, "Reward multiplier must be at least 1.");
            }

            var credited = Math.Min(Math.Max(elapsed, 0.0), capSeconds);
            return credited * ratePerSecond * efficiency * rewardMultiplier;
        }

        /// <summary>Permanent multiplier granted by resetting a run.</summary>
        /// <remarks>
        /// Square root rather than linear, so each successive reset is worth less than the one
        /// before and prestige never becomes the only action worth taking.
        /// </remarks>
        public static double PrestigeMultiplier(double totalEarned, double k, double scale)
        {
            if (scale <= 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(scale));
            }

            return totalEarned <= 0.0 ? 1.0 : 1.0 + k * Math.Sqrt(totalEarned / scale);
        }

        /// <summary>Cumulative earnings needed to reach <paramref name="level"/>.</summary>
        public static double LevelThreshold(double baseThreshold, double growth, int level)
        {
            return level <= 1 ? 0.0 : baseThreshold * Math.Pow(growth, level - 2);
        }

        /// <summary>Income gained per unit of cash spent — the ranking heuristic for upgrades.</summary>
        /// <remarks>
        /// A free improvement is infinitely good and a purchase that improves nothing is
        /// worthless. Both are returned as such rather than throwing, because callers rank
        /// candidates and need a total order over them.
        /// </remarks>
        public static double MarginalValue(double deltaRate, double cost)
        {
            if (deltaRate <= 0.0)
            {
                return 0.0;
            }

            return cost <= 0.0 ? double.PositiveInfinity : deltaRate / cost;
        }

        private static void Validate(double baseCost, double growth, int level)
        {
            if (baseCost < 0.0)
            {
                throw new ArgumentOutOfRangeException(nameof(baseCost), baseCost, "Base cost must be non-negative.");
            }

            if (growth < MinGrowth || growth > MaxGrowth)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(growth), growth, $"Growth must be within [{MinGrowth}, {MaxGrowth}].");
            }

            if (level < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(level), level, "Level must be non-negative.");
            }
        }
    }
}
