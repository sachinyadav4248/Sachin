# Phase 8 — Build, Release and Compliance

> Policy deadlines move. Everything dated here was accurate when written and must be
> re-checked in the Play Console before each submission rather than trusted from this page.

## 1. Build configuration

| Setting | Value |
| --- | --- |
| Output | Android App Bundle |
| `minSdkVersion` | 24 |
| `targetSdkVersion` | 35 (Android 15) now; **36 (Android 16)** for any submission after 31 Aug 2026 |
| Play Billing | 7 or newer |
| Scripting backend | IL2CPP, ARM64 |
| Shrinking | R8, with keep rules for every reflection-touched type |
| Page alignment | 16 KB |
| Download size | ≤ 150 MB |

The reflection keep rules matter more than they look. `SaveData` is deserialised by name, so
R8 renaming a property silently changes the save format between a debug and a release build
— and it will be found by a player, not by a test, because the tests run unshrunk.

## 2. Signing and secrets

Nothing secret is committed. The keystore, the AppLovin SDK key, the AdMob app id, the Adjust
token, the Play licence key and `google-services.json` all come from CI secrets.

The build **fails loudly** on a missing key rather than falling back to a placeholder. A
build that quietly ships with a test ad unit earns nothing and nobody notices for a week.

## 3. Release process

1. Version bump — semantic, with the build number derived from the CI run.
2. Tag, and build from the tag rather than from a branch.
3. Internal testing track. Full QA gates from Phase 7.
4. Closed testing, 100–500 players, minimum one week.
5. Production, staged: 1% → 5% → 20% → 50% → 100%, at least 24 hours per step.
6. Watch crash-free rate and D1 at every step. Halt on a crash-free rate below 99% or a
   D1 drop over 3 points.

Pre-launch report reviewed before every production step, not only the first.

## 4. Data Safety

The declaration must match what the SDKs actually do, not what the game intends. Ad
mediation collects more than most teams assume, and the declaration is a statement to
players, not a form to fill in.

With the recommended stack the declaration covers **Device or other IDs** (advertising id),
**App activity** (in-app actions, for analytics), **App info and performance** (crash logs
and diagnostics), and **approximate location** if the mediation stack derives it — which it
may, from IP, without being asked to.

Before every submission, verify the declaration against the SDKs actually linked in the
build rather than against this list. The right check is a network capture from a real
device, not a reading of the documentation.

Required alongside it: a public privacy policy URL, an account-deletion route (even with no
accounts, a data-deletion request path is required), and a data-retention statement.

## 5. Consent

- **GDPR/UK GDPR:** a consent flow before any personalised ad request, via the mediation
  SDK's UMP integration. Refusal serves non-personalised ads; it does not degrade the game.
- **US state privacy laws:** opt-out signalling passed to the mediation stack.
- **COPPA and the Families policy:** if the app targets under-13s, only certified ad SDKs,
  no personalised ads, a neutral age screen, and no external links.

**The Families decision is still open** and it is the highest-impact commercial choice
outstanding — see [`docs/01-requirements.md`](01-requirements.md) §7. The code supports either
answer; the store listing cannot support both. It must be made before the first submission,
because changing a live app's target audience is a far harder conversation with review than
declaring it correctly the first time.

## 6. Store listing

Written from scratch. Keyword overlap with competitors on descriptive terms — idle, tycoon,
restaurant, cooking, simulator — is expected and fine; copied sentences are not. No
competitor is named, and no competitor's screenshot appears in any comparison.

Screenshots are captured from the real build. A screenshot showing gameplay the app does not
contain is both a policy violation and the fastest way to earn a one-star review from someone
who feels lied to.

## 7. CI

| Stage | Runs on | Does |
| --- | --- | --- |
| Lint and format | Every push | Style and analyser rules |
| Python tests | Every push | Economy and balance, ~5 s |
| Balance drift | Every push | Regenerates the tables and fails if the committed output differs |
| Edit-mode tests | Every push | Unity Test Runner, headless |
| Play-mode tests | Every PR | Once they exist |
| Build | Every PR | Unsigned AAB, to catch compile and shrink failures |
| Signed build | Tags | Signed AAB, uploaded to internal testing |
| Soak | Nightly | 30 minutes on a device farm |

The balance-drift stage is worth its cost: generation is deterministic, so a difference means
someone changed `config.py` without regenerating, and the CSVs the game ships no longer match
the numbers the tests verified.

## 8. Definition of Done — Phase 8

- [x] Build settings, API levels and shrinking rules fixed
- [x] Secret handling defined, with fail-loud on missing keys
- [x] Staged rollout with halt conditions
- [x] Data Safety scope identified with a verification method
- [x] Consent obligations enumerated
- [x] CI stages defined including balance-drift detection
- [ ] Play Console entry — does not exist
- [ ] Privacy policy and support email — unresolved
- [ ] Families decision — **open, gates submission**
- [ ] Keystore and signing — not provisioned
