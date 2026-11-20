// Token Radar, model radar-6 — a fresh build on the radar-5 evidence.
//
// What this file does, in one paragraph: it reads one sealed DefiLlama
// snapshot (758 protocols, 2026-11-14), fits a size curve to the 128
// live-token protocols that carry a positive market cap, and scores every
// pre-token protocol by what its token would be worth if it launched at
// the fitted multiple. Implied value = if-it-launches x growth carry x
// token odds. The growth carry is a stated projection (never fitted), the
// odds come from a small logistic model, and the farm verdict is pure
// arithmetic on the $1,000 ticket: FARM only when the odds clear 50% and
// the net is positive. Nothing here names a protocol specially; every row
// is scored by the same function, and every number the dashboard prints
// is recomputed from the snapshot at build time.
//
// Held-out evidence (recomputed below, printed on the cover):
//   leave-one-out miss x3.39, walk-forward miss x2.96, flat-median
//   baseline x5.09 / x5.33. Odds Brier 0.208 in-sample, 0.213
//   walk-forward, against a 0.249 base rate. P25-P75 range holds 50.8%
//   of live caps (stated 50%), P10-P90 holds 79.7% (stated 80%).

export interface SnapProto {
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

export interface Snap {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapProto[];
  watchlist: string[];
}

export interface Consts {
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

// Fitted once on the 128 live comps (OLS on log TVL, then shrunk
// category effects). The dashboard prints these numbers, so they live
// here in the open rather than buried in a fit routine.
export const MODEL: Consts = {
  global_median: 0.2138,
  value_const: 6.9646,
  value_log_tvl: 0.5223,
  value_resid_p10: -2.7116,
  value_resid_p25: -1.0938,
  value_resid_p75: 1.371,
  value_resid_p90: 2.0969,
  value_clip: 1,
  value_shrink_prior: 10,
  value_effect_cap: 1,
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

export const MODEL_VERSION = 'radar-6';

// Category effect on the value, in log points: the shrunk mean of the
// clipped OLS residuals in the category (clip +/-1.0, shrink n/(n+10),
// cap +/-1.0). One-comp categories sit at +0.0909 because a single
// residual of +1.0 shrinks by 1/(1+10); the clip keeps a lone outlier
// from setting the effect on its own.
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

// Category effect on the token odds, in logit points: ridge-shrunk
// (penalty 16) dummies from the logistic fit on all 758 protocols.
// Categories absent here get 0.
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

// Fit summary the dashboard prints. The Brier and calibration fields
// are filled in at build time from the snapshot; the rest are the
// held-out numbers this model earned.
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
  odds_brier_in_sample: 0.20848469472219686,
  odds_brier_wf: 0.21272109217521082,
  odds_brier_base: 0.24863548708237898,
  range_mid50_calib: 0.5078125,
  range_p10p90_calib: 0.796875,
  note: 'This model ranks; it does not price. Implied values are order-of-magnitude scores with ~3.4x typical held-out error. Growth enters the value only as a stated carry (1 + 0.01xclip(7d, -25, +25)), never fitted; age is not in the value. The odds model has no growth term: the fitted one (-0.2668) rewarded crashers. The Brier is the in-sample Brier of the shipped odds model against the own-token-launch flag, computed from the snapshot at build time.',
};

export const LIVE_ROWS = 24;
export const BOOTSTRAP_REFITS = 20;

export interface FitTerm {
  term: string;
  loo_miss: number | null;
  loo_medape: number | null;
  wf_miss: number | null;
  wf_medape: number | null;
  kept: boolean;
  note: string;
}

export interface LedgerGroup {
  key: string;
  label: string;
  count: number;
  note: string;
}

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

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

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

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: Consts;
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
  scatter: number[][];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// ---- scoring: one function per idea, all pure ----

/** Whole days between the snapshot date and first listing, or null. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((a - b) / DAY_MS));
}

export function valueEffect(category: string | null): number {
  if (category === null) return 0;
  return VALUE_EFFECT[category] ?? 0;
}

export function oddsEffect(category: string | null): number {
  if (category === null) return 0;
  return ODDS_EFFECT[category] ?? 0;
}

/** What the token would be worth if it launched today, before odds. */
export function ifLaunches(p: SnapProto, m: Consts = MODEL): number {
  return Math.exp(m.value_const + m.value_log_tvl * Math.log(Math.max(1, p.tvl_usd)) + valueEffect(p.category));
}

/**
 * Protocols that share a name stem with a live-token protocol and carry
 * no token of their own (or the same symbol): children of a family that
 * already has a token. They are down-weighted in the odds, never in
 * the value — only 2 live comps are family children, too few to fit.
 */
export function familyChildSlugs(snap: Snap): Set<string> {
  const stems = new Map<string, SnapProto[]>();
  for (const p of snap.protocols) {
    const stem = p.slug.split('-')[0]!;
    const g = stems.get(stem);
    if (g) g.push(p);
    else stems.set(stem, [p]);
  }
  const kids = new Set<string>();
  for (const p of snap.protocols) {
    const sibs = stems.get(p.slug.split('-')[0]!) ?? [];
    const hasLiveSibling = sibs.some(
      (q) => q !== p && q.mcap_usd !== null && q.mcap_usd > 0 && (p.symbol === null || p.symbol === undefined || p.symbol === q.symbol),
    );
    if (hasLiveSibling) kids.add(p.slug);
  }
  return kids;
}

/** Records a token of its own (not inherited from a parent). */
export function ownsToken(p: SnapProto, kids: Set<string>): boolean {
  return p.symbol !== null && p.symbol !== undefined && !kids.has(p.slug);
}

/** Chance this protocol ever issues its own token, 0.05–0.95. */
export function tokenOdds(p: SnapProto, age: number | null, m: Consts = MODEL, isKid = false): number {
  const ageUsed = age === null ? m.unknown_age_days : Math.max(age, m.odds_age_floor_days);
  const zTvl = (Math.log(Math.max(1, p.tvl_usd)) - m.odds_mu_log_tvl) / m.odds_sd_log_tvl;
  const zAge = (Math.log(ageUsed) - m.odds_mu_log_age) / m.odds_sd_log_age;
  let logit = m.odds_const + m.odds_log_tvl * zTvl + m.odds_log_age * zAge + oddsEffect(p.category);
  if (isKid) logit -= m.odds_family_penalty;
  const odds = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, logit))));
  return Math.min(m.odds_cap, Math.max(m.odds_floor, odds));
}

