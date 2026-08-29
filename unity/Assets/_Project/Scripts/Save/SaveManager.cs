using System;
using SizzleStreet.Core;

namespace SizzleStreet.Save
{
    /// <summary>Where save bytes live. A file on the device; an in-memory dictionary in tests.</summary>
    public interface ISaveStore
    {
        bool Exists(string slot);

        byte[] Read(string slot);

        /// <summary>
        /// Writes atomically: to a temporary file, flushed, then moved over the live one.
        /// </summary>
        /// <remarks>
        /// Process death during a write must never leave a half-written save. It is the one
        /// failure that costs a player everything they have, and it arrives as a one-star
        /// review rather than a bug report.
        /// </remarks>
        void Write(string slot, byte[] payload);

        void Delete(string slot);
    }

    public interface ISaveService
    {
        SaveData Data { get; }

        /// <summary>Loads, verifying and migrating, falling back to the backup or a new game.</summary>
        void Load();

        /// <summary>Writes immediately, stamping the current time.</summary>
        void Save();

        /// <summary>Requests a save at the next safe moment.</summary>
        void RequestSave();

        /// <summary>Writes if a save has been requested. Called between frames, never mid-loop.</summary>
        void FlushIfRequested();
    }

    /// <summary>
    /// Loads and stores the save, with a backup slot and a refusal to lose progress quietly.
    /// </summary>
    /// <remarks>
    /// Two slots. The previous good save is kept, so a failed checksum falls back to it and
    /// reports <see cref="SaveRecovered"/> instead of resetting the player to zero. Starting a
    /// new game is the last resort, not the first response to an unreadable file.
    /// </remarks>
    public sealed class SaveManager : ISaveService
    {
        public const string PrimarySlot = "save";
        public const string BackupSlot = "save.backup";

        private readonly ISaveStore _store;
        private readonly ISaveSerializer _serializer;
        private readonly SaveMigrator _migrator;
        private readonly IClock _clock;
        private readonly double _startingCash;
        private readonly int _startingGems;

        private bool _saveRequested;
        private bool _primaryIsSuspect;

        public SaveManager(
            ISaveStore store,
            ISaveSerializer serializer,
            SaveMigrator migrator,
            IClock clock,
            double startingCash,
            int startingGems)
        {
            _store = store ?? throw new ArgumentNullException(nameof(store));
            _serializer = serializer ?? throw new ArgumentNullException(nameof(serializer));
            _migrator = migrator ?? throw new ArgumentNullException(nameof(migrator));
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));
            _startingCash = startingCash;
            _startingGems = startingGems;
        }

        public SaveData Data { get; private set; }

        /// <summary>True when the primary slot failed and the backup was used instead.</summary>
        public bool RecoveredFromBackup { get; private set; }

        /// <summary>True when no readable save was found and a new game was started.</summary>
        public bool StartedNewGame { get; private set; }

        public void Load()
        {
            RecoveredFromBackup = false;
            StartedNewGame = false;
            _primaryIsSuspect = false;

            if (TryLoadSlot(PrimarySlot, out var primary, out var primaryReason))
            {
                Data = primary;
                return;
            }

            if (_store.Exists(PrimarySlot))
            {
                // Only worth reporting when a save actually existed and failed. A first launch
                // has no primary slot, and that is not a recovery.
                _primaryIsSuspect = true;
                EventBus.Publish(new SaveRecovered(primaryReason ?? "unknown"));
            }

            if (TryLoadSlot(BackupSlot, out var backup, out _))
            {
                Data = backup;
                RecoveredFromBackup = true;

                // Promote the backup immediately. Leaving a known-bad primary in place means
                // the next launch repeats the whole recovery, and the launch after that may
                // find the backup overwritten by it.
                Save();
                return;
            }

            Data = SaveData.NewGame(_clock.NowUnixSeconds, _startingCash, _startingGems);
            StartedNewGame = true;
        }

        public void Save()
        {
            if (Data == null)
            {
                return;
            }

            Data.SavedAtUnix = _clock.NowUnixSeconds;
            Data.SchemaVersion = SaveData.CurrentSchemaVersion;

            var payload = _serializer.Serialize(Data);

            // Rotate before overwriting: the current primary becomes the backup only once the
            // new bytes are known good. Writing the primary first would leave both slots
            // holding the same untested data.
            //
            // Except when the primary is the file we just failed to read. Rotating then would
            // copy the corrupt bytes over the backup that is currently the player's only good
            // save — turning a recovered launch into a destroyed one on the launch after.
            if (!_primaryIsSuspect && _store.Exists(PrimarySlot))
            {
                var existing = _store.Read(PrimarySlot);
                if (existing != null && existing.Length > 0)
                {
                    _store.Write(BackupSlot, existing);
                }
            }

            _store.Write(PrimarySlot, payload);
            _primaryIsSuspect = false;
            _saveRequested = false;
        }

        public void RequestSave() => _saveRequested = true;

        public void FlushIfRequested()
        {
            if (_saveRequested)
            {
                Save();
            }
        }

        private bool TryLoadSlot(string slot, out SaveData data, out string failureReason)
        {
            data = null;
            failureReason = null;

            if (!_store.Exists(slot))
            {
                failureReason = "missing";
                return false;
            }

            var payload = _store.Read(slot);
            if (!_serializer.TryDeserialize(payload, out var loaded, out failureReason))
            {
                return false;
            }

            if (SaveMigrator.NeedsMigration(loaded) && !_migrator.TryMigrate(loaded, out failureReason))
            {
                return false;
            }

            if (loaded.SchemaVersion > SaveData.CurrentSchemaVersion)
            {
                failureReason = "from a newer build";
                return false;
            }

            data = loaded;
            return true;
        }
    }
}
