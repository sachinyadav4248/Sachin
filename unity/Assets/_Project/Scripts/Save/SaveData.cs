using System;
using System.Collections.Generic;

namespace SizzleStreet.Save
{
    /// <summary>
    /// Everything about one player's progress, as a plain serialisable graph.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Deliberately separate from the balance configuration. Changing a cost curve changes a
    /// ScriptableObject, not a save, so a balance patch never touches anyone's progress.
    /// </para>
    /// <para>
    /// Every field here is permanent. Renaming one orphans the data behind it in every
    /// existing save, and there is no way to get it back. Add fields; do not repurpose them.
    /// </para>
    /// </remarks>
    [Serializable]
    public sealed class SaveData
    {
        /// <summary>
        /// Schema version, written from the first build.
        /// </summary>
        /// <remarks>
        /// Versioning from v1 costs nothing now. Retrofitting it onto saves already on
        /// players' devices is not possible, because there is no way to tell an unversioned
        /// save from a v1 one.
        /// </remarks>
        public int SchemaVersion { get; set; } = CurrentSchemaVersion;

        public const int CurrentSchemaVersion = 1;

        /// <summary>Unix seconds when this save was written. The basis for offline earnings.</summary>
        public double SavedAtUnix { get; set; }

        public PlayerState Player { get; set; } = new PlayerState();

        public EconomyState Economy { get; set; } = new EconomyState();

        public List<LocationSaveState> Locations { get; set; } = new List<LocationSaveState>();

        public MetaState Meta { get; set; } = new MetaState();

        /// <summary>A save for a player who has never played.</summary>
        public static SaveData NewGame(double nowUnix, double startingCash, int startingGems)
        {
            var data = new SaveData
            {
                SchemaVersion = CurrentSchemaVersion,
                SavedAtUnix = nowUnix
            };

            data.Economy.Cash = startingCash;
            data.Economy.Gems = startingGems;
            data.Locations.Add(new LocationSaveState { Index = 0, IsUnlocked = true });
            return data;
        }
    }

    [Serializable]
    public sealed class PlayerState
    {
        public int Level { get; set; } = 1;

        public double TotalEarned { get; set; }

        /// <summary>Reserved for the prestige system, which ships after v1.</summary>
        public int PrestigeCount { get; set; }

        /// <summary>Reserved for prestige. 1.0 means no bonus.</summary>
        public double PrestigeMultiplier { get; set; } = 1.0;

        /// <summary>Highest FTUE step completed, so the tutorial resumes rather than restarts.</summary>
        public int TutorialStep { get; set; }

        public bool HasSeenFirstOfflineReward { get; set; }
    }

    [Serializable]
    public sealed class EconomyState
    {
        public double Cash { get; set; }

        public int Gems { get; set; }

        public int PriceLevel { get; set; }

        public int MarketingLevel { get; set; }

        public int CarryCapacityLevel { get; set; }

        /// <summary>Index of the location the player is currently standing in.</summary>
        public int ActiveLocationIndex { get; set; }
    }

    [Serializable]
    public sealed class LocationSaveState
    {
        public int Index { get; set; }

        public bool IsUnlocked { get; set; }

        public List<StationSaveState> Stations { get; set; } = new List<StationSaveState>();

        public List<ChannelSaveState> Channels { get; set; } = new List<ChannelSaveState>();
    }

    /// <summary>
    /// One station's persisted state.
    /// </summary>
    /// <remarks>
    /// Named <c>...SaveState</c> rather than <c>StationState</c> because the simulation
    /// already has a <c>StationState</c>, and that one is an FSM state — Idle, Producing,
    /// Blocked. Two public types with the same name meaning entirely different things
    /// collided in the first piece of gameplay code that both saved and ran the chain, which
    /// is every piece of gameplay code eventually.
    ///
    /// Renaming the class is safe for existing saves: the serialiser writes member names, not
    /// type names, so the JSON is unchanged.
    /// </remarks>
    [Serializable]
    public sealed class StationSaveState
    {
        public string Id { get; set; } = string.Empty;

        public int Level { get; set; }

        /// <summary>Parallel units owned. A second oven is a purchase, not a level.</summary>
        public int Count { get; set; } = 1;

        public bool IsStaffed { get; set; }

        public int StaffLevel { get; set; }
    }

    [Serializable]
    public sealed class ChannelSaveState
    {
        public string Id { get; set; } = string.Empty;

        public int SlotLevel { get; set; }

        public bool IsStaffed { get; set; }
    }

    [Serializable]
    public sealed class MetaState
    {
        public int DailyStreak { get; set; }

        /// <summary>Day index of the last claimed daily reward, in local days since epoch.</summary>
        public int LastDailyRewardDay { get; set; } = -1;

        /// <summary>
        /// Whether the player owns the ad-free entitlement.
        /// </summary>
        /// <remarks>
        /// A cache of the store's answer, never the authority for it. Entitlement is
        /// re-derived from the platform's purchase records at launch, because this field lives
        /// in a file the player can edit.
        /// </remarks>
        public bool AdFreeCached { get; set; }

        public double RushHourAvailableAtUnix { get; set; }

        public int RushHourBestCombo { get; set; }

        public int StarPoints { get; set; }

        /// <summary>Serves since the last interstitial, for the frequency cap.</summary>
        public int ServesSinceInterstitial { get; set; }

        public double LastInterstitialUnix { get; set; }

        public List<string> OwnedCosmetics { get; set; } = new List<string>();
    }
}
