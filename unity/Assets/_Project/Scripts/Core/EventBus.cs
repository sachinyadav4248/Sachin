using System;
using System.Collections.Generic;

namespace SizzleStreet.Core
{
    /// <summary>
    /// Typed publish/subscribe, generic over the payload so publishing does not box.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the seam between simulation and presentation. The economy publishes
    /// <c>CashChanged</c>; the HUD, the analytics service and the floating-text pool all
    /// listen, and the economy knows about none of them.
    /// </para>
    /// <para>
    /// Payloads are structs and handler lists are preallocated, because this sits on the core
    /// loop and the core loop has a zero-allocation budget. Generic static state gives each
    /// payload type its own list with no dictionary lookup and no type-key hashing per publish.
    /// </para>
    /// </remarks>
    public static class EventBus
    {
        /// <summary>
        /// Per-payload-type handler storage. The C# runtime instantiates one of these per
        /// <typeparamref name="T"/>, which is what makes publish a direct field access.
        /// </summary>
        private static class Channel<T> where T : struct
        {
            internal static readonly List<Action<T>> Handlers = new List<Action<T>>(8);

            /// <summary>Snapshot used during dispatch so handlers may subscribe safely.</summary>
            internal static readonly List<Action<T>> Dispatching = new List<Action<T>>(8);

            internal static bool IsDispatching;
            internal static readonly List<Action<T>> PendingAdds = new List<Action<T>>(4);
            internal static readonly List<Action<T>> PendingRemoves = new List<Action<T>>(4);
        }

        /// <summary>Registers a handler. Safe to call from inside a handler.</summary>
        public static void Subscribe<T>(Action<T> handler) where T : struct
        {
            if (handler == null)
            {
                throw new ArgumentNullException(nameof(handler));
            }

            if (Channel<T>.IsDispatching)
            {
                Channel<T>.PendingAdds.Add(handler);
                return;
            }

            Channel<T>.Handlers.Add(handler);
        }

        /// <summary>Removes a handler. Safe to call from inside a handler.</summary>
        public static void Unsubscribe<T>(Action<T> handler) where T : struct
        {
            if (handler == null)
            {
                return;
            }

            if (Channel<T>.IsDispatching)
            {
                Channel<T>.PendingRemoves.Add(handler);
                return;
            }

            Channel<T>.Handlers.Remove(handler);
        }

        /// <summary>
        /// Delivers <paramref name="payload"/> to every current subscriber.
        /// </summary>
        /// <remarks>
        /// Dispatch iterates a snapshot and defers subscription changes until it finishes. A
        /// handler that subscribes or unsubscribes mid-dispatch is not a hypothetical — a
        /// popup that closes itself in response to the event it is handling does exactly that
        /// — and without this it corrupts the iteration under an ordering that only shows up
        /// occasionally, on a device, in someone else's session.
        /// </remarks>
        public static void Publish<T>(T payload) where T : struct
        {
            var handlers = Channel<T>.Handlers;
            if (handlers.Count == 0)
            {
                return;
            }

            var snapshot = Channel<T>.Dispatching;
            snapshot.Clear();
            for (var i = 0; i < handlers.Count; i++)
            {
                snapshot.Add(handlers[i]);
            }

            Channel<T>.IsDispatching = true;
            try
            {
                for (var i = 0; i < snapshot.Count; i++)
                {
                    snapshot[i].Invoke(payload);
                }
            }
            finally
            {
                Channel<T>.IsDispatching = false;
                ApplyPending<T>();
                snapshot.Clear();
            }
        }

        /// <summary>
        /// Drops every handler for a payload type. Tests call this between cases; nothing in
        /// the game should, because it silently unhooks systems that are still alive.
        /// </summary>
        public static void ClearHandlers<T>() where T : struct
        {
            Channel<T>.Handlers.Clear();
            Channel<T>.PendingAdds.Clear();
            Channel<T>.PendingRemoves.Clear();
        }

        /// <summary>Number of live subscribers, for tests and leak diagnostics.</summary>
        public static int HandlerCount<T>() where T : struct => Channel<T>.Handlers.Count;

        private static void ApplyPending<T>() where T : struct
        {
            var adds = Channel<T>.PendingAdds;
            for (var i = 0; i < adds.Count; i++)
            {
                Channel<T>.Handlers.Add(adds[i]);
            }

            adds.Clear();

            var removes = Channel<T>.PendingRemoves;
            for (var i = 0; i < removes.Count; i++)
            {
                Channel<T>.Handlers.Remove(removes[i]);
            }

            removes.Clear();
        }
    }
}
