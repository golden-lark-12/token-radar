// The token radar's fitted model (radar-4): one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every rankable pre-token protocol: the snapshot's watchlist (the floor,
// never a ceiling) plus every other pre-token protocol that is not a CEX and not a versioned
// pool. A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as
// the market's own values, never mixed into the ranked board.
//
// Implied value is FITTED, not assumed, in two parts. This is the v3 rebuild after v2
// (radar-3, 69.88%) regressed 14 points behind v1 (radar-2, 84.05%) by ranking crashing
// protocols as the best farms. The fix, following the top entry's own evidence table:
//
//   VALUE IF IT LAUNCHES — a size curve plus a category effect. NO growth, NO age.
//   log(mcap) = 6.9646 + 0.5223 x log(TVL) + category_effect
//   Fitted by least squares on the 128 live-token protocols with a positive recorded market
//   cap (144 record one; 16 are zero or negative and cannot enter a log fit). The category
//   effect is the shrunk mean of the OLS residuals in the category: each residual clipped
//   to +/-2.0 log points, averaged, shrunk by n/(n+5) toward 0, capped at +/-1.0 log point.
//   Growth and age were TESTED and NOT kept: growth in the value model is what inverted v2
//   (a -72.71% 7d protocol ranked #6 as a FARM). A protocol at +50% 7d growth gets exactly
//   the same if-launches value as at -50% here, by construction.
//   Held-out: leave-one-out miss x3.84, MedAPE 84.4%; 80/20 splits miss x3.47-5.29.
//   The flat median multiple (0.2138) misses x4.86 / MedAPE 90.1% on the same test.
//   Bootstrap (200 resamples) standard errors: const 1.55, log-TVL slope 0.085.
//   Ranges: the value-model residual P10/P90 (x0.064 / x8.48) bounds if-launches and
//   implied; rank ranges come from 20 bootstrap refits of this value model (odds fixed).
//
//   TOKEN ODDS — a logistic regression on all 758 protocols, P(records a token symbol).
//   logit = 0.1959 + 0.1682 x z(log TVL) + 0.4281 x z(log age) - 0.2668 x z(growth)
//           + category_effect, z-standardised (means/sds in MODEL below).
//   Age is floored at 365 days before the log: below one year, listing age carries no
//   further "has had time to launch" signal, so a 56-day-old grower is not punished for
//   being young. Category effects are ridge-shrunk (penalty 16); slopes carry a 0.1 ridge.
//   5-fold cross-validated Brier 0.217 (seeds 0-2: 0.216-0.218) against a 0.248 base rate:
//   clearly better than guessing, so the strip may show it. In-sample Brier 0.209.
//   implied = max(1, round(if_launches x token_odds))
//
//   NET — information, NOT the verdict. Slice = implied x 7% x ($1,000 / TVL); gas is the
//   chain's farm-run gas; forgone yield = $1,000 x 4% x (hold_days / 365). Net = slice -
//   gas - forgone yield. Net/hour divides by the farm plan's time (0.25h setup + 10 min a
//   week over the hold + 10 min to claim). Break-even ticket is the ticket size at which
//   the net is $0 (null when the slice per dollar is below the T-bill rate, so no ticket
//   pays); break-even odds is the token odds needed for a $1,000 ticket to break even
//   (null when above 0.95). The verdict stays ODDS-BASED (v1's direction): farm if odds
//   >= 0.5, thin if >= 0.3, else skip. A negative net never flips a farm to a skip.

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
  value_resid_p90: number;
  value_clip: number;
  value_shrink_prior: number;
  value_effect_cap: number;
  odds_const: number;
  odds_log_tvl: number;
  odds_log_age: number;
  odds_growth: number;
  odds_mu_log_tvl: number;
  odds_mu_log_age: number;
  odds_mu_growth: number;
  odds_sd_log_tvl: number;
  odds_sd_log_age: number;
  odds_sd_growth: number;
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
  value_resid_p10: -2.7437,
  value_resid_p90: 2.1382,
  value_clip: 2.0,
  value_shrink_prior: 5,
  value_effect_cap: 1.0,
  odds_const: 0.1959,
  odds_log_tvl: 0.1682,
  odds_log_age: 0.4281,
  odds_growth: -0.2668,
  odds_mu_log_tvl: 17.7347,
  odds_mu_log_age: 6.441,
  odds_mu_growth: -0.068,
  odds_sd_log_tvl: 1.8078,
  odds_sd_log_age: 0.5433,
  odds_sd_growth: 0.0853,
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
export const MODEL_VERSION = 'radar-4';

/** The value model's category effect (log points): shrunk mean of the clipped OLS
 *  residuals in the category, prior weight 5, capped at +/-1.0. Categories with no live
 *  comps get 0. Source: the snapshot's 128 positive-market-cap live protocols.
 *  Prediction Market (+0.3333) rests on one comp (Rain, mcap/TVL 400x); its residual was
 *  clipped to +2.0 before shrinking, so the single outlier cannot set the effect alone. */
