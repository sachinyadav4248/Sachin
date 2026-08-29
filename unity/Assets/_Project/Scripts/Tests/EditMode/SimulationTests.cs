using System.Collections.Generic;
using NUnit.Framework;
using SizzleStreet.Core;
using SizzleStreet.Economy;
using SizzleStreet.Simulation;

namespace SizzleStreet.Tests
{
    /// <summary>Tests for the production chain and the serving channels.</summary>
    [TestFixture]
    public sealed class StationTests
    {
        private static Station Head(int buffer = 6, double output = 1.0, int supplies = 40)
        {
            return new Station(
                new TestStationSettings { BaseOutput = output, OutputBuffer = buffer, IngredientCapacity = supplies },
                isChainHead: true);
        }

        [Test]
        public void AStationWithNobodyWorkingItProducesNothing()
        {
            var station = Head();
            station.Tick(10.0);

            Assert.That(station.OutputCount, Is.Zero);
            Assert.That(station.State, Is.EqualTo(StationState.Idle));
        }

        [Test]
        public void TheOvenNeedsNobodyAtAll()
        {
            // The one station that is a machine rather than a post. This is what makes it a
            // pure throughput ceiling, and what makes it bind only after the first hires.
            var oven = new Station(
                new TestStationSettings { RequiresWorker = false, IngredientCapacity = 0, BaseOutput = 1.0 });
            oven.AddInput(5);
            oven.Tick(3.0);

            Assert.That(oven.IsAutonomous, Is.True);
            Assert.That(oven.IsAutomated, Is.True);
            Assert.That(oven.OutputCount, Is.EqualTo(3));
        }

        [Test]
        public void APresentPlayerWorksTheStation()
        {
            var station = Head();
            station.PlayerPresent = true;
            station.Tick(3.0);

            Assert.That(station.OutputCount, Is.EqualTo(3));
            Assert.That(station.State, Is.EqualTo(StationState.OutputReady));
        }

        [Test]
        public void AFastStationProducesMoreThanOneUnitPerTick()
        {
            // Capping at one per tick would silently discard throughput the player paid for,
            // which presents as a late-game upgrade doing nothing.
            var station = Head(buffer: 20, output: 10.0);
            station.PlayerPresent = true;
            station.Tick(1.0);

            Assert.That(station.OutputCount, Is.EqualTo(10));
        }

        [Test]
        public void AFullOutputBufferBlocksProduction()
        {
            var station = Head(buffer: 3);
            station.PlayerPresent = true;
            station.Tick(10.0);

            Assert.That(station.OutputCount, Is.EqualTo(3));
            Assert.That(station.State, Is.EqualTo(StationState.Blocked));
        }

        [Test]
        public void TakingOutputUnblocksTheStation()
        {
            var station = Head(buffer: 3);
            station.PlayerPresent = true;
            station.Tick(10.0);

            Assert.That(station.TakeOutput(2), Is.EqualTo(2));
            Assert.That(station.State, Is.EqualTo(StationState.Producing));

            station.Tick(2.0);
            Assert.That(station.OutputCount, Is.EqualTo(3));
        }

        [Test]
        public void RunningOutOfSuppliesStopsProduction()
        {
            var station = Head(buffer: 100, supplies: 2);
            station.PlayerPresent = true;
            station.Tick(10.0);

            Assert.That(station.OutputCount, Is.EqualTo(2));
            Assert.That(station.NeedsRestock, Is.True);

            station.Restock();
            station.Tick(1.0);
            Assert.That(station.OutputCount, Is.EqualTo(3));
        }

        [Test]
        public void AStalledStationDoesNotBankWorkItCouldNotDo()
        {
            // Regression. Progress used to accrue for the whole elapsed tick and then get
            // clamped, so a station with two units of flour and ten seconds produced its two
            // and kept a full unit of progress in hand - which it handed over free the instant
            // somebody restocked it. Time spent stalled is time the station did nothing.
            var station = Head(buffer: 100, supplies: 2);
            station.PlayerPresent = true;
            station.Tick(10.0);

            Assert.That(station.OutputCount, Is.EqualTo(2));
            Assert.That(station.Progress, Is.Zero, "a stalled station holds no banked progress");

            station.Restock();
            station.Tick(0.5);

            Assert.That(
                station.OutputCount, Is.EqualTo(2),
                "half a second of work must not complete a unit from nothing");
        }

        [Test]
        public void AWorkerLeavingMidUnitKeepsThePartialProgress()
        {
            // The other half of the rule: progress genuinely earned is not thrown away just
            // because the player walked off.
            var station = Head(buffer: 100, output: 1.0);
            station.PlayerPresent = true;
            station.Tick(0.5);

            var partial = station.Progress;
            Assert.That(partial, Is.GreaterThan(0f));

            station.PlayerPresent = false;
            station.Tick(5.0);

            Assert.That(station.Progress, Is.EqualTo(partial).Within(1e-6));
            Assert.That(station.OutputCount, Is.Zero);
        }

