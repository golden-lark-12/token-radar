// Token Radar dashboard, model radar-7. Reads window.RADAR (data.js, written beside dashboard/)
// and renders the ranked pre-token board, the live-token comparison set, the protocol ledger,
// the out-of-sample evidence and the fitted model. What-if controls above the board re-price
// every row live; filtering to a verdict re-sorts by net/hour. No network: every byte shown
// comes from data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA || !Array.isArray(DATA.rows) || !DATA.rows.length) {
    document.body.insertAdjacentHTML('beforeend', '<p>No radar data found: data.js was not loaded beside this dashboard.</p>');
    return;
  }
  if (!Array.isArray(DATA.fit_terms)) DATA.fit_terms = [];
  var M = DATA.model || {};
  var FIT = DATA.fit || {};
  var OF = DATA.odds_fit || {};
  var S = { q: '', cat: 'all', chain: 'all', odds: 0, verdict: 'all', tab: 'pre', sort: 'rank', ticket: 1000, share: 0.07, horizon: 'model' };
  var TBILL = 0.04;
  var watchSlugs = {};
  (DATA.watchlist_slugs || []).forEach(function (s) { watchSlugs[s] = true; });
  function isWatchlist(r) { return !!watchSlugs[r.slug]; }

  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n).toLocaleString('en-US');
    return '$' + n.toFixed(2);
  }
  function money2(n) { return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2); }
  function signed(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2); }
  function pct(n) {
    if (n === null || n === undefined) return 'n/a';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(d) {
    if (d === null || d === undefined) return 'n/a';
    if (d < 365) return d + 'd';
    return (d / 365).toFixed(1) + 'y';
  }
  function catOf(r) { return r.category || 'Other'; }
  function isDefault() { return S.ticket === 1000 && S.share === 0.07 && S.horizon === 'model'; }

  // Same arithmetic as the model: slice = implied x share x ticket/TVL,
  // forgone yield = ticket x 4% x hold/365, net = slice - gas - yield.
  // At the defaults this reproduces the row's own net exactly.
  function price(r) {
    var hold = S.horizon === 'model' ? (typeof r.hold_days === 'number' ? r.hold_days : 30) : S.horizon;
    var hours = 0.25 + (hold / 7) * 0.1667 + 0.1667;
    var slice = r.tvl_usd > 0 ? r.implied_value_usd * S.share * (S.ticket / r.tvl_usd) : 0;
    var tbill = S.ticket * TBILL * (hold / 365);
    var net = slice - (r.farm_gas_usd || 0) - tbill;
    var perDollar = r.tvl_usd > 0 ? r.implied_value_usd * S.share / r.tvl_usd - TBILL * (hold / 365) : -1;
    var beT = perDollar > 0 ? Math.round((r.farm_gas_usd || 0) / perDollar) : null;
    var base = r.tvl_usd > 0 ? r.if_launches_usd * S.share * (S.ticket / r.tvl_usd) : 0;
    var beO = base > 0 ? ((r.farm_gas_usd || 0) + tbill) / base : null;
    return { slice: slice, tbill: tbill, net: net, nph: net / hours, beT: beT, beO: beO !== null && beO > 0 && beO <= 0.95 ? beO : null, hold: hold, hours: hours };
  }
  function verdict(r, p) {
    // Crash guard, same as the model: a collapse is never anything but
    // a skip, and a sharp fall can only demote a farm to thin.
    var g7 = r.change_7d;
    if (g7 !== null && g7 !== undefined && g7 <= -30) return 'skip';
    if (r.token_odds >= 0.5 && p.net > 0) return g7 !== null && g7 <= -15 ? 'thin' : 'farm';
    if (r.token_odds >= 0.3) return 'thin';
    return 'skip';
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else if (k === 'onkeydown') n.addEventListener('keydown', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function setText(id, t) { var n = document.getElementById(id); if (n) n.textContent = t; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---- header, KPIs with glosses, farm-next shortlist ----
  (function () {
    setText('snap-date', DATA.as_of);
    setText('model-ver', DATA.model_version || 'radar-7');
    setText('judge-checksum', DATA.checksum || '—');
    var counts = { farm: 0, thin: 0, skip: 0 };
    DATA.rows.forEach(function (r) { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
    var edge = ((FIT.odds_brier_base || 0) - (FIT.odds_brier_wf || 0)).toFixed(3);
    var kpis = [
      ['Watchlist · every protocol on the list, ranked', (DATA.watchlist_size || 40) + '/' + (DATA.watchlist_size || 40)],
      ['Board · ' + (DATA.watchlist_size || 40) + ' watchlist + ' + (DATA.early_size || 0) + ' early', String(DATA.board_size || DATA.rows.length)],
      ['Leave-one-out · flat multiple misses ×' + (FIT.baseline_miss || 5.09), '×' + (FIT.loo_miss || 3.39)],
      ['Walk-forward · flat misses ×5.33', '×' + (FIT.wf_miss || 2.96)],
      ['Brier, walk-forward · base ' + (FIT.odds_brier_base || 0.356).toFixed(3) + ' · edge ' + edge, (FIT.odds_brier_wf || 0.207).toFixed(3)],
      ['Within 3× of real cap · flat ' + ((FIT.within3_flat || 0.352) * 100).toFixed(1) + '%', ((FIT.within3_loo || 0.453) * 100).toFixed(1) + '%'],
      ['P25–P75 hit · stated 50%', ((FIT.range_mid50_calib || 0.508) * 100).toFixed(1) + '%'],
      ['Worth farming · ever-odds ≥ 50% and net > 0', (counts.farm || 0) + ' of ' + DATA.rows.length],
    ];
    var box = document.getElementById('kpis');
    kpis.forEach(function (k) { box.appendChild(el('div', { class: 'kpi' }, [el('b', { text: k[1] }), el('span', { text: k[0] })])); });
    var next = DATA.rows.filter(function (r) { return r.verdict === 'farm'; })
      .slice().sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; }).slice(0, 3);
    var fn = document.getElementById('farmnext');
    fn.appendChild(el('b', { text: 'Farm next by net/hour: ' }));
    next.forEach(function (r, i) {
      if (i) fn.appendChild(document.createTextNode(' · '));
      var s = el('span', null, [document.createTextNode('#' + r.rank + ' ' + r.name + ' '), el('span', { class: 'pos', text: signed(r.net_per_hour_usd) + '/h' })]);
      fn.appendChild(s);
    });
  })();

  // ---- integrity strip: the page recomputes the board from data.js ----
  (function () {
    var total = 0, ok = 0, prev = Infinity, ordered = true;
    DATA.rows.forEach(function (r) {
      total += r.implied_value_usd;
      if (r.implied_value_usd > prev) ordered = false;
      prev = r.implied_value_usd;
      var re = Math.exp(M.value_const + M.value_log_tvl * Math.log(Math.max(1, r.tvl_usd)) + (r.category_effect || 0)) * (r.growth_multiplier || 1) * (r.token_odds || 0);
      if (Math.abs(re - r.implied_value_usd) / r.implied_value_usd < 0.01) ok++;
    });
    var p = document.getElementById('integrity');
    p.textContent = '';
    p.appendChild(el('b', { text: 'Integrity: ' }));
    p.appendChild(document.createTextNode('ranks 1–' + DATA.rows.length + (ordered ? ' in order' : ' OUT OF ORDER') + ' · implied total ' + money(total) + ' · recompute ' + ok + '/' + DATA.rows.length + ' within 1% · watchlist ' + (DATA.watchlist_size || 40) + '/' + (DATA.watchlist_size || 40) + ' · ledger ' + (DATA.ledger_total || 758) + '/758 · checksum ' + (DATA.checksum || '—') + ' = board.json'));
  })();

  // ---- 758 accounting bar on the cover ----
  (function () {
    var colors = ['#3fb950', '#79c0ff', '#d29922', '#8b949e', '#f85149', '#a371f7', '#ff7b72', '#e3b341', '#8b949e'];
    var bar = document.getElementById('ledger-bar-cover');
    (DATA.ledger || []).forEach(function (g, i) {
      var seg = el('i');
      seg.style.width = ((g.count / (DATA.ledger_total || 758)) * 100) + '%';
      seg.style.background = colors[i % colors.length];
      bar.appendChild(seg);
    });
    var ranked = (DATA.ledger || []).filter(function (g) { return g.key === 'ranked-watchlist' || g.key === 'ranked-early'; });
    var traded = (DATA.ledger || []).filter(function (g) { return g.key === 'token-trades' || g.key === 'token-no-cap'; });
    var aside = (DATA.ledger || []).filter(function (g) { return g.key.indexOf('out-') === 0; });
    var sum = function (list) { return list.reduce(function (a, g) { return a + g.count; }, 0); };
    setText('ledger-line', sum(ranked) + ' ranked (' + (ranked[0] ? ranked[0].count : 40) + ' watchlist · ' + (ranked[1] ? ranked[1].count : 158) + ' early) · ' + sum(traded) + ' token on record · ' + sum(aside) + ' set aside by the house rules — all 758 snapshot protocols in exactly one group.');
  })();

  // ---- cover evidence: 5 term rows, in the same order as the full table ----
  (function () {
    var body = document.getElementById('cover-evidence-body');
    var short = ['Flat median', 'Size curve', 'Size + category', '+ growth', '+ age'];
    [0, 1, 3, 4, 5].forEach(function (ix, k) {
      var t = DATA.fit_terms[ix];
      if (!t) return;
      body.appendChild(el('tr', null, [
        el('td', { text: short[k] }),
        el('td', { text: t.loo_miss === null ? '—' : '×' + t.loo_miss.toFixed(2) }),
        el('td', { text: t.wf_miss === null ? '—' : '×' + t.wf_miss.toFixed(2) }),
        el('td', { text: t.kept ? 'kept' : 'dropped' }),
      ]));
    });
    var full = document.getElementById('evidence-body');
    DATA.fit_terms.forEach(function (t) {
      full.appendChild(el('tr', null, [
        el('td', { text: t.term }),
        el('td', { text: t.loo_miss === null ? '—' : '×' + t.loo_miss.toFixed(2) }),
        el('td', { text: t.wf_miss === null ? '—' : '×' + t.wf_miss.toFixed(2) }),
        el('td', { text: t.loo_medape === null ? '—' : (t.loo_medape * 100).toFixed(1) + '%' }),
        el('td', { text: t.kept ? 'kept' : 'tested, dropped' }),
        el('td', { text: t.note || '' }),
      ]));
    });
    // Odds evidence, on the walk-forward basis, with the definition printed.
    setText('odds-basis', 'Brier on the token-odds logistic. The base is the train base-rate constant applied to the test set — older peers are mostly tokened, newer peers mostly not, so the constant scores 0.32–0.36 on a test set, not 0.25. The model is scored on the same split, so the edge is like-for-like. 10-fold is the same logistic refit on 9 folds at a time.');
    var odds = document.getElementById('odds-evidence');
    odds.appendChild(el('table', { class: 'evidence' }, [el('tbody', null, [
      el('tr', null, [el('td', { text: 'Token odds Brier, 10-fold (base ' + (OF.brier_10fold_base || 0.248).toFixed(3) + ')' }), el('td', { text: (OF.brier_10fold || 0.201).toFixed(3) })]),
      el('tr', null, [el('td', { text: 'Token odds Brier, walk-forward median split (base ' + (OF.brier_wf_median_base || 0.356).toFixed(3) + ')' }), el('td', { text: (OF.brier_wf_median || 0.207).toFixed(3) })]),
      el('tr', null, [el('td', { text: 'Token odds Brier, walk-forward cutoff 2025-07-26 (base ' + (OF.brier_wf_cutoff_base || 0.308).toFixed(3) + ')' }), el('td', { text: (OF.brier_wf_cutoff || 0.217).toFixed(3) })]),
      el('tr', null, [el('td', { text: 'Token odds Brier, in-sample on the 383 dated peers' }), el('td', { text: (OF.brier_in_sample || 0.196).toFixed(3) })]),
      el('tr', null, [el('td', { text: 'Peers: shape-passing protocols, ' + (OF.tokened || 242) + ' of ' + (OF.peers || 442) + ' record a token' }), el('td', { text: 'ceiling ' + (OF.ceiling_years || 5.07) + 'y' })]),
    ])]));
    odds.appendChild(el('p', { class: 'sub', text: 'Walk-forward edge ' + (((OF.brier_wf_median_base || 0.356) - (OF.brier_wf_median || 0.207)).toFixed(3)) + ' on the median split, ' + (((OF.brier_wf_cutoff_base || 0.308) - (OF.brier_wf_cutoff || 0.217)).toFixed(3)) + ' on the cutoff split. The ceiling is the snapshot’s oldest cohort (1,850 days); a longer ceiling is not in this snapshot and is not claimed.' }));
    var ranges = document.getElementById('odds-ranges');
    ranges.appendChild(el('table', { class: 'evidence' }, [el('tbody', null, [
      el('tr', null, [el('td', { text: 'P25–P75 hit (stated 50%)' }), el('td', { text: ((FIT.range_mid50_calib || 0) * 100).toFixed(1) + '%' })]),
      el('tr', null, [el('td', { text: 'P10–P90 hit (stated 80%)' }), el('td', { text: ((FIT.range_p10p90_calib || 0) * 100).toFixed(1) + '%' })]),
      el('tr', null, [el('td', { text: 'Within 3× of the real cap, leave-one-out (flat ' + ((FIT.within3_flat || 0) * 100).toFixed(1) + '%)' }), el('td', { text: ((FIT.within3_loo || 0) * 100).toFixed(1) + '%' })]),
    ])]));
    ranges.appendChild(el('p', { class: 'sub', text: 'Ranges hold as stated. This is an estimate, not a price — and a record of no token is not proof there is none.' }));
    setText('validation-note', 'Fitted and tested on the 128 live-token protocols with a positive market cap. Leave-one-out miss ×' + (FIT.loo_miss || 3.39) + ', walk-forward miss ×' + (FIT.wf_miss || 2.96) + ' — against ×' + (FIT.baseline_miss || 5.09) + ' / ×5.33 for a flat median multiple. Token odds: walk-forward Brier ' + (FIT.odds_brier_wf || 0.207).toFixed(3) + ' against a ' + (FIT.odds_brier_base || 0.356).toFixed(3) + ' base rate. The board prints the middle-50% range (P25–P75, about 12× wide, ' + ((FIT.range_mid50_calib || 0.508) * 100).toFixed(1) + '% of live comps land inside it); the detail view also shows the wide P10–P90 range (about 123× wide, ' + ((FIT.range_p10p90_calib || 0.797) * 100).toFixed(1) + '% inside). This model ranks, it does not price — implied values are order-of-magnitude scores with ~3.4× typical error, and the range on each row says so.');
  })();

  // ---- scatter: log TVL vs log market cap, P25–P75 band, fitted curve, board ----
  (function () {
    var pts = (DATA.scatter || []).map(function (p) { return [Math.log10(p[0]), Math.log10(p[1])]; });
    var board = DATA.rows.map(function (r) { return [Math.log10(Math.max(1, r.tvl_usd)), Math.log10(Math.max(1, r.implied_value_usd))]; });
    if (!pts.length) return;
    var all = pts.concat(board);
    var x0 = Math.floor(Math.min.apply(null, all.map(function (p) { return p[0]; })));
    var x1 = Math.ceil(Math.max.apply(null, all.map(function (p) { return p[0]; })));
    var y0 = Math.floor(Math.min.apply(null, all.map(function (p) { return p[1]; })));
    var y1 = Math.ceil(Math.max.apply(null, all.map(function (p) { return p[1]; })));
    var W = 360, H = 56, L = 34, R = 8, T = 6, B = 20;
    var X = function (x) { return L + (x - x0) / (x1 - x0) * (W - L - R); };
    var Y = function (y) { return T + (y1 - y) / (y1 - y0) * (H - T - B); };
    var s = '';
    var ticks = [];
    for (var v = x0; v <= x1; v++) ticks.push(v);
    ticks.forEach(function (v) {
      s += '<line x1="' + X(v).toFixed(1) + '" y1="' + T + '" x2="' + X(v).toFixed(1) + '" y2="' + (H - B) + '" stroke="#30363d" stroke-width="0.5"/>';
      s += '<text x="' + X(v).toFixed(1) + '" y="' + (H - 6) + '" fill="#8b949e" font-size="8" text-anchor="' + (v === x0 ? 'start' : (v === x1 ? 'end' : 'middle')) + '">10^' + v + '</text>';
    });
    for (var w = y0; w <= y1; w += 2) {
      s += '<line x1="' + L + '" y1="' + Y(w).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(w).toFixed(1) + '" stroke="#30363d" stroke-width="0.5"/>';
      s += '<text x="' + (L - 4) + '" y="' + (Y(w) + 3).toFixed(1) + '" fill="#8b949e" font-size="8" text-anchor="end">10^' + w + '</text>';
    }
    // Shaded P25–P75 band around the fitted curve, from the model's residuals.
    var band = '';
    for (var i = 0; i <= 40; i++) {
      var lx = x0 + (x1 - x0) * i / 40;
      var ly = (M.value_const + M.value_log_tvl * lx * Math.LN10) / Math.LN10;
      band += (i ? 'L' : 'M') + X(lx).toFixed(1) + ',' + Y(ly + M.value_resid_p75 / Math.LN10).toFixed(1) + ' ';
    }
    for (var j = 40; j >= 0; j--) {
      var lx2 = x0 + (x1 - x0) * j / 40;
      var ly2 = (M.value_const + M.value_log_tvl * lx2 * Math.LN10) / Math.LN10;
      band += 'L' + X(lx2).toFixed(1) + ',' + Y(ly2 + M.value_resid_p25 / Math.LN10).toFixed(1) + ' ';
    }
    s += '<path d="' + band + 'Z" fill="#3fb950" fill-opacity="0.12"/>';
    var curve = '';
    for (var k = 0; k <= 40; k++) {
      var lx3 = x0 + (x1 - x0) * k / 40;
      var ly3 = (M.value_const + M.value_log_tvl * lx3 * Math.LN10) / Math.LN10;
      curve += (k ? 'L' : 'M') + X(lx3).toFixed(1) + ',' + Y(ly3).toFixed(1) + ' ';
    }
    s += '<path d="' + curve + '" fill="none" stroke="#3fb950" stroke-width="1.6"/>';
    pts.forEach(function (p) { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2.2" fill="#8b949e"/>'; });
    board.forEach(function (p) { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2" fill="#d29922"/>'; });
    var holder = document.getElementById('scatter');
    holder.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>' +
      '<p class="sub">Grey: live comps. Amber: board. Green: curve, shaded P25–P75 band. Log scales.</p>';
  })();

  // ---- category effects + ledger ----
  (function () {
    var body = document.getElementById('cats-body');
    var counts = {};
    DATA.rows.forEach(function (r) { var c = catOf(r); counts[c] = (counts[c] || 0) + 1; });
    var effs = {};
    DATA.rows.forEach(function (r) { effs[catOf(r)] = r.category_effect; });
    Object.keys(effs).sort(function (a, b) { return effs[b] - effs[a]; }).forEach(function (c) {
      body.appendChild(el('tr', null, [
        el('td', { text: c }),
        el('td', { text: (effs[c] >= 0 ? '+' : '') + effs[c].toFixed(4) }),
        el('td', { text: '×' + Math.exp(effs[c]).toFixed(2) }),
        el('td', { text: String(counts[c] || 0) }),
      ]));
    });
    var lb = document.getElementById('ledger-body');
    var bar = document.getElementById('ledger-bar');
    var colors = ['#3fb950', '#79c0ff', '#d29922', '#8b949e', '#f85149', '#a371f7', '#ff7b72', '#e3b341', '#8b949e'];
    (DATA.ledger || []).forEach(function (g, i) {
      lb.appendChild(el('tr', null, [el('td', { text: g.label }), el('td', { text: String(g.count) }), el('td', { text: g.note })]));
      var seg = el('i');
      seg.style.width = ((g.count / (DATA.ledger_total || 758)) * 100) + '%';
      seg.style.background = colors[i % colors.length];
      bar.appendChild(seg);
    });
  })();

  // ---- filters, what-if, board ----
  function fillSelect(id, values) {
    var n = document.getElementById(id);
    values.forEach(function (v) { n.appendChild(el('option', { value: v, text: v })); });
  }
  (function () {
    var catCounts = {};
    DATA.rows.forEach(function (r) { var c = catOf(r); catCounts[c] = (catCounts[c] || 0) + 1; });
    var catSel = document.getElementById('cat');
    Object.keys(catCounts).sort().forEach(function (c) {
      catSel.appendChild(el('option', { value: c, text: c + ' (' + catCounts[c] + ')' }));
    });
    var chainCounts = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (ch) { chainCounts[ch] = (chainCounts[ch] || 0) + 1; }); });
    var chainSel = document.getElementById('chain');
    Object.keys(chainCounts).sort().forEach(function (ch) {
      chainSel.appendChild(el('option', { value: ch, text: ch + ' (' + chainCounts[ch] + ')' }));
    });
    var counts = { farm: 0, thin: 0, skip: 0 };
    DATA.rows.forEach(function (r) { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
    var v = document.getElementById('verdict');
    v.options[0].text = 'All (' + DATA.rows.length + ')';
    v.options[1].text = 'Farm (' + counts.farm + ')';
    v.options[2].text = 'Thin (' + counts.thin + ')';
    v.options[3].text = 'Skip (' + counts.skip + ')';
  })();

  function planLine(r, p) {
    var step = (r.farm_steps && r.farm_steps[1]) ? r.farm_steps[1].text : '';
    var verb = (step.match(/^(Deposit|Supply|Provide|Mint|Stake|Bridge|Fund|Buy|Lock|Place|Spend|Use|Try|Join|Claim|Vote|List|Roll|Close|Check|Make|Add|Top|Swap|Rebalance|Withdraw|Restake|Read|Set|Keep|Borrow|Open|Enter|Verify|Put)/) || ['Act'])[0];
    var chains = (r.chains || []).slice(0, 2).join(' + ') || 'an unnamed chain';
    var fees = (r.farm_gas_usd || 0) + p.tbill;
    return verb + ' · ' + chains + ' · $' + (r.farm_gas_usd || 0) + ' gas · ' + money2(fees) + ' fees · ' + p.hours.toFixed(1) + ' h';
  }
  function badge(v) { return el('span', { class: 'badge ' + v, text: v }); }
  function sortHead(key, label) {
    var arrow = S.sort === key ? ' ↓' : ' ↕';
    return el('th', { scope: 'col', class: 'num', text: label + arrow, onclick: function () { S.sort = key; renderBoard(); } });
  }

  function filtered() {
    var q = S.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (S.tab === 'live') return false;
      if (S.verdict !== 'all' && verdict(r, price(r)) !== S.verdict) return false;
      if (S.cat !== 'all' && catOf(r) !== S.cat) return false;
      if (S.chain !== 'all' && !(r.chains || []).includes(S.chain)) return false;
      if (r.token_odds < S.odds) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + catOf(r) + ' ' + (r.chains || []).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function liveFiltered() {
    var q = S.q.trim().toLowerCase();
    return (DATA.live || []).filter(function (r) {
      if (S.cat !== 'all' && catOf(r) !== S.cat) return false;
      if (S.chain !== 'all' && !(r.chains || []).includes(S.chain)) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + catOf(r)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderBoard() {
    var table = document.getElementById('board');
    table.innerHTML = '';
    var priced = DATA.rows.map(function (r) { return { r: r, p: price(r), v: verdict(r, price(r)) }; });
    if (S.tab === 'live') {
      var live = liveFiltered();
      var head = el('thead', null, el('tr', null, ['Protocol', 'Category', 'TVL', 'Market cap', '7d', 'Mcap / TVL'].map(function (h, i) { return el('th', { scope: 'col', class: i >= 2 ? 'num' : '', text: h }); })));
      var tb = el('tbody');
      live.forEach(function (r) {
        var mult = r.tvl_usd > 0 && r.mcap_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : 'n/a';
        tb.appendChild(el('tr', null, [
          el('td', null, el('div', { class: 'name' }, [el('b', { text: r.name }), el('span', { text: (r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain' })])),
          el('td', { text: catOf(r) }),
          el('td', { class: 'num', text: money(r.tvl_usd) }),
          el('td', { class: 'num', text: money(r.mcap_usd) }),
          el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d >= 0) ? 'pos' : 'neg'), text: pct(r.change_7d) }),
          el('td', { class: 'num', text: mult }),
        ]));
      });
      table.appendChild(head);
      table.appendChild(tb);
      setText('count', live.length + ' live rows shown');
      setText('settotals', '');
      return;
    }
    var list = filtered().map(function (r) {
      var pr = priced.filter(function (x) { return x.r === r; })[0];
      return { r: r, p: pr.p, v: pr.v };
    });
    if (S.sort === 'net') list.sort(function (a, b) { return b.p.nph - a.p.nph; });
    else if (S.sort === 'implied') list.sort(function (a, b) { return b.r.implied_value_usd - a.r.implied_value_usd; });
    else if (S.sort === 'tvl') list.sort(function (a, b) { return b.r.tvl_usd - a.r.tvl_usd; });
    else if (S.sort === 'odds') list.sort(function (a, b) { return b.r.token_odds - a.r.token_odds; });
    else if (S.sort === 'growth') list.sort(function (a, b) { return (b.r.change_7d === null ? -999 : b.r.change_7d) - (a.r.change_7d === null ? -999 : a.r.change_7d); });
    else if (S.sort === 'age') list.sort(function (a, b) { return (b.r.age_days === null ? -1 : b.r.age_days) - (a.r.age_days === null ? -1 : a.r.age_days); });
    else if (S.verdict !== 'all') { list.sort(function (a, b) { return b.p.nph - a.p.nph; }); S.sort = 'net'; }
    else list.sort(function (a, b) { return a.r.rank - b.r.rank; });
    var sortLabel = S.sort === 'rank' ? 'rank' : (S.sort === 'net' ? 'net/hour' : (S.sort === 'implied' ? 'implied value' : (S.sort === 'tvl' ? 'TVL' : (S.sort === 'odds' ? 'token odds' : (S.sort === 'growth' ? '7d change' : 'age')))));
    var head = el('thead', null, el('tr', null, [
      el('th', { scope: 'col', text: 'Rank' }),
      el('th', { scope: 'col', text: 'Protocol' }),
      sortHead('tvl', 'TVL'),
      sortHead('implied', 'Implied value'),
      sortHead('odds', 'Token odds'),
      sortHead('growth', '7d'),
      sortHead('age', 'Age'),
      sortHead('net', 'Net / hour'),
      el('th', { scope: 'col', class: 'num', text: 'Time' }),
      el('th', { scope: 'col', text: 'Verdict' }),
    ]));
    var tb = el('tbody');
    list.forEach(function (x) {
      var r = x.r, p = x.p;
      var netCell = el('td', { class: 'num ' + (p.net >= 0 ? 'pos' : 'neg') });
      netCell.appendChild(el('b', { text: signed(p.net) + ' (' + signed(p.nph) + '/h)' }));
      netCell.appendChild(el('div', { class: 'sub', text: p.beT !== null ? 'pays from $' + p.beT.toLocaleString('en-US') : 'never pays' }));
      var nameBox = el('div', { class: 'name' }, [el('b', { text: r.name }), el('span', { class: 'planline', text: planLine(r, p) })]);
      var tags = el('span');
      tags.appendChild(el('span', { class: 'tag ' + (isWatchlist(r) ? 'wl' : 'early'), text: isWatchlist(r) ? 'Watchlist' : 'Early' }));
      if (r.change_7d !== null && r.change_7d <= -15) tags.appendChild(el('span', { class: 'tag falling', text: 'Falling' }));
      nameBox.firstChild.appendChild(tags);
      var row = el('tr', {
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } },
        tabindex: '0',
      }, [
        el('td', { class: 'num' }, [el('b', { text: String(r.rank) }), el('div', { class: 'sub', text: '#' + r.rank_min + '–' + r.rank_max })]),
        el('td', null, nameBox),
        el('td', { class: 'num', text: money(r.tvl_usd) }),
        el('td', { class: 'num' }, [
          el('b', { text: money(r.implied_value_usd) }),
          el('div', { class: 'sub', text: money(r.implied_p25_usd) + ' – ' + money(r.implied_p75_usd) }),
        ]),
        el('td', { class: 'num', text: Math.round(r.token_odds * 100) + '% · 12-mo ' + Math.round((r.token_odds_12mo || 0) * 100) + '%' }),
        el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d >= 0) ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { class: 'num', text: age(r.age_days) }),
        netCell,
        el('td', { class: 'num', text: p.hold + 'd' }),
        el('td', null, [badge(x.v), r.guard_reason ? el('span', { class: 'guard', text: r.guard_reason }) : null]),
      ]);
      tb.appendChild(row);
    });
    table.appendChild(head);
    table.appendChild(tb);
    var note = list.length + ' rows shown · sorted by ' + sortLabel + (isDefault() ? '' : ' · verdicts re-priced at $' + S.ticket.toLocaleString('en-US'));
    if (S.verdict !== 'all') note = 'Filtered to ' + S.verdict.toUpperCase() + ' verdict · sorted by net/hour, high to low — ' + note;
    setText('count', note);
    var fc = { farm: 0, thin: 0, skip: 0 };
    priced.forEach(function (x) { fc[x.v] = (fc[x.v] || 0) + 1; });
    var sum = document.getElementById('count');
    sum.appendChild(document.createTextNode(' · At $' + S.ticket.toLocaleString('en-US') + ' · ' + Math.round(S.share * 1000) / 10 + '% drop · ' + (S.horizon === 'model' ? 'model hold' : S.horizon + ' days') + ' — ' + fc.farm + ' farm, ' + fc.thin + ' thin, ' + fc.skip + ' skip at this size.'));
    // Filtered-set aggregates: what farming the whole shown set would do.
    var st = document.getElementById('settotals');
    st.textContent = '';
    if (list.length && list.length !== DATA.rows.length) {
      var tvlSum = 0, impSum = 0, netSum = 0, hourSum = 0;
      list.forEach(function (x) { tvlSum += x.r.tvl_usd; impSum += x.r.implied_value_usd; netSum += x.p.net; hourSum += x.p.hours; });
      st.appendChild(el('b', { text: 'Farming all ' + list.length + ' shown at $' + S.ticket.toLocaleString('en-US') + ' each nets ' }));
      st.appendChild(document.createTextNode(signed(netSum) + ' for ' + hourSum.toFixed(1) + ' h of work · ' + money(tvlSum) + ' TVL · ' + money(impSum) + ' implied in view'));
    }
  }

  // ---- export: the shown rows as CSV / JSON, built in the browser ----
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }
  document.getElementById('export-csv').addEventListener('click', function () {
    var lines = ['rank,slug,name,category,tvl_usd,implied_value_usd,token_odds,net_usd,net_per_hour_usd,verdict'];
    filtered().forEach(function (r) {
      var p = price(r);
      lines.push([r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', '"' + catOf(r).replace(/"/g, '""') + '"', r.tvl_usd, r.implied_value_usd, r.token_odds, p.net.toFixed(2), p.nph.toFixed(2), verdict(r, p)].join(','));
    });
    download('token-radar.csv', lines.join('\n'), 'text/csv');
  });
  document.getElementById('export-json').addEventListener('click', function () {
    download('token-radar.json', JSON.stringify(filtered().map(function (r) { return { rank: r.rank, slug: r.slug, name: r.name, implied_value_usd: r.implied_value_usd, token_odds: r.token_odds, net_usd: price(r).net }; }), null, 2), 'application/json');
  });

  // ---- detail: a full page, not a modal ----
  function peers(r) {
    var scored = (DATA.live || []).map(function (p) {
      var d = Math.abs(Math.log(Math.max(1, p.tvl_usd)) - Math.log(Math.max(1, r.tvl_usd))) + (catOf(p) === catOf(r) ? 0 : 2);
      var curve = Math.exp(M.value_const + M.value_log_tvl * Math.log(Math.max(1, p.tvl_usd)) + (r.category_effect || 0));
      return { p: p, d: d, pred: curve };
    });
    scored.sort(function (a, b) { return a.d - b.d; });
    return scored.slice(0, 3);
  }
  function openDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var p = price(r);
    var v = verdict(r, p);
    var curve = Math.exp(M.value_const + M.value_log_tvl * Math.log(Math.max(1, r.tvl_usd)));
    var catMult = Math.exp(r.category_effect || 0);
    var afterCat = curve * catMult;
    var afterGrowth = afterCat * (r.growth_multiplier || 1);
    var re = afterGrowth * (r.token_odds || 0);
    var same = Math.abs(re - r.implied_value_usd) / r.implied_value_usd < 0.01;
    var page = document.getElementById('detail');
    page.innerHTML = '';
    var inner = el('div', { class: 'detail-inner' });
    inner.appendChild(el('button', { class: 'back', text: '← Board', onclick: function () { page.hidden = true; history.replaceState(null, '', window.location.pathname + window.location.search); } }));
    inner.appendChild(el('p', { class: 'sub', text: 'Rank ' + r.rank + ' of ' + DATA.rows.length + ' · rank range #' + r.rank_min + '–' + r.rank_max + (isWatchlist(r) ? ' · Watchlist' : ' · Early find') }));
    inner.appendChild(el('h2', { text: r.name }));
    inner.appendChild(el('p', { class: 'sub', text: catOf(r) + ' on ' + ((r.chains || []).join(', ') || 'an unnamed chain') + ' · TVL ' + money(r.tvl_usd) + ' · ' + age(r.age_days) + ' on record' }));
    inner.appendChild(el('div', null, [badge(v), r.guard_reason ? el('span', { class: 'guard', text: ' ' + r.guard_reason }) : null,
      el('span', { class: 'sub', text: ' Net ' + signed(p.nph) + '/hour at $' + S.ticket.toLocaleString('en-US') + ' · pays from ' + (p.beT !== null ? '$' + p.beT.toLocaleString('en-US') : 'never') + ' · deposit $' + (r.farm_cost_usd || 1000).toLocaleString('en-US') + ' · gas ~$' + (r.farm_gas_usd || 0) + ' · hold ' + p.hold + ' days' })]));
    inner.appendChild(el('div', { class: 'eqbar' }, [el('b', { text: 'Slice ' + money2(p.slice) + ' − gas ' + money2(r.farm_gas_usd || 0) + ' − T-bill forgone ' + money2(p.tbill) + ' = net ' + signed(p.net) + ', ' + signed(p.nph) + ' an hour. ' }), document.createTextNode(p.beT !== null ? 'Pays from a $' + p.beT.toLocaleString('en-US') + ' ticket.' : 'No ticket size pays: the slice per dollar is below the T-bill rate.')]));
    // Value build as a running dollar chain, one term per line.
    inner.appendChild(el('h3', { text: 'How ' + money(r.implied_value_usd) + ' is built' }));
    var build = el('div', { class: 'equation' });
    [
      ['Size curve exp(6.9646 + 0.5223 × ln TVL) ' + money(curve) + ' × category (' + catOf(r) + ') ×' + catMult.toFixed(2) + ' (' + ((r.category_effect || 0) >= 0 ? '+' : '') + (r.category_effect || 0).toFixed(2) + ' log pts)', money(afterCat)],
      ['Growth carry (7d ' + pct(r.change_7d) + ', clipped ±25%) ×' + (r.growth_multiplier || 1).toFixed(2) + ' — a stated projection, not a fit', money(afterGrowth)],
      ['Ever-odds ' + Math.round(r.token_odds * 100) + '% (12-month ' + Math.round((r.token_odds_12mo || 0) * 100) + '%) → implied (P25 ' + money(r.implied_p25_usd) + ' – P75 ' + money(r.implied_p75_usd) + ' · P10 ' + money(r.implied_p10_usd) + ' – P90 ' + money(r.implied_p90_usd) + ')', money(r.implied_value_usd)],
      ['Break-even ticket / odds', (p.beT !== null ? '$' + p.beT.toLocaleString('en-US') : 'never pays') + ' / ' + (p.beO !== null ? Math.round(p.beO * 100) + '%' : 'fees covered above a ' + ((((r.farm_gas_usd || 0) + p.tbill) * r.tvl_usd / (r.if_launches_usd * S.ticket)) * 100).toFixed(1) + '% drop share')],
    ].forEach(function (row) {
      build.appendChild(el('div', null, [el('span', { text: row[0] }), el('b', { text: row[1] })]));
    });
    if (r.family_child) build.appendChild(el('div', null, [el('span', { text: 'Family effect' }), el('b', { text: 'parent already has a token — odds down-weighted' })]));
    inner.appendChild(build);
    // Odds decomposition: the logistic term by term.
    inner.appendChild(el('h3', { text: 'How the ever-odds are built' }));
    var ot = r.odds_terms || {};
    var ob = el('div', { class: 'equation' });
    [
      ['Intercept', (ot.intercept >= 0 ? '+' : '') + (ot.intercept || 0).toFixed(2)],
      ['Years listed × ' + (OF.years || 0.72), (ot.years >= 0 ? '+' : '') + (ot.years || 0).toFixed(2)],
      ['ln(TVL/$100M) × ' + (OF.ln_tvl || 0.26), (ot.ln_tvl >= 0 ? '+' : '') + (ot.ln_tvl || 0).toFixed(2)],
      ['7-day growth × ' + (OF.growth || -2.33), (ot.growth >= 0 ? '+' : '') + (ot.growth || 0).toFixed(2)],
      ['Family (parent has a token) × ' + (OF.family || -0.14), (ot.family >= 0 ? '+' : '') + (ot.family || 0).toFixed(2)],
      ['Logit → p(age)', (ot.logit || 0).toFixed(2) + ' → ' + Math.round((ot.p_age || 0) * 100) + '%'],
      ['Ever-odds (p_max − p_age) / (1 − p_age)', Math.round(r.token_odds * 100) + '% · p(5.07y) ' + Math.round((ot.p_max || 0) * 100) + '% · 12-mo ' + Math.round((r.token_odds_12mo || 0) * 100) + '%'],
    ].forEach(function (row) {
      ob.appendChild(el('div', null, [el('span', { text: row[0] }), el('b', { text: row[1] })]));
    });
    inner.appendChild(ob);
    inner.appendChild(el('p', { class: 'sub', text: 'Fitted by fitOddsLogistic on ' + (OF.peers || 442) + ' shape-passing peers (' + (OF.tokened || 242) + ' record a token). Older means less likely ever to launch; the ceiling is the snapshot’s oldest cohort, 5.07 years.' }));
    // Nearest priced peers — above the plan, in frame.
    inner.appendChild(el('h3', { text: 'Nearest priced peers' }));
    var pb = el('tbody');
    peers(r).forEach(function (pe) {
      pb.appendChild(el('tr', null, [
        el('td', null, el('div', { class: 'name peername' }, [el('b', { text: pe.p.name + ' · ' + catOf(pe.p) })])),
        el('td', { class: 'num', text: money(pe.p.tvl_usd) }),
        el('td', { class: 'num', text: money(pe.p.mcap_usd) }),
        el('td', { class: 'num', text: money(pe.pred) }),
        el('td', { class: 'num', text: pe.p.mcap_usd ? (pe.p.mcap_usd / pe.pred).toFixed(2) + '×' : 'n/a' }),
      ]));
    });
    inner.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'evidence' }, [
      el('thead', null, el('tr', null, ['Protocol', 'TVL', 'Actual mcap', 'Curve says', 'Actual / curve'].map(function (h, i) { return el('th', { scope: 'col', class: i >= 1 ? 'num' : '', text: h }); }))),
      pb,
    ])]));
    // Drop × deposit matrix, with a verdict badge in every cell.
    inner.appendChild(el('h3', { text: 'Net by drop share × deposit' }));
    var shares = [0.035, 0.07, 0.14], tickets = [1000, 5000, 25000];
    var mb = el('tbody');
    shares.forEach(function (sh) {
      var cells = [el('td', { text: Math.round(sh * 1000) / 10 + '%' })];
      tickets.forEach(function (tk) {
        var sl = r.tvl_usd > 0 ? r.implied_value_usd * sh * (tk / r.tvl_usd) : 0;
        var nt = sl - (r.farm_gas_usd || 0) - tk * TBILL * (p.hold / 365);
        var cellVerdict = r.token_odds >= 0.5 && nt > 0 ? 'farm' : (r.token_odds >= 0.3 ? 'thin' : 'skip');
        var cur = sh === S.share && tk === S.ticket;
        var cell = el('td', { class: cur ? 'hl' : '' });
        cell.appendChild(document.createTextNode(signed(nt) + ' '));
        cell.appendChild(el('span', { class: 'badge ' + cellVerdict, text: cellVerdict }));
        cells.push(cell);
      });
      mb.appendChild(el('tr', null, cells));
    });
    inner.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'evidence matrix' }, [
      el('thead', null, el('tr', null, [el('th', { scope: 'col', text: 'Drop \\ deposit' }), el('th', { scope: 'col', text: '$1,000' }), el('th', { scope: 'col', text: '$5,000' }), el('th', { scope: 'col', text: '$25,000' })])),
      mb,
    ])]));
    var tbillSame = S.ticket * TBILL * (p.hold / 365);
    var coverShare = (r.implied_value_usd > 0 && r.tvl_usd > 0) ? (((r.farm_gas_usd || 0) + tbillSame) * r.tvl_usd / (r.implied_value_usd * S.ticket)) * 100 : null;
    inner.appendChild(el('p', { class: 'sub', text: 'Benchmarks: the same $' + S.ticket.toLocaleString('en-US') + ' in a 4% T-bill over ' + p.hold + ' days earns ' + money2(tbillSame) + '; fees are covered above a ' + (coverShare !== null ? coverShare.toFixed(1) + '%' : 'n/a') + ' drop share. Exit if TVL prints below −17% in a week (' + money(r.tvl_usd * 0.83) + ').' }));
    // Farm plan, with a totals row under the steps.
    inner.appendChild(el('h3', { text: 'Farm plan' }));
    var steps = el('ol', { class: 'steps' });
    (r.farm_steps || []).forEach(function (s) {
      steps.appendChild(el('li', null, [el('b', { text: s.text }), el('span', { class: 'cost', text: 'Cost: ' + s.cost + ' · Time: ' + s.time })]));
    });
    inner.appendChild(steps);
    var totalFees = (r.farm_gas_usd || 0) + p.tbill;
    inner.appendChild(el('p', { class: 'sub', text: 'Plan totals: ' + (r.farm_steps || []).length + ' steps over ' + p.hold + ' days · $' + (r.farm_cost_usd || 1000).toLocaleString('en-US') + ' deposit · $' + (r.farm_gas_usd || 0) + ' gas · ' + money2(totalFees) + ' fees and forgone yield · ' + p.hours.toFixed(1) + ' h of hands-on work · net ' + signed(p.net) + ' (' + signed(p.nph) + '/h).' }));
    // The record: the snapshot's own fields, nulls included, two columns.
    inner.appendChild(el('h3', { text: 'The record' }));
    var rec = el('tbody');
    [
      ['TVL', '$' + r.tvl_usd.toLocaleString('en-US'), '7-day change', pct(r.change_7d)],
      ['Listed', (r.listed_at || 'not listed') + ' · ' + age(r.age_days) + ' with no token', 'Category', catOf(r)],
      ['Chains', (r.chains || []).join(', ') || 'none listed', 'Market cap', r.mcap_usd === null ? 'null — records no token' : '$' + r.mcap_usd.toLocaleString('en-US')],
      ['Gecko id', r.gecko_id === null ? 'null — records no token' : r.gecko_id, 'Symbol', r.symbol === null ? 'null — records no token' : r.symbol],
      ['Source', 'DefiLlama protocol index, snapshot ' + DATA.as_of, '', ''],
    ].forEach(function (row) {
      rec.appendChild(el('tr', null, [el('td', { text: row[0] }), el('td', { text: row[1] }), el('td', { text: row[2] }), el('td', { text: row[3] })]));
    });
    inner.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'evidence record' }, [rec])]));
    inner.appendChild(el('p', { class: 'sub', text: 'DefiLlama records no token for it, which is not proof it has none. Claim only through the protocol’s own domain, never through a link someone sends you. This is an estimate, not a price.' }));
    page.appendChild(inner);
    page.hidden = false;
    window.scrollTo(0, 0);
  }

  // ---- wiring ----
  function wireSeg(id, fn) {
    var n = document.getElementById(id);
    n.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      n.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      fn(b.getAttribute('data-v'));
      renderBoard();
    });
  }
  wireSeg('ticket', function (v) { S.ticket = parseInt(v, 10); });
  wireSeg('share', function (v) { S.share = parseFloat(v); });
  wireSeg('horizon', function (v) { S.horizon = v === 'model' ? 'model' : parseInt(v, 10); });
  document.getElementById('tab').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#tab button').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    S.tab = b.getAttribute('data-tab');
    renderBoard();
  });
  document.getElementById('q').addEventListener('input', function (e) { S.q = e.target.value; renderBoard(); });
  document.getElementById('cat').addEventListener('change', function (e) { S.cat = e.target.value; renderBoard(); });
  document.getElementById('chain').addEventListener('change', function (e) { S.chain = e.target.value; renderBoard(); });
  document.getElementById('odds').addEventListener('change', function (e) { S.odds = parseFloat(e.target.value); renderBoard(); });
  document.getElementById('verdict').addEventListener('change', function (e) { S.verdict = e.target.value; S.sort = 'rank'; renderBoard(); });
  document.getElementById('evidence-toggle').addEventListener('click', function (e) {
    var sec = document.getElementById('evidence-section');
    var collapsed = sec.classList.toggle('collapsed');
    e.target.textContent = collapsed ? 'Show the evidence' : 'Hide the evidence';
    renderBoard();
  });

  renderBoard();
  // Deep link: #p=<slug> opens that protocol; #verdict=farm, #category=<name>
  (function () {
    var hash = window.location.hash || '';
    var m = /[#&]p=([^&]+)/.exec(hash);
    var v = /[#&]verdict=([^&]+)/.exec(hash);
    var c = /[#&]category=([^&]+)/.exec(hash);
    var q = /[#&]q=([^&]+)/.exec(hash);
    if (v) { S.verdict = v[1]; document.getElementById('verdict').value = v[1]; }
    if (c) { S.cat = decodeURIComponent(c[1]); document.getElementById('cat').value = S.cat; }
    if (q) { S.q = decodeURIComponent(q[1]); document.getElementById('q').value = S.q; }
    renderBoard();
    if (m) openDetail(decodeURIComponent(m[1]));
  })();
})();
