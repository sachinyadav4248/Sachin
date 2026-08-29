using System;
using System.Collections.Generic;
using SizzleStreet.Core;
using SizzleStreet.Economy;
using SizzleStreet.Economy.Generated;
using SizzleStreet.Economy.Model;
using SizzleStreet.Save;
using SizzleStreet.Simulation;

namespace SizzleStreet.Android
{
    /// <summary>A point in normalised screen space, where 0,0 is the top-left corner.</summary>
    /// <remarks>
    /// Normalised rather than pixels so the world knows nothing about the device it is on, and
    /// the renderer is the only thing that has to care about resolution.
    /// </remarks>
    public readonly struct Vec
    {
        public readonly float X;
        public readonly float Y;

        public Vec(float x, float y)
        {
            X = x;
            Y = y;
        }

        public float DistanceTo(in Vec other)
        {
            var dx = X - other.X;
            var dy = Y - other.Y;
            return (float)Math.Sqrt(dx * dx + dy * dy);
        }
    }

    /// <summary>A station and where it sits on screen.</summary>
    public sealed class StationSlot
    {
        public Station Station;
        public Vec Position;
        public string Label;
        public string UpgradeId;
    }

    /// <summary>A serving channel and where it sits on screen.</summary>
    public sealed class CounterSlot
    {
        public ServiceCounter Counter;
        public Vec Position;
        public string Label;
        public IChannelSettings Settings;
        public double SpawnAccumulator;
    }

    /// <summary>One button in the control panel.</summary>
    public sealed class GameButton
    {
        public string Label;
        public Func<string> Caption;
        public Func<bool> Enabled;
        public Action Press;
    }

    /// <summary>
    /// The whole game, wired together and free of Android types.
    /// </summary>
    /// <remarks>
    /// Everything of consequence here is delegated: <see cref="Shop"/> runs the chain,
    /// <see cref="ServiceCounter"/> runs the queues, <see cref="EconomyManager"/> holds the
    /// money and <see cref="UpgradeSystem"/> prices the purchases. What this class adds is
    /// arrangement — where things are, who is near what, and which buttons exist.
    ///
    /// Two deliberate simplifications against the design, both because this is a grey box and
    /// not the shipping game: cash is credited directly rather than dropping in the world to be
    /// walked over, and there is one location rather than three.
    /// </remarks>
    public sealed class GameWorld
    {
        /// <summary>How far the player can be from something and still work it.</summary>
        public const float InteractionRadius = 0.085f;

        /// <summary>Normalised units per second at full joystick deflection.</summary>
        private const float MoveSpeed = 0.30f;

        private static readonly Vec CratePosition = new Vec(0.50f, 0.375f);

        private readonly IEconomySettings _settings = GeneratedBalance.EconomySettings;
        private readonly ICarrySettings _carry = GeneratedBalance.CarrySettings;
        private readonly IMarketingSettings _marketing = GeneratedBalance.MarketingSettings;
        private readonly ILocationSettings _location = GeneratedBalance.Locations[0];

        private readonly ObjectPool<Customer> _customers;
        private readonly Random _random = new Random();
        private readonly List<GameButton> _buttons = new List<GameButton>(8);

        private readonly EconomyManager _economy;
        private readonly UpgradeSystem _upgrades;
        private readonly ComboTracker _combo;
        private readonly Shop _shop;
        private readonly CarryStack _stack;
        private readonly ISaveService _save;
        private readonly OfflineEarningsCalculator _offline;

        private Vec _player = new Vec(0.5f, 0.5f);
        private bool _hasCrate;
        private double _sessionSeconds;

