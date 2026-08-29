using System;
using NUnit.Framework;
using SizzleStreet.Economy;

namespace SizzleStreet.Tests
{
    /// <summary>
    /// Asserts the C# economy reproduces the Python reference implementation exactly.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The economy is specified once, in <c>tools/balance/economy.py</c>, and implemented
    /// twice. This is what stops the two drifting. Every case here was produced by running the
    /// Python and writing down what it said; if this class fails, either a formula changed on
    /// one side only, or the generated file is stale and needs
    /// <c>python3 tools/balance/generate_tables.py</c>.
    /// </para>
    /// <para>
    /// The comparison is relative rather than absolute. Values here span from 25 to tens of
    /// millions, and an absolute epsilon that is meaningful at one end is either uselessly
    /// loose or impossibly tight at the other.
    /// </para>
    /// </remarks>
    [TestFixture]
    public sealed class EconomyMathGoldenValueTests
    {
        /// <summary>
        /// Allowed relative difference between the two implementations.
        /// </summary>
        /// <remarks>
        /// Not zero. <c>Math.Pow</c> is not required to be correctly rounded and CPython and
        /// .NET may land an ulp apart on the same input, which is far below anything the game
        /// or a player could observe.
        /// </remarks>
        private const double Tolerance = 1e-9;

        [Test]
        public void EveryGoldenValueIsReproduced([ValueSource(nameof(Cases))] GoldenCase golden)
        {
            var actual = Evaluate(golden);
            var scale = Math.Max(Math.Abs(golden.Expected), 1.0);

            Assert.That(
                Math.Abs(actual - golden.Expected),
                Is.LessThanOrEqualTo(Tolerance * scale),
                $"{golden} expected {golden.Expected:R} but the C# economy produced {actual:R}. " +
                "Either a formula changed on one side only, or the generated golden values are " +
                "stale — rerun tools/balance/generate_tables.py.");
        }

        [Test]
        public void TheGeneratedValuesArePresent()
        {
            // A generator that silently emitted nothing would make every other test in this
            // fixture pass by having no cases to run.
            Assert.That(GoldenValues.Cases, Is.Not.Empty);
        }

        private static GoldenCase[] Cases => GoldenValues.Cases;

        private static double Evaluate(in GoldenCase golden)
        {
            var a = golden.Args;
            switch (golden.Function)
            {
                case "UpgradeCost":
                    return EconomyMath.UpgradeCost(a[0], a[1], (int)a[2]);

                case "UpgradeCostRange":
                    return EconomyMath.UpgradeCostRange(a[0], a[1], (int)a[2], (int)a[3]);

                case "MaxAffordableLevels":
                    return EconomyMath.MaxAffordableLevels(a[0], a[1], (int)a[2], a[3]);

                case "LocationUnlockCost":
                    return EconomyMath.LocationUnlockCost(a[0], a[1], (int)a[2]);

                case "StationOutputPerSecond":
                    return EconomyMath.StationOutputPerSecond(a[0], (int)a[1], a[2], (int)a[3], a[4]);

                case "ComboBonus":
                    return EconomyMath.ComboBonus((int)a[0], a[1], (int)a[2]);

                case "ComboBonusUncapped":
                    return EconomyMath.ComboBonusUncapped((int)a[0], a[1]);

                case "OfflineEarnings":
                    return EconomyMath.OfflineEarnings(a[0], a[1], a[2], a[3], a[4]);

                case "ElapsedSeconds":
                    return EconomyMath.ElapsedSeconds(a[0], a[1]);

                case "IdleRate":
                    // Layout: four station rates, four automation flags as 1/0, serve
                    // capacity, average income. Fixed by the generator in generate_tables.py.
                    return EconomyMath.IdleRate(
                        new[] { a[0], a[1], a[2], a[3] },
                        new[] { a[4] > 0.5, a[5] > 0.5, a[6] > 0.5, a[7] > 0.5 },
                        a[8],
                        a[9]);

                case "PrestigeMultiplier":
                    return EconomyMath.PrestigeMultiplier(a[0], a[1], a[2]);

                default:
                    throw new NotSupportedException(
                        $"No C# binding for golden function '{golden.Function}'. A case was added " +
                        "to generate_tables.py without a corresponding branch here.");
            }
        }
    }
}
