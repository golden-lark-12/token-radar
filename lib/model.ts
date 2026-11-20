// The token radar's fitted model (radar-2): one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every rankable pre-token protocol: the snapshot's watchlist (the floor,
// never a ceiling) plus every other pre-token protocol that is not a CEX and not a versioned
// pool. A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as
// the market's own values, never mixed into the ranked board.
//
// Implied value is FITTED, not assumed. The live-token protocols in the snapshot (144 with a
// recorded market cap) give the valuation multiple: market cap over TVL, by category, shrunk
// toward the global positive median so thin categories do not explode the ranking. Token odds
// come from the peers' record: the share of protocols in the same category that record a
// token, adjusted by TVL band and age band. The fit is validated held-out (see FIT below).
//
//   fitted_multiple(c) = min(2.0, (n_c x median_pos(c) + 5 x 0.214) / (n_c + 5))
//   growth             = 1 + 0.01 x clip(change_7d, -30, +30), bounded [0.70, 1.30]
//   maturity           = 1.0 (age shows no trend in the multiple, so it is not used)
//   token_odds         = clip(symbol_rate(c) x TVL_ratio(band) x age_ratio(band), 0.05, 0.95)
//   implied            = max(1, round(TVL x fitted_multiple x growth x maturity x token_odds))
//
// Held-out validation (80/20 split on the 144 market-cap-live protocols, 5 seeds): median
// absolute percentage error 90-125% (seed 42: 98.8%). The category fit barely beats the
// overall-median baseline (MedAPE 87-99%). This model ranks; it does not price. Implied
// values are order-of-magnitude scores with ~2x typical error. The dashboard says so.

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
  shrink_prior: number;
  multiple_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity: number;
  unknown_age_days: number;
  odds_floor: number;
  odds_cap: number;
}

