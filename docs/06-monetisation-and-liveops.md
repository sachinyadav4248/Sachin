# Phase 6 — Monetisation and LiveOps

## 1. The rule everything else follows

**Retention outranks revenue, and the trade is decided in advance.** If raising ad frequency
costs more than 3 points of D1, it is rolled back regardless of what it did to ARPDAU. Ad
density is the most common cause of one-star reviews in this category, and a player who
uninstalls on day one has a lifetime value of whatever they saw before they left.

This is written down here so that it is a decision already made rather than an argument to
be had later, at the point where the ARPDAU number is right in front of somebody.

## 2. Rewarded ads

Rewarded video should be 70–80% of ad revenue. Every placement is **optional**, every one
**pays the player something**, and every one **fails invisibly**.

| Placement | Offer | Where it appears |
| --- | --- | --- |
| `OfflineDoubler` | ×2 the offline reward | The return popup. The first ad most players ever see, and it hands them money |
| `IncomeBoost` | ×2 income for 120 s | HUD button, on a cooldown |
| `InstantRestock` | Refill every supply crate | On the restock prompt, when a station runs dry |
| `FreeStaffTrial` | One hire, free, for 10 minutes | Offered on the wall before the first hire |
| `GemChest` | A small gem grant | Daily, capped |
| `RushHourHeadStart` | Start Rush Hour at ×2 | On the Rush Hour confirm |

`FreeStaffTrial` is the important one. The first hire is the biggest jump in the game and it
sits behind a ten-minute save; letting a player feel it once, free, is both the best advert
for the purchase and the most effective thing available at the first real wall.

If no ad fills, the offer is **hidden**, never shown failing. A doubler button that does
nothing costs more trust than an absent one.

## 3. Interstitials

Deliberately restrained, and off entirely at first.

- **First unlock:** after 60 completed serves. A new player sees no interstitial in their
  first session.
- **Placements:** location transitions, and after N serves.
- **Caps:** at most 6 per hour, minimum 180 s apart, never during Rush Hour, never within
  30 s of app start, never between a serve and its payout.
- All four numbers are Remote Config, so they move without a client release.

## 4. IAP

| SKU | Price | What it does |
| --- | --- | --- |
| No-Ads | $3.99 | Removes interstitials. Rewarded ads remain, because they are opt-in and pay |
| No-Ads + gems | $9.99 | The same plus a gem bundle |
| Gems (four tiers) | $2.99 / $4.99 / $9.99 / $19.99 | |
| Starter pack | $4.99 | Appears at the first substantial wall, around 27 minutes. Once, time-limited |
| Growth pack | $9.99 | Mid-game, around the second location |
| Season pass | $4.99 | Not offered before day 3 |

Receipts are validated server-side before entitlement, and entitlement is re-derived from the
platform's records at every launch. `MetaState.AdFreeCached` is a cache of the store's
answer, never the authority — it lives in a file the player can edit.

Restore purchases is reachable from the settings screen without an account.

## 5. What is not sold

- No purchase that trivialises optimisation. The optimiser persona is the one who stays.
- No paid advantage in the weekly contest. Cosmetics only; a leaderboard that pays out power
  is a different game and a worse one for this audience.
- No randomised paid boxes. Simpler to reason about, and it sidesteps a regulatory question
  that is still moving in several markets.

## 6. Remote Config

| Key | Default | Purpose |
| --- | --- | --- |
| `offline_cap_seconds` | 14400 | Offline accrual cap |
| `offline_efficiency` | 0.5 | Offline rate against active |
| `rewarded_multiplier` | 2.0 | Doubler strength |
| `interstitial_cap_per_hour` | 6 | |
| `interstitial_min_gap_seconds` | 180 | |
| `interstitial_first_unlock_serves` | 60 | Serves before the first interstitial |
| `econ_growth_rate_scale` | 1.0 | Scales every cost curve at once |
| `price_multiplier_scale` | 1.0 | Scales every payout at once |
| `starter_pack_enabled` | true | |
| `rush_hour_enabled` | true | Kill switch |
| `event_id` | "" | Active seasonal event |

Every one has a default that produces a working game, because a fetch that never completes
must be invisible.

`econ_growth_rate_scale` and `rush_hour_enabled` are kill switches as much as tuning knobs:
if the economy ships broken, the first is how it gets survivable without waiting on a store
review.

## 7. A/B tests, in order

1. **Interstitial frequency.** Highest risk to retention, so it goes first while cohorts are
   cheap. Watch D1, not ARPDAU.
2. **Starter pack timing** — at the first wall against a fixed session count.
3. **Offline cap** — 4 h against 8 h. Tests whether the cap drives return visits or just
   annoys.
4. **First-hire pricing.** The simulation puts the first hire at 10.5 minutes; whether that
   is right is a question only real players answer.
5. **FTUE length** — the guided sequence against a shorter one.

One live experiment at a time on the same metric. Two overlapping tests on D1 produce a
result nobody can attribute.

## 8. Event calendar

- **Daily attendance:** escalating rewards, visible streak. Missing a day costs the streak
  position, not the accumulated progress.
- **Weekly Star-Point contest:** points per serve, cosmetic rewards, resets weekly.
- **Seasonal:** themed decor and skins. Cosmetic only — a seasonal economy boost has to be
  taken away again, and taking things away is how goodwill is spent.

## 9. Definition of Done — Phase 6

- [x] Rewarded placements enumerated with the no-fill rule
- [x] Interstitial caps set, and set low
- [x] IAP catalogue defined with server-side validation required
- [x] Remote Config surface fixed, with working defaults and kill switches
- [x] Experiment order set by risk
- [x] The retention/revenue trade decided in advance
- [ ] Store products created — needs a Play Console entry
- [ ] Receipt validation endpoint — not built
- [ ] Mediation configured — needs live keys
