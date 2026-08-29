using System;
using SizzleStreet.Economy;

namespace SizzleStreet.Simulation
{
    /// <summary>
    /// The combo chain: the one place where paying attention beats walking away.
    /// </summary>
    /// <remarks>
    /// Increments on every completed order and resets to zero the moment any customer gives
    /// up. Rush Hour lifts the cap entirely, which is what turns a two-minute shift into the
    /// only part of the game with a skill ceiling.
    /// </remarks>
    public sealed class ComboTracker
    {
        private readonly double _step;
        private readonly int _cap;

        public ComboTracker(double step, int cap)
        {
            _step = step;
            _cap = Math.Max(0, cap);
        }

        public int Current { get; private set; }

        public int Best { get; private set; }

        /// <summary>Whether the cap is lifted — true only during Rush Hour.</summary>
        public bool IsUncapped { get; set; }

        public double Multiplier => IsUncapped
            ? EconomyMath.ComboBonusUncapped(Current, _step)
            : EconomyMath.ComboBonus(Current, _step, _cap);

        public void Increment()
        {
            Current++;
            if (Current > Best)
            {
                Best = Current;
            }
        }

        /// <summary>Breaks the chain. Called on every abandonment, however many at once.</summary>
        public void Break() => Current = 0;

        /// <summary>Clears the chain and the record. For a new run, not a broken combo.</summary>
        public void Reset()
        {
            Current = 0;
            Best = 0;
        }
    }
}
