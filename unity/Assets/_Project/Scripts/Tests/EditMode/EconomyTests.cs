using NUnit.Framework;
using SizzleStreet.Core;
using SizzleStreet.Economy;

namespace SizzleStreet.Tests
{
    [TestFixture]
    public sealed class EconomyManagerTests
    {
        private TestEconomySettings _settings;
        private EconomyManager _economy;

        [SetUp]
        public void SetUp()
        {
            _settings = new TestEconomySettings();
            _economy = new EconomyManager(_settings, cash: 100.0, gems: 5, totalEarned: 0.0);
            EventBus.ClearHandlers<CashChanged>();
            EventBus.ClearHandlers<PlayerLeveledUp>();
        }

        [Test]
        public void EarningRaisesTheBalanceAndTheLifetimeTotal()
        {
            _economy.Earn(50.0, "serve");

            Assert.That(_economy.Cash, Is.EqualTo(150.0).Within(1e-9));
            Assert.That(_economy.TotalEarned, Is.EqualTo(50.0).Within(1e-9));
        }

        [Test]
        public void SpendingMoreThanTheBalanceChangesNothing()
        {
            Assert.That(_economy.TrySpend(1000.0, "upgrade"), Is.False);
            Assert.That(_economy.Cash, Is.EqualTo(100.0).Within(1e-9));
        }

        [Test]
        public void SpendingExactlyTheBalanceIsAllowedAndLeavesZero()
        {
            Assert.That(_economy.TrySpend(100.0, "upgrade"), Is.True);
            Assert.That(_economy.Cash, Is.Zero);
        }

        [Test]
        public void TheBalanceNeverGoesNegative()
        {
            // CanAfford allows a relative sliver of slack on an exact boundary, so the charge is
            // clamped. A balance a fraction below zero would fail every later affordability
            // check for a reason no player could ever work out.
            _economy.TrySpend(100.0 * (1.0 + EconomyMath.BoundaryTolerance / 2.0), "upgrade");
            Assert.That(_economy.Cash, Is.GreaterThanOrEqualTo(0.0));
        }

        [Test]
        public void NonsenseAmountsAreIgnoredRatherThanPoisoningTheBalance()
        {
            _economy.Earn(double.NaN, "bug");
            _economy.Earn(double.PositiveInfinity, "bug");

            Assert.That(_economy.Cash, Is.EqualTo(100.0).Within(1e-9));
        }

        [Test]
        public void CrossingAThresholdLevelsThePlayerUp()
        {
            var levels = 0;
            EventBus.Subscribe<PlayerLeveledUp>(_ => levels++);

            _economy.Earn(_settings.LevelThresholdBase + 1.0, "serve");

            Assert.That(levels, Is.EqualTo(1));
            Assert.That(_economy.PlayerLevel, Is.EqualTo(2));
        }

        [Test]
        public void OneLargeGrantCanCrossSeveralThresholdsAtOnce()
        {
            // An offline claim or a location payout can jump multiple levels. Testing the
            // threshold once per call would swallow every level but the first.
            var levels = 0;
            EventBus.Subscribe<PlayerLeveledUp>(_ => levels++);

            _economy.Earn(100_000.0, "offline");

            Assert.That(levels, Is.GreaterThan(1));
            Assert.That(_economy.PlayerLevel, Is.EqualTo(levels + 1));
        }

        [Test]
        public void LoadingASaveDoesNotReplayLevelUps()
        {
            // Otherwise a returning player watches every level-up celebration they have ever
            // earned, on every launch.
            var levels = 0;
            EventBus.Subscribe<PlayerLeveledUp>(_ => levels++);

            _economy.RestoreFromSave(cash: 5000.0, gems: 3, totalEarned: 100_000.0);

            Assert.That(levels, Is.Zero);
            Assert.That(_economy.PlayerLevel, Is.GreaterThan(1));
        }

