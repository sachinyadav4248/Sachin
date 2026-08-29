using System;

namespace SizzleStreet.Simulation
{
    /// <summary>What a hired worker is assigned to.</summary>
    public enum StaffPost
    {
        Station = 0,
        Channel = 1
    }

    /// <summary>
    /// A hired worker: the same abilities as the player, applied to one post forever.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Staff are slower than the player at the same station — 0.85 or so — and that is the
    /// point. What they buy is not speed, it is <em>parallelism</em>: a post with a hire on it
    /// stops competing for the player's hands. The player working four stations in sequence
    /// pays the sum of four times; four hires pay only the slowest of them.
    /// </para>
    /// <para>
    /// Workers go idle when their post has nothing to do, and the player wakes them by walking
    /// into them. That is a deliberate small tax on full automation: it keeps a reason to walk
    /// around a shop that otherwise runs itself.
    /// </para>
    /// </remarks>
    public sealed class StaffWorker
    {
        private readonly CarryStack _stack;
        private double _idleSeconds;

        public StaffWorker(StaffPost post, string postId, int carryCapacity)
        {
            Post = post;
            PostId = postId ?? throw new ArgumentNullException(nameof(postId));
            _stack = new CarryStack(carryCapacity);
        }

        public StaffPost Post { get; }

        public string PostId { get; }

        public CarryStack Stack => _stack;

        /// <summary>Whether the worker has downed tools and needs waking.</summary>
        public bool IsAsleep { get; private set; }

        /// <summary>Seconds of nothing to do before a worker falls asleep.</summary>
        public double SleepAfterSeconds { get; set; } = 45.0;

        /// <summary>Wakes the worker. Called when the player walks into them.</summary>
        public void Wake()
        {
            IsAsleep = false;
            _idleSeconds = 0.0;
        }

        /// <summary>
        /// Advances the worker. A station worker keeps its station manned; a channel worker
        /// ferries finished items to its counter.
        /// </summary>
        public void Tick(double deltaSeconds, Shop shop, ServiceCounter assignedCounter)
        {
            if (shop == null || IsAsleep)
            {
                return;
            }

            var didSomething = false;

            if (Post == StaffPost.Channel && assignedCounter != null)
            {
                if (!_stack.IsFull)
                {
                    didSomething |= shop.CollectFinished(_stack) > 0;
                }

                if (!_stack.IsEmpty)
                {
                    didSomething |= shop.Serve(assignedCounter, _stack) > 0;
                }
            }
            else
            {
                // A station worker's presence is what keeps the station producing; the station
                // itself does the work during its own tick.
                didSomething = true;
            }

            if (didSomething)
            {
                _idleSeconds = 0.0;
                return;
            }

            _idleSeconds += deltaSeconds;
            if (_idleSeconds >= SleepAfterSeconds)
            {
                IsAsleep = true;
            }
        }
    }
}
