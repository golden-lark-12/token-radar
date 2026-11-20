// The token radar's fitted model (radar-5): one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every rankable pre-token protocol: the snapshot's watchlist (the floor,
// never a ceiling) plus every other pre-token protocol that is not a CEX and not a versioned
// pool. A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as
// the market's own values, never mixed into the ranked board.
//
// VALUE — fitted, then adjusted by ONE stated projection. This is the v4 rebuild after
// v3 (radar-4, 80.38%) sat 3.7 points below v1 (radar-2, 84.05%). The three top entries
// all score ~96% and disagree about growth: one leaves growth and age out entirely, two
// keep them as a momentum/carry term. Growth in or out is NOT what separates winners,
// so v4 keeps growth and age OUT of the fitted curve and adds only a bounded carry:
//
//   VALUE IF IT LAUNCHES — a size curve plus a category effect.
//   log(mcap) = 6.9646 + 0.5223 x log(TVL) + category_effect
//   Fitted by least squares on the 128 live-token protocols with a positive recorded market
//   cap (144 record one; 16 are zero or negative and cannot enter a log fit). The category
//   effect is the shrunk mean of the OLS residuals in the category: each residual clipped
//   to +/-1.0 log point, averaged, shrunk by n/(n+10) toward 0, capped at +/-1.0 log point.
//   The stronger shrinkage is the held-out winner: leave-one-out miss x3.39 against x3.94
//   for v3's n/(n+5), +/-2.0 shrinkage, and x3.40 for the size curve alone. Walk-forward
//   (older-listed -> newer-listed) miss x2.96. The flat median multiple misses x5.09.
//   Bootstrap (200 resamples) standard errors: const 1.55, log-TVL slope 0.085.
//   Every term was run through the held-out test (leave-one-out AND older -> newer) and
//   the page's evidence table reports which were kept and which failed — see heldOutTests.
//   Growth and age FITTED in the value both fail (LOO x4.08 and x4.06); a curvature term
//   in log TVL ties on LOO and is not kept. The 3.3 LOO target was NOT met (best 3.39);
//   the walk-forward miss is below it (2.96). Ranges: the value-model residuals bound
//   if-launches and implied. The board prints the MIDDLE-50% range (P25-P75, about 12x
//   wide; 50.8% of live comps fall inside their own, target 50%). The detail view also
//   prints the wide P10-P90 range (about 123x; 79.7% inside, target 80%). A 130x range
//   on the board reads as no skill, so the tight calibrated interval is the board's range
//   and the wide one is shown, labelled, in the detail view. Rank ranges come from 20
//   bootstrap refits of this value model (odds fixed).
//
//   GROWTH CARRY — a stated projection, 1 + 0.01 x clip(change_7d, -25, +25), null as 0.
//   A grower is worth up to 1.25x a flat protocol with the same TVL and category; a
//   crasher down to 0.75x. It is NOT fitted: fitting growth is what inverted v2 (a
//   -2.8915 coefficient ranked crashers as the best farms). Age is not in the value at
//   all: it appears as a data column and in the held-out test table, where it fails.
//
//   implied = if_launches x growth_carry x token_odds
//
//   TOKEN ODDS — a logistic regression on all 758 protocols, P(launches its OWN token).
//   logit = 0.1959 + 0.1682 x z(log TVL) + 0.4281 x z(log age)
//           + category_effect - 2.5 x family_child, z-standardised (means/sds in MODEL).
//   Age is floored at 365 days before the log: below one year, listing age carries no
//   further "has had time to launch" signal, so a 56-day-old grower is not punished for
//   being young. Category effects are ridge-shrunk (penalty 16); slopes carry a 0.1 ridge.
//   Growth is NOT in the odds: the fitted growth term (-0.2668) rewarded crashers — a
//   protocol down 72.7% in 7 days scored odds 0.72 and a FARM verdict. With the term
//   dropped, odds reward size and age only. FAMILY_CHILD is 1 when another protocol in
//   the same family (same first slug segment) already has a token and this protocol either
//   carries that token's symbol or has no symbol — a versioned deployment (aave-v3,
//   quickswap-v3) that will not launch its own token. The snapshot records a token symbol
//   for such deployments (aave-v3 carries AAVE), so the raw "records a symbol" flag
//   overstates them; the odds target is OWN-token launch and the Brier is scored against
//   it. The 2.5-point penalty is tuned on the walk-forward Brier against that flag:
//   in-sample 0.2168 -> 0.2085, walk-forward 0.2180 -> 0.2127; the curve is flat from 2.0
//   to 3.0 and 2.5 is the smallest penalty that moves the largest family child (aave-v3,
//   0.88 -> 0.38) below the FARM threshold. The Brier reported is the in-sample Brier
//   of the shipped odds model, computed from the snapshot at build time (see buildRadar).
//   implied = max(1, round(if_launches x growth_carry x token_odds))
//
//   CRASH GUARD — the verdict, not the value. A protocol down 15% or more in 7 days can
//   never be FARM (capped at thin); down 30% or more is SKIP, whatever the odds say.
//   The guard's reason is shown on the row ("TVL -72.7% in 7d").
//
//   NET — information, NOT the verdict. Slice = implied x 7% x ($1,000 / TVL); gas is the
//   chain's farm-run gas; forgone yield = $1,000 x 4% x (hold_days / 365). Net = slice -
//   gas - forgone yield. Net/hour divides by the farm plan's time (0.25h setup + 10 min a
//   week over the hold + 10 min to claim). Break-even ticket is the ticket size at which
//   the net is $0 (null when the slice per dollar is below the T-bill rate, so no ticket
//   pays); break-even odds is the token odds needed for a $1,000 ticket to break even
//   (null when above 0.95). The verdict stays ODDS-BASED (v1's direction): farm if odds
//   >= 0.5, thin if >= 0.3, else skip — then the crash guard caps it. A negative net
//   never flips a farm to a skip. Top rows may be SKIP with a negative net: that is what
//   the odds say, and the board shows the farm plan for the row, not the net.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  global_median: number;
  value_const: number;
  value_log_tvl: number;
  value_resid_p10: number;
  value_resid_p25: number;
  value_resid_p75: number;
  value_resid_p90: number;
  value_clip: number;
  value_shrink_prior: number;
  value_effect_cap: number;
  odds_const: number;
  odds_log_tvl: number;
  odds_log_age: number;
  odds_family_penalty: number;
  odds_mu_log_tvl: number;
  odds_mu_log_age: number;
  odds_sd_log_tvl: number;
  odds_sd_log_age: number;
  odds_age_floor_days: number;
  unknown_age_days: number;
  odds_floor: number;
  odds_cap: number;
  drop_share: number;
  ticket_usd: number;
  tbill_rate: number;
  setup_hours: number;
  weekly_hours: number;
  claim_hours: number;
}