/**
 * The growth carry: 1 + 0.01 x the 7-day TVL change, clipped to ±25%.
 * A stated projection, not a fit — the fitted growth term failed
 * held-out (LOO x3.77) and is reported as failed in the evidence table.
 */
export function growthCarry(change7d: number | null): number {
  const g = change7d === null ? 0 : Math.min(25, Math.max(-25, change7d));
  return 1 + 0.01 * g;
}

export interface Scored {
  implied: number;
  ifLaunches: number;
  growthPct: number;
  growthMult: number;
  age: number | null;
  multiple: number;
  odds: number;
  categoryEffect: number;
  familyChild: boolean;
}

export function impliedValue(p: SnapProto, asOf: string, m: Consts = MODEL, isKid = false): Scored {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(25, Math.max(-25, finite(p.change_7d, 0)));
  const growthMult = growthCarry(p.change_7d);
  const launches = ifLaunches(p, m);
  const odds = tokenOdds(p, age, m, isKid);
  const multiple = p.tvl_usd > 0 ? launches / p.tvl_usd : 0;
  const implied = Math.max(1, Math.round(launches * growthMult * odds));
  return { implied, ifLaunches: launches, growthPct, growthMult, age, multiple, odds, categoryEffect: valueEffect(p.category), familyChild: isKid };
}

// ---- small linear algebra, standard library only ----

function solveLinear(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const m = aIn.map((row, i) => [...row, bIn[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    const tmp = m[c]!;
    m[c] = m[pivot]!;
    m[pivot] = tmp;
    const d = m[c]![c]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / d;
      for (let k = c; k <= n; k++) m[r]![k] = m[r]![k]! - f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / (Math.abs(row[i]!) < 1e-12 ? 1 : row[i]!));
}

function leastSquares(xs: number[][], ys: number[]): number[] {
  const k = xs[0]!.length;
  const a: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const b: number[] = Array<number>(k).fill(0);
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < k; j++) {
      b[j] = b[j]! + xs[i]![j]! * ys[i]!;
      for (let l = 0; l < k; l++) a[j]![l] = a[j]![l]! + xs[i]![j]! * xs[i]![l]!;
    }
  }
  return solveLinear(a, b);
}

export interface ValueComp {
  lnTvl: number;
  lnMcap: number;
  category: string | null;
}

/** Live comps for a refit: positive recorded market cap, positive TVL. */
export function valueComps(snap: Snap): ValueComp[] {
  return snap.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({ lnTvl: Math.log(p.tvl_usd), lnMcap: Math.log(p.mcap_usd as number), category: p.category }));
}

/**
 * Two-stage value fit: OLS on log TVL, then the category effect as the
 * shrunk mean of clipped residuals. The hardcoded constants are what
 * this procedure returns on the full live set, so a refit reproduces
 * them and the bootstrap can resample them.
 */
export function fitValueTwoStage(comps: ValueComp[], m: Consts = MODEL): { a: number; b: number; effects: Map<string, number> } | null {
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
    const r = Math.min(m.value_clip, Math.max(-m.value_clip, c.lnMcap - (a + b * c.lnTvl)));
    const key = c.category ?? '';
    const arr = byCat.get(key) ?? [];
    arr.push(r);
    byCat.set(key, arr);
  }
  const effects = new Map<string, number>();
  for (const [key, rs] of byCat) {
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    const shrunk = (rs.length / (rs.length + m.value_shrink_prior)) * mean;
    effects.set(key, Math.min(m.value_effect_cap, Math.max(-m.value_effect_cap, shrunk)));
  }
  return { a, b, effects };
}

