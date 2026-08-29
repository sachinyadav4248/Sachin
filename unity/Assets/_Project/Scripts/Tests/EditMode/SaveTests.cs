using NUnit.Framework;
using SizzleStreet.Core;
using SizzleStreet.Save;

namespace SizzleStreet.Tests
{
    /// <summary>
    /// Tests for the one system whose failure costs a player everything.
    /// </summary>
    /// <remarks>
    /// These cover what actually goes wrong in the field: a file truncated by a process kill,
    /// a save edited by a player, and a save written by a build newer than this one. Each has a
    /// defined answer, and none of them is "start a new game".
    /// </remarks>
    [TestFixture]
    public sealed class SaveTests
    {
        private const string Key = "test-key-material";

        private InMemorySaveStore _store;
        private SaveSerializer _serializer;
        private SaveMigrator _migrator;
        private TestClock _clock;

        [SetUp]
        public void SetUp()
        {
            _store = new InMemorySaveStore();
            _serializer = new SaveSerializer(new TestJsonCodec(), Key);
            _migrator = new SaveMigrator();
            _clock = new TestClock { NowUnixSeconds = 1_700_000_000.0 };
            EventBus.ClearHandlers<SaveRecovered>();
        }

        private SaveManager NewManager() =>
            new SaveManager(_store, _serializer, _migrator, _clock, startingCash: 10.0, startingGems: 0);

        [Test]
        public void ASaveRoundTrips()
        {
            var manager = NewManager();
            manager.Load();
            manager.Data.Economy.Cash = 12345.6789;
            manager.Data.Player.TotalEarned = 99999.5;
            manager.Save();

            var reloaded = NewManager();
            reloaded.Load();

            Assert.That(reloaded.Data.Economy.Cash, Is.EqualTo(12345.6789).Within(1e-9));
            Assert.That(reloaded.Data.Player.TotalEarned, Is.EqualTo(99999.5).Within(1e-9));
            Assert.That(reloaded.StartedNewGame, Is.False);
        }

        [Test]
        public void AFirstLaunchStartsANewGame()
        {
            var manager = NewManager();
            manager.Load();

            Assert.That(manager.StartedNewGame, Is.True);
            Assert.That(manager.Data.Economy.Cash, Is.EqualTo(10.0));
            Assert.That(manager.Data.Locations, Has.Count.EqualTo(1));
            Assert.That(manager.Data.Locations[0].IsUnlocked, Is.True);
        }

        [Test]
        public void AFirstLaunchDoesNotReportARecovery()
        {
            // Reporting a recovery on every fresh install would bury the real signal: a rise in
            // this event means a corruption bug, and it is worthless if it fires for everyone.
            var recoveries = 0;
            EventBus.Subscribe<SaveRecovered>(_ => recoveries++);

            NewManager().Load();

            Assert.That(recoveries, Is.Zero);
        }

        [Test]
        public void AnEditedSaveIsRejected()
        {
            var manager = NewManager();
            manager.Load();
            manager.Data.Economy.Cash = 500.0;
            manager.Save();

            _store.Corrupt(SaveManager.PrimarySlot);

            var payload = _store.Read(SaveManager.PrimarySlot);
            Assert.That(
                _serializer.TryDeserialize(payload, out _, out var reason), Is.False,
                "an edited save must not deserialise");
            Assert.That(reason, Is.Not.Null);
        }

        [Test]
        public void ATruncatedSaveIsRejected()
        {
            var manager = NewManager();
            manager.Load();
            manager.Save();

            _store.Truncate(SaveManager.PrimarySlot, 20);

            Assert.That(
                _serializer.TryDeserialize(_store.Read(SaveManager.PrimarySlot), out _, out var reason),
                Is.False);
            Assert.That(reason, Is.EqualTo("truncated"));
        }

        [Test]
        public void ADamagedPrimaryFallsBackToTheBackup()
        {
            var manager = NewManager();
            manager.Load();

            manager.Data.Economy.Cash = 111.0;
            manager.Save();

            // The second save rotates the first into the backup slot.
            manager.Data.Economy.Cash = 222.0;
            manager.Save();

            _store.Corrupt(SaveManager.PrimarySlot);

            var recovered = NewManager();
            recovered.Load();

            Assert.That(recovered.RecoveredFromBackup, Is.True);
            Assert.That(recovered.StartedNewGame, Is.False, "progress must not be reset");
            Assert.That(recovered.Data.Economy.Cash, Is.EqualTo(111.0).Within(1e-9));
        }