        [Test]
        public void GemsCannotBeOverspent()
        {
            Assert.That(_economy.TrySpendGems(10, "skip"), Is.False);
            Assert.That(_economy.Gems, Is.EqualTo(5));

            Assert.That(_economy.TrySpendGems(5, "skip"), Is.True);
            Assert.That(_economy.Gems, Is.Zero);
        }
    }

    [TestFixture]
    public sealed class UpgradeSystemTests
    {
        private EconomyManager _economy;
        private UpgradeSystem _upgrades;

        [SetUp]
        public void SetUp()
        {
            _economy = new EconomyManager(new TestEconomySettings(), cash: 1000.0, gems: 0, totalEarned: 0.0);
            _upgrades = new UpgradeSystem(_economy);
            _upgrades.Register(new UpgradeTrack("dough", baseCost: 25.0, growth: 1.09));
            EventBus.ClearHandlers<UpgradePurchased>();
        }

        [Test]
        public void TheFirstLevelCostsTheBase()
        {
            Assert.That(_upgrades.NextCost("dough"), Is.EqualTo(25.0).Within(1e-9));
        }

        [Test]
        public void BuyingChargesAndAdvancesTheLevel()
        {
            Assert.That(_upgrades.TryBuy("dough"), Is.True);

            Assert.That(_upgrades.LevelOf("dough"), Is.EqualTo(1));
            Assert.That(_economy.Cash, Is.EqualTo(975.0).Within(1e-9));
        }

        [Test]
        public void ABulkBuyChargesTheGeometricSumAndPublishesOnce()
        {
            var events = 0;
            EventBus.Subscribe<UpgradePurchased>(_ => events++);

            Assert.That(_upgrades.TryBuy("dough", 5, out var bought), Is.True);

            var expected = EconomyMath.UpgradeCostRange(25.0, 1.09, 0, 5);
            Assert.That(bought, Is.EqualTo(5));
            Assert.That(_economy.Cash, Is.EqualTo(1000.0 - expected).Within(1e-6));
            Assert.That(events, Is.EqualTo(1), "a bulk buy is one purchase, not five");
        }

        [Test]
        public void ABulkBuyIsTrimmedToWhatIsAffordable()
        {
            Assert.That(_upgrades.TryBuy("dough", 500, out var bought), Is.True);

            Assert.That(bought, Is.LessThan(500));
            Assert.That(_economy.Cash, Is.GreaterThanOrEqualTo(0.0));
        }

        [Test]
        public void AnUnaffordableUpgradeChangesNothing()
        {
            var poor = new EconomyManager(new TestEconomySettings(), cash: 1.0, gems: 0, totalEarned: 0.0);
            var upgrades = new UpgradeSystem(poor);
            upgrades.Register(new UpgradeTrack("dough", 25.0, 1.09));

            Assert.That(upgrades.TryBuy("dough"), Is.False);
            Assert.That(upgrades.LevelOf("dough"), Is.Zero);
            Assert.That(poor.Cash, Is.EqualTo(1.0).Within(1e-9));
        }

        [Test]
        public void TheCostBandRePricesTheWholeShop()
        {
            _upgrades.CostBand = 40.0;

            Assert.That(_upgrades.NextCost("dough"), Is.EqualTo(1000.0).Within(1e-9));
        }

        [Test]
        public void AMaxedTrackCostsInfinityRatherThanNothing()
        {
            // Zero would read as free everywhere a price is compared, and an exception would
            // throw inside a UI refresh that asks every frame.
            _upgrades.Register(new UpgradeTrack("capped", 10.0, 1.09, level: 3, maxLevel: 3));

            Assert.That(_upgrades.NextCost("capped"), Is.EqualTo(double.PositiveInfinity));
            Assert.That(_upgrades.TryBuy("capped"), Is.False);
        }