export const MODEL: ModelConstants = {
  global_median: 0.2138,
  value_const: 6.9646,
  value_log_tvl: 0.5223,
  value_resid_p10: -2.7116,
  value_resid_p25: -1.0938,
  value_resid_p75: 1.3710,
  value_resid_p90: 2.0969,
  value_clip: 1.0,
  value_shrink_prior: 10,
  value_effect_cap: 1.0,
  odds_const: 0.1959,
  odds_log_tvl: 0.1682,
  odds_log_age: 0.4281,
  odds_family_penalty: 2.5,
  odds_mu_log_tvl: 17.7347,
  odds_mu_log_age: 6.441,
  odds_sd_log_tvl: 1.8078,
  odds_sd_log_age: 0.5433,
  odds_age_floor_days: 365,
  unknown_age_days: 365,
  odds_floor: 0.05,
  odds_cap: 0.95,
  drop_share: 0.07,
  ticket_usd: 1000,
  tbill_rate: 0.04,
  setup_hours: 0.25,
  weekly_hours: 0.1667,
  claim_hours: 0.1667,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-5';

/** The value model's category effect (log points): shrunk mean of the clipped OLS
 *  residuals in the category, each residual clipped to +/-1.0, averaged, shrunk by
 *  n/(n+10) toward 0, capped at +/-1.0. Categories with no live comps get 0. Source: the
 *  snapshot's 128 positive-market-cap live protocols. The stronger shrinkage is the
 *  held-out winner (leave-one-out miss x3.39 vs x3.94 for the old n/(n+5), +/-2.0).
 *  Prediction Market (+0.0909) rests on one comp (Rain, mcap/TVL 400x); its residual was
 *  clipped to +1.0 before shrinking, so the single outlier cannot set the effect alone. */
export const VALUE_EFFECT: Record<string, number> = {
  'AI Agents': -0.0005,
  'Basis Trading': 0.1872,
  'Bridge': 0.1256,
  'CDP': -0.1126,
  'CEX': 0.1373,
  'Canonical Bridge': 0.2432,
  'Chain': 0.0909,
  'Collateral Management': 0.0909,
  'Cross Chain Bridge': 0.0852,
  'DOR': -0.0803,
  'Decentralized AI': 0.0909,
  'Derivatives': 0.1509,
  'Dexs': 0.0567,
  'Dual-Token Stablecoin': -0.0909,
  'Indexes': -0.0769,
  'Launchpad': -0.004,
  'Lending': -0.1612,
  'Leveraged Farming': -0.0016,
  'Liquid Restaking': -0.0251,
  'Liquid Staking': -0.2496,
  'Liquidity Manager': -0.0909,
  'NFT Marketplace': 0.0909,
  'Onchain Capital Allocator': -0.1647,
  'Options': 0.0909,
  'Payments': -0.1667,
  'Prediction Market': 0.0909,
  'Privacy': 0.1044,
  'RWA': 0.0806,
  'Restaking': -0.0312,
  'Risk Curators': 0.0909,
  'Staking Pool': -0.1667,
  'Token Locker': 0,
  'Yield': -0.0588,
  'Yield Aggregator': -0.1741,
};

/** The odds model's category effect (logit points): ridge-shrunk (penalty 16) dummy
 *  coefficients from the logistic fit on all 758 protocols. Categories not listed get 0.
 *  Dexs (+0.573) and Lending (+0.5125) lift their protocols; Risk Curators (-0.5118)
 *  reflects that only ~13% of the young curator category records a token yet. */
export const ODDS_EFFECT: Record<string, number> = {
  'AI Agents': 0.047,
  'Algo-Stables': 0.073,
  'Anchor BTC': -0.0274,
  'Basis Trading': 0.1553,
  'Bridge': -0.1952,
  'CDP': -0.0511,
  'CDP Manager': -0.0179,
  'CEX': -0.7128,
  'Canonical Bridge': 0.0708,
  'CeDeFi': -0.0465,
  'Chain': -0.0796,
  'Collateral Management': 0.0295,
  'Collateral Markets': -0.0423,
  'Cross Chain Bridge': 0.1132,
  'Crypto Card Issuer': 0.0064,
  'DOR': 0.0223,
  'Decentralized AI': 0.0329,
  'Decentralized BTC': -0.0497,
  'Derivatives': 0.0125,
  'Dexs': 0.573,
  'Dual-Token Stablecoin': -0.0219,
  'Farm': -0.0491,
  'Governance Incentives': -0.0114,
  'Indexes': 0.1191,
  'Insurance': 0.0006,
  'Interest Rate Derivatives': -0.029,
  'Launchpad': 0.0977,
  'Lending': 0.5125,
  'Leveraged Farming': 0.0482,
  'Liquid Restaking': -0.0007,
  'Liquid Staking': -0.2327,
  'Liquidity Manager': 0.0378,
  'NFT Marketplace': 0.0146,
  'OTC Marketplace': -0.0274,
  'Onchain Capital Allocator': -0.2625,
  'Options': 0.085,
  'Options Vault': -0.031,
  'Payments': 0.0061,
  'Prediction Market': -0.0454,
  'Privacy': 0.0421,
  'RWA': -0.0049,
  'Reserve Currency': 0.0166,
  'Restaked BTC': -0.0494,
  'Restaking': 0.0164,
  'Risk Curators': -0.5118,
  'Stablecoin Issuer': 0.0269,
  'Stablecoin Wrapper': -0.0512,
  'Staking Pool': -0.0742,
  'Synthetics': 0.0865,
  'Token Locker': 0.0918,
  'Uncollateralized Lending': -0.0138,
  'Yield': 0.1756,
  'Yield Aggregator': 0.1254,
};

/** The held-out validation the dashboard reports. Value model: leave-one-out and
 *  older-listed -> newer-listed (walk-forward) on the 128 positive-market-cap live
 *  protocols; the flat-median baseline is the same test on a single global mcap/TVL
 *  multiple. The term-by-term table is computed from the snapshot at build time by
 *  heldOutTests — the numbers below are the shipped model's summary, and the table in
 *  fit_terms carries every variant. Odds model: in-sample Brier on all 758 protocols
 *  against the own-token-launch flag (see tokenOdds), plus the walk-forward Brier;
 *  both are computed at build time in buildRadar. */
export const FIT = {
  n_live: 128,
  n_live_total: 144,
  median_multiple: 0.2138,
  value_const: 6.9646,
  value_log_tvl: 0.5223,
  value_const_se: 1.55,
  value_log_tvl_se: 0.085,
  loo_miss: 3.39,
  loo_medape: 86.1,
  wf_miss: 2.96,
  wf_medape: 89.0,
  heldout_medape_range: 'walk-forward miss x2.96, leave-one-out x3.39',
  baseline_medape: '88.3%',
  baseline_miss: 5.09,
  resid_p10_mult: 0.066,
  resid_p25_mult: 0.335,
  resid_p75_mult: 3.939,
  resid_p90_mult: 8.141,
  odds_brier_in_sample: 0,
  odds_brier_wf: 0,
  odds_brier_base: 0,
  range_mid50_calib: 0,
  range_p10p90_calib: 0,
  note: 'This model ranks; it does not price. Implied values are order-of-magnitude scores with ~3.4x typical held-out error. Growth enters the value only as a stated carry (1 + 0.01xclip(7d, -25, +25)), never fitted; age is not in the value. The odds model has no growth term: the fitted one (-0.2668) rewarded crashers. The Brier is the in-sample Brier of the shipped odds model against the own-token-launch flag, computed from the snapshot at build time.',
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The net of farming one protocol on the default ticket: slice, gas, forgone T-bill
 *  yield, net, net per hour, and the two break-evens (null when no ticket / no odds
 *  below 0.95 pays). The net is information; the verdict is odds-based. */
export interface NetInfo {
  hold_days: number;
  hours: number;
  slice_usd: number;
  gas_usd: number;
  tbill_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_ticket_usd: number | null;
  break_even_odds: number | null;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  if_launches_usd: number;
  if_launches_p10_usd: number;
  if_launches_p25_usd: number;
  if_launches_p75_usd: number;
  if_launches_p90_usd: number;
  implied_p10_usd: number;
  implied_p25_usd: number;
  implied_p75_usd: number;
  implied_p90_usd: number;
  rank_min: number;
  rank_max: number;
  net_usd: number;
  net_per_hour_usd: number;
  slice_usd: number;
  tbill_usd: number;
  hold_days: number;
  break_even_ticket_usd: number | null;
  break_even_odds: number | null;
  model: {
    fitted_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    token_odds: number;
    age_days: number | null;
    if_launches_usd: number;
    category_effect: number;
    family_child: boolean;
  };
  verdict: 'farm' | 'thin' | 'skip';
  guard_reason: string | null;
  farm_cost_usd: number;
  farm_gas_usd: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan as structured steps. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  if_launches_usd: number;
  if_launches_p10_usd: number;
  if_launches_p25_usd: number;
  if_launches_p75_usd: number;
  if_launches_p90_usd: number;
  implied_p10_usd: number;
  implied_p25_usd: number;
  implied_p75_usd: number;
  implied_p90_usd: number;
  rank_min: number;
  rank_max: number;
  net_usd: number;
  net_per_hour_usd: number;
  slice_usd: number;
  tbill_usd: number;
  hold_days: number;
  break_even_ticket_usd: number | null;
  break_even_odds: number | null;
  category_effect: number;
  fitted_multiple: number;
  growth_multiplier: number;
  token_odds: number;
  family_child: boolean;
  verdict: 'farm' | 'thin' | 'skip';
  guard_reason: string | null;
  farm_cost_usd: number;
  farm_gas_usd: number;
  farm_steps: FarmStep[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One group of the protocol accounting ledger: every snapshot protocol in exactly one group. */
export interface LedgerGroup {
  key: string;
  label: string;
  count: number;
  note: string;
}

/** One term of the out-of-sample evidence table, computed from the snapshot at build
 *  time by heldOutTests. loo_miss / wf_miss are the median multiplicative errors
 *  (leave-one-out, and older-listed -> newer-listed walk-forward); the medape fields
 *  are the median absolute percentage errors on the same held-out sets. A null miss
 *  means the term is a stated projection, not a fitted term, so no held-out number is
 *  claimed for it. */
export interface FitTerm {
  term: string;
  loo_miss: number | null;
  loo_medape: number | null;
  wf_miss: number | null;
  wf_medape: number | null;
  kept: boolean;
  note: string;
}

/** Everything the dashboard needs: the board, the live set, the ledger and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: typeof FIT;
  fit_terms: FitTerm[];
  ledger: LedgerGroup[];
  ledger_total: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The value model's category effect (log points), 0 for categories with no live comps. */
export function valueEffect(category: string | null): number {
  if (category === null) return 0;
  return VALUE_EFFECT[category] ?? 0;
}

/** The odds model's category effect (logit points), 0 for categories the fit never saw. */
export function oddsEffect(category: string | null): number {
  if (category === null) return 0;
  return ODDS_EFFECT[category] ?? 0;
}

/** The value if a protocol launches: exp(a + b x log(TVL) + category effect). Growth and
 *  age do not enter: the same protocol at +50% and at -50% 7d growth gets the same value. */
export function ifLaunches(protocol: SnapshotProtocol, model: ModelConstants = MODEL): number {
  return Math.exp(model.value_const + model.value_log_tvl * Math.log(Math.max(1, protocol.tvl_usd)) + valueEffect(protocol.category));
}

/** The family of a protocol: protocols sharing its first slug segment (aave-v3 and
 *  aave-v2, quickswap-v3 and quickswap-dex). A protocol is a FAMILY CHILD when another
 *  member of its family already has a token (positive market cap) and this protocol
 *  either carries that token's symbol or has no symbol — a versioned deployment that
 *  will not launch its own token. A sibling with a DIFFERENT symbol (yield-basis YB
 *  vs yield-yak YAK) is a different project, not a child. */
export function familyChildSlugs(snapshot: Snapshot): Set<string> {
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    const key = p.slug.split('-')[0];
    const g = groups.get(key);
    if (g) g.push(p); else groups.set(key, [p]);
  }
  const children = new Set<string>();
  for (const p of snapshot.protocols) {
    const g = groups.get(p.slug.split('-')[0]) || [];
    const isChild = g.some((q) => q !== p && q.mcap_usd !== null && q.mcap_usd > 0 && (p.symbol === null || p.symbol === undefined || p.symbol === q.symbol));
    if (isChild) children.add(p.slug);
  }
  return children;
}

/** Whether a protocol launches its OWN token (the odds target): it records a symbol
 *  and is not a family child. Versioned deployments record the parent's symbol
 *  (aave-v3 carries AAVE), so the raw "records a symbol" flag overstates them. */
export function ownsToken(p: SnapshotProtocol, familyChildren: Set<string>): boolean {
  return p.symbol !== null && p.symbol !== undefined && !familyChildren.has(p.slug);
}

/** A protocol's token odds: the logistic fit on standardised log TVL and log age (floored
 *  at 365 days, so the young are not punished for being young), plus the category effect,
 *  minus the family penalty for a family child, clipped to [0.05, 0.95]. Growth is NOT
 *  a term: the fitted growth coefficient (-0.2668) rewarded crashers, so it was dropped,
 *  not refitted with the wrong sign. */
export function tokenOdds(p: SnapshotProtocol, age: number | null, model: ModelConstants = MODEL, familyChild = false): number {
  const ageForOdds = age === null ? model.unknown_age_days : Math.max(age, model.odds_age_floor_days);
  const zTvl = (Math.log(Math.max(1, p.tvl_usd)) - model.odds_mu_log_tvl) / model.odds_sd_log_tvl;
  const zAge = (Math.log(ageForOdds) - model.odds_mu_log_age) / model.odds_sd_log_age;
  let logit = model.odds_const + model.odds_log_tvl * zTvl + model.odds_log_age * zAge + oddsEffect(p.category);
  if (familyChild) logit -= model.odds_family_penalty;
  const odds = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, logit))));
  return Math.min(model.odds_cap, Math.max(model.odds_floor, odds));
}

