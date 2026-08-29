using System;
using System.Collections.Generic;

namespace SizzleStreet.Save
{
    /// <summary>One step forward in the save schema.</summary>
    public interface ISaveMigration
    {
        /// <summary>The version this migration upgrades from. It produces <c>FromVersion + 1</c>.</summary>
        int FromVersion { get; }

        void Apply(SaveData data);
    }

    /// <summary>
    /// Brings an older save up to the current schema, one version at a time.
    /// </summary>
    /// <remarks>
    /// <para>
    /// There are no migrations yet, and that is exactly when this should be built. A player
    /// who installs v1 and returns after three updates must have their progress carried
    /// forward through every intervening schema, and the only way to guarantee that is for
    /// each version to know how to become the next one. Writing the machinery once there are
    /// already saves in the wild is too late.
    /// </para>
    /// <para>
    /// Rules for adding one: migrations run in order and must be idempotent in effect,
    /// never destructive, and never dependent on live configuration — a migration that reads
    /// a cost curve will silently change behaviour the next time balance moves.
    /// </para>
    /// </remarks>
    public sealed class SaveMigrator
    {
        private readonly List<ISaveMigration> _migrations = new List<ISaveMigration>();

        public void Register(ISaveMigration migration)
        {
            if (migration == null)
            {
                throw new ArgumentNullException(nameof(migration));
            }

            _migrations.Add(migration);
            _migrations.Sort((left, right) => left.FromVersion.CompareTo(right.FromVersion));
        }

        /// <summary>Whether this save is older than the current schema.</summary>
        public static bool NeedsMigration(SaveData data) =>
            data != null && data.SchemaVersion < SaveData.CurrentSchemaVersion;

        /// <summary>
        /// Upgrades <paramref name="data"/> in place to the current schema.
        /// </summary>
        /// <returns>False if the save cannot be migrated, in which case it must not be used.</returns>
        /// <remarks>
        /// A save from the *future* — a player who downgraded, or moved a file from a device on
        /// a newer build — is refused rather than guessed at. Loading it would mean silently
        /// discarding fields this build does not know about, and then writing that loss back
        /// to disk on the next autosave.
        /// </remarks>
        public bool TryMigrate(SaveData data, out string failureReason)
        {
            failureReason = null;
            if (data == null)
            {
                failureReason = "null save";
                return false;
            }

            if (data.SchemaVersion > SaveData.CurrentSchemaVersion)
            {
                failureReason =
                    $"save is version {data.SchemaVersion}, this build understands {SaveData.CurrentSchemaVersion}";
                return false;
            }

            while (data.SchemaVersion < SaveData.CurrentSchemaVersion)
            {
                var migration = Find(data.SchemaVersion);
                if (migration == null)
                {
                    failureReason = $"no migration from version {data.SchemaVersion}";
                    return false;
                }

                migration.Apply(data);
                data.SchemaVersion = migration.FromVersion + 1;
            }

            return true;
        }

        private ISaveMigration Find(int fromVersion)
        {
            for (var i = 0; i < _migrations.Count; i++)
            {
                if (_migrations[i].FromVersion == fromVersion)
                {
                    return _migrations[i];
                }
            }

            return null;
        }
    }
}
