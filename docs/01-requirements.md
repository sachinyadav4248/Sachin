# Phase 1 — Requirements and Product Definition

## 1. Vision

Sizzle Street turns the small satisfactions of running a food counter — the dough hitting
the tray, the oven timer, the stack of boxes going out the window — into a loop you can
pick up for three minutes or lose forty to. You begin doing every job yourself, badly and
just fast enough. Cash buys speed, then capacity, then people, until the stall you were
drowning in runs without you and the interesting question becomes which street to open on
next. The game is generous with progress in the first session and honest about the walls
that come later: every wall has a visible price, and the price is always a choice between
time, an ad, or money.

## 2. Audience and personas

Primary audience: casual mobile players, 13–45, skewing slightly female, playing in short
bursts on mid-tier Android. They are genre-literate — they have played an idle game before
and expect offline earnings and a rewarded doubler without being taught.

### Commuter Casey — 34, sessions of 3 minutes

Plays on the bus, four to six times a day, one hand, sound off. Opens the game *for* the
offline-earnings popup. Wants a decisive upgrade every session and to close the app without
feeling she abandoned something mid-task.

- **Needs:** instant resume, no unskippable intro, one-tap collect, readable UI at arm's
  length, full playability muted.
- **Spends:** rarely, but buys No-Ads if interstitials annoy her before day 7.
- **Design consequence:** no session may *require* more than 60 seconds to reach a
  satisfying stopping point. Rush Hour is opt-in, never forced.

### Optimizer Omar — 22, sessions of 25 minutes

Reads the upgrade list before buying. Wants to know the marginal return of each purchase
and will notice if a cost curve is dishonest. Chases the weekly leaderboard.

- **Needs:** exact numbers, not bars. Income-per-second deltas shown before purchase.
  Deterministic, explainable systems. A skill ceiling — Rush Hour is aimed squarely at him.
- **Spends:** season pass, sometimes gems, resents pay-to-skip that trivialises optimisation.
- **Design consequence:** every upgrade tooltip shows current and post-purchase rates.
  Nothing important is hidden behind an undisclosed random roll.

### Kid Kim — 11, sessions of 10 minutes, supervised device

Reachable only if the app is Families-compliant. Drives the content rating and the entire
ads configuration.

- **Needs:** no personalised ads, no external links, no data collection beyond the minimum,
  neutral age screen, comprehensible-without-reading UI.
- **Spends:** nothing directly; parental purchases only.
- **Design consequence:** this persona is the reason the ad layer is built behind an
  interface with a non-personalised mode from day one. **Whether we target Families is an
  open commercial decision** — see §7. The architecture supports either answer; the store
  listing cannot support both.

## 3. Market position

The idle-arcade restaurant tycoon is a crowded, proven category on Play. Category leaders
are free, ad-heavy, and monetise primarily through rewarded video with a No-Ads IAP as the
main conversion event. Entry is cheap and differentiation is thin: most entrants ship the
same loop with different food.

**Our differentiator is Rush Hour.** Idle-arcade games in this category are almost entirely
throughput management with no failure state and no execution skill. Rush Hour adds a
recurring, opt-in, two-minute shift where both channels surge, the combo multiplier is
uncapped, and a dropped order breaks the chain. It gives the genre's idle scaffolding an
active layer without adding a lose condition to the base game — Casey ignores it, Omar
builds his session around it.

Secondary differentiator: **the Drive-Thru is a genuinely different problem**, not a second
counter. Drive-Thru customers have shorter patience, arrive in cars that block the lane when
unserved, and order fewer but higher-value items. Balancing attention between a forgiving
Counter queue and an unforgiving lane is the moment-to-moment decision.

Risks: the category is saturated, UA costs are set by well-capitalised incumbents, and
differentiation on mechanics alone rarely wins UA auctions. Creative quality and CPI matter
at least as much as the hook.

## 4. Success metrics

Targets for the soft-launch decision. Sources are genre medians from public benchmark
reporting, not competitor telemetry — treat them as goalposts, not observations.

| Metric | Target | Scale-UA gate | Notes |
| --- | --- | --- | --- |
| D1 retention | ≥ 40% | > 35% | Below 30%, fix the first session, not the UA |
| D7 retention | ≥ 15% | ≥ 12% | Category top-quartile is ~20% |
| D30 retention | ≥ 5% | ≥ 4% | |
| Average session | 4–6 min | | Sub-3 min means the loop stalls |
| Sessions per day | ≥ 4 | | Offline collect drives this |
| Day-0 playtime | ≥ 20 min | | Strong early signal, available on day 1 |
| CPI | ≤ $0.30 | ~$0.20 | Blended, primary geos |
| ARPDAU | ≥ $0.05 | | Ads + IAP |
| Rewarded engagement | ≥ 40% DAU | | Below 25% means placements are badly sited |
| Rewarded share of ad revenue | 70–80% | | Interstitial-heavy revenue mix predicts churn |
| Crash-free sessions | ≥ 99.5% | ≥ 99.0% | |
| FTUE completion | ≥ 85% | | Reaching first upgrade |

