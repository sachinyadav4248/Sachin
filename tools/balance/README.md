# Balance tooling

The economy is specified once, here, in Python — and ported to C#. The two implementations
are held together by `data/balance/golden_values.json`, which this tool generates and the
Unity edit-mode tests assert against.

## Running

```sh
python3 -m unittest discover -v   # economy unit tests + balance regression tests
python3 generate_tables.py        # regenerate data/balance/
```

No dependencies beyond the standard library.

## Files

| File | Role |
| --- | --- |
| `economy.py` | The formulas. Pure functions, no state, no clock, no I/O |
| `config.py` | Every tunable number in the game, plus the pacing targets |
| `simulate.py` | Models a session: what gets bought, when, and where players stall |
| `generate_tables.py` | Writes the CSVs, the golden values and the balance report |
| `test_economy.py` | Properties the game depends on — bulk buys never overcharge, time is never invented |
| `test_simulate.py` | Asserts the simulated pacing against `config.PACING` |

## Changing balance

1. Edit `config.py`. Nothing else should contain a balance literal.
2. `python3 -m unittest discover` — the pacing tests fail if the change breaks the curve.
3. `python3 generate_tables.py`.
4. Commit `config.py` and the regenerated `data/balance/` together. Generation is
   deterministic, so any diff there is a real balance change and reviews as one.

## What the simulation is for

It answers questions the spreadsheet cannot: when does the first hire become affordable, how
long is the save before the third location, does income plateau or run away, is there enough
content to reach day 30. It has already changed the design twice — it showed that the Oven
is not the early bottleneck (the player's own hands are), and that without a demand ceiling
income reaches 470,000/sec within six hours.

It is a tuning aid, not a forecast. Its assumptions about player behaviour are listed at the
top of `simulate.py` and in the generated report, and every one of them should be replaced
with a measured value once a build produces telemetry.
