using System;

namespace SizzleStreet.Core
{
    /// <summary>
    /// The only source of time the simulation is allowed to read.
    /// </summary>
    /// <remarks>
    /// Injecting time rather than calling <see cref="DateTime.UtcNow"/> is what makes offline
    /// earnings testable. A test can hand the offline calculator a clock reading two days
    /// later, or one reading 1970, and assert what happens — neither of which is possible
    /// against a static call to the system clock.
    /// </remarks>
    public interface IClock
    {
        /// <summary>Wall-clock time as Unix seconds. Moves when the device clock moves.</summary>
        double NowUnixSeconds { get; }

        /// <summary>
        /// Seconds since the process started. Monotonic, unaffected by the device clock, and
        /// therefore the right choice for anything measuring a duration within a session.
        /// </summary>
        double SessionSeconds { get; }

        /// <summary>Seconds since the last frame, already scaled by any pause or slow-motion.</summary>
        float DeltaSeconds { get; }
    }

    /// <summary>Reads the real device clock. The production implementation.</summary>
    public sealed class SystemClock : IClock
    {
        private static readonly DateTime UnixEpoch =
            new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        private readonly Func<float> _deltaProvider;
        private readonly Func<double> _sessionProvider;

        /// <param name="deltaProvider">Supplies frame delta, normally <c>Time.deltaTime</c>.</param>
        /// <param name="sessionProvider">Supplies monotonic session time, normally
        /// <c>Time.realtimeSinceStartupAsDouble</c>.</param>
        /// <remarks>
        /// The engine values arrive as delegates so this class stays free of
        /// <c>UnityEngine</c> and can be constructed in a headless test.
        /// </remarks>
        public SystemClock(Func<float> deltaProvider, Func<double> sessionProvider)
        {
            _deltaProvider = deltaProvider ?? throw new ArgumentNullException(nameof(deltaProvider));
            _sessionProvider = sessionProvider ?? throw new ArgumentNullException(nameof(sessionProvider));
        }

        public double NowUnixSeconds => (DateTime.UtcNow - UnixEpoch).TotalSeconds;

        public double SessionSeconds => _sessionProvider();

        public float DeltaSeconds => _deltaProvider();
    }

    /// <summary>A clock the test drives by hand.</summary>
    public sealed class TestClock : IClock
    {
        public double NowUnixSeconds { get; set; }

        public double SessionSeconds { get; set; }

        public float DeltaSeconds { get; set; }

        /// <summary>Advances both wall-clock and session time by the same amount.</summary>
        public void Advance(double seconds)
        {
            NowUnixSeconds += seconds;
            SessionSeconds += seconds;
        }

        /// <summary>
        /// Moves wall-clock time only, leaving session time alone — what a player changing
        /// their device clock mid-session actually does.
        /// </summary>
        public void SetWallClock(double unixSeconds) => NowUnixSeconds = unixSeconds;
    }
}