**The retention/monetisation trade is decided in advance:** if raising ad frequency costs
more than 3 points of D1, it is rolled back regardless of the ARPDAU gain. Ad density is
the most common cause of one-star reviews in this category, and early over-monetisation
caps lifetime value permanently.

## 5. Functional requirements

| ID | Requirement |
| --- | --- |
| F-01 | The player controls an avatar by on-screen floating joystick and interacts with stations automatically by proximity — no interaction button |
| F-02 | Food is produced through an ordered station chain: Dough → Topping → Oven → Boxing |
| F-03 | Finished items are carried in a visible stack of limited, upgradeable capacity |
| F-04 | Two independent serving channels — Counter and Drive-Thru — each with its own queue, patience model and payout band |
| F-05 | Customers arrive on a rate curve, queue, order, wait, pay and leave; expiring patience loses the sale and breaks the combo |
| F-06 | Cash drops physically in the world and is collected by walking over it |
| F-07 | Upgrades cost `baseCost × growth^level` and apply to station speed, carry capacity, prices, staff and channel capacity |
| F-08 | Staff can be hired to automate any station or channel, and upgraded for speed and capacity |
| F-09 | Two currencies: cash (soft, earned) and gems (hard, earned sparsely and purchasable) |
| F-10 | Offline earnings accrue at the idle rate, capped, with a rewarded-ad doubler |
| F-11 | Player level rises with total earnings and grants free rewards; a paid pass grants a parallel premium track |
| F-12 | Locations unlock in sequence, each a fresh loop instance at a higher price band |
| F-13 | Rush Hour: an opt-in timed shift with surged arrivals and an uncapped combo multiplier |
| F-14 | Rewarded ads at the placements in [`docs/06-monetisation-and-liveops.md`](06-monetisation-and-liveops.md); every one is optional and every one must fail gracefully |
| F-15 | Interstitial ads at location transitions and after N serves, under a frequency cap |
| F-16 | IAP: No-Ads, gem packs, starter pack, season pass, with receipt validation and restore |
| F-17 | The game saves automatically and survives process death without losing more than one action |
| F-18 | Daily attendance rewards on a repeating cycle |
| F-19 | A weekly Star-Point leaderboard with cosmetic rewards |
| F-20 | Restaurant customisation (floors, walls, furniture) that also raises customer arrival rate |

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| N-01 | 60 FPS sustained on the reference mid-tier device; no core-loop frame over 33 ms |
| N-02 | Zero per-frame GC allocation in the core loop, verified by profiler assertion in CI |
| N-03 | Cold start to interactive ≤ 4 s; resume from background ≤ 1 s |
| N-04 | Fully playable offline. Ads, Remote Config and analytics degrade silently |
| N-05 | Saves are encrypted at rest, checksummed, versioned, and migrate forward without loss |
| N-06 | A corrupt save is detected and recovered from a backup slot rather than reset |
| N-07 | Install size ≤ 150 MB download |
| N-08 | All player-facing text is externalised to string tables; no text baked into textures |
| N-09 | Ships in EN; ES, PT-BR, DE, FR, TR, RU, JA, KO, ZH-Hans wired and translation-ready |
| N-10 | Playable muted; no information conveyed by audio alone |
| N-11 | No information conveyed by colour alone; icon plus shape for every state |
| N-12 | Safe-area respected on notched and hole-punch displays |
| N-13 | Data collection matches the Play Data Safety declaration exactly |
| N-14 | Consent (GDPR/UMP) is obtained before any personalised ad request |
| N-15 | Crash-free sessions ≥ 99.5% |
| N-16 | No gameplay-affecting value is trusted from the client alone where it gates a purchase |

## 7. MoSCoW for v1

**Must** — core station chain, both channels, joystick avatar, carry stack, cash pickup,
upgrades, staff automation, save/load, offline earnings, three locations, rewarded ads with
consent, No-Ads and gem IAP, analytics taxonomy, EN localisation, Data Safety compliance.

**Should** — Rush Hour, player level and free reward track, daily attendance, starter pack,
interstitials with cap, cloud save, additional languages.

**Could** — season pass, weekly leaderboard, restaurant customisation, seasonal events,
prestige, service-robot helper, skins.

**Won't (v1)** — multiplayer or social features, cross-platform accounts, a server-authored
economy, user-generated content, iOS.

