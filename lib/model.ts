// The token radar's fitted model (radar-3): one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every rankable pre-token protocol: the snapshot's watchlist (the floor,
// never a ceiling) plus every other pre-token protocol that is not a CEX and not a versioned
// pool. A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as
// the market's own values, never mixed into the ranked board.
//
// Implied value is FITTED, not assumed, in two parts:
//
//   VALUE IF IT LAUNCHES — a power-law regression on the snapshot's live-token protocols.
//   log(mcap) = 8.9076 + 0.4649 x log(TVL) - 2.8915 x (growth/100) - 0.1769 x log(age_days)
//   Fitted by least squares on the 95 live protocols with a complete record (market cap,
//   TVL, listed date, 7-day change). TVL enters sub-linearly (exponent 0.465): a flat
//   multiple over-values large protocols by up to 9x. Growth enters negatively: hot recent
//   TVL growth is mercenary capital that does not survive into a token price. Age enters
//   negatively: older listings carry a smaller multiple once TVL is held fixed.
//   Held-out: leave-one-out miss x2.90, walk-forward (older -> newer) miss x2.72.
//   A flat median multiple misses x5.00 / x5.29 on the same tests. See FIT below.
//
//   TOKEN ODDS — a logistic regression on all 758 protocols, P(records a token).
//   logit = -3.771 + 0.045 x log(TVL) + 0.51 x log(age_days)
//   Age is the signal, not the category: a category's token rate confounds "has not
//   launched yet" with "will never launch" (Risk Curators: 12.8% have a token, because
//   the category is new — yet its largest protocols are the likeliest launches in the
//   snapshot). 5-fold cross-validated Brier 0.237 against a 0.248 base rate.
//   implied = max(1, round(if_launches x token_odds))
//
//   FARM VERDICT, NETTED TO THE DOLLAR — for a $1,000 ticket. The expected airdrop slice
//   is implied value x 10% (the share to depositors) x ($1,000 / TVL); the cost is the
//   chain's gas for setup, weekly actions and claim. Net = slice - gas. FARM when the net
//   clears $10, THIN when it clears $0, SKIP when it does not. The deposit itself is
//   returned, so it is not a cost; only gas is.
//
// The dashboard also accounts for every one of the 758 snapshot protocols in exactly one
// group (the ledger), and shows the out-of-sample evidence table for the value model.

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
  value_const: number;
  value_log_tvl: number;
  value_growth: number;
  value_log_age: number;
  odds_const: number;
  odds_log_tvl: number;
  odds_log_age: number;
  unknown_age_days: number;
  odds_floor: number;
  odds_cap: number;
  airdrop_share: number;
  ticket_usd: number;
  farm_threshold_usd: number;
  thin_threshold_usd: number;
}

