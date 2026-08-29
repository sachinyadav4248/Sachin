# Phase 7 — QA and Testing

## 1. What is tested where

| Layer | Runs | Covers |
| --- | --- | --- |
| Python unit tests | `python3 -m unittest discover` in `tools/balance` | The economy specification: 41 tests |
| Python balance tests | The same | Simulated pacing against `config.PACING`: 16 tests |
| C# edit-mode tests | `tools/verify/run.sh`, and Unity Test Runner | Golden values, saves, the production chain, the ledger: 114 tests |
| Play-mode tests | Unity Test Runner | Scene wiring, pooling, the FTUE sequence — **not written** |
| Device matrix | Manual, per release | Frame rate, memory, thermals, input |
| Soak | Automated, nightly | 30 minutes of continuous play |

The C# tests run **without Unity**. Every runtime assembly sets `noEngineReferences`, so the
plain .NET SDK compiles the same sources and runs the same tests against netstandard2.1 —
Unity's own target — in about two seconds. `./tools/verify/run.sh`, and a CI job.

That was worth building for a reason beyond speed. The first time those tests executed, they
failed twice, in code that had been written, reviewed and documented but never compiled: a
station banked a free unit of work across a stall, and a fully staffed shop reported that it
earned nothing while closed. Both are the kind of bug that survives any amount of reading.

Only the Unity Test Runner, play-mode tests and device work remain unrun.

## 2. The balance tests are the unusual part

`tools/balance/test_simulate.py` asserts a simulated player's progression against the pacing
targets in `config.PACING`: first upgrade inside a minute, level 4 inside four minutes, the
first hire between 5 and 20 minutes, the second location between 1.5 and 6 hours, and enough
content to reach day 30.

This means a balance change that quietly pushes the first hire past half an hour **fails
CI**. Tuning is usually the least-tested part of a game and the part most likely to be
changed at the last minute by somebody in a hurry.

Two of these targets exist because an earlier tuning pass failed them. `max_income_rate`
catches the runaway that reached 470,000 cash per second within six hours;
`longest_hire_wall_max_seconds` catches the version where the first hire landed at 104
minutes.

## 3. Edge cases with a defined answer

Each of these has a test, or is listed as owing one.

**Time.** Clock set backwards — credit nothing, repair the timestamp, no reward. Clock set
forward — the cap bounds the gain; accepted, no server to check against. Time zone change
mid-session, daylight saving, and a device that has never had a correct clock.

**Storage.** Killed mid-write. Killed mid-write of the backup. Disk full. Save edited by the
player. Save truncated. Save from a newer build. Both slots unreadable. All but the last
three are covered by `SaveTests`; a disk-full write needs a play-mode test.

**Network.** No network at launch. Network lost mid-session. Ads never fill. Remote Config
never fetches. Analytics cannot send. Every one must degrade to a playable game, which is
verified by launching in airplane mode — the null services exist so this is structural
rather than a matter of remembering to null-check.

**Ads.** Abandoned mid-ad. Ad fails to show after reporting ready. Reward callback arrives
twice — grant once, keyed by impression. Reward callback never arrives. App backgrounded
during an ad.

**Economy.** Balance at exactly an upgrade cost. Bulk-buy of more levels than are affordable.
A maxed track. Numbers past 1e15, where a double stops representing integers exactly.

**Input.** Two fingers. Joystick released off-screen. Interruption by a call. Rotation.

## 4. Device matrix

| Tier | Example | What it proves |
| --- | --- | --- |
| Minimum | Snapdragon 4-series, 3 GB, Android 8 | The floor still runs |
| Target | Snapdragon 6-series, 4 GB, Android 13 | 60 FPS sustained — the budget device |
| High | Recent flagship | Nothing thermally throttles at high frame rates |
| Tablet | 10-inch, 4:3 | Layout survives a different aspect |
| Notched | Hole-punch or notch | Safe area is respected |

Frame rate is measured at the worst case, not the average: Rush Hour, both queues full, in
the largest location, with a staff member at every post.

## 5. Soak

Thirty minutes of continuous automated play, nightly, on the target device. Watch for
climbing memory (a pooling leak), climbing frame time (accumulating objects), and thermal
throttling. Fail the build on a memory slope over 5 MB per minute or a frame-time slope at
all.

## 6. Play-test protocol

Five first-time players per build, watched, not interviewed. Note where they stop, where
they hesitate, and what they say aloud. Do not explain anything, however painful.

Three questions afterwards: what were you trying to do; what did you expect to happen; would
you open this again tomorrow. Everything else is noise at this sample size.

## 7. Release gates

No build ships with any of these unmet:

- Every unit and edit-mode test green
- Frame rate on the target device at the worst case ≥ 55 FPS
- Soak clean over 30 minutes
- Crash-free sessions ≥ 99.5% in the previous stage
- Save/load verified across an app kill on a real device
- Full playthrough of the FTUE on the minimum-spec device
- Airplane-mode launch reaches gameplay
- Data Safety declaration matches what the SDKs actually collect

## 8. Definition of Done — Phase 7

- [x] Test layers assigned to what they cover
- [x] Balance targets made executable, and enforced in CI
- [x] Edge cases enumerated with a defined answer each
- [x] Device matrix and worst-case measurement point set
- [x] Release gates fixed
- [ ] Play-mode tests — not written
- [ ] Soak automation — not built
- [ ] Any of it run on a device — no build exists