        [Test]
        public void ExpandingRaisesThePriceAndSignageCaps()
        {
            _upgrades.Register(new UpgradeTrack(UpgradeIds.Price, 120.0, 1.15, maxLevel: 12));
            _upgrades.Register(new UpgradeTrack(UpgradeIds.Marketing, 300.0, 1.16, maxLevel: 10));

            _upgrades.ApplyLocationCaps(unlockedLocations: 2, priceLevelsPerLocation: 12, marketingLevelsPerLocation: 10);

            Assert.That(_upgrades.Get(UpgradeIds.Price).MaxLevel, Is.EqualTo(24));
            Assert.That(_upgrades.Get(UpgradeIds.Marketing).MaxLevel, Is.EqualTo(20));
        }

        [Test]
        public void RestoringFromASaveDoesNotCharge()
        {
            _upgrades.RestoreLevel("dough", 12);

            Assert.That(_upgrades.LevelOf("dough"), Is.EqualTo(12));
            Assert.That(_economy.Cash, Is.EqualTo(1000.0).Within(1e-9));
        }
    }

    [TestFixture]
    public sealed class OfflineEarningsTests
    {
        private TestEconomySettings _settings;
        private TestClock _clock;
        private OfflineEarningsCalculator _calculator;

        [SetUp]
        public void SetUp()
        {
            _settings = new TestEconomySettings();
            _clock = new TestClock { NowUnixSeconds = 1_700_000_000.0 };
            _calculator = new OfflineEarningsCalculator(_settings, _clock);
        }

        [Test]
        public void AnHourAwayPaysAnHourAtHalfRate()
        {
            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 3600.0, idleRatePerSecond: 10.0);

            Assert.That(reward.BaseAmount, Is.EqualTo(3600.0 * 10.0 * 0.5).Within(1e-6));
            Assert.That(reward.WasCapped, Is.False);
        }

        [Test]
        public void TwoDaysAwayPaysTheCap()
        {
            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 48 * 3600.0, idleRatePerSecond: 10.0);

            Assert.That(reward.CreditedSeconds, Is.EqualTo(_settings.OfflineCapSeconds).Within(1e-6));
            Assert.That(reward.WasCapped, Is.True);
            Assert.That(reward.ElapsedSeconds, Is.GreaterThan(reward.CreditedSeconds));
        }

        [Test]
        public void ABackwardsClockPaysNothing()
        {
            // There is no server to check against, so the client is trusted about time. It is
            // trusted in exactly one direction.
            var reward = _calculator.Calculate(_clock.NowUnixSeconds + 10_000.0, idleRatePerSecond: 10.0);

            Assert.That(reward.BaseAmount, Is.Zero);
            Assert.That(reward.ClockMovedBackwards, Is.True);
        }

        [Test]
        public void AShopThatCannotRunItselfPaysNothing()
        {
            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 3600.0, idleRatePerSecond: 0.0);

            Assert.That(reward.HasReward, Is.False);
        }

        [Test]
        public void TheRewardedDoublerDoubles()
        {
            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 3600.0, idleRatePerSecond: 10.0);

            Assert.That(_calculator.DoubledAmount(reward), Is.EqualTo(reward.BaseAmount * 2.0).Within(1e-6));
        }

        [Test]
        public void RemoteConfigCanMoveTheCapWithoutAClientRelease()
        {
            _calculator.CapSecondsOverride = 600.0;

            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 3600.0, idleRatePerSecond: 10.0);

            Assert.That(reward.CreditedSeconds, Is.EqualTo(600.0).Within(1e-6));
        }

        [Test]
        public void GrantingPaysTheEconomyExactlyOnce()
        {
            var economy = new EconomyManager(_settings, cash: 0.0, gems: 0, totalEarned: 0.0);
            var reward = _calculator.Calculate(_clock.NowUnixSeconds - 3600.0, idleRatePerSecond: 10.0);

            _calculator.Grant(economy, reward, doubled: true);

            Assert.That(economy.Cash, Is.EqualTo(reward.BaseAmount * 2.0).Within(1e-6));
        }
    }
}