export const VALUE_EFFECT: Record<string, number> = {
  'AI Agents': -0.0008,
  'Basis Trading': 0.3951,
  'Bridge': 0.1664,
  'CDP': -0.3079,
  'CEX': 0.3514,
  'Canonical Bridge': 0.5148,
  'Chain': 0.3333,
  'Collateral Management': 0.3333,
  'Cross Chain Bridge': 0.3033,
  'DOR': -0.1472,
  'Decentralized AI': 0.3333,
  'Derivatives': 0.3809,
  'Dexs': 0.1238,
  'Dual-Token Stablecoin': -0.2877,
  'Indexes': -0.0499,
  'Launchpad': -0.0074,
  'Lending': -0.3072,
  'Leveraged Farming': -0.0029,
  'Liquid Restaking': -0.1858,
  'Liquid Staking': -0.523,
  'Liquidity Manager': -0.3333,
  'NFT Marketplace': 0.2347,
  'Onchain Capital Allocator': -0.4253,
  'Options': 0.1756,
  'Payments': -0.3393,
  'Prediction Market': 0.3333,
  'Privacy': 0.3996,
  'RWA': 0.1197,
  'Restaking': -0.0535,
  'Risk Curators': 0.3173,
  'Staking Pool': -0.5431,
  'Token Locker': 0.1122,
  'Yield': -0.2168,
  'Yield Aggregator': -0.4056,
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

/** The held-out validation the dashboard reports. Value model: leave-one-out and 80/20
 *  splits on the 128 positive-market-cap live protocols; the flat-median baseline is the
 *  same test on a single global mcap/TVL multiple (0.2138). Odds model: 5-fold
 *  cross-validated Brier on all 758 protocols against the constant base-rate Brier. */
export const FIT = {
  n_live: 128,
  n_live_total: 144,
  median_multiple: 0.2138,
  value_const: 6.9646,
  value_log_tvl: 0.5223,
  value_const_se: 1.55,
  value_log_tvl_se: 0.085,
  loo_miss: 3.84,
  loo_medape: 84.4,
  heldout_medape: 84.4,
  heldout_medape_range: '80/20 misses x3.47-5.29',
  baseline_medape: '90.1%',
  baseline_miss: 4.86,
  resid_p10_mult: 0.0643,
  resid_p90_mult: 8.4838,
  odds_brier_cv: 0.217,
  odds_brier_base: 0.248,
  odds_brier_in_sample: 0.209,
  note: 'This model ranks; it does not price. Implied values are order-of-magnitude scores with ~4x typical error. Growth and age are NOT in the value model: a crasher and a grower with the same TVL and category get the same if-launches value.',
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
  if_launches_p90_usd: number;
  implied_p10_usd: number;
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
    maturity_multiplier: number;
    token_odds: number;
    age_days: number | null;
    if_launches_usd: number;
    category_effect: number;
  };
  verdict: 'farm' | 'thin' | 'skip';
  farm_cost_usd: number;
  farm_gas_usd: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
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
  if_launches_p90_usd: number;
  implied_p10_usd: number;
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
  maturity_multiplier: number;
  token_odds: number;
  verdict: 'farm' | 'thin' | 'skip';
  farm_cost_usd: number;
  farm_gas_usd: number;
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

/** One term of the out-of-sample evidence table. A null leave-one-out miss means the term
 *  was tested and dropped, so no held-out number is claimed for it. */
export interface FitTerm {
  term: string;
  loo_miss: number | null;
  medape: string;
  kept: boolean;
}

/** The value model's out-of-sample evidence, from FIT: the flat median multiple is the
 *  baseline; the size curve plus the category effect is the kept model. Seven-day growth
 *  and age were TESTED in the value model and dropped — growth inverted the ranking in
 *  the previous version, ranking crashers as the best farms, so both enter only through
 *  the token odds, never through the value. */
export const FIT_TERMS: FitTerm[] = [
  { term: 'flat median multiple (0.2138×)', loo_miss: 4.86, medape: '90.1%', kept: false },
  { term: '+ size curve, log TVL, + category effect', loo_miss: 3.84, medape: '84.4%', kept: true },
  { term: '7-day TVL growth in the value model', loo_miss: null, medape: '—', kept: false },
  { term: 'age, log days listed, in the value model', loo_miss: null, medape: '—', kept: false },
];

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

/** A protocol's token odds: the logistic fit on standardised log TVL, log age (floored
 *  at 365 days, so the young are not punished for being young) and clipped 7d growth,
 *  plus the category effect, clipped to [0.05, 0.95]. */
export function tokenOdds(p: SnapshotProtocol, age: number | null, model: ModelConstants = MODEL): number {
  const ageForOdds = age === null ? model.unknown_age_days : Math.max(age, model.odds_age_floor_days);
  const growth = p.change_7d === null ? 0 : Math.min(30, Math.max(-30, p.change_7d)) / 100;
  const zTvl = (Math.log(Math.max(1, p.tvl_usd)) - model.odds_mu_log_tvl) / model.odds_sd_log_tvl;
  const zAge = (Math.log(ageForOdds) - model.odds_mu_log_age) / model.odds_sd_log_age;
  const zGrowth = (growth - model.odds_mu_growth) / model.odds_sd_growth;
  const logit = model.odds_const + model.odds_log_tvl * zTvl + model.odds_log_age * zAge + model.odds_growth * zGrowth + oddsEffect(p.category);
  const odds = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, logit))));
  return Math.min(model.odds_cap, Math.max(model.odds_floor, odds));
}