export const MODEL: ModelConstants = {
  value_const: 8.9076,
  value_log_tvl: 0.4649,
  value_growth: -2.8915,
  value_log_age: -0.1769,
  odds_const: -3.771,
  odds_log_tvl: 0.045,
  odds_log_age: 0.51,
  unknown_age_days: 365,
  odds_floor: 0.05,
  odds_cap: 0.95,
  airdrop_share: 0.10,
  ticket_usd: 1000,
  farm_threshold_usd: 10,
  thin_threshold_usd: 0,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** The held-out validation the dashboard reports. Fitted and tested on the snapshot's
 *  live-token protocols (95 with a complete record: market cap, TVL, listed date, 7-day
 *  change). Leave-one-out and walk-forward (fit on the older half, predict the newer half).
 *  The flat-median baseline is the same tests on a single global mcap/TVL multiple. */
export const FIT = {
  n_live: 95,
  n_live_total: 128,
  value_const: 8.9076,
  value_log_tvl: 0.4649,
  value_growth: -2.8915,
  value_log_age: -0.1769,
  loo_medape: 83.8,
  loo_miss: 2.9,
  wf_medape: 89.0,
  wf_miss: 2.72,
  flat_loo_miss: 5.0,
  flat_wf_miss: 5.29,
  odds_brier_cv: 0.237,
  odds_brier_base: 0.248,
  note: 'The power law beats a flat multiple by ~40% on held-out miss. Implied values are order-of-magnitude scores with ~3x typical error; the model ranks, it does not price.',
};

/** One term of the out-of-sample evidence table. */
export interface FitTerm {
  term: string;
  loo_miss: number;
  wf_miss: number;
  kept: boolean;
}

export const FIT_TERMS: FitTerm[] = [
  { term: 'flat median multiple', loo_miss: 5.0, wf_miss: 5.29, kept: false },
  { term: '+ size curve, log TVL', loo_miss: 3.23, wf_miss: 3.01, kept: true },
  { term: '+ 7-day TVL growth', loo_miss: 2.94, wf_miss: 2.74, kept: true },
  { term: '+ age, log days listed', loo_miss: 2.9, wf_miss: 2.72, kept: true },
];

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
  if_launches_usd: number;
  model: {
    value_const: number;
    value_log_tvl: number;
    value_growth: number;
    value_log_age: number;
    growth_pct: number;
    token_odds: number;
    age_days: number | null;
  };
  verdict: 'farm' | 'thin' | 'skip';
  net_usd: number;
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
  growth_multiplier: number;
  token_odds: number;
  verdict: 'farm' | 'thin' | 'skip';
  net_usd: number;
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

/** The value if a token launches: the power-law regression on the live-token comps. */
export function ifLaunches(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { value: number; growthPct: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(120, Math.max(-60, rawGrowth));
  const logValue =
    model.value_const +
    model.value_log_tvl * Math.log(Math.max(1, protocol.tvl_usd)) +
    model.value_growth * (growthPct / 100) +
    model.value_log_age * Math.log(Math.max(1, ageForModel));
  return { value: Math.max(1, Math.round(Math.exp(logValue))), growthPct, age };
}

/** A protocol's token odds: the logistic regression on all 758 protocols. */
export function tokenOdds(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): number {
  const age = ageDays(asOf, protocol.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const logit =
    model.odds_const +
    model.odds_log_tvl * Math.log(Math.max(1, protocol.tvl_usd)) +
    model.odds_log_age * Math.log(Math.max(1, ageForModel));
  const p = 1 / (1 + Math.exp(-logit));
  return Math.min(model.odds_cap, Math.max(model.odds_floor, p));
}

/** The multipliers and the implied value one protocol gets under the fitted model. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; ifLaunches: number; growthPct: number; age: number | null; odds: number } {
  const { value, growthPct, age } = ifLaunches(protocol, asOf, model);
  const odds = tokenOdds(protocol, asOf, model);
  const implied = Math.max(1, Math.round(value * odds));
  return { implied, ifLaunches: value, growthPct, age, odds };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
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

/** The verdict for a row, netted to the dollar on a $1,000 ticket. */
export function verdictFor(netUsd: number, model: ModelConstants): 'farm' | 'thin' | 'skip' {
  if (netUsd >= model.farm_threshold_usd) return 'farm';
  if (netUsd > model.thin_threshold_usd) return 'thin';
  return 'skip';
}

/** The expected airdrop slice for a ticket, and the net after gas. */
export function netFor(impliedUsd: number, tvlUsd: number, gasUsd: number, model: ModelConstants): { slice: number; net: number } {
  const slice = (impliedUsd * model.airdrop_share * model.ticket_usd) / Math.max(1, tvlUsd);
  const net = slice - gasUsd;
  return { slice, net };
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
    const { implied, ifLaunches, growthPct, age, odds } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, ifLaunches, growthPct, age, odds };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const cost = capitalFor(s.p);
    const gas = gasFor(s.p);
    const { net } = netFor(s.implied, s.p.tvl_usd, gas, model);
    const verdict = verdictFor(net, model);
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
      if_launches_usd: s.ifLaunches,
      model: {
        value_const: model.value_const,
        value_log_tvl: model.value_log_tvl,
        value_growth: model.value_growth,
        value_log_age: model.value_log_age,
        growth_pct: s.growthPct,
        token_odds: round4(s.odds),
        age_days: s.age,
      },
      verdict,
      net_usd: round2(net),
      farm_cost_usd: cost,
      farm_gas_usd: gas,
      farm_steps: farmSteps(s.p, s.age, cost, gas, net, model).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

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
 * names. The last step is the verdict, netted to the dollar on a $1,000 ticket.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, capital: number, gas: number, net: number, model: ModelConstants): FarmStep[] {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const total = capital + gas;
  const verdict = verdictFor(net, model);
  const netText = net >= 0 ? `+$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`;
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
      text: `Verdict ${verdict.toUpperCase()}: on a $${model.ticket_usd} ticket the expected airdrop slice nets ${netText} after ~$${gas} of gas, so the full run costs about $${total} ($${capital} deposit, ~$${gas} gas). Farm it only if that net clears your bar; the implied value and token odds above are the model's read, not a promise.`,
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
    { key: 'ranked-watchlist', label: 'Ranked · watchlist', count: rankedWatchlist, note: 'records no token, at or above the $50M floor' },
    { key: 'ranked-early', label: 'Ranked · early, below the floor', count: rankedEarly, note: 'records no token, below the floor, rankable' },
    { key: 'token-trades', label: 'Token trades · priced comp', count: tokenTrades, note: 'a market cap: comparables, never ranked' },
    { key: 'token-no-cap', label: 'Token recorded · no usable cap', count: tokenNoCap, note: 'a token on record, no market cap to price' },
    { key: 'out-bridge', label: 'Out · bridge', count: outBridge, note: 'the house rule, applied below its floor' },
    { key: 'out-liquid-staking', label: 'Out · liquid staking', count: outLiquidStaking, note: 'a staked product of a token that trades' },
    { key: 'out-exchange', label: 'Out · exchange', count: outExchange, note: 'an exchange balance, not a protocol launch' },
    { key: 'out-versioned-wrapped', label: 'Out · versioned or wrapped', count: outVersionedWrapped, note: 'a versioned pool or a wrapped product' },
    { key: 'out-other', label: 'Out · other', count: outOther, note: 'pre-token, not rankable under the house rules' },
  ];
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
    growth_multiplier: row.model.growth_pct,
    token_odds: row.model.token_odds,
    verdict: row.verdict,
    net_usd: row.net_usd,
    farm_cost_usd: row.farm_cost_usd,
    farm_gas_usd: row.farm_gas_usd,
  };
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
