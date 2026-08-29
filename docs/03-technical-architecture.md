> **Status:** the code described here compiles and its tests pass. It has *not* been run
> inside Unity — there is no editor here — but rule 1 below turned out to pay for itself
> immediately: because the runtime assemblies contain no Unity types, the plain .NET SDK
> compiles the same sources and runs the same tests. `./tools/verify/run.sh` builds them
> against netstandard2.1 and runs 114 tests in about two seconds. What remains unverified is
> everything engine-shaped: `Gameplay`, scenes, prefabs and assets.

# Phase 3 — Technical Architecture

## 1. Shape of the thing

Four rules decide most of the structure:

1. **The simulation is Unity-free.** Economy, upgrades, offline accrual and save handling
   are plain C# in assemblies that do not reference `UnityEngine`. They run in headless
   tests, they are portable, and they can be checked against the Python reference.
   `MonoBehaviour`s are adapters over them and contain no rules.
2. **Time is injected.** Nothing in the simulation calls `DateTime.UtcNow` or `Time.time`.
   It takes an `IClock`. This is the only reason offline earnings and clock tampering are
   testable at all.
3. **Nothing allocates in the core loop.** The event bus is generic over struct payloads,
   everything spawned is pooled, and no hot path uses LINQ, closures or string
   concatenation. This is a hard constraint, not an aspiration — it is what 60 FPS on a
   4 GB device costs.
4. **Dependencies point one way.** `Core` knows nothing. `Economy` and `Save` know `Core`.
   `Gameplay` knows `Core` and `Economy`. `UI` knows everything and is known by nothing.

## 2. Assemblies

```
SizzleStreet.Core           clock, event bus, service locator, pooling, formatting
SizzleStreet.Economy        formulas, ledger, upgrades, offline accrual   → Core
SizzleStreet.Save           save model, serialisation, migration, storage → Core
SizzleStreet.Simulation     stations, customers, channels, combo, shop    → Core, Economy
SizzleStreet.Services       ads, analytics, remote config — interfaces    → Core
SizzleStreet.Serialization  the one place the JSON dependency lands       → Save
SizzleStreet.Gameplay       MonoBehaviours: player, anchors               → all of the above
SizzleStreet.UI             HUD, panels, popups                           → all
SizzleStreet.Tests.EditMode                                               → all but Gameplay
```

Everything above `Gameplay` sets `noEngineReferences`, so a stray `using UnityEngine;` in the
economy fails to compile rather than failing review. `Gameplay` is the only assembly that
touches the engine, and it holds no rules.

That boundary is not decoration. Because those assemblies contain no Unity types, the plain
.NET SDK compiles exactly the same sources — which is what `tools/verify/` does, running the
whole test suite in about two seconds with no editor and no licence. The first time it ran it
found two bugs in code that had already been written, reviewed and documented.

## 3. Folders

```
unity/Assets/_Project/
  Art/            models, textures, materials, atlases
  Audio/          clips and the mixer
  Prefabs/        stations, customers, staff, VFX, UI
  Scenes/         Bootstrap, Game, and one per location
  Scripts/        Core/ Economy/ Save/ Services/ Gameplay/ UI/ Tests/
  ScriptableObjects/  balance data, seeded from data/balance/*.csv
  Localization/   string tables
  Addressables/   location and skin groups
```

## 4. Scenes and startup

`Bootstrap` is tiny and contains no gameplay. It constructs services in dependency order,
registers them, loads the save, then loads `Game` additively:

```
Bootstrap.Awake
  ├── SystemClock
  ├── RemoteConfigService     ← defaults applied immediately; fetch is fire-and-forget
  ├── SaveService             ← load, verify checksum, migrate, or start fresh
  ├── EconomyService          ← rehydrated from SaveData
  ├── AnalyticsService        ← queues events until consent resolves
  ├── AdService               ← consent flow, then init; never blocks startup
  └── SceneManager.LoadSceneAsync("Game", Additive)
```

