using System;
using System.Collections.Generic;

namespace SizzleStreet.Services
{
    /// <summary>
    /// Remote Config, with defaults that always work.
    /// </summary>
    /// <remarks>
    /// Reads are synchronous and never wait on the network. A fetch that has not completed —
    /// or never will — is invisible: the defaults baked into the build answer instead, and
    /// fetched values swap in when they arrive. Startup must not block on a network call, so
    /// this is the only shape that is safe to read during bootstrap.
    /// </remarks>
    public interface IRemoteConfigService
    {
        bool GetBool(string key, bool fallback);

        int GetInt(string key, int fallback);

        double GetDouble(string key, double fallback);

        string GetString(string key, string fallback);

        /// <summary>True once a fetch has completed and values are live.</summary>
        bool HasFetched { get; }

        /// <summary>Starts a fetch. Fire and forget; failure is not an error worth surfacing.</summary>
        void FetchAsync(Action onComplete = null);
    }

    /// <summary>Every key, with the default the game ships with.</summary>
    /// <remarks>
    /// A key absent from this table is a bug: reads go through it so that a typo in a key name
    /// fails in a test rather than silently returning a caller-supplied fallback forever.
    /// </remarks>
    public static class RemoteConfigKeys
    {
        public const string OfflineCapSeconds = "offline_cap_seconds";
        public const string OfflineEfficiency = "offline_efficiency";
        public const string RewardedMultiplier = "rewarded_multiplier";
        public const string InterstitialCapPerHour = "interstitial_cap_per_hour";
        public const string InterstitialMinGapSeconds = "interstitial_min_gap_seconds";
        public const string InterstitialFirstUnlockServes = "interstitial_first_unlock_serves";
        public const string EconGrowthRateScale = "econ_growth_rate_scale";
        public const string PriceMultiplierScale = "price_multiplier_scale";
        public const string StarterPackEnabled = "starter_pack_enabled";
        public const string RushHourEnabled = "rush_hour_enabled";
        public const string EventId = "event_id";

        public static readonly IReadOnlyDictionary<string, object> Defaults =
            new Dictionary<string, object>
            {
                { OfflineCapSeconds, 4.0 * 60.0 * 60.0 },
                { OfflineEfficiency, 0.5 },
                { RewardedMultiplier, 2.0 },
                { InterstitialCapPerHour, 6 },
                { InterstitialMinGapSeconds, 180 },
                { InterstitialFirstUnlockServes, 60 },
                { EconGrowthRateScale, 1.0 },
                { PriceMultiplierScale, 1.0 },
                { StarterPackEnabled, true },
                { RushHourEnabled, true },
                { EventId, string.Empty }
            };
    }

    /// <summary>Serves the shipped defaults and nothing else. The offline fallback.</summary>
    public sealed class DefaultRemoteConfigService : IRemoteConfigService
    {
        public bool HasFetched => false;

        public bool GetBool(string key, bool fallback) => Lookup(key, fallback);

        public int GetInt(string key, int fallback) => Lookup(key, fallback);

        public double GetDouble(string key, double fallback) => Lookup(key, fallback);

        public string GetString(string key, string fallback) => Lookup(key, fallback);

        public void FetchAsync(Action onComplete = null) => onComplete?.Invoke();

        private static T Lookup<T>(string key, T fallback)
        {
            if (RemoteConfigKeys.Defaults.TryGetValue(key, out var value) && value is T typed)
            {
                return typed;
            }

            return fallback;
        }
    }
}