        public GameWorld(ISaveService save, IClock clock)
        {
            _save = save ?? throw new ArgumentNullException(nameof(save));
            Clock = clock ?? throw new ArgumentNullException(nameof(clock));

            var data = _save.Data;
            _economy = new EconomyManager(
                _settings, data.Economy.Cash, data.Economy.Gems, data.Player.TotalEarned);
            _combo = new ComboTracker(_settings.ComboStep, _settings.ComboCap);
            _shop = new Shop(_economy, _combo);
            _upgrades = new UpgradeSystem(_economy) { CostBand = _location.CostBand };
            _stack = new CarryStack(_carry.BaseCapacity, publishesEvents: true);
            _offline = new OfflineEarningsCalculator(_settings, clock);
            _customers = new ObjectPool<Customer>(() => new Customer(), prewarm: 24, maxSize: 96);

            BuildStations();
            BuildCounters();
            BuildUpgradeTracks();
            RestoreFrom(data);
            RefreshDerivedValues();
            BuildButtons();

            OfflineReward = _offline.Calculate(data.SavedAtUnix, _shop.IdleRatePerSecond(AverageIncomePerItem));
            if (OfflineReward.HasReward)
            {
                _offline.Grant(_economy, OfflineReward, doubled: false);
            }
        }

        public IClock Clock { get; }

        public IEconomyService Economy => _economy;

        public Shop Shop => _shop;

        public CarryStack Stack => _stack;

        public ComboTracker Combo => _combo;

        public Vec Player => _player;

        public Vec Crate => CratePosition;

        public bool HasCrate => _hasCrate;

        public IReadOnlyList<GameButton> Buttons => _buttons;

        public List<StationSlot> Stations { get; } = new List<StationSlot>(4);

        public List<CounterSlot> Counters { get; } = new List<CounterSlot>(2);

        /// <summary>What the player was owed on returning. Shown once, at startup.</summary>
        public OfflineReward OfflineReward { get; }

        /// <summary>Status line under the HUD — whatever the player most needs to know.</summary>
        public string Hint { get; private set; } = "Walk to the dough station to start";

        public double AverageIncomePerItem
        {
            get
            {
                var price = EconomyMath.PriceMultiplier(
                    _settings.PriceGrowth, _upgrades.LevelOf(UpgradeIds.Price), _location.PriceBand);
                return EconomyMath.IncomePerItem(_settings.BasePrice, price, _combo.Multiplier);
            }
        }

        // ------------------------------------------------------------------------------
        // Construction
        // ------------------------------------------------------------------------------

        private void BuildStations()
        {
            var xs = new[] { 0.13f, 0.37f, 0.63f, 0.87f };
            var entries = GeneratedBalance.Stations;

            for (var i = 0; i < entries.Length; i++)
            {
                var settings = entries[i];
                var station = new Station(settings, isChainHead: i == 0);
                _shop.AddStation(station);
                Stations.Add(new StationSlot
                {
                    Station = station,
                    Position = new Vec(xs[i], 0.225f),
                    Label = settings.DisplayName,
                    UpgradeId = UpgradeIds.Station(settings.Id)
                });
            }
        }

        private void BuildCounters()
        {
            var positions = new[] { new Vec(0.27f, 0.555f), new Vec(0.76f, 0.555f) };
            var entries = GeneratedBalance.Channels;

            for (var i = 0; i < entries.Length; i++)
            {
                var settings = entries[i];
                var counter = new ServiceCounter(settings)
                {
                    PatienceSeconds = settings.BasePatienceSeconds * _location.PatienceScale
                };

                _shop.AddCounter(counter);
                Counters.Add(new CounterSlot
                {
                    Counter = counter,
                    Position = positions[i],
                    Label = settings.DisplayName,
                    Settings = settings
                });
            }
        }

        private void BuildUpgradeTracks()
        {
            foreach (var entry in GeneratedBalance.Stations)
            {
                _upgrades.Register(new UpgradeTrack(
                    UpgradeIds.Station(entry.Id), entry.BaseCost, entry.CostGrowth));
            }

            _upgrades.Register(new UpgradeTrack(
                UpgradeIds.Price,
                _settings.PriceUpgradeBaseCost,
                _settings.PriceUpgradeCostGrowth,
                maxLevel: _settings.PriceLevelsPerLocation));

            _upgrades.Register(new UpgradeTrack(
                UpgradeIds.CarryCapacity,
                _carry.UpgradeBaseCost,
                _carry.UpgradeCostGrowth,
                maxLevel: _carry.MaxLevel));

            _upgrades.Register(new UpgradeTrack(
                UpgradeIds.Marketing,
                _marketing.UpgradeBaseCost,
                _marketing.UpgradeCostGrowth,
                maxLevel: _marketing.LevelsPerLocation));
        }

