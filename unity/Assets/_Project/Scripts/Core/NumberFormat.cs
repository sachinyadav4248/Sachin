using System;
using System.Globalization;
using System.Text;

namespace SizzleStreet.Core
{
    /// <summary>
    /// Formats the very large numbers an idle economy produces into something a player can
    /// read at a glance.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Below a thousand, numbers are shown whole. Above it they are shown to three
    /// significant figures with a suffix: 1.24K, 15.7M, 890B. Past trillions the standard
    /// short-scale names run out and become useless to most players anyway, so the scheme
    /// switches to the two-letter sequence idle games have converged on — aa, ab, ac — which
    /// is at least unambiguous about ordering.
    /// </para>
    /// <para>
    /// Formatting allocates a string, so callers must only reformat when the displayed value
    /// actually changes. A HUD that reformats an unchanged balance every frame is a steady
    /// drip of garbage on the core loop, which the frame budget does not have room for.
    /// <see cref="HasVisiblyChanged"/> exists so callers can check cheaply.
    /// </para>
    /// <para>
    /// The suffixes are placeholders pending localisation. Grouping and decimal separators
    /// already follow the player's culture; the suffix letters do not translate and several
    /// markets — CJK especially — count in different groupings entirely. Wiring these to the
    /// string tables is tracked as part of the localisation pass.
    /// </para>
    /// </remarks>
    public static class NumberFormat
    {
        private static readonly string[] Suffixes =
        {
            "", "K", "M", "B", "T"
        };

        private const int NamedSuffixCount = 5;
        private const double Threshold = 1000.0;

        [ThreadStatic]
        private static StringBuilder _builder;

        /// <summary>Formats a currency amount for display.</summary>
        public static string Currency(double value, IFormatProvider culture = null)
        {
            culture ??= CultureInfo.CurrentCulture;

            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                // Reaching here means an economy bug upstream. Showing a placeholder beats
                // showing "NaN" to a player or throwing inside a UI refresh.
                return "—";
            }

            var negative = value < 0.0;
            var magnitude = Math.Abs(value);

            if (magnitude < Threshold)
            {
                var whole = Math.Floor(magnitude);
                return negative
                    ? "-" + whole.ToString("0", culture)
                    : whole.ToString("0", culture);
            }

            var tier = 0;
            while (magnitude >= Threshold)
            {
                magnitude /= Threshold;
                tier++;
            }

            var builder = _builder ??= new StringBuilder(24);
            builder.Clear();

            if (negative)
            {
                builder.Append('-');
            }

            // Three significant figures: 999 stays 999, 99.9 keeps one decimal, 9.99 keeps two.
            var format = magnitude >= 100.0 ? "0" : magnitude >= 10.0 ? "0.0" : "0.00";
            builder.Append(magnitude.ToString(format, culture));
            builder.Append(SuffixFor(tier));
            return builder.ToString();
        }

        /// <summary>
        /// Whether two values would render differently, so a caller can skip reformatting.
        /// </summary>
        /// <remarks>
        /// Compares at three significant figures, matching what <see cref="Currency"/>
        /// actually shows. Cash arrives in a continuous trickle, so the underlying double
        /// changes every frame while the rendered string changes a few times a second.
        /// </remarks>
        public static bool HasVisiblyChanged(double previous, double current)
        {
            if (previous.Equals(current))
            {
                return false;
            }

            var larger = Math.Max(Math.Abs(previous), Math.Abs(current));
            if (larger < Threshold)
            {
                return Math.Floor(previous) != Math.Floor(current);
            }

            return Math.Abs(current - previous) >= larger * 0.001;
        }

        /// <summary>Formats a duration as the "away for 3h 12m" line on the offline popup.</summary>
        public static string Duration(double seconds, IFormatProvider culture = null)
        {
            culture ??= CultureInfo.CurrentCulture;
            if (seconds < 0.0)
            {
                seconds = 0.0;
            }

            var span = TimeSpan.FromSeconds(seconds);
            if (span.TotalHours >= 1.0)
            {
                return string.Format(culture, "{0}h {1:00}m", (int)span.TotalHours, span.Minutes);
            }

            return span.TotalMinutes >= 1.0
                ? string.Format(culture, "{0}m {1:00}s", (int)span.TotalMinutes, span.Seconds)
                : string.Format(culture, "{0}s", (int)span.TotalSeconds);
        }

        private static string SuffixFor(int tier)
        {
            if (tier < NamedSuffixCount)
            {
                return Suffixes[tier];
            }

            // aa, ab, ... az, ba, ... Ordering is what matters here; nobody reads these as
            // words, they read them as "bigger than the last one".
            var index = tier - NamedSuffixCount;
            var first = (char)('a' + index / 26 % 26);
            var second = (char)('a' + index % 26);
            return string.Concat(first.ToString(), second.ToString());
        }
    }
}
