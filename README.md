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

## Status

Phases 0–4 are implemented as code and documentation in this repository. Art, audio,
storefront assets and live SDK keys are not — see each phase document for its Definition of
Done and what remains open.
</content>
