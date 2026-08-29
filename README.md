# Sizzle Street

An original 3D idle-arcade restaurant tycoon for Android, built in Unity 6 (URP, C#).

You start behind the counter of one small food stall. You knead, top, bake, box and serve —
by hand, at first — across two competing channels: a walk-up **Counter** and a
**Drive-Thru** lane whose drivers will not wait. Cash buys faster stations, bigger carry
stacks and staff who take the work off your hands, until the stall runs itself and you
open the next one down the street.

> **Legal:** Sizzle Street is an original title. It borrows nothing from any existing game
> beyond unprotectable genre mechanics and economy mathematics. See
> [`IP-GUARDRAILS.md`](IP-GUARDRAILS.md) — read it before adding any asset, name or store
> copy.

## Repository layout

| Path | Contents |
| --- | --- |
| `docs/` | One document per SDLC phase — charter, requirements, GDD, architecture, content pipeline, monetisation, QA, release, analytics, maintenance |
| `unity/` | The Unity project root. Game code lives in `unity/Assets/_Project/Scripts`, split into assembly definitions per module |
| `tools/balance/` | Python reference implementation of the economy, the balance-table generator, and its test suite |
| `data/balance/` | Generated CSV balance tables, consumed by the Unity importer into ScriptableObjects |
| `ATTRIBUTIONS.md` | Every third-party asset and licence; source for the in-game attributions screen |

## Getting started

### Game code

Open `unity/` in Unity 6000.0 LTS or newer. The project targets URP and Android.
`Assets/_Project/Scenes/Bootstrap.unity` is the entry scene; it initialises services and
loads `Game.unity` additively.

Balance values are **never** hard-coded in logic. They live in ScriptableObjects under
`Assets/_Project/ScriptableObjects/`, seeded from the CSVs in `data/balance/`, and the
handful of values that need to move without a client release are overridden by Remote
Config (see [`docs/06-monetisation-and-liveops.md`](docs/06-monetisation-and-liveops.md)).

### Balance tooling

The economy is specified once, in Python, and ported to C# — the two implementations are
kept in agreement by a shared set of golden values.

```sh
cd tools/balance
python3 -m unittest discover -v     # run the economy tests
python3 generate_tables.py          # regenerate data/balance/*.csv
```

`generate_tables.py` is deterministic: regenerating without changing
`tools/balance/config.py` produces byte-identical CSVs, so a diff in `data/balance/` always
means a real balance change.

## Design summary

The core loop is **serve → earn → upgrade → expand**, underpinned by offline income.

- **Serve.** A joystick-driven avatar walks a station chain — Dough → Topping → Oven →
  Boxing — carrying a visible stack of boxes to the Counter and the Drive-Thru.
- **Earn.** Each served order pays `basePrice × priceMultiplier × comboBonus`. Serving both
  channels without letting either queue expire builds the combo.
- **Upgrade.** Station speed, carry capacity, prices and staff all cost
  `baseCost × growth^level`. Exponential cost against sub-exponential income creates the
  soft walls the meta-game is built around.
- **Expand.** New counters, then new floors, then new locations, each a fresh instance of
  the loop with a higher price band.

The differentiator is **Rush Hour**: a recurring timed shift where both channels surge at
once and the combo multiplier is uncapped. It is the skill ceiling of an otherwise idle
game, and the reason to keep hands on the device.

Full design: [`docs/02-game-design-document.md`](docs/02-game-design-document.md).

## Documents

| Phase | Document |
| --- | --- |
| 0 | [Project charter](docs/00-project-charter.md) — placeholders, budgets, standards |
| 1 | [Requirements](docs/01-requirements.md) — personas, KPIs, acceptance criteria |
| 2 | [Game design](docs/02-game-design-document.md) — the loop, the economy, the FTUE |
| 3 | [Technical architecture](docs/03-technical-architecture.md) — assemblies, saves, offline trust |
| 4 | [Implementation](docs/04-implementation.md) — what exists, what does not, what order to build it |
| 5 | [Content pipeline](docs/05-content-pipeline.md) — asset budgets and specifications |
| 6 | [Monetisation and LiveOps](docs/06-monetisation-and-liveops.md) — placements, IAP, experiments |
| 7 | [QA and testing](docs/07-qa-and-testing.md) — test layers, edge cases, release gates |
| 8 | [Build, release and compliance](docs/08-build-release-and-compliance.md) — API levels, Data Safety, CI |
| 9 | [Analytics](docs/09-analytics.md) — event taxonomy, funnels, feeding telemetry back |
| 10 | [Maintenance and scaling](docs/10-maintenance-and-scaling.md) — cadence, tech debt, stop conditions |

Plus [`IP-GUARDRAILS.md`](IP-GUARDRAILS.md), which applies to every commit, and
[`data/balance/REPORT.md`](data/balance/REPORT.md), which is generated.

## Status

The design is complete across all eleven phases and the systems code is written. Two things
are worth being plain about before reading further.

**The C# has never been compiled.** There is no Unity installation and no .NET toolchain in
the environment this was built in, so none of it has been through a compiler and the
edit-mode tests have never run. The economy those tests check *has* been executed — in
Python, against the same golden values — so the formulas are trustworthy and the C#
expressing them is not yet. Treat the first Unity open as a compile-and-fix pass.

**There is no game to play.** No UI, no scenes, no art, no audio, no bootstrap, and only null
implementations of the ad, analytics and config services. What exists is the loop's logic,
the economy, the save system, and the tests for them.
[`docs/04-implementation.md`](docs/04-implementation.md) lists what is missing and the order
to build it in. The gate that matters is a grey-box scene with a joystick and one shop —
everything before it is scaffolding, and everything after it is worthless if the loop is not
fun.
