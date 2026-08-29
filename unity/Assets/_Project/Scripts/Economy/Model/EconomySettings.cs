namespace SizzleStreet.Economy.Model
{
    /// <summary>
    /// Read-only views of the balance data the economy runs on.
    /// </summary>
    /// <remarks>
    /// <para>
    /// These are interfaces rather than concrete types so the economy assembly can stay free
    /// of <c>UnityEngine</c>. The shipping implementations are <c>ScriptableObject</c>s in
    /// <c>SizzleStreet.Configs</c>, seeded from <c>data/balance/*.csv</c>; tests implement the
    /// same interfaces with plain objects and never touch an asset.
    /// </para>
    /// <para>
    /// They share a file because they are one data contract, read together and changed
    /// together — splitting them across five files would scatter a single idea.
    /// </para>
    /// </remarks>
    public interface IEconomySettings
    {
        double BasePrice { get; }

        double PriceGrowth { get; }

        double PriceUpgradeBaseCost { get; }

        double PriceUpgradeCostGrowth { get; }

        /// <summary>Price levels granted per unlocked location.</summary>
        /// <remarks>
        /// A menu has a ceiling: past a point the neighbourhood will not pay more. Without
        /// this cap a single shop scales forever and expansion is decorative.
        /// </remarks>
        int PriceLevelsPerLocation { get; }

        double ComboStep { get; }

        int ComboCap { get; }

        double OfflineCapSeconds { get; }

        double OfflineEfficiency { get; }

        double OfflineRewardMultiplier { get; }

        double LevelThresholdBase { get; }

        double LevelThresholdGrowth { get; }

        int MaxPlayerLevel { get; }

        double StartingCash { get; }

        int StartingGems { get; }
    }

    /// <summary>One stage of the production chain.</summary>
    public interface IStationSettings
    {
        string Id { get; }

        double BaseCost { get; }

        double CostGrowth { get; }

        /// <summary>Units per second at level zero, one unit owned, no staff bonus.</summary>
        double BaseOutput { get; }

        double SpeedPerLevel { get; }

        /// <summary>Finished units held before the station blocks.</summary>
        int OutputBuffer { get; }

        /// <summary>Zero means the station consumes no restockable ingredient.</summary>
        int IngredientCapacity { get; }

        /// <summary>
        /// Whether somebody must stand here for the station to produce.
        /// </summary>
        /// <remarks>
        /// The Oven is the exception: a machine that bakes unattended, so it cannot be
        /// staffed. That is what makes it a pure throughput ceiling rather than a claim on the
        /// player's attention, and it is why it only starts to bind after the first hires.
        /// </remarks>
        bool RequiresWorker { get; }

        double StaffHireCost { get; }

        /// <summary>Throughput of a hired worker relative to the player working the station.</summary>
        double StaffSpeedMultiplier { get; }
    }

    /// <summary>One serving channel.</summary>
    public interface IChannelSettings
    {
        string Id { get; }

        SizzleStreet.Core.ServingChannel Channel { get; }

        double BasePatienceSeconds { get; }

        int MinOrder { get; }

        int MaxOrder { get; }

        double PriceMultiplier { get; }

        double BaseArrivalsPerSecond { get; }

        int BaseSlots { get; }

        double SlotBaseCost { get; }

        double SlotCostGrowth { get; }

        double StaffHireCost { get; }

        /// <summary>Seconds to hand over one order, bounding throughput independently of production.</summary>
        double ServeSeconds { get; }
    }

    /// <summary>One shop.</summary>
    public interface ILocationSettings
    {
        int Index { get; }

        string DisplayNameKey { get; }

        double UnlockCost { get; }

        /// <summary>Multiplier on every item's price at this location.</summary>
        double PriceBand { get; }

        /// <summary>
        /// Multiplier on every upgrade price at this location.
        /// </summary>
        /// <remarks>
        /// Without this, opening a location is anticlimactic: the player arrives holding the
        /// fortune they saved for the unlock and buys every remaining upgrade in the game in a
        /// single tap. A new shop comes with a new price band on its equipment.
        /// </remarks>
        double CostBand { get; }

        double ArrivalMultiplier { get; }

        /// <summary>Patience tightens per location, so later shops demand more attention.</summary>
        double PatienceScale { get; }
    }

    /// <summary>Signage and decor — the only way to raise demand inside one location.</summary>
    public interface IMarketingSettings
    {
        double ArrivalsPerLevel { get; }

        double UpgradeBaseCost { get; }

        double UpgradeCostGrowth { get; }

        int LevelsPerLocation { get; }
    }

    /// <summary>The player's carry stack.</summary>
    public interface ICarrySettings
    {
        int BaseCapacity { get; }

        int CapacityPerLevel { get; }

        int MaxLevel { get; }

        double UpgradeBaseCost { get; }

        double UpgradeCostGrowth { get; }
    }
}