        [Test]
        public void ADownstreamStationWaitsForWorkFromUpstream()
        {
            // The bug this guards: with work-in-progress and restockable supplies merged into
            // one counter, a station with no supply capacity produced from nothing at all.
            var downstream = new Station(
                new TestStationSettings { RequiresWorker = false, IngredientCapacity = 0 });
            downstream.Tick(10.0);

            Assert.That(downstream.OutputCount, Is.Zero);

            downstream.AddInput(2);
            downstream.Tick(10.0);
            Assert.That(downstream.OutputCount, Is.EqualTo(2));
        }

        [Test]
        public void TheChainHeadAcceptsNoInput()
        {
            Assert.That(Head().RoomForInput(), Is.Zero);
        }

        [Test]
        public void StaffProduceMoreSlowlyThanThePlayer()
        {
            // Staff buy parallelism, not speed. If they were also faster there would be no
            // reason to ever stand anywhere.
            var settings = new TestStationSettings { StaffSpeedMultiplier = 0.85 };
            var manned = new Station(settings, isChainHead: true) { PlayerPresent = true };
            var staffed = new Station(settings, isChainHead: true);
            staffed.SetStaffed(true);

            Assert.That(staffed.OutputPerSecond, Is.LessThan(manned.OutputPerSecond));
        }
    }

    [TestFixture]
    public sealed class ServiceCounterTests
    {
        private static ServiceCounter NewCounter(ServingChannel channel, double patience = 30.0)
        {
            return new ServiceCounter(
                new TestChannelSettings
                {
                    Channel = channel,
                    MinOrder = 2,
                    MaxOrder = 2,
                    ServeSeconds = 0.0
                },
                seed: 1234)
            {
                PatienceSeconds = patience,
                PriceMultiplier = 1.0
            };
        }

        [Test]
        public void AQueueFillsToCapacityAndNoFurther()
        {
            var counter = NewCounter(ServingChannel.Counter);
            var admitted = 0;
            for (var i = 0; i < 10; i++)
            {
                if (counter.TryAdmit(new Customer()))
                {
                    admitted++;
                }
            }

            Assert.That(admitted, Is.EqualTo(counter.Capacity));
        }

        [Test]
        public void PatienceExpiresAndBreaksTheCombo()
        {
            var counter = NewCounter(ServingChannel.Counter, patience: 5.0);
            counter.TryAdmit(new Customer());

            var abandoned = new List<Customer>();
            Assert.That(counter.Tick(1.0, abandoned), Is.Zero);

            abandoned.Clear();
            Assert.That(counter.Tick(10.0, abandoned), Is.EqualTo(1));
            Assert.That(abandoned, Has.Count.EqualTo(1));
            Assert.That(counter.QueueLength, Is.Zero);
        }

        [Test]
        public void ServingPaysForWhatWasHandedOver()
        {
            var counter = NewCounter(ServingChannel.Counter);
            counter.PriceMultiplier = 4.0;
            counter.TryAdmit(new Customer());

            var abandoned = new List<Customer>();
            counter.Tick(0.1, abandoned);

            var stack = new CarryStack(10);
            stack.TryAdd(5);

            var served = counter.TryServe(stack, comboMultiplier: 1.5, out var payout);

            Assert.That(served, Is.EqualTo(2), "the order was for two items");
            Assert.That(payout, Is.EqualTo(2 * 4.0 * 1.5).Within(1e-9));
            Assert.That(stack.Count, Is.EqualTo(3));
        }

        [Test]
        public void PartialServiceDoesNotResetPatience()
        {
            // A customer who wants five and gets two keeps waiting on the same clock. This is
            // what makes carry capacity matter rather than being a convenience.
            var customer = new Customer();
            customer.Initialise(ServingChannel.Counter, itemsWanted: 5, patienceSeconds: 10.0);
            customer.BeginWaiting();
            customer.Tick(4.0);

            var before = customer.PatienceRemaining;
            Assert.That(customer.Serve(2), Is.EqualTo(2));

            Assert.That(customer.PatienceRemaining, Is.EqualTo(before).Within(1e-9));
            Assert.That(customer.ItemsOutstanding, Is.EqualTo(3));
            Assert.That(customer.State, Is.EqualTo(CustomerState.WaitingForFood));
        }

        [Test]
        public void AnUnservedCarBlocksTheDriveThruLane()
        {
            // The Drive-Thru is not a second counter. One missed order costs more than one sale
            // because everyone behind it is stuck, and that is the whole reason the two
            // channels are a decision rather than a walk.
            var lane = NewCounter(ServingChannel.DriveThru);
            var first = new Customer();
            var second = new Customer();
            lane.TryAdmit(first);
            lane.TryAdmit(second);

            var abandoned = new List<Customer>();
            lane.Tick(0.1, abandoned);

            Assert.That(first.State, Is.EqualTo(CustomerState.WaitingForFood));
            Assert.That(
                second.State, Is.EqualTo(CustomerState.Queueing),
                "the second car cannot order until the first is served");
        }

        [Test]
        public void AnInstantHandoverImposesNoThroughputLimit()
        {
            // Regression. A non-positive serve time means the exchange is instantaneous, so it
            // limits nothing. Reporting zero capacity conflated "instant" with "impossible",
            // and because idle rate takes a minimum against it, a fully staffed shop reported
            // that it earned nothing at all while closed.
            var counter = NewCounter(ServingChannel.Counter);

            Assert.That(counter.ServeCapacityPerSecond, Is.EqualTo(double.PositiveInfinity));
        }

