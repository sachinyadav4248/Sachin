# Phase 2 — Game Design Document

Every number in this document is a **default**, not a constant. All of them live in
ScriptableObjects generated from `tools/balance/config.py`; a handful are additionally
overridable at runtime by Remote Config. Where this document and the generated tables in
`data/balance/` disagree, the tables win — regenerate and re-read.

## 1. Core loop

**Serve → Earn → Upgrade → Expand**, sitting on a bed of idle income.

The loop is legible at two time scales. Second to second, the player is a bottleneck-solver:
the oven is the slow step, so the dough piles up, so you go stand at the oven. Session to
session, the player is buying their way out of being the bottleneck at all — first with
speed, then with capacity, then with staff who replace them entirely, at which point the
shop earns while the app is closed and the interesting decision moves up a level to which
location to open next.

Each of the four verbs feeds exactly one other:

- **Serve** converts finished items and waiting customers into cash.
- **Earn** converts cash into the ability to buy.
- **Upgrade** converts cash into throughput, which is more serving per unit of attention.
- **Expand** resets the whole loop at a higher price band, which is the only thing that
  outruns the cost curve for long.

## 2. Station flow

```
                    ┌──────────┐
  Ingredient        │  DOUGH   │  knead — taps produce, or staff produce
  crates ─────────► │  0.80/s  │
                    └────┬─────┘
                         │ raw base
                    ┌────▼─────┐
                    │ TOPPING  │  sauce + toppings
                    │  0.70/s  │
                    └────┬─────┘
                         │ topped, unbaked
                    ┌────▼─────┐
                    │   OVEN   │  bake timer; overcooks if left
                    │  0.45/s  │
                    └────┬─────┘
                         │ baked
                    ┌────▼─────┐
                    │  BOXING  │  cut and box
                    │  0.90/s  │
                    └────┬─────┘
                         │ finished item
                    ┌────▼────────────────┐
                    │   PLAYER CARRY      │  visible stack, capacity 4 → 20
                    │   or STAFF CARRY    │
                    └───┬─────────────┬───┘
                        │             │
                 ┌──────▼─────┐ ┌─────▼────────┐
                 │  COUNTER   │ │  DRIVE-THRU  │
                 │ 2–5 items  │ │  1–2 items   │
                 │ patience   │ │  patience    │
                 │    30s     │ │     18s      │
                 └────────────┘ └──────────────┘
```

