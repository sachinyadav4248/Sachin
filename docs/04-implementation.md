# Phase 4 — Implementation

> **Status: compiles, and its tests pass.** `./tools/verify/run.sh` builds every runtime
> assembly against netstandard2.1 — Unity's own target — and runs all 114 edit-mode tests in
> about two seconds, with no editor and no licence. This works because the runtime assemblies
> set `noEngineReferences`, so the plain .NET SDK compiles exactly the sources Unity would.
>
> Still unverified: anything engine-shaped. `Gameplay` (a `MonoBehaviour`), scenes, prefabs,
> assets, and the frame budget.

## What exists

| Module | Files | What it does |
| --- | --- | --- |
| `Core` | `IClock`, `EventBus`, `GameEvents`, `ServiceLocator`, `NumberFormat`, `ObjectPool` | Time, events, service registry, big-number formatting, pooling |
| `Economy` | `EconomyMath`, `EconomyManager`, `UpgradeSystem`, `OfflineEarningsCalculator`, `Model/EconomySettings` | Every formula, the ledger, upgrade pricing, offline accrual |
| `Save` | `SaveData`, `SaveSerializer`, `SaveMigrator`, `SaveManager` | Versioned, checksummed, encrypted saves with a backup slot |
| `Simulation` | `Station`, `ServiceCounter`, `Customer`, `CarryStack`, `ComboTracker`, `StaffWorker`, `Shop` | The loop itself, with no Unity types |
| `Services` | `IAdService`, `IAnalyticsService`, `IRemoteConfigService` | Ads, analytics and config behind interfaces, each with a null implementation |
| `Serialization` | `NewtonsoftJsonCodec` | The single place the JSON dependency lands |
| `Gameplay` | `PlayerController` and its anchors | The joystick, movement, and proximity interaction |
| `Tests/EditMode` | Golden values, save, simulation, economy | 114 tests, all passing |

## Four things the code found that the design had wrong

Two came from writing it, and two more from the first time it was compiled and run — in code
that had already been written, reviewed and documented.

**A station has two inputs, not one.** The first draft merged work in progress from the
upstream station with the restockable supplies the player fetches. Under that model the
Oven — which takes topped bases from Topping and consumes no crate of its own — had a
supply capacity of zero, so it consumed nothing and baked from an empty chain. They are
separate buffers now. `ADownstreamStationWaitsForWorkFromUpstream` guards it.

**Recovering a save could destroy it.** Loading falls back to the backup slot when the
primary fails verification, then saves immediately to promote it. That save rotated the
*corrupt* primary into the backup slot, overwriting the only good copy — so a single bad
file became total loss one launch later. Rotation is now skipped while the primary is known
bad. `ARecoveryDoesNotDestroyTheBackup` guards it.

**A stalled station banked free work.** `Station.Tick` accrued progress across the whole
elapsed tick and clamped afterwards, so a station holding two units of flour and given ten
seconds produced its two and kept a full unit of progress in hand — which it handed over free
the instant somebody restocked it. Progress now only accrues for time the station could
actually work. `AStalledStationDoesNotBankWorkItCouldNotDo` guards it, and
`AWorkerLeavingMidUnitKeepsThePartialProgress` guards the other half of the rule.

**An instantaneous handover reported no capacity at all.**
`ServiceCounter.ServeCapacityPerSecond` returned zero for a non-positive serve time,
conflating "instant" with "impossible". Because idle rate takes a minimum against it, a fully
staffed shop reported that it earned nothing while closed — the single most valuable thing in
the game silently worth zero. It returns infinity now.
`AnInstantHandoverImposesNoThroughputLimit` guards it.

None of the four was visible in the design documents. Two became visible the moment the code
had to say exactly what happened, and two more the moment a compiler and a test runner did.
That second pair is the argument for the verification harness: they sat in reviewed,
documented, plausible-looking code, and cost about a minute to find once anything actually
executed it.

## What is not built

- **UI.** No HUD, panels, popups or joystick implementation. `IJoystick` is an interface
  with no implementation, and `PlayerController` is inert without one.
- **ScriptableObject configs and the CSV importer.** The settings interfaces exist and the
  CSVs exist; nothing yet reads one into the other. Tests use plain objects.
- **Bootstrap.** The startup sequence is specified in Phase 3 and not written.
- **Concrete services.** Only the null implementations exist. No MAX, Firebase or Adjust
  integration, and none of the keys they need.
- **Rush Hour, locations, staff hiring flow, daily rewards, the level reward track.**
  `ComboTracker.IsUncapped` is the hook Rush Hour needs; nothing sets it.
- **Everything visual and audible.** No art, no audio, no scenes, no prefabs.

## Order to build the rest

1. ~~Get it compiling and the edit-mode tests green.~~ Done, headlessly. Open it in Unity
   once to confirm the editor agrees, which is a formality rather than a task.
2. Bootstrap plus the CSV-to-ScriptableObject importer, so the game runs on real balance.
3. A joystick and a grey-box scene — one shop, four stations, one counter. This is the first
   moment anyone can answer whether the loop is fun.
4. The Drive-Thru, then staff hiring, then offline earnings on resume.
5. HUD and upgrade UI.
6. Ads and analytics behind their interfaces, starting with the offline doubler.
7. Rush Hour, once the base loop is tuned against real play rather than the simulation.

Step 3 is the real gate. Everything before it is scaffolding, and everything after it is
worthless if the answer there is no.

## Definition of Done — Phase 4

- [x] Economy formulas implemented and pinned to the Python reference by golden values
- [x] Save system with versioning, checksums, encryption, backup recovery and migration
- [x] Production chain, serving channels, customers, combo and carry stack as testable logic
- [x] Service interfaces with null implementations for offline play
- [x] Assembly boundaries enforced by `noEngineReferences`
- [x] Edit-mode tests written for every rule above
- [x] Code compiles against netstandard2.1 with zero warnings
- [x] All 114 edit-mode tests pass, headlessly and in CI
- [ ] Confirmed inside the Unity editor — no editor in this environment
- [ ] UI, bootstrap, configs and concrete services — not started