**Open decision — Families track.** Targeting under-13s requires certified ad SDKs,
non-personalised ads only, a neutral age gate, and materially lower ad revenue. Not
targeting them means a teen+ content rating and losing Kid Kim. The code supports both; the
listing must pick one. **This must be decided before the first submission** and is the
single highest-impact commercial decision outstanding.

## 8. User stories

### Core loop

```gherkin
Feature: Serving customers

  Scenario: Serving a counter customer
    Given a customer is waiting at the Counter with an order for 2 items
    And the player is carrying at least 2 finished items
    When the player walks within interaction range of the Counter
    Then 2 items transfer from the carry stack to the customer
    And cash equal to basePrice x priceMultiplier x comboBonus per item drops at the Counter
    And the combo counter increases by 1
    And the customer leaves along the exit path

  Scenario: A customer's patience expires
    Given a customer is waiting with 1 second of patience remaining
    When 1 second passes without the order being filled
    Then the customer leaves without paying
    And the combo counter resets to 0
    And an angry reaction plays above the customer
    And no cash is awarded

  Scenario: The carry stack is full
    Given the player's carry stack is at capacity
    When the player enters range of a station with a finished item ready
    Then no item is picked up
    And the station holds the item in its output buffer
    And a "stack full" indicator shows above the player
```

### Production

```gherkin
Feature: Station production

  Scenario: A station produces while stocked
    Given the Dough station has ingredients and an empty output buffer
    When production time equal to 1 / (baseOutput x stationMultiplier x staffMultiplier) elapses
    Then one unit is added to the output buffer
    And one ingredient is consumed

  Scenario: A station blocks on a full output buffer
    Given a station's output buffer is at capacity
    When production time elapses
    Then no unit is produced
    And the station enters the Blocked state
    And it resumes producing the moment an item is removed

  Scenario: A station runs out of ingredients
    Given the Topping station has zero ingredients
    When the player brings a restock crate within range
    Then ingredients refill to capacity
    And the station returns to Producing
```

### Economy

```gherkin
Feature: Upgrades

  Scenario: Buying an affordable upgrade
    Given the Oven is at level 4 with baseCost 75 and growth 1.12
    And the player holds at least 75 x 1.12^4 cash
    When the player buys the Oven upgrade
    Then that exact cost is deducted
    And the Oven level becomes 5
    And its production multiplier updates immediately
    And an upgrade-purchased event is emitted with id, level and cost

  Scenario: Attempting an unaffordable upgrade
    Given the player holds less cash than the next Oven upgrade costs
    When the player taps the Oven upgrade button
    Then no cash is deducted and the level is unchanged
    And the button shows an insufficient-funds state
    And no purchase event is emitted
```

### Offline earnings

```gherkin
Feature: Offline earnings

  Scenario: Returning within the cap
    Given the player's idle rate is 10 cash per second and the cap is 4 hours
    And the player was away for 1 hour
    When the game resumes
    Then the offline reward is 3600 x 10 x offlineEfficiency
    And a claim popup offers a rewarded ad to double it

  Scenario: Returning after the cap
    Given the cap is 4 hours
    And the player was away for 12 hours
    Then the reward is calculated for exactly 4 hours

  Scenario: The device clock moves backwards
    Given the last save timestamp is later than the current device time
    When the game resumes
    Then the elapsed time is treated as zero
    And no offline reward is granted
    And the save timestamp is repaired to the current time
```

### Ads

```gherkin
Feature: Rewarded ads

  Scenario: Completing a rewarded ad
    Given a rewarded ad is loaded for the offline-doubler placement
    When the player accepts and watches it to completion
    Then the doubled reward is granted exactly once
    And an ad-rewarded-complete event is emitted with the placement

  Scenario: No ad fills
    Given no rewarded ad is available
    When the player opens the offline claim popup
    Then the doubler button is hidden rather than shown failing
    And the base reward remains claimable

  Scenario: The player abandons an ad
    Given a rewarded ad is playing
    When the player closes it before completion
    Then no reward is granted
    And the base reward remains claimable
    And the game returns to its pre-ad state with audio restored
```

### First session

```gherkin
Feature: First-time user experience

  Scenario: A first launch
    Given the game is launched for the first time
    Then no title screen or menu is shown
    And the player is in control inside the first shop within 5 seconds
    And only the joystick and the first station prompt are visible
    And every other UI element stays hidden until its system is unlocked
```

## 9. Definition of Done — Phase 1

- [x] Vision, personas and market position written with design consequences drawn
- [x] KPI targets and UA-scaling gates quantified
- [x] Functional and non-functional requirements enumerated and testable
- [x] MoSCoW agreed for v1
- [x] Acceptance criteria in Gherkin for every core system
- [ ] Families-track decision made — **open, gates first submission**
