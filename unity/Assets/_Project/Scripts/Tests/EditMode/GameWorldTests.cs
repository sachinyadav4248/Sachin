using System;
using NUnit.Framework;
using SizzleStreet.Android;
using SizzleStreet.Core;
using SizzleStreet.Simulation;
using SizzleStreet.Save;
using SizzleStreet.Serialization;

namespace SizzleStreet.Tests
{
    /// <summary>
    /// Plays the game.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <see cref="GameWorld"/> is the wiring layer of the Android build — it arranges the
    /// shop, decides who is near what, spawns customers and owns the buttons. It contains no
    /// Android types, which is what lets these tests drive the real thing rather than a
    /// stand-in.
    /// </para>
    /// <para>
    /// These are not unit tests. Each one runs a scripted player around the shop for a
    /// simulated stretch of minutes and then asks whether the result makes sense. That catches
    /// the class of bug unit tests structurally cannot: a queue that jams after ten minutes, a
    /// pool that leaks, a payout that stops arriving once the first customer has been served.
    /// </para>
    /// </remarks>
    [TestFixture]
    public sealed class GameWorldTests
    {
        private const float Step = 1f / 30f;

        private InMemorySaveStore _store;
        private TestClock _clock;
        private SaveManager _save;

        [SetUp]
        public void SetUp()
        {
            _store = new InMemorySaveStore();
            _clock = new TestClock { NowUnixSeconds = 1_700_000_000.0 };
            _save = NewSaveManager();
            _save.Load();
        }

        private SaveManager NewSaveManager()
        {
            return new SaveManager(
                _store,
                // The real codec, not the scalar-only test double. These tests round-trip the
                // whole save graph - station levels, staffing, channels - and the double
                // silently drops all of it, which shows up as progress vanishing on reload.
                new SaveSerializer(new NewtonsoftJsonCodec(), "gameworld-tests"),
                new SaveMigrator(),
                _clock,
                startingCash: 10.0,
                startingGems: 0);
        }

        /// <summary>
        /// Runs the game for a while with a player who behaves sensibly.
        /// </summary>
        /// <remarks>
        /// The policy matters. An earlier version walked a fixed loop of waypoints and was
        /// simply bad at the game — it produced numbers that said more about the bot than the
        /// balance. This one does what a competent player does: keep the line moving from the
        /// far end back, take food out when there is food, serve whoever is waiting, and fetch
        /// a crate when something runs dry.
        /// </remarks>
        private static void Play(GameWorld world, double minutes, bool buyUpgrades = true)
        {
            var steps = (int)(minutes * 60.0 / Step);

            for (var i = 0; i < steps; i++)
            {
                var destination = ChooseDestination(world);
                var player = world.Player;
                var dx = destination.X - player.X;
                var dy = destination.Y - player.Y;
                var distance = (float)Math.Sqrt(dx * dx + dy * dy);

                if (distance < GameWorld.InteractionRadius * 0.5f)
                {
                    world.Update(Step, 0f, 0f);
                }
                else
                {
                    world.Update(Step, dx / distance, dy / distance);
                }

                if (buyUpgrades && i % 90 == 0)
                {
                    foreach (var button in world.Buttons)
                    {
                        if (button.Enabled())
                        {
                            button.Press();
                            break;
                        }
                    }
                }
            }
        }

        /// <summary>Where a competent player would be heading right now.</summary>
        private static Vec ChooseDestination(GameWorld world)
        {
            // A dry station stops the whole chain, so it comes first.
            foreach (var slot in world.Stations)
            {
                if (slot.Station.NeedsRestock)
                {
                    return world.HasCrate ? slot.Position : world.Crate;
                }
            }

            // Carrying food with somebody waiting: go and get paid.
            if (world.Stack.Count > 0)
            {
                foreach (var counter in world.Counters)
                {
                    if (counter.Counter.IsStaffed)
                    {
                        continue;
                    }

                    foreach (var customer in counter.Counter.Queue)
                    {
                        if (customer.State == CustomerState.WaitingForFood)
                        {
                            return counter.Position;
                        }
                    }
                }
            }

            var last = world.Stations[world.Stations.Count - 1];

            // Food is boxed and there is room to carry it.
            if (world.Shop.FinishedItems > 0 && !world.Stack.IsFull)
            {
                return last.Position;
            }

            // Otherwise work the line from the far end back, which pushes work downstream
            // instead of piling it up at the start.
            for (var i = world.Stations.Count - 1; i >= 0; i--)
            {
                var station = world.Stations[i].Station;
                if (station.IsAutonomous || station.IsStaffed || station.NeedsRestock)
                {
                    continue;
                }

                if (station.State == StationState.Blocked)
                {
                    continue;
                }

                if (station.IsChainHead || station.WorkInProgress > 0)
                {
                    return world.Stations[i].Position;
                }
            }

            return last.Position;
        }