The Oven is the deliberate bottleneck at level 0 — 0.45/s against Dough's 0.80/s. A new
player discovers within ninety seconds that dough piles up while the oven crawls, which
teaches the entire upgrade system without a tutorial step. Oven upgrades are also the most
expensive per level (`growth` 1.12 against Dough's 1.09), so the bottleneck moves around as
the player buys, rather than being solved once.

### Station state machine

`Idle → Producing → OutputReady → Blocked`

- **Idle** — no ingredients, or no worker present (player out of range and no staff hired).
- **Producing** — consuming ingredients, accumulating progress.
- **OutputReady** — at least one finished unit in the output buffer; still producing.
- **Blocked** — output buffer full. Production halts and resumes the instant a unit leaves.

Blocking is what makes the chain a system rather than four independent timers. An unattended
Boxing station backs up into the Oven, which backs up into Topping. The player sees the jam
propagate and learns where to stand.

### The two channels

They are different problems, not one problem twice.

| | Counter | Drive-Thru |
| --- | --- | --- |
| Order size | 2–5 items | 1–2 items |
| Base patience | 30 s | 18 s |
| Price multiplier | 1.0× | 1.35× |
| Arrival rate | Higher | Lower |
| Failure cost | Customer leaves | Car leaves **and blocks the lane while unserved** |
| Feel | Forgiving, bulk | Urgent, high-value |

The Drive-Thru lane is physically ordered: an unserved car at the window holds up the cars
behind it, so a single missed order costs more than one sale. This is what makes splitting
attention a real decision rather than a matter of walking further.

### Player verbs

Move (joystick) · carry (automatic pickup by proximity, up to capacity) · serve (automatic
on approach when carrying what's needed) · restock (carry a crate from the supply point to a
station) · collect (walk over dropped cash) · wake (walk into a staff member who has gone
idle). There is no interaction button. Everything is proximity-triggered, which is what
makes one-handed play on a bus possible.

## 3. Economy

### 3.1 Upgrade cost

```
cost(n) = baseCost × growth^n
```

`n` is the current level, zero-indexed; buying moves `n → n+1`. Buying `k` levels at once is
the geometric sum:

```
cost(n, k) = baseCost × growth^n × (growth^k − 1) / (growth − 1)
```

and the largest affordable `k` for a purse `c` inverts it:

```
kMax = floor( log(1 + c × (growth − 1) / (baseCost × growth^n)) / log(growth) )
```

`growth` sits between 1.07 and 1.15. The band is a design language, and it is used
consistently:

| Growth | Meaning | Applied to |
| --- | --- | --- |
| 1.06–1.09 | Cheap, frequent, bought without thinking | Dough, Boxing, carry capacity |
| 1.10–1.12 | Considered purchases, the pacing spine | Topping, Oven, staff |
| 1.13–1.15 | Power spikes, saved for | Price, channel capacity, locations |

### 3.2 Income

```
income = basePrice × priceMultiplier × comboBonus
priceMultiplier = priceGrowth^priceLevel × locationBand × prestigeMultiplier
comboBonus = 1 + comboStep × min(combo, comboCap)
```

Defaults: `basePrice` 3.0, `priceGrowth` 1.07, `comboStep` 0.05, `comboCap` 10 (so a maxed
normal combo is +50%). Drive-Thru orders apply an additional 1.35× channel multiplier.

The combo increments on every completed order and resets to zero on any expired customer.
It is the only place where paying attention beats walking away, outside Rush Hour.

### 3.3 Production rate

```
outputPerSecond = baseOutput × count × stationMultiplier × staffMultiplier
stationMultiplier = speedPerLevel^level
```

`count` is the number of parallel units of that station (a second oven is a purchase, not an
upgrade). `staffMultiplier` is 1.0 when the player works the station personally and comes
from the staff tier when a hire works it.

### 3.4 The progression invariant

Cost is exponential in level. Income is at best exponential with a *smaller* base, and in
practice sub-exponential because throughput is gated by the slowest station and by serving
capacity. Therefore the ratio of cost to income grows without bound, and the player
periodically hits a wall where the next upgrade is out of reach.

**This is the design, not a defect.** Every wall is relieved by exactly one of four things,
and the player always knows which: wait (idle income), watch (rewarded doubler), pay (gems
or a pack), or expand (a new location resets the ratio at a higher band). A wall with no
visible exit is a bug; a wall with an exit is the entire meta-game.

The first wall is tuned to land at roughly 25–35 minutes of play, which is after the first
session for Casey and inside the first session for Omar. It is where the No-Ads and starter
offers first appear.

### 3.5 Idle rate and offline earnings

The idle rate is the throughput of the chain **as it runs without the player**, so it is
determined entirely by what is automated:

```
idleRate = min over stations( automated_i ? outputPerSecond_i : 0 )
           × min(1, serveCapacityPerSecond / chainThroughput)
           × averageIncomePerItem
```

Any unstaffed station in the chain drives the idle rate to zero. This is deliberate and it
is the single strongest argument the game makes for hiring staff. Before the first hire, the
FTUE grants a fixed welcome-back bundle instead, so the first return still has a reward
popup — that bundle is scripted content, not idle income, and stops once real automation
begins.

```
offline = min(elapsed, capSeconds) × idleRate × offlineEfficiency
elapsed = max(0, now − lastSaveTime)
```

Defaults: `capSeconds` 4 h (Remote Config), `offlineEfficiency` 0.5, rewarded doubler ×2.
Half-rate offline income keeps active play strictly better than closing the app, while the
cap gives a reason to come back four times a day rather than once.

If `now < lastSaveTime` the device clock has moved backwards. Elapsed is zero, no reward is
granted, and the stored timestamp is repaired forward. The game never grants time it cannot
prove passed.

### 3.6 Prestige (post-v1)

```
multiplier = 1 + prestigeK × sqrt(totalEarnedThisRun / prestigeScale)
```

Defaults `prestigeK` 1.0, `prestigeScale` 1e6 — so a run that earns 1M returns at 2.0×, and
4M at 3.0×. The square root means each successive reset is worth less, which is what stops
prestige from becoming the only thing worth doing. Not in v1; the save schema reserves the
fields so adding it later is a migration, not a rewrite.

### 3.7 Balance tables

Generated, not hand-written. `tools/balance/generate_tables.py` emits:

| File | Contents |
| --- | --- |
| `data/balance/station_upgrades.csv` | 30 levels per station: cost, cumulative cost, output/s, marginal output per unit cost |
| `data/balance/price_upgrades.csv` | 30 levels: cost, price multiplier, income per item |
| `data/balance/carry_upgrades.csv` | Capacity levels: cost, capacity |
| `data/balance/staff.csv` | Staff tiers per station: hire cost, speed multiplier |
| `data/balance/locations.csv` | Unlock cost, price band, arrival multiplier, patience scale |
| `data/balance/customer_patience.csv` | Patience per channel per location |
| `data/balance/progression.csv` | Simulated time-to-afford and wall positions across the first N levels |

`progression.csv` is the important one: it is the output of an actual simulation of the loop,
and it is what makes "the first wall lands at 25–35 minutes" a checkable claim rather than an
aspiration.

## 4. Progression and content

### Player level

Rises on cumulative earnings, with thresholds on a geometric curve. Each level grants a free
reward (cash, gems, a station unlock, a decor piece); the paid pass grants a parallel
premium track for the same levels. Levels 1–3 are deliberately trivial — a new player should
see three level-up celebrations inside the first four minutes.

### Locations

Sequential unlocks, each a fresh shop with its own stations and upgrade levels, a higher
`locationBand` price multiplier and faster arrivals. Unlock cost is geometric with a very
large growth factor, so a location is always a multi-session goal. Three locations in v1;
the content pipeline supports adding more without a code change.

### Rush Hour — the hook

An opt-in shift, offered on a cooldown and always refusable:

- Arrivals surge on both channels simultaneously, roughly 3×.
- `comboCap` is lifted entirely — the multiplier compounds for as long as the chain holds.
- A single expired customer ends the multiplier, not the shift.
- Ends after 120 seconds and pays out the accumulated total with a summary.

Rush Hour is the only system in the game where execution matters, and it is bounded so that
ignoring it costs a bonus rather than progress. Casey never touches it. Omar plans his
upgrades around surviving it. It is also the natural home of a rewarded "start with a ×2
head start" placement.

### Weekly Star-Point contest

Points earned per served order, reset weekly, cosmetic rewards only — skins and decor, never
economy. A leaderboard that pays out power turns a casual idle game into a competitive one,
which is a different game and a worse one for this audience.

### Daily attendance

A repeating cycle of escalating rewards with a visible streak. Missing a day costs the
streak position, not the accumulated progress.

## 5. UX

### Screen layout

```
┌────────────────────────────────────────────────┐
│ [$ cash]  [◆ gems]        [lvl ▓▓▓░░]  [⚙]     │  ← HUD, safe-area inset
│                                                │
│                                                │
│              3D shop, tilted top-down          │
│                                                │
│         ┌────────┐                             │
│         │ UPGRADE│  ← world-space, above station│
│         │  $340  │                             │
│         └────────┘                             │
│                                                │
│  ╭───╮                              ┌────────┐ │
│  │ ⊙ │  joystick                    │ RUSH   │ │
│  ╰───╯                              │ HOUR   │ │
│                                     └────────┘ │
└────────────────────────────────────────────────┘
```

Upgrade buttons live in the world, floating above the thing they upgrade, rather than in a
menu. The player never has to learn where anything is: it is above the object. Menus exist
for shop, offers, settings and the expansion map, and nothing else.

### Progressive disclosure

Every UI element stays hidden until the system behind it is unlocked. A first-time player
sees a joystick and one prompt. The gem counter appears when they first hold gems. The Rush
Hour button appears when Rush Hour first unlocks. This is the single highest-leverage thing
we do for D1: the first screen has one affordance on it.

### FTUE, beat by beat

| Time | Beat |
| --- | --- |
| 0 s | App opens directly into the shop. No logo screen, no menu, no name entry |
| 0–5 s | Player has joystick control. One arrow points at the Dough station |
| ~10 s | First item produced; carry stack shows one box |
| ~20 s | First Counter customer served; cash drops; first "+$" popup |
| ~30 s | First cash collected by walking over it |
| ~45 s | First upgrade prompt appears above the Oven — the station they have already noticed is slow |
| ~90 s | Drive-Thru opens; first car arrives; the second channel is introduced by use, not text |
| ~3 min | First staff hire offered — the first time the shop does something without them |
| ~5 min | Player level 3; expansion map teased, locked |
| First return | Offline earnings popup with the rewarded doubler — the first ad the player ever sees, and it is optional and pays them |
| ~25–35 min | First real wall; No-Ads and starter offers appear |

The first ad in the game is a rewarded one that gives the player money. The first
interstitial does not appear until after the first location transition. Casey's opinion of
the game is set in the first two minutes and ads are not part of it.

### Feedback

Nothing happens silently. Every serve pops the customer's happy reaction, drops physical
cash, fires a "+$" that flies to the HUD, and ticks the combo. Every upgrade squashes the
station model and bursts particles. Every level-up freezes the world for 400 ms. Haptics on
serve, upgrade and level-up, respecting the OS setting.

## 6. Art direction

Low-poly stylised 3D. Bright, high-saturation palette on a warm neutral ground. Chunky,
rounded silhouettes readable at 4 cm. Camera is a fixed tilted top-down at roughly 55°,
orthographic-feeling perspective, framing the whole shop with no camera control — the player
never manages a camera.

Everything animates with squash and stretch. Stations compress when they produce, customers
bob while queueing, boxes wobble on the stack, cash arcs and bounces. The genre's appeal is
tactile; the models are simple so the motion has to carry it.

Characters ≤ 2,000 triangles, props ≤ 500, one shared URP material per atlas, no per-object
textures. Full specification in [`docs/05-content-pipeline.md`](05-content-pipeline.md).

## 7. Audio

A short warm loop per location, ducked under a mixer group so it never competes with
feedback. The signature sounds are the cash chime, the oven sizzle, the box pop and the
level-up stinger — these four carry the whole game's feel and are worth commissioning
properly rather than buying.

Mixer groups: Music, SFX, UI. Feedback ducks music by 3 dB for 200 ms. **The game must be
completely playable muted** — every audio cue has a visual twin, because most sessions are
silent.

## 8. Localisation

English is the source. All strings live in Unity Localization string tables under
`Assets/_Project/Localization/`. No text is baked into any texture, including the store
icon variants used in-game.

Wired at v1, translated as budget allows: ES, PT-BR, DE, FR, TR, RU, JA, KO, ZH-Hans. Layout
is built for a 1.4× string-length expansion (German and Russian) and for CJK line breaking.
Numbers, currency and dates go through culture-aware formatting; large numbers use the
suffix scheme in `NumberFormat`, which is itself localised because suffix conventions differ
by market.

## 9. Definition of Done — Phase 2

- [x] Core loop and station flow specified including block propagation
- [x] Both channels differentiated with distinct parameters and failure costs
- [x] Every economy formula written explicitly with defaults
- [x] Progression invariant stated with its wall-relief design
- [x] Offline model defined including the clock-tamper rule
- [x] Balance tables specified as generated artefacts
- [x] FTUE written beat by beat with timings
- [x] Art, audio and localisation direction set
- [ ] First-wall timing validated against the simulation — see `data/balance/progression.csv`
- [ ] Rush Hour tuned against real play sessions — needs a playable build
</content>
