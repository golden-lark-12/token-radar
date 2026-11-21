# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/golden-lark-12/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/golden-lark-12/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: a sealed DefiLlama snapshot of 758 protocols, ranked by implied token value, with a costed farm plan for each pre-token protocol.

Built for the make.fun token-radar-01 bounty. The dashboard is a static page (no network) that renders the ranked board, a detail view for every protocol, and filters. `main.ts` (Node 22) reads the snapshot, fits the valuation model to live-token comparables, validates it out of sample, and writes `board.json`, the dashboard data, and the dossier.

## Model

- **Fitted launch pricing** — implied value is a size curve fitted to the 128 live-token comparables in the snapshot (category effects, shrunk toward the global multiple), times a growth carry and the ever-odds. Held out, it misses by a factor of ×3.39 leave-one-out and ×2.96 walk-forward, against a flat multiple's ×5.09 and ×5.33. Every term was kept only if it won both tests; growth and curvature failed and were dropped from the value model.
- **Token odds** — each pre-token protocol's probability of ever issuing a token, fitted by logistic regression on 442 shape-passing peers: age and size raise the odds, growth lowers them. Age enters the odds model only, never the value model.
- **Costed farm verdicts** — every row is priced at its own deposit (0.015% of its TVL, $1,000–$10,000, rounded to $100) with its own gas, a 7% exit drop, and a 4% T-bill alternative. FARM needs a positive net and at least $20/hour; the deposit control re-prices all 198 verdicts live.
- **Full coverage** — the board ranks 198 pre-token protocols, all 40 of the watchlist plus every other rankable pre-token protocol, with a live-token tab for comparison.
- **Honest about error** — the held-out miss is a factor of about three, and the dashboard prints it on the cover next to the controls that beat the flat multiple. The model ranks; it does not price.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/` and `out/dossier.json`. Open `out/dashboard/index.html` in a browser (no network needed). The board is sorted by implied value; click a row for its model breakdown and farm plan, and use the filters to narrow by category, chain, token odds or verdict.