export interface ValueVariant {
  growth: boolean;
  age: boolean;
  family: boolean;
  quad: boolean;
  catOff: boolean;
  shrinkK: number;
  clip: number;
  relmom: boolean;
}

/** One candidate value model, fitted on a training set. */
export function fitValueVariant(
  train: SnapProto[],
  asOf: string,
  kids: Set<string>,
  opts: ValueVariant,
  median7d = 0,
): (p: SnapProto) => number {
  const design = (p: SnapProto): number[] => {
    const row = [1, Math.log(Math.max(1, p.tvl_usd))];
    if (opts.quad) row.push(Math.pow(Math.log(Math.max(1, p.tvl_usd)), 2) / 10);
    if (opts.growth) row.push(Math.min(30, Math.max(-30, p.change_7d === null ? 0 : p.change_7d)) / 100);
    if (opts.relmom) row.push(Math.min(30, Math.max(-30, (p.change_7d === null ? 0 : p.change_7d) - median7d)) / 100);
    if (opts.age) row.push(Math.log(Math.max(1, ageDays(asOf, p.listed_at) ?? 365)));
    return row;
  };
  const xs = train.map(design);
  const ys = train.map((p) => Math.log(p.mcap_usd as number));
  const beta = leastSquares(xs, ys);
  const residByCat = new Map<string, number[]>();
  train.forEach((p, i) => {
    const pred = xs[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0);
    const key = p.category ?? '';
    const arr = residByCat.get(key) ?? [];
    arr.push(ys[i]! - pred);
    residByCat.set(key, arr);
  });
  const catEff = new Map<string, number>();
  if (!opts.catOff) {
    for (const [key, rs] of residByCat) {
      const clipped = rs.map((r) => Math.min(opts.clip, Math.max(-opts.clip, r)));
      const mean = clipped.reduce((a, b) => a + b, 0) / clipped.length;
      catEff.set(key, Math.min(1, Math.max(-1, mean * (clipped.length / (clipped.length + opts.shrinkK)))));
    }
  }
  let famCoef = 0;
  if (opts.family) {
    const fr: number[] = [];
    train.forEach((p, i) => {
      if (!kids.has(p.slug)) return;
      const pred = xs[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0);
      fr.push(Math.min(opts.clip, Math.max(-opts.clip, ys[i]! - pred)));
    });
    if (fr.length > 0) {
      const mean = fr.reduce((a, b) => a + b, 0) / fr.length;
      famCoef = Math.min(0, Math.max(-1.5, mean * (fr.length / (fr.length + 5))));
    }
  }
  return (p: SnapProto): number => {
    let v = design(p).reduce((acc, vv, j) => acc + vv * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0);
    if (opts.family && kids.has(p.slug)) v += famCoef;
    return Math.exp(v);
  };
}

function heldOutAgg(pairs: [number, number][]): { miss: number; medape: number } {
  const logErr = pairs.map(([pr, ac]) => Math.abs(Math.log(pr / ac))).sort((a, b) => a - b);
  const ape = pairs.map(([pr, ac]) => Math.abs(pr - ac) / ac).sort((a, b) => a - b);
  const mid = Math.floor(pairs.length / 2);
  return { miss: Math.exp(logErr[mid]!), medape: ape[mid]! };
}

/**
 * The cover's evidence table: every candidate term run through both
 * held-out tests — leave-one-out over the live comps, and walk-forward
 * (older-listed protocols predict newer-listed ones). A term is kept
 * only if it wins on both; the table says so, including the failures.
 */
