# Android build

A playable Android build of Sizzle Street that does not need Unity.

```sh
./android/build.sh          # produces dist/SizzleStreet-<version>-greybox.apk
```

## What this is

The grey-box prototype the build order in
[`docs/04-implementation.md`](../docs/04-implementation.md) calls for: the first thing that
installs on a phone and answers the only question that matters this early — **is the loop fun
to play?**

It is not the game the design documents describe. There is no art, no animation, no audio, no
ads, one location instead of three, and cash is credited directly rather than dropping in the
world to be walked over. Everything you see is coloured rectangles.

What it is *not* is a mock-up. The rules it runs are the same source files that
`tools/verify` tests — `Shop`, `Station`, `ServiceCounter`, `Customer`, `CarryStack`,
`ComboTracker`, `EconomyManager`, `UpgradeSystem`, `SaveManager`. The presentation is
throwaway; the simulation underneath is the real thing, and the balance is generated from
`tools/balance/config.py` like everything else.

## Why not Unity

Unity needs an editor install and a licence activation, neither of which exists in the
environment this was built in. But the architecture's first rule — the simulation is
Unity-free — means the .NET Android workload can consume the same assemblies directly. The
alternative would have been reimplementing the game in another language to get something on a
phone, which would have created a second source of truth and a permanent drift problem.

When the Unity project is built out, this build stays useful as a fast way to test balance
changes without opening an editor.

## How it is verified

There is no device or emulator in CI, so `GameWorld` — the wiring layer, and the only new
logic in this build — was written without a single Android type in it. That lets
`GameWorldTests` drive the exact code that ships in the APK: it plays scripted sessions of up
to forty simulated minutes and checks the shop keeps trading, customers keep arriving,
progress survives a close and reopen, and an upgrade is affordable inside the first minute.

That covers everything in this build except drawing and touch handling, which have not been
run on a device.

## Layout

| File | Role |
| --- | --- |
| `GameWorld.cs` | Arrangement and wiring: where things are, who is near what, which buttons exist. No Android types, so it is testable |
| `GameView.cs` | Drawing and input. Disposable |
| `MainActivity.cs` | The bootstrap sequence from the architecture document |
| `AndroidFileSaveStore.cs` | Atomic file writes for saves |

## Build notes

- **Linking is off in Release.** The save model is serialised by reflection; a trimmer that
  cannot see that removes members it believes unused, which surfaces as a save silently
  losing fields on a device after release. Size is the cheaper thing to spend.
- **arm64-v8a and x86_64 only.** Real phones and emulators. The 32-bit ABIs roughly double
  the download and only serve devices below the minimum spec.
- **Debug-signed.** Fine for sideloading, not for distribution. A release keystore is a
  Play Console task — see [`docs/08-build-release-and-compliance.md`](../docs/08-build-release-and-compliance.md).

## Installing

Enable "install unknown apps" for whatever app you transfer it with, then open the APK. Or
over USB with debugging on:

```sh
adb install -r dist/SizzleStreet-0.1.0-greybox.apk
```

## Playing it

Drag anywhere in the dark strip at the bottom to move. Everything else is proximity-based —
there is no interaction button, because the whole point is one-handed play.

- Stand at a station to work it. Dough, Topping and Boxing need you; the **Oven is a machine
  and runs itself**, which is why it only becomes the bottleneck after you start hiring.
- Stand at **Boxing** to pick up finished food, then walk to the Counter or Drive-Thru to
  serve. The number on each customer is what they still want; the bar is their patience.
- When a station runs dry, fetch a crate from the middle and bring it over.
- Buttons buy upgrades. **Hire** is the one to watch: it moves a station out of your hands
  entirely, and it is the biggest single jump in the game.
