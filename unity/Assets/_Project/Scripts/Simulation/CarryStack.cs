using System;
using SizzleStreet.Core;

namespace SizzleStreet.Simulation
{
    /// <summary>
    /// The visible stack of boxes the player or a staff member is carrying.
    /// </summary>
    /// <remarks>
    /// Capacity is the quietest upgrade in the game and one of the most valuable: it decides
    /// how many trips it takes to clear a queue, and therefore how much of the player's time
    /// is spent walking rather than serving.
    /// </remarks>
    public sealed class CarryStack
    {
        private int _count;
        private int _capacity;
        private readonly bool _publishesEvents;

        /// <param name="publishesEvents">
        /// True for the player's stack, which the HUD watches. False for staff, whose stacks
        /// change constantly and would flood the bus with events nothing is listening for.
        /// </param>
        public CarryStack(int capacity, bool publishesEvents = false)
        {
            _capacity = Math.Max(1, capacity);
            _publishesEvents = publishesEvents;
        }

        public int Count => _count;

        public int Capacity => _capacity;

        public bool IsFull => _count >= _capacity;

        public bool IsEmpty => _count <= 0;

        public int FreeSpace => Math.Max(0, _capacity - _count);

        /// <summary>Adds up to <paramref name="count"/> items, stopping at capacity.</summary>
        /// <returns>How many were accepted.</returns>
        public int TryAdd(int count)
        {
            if (count <= 0)
            {
                return 0;
            }

            var accepted = Math.Min(count, FreeSpace);
            if (accepted <= 0)
            {
                return 0;
            }

            _count += accepted;
            Publish();
            return accepted;
        }

        /// <summary>Removes up to <paramref name="count"/> items.</summary>
        /// <returns>How many were actually removed.</returns>
        public int TryRemove(int count)
        {
            if (count <= 0 || _count <= 0)
            {
                return 0;
            }

            var removed = Math.Min(count, _count);
            _count -= removed;
            Publish();
            return removed;
        }

        /// <summary>Raises capacity, keeping what is already carried.</summary>
        public void SetCapacity(int capacity)
        {
            _capacity = Math.Max(1, capacity);

            // A capacity that somehow drops below what is held must not leave the stack in an
            // impossible state, so the excess is discarded rather than carried invisibly.
            if (_count > _capacity)
            {
                _count = _capacity;
            }

            Publish();
        }

        public void Clear()
        {
            _count = 0;
            Publish();
        }

        private void Publish()
        {
            if (_publishesEvents)
            {
                EventBus.Publish(new CarryStackChanged(_count, _capacity));
            }
        }
    }
}