Every service has a null implementation used when its SDK is absent, consent is refused, or
initialisation fails. `NullAdService` reports that nothing ever fills; `NullAnalyticsService`
drops events. **The game must be fully playable with every one of them installed** — that is
what "playable offline" means concretely, and it is checked in QA by launching with the
network disabled.

Startup never blocks on a network call. Remote Config serves its defaults synchronously and
swaps in fetched values when they arrive; a fetch that never completes is invisible.

## 5. Services and resolution

Managers sit behind interfaces and are resolved through a `ServiceLocator` registered in
`Bootstrap`. Not because a locator is elegant — it is a global with extra steps — but
because the alternatives are worse here: `static Instance` singletons make the economy
untestable, and full constructor injection fights `MonoBehaviour` instantiation for little
gain at this size.

The rules that keep it honest: services are registered once, in `Bootstrap`, before `Game`
loads; gameplay resolves them in `Awake` and caches the reference; nothing resolves during
`Update`; and every interface has a null implementation so a missing registration degrades
instead of throwing at the worst moment.

| Interface | Responsibility |
| --- | --- |
| `IClock` | Now, in Unix seconds and frame time. Injected everywhere time matters |
| `IEconomyService` | Balances, earning, spending, current rates |
| `ISaveService` | Load, save, autosave, migration, corruption recovery |
| `IAdService` | Availability, show, reward callback, consent state |
| `IAnalyticsService` | Typed event logging |
| `IRemoteConfigService` | Typed reads with defaults that always work |
| `IAudioService` | Play, duck, mute-aware |

## 6. The event bus

Typed, generic over the payload struct, so publishing does not box and subscribing does not
allocate:

```csharp
EventBus.Publish(new OrderCompleted(channel, itemCount, payout));
EventBus.Subscribe<OrderCompleted>(OnOrderCompleted);
```

Payloads are `readonly struct`s in `Core/GameEvents.cs`. Subscribers are stored per type in
a preallocated list. The bus is the seam between simulation and presentation: the economy
publishes `CashChanged`, and the HUD, the analytics service and the floating-text pool all
listen without the economy knowing any of them exist.

The one rule that matters: **publishing must not mutate the subscriber list.** A handler
that subscribes or unsubscribes during dispatch is the classic source of a
`InvalidOperationException` under a rare ordering, so dispatch iterates a snapshot and
defers mutations to the end.

## 7. Data model

Configuration is ScriptableObjects, seeded from `data/balance/*.csv` by an editor importer.
The CSVs are the source of truth; the assets are build artefacts that happen to be
committed. Regenerating balance and re-importing is a two-command operation.

```
EconomyConfig          base price, growth bands, combo, offline cap, prestige
StationDefinition      id, base output, speed per level, cost curve, buffer, requiresWorker
ChannelDefinition      patience, order size, price multiplier, arrivals, serve time
LocationDefinition     unlock cost, price band, cost band, arrival multiplier, level caps
UpgradeDefinition      target, base cost, growth, cap
StaffDefinition        post, hire cost, speed multiplier
```

Runtime state is a plain serialisable graph, deliberately separate from configuration:

```
SaveData
  ├── SchemaVersion, SavedAtUnix, Checksum
  ├── PlayerState      level, totalEarned, prestige, tutorial progress
  ├── EconomyState     cash, gems, priceLevel, marketingLevel
  ├── LocationState[]  index, unlocked, stations[], channels[], staff[]
  └── MetaState        dailyStreak, lastRewardDay, adFreeEntitlement, rushHourCooldown
```

Separating them is what makes a balance patch safe: changing a cost curve changes a
`ScriptableObject`, not a save, so nobody's progress is touched.

## 8. Saving

```
SaveData → JSON (Newtonsoft) → checksum over the payload → AES-256-CBC → file
```

- **Versioned from v1.** `SchemaVersion` is written from the first build and `SaveMigrator`
  runs registered migrations in order. A migration path that exists before it is needed
  costs an afternoon; retrofitting one onto shipped saves is not possible.