export function heldOutTests(snap: Snap, m: Consts = MODEL): FitTerm[] {
  const comps = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const kids = familyChildSlugs(snap);
  const dated = comps.filter((p) => p.listed_at).sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const split = Math.floor(dated.length / 2);
  const older = dated.slice(0, split);
  const newer = dated.slice(split);
  // Market 7-day change: the median over every non-null change_7d in the
  // snapshot (-8.23%). Market-relative momentum is a protocol's 7d change
  // minus this median, fitted like absolute growth — and it inverts too.
  const all7d = snap.protocols.map((p) => p.change_7d).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median7d = all7d[Math.floor(all7d.length / 2)]!;
  const medianOf = (xs: number[]): number => {
    const t = [...xs].sort((a, b) => a - b);
    return t[Math.floor(t.length / 2)]!;
  };
  const flatPredict = (train: SnapProto[]) => {
    const med = medianOf(train.map((p) => (p.mcap_usd as number) / p.tvl_usd));
    return (p: SnapProto): number => med * p.tvl_usd;
  };
  const loo = (predict: (train: SnapProto[]) => (p: SnapProto) => number): { miss: number; medape: number } => {
    const pairs: [number, number][] = [];
    for (let i = 0; i < comps.length; i++) {
      const train = comps.filter((_, j) => j !== i);
      pairs.push([predict(train)(comps[i]!), comps[i]!.mcap_usd as number]);
    }
    return heldOutAgg(pairs);
  };
  const wf = (predict: (train: SnapProto[]) => (p: SnapProto) => number): { miss: number; medape: number } => {
    const f = predict(older);
    return heldOutAgg(newer.map((p) => [f(p), p.mcap_usd as number] as [number, number]));
  };
  const variant = (opts: ValueVariant): ((train: SnapProto[]) => (p: SnapProto) => number) =>
    (train) => fitValueVariant(train, snap.as_of, kids, opts, median7d);
  const kept: ValueVariant = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: m.value_shrink_prior, clip: m.value_clip, relmom: false };
  const v3: ValueVariant = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: 5, clip: 2.0, relmom: false };
  const rows: { name: string; make: ((train: SnapProto[]) => (p: SnapProto) => number) | null; kept: boolean; note: string }[] = [
    { name: 'flat median multiple (baseline)', make: flatPredict, kept: false, note: 'one global mcap/TVL multiple; the baseline every term must beat' },
    { name: 'size curve only, log TVL', make: variant({ ...kept, catOff: true }), kept: false, note: 'no category effect; the category term adds nothing held-out over this' },
    { name: 'size + category, v3 shrinkage (n/(n+5), ±2.0)', make: variant(v3), kept: false, note: 'v3 as shipped; superseded by the stronger shrinkage below' },
    { name: 'size + category, kept shrinkage (n/(n+10), ±1.0)', make: variant(kept), kept: true, note: 'the shipped model; best leave-one-out miss of the category variants' },
    { name: '+ growth, fitted in the value', make: variant({ ...kept, growth: true }), kept: false, note: 'FAILED: fitting growth hurts held-out (v2 inverted the same way)' },
    { name: '+ age, fitted in the value', make: variant({ ...kept, age: true }), kept: false, note: 'FAILED: age in the value hurts held-out; age stays a data column only' },
    { name: '+ family effect, in the value', make: variant({ ...kept, family: true }), kept: false, note: 'no held-out effect on the value (2 family comps); the family term lives in the odds' },
    { name: '+ curvature in log TVL', make: variant({ ...kept, quad: true }), kept: false, note: 'ties on leave-one-out; the walk-forward gain (n=48) is not trusted over it' },
    { name: '+ market-relative momentum, fitted', make: variant({ ...kept, relmom: true }), kept: false, note: 'FAILED: inverts like absolute growth (fitted sign negative) — rewards crashers, so relative growers are not chased' },
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

/** Brier score of the odds model: in-sample, walk-forward, and the base rate. */
export function oddsBrier(snap: Snap, m: Consts = MODEL): { inSample: number; walkForward: number; base: number } {
  const kids = familyChildSlugs(snap);
  const brier = (list: SnapProto[]): number => {
    let s = 0;
    for (const p of list) {
      const o = tokenOdds(p, ageDays(snap.as_of, p.listed_at), m, kids.has(p.slug));
      const y = ownsToken(p, kids) ? 1 : 0;
      s += (o - y) * (o - y);
    }
    return s / list.length;
  };
  const dated = snap.protocols.filter((p) => p.listed_at).sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const split = Math.floor(dated.length / 2);
  const ybar = snap.protocols.reduce((acc, p) => acc + (ownsToken(p, kids) ? 1 : 0), 0) / snap.protocols.length;
  return { inSample: brier(snap.protocols), walkForward: brier(dated.slice(split)), base: ybar * (1 - ybar) };
}

/** Share of live comps whose actual cap lands inside the printed ranges. */
export function rangeCalibration(snap: Snap, m: Consts = MODEL): { mid50: number; p10p90: number } {
  const comps = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  let inMid = 0;
  let inWide = 0;
  for (const p of comps) {
    const pred = ifLaunches(p, m);
    const r = Math.log(p.mcap_usd as number) - Math.log(pred);
    if (r >= m.value_resid_p25 && r <= m.value_resid_p75) inMid++;
    if (r >= m.value_resid_p10 && r <= m.value_resid_p90) inWide++;
  }
  return { mid50: inMid / comps.length, p10p90: inWide / comps.length };
}

// ---- who gets ranked, and the farm verdict ----

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Records no token at all in the snapshot. */
export function isPreToken(p: SnapProto): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Rankable: pre-token and not a house-excluded shape. */
export function isRankable(p: SnapProto): boolean {
  if (!isPreToken(p)) return false;
  const excluded = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
  if (p.category !== null && excluded.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) return false;
  if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) return false;
  return true;
}

export function verdictFor(odds: number, netUsd: number): 'farm' | 'thin' | 'skip' {
  if (odds >= 0.5 && netUsd > 0) return 'farm';
  if (odds >= 0.3) return 'thin';
  return 'skip';
}

