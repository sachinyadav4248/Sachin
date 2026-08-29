using System;
using System.Collections.Generic;

namespace SizzleStreet.Core
{
    /// <summary>
    /// Implemented by anything pooled, to reset itself between lives.
    /// </summary>
    /// <remarks>
    /// The commonest pooling bug by a distance is a recycled object carrying state from its
    /// last life — a customer that spawns already angry, a coin still mid-tween, a box with a
    /// stale parent. <see cref="OnSpawn"/> must leave the object exactly as a freshly
    /// constructed one, and it is the implementer's job, not the pool's.
    /// </remarks>
    public interface IPoolable
    {
        /// <summary>Called as the object leaves the pool. Reset everything here.</summary>
        void OnSpawn();

        /// <summary>Called as it returns. Release references so nothing is kept alive.</summary>
        void OnDespawn();
    }

    /// <summary>A fixed-growth pool of reusable objects.</summary>
    /// <remarks>
    /// Prewarm to the worst case a scene can produce. Rush Hour triples arrivals on both
    /// channels at once, and a pool that grows during it allocates at exactly the moment the
    /// frame budget is tightest.
    /// </remarks>
    public sealed class ObjectPool<T> where T : class, IPoolable
    {
        private readonly Func<T> _factory;
        private readonly Stack<T> _available;
        private readonly HashSet<T> _live;
        private readonly int _maxSize;

        /// <param name="factory">Creates a new instance when the pool is empty.</param>
        /// <param name="prewarm">Instances to create up front.</param>
        /// <param name="maxSize">
        /// Cap on total instances. Beyond it, <see cref="Rent"/> returns null rather than
        /// growing without bound — a spawner asking for a thousandth customer has a bug, and
        /// exhausting memory hides it behind an out-of-memory crash on someone's phone.
        /// </param>
        public ObjectPool(Func<T> factory, int prewarm = 0, int maxSize = 512)
        {
            _factory = factory ?? throw new ArgumentNullException(nameof(factory));
            if (maxSize <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(maxSize));
            }

            _maxSize = maxSize;
            _available = new Stack<T>(Math.Max(prewarm, 4));
            _live = new HashSet<T>();

            for (var i = 0; i < prewarm && i < maxSize; i++)
            {
                _available.Push(_factory());
            }
        }

        /// <summary>Instances currently checked out.</summary>
        public int LiveCount => _live.Count;

        /// <summary>Instances waiting to be reused.</summary>
        public int AvailableCount => _available.Count;

        /// <summary>Total instances ever created, live plus available.</summary>
        public int TotalCount => _live.Count + _available.Count;

        /// <summary>Takes an instance from the pool, or null if the cap is reached.</summary>
        public T Rent()
        {
            T instance;
            if (_available.Count > 0)
            {
                instance = _available.Pop();
            }
            else if (TotalCount < _maxSize)
            {
                instance = _factory();
            }
            else
            {
                return null;
            }

            _live.Add(instance);
            instance.OnSpawn();
            return instance;
        }

        /// <summary>Returns an instance to the pool.</summary>
        /// <remarks>
        /// Returning the same instance twice would put it in the pool twice and hand it to two
        /// callers at once — a bug that presents as two customers sharing one body. The live
        /// set makes it a no-op instead.
        /// </remarks>
        public void Return(T instance)
        {
            if (instance == null || !_live.Remove(instance))
            {
                return;
            }

            instance.OnDespawn();
            _available.Push(instance);
        }

        /// <summary>Drops every pooled instance. Called when unloading a location.</summary>
        public void Clear()
        {
            _available.Clear();
            _live.Clear();
        }
    }
}