        private void RestoreFrom(SaveData data)
        {
            if (data.Locations.Count == 0)
            {
                return;
            }

            var location = data.Locations[0];

            foreach (var state in location.Stations)
            {
                var slot = Stations.Find(s => s.Station.Id == state.Id);
                if (slot == null)
                {
                    continue;
                }

                slot.Station.SetLevel(state.Level);
                slot.Station.SetStaffed(state.IsStaffed);
                _upgrades.RestoreLevel(slot.UpgradeId, state.Level);
            }

            foreach (var state in location.Channels)
            {
                var slot = Counters.Find(c => c.Settings.Id == state.Id);
                if (slot == null)
                {
                    continue;
                }

                slot.Counter.SetSlotLevel(state.SlotLevel);
                slot.Counter.IsStaffed = state.IsStaffed;
            }

            _upgrades.RestoreLevel(UpgradeIds.Price, data.Economy.PriceLevel);
            _upgrades.RestoreLevel(UpgradeIds.Marketing, data.Economy.MarketingLevel);
            _upgrades.RestoreLevel(UpgradeIds.CarryCapacity, data.Economy.CarryCapacityLevel);
        }

        /// <summary>Recomputes everything that depends on an upgrade level.</summary>
        /// <remarks>
        /// Called after every purchase rather than recomputed per frame. Prices and capacities
        /// only change when something is bought, and a payout that silently lags a purchase by
        /// a frame is the kind of bug nobody reports and everybody feels.
        /// </remarks>
        private void RefreshDerivedValues()
        {
            var priceMultiplier = EconomyMath.PriceMultiplier(
                _settings.PriceGrowth, _upgrades.LevelOf(UpgradeIds.Price), _location.PriceBand);

            foreach (var slot in Counters)
            {
                slot.Counter.PriceMultiplier =
                    _settings.BasePrice * priceMultiplier * slot.Settings.PriceMultiplier;
            }

            _stack.SetCapacity(
                _carry.BaseCapacity
                + _carry.CapacityPerLevel * _upgrades.LevelOf(UpgradeIds.CarryCapacity));

            foreach (var slot in Stations)
            {
                slot.Station.SetLevel(_upgrades.LevelOf(slot.UpgradeId));
            }
        }

        // ------------------------------------------------------------------------------
        // Buttons
        // ------------------------------------------------------------------------------

        private void BuildButtons()
        {
            foreach (var slot in Stations)
            {
                var captured = slot;
                _buttons.Add(new GameButton
                {
                    Label = captured.Label,
                    Caption = () => PriceCaption(captured.UpgradeId),
                    Enabled = () => _upgrades.CanBuy(captured.UpgradeId),
                    Press = () =>
                    {
                        if (_upgrades.TryBuy(captured.UpgradeId))
                        {
                            RefreshDerivedValues();
                        }
                    }
                });
            }

            _buttons.Add(new GameButton
            {
                Label = "Price",
                Caption = () => PriceCaption(UpgradeIds.Price),
                Enabled = () => _upgrades.CanBuy(UpgradeIds.Price),
                Press = () =>
                {
                    if (_upgrades.TryBuy(UpgradeIds.Price))
                    {
                        RefreshDerivedValues();
                    }
                }
            });

            _buttons.Add(new GameButton
            {
                Label = "Carry",
                Caption = () => PriceCaption(UpgradeIds.CarryCapacity),
                Enabled = () => _upgrades.CanBuy(UpgradeIds.CarryCapacity),
                Press = () =>
                {
                    if (_upgrades.TryBuy(UpgradeIds.CarryCapacity))
                    {
                        RefreshDerivedValues();
                    }
                }
            });

            _buttons.Add(new GameButton
            {
                Label = "Hire",
                Caption = HireCaption,
                Enabled = () =>
                {
                    var cost = NextHireCost(out _, out _);
                    return cost > 0.0 && _economy.CanAfford(cost);
                },
                Press = HireNext
            });
        }

        private string PriceCaption(string upgradeId)
        {
            var cost = _upgrades.NextCost(upgradeId);
            if (double.IsPositiveInfinity(cost))
            {
                return "MAX";
            }

            return "$" + NumberFormat.Currency(cost) + "  L" + _upgrades.LevelOf(upgradeId);
        }

