using System;
using System.Collections.Generic;

namespace SizzleStreet.Services
{
    /// <summary>
    /// Analytics, behind an interface, with the event names fixed in one place.
    /// </summary>
    /// <remarks>
    /// The names in <see cref="AnalyticsEvents"/> are the contract with every dashboard, funnel
    /// and cohort query built on them. Renaming one does not rename the history behind it: it
    /// splits the metric in two and quietly breaks a chart somebody is making decisions from.
    /// </remarks>
    public interface IAnalyticsService
    {
        void Log(string eventName);

        void Log(string eventName, IReadOnlyDictionary<string, object> parameters);

        /// <summary>Sets a property that persists across events, like the player's level.</summary>
        void SetUserProperty(string key, string value);

        /// <summary>
        /// Whether events are being sent or held.
        /// </summary>
        /// <remarks>
        /// Events raised before consent resolves are queued rather than dropped, so the first
        /// session's funnel is not missing its own opening steps.
        /// </remarks>
        bool IsCollecting { get; }
    }

    /// <summary>Every analytics event name. See docs/09-analytics.md for the parameters.</summary>
    public static class AnalyticsEvents
    {
        public const string GameStart = "game_start";
        public const string SessionStart = "session_start";
        public const string SessionEnd = "session_end";
        public const string FtueStepComplete = "ftue_step_complete";
        public const string OrderCompleted = "order_completed";
        public const string OrderAbandoned = "order_abandoned";
        public const string UpgradePurchased = "upgrade_purchased";
        public const string StaffHired = "staff_hired";
        public const string LevelUp = "level_up";
        public const string LocationUnlocked = "location_unlocked";
        public const string CurrencyEarned = "currency_earned";
        public const string CurrencySpent = "currency_spent";
        public const string OfflineClaimed = "offline_claimed";
        public const string RushHourStarted = "rush_hour_started";
        public const string RushHourEnded = "rush_hour_ended";
        public const string AdImpression = "ad_impression";
        public const string AdRewardedComplete = "ad_rewarded_complete";
        public const string AdNoFill = "ad_no_fill";
        public const string IapPurchase = "iap_purchase";
        public const string SaveRecovered = "save_recovered";
    }

    /// <summary>Drops everything. Used when analytics is unavailable or consent is refused.</summary>
    public sealed class NullAnalyticsService : IAnalyticsService
    {
        public bool IsCollecting => false;

        public void Log(string eventName)
        {
        }

        public void Log(string eventName, IReadOnlyDictionary<string, object> parameters)
        {
        }

        public void SetUserProperty(string key, string value)
        {
        }
    }
}
