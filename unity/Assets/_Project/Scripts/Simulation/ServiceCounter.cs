using System;
using System.Collections.Generic;
using SizzleStreet.Core;
using SizzleStreet.Economy;
using SizzleStreet.Economy.Model;

namespace SizzleStreet.Simulation
{
    /// <summary>
    /// One serving channel: its queue, its patience clock and its payouts.
    /// </summary>
    /// <remarks>
    /// The Counter and the Drive-Thru share this class but not their behaviour. The Drive-Thru
    /// is <see cref="IsOrdered"/>: cars cannot be served out of sequence, so an unserved car at
    /// the window holds up everyone behind it and one missed order costs more than one sale.
    /// The Counter lets the player serve whoever is ready.
    /// </remarks>
    public sealed class ServiceCounter
    {
        private readonly IChannelSettings _settings;
        private readonly List<Customer> _queue;
        private readonly Random _random;

        private int _slotLevel;
        private double _serveCooldown;

        public ServiceCounter(IChannelSettings settings, int seed = 0)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _queue = new List<Customer>(16);

            // Seeded so a balance run or a bug report can be reproduced exactly. Unseeded
            // randomness in a queue makes "it stalls sometimes" impossible to chase down.
            _random = seed == 0 ? new Random() : new Random(seed);
        }

        public ServingChannel Channel => _settings.Channel;

        /// <summary>Whether customers must be served strictly in arrival order.</summary>
        public bool IsOrdered => _settings.Channel == ServingChannel.DriveThru;

        public bool IsStaffed { get; set; }

        public int Capacity => _settings.BaseSlots + _slotLevel;

        public int QueueLength => _queue.Count;

        public bool HasRoom => _queue.Count < Capacity;

        public IReadOnlyList<Customer> Queue => _queue;

        /// <summary>Patience allowed at this location, after its tightening scale.</summary>
        public double PatienceSeconds { get; set; }

        /// <summary>Multiplier on this channel's payouts, including the location band.</summary>
        public double PriceMultiplier { get; set; } = 1.0;

        public void SetSlotLevel(int level) => _slotLevel = Math.Max(0, level);

        /// <summary>Adds a customer if there is room. Returns false if the queue is full.</summary>
        public bool TryAdmit(Customer customer)
        {
            if (customer == null || !HasRoom)
            {
                return false;
            }

            var items = _random.Next(_settings.MinOrder, _settings.MaxOrder + 1);
            var patience = PatienceSeconds > 0.0 ? PatienceSeconds : _settings.BasePatienceSeconds;
            customer.Initialise(_settings.Channel, items, patience);
            customer.EnterQueue();
            _queue.Add(customer);
            return true;
        }

        /// <summary>
        /// Advances every waiting customer's patience.
        /// </summary>
        /// <param name="abandoned">Customers who gave up this tick and must be despawned.</param>
        /// <returns>How many combos were broken — one per abandonment.</returns>
        public int Tick(double deltaSeconds, List<Customer> abandoned)
        {
            if (abandoned == null)
            {
                throw new ArgumentNullException(nameof(abandoned));
            }

            _serveCooldown = Math.Max(0.0, _serveCooldown - deltaSeconds);

            // Everyone within capacity is at the counter and waiting; anyone beyond it is
            // still shuffling forward and not yet impatient.
            var servingWindow = IsOrdered ? Math.Min(1, _queue.Count) : Math.Min(Capacity, _queue.Count);
            for (var i = 0; i < servingWindow; i++)
            {
                var customer = _queue[i];
                if (customer.State == CustomerState.Queueing)
                {
                    customer.BeginWaiting();
                }
            }

            var breaks = 0;

            // Backwards, because giving up removes from the list.
            for (var i = _queue.Count - 1; i >= 0; i--)
            {
                var customer = _queue[i];
                if (!customer.Tick(deltaSeconds))
                {
                    continue;
                }

                _queue.RemoveAt(i);
                abandoned.Add(customer);
                breaks++;
                EventBus.Publish(
                    new OrderAbandoned(_settings.Channel, customer.ItemsOutstanding, 1));
            }

            return breaks;
        }

        /// <summary>
        /// Serves the customer at the front from the carrier's stack.
        /// </summary>
        /// <returns>Items handed over. Zero if nobody is ready or the handover is still running.</returns>
        /// <remarks>
        /// The handover takes <see cref="IChannelSettings.ServeSeconds"/>, which is what bounds
        /// throughput independently of production: a kitchen that can make ten a second still
        /// cannot hand them over faster than people can take them.
        /// </remarks>
        public int TryServe(CarryStack carrier, double comboMultiplier, out double payout)
        {
            payout = 0.0;
            if (carrier == null || carrier.IsEmpty || _queue.Count == 0 || _serveCooldown > 0.0)
            {
                return 0;
            }

            var customer = FindServable();
            if (customer == null)
            {
                return 0;
            }

            var given = customer.Serve(Math.Min(carrier.Count, customer.ItemsOutstanding));
            if (given <= 0)
            {
                return 0;
            }

            carrier.TryRemove(given);
            _serveCooldown = _settings.ServeSeconds;
            payout = given * PriceMultiplier * comboMultiplier;
            return given;
        }

        /// <summary>Removes a customer who has been paid out and is walking away.</summary>
        public bool Release(Customer customer)
        {
            return customer != null && _queue.Remove(customer);
        }

        /// <summary>Items per second this channel can physically hand over.</summary>
        public double ServeCapacityPerSecond =>
            _settings.ServeSeconds <= 0.0 ? 0.0 : Capacity / _settings.ServeSeconds;

        private Customer FindServable()
        {
            if (_queue.Count == 0)
            {
                return null;
            }

            if (IsOrdered)
            {
                // A car at the window blocks the lane. If the front one is not ready, nobody is.
                var front = _queue[0];
                return front.State == CustomerState.WaitingForFood ? front : null;
            }

            for (var i = 0; i < _queue.Count; i++)
            {
                if (_queue[i].State == CustomerState.WaitingForFood)
                {
                    return _queue[i];
                }
            }

            return null;
        }
    }
}
