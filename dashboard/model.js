/*
Map of this file. Each function is pure: same inputs, same outputs, no network, no imports.
fitValueTwoStage: fits the size curve on live comps, then shrunk category effects.
computeImpliedValue: launch value from TVL and category, times growth carry and ever-odds.
estimateTokenOdds: logistic age curve turned into ever-odds and 12-month odds by a life table.
buildFarmPlan: deposit, gas, hours, slice, T-bill net and verdict for one row, plus its steps.
verdictFor: FARM / THIN / SKIP from odds, net, dollars per hour, slice, gas and break-even odds.
verifyWatchlist: checks every watchlist slug appears among the board rows, and lists any missing.
Inputs are plain values from the snapshot, the fitted constants and the board rows; nothing is fetched.
*/
'use strict';

function clampNum(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function logOf(value) {
  return Math.log(Math.max(1, value));
}

function logisticCurve(z) {
  var c = clampNum(z, -30, 30);
  return 1 / (1 + Math.exp(-c));
}

function roundTo(value, places) {
  var f = Math.pow(10, places);
  return Math.round(value * f) / f;
}

function categoryEffectOf(category, effects) {
  if (category === null || category === undefined) return 0;
  var v = effects[category];
  return typeof v === 'number' ? v : 0;
}

/* Least squares of log market cap on log TVL, then each category's
   effect as the shrunk mean of its clipped residuals. Null under 3 comps. */
function fitValueTwoStage(comps, consts) {
  var n = comps.length;
  if (n < 3) return null;
  var sx = 0, sy = 0, sxx = 0, sxy = 0, i, c;
  for (i = 0; i < n; i++) {
    c = comps[i];
    sx += c.lnTvl; sy += c.lnMcap;
    sxx += c.lnTvl * c.lnTvl; sxy += c.lnTvl * c.lnMcap;
  }
  var denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  var slope = (n * sxy - sx * sy) / denom;
  var intercept = (sy - slope * sx) / n;
  var buckets = {};
  for (i = 0; i < n; i++) {
    c = comps[i];
    var resid = clampNum(c.lnMcap - (intercept + slope * c.lnTvl), -consts.value_clip, consts.value_clip);
    var key = c.category === null || c.category === undefined ? '' : c.category;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(resid);
  }
  var effects = {};
  var keys = Object.keys(buckets);
  for (i = 0; i < keys.length; i++) {
    var list = buckets[keys[i]];
    var mean = 0, j;
    for (j = 0; j < list.length; j++) mean += list[j];
    mean /= list.length;
    var shrunk = (list.length / (list.length + consts.value_shrink_prior)) * mean;
    effects[keys[i]] = clampNum(shrunk, -consts.value_effect_cap, consts.value_effect_cap);
  }
  return { intercept: intercept, slope: slope, effects: effects, n: n };
}

/* The launch value before odds, and the odds-weighted implied value.
   fitted comes from fitValueTwoStage; everOdds is a number from
   estimateTokenOdds. Growth enters only as the stated carry. */
function computeImpliedValue(proto, fitted, everOdds, consts, effects) {
  var effect = categoryEffectOf(proto.category, effects || fitted.effects);
  var ifLaunches = Math.exp(consts.value_const + consts.value_log_tvl * logOf(proto.tvl_usd) + effect);
  var growthPct = proto.change_7d === null || proto.change_7d === undefined
    ? 0 : clampNum(proto.change_7d, -25, 25);
  var carry = 1 + 0.01 * growthPct;
  var implied = Math.max(1, Math.round(ifLaunches * carry * everOdds));
  return {
    ifLaunches: ifLaunches,
    growthPct: growthPct,
    growthCarry: carry,
    categoryEffect: effect,
    fittedMultiple: proto.tvl_usd > 0 ? ifLaunches / proto.tvl_usd : 0,
    everOdds: everOdds,
    implied: implied
  };
}

/* Ever-odds from a fitted logistic, beta [intercept, years, ln TVL,
   growth, family]: the share of peers still tokenless at this age
   that ever record one by the ceiling age. */
function estimateTokenOdds(proto, beta, ageDays, consts, familyChild) {
  var years = (ageDays === null || ageDays === undefined ? consts.unknown_age_days : ageDays) / 365.25;
  function pAt(ageYears) {
    var z = beta[0]
      + beta[1] * ageYears
      + beta[2] * Math.log(Math.max(1, proto.tvl_usd) / 100000000)
      + beta[3] * ((proto.change_7d === null || proto.change_7d === undefined ? 0 : proto.change_7d) / 100)
      + beta[4] * (familyChild ? 1 : 0);
    return { logit: z, p: logisticCurve(z) };
  }
  var atAge = pAt(years);
  var atMax = pAt(consts.odds_ceiling_years);
  var atNext = pAt(Math.min(years + 1, consts.odds_ceiling_years));
  var rawEver = atAge.p >= 1 ? 0 : (atMax.p - atAge.p) / (1 - atAge.p);
  var rawTwelve = atAge.p >= 1 ? 0 : (atNext.p - atAge.p) / (1 - atAge.p);
  var ever = clampNum(rawEver, consts.odds_floor, consts.odds_cap);
  var twelve = clampNum(rawTwelve, 0, consts.odds_cap);
  return {
    ever: ever,
    twelveMo: twelve,
    pAge: atAge.p,
    pMax: atMax.p,
    logit: atAge.logit,
    terms: {
      intercept: roundTo(beta[0], 4),
      years: roundTo(beta[1] * years, 4),
      lnTvl: roundTo(beta[2] * Math.log(Math.max(1, proto.tvl_usd) / 100000000), 4),
      growth: roundTo(beta[3] * ((proto.change_7d === null || proto.change_7d === undefined ? 0 : proto.change_7d) / 100), 4),
      family: roundTo(beta[4] * (familyChild ? 1 : 0), 4)
    }
  };
}

/* Verdict rule. Net at or below zero, or break-even odds null (it
   would need odds above the 0.95 cap), is a SKIP. FARM needs odds
   of 50%+, a positive net and the hourly floor. Low odds or fees
   above the slice is a SKIP. The rest is THIN. */
function verdictFor(odds, netUsd, netPerHour, slice, gas, breakEvenOdds, consts) {
  if (netUsd <= 0 || breakEvenOdds === null || breakEvenOdds === undefined) return 'skip';
  if (odds >= 0.5 && netPerHour >= consts.hourly_floor_usd) return 'farm';
  if (odds < 0.3 || slice <= gas) return 'skip';
  return 'thin';
}

/* Farm plan for one board row: economics on a deposit, with optional
   what-if overrides, plus the row's own steps. Hours are setup plus
   weekly checks over the hold plus the claim. */
function buildFarmPlan(row, consts, overrides) {
  var o = overrides || {};
  var deposit = typeof o.deposit === 'number' ? o.deposit : row.deposit_usd;
  var share = typeof o.dropShare === 'number' ? o.dropShare : consts.drop_share;
  var hold = typeof o.holdDays === 'number' ? o.holdDays : row.hold_days;
  var gas = row.farm_gas_usd;
  var hours = consts.setup_hours + (hold / 7) * consts.weekly_hours + consts.claim_hours;
  var slice = row.tvl_usd > 0 ? row.implied_value_usd * share * (deposit / row.tvl_usd) : 0;
  var tbill = deposit * consts.tbill_rate * (hold / 365);
  var net = slice - gas - tbill;
  var perHour = net / hours;
  var perDollar = row.tvl_usd > 0
    ? (row.implied_value_usd * share) / row.tvl_usd - consts.tbill_rate * (hold / 365) : -1;
  var breakEvenTicket = perDollar > 0 ? Math.round(gas / perDollar) : null;
  var sliceBase = row.tvl_usd > 0 ? row.if_launches_usd * share * (deposit / row.tvl_usd) : 0;
  var oddsStar = sliceBase > 0 ? (gas + tbill) / sliceBase : Infinity;
  var breakEvenOdds = oddsStar > 0 && oddsStar <= 0.95 ? roundTo(oddsStar, 4) : null;
  var verdict = verdictFor(row.token_odds, net, perHour, slice, gas, breakEvenOdds, consts);
  return {
    deposit: deposit,
    gas: gas,
    holdDays: hold,
    hours: roundTo(hours, 4),
    dropShare: share,
    slice: roundTo(slice, 2),
    dropMinusFees: roundTo(slice - gas, 2),
    tbill: roundTo(tbill, 2),
    net: roundTo(net, 2),
    netPerHour: roundTo(perHour, 2),
    breakEvenTicket: breakEvenTicket,
    breakEvenOdds: breakEvenOdds,
    verdict: verdict,
    steps: row.farm_steps,
    stepCount: row.farm_steps.length,
    allIn: deposit + gas
  };
}

/* Watchlist coverage: every watchlist slug must appear among the
   board rows. Returns the counts and any slug that is missing. */
function verifyWatchlist(rows, watchlistSlugs) {
  var seen = {};
  var i;
  for (i = 0; i < rows.length; i++) seen[rows[i].slug] = true;
  var missing = [];
  for (i = 0; i < watchlistSlugs.length; i++) {
    if (!seen[watchlistSlugs[i]]) missing.push(watchlistSlugs[i]);
  }
  return {
    boardSize: rows.length,
    watchlistSize: watchlistSlugs.length,
    covered: watchlistSlugs.length - missing.length,
    missing: missing,
    complete: missing.length === 0
  };
}
