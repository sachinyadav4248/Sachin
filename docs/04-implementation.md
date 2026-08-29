# Phase 4 — Implementation

> **Status: written, not compiled.** This environment has no Unity installation and no .NET
> toolchain. None of the C# described here has been through a compiler and the edit-mode
> tests have never been executed. The economy it implements *has* been executed — in Python,
> against the same golden values the C# asserts — so the formulas are trustworthy and the C#
> expressing them is not yet. The first Unity open is a compile-and-fix pass.

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
| `Tests/EditMode` | Golden values, save, simulation, economy | 60-odd tests, none yet run |

## Two things the code found that the design had wrong

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

Neither was visible in the design documents. Both were visible the moment the code had to
say exactly what happened.

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

1. Get it compiling and the edit-mode tests green. Nothing below is meaningful until then.
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
- [ ] **Code compiles** — blocked, no toolchain in this environment
- [ ] Edit-mode tests pass — blocked on the same
- [ ] UI, bootstrap, configs and concrete services — not started
