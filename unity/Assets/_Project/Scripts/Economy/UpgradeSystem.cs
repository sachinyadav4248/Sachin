using System;
using System.Collections.Generic;
using SizzleStreet.Core;

namespace SizzleStreet.Economy
{
    /// <summary>An upgradeable thing: its cost curve, its current level and its cap.</summary>
    public sealed class UpgradeTrack
    {
        public UpgradeTrack(string id, double baseCost, double growth, int level = 0, int maxLevel = int.MaxValue)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Upgrade id is required.", nameof(id));
            }

            Id = id;
            BaseCost = baseCost;
            Growth = growth;
            Level = level;
            MaxLevel = maxLevel;
        }

        public string Id { get; }

        public double BaseCost { get; }

        public double Growth { get; }

        public int Level { get; private set; }

        /// <summary>
        /// Upper bound on level. Price and signage are capped per unlocked location, so this
        /// moves as the player expands rather than being fixed at construction.
        /// </summary>
        public int MaxLevel { get; set; }

        public bool IsMaxed => Level >= MaxLevel;

        internal void SetLevel(int level) => Level = Math.Max(0, level);

        internal void Increment(int count) => Level += Math.Max(0, count);
    }

    /// <summary>
    /// Prices upgrades, validates purchases and applies them.
    /// </summary>
    /// <remarks>
    /// Every cost passes through <see cref="CostBand"/>, the multiplier that scales all
    /// upgrade prices at the current location. It lives here rather than being baked into
    /// each track's base cost so that expanding re-prices the entire shop in one assignment.
    /// </remarks>
    public sealed class UpgradeSystem
    {
        private readonly IEconomyService _economy;
        private readonly Dictionary<string, UpgradeTrack> _tracks;

        public UpgradeSystem(IEconomyService economy)
        {
            _economy = economy ?? throw new ArgumentNullException(nameof(economy));
            _tracks = new Dictionary<string, UpgradeTrack>(24, StringComparer.Ordinal);
        }

        /// <summary>Multiplier applied to every upgrade price at the current location.</summary>
        public double CostBand { get; set; } = 1.0;

        public void Register(UpgradeTrack track)
        {
            if (track == null)
            {
                throw new ArgumentNullException(nameof(track));
            }

            _tracks[track.Id] = track;
        }

        public UpgradeTrack Get(string id)
        {
            return _tracks.TryGetValue(id, out var track) ? track : null;
        }

        public int LevelOf(string id) => Get(id)?.Level ?? 0;

        /// <summary>Cost of the next level, or <see cref="double.PositiveInfinity"/> if maxed.</summary>
        /// <remarks>
        /// Infinity rather than an exception or zero: a maxed track is a normal state that the
        /// UI asks about every frame, zero would read as free, and comparisons against
        /// infinity behave correctly everywhere a price is used.
        /// </remarks>
        public double NextCost(string id)
        {
            var track = Get(id);
            if (track == null || track.IsMaxed)
            {
                return double.PositiveInfinity;
            }

            return CostBand * EconomyMath.UpgradeCost(track.BaseCost, track.Growth, track.Level);
        }

        /// <summary>Total cost of the next <paramref name="count"/> levels, respecting the cap.</summary>
        public double CostOfNext(string id, int count)
        {
            var track = Get(id);
            if (track == null || count <= 0)
            {
                return 0.0;
            }

            var available = Math.Min(count, track.MaxLevel - track.Level);
            if (available <= 0)
            {
                return double.PositiveInfinity;
            }

            return CostBand * EconomyMath.UpgradeCostRange(track.BaseCost, track.Growth, track.Level, available);
        }

        /// <summary>How many levels the player can afford right now, respecting the cap.</summary>
        public int AffordableLevels(string id)
        {
            var track = Get(id);
            if (track == null || track.IsMaxed)
            {
                return 0;
            }

            var affordable = EconomyMath.MaxAffordableLevels(
                track.BaseCost, track.Growth, track.Level, _economy.Cash / CostBand);

            var headroom = track.MaxLevel - track.Level;
            return Math.Min(affordable, headroom);
        }

        public bool CanBuy(string id) => AffordableLevels(id) >= 1;

        /// <summary>Buys one level. Returns false and changes nothing if it cannot.</summary>
        public bool TryBuy(string id) => TryBuy(id, 1, out _);

        /// <summary>
        /// Buys up to <paramref name="count"/> levels, charging the exact geometric sum.
        /// </summary>
        /// <param name="purchased">Levels actually bought — fewer than asked if the player
        /// cannot afford them all or the cap intervenes.</param>
        /// <remarks>
        /// Charged as one geometric sum rather than a loop of single purchases. Looping would
        /// publish a <see cref="UpgradePurchased"/> per level, which spams the analytics
        /// funnel and fires the celebration animation ten times over.
        /// </remarks>
        public bool TryBuy(string id, int count, out int purchased)
        {
            purchased = 0;
            var track = Get(id);
            if (track == null || count <= 0 || track.IsMaxed)
            {
                return false;
            }

            var available = Math.Min(count, AffordableLevels(id));
            if (available <= 0)
            {
                return false;
            }

            var cost = CostBand * EconomyMath.UpgradeCostRange(
                track.BaseCost, track.Growth, track.Level, available);

            if (!_economy.TrySpend(cost, id))
            {
                return false;
            }

            track.Increment(available);
            purchased = available;
            EventBus.Publish(new UpgradePurchased(track.Id, track.Level, cost));
            return true;
        }

        /// <summary>Restores levels from a save without spending or publishing purchases.</summary>
        public void RestoreLevel(string id, int level)
        {
            Get(id)?.SetLevel(level);
        }

        /// <summary>Raises the caps on the tracks that expand with the player's locations.</summary>
        public void ApplyLocationCaps(int unlockedLocations, int priceLevelsPerLocation, int marketingLevelsPerLocation)
        {
            var price = Get(UpgradeIds.Price);
            if (price != null)
            {
                price.MaxLevel = unlockedLocations * priceLevelsPerLocation;
            }

            var marketing = Get(UpgradeIds.Marketing);
            if (marketing != null)
            {
                marketing.MaxLevel = unlockedLocations * marketingLevelsPerLocation;
            }
        }

        /// <summary>Every registered track, for save writing and the upgrade panel.</summary>
        public IEnumerable<UpgradeTrack> Tracks => _tracks.Values;
    }

    /// <summary>
    /// Identifiers for the tracks the code refers to by name.
    /// </summary>
    /// <remarks>
    /// These strings reach saves and analytics, so they are permanent. Renaming one orphans
    /// the saved level behind it and splits the metric in two.
    /// </remarks>
    public static class UpgradeIds
    {
        public const string Price = "price";
        public const string Marketing = "marketing";
        public const string CarryCapacity = "carry_capacity";

        public static string Station(string stationId) => "station:" + stationId;

        public static string ChannelSlots(string channelId) => "slots:" + channelId;
    }
}
