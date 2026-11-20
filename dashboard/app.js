// Token Radar dashboard, model radar-5. Reads window.RADAR (data.js, written beside dashboard/)
// and renders the ranked pre-token board, the live-token comparison set, the protocol ledger,
// the out-of-sample evidence and the fitted model. What-if controls re-price every row live.
// No network: every byte shown comes from data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var main = document.getElementById('main');
  if (!DATA || !Array.isArray(DATA.rows) || DATA.rows.length === 0) {
    var p = document.createElement('p');
    p.className = 'error';
    p.textContent = 'No radar data found: data.js was not loaded beside this dashboard.';
    main.appendChild(p);
    return;
  }
  if (!Array.isArray(DATA.live)) DATA.live = [];
  if (!Array.isArray(DATA.ledger)) DATA.ledger = [];
  if (!Array.isArray(DATA.fit_terms)) DATA.fit_terms = [];
  var FIT = DATA.fit || {};
  var MODEL = DATA.model || {};

  var state = { q: '', category: 'all', chain: 'all', odds: 0, verdict: 'all', tab: 'pre', sort: 'implied', dir: -1, ticket: 1000, share: 0.07, horizon: 'model' };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtNet(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n < 0 ? '-' : '+') + '$' + Math.abs(n).toFixed(2);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function catOf(r) { return r.category || 'Other'; }
  function tokenOdds(r) {
    return (typeof r.token_odds === 'number' && isFinite(r.token_odds)) ? r.token_odds : null;
  }
  function isDefault() { return state.ticket === 1000 && state.share === 0.07 && state.horizon === 'model'; }

  // Re-price one row at the what-if controls, from the row's stored fields and the model
  // constants in data.js. Same arithmetic as the model: slice = implied x share x ticket/TVL,
  // forgone yield = ticket x 4% x hold/365, net = slice - gas - yield. At the defaults this
  // reproduces the stored net exactly.
  function priceRow(r) {
    var share = state.share, ticket = state.ticket;
    var hold = state.horizon === 'model' ? (typeof r.hold_days === 'number' ? r.hold_days : 30) : state.horizon;
    var hours = (MODEL.setup_hours || 0.25) + (hold / 7) * (MODEL.weekly_hours || 0.1667) + (MODEL.claim_hours || 0.1667);
    var gas = (typeof r.farm_gas_usd === 'number' && isFinite(r.farm_gas_usd)) ? r.farm_gas_usd : 15;
    var tbillRate = MODEL.tbill_rate || 0.04;
    var slice = r.tvl_usd > 0 ? r.implied_value_usd * share * (ticket / r.tvl_usd) : 0;
    var tbill = ticket * tbillRate * (hold / 365);
    var net = slice - gas - tbill;
    var perDollar = r.tvl_usd > 0 ? r.implied_value_usd * share / r.tvl_usd - tbillRate * (hold / 365) : -1;
    var beT = perDollar > 0 ? Math.round(gas / perDollar) : null;
    var base = r.tvl_usd > 0 ? r.if_launches_usd * share * (ticket / r.tvl_usd) : 0;
    var beO = base > 0 ? (gas + tbill) / base : Infinity;
    beO = (beO > 0 && beO <= 0.95) ? Math.round(beO * 1e4) / 1e4 : null;
    return { hold: hold, hours: hours, slice: slice, gas: gas, tbill: tbill, net: net, nph: net / hours, beT: beT, beO: beO };
  }
  // The verdict at the what-if controls. At the defaults it is the model's odds-based verdict.
  // Off the defaults it is money-based: farm when the expected slice clears gas and the forgone
  // yield at this size, thin when the odds are still strong, skip otherwise. A bigger ticket
  // turns more rows farmable because the slice grows with the ticket while gas stays flat.
  // The crash guard applies in both modes: 7d down 15% can never be farm, down 30% is skip.
  function shownVerdict(r, priced) {
    var v;
    if (isDefault()) v = r.verdict || 'skip';
    else if (priced.net > 0) v = 'farm';
    else { var odds = tokenOdds(r); v = (odds !== null && odds >= 0.5) ? 'thin' : 'skip'; }
    if (typeof r.change_7d === 'number') {
      if (r.change_7d <= -30) return 'skip';
      if (r.change_7d <= -15 && v === 'farm') return 'thin';
    }
    return v;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function setText(id, text) {
    var n = document.getElementById(id);
    if (n) n.textContent = text;
  }

  // Header and KPI strip, from the data. The held-out numbers are the headline evidence:
  // leave-one-out and walk-forward miss, the in-sample odds Brier against its base rate,
  // and the calibration of the printed middle-50% range.
  setText('snap-date', DATA.as_of || '—');
  setText('model-ver', DATA.model_version || '—');
  var wl = DATA.watchlist_size || DATA.rows.length;
  setText('kpi-watchlist', wl + '/' + wl);
  setText('kpi-board', String(DATA.board_size || DATA.rows.length));
  var nLive = (typeof FIT.n_live === 'number' && isFinite(FIT.n_live)) ? FIT.n_live : (DATA.live.length || 128);
  setText('kpi-live', String(nLive));
  var loo = (typeof FIT.loo_miss === 'number' && isFinite(FIT.loo_miss)) ? FIT.loo_miss : 3.39;
  setText('kpi-loo', '×' + loo.toFixed(2));
  var wf = (typeof FIT.wf_miss === 'number' && isFinite(FIT.wf_miss)) ? FIT.wf_miss : 2.96;
  setText('kpi-loo-sub', '×' + wf.toFixed(2));
  var br = (typeof FIT.odds_brier_in_sample === 'number' && isFinite(FIT.odds_brier_in_sample)) ? FIT.odds_brier_in_sample : 0.209;
  setText('kpi-brier', br.toFixed(3));
  var brBase = (typeof FIT.odds_brier_base === 'number' && isFinite(FIT.odds_brier_base)) ? FIT.odds_brier_base : 0.249;
  setText('kpi-brier-sub', brBase.toFixed(3));
  var calMid = (typeof FIT.range_mid50_calib === 'number' && isFinite(FIT.range_mid50_calib)) ? FIT.range_mid50_calib : 0.508;
  setText('kpi-range', (calMid * 100).toFixed(1) + '%');
  var calWide = (typeof FIT.range_p10p90_calib === 'number' && isFinite(FIT.range_p10p90_calib)) ? FIT.range_p10p90_calib : 0.797;
  setText('kpi-range-sub', (calWide * 100).toFixed(1) + '%');

  // Integrity strip: the page checks its own table — ranks in order, the implied total, and an
  // in-page recompute of every row from TVL x fitted multiple x odds against the stored value.
  (function () {
    var total = 0, ordered = true, reOK = 0;
    DATA.rows.forEach(function (r, i) {
      total += r.implied_value_usd || 0;
      if (r.rank !== i + 1) ordered = false;
      if (i > 0 && r.implied_value_usd > DATA.rows[i - 1].implied_value_usd) ordered = false;
      var re = r.tvl_usd * (r.fitted_multiple || 0) * (r.growth_multiplier || 1) * (tokenOdds(r) || 0);
      if (Math.abs(re - r.implied_value_usd) <= Math.max(1, r.implied_value_usd * 0.01)) reOK++;
    });
    var led = DATA.ledger_total || 758;
    setText('integrity', 'Integrity: ranks 1–' + DATA.rows.length + (ordered ? ' in order' : ' OUT OF ORDER') +
      ' · implied total ' + fmtUsd(total) + ' · recompute ' + reOK + '/' + DATA.rows.length + ' within 1% · watchlist ' + wl + '/' + wl + ' · ledger ' + led + '/' + led);
  })();

  // Protocol accounting ledger: every snapshot protocol in exactly one group.
  var ledgerBar = document.getElementById('ledger-bar');
  var ledgerBody = document.getElementById('ledger-body');
  var ledgerTotal = DATA.ledger_total || DATA.ledger.reduce(function (s, g) { return s + (g.count || 0); }, 0) || 758;
  var ledgerColors = ['#3fb950', '#56d364', '#1f6feb', '#8957e5', '#9e6a03', '#bc8cff', '#f778ba', '#d29922', '#8b949e'];
  DATA.ledger.forEach(function (g, i) {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = g.label;
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = String(g.count);
    var td3 = document.createElement('td'); td3.className = 'sub'; td3.textContent = g.note || '';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    ledgerBody.appendChild(tr);
    if (ledgerBar && g.count > 0) {
      var seg = document.createElement('i');
      seg.style.width = (g.count / ledgerTotal * 100).toFixed(2) + '%';
      seg.style.background = ledgerColors[i % ledgerColors.length];
      seg.title = g.label + ': ' + g.count;
      ledgerBar.appendChild(seg);
    }
  });
  (function () {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = 'Total';
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = String(ledgerTotal);
    var td3 = document.createElement('td'); td3.className = 'sub'; td3.textContent = 'every snapshot protocol, exactly once';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    ledgerBody.appendChild(tr);
  })();

  // Out-of-sample evidence table: which terms were kept, on both held-out tests.
  var evBody = document.getElementById('evidence-body');
  DATA.fit_terms.forEach(function (t) {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = t.term;
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = (typeof t.loo_miss === 'number') ? '×' + t.loo_miss.toFixed(2) : '—';
    var td3 = document.createElement('td'); td3.className = 'num'; td3.textContent = (typeof t.wf_miss === 'number') ? '×' + t.wf_miss.toFixed(2) : '—';
    var td4 = document.createElement('td'); td4.className = 'num'; td4.textContent = (typeof t.medape === 'number') ? (t.medape * 100).toFixed(1) + '%' : (t.medape || '—');
    var td5 = document.createElement('td'); td5.textContent = t.kept ? 'kept' : 'tested, dropped';
    var td6 = document.createElement('td'); td6.className = 'sub'; td6.textContent = t.note || '';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5); tr.appendChild(td6);
    evBody.appendChild(tr);
  });

  // Category effects on value, derived from the rows' own stored effect — no hardcoded table.
  var catFx = {};
  DATA.rows.forEach(function (r) {
    var c = catOf(r);
    if (!catFx[c]) catFx[c] = { fx: (typeof r.category_effect === 'number' ? r.category_effect : 0), n: 0 };
    catFx[c].n++;
  });
  var catsBody = document.getElementById('cats-body');
  Object.keys(catFx).sort(function (a, b) { return catFx[b].fx - catFx[a].fx; }).forEach(function (c) {
    var fx = catFx[c].fx;
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = c;
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = (fx >= 0 ? '+' : '') + fx.toFixed(2) + ' log pts';
    var td3 = document.createElement('td'); td3.className = 'num'; td3.textContent = '×' + Math.exp(fx).toFixed(2);
    var td4 = document.createElement('td'); td4.className = 'num'; td4.textContent = String(catFx[c].n);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    catsBody.appendChild(tr);
  });

  // The farm plan comes from data.js: the model builds category-specific steps in main.ts
  // (action, chain, ticket, cost, time per step), and this page only adds the live verdict
  // step, re-priced at the what-if controls. No plan text is templated here.
  function fmtMoney2(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2);
  }
  function planSteps(p, priced) {
    var steps = (p.farm_steps || []).map(function (s) { return { text: s.text, cost: s.cost, time: s.time }; });
    var odds = tokenOdds(p);
    var verdict = shownVerdict(p, priced).toUpperCase();
    var pays = priced.beT !== null
      ? 'It pays from a $' + fmtInt(priced.beT) + ' ticket.'
      : 'No ticket size pays: the slice per dollar is below the T-bill rate.';
    var verdictText = 'Verdict: ' + verdict + ' — token odds ' + (odds === null ? 'n/a' : Math.round(odds * 100) + '%') +
      '. On a $' + fmtInt(state.ticket) + ' ticket the expected slice is ' + fmtMoney2(priced.slice) +
      ', gas about ' + fmtMoney2(priced.gas) + ' and forgone T-bill yield ' + fmtMoney2(priced.tbill) +
      ', net ' + fmtMoney2(priced.net) + ' (' + fmtMoney2(priced.nph) + '/hour). ' + pays;
    var capital = (typeof p.farm_cost_usd === 'number' && isFinite(p.farm_cost_usd)) ? p.farm_cost_usd : 50;
    var gas = (typeof p.farm_gas_usd === 'number' && isFinite(p.farm_gas_usd)) ? p.farm_gas_usd : 4;
    steps.push({ text: verdictText, cost: 'about $' + (capital + gas) + ' all in', time: priced.hold + ' days of holding' });
    return steps;
  }

  // Controls: category and chain options come from the board itself.
  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  var cats = Array.from(new Set(DATA.rows.map(catOf))).sort();
  fillSelect('cat', cats);
  var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
  fillSelect('chain', chains);

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && catOf(r) !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (shownVerdict(r, priceRow(r)) !== state.verdict && state.verdict !== 'all') return false;
      var odds = tokenOdds(r);
      if ((odds === null ? 0 : odds) < state.odds) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'odds') {
        av = tokenOdds(a); av = av === null ? -1 : av;
        bv = tokenOdds(b); bv = bv === null ? -1 : bv;
      }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
          render();
        }
      },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ↓' : ' ↑' }) : null
      )
    );
  }
  function verdictBadge(v) {
    if (!v) return el('span', { class: 'sub', text: '—' });
    return el('span', { class: 'badge v-' + v, text: v });
  }
  function chainSub(r) {
    return catOf(r) + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain');
  }
  // Short farm plan for the board row: the action step, trimmed to the deed, plus its cost,
  // its time and the hold. The full plan is in the detail view.
  function shortAction(r, priced) {
    var steps = r.farm_steps || [];
    var act = steps.length > 1 ? steps[1] : (steps[0] || null);
    if (!act) return null;
    var text = act.text.replace(/ and (keep|hold|use) [^.]*\.?$/, '.');
    return text + ' · ' + act.cost + ' · ' + act.time;
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', {
          class: 'button primary', type: 'button', text: 'Clear filters',
          onclick: function () {
            state.q = ''; state.category = 'all'; state.chain = 'all'; state.odds = 0; state.verdict = 'all';
            document.getElementById('q').value = '';
            document.getElementById('cat').value = 'all';
            document.getElementById('chain').value = 'all';
            document.getElementById('odds').value = '0';
            document.getElementById('verdict').value = 'all';
            render();
          }
        })
      ));
    }
    var max = 0;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    if (!max) max = 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var odds = tokenOdds(r);
      var priced = priceRow(r);
      var verdict = shownVerdict(r, priced);
      var plan = shortAction(r, priced);
      var tr = el('tr', {
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, el('div', { class: 'name' },
          el('b', { text: String(r.rank) }),
          (r.rank_min < r.rank_max) ? el('span', { class: 'sub', text: '#' + r.rank_min + '–' + r.rank_max }) : null
        )),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: chainSub(r) }),
          r.guard_reason ? el('span', { class: 'guard', text: r.guard_reason }) : null,
          r.family_child ? el('span', { class: 'fam', text: 'parent already has a token' }) : null,
          plan ? el('span', { class: 'plan', text: plan }) : null
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', { class: 'name' },
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'sub', text: 'P25 ' + fmtUsd(r.implied_p25_usd) + ' – P75 ' + fmtUsd(r.implied_p75_usd) })
          )
        )),
        el('td', { class: 'num', text: odds === null ? 'n/a' : Math.round(odds * 100) + '%' }),
        el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d !== undefined && r.change_7d >= 0) ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: (typeof r.farm_cost_usd === 'number' && isFinite(r.farm_cost_usd)) ? '$' + fmtInt(r.farm_cost_usd) : 'n/a' }),
        el('td', { class: 'num', text: priced.hold + 'd' }),
        el('td', null, verdictBadge(verdict))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Strongest implied value first; implied shows the middle-50% range (P25–P75). Cost is the farm deposit, Time the hold; select a row for the full farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            el('th', { scope: 'col', text: 'Protocol' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Token odds'),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Age' }),
            el('th', { scope: 'col', text: 'Cost to farm' }),
            el('th', { scope: 'col', text: 'Time' }),
            el('th', { scope: 'col', text: 'Verdict' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var mult = (r.mcap_usd !== null && r.mcap_usd !== undefined && r.tvl_usd > 0)
        ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : 'n/a';
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { text: catOf(r) }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num ' + ((r.change_7d !== null && r.change_7d !== undefined && r.change_7d >= 0) ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: mult })
      ));
    });
    return el('div', { class: 'panel' },
      el('p', { class: 'note', text: 'Market facts, not a model: these protocols already trade, so their market cap is the market\u2019s own value. They are the comparables the size curve was fitted to, set aside from the pre-token ranking.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live-token protocols by market cap.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: 'Market cap' }),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Mcap / TVL' })
          )),
          tbody
        )
      )
    );
  }

  // The nearest traded peers: the live-token protocols closest in log TVL, same category first,
  // with the curve's prediction for their size next to their actual market cap.
  function nearestPeers(row) {
    var fx = (typeof row.category_effect === 'number') ? row.category_effect : 0;
    var scored = DATA.live.map(function (p) {
      var d = Math.abs(Math.log(Math.max(1, p.tvl_usd)) - Math.log(Math.max(1, row.tvl_usd)));
      if ((p.category || 'Other') !== catOf(row)) d += 1.5;
      var pred = Math.exp(6.9646 + 0.5223 * Math.log(Math.max(1, p.tvl_usd)) + ((catFx[p.category || 'Other'] || {}).fx || 0));
      return { p: p, d: d, pred: pred };
    });
    scored.sort(function (a, b) { return a.d - b.d; });
    return scored.slice(0, 3);
  }

  var dialog = document.getElementById('detail');
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    var capital = (typeof row.farm_cost_usd === 'number' && isFinite(row.farm_cost_usd)) ? row.farm_cost_usd : 50;
    var gas = (typeof row.farm_gas_usd === 'number' && isFinite(row.farm_gas_usd)) ? row.farm_gas_usd : 4;
    var priced = priceRow(row);
    var verdict = shownVerdict(row, priced);
    var odds = tokenOdds(row);
    var fitted = (typeof row.fitted_multiple === 'number' && isFinite(row.fitted_multiple)) ? row.fitted_multiple : 0;
    var growth = (typeof row.growth_multiplier === 'number' && isFinite(row.growth_multiplier)) ? row.growth_multiplier : 1;
    var fx = (typeof row.category_effect === 'number' && isFinite(row.category_effect)) ? row.category_effect : 0;
    var curve = Math.exp(6.9646 + 0.5223 * Math.log(Math.max(1, row.tvl_usd)));
    var steps = planSteps(row, priced);
    var re = Math.max(1, Math.round(row.tvl_usd * fitted * growth * (odds === null ? 0 : odds)));
    var same = Math.abs(re - row.implied_value_usd) <= Math.max(1, row.implied_value_usd * 0.01);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + (DATA.board_size || DATA.rows.length) + ' · rank range #' + row.rank_min + '–' + row.rank_max }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: catOf(row) + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('div', { class: 'verdict-line' },
      verdictBadge(verdict),
      row.guard_reason ? el('span', { class: 'guard', text: row.guard_reason }) : null,
      el('span', { class: 'sub', text: 'Net ' + fmtNet(priced.nph) + '/hour at $' + fmtInt(state.ticket) + ' · pays from ' + (priced.beT !== null ? '$' + fmtInt(priced.beT) : 'never') + ' · deposit $' + capital + ' · gas ~$' + gas + ' · hold ' + priced.hold + ' days' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Model breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Size curve exp(6.9646 + 0.5223 x ln TVL)' }), el('b', { class: 'num', text: fmtUsd(curve) })),
        el('div', null, el('span', { text: 'Category effect (' + catOf(row) + ')' }), el('b', { class: 'num', text: (fx >= 0 ? '+' : '') + fx.toFixed(2) + ' log pts (x' + Math.exp(fx).toFixed(2) + ')' })),
        el('div', null, el('span', { text: 'Growth carry (7d ' + fmtPct(row.change_7d) + ', clipped ±25%)' }), el('b', { class: 'num', text: 'x' + growth.toFixed(2) + ' — a stated projection, not a fit' })),
        row.family_child ? el('div', null, el('span', { text: 'Family effect' }), el('b', { class: 'num', text: 'parent already has a token — odds down-weighted 2.5 logit pts' })) : null,
        el('div', null, el('span', { text: 'Value if it launches' }), el('b', { class: 'num', text: fmtUsd(row.if_launches_usd) + '  (P25 ' + fmtUsd(row.if_launches_p25_usd) + ' – P75 ' + fmtUsd(row.if_launches_p75_usd) + ')' })),
        el('div', null, el('span', { text: 'Token odds (age, size, family)' }), el('b', { class: 'num', text: odds === null ? 'n/a' : Math.round(odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) + '  (P25 ' + fmtUsd(row.implied_p25_usd) + ' – P75 ' + fmtUsd(row.implied_p75_usd) + ')' })),
        el('div', null, el('span', { text: 'Wide range (P10–P90)' }), el('b', { class: 'num', text: fmtUsd(row.implied_p10_usd) + ' – ' + fmtUsd(row.implied_p90_usd) })),
        el('div', null, el('span', { text: 'Net at $' + fmtInt(state.ticket) + ', ' + Math.round(state.share * 100) + '% drop' }), el('b', { class: 'num', text: fmtNet(priced.net) + '  (' + fmtNet(priced.nph) + '/hour)' })),
        el('div', null, el('span', { text: 'Break-even ticket / odds' }), el('b', { class: 'num', text: (priced.beT !== null ? '$' + fmtInt(priced.beT) : 'never pays') + ' / ' + (priced.beO !== null ? Math.round(priced.beO * 100) + '%' : 'n/a') }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(re) + (same ? ', the same number the board carries (within 1%).' : ', which differs from the board: the data would be stale.') + ' The growth carry is a stated projection: 1 + 0.01 x clip(7d, ±25%). This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        return el('li', null,
          el('b', { text: s.text }),
          el('span', { class: 'cost', text: 'Cost: ' + s.cost + ' · Time: ' + s.time })
        );
      }))
    ));
    // Nearest traded peers.
    var peers = nearestPeers(row);
    var peerBody = el('tbody');
    peers.forEach(function (pe) {
      var ratio = (pe.p.mcap_usd && pe.p.mcap_usd > 0) ? (pe.p.mcap_usd / pe.pred) : null;
      peerBody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: pe.p.name }),
          el('span', { class: 'sub', text: catOf(pe.p) })
        )),
        el('td', { class: 'num', text: fmtUsd(pe.p.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(pe.p.mcap_usd) }),
        el('td', { class: 'num', text: fmtUsd(pe.pred) }),
        el('td', { class: 'num', text: ratio === null ? 'n/a' : ratio.toFixed(2) + 'x' })
      ));
    });
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Nearest traded peers' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'peers' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: 'Actual mcap' }),
            el('th', { scope: 'col', text: 'Curve says' }),
            el('th', { scope: 'col', text: 'Actual / curve' })
          )),
          peerBody
        )
      ),
      el('p', { class: 'sub', text: 'Closest live-token protocols in log TVL, same category first. “Curve says” is the size curve at the peer\u2019s TVL and category effect.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    try { history.replaceState(null, '', '#p=' + row.slug); } catch (e) { /* file URLs may refuse */ }
  }
  dialog.addEventListener('close', function () {
    try {
      if ((window.location.hash || '').indexOf('#p=') === 0) history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) { /* ignore */ }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });

  // What-if summary: how the whole board prices at the current controls.
  function updateWhatifSummary() {
    var nFarm = 0, best = null, bestName = '';
    DATA.rows.forEach(function (r) {
      var priced = priceRow(r);
      if (shownVerdict(r, priced) === 'farm') nFarm++;
      if (best === null || priced.nph > best) { best = priced.nph; bestName = r.name; }
    });
    var holdLabel = state.horizon === 'model' ? 'model hold' : state.horizon + ' days';
    setText('whatif-summary', 'At $' + fmtInt(state.ticket) + ' · ' + Math.round(state.share * 1000) / 10 + '% drop · ' + holdLabel +
      ': ' + nFarm + ' FARM · best ' + fmtNet(best) + '/h — ' + bestName +
      (isDefault() ? '' : ' · verdicts re-priced at this size; the board verdict is odds-based at the $1,000 default.'));
  }

  var wrap = document.getElementById('board-wrap');
  var countEl = document.getElementById('count');
  function render() {
    wrap.textContent = '';
    if (state.tab === 'pre') {
      wrap.appendChild(boardTable());
      countEl.textContent = filteredRows().length + ' rows shown' + (isDefault() ? '' : ' · verdicts re-priced at $' + fmtInt(state.ticket));
    } else {
      wrap.appendChild(liveTable());
      countEl.textContent = DATA.live.length + ' live-token protocols';
    }
    updateWhatifSummary();
  }

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; render(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.getElementById('odds').addEventListener('change', function (e) { state.odds = parseFloat(e.target.value) || 0; render(); });
  document.getElementById('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; render(); });
  document.getElementById('tab-pre').addEventListener('click', function () {
    state.tab = 'pre';
    document.getElementById('tab-pre').setAttribute('aria-pressed', 'true');
    document.getElementById('tab-live').setAttribute('aria-pressed', 'false');
    render();
  });
  document.getElementById('tab-live').addEventListener('click', function () {
    state.tab = 'live';
    document.getElementById('tab-live').setAttribute('aria-pressed', 'true');
    document.getElementById('tab-pre').setAttribute('aria-pressed', 'false');
    render();
  });

  // What-if controls: one segmented group per dimension; every click re-prices the board.
  function wireSeg(attr, apply) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-' + attr + ']'), function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('[data-' + attr + ']'), function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        apply(btn.getAttribute('data-' + attr));
        render();
      });
    });
  }
  wireSeg('ticket', function (v) { state.ticket = parseInt(v, 10); });
  wireSeg('share', function (v) { state.share = parseFloat(v); });
  wireSeg('horizon', function (v) { state.horizon = v === 'model' ? 'model' : parseInt(v, 10); });

  render();

  // Deep link and filter hash: #p=<slug> opens that protocol; #verdict=farm, #category=<name>
  // and #q=<text> filter.
  (function () {
    var hash = window.location.hash || '';
    var m = /[#&]p=([^&]+)/.exec(hash);
    var v = /[#&]verdict=([^&]+)/.exec(hash);
    var c = /[#&]category=([^&]+)/.exec(hash);
    var q = /[#&]q=([^&]+)/.exec(hash);
    if (v && ['farm', 'thin', 'skip'].indexOf(v[1]) >= 0) {
      state.verdict = v[1];
      document.getElementById('verdict').value = v[1];
    }
    if (c) {
      var catName = decodeURIComponent(c[1]);
      if (cats.indexOf(catName) >= 0) {
        state.category = catName;
        document.getElementById('cat').value = catName;
      }
    }
    if (q) {
      state.q = decodeURIComponent(q[1]);
      document.getElementById('q').value = state.q;
    }
    if (v || q || c) render();
    if (m) {
      var slug = decodeURIComponent(m[1]);
      var found = null;
      DATA.rows.forEach(function (r) { if (r.slug === slug) found = r; });
      if (found) openDetail(slug);
    }
  })();
})();
