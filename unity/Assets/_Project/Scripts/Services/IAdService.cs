using System;

namespace SizzleStreet.Services
{
    /// <summary>Where a rewarded ad is offered from.</summary>
    /// <remarks>
    /// These names reach the mediation dashboard and the analytics funnel, so they are
    /// permanent. Every one of them is optional, and every one pays the player something.
    /// </remarks>
    public enum RewardedPlacement
    {
        OfflineDoubler = 0,
        IncomeBoost = 1,
        InstantRestock = 2,
        FreeStaffTrial = 3,
        GemChest = 4,
        RushHourHeadStart = 5
    }

    public enum InterstitialPlacement
    {
        LocationTransition = 0,
        AfterServes = 1
    }

    /// <summary>Whether the player has been asked, and what they said.</summary>
    public enum ConsentState
    {
        Unknown = 0,
        Personalised = 1,
        NonPersonalised = 2,

        /// <summary>Under-13 configuration: non-personalised, certified networks only.</summary>
        ChildDirected = 3
    }

    /// <summary>
    /// Ads, behind an interface so the game never depends on a specific mediation SDK.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Two rules run through every method here. Nothing blocks: an ad that does not load must
    /// leave the game playable and the base reward claimable. And nothing is rewarded on a
    /// button press — only on the SDK's own completion callback, because granting on the press
    /// is how a closed ad ends up paying out.
    /// </para>
    /// <para>
    /// <see cref="NullAdService"/> is the shipping fallback whenever consent is refused, the
    /// SDK fails to initialise, or the player owns the ad-free entitlement. The game must be
    /// completely playable against it, which is checked in QA by launching with no network.
    /// </para>
    /// </remarks>
    public interface IAdService
    {
        ConsentState Consent { get; }

        /// <summary>True once the player owns No-Ads. Interstitials stop; rewarded ads remain.</summary>
        bool IsAdFree { get; }

        /// <summary>Whether a rewarded ad is loaded right now.</summary>
        /// <remarks>
        /// Callers must hide the offer rather than show it failing. A doubler button that does
        /// nothing costs more trust than an absent one.
        /// </remarks>
        bool IsRewardedReady(RewardedPlacement placement);

        /// <summary>
        /// Shows a rewarded ad.
        /// </summary>
        /// <param name="onComplete">
        /// Called with true only after the SDK confirms the ad was watched to the end, and
        /// exactly once per impression. Called with false on abandonment, failure or no fill.
        /// </param>
        void ShowRewarded(RewardedPlacement placement, Action<bool> onComplete);

        /// <summary>Shows an interstitial if the frequency cap allows and the player is not ad-free.</summary>
        /// <returns>False if it was suppressed, which is not an error.</returns>
        bool TryShowInterstitial(InterstitialPlacement placement);

        void SetConsent(ConsentState state);
    }

    /// <summary>
    /// The no-ads-available implementation. Never fills, never rewards, never throws.
    /// </summary>
    /// <remarks>
    /// Used when the SDK is absent, consent is refused, initialisation fails, or the player has
    /// bought No-Ads. It exists so that "the game is fully playable offline" is enforced by the
    /// type system rather than by remembering to null-check at fourteen call sites.
    /// </remarks>
    public sealed class NullAdService : IAdService
    {
        public ConsentState Consent { get; private set; } = ConsentState.Unknown;

        public bool IsAdFree { get; }

        public NullAdService(bool isAdFree = false)
        {
            IsAdFree = isAdFree;
        }

        public bool IsRewardedReady(RewardedPlacement placement) => false;

        public void ShowRewarded(RewardedPlacement placement, Action<bool> onComplete)
        {
            // Invoked rather than dropped: a caller waiting on this callback to re-enable a
            // button would otherwise leave the player staring at a dead popup.
            onComplete?.Invoke(false);
        }

        public bool TryShowInterstitial(InterstitialPlacement placement) => false;

        public void SetConsent(ConsentState state) => Consent = state;
    }
}
