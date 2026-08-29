# Phase 9 — Analytics, Retention and Iteration

## 1. Event taxonomy

Names live in `AnalyticsEvents` and are permanent. Renaming one does not rename its history:
it splits the metric in two and breaks a chart somebody is making decisions from.

| Event | Parameters |
| --- | --- |
| `game_start` | `is_first_launch`, `save_recovered` |
| `session_start` | `session_number`, `seconds_since_last` |
| `session_end` | `duration_seconds`, `orders_served`, `cash_earned` |
| `ftue_step_complete` | `step`, `seconds_since_launch` |
| `order_completed` | `channel`, `items`, `payout`, `combo`, `wait_seconds` |
| `order_abandoned` | `channel`, `items`, `combo_lost` |
| `upgrade_purchased` | `upgrade_id`, `level`, `cost`, `location_index` |
| `staff_hired` | `post_id`, `cost`, `shop_self_running` |
| `level_up` | `level`, `total_earned`, `seconds_since_launch` |
| `location_unlocked` | `location_index`, `cost`, `seconds_since_launch` |
| `currency_earned` | `type`, `amount`, `source` |
| `currency_spent` | `type`, `amount`, `sink` |
| `offline_claimed` | `amount`, `doubled`, `away_seconds`, `was_capped` |
| `rush_hour_started` | `trigger`, `player_level` |
| `rush_hour_ended` | `earned`, `best_combo`, `orders_served` |
| `ad_impression` | `placement`, `format`, `network`, `ecpm` |
| `ad_rewarded_complete` | `placement`, `reward_granted` |
| `ad_no_fill` | `placement`, `format` |
| `iap_purchase` | `sku`, `price`, `currency`, `player_level`, `seconds_since_install` |
| `save_recovered` | `reason` |

`seconds_since_launch` appears on the progression events on purpose: it is what turns the
simulated pacing in `data/balance/REPORT.md` into a measured one. The simulation predicts a
first hire at 10.5 minutes; `staff_hired` is how anyone finds out what it really is.

`ad_no_fill` matters more than it looks. A placement that never fills is invisible in an
impression-based dashboard — it simply shows fewer impressions — and it is the difference
between a badly sited placement and one that is never offered at all.

## 2. Funnels

1. **FTUE:** launch → first item → first serve → first cash collected → first upgrade →
   first level-up. Drop-off before the first serve is a control problem; drop-off before the
   first upgrade is a pacing problem.
2. **First hire:** first upgrade → first wall → hire offered → hire afforded. The simulation
   says this stretch is 10 minutes.
3. **First ad:** offline popup shown → doubler offered → accepted → completed → granted. The
   gap between offered and accepted is the placement's real conversion.
4. **First purchase:** wall reached → offer shown → store opened → purchased.
5. **Second location:** the long one, and the one most likely to leak.

## 3. What to watch, in priority order

1. **D1.** Everything else is downstream. Segment by FTUE completion.
2. **Rewarded engagement.** Below 25% of DAU, a placement is badly sited, not unpopular.
3. **Time to first hire.** Against the simulated 10.5 minutes. A large gap means the model's
   assumptions are wrong and the balance tooling needs recalibrating from telemetry.
4. **Wall durations.** Especially the 8-hour save for the third location, which is the
   riskiest stretch in the game.
5. **Crash-free sessions**, then **`save_recovered` rate** — a rise in the latter is a
   corruption bug, and it is otherwise silent.
6. **ARPDAU**, last, and never at the expense of the first.

## 4. Feeding telemetry back into the balance model

The simulation's assumptions — `attention_efficiency`, `average_combo`, `counter_share` — are
guesses. They are the least trustworthy numbers in the project and they are labelled as such
in `config.py`.

Once telemetry exists, each has a direct measurement: `counter_share` from `order_completed`,
`average_combo` from the same, `attention_efficiency` from observed throughput against the
theoretical chain minimum. Replacing them and regenerating turns the balance report from a
prediction into a model that has been checked against reality — at which point the pacing
tests in CI start guarding something real.

This is the highest-value thing to do in the first month after soft launch, and it is easy to
never get to.

## 5. The known content problem

The simulation exhausts every purchase in v1 at **19.5 hours of active play** — roughly six
weeks at 25 minutes a day, or under three at 45. That is enough to reach the D30 target and
not much beyond it.

Watch the tail of the level distribution. When a visible cohort reaches the end of the
content, a fourth location or the prestige system needs to already exist. Which of the two
is a roadmap decision, not a balance one, and it wants making before the data forces it.

## 6. Definition of Done — Phase 9

- [x] Event names and parameters fixed and mirrored in code
- [x] Funnels defined against the design's own claims
- [x] Metric priority set, with D1 first and ARPDAU last
- [x] A route from telemetry back into the balance model
- [x] The content-exhaustion risk given a monitoring signal
- [ ] Events wired to a provider — only the interface exists
- [ ] Dashboards — no data
