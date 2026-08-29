using System;
using System.IO;
using Android.App;
using Android.Content.PM;
using Android.OS;
using Android.Views;
using SizzleStreet.Core;
using SizzleStreet.Save;
using SizzleStreet.Serialization;

namespace SizzleStreet.Android
{
    /// <summary>
    /// Starts the game: services first, then the save, then the world, then the view.
    /// </summary>
    /// <remarks>
    /// This is the Bootstrap sequence from the architecture document, minus the services that
    /// only have null implementations so far. Nothing here blocks on a network call, and
    /// nothing needs one.
    /// </remarks>
    [Activity(
        Label = "Sizzle Street",
        MainLauncher = true,
        ScreenOrientation = ScreenOrientation.Portrait,
        Theme = "@android:style/Theme.Black.NoTitleBar.Fullscreen",
        ConfigurationChanges = ConfigChanges.Orientation | ConfigChanges.ScreenSize)]
    public sealed class MainActivity : Activity
    {
        private GameWorld _world;
        private GameView _view;
        private SaveManager _save;

        protected override void OnCreate(Bundle savedInstanceState)
        {
            base.OnCreate(savedInstanceState);

            Window?.AddFlags(WindowManagerFlags.KeepScreenOn);

            var directory = FilesDir.AbsolutePath;
            var store = new AndroidFileSaveStore(directory);
            var serializer = new SaveSerializer(new NewtonsoftJsonCodec(), KeyMaterial(directory));

            // The view is created before the clock so the clock can read its frame timings; the
            // world is created before the view because the view draws it. Hence the two-step.
            GameView view = null;
            var clock = new SizzleStreet.Core.SystemClock(
                () => view?.LastDelta ?? 0f,
                () => view?.SessionSeconds ?? 0.0);

            _save = new SaveManager(
                store,
                serializer,
                new SaveMigrator(),
                clock,
                Economy.Generated.GeneratedBalance.EconomySettings.StartingCash,
                Economy.Generated.GeneratedBalance.EconomySettings.StartingGems);

            _save.Load();

            _world = new GameWorld(_save, clock);
            view = new GameView(this, _world);
            _view = view;

            SetContentView(_view);
        }

        protected override void OnPause()
        {
            base.OnPause();

            // Android kills backgrounded processes without warning, so this is the last moment
            // anything is guaranteed to run. Everything worth keeping is written here.
            _world?.Persist();
        }

        /// <summary>
        /// Per-install key seed for save encryption.
        /// </summary>
        /// <remarks>
        /// Kept in a plain file beside the saves, which sounds absurd until you remember what
        /// the encryption is for: it is obfuscation to discourage casual save editing, not
        /// security. A per-install seed at least means extracting one player's key does not
        /// unlock everyone's. Nothing that gates a purchase may trust any of it.
        /// </remarks>
        private static string KeyMaterial(string directory)
        {
            var path = Path.Combine(directory, "install.id");
            if (File.Exists(path))
            {
                var existing = File.ReadAllText(path);
                if (!string.IsNullOrWhiteSpace(existing))
                {
                    return existing;
                }
            }

            var generated = Guid.NewGuid().ToString("N");
            File.WriteAllText(path, generated);
            return generated;
        }
    }
}