/** The multipliers and the implied value one protocol gets under the fitted model.
 *  fitted_multiple is the EFFECTIVE multiple (if-launches / TVL), so the dashboard's
 *  detail view still recomputes implied as TVL x fitted x growth x odds with
 *  growth_multiplier exactly 1.0: growth is not in the value model. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): { implied: number; ifLaunches: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null; multiple: number; odds: number; categoryEffect: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(30, Math.max(-30, finite(protocol.change_7d, 0)));
  const growthMult = 1.0;
  const maturityMult = 1.0;
  const launches = ifLaunches(protocol, model);
  const odds = tokenOdds(protocol, age, model);
  const multiple = protocol.tvl_usd > 0 ? launches / protocol.tvl_usd : 0;
  const implied = Math.max(1, Math.round(launches * odds));
  return { implied, ifLaunches: launches, growthPct, growthMult, maturityMult, age, multiple, odds, categoryEffect: valueEffect(protocol.category) };
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
 *  (resampled live comparables, odds fixed). The main fit's own rank always lies inside. */
export function bootstrapRankRanges(
  rows: { slug: string; tvl_usd: number; category: string | null; odds: number }[],
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
      return { slug: r.slug, implied: launches * r.odds };
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
    const { implied, ifLaunches: launches, growthPct, growthMult, maturityMult, age, multiple, odds, categoryEffect } = impliedValue(p, snapshot.as_of, model);
    const gas = gasFor(p);
    const net = netFor(p, implied, launches, age, gas, model);
    return { p, implied, launches, growthPct, growthMult, maturityMult, age, multiple, odds, categoryEffect, gas, net };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const ranges = bootstrapRankRanges(
    scored.map((s) => ({ slug: s.p.slug, tvl_usd: s.p.tvl_usd, category: s.p.category, odds: s.odds })),
    valueComps(snapshot),
    model,
  );
  const p10 = Math.exp(model.value_resid_p10);
  const p90 = Math.exp(model.value_resid_p90);
  return scored.map((s, i) => {
    const verdict = verdictFor(s.odds);
    const cost = capitalFor(s.p);
    const range = ranges.get(s.p.slug) ?? { min: i + 1, max: i + 1 };
    const ilP10 = Math.max(1, Math.round(s.launches * p10));
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
      if_launches_p90_usd: ilP90,
      implied_p10_usd: Math.max(1, Math.round(ilP10 * s.odds)),
      implied_p90_usd: Math.max(1, Math.round(ilP90 * s.odds)),
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
        maturity_multiplier: round4(s.maturityMult),
        token_odds: round4(s.odds),
        age_days: s.age,
        if_launches_usd: Math.max(1, Math.round(s.launches)),
        category_effect: round4(s.categoryEffect),
      },
      verdict,
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

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('chain')) return `Use ${name} on ${chain}: run one transaction a week and keep the wallet active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. The last step is the verdict, costed with the net and the break-even: it states the
 * odds-based verdict, the net on a $1,000 ticket and the ticket size (or odds) that pays.
 * The net is information only; it never changes the verdict.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, capital: number, gas: number, verdict: 'farm' | 'thin' | 'skip', odds: number, net: NetInfo): FarmStep[] {
  const chain = chainOf(p);
  const hold = net.hold_days;
  const action = actionFor(p, capital, chain);
  const total = capital + gas;
  const pays = net.break_even_ticket_usd !== null
    ? `It pays from a $${net.break_even_ticket_usd.toLocaleString('en-US')} ticket.`
    : `It never pays at any ticket size: the slice per dollar is below the T-bill rate.`;
  const verdictText = `Verdict: ${verdict.toUpperCase()} — token odds ${Math.round(odds * 100)}%. On a $1,000 ticket the expected slice is ${fmtUsd(net.slice_usd)}, gas about ${fmtUsd(net.gas_usd)} and forgone T-bill yield ${fmtUsd(net.tbill_usd)}, net ${fmtUsd(net.net_usd)} (${fmtUsd(net.net_per_hour_usd)}/hour). ${pays}`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${Math.max(2, Math.round(gas / 4))} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
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
export function radarRow(row: BoardRow): RadarRow {
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
    if_launches_p90_usd: row.if_launches_p90_usd,
    implied_p10_usd: row.implied_p10_usd,
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
    maturity_multiplier: row.model.maturity_multiplier,
    token_odds: row.model.token_odds,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    farm_gas_usd: row.farm_gas_usd,
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

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const boardSlugs = new Set(board.map((r) => r.slug));
  const ledger = buildLedger(snapshot, boardSlugs);
  const ledgerTotal = ledger.reduce((s, g) => s + g.count, 0);
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
    fit: FIT,
    fit_terms: FIT_TERMS,
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
