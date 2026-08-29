using System;
using SizzleStreet.Core;

namespace SizzleStreet.Simulation
{
    /// <summary>Where a customer is in their visit.</summary>
    public enum CustomerState
    {
        Entering = 0,
        Queueing = 1,
        Ordering = 2,
        WaitingForFood = 3,
        Paying = 4,
        Leaving = 5,

        /// <summary>Gave up. No payment, and the combo is gone.</summary>
        Abandoned = 6
    }

    /// <summary>
    /// One customer's visit, as pure state.
    /// </summary>
    /// <remarks>
    /// Patience only runs while they are actually waiting for food. A customer still shuffling
    /// forward in a queue is not yet impatient, and running the timer during the walk-in would
    /// make a long queue lethal in a way the player cannot see or act on.
    /// </remarks>
    public sealed class Customer : IPoolable
    {
        public CustomerState State { get; private set; } = CustomerState.Entering;

        public ServingChannel Channel { get; private set; }

        public int ItemsWanted { get; private set; }

        public int ItemsReceived { get; private set; }

        public double PatienceRemaining { get; private set; }

        public double PatienceTotal { get; private set; }

        /// <summary>Seconds spent waiting, for the analytics event and the tip bonus.</summary>
        public double WaitedSeconds { get; private set; }

        public int ItemsOutstanding => Math.Max(0, ItemsWanted - ItemsReceived);

        /// <summary>Patience left as a fraction, for the bar above their head.</summary>
        public float PatienceFraction =>
            PatienceTotal <= 0.0 ? 1f : (float)Math.Clamp(PatienceRemaining / PatienceTotal, 0.0, 1.0);

        public void Initialise(ServingChannel channel, int itemsWanted, double patienceSeconds)
        {
            Channel = channel;
            ItemsWanted = Math.Max(1, itemsWanted);
            ItemsReceived = 0;
            PatienceTotal = Math.Max(0.1, patienceSeconds);
            PatienceRemaining = PatienceTotal;
            WaitedSeconds = 0.0;
            State = CustomerState.Entering;
        }

        /// <summary>They have reached the front and placed their order. Patience starts now.</summary>
        public void BeginWaiting()
        {
            State = CustomerState.WaitingForFood;
        }

        public void EnterQueue() => State = CustomerState.Queueing;

        /// <summary>Advances patience. Returns true if they just gave up on this tick.</summary>
        public bool Tick(double deltaSeconds)
        {
            if (State != CustomerState.WaitingForFood || deltaSeconds <= 0.0)
            {
                return false;
            }

            WaitedSeconds += deltaSeconds;
            PatienceRemaining -= deltaSeconds;

            if (PatienceRemaining > 0.0)
            {
                return false;
            }

            PatienceRemaining = 0.0;
            State = CustomerState.Abandoned;
            return true;
        }

        /// <summary>Hands over up to <paramref name="available"/> items.</summary>
        /// <returns>How many were handed over.</returns>
        /// <remarks>
        /// Partial service is allowed and does not reset patience. A customer who wants five
        /// and gets two keeps waiting for the other three on the same clock — which is what
        /// makes carry capacity matter rather than being a convenience.
        /// </remarks>
        public int Serve(int available)
        {
            if (State != CustomerState.WaitingForFood || available <= 0)
            {
                return 0;
            }

            var given = Math.Min(available, ItemsOutstanding);
            ItemsReceived += given;

            if (ItemsOutstanding == 0)
            {
                State = CustomerState.Paying;
            }

            return given;
        }

        public void CompletePayment() => State = CustomerState.Leaving;

        public void OnSpawn()
        {
            State = CustomerState.Entering;
            ItemsWanted = 0;
            ItemsReceived = 0;
            PatienceRemaining = 0.0;
            PatienceTotal = 0.0;
            WaitedSeconds = 0.0;
        }

        public void OnDespawn()
        {
            State = CustomerState.Leaving;
        }
    }
}