        [Test]
        public void ARealHandoverTimeBoundsThroughput()
        {
            var counter = new ServiceCounter(
                new TestChannelSettings { BaseSlots = 3, ServeSeconds = 0.8 }, seed: 7);

            Assert.That(counter.ServeCapacityPerSecond, Is.EqualTo(3.0 / 0.8).Within(1e-9));
        }

        [Test]
        public void TheCounterServesWhoeverIsReady()
        {
            var counter = NewCounter(ServingChannel.Counter);
            counter.TryAdmit(new Customer());
            counter.TryAdmit(new Customer());

            var abandoned = new List<Customer>();
            counter.Tick(0.1, abandoned);

            foreach (var customer in counter.Queue)
            {
                Assert.That(customer.State, Is.EqualTo(CustomerState.WaitingForFood));
            }
        }
    }

    [TestFixture]
    public sealed class ComboTests
    {
        [Test]
        public void TheComboIsCappedInNormalPlay()
        {
            var combo = new ComboTracker(0.05, 10);
            for (var i = 0; i < 50; i++)
            {
                combo.Increment();
            }

            Assert.That(combo.Multiplier, Is.EqualTo(1.5).Within(1e-9));
        }

        [Test]
        public void RushHourLiftsTheCap()
        {
            var combo = new ComboTracker(0.05, 10) { IsUncapped = true };
            for (var i = 0; i < 40; i++)
            {
                combo.Increment();
            }

            Assert.That(combo.Multiplier, Is.EqualTo(3.0).Within(1e-9));
        }

        [Test]
        public void OneAbandonmentEndsTheChain()
        {
            var combo = new ComboTracker(0.05, 10);
            combo.Increment();
            combo.Increment();
            combo.Break();

            Assert.That(combo.Current, Is.Zero);
            Assert.That(combo.Best, Is.EqualTo(2), "the record survives the break");
        }
    }

    [TestFixture]
    public sealed class ShopTests
    {
        private static Shop BuildShop(out EconomyManager economy, bool staffed)
        {
            economy = new EconomyManager(new TestEconomySettings(), cash: 0, gems: 0, totalEarned: 0);
            var shop = new Shop(economy, new ComboTracker(0.05, 10));

            var head = new Station(
                new TestStationSettings { Id = "dough", BaseOutput = 2.0 }, isChainHead: true);
            var oven = new Station(
                new TestStationSettings { Id = "oven", RequiresWorker = false, IngredientCapacity = 0, BaseOutput = 2.0 });
            head.SetStaffed(staffed);
            shop.AddStation(head);
            shop.AddStation(oven);

            var counter = new ServiceCounter(
                new TestChannelSettings { ServeSeconds = 0.0 }, seed: 99) { PatienceSeconds = 60.0 };
            counter.IsStaffed = staffed;
            shop.AddCounter(counter);
            return shop;
        }

        [Test]
        public void WorkFlowsDownTheChain()
        {
            var shop = BuildShop(out _, staffed: true);
            shop.Tick(1.0);
            shop.Tick(1.0);

            Assert.That(shop.FinishedItems, Is.GreaterThan(0), "the oven should have baked something");
        }

        [Test]
        public void AnItemAdvancesAtMostOneStagePerTick()
        {
            // Flowing front-to-back would let an item cross the whole chain in one frame
            // whenever every stage happened to be free, making pacing depend on frame rate.
            var shop = BuildShop(out _, staffed: true);
            shop.Tick(1.0);

            Assert.That(shop.FinishedItems, Is.Zero);
        }

        [Test]
        public void AShopThatCannotRunItselfEarnsNothingWhileClosed()
        {
            var shop = BuildShop(out _, staffed: false);

            Assert.That(shop.IsSelfRunning, Is.False);
            Assert.That(shop.IdleRatePerSecond(4.0), Is.Zero);
        }

        [Test]
        public void AFullyStaffedShopEarnsWhileClosed()
        {
            var shop = BuildShop(out _, staffed: true);

            Assert.That(shop.IsSelfRunning, Is.True);
            Assert.That(shop.IdleRatePerSecond(4.0), Is.GreaterThan(0.0));
        }

        [Test]
        public void ServingPaysTheEconomyAndAdvancesTheCombo()
        {
            var shop = BuildShop(out var economy, staffed: true);
            for (var i = 0; i < 10; i++)
            {
                shop.Tick(1.0);
            }

            var stack = new CarryStack(10);
            shop.CollectFinished(stack);
            Assert.That(stack.Count, Is.GreaterThan(0));

            shop.Counters[0].TryAdmit(new Customer());
            shop.Tick(0.1);

            var before = economy.Cash;
            var served = shop.Serve(shop.Counters[0], stack);

            Assert.That(served, Is.GreaterThan(0));
            Assert.That(economy.Cash, Is.GreaterThan(before));
            Assert.That(shop.Combo.Current, Is.EqualTo(1));
        }
    }
}
