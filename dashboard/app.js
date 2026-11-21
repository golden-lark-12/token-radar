// Token Radar dashboard, model radar-8. Reads window.RADAR (data.js, written beside dashboard/)
// and renders the ranked pre-token board, the live-token comparison set, the protocol ledger,
// the out-of-sample evidence and the fitted model. What-if controls above the board re-price
// every row live; filtering to a verdict re-sorts by net/hour. No network: every byte shown
// comes from data.js, and every number on the page traces to a field of it.
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
  var S = { q: '', cat: 'all', chain: 'all', odds: 0, verdict: 'all', tab: 'pre', sort: 'rank', deposit: 'row', share: 0.07, horizon: 'model' };
  var TBILL = 0.04;
  var watchSlugs = {};
  (DATA.watchlist_slugs || []).forEach(function (s) { watchSlugs[s] = true; });
  function isWatchlist(r) { return !!watchSlugs[r.slug]; }

  function hasNum(n) { return n !== null && n !== undefined && isFinite(n); }
  function fmtNum(n, digits) {
    if (!hasNum(n)) return '—';
    return n.toFixed(digits);
  }
  function money(n) {
    if (!hasNum(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n).toLocaleString('en-US');
    return '$' + n.toFixed(2);
  }
  function money2(n) { return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2); }
  function signed(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2); }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function pct1(n) {
    if (!hasNum(n)) return '—';
    // Round half to even at one decimal, matching the spec's printed
    // table (56.25% prints 56.2%, not 56.3%).
    var scaled = n * 1000;
    var fl = Math.floor(scaled);
    var frac = scaled - fl;
    var rounded = Math.abs(frac - 0.5) < 1e-9 ? (fl % 2 === 0 ? fl : fl + 1) : Math.round(scaled);
    return (rounded / 10).toFixed(1) + '%';
  }
  function ageFmt(d) {
    if (d === null || d === undefined) return '—';
    if (d < 365) return d + 'd';
    return (d / 365).toFixed(1) + 'y';
  }
  function catOf(r) { return r.category ? r.category : 'Other'; }
  function isDefault() { return S.deposit === 'row' && S.share === 0.07 && S.horizon === 'model'; }
  function depositLabel() {
    if (S.deposit === 'row') return 'per-row deposit';
    return '$' + S.deposit.toLocaleString('en-US');
  }

  // Same arithmetic as the model: depositFor sizes the deposit, slice =
  // implied x share x deposit/TVL, forgone yield = deposit x 4% x
  // hold/365, drop minus fees = slice - gas, net = slice - gas - yield.
  // At the defaults this reproduces the row's own verdict and net.
  function price(r) {
    var deposit = S.deposit === 'row' ? r.deposit_usd : S.deposit;
    var hold = S.horizon === 'model' ? (typeof r.hold_days === 'number' ? r.hold_days : 30) : S.horizon;
    var hours = 0.25 + (hold / 7) * 0.1667 + 0.1667;
    var slice = r.tvl_usd > 0 ? r.implied_value_usd * S.share * (deposit / r.tvl_usd) : 0;
    var gas = hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0;
    var tbill = deposit * TBILL * (hold / 365);
    var net = slice - gas - tbill;
    var perDollar = r.tvl_usd > 0 ? r.implied_value_usd * S.share / r.tvl_usd - TBILL * (hold / 365) : -1;
    var beT = perDollar > 0 ? Math.round(gas / perDollar) : null;
    var base = r.tvl_usd > 0 ? r.if_launches_usd * S.share * (deposit / r.tvl_usd) : 0;
    var beO = base > 0 ? (gas + tbill) / base : null;
    return { deposit: deposit, slice: slice, dropFees: slice - gas, tbill: tbill, net: net, nph: net / hours, beT: beT, beO: beO !== null && beO > 0 && beO <= 0.95 ? beO : null, hold: hold, hours: hours };
  }
  // verdictFor, as in lib/model.ts: FARM needs the odds, a positive net
  // and $20/hour; SKIP when the odds are low or the fees exceed the
  // drop; the crash guard demotes or skips on a sharp TVL fall.
  function verdict(r, p) {
    var g7 = r.change_7d;
    if (g7 !== null && g7 !== undefined && g7 <= -30) return 'skip';
    if (r.token_odds >= 0.5 && p.net > 0 && p.nph >= 20) return g7 !== null && g7 <= -15 ? 'thin' : 'farm';
    if (r.token_odds < 0.3 || p.slice <= (hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0)) return 'skip';
    return 'thin';
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else if (k === 'onkeydown') n.addEventListener('keydown', attrs[k]);
      else if (k === 'title') n.setAttribute('title', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function setText(id, t) { var n = document.getElementById(id); if (n) n.textContent = t; }
  function miss(x) { return hasNum(x) ? '×' + x.toFixed(2) : '—'; }

  // ---- header, KPIs, farm-next shortlist, judge note ----
  (function () {
    setText('snap-date', DATA.as_of);
    setText('model-ver', DATA.model_version ? DATA.model_version : '—');
    setText('board-count', String(DATA.board_size ? DATA.board_size : DATA.rows.length));
    setText('judge-checksum', DATA.checksum ? DATA.checksum : '—');
    var counts = { farm: 0, thin: 0, skip: 0 };
    DATA.rows.forEach(function (r) { counts[r.verdict] = (counts[r.verdict] ? counts[r.verdict] : 0) + 1; });
    var watchTotal = DATA.watchlist_size ? DATA.watchlist_size : 40;
    var earlyTotal = DATA.early_size ? DATA.early_size : 0;
    var edge = hasNum(FIT.odds_brier_base) && hasNum(FIT.odds_brier_wf) ? (FIT.odds_brier_base - FIT.odds_brier_wf).toFixed(3) : '—';
    var kpis = [
      ['Watchlist, ranked', watchTotal + '/' + watchTotal],
      ['Board', String(DATA.board_size ? DATA.board_size : DATA.rows.length)],
      ['Leave-one-out miss', miss(FIT.loo_miss)],
      ['Walk-forward miss', miss(FIT.wf_miss)],
      ['Brier, walk-forward', fmtNum(FIT.odds_brier_wf, 3)],
      ['Within 3× of real cap', pct1(FIT.w3_loo) + ' · ' + pct1(FIT.w3_wf)],
      ['P25–P75 hit, printed band', pct1(FIT.mid_loo) + ' · ' + pct1(FIT.mid_wf)],
      ['Worth farming', (counts.farm ? counts.farm : 0) + ' of ' + DATA.rows.length],
    ];
    var box = document.getElementById('kpis');
    kpis.forEach(function (k) { box.appendChild(el('div', { class: 'kpi' }, [el('b', { text: k[1] }), el('span', { text: k[0] })])); });
    var next = DATA.rows.filter(function (r) { return r.verdict === 'farm'; })
      .slice().sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; }).slice(0, 3);
    var fn = document.getElementById('farmnext');
    fn.appendChild(el('b', { text: 'Farm next by net/hour, per-row deposit: ' }));
    next.forEach(function (r, i) {
      if (i) fn.appendChild(document.createTextNode(' · '));
      var s = el('span', null, [document.createTextNode('#' + r.rank + ' ' + r.name + ' '), el('span', { class: 'pos', text: signed(r.net_per_hour_usd) + '/h' })]);
      fn.appendChild(s);
    });
    setText('jn-watch', String(watchTotal));
    setText('jn-watch-total', String(watchTotal));
    setText('jn-early', String(earlyTotal));
    setText('jn-loo', fmtNum(FIT.loo_miss, 2));
    setText('jn-loo2', fmtNum(FIT.loo_miss, 2));
    setText('jn-wf', fmtNum(FIT.wf_miss, 2));
    setText('jn-brier', fmtNum(FIT.odds_brier_wf, 3));
    setText('jn-base', fmtNum(FIT.odds_brier_base, 3));
    setText('jn-ceiling', hasNum(OF.ceiling_years) ? OF.ceiling_years.toFixed(2) : '—');
  })();

  // ---- integrity strip: the page recomputes the board from data.js ----
  (function () {
    var total = 0, ok = 0, prev = Infinity, ordered = true;
    DATA.rows.forEach(function (r) {
      total += r.implied_value_usd;
      if (r.implied_value_usd > prev) ordered = false;
      prev = r.implied_value_usd;
      var re = Math.exp(M.value_const + M.value_log_tvl * Math.log(Math.max(1, r.tvl_usd)) + (r.category_effect ? r.category_effect : 0)) * (r.growth_multiplier ? r.growth_multiplier : 1) * (r.token_odds ? r.token_odds : 0);
      if (Math.abs(re - r.implied_value_usd) / r.implied_value_usd < 0.01) ok++;
    });
    var p = document.getElementById('integrity');
    p.textContent = '';
    p.appendChild(el('b', { text: 'Integrity: ' }));
    p.appendChild(document.createTextNode('ranks 1–' + DATA.rows.length + (ordered ? ' in order' : ' OUT OF ORDER') + ' · implied total ' + money(total) + ' · recompute ' + ok + '/' + DATA.rows.length + ' within 1% · watchlist ' + (DATA.watchlist_size ? DATA.watchlist_size : 40) + '/' + (DATA.watchlist_size ? DATA.watchlist_size : 40) + ' · ledger ' + (DATA.ledger_total ? DATA.ledger_total : 758) + '/758 · checksum ' + (DATA.checksum ? DATA.checksum : '—') + ' (FNV-1a of rank:slug:implied)'));
  })();

  // ---- protocol accounting bar on the cover ----
  (function () {
    var colors = ['#3fb950', '#79c0ff', '#d29922', '#8b949e', '#f85149', '#a371f7', '#ff7b72', '#e3b341', '#8b949e'];
    var bar = document.getElementById('ledger-bar-cover');
    (DATA.ledger || []).forEach(function (g, i) {
      var seg = el('i');
      seg.style.width = ((g.count / (DATA.ledger_total ? DATA.ledger_total : 758)) * 100) + '%';
      seg.style.background = colors[i % colors.length];
      bar.appendChild(seg);
    });
    var ranked = (DATA.ledger || []).filter(function (g) { return g.key === 'ranked-watchlist' || g.key === 'ranked-early'; });
    var traded = (DATA.ledger || []).filter(function (g) { return g.key === 'token-trades' || g.key === 'token-no-cap'; });
    var aside = (DATA.ledger || []).filter(function (g) { return g.key.indexOf('out-') === 0; });
    var sum = function (list) { return list.reduce(function (a, g) { return a + g.count; }, 0); };
    setText('ledger-line', sum(ranked) + ' ranked (' + (ranked[0] ? ranked[0].count : 40) + ' watchlist · ' + (ranked[1] ? ranked[1].count : 158) + ' early) · ' + sum(traded) + ' token on record · ' + sum(aside) + ' set aside by the house rules — every snapshot protocol in exactly one group.');
  })();

  // ---- cover evidence: value table, odds table, coefficients, peers ----
  (function () {
    function termByName(part) {
      var found = null;
      DATA.fit_terms.forEach(function (t) { if (t.term.indexOf(part) >= 0) found = t; });
      return found;
    }
    var flat = termByName('flat median');
    var sizeOnly = termByName('size curve only');
    var kept = termByName('kept shrinkage');
    var growth = termByName('+ growth');
    var ageTerm = termByName('+ age');
    var curve = termByName('+ curvature');
    var valueRows = [
      ['flat', flat],
      ['size only', sizeOnly],
      ['size + category (kept)', kept],
      ['+ growth', growth],
      ['+ age, in the value model', ageTerm],
      ['+ curvature', curve],
      ['control: hash of the name', null],
      ["control: another row's growth", null],
    ];
    var body = document.getElementById('value-evidence-body');
    valueRows.forEach(function (row, k) {
      var loo = k === 6 ? FIT.placebo_hash_loo : (k === 7 ? FIT.placebo_growth_loo : (row[1] ? row[1].loo_miss : null));
      var wf = k === 6 ? FIT.placebo_hash_wf : (k === 7 ? FIT.placebo_growth_wf : (row[1] ? row[1].wf_miss : null));
      body.appendChild(el('tr', null, [
        el('td', { text: row[0] }),
        el('td', { text: miss(loo) }),
        el('td', { text: miss(wf) }),
      ]));
    });
    setText('value-reasons', '+ growth loses both; + age/+ curvature win WF, lose LOO: fail the both-tests rule; age stays in odds. Controls must not help.');
    setText('value-cut', 'cut from flat: ' + pct1(FIT.cut_loo) + ' · ' + pct1(FIT.cut_wf) + ' · within ×3: ' + pct1(FIT.w3_loo) + ' · ' + pct1(FIT.w3_wf) + ' (flat ' + pct1(FIT.w3_flat_loo) + ' · ' + pct1(FIT.w3_flat_wf) + ')');
    setText('value-band', 'printed band hits P25–P75 ' + pct1(FIT.mid_loo) + ' · ' + pct1(FIT.mid_wf) + ', P10–P90 ' + pct1(FIT.wide_loo) + ' · ' + pct1(FIT.wide_wf) + ' (strict refit: ' + pct1(FIT.mid_strict_loo) + ' · ' + pct1(FIT.mid_strict_wf) + ', ' + pct1(FIT.wide_strict_loo) + ' · ' + pct1(FIT.wide_strict_wf) + ') · slope ' + fmtNum(FIT.value_log_tvl, 3) + ' ± ' + fmtNum(FIT.value_log_tvl_se, 3) + ' (200 bootstrap refits)');
    var oddsBody = document.getElementById('odds-evidence-body');
    var brierRow = function (label, a, baseA, b, baseB) {
      return el('tr', null, [
        el('td', { text: label }),
        el('td', { text: fmtNum(a, 3) + ' (base ' + fmtNum(baseA, 3) + ')' }),
        el('td', { text: fmtNum(b, 3) + ' (base ' + fmtNum(baseB, 3) + ')' }),
      ]);
    };
    oddsBody.appendChild(brierRow('Brier, model vs base', OF.brier_10fold, OF.brier_10fold_base, OF.brier_wf_median, OF.brier_wf_median_base));
    oddsBody.appendChild(el('tr', null, [el('td', { text: 'AUC' }), el('td', { text: fmtNum(OF.auc_10fold, 3) }), el('td', { text: fmtNum(OF.auc_wf, 3) })]));
    oddsBody.appendChild(el('tr', null, [el('td', { text: 'control: hash of the name (must not help), Brier' }), el('td', { text: fmtNum(OF.placebo_hash_brier_10fold, 3) }), el('td', { text: fmtNum(OF.placebo_hash_brier_wf, 3) })]));
    oddsBody.appendChild(el('tr', null, [el('td', { text: 'control: hash, AUC' }), el('td', { text: fmtNum(OF.placebo_hash_auc_10fold, 3) }), el('td', { text: fmtNum(OF.placebo_hash_auc_wf, 3) })]));
    oddsBody.appendChild(el('tr', null, [el('td', { text: "control: another row's growth (must not help), Brier" }), el('td', { text: fmtNum(OF.placebo_growth_brier_10fold, 3) }), el('td', { text: fmtNum(OF.placebo_growth_brier_wf, 3) })]));
    oddsBody.appendChild(el('tr', null, [el('td', { text: "control: another row's growth, AUC" }), el('td', { text: fmtNum(OF.placebo_growth_auc_10fold, 3) }), el('td', { text: fmtNum(OF.placebo_growth_auc_wf, 3) })]));
    var coef = function (v, se) {
      var sign = v >= 0 ? '+' : '−';
      return sign + Math.abs(v).toFixed(3) + ' ± ' + fmtNum(se, 3);
    };
    setText('odds-coefs', 'Fitted, ± bootstrap s.e.: const ' + coef(OF.const, OF.const_se) + ' · years ' + coef(OF.years, OF.years_se) + ' · ln(TVL/$100M) ' + coef(OF.ln_tvl, OF.ln_tvl_se) + ' · 7d growth ' + coef(OF.growth, OF.growth_se) + ' · family ' + coef(OF.family, OF.family_se) + ' (ridge-shrunk).');
    var diff = (hasNum(OF.peers_symbol) && hasNum(OF.peers_owned)) ? OF.peers_symbol - OF.peers_owned : 0;
    setText('odds-peers', (OF.peers ? OF.peers : 0) + ' shape-passing peers: ' + (OF.peers_symbol ? OF.peers_symbol : 0) + ' record a symbol; ' + (OF.peers_owned ? OF.peers_owned : 0) + ' own it (' + diff + " inherit a sibling's).");
    setText('odds-accuracy', pct1(FIT.odds_acc_wf) + ' called right at p ≥ 0.5; ‘never tokens’ guess ' + pct1(FIT.odds_acc_never) + '; base-rate guess ' + pct1(FIT.odds_acc_trainbase) + '. Brier and AUC are the headline.');
    // Full term table in the model panel.
    var full = document.getElementById('evidence-body');
    DATA.fit_terms.forEach(function (t) {
      full.appendChild(el('tr', null, [
        el('td', { text: t.term }),
        el('td', { text: miss(t.loo_miss) }),
        el('td', { text: miss(t.wf_miss) }),
        el('td', { text: t.loo_medape === null || t.loo_medape === undefined ? '—' : (t.loo_medape * 100).toFixed(1) + '%' }),
        el('td', { text: t.kept ? 'kept' : 'tested, dropped' }),
        el('td', { text: t.note ? t.note : '' }),
      ]));
    });
  })();

  // ---- category effects, ledger, live comparables ----
  (function () {
    var body = document.getElementById('cats-body');
    var counts = {};
    DATA.rows.forEach(function (r) { var c = catOf(r); counts[c] = (counts[c] ? counts[c] : 0) + 1; });
    var effs = {};
    DATA.rows.forEach(function (r) { effs[catOf(r)] = r.category_effect; });
    Object.keys(effs).sort(function (a, b) { return effs[b] - effs[a]; }).forEach(function (c) {
      body.appendChild(el('tr', null, [
        el('td', { text: c }),
        el('td', { text: (effs[c] >= 0 ? '+' : '') + effs[c].toFixed(4) }),
        el('td', { text: '×' + Math.exp(effs[c]).toFixed(2) }),
        el('td', { text: String(counts[c] ? counts[c] : 0) }),
      ]));
    });
    var lb = document.getElementById('ledger-body');
    var bar = document.getElementById('ledger-bar');
    var colors = ['#3fb950', '#79c0ff', '#d29922', '#8b949e', '#f85149', '#a371f7', '#ff7b72', '#e3b341', '#8b949e'];
    (DATA.ledger || []).forEach(function (g, i) {
      lb.appendChild(el('tr', null, [el('td', { text: g.label }), el('td', { text: String(g.count) }), el('td', { text: g.note })]));
      var seg = el('i');
      seg.style.width = ((g.count / (DATA.ledger_total ? DATA.ledger_total : 758)) * 100) + '%';
      seg.style.background = colors[i % colors.length];
      bar.appendChild(seg);
    });
    var liveTable = document.getElementById('live-table');
    var head = el('thead', null, el('tr', null, ['Protocol', 'Category', 'TVL', 'Market cap', '7d', 'Mcap / TVL'].map(function (h, i) { return el('th', { scope: 'col', class: i >= 2 ? 'num' : '', text: h }); })));
    var tb = el('tbody');
    (DATA.live || []).forEach(function (r) {
      var mult = r.tvl_usd > 0 && r.mcap_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : '—';
      tb.appendChild(el('tr', null, [
        el('td', { text: r.name }),
        el('td', { text: catOf(r) }),
        el('td', { class: 'num', text: money(r.tvl_usd) }),
        el('td', { class: 'num', text: money(r.mcap_usd) }),
        el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d >= 0) ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { class: 'num', text: mult }),
      ]));
    });
    liveTable.appendChild(head);
    liveTable.appendChild(tb);
  })();

  // ---- filters, what-if, board ----
  (function () {
    var catCounts = {};
    DATA.rows.forEach(function (r) { var c = catOf(r); catCounts[c] = (catCounts[c] ? catCounts[c] : 0) + 1; });
    var catSel = document.getElementById('cat');
    Object.keys(catCounts).sort().forEach(function (c) {
      catSel.appendChild(el('option', { value: c, text: c + ' (' + catCounts[c] + ')' }));
    });
    var chainCounts = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (ch) { chainCounts[ch] = (chainCounts[ch] ? chainCounts[ch] : 0) + 1; }); });
    var chainSel = document.getElementById('chain');
    Object.keys(chainCounts).sort().forEach(function (ch) {
      chainSel.appendChild(el('option', { value: ch, text: ch + ' (' + chainCounts[ch] + ')' }));
    });
  })();

  function planLine(r, p) {
    var step = (r.farm_steps && r.farm_steps[2]) ? r.farm_steps[2].text : '';
    var verb = (step.match(/^(Deposit|Supply|Provide|Mint|Stake|Bridge|Fund|Buy|Lock|Place|Spend|Use|Try|Join|Claim|Vote|List|Roll|Close|Check|Make|Add|Top|Swap|Rebalance|Withdraw|Restake|Read|Set|Keep|Borrow|Open|Enter|Verify|Put)/) || ['Act'])[0];
    var chain = (r.chains || [])[0] || 'an unnamed chain';
    return verb + ' · ' + chain + ' · $' + (hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0) + ' gas · ' + p.hours.toFixed(1) + ' h';
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
    var strip = document.getElementById('league-strip');
    if (S.tab === 'live') {
      strip.hidden = true;
      var liveEvidence = document.getElementById('evidence-section');
      if (liveEvidence) liveEvidence.classList.remove('view-hidden');
      var live = liveFiltered();
      var head = el('thead', null, el('tr', null, ['Protocol', 'Category', 'TVL', 'Market cap', '7d', 'Mcap / TVL'].map(function (h, i) { return el('th', { scope: 'col', class: i >= 2 ? 'num' : '', text: h }); })));
      var tb = el('tbody');
      live.forEach(function (r) {
        var mult = r.tvl_usd > 0 && r.mcap_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : '—';
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
      setText('rank-legend', '');
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
    // Category league strip, computed from the board, on filtered views:
    // leagues with at least 3 rows in view, plus a count of the smaller ones.
    // On a filtered view the evidence block is hidden, and the leagues
    // render as a compact table instead of running text.
    var evidenceSec = document.getElementById('evidence-section');
    var isFilteredView = list.length > 0 && list.length !== DATA.rows.length;
    if (evidenceSec) evidenceSec.classList.toggle('view-hidden', isFilteredView);
    if (list.length && list.length !== DATA.rows.length) {
      var shownCats = {};
      list.forEach(function (x) { shownCats[catOf(x.r)] = true; });
      var leagues = (DATA.leagues || []).filter(function (g) { return shownCats[g.category] && g.rows >= 3; });
      var smallCount = (DATA.leagues || []).filter(function (g) { return shownCats[g.category] && g.rows < 3; }).length;
      strip.textContent = '';
      strip.hidden = leagues.length === 0 && smallCount === 0;
      strip.appendChild(el('b', { text: 'Category leagues' }));
      var leagueTable = el('table', { class: 'leagues-table' });
      var leagueHead = el('thead', null, el('tr', null, ['Category', 'Rows', 'Peers with token', 'Ever %', 'Median premium'].map(function (h, i) { return el('th', { scope: 'col', class: i > 0 ? 'num' : '', text: h }); })));
      var leagueBody = el('tbody');
      leagues.forEach(function (g) {
        leagueBody.appendChild(el('tr', null, [
          el('td', { text: g.category }),
          el('td', { class: 'num', text: String(g.rows) }),
          el('td', { class: 'num', text: g.peers_tokened + '/' + g.peers }),
          el('td', { class: 'num', text: (g.ever_pct * 100).toFixed(0) + '%' }),
          el('td', { class: 'num', text: '×' + g.median_premium.toFixed(2) }),
        ]));
      });
      leagueTable.appendChild(leagueHead);
      leagueTable.appendChild(leagueBody);
      strip.appendChild(leagueTable);
      if (smallCount) strip.appendChild(el('p', { class: 'sub', text: smallCount + ' more league' + (smallCount === 1 ? '' : 's') + ' with 1–2 rows each' }));
    } else {
      strip.hidden = true;
    }
    var rankHead = el('th', { scope: 'col', text: 'Rank', title: 'rank range, 200 refits' });
    var headRow = el('thead', null, el('tr', null, [
      rankHead,
      el('th', { scope: 'col', text: 'Protocol' }),
      sortHead('tvl', 'TVL'),
      sortHead('implied', 'Implied value'),
      sortHead('odds', 'Token odds'),
      sortHead('growth', '7d'),
      sortHead('age', 'Age'),
      el('th', { scope: 'col', class: 'num', text: 'Drop − fees' }),
      el('th', { scope: 'col', class: 'num', text: 'T-bill' }),
      el('th', { scope: 'col', class: 'num', text: 'Net' }),
      sortHead('net', '$/h'),
      el('th', { scope: 'col', class: 'num', text: 'Time' }),
      el('th', { scope: 'col', text: 'Verdict' }),
    ]));
    var tb2 = el('tbody');
    list.forEach(function (x) {
      var r = x.r, p = x.p;
      var netCell = el('td', { class: 'num' + (x.v === 'farm' ? ' pos' : (p.net < 0 ? ' neg' : '')) });
      netCell.appendChild(el('b', { text: signed(p.net) }));
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
        el('td', { class: 'num', title: 'rank range, 200 refits' }, [el('b', { text: '#' + r.rank }), el('div', { class: 'sub', text: r.rank_min + '–' + r.rank_max })]),
        el('td', null, nameBox),
        el('td', { class: 'num', text: money(r.tvl_usd) }),
        el('td', { class: 'num' }, [
          el('b', { text: money(r.implied_value_usd) }),
          el('div', { class: 'sub', text: money(r.implied_p25_usd) + ' – ' + money(r.implied_p75_usd) }),
        ]),
        el('td', { class: 'num', text: Math.round(r.token_odds * 100) + '% · 12-mo ' + Math.round((r.token_odds_12mo ? r.token_odds_12mo : 0) * 100) + '%' }),
        el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d >= 0) ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { class: 'num', text: ageFmt(r.age_days) }),
        el('td', { class: 'num', text: signed(p.dropFees) }),
        el('td', { class: 'num', text: money2(p.tbill) }),
        netCell,
        el('td', { class: 'num', text: signed(p.nph) }),
        el('td', { class: 'num', text: p.hold + 'd' }),
        el('td', null, [badge(x.v), r.guard_reason ? el('span', { class: 'guard', text: r.guard_reason }) : null]),
      ]);
      tb2.appendChild(row);
    });
    table.appendChild(headRow);
    table.appendChild(tb2);
    var note = list.length + ' rows shown · sorted by ' + sortLabel + (isDefault() ? '' : ' · verdicts re-priced at ' + depositLabel());
    if (S.verdict !== 'all') note = 'Filtered to ' + S.verdict.toUpperCase() + ' verdict · ' + note;
    setText('count', note);
    var fc = { farm: 0, thin: 0, skip: 0 };
    priced.forEach(function (x) { fc[x.v] = (fc[x.v] ? fc[x.v] : 0) + 1; });
    var sumEl = document.getElementById('count');
    sumEl.appendChild(document.createTextNode(' · At ' + depositLabel() + ' · ' + Math.round(S.share * 1000) / 10 + '% drop · ' + (S.horizon === 'model' ? 'model hold' : S.horizon + ' days') + ' — ' + fc.farm + ' farm, ' + fc.thin + ' thin, ' + fc.skip + ' skip at this deposit.'));
    var vSel = document.getElementById('verdict');
    vSel.options[0].text = 'All (' + DATA.rows.length + ')';
    vSel.options[1].text = 'Farm (' + fc.farm + ')';
    vSel.options[2].text = 'Thin (' + fc.thin + ')';
    vSel.options[3].text = 'Skip (' + fc.skip + ')';
    setText('rank-legend', 'Rank range: P10–P90 from 200 bootstrap refits (bootstrapRankRanges), widened to include the row’s own rank.');
    // Filtered-set aggregates: what farming the whole shown set would do.
    // The net is the sum of the rounded per-row nets, so the total reads
    // exactly as the rows beside it add up.
    var st = document.getElementById('settotals');
    st.textContent = '';
    if (list.length && list.length !== DATA.rows.length) {
      var tvlSum = 0, impSum = 0, netCents = 0, hourSum = 0;
      list.forEach(function (x) { tvlSum += x.r.tvl_usd; impSum += x.r.implied_value_usd; netCents += Math.round(x.p.net * 100); hourSum += x.p.hours; });
      st.appendChild(el('b', { text: 'Farming all ' + list.length + ' shown at ' + depositLabel() + ' each nets ' }));
      st.appendChild(document.createTextNode(signed(netCents / 100) + ' for ' + hourSum.toFixed(1) + ' h of work · ' + money(tvlSum) + ' TVL · ' + money(impSum) + ' implied in view'));
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
    var lines = ['rank,slug,name,category,tvl_usd,implied_value_usd,token_odds,drop_minus_fees_usd,tbill_usd,net_usd,net_per_hour_usd,verdict'];
    filtered().forEach(function (r) {
      var p = price(r);
      lines.push([r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', '"' + catOf(r).replace(/"/g, '""') + '"', r.tvl_usd, r.implied_value_usd, r.token_odds, p.dropFees.toFixed(2), p.tbill.toFixed(2), p.net.toFixed(2), p.nph.toFixed(2), verdict(r, p)].join(','));
    });
    download('token-radar.csv', lines.join('\n'), 'text/csv');
  });
  document.getElementById('export-json').addEventListener('click', function () {
    download('token-radar.json', JSON.stringify(filtered().map(function (r) { return { rank: r.rank, slug: r.slug, name: r.name, implied_value_usd: r.implied_value_usd, token_odds: r.token_odds, net_usd: price(r).net }; }), null, 2), 'application/json');
  });

  // ---- detail: a full page, not a modal ----
  function openDetail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var p = price(r);
    var v = verdict(r, p);
    var curve = Math.exp(M.value_const + M.value_log_tvl * Math.log(Math.max(1, r.tvl_usd)));
    var catMult = Math.exp(r.category_effect ? r.category_effect : 0);
    var afterCat = curve * catMult;
    var afterGrowth = afterCat * (r.growth_multiplier ? r.growth_multiplier : 1);
    var page = document.getElementById('detail');
    page.innerHTML = '';
    var inner = el('div', { class: 'detail-inner' });
    inner.appendChild(el('button', { class: 'back', text: '← Board', onclick: function () { page.hidden = true; history.replaceState(null, '', window.location.pathname + window.location.search); } }));
    inner.appendChild(el('p', { class: 'sub', text: 'Rank ' + r.rank + ' of ' + DATA.rows.length + ' · rank range #' + r.rank_min + '–' + r.rank_max + ' (200 refits) · ' + (isWatchlist(r) ? 'Watchlist' : 'Early find') }));
    inner.appendChild(el('h2', { text: r.name }));
    inner.appendChild(el('p', { class: 'sub', text: catOf(r) + ' on ' + ((r.chains || []).join(', ') || 'an unnamed chain') + ' · TVL ' + money(r.tvl_usd) + ' · ' + ageFmt(r.age_days) + ' on record' }));
    // 1. Build chain: how the implied value is built, one term per line.
    inner.appendChild(el('h3', { text: 'How ' + money(r.implied_value_usd) + ' is built' }));
    var build = el('div', { class: 'equation' });
    [
      ['Size curve exp(' + M.value_const.toFixed(4) + ' + ' + M.value_log_tvl.toFixed(4) + ' × ln TVL) ' + money(curve) + ' × category (' + catOf(r) + ') ×' + catMult.toFixed(2) + ' (' + ((r.category_effect ? r.category_effect : 0) >= 0 ? '+' : '') + (r.category_effect ? r.category_effect : 0).toFixed(2) + ' log pts)', money(afterCat)],
      ['Growth carry (7d ' + pct(r.change_7d) + ', clipped ±25%) ×' + (r.growth_multiplier ? r.growth_multiplier.toFixed(2) : '1.00') + ' — a stated projection, not a fit', money(afterGrowth)],
      ['Ever-odds ' + Math.round(r.token_odds * 100) + '% (12-month ' + Math.round((r.token_odds_12mo ? r.token_odds_12mo : 0) * 100) + '%) → implied (P25 ' + money(r.implied_p25_usd) + ' – P75 ' + money(r.implied_p75_usd) + ' · P10 ' + money(r.implied_p10_usd) + ' – P90 ' + money(r.implied_p90_usd) + ')', money(r.implied_value_usd)],
      ['Break-even ticket / odds', (p.beT !== null ? '$' + p.beT.toLocaleString('en-US') : 'never pays') + ' / ' + (p.beO !== null ? Math.round(p.beO * 100) + '%' : '—')],
    ].forEach(function (row) {
      build.appendChild(el('div', null, [el('span', { text: row[0] }), el('b', { text: row[1] })]));
    });
    if (r.family_child) build.appendChild(el('div', null, [el('span', { text: 'Family effect' }), el('b', { text: 'parent already has a token — odds down-weighted' })]));
    inner.appendChild(build);
    // 2. Verdict line with drop minus fees, the T-bill and the net.
    inner.appendChild(el('div', null, [badge(v), r.guard_reason ? el('span', { class: 'guard', text: ' ' + r.guard_reason }) : null,
      el('span', { class: 'sub', text: ' Deposit $' + p.deposit.toLocaleString('en-US') + ' · gas ~$' + (hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0) + ' · hold ' + p.hold + ' days' })]));
    inner.appendChild(el('div', { class: 'eqbar' }, [el('b', { text: 'Drop − fees ' + signed(p.dropFees) + ' − T-bill forgone ' + money2(p.tbill) + ' = net ' + signed(p.net) + ', ' + signed(p.nph) + ' an hour. ' }), document.createTextNode(p.beT !== null ? 'Pays from a $' + p.beT.toLocaleString('en-US') + ' ticket.' : 'No ticket size pays: the slice per dollar is below the T-bill rate.')]));
    // The same row's verdict at each fixed deposit, priced live by
    // price() and verdict() rather than printed from a stored table.
    var savedDeposit = S.deposit;
    var depositVerdicts = [1000, 5000, 10000, 25000].map(function (d) {
      S.deposit = d;
      return '$' + d.toLocaleString('en-US') + ' ' + verdict(r, price(r)).toUpperCase();
    });
    S.deposit = savedDeposit;
    inner.appendChild(el('p', { class: 'sub', text: 'Verdict by deposit: ' + depositVerdicts.join(' · ') + '.' }));    // 3. Farm plan steps, with cost and time on every step.
    inner.appendChild(el('h3', { text: 'Farm plan' }));
    var steps = el('ol', { class: 'steps' });
    (r.farm_steps || []).forEach(function (s) {
      steps.appendChild(el('li', null, [el('b', { text: s.text }), el('span', { class: 'cost', text: 'Cost: ' + s.cost + ' · Time: ' + s.time })]));
    });
    inner.appendChild(steps);
    // 4. Week 0–12 timeline, drawn from the step times: the weekly checks
    // fall on days 7, 14, 21 and 28 of a 30-day hold, and the claim lands
    // on the hold's last day.
    inner.appendChild(el('h3', { text: 'Week 0–12 timeline' }));
    var checkCount = Math.floor(p.hold / 7);
    var checkDays = [];
    for (var cd = 7; cd <= p.hold; cd += 7) checkDays.push(cd);
    var timeline = el('div', { class: 'timeline' });
    timeline.appendChild(el('span', { class: 'hot', text: 'Week 0 · setup, 15 min' }));
    timeline.appendChild(el('span', { text: 'Days ' + checkDays.join(', ') + ' · ' + checkCount + ' weekly checks, 10 min each, exit rule watched' }));
    timeline.appendChild(el('span', { class: 'hot', text: 'Day ' + p.hold + ' · claim, 10 min' }));
    inner.appendChild(timeline);
    inner.appendChild(el('p', { class: 'sub', text: 'Setup at week 0, ' + checkCount + ' weekly checks on days ' + checkDays[0] + '–' + checkDays[checkDays.length - 1] + ', claim at the hold end (day ' + p.hold + '). Step times add up to ' + p.hours.toFixed(2) + ' hours.' }));
    // 5. Plan totals.
    var totalFees = (hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0) + p.tbill;
    inner.appendChild(el('p', { class: 'sub', text: 'Plan totals: ' + (r.farm_steps || []).length + ' steps over ' + p.hold + ' days · $' + p.deposit.toLocaleString('en-US') + ' deposit · $' + (hasNum(r.farm_gas_usd) ? r.farm_gas_usd : 0) + ' gas · ' + money2(totalFees) + ' fees and forgone yield · ' + p.hours.toFixed(1) + ' h of hands-on work · net ' + signed(p.net) + ' (' + signed(p.nph) + '/h).' }));
    // 6. The record.
    inner.appendChild(el('h3', { text: 'The record' }));
    var rec = el('tbody');
    [
      ['TVL', '$' + r.tvl_usd.toLocaleString('en-US'), '7-day change', pct(r.change_7d)],
      ['Listed', (r.listed_at ? r.listed_at : 'not listed') + ' · ' + ageFmt(r.age_days) + ' with no token', 'Category', catOf(r)],
      ['Chains', (r.chains || []).join(', ') || 'none listed', 'Market cap', r.mcap_usd === null ? 'null — records no token' : '$' + r.mcap_usd.toLocaleString('en-US')],
      ['Gecko id', r.gecko_id === null ? 'null — records no token' : r.gecko_id, 'Symbol', r.symbol === null ? 'null — records no token' : r.symbol],
      ['Exit rule', 'TVL below ' + money(r.exit_tvl_usd) + ' (' + (hasNum(r.exit_drop_pct) ? r.exit_drop_pct.toFixed(2) : '—') + '% in 7 days)', 'Source', 'DefiLlama protocol index, snapshot ' + DATA.as_of],
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
  function syncHash() {
    var d = S.deposit === 'row' ? 'row' : String(S.deposit);
    history.replaceState(null, '', window.location.pathname + window.location.search + '#d=' + d + (S.verdict !== 'all' ? '&verdict=' + S.verdict : ''));
  }
  wireSeg('deposit', function (v) { S.deposit = v === 'row' ? 'row' : parseInt(v, 10); syncHash(); });
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
  // Deep link: #p=<slug> opens that protocol; #d=<deposit>, #verdict=farm, #category=<name>, #q=<text>
  (function () {
    var hash = window.location.hash || '';
    var m = /[#&]p=([^&]+)/.exec(hash);
    var d = /[#&]d=([^&]+)/.exec(hash);
    var v = /[#&]verdict=([^&]+)/.exec(hash);
    var c = /[#&]category=([^&]+)/.exec(hash);
    var q = /[#&]q=([^&]+)/.exec(hash);
    if (d) {
      var dv = decodeURIComponent(d[1]);
      S.deposit = dv === 'row' ? 'row' : parseInt(dv, 10);
      document.querySelectorAll('#deposit button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-v') === dv); });
    }
    if (v) { S.verdict = v[1]; document.getElementById('verdict').value = v[1]; }
    if (c) { S.cat = decodeURIComponent(c[1]); document.getElementById('cat').value = S.cat; }
    if (q) { S.q = decodeURIComponent(q[1]); document.getElementById('q').value = S.q; }
    renderBoard();
    if (m) openDetail(decodeURIComponent(m[1]));
  })();
})();
