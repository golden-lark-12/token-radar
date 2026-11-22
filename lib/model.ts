// Token Radar, model radar-8.
//
// What this build changes against radar-7, and why. The value fit, the
// odds fit, the ranking and the sort are untouched: the board checksum
// stays 63fdb827. What moves is the economics around each row. A row is
// now priced on a deposit sized to its own pool, 0.015% of TVL kept
// between $1,000 and $10,000, and a row is FARM only when its net beats
// the T-bill and pays at least $20 for each hour of hands-on work. The
// evidence block is rebuilt from held-out numbers computed here at
// build time, with two negative controls, bootstrap standard errors and
// bootstrap rank ranges, so every figure the page prints is a number
// this file computed from the snapshot, never a typed-in claim. The
// farm plans get a computed exit rule from the snapshot's own 7-day
// distribution, a chain-specific gas token, a test deposit, and step
// times that add up to the hours behind each row's dollars-per-hour.
//
// The odds answer the survivor question: among peers still tokenless at
// this age, the share that ever record a token by the ceiling, the
// snapshot's oldest cohort at 5.07 years. Older means less likely ever
// to launch, because a protocol that has run five years with no token
// has mostly had its chance.

import { createHash } from 'node:crypto';

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
  odds_floor: number;
  odds_cap: number;
  odds_ceiling_years: number;
  unknown_age_days: number;
  drop_share: number;
  tbill_rate: number;
  setup_hours: number;
  weekly_hours: number;
  claim_hours: number;
  deposit_share: number;
  deposit_min_usd: number;
  deposit_max_usd: number;
  deposit_round_usd: number;
  hourly_floor_usd: number;
  bootstrap_refits: number;
  exit_quantile: number;
}

// Fitted once on the 128 live comps: ordinary least squares on log TVL,
// then shrunk category effects. The dashboard prints these numbers in
// the open, and buildRadar asserts a fresh refit reproduces them.
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
  odds_floor: 0.05,
  odds_cap: 0.95,
  odds_ceiling_years: 5.07,
  unknown_age_days: 365,
  drop_share: 0.07,
  tbill_rate: 0.04,
  setup_hours: 0.25,
  weekly_hours: 0.1667,
  claim_hours: 0.1667,
  deposit_share: 0.00015,
  deposit_min_usd: 1000,
  deposit_max_usd: 10000,
  deposit_round_usd: 100,
  hourly_floor_usd: 20,
  bootstrap_refits: 200,
  exit_quantile: 0.05,
};

export const MODEL_VERSION = 'radar-13';

// Value effect per category, in log points: the shrunk mean of the
// clipped least-squares residuals in the category. A lone residual
// cannot set a category on its own.
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

export interface ValueEvidence {
  loo_miss: number;
  wf_miss: number;
  flat_loo: number;
  flat_wf: number;
  cut_loo: number;
  cut_wf: number;
  w3_loo: number;
  w3_wf: number;
  w3_flat_loo: number;
  w3_flat_wf: number;
  mid_loo: number;
  mid_wf: number;
  wide_loo: number;
  wide_wf: number;
  mid_strict_loo: number;
  mid_strict_wf: number;
  wide_strict_loo: number;
  wide_strict_wf: number;
  placebo_hash_loo: number;
  placebo_hash_wf: number;
  placebo_growth_loo: number;
  placebo_growth_wf: number;
  value_const_se: number;
  value_log_tvl_se: number;
}

export interface OddsEvidence {
  peers: number;
  tokened: number;
  dated: number;
  peers_symbol: number;
  peers_owned: number;
  const: number;
  years: number;
  ln_tvl: number;
  growth: number;
  family: number;
  ceiling_years: number;
  brier_10fold: number;
  brier_10fold_base: number;
  brier_wf_median: number;
  brier_wf_median_base: number;
  brier_wf_cutoff: number;
  brier_wf_cutoff_base: number;
  brier_in_sample: number;
  auc_10fold: number;
  auc_wf: number;
  acc_10fold: number;
  acc_wf: number;
  acc_wf_trainbase: number;
  acc_wf_never: number;
  placebo_hash_brier_10fold: number;
  placebo_hash_brier_wf: number;
  placebo_hash_auc_10fold: number;
  placebo_hash_auc_wf: number;
  placebo_growth_brier_10fold: number;
  placebo_growth_brier_wf: number;
  placebo_growth_auc_10fold: number;
  placebo_growth_auc_wf: number;
  const_se: number;
  years_se: number;
  ln_tvl_se: number;
  growth_se: number;
  family_se: number;
}

export interface FitSummary {
  n_live: number;
  median_multiple: number;
  value_const: number;
  value_log_tvl: number;
  value_const_se: number;
  value_log_tvl_se: number;
  loo_miss: number;
  wf_miss: number;
  flat_loo: number;
  flat_wf: number;
  cut_loo: number;
  cut_wf: number;
  w3_loo: number;
  w3_wf: number;
  w3_flat_loo: number;
  w3_flat_wf: number;
  mid_loo: number;
  mid_wf: number;
  wide_loo: number;
  wide_wf: number;
  mid_strict_loo: number;
  mid_strict_wf: number;
  wide_strict_loo: number;
  wide_strict_wf: number;
  placebo_hash_loo: number;
  placebo_hash_wf: number;
  placebo_growth_loo: number;
  placebo_growth_wf: number;
  baseline_miss: number;
  resid_p10_mult: number;
  resid_p25_mult: number;
  resid_p75_mult: number;
  resid_p90_mult: number;
  odds_brier_10fold: number;
  odds_brier_wf: number;
  odds_brier_base: number;
  odds_auc_10fold: number;
  odds_auc_wf: number;
  odds_acc_wf: number;
  odds_acc_never: number;
  odds_acc_trainbase: number;
  range_mid50_calib: number;
  range_p10p90_calib: number;
  within3_loo: number;
  within3_flat: number;
  note: string;
}

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
  deposit_usd: number;
  slice_usd: number;
  gas_usd: number;
  drop_minus_fees_usd: number;
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

