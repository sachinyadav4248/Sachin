# Phase 0 — Project Charter, Placeholders and Quality Bar

This document fixes the values that the rest of the project treats as given. Everything
here was chosen as a documented default; anything a stakeholder disagrees with should be
changed **here first**, then propagated.

## 1. Filled placeholders

The build prompt this project was generated from carried placeholders. They resolve as
follows. Values marked **UNRESOLVED** are credentials or URLs that cannot be invented; they
are read from environment/secret configuration and the build fails loudly if missing (see
[`docs/08-build-release-and-compliance.md`](08-build-release-and-compliance.md)).

| Placeholder | Value |
| --- | --- |
| `GAME_NAME` | Sizzle Street |
| `STUDIO_NAME` | Sizzle Street Games |
| `UNIQUE_HOOK` | **Rush Hour** — a recurring timed shift where both serving channels surge simultaneously and the combo multiplier is uncapped |
| `PACKAGE_ID` | `com.sizzlestreetgames.sizzlestreet` |
| `APPLOVIN_SDK_KEY` | **UNRESOLVED** — `SS_APPLOVIN_SDK_KEY` |
| `MAX_AD_UNIT_IDS` | **UNRESOLVED** — per-placement, `SS_MAX_UNIT_<PLACEMENT>` |
| `ADMOB_APP_ID` | **UNRESOLVED** — `SS_ADMOB_APP_ID` |
| `FIREBASE_CONFIG` | **UNRESOLVED** — `google-services.json`, not committed |
| `ADJUST_APP_TOKEN` | **UNRESOLVED** — `SS_ADJUST_APP_TOKEN` |
| `PLAY_LICENSE_KEY` | **UNRESOLVED** — `SS_PLAY_LICENSE_KEY` |
| `PRIVACY_POLICY_URL` | **UNRESOLVED** — must exist before first submission |
| `SUPPORT_EMAIL` | **UNRESOLVED** — must exist before first submission |

**Name clearance is not done.** "Sizzle Street" has not been checked against trademark
registers or the Play store. Clearance is a gate on the first store submission, not on
development — see [`IP-GUARDRAILS.md`](../IP-GUARDRAILS.md).

## 2. Engine and platform

- **Unity 6000.0 LTS**, Universal Render Pipeline, C# against .NET Standard 2.1.
- **Android first.** minSdk 24. targetSdk 35 (Android 15) today; 36 (Android 16) for any
  submission after 31 Aug 2026. Output is an AAB, R8-shrunk, 16 KB page-size aligned.
- iOS is a later port. Nothing in the architecture may assume Android — platform-specific
  work sits behind the service interfaces in `SizzleStreet.Services`.

## 3. Performance budget

The target device is a mid-tier Android phone: Snapdragon 6-series class, 4 GB RAM.

| Budget | Limit |
| --- | --- |
| Frame rate | 60 FPS sustained, no frame over 33 ms in the core loop |
| Draw calls | ≤ 120 in the shop view |
| Triangles on screen | ≤ 100k |
| Textures | Shared atlases, 1024–2048, ASTC 6x6 |
| GC | **Zero** per-frame allocation in the core loop |
| Memory | ≤ 512 MB total, verified over a 30-minute soak |
| Cold start | ≤ 4 s to first interactive frame |

Zero per-frame allocation is the constraint that shapes the code most. It is why customers,
boxes, cash pickups and floating text are pooled, why the event bus is generic over struct
payloads, and why no core-loop code uses LINQ, `foreach` over interfaces, string
concatenation or lambda closures.

## 4. Code standards

- PascalCase types and methods, camelCase locals and parameters, `_camelCase` private
  fields. One public type per file, named for the type — except tightly coupled data
  contracts, where splitting one idea across five files makes it harder to read, not easier.
  `GameEvents.cs` holds every event payload; `EconomySettings.cs` holds every settings
  interface. Both are read and changed as a unit.
- XML documentation on every public API. Comments explain constraints, not mechanics.
- An assembly definition per module. Dependencies point one way: `Gameplay` and `UI` may
  depend on `Core` and `Economy`; nothing depends on `UI`.
- Composition over inheritance. Managers sit behind interfaces and are resolved through
  `ServiceLocator`, never through `static Instance` properties reached from gameplay code.
- No `GameObject.Find`, `Camera.main` or `GetComponent` inside `Update`. Cache in `Awake`.
- **Balance values never appear in logic.** A literal number in a gameplay file is a bug
  unless it is a structural constant (array size, layer index).
- Nullable reference types are enabled in every assembly.

## 5. Architectural rules that outrank convenience

1. **Simulation is Unity-free.** Economy, upgrade, offline and save logic are plain C#
   classes with no `UnityEngine` dependency, so they run in headless unit tests and can be
   ported. `MonoBehaviour`s are thin adapters over them.
2. **Time is injected.** No simulation code calls `DateTime.UtcNow` or `Time.time`
   directly; it takes an `IClock`. This is what makes offline earnings and clock-tamper
   handling testable.
3. **Money is `double`, never `float`.** Late-game values exceed `float` precision long
   before they exceed `double` range. Display formatting is a separate concern.
4. **Saves are versioned from v1.** A migration path exists before it is needed, because
   retrofitting one onto shipped saves is not possible.
5. **Every remote dependency has a no-network path.** Ads that do not fill, Remote Config
   that does not fetch and analytics that cannot send must all degrade to a playable game.

## 6. Definition of Done — Phase 0

- [x] Placeholders resolved or explicitly marked unresolved with a source
- [x] Engine, platform and API-level targets fixed
- [x] Performance budget quantified per metric
- [x] Code standards written down
- [x] Architectural non-negotiables stated with reasons
- [ ] Name cleared against trademark registers — **open, gates first submission**
- [ ] Privacy policy and support email provisioned — **open, gates first submission**