/** The growth carry: a stated projection, 1 + 0.01 x clip(change_7d, -25, +25); a null
 *  7d change counts as 0. A grower is worth up to 1.25x a flat protocol with the same TVL
 *  and category; a crasher down to 0.75x. It is NOT fitted: fitting growth inverted v2,
 *  and the held-out test says a fitted growth term does not help (LOO x4.08 vs x3.39). */
export function growthCarry(change7d: number | null): number {
  const g = change7d === null ? 0 : Math.min(25, Math.max(-25, change7d));
  return 1 + 0.01 * g;
}

/** The multipliers and the implied value one protocol gets.
 *  implied = if_launches x growth_carry x token_odds, so the dashboard's detail view
 *  recomputes it as TVL x fitted multiple x growth carry x odds. fitted_multiple is the
 *  EFFECTIVE multiple (if-launches / TVL). Age is not in the value. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL, familyChild = false): { implied: number; ifLaunches: number; growthPct: number; growthMult: number; age: number | null; multiple: number; odds: number; categoryEffect: number; familyChild: boolean } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(25, Math.max(-25, finite(protocol.change_7d, 0)));
  const growthMult = growthCarry(protocol.change_7d);
  const launches = ifLaunches(protocol, model);
  const odds = tokenOdds(protocol, age, model, familyChild);
  const multiple = protocol.tvl_usd > 0 ? launches / protocol.tvl_usd : 0;
  const implied = Math.max(1, Math.round(launches * growthMult * odds));
  return { implied, ifLaunches: launches, growthPct, growthMult, age, multiple, odds, categoryEffect: valueEffect(protocol.category), familyChild };
}

/** --- Held-out tests, computed from the snapshot at build time. --- */

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) throw new Error('singular fit');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** Least squares for y ~ X (rows of regressors), with optional weights. */
function leastSquares(X: number[][], y: number[], w?: number[]): number[] {
  const k = X[0]!.length;
  const A: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const b: number[] = Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    const wi = w ? w[i]! : 1;
    for (let a = 0; a < k; a++) {
      b[a]! += wi * X[i]![a]! * y[i]!;
      for (let c = 0; c < k; c++) A[a]![c]! += wi * X[i]![a]! * X[i]![c]!;
    }
  }
  return solveLinear(A, b);
}

