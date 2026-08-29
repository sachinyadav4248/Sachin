# Phase 10 — Maintenance and Scaling

## 1. Versioning and branches

Semantic versioning: major for a save-breaking change, minor for features, patch for fixes.
`main` is always releasable. Feature branches merge via PR with tests green. Release branches
are cut at a tag and accept only cherry-picked fixes.

A hotfix goes: branch from the release tag, fix, test, staged rollout from 1%, then merge
back to `main`. Never fix forward from `main` for a live incident — it ships everything else
that landed since the release along with the fix.

## 2. Kill switches

Anything that can go wrong in a way a store review cannot fix quickly gets a Remote Config
switch. Today that means `rush_hour_enabled`, `starter_pack_enabled`, the interstitial caps,
and `econ_growth_rate_scale` — which exists so a broken economy can be made survivable
without waiting days for a review.

A new system ships with a switch if disabling it leaves a playable game. If it does not, that
is worth knowing before it ships.

## 3. Tech-debt register

Carried openly rather than discovered later.

| Item | Cost | When it bites |
| --- | --- | --- |
| Nothing has been opened in Unity | Probably an afternoon | The first editor open |
| No UI layer at all | Weeks | Before any playtest |
| No ScriptableObject importer; CSVs are not yet read by the game | Days | Before balance means anything in-engine |
| Only null service implementations | Days | Before monetisation exists |
| Simulation assumptions are guesses | Recalibration | As soon as telemetry exists |
| v1 content ends at 19.5 h of play | A location or prestige | Before the first cohort reaches D30 |
| Save encryption is obfuscation, not security | Accepted | Never, unless the economy becomes server-authoritative |
| No server, so clock advancement is possible | Bounded by the offline cap | Accepted for v1 |
| No play-mode or device tests | Days | Before the first release |

The runtime code compiles and its 114 tests pass, headlessly and in CI, so the top row is
much smaller than it was: what remains is Unity agreeing with a compiler that has already
accepted the same sources against the same target framework. The rows that matter now are the
second and the last — there is no UI, and nothing has been run on a device.

## 4. Update cadence

Two to four weeks. Alternate: one release of content, one of fixes and tuning. Balance
changes ship through Remote Config where possible and through a client release where the
change is structural.

Every release runs the full Phase 7 gates. A tuning-only release is not exempt — the balance
tests exist precisely because tuning is the change most likely to skip review.

## 5. Scaling the content

Adding a location is data: a row in `locations.csv`, a scene, its ScriptableObjects. Adding a
station is data plus a prefab. Neither should require a code change, and if one does, that is
a bug in the content pipeline rather than a task.

The cost curves are already defined for locations beyond the third, so extending the game is
a matter of authoring rather than re-tuning — provided each addition is run through
`generate_tables.py` and the pacing tests, because a fourth location that lands in the wrong
place breaks a curve that currently holds.

## 6. When to stop

Written down now, while it is cheap to be honest about.

If after a full soft launch with instrumented cohorts D1 stays below 30% across three
iterations of the first session, the game does not work and no amount of UA will fix it. The
loop is either not fun or not legible, and both are first-session problems.

If D1 clears 35% but CPI will not come below roughly $0.40 in the primary geos, the problem
is creative and positioning, not the game — and that is a different project to fund.

Neither of these is a reason to keep spending because of what has already been spent.

## 7. Definition of Done — Phase 10

- [x] Versioning and hotfix process defined
- [x] Kill-switch policy stated
- [x] Tech debt registered with costs and timing
- [x] Update cadence set, with no exemption for tuning releases
- [x] Content scaling path confirmed as data-only
- [x] Stop conditions written down in advance
