# Token Radar

A token launch radar: a sealed DefiLlama snapshot of 758 protocols, ranked by implied token value, with a farm plan for each pre-token protocol.

Built for the make.fun token-radar-01 bounty. The dashboard is a static page (no network) that renders the ranked board, a detail view for every protocol, and filters. `main.ts` (Node 22) reads the snapshot, fits the valuation model to live-token comparables, validates it out of sample, and writes `board.json`, the dashboard data, and the dossier.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

## Model

Implied value is fitted, not assumed: market cap is regressed on TVL by category from the live-token protocols in the snapshot, the fit is tested held-out, and each pre-token protocol gets a token-odds estimate from its peers' record. See the dashboard's model panel for the fitted multiples and the held-out error.