/** Options for one value-model variant in the held-out test. */
interface ValueVariant {
  growth: boolean;
  age: boolean;
  family: boolean;
  quad: boolean;
  catOff: boolean;
  shrinkK: number;
  clip: number;
}

/** The two-stage value fit on a set of live comps, with optional extra regressors.
 *  Stage 1: OLS log(mcap) ~ 1 + log(TVL) [+ growth + age + curvature]; stage 2: the
 *  category effect as the shrunk mean of the clipped residuals. The family term, when
 *  on, is the shrunk mean residual of the family children, capped at a down-weight.
 *  This is the same procedure the hardcoded constants came from, so a fit on the full
 *  set with the kept options reproduces them. */
function fitValueVariant(train: SnapshotProtocol[], asOf: string, familyChildren: Set<string>, opts: ValueVariant): (p: SnapshotProtocol) => number {
  const design = (p: SnapshotProtocol): number[] => {
    const row = [1, Math.log(Math.max(1, p.tvl_usd))];
    if (opts.quad) row.push(Math.pow(Math.log(Math.max(1, p.tvl_usd)), 2) / 10);
    if (opts.growth) row.push(Math.min(30, Math.max(-30, p.change_7d === null ? 0 : p.change_7d)) / 100);
    if (opts.age) row.push(Math.log(Math.max(1, ageDays(asOf, p.listed_at) ?? 365)));
    return row;
  };
  const X = train.map(design);
  const y = train.map((p) => Math.log(p.mcap_usd as number));
  const beta = leastSquares(X, y);
  const residByCat = new Map<string, number[]>();
  train.forEach((p, i) => {
    const pred = X[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0);
    const key = p.category ?? '';
    const arr = residByCat.get(key) ?? [];
    arr.push(y[i]! - pred);
    residByCat.set(key, arr);
  });
  const catEff = new Map<string, number>();
  if (!opts.catOff) {
    for (const [key, rs] of residByCat) {
      const clipped = rs.map((r) => Math.min(opts.clip, Math.max(-opts.clip, r)));
      const mean = clipped.reduce((a, b) => a + b, 0) / clipped.length;
      catEff.set(key, Math.min(1.0, Math.max(-1.0, mean * (clipped.length / (clipped.length + opts.shrinkK)))));
    }
  }
  let famCoef = 0;
  if (opts.family) {
    const fr: number[] = [];
    train.forEach((p, i) => {
      if (!familyChildren.has(p.slug)) return;
      const pred = X[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0);
      fr.push(Math.min(opts.clip, Math.max(-opts.clip, y[i]! - pred)));
    });
    if (fr.length > 0) {
      const mean = fr.reduce((a, b) => a + b, 0) / fr.length;
      famCoef = Math.min(0, Math.max(-1.5, mean * (fr.length / (fr.length + 5))));
    }
  }
  return (p: SnapshotProtocol): number => {
    let v = design(p).reduce((acc, vv, j) => acc + vv * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0);
    if (opts.family && familyChildren.has(p.slug)) v += famCoef;
    return Math.exp(v);
  };
}

/** The median multiplicative error and median absolute percentage error of predictions. */
function heldOutAgg(pairs: [number, number][]): { miss: number; medape: number } {
  const logErr = pairs.map(([pr, ac]) => Math.abs(Math.log(pr / ac))).sort((a, b) => a - b);
  const ape = pairs.map(([pr, ac]) => Math.abs(pr - ac) / ac).sort((a, b) => a - b);
  const mid = Math.floor(pairs.length / 2);
  return { miss: Math.exp(logErr[mid]!), medape: ape[mid]! };
}

/** The term-by-term held-out test: leave-one-out AND older-listed -> newer-listed
 *  (walk-forward) on the 128 positive-market-cap live protocols. Each variant is
 *  refitted from scratch on the training set, so the numbers are honest out-of-sample
 *  errors, not in-sample fits. The growth carry is a stated projection, not a fitted
 *  term, so it carries no held-out number. */
export function heldOutTests(snapshot: Snapshot, model: ModelConstants = MODEL): FitTerm[] {
  const comps = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const familyChildren = familyChildSlugs(snapshot);
  const dated = comps.filter((p) => p.listed_at).sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const split = Math.floor(dated.length / 2);
  const older = dated.slice(0, split);
  const newer = dated.slice(split);
  const medianOf = (xs: number[]): number => {
    const t = [...xs].sort((a, b) => a - b);
    return t[Math.floor(t.length / 2)]!;
  };
  const flatPredict = (train: SnapshotProtocol[]) => {
    const med = medianOf(train.map((p) => (p.mcap_usd as number) / p.tvl_usd));
    return (p: SnapshotProtocol): number => med * p.tvl_usd;
  };
  const loo = (predict: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): { miss: number; medape: number } => {
    const pairs: [number, number][] = [];
    for (let i = 0; i < comps.length; i++) {
      const train = comps.filter((_, j) => j !== i);
      pairs.push([predict(train)(comps[i]!), comps[i]!.mcap_usd as number]);
    }
    return heldOutAgg(pairs);
  };
  const wf = (predict: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): { miss: number; medape: number } => {
    const f = predict(older);
    return heldOutAgg(newer.map((p) => [f(p), p.mcap_usd as number] as [number, number]));
  };
  const variant = (opts: ValueVariant): ((train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number) =>
    (train) => fitValueVariant(train, snapshot.as_of, familyChildren, opts);
  const kept: ValueVariant = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: model.value_shrink_prior, clip: model.value_clip };
  const v3: ValueVariant = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: 5, clip: 2.0 };
  const rows: { name: string; make: ((train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number) | null; kept: boolean; note: string }[] = [
    { name: 'flat median multiple (baseline)', make: flatPredict, kept: false, note: 'one global mcap/TVL multiple; the baseline every term must beat' },
    { name: 'size curve only, log TVL', make: variant({ ...kept, catOff: true }), kept: false, note: 'no category effect; the category term adds nothing held-out over this' },
    { name: 'size + category, v3 shrinkage (n/(n+5), ±2.0)', make: variant(v3), kept: false, note: 'v3 as shipped; superseded by the stronger shrinkage below' },
    { name: 'size + category, kept shrinkage (n/(n+10), ±1.0)', make: variant(kept), kept: true, note: 'the shipped model; best leave-one-out miss of the category variants' },
    { name: '+ growth, fitted in the value', make: variant({ ...kept, growth: true }), kept: false, note: 'FAILED: fitting growth hurts held-out (v2 inverted the same way)' },
    { name: '+ age, fitted in the value', make: variant({ ...kept, age: true }), kept: false, note: 'FAILED: age in the value hurts held-out; age stays a data column only' },
    { name: '+ family effect, in the value', make: variant({ ...kept, family: true }), kept: false, note: 'no held-out effect on the value (2 family comps); the family term lives in the odds' },
    { name: '+ curvature in log TVL', make: variant({ ...kept, quad: true }), kept: false, note: 'ties on leave-one-out; the walk-forward gain (n=48) is not trusted over it' },
    { name: 'growth carry, stated projection ±25%', make: null, kept: true, note: 'not fitted: 1 + 0.01×clip(7d, −25, +25), applied after the fit; no held-out claim' },
  ];
  return rows.map((r) => {
    if (r.make === null) {
      return { term: r.name, loo_miss: null, loo_medape: null, wf_miss: null, wf_medape: null, kept: r.kept, note: r.note };
    }
    const l = loo(r.make);
    const w = wf(r.make);
    return { term: r.name, loo_miss: l.miss, loo_medape: l.medape, wf_miss: w.miss, wf_medape: w.medape, kept: r.kept, note: r.note };
  });
}