        private string HireCaption()
        {
            var cost = NextHireCost(out var label, out _);
            return cost <= 0.0 ? "All hired" : label + "  $" + NumberFormat.Currency(cost);
        }

        /// <summary>
        /// The cheapest post nobody is working yet.
        /// </summary>
        /// <remarks>
        /// Offered cheapest-first because the first hire is the biggest single jump in the
        /// game and the sooner a player feels it, the sooner they understand what money is for.
        /// </remarks>
        private double NextHireCost(out string label, out Action hire)
        {
            var best = double.MaxValue;
            label = string.Empty;
            hire = null;

            for (var i = 0; i < Stations.Count; i++)
            {
                var slot = Stations[i];
                var settings = GeneratedBalance.Stations[i];
                if (!settings.RequiresWorker || slot.Station.IsStaffed)
                {
                    continue;
                }

                var cost = settings.StaffHireCost * _location.CostBand;
                if (cost < best)
                {
                    best = cost;
                    label = settings.DisplayName;
                    var captured = slot;
                    hire = () => captured.Station.SetStaffed(true);
                }
            }

            foreach (var slot in Counters)
            {
                if (slot.Counter.IsStaffed)
                {
                    continue;
                }

                var cost = slot.Settings.StaffHireCost * _location.CostBand;
                if (cost < best)
                {
                    best = cost;
                    label = slot.Label;
                    var captured = slot;
                    hire = () => captured.Counter.IsStaffed = true;
                }
            }

            return hire == null ? 0.0 : best;
        }

        private void HireNext()
        {
            var cost = NextHireCost(out var label, out var hire);
            if (hire == null || !_economy.TrySpend(cost, "hire:" + label))
            {
                return;
            }

            hire();
            EventBus.Publish(new StaffHired(label, cost, _shop.IsSelfRunning));
            _save.RequestSave();
        }

        // ------------------------------------------------------------------------------
        // Update
        // ------------------------------------------------------------------------------

        /// <summary>Advances the whole game by one frame.</summary>
        /// <param name="moveX">Joystick horizontal, -1 to 1.</param>
        /// <param name="moveY">Joystick vertical, -1 to 1.</param>
        public void Update(float deltaSeconds, float moveX, float moveY)
        {
            if (deltaSeconds <= 0f)
            {
                return;
            }

            // A frame that took a very long time - the app was backgrounded, or the device
            // stalled - must not teleport the player across the shop or fast-forward the
            // queues. Long absences are the offline system's job, not the frame loop's.
            if (deltaSeconds > 0.1f)
            {
                deltaSeconds = 0.1f;
            }

            _sessionSeconds += deltaSeconds;

            MovePlayer(deltaSeconds, moveX, moveY);
            UpdateProximity();

            _shop.Tick(deltaSeconds);

            RecycleDeparted(_shop.RecentlyAbandoned);
            RecycleDeparted(_shop.RecentlyPaid);

            SpawnCustomers(deltaSeconds);
            UpdateHint();
        }

        private void MovePlayer(float deltaSeconds, float moveX, float moveY)
        {
            var magnitude = (float)Math.Sqrt(moveX * moveX + moveY * moveY);
            if (magnitude > 1f)
            {
                moveX /= magnitude;
                moveY /= magnitude;
            }

            var x = _player.X + moveX * MoveSpeed * deltaSeconds;
            var y = _player.Y + moveY * MoveSpeed * deltaSeconds;

            _player = new Vec(
                Math.Min(0.95f, Math.Max(0.05f, x)),
                Math.Min(0.62f, Math.Max(0.14f, y)));
        }