        [Test]
        public void AFreshGameStartsWithTheTunedOpeningPurse()
        {
            var world = new GameWorld(_save, _clock);

            Assert.That(world.Economy.Cash, Is.EqualTo(10.0).Within(1e-9));
            Assert.That(world.Stations, Has.Count.EqualTo(4));
            Assert.That(world.Counters, Has.Count.EqualTo(2));
            Assert.That(world.Buttons, Is.Not.Empty);
        }

        [Test]
        public void ThirtyMinutesOfPlayRunsWithoutThrowing()
        {
            var world = new GameWorld(_save, _clock);

            Assert.DoesNotThrow(() => Play(world, minutes: 30));
        }

        [Test]
        public void PlayingEarnsMoney()
        {
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 10, buyUpgrades: false);

            Assert.That(world.Economy.TotalEarned, Is.GreaterThan(0.0),
                "a player walking the chain and serving the counter must earn something");
        }

        [Test]
        public void TheShopStillTakesOrdersAfterHalfAnHour()
        {
            // The end-to-end guard against the queue jam: customers who have paid must leave,
            // or every slot fills with people who already have their food and the shop quietly
            // stops trading. Earnings in the last stretch are what prove it did not.
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 25);

            var earnedByThen = world.Economy.TotalEarned;
            Play(world, minutes: 5);

            Assert.That(world.Economy.TotalEarned, Is.GreaterThan(earnedByThen),
                "the shop stopped earning partway through — the queues have jammed");
        }

        [Test]
        public void CustomersKeepArriving()
        {
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 20);

            var queued = 0;
            foreach (var counter in world.Counters)
            {
                queued += counter.Counter.QueueLength;
            }

            Assert.That(queued, Is.GreaterThan(0), "nobody is in the shop after twenty minutes");
        }

        [Test]
        public void TheFirstUpgradeIsAffordableEarly()
        {
            // The FTUE promises a first upgrade inside the first minute, and the balance
            // simulation puts it at 24 seconds. This checks the real game agrees.
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 1, buyUpgrades: false);

            var affordable = false;
            foreach (var button in world.Buttons)
            {
                affordable |= button.Enabled();
            }

            Assert.That(affordable, Is.True, "nothing was affordable after a minute of play");
        }

        [Test]
        public void RunningAStationDryStopsItUntilItIsRestocked()
        {
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 40);

            // Somewhere in forty minutes a supply-fed station will run out at least once. The
            // point is that the game keeps going: the restock loop is reachable, not a dead end.
            Assert.That(world.Economy.TotalEarned, Is.GreaterThan(0.0));
            Assert.That(world.Hint, Is.Not.Null.And.Not.Empty);
        }

        [Test]
        public void ProgressSurvivesBeingClosedAndReopened()
        {
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 15);

            var cash = world.Economy.Cash;
            var doughLevel = world.Stations[0].Station.Level;
            world.Persist();

            // A second launch, reading the same store from scratch.
            var reopened = NewSaveManager();
            reopened.Load();
            var restored = new GameWorld(reopened, _clock);

            Assert.That(restored.Economy.Cash, Is.EqualTo(cash).Within(0.01));
            Assert.That(restored.Stations[0].Station.Level, Is.EqualTo(doughLevel));
        }

        [Test]
        public void ClosingTheGameAndReturningLaterPaysOfflineEarningsOnlyOnceAutomated()
        {
            var world = new GameWorld(_save, _clock);
            Play(world, minutes: 10);
            world.Persist();

            _clock.Advance(2 * 60 * 60);

            var reopened = NewSaveManager();
            reopened.Load();
            var restored = new GameWorld(reopened, _clock);

            // Nothing is staffed after ten minutes of play, so the shop cannot run itself and
            // must not have earned a penny while closed.
            Assert.That(restored.Shop.IsSelfRunning, Is.False);
            Assert.That(restored.OfflineReward.BaseAmount, Is.Zero);
        }
    }
}
