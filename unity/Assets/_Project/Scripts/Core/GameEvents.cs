namespace SizzleStreet.Core
{
    /// <summary>Which counter an order went across.</summary>
    public enum ServingChannel
    {
        Counter = 0,
        DriveThru = 1
    }

    /// <summary>The two currencies.</summary>
    public enum CurrencyKind
    {
        Cash = 0,
        Gems = 1
    }

    /// <summary>
    /// Every event on the bus, as a readonly struct so publishing allocates nothing.
    /// </summary>
    /// <remarks>
    /// These names are load-bearing beyond the code: the analytics taxonomy in
    /// <c>docs/09-analytics.md</c> maps one-to-one onto them, so renaming an event here
    /// breaks a dashboard someone is reading. Add fields rather than repurposing them.
    /// </remarks>
    public readonly struct CashChanged
    {
        public readonly double Balance;
        public readonly double Delta;

        public CashChanged(double balance, double delta)
        {
            Balance = balance;
            Delta = delta;
        }
    }

    public readonly struct GemsChanged
    {
        public readonly int Balance;
        public readonly int Delta;

        public GemsChanged(int balance, int delta)
        {
            Balance = balance;
            Delta = delta;
        }
    }

    public readonly struct OrderCompleted
    {
        public readonly ServingChannel Channel;
        public readonly int ItemCount;
        public readonly double Payout;
        public readonly int ComboAfter;
        public readonly float WaitSeconds;

        public OrderCompleted(
            ServingChannel channel, int itemCount, double payout, int comboAfter, float waitSeconds)
        {
            Channel = channel;
            ItemCount = itemCount;
            Payout = payout;
            ComboAfter = comboAfter;
            WaitSeconds = waitSeconds;
        }
    }

    /// <summary>A customer ran out of patience. Breaks the combo and loses the sale.</summary>
    public readonly struct OrderAbandoned
    {
        public readonly ServingChannel Channel;
        public readonly int ItemCount;
        public readonly int ComboLost;

        public OrderAbandoned(ServingChannel channel, int itemCount, int comboLost)
        {
            Channel = channel;
            ItemCount = itemCount;
            ComboLost = comboLost;
        }
    }

    public readonly struct UpgradePurchased
    {
        public readonly string UpgradeId;
        public readonly int LevelAfter;
        public readonly double Cost;

        public UpgradePurchased(string upgradeId, int levelAfter, double cost)
        {
            UpgradeId = upgradeId;
            LevelAfter = levelAfter;
            Cost = cost;
        }
    }

    /// <summary>A post was automated for the first time — the biggest jump in the game.</summary>
    public readonly struct StaffHired
    {
        public readonly string PostId;
        public readonly double Cost;
        public readonly bool ShopIsNowSelfRunning;

        public StaffHired(string postId, double cost, bool shopIsNowSelfRunning)
        {
            PostId = postId;
            Cost = cost;
            ShopIsNowSelfRunning = shopIsNowSelfRunning;
        }
    }

    public readonly struct PlayerLeveledUp
    {
        public readonly int Level;
        public readonly double TotalEarned;

        public PlayerLeveledUp(int level, double totalEarned)
        {
            Level = level;
            TotalEarned = totalEarned;
        }
    }

    public readonly struct LocationUnlocked
    {
        public readonly int LocationIndex;
        public readonly double Cost;

        public LocationUnlocked(int locationIndex, double cost)
        {
            LocationIndex = locationIndex;
            Cost = cost;
        }
    }

    public readonly struct OfflineEarningsOffered
    {
        public readonly double BaseReward;
        public readonly double CreditedSeconds;
        public readonly bool WasCapped;

        public OfflineEarningsOffered(double baseReward, double creditedSeconds, bool wasCapped)
        {
            BaseReward = baseReward;
            CreditedSeconds = creditedSeconds;
            WasCapped = wasCapped;
        }
    }

    public readonly struct OfflineEarningsClaimed
    {
        public readonly double Reward;
        public readonly bool Doubled;

        public OfflineEarningsClaimed(double reward, bool doubled)
        {
            Reward = reward;
            Doubled = doubled;
        }
    }

    public readonly struct RushHourStarted
    {
        public readonly float DurationSeconds;

        public RushHourStarted(float durationSeconds)
        {
            DurationSeconds = durationSeconds;
        }
    }

    public readonly struct RushHourEnded
    {
        public readonly double TotalEarned;
        public readonly int BestCombo;
        public readonly int OrdersServed;

        public RushHourEnded(double totalEarned, int bestCombo, int ordersServed)
        {
            TotalEarned = totalEarned;
            BestCombo = bestCombo;
            OrdersServed = ordersServed;
        }
    }

    /// <summary>The player's carry stack changed, so the HUD and the stack visual update.</summary>
    public readonly struct CarryStackChanged
    {
        public readonly int Count;
        public readonly int Capacity;

        public CarryStackChanged(int count, int capacity)
        {
            Count = count;
            Capacity = capacity;
        }
    }

    /// <summary>
    /// A save was recovered from the backup slot after the primary failed verification.
    /// Worth an analytics event on its own: a rise here means a corruption bug.
    /// </summary>
    public readonly struct SaveRecovered
    {
        public readonly string Reason;

        public SaveRecovered(string reason)
        {
            Reason = reason;
        }
    }
}