        /// <summary>
        /// Tells the simulation which posts the player is covering, and works them.
        /// </summary>
        /// <remarks>
        /// Every station is cleared first and re-marked. Marking only what is in range would
        /// leave a station believing the player was still there after they walked away — a shop
        /// that keeps producing from an empty room.
        /// </remarks>
        private void UpdateProximity()
        {
            foreach (var slot in Stations)
            {
                slot.Station.PlayerPresent = false;
            }

            if (_player.DistanceTo(CratePosition) < InteractionRadius)
            {
                _hasCrate = true;
            }

            foreach (var slot in Stations)
            {
                if (_player.DistanceTo(slot.Position) >= InteractionRadius)
                {
                    continue;
                }

                slot.Station.PlayerPresent = true;

                if (_hasCrate && slot.Station.NeedsRestock)
                {
                    slot.Station.Restock();
                    _hasCrate = false;
                }
            }

            // Collecting happens at the end of the chain, which is where finished food is.
            var last = Stations[Stations.Count - 1];
            if (_player.DistanceTo(last.Position) < InteractionRadius)
            {
                _shop.CollectFinished(_stack);
            }

            foreach (var slot in Counters)
            {
                if (_player.DistanceTo(slot.Position) < InteractionRadius)
                {
                    _shop.Serve(slot.Counter, _stack);
                }
            }
        }

        private void SpawnCustomers(double deltaSeconds)
        {
            var marketing = Math.Pow(
                _marketing.ArrivalsPerLevel, _upgrades.LevelOf(UpgradeIds.Marketing));

            foreach (var slot in Counters)
            {
                var rate = slot.Settings.BaseArrivalsPerSecond
                           * marketing
                           * _location.ArrivalMultiplier;

                slot.SpawnAccumulator += rate * deltaSeconds;

                while (slot.SpawnAccumulator >= 1.0)
                {
                    slot.SpawnAccumulator -= 1.0;

                    if (!slot.Counter.HasRoom)
                    {
                        // A queue at capacity turns arrivals away rather than banking them.
                        // Banking would produce a stampede the moment a slot frees up.
                        continue;
                    }

                    var customer = _customers.Rent();
                    if (customer == null || !slot.Counter.TryAdmit(customer))
                    {
                        if (customer != null)
                        {
                            _customers.Return(customer);
                        }
                    }
                }
            }
        }

        private void RecycleDeparted(IReadOnlyList<Customer> departed)
        {
            for (var i = 0; i < departed.Count; i++)
            {
                _customers.Return(departed[i]);
            }
        }

        private void UpdateHint()
        {
            if (_stack.IsFull)
            {
                Hint = "Stack full — go and serve somebody";
                return;
            }

            foreach (var slot in Stations)
            {
                if (slot.Station.NeedsRestock)
                {
                    Hint = _hasCrate
                        ? "Take the crate to " + slot.Label
                        : slot.Label + " is out — fetch a crate from the middle";
                    return;
                }
            }

            if (_shop.FinishedItems > 0 && _stack.IsEmpty)
            {
                Hint = "Food is ready at Boxing";
                return;
            }

            Hint = _shop.IsSelfRunning
                ? "The shop runs itself now — spend the profit"
                : "Stand at a station to work it";
        }

        // ------------------------------------------------------------------------------
        // Persistence
        // ------------------------------------------------------------------------------

        /// <summary>Copies live state back into the save and writes it.</summary>
        public void Persist()
        {
            var data = _save.Data;
            data.Economy.Cash = _economy.Cash;
            data.Economy.Gems = _economy.Gems;
            data.Economy.PriceLevel = _upgrades.LevelOf(UpgradeIds.Price);
            data.Economy.MarketingLevel = _upgrades.LevelOf(UpgradeIds.Marketing);
            data.Economy.CarryCapacityLevel = _upgrades.LevelOf(UpgradeIds.CarryCapacity);
            data.Player.TotalEarned = _economy.TotalEarned;
            data.Player.Level = _economy.PlayerLevel;

            if (data.Locations.Count == 0)
            {
                data.Locations.Add(new LocationSaveState { Index = 0, IsUnlocked = true });
            }

            var location = data.Locations[0];
            location.Stations.Clear();
            foreach (var slot in Stations)
            {
                location.Stations.Add(new StationSaveState
                {
                    Id = slot.Station.Id,
                    Level = slot.Station.Level,
                    Count = 1,
                    IsStaffed = slot.Station.IsStaffed
                });
            }

            location.Channels.Clear();
            foreach (var slot in Counters)
            {
                location.Channels.Add(new ChannelSaveState
                {
                    Id = slot.Settings.Id,
                    SlotLevel = 0,
                    IsStaffed = slot.Counter.IsStaffed
                });
            }

            _save.Save();
        }
    }
}