        [Test]
        public void ARecoveryIsReported()
        {
            var manager = NewManager();
            manager.Load();
            manager.Save();
            manager.Save();
            _store.Corrupt(SaveManager.PrimarySlot);

            var recoveries = 0;
            EventBus.Subscribe<SaveRecovered>(_ => recoveries++);

            NewManager().Load();

            Assert.That(recoveries, Is.EqualTo(1));
        }

        [Test]
        public void ARecoveryPromotesTheBackupImmediately()
        {
            // Otherwise every subsequent launch repeats the recovery, and the launch after that
            // may find the good backup already overwritten by the bad primary.
            var manager = NewManager();
            manager.Load();
            manager.Save();
            manager.Save();
            _store.Corrupt(SaveManager.PrimarySlot);

            NewManager().Load();

            var third = NewManager();
            third.Load();
            Assert.That(third.RecoveredFromBackup, Is.False);
        }

        [Test]
        public void ARecoveryDoesNotDestroyTheBackup()
        {
            // The promoting save must not rotate the corrupt primary over the backup. If it
            // does, a single bad file turns into total loss one launch later.
            var manager = NewManager();
            manager.Load();
            manager.Data.Economy.Cash = 111.0;
            manager.Save();
            manager.Data.Economy.Cash = 222.0;
            manager.Save();
            _store.Corrupt(SaveManager.PrimarySlot);

            NewManager().Load();

            Assert.That(
                _serializer.TryDeserialize(_store.Read(SaveManager.BackupSlot), out var backup, out _),
                Is.True,
                "the backup slot must still hold a readable save after a recovery");
            Assert.That(backup.Economy.Cash, Is.EqualTo(111.0).Within(1e-9));
        }

        [Test]
        public void ASaveFromANewerBuildIsRefused()
        {
            var manager = NewManager();
            manager.Load();
            manager.Save();

            var data = new SaveData { SchemaVersion = SaveData.CurrentSchemaVersion + 5 };
            Assert.That(_migrator.TryMigrate(data, out var reason), Is.False);
            Assert.That(reason, Does.Contain("understands"));
        }

        [Test]
        public void ACurrentSaveNeedsNoMigration()
        {
            Assert.That(SaveMigrator.NeedsMigration(new SaveData()), Is.False);
        }

        [Test]
        public void AMigrationRunsAndAdvancesTheVersion()
        {
            var data = new SaveData { SchemaVersion = SaveData.CurrentSchemaVersion };
            data.SchemaVersion = 0;

            var applied = false;
            _migrator.Register(new DelegateMigration(0, _ => applied = true));

            Assert.That(_migrator.TryMigrate(data, out _), Is.True);
            Assert.That(applied, Is.True);
            Assert.That(data.SchemaVersion, Is.EqualTo(SaveData.CurrentSchemaVersion));
        }

        [Test]
        public void AMissingMigrationFailsRatherThanGuessing()
        {
            var data = new SaveData { SchemaVersion = 0 };

            Assert.That(_migrator.TryMigrate(data, out var reason), Is.False);
            Assert.That(reason, Does.Contain("no migration"));
        }

        [Test]
        public void SavingStampsTheCurrentTime()
        {
            var manager = NewManager();
            manager.Load();
            _clock.Advance(600.0);
            manager.Save();

            Assert.That(manager.Data.SavedAtUnix, Is.EqualTo(1_700_000_600.0).Within(1e-6));
        }

        [Test]
        public void ARequestedSaveIsWrittenOnFlush()
        {
            var manager = NewManager();
            manager.Load();
            manager.Data.Economy.Cash = 42.0;
            manager.RequestSave();

            Assert.That(_store.Exists(SaveManager.PrimarySlot), Is.False);

            manager.FlushIfRequested();
            Assert.That(_store.Exists(SaveManager.PrimarySlot), Is.True);

            // A second flush without a new request must not write again — autosave sits on the
            // pause path, and a redundant serialise there is a visible hitch.
            _store.Writes.Clear();
            manager.FlushIfRequested();
            Assert.That(_store.Writes, Is.Empty);
        }

        private sealed class DelegateMigration : ISaveMigration
        {
            private readonly System.Action<SaveData> _apply;

            public DelegateMigration(int fromVersion, System.Action<SaveData> apply)
            {
                FromVersion = fromVersion;
                _apply = apply;
            }

            public int FromVersion { get; }

            public void Apply(SaveData data) => _apply(data);
        }
    }
}