- **Checksummed.** The checksum covers the plaintext payload and is verified after
  decryption. It detects tampering and, more often, truncation from a kill mid-write.
- **Encrypted at rest.** AES with a key derived per install. This is obfuscation, not
  security: the key ships inside the app and a determined player will find it. It exists to
  make casual save editing inconvenient, and **nothing that gates a purchase may trust it**
  (requirement N-16).
- **Written atomically.** Write to a temporary file, flush, then move over the live file.
  Process death during a write must never leave a half-written save, because that is the
  one failure that costs a player everything and turns into a one-star review.
- **Two slots.** The previous good save is retained. A failed checksum falls back to it and
  reports `save_recovered` rather than resetting the player.
- **Autosaved** on every gate purchase, level up, location unlock, IAP, and on pause and
  quit. Never on a timer during the core loop — a serialise mid-frame is a hitch.

## 9. Offline earnings

The one system where the client is trusted about time, so it is the one system built to be
suspicious:

```
elapsed = max(0, now − savedAt)         // negative means the clock moved back
credited = min(elapsed, capSeconds)
reward = credited × idleRate × efficiency × rewardMultiplier
```

`idleRate` is the throughput of the chain **as it runs without the player** — any unstaffed
post that needs a worker drives it to zero. A shop that visibly could not run itself never
earns while closed.

A backwards clock credits nothing and repairs the stored timestamp forward. There is no
server, so a player who advances their device clock will gain time; the cap bounds how much,
and the alternative — a trusted time source on every launch — costs a network dependency at
startup, which rule 4 of §4 forbids. This is a knowing trade, and it is why offline income
is capped at four hours rather than a day.

## 10. Pooling

Everything spawned repeatedly is pooled: customers, cars, boxes, cash pickups, floating
text, particles. `PoolManager` holds a `ObjectPool<T>` per prefab, prewarmed at location
load to the worst case the location can produce, so a Rush Hour surge allocates nothing.

Pooled objects implement `IPoolable` with `OnSpawn`/`OnDespawn` and are required to reset
their own state. The commonest pooling bug by a distance is a recycled object carrying state
from its last life — a customer that spawns already angry, a coin still tweening.

## 11. Performance

| Technique | Applies to |
| --- | --- |
| GPU instancing | Customers and cars, which are the same mesh many times |
| Single atlas per location | All props share one material |
| No per-frame allocation | Struct events, pooling, cached references, no LINQ |
| Update budgeting | Station and staff ticks are spread across frames, not all on frame zero |
| LOD and culling | Distant props drop to a lower LOD; off-camera customers stop animating |
| Addressables | Locations and skins load on demand and unload on leave |

Stations do not each run an `Update`. A single `StationTicker` walks the active stations in
one loop, which turns hundreds of virtual calls into one and makes the cost of a location
predictable.

## 12. Threats

| Threat | Response |
| --- | --- |
| Save editing | Checksum plus encryption. Purchases are entitlements from the store, never save flags |
| Clock advancement | Offline cap bounds the gain; backwards clocks credit nothing |
| Replayed rewarded ads | Reward granted once per verified callback, keyed by impression id |
| Fake IAP | Server-side receipt validation before entitlement |
| Modified APK | Out of scope. There is no server-authoritative economy in v1 and pretending otherwise would be theatre |

## 13. Definition of Done — Phase 3

- [x] Assembly boundaries defined and one-way
- [x] Startup order specified with a no-network path for every service
- [x] Event bus contract fixed, including the dispatch-mutation rule
- [x] Config and save state separated, with the reason
- [x] Save durability, versioning and recovery specified
- [x] Offline trust model stated, including what it knowingly does not defend
- [x] Pooling and performance techniques assigned to specific systems
- [x] Code compiles — against netstandard2.1, Unity's own target, with zero warnings
- [x] Edit-mode tests executed — 114 passing, headlessly, in about two seconds
- [x] Rule 1 enforced by construction and shown to pay for itself
- [ ] Compiled inside Unity — no editor in this environment
- [ ] Frame budget measured on a real device — blocked on a build
