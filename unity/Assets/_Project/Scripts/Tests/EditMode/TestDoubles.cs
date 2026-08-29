using System.Collections.Generic;
using SizzleStreet.Core;
using SizzleStreet.Economy.Model;
using SizzleStreet.Save;

namespace SizzleStreet.Tests
{
    /// <summary>
    /// Plain settings objects for tests.
    /// </summary>
    /// <remarks>
    /// The economy interfaces exist so tests never have to construct a ScriptableObject or
    /// load an asset. Defaults here mirror <c>tools/balance/config.py</c>, but a test that
    /// depends on a specific value should set it explicitly rather than relying on these —
    /// otherwise a balance change breaks a test that was never about balance.
    /// </remarks>
    public sealed class TestEconomySettings : IEconomySettings
    {
        public double BasePrice { get; set; } = 3.0;
        public double PriceGrowth { get; set; } = 1.07;
        public double PriceUpgradeBaseCost { get; set; } = 120.0;
        public double PriceUpgradeCostGrowth { get; set; } = 1.15;
        public int PriceLevelsPerLocation { get; set; } = 12;
        public double ComboStep { get; set; } = 0.05;
        public int ComboCap { get; set; } = 10;
        public double OfflineCapSeconds { get; set; } = 4 * 60 * 60;
        public double OfflineEfficiency { get; set; } = 0.5;
        public double OfflineRewardMultiplier { get; set; } = 2.0;
        public double LevelThresholdBase { get; set; } = 60.0;
        public double LevelThresholdGrowth { get; set; } = 1.5;
        public int MaxPlayerLevel { get; set; } = 60;
        public double StartingCash { get; set; } = 10.0;
        public int StartingGems { get; set; }
    }

    public sealed class TestStationSettings : IStationSettings
    {
        public string Id { get; set; } = "station";
        public double BaseCost { get; set; } = 25.0;
        public double CostGrowth { get; set; } = 1.09;
        public double BaseOutput { get; set; } = 1.0;
        public double SpeedPerLevel { get; set; } = 1.07;
        public int OutputBuffer { get; set; } = 6;
        public int IngredientCapacity { get; set; } = 40;
        public bool RequiresWorker { get; set; } = true;
        public double StaffHireCost { get; set; } = 250.0;
        public double StaffSpeedMultiplier { get; set; } = 0.85;
    }

    public sealed class TestChannelSettings : IChannelSettings
    {
        public string Id { get; set; } = "counter";
        public ServingChannel Channel { get; set; } = ServingChannel.Counter;
        public double BasePatienceSeconds { get; set; } = 30.0;
        public int MinOrder { get; set; } = 2;
        public int MaxOrder { get; set; } = 2;
        public double PriceMultiplier { get; set; } = 1.0;
        public double BaseArrivalsPerSecond { get; set; } = 0.22;
        public int BaseSlots { get; set; } = 3;
        public double SlotBaseCost { get; set; } = 400.0;
        public double SlotCostGrowth { get; set; } = 1.14;
        public double StaffHireCost { get; set; } = 800.0;
        public double ServeSeconds { get; set; }
    }

    /// <summary>An in-memory save store, so tests never touch the filesystem.</summary>
    public sealed class InMemorySaveStore : ISaveStore
    {
        private readonly Dictionary<string, byte[]> _slots = new Dictionary<string, byte[]>();

        /// <summary>Slots written since construction, for asserting rotation behaviour.</summary>
        public List<string> Writes { get; } = new List<string>();

        public bool Exists(string slot) => _slots.ContainsKey(slot);

        public byte[] Read(string slot) => _slots.TryGetValue(slot, out var bytes) ? bytes : null;

        public void Write(string slot, byte[] payload)
        {
            _slots[slot] = payload;
            Writes.Add(slot);
        }

        public void Delete(string slot) => _slots.Remove(slot);

        /// <summary>Flips a byte in the middle of a slot, simulating a corrupted file.</summary>
        public void Corrupt(string slot)
        {
            if (_slots.TryGetValue(slot, out var bytes) && bytes.Length > 0)
            {
                bytes[bytes.Length / 2] ^= 0xFF;
            }
        }

        /// <summary>Cuts a slot short, simulating a process killed mid-write.</summary>
        public void Truncate(string slot, int keepBytes)
        {
            if (!_slots.TryGetValue(slot, out var bytes))
            {
                return;
            }

            var kept = new byte[System.Math.Min(keepBytes, bytes.Length)];
            System.Buffer.BlockCopy(bytes, 0, kept, 0, kept.Length);
            _slots[slot] = kept;
        }
    }

    /// <summary>A JSON codec for tests, so the save tests do not depend on Newtonsoft.</summary>
    /// <remarks>
    /// Round-tripping through an object graph is not the point of the save tests — the
    /// checksum, the encryption, the slot rotation and the migration gate are. This codec
    /// preserves enough of <see cref="SaveData"/> to prove those work, and does so with no
    /// external dependency and no reflection.
    /// </remarks>
    public sealed class TestJsonCodec : IJsonCodec
    {
        public string Serialize<T>(T value)
        {
            if (value is SaveData data)
            {
                return string.Join(
                    "|",
                    data.SchemaVersion.ToString(System.Globalization.CultureInfo.InvariantCulture),
                    data.SavedAtUnix.ToString("R", System.Globalization.CultureInfo.InvariantCulture),
                    data.Economy.Cash.ToString("R", System.Globalization.CultureInfo.InvariantCulture),
                    data.Economy.Gems.ToString(System.Globalization.CultureInfo.InvariantCulture),
                    data.Player.TotalEarned.ToString("R", System.Globalization.CultureInfo.InvariantCulture),
                    data.Player.Level.ToString(System.Globalization.CultureInfo.InvariantCulture));
            }

            return value?.ToString() ?? string.Empty;
        }

        public T Deserialize<T>(string json)
        {
            if (typeof(T) != typeof(SaveData))
            {
                return default;
            }

            var parts = json.Split('|');
            if (parts.Length < 6)
            {
                return default;
            }

            var culture = System.Globalization.CultureInfo.InvariantCulture;
            var data = new SaveData
            {
                SchemaVersion = int.Parse(parts[0], culture),
                SavedAtUnix = double.Parse(parts[1], culture)
            };
            data.Economy.Cash = double.Parse(parts[2], culture);
            data.Economy.Gems = int.Parse(parts[3], culture);
            data.Player.TotalEarned = double.Parse(parts[4], culture);
            data.Player.Level = int.Parse(parts[5], culture);
            return (T)(object)data;
        }
    }
}
