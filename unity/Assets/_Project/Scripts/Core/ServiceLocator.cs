using System;
using System.Collections.Generic;

namespace SizzleStreet.Core
{
    /// <summary>
    /// Registry of the game's services, populated once during bootstrap.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A service locator is a global with extra steps, and it is chosen here with that fully
    /// in mind. The alternatives are worse at this size: <c>static Instance</c> singletons
    /// make the economy impossible to test in isolation, and threading constructor injection
    /// through <c>MonoBehaviour</c> instantiation buys little for a game with seven services.
    /// </para>
    /// <para>
    /// What keeps it honest is the discipline around it. Registration happens once, in
    /// bootstrap, before any gameplay scene loads. Gameplay resolves in <c>Awake</c> and
    /// caches. Nothing resolves during <c>Update</c>. And every service interface has a null
    /// implementation, so a missing registration degrades to a playable game rather than a
    /// null reference at the worst possible moment.
    /// </para>
    /// </remarks>
    public static class ServiceLocator
    {
        private static readonly Dictionary<Type, object> Services = new Dictionary<Type, object>(16);

        /// <summary>Registers the implementation of <typeparamref name="TService"/>.</summary>
        /// <exception cref="InvalidOperationException">
        /// If one is already registered. Silent replacement hides a double-bootstrap, which
        /// otherwise shows up much later as two economies disagreeing about the balance.
        /// </exception>
        public static void Register<TService>(TService service) where TService : class
        {
            if (service == null)
            {
                throw new ArgumentNullException(nameof(service));
            }

            var key = typeof(TService);
            if (Services.ContainsKey(key))
            {
                throw new InvalidOperationException(
                    $"{key.Name} is already registered. Services are registered once, during bootstrap.");
            }

            Services.Add(key, service);
        }

        /// <summary>Replaces an existing registration. For tests and hot-swapping a null service.</summary>
        public static void Replace<TService>(TService service) where TService : class
        {
            if (service == null)
            {
                throw new ArgumentNullException(nameof(service));
            }

            Services[typeof(TService)] = service;
        }

        /// <summary>Resolves a service.</summary>
        /// <exception cref="InvalidOperationException">If nothing is registered for the type.</exception>
        public static TService Resolve<TService>() where TService : class
        {
            if (Services.TryGetValue(typeof(TService), out var service))
            {
                return (TService)service;
            }

            throw new InvalidOperationException(
                $"No {typeof(TService).Name} registered. Bootstrap must register every service, " +
                "including the null implementations, before loading a gameplay scene.");
        }

        /// <summary>Resolves a service, or returns null if none is registered.</summary>
        public static TService TryResolve<TService>() where TService : class
        {
            return Services.TryGetValue(typeof(TService), out var service) ? (TService)service : null;
        }

        public static bool IsRegistered<TService>() where TService : class
        {
            return Services.ContainsKey(typeof(TService));
        }

        /// <summary>Empties the registry. Tests call this between cases.</summary>
        public static void Reset() => Services.Clear();
    }
}