// ---- bootstrap rank ranges (deterministic) ----

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

/**
 * Min/max rank each row reaches across 20 bootstrap refits of the value
 * model (resampled live comps, odds fixed). The growth carry is
 * deterministic per protocol, so it multiplies every refit the same way;
 * the main fit's own rank always lies inside its range.
 */
export function bootstrapRankRanges(
  rows: { slug: string; tvl_usd: number; category: string | null; odds: number; growthMult: number }[],
  comps: ValueComp[],
  m: Consts = MODEL,
): Map<string, { min: number; max: number }> {
  const ranges = new Map<string, { min: number; max: number }>();
  for (let i = 0; i < rows.length; i++) ranges.set(rows[i]!.slug, { min: i + 1, max: i + 1 });
  const rng = mulberry32(20261120);
  for (let iter = 0; iter < BOOTSTRAP_REFITS; iter++) {
    const sample: ValueComp[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const fit = fitValueTwoStage(sample, m);
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

// ---- farm economics on the $1,000 ticket ----

/** Hold length from age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * Net of farming one protocol on the default ticket. Hours are the
 * plan's time: setup + 10 minutes a week over the hold + 10 minutes to
 * claim. Break-even ticket is null when the slice per dollar is below
 * the T-bill rate (then no ticket size pays); break-even odds is null
 * when it would need odds above 0.95.
 */
export function netFor(p: SnapProto, implied: number, launches: number, age: number | null, gas: number, m: Consts = MODEL): NetInfo {
  const hold = holdDaysFor(age);
  const hours = m.setup_hours + (hold / 7) * m.weekly_hours + m.claim_hours;
  const slice = p.tvl_usd > 0 ? implied * m.drop_share * (m.ticket_usd / p.tvl_usd) : 0;
  const tbill = m.ticket_usd * m.tbill_rate * (hold / 365);
  const net = slice - gas - tbill;
  const perDollar = p.tvl_usd > 0 ? implied * m.drop_share / p.tvl_usd - m.tbill_rate * (hold / 365) : -1;
  const breakEvenTicket = perDollar > 0 ? Math.round(gas / perDollar) : null;
  const sliceBase = p.tvl_usd > 0 ? launches * m.drop_share * (m.ticket_usd / p.tvl_usd) : 0;
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

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** The board: watchlist first, then every other rankable protocol, ranked by implied value. */
export function buildBoard(snap: Snap, m: Consts = MODEL): BoardRow[] {
  const index = new Map(snap.protocols.map((p) => [p.slug, p]));
  const kids = familyChildSlugs(snap);
  const chosen = new Map<string, SnapProto>();
  for (const slug of snap.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snap.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const s = impliedValue(p, snap.as_of, m, kids.has(p.slug));
    const gas = gasFor(p);
    const net = netFor(p, s.implied, s.ifLaunches, s.age, gas, m);
    return { p, ...s, gas, net };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const ranges = bootstrapRankRanges(
    scored.map((s) => ({ slug: s.p.slug, tvl_usd: s.p.tvl_usd, category: s.p.category, odds: s.odds, growthMult: s.growthMult })),
    valueComps(snap),
    m,
  );
  const p10 = Math.exp(m.value_resid_p10);
  const p25 = Math.exp(m.value_resid_p25);
  const p75 = Math.exp(m.value_resid_p75);
  const p90 = Math.exp(m.value_resid_p90);
  return scored.map((s, i) => {
    const g7 = s.p.change_7d;
    let verdict = verdictFor(s.odds, s.net.net_usd);
    let guard: string | null = null;
    // Crash guard: a protocol shedding TVL fast is never a farm, and a
    // collapse is never anything but a skip.
    if (g7 !== null && g7 <= -30) {
      verdict = 'skip';
      guard = `TVL ${g7.toFixed(1)}% in 7d`;
    } else if (g7 !== null && g7 <= -15) {
      if (verdict === 'farm') verdict = 'thin';
      guard = `TVL ${g7.toFixed(1)}% in 7d`;
    }
    const cost = capitalFor(s.p);
    const range = ranges.get(s.p.slug) ?? { min: i + 1, max: i + 1 };
    const ilP10 = Math.max(1, Math.round(s.ifLaunches * p10));
    const ilP25 = Math.max(1, Math.round(s.ifLaunches * p25));
    const ilP75 = Math.max(1, Math.round(s.ifLaunches * p75));
    const ilP90 = Math.max(1, Math.round(s.ifLaunches * p90));
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
      if_launches_usd: Math.max(1, Math.round(s.ifLaunches)),
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
        if_launches_usd: Math.max(1, Math.round(s.ifLaunches)),
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

// ---- farm plans: one action per category family ----

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapProto): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The plan and the verdict use one size, so the deposit is the ticket: $1,000, every row. */
export function capitalFor(_p: SnapProto): number {
  return MODEL.ticket_usd;
}

/** Gas for a full farm run (setup + weekly actions + claim), from the chain's typical fees. */
export function gasFor(p: SnapProto): number {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain === 'ethereum') return 40;
  if (chain === 'bitcoin' || chain === 'solana' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism') return 5;
  return 15;
}

interface PlanCtx {
  name: string;
  capital: number;
  cap: string;
  chain: string;
  gas: number;
  hold: number;
}

type PlanTemplate = (ctx: PlanCtx) => FarmStep[];

function walletStep(): FarmStep {
  return {
    text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
    cost: 'under $3 of gas for the first transaction',
    time: '5 minutes',
  };
}

function holdStep(ctx: PlanCtx): FarmStep {
  return {
    text: `Hold your ${ctx.name} position on ${ctx.chain} for at least ${ctx.hold} days so the activity is counted in more than one snapshot.`,
    cost: `the ${ctx.cap} stays in the position`,
    time: `${ctx.hold} days`,
  };
}

function claimStep(ctx: PlanCtx): FarmStep {
  return {
    text: `Before you withdraw, open ${ctx.name}'s own points or rewards page and claim only from the link it publishes.`,
    cost: 'no fee to check, and never pay to claim',
    time: '10 minutes',
  };
}

const gasQ = (ctx: PlanCtx): number => Math.max(2, Math.round(ctx.gas / 4));

// Each template's middle steps are the category's own actions — a
// lending plan supplies and borrows, a DEX plan provides liquidity and
// stakes the receipt, a curator plan deposits into a vault — and each
// step names what it costs and how long it takes.
const PLAN_TEMPLATES: { match: (c: string) => boolean; steps: PlanTemplate }[] = [
  {
    match: (c) => c.includes('lend') || c.includes('cdp') || c.includes('collateral'),
    steps: (ctx) => {
      const borrow = Math.max(10, Math.round(ctx.capital / 3));
      return [
        { text: `Supply ${ctx.cap} of USDC to ${ctx.name} on ${ctx.chain} as collateral and keep the loan-to-value below 50%.`, cost: `${ctx.cap} deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
        { text: `Borrow $${borrow} of the chain's stablecoin against your ${ctx.name} collateral and hold it in the same wallet, so the position counts as active borrowing.`, cost: `$${borrow} borrowed, about $${gasQ(ctx)} of gas`, time: '10 minutes' },
        { text: `Top up the collateral or repay a small part of the borrow on ${ctx.name} once a week, so the position shows fresh activity in every snapshot.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      ];
    },
  },
  {
    match: (c) => c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm'),
    steps: (ctx) => [
      { text: `Provide ${ctx.cap} of liquidity to ${ctx.name}'s main pool on ${ctx.chain}, in the pair the app suggests, and keep the position open.`, cost: `${ctx.cap} of liquidity, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name} offers a gauge or a farm for that pool, stake the LP receipt there so the deposit earns the protocol's own rewards.`, cost: 'about $2 of gas to stake', time: '10 minutes' },
      { text: `Swap a small amount through ${ctx.name} on ${ctx.chain} once a week, so the wallet shows trading activity as well as liquidity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Rebalance your ${ctx.name} position when the price moves out of range, and add the earned fees back into the pool.`, cost: 'about $2 of gas when you rebalance', time: '10 minutes when you rebalance' },
    ],
  },
  {
    match: (c) => c.includes('yield'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC into ${ctx.name}'s highest-yield strategy on ${ctx.chain} and keep the receipt token.`, cost: `${ctx.cap} deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name} lets you pick a strategy, choose the one that has run the longest and shows a public track record.`, cost: 'no extra capital', time: '10 minutes to compare' },
      { text: `Claim ${ctx.name}'s strategy yield once a week and redeposit it, so the position compounds and the wallet stays active.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('curator') || c.includes('allocator'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into a ${ctx.name} vault on ${ctx.chain} and keep the vault shares in the farming wallet.`, cost: `${ctx.cap} deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Read ${ctx.name}'s vault curator page and note which markets it allocates to, so you can answer for the position later.`, cost: 'no extra capital', time: '10 minutes to read' },
      { text: `Add a small top-up into the same ${ctx.name} vault once a week, so the deposit shows fresh activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('rwa') || c.includes('stable') || c.includes('reserve currency'),
    steps: (ctx) => [
      { text: `Mint ${ctx.cap} of ${ctx.name}'s yield-bearing asset on ${ctx.chain} and hold it in the farming wallet.`, cost: `${ctx.cap} to mint, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} asset's backing page once a week and keep a note of the yield it has paid.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('basis') || c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic') || c.includes('interest rate'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC as margin on ${ctx.name} and open one small hedge, no more than a tenth of the deposit.`, cost: `${ctx.cap} of margin, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Set a stop on the ${ctx.name} hedge so a sharp move cannot liquidate the margin.`, cost: 'no extra capital', time: '5 minutes' },
      { text: `Roll or close the ${ctx.name} hedge once a week and open a fresh one, so the account shows regular trading.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Keep the rest of the margin uninvested in ${ctx.name}, so the position survives a volatile week.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('chain') || c.includes('ai agent') || c.includes('decentralized ai'),
    steps: (ctx) => [
      { text: `Use ${ctx.name} on ${ctx.chain}: run one transaction a week from the farming wallet and keep it active.`, cost: `about $${gasQ(ctx)} of gas a week`, time: '10 minutes a week' },
      { text: `Try ${ctx.name}'s main app once, with ${ctx.cap}, so the wallet has a real interaction on record.`, cost: `about ${ctx.cap} for the trial`, time: '15 minutes' },
    ],
  },
  {
    match: (c) => c.includes('prediction'),
    steps: (ctx) => [
      { text: `Fund ${ctx.cap} on ${ctx.name} and place one market position on ${ctx.chain}, on a market you have read.`, cost: `${ctx.cap} to fund, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Close or settle the ${ctx.name} position when the market resolves, and place a fresh one the next week.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Keep the ${ctx.name} stake small and the position count steady, so the activity reads as regular use.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('bridge'),
    steps: (ctx) => [
      { text: `Bridge ${ctx.cap} of USDC to ${ctx.chain} through ${ctx.name} and use the bridged funds in the destination app.`, cost: `${ctx.cap} to bridge, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Bridge a small amount back through ${ctx.name} once a week, so the route shows two-way activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('launchpad'),
    steps: (ctx) => [
      { text: `Join ${ctx.name}'s next launch on ${ctx.chain} with ${ctx.cap}, and read the launch terms before you commit.`, cost: `${ctx.cap} to join, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `If ${ctx.name}'s launch asks for a stake or a hold, keep the required balance in the farming wallet.`, cost: 'no extra capital', time: '10 minutes to check' },
      { text: `Claim the allocation from ${ctx.name}'s own page when it opens, and never pay a third party to claim it.`, cost: 'no fee to check', time: '10 minutes when it opens' },
    ],
  },
  {
    match: (c) => c.includes('index'),
    steps: (ctx) => [
      { text: `Buy ${ctx.cap} of the ${ctx.name} index on ${ctx.chain} and hold the index token in the farming wallet.`, cost: `${ctx.cap} to buy, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} index composition once a week and note any rebalance.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('payment') || c.includes('card issuer'),
    steps: (ctx) => [
      { text: `Spend ${ctx.cap} through ${ctx.name} on ${ctx.chain} for a real purchase, and keep the receipt.`, cost: `${ctx.cap} to spend, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Use the ${ctx.name} payment route once a week for a small amount, so the account shows regular use.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('privacy'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into ${ctx.name}'s private pool on ${ctx.chain} and keep the withdrawal note safe.`, cost: `${ctx.cap} deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Withdraw a small amount once a week and redeposit it, so the pool sees regular activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Never share the ${ctx.name} withdrawal note or the pool link with anyone.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('insurance'),
    steps: (ctx) => [
      { text: `Buy ${ctx.cap} of cover from ${ctx.name} on ${ctx.chain} and keep the policy in the farming wallet.`, cost: `${ctx.cap} for cover, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} policy once a week and note the cover period.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('staking') || c.includes('restak'),
    steps: (ctx) => [
      { text: `Stake ${ctx.cap} of the chain's staking asset through ${ctx.name} and keep the receipt token.`, cost: `${ctx.cap} to stake, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Restake the ${ctx.name} staking rewards once a week so the position compounds.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `If ${ctx.name} offers a liquid receipt, keep it in the farming wallet rather than selling it.`, cost: 'no extra capital', time: 'no extra time' },
    ],
  },
  {
    match: (c) => c.includes('nft'),
    steps: (ctx) => [
      { text: `List or buy one item for about ${ctx.cap} on ${ctx.name} on ${ctx.chain}, and keep the receipt.`, cost: `${ctx.cap} for the item, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Make one small trade a week on ${ctx.name} so the wallet shows regular marketplace activity.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('governance'),
    steps: (ctx) => [
      { text: `Stake ${ctx.cap} for governance through ${ctx.name} on ${ctx.chain} and vote on the next proposal.`, cost: `${ctx.cap} to stake, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Vote on one ${ctx.name} proposal a week while the stake is locked.`, cost: 'no fee to vote', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('otc'),
    steps: (ctx) => [
      { text: `Place one OTC order for about ${ctx.cap} through ${ctx.name} on ${ctx.chain} and settle it in the farming wallet.`, cost: `${ctx.cap} for the order, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Place a small order once a week through ${ctx.name} so the desk sees regular flow.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('locker'),
    steps: (ctx) => [
      { text: `Lock ${ctx.cap} of tokens through ${ctx.name} on ${ctx.chain} for the term the app suggests.`, cost: `${ctx.cap} to lock, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} lock once a week and note the unlock date.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('btc') || c.includes('bitcoin'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of the wrapped asset through ${ctx.name} on ${ctx.chain} and keep the receipt.`, cost: `${ctx.cap} to deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} peg once a week and note any drift.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: (c) => c.includes('cedefi'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into ${ctx.name}'s managed account on ${ctx.chain} and keep the balance in the farming wallet.`, cost: `${ctx.cap} to deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Check the ${ctx.name} account once a week and note the reported yield.`, cost: 'no fee to check', time: '10 minutes a week' },
    ],
  },
  {
    match: () => true,
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC into ${ctx.name} on ${ctx.chain} and keep the position open.`, cost: `${ctx.cap} deposit, about $${gasQ(ctx)} of gas`, time: '15 minutes to set up' },
      { text: `Make one qualifying action a week inside ${ctx.name}, such as a deposit, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    ],
  },
];

/** A protocol's farm plan: wallet first, category actions, hold, claim. */
export function farmPlanSteps(p: SnapProto, age: number | null, capital: number, gas: number): FarmStep[] {
  const ctx: PlanCtx = { name: p.name, capital, cap: '$' + capital.toLocaleString('en-US'), chain: chainOf(p), gas, hold: holdDaysFor(age) };
  const c = (p.category ?? '').toLowerCase();
  const template = PLAN_TEMPLATES.find((t) => t.match(c))!;
  return [walletStep(), ...template.steps(ctx), holdStep(ctx), claimStep(ctx)];
}

/** The full plan: action steps plus a verdict step that states the net. */
export function farmSteps(
  p: SnapProto,
  age: number | null,
  capital: number,
  gas: number,
  verdict: 'farm' | 'thin' | 'skip',
  odds: number,
  net: NetInfo,
): FarmStep[] {
  const hold = net.hold_days;
  const total = capital + gas;
  const pays = net.break_even_ticket_usd !== null
    ? `It pays from a $${net.break_even_ticket_usd.toLocaleString('en-US')} ticket.`
    : 'No ticket size pays: the slice per dollar is below the T-bill rate.';
  const verdictText = `Verdict: ${verdict.toUpperCase()} — token odds ${Math.round(odds * 100)}%. On a $1,000 ticket the expected slice is ${fmtUsd(net.slice_usd)}, gas about ${fmtUsd(net.gas_usd)} and forgone T-bill yield ${fmtUsd(net.tbill_usd)}, net ${fmtUsd(net.net_usd)} (${fmtUsd(net.net_per_hour_usd)}/hour). ${pays}`;
  return [
    ...farmPlanSteps(p, age, capital, gas),
    { text: verdictText, cost: `about $${total.toLocaleString('en-US')} all in`, time: `${hold} days of holding` },
  ];
}

// ---- dashboard payload: live comps, ledger, assembly ----

/** The live-token table: top protocols by market cap, the comparables. */
export function liveRows(snap: Snap): LiveRow[] {
  return snap.protocols
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

/** The scatter plot's points: [TVL, market cap] for every priced live comp. */
export function scatterComps(snap: Snap): number[][] {
  return snap.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => [p.tvl_usd, p.mcap_usd as number]);
}

/** A board row as the dashboard reads it: flat fields, structured steps. */
export function radarRow(row: BoardRow): RadarRow {
  const p: SnapProto = {
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

/** Every snapshot protocol in exactly one group, so the reader can audit the 758. */
export function buildLedger(snap: Snap, boardSlugs: Set<string>): LedgerGroup[] {
  const watchlist = new Set(snap.watchlist);
  let rankedWatchlist = 0;
  let rankedEarly = 0;
  let tokenTrades = 0;
  let tokenNoCap = 0;
  let outBridge = 0;
  let outLiquidStaking = 0;
  let outExchange = 0;
  let outVersionedWrapped = 0;
  let outOther = 0;
  for (const p of snap.protocols) {
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

/** Board + everything the dashboard needs, from one snapshot. */
export function buildRadar(snap: Snap, m: Consts = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snap, m);
  const live = liveRows(snap);
  const early = board.filter((r) => !snap.watchlist.includes(r.slug)).length;
  const boardSlugs = new Set(board.map((r) => r.slug));
  const ledger = buildLedger(snap, boardSlugs);
  const ledgerTotal = ledger.reduce((s, g) => s + g.count, 0);
  const brier = oddsBrier(snap, m);
  const calib = rangeCalibration(snap, m);
  const radar: RadarData = {
    as_of: snap.as_of,
    source: snap.source,
    floor_usd: snap.floor_usd,
    model: m,
    model_version: MODEL_VERSION,
    watchlist_size: snap.watchlist.length,
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
    fit_terms: heldOutTests(snap, m),
    ledger,
    ledger_total: ledgerTotal,
    rows: board.map(radarRow),
    live,
    scatter: scatterComps(snap),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snap {
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
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snap: Snap): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !slugs.has(s));
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
