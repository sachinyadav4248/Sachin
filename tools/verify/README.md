# Headless verification

Compiles and tests the game's runtime code **without Unity**.

```sh
./run.sh
```

## Why this exists

Unity's Test Runner needs an editor install and, in CI, a licence. That is a slow and
fragile thing to put between a developer and the answer to "did I break the economy". It is
also unnecessary here: `Core`, `Economy`, `Save`, `Simulation`, `Services` and
`Serialization` all set `noEngineReferences` in their assembly definitions, so they contain
no Unity types at all. The plain .NET SDK can compile exactly the same source files.

The result is that the economy, the save system, the production chain and the serving
channels are verified on every push in about two seconds, and the Unity Test Runner becomes
a second opinion rather than the only one.

## What it does and does not cover

Covered: every runtime assembly except `Gameplay`, and all of `Tests/EditMode`.

Not covered: `Gameplay` — `PlayerController` is a `MonoBehaviour` and genuinely needs the
engine. Anything scene-, prefab- or asset-shaped needs Unity and belongs in play-mode tests.

## Why netstandard2.1

`Runtime` targets `netstandard2.1` because that is what Unity compiles against. Building
against anything newer would cheerfully accept APIs that do not exist in the real player,
and the failure would then surface on a device instead of in CI.

The test project targets `net8.0`, because the test host needs a runtime and it never ships.

## What it has already caught

Both bugs below were found the first time these tests ran, in code that had been written,
reviewed and documented but never compiled:

- A station accrued progress for the whole elapsed tick and clamped afterwards, so one that
  ran out of supplies mid-tick banked a full unit of work and handed it over free the moment
  it was restocked.
- `ServeCapacityPerSecond` returned zero for an instantaneous handover, conflating "instant"
  with "impossible". Since idle rate takes a minimum against it, a fully staffed shop
  reported that it earned nothing while closed.
