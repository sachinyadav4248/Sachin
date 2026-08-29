using System;
using SizzleStreet.Economy;
using SizzleStreet.Economy.Model;

namespace SizzleStreet.Simulation
{
    /// <summary>Where a station is in its cycle.</summary>
    public enum StationState
    {
        /// <summary>Nothing to work on, no supplies, or nobody here to work it.</summary>
        Idle = 0,

        Producing = 1,

        /// <summary>Producing, with at least one finished unit waiting to be taken.</summary>
        OutputReady = 2,

        /// <summary>Output buffer full. Production has stopped until a unit leaves.</summary>
        Blocked = 3
    }

    /// <summary>
    /// One stage of the production chain, as pure logic.
    /// </summary>
    /// <remarks>
    /// <para>
    /// No Unity here: a station is a pair of buffers, a timer and a set of rules about when it
    /// may run. The <c>MonoBehaviour</c> that draws it holds a reference to one of these and
    /// does nothing but render what it reports.
    /// </para>
    /// <para>
    /// A station has <em>two</em> distinct inputs and conflating them is a mistake worth
    /// naming, because the first draft of this class made it. <b>Work in progress</b> arrives
    /// from the station upstream — topped bases waiting for the Oven. <b>Supplies</b> are the
    /// restockable crates the player fetches — flour, toppings, flat-pack boxes. Most stations
    /// need both. The Oven needs only the first: it bakes what Topping hands it and consumes no
    /// crate, which is why its supply capacity is zero. With the two merged, a supply capacity
    /// of zero meant the Oven consumed nothing at all and produced from an empty chain.
    /// </para>
    /// <para>
    /// Blocking is what makes the chain a system rather than four independent timers. A full
    /// Boxing buffer stops Boxing, which fills the Oven's output, which stops the Oven, and the
    /// jam propagates back up the line where the player can see it and work out where to stand.
    /// </para>
    /// </remarks>
    public sealed class Station
    {
        private readonly IStationSettings _settings;

        private double _progress;
        private int _outputCount;
        private int _workInProgress;
        private int _supplies;
        private int _level;
        private int _unitCount = 1;

        /// <param name="isChainHead">
        /// True for the first station, which has nothing upstream and therefore never waits for
        /// work in progress.
        /// </param>
        public Station(IStationSettings settings, bool isChainHead = false)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            IsChainHead = isChainHead;
            _supplies = settings.IngredientCapacity;
        }

        public string Id => _settings.Id;

        public bool IsChainHead { get; }

        public StationState State { get; private set; } = StationState.Idle;

        public int OutputCount => _outputCount;

        /// <summary>Units received from upstream and not yet processed.</summary>
        public int WorkInProgress => _workInProgress;

        /// <summary>Restockable supplies remaining.</summary>
        public int Supplies => _supplies;

        public int Level => _level;

        /// <summary>Whether a hire is working this station.</summary>
        public bool IsStaffed { get; private set; }

        /// <summary>Whether the player is close enough to work it personally.</summary>
        public bool PlayerPresent { get; set; }

        /// <summary>True for a station that needs no worker at all — the Oven, and only the Oven.</summary>
        public bool IsAutonomous => !_settings.RequiresWorker;

        /// <summary>Whether it keeps producing with the player elsewhere.</summary>
        public bool IsAutomated => IsAutonomous || IsStaffed;

        /// <summary>Fraction of the current unit completed, for the progress ring.</summary>
        public float Progress => (float)Math.Clamp(_progress, 0.0, 1.0);

        public bool UsesSupplies => _settings.IngredientCapacity > 0;

        public bool NeedsRestock => UsesSupplies && _supplies <= 0;

        public double OutputPerSecond => EconomyMath.StationOutputPerSecond(
            _settings.BaseOutput,
            _unitCount,
            _settings.SpeedPerLevel,
            _level,
            IsStaffed ? _settings.StaffSpeedMultiplier : 1.0);

        /// <summary>How many upstream units this station can accept right now.</summary>
        /// <remarks>
        /// The chain head accepts nothing: it creates work rather than receiving it. Everyone
        /// else buffers up to their output capacity, which keeps a fast upstream station from
        /// piling an unbounded queue into a slow one.
        /// </remarks>
        public int RoomForInput()
        {
            if (IsChainHead)
            {
                return 0;
            }

            return Math.Max(0, _settings.OutputBuffer - _workInProgress);
        }

        public void SetLevel(int level) => _level = Math.Max(0, level);

        public void SetUnitCount(int count) => _unitCount = Math.Max(1, count);

        public void SetStaffed(bool staffed) => IsStaffed = staffed;

        public void Restock() => _supplies = _settings.IngredientCapacity;

        /// <summary>Accepts work in progress from the station upstream.</summary>
        public void AddInput(int count)
        {
            if (count > 0 && !IsChainHead)
            {
                _workInProgress = Math.Min(_settings.OutputBuffer, _workInProgress + count);
            }
        }

        /// <summary>Advances the station by <paramref name="deltaSeconds"/>.</summary>
        /// <remarks>
        /// Produces as many units as the elapsed time allows rather than capping at one. A
        /// late-game station can exceed one unit per frame, and a cap would silently discard
        /// throughput the player has paid for — a bug that presents as the upgrade doing
        /// nothing.
        /// </remarks>
        public void Tick(double deltaSeconds)
        {
            if (deltaSeconds <= 0.0)
            {
                return;
            }

            if (!HasWorker())
            {
                State = _outputCount > 0 ? StationState.OutputReady : StationState.Idle;
                return;
            }

            if (_outputCount >= _settings.OutputBuffer)
            {
                State = StationState.Blocked;
                return;
            }

            if (!HasMaterials())
            {
                State = _outputCount > 0 ? StationState.OutputReady : StationState.Idle;
                return;
            }

            var rate = OutputPerSecond;
            if (rate <= 0.0)
            {
                State = StationState.Idle;
                return;
            }

            _progress += rate * deltaSeconds;

            while (_progress >= 1.0 && _outputCount < _settings.OutputBuffer && HasMaterials())
            {
                if (!IsChainHead)
                {
                    _workInProgress--;
                }

                if (UsesSupplies)
                {
                    _supplies--;
                }

                _progress -= 1.0;
                _outputCount++;
            }

            // Hold partial progress rather than discarding it, so a station that unblocks or
            // gets restocked resumes where it stopped instead of restarting the unit.
            if (_progress > 1.0)
            {
                _progress = 1.0;
            }

            if (_outputCount >= _settings.OutputBuffer)
            {
                State = StationState.Blocked;
            }
            else if (!HasMaterials())
            {
                State = _outputCount > 0 ? StationState.OutputReady : StationState.Idle;
            }
            else
            {
                State = _outputCount > 0 ? StationState.OutputReady : StationState.Producing;
            }
        }

        /// <summary>Takes up to <paramref name="requested"/> finished units.</summary>
        /// <returns>How many were actually taken, which may be fewer or none.</returns>
        public int TakeOutput(int requested)
        {
            if (requested <= 0 || _outputCount <= 0)
            {
                return 0;
            }

            var taken = Math.Min(requested, _outputCount);
            _outputCount -= taken;

            if (State == StationState.Blocked)
            {
                State = StationState.Producing;
            }

            return taken;
        }

        private bool HasWorker() => IsAutonomous || IsStaffed || PlayerPresent;

        private bool HasMaterials()
        {
            if (!IsChainHead && _workInProgress <= 0)
            {
                return false;
            }

            return !NeedsRestock;
        }
    }
}
