using System;
using SizzleStreet.Core;
using SizzleStreet.Economy.Model;

namespace SizzleStreet.Economy
{
    /// <summary>What the player is owed for an absence.</summary>
    public readonly struct OfflineReward
    {
        /// <summary>Seconds actually credited, after the cap and the clock check.</summary>
        public readonly double CreditedSeconds;

        /// <summary>Real seconds away, before the cap — for the "you were away 9h" line.</summary>
        public readonly double ElapsedSeconds;

        public readonly double BaseAmount;

        public readonly bool WasCapped;

        /// <summary>True when the device clock had moved backwards and nothing was credited.</summary>
        public readonly bool ClockMovedBackwards;

        public OfflineReward(
            double creditedSeconds,
            double elapsedSeconds,
            double baseAmount,
            bool wasCapped,
            bool clockMovedBackwards)
        {
            CreditedSeconds = creditedSeconds;
            ElapsedSeconds = elapsedSeconds;
            BaseAmount = baseAmount;
            WasCapped = wasCapped;
            ClockMovedBackwards = clockMovedBackwards;
        }

        public bool HasReward => BaseAmount > 0.0;
    }

    /// <summary>
    /// Works out offline earnings, and refuses to be talked into inventing time.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the one system that trusts the client about the clock, so it is the one built
    /// to be suspicious. A backwards clock credits nothing and the stored timestamp is
    /// repaired forward. A player who advances their clock will still gain time — there is no
    /// server to check against — but the cap bounds how much, which is the main reason the cap
    /// is four hours rather than a day.
    /// </para>
    /// <para>
    /// The idle rate is supplied by the caller and is zero unless every post that needs a
    /// worker is staffed. A shop that visibly could not run itself never earns while closed.
    /// </para>
    /// </remarks>
    public sealed class OfflineEarningsCalculator
    {
        private readonly IEconomySettings _settings;
        private readonly IClock _clock;

        public OfflineEarningsCalculator(IEconomySettings settings, IClock clock)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));
        }

        /// <summary>Optional Remote Config override for the cap, in seconds.</summary>
        public double? CapSecondsOverride { get; set; }

        private double CapSeconds => CapSecondsOverride ?? _settings.OfflineCapSeconds;

        /// <summary>Calculates what is owed. Pure — grants nothing and changes no state.</summary>
        /// <param name="lastSaveUnix">When the save was written.</param>
        /// <param name="idleRatePerSecond">Cash per second with the player absent.</param>
        public OfflineReward Calculate(double lastSaveUnix, double idleRatePerSecond)
        {
            var now = _clock.NowUnixSeconds;
            var wentBackwards = now < lastSaveUnix;

            var elapsed = EconomyMath.ElapsedSeconds(now, lastSaveUnix);
            var cap = CapSeconds;
            var credited = Math.Min(elapsed, cap);

            var amount = EconomyMath.OfflineEarnings(
                elapsed, cap, Math.Max(0.0, idleRatePerSecond), _settings.OfflineEfficiency);

            return new OfflineReward(credited, elapsed, amount, elapsed > cap, wentBackwards);
        }

        /// <summary>The doubled amount a rewarded ad would grant.</summary>
        public double DoubledAmount(in OfflineReward reward)
        {
            return reward.BaseAmount * _settings.OfflineRewardMultiplier;
        }

        /// <summary>
        /// Grants the reward and announces it.
        /// </summary>
        /// <param name="doubled">
        /// Whether a rewarded ad was watched to completion. The caller must only pass true
        /// after the ad SDK's own completion callback — never on the button press, which is
        /// how a closed ad ends up paying out.
        /// </param>
        public void Grant(IEconomyService economy, in OfflineReward reward, bool doubled)
        {
            if (economy == null)
            {
                throw new ArgumentNullException(nameof(economy));
            }

            if (!reward.HasReward)
            {
                return;
            }

            var amount = doubled ? DoubledAmount(reward) : reward.BaseAmount;
            economy.Earn(amount, doubled ? "offline_doubled" : "offline");
            EventBus.Publish(new OfflineEarningsClaimed(amount, doubled));
        }
    }
}
