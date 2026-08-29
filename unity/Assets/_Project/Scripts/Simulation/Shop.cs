using System;
using System.Collections.Generic;
using SizzleStreet.Core;
using SizzleStreet.Economy;

namespace SizzleStreet.Simulation
{
    /// <summary>
    /// One location: its station chain, its two channels, and the rules that join them.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is where the loop actually lives. Stations tick, finished items flow down the
    /// chain, whoever is carrying serves the queues, and payouts go to the economy. It holds
    /// no Unity types, so a test can run a full shop for a simulated hour in milliseconds.
    /// </para>
    /// <para>
    /// The chain is ordered and each station feeds the next. Output that the downstream
    /// station cannot accept stays where it is, which is what makes a jam visible rather than
    /// silently discarded.
    /// </para>
    /// </remarks>
    public sealed class Shop
    {
        private readonly List<Station> _chain = new List<Station>(4);
        private readonly List<ServiceCounter> _counters = new List<ServiceCounter>(2);
        private readonly List<Customer> _abandonedBuffer = new List<Customer>(8);
        private readonly ComboTracker _combo;
        private readonly IEconomyService _economy;

        public Shop(IEconomyService economy, ComboTracker combo)
        {
            _economy = economy ?? throw new ArgumentNullException(nameof(economy));
            _combo = combo ?? throw new ArgumentNullException(nameof(combo));
        }

        /// <summary>Stations in production order, first to last.</summary>
        public IReadOnlyList<Station> Chain => _chain;

        public IReadOnlyList<ServiceCounter> Counters => _counters;

        public ComboTracker Combo => _combo;

        /// <summary>Items finished and waiting at the end of the chain to be picked up.</summary>
        public int FinishedItems => _chain.Count == 0 ? 0 : _chain[_chain.Count - 1].OutputCount;

        /// <summary>Customers who gave up on the last tick and need despawning.</summary>
        public IReadOnlyList<Customer> RecentlyAbandoned => _abandonedBuffer;

        public void AddStation(Station station)
        {
            if (station == null)
            {
                throw new ArgumentNullException(nameof(station));
            }

            _chain.Add(station);
        }

        public void AddCounter(ServiceCounter counter)
        {
            if (counter == null)
            {
                throw new ArgumentNullException(nameof(counter));
            }

            _counters.Add(counter);
        }

        /// <summary>Advances production, flow and patience by one step.</summary>
        public void Tick(double deltaSeconds)
        {
            if (deltaSeconds <= 0.0)
            {
                return;
            }

            for (var i = 0; i < _chain.Count; i++)
            {
                _chain[i].Tick(deltaSeconds);
            }

            FlowDownChain();

            _abandonedBuffer.Clear();
            var breaks = 0;
            for (var i = 0; i < _counters.Count; i++)
            {
                breaks += _counters[i].Tick(deltaSeconds, _abandonedBuffer);
            }

            if (breaks > 0)
            {
                // One break is as bad as five: the chain is gone either way, and resetting once
                // avoids publishing a cascade of identical events during a bad Rush Hour.
                _combo.Break();
            }
        }

        /// <summary>
        /// Moves finished units from each station into the next one's input.
        /// </summary>
        /// <remarks>
        /// Walked from the end backwards so a unit moves at most one stage per tick. Front to
        /// back would let an item teleport from Dough to Boxing within a single frame whenever
        /// the whole chain happened to be free, which makes the chain's pacing depend on frame
        /// rate.
        /// </remarks>
        private void FlowDownChain()
        {
            for (var i = _chain.Count - 2; i >= 0; i--)
            {
                var upstream = _chain[i];
                var downstream = _chain[i + 1];

                if (upstream.OutputCount <= 0)
                {
                    continue;
                }

                var room = downstream.RoomForInput();
                if (room <= 0)
                {
                    continue;
                }

                var moved = upstream.TakeOutput(room);
                downstream.AddInput(moved);
            }
        }

        /// <summary>Collects finished items from the end of the chain into a carrier's stack.</summary>
        public int CollectFinished(CarryStack carrier)
        {
            if (carrier == null || _chain.Count == 0 || carrier.IsFull)
            {
                return 0;
            }

            var taken = _chain[_chain.Count - 1].TakeOutput(carrier.FreeSpace);
            return taken > 0 ? carrier.TryAdd(taken) : 0;
        }

        /// <summary>Serves a channel from a carrier's stack and pays for what was handed over.</summary>
        public int Serve(ServiceCounter counter, CarryStack carrier)
        {
            if (counter == null || carrier == null)
            {
                return 0;
            }

            var served = counter.TryServe(carrier, _combo.Multiplier, out var payout);
            if (served <= 0)
            {
                return 0;
            }

            _economy.Earn(payout, "serve");
            _combo.Increment();
            EventBus.Publish(
                new OrderCompleted(counter.Channel, served, payout, _combo.Current, 0f));
            return served;
        }

        /// <summary>
        /// Cash per second this shop earns with the player absent.
        /// </summary>
        /// <remarks>
        /// Any post that needs a worker and has no hire takes this to zero. A shop that
        /// visibly could not run itself never earns while the app is closed, and that is the
        /// strongest argument the game makes for hiring anybody.
        /// </remarks>
        public double IdleRatePerSecond(double averageIncomePerItem)
        {
            if (_chain.Count == 0)
            {
                return 0.0;
            }

            var rates = new double[_chain.Count];
            var automated = new bool[_chain.Count];
            for (var i = 0; i < _chain.Count; i++)
            {
                rates[i] = _chain[i].OutputPerSecond;
                automated[i] = _chain[i].IsAutomated;
            }

            var serveCapacity = 0.0;
            for (var i = 0; i < _counters.Count; i++)
            {
                if (_counters[i].IsStaffed)
                {
                    serveCapacity += _counters[i].ServeCapacityPerSecond;
                }
            }

            return EconomyMath.IdleRate(rates, automated, serveCapacity, averageIncomePerItem);
        }

        /// <summary>Whether every post is covered, so the shop runs without the player.</summary>
        public bool IsSelfRunning
        {
            get
            {
                for (var i = 0; i < _chain.Count; i++)
                {
                    if (!_chain[i].IsAutomated)
                    {
                        return false;
                    }
                }

                for (var i = 0; i < _counters.Count; i++)
                {
                    if (_counters[i].IsStaffed)
                    {
                        return true;
                    }
                }

                return false;
            }
        }
    }
}