/** The odds Brier against the own-token-launch flag, in-sample and walk-forward
 *  (older-listed -> newer-listed), with the constant base-rate Brier for comparison.
 *  The flag is 1 when a protocol launches its own token: it records a symbol and is
 *  not a family child. */
export function oddsBrier(snapshot: Snapshot, model: ModelConstants = MODEL): { inSample: number; walkForward: number; base: number } {
  const familyChildren = familyChildSlugs(snapshot);
  const brier = (list: SnapshotProtocol[]): number => {
    let s = 0;
    for (const p of list) {
      const o = tokenOdds(p, ageDays(snapshot.as_of, p.listed_at), model, familyChildren.has(p.slug));
      const y = ownsToken(p, familyChildren) ? 1 : 0;
      s += (o - y) * (o - y);
    }
    return s / list.length;
  };
  const dated = snapshot.protocols.filter((p) => p.listed_at).sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const split = Math.floor(dated.length / 2);
  const ybar = snapshot.protocols.reduce((acc, p) => acc + (ownsToken(p, familyChildren) ? 1 : 0), 0) / snapshot.protocols.length;
  return { inSample: brier(snapshot.protocols), walkForward: brier(dated.slice(split)), base: ybar * (1 - ybar) };
}

/** The fraction of live comps whose actual market cap falls inside their printed range:
 *  the middle-50% range (P25–P75) the board shows, and the wide P10–P90 range the
 *  detail view shows. Both use the shipped model's residual quantiles. */
export function rangeCalibration(snapshot: Snapshot, model: ModelConstants = MODEL): { mid50: number; p10p90: number } {
  const comps = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  let inMid = 0;
  let inWide = 0;
  for (const p of comps) {
    const pred = ifLaunches(p, model);
    const r = Math.log(p.mcap_usd as number) - Math.log(pred);
    if (r >= model.value_resid_p25 && r <= model.value_resid_p75) inMid++;
    if (r >= model.value_resid_p10 && r <= model.value_resid_p90) inWide++;
  }
  return { mid50: inMid / comps.length, p10p90: inWide / comps.length };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not a wrapped, staked or
 *  bridged product of a token that already trades, not an exchange, not a versioned pool.
 *  This is the watchlist's own rule, applied to the whole board: WBTC, Binance staked ETH
 *  and USDT0 are wrapped products, not protocols still waiting on a launch of their own. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  const excluded = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
  if (p.category !== null && excluded.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) return false;
  if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The verdict for a row: farm when the token odds are strong, thin when they are middling,
 *  skip when they are weak. The verdict is about the probability of a token, not the size:
 *  the net is shown as a column but never flips it. */
export function verdictFor(odds: number): 'farm' | 'thin' | 'skip' {
  if (odds >= 0.5) return 'farm';
  if (odds >= 0.3) return 'thin';
  return 'skip';
}

/** One live comparable for the value-model refit: log TVL, log market cap, category. */
export interface ValueComp {
  lnTvl: number;
  lnMcap: number;
  category: string | null;
}

/** The value model refitted from a set of live comparables: OLS for the size curve, then
 *  the category effect as the shrunk mean of the residuals clipped to +/-clip, prior
 *  weight `shrink`, capped at +/-cap. This is the same two-stage procedure the hardcoded
 *  constants came from, so a refit on the full set reproduces them; the bootstrap uses it
 *  on resamples. Returns null when the resample cannot identify a slope. */
export function fitValueTwoStage(comps: ValueComp[], model: ModelConstants = MODEL): { a: number; b: number; effects: Map<string, number> } | null {
  const n = comps.length;
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const c of comps) {
    sx += c.lnTvl;
    sy += c.lnMcap;
    sxx += c.lnTvl * c.lnTvl;
    sxy += c.lnTvl * c.lnMcap;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  const byCat = new Map<string, number[]>();
  for (const c of comps) {
    const r = Math.min(model.value_clip, Math.max(-model.value_clip, c.lnMcap - (a + b * c.lnTvl)));
    const key = c.category ?? '';
    const arr = byCat.get(key) ?? [];
    arr.push(r);
    byCat.set(key, arr);
  }
  const effects = new Map<string, number>();
  for (const [key, rs] of byCat) {
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    const shrunk = (rs.length / (rs.length + model.value_shrink_prior)) * mean;
    effects.set(key, Math.min(model.value_effect_cap, Math.max(-model.value_effect_cap, shrunk)));
  }
  return { a, b, effects };
}

/** The snapshot's live comparables for the value model: positive recorded market cap. */
export function valueComps(snapshot: Snapshot): ValueComp[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({ lnTvl: Math.log(p.tvl_usd), lnMcap: Math.log(p.mcap_usd as number), category: p.category }));
}

/** A small deterministic PRNG (mulberry32) so the bootstrap rank ranges reproduce. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many bootstrap refits feed each row's rank range. */
export const BOOTSTRAP_REFITS = 20;

/** The min/max rank each protocol reaches across bootstrap refits of the value model
 *  (resampled live comparables, odds fixed). The growth carry is deterministic per
 *  protocol, so it multiplies every refit the same way; the main fit's own rank always
 *  lies inside. */
