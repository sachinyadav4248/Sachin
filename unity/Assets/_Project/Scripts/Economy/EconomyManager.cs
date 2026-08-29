using System;
using SizzleStreet.Core;
using SizzleStreet.Economy.Model;

namespace SizzleStreet.Economy
{
    /// <summary>The player's balances and the rules for changing them.</summary>
    public interface IEconomyService
    {
        double Cash { get; }

        int Gems { get; }

        /// <summary>Lifetime cash earned. Drives player level and, later, prestige.</summary>
        double TotalEarned { get; }

        int PlayerLevel { get; }

        /// <summary>Progress towards the next level, in the range [0, 1].</summary>
        float LevelProgress { get; }

        void Earn(double amount, string source);

        /// <summary>Spends if affordable. Returns false and changes nothing if not.</summary>
        bool TrySpend(double amount, string sink);

        /// <summary>Whether <paramref name="amount"/> is affordable, at the same tolerance as <see cref="TrySpend"/>.</summary>
        bool CanAfford(double amount);

        void AddGems(int amount, string source);

        bool TrySpendGems(int amount, string sink);
    }

    /// <summary>
    /// Holds the balances, applies earnings and spends, and tracks player level.
    /// </summary>
    /// <remarks>
    /// Deliberately small. It owns two numbers and the rules for changing them, and it knows
    /// nothing about what those numbers are spent on — upgrades, staff and locations all go
    /// through <see cref="TrySpend"/> and price themselves. Everything else in the game
    /// discovers a balance change by subscribing to <see cref="CashChanged"/>.
    /// </remarks>
    public sealed class EconomyManager : IEconomyService
    {
        private readonly IEconomySettings _settings;

        private double _cash;
        private int _gems;
        private double _totalEarned;
        private int _playerLevel;

        public EconomyManager(IEconomySettings settings, double cash, int gems, double totalEarned)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _cash = Math.Max(0.0, cash);
            _gems = Math.Max(0, gems);
            _totalEarned = Math.Max(0.0, totalEarned);
            _playerLevel = LevelFor(_totalEarned);
        }

        public double Cash => _cash;

        public int Gems => _gems;

        public double TotalEarned => _totalEarned;

        public int PlayerLevel => _playerLevel;

        public float LevelProgress
        {
            get
            {
                if (_playerLevel >= _settings.MaxPlayerLevel)
                {
                    return 1f;
                }

                var current = ThresholdFor(_playerLevel);
                var next = ThresholdFor(_playerLevel + 1);
                var span = next - current;
                if (span <= 0.0)
                {
                    return 1f;
                }

                var progress = (_totalEarned - current) / span;
                return (float)Math.Clamp(progress, 0.0, 1.0);
            }
        }

        /// <summary>Adds cash and advances the level if the new total crosses a threshold.</summary>
        /// <remarks>
        /// A non-positive amount is ignored rather than rejected. Callers include the serving
        /// code, which can legitimately compute a zero payout during a Rush Hour transition,
        /// and throwing there would be an exception on the core loop for a non-event.
        /// </remarks>
        public void Earn(double amount, string source)
        {
            if (amount <= 0.0 || double.IsNaN(amount) || double.IsInfinity(amount))
            {
                return;
            }

            _cash += amount;
            _totalEarned += amount;
            EventBus.Publish(new CashChanged(_cash, amount));

            // A single large grant — an offline claim, a location payout — can cross more than
            // one threshold at once, so this loops rather than testing once.
            var target = LevelFor(_totalEarned);
            while (_playerLevel < target)
            {
                _playerLevel++;
                EventBus.Publish(new PlayerLeveledUp(_playerLevel, _totalEarned));
            }
        }

        public bool CanAfford(double amount)
        {
            if (amount <= 0.0)
            {
                return true;
            }

            // Matched to EconomyMath.BoundaryTolerance so a bulk buy priced at exactly the
            // player's balance is affordable here too. Without the same slack on both sides,
            // MaxAffordableLevels offers a purchase that TrySpend then refuses.
            return amount <= _cash * (1.0 + EconomyMath.BoundaryTolerance);
        }

        public bool TrySpend(double amount, string sink)
        {
            if (amount <= 0.0)
            {
                return true;
            }

            if (double.IsNaN(amount) || double.IsInfinity(amount) || !CanAfford(amount))
            {
                return false;
            }

            // Clamped because CanAfford allows a relative 1e-9 of slack on an exact boundary.
            // A balance that drifts a fraction below zero would then fail every subsequent
            // affordability check for reasons no player could ever diagnose.
            _cash = Math.Max(0.0, _cash - amount);
            EventBus.Publish(new CashChanged(_cash, -amount));
            return true;
        }

        public void AddGems(int amount, string source)
        {
            if (amount <= 0)
            {
                return;
            }

            _gems += amount;
            EventBus.Publish(new GemsChanged(_gems, amount));
        }

        public bool TrySpendGems(int amount, string sink)
        {
            if (amount <= 0)
            {
                return true;
            }

            if (amount > _gems)
            {
                return false;
            }

            _gems -= amount;
            EventBus.Publish(new GemsChanged(_gems, -amount));
            return true;
        }

        /// <summary>Restores balances from a save without emitting earn or level-up events.</summary>
        /// <remarks>
        /// Loading is not earning. Routing a load through <see cref="Earn"/> would fire a
        /// level-up celebration for every level the player already had, on every launch.
        /// </remarks>
        public void RestoreFromSave(double cash, int gems, double totalEarned)
        {
            _cash = Math.Max(0.0, cash);
            _gems = Math.Max(0, gems);
            _totalEarned = Math.Max(0.0, totalEarned);
            _playerLevel = LevelFor(_totalEarned);
            EventBus.Publish(new CashChanged(_cash, 0.0));
            EventBus.Publish(new GemsChanged(_gems, 0));
        }

        private int LevelFor(double totalEarned)
        {
            var level = 1;
            while (level < _settings.MaxPlayerLevel && totalEarned >= ThresholdFor(level + 1))
            {
                level++;
            }

            return level;
        }

        private double ThresholdFor(int level)
        {
            return EconomyMath.LevelThreshold(
                _settings.LevelThresholdBase, _settings.LevelThresholdGrowth, level);
        }
    }
}
