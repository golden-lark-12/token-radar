# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/golden-lark-12/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/golden-lark-12/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: a sealed DefiLlama snapshot of 758 protocols, ranked by implied token value, with a farm plan for each pre-token protocol.

Built for the make.fun token-radar-01 bounty. The dashboard is a static page (no network) that renders the ranked board, a detail view for every protocol, and filters. `main.ts` (Node 22) reads the snapshot, fits the valuation model to live-token comparables, validates it out of sample, and writes `board.json`, the dashboard data, and the dossier.

## Model

- **Fitted launch pricing** — implied value is TVL times a multiple fitted to the 144 live-token comparables in the snapshot, shrunk by category toward the global median (0.214x), not a flat guess. The fit is shown on the dashboard with its held-out error.
- **Token odds** — each pre-token protocol's probability of ever issuing a token, from its peers' record: the share of same-category protocols that have a token, adjusted by TVL band and by age. Age is the strongest signal.
- **Costed farm verdicts** — every row carries a farm plan with real costs (deposit size, gas, hold time) and a verdict (farm / thin / skip) netted to the dollar, derived from the protocol's category, chains, TVL and age.
- **Full coverage** — the board ranks 198 pre-token protocols, all 40 of the watchlist plus every other rankable pre-token protocol, with a live-token tab for comparison.
- **Honest about error** — the held-out median absolute percentage error is 98.8% (baseline 87-99%). The model ranks; it does not price. The dashboard says so on the page.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/` and `out/dossier.json`. Open `out/dashboard/index.html` in a browser (no network needed). The board is sorted by implied value; click a row for its model breakdown and farm plan, and use the filters to narrow by category, chain, token odds or verdict.