export interface OddsTerms {
  intercept: number;
  years: number;
  ln_tvl: number;
  growth: number;
  family: number;
  logit: number;
  p_age: number;
  p_max: number;
  ever: number;
  twelve_mo: number;
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
  deposit_usd: number;
  drop_minus_fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  slice_usd: number;
  tbill_usd: number;
  hold_days: number;
  exit_tvl_usd: number;
  break_even_ticket_usd: number | null;
  break_even_odds: number | null;
  model: {
    fitted_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    token_odds: number;
    token_odds_12mo: number;
    odds_terms: OddsTerms;
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
  gecko_id: string | null;
  symbol: string | null;
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
  deposit_usd: number;
  drop_minus_fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  slice_usd: number;
  tbill_usd: number;
  hold_days: number;
  exit_tvl_usd: number;
  exit_drop_pct: number;
  break_even_ticket_usd: number | null;
  break_even_odds: number | null;
  category_effect: number;
  fitted_multiple: number;
  growth_multiplier: number;
  token_odds: number;
  token_odds_12mo: number;
  odds_terms: OddsTerms;
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
  symbol: string | null;
  gecko_id: string | null;
  listed_at: string | null;
}

export interface LeagueRow {
  category: string;
  rows: number;
  peers: number;
  peers_tokened: number;
  ever_pct: number;
  median_premium: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: Consts;
  model_version: string;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  priced_size: number;
  value_effects: Record<string, number>;
  odds_beta: number[];
  fit: FitSummary;
  odds_fit: OddsEvidence;
  fit_terms: FitTerm[];
  leagues: LeagueRow[];
  ledger: LedgerGroup[];
  ledger_total: number;
  checksum: string;
  exit_drop_pct: number;
  rows: RadarRow[];
  live: LiveRow[];
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

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Deterministic stream, so every bootstrap and fold is reproducible. */
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

/** Sample standard deviation of a list of numbers. */
function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const ss = values.reduce((a, v) => a + (v - mean) * (v - mean), 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** A quantile by linear interpolation, the numpy default: position (n - 1) * q. */
function quantileInterp(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Solve a small dense linear system by Gauss-Jordan with partial pivoting. */
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

/** Least squares through the normal equations. */
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

function logisticFn(z: number): number {
  const c = Math.max(-30, Math.min(30, z));
  return 1 / (1 + Math.exp(-c));
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtSignedUsd(n: number): string {
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
}

function fmtCompactUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(n).toLocaleString('en-US')}`;
  return `$${n.toFixed(2)}`;
}

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

/** What the token would be worth if it launched today, before odds. */
export function ifLaunches(p: SnapProto, m: Consts = MODEL): number {
  return Math.exp(m.value_const + m.value_log_tvl * Math.log(Math.max(1, p.tvl_usd)) + valueEffect(p.category));
}

/**
 * Protocols that share a name stem with a live-token protocol and carry
 * no token of their own, or the same symbol: children of a family that
 * already has a token. Down-weighted in the odds, never in the value.
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

/** Records a token of its own, not one inherited from a sibling. */
export function ownsToken(p: SnapProto, kids: Set<string>): boolean {
  return p.symbol !== null && p.symbol !== undefined && !kids.has(p.slug);
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCLUDED_SHAPES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A protocol whose shape could ever be a launch: not a bridge, staked
 * product, exchange balance, versioned pool or wrapped product. The
 * house watchlist rule minus the pre-token requirement, so the peer set
 * holds the protocols that already launched too: 442 of them. */
export function passesShape(p: SnapProto): boolean {
  if (p.category !== null && EXCLUDED_SHAPES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) return false;
  if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) return false;
  return true;
}

/** Records no token at all in the snapshot. */
export function isPreToken(p: SnapProto): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Rankable: pre-token and not a house-excluded shape. */
export function isRankable(p: SnapProto): boolean {
  return isPreToken(p) && passesShape(p);
}

// ---- the odds fit: IRLS logistic on the dated peers ----

export interface OddsBeta {
  beta: number[];
  peers: number;
  tokened: number;
  dated: number;
}

function oddsFeatures(p: SnapProto, years: number, isKid: boolean, extra?: number): number[] {
  const row = [1, years, Math.log(Math.max(1, p.tvl_usd) / 100_000_000), (p.change_7d ?? 0) / 100, isKid ? 1 : 0];
  if (extra !== undefined) row.push(extra);
  return row;
}

/**
 * IRLS logistic regression. The family dummy carries a ridge penalty of
 * 16 (it fires on few peers); every other slope is unpenalised, and an
 * extra control column, when present, is unpenalised too. Deterministic:
 * fixed start, fixed iteration cap, no randomness.
 */
export function fitOddsLogistic(
  rows: SnapProto[],
  asOf: string,
  kids: Set<string>,
  extraFn?: (p: SnapProto) => number,
): number[] {
  const dated = rows.filter((p) => p.listed_at !== null);
  const xs = dated.map((p) =>
    oddsFeatures(p, (ageDays(asOf, p.listed_at) ?? 365) / 365.25, kids.has(p.slug), extraFn ? extraFn(p) : undefined),
  );
  const ys = dated.map((p) => (ownsToken(p, kids) ? 1 : 0));
  const k = xs[0]!.length;
  const beta = Array<number>(k).fill(0);
  for (let iter = 0; iter < 80; iter++) {
    const grad = Array<number>(k).fill(0);
    const hess: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      const z = Math.max(-30, Math.min(30, beta.reduce((s, b, j) => s + b * x[j]!, 0)));
      const pr = 1 / (1 + Math.exp(-z));
      const w = pr * (1 - pr);
      for (let a = 0; a < k; a++) {
        grad[a] = grad[a]! + (ys[i]! - pr) * x[a]!;
        for (let b = 0; b < k; b++) hess[a]![b] = hess[a]![b]! + w * x[a]! * x[b]!;
      }
    }
    grad[4] = grad[4]! - 16 * beta[4]!;
    hess[4]![4] = hess[4]![4]! + 16;
    const step = solveLinear(hess, grad);
    let biggest = 0;
    for (let j = 0; j < k; j++) {
      beta[j] = beta[j]! + step[j]!;
      biggest = Math.max(biggest, Math.abs(step[j]!));
    }
    if (biggest < 1e-9) break;
  }
  return beta;
}

/** p(age): the fitted logistic at a given age in years, other features as the row's. */
export function oddsPAt(beta: number[], p: SnapProto, years: number, isKid: boolean, extra?: number): number {
  const x = oddsFeatures(p, years, isKid, extra);
  return logisticFn(beta.reduce((s, b, j) => s + b * x[j]!, 0));
}

export interface EverOdds {
  ever: number;
  twelveMo: number;
  pAge: number;
  pMax: number;
  terms: OddsTerms;
}

/**
 * The life-table transform. pMax is the same logistic at the ceiling age
 * (5.07 years, the snapshot's oldest cohort), with the row's own TVL,
 * growth and family. ever = (pMax - p(age)) / (1 - p(age)): among peers
 * still tokenless at this age, the share that ever record one by the
 * ceiling. 12-month odds use p(age + 1 year) the same way, with the age
 * clamped to the ceiling: past the ceiling there is no further year to
 * wait, so 12-month odds can never exceed ever-odds. Floored and capped
 * at 0.05 / 0.95, as the shipped odds were.
 */
export function everOdds(beta: number[], p: SnapProto, age: number | null, m: Consts = MODEL, isKid = false): EverOdds {
  const ageYears = (age === null ? m.unknown_age_days : age) / 365.25;
  const x = oddsFeatures(p, ageYears, isKid);
  const logit = beta.reduce((s, b, j) => s + b * x[j]!, 0);
  const pAge = logisticFn(logit);
  const pMax = oddsPAt(beta, p, m.odds_ceiling_years, isKid);
  const pNext = oddsPAt(beta, p, Math.min(ageYears + 1, m.odds_ceiling_years), isKid);
  const rawEver = pAge >= 1 ? 0 : (pMax - pAge) / (1 - pAge);
  const rawTwelve = pAge >= 1 ? 0 : (pNext - pAge) / (1 - pAge);
  const ever = Math.min(m.odds_cap, Math.max(m.odds_floor, rawEver));
  const twelveMo = Math.min(m.odds_cap, Math.max(0, rawTwelve));
  return {
    ever,
    twelveMo,
    pAge,
    pMax,
    terms: {
      intercept: round4(beta[0]!),
      years: round4(beta[1]! * ageYears),
      ln_tvl: round4(beta[2]! * x[2]!),
      growth: round4(beta[3]! * x[3]!),
      family: round4(beta[4]! * x[4]!),
      logit: round4(logit),
      p_age: round4(pAge),
      p_max: round4(pMax),
      ever: round4(ever),
      twelve_mo: round4(twelveMo),
    },
  };
}

/**
 * The growth carry: 1 + 0.01 x the 7-day TVL change, clipped to ±25%.
 * A stated projection, not a fit: the fitted growth term failed
 * held-out and is reported as failed in the evidence table.
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
  odds12mo: number;
  oddsDetail: EverOdds;
  categoryEffect: number;
  familyChild: boolean;
}

export function impliedValue(p: SnapProto, asOf: string, beta: number[], m: Consts = MODEL, isKid = false): Scored {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(25, Math.max(-25, finiteNumber(p.change_7d, 0)));
  const growthMult = growthCarry(p.change_7d);
  const launches = ifLaunches(p, m);
  const detail = everOdds(beta, p, age, m, isKid);
  const multiple = p.tvl_usd > 0 ? launches / p.tvl_usd : 0;
  const implied = Math.max(1, Math.round(launches * growthMult * detail.ever));
  return { implied, ifLaunches: launches, growthPct, growthMult, age, multiple, odds: detail.ever, odds12mo: detail.twelveMo, oddsDetail: detail, categoryEffect: valueEffect(p.category), familyChild: isKid };
}

// ---- value fit: least squares, two-stage category effects ----

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
 * Two-stage value fit: ordinary least squares on log TVL, then the
 * category effect as the shrunk mean of clipped residuals. The
 * hardcoded constants are what this returns on the full live set, so a
 * refit reproduces them and the bootstrap can resample them.
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

/** Assert the hardcoded fitted constants equal a fresh refit, to 4 dp. */
export function assertFittedConstants(snap: Snap, m: Consts = MODEL): void {
  const fit = fitValueTwoStage(valueComps(snap), m);
  if (fit === null) throw new Error('fitted constants: no live comps to refit');
  if (round4(fit.a) !== round4(m.value_const) || round4(fit.b) !== round4(m.value_log_tvl)) {
    throw new Error(`fitted constants: refit ${fit.a.toFixed(4)}/${fit.b.toFixed(4)} differs from MODEL ${m.value_const}/${m.value_log_tvl}`);
  }
  for (const [cat, v] of Object.entries(VALUE_EFFECT)) {
    const refit = fit.effects.get(cat);
    if (refit === undefined) continue;
    if (round4(refit) !== round4(v)) {
      throw new Error(`fitted constants: category ${cat} refit ${refit.toFixed(4)} differs from VALUE_EFFECT ${v}`);
    }
  }
}

// ---- value evidence: held-out term table ----

export interface ValueVariantOpts {
  growth: boolean;
  age: boolean;
  family: boolean;
  quad: boolean;
  catOff: boolean;
  shrinkK: number;
  clip: number;
  relmom: boolean;
}

interface CompRec {
  proto: SnapProto;
  lnTvl: number;
  lnMcap: number;
}

function variantDesign(p: SnapProto, asOf: string, opts: ValueVariantOpts, median7d: number): number[] {
  const row = [1, Math.log(Math.max(1, p.tvl_usd))];
  if (opts.quad) row.push(Math.pow(Math.log(Math.max(1, p.tvl_usd)), 2) / 10);
  if (opts.growth) row.push(Math.min(30, Math.max(-30, p.change_7d === null ? 0 : p.change_7d)) / 100);
  if (opts.relmom) row.push(Math.min(30, Math.max(-30, (p.change_7d === null ? 0 : p.change_7d) - median7d)) / 100);
  if (opts.age) row.push(Math.log(Math.max(1, ageDays(asOf, p.listed_at) ?? 365)));
  return row;
}

function fitVariantPredictor(
  train: SnapProto[],
  asOf: string,
  kids: Set<string>,
  opts: ValueVariantOpts,
  median7d: number,
): (p: SnapProto) => number {
  const xs = train.map((p) => variantDesign(p, asOf, opts, median7d));
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
    let v = variantDesign(p, asOf, opts, median7d).reduce((acc, vv, j) => acc + vv * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0);
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
 * held-out tests, leave-one-out over the live comps and walk-forward
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
  const variant = (opts: ValueVariantOpts): ((train: SnapProto[]) => (p: SnapProto) => number) =>
    (train) => fitVariantPredictor(train, snap.as_of, kids, opts, median7d);
  const kept: ValueVariantOpts = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: m.value_shrink_prior, clip: m.value_clip, relmom: false };
  const v3: ValueVariantOpts = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: 5, clip: 2.0, relmom: false };
  const rows: { name: string; make: ((train: SnapProto[]) => (p: SnapProto) => number) | null; kept: boolean; note: string }[] = [
    { name: 'flat median multiple (baseline)', make: flatPredict, kept: false, note: 'one global mcap/TVL multiple; the baseline every term must beat' },
    { name: 'size curve only, log TVL', make: variant({ ...kept, catOff: true }), kept: false, note: 'no category effect; the category term adds nothing held-out over this' },
    { name: 'size + category, v3 shrinkage (n/(n+5), ±2.0)', make: variant(v3), kept: false, note: 'v3 as shipped; superseded by the stronger shrinkage below' },
    { name: 'size + category, kept shrinkage (n/(n+10), ±1.0)', make: variant(kept), kept: true, note: 'the shipped model; best leave-one-out miss of the category variants' },
    { name: '+ growth, fitted in the value', make: variant({ ...kept, growth: true }), kept: false, note: 'loses both tests' },
    { name: '+ age, fitted in the value', make: variant({ ...kept, age: true }), kept: false, note: 'wins WF, loses LOO: fails the both-tests rule; age stays in the odds model' },
    { name: '+ family effect, in the value', make: variant({ ...kept, family: true }), kept: false, note: 'no held-out effect on the value (2 family comps); the family term lives in the odds' },
    { name: '+ curvature in log TVL', make: variant({ ...kept, quad: true }), kept: false, note: 'wins WF, loses LOO: fails the both-tests rule' },
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

// ---- value evidence: held-out pairs, band hits, controls, SEs ----

/** First 8 hex digits of SHA-256(slug), scaled to [-0.5, 0.5]: name noise that must not help. */
export function hashNoise(slug: string): number {
  const hex = createHash('sha256').update(slug).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 4294967296 - 0.5;
}

/** The 7-day growth of the next protocol in slug order, wrapping, clipped to ±30 and scaled to a rate. */
export function nextGrowthFeature(snap: Snap): Map<string, number> {
  const ordered = [...snap.protocols].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const out = new Map<string, number>();
  for (let i = 0; i < ordered.length; i++) {
    const next = ordered[(i + 1) % ordered.length]!;
    const g = next.change_7d === null ? 0 : Math.min(30, Math.max(-30, next.change_7d));
    out.set(ordered[i]!.slug, g / 100);
  }
  return out;
}

interface SplitStats {
  n: number;
  logErrs: number[];
  flatLogErrs: number[];
  w3: number;
  flatW3: number;
  midPrinted: number;
  widePrinted: number;
  midStrict: number;
  wideStrict: number;
}

function splitStats(
  train: SnapProto[],
  test: SnapProto[],
  asOf: string,
  kids: Set<string>,
  m: Consts,
  extraFn?: (p: SnapProto) => number,
): SplitStats {
  const kept: ValueVariantOpts = { growth: false, age: false, family: false, quad: false, catOff: false, shrinkK: m.value_shrink_prior, clip: m.value_clip, relmom: false };
  let predict: (p: SnapProto) => number;
  if (extraFn) {
    const design = (p: SnapProto): number[] => [1, Math.log(Math.max(1, p.tvl_usd)), extraFn(p)];
    const xs = train.map(design);
    const ys = train.map((p) => Math.log(p.mcap_usd as number));
    const beta = leastSquares(xs, ys);
    const residByCat = new Map<string, number[]>();
    train.forEach((p, i) => {
      const pred = xs[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0);
      const key = p.category ?? '';
      const arr = residByCat.get(key) ?? [];
      arr.push(Math.min(m.value_clip, Math.max(-m.value_clip, ys[i]! - pred)));
      residByCat.set(key, arr);
    });
    const catEff = new Map<string, number>();
    for (const [key, rs] of residByCat) {
      const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
      catEff.set(key, Math.min(m.value_effect_cap, Math.max(-m.value_effect_cap, mean * (rs.length / (rs.length + m.value_shrink_prior)))));
    }
    predict = (p: SnapProto): number =>
      Math.exp(design(p).reduce((acc, v, j) => acc + v * beta[j]!, 0) + (catEff.get(p.category ?? '') ?? 0));
  } else {
    predict = fitVariantPredictor(train, asOf, kids, kept, 0);
  }
  const trainResiduals = train.map((p) => Math.log(p.mcap_usd as number) - Math.log(predict(p))).sort((a, b) => a - b);
  const q25 = quantileInterp(trainResiduals, 0.25);
  const q75 = quantileInterp(trainResiduals, 0.75);
  const q10 = quantileInterp(trainResiduals, 0.1);
  const q90 = quantileInterp(trainResiduals, 0.9);
  const med = [...train.map((p) => (p.mcap_usd as number) / p.tvl_usd)].sort((a, b) => a - b)[Math.floor(train.length / 2)]!;
  const stats: SplitStats = { n: test.length, logErrs: [], flatLogErrs: [], w3: 0, flatW3: 0, midPrinted: 0, widePrinted: 0, midStrict: 0, wideStrict: 0 };
  for (const p of test) {
    const actual = p.mcap_usd as number;
    const pred = predict(p);
    const logErr = Math.abs(Math.log(pred / actual));
    stats.logErrs.push(logErr);
    if (pred / actual >= 1 / 3 && pred / actual <= 3) stats.w3++;
    const resid = Math.log(actual) - Math.log(pred);
    if (resid >= m.value_resid_p25 && resid <= m.value_resid_p75) stats.midPrinted++;
    if (resid >= m.value_resid_p10 && resid <= m.value_resid_p90) stats.widePrinted++;
    if (resid >= q25 && resid <= q75) stats.midStrict++;
    if (resid >= q10 && resid <= q90) stats.wideStrict++;
    const flatPred = med * p.tvl_usd;
    stats.flatLogErrs.push(Math.abs(Math.log(flatPred / actual)));
    if (flatPred / actual >= 1 / 3 && flatPred / actual <= 3) stats.flatW3++;
  }
  return stats;
}

function medianUpper(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Every held-out value figure the page prints, computed here from the snapshot. */
export function valueEvidence(snap: Snap, m: Consts = MODEL): ValueEvidence {
  const kids = familyChildSlugs(snap);
  const comps = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const dated = comps.filter((p) => p.listed_at).sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const split = Math.floor(dated.length / 2);
  const older = dated.slice(0, split);
  const newer = dated.slice(split);
  const nextGrowth = nextGrowthFeature(snap);

  const looAgg = { logErrs: [] as number[], flatLogErrs: [] as number[], w3: 0, flatW3: 0, midPrinted: 0, widePrinted: 0, midStrict: 0, wideStrict: 0 };
  const looHash = { logErrs: [] as number[] };
  const looGrowth = { logErrs: [] as number[] };
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const test = [comps[i]!];
    const s = splitStats(train, test, snap.as_of, kids, m);
    looAgg.logErrs.push(...s.logErrs);
    looAgg.flatLogErrs.push(...s.flatLogErrs);
    looAgg.w3 += s.w3;
    looAgg.flatW3 += s.flatW3;
    looAgg.midPrinted += s.midPrinted;
    looAgg.widePrinted += s.widePrinted;
    looAgg.midStrict += s.midStrict;
    looAgg.wideStrict += s.wideStrict;
    const sh = splitStats(train, test, snap.as_of, kids, m, (p) => hashNoise(p.slug));
    looHash.logErrs.push(...sh.logErrs);
    const sg = splitStats(train, test, snap.as_of, kids, m, (p) => nextGrowth.get(p.slug) ?? 0);
    looGrowth.logErrs.push(...sg.logErrs);
  }
  const wf = splitStats(older, newer, snap.as_of, kids, m);
  const wfHash = splitStats(older, newer, snap.as_of, kids, m, (p) => hashNoise(p.slug));
  const wfGrowth = splitStats(older, newer, snap.as_of, kids, m, (p) => nextGrowth.get(p.slug) ?? 0);

  const looSorted = [...looAgg.logErrs].sort((a, b) => a - b);
  const wfSorted = [...wf.logErrs].sort((a, b) => a - b);
  const flatLooSorted = [...looAgg.flatLogErrs].sort((a, b) => a - b);
  const flatWfSorted = [...wf.flatLogErrs].sort((a, b) => a - b);
  const looMiss = Math.exp(medianUpper(looSorted));
  const wfMiss = Math.exp(medianUpper(wfSorted));
  const flatLoo = Math.exp(medianUpper(flatLooSorted));
  const flatWf = Math.exp(medianUpper(flatWfSorted));

  const rng = mulberry32(20261121);
  const compRecs = valueComps(snap);
  const consts: number[] = [];
  const slopes: number[] = [];
  for (let iter = 0; iter < 200; iter++) {
    const sample: ValueComp[] = [];
    for (let i = 0; i < compRecs.length; i++) sample.push(compRecs[Math.floor(rng() * compRecs.length)]!);
    const fit = fitValueTwoStage(sample, m);
    if (fit === null) continue;
    consts.push(fit.a);
    slopes.push(fit.b);
  }

  return {
    loo_miss: looMiss,
    wf_miss: wfMiss,
    flat_loo: flatLoo,
    flat_wf: flatWf,
    cut_loo: 1 - looMiss / flatLoo,
    cut_wf: 1 - wfMiss / flatWf,
    w3_loo: looAgg.w3 / comps.length,
    w3_wf: wf.w3 / newer.length,
    w3_flat_loo: looAgg.flatW3 / comps.length,
    w3_flat_wf: wf.flatW3 / newer.length,
    mid_loo: looAgg.midPrinted / comps.length,
    mid_wf: wf.midPrinted / newer.length,
    wide_loo: looAgg.widePrinted / comps.length,
    wide_wf: wf.widePrinted / newer.length,
    mid_strict_loo: looAgg.midStrict / comps.length,
    mid_strict_wf: wf.midStrict / newer.length,
    wide_strict_loo: looAgg.wideStrict / comps.length,
    wide_strict_wf: wf.wideStrict / newer.length,
    placebo_hash_loo: Math.exp(medianUpper([...looHash.logErrs].sort((a, b) => a - b))),
    placebo_hash_wf: Math.exp(medianUpper([...wfHash.logErrs].sort((a, b) => a - b))),
    placebo_growth_loo: Math.exp(medianUpper([...looGrowth.logErrs].sort((a, b) => a - b))),
    placebo_growth_wf: Math.exp(medianUpper([...wfGrowth.logErrs].sort((a, b) => a - b))),
    value_const_se: sampleStd(consts),
    value_log_tvl_se: sampleStd(slopes),
  };
}

// ---- odds evidence: Brier, AUC, accuracy, controls, SEs ----

function brierOf(preds: number[], ys: number[]): number {
  let s = 0;
  for (let i = 0; i < preds.length; i++) s += (preds[i]! - ys[i]!) * (preds[i]! - ys[i]!);
  return s / preds.length;
}

/** Mann-Whitney AUC; ties count one half. */
function aucOf(preds: number[], ys: number[]): number {
  let pos = 0;
  let neg = 0;
  let wins = 0;
  for (let i = 0; i < preds.length; i++) {
    if (ys[i] === 1) pos++;
    else neg++;
  }
  if (pos === 0 || neg === 0) return 0.5;
  for (let i = 0; i < preds.length; i++) {
    if (ys[i] !== 1) continue;
    for (let j = 0; j < preds.length; j++) {
      if (ys[j] === 1) continue;
      if (preds[i]! > preds[j]!) wins += 1;
      else if (preds[i]! === preds[j]!) wins += 0.5;
    }
  }
  return wins / (pos * neg);
}

function accuracyOf(preds: number[], ys: number[]): number {
  let ok = 0;
  for (let i = 0; i < preds.length; i++) if ((preds[i]! >= 0.5 ? 1 : 0) === ys[i]) ok++;
  return ok / preds.length;
}

/** Every held-out odds figure the page prints, computed here from the snapshot. */
export function oddsEvidence(snap: Snap, kids: Set<string>): OddsEvidence {
  const peers = snap.protocols.filter(passesShape);
  const dated = peers.filter((p) => p.listed_at !== null);
  const tokened = peers.filter((p) => ownsToken(p, kids)).length;
  const peersSymbol = peers.filter((p) => p.symbol !== null && p.symbol !== undefined).length;
  const beta = fitOddsLogistic(peers, snap.as_of, kids);
  const ys = (list: SnapProto[]): number[] => list.map((p) => (ownsToken(p, kids) ? 1 : 0));
  const predsFor = (b: number[], list: SnapProto[], extraFn?: (p: SnapProto) => number): number[] =>
    list.map((p) => oddsPAt(b, p, (ageDays(snap.as_of, p.listed_at) ?? 365) / 365.25, kids.has(p.slug), extraFn ? extraFn(p) : undefined));

  // 10-fold, one fixed-seed shuffle, folds by position in the shuffled order.
  const rng = mulberry32(20261114);
  const order = dated.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  const foldSets: Set<number>[] = [];
  for (let f = 0; f < 10; f++) foldSets.push(new Set(order.filter((_, i) => i % 10 === f)));
  const oof = new Array<number>(dated.length).fill(0);
  const oofHash = new Array<number>(dated.length).fill(0);
  const oofGrowth = new Array<number>(dated.length).fill(0);
  const nextGrowth = nextGrowthFeature(snap);
  for (let f = 0; f < 10; f++) {
    const testIdx = foldSets[f]!;
    const train = dated.filter((_, i) => !testIdx.has(i));
    const test = dated.filter((_, i) => testIdx.has(i));
    const b = fitOddsLogistic(train, snap.as_of, kids);
    const bHash = fitOddsLogistic(train, snap.as_of, kids, (p) => hashNoise(p.slug));
    const bGrowth = fitOddsLogistic(train, snap.as_of, kids, (p) => nextGrowth.get(p.slug) ?? 0);
    test.forEach((p) => {
      const i = dated.indexOf(p);
      oof[i] = oddsPAt(b, p, (ageDays(snap.as_of, p.listed_at) ?? 365) / 365.25, kids.has(p.slug));
      oofHash[i] = oddsPAt(bHash, p, (ageDays(snap.as_of, p.listed_at) ?? 365) / 365.25, kids.has(p.slug), hashNoise(p.slug));
      oofGrowth[i] = oddsPAt(bGrowth, p, (ageDays(snap.as_of, p.listed_at) ?? 365) / 365.25, kids.has(p.slug), nextGrowth.get(p.slug) ?? 0);
    });
  }
  const datedYs = ys(dated);

  // Walk-forward, median split by listing date.
  const byDate = [...dated].sort((a, b) => (a.listed_at as string).localeCompare(b.listed_at as string));
  const half = Math.floor(byDate.length / 2);
  const older = byDate.slice(0, half);
  const newer = byDate.slice(half);
  const betaOlder = fitOddsLogistic(older, snap.as_of, kids);
  const betaOlderHash = fitOddsLogistic(older, snap.as_of, kids, (p) => hashNoise(p.slug));
  const betaOlderGrowth = fitOddsLogistic(older, snap.as_of, kids, (p) => nextGrowth.get(p.slug) ?? 0);
  const newerYs = ys(newer);
  const newerPreds = predsFor(betaOlder, newer);
  const newerPredsHash = predsFor(betaOlderHash, newer, (p) => hashNoise(p.slug));
  const newerPredsGrowth = predsFor(betaOlderGrowth, newer, (p) => nextGrowth.get(p.slug) ?? 0);
  const constBrier = (train: SnapProto[], test: SnapProto[]): number => {
    const c = train.reduce((s, p) => s + (ownsToken(p, kids) ? 1 : 0), 0) / train.length;
    let s = 0;
    for (const p of test) {
      const y = ownsToken(p, kids) ? 1 : 0;
      s += (c - y) * (c - y);
    }
    return s / test.length;
  };

  // Walk-forward cutoff split, kept for completeness.
  const cutoffTrain = dated.filter((p) => (p.listed_at as string) < '2025-07-26');
  const cutoffTest = dated.filter((p) => (p.listed_at as string) >= '2025-07-26');
  const betaCutoff = fitOddsLogistic(cutoffTrain, snap.as_of, kids);

  const peerRate = tokened / peers.length;
  const trainRate = older.reduce((s, p) => s + (ownsToken(p, kids) ? 1 : 0), 0) / older.length;
  const accTrainBase = newerYs.reduce((s, y) => s + (y === 1 ? 1 : 0), 0) / newerYs.length;
  void trainRate;

  // Bootstrap standard errors: 200 refits of the dated peers.
  const boot = mulberry32(20261122);
  const bootBetas: number[][] = [];
  for (let iter = 0; iter < 200; iter++) {
    const sample: SnapProto[] = [];
    for (let i = 0; i < dated.length; i++) sample.push(dated[Math.floor(boot() * dated.length)]!);
    bootBetas.push(fitOddsLogistic(sample, snap.as_of, kids));
  }
  const seOf = (j: number): number => sampleStd(bootBetas.map((b) => b[j]!));

  return {
    peers: peers.length,
    tokened,
    dated: dated.length,
    peers_symbol: peersSymbol,
    peers_owned: tokened,
    const: round4(beta[0]!),
    years: round4(beta[1]!),
    ln_tvl: round4(beta[2]!),
    growth: round4(beta[3]!),
    family: round4(beta[4]!),
    ceiling_years: MODEL.odds_ceiling_years,
    brier_10fold: round4(brierOf(oof, datedYs)),
    brier_10fold_base: round4(peerRate * (1 - peerRate)),
    brier_wf_median: round4(brierOf(newerPreds, newerYs)),
    brier_wf_median_base: round4(constBrier(older, newer)),
    brier_wf_cutoff: round4(brierOf(predsFor(betaCutoff, cutoffTest), ys(cutoffTest))),
    brier_wf_cutoff_base: round4(constBrier(cutoffTrain, cutoffTest)),
    brier_in_sample: round4(brierOf(predsFor(beta, dated), datedYs)),
    auc_10fold: round4(aucOf(oof, datedYs)),
    auc_wf: round4(aucOf(newerPreds, newerYs)),
    acc_10fold: accuracyOf(oof, datedYs),
    acc_wf: accuracyOf(newerPreds, newerYs),
    acc_wf_trainbase: accTrainBase,
    acc_wf_never: 1 - accTrainBase,
    placebo_hash_brier_10fold: round4(brierOf(oofHash, datedYs)),
    placebo_hash_brier_wf: round4(brierOf(newerPredsHash, newerYs)),
    placebo_hash_auc_10fold: round4(aucOf(oofHash, datedYs)),
    placebo_hash_auc_wf: round4(aucOf(newerPredsHash, newerYs)),
    placebo_growth_brier_10fold: round4(brierOf(oofGrowth, datedYs)),
    placebo_growth_brier_wf: round4(brierOf(newerPredsGrowth, newerYs)),
    placebo_growth_auc_10fold: round4(aucOf(oofGrowth, datedYs)),
    placebo_growth_auc_wf: round4(aucOf(newerPredsGrowth, newerYs)),
    const_se: seOf(0),
    years_se: seOf(1),
    ln_tvl_se: seOf(2),
    growth_se: seOf(3),
    family_se: seOf(4),
  };
}

// ---- bootstrap rank ranges (200 refits, P10-P90, nearest rank) ----

/**
 * The rank each row reaches across 200 bootstrap refits of the value
 * model (resampled live comps, odds fixed), reported as the P10-P90
 * range by nearest rank, widened to include the row's own rank.
 */
export function bootstrapRankRanges(
  rows: { slug: string; tvl_usd: number; category: string | null; odds: number; growthMult: number }[],
  comps: ValueComp[],
  m: Consts = MODEL,
): Map<string, { min: number; max: number }> {
  const allRanks = new Map<string, number[]>();
  for (const r of rows) allRanks.set(r.slug, []);
  const rng = mulberry32(20261120);
  for (let iter = 0; iter < m.bootstrap_refits; iter++) {
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
      allRanks.get(s.slug)!.push(i + 1);
    });
  }
  const ranges = new Map<string, { min: number; max: number }>();
  rows.forEach((r, i) => {
    const ranks = [...(allRanks.get(r.slug) ?? [i + 1])].sort((a, b) => a - b);
    const p10 = ranks[Math.ceil(0.1 * ranks.length) - 1]!;
    const p90 = ranks[Math.ceil(0.9 * ranks.length) - 1]!;
    ranges.set(r.slug, { min: Math.min(p10, i + 1), max: Math.max(p90, i + 1) });
  });
  return ranges;
}

// ---- the deposit, the net and the verdict ----

/**
 * The deposit for one row: 0.015% of its TVL, rounded to the nearest
 * $100 and kept between $1,000 and $10,000, so every row is priced on
 * the same share of its own pool.
 */
export function depositFor(p: SnapProto, m: Consts = MODEL): number {
  const sized = Math.round((m.deposit_share * p.tvl_usd) / m.deposit_round_usd) * m.deposit_round_usd;
  return Math.min(m.deposit_max_usd, Math.max(m.deposit_min_usd, sized));
}

/** Hold length from age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * The economics of farming one row on its own deposit. Hours are the
 * plan's time: 15 minutes to set up, 10 minutes a week over the hold,
 * 10 minutes to claim. Drop minus fees is the slice after gas, before
 * the T-bill benchmark; the net subtracts the T-bill too. Break-even
 * ticket is null when the slice per dollar is below the T-bill rate;
 * break-even odds is null when it would need odds above 0.95.
 */
export function netFor(
  p: SnapProto,
  implied: number,
  launches: number,
  age: number | null,
  gas: number,
  deposit: number,
  m: Consts = MODEL,
): NetInfo {
  const hold = holdDaysFor(age);
  const hours = m.setup_hours + (hold / 7) * m.weekly_hours + m.claim_hours;
  const slice = p.tvl_usd > 0 ? implied * m.drop_share * (deposit / p.tvl_usd) : 0;
  const tbill = deposit * m.tbill_rate * (hold / 365);
  const net = slice - gas - tbill;
  const perDollar = p.tvl_usd > 0 ? implied * m.drop_share / p.tvl_usd - m.tbill_rate * (hold / 365) : -1;
  const breakEvenTicket = perDollar > 0 ? Math.round(gas / perDollar) : null;
  const sliceBase = p.tvl_usd > 0 ? launches * m.drop_share * (deposit / p.tvl_usd) : 0;
  const oddsStar = sliceBase > 0 ? (gas + tbill) / sliceBase : Number.POSITIVE_INFINITY;
  const breakEvenOdds = oddsStar > 0 && oddsStar <= 0.95 ? round4(oddsStar) : null;
  return {
    hold_days: hold,
    hours: round4(hours),
    deposit_usd: deposit,
    slice_usd: round2(slice),
    gas_usd: gas,
    drop_minus_fees_usd: round2(slice - gas),
    tbill_usd: round2(tbill),
    net_usd: round2(net),
    net_per_hour_usd: round2(net / hours),
    break_even_ticket_usd: breakEvenTicket,
    break_even_odds: breakEvenOdds,
  };
}

/**
 * The verdict rule, radar-13. SKIP first: a row whose net after the
 * T-bill is zero or negative never pays on its own deposit, and a row
 * whose break-even odds are null never pays either, because breaking
 * even would need odds above the 0.95 cap. FARM needs the odds, a
 * positive net after the T-bill, and at least $20 for each hour of
 * work. SKIP also when the odds are low or the fees exceed the drop.
 * Everything else is THIN. The crash guard is applied on top of this,
 * in the board assembly.
 */
export function verdictFor(
  odds: number,
  netUsd: number,
  netPerHour: number,
  slice: number,
  gas: number,
  m: Consts = MODEL,
  breakEvenOdds: number | null = null,
): 'farm' | 'thin' | 'skip' {
  if (netUsd <= 0 || breakEvenOdds === null) return 'skip';
  if (odds >= 0.5 && netPerHour >= m.hourly_floor_usd) return 'farm';
  if (odds < 0.3 || slice <= gas) return 'skip';
  return 'thin';
}

/** The 5th percentile of every reported 7-day change: the exit threshold. */
export function exitDrop(snap: Snap, m: Consts = MODEL): number {
  const changes = snap.protocols.map((p) => p.change_7d).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (changes.length === 0) return 0;
  return changes[Math.floor(m.exit_quantile * changes.length)]!;
}

// ---- farm plans: one action per category family, times that add up ----

const SETUP_INSIDE = 'inside the 15-minute setup';
const WEEKLY_CHECK = '10 minutes a week';
const WEEK_CHECK_INSIDE = 'inside the 10-minute weekly check';
const NO_EXTRA = 'no extra time beyond the weekly checks';

/** Gas for a full farm run, from the chain's typical fees. */
export function gasFor(p: SnapProto): number {
  const chain = (p.chains[0] ?? '').toLowerCase();
  if (chain === 'ethereum') return 40;
  if (chain === 'bitcoin' || chain === 'solana' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism') return 5;
  return 15;
}

function chainOf(p: SnapProto): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The gas token of the row's first chain, by name; anything else names the chain's native token. */
export function gasTokenFor(p: SnapProto): string {
  const chain = (p.chains[0] ?? '').toLowerCase();
  const table: Record<string, string> = {
    ethereum: 'ETH',
    base: 'ETH',
    arbitrum: 'ETH',
    ink: 'ETH',
    'zksync era': 'ETH',
    solana: 'SOL',
    binance: 'BNB',
    bitcoin: 'BTC',
    'hyperliquid l1': 'HYPE',
    monad: 'MON',
    stellar: 'XLM',
    flare: 'FLR',
    plasma: 'XPL',
    sui: 'SUI',
    polygon: 'POL',
    avalanche: 'AVAX',
    tron: 'TRX',
    bittensor: 'TAO',
    mantle: 'MNT',
    algorand: 'ALGO',
    ripple: 'XRP',
  };
  return table[chain] ?? "the chain's native gas token";
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

const gasQuarter = (ctx: PlanCtx): number => Math.max(2, Math.round(ctx.gas / 4));

// Each template's steps name the category's own actions, with a cost
// and a time on every step. Exactly one step per plan carries the
// weekly 10 minutes; the setup steps sit inside the 15-minute setup,
// the check steps inside the weekly check, and the claim takes the
// final 10 minutes, so the step times add up to the row's hours.
const PLAN_TEMPLATES: { match: (c: string) => boolean; steps: PlanTemplate }[] = [
  {
    match: (c) => c.includes('lend') || c.includes('cdp') || c.includes('collateral'),
    steps: (ctx) => {
      const borrow = Math.max(10, Math.round(ctx.capital / 3));
      return [
        { text: `Deposit ${ctx.cap} of USDC into ${ctx.name} on ${ctx.chain} as collateral, keeping the loan-to-value below 50%.`, cost: `${ctx.cap} deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
        { text: `Borrow $${borrow} of the chain's stablecoin against that ${ctx.name} collateral and leave it in the same wallet, so the position counts as active borrowing.`, cost: `$${borrow} borrowed, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
        { text: `Once a week, add a little collateral or repay a small part of the borrow on ${ctx.name}, so the position shows fresh activity in every snapshot.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      ];
    },
  },
  {
    match: (c) => c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm') || c.includes('farm'),
    steps: (ctx) => [
      { text: `Add ${ctx.cap} of liquidity to ${ctx.name}'s main pool on ${ctx.chain}, in the pair the app suggests, and leave the position open.`, cost: `${ctx.cap} of liquidity, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `If ${ctx.name} runs a gauge or a farm for that pool, stake the LP receipt there so the deposit earns the protocol's own rewards.`, cost: 'about $2 of gas to stake', time: SETUP_INSIDE },
      { text: `Swap a small amount through ${ctx.name} on ${ctx.chain} once a week, so the wallet shows trading activity as well as liquidity.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      { text: `When the price moves out of range, rebalance your ${ctx.name} position and put the earned fees back into the pool.`, cost: 'about $2 of gas when you rebalance', time: WEEK_CHECK_INSIDE },
    ],
  },
  {
    match: (c) => c.includes('yield'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC into ${ctx.name}'s longest-running strategy on ${ctx.chain} and keep the receipt token.`, cost: `${ctx.cap} deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Take 10 minutes to compare ${ctx.name}'s strategies and pick the one with the longest public track record.`, cost: '$0 extra capital', time: SETUP_INSIDE },
      { text: `Claim ${ctx.name}'s strategy yield once a week and put it back in, so the position compounds and the wallet stays active.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('curator') || c.includes('allocator'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into a ${ctx.name} vault on ${ctx.chain} and keep the vault shares in the farming wallet.`, cost: `${ctx.cap} deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Read ${ctx.name}'s vault curator page for 10 minutes and note the 3 markets it allocates to most, so you can speak for the position later.`, cost: '$0 extra capital', time: SETUP_INSIDE },
      { text: `Add a small top-up into the same ${ctx.name} vault once a week, so the deposit shows fresh activity.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('rwa') || c.includes('stable') || c.includes('reserve currency'),
    steps: (ctx) => [
      { text: `Mint ${ctx.cap} of ${ctx.name}'s yield-bearing asset on ${ctx.chain} and hold it in the farming wallet.`, cost: `${ctx.cap} to mint, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} asset's backing page once a week and note the yield it has paid over the last 7 days.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('basis') || c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic') || c.includes('interest rate'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC as margin on ${ctx.name} and open one small hedge, no more than a tenth of the deposit.`, cost: `${ctx.cap} of margin, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Set a stop on the ${ctx.name} hedge in the first 5 minutes, so a sharp move cannot liquidate the margin.`, cost: '$0 extra capital', time: SETUP_INSIDE },
      { text: `Roll or close the ${ctx.name} hedge once a week and open a fresh one, so the account shows regular trading.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      { text: `Leave the rest of the margin uninvested in ${ctx.name}, so the position survives a volatile week.`, cost: '$0 extra capital', time: NO_EXTRA },
    ],
  },
  {
    match: (c) => c.includes('bridge'),
    steps: (ctx) => [
      { text: `Bridge ${ctx.cap} of USDC to ${ctx.chain} through ${ctx.name} and use the bridged funds in the destination app.`, cost: `${ctx.cap} to bridge, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Bridge a small amount back through ${ctx.name} once a week, so the route shows two-way activity.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('prediction'),
    steps: (ctx) => [
      { text: `Fund ${ctx.cap} on ${ctx.name} and take one market position on ${ctx.chain}, on a market you have actually read.`, cost: `${ctx.cap} to fund, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Close or settle the ${ctx.name} position when the market resolves, and take a fresh one the next week.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      { text: `Keep the ${ctx.name} stake small and the position count steady, so the activity reads as regular use over 4 weeks or more.`, cost: '$0 extra capital', time: NO_EXTRA },
    ],
  },
  {
    match: (c) => c.includes('launchpad'),
    steps: (ctx) => [
      { text: `Join ${ctx.name}'s next launch on ${ctx.chain} with ${ctx.cap}, and read the launch terms for 10 minutes before you commit.`, cost: `${ctx.cap} to join, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `If ${ctx.name}'s launch asks for a stake or a hold, keep the required balance in the farming wallet and check it once a week.`, cost: '$0 extra capital', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('index'),
    steps: (ctx) => [
      { text: `Buy ${ctx.cap} of the ${ctx.name} index on ${ctx.chain} and hold the index token in the farming wallet.`, cost: `${ctx.cap} to buy, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} index composition once a week and note any rebalance in the last 7 days.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('payment') || c.includes('card issuer'),
    steps: (ctx) => [
      { text: `Pay ${ctx.cap} through ${ctx.name} on ${ctx.chain} for a real purchase, and keep the receipt for 30 days.`, cost: `${ctx.cap} to spend, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Use the ${ctx.name} payment route once a week for a small amount, so the account shows regular use.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('privacy'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into ${ctx.name}'s private pool on ${ctx.chain} and keep the withdrawal note safe for the full hold.`, cost: `${ctx.cap} deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Withdraw a small amount once a week and put it back in, so the pool sees regular activity.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      { text: `Never share the ${ctx.name} withdrawal note or the pool link with anyone, not even in a screenshot.`, cost: '$0 extra capital', time: NO_EXTRA },
    ],
  },
  {
    match: (c) => c.includes('insurance'),
    steps: (ctx) => [
      { text: `Buy ${ctx.cap} of cover from ${ctx.name} on ${ctx.chain} and keep the policy in the farming wallet.`, cost: `${ctx.cap} for cover, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} policy once a week and note the cover period and the claim window.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('staking') || c.includes('restak'),
    steps: (ctx) => [
      { text: `Stake ${ctx.cap} of the chain's staking asset through ${ctx.name} and keep the receipt token for the full hold.`, cost: `${ctx.cap} to stake, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Restake the ${ctx.name} staking rewards once a week so the position compounds.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
      { text: `If ${ctx.name} offers a liquid receipt, keep it in the farming wallet rather than selling it for $0 gain.`, cost: '$0 extra capital', time: NO_EXTRA },
    ],
  },
  {
    match: (c) => c.includes('nft'),
    steps: (ctx) => [
      { text: `List or buy one item for about ${ctx.cap} on ${ctx.name} on ${ctx.chain}, and keep the receipt.`, cost: `${ctx.cap} for the item, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Make one small trade a week on ${ctx.name} so the wallet shows regular marketplace activity.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('governance'),
    steps: (ctx) => [
      { text: `Stake ${ctx.cap} for governance through ${ctx.name} on ${ctx.chain} and vote on the next proposal within 7 days.`, cost: `${ctx.cap} to stake, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Vote on one ${ctx.name} proposal a week while the stake is locked.`, cost: '$0 to vote', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('otc'),
    steps: (ctx) => [
      { text: `Place one OTC order for about ${ctx.cap} through ${ctx.name} on ${ctx.chain} and settle it in the farming wallet.`, cost: `${ctx.cap} for the order, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Place a small order once a week through ${ctx.name} so the desk sees regular flow.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('locker'),
    steps: (ctx) => [
      { text: `Lock ${ctx.cap} of tokens through ${ctx.name} on ${ctx.chain} for the term the app suggests, at least 30 days.`, cost: `${ctx.cap} to lock, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} lock once a week and note the unlock date.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('btc') || c.includes('bitcoin'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of the wrapped asset through ${ctx.name} on ${ctx.chain} and keep the receipt.`, cost: `${ctx.cap} to deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} peg once a week and note any drift over the last 7 days.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('cedefi'),
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} into ${ctx.name}'s managed account on ${ctx.chain} and keep the balance in the farming wallet.`, cost: `${ctx.cap} to deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Check the ${ctx.name} account once a week and note the reported yield for the last 7 days.`, cost: '$0 to check', time: WEEKLY_CHECK },
    ],
  },
  {
    match: (c) => c.includes('chain') || c.includes('ai agent') || c.includes('decentralized ai'),
    steps: (ctx) => [
      { text: `Use ${ctx.name}'s main app once, with ${ctx.cap}, so the wallet has a real interaction on record within 7 days.`, cost: `about ${ctx.cap} for the trial`, time: SETUP_INSIDE },
      { text: `Use ${ctx.name} on ${ctx.chain} once a week: run one transaction from the farming wallet and keep it active.`, cost: `about $${gasQuarter(ctx)} of gas a week`, time: WEEKLY_CHECK },
    ],
  },
  {
    match: () => true,
    steps: (ctx) => [
      { text: `Deposit ${ctx.cap} of USDC into ${ctx.name} on ${ctx.chain} and keep the position open for the full hold.`, cost: `${ctx.cap} deposit, about $${gasQuarter(ctx)} of gas`, time: SETUP_INSIDE },
      { text: `Do one qualifying action a week inside ${ctx.name}, such as a deposit, a swap or a vote.`, cost: 'about $2 of gas a week', time: WEEKLY_CHECK },
    ],
  },
];

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The plan without its closing verdict line: wallet, test, actions, exit, hold, claim. */
export function farmPlanSteps(
  p: SnapProto,
  age: number | null,
  capital: number,
  gas: number,
  exitTvlUsd: number,
  exitPct: number,
): FarmStep[] {
  const ctx: PlanCtx = { name: p.name, capital, cap: '$' + capital.toLocaleString('en-US'), chain: chainOf(p), gas, hold: holdDaysFor(age) };
  const c = (p.category ?? '').toLowerCase();
  const template = PLAN_TEMPLATES.find((t) => t.match(c))!;
  const token = gasTokenFor(p);
  const wallet: FarmStep = {
    text: `Open a fresh wallet on ${ctx.chain} and fund it with about $${gas} of ${token} for the run.`,
    cost: `$${gas} of ${token} for gas`,
    time: '15 minutes to set up',
  };
  const test: FarmStep = {
    text: `Deposit $100 first, confirm it shows in ${p.name}, then add the rest up to ${ctx.cap}.`,
    cost: `no extra gas: within the $${gas} run total`,
    time: SETUP_INSIDE,
  };
  const exit: FarmStep = {
    text: `Withdraw if ${p.name}'s TVL prints below ${fmtCompactUsd(exitTvlUsd)} (a 7-day fall of ${Math.abs(exitPct).toFixed(2)}%, worse than 95% of this snapshot's protocols).`,
    cost: `gas for one withdrawal, included in the $${gas}`,
    time: WEEK_CHECK_INSIDE,
  };
  const hold: FarmStep = {
    text: `Keep your ${ctx.cap} position in ${p.name} on ${ctx.chain} open for at least ${ctx.hold} days, so the activity spans more than one snapshot.`,
    cost: `${ctx.cap} stays in the position`,
    time: NO_EXTRA,
  };
  const claim: FarmStep = {
    text: `Before withdrawing, spend 10 minutes on ${p.name}'s own points or rewards page and claim only from the link it publishes itself.`,
    cost: '$0 to check, and never pay to claim',
    time: '10 minutes to claim',
  };
  return [wallet, test, ...template.steps(ctx), exit, hold, claim];
}

/** The full plan: the action steps plus a closing verdict line, so the board and the detail view show one plan. */
export function farmSteps(
  p: SnapProto,
  age: number | null,
  capital: number,
  gas: number,
  verdict: 'farm' | 'thin' | 'skip',
  odds: number,
  net: NetInfo,
  exitTvlUsd: number,
  exitPct: number,
): FarmStep[] {
  const total = capital + gas;
  const verdictText = `Verdict: ${verdict.toUpperCase()}. On ${"$" + capital.toLocaleString("en-US")}: drop − fees ${fmtSignedUsd(net.drop_minus_fees_usd)}; same money in a 4% T-bill ${fmtUsd(net.tbill_usd)}; net ${fmtSignedUsd(net.net_usd)} (${fmtSignedUsd(net.net_per_hour_usd)}/hour). FARM needs net > 0 and ≥ $20/hour.`;
  return [
    ...farmPlanSteps(p, age, capital, gas, exitTvlUsd, exitPct),
    { text: verdictText, cost: `about $${total.toLocaleString('en-US')} all in`, time: 'inside the 10-minute claim' },
  ];
}

// ---- the board: watchlist first, then every other rankable protocol ----

interface Assembled {
  board: BoardRow[];
  radarRows: RadarRow[];
}

function assembleBoard(snap: Snap, m: Consts = MODEL): Assembled {
  const index = new Map(snap.protocols.map((p) => [p.slug, p]));
  const kids = familyChildSlugs(snap);
  const beta = fitOddsLogistic(snap.protocols.filter(passesShape), snap.as_of, kids);
  const chosen = new Map<string, SnapProto>();
  for (const slug of snap.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snap.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const dropPct = exitDrop(snap, m);
  const scored = [...chosen.values()].map((p) => {
    const s = impliedValue(p, snap.as_of, beta, m, kids.has(p.slug));
    const gas = gasFor(p);
    const deposit = depositFor(p, m);
    const net = netFor(p, s.implied, s.ifLaunches, s.age, gas, deposit, m);
    const exitTvl = p.tvl_usd * (1 + dropPct / 100);
    return { p, ...s, gas, deposit, net, exitTvl };
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
  const board: BoardRow[] = [];
  const radarRows: RadarRow[] = [];
  scored.forEach((s, i) => {
    const g7 = s.p.change_7d;
    let verdict = verdictFor(s.odds, s.net.net_usd, s.net.net_per_hour_usd, s.net.slice_usd, s.gas, m, s.net.break_even_odds);
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
    const range = ranges.get(s.p.slug) ?? { min: i + 1, max: i + 1 };
    const ilP10 = Math.max(1, Math.round(s.ifLaunches * p10));
    const ilP25 = Math.max(1, Math.round(s.ifLaunches * p25));
    const ilP75 = Math.max(1, Math.round(s.ifLaunches * p75));
    const ilP90 = Math.max(1, Math.round(s.ifLaunches * p90));
    const steps = farmSteps(s.p, s.age, s.deposit, s.gas, verdict, s.odds, s.net, s.exitTvl, dropPct);
    board.push({
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
      deposit_usd: s.deposit,
      drop_minus_fees_usd: s.net.drop_minus_fees_usd,
      net_usd: s.net.net_usd,
      net_per_hour_usd: s.net.net_per_hour_usd,
      slice_usd: s.net.slice_usd,
      tbill_usd: s.net.tbill_usd,
      hold_days: s.net.hold_days,
      exit_tvl_usd: Math.round(s.exitTvl),
      break_even_ticket_usd: s.net.break_even_ticket_usd,
      break_even_odds: s.net.break_even_odds,
      model: {
        fitted_multiple: round4(s.multiple),
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        token_odds: round4(s.odds),
        token_odds_12mo: round4(s.odds12mo),
        odds_terms: s.oddsDetail.terms,
        age_days: s.age,
        if_launches_usd: Math.max(1, Math.round(s.ifLaunches)),
        category_effect: round4(s.categoryEffect),
        family_child: s.familyChild,
      },
      verdict,
      guard_reason: guard,
      farm_cost_usd: s.deposit,
      farm_gas_usd: s.gas,
      farm_steps: steps.map(stepText),
    });
    radarRows.push({
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
      deposit_usd: s.deposit,
      drop_minus_fees_usd: s.net.drop_minus_fees_usd,
      net_usd: s.net.net_usd,
      net_per_hour_usd: s.net.net_per_hour_usd,
      slice_usd: s.net.slice_usd,
      tbill_usd: s.net.tbill_usd,
      hold_days: s.net.hold_days,
      exit_tvl_usd: Math.round(s.exitTvl),
      exit_drop_pct: dropPct,
      break_even_ticket_usd: s.net.break_even_ticket_usd,
      break_even_odds: s.net.break_even_odds,
      category_effect: round4(s.categoryEffect),
      fitted_multiple: round4(s.multiple),
      growth_multiplier: round4(s.growthMult),
      token_odds: round4(s.odds),
      token_odds_12mo: round4(s.odds12mo),
      odds_terms: s.oddsDetail.terms,
      family_child: s.familyChild,
      verdict,
      guard_reason: guard,
      farm_cost_usd: s.deposit,
      farm_gas_usd: s.gas,
      farm_steps: steps,
    });
  });
  return { board, radarRows };
}

/** The board alone, for the gate refusal check in main.ts. */
export function buildBoard(snap: Snap, m: Consts = MODEL): BoardRow[] {
  return assembleBoard(snap, m).board;
}

// ---- dashboard payload: live comps, leagues, ledger, assembly ----

/** The live-token table: every protocol that records a symbol, all 416
 * of them, priced or not. The 128 with a positive market cap are the
 * fit set the value model is fitted on; the rest record a symbol with
 * no usable cap. Sorted by market cap, then TVL, caps of zero or
 * missing last. */
export function liveRows(snap: Snap): LiveRow[] {
  return snap.protocols
    .filter((p) => p.symbol !== null && p.symbol !== undefined)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
      gecko_id: p.gecko_id,
      listed_at: p.listed_at,
    }));
}

/** One league line per board category: board rows, peers that record a token, and the median premium. */
export function leagueRows(snap: Snap, board: BoardRow[]): LeagueRow[] {
  const kids = familyChildSlugs(snap);
  const peers = snap.protocols.filter(passesShape);
  const byCat = new Map<string, { rows: number[]; peers: number; tokened: number }>();
  const catOf = (c: string | null): string => c ?? 'Other';
  for (const p of peers) {
    const key = catOf(p.category);
    const g = byCat.get(key) ?? { rows: [], peers: 0, tokened: 0 };
    g.peers++;
    if (ownsToken(p, kids)) g.tokened++;
    byCat.set(key, g);
  }
  for (const r of board) {
    const key = catOf(r.category);
    const g = byCat.get(key) ?? { rows: [], peers: 0, tokened: 0 };
    g.rows.push(r.model.fitted_multiple);
    byCat.set(key, g);
  }
  const out: LeagueRow[] = [];
  for (const [category, g] of byCat) {
    if (g.rows.length === 0) continue;
    const sorted = [...g.rows].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    out.push({
      category,
      rows: g.rows.length,
      peers: g.peers,
      peers_tokened: g.tokened,
      ever_pct: g.peers > 0 ? g.tokened / g.peers : 0,
      median_premium: median,
    });
  }
  out.sort((a, b) => b.rows - a.rows || (a.category < b.category ? -1 : 1));
  return out;
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

/** A short checksum over the board's ranks and values, printed on the page next to the board's own figures. */
export function boardChecksum(board: BoardRow[]): string {
  let h = 0x811c9dc5;
  const text = board.map((r) => `${r.rank}:${r.slug}:${r.implied_value_usd}`).join('|');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Board + everything the dashboard needs, from one snapshot. */
export function buildRadar(snap: Snap, m: Consts = MODEL): { board: BoardRow[]; radar: RadarData } {
  assertFittedConstants(snap, m);
  const { board, radarRows } = assembleBoard(snap, m);
  const live = liveRows(snap);
  const early = board.filter((r) => !snap.watchlist.includes(r.slug)).length;
  const boardSlugs = new Set(board.map((r) => r.slug));
  const ledger = buildLedger(snap, boardSlugs);
  const ledgerTotal = ledger.reduce((s, g) => s + g.count, 0);
  const kids = familyChildSlugs(snap);
  const oddsBeta = fitOddsLogistic(snap.protocols.filter(passesShape), snap.as_of, kids);
  const odds = oddsEvidence(snap, kids);
  const value = valueEvidence(snap, m);
  const fit: FitSummary = {
    n_live: 128,
    median_multiple: m.global_median,
    value_const: m.value_const,
    value_log_tvl: m.value_log_tvl,
    value_const_se: value.value_const_se,
    value_log_tvl_se: value.value_log_tvl_se,
    loo_miss: value.loo_miss,
    wf_miss: value.wf_miss,
    flat_loo: value.flat_loo,
    flat_wf: value.flat_wf,
    cut_loo: value.cut_loo,
    cut_wf: value.cut_wf,
    w3_loo: value.w3_loo,
    w3_wf: value.w3_wf,
    w3_flat_loo: value.w3_flat_loo,
    w3_flat_wf: value.w3_flat_wf,
    mid_loo: value.mid_loo,
    mid_wf: value.mid_wf,
    wide_loo: value.wide_loo,
    wide_wf: value.wide_wf,
    mid_strict_loo: value.mid_strict_loo,
    mid_strict_wf: value.mid_strict_wf,
    wide_strict_loo: value.wide_strict_loo,
    wide_strict_wf: value.wide_strict_wf,
    placebo_hash_loo: value.placebo_hash_loo,
    placebo_hash_wf: value.placebo_hash_wf,
    placebo_growth_loo: value.placebo_growth_loo,
    placebo_growth_wf: value.placebo_growth_wf,
    baseline_miss: value.flat_loo,
    resid_p10_mult: Math.exp(m.value_resid_p10),
    resid_p25_mult: Math.exp(m.value_resid_p25),
    resid_p75_mult: Math.exp(m.value_resid_p75),
    resid_p90_mult: Math.exp(m.value_resid_p90),
    odds_brier_10fold: odds.brier_10fold,
    odds_brier_wf: odds.brier_wf_median,
    odds_brier_base: odds.brier_wf_median_base,
    odds_auc_10fold: odds.auc_10fold,
    odds_auc_wf: odds.auc_wf,
    odds_acc_wf: odds.acc_wf,
    odds_acc_never: odds.acc_wf_never,
    odds_acc_trainbase: odds.acc_wf_trainbase,
    range_mid50_calib: value.mid_loo,
    range_p10p90_calib: value.wide_loo,
    within3_loo: value.w3_loo,
    within3_flat: value.w3_flat_loo,
    note: 'This model ranks; it does not price. Implied values are order-of-magnitude scores with ~3.4x typical held-out error. Growth enters the value only as a stated carry (1 + 0.01xclip(7d, -25, +25)), never fitted; age is not in the value. The odds are a life-table transform of a logistic fitted on the 442 shape-passing peers: ever-odds = (p(5.07y) - p(age)) / (1 - p(age)).',
  };
  const radar: RadarData = {
    as_of: snap.as_of,
    source: snap.source,
    floor_usd: snap.floor_usd,
    model: m,
    model_version: MODEL_VERSION,
    watchlist_size: snap.watchlist.length,
    watchlist_slugs: [...snap.watchlist],
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    priced_size: live.filter((r) => r.mcap_usd !== null && r.mcap_usd > 0).length,
    value_effects: { ...VALUE_EFFECT },
    odds_beta: oddsBeta,
    fit,
    odds_fit: odds,
    fit_terms: heldOutTests(snap, m),
    leagues: leagueRows(snap, board),
    ledger,
    ledger_total: ledgerTotal,
    checksum: boardChecksum(board),
    exit_drop_pct: exitDrop(snap, m),
    rows: radarRows,
    live,
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
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