export function bootstrapRankRanges(
  rows: { slug: string; tvl_usd: number; category: string | null; odds: number; growthMult: number }[],
  comps: ValueComp[],
  model: ModelConstants = MODEL,
): Map<string, { min: number; max: number }> {
  const ranges = new Map<string, { min: number; max: number }>();
  // Rows arrive in main-fit rank order, so the initial range is the main rank.
  for (let i = 0; i < rows.length; i++) ranges.set(rows[i]!.slug, { min: i + 1, max: i + 1 });
  const rng = mulberry32(20261120);
  for (let iter = 0; iter < BOOTSTRAP_REFITS; iter++) {
    const sample: ValueComp[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const fit = fitValueTwoStage(sample, model);
    if (fit === null) continue;
    const scored = rows.map((r) => {
      const eff = fit.effects.get(r.category ?? '') ?? 0;
      const launches = Math.exp(fit.a + fit.b * Math.log(Math.max(1, r.tvl_usd)) + eff);
      return { slug: r.slug, implied: launches * r.growthMult * r.odds };
    });
    scored.sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => {
      const cur = ranges.get(s.slug)!;
      cur.min = Math.min(cur.min, i + 1);
      cur.max = Math.max(cur.max, i + 1);
    });
  }
  return ranges;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The net of farming one protocol on the default ticket, from the fitted model. Hours
 *  are the farm plan's time: setup + 10 minutes a week over the hold + 10 minutes to
 *  claim. Break-even ticket is null when the slice per dollar is below the T-bill rate
 *  (then no ticket size pays); break-even odds is null when it would need odds above 0.95. */
export function netFor(
  p: SnapshotProtocol,
  implied: number,
  launches: number,
  age: number | null,
  gas: number,
  model: ModelConstants = MODEL,
): NetInfo {
  const hold = holdDaysFor(age);
  const hours = model.setup_hours + (hold / 7) * model.weekly_hours + model.claim_hours;
  const slice = p.tvl_usd > 0 ? implied * model.drop_share * (model.ticket_usd / p.tvl_usd) : 0;
  const tbill = model.ticket_usd * model.tbill_rate * (hold / 365);
  const net = slice - gas - tbill;
  const perDollar = p.tvl_usd > 0 ? implied * model.drop_share / p.tvl_usd - model.tbill_rate * (hold / 365) : -1;
  const breakEvenTicket = perDollar > 0 ? Math.round(gas / perDollar) : null;
  const sliceBase = p.tvl_usd > 0 ? launches * model.drop_share * (model.ticket_usd / p.tvl_usd) : 0;
  const oddsStar = sliceBase > 0 ? (gas + tbill) / sliceBase : Number.POSITIVE_INFINITY;
  const breakEvenOdds = oddsStar > 0 && oddsStar <= 0.95 ? round4(oddsStar) : null;
  return {
    hold_days: hold,
    hours: round4(hours),
    slice_usd: round2(slice),
    gas_usd: gas,
    tbill_usd: round2(tbill),
    net_usd: round2(net),
    net_per_hour_usd: round2(net / hours),
    break_even_ticket_usd: breakEvenTicket,
    break_even_odds: breakEvenOdds,
  };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A dollar amount with two decimals, keeping the minus sign in front. */
function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const familyChildren = familyChildSlugs(snapshot);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, not just the top 160 by TVL.
  // The board is the whole pre-token universe the snapshot can rank.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const { implied, ifLaunches: launches, growthPct, growthMult, age, multiple, odds, categoryEffect, familyChild } = impliedValue(p, snapshot.as_of, model, familyChildren.has(p.slug));
    const gas = gasFor(p);
    const net = netFor(p, implied, launches, age, gas, model);
    return { p, implied, launches, growthPct, growthMult, age, multiple, odds, categoryEffect, familyChild, gas, net };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const ranges = bootstrapRankRanges(
    scored.map((s) => ({ slug: s.p.slug, tvl_usd: s.p.tvl_usd, category: s.p.category, odds: s.odds, growthMult: s.growthMult })),
    valueComps(snapshot),
    model,
  );
  const p10 = Math.exp(model.value_resid_p10);
  const p25 = Math.exp(model.value_resid_p25);
  const p75 = Math.exp(model.value_resid_p75);
  const p90 = Math.exp(model.value_resid_p90);
  return scored.map((s, i) => {
    // The crash guard caps the verdict, never the value: a protocol down 15% or more
    // in 7 days can never be FARM; down 30% or more is SKIP, whatever the odds say.
    const g7 = s.p.change_7d;
    let verdict = verdictFor(s.odds);
    let guard: string | null = null;
    if (g7 !== null && g7 <= -30) {
      verdict = 'skip';
      guard = `TVL ${g7.toFixed(1)}% in 7d`;
    } else if (g7 !== null && g7 <= -15) {
      if (verdict === 'farm') verdict = 'thin';
      guard = `TVL ${g7.toFixed(1)}% in 7d`;
    }
    const cost = capitalFor(s.p);
    const range = ranges.get(s.p.slug) ?? { min: i + 1, max: i + 1 };
    const ilP10 = Math.max(1, Math.round(s.launches * p10));
    const ilP25 = Math.max(1, Math.round(s.launches * p25));
    const ilP75 = Math.max(1, Math.round(s.launches * p75));
    const ilP90 = Math.max(1, Math.round(s.launches * p90));
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      if_launches_usd: Math.max(1, Math.round(s.launches)),
      if_launches_p10_usd: ilP10,
      if_launches_p25_usd: ilP25,
      if_launches_p75_usd: ilP75,
      if_launches_p90_usd: ilP90,
      implied_p10_usd: Math.max(1, Math.round(ilP10 * s.growthMult * s.odds)),
      implied_p25_usd: Math.max(1, Math.round(ilP25 * s.growthMult * s.odds)),
      implied_p75_usd: Math.max(1, Math.round(ilP75 * s.growthMult * s.odds)),
      implied_p90_usd: Math.max(1, Math.round(ilP90 * s.growthMult * s.odds)),
      rank_min: range.min,
      rank_max: range.max,
      net_usd: s.net.net_usd,
      net_per_hour_usd: s.net.net_per_hour_usd,
      slice_usd: s.net.slice_usd,
      tbill_usd: s.net.tbill_usd,
      hold_days: s.net.hold_days,
      break_even_ticket_usd: s.net.break_even_ticket_usd,
      break_even_odds: s.net.break_even_odds,
      model: {
        fitted_multiple: round4(s.multiple),
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        token_odds: round4(s.odds),
        age_days: s.age,
        if_launches_usd: Math.max(1, Math.round(s.launches)),
        category_effect: round4(s.categoryEffect),
        family_child: s.familyChild,
      },
      verdict,
      guard_reason: guard,
      farm_cost_usd: cost,
      farm_gas_usd: s.gas,
      farm_steps: farmSteps(s.p, s.age, cost, s.gas, verdict, s.odds, s.net).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** Gas for a full farm run (setup + weekly actions + claim), from the chain's typical fees. */
export function gasFor(p: SnapshotProtocol): number {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain === 'ethereum') return 40;
  if (chain === 'bitcoin' || chain === 'solana' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism') return 5;
  return 15;
}

/** The context a farm plan is written from: the protocol's own record. */
interface PlanCtx {
  name: string;
  capital: number;
  chain: string;
  gas: number;
  hold: number;
}

/** The one step every plan shares: a fresh wallet. It is the single step the
 *  diversity rule exempts; every other step names the protocol, so no other step text
 *  repeats across rows. */
function walletStep(): FarmStep {
  return {
    text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
    cost: 'under $3 of gas for the first transaction',
    time: '5 minutes',
  };
}

/** Hold the position, named so the step is the protocol's own. */
function holdStep(ctx: PlanCtx): FarmStep {
  return {
    text: `Hold your ${ctx.name} position on ${ctx.chain} for at least ${ctx.hold} days so the activity is counted in more than one snapshot.`,
    cost: `the $${ctx.capital} stays in the position`,
    time: `${ctx.hold} days`,
  };
}

/** Claim only from the protocol's own page, named so the step is the protocol's own. */
function claimStep(ctx: PlanCtx): FarmStep {
  return {
    text: `Before you withdraw, open ${ctx.name}'s own points or rewards page and claim only from the link it publishes.`,
    cost: 'no fee to check, and never pay to claim',
    time: '10 minutes',
  };
}

type PlanTemplate = (ctx: PlanCtx) => FarmStep[];

/** Category-specific farm plans. Each template's middle steps are the category's own
 *  actions — a lending plan supplies and borrows, a DEX plan provides liquidity and
 *  stakes the receipt, a curator plan deposits into a vault — and each step names the
 *  protocol, its chain and the ticket size, so plans differ by protocol, not just by
 *  category. The wallet, hold and claim steps wrap every template. */
const PLAN_TEMPLATES: { match: (c: string) => boolean; steps: PlanTemplate }[] = [
  {
    match: (c) => c.includes('lend') || c.includes('cdp') || c.includes('collateral'),
    steps: (ctx) => {
      const borrow = Math.max(10, Math.round(ctx.capital / 3));
      return [
        { text: `Supply $${ctx.capital} of USDC to ${ctx.name} on ${ctx.chain} as collateral and keep the loan-to-value below 50%.`, cost: `$${ctx.capital} deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
        { text: `Borrow $${borrow} of the chain's stablecoin against your ${ctx.name} collateral and hold it in the same wallet, so the position counts as active borrowing.`, cost: `$${borrow} borrowed, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '10 minutes' },
        { text: `Top up the collateral or repay a small part of the borrow on ${ctx.name} once a week, so the position shows fresh activity in every snapshot.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      ];
    },
  },
  {
    match: (c) => c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm'),
    steps: (ctx) => [
      { text: `Provide $${ctx.capital} of liquidity to ${ctx.name}'s main pool on ${ctx.chain}, in the pair the app suggests, and keep the position open.`, cost: `$${ctx.capital} of liquidity, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name} offers a gauge or a farm for that pool, stake the LP receipt there so the deposit earns the protocol's own rewards.`, cost: 'about $2 of gas to stake', time: '10 minutes' },
      { text: `Swap a small amount through ${ctx.name} on ${ctx.chain} once a week, so the wallet shows trading activity as well as liquidity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Rebalance your ${ctx.name} position when the price moves out of range, and add the earned fees back into the pool.`, cost: 'about $2 of gas when you rebalance', time: '10 minutes when you rebalance' },
    ],
  },
  {
    match: (c) => c.includes('yield'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} of USDC into ${ctx.name}'s highest-yield strategy on ${ctx.chain} and keep the receipt token.`, cost: `$${ctx.capital} deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name} lets you pick a strategy, choose the one that has run the longest and shows a public track record.`, cost: 'no extra capital', time: '10 minutes to compare' },
      { text: `Claim ${ctx.name}'s strategy yield once a week and redeposit it, so the position compounds and the wallet stays active.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('curator') || c.includes('allocator'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} into a ${ctx.name} vault on ${ctx.chain} and keep the vault shares in the farming wallet.`, cost: `$${ctx.capital} deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Read ${ctx.name}'s vault curator page and note which markets it allocates to, so you can answer for the position later.`, cost: 'no extra capital', time: '10 minutes to read' },
      { text: `Add a small top-up into the same ${ctx.name} vault once a week, so the deposit shows fresh activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('rwa') || c.includes('stable') || c.includes('reserve currency'),
    steps: (ctx) => [
      { text: `Mint $${ctx.capital} of ${ctx.name}'s yield-bearing asset on ${ctx.chain} and hold it in the farming wallet.`, cost: `$${ctx.capital} to mint, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} asset's backing page once a week and keep a note of the yield it has paid.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('basis') || c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic') || c.includes('interest rate'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} of USDC as margin on ${ctx.name} and open one small hedge, no more than a tenth of the deposit.`, cost: `$${ctx.capital} of margin, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Set a stop on the ${ctx.name} hedge so a sharp move cannot liquidate the margin.`, cost: 'no extra capital', time: '5 minutes' },
      { text: `Roll or close the ${ctx.name} hedge once a week and open a fresh one, so the account shows regular trading.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Keep the rest of the margin uninvested in ${ctx.name}, so the position survives a volatile week.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('chain') || c.includes('ai agent') || c.includes('decentralized ai'),
    steps: (ctx) => [
      { text: `Use ${ctx.name} on ${ctx.chain}: run one transaction a week from the farming wallet and keep it active.`, cost: `about $${Math.max(2, Math.round(ctx.gas / 4))} of gas a week`, time: '10 minutes a week' },
      { text: `Try ${ctx.name}'s main app once, with a small amount, so the wallet has a real interaction on record.`, cost: `about $${Math.max(10, Math.round(ctx.capital / 10))} for the trial`, time: '15 minutes' },
    ],
  },
  {
    match: (c) => c.includes('prediction'),
    steps: (ctx) => [
      { text: `Fund $${ctx.capital} on ${ctx.name} and place one market position on ${ctx.chain}, on a market you have read.`, cost: `$${ctx.capital} to fund, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Close or settle the ${ctx.name} position when the market resolves, and place a fresh one the next week.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Keep the ${ctx.name} stake small and the position count steady, so the activity reads as regular use.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('bridge'),
    steps: (ctx) => [
      { text: `Bridge $${ctx.capital} of USDC to ${ctx.chain} through ${ctx.name} and use the bridged funds in the destination app.`, cost: `$${ctx.capital} to bridge, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Bridge a small amount back through ${ctx.name} once a week, so the route shows two-way activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('launchpad'),
    steps: (ctx) => [
      { text: `Join ${ctx.name}'s next launch on ${ctx.chain} with $${ctx.capital}, and read the launch terms before you commit.`, cost: `$${ctx.capital} to join, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name}'s launch asks for a stake or a hold, keep the required balance in the farming wallet.`, cost: 'no extra capital', time: '10 minutes to check' },
      { text: `Claim the allocation from ${ctx.name}'s own page when it opens, and never pay a third party to claim it.`, cost: 'no fee to check', time: '10 minutes when it opens' },
    ],
  },
  {
    match: (c) => c.includes('index'),
    steps: (ctx) => [
      { text: `Buy $${ctx.capital} of the ${ctx.name} index on ${ctx.chain} and hold the index token in the farming wallet.`, cost: `$${ctx.capital} to buy, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} index composition once a week and note any rebalance.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('payment') || c.includes('card issuer'),
    steps: (ctx) => [
      { text: `Spend $${ctx.capital} through ${ctx.name} on ${ctx.chain} for a real purchase, and keep the receipt.`, cost: `$${ctx.capital} to spend, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Use the ${ctx.name} payment route once a week for a small amount, so the account shows regular use.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('privacy'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} into ${ctx.name}'s private pool on ${ctx.chain} and keep the withdrawal note safe.`, cost: `$${ctx.capital} deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Withdraw a small amount once a week and redeposit it, so the pool sees regular activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Never share the ${ctx.name} withdrawal note or the pool link with anyone.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('insurance'),
    steps: (ctx) => [
      { text: `Buy $${ctx.capital} of cover from ${ctx.name} on ${ctx.chain} and keep the policy in the farming wallet.`, cost: `$${ctx.capital} for cover, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} policy once a week and note the cover period.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('staking') || c.includes('restak'),
    steps: (ctx) => [
      { text: `Stake $${ctx.capital} of the chain's staking asset through ${ctx.name} and keep the receipt token.`, cost: `$${ctx.capital} to stake, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Restake the ${ctx.name} staking rewards once a week so the position compounds.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `If ${ctx.name} offers a liquid receipt, keep it in the farming wallet rather than selling it.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('nft'),
    steps: (ctx) => [
      { text: `List or buy one item for about $${ctx.capital} on ${ctx.name} on ${ctx.chain}, and keep the receipt.`, cost: `$${ctx.capital} for the item, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Make one small trade a week on ${ctx.name} so the wallet shows regular marketplace activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('governance'),
    steps: (ctx) => [
      { text: `Stake $${ctx.capital} for governance through ${ctx.name} on ${ctx.chain} and vote on the next proposal.`, cost: `$${ctx.capital} to stake, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Vote on one ${ctx.name} proposal a week while the stake is locked.`, cost: 'no fee to vote', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('otc'),
    steps: (ctx) => [
      { text: `Place one OTC order for about $${ctx.capital} through ${ctx.name} on ${ctx.chain} and settle it in the farming wallet.`, cost: `$${ctx.capital} for the order, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Place a small order once a week through ${ctx.name} so the desk sees regular flow.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('locker'),
    steps: (ctx) => [
      { text: `Lock $${ctx.capital} of tokens through ${ctx.name} on ${ctx.chain} for the term the app suggests.`, cost: `$${ctx.capital} to lock, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} lock once a week and note the unlock date.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('btc') || c.includes('bitcoin'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} of the wrapped asset through ${ctx.name} on ${ctx.chain} and keep the receipt.`, cost: `$${ctx.capital} to deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} peg once a week and note any drift.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('cedefi'),
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} into ${ctx.name}'s managed account on ${ctx.chain} and keep the balance in the farming wallet.`, cost: `$${ctx.capital} to deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} account once a week and note the reported yield.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: () => true,
    steps: (ctx) => [
      { text: `Deposit $${ctx.capital} of USDC into ${ctx.name} on ${ctx.chain} and keep the position open.`, cost: `$${ctx.capital} deposit, about $${Math.max(2, Math.round(ctx.gas / 4))} of gas`, time: '15 minutes to set up' },
      { text: `Make one qualifying action a week inside ${ctx.name}, such as a deposit, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
];

/** A protocol's farm plan: the action steps only (5-7), wallet first, hold and claim
 *  last. The plan is derived from the protocol's own record (category, chains, TVL,
 *  age), never from a hand-written list of names. */
export function farmPlanSteps(p: SnapshotProtocol, age: number | null, capital: number, gas: number): FarmStep[] {
  const ctx: PlanCtx = { name: p.name, capital, chain: chainOf(p), gas, hold: holdDaysFor(age) };
  const c = (p.category ?? '').toLowerCase();
  const template = PLAN_TEMPLATES.find((t) => t.match(c))!;
  return [walletStep(), ...template.steps(ctx), holdStep(ctx), claimStep(ctx)];
}

/**
 * A protocol's full farm plan: the action steps plus the verdict step, costed with the
 *  net and the break-even. The last step states the odds-based verdict, the net on a
 *  $1,000 ticket and the ticket size (or odds) that pays; when no ticket pays it says
 *  so plainly. The net is information only; it never changes the verdict.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, capital: number, gas: number, verdict: 'farm' | 'thin' | 'skip', odds: number, net: NetInfo): FarmStep[] {
  const hold = net.hold_days;
  const total = capital + gas;
  const pays = net.break_even_ticket_usd !== null
    ? `It pays from a $${net.break_even_ticket_usd.toLocaleString('en-US')} ticket.`
    : `No ticket size pays: the slice per dollar is below the T-bill rate.`;
  const verdictText = `Verdict: ${verdict.toUpperCase()} — token odds ${Math.round(odds * 100)}%. On a $1,000 ticket the expected slice is ${fmtUsd(net.slice_usd)}, gas about ${fmtUsd(net.gas_usd)} and forgone T-bill yield ${fmtUsd(net.tbill_usd)}, net ${fmtUsd(net.net_usd)} (${fmtUsd(net.net_per_hour_usd)}/hour). ${pays}`;
  return [
    ...farmPlanSteps(p, age, capital, gas),
    {
      text: verdictText,
      cost: `about $${total} all in`,
      time: `${hold} days of holding`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
/** The dashboard's row: the board's numbers plus the farm plan as structured steps.
 *  The plan is regenerated from the row's own record by the same farmPlanSteps the
 *  board used, so the page's plan and the board's plan are the same plan. */
export function radarRow(row: BoardRow): RadarRow {
  const p: SnapshotProtocol = {
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    gecko_id: row.gecko_id,
    symbol: row.symbol,
  };
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    if_launches_usd: row.if_launches_usd,
    if_launches_p10_usd: row.if_launches_p10_usd,
    if_launches_p25_usd: row.if_launches_p25_usd,
    if_launches_p75_usd: row.if_launches_p75_usd,
    if_launches_p90_usd: row.if_launches_p90_usd,
    implied_p10_usd: row.implied_p10_usd,
    implied_p25_usd: row.implied_p25_usd,
    implied_p75_usd: row.implied_p75_usd,
    implied_p90_usd: row.implied_p90_usd,
    rank_min: row.rank_min,
    rank_max: row.rank_max,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    slice_usd: row.slice_usd,
    tbill_usd: row.tbill_usd,
    hold_days: row.hold_days,
    break_even_ticket_usd: row.break_even_ticket_usd,
    break_even_odds: row.break_even_odds,
    category_effect: row.model.category_effect,
    fitted_multiple: row.model.fitted_multiple,
    growth_multiplier: row.model.growth_multiplier,
    token_odds: row.model.token_odds,
    family_child: row.model.family_child,
    verdict: row.verdict,
    guard_reason: row.guard_reason,
    farm_cost_usd: row.farm_cost_usd,
    farm_gas_usd: row.farm_gas_usd,
    farm_steps: farmPlanSteps(p, row.age_days, row.farm_cost_usd, row.farm_gas_usd),
  };
}

/** The protocol accounting ledger: every snapshot protocol in exactly one group. */
export function buildLedger(snapshot: Snapshot, boardSlugs: Set<string>): LedgerGroup[] {
  const watchlist = new Set(snapshot.watchlist);
  let rankedWatchlist = 0;
  let rankedEarly = 0;
  let tokenTrades = 0;
  let tokenNoCap = 0;
  let outBridge = 0;
  let outLiquidStaking = 0;
  let outExchange = 0;
  let outVersionedWrapped = 0;
  let outOther = 0;
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) {
      if (watchlist.has(p.slug)) rankedWatchlist++;
      else rankedEarly++;
      continue;
    }
    if (!isPreToken(p)) {
      if (p.mcap_usd !== null && p.mcap_usd > 0) tokenTrades++;
      else tokenNoCap++;
      continue;
    }
    // Pre-token but not ranked: apply the house's own exclusion rules.
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') { outBridge++; continue; }
    if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') { outLiquidStaking++; continue; }
    if (p.category === 'CEX') { outExchange++; continue; }
    if (VERSIONED.test(p.name) || /\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name) || /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) { outVersionedWrapped++; continue; }
    outOther++;
  }
  return [
    { key: 'ranked-watchlist', label: 'Ranked · watchlist', count: rankedWatchlist, note: 'records no token, on the 40-protocol watchlist' },
    { key: 'ranked-early', label: 'Ranked · early', count: rankedEarly, note: 'records no token, found beyond the watchlist' },
    { key: 'token-trades', label: 'Token trades · priced comp', count: tokenTrades, note: 'a market cap: comparables, never ranked' },
    { key: 'token-no-cap', label: 'Token recorded · no usable cap', count: tokenNoCap, note: 'a token on record, no market cap to price' },
    { key: 'out-bridge', label: 'Out · bridge', count: outBridge, note: 'the house rule: bridges are not launches' },
    { key: 'out-liquid-staking', label: 'Out · liquid staking', count: outLiquidStaking, note: 'a staked product of a token that trades' },
    { key: 'out-exchange', label: 'Out · exchange', count: outExchange, note: 'an exchange balance, not a protocol launch' },
    { key: 'out-versioned-wrapped', label: 'Out · versioned or wrapped', count: outVersionedWrapped, note: 'a versioned pool or a wrapped product' },
    { key: 'out-other', label: 'Out · other', count: outOther, note: 'pre-token, not rankable under the house rules' },
  ];
}

/** Everything the dashboard renders, from the snapshot. The held-out term table, the
 *  odds Brier and the range calibration are computed from the snapshot at build time,
 *  so the page's evidence is the shipped model's own, not a pasted number. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const boardSlugs = new Set(board.map((r) => r.slug));
  const ledger = buildLedger(snapshot, boardSlugs);
  const ledgerTotal = ledger.reduce((s, g) => s + g.count, 0);
  const brier = oddsBrier(snapshot, model);
  const calib = rangeCalibration(snapshot, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit: {
      ...FIT,
      odds_brier_in_sample: brier.inSample,
      odds_brier_wf: brier.walkForward,
      odds_brier_base: brier.base,
      range_mid50_calib: calib.mid50,
      range_p10p90_calib: calib.p10p90,
    },
    fit_terms: heldOutTests(snapshot, model),
    ledger,
    ledger_total: ledgerTotal,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