export const MODEL: ModelConstants = {
  global_median: 0.214,
  shrink_prior: 5,
  multiple_cap: 2.0,
  growth_weight: 0.01,
  growth_floor: -30,
  growth_cap: 30,
  maturity: 1.0,
  unknown_age_days: 365,
  odds_floor: 0.05,
  odds_cap: 0.95,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** Fitted multiple per category: median of positive mcap/TVL, shrunk toward the global
 *  positive median (0.214) with a prior weight of 5, capped at 2.0. Categories with no live
 *  comps fall back to the global median. Source: the snapshot's 144 market-cap-live protocols. */
export const FITTED_MULTIPLE: Record<string, number> = {
  'Dexs': 0.302,
  'Lending': 0.153,
  'Liquid Staking': 0.103,
  'Yield': 0.199,
  'RWA': 0.253,
  'Canonical Bridge': 0.542,
  'Basis Trading': 0.471,
  'Bridge': 0.401,
  'Yield Aggregator': 0.186,
  'Cross Chain Bridge': 0.661,
  'Onchain Capital Allocator': 0.156,
  'CDP': 0.197,
  'Derivatives': 0.770,
  'Liquid Restaking': 0.205,
  'Restaking': 0.160,
  'Staking Pool': 0.153,
  'Payments': 0.205,
  'AI Agents': 0.326,
  'Indexes': 0.189,
  'Privacy': 0.497,
  'Token Locker': 2.0,
  'Collateral Management': 2.0,
  'Prediction Market': 2.0,
  'Risk Curators': 0.674,
  'Chain': 0.683,
  'CEX': 0.125,
};

/** Symbol-based token rate per category: the share of protocols in the category that record
 *  a token symbol (a token exists, even when no market cap is recorded). Categories not
 *  listed fall back to the overall symbol rate. Source: the snapshot's 758 protocols. */
export const SYMBOL_RATE: Record<string, number> = {
  'Lending': 0.787,
  'Dexs': 0.737,
  'Liquid Staking': 0.513,
  'Yield': 0.590,
  'RWA': 0.515,
  'Basis Trading': 0.619,
  'Bridge': 0.491,
  'Canonical Bridge': 0.531,
  'CEX': 0.250,
  'Risk Curators': 0.128,
  'Onchain Capital Allocator': 0.310,
  'Derivatives': 0.500,
  'CDP': 0.500,
  'Cross Chain Bridge': 0.857,
  'Yield Aggregator': 0.609,
};

export const OVERALL_SYMBOL_RATE = 0.549;

/** TVL-band ratio for token odds (symbol-rate ratio to the overall rate). */
export function tvlRatio(tvl: number): number {
  if (tvl < 10_000_000) return 0.95;
  if (tvl < 50_000_000) return 0.95;
  if (tvl < 100_000_000) return 1.01;
  if (tvl < 500_000_000) return 1.05;
  if (tvl < 1_000_000_000) return 1.15;
  return 1.16;
}

/** Age-band ratio for token odds. Unknown age behaves like old protocols (missing metadata
 *  is mostly old), so it takes the >3y ratio with a note. */
export function ageRatio(ageDays: number | null): number {
  if (ageDays === null) return 1.43;
  if (ageDays < 180) return 0.48;
  if (ageDays < 365) return 0.73;
  if (ageDays < 730) return 0.70;
  if (ageDays < 1095) return 1.0;
  return 1.44;
}

/** The held-out validation the dashboard reports. Computed on the 144 market-cap-live
 *  protocols, 80/20 split, 5 seeds (42, 1, 7, 123, 2026). */
export const FIT = {
  n_live: 144,
  median_multiple: 0.214,
  heldout_medape: 98.8,
  heldout_medape_range: '90-125%',
  baseline_medape: '87-99%',
  note: 'This model ranks; it does not price. Implied values are order-of-magnitude scores with ~2x typical error.',
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
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
  model: {
    fitted_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    token_odds: number;
    age_days: number | null;
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

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
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

/** The fitted multiple for a category, falling back to the global median. */
export function fittedMultiple(category: string | null): number {
  if (category === null) return MODEL.global_median;
  return FITTED_MULTIPLE[category] ?? MODEL.global_median;
}

/** The symbol-based token rate for a category, falling back to the overall rate. */
export function symbolRate(category: string | null): number {
  if (category === null) return OVERALL_SYMBOL_RATE;
  return SYMBOL_RATE[category] ?? OVERALL_SYMBOL_RATE;
}

/** A protocol's token odds: its category's token rate, adjusted by TVL band and age band. */
export function tokenOdds(p: SnapshotProtocol, age: number | null): number {
  const raw = symbolRate(p.category) * tvlRatio(p.tvl_usd) * ageRatio(age);
  return Math.min(MODEL.odds_cap, Math.max(MODEL.odds_floor, raw));
}

/** The multipliers and the implied value one protocol gets under the fitted model. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null; multiple: number; odds: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100);
  const boundedGrowth = Math.min(1.30, Math.max(0.70, growthMult));
  const maturityMult = model.maturity;
  const multiple = fittedMultiple(protocol.category);
  const odds = tokenOdds(protocol, age);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * boundedGrowth * maturityMult * odds));
  return { implied, growthPct, growthMult: boundedGrowth, maturityMult, age, multiple, odds };
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
 *  skip when they are weak. The verdict is about the probability of a token, not the size. */
export function verdictFor(odds: number): 'farm' | 'thin' | 'skip' {
  if (odds >= 0.5) return 'farm';
  if (odds >= 0.3) return 'thin';
  return 'skip';
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
    const { implied, growthPct, growthMult, maturityMult, age, multiple, odds } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, growthPct, growthMult, maturityMult, age, multiple, odds };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const verdict = verdictFor(s.odds);
    const cost = capitalFor(s.p);
    const gas = gasFor(s.p);
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
      model: {
        fitted_multiple: s.multiple,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        token_odds: round4(s.odds),
        age_days: s.age,
      },
      verdict,
      farm_cost_usd: cost,
      farm_gas_usd: gas,
      farm_steps: farmSteps(s.p, s.age, cost, gas).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

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

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
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
 * names. The last step is the verdict, netted to the dollar: deposit plus gas against the
 * implied value and the token odds.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, capital: number, gas: number): FarmStep[] {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const total = capital + gas;
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
      text: `Verdict: the full run costs about $${total} ($${capital} deposit, ~$${gas} gas). Farm it only if a token launch would pay that back; the implied value and token odds above are the model's read, not a promise.`,
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
    fitted_multiple: row.model.fitted_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    token_odds: row.model.token_odds,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    farm_gas_usd: row.farm_gas_usd,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
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
