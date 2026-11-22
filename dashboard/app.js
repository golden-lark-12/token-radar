/* Token Radar dashboard: window.RADAR from data.js, recomputed
   through the six functions in model.js. */
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !Array.isArray(R.rows) || !R.rows.length) return;
  var C = R.model;
  var EFFECTS = R.value_effects || {};
  var WATCH = {};
  R.watchlist_slugs.forEach(function (s) { WATCH[s] = true; });
  var BETA = (R.odds_beta && R.odds_beta.length === 5) ? R.odds_beta
    : [R.odds_fit.const, R.odds_fit.years, R.odds_fit.ln_tvl, R.odds_fit.growth, R.odds_fit.family];

  var S = { tab: 'pre', q: '', cat: 'all', chain: 'all', odds: 0, verdict: 'all',
    sort: 'rank', dir: 1, deposit: 'row', share: 0.07, horizon: 'model', pricedOnly: false };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return sign + '$' + Math.round(a).toLocaleString('en-US');
    return sign + '$' + a.toFixed(2);
  }
  function money2(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n, digits) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(digits === undefined ? 1 : digits) + '%';
  }
  function signed(n) { return (n < 0 ? '-' : '+') + '$' + Math.abs(n).toFixed(2); }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365.25).toFixed(1) + 'y';
  }
  function chainText(chains) {
    if (!chains || !chains.length) return '—';
    return chains.length > 1 ? chains[0] + ' +' + (chains.length - 1) : chains[0];
  }
  function guardOf(row, verdict) {
    if (row.change_7d !== null && row.change_7d <= -30) return 'skip';
    if (row.change_7d !== null && row.change_7d <= -15 && verdict === 'farm') return 'thin';
    return verdict;
  }
  function overrides() {
    var o = {};
    if (S.deposit !== 'row') o.deposit = Number(S.deposit);
    o.dropShare = S.share;
    if (S.horizon !== 'model') o.holdDays = Number(S.horizon);
    return o;
  }
  function planOf(row) {
    var p = buildFarmPlan(row, C, overrides());
    p.verdict = guardOf(row, p.verdict);
    return p;
  }
  function fittedNow() {
    var comps = R.live.filter(function (r) { return r.mcap_usd !== null && r.mcap_usd > 0; })
      .map(function (r) { return { lnTvl: Math.log(r.tvl_usd), lnMcap: Math.log(r.mcap_usd), category: r.category }; });
    return fitValueTwoStage(comps, C);
  }

  /* ---------- header, KPIs, integrity ---------- */
  function renderHead() {
    $('snap-date').textContent = R.as_of;
    $('model-ver').textContent = R.model_version;
    var counts = { farm: 0, thin: 0, skip: 0 };
    R.rows.forEach(function (r) { counts[r.verdict]++; });
    var cov = verifyWatchlist(R.rows, R.watchlist_slugs);
    var kpis = [
      { v: cov.covered + '/' + cov.watchlistSize, l: 'watchlist protocols ranked' },
      { v: String(R.board_size), l: 'record no token · ' + R.early_size + ' beyond the watchlist' },
      { v: R.live_size + ' / ' + R.priced_size, l: 'live, symbol-recorded / priced fit set' },
      { v: String(counts.farm), l: 'worth farming on row deposits' },
      { v: '×' + R.fit.loo_miss.toFixed(2) + ' / ×' + R.fit.wf_miss.toFixed(2), l: 'held-out miss, leave-one-out / walk-forward' }
    ];
    var box = $('kpis');
    box.textContent = '';
    kpis.forEach(function (k) {
      var d = el('div', 'kpi');
      d.appendChild(el('b', null, k.v));
      d.appendChild(el('span', null, k.l));
      box.appendChild(d);
    });
    /* Recompute every row through model.js and compare with the dataset. */
    var fit = fittedNow();
    var refitOk = fit !== null
      && Math.abs(fit.intercept - C.value_const) < 0.00005
      && Math.abs(fit.slope - C.value_log_tvl) < 0.00005;
    var bad = 0, badOdds = 0;
    R.rows.forEach(function (r) {
      var od = estimateTokenOdds(r, BETA, r.age_days, C, r.family_child);
      var iv = computeImpliedValue(r, fit, od.ever, C, EFFECTS);
      if (iv.implied !== r.implied_value_usd) bad++;
      if (Math.abs(od.ever - r.token_odds) > 0.001) badOdds++;
    });
    var line = $('integrity');
    line.textContent = '';
    line.appendChild(el('b', null, 'Checked: '));
    line.appendChild(document.createTextNode(
      'verifyWatchlist covers ' + cov.covered + ' of ' + cov.watchlistSize + ' watchlist protocols; ' +
      'computeImpliedValue and estimateTokenOdds reproduce ' + (R.rows.length - bad) + ' of ' + R.rows.length +
      ' values exactly and ' + (R.rows.length - badOdds) + ' of ' + R.rows.length + ' odds within 0.001; ' +
      'the refit ' + (refitOk ? 'reproduces' : 'does NOT reproduce') + ' the constants.'));
  }

  /* ---------- audit drawer ---------- */
  function numCell(v, digits) {
    var td = el('td', 'num');
    td.textContent = v === null || v === undefined ? '—' : '×' + v.toFixed(digits === undefined ? 2 : digits);
    return td;
  }
  function renderAudit() {
    var tb = $('terms-body');
    tb.textContent = '';
    R.fit_terms.forEach(function (f) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, f.term));
      tr.appendChild(numCell(f.loo_miss));
      tr.appendChild(numCell(f.wf_miss));
      tr.appendChild(el('td', null, f.kept ? 'Yes' : '—'));
      tb.appendChild(tr);
    });
    var f = R.fit, o = R.odds_fit;
    $('value-reasons').textContent = 'Growth and age were tested in the value and dropped: neither wins both tests.';
    $('value-cut').textContent = 'Against the flat median multiple, the kept model cuts the miss by ' +
      (f.cut_loo * 100).toFixed(1) + '% leave-one-out and ' + (f.cut_wf * 100).toFixed(1) + '% walk-forward.';
    var ob = $('odds-body');
    ob.textContent = '';
    [
      ['Brier score', o.brier_10fold, o.brier_wf_median],
      ['Brier, constant base', o.brier_10fold_base, o.brier_wf_median_base],
      ['AUC', o.auc_10fold, o.auc_wf],
      ['Brier, name-hash control', o.placebo_hash_brier_10fold, o.placebo_hash_brier_wf]
    ].forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, row[0]));
      var a = el('td', 'num'); a.textContent = row[1].toFixed(3); tr.appendChild(a);
      var b = el('td', 'num'); b.textContent = row[2].toFixed(3); tr.appendChild(b);
      ob.appendChild(tr);
    });
    $('odds-coefs').textContent = 'Logit: const ' + o.const.toFixed(3) + ' (±' + o.const_se.toFixed(3) +
      '), years ' + (o.years >= 0 ? '+' : '') + o.years.toFixed(3) + ', ln TVL ' + (o.ln_tvl >= 0 ? '+' : '') + o.ln_tvl.toFixed(3) +
      ', growth ' + o.growth.toFixed(3) + ', family ' + o.family.toFixed(3) + '.';
    $('odds-peers').textContent = o.peers + ' shape-passing peers: ' + o.peers_symbol + ' record a symbol; ' +
      o.peers_owned + ' own it (' + (o.peers_symbol - o.peers_owned) + " inherit a sibling's).";
    $('odds-accuracy').textContent = 'Walk-forward accuracy ' + (f.odds_acc_wf * 100).toFixed(1) +
      '% vs ' + (f.odds_acc_never * 100).toFixed(1) + '% for always predicting never.';
    renderScatter();
    var cb = $('cats-body');
    cb.textContent = '';
    var counts = {};
    R.rows.forEach(function (r) { var k = r.category || 'Other'; counts[k] = (counts[k] || 0) + 1; });
    Object.keys(EFFECTS).sort(function (a, b) { return EFFECTS[b] - EFFECTS[a]; }).forEach(function (cat) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, cat));
      var e = el('td', 'num'); e.textContent = (EFFECTS[cat] >= 0 ? '+' : '') + EFFECTS[cat].toFixed(4); tr.appendChild(e);
      var m = el('td', 'num'); m.textContent = '×' + Math.exp(EFFECTS[cat]).toFixed(3); tr.appendChild(m);
      var n = el('td', 'num'); n.textContent = String(counts[cat] || 0); tr.appendChild(n);
      cb.appendChild(tr);
    });
    var lb = $('ledger-body'), bar = $('ledger-bar');
    lb.textContent = ''; bar.textContent = '';
    var colors = ['#4cc38a', '#79c0ff', '#e0a83c', '#8b949e', '#e5636b', '#b07cd8', '#5aa9a0', '#c97b4a', '#6d7b89'];
    R.ledger.forEach(function (g, i) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, g.label));
      var n = el('td', 'num'); n.textContent = String(g.count); tr.appendChild(n);
      tr.appendChild(el('td', null, g.note));
      lb.appendChild(tr);
      var seg = el('i'); seg.style.width = (g.count / R.ledger_total * 100) + '%';
      seg.style.background = colors[i % colors.length]; seg.title = g.label + ' ' + g.count;
      bar.appendChild(seg);
    });
    $('scatter-note').textContent = 'The curve is the fitted size curve. ' +
      R.priced_size + ' priced comps set the fit.';
  }
  function renderScatter() {
    var W = 340, H = 215, pad = 30;
    var pts = R.live.filter(function (r) { return r.mcap_usd > 0; });
    var xs = pts.map(function (r) { return Math.log(r.tvl_usd); }).concat(R.rows.map(function (r) { return Math.log(r.tvl_usd); }));
    var ys = pts.map(function (r) { return Math.log(r.mcap_usd); }).concat(R.rows.map(function (r) { return Math.log(r.implied_value_usd); }));
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    function X(v) { return pad + (v - x0) / (x1 - x0) * (W - pad - 8); }
    function Y(v) { return H - pad + 6 - (v - y0) / (y1 - y0) * (H - pad - 14); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Market cap against TVL, log scales">';
    var gx, gy;
    for (gx = 0; gx <= 4; gx++) s += '<line class="scatter-grid" x1="' + X(x0 + (x1 - x0) * gx / 4) + '" y1="8" x2="' + X(x0 + (x1 - x0) * gx / 4) + '" y2="' + (H - pad + 6) + '"/>';
    for (gy = 0; gy <= 4; gy++) s += '<line class="scatter-grid" x1="' + pad + '" y1="' + Y(y0 + (y1 - y0) * gy / 4) + '" x2="' + (W - 8) + '" y2="' + Y(y0 + (y1 - y0) * gy / 4) + '"/>';
    var curve = '';
    for (gx = 0; gx <= 20; gx++) {
      var xv = x0 + (x1 - x0) * gx / 20;
      curve += (gx === 0 ? 'M' : 'L') + X(xv).toFixed(1) + ' ' + Y(C.value_const + C.value_log_tvl * xv).toFixed(1) + ' ';
    }
    s += '<path class="scatter-curve" d="' + curve + '"/>';
    pts.forEach(function (r) {
      s += '<circle class="scatter-live" cx="' + X(Math.log(r.tvl_usd)).toFixed(1) + '" cy="' + Y(Math.log(r.mcap_usd)).toFixed(1) + '" r="2.4"/>';
    });
    R.rows.forEach(function (r) {
      s += '<path class="scatter-board" d="M' + X(Math.log(r.tvl_usd)).toFixed(1) + ' ' + (Y(Math.log(r.implied_value_usd)) - 3).toFixed(1) +
        ' l3 6 h-6 Z"/>';
    });
    s += '<text x="' + pad + '" y="' + (H - 6) + '" font-size="10" fill="#94a2b0">ln TVL</text>';
    s += '<text x="4" y="14" font-size="10" fill="#94a2b0">ln value</text></svg>';
    $('scatter').innerHTML = s;
  }

  /* ---------- filters, selects, leagues ---------- */
  function fillSelects() {
    var cats = {}, chains = {};
    R.rows.forEach(function (r) {
      cats[r.category || 'Other'] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    Object.keys(cats).sort().forEach(function (c) {
      var o = el('option', null, c); o.value = c; $('cat').appendChild(o);
    });
    Object.keys(chains).sort().forEach(function (c) {
      var o = el('option', null, c); o.value = c; $('chain').appendChild(o);
    });
  }
  function filteredRows() {
    var q = S.q.trim().toLowerCase();
    return R.rows.filter(function (r) {
      if (S.verdict !== 'all' && r.verdict !== S.verdict) return false;
      if (S.cat !== 'all' && (r.category || 'Other') !== S.cat) return false;
      if (S.chain !== 'all' && (r.chains || []).indexOf(S.chain) < 0) return false;
      if (r.token_odds < S.odds) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.chains || []).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function isFiltered() {
    return S.q.trim() !== '' || S.cat !== 'all' || S.chain !== 'all' || S.odds > 0 || S.verdict !== 'all';
  }
  function renderLeagues() {
    var wrap = $('leagues-wrap');
    if (S.tab !== 'pre' || isFiltered()) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var tb = $('leagues-body');
    tb.textContent = '';
    R.leagues.forEach(function (g) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, g.category));
      var a = el('td', 'num'); a.textContent = String(g.rows); tr.appendChild(a);
      var b = el('td', 'num'); b.textContent = String(g.peers); tr.appendChild(b);
      var c = el('td', 'num'); c.textContent = (g.ever_pct * 100).toFixed(1) + '%'; tr.appendChild(c);
      var d = el('td', 'num'); d.textContent = '×' + g.median_premium.toFixed(3); tr.appendChild(d);
      tb.appendChild(tr);
    });
  }

  /* ---------- board ---------- */
  var COLS = [
    { key: 'rank', label: 'Rank', w: 76 }, { key: 'name', label: 'Protocol', w: 208 },
    { key: 'category', label: 'Category', w: 112 }, { key: 'chain', label: 'Chain', w: 92 },
    { key: 'tvl', label: 'TVL', num: true, w: 86 }, { key: 'change', label: '7d', num: true, w: 60 },
    { key: 'age', label: 'Age', num: true, w: 54 }, { key: 'iflaunches', label: 'If launches', num: true, w: 96 },
    { key: 'odds', label: 'Odds', num: true, w: 62 }, { key: 'implied', label: 'Implied', num: true, w: 96 },
    { key: 'range', label: 'P25–P75', w: 96 }, { key: 'net', label: 'Net', num: true, w: 86 },
    { key: 'perhour', label: '$/h', num: true, w: 86 }, { key: 'verdict', label: 'Verdict', w: 136 }
  ];
  var SORTVAL = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    category: function (r) { return (r.category || 'Other').toLowerCase(); },
    chain: function (r) { return (r.chains[0] || '').toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    change: function (r) { return r.change_7d === null ? -999 : r.change_7d; },
    age: function (r) { return r.age_days === null ? -1 : r.age_days; },
    iflaunches: function (r) { return r.if_launches_usd; },
    odds: function (r) { return r.token_odds; },
    implied: function (r) { return r.implied_value_usd; },
    range: function (r) { return r.implied_p75_usd - r.implied_p25_usd; },
    net: function (r, p) { return p.net; },
    perhour: function (r, p) { return p.netPerHour; },
    verdict: function (r) { return r.verdict; }
  };
  function sortVal(row, plan, key) { return SORTVAL[key](row, plan); }
  function rangeSvg(row) {
    var lo = Math.log(Math.max(1, row.implied_p25_usd)), hi = Math.log(Math.max(1, row.implied_p75_usd));
    var mid = Math.log(Math.max(1, row.implied_value_usd));
    var loAll = Math.log(Math.max(1, row.implied_p10_usd)), hiAll = Math.log(Math.max(1, row.implied_p90_usd));
    function px(v) { return 4 + (v - loAll) / Math.max(0.001, hiAll - loAll) * 82; }
    return '<svg class="range-svg" width="90" height="18" viewBox="0 0 90 18" aria-hidden="true">' +
      '<rect x="' + px(lo).toFixed(1) + '" y="5" width="' + Math.max(2, px(hi) - px(lo)).toFixed(1) + '" height="8" rx="2" fill="#4cc38a" fill-opacity="0.55"/>' +
      '<line x1="' + px(mid).toFixed(1) + '" y1="3" x2="' + px(mid).toFixed(1) + '" y2="15" stroke="#e9eef3" stroke-width="2"/></svg>';
  }
  function renderBoard() {
    var table = $('board');
    table.textContent = '';
    if (S.tab === 'live') { renderLive(table); return; }
    var rows = filteredRows().map(function (r) { return { row: r, plan: planOf(r) }; });
    rows.sort(function (a, b) {
      var va = sortVal(a.row, a.plan, S.sort), vb = sortVal(b.row, b.plan, S.sort);
      var cmp = va < vb ? -1 : va > vb ? 1 : a.row.rank - b.row.rank;
      return cmp * S.dir;
    });
    var thead = document.createElement('thead');
    var htr = document.createElement('tr');
    COLS.forEach(function (c) {
      var th = el('th', c.num ? 'num' : null, c.label);
      th.style.width = c.w + 'px';
      if (S.sort === c.key) {
        var ar = el('span', 'arrow', S.dir === 1 ? ' ▲' : ' ▼');
        th.appendChild(ar);
      }
      th.addEventListener('click', function () {
        if (S.sort === c.key) S.dir = -S.dir;
        else { S.sort = c.key; S.dir = c.key === 'rank' || c.key === 'name' || c.key === 'category' ? 1 : -1; }
        writeHash(); renderBoard();
      });
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (item) {
      var r = item.row, p = item.plan;
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      function open() { openDetail(r.slug); }
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
      var rank = el('td', 'num', String(r.rank)); tr.appendChild(rank);
      var name = el('td', 'name');
      var b = el('b', null, r.name); name.appendChild(b);
      if (WATCH[r.slug]) { var t1 = el('span', 'tag wl', 'WATCHLIST'); name.appendChild(t1); }
      else { var t2 = el('span', 'tag early', 'EARLY'); name.appendChild(t2); }
      if (r.change_7d !== null && r.change_7d <= -15) { var t3 = el('span', 'tag falling', 'FALLING'); name.appendChild(t3); }
      name.appendChild(el('span', 'slugline', ' · ' + r.slug));
      tr.appendChild(name);
      tr.appendChild(el('td', null, r.category || '—'));
      tr.appendChild(el('td', null, chainText(r.chains)));
      tr.appendChild(el('td', 'num', money(r.tvl_usd)));
      var ch = el('td', 'num', pct(r.change_7d));
      if (r.change_7d !== null) ch.className += r.change_7d < 0 ? ' neg' : ' pos';
      tr.appendChild(ch);
      tr.appendChild(el('td', 'num', ageText(r.age_days)));
      tr.appendChild(el('td', 'num', money(r.if_launches_usd)));
      tr.appendChild(el('td', 'num', (r.token_odds * 100).toFixed(1) + '%'));
      tr.appendChild(el('td', 'num', money(r.implied_value_usd)));
      var rg = document.createElement('td'); rg.innerHTML = rangeSvg(r); tr.appendChild(rg);
      var net = el('td', 'num', signed(p.net)); net.className += p.net < 0 ? ' neg' : ' pos'; tr.appendChild(net);
      var ph = el('td', 'num', signed(p.netPerHour)); ph.className += p.netPerHour < 0 ? ' neg' : ' pos'; tr.appendChild(ph);
      var vd = document.createElement('td');
      var badge = el('span', 'badge ' + p.verdict, p.verdict.toUpperCase()); vd.appendChild(badge);
      if (r.guard_reason) { vd.className = 'wrap'; var g = el('span', 'guard', r.guard_reason); vd.appendChild(g); }
      tr.appendChild(vd);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    var shown = rows;
    var totTvl = 0, totImp = 0, totNet = 0, totHours = 0, perHours = [];
    shown.forEach(function (it) { totTvl += it.row.tvl_usd; totImp += it.row.implied_value_usd; totNet += it.plan.net; totHours += it.plan.hours; perHours.push(it.plan.netPerHour); });
    perHours.sort(function (a, b) { return a - b; });
    var med = perHours.length ? perHours[Math.floor(perHours.length / 2)] : 0;
    $('count').textContent = 'Showing ' + shown.length + ' of ' + R.board_size + ' pre-token protocols, sorted by ' +
      (COLS.filter(function (c) { return c.key === S.sort; })[0] || {}).label + (S.dir === 1 ? ' ascending' : ' descending') + '.';
    $('settotals').innerHTML = '';
    var st = $('settotals');
    st.appendChild(document.createTextNode(
      (isFiltered() ? 'Filtered: ' : 'Board: ') + shown.length + ' rows · total TVL ' + money(totTvl) +
      ' · total implied ' + money(totImp) + ' · median ' + signed(med) + '/hour · total net ' + signed(totNet) +
      ' · ' + totHours.toFixed(1) + ' work hours.'));
    renderLeagues();
  }

  /* ---------- live tab ---------- */
  var LIVE_SORT = { key: 'mcap', dir: -1 };
  function renderLive(table) {
    var rows = R.live.slice();
    if (S.pricedOnly) rows = rows.filter(function (r) { return r.mcap_usd !== null && r.mcap_usd > 0; });
    var q = S.q.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return (r.name + ' ' + r.slug + ' ' + (r.symbol || '') + ' ' + (r.chains || []).join(' ')).toLowerCase().indexOf(q) >= 0; });
    if (S.cat !== 'all') rows = rows.filter(function (r) { return (r.category || 'Other') === S.cat; });
    if (S.chain !== 'all') rows = rows.filter(function (r) { return (r.chains || []).indexOf(S.chain) >= 0; });
    function val(r, k) {
      if (k === 'mcap') return r.mcap_usd === null ? -1 : r.mcap_usd;
      if (k === 'tvl') return r.tvl_usd;
      if (k === 'multiple') return r.mcap_usd !== null && r.mcap_usd > 0 && r.tvl_usd > 0 ? r.mcap_usd / r.tvl_usd : -1;
      if (k === 'change') return r.change_7d === null ? -999 : r.change_7d;
      if (k === 'name') return r.name.toLowerCase();
      return 0;
    }
    rows.sort(function (a, b) {
      var va = val(a, LIVE_SORT.key), vb = val(b, LIVE_SORT.key);
      var cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return cmp * LIVE_SORT.dir;
    });
    var cols = [
      { key: 'name', label: 'Protocol', w: 340 }, { key: 'symbol', label: 'Symbol', w: 100 },
      { key: 'category', label: 'Category', w: 170 }, { key: 'chain', label: 'Chain', w: 140 },
      { key: 'tvl', label: 'TVL', num: true, w: 130 }, { key: 'mcap', label: 'Market cap', num: true, w: 140 },
      { key: 'multiple', label: 'Mcap / TVL', num: true, w: 130 }, { key: 'change', label: '7d', num: true, w: 80 }
    ];
    var thead = document.createElement('thead');
    var htr = document.createElement('tr');
    cols.forEach(function (c) {
      var th = el('th', c.num ? 'num' : null, c.label);
      th.style.width = c.w + 'px';
      if (LIVE_SORT.key === c.key) th.appendChild(el('span', 'arrow', LIVE_SORT.dir === 1 ? ' ▲' : ' ▼'));
      if (c.key !== 'symbol' && c.key !== 'category' && c.key !== 'chain') {
        th.addEventListener('click', function () {
          if (LIVE_SORT.key === c.key) LIVE_SORT.dir = -LIVE_SORT.dir;
          else { LIVE_SORT.key = c.key; LIVE_SORT.dir = c.key === 'name' ? 1 : -1; }
          renderBoard();
        });
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'default';
      var name = el('td', 'name'); name.appendChild(el('b', null, r.name));
      name.appendChild(el('span', 'slugline', ' · ' + r.slug));
      tr.appendChild(name);
      tr.appendChild(el('td', null, r.symbol || '—'));
      tr.appendChild(el('td', null, r.category || '—'));
      tr.appendChild(el('td', null, chainText(r.chains)));
      tr.appendChild(el('td', 'num', money(r.tvl_usd)));
      tr.appendChild(el('td', 'num', r.mcap_usd !== null && r.mcap_usd > 0 ? money(r.mcap_usd) : '—'));
      var mult = r.mcap_usd !== null && r.mcap_usd > 0 && r.tvl_usd > 0 ? '×' + (r.mcap_usd / r.tvl_usd).toFixed(3) : '—';
      tr.appendChild(el('td', 'num', mult));
      var ch = el('td', 'num', pct(r.change_7d));
      if (r.change_7d !== null) ch.className += r.change_7d < 0 ? ' neg' : ' pos';
      tr.appendChild(ch);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    $('count').textContent = 'Live tab: ' + rows.length + ' of ' + R.live_size + ' symbol-recorded protocols' +
      (S.pricedOnly ? ' (priced only)' : '') + '. Comparables, never ranked.';
    $('settotals').textContent = 'The ' + R.priced_size + '-comp fit set is the priced subset. The other ' +
      (R.live_size - R.priced_size) + ' record a symbol with no usable cap.';
    $('live-count').textContent = R.live_size + ' symbol-recorded · ' + R.priced_size + ' priced — the ' + R.priced_size + '-comp fit set.';
    renderLeagues();
  }

  /* ---------- detail ---------- */
  var EXCLUDED = { 'Bridge': 1, 'Canonical Bridge': 1, 'Liquid Staking': 1, 'Liquid Restaking': 1, 'Restaked BTC': 1, 'CEX': 1 };
  var VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
  function shapeOk(p) {
    if (p.category !== null && EXCLUDED[p.category]) return false;
    if (VERSIONED.test(p.name)) return false;
    if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) return false;
    if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) return false;
    return true;
  }
  function waterfallSvg(row, plan) {
    var W = 640, H = 250, padL = 150, padB = 34, padT = 16;
    var curveVal = Math.exp(C.value_const + C.value_log_tvl * Math.log(Math.max(1, row.tvl_usd)));
    var steps = [
      { label: 'TVL curve', value: curveVal, sub: 'size curve' },
      { label: 'Category', value: curveVal * Math.exp(row.category_effect), sub: '× exp(' + row.category_effect.toFixed(4) + ')' },
      { label: '7d carry', value: curveVal * Math.exp(row.category_effect) * row.growth_multiplier, sub: '× ' + row.growth_multiplier.toFixed(4) },
      { label: 'Ever-odds', value: row.implied_value_usd, sub: '× ' + row.token_odds.toFixed(4) + ' odds' },
      { label: 'Implied value', value: row.implied_value_usd, sub: 'final' }
    ];
    var maxV = Math.max.apply(null, steps.map(function (s) { return s.value; }));
    var minLog = Math.log(Math.max(1, Math.min.apply(null, steps.map(function (s) { return s.value; })))) - 0.35;
    var maxLog = Math.log(Math.max(1, maxV));
    function Y(v) { return padT + (1 - (Math.log(Math.max(1, v)) - minLog) / Math.max(0.001, maxLog - minLog)) * (H - padT - padB); }
    var bw = 74, gap = (W - padL - 20 - bw * steps.length) / (steps.length - 1);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Valuation waterfall">';
    steps.forEach(function (st, i) {
      var x = padL + i * (bw + gap);
      var y = Y(st.value), h = Math.max(3, H - padB - y);
      var cls = i === steps.length - 1 ? 'wf-final' : (i === 0 ? 'wf-bar' : 'wf-step');
      s += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="3"/>';
      s += '<text class="wf-label" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + esc(money(st.value)) + '</text>';
      s += '<text class="wf-label" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 18).toFixed(1) + '" text-anchor="middle">' + esc(st.label) + '</text>';
      s += '<text class="wf-sub" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5).toFixed(1) + '" text-anchor="middle">' + esc(st.sub) + '</text>';
    });
    s += '</svg>';
    return s;
  }
  function reasonLine(row, plan) {
    if (plan.verdict === 'farm') return 'FARM: odds ' + (row.token_odds * 100).toFixed(1) + '% (≥ 50%), net ' + signed(plan.net) + ', ' + signed(plan.netPerHour) + '/hour (≥ $20).';
    if (row.guard_reason) return 'SKIP: ' + row.guard_reason + ' — the crash guard overrides the rule.';
    if (plan.net <= 0) return 'SKIP: net ' + signed(plan.net) + ' at or below $0 — never pays after gas and the T-bill.';
    if (plan.breakEvenOdds === null) return 'SKIP: break-even needs odds above the 95% cap — never pays at feasible odds.';
    if (row.token_odds < 0.3) return 'SKIP: ever-odds ' + (row.token_odds * 100).toFixed(1) + '% below 30%.';
    if (plan.slice <= plan.gas) return 'SKIP: slice ' + money2(plan.slice) + ' does not cover gas ' + money2(plan.gas) + '.';
    return 'THIN: pays something, but below $20/hour or below 50% odds.';
  }
  function openDetail(slug) {
    var row = null;
    R.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    var plan = planOf(row);
    var page = $('detail');
    page.textContent = '';
    page.hidden = false;
    var shell = el('div', 'detail-shell');
    var back = el('button', 'back', '← Back to the board');
    back.addEventListener('click', closeDetail);
    shell.appendChild(back);
    var h1 = el('h1', null, '#' + row.rank + ' ' + row.name);
    shell.appendChild(h1);
    shell.appendChild(el('p', 'sub', (row.category || 'No category') + ' · ' + chainText(row.chains) +
      ' · TVL ' + money(row.tvl_usd) + ' · 7d ' + pct(row.change_7d) + ' · age ' + ageText(row.age_days) +
      (WATCH[row.slug] ? ' · watchlist' : ' · early, beyond the watchlist')));
    var verdictP = el('p', null, '');
    var badge = el('span', 'badge ' + plan.verdict, plan.verdict.toUpperCase());
    verdictP.appendChild(badge);
    verdictP.appendChild(document.createTextNode('  ' + reasonLine(row, plan)));
    shell.appendChild(verdictP);
    var grid = el('div', 'detail-grid');
    /* left: waterfall + matrix */
    var left = document.createElement('div');
    var wfCard = el('div', 'card wide');
    wfCard.appendChild(el('h2', null, 'Valuation waterfall'));
    var wfDiv = document.createElement('div'); wfDiv.innerHTML = waterfallSvg(row, plan); wfCard.appendChild(wfDiv);
    wfCard.appendChild(el('p', 'sub', 'Each bar multiplies the last. The final bar is odds-weighted; the bar before it is the conditional value if a token launches.'));
    left.appendChild(wfCard);
    var mxCard = el('div', 'card wide');
    mxCard.appendChild(el('h2', null, 'Drop × deposit matrix — net after gas and the T-bill'));
    var mx = document.createElement('table'); mx.className = 'evidence matrix';
    var mhead = document.createElement('thead'); var mhr = document.createElement('tr');
    mhr.appendChild(el('th', null, 'Drop share \\ deposit'));
    [1000, 5000, 10000, 25000].forEach(function (d) {
      mhr.appendChild(el('th', 'num', '$' + d.toLocaleString('en-US')));
    });
    mhead.appendChild(mhr); mx.appendChild(mhead);
    var mb = document.createElement('tbody');
    [0.035, 0.07, 0.14].forEach(function (sh) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, (sh * 100).toFixed(1) + '% of implied value'));
      [1000, 5000, 10000, 25000].forEach(function (d) {
        var cellPlan = buildFarmPlan(row, C, { deposit: d, dropShare: sh, holdDays: plan.holdDays });
        var td = el('td', 'num', signed(cellPlan.net) + '  (' + signed(cellPlan.netPerHour) + '/h)');
        if (cellPlan.net < 0) td.className += ' neg'; else td.className += ' pos';
        tr.appendChild(td);
      });
      mb.appendChild(tr);
    });
    mx.appendChild(mb); mxCard.appendChild(mx);
    mxCard.appendChild(el('p', 'sub', 'Hold ' + plan.holdDays + ' days, gas ' + money2(row.farm_gas_usd) + '. Each cell nets the drop share minus gas and the T-bill.'));
    left.appendChild(mxCard);
    grid.appendChild(left);
    /* right: plan + timeline + peers + benchmark */
    var right = document.createElement('div');
    var planCard = el('div', 'card wide');
    planCard.appendChild(el('h2', null, 'Farm plan — ' + money(plan.deposit) + ' deposit, ' + money2(plan.gas) + ' gas, ' + plan.hours.toFixed(2) + ' hours'));
    var steps = el('ol', 'steps');
    plan.steps.forEach(function (st) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(st.text + ' '));
      li.appendChild(el('span', 'cost', 'Cost: ' + st.cost + '. Time: ' + st.time + '.'));
      steps.appendChild(li);
    });
    planCard.appendChild(steps);
    planCard.appendChild(el('p', 'sub', 'Costs and times reconcile: deposit ' + money(plan.deposit) + ' + gas ' + money2(plan.gas) +
      ' = ' + money(plan.allIn) + ' all in; hours ' + plan.hours.toFixed(2) + ' = 0.25 setup + ' +
      (plan.holdDays / 7).toFixed(1) + ' weekly checks + claim. Timeline: day 0 set up (15 min), weekly checks (10 min), day ' + plan.holdDays + ' claim (10 min). ' +
      'Exit rule: withdraw if TVL prints below ' + money(row.exit_tvl_usd) +
      ' (a 7-day fall of ' + Math.abs(R.exit_drop_pct).toFixed(2) + '%, worse than 95% of this snapshot).'));
    right.appendChild(planCard);
    var peersCard = el('div', 'card wide');
    peersCard.appendChild(el('h2', null, 'Same-category priced peers'));
    peersCard.appendChild(el('p', 'sub', 'Priced peers in ' + (row.category || 'the same category') +
      ' passing the shape rule — Bridges and versioned pools excluded.'));
    var peers = R.live.filter(function (p) {
      return p.category === row.category && p.mcap_usd !== null && p.mcap_usd > 0 && shapeOk(p);
    }).map(function (p) {
      return { p: p, d: Math.abs(Math.log(p.tvl_usd) - Math.log(row.tvl_usd)) };
    }).sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
    var pt = document.createElement('table'); pt.className = 'evidence';
    var ph = document.createElement('thead'); var phr = document.createElement('tr');
    ['Protocol', 'TVL', 'Market cap', 'Mcap / TVL'].forEach(function (h, i) {
      phr.appendChild(el('th', i > 0 ? 'num' : null, h));
    });
    ph.appendChild(phr); pt.appendChild(ph);
    var pb = document.createElement('tbody');
    if (!peers.length) {
      var er = document.createElement('tr'); var ec = document.createElement('td'); ec.colSpan = 4;
      ec.textContent = 'No priced peer in this category passes the shape rule.'; er.appendChild(ec); pb.appendChild(er);
    }
    peers.forEach(function (it) {
      var p = it.p;
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, p.name + ' (' + (p.symbol || '—') + ')'));
      tr.appendChild(el('td', 'num', money(p.tvl_usd)));
      tr.appendChild(el('td', 'num', money(p.mcap_usd)));
      tr.appendChild(el('td', 'num', '×' + (p.mcap_usd / p.tvl_usd).toFixed(3)));
      pb.appendChild(tr);
    });
    pt.appendChild(pb); peersCard.appendChild(pt);
    right.appendChild(peersCard);
    var bmCard = el('div', 'card wide');
    bmCard.appendChild(el('h2', null, 'Conditional vs odds-weighted, and the benchmark'));
    bmCard.appendChild(el('p', 'sub',
      'Conditional: if it launches, ' + money(row.if_launches_usd) + ' (P25–P75 ' + money(row.if_launches_p25_usd) + '–' + money(row.if_launches_p75_usd) + '). ' +
      'Odds-weighted: implied ' + money(row.implied_value_usd) + ' = conditional × ' + row.growth_multiplier.toFixed(4) + ' carry × ' + (row.token_odds * 100).toFixed(1) + '% ever-odds. ' +
      'Benchmark: ' + money(plan.deposit) + ' in a 4% T-bill earns ' + money2(plan.tbill) + ' for certain over ' + plan.holdDays +
      ' days; the slice ' + money2(plan.slice) + ' pays only if a token ever launches. ' +
      'Break-even ticket ' + (plan.breakEvenTicket === null ? '—' : money(plan.breakEvenTicket)) + ', break-even odds ' +
      (plan.breakEvenOdds === null ? 'above the cap' : (plan.breakEvenOdds * 100).toFixed(1) + '%') + '. ' +
      'Fitted multiple ×' + row.fitted_multiple.toFixed(4) + ' · category effect ' + (row.category_effect >= 0 ? '+' : '') + row.category_effect.toFixed(4) +
      ' · implied P10–P90 ' + money(row.implied_p10_usd) + '–' + money(row.implied_p90_usd) + ' · bootstrap rank #' + row.rank_min + '–#' + row.rank_max + '.'));
    right.appendChild(bmCard);
    grid.appendChild(right);
    shell.appendChild(grid);
    page.appendChild(shell);
  }
  function closeDetail() {
    $('detail').hidden = true;
    $('detail').textContent = '';
    writeHash(true);
  }

  /* ---------- hash state ---------- */
  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var dirSeen = false;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = kv[0], v = kv[1] ? decodeURIComponent(kv[1]) : '';
      if (k === 'verdict' && ['farm', 'thin', 'skip', 'all'].indexOf(v) >= 0) { S.verdict = v; $('verdict').value = v; }
      if (k === 'sort') S.sort = v;
      if (k === 'dir') { S.dir = v === '-1' ? -1 : 1; dirSeen = true; }
      if (k === 'tab' && (v === 'pre' || v === 'live')) S.tab = v;
      if (k === 'cat') { S.cat = v; $('cat').value = v; }
      if (k === 'q') { S.q = v; $('q').value = v; }
      if (k === 'deposit') S.deposit = v;
      if (k === 'share') S.share = parseFloat(v) || 0.07;
      if (k === 'horizon') S.horizon = v;
      if (k === 'priced') S.pricedOnly = v === '1';
      if (k === 'detail') S._detail = v;
    });
    if (!dirSeen && S.sort !== 'rank') S.dir = -1;
  }
  function writeHash(clearDetail) {
    var parts = [];
    if (S.verdict !== 'all') parts.push('verdict=' + S.verdict);
    if (S.sort !== 'rank') parts.push('sort=' + S.sort);
    if (S.sort !== 'rank') parts.push('dir=' + S.dir);
    if (S.tab !== 'pre') parts.push('tab=' + S.tab);
    if (S.cat !== 'all') parts.push('cat=' + encodeURIComponent(S.cat));
    if (S.q) parts.push('q=' + encodeURIComponent(S.q));
    if (S.deposit !== 'row') parts.push('deposit=' + S.deposit);
    if (S.share !== 0.07) parts.push('share=' + S.share);
    if (S.horizon !== 'model') parts.push('horizon=' + S.horizon);
    if (S.pricedOnly) parts.push('priced=1');
    if (!clearDetail && S._detail) parts.push('detail=' + S._detail);
    var h = parts.length ? '#' + parts.join('&') : ' ';
    try { window.history.replaceState(null, '', h === ' ' ? window.location.pathname : h); } catch (e) { /* file URLs */ }
  }

  /* ---------- controls ---------- */
  function segHandler(id, fn) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      $(id).querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      fn(b.getAttribute('data-v'));
      writeHash(); renderBoard();
    });
  }
  function syncSegs() {
    function sync(id, v) {
      $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-v') === v); });
    }
    sync('deposit', S.deposit); sync('share', String(S.share)); sync('horizon', S.horizon);
    $('tab').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === S.tab); });
    $('live-tools').hidden = S.tab !== 'live';
    $('priced-pill').setAttribute('aria-pressed', S.pricedOnly ? 'true' : 'false');
    $('priced-pill').textContent = S.pricedOnly ? 'Priced only (128) — show all' : 'Priced comps only (128)';
  }
  function bindControls() {
    $('q').addEventListener('input', function (e) { S.q = e.target.value; writeHash(); renderBoard(); });
    $('cat').addEventListener('change', function (e) { S.cat = e.target.value; writeHash(); renderBoard(); });
    $('chain').addEventListener('change', function (e) { S.chain = e.target.value; writeHash(); renderBoard(); });
    $('odds').addEventListener('change', function (e) { S.odds = parseFloat(e.target.value); writeHash(); renderBoard(); });
    $('verdict').addEventListener('change', function (e) { S.verdict = e.target.value; S.sort = 'rank'; S.dir = 1; writeHash(); renderBoard(); });
    $('tab').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      S.tab = b.getAttribute('data-tab');
      syncSegs(); writeHash(); renderBoard();
    });
    segHandler('deposit', function (v) { S.deposit = v; });
    segHandler('share', function (v) { S.share = parseFloat(v); });
    segHandler('horizon', function (v) { S.horizon = v; });
    $('priced-pill').addEventListener('click', function () {
      S.pricedOnly = !S.pricedOnly;
      syncSegs(); writeHash(); renderBoard();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('detail').hidden) closeDetail();
    });
  }

  fillSelects();
  renderHead();
  renderAudit();
  bindControls();
  readHash();
  syncSegs();
  renderBoard();
  if (S._detail) openDetail(S._detail);
})();
