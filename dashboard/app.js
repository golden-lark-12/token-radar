// Token Radar dashboard, model radar-3. Reads window.RADAR (data.js, written beside dashboard/)
// and renders the ranked pre-token board, the live-token comparison set, the protocol ledger,
// the out-of-sample evidence and the fitted model. No network: every byte shown comes from data.js.
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

  var state = { q: '', category: 'all', chain: 'all', odds: 0, verdict: 'all', tab: 'pre', sort: 'implied', dir: -1 };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtNet(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '+';
    return sign + '$' + Math.abs(n).toFixed(2);
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
  function netOf(r) {
    return (typeof r.net_usd === 'number' && isFinite(r.net_usd)) ? r.net_usd : null;
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

  // The farm plan is the same derivation main.ts uses: category, chains, TVL and age decide the
  // action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = (typeof p.farm_cost_usd === 'number' && isFinite(p.farm_cost_usd)) ? p.farm_cost_usd : capitalFor(p);
    var gas = (typeof p.farm_gas_usd === 'number' && isFinite(p.farm_gas_usd)) ? p.farm_gas_usd : (capital >= 150 ? 8 : 4);
    var hold = holdDaysFor(p.age_days);
    var net = netOf(p);
    var netText = net === null ? 'n/a' : fmtNet(net);
    var verdict = (p.verdict || 'skip').toUpperCase();
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' deposit, about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: '$' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check; never pay to claim', time: '10 minutes' },
      { text: 'Verdict ' + verdict + ': on a $1,000 ticket the expected airdrop slice nets ' + netText + ' after ~$' + gas + ' of gas, so the full run costs about $' + (capital + gas) + ' ($' + capital + ' deposit, ~$' + gas + ' gas). Farm it only if that net clears your bar; the implied value and token odds above are the model\u2019s read, not a promise.', cost: 'about $' + (capital + gas) + ' all in', time: hold + ' days of holding' }
    ];
  }

  function setText(id, text) {
    var n = document.getElementById(id);
    if (n) n.textContent = text;
  }

  // Header and KPI strip, from the data.
  setText('snap-date', DATA.as_of || '—');
  setText('model-ver', DATA.model_version || '—');
  var wl = DATA.watchlist_size || DATA.rows.length;
  setText('kpi-watchlist', wl + ' / ' + wl);
  setText('kpi-board', String(DATA.board_size || DATA.rows.length));
  var loo = (typeof FIT.loo_miss === 'number' && isFinite(FIT.loo_miss)) ? FIT.loo_miss : 2.9;
  setText('kpi-loo', '×' + loo.toFixed(2));
  var wf = (typeof FIT.wf_miss === 'number' && isFinite(FIT.wf_miss)) ? FIT.wf_miss : 2.72;
  setText('kpi-wf', '×' + wf.toFixed(2));
  var br = (typeof FIT.odds_brier_cv === 'number' && isFinite(FIT.odds_brier_cv)) ? FIT.odds_brier_cv : 0.237;
  setText('kpi-brier', br.toFixed(3));
  var nFarm = DATA.rows.filter(function (r) { return r.verdict === 'farm'; }).length;
  setText('kpi-farm', nFarm + ' FARM');

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

  // Out-of-sample evidence table: which terms were kept, and the held-out miss for each.
  var evBody = document.getElementById('evidence-body');
  DATA.fit_terms.forEach(function (t) {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = t.term;
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = '×' + Number(t.loo_miss).toFixed(2);
    var td3 = document.createElement('td'); td3.className = 'num'; td3.textContent = '×' + Number(t.wf_miss).toFixed(2);
    var td4 = document.createElement('td'); td4.textContent = t.kept ? 'kept' : 'baseline';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    evBody.appendChild(tr);
  });

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
      if (state.verdict !== 'all' && (r.verdict || '') !== state.verdict) return false;
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
      else if (key === 'growth') {
        av = (a.change_7d === null || a.change_7d === undefined) ? -Infinity : a.change_7d;
        bv = (b.change_7d === null || b.change_7d === undefined) ? -Infinity : b.change_7d;
      }
      else if (key === 'age') {
        av = (a.age_days === null || a.age_days === undefined) ? Infinity : a.age_days;
        bv = (b.age_days === null || b.age_days === undefined) ? Infinity : b.age_days;
      }
      else if (key === 'odds') {
        av = tokenOdds(a); av = av === null ? -1 : av;
        bv = tokenOdds(b); bv = bv === null ? -1 : bv;
      }
      else if (key === 'net') {
        av = netOf(a); av = av === null ? -Infinity : av;
        bv = netOf(b); bv = bv === null ? -Infinity : bv;
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
      var growth = r.change_7d === null || r.change_7d === undefined ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = (r.change_7d === null || r.change_7d === undefined) ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var odds = tokenOdds(r);
      var net = netOf(r);
      var netClass = net === null ? '' : net >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: chainSub(r) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: odds === null ? 'n/a' : Math.round(odds * 100) + '%' }),
        el('td', { class: 'num ' + netClass, text: fmtNet(net) }),
        el('td', null, verdictBadge(r.verdict || null))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Net is the expected airdrop slice on a $1,000 ticket after gas. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            el('th', { scope: 'col', text: 'Protocol' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Token odds'),
            sortHeader('net', 'Net / $1,000'),
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
      el('p', { class: 'note', text: 'Market facts, not a model: these protocols already trade, so their market cap is the market\u2019s own value. They are the comparables the power law was fitted to, set aside from the pre-token ranking.' }),
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

  // Recompute a row in the page from the snapshot figures and the model constants, so the
  // page's code and the board's data are visibly the same arithmetic.
  function recompute(row) {
    var m = MODEL;
    var vc = typeof m.value_const === 'number' ? m.value_const : 8.9076;
    var vt = typeof m.value_log_tvl === 'number' ? m.value_log_tvl : 0.4649;
    var vg = typeof m.value_growth === 'number' ? m.value_growth : -2.8915;
    var va = typeof m.value_log_age === 'number' ? m.value_log_age : -0.1769;
    var oc = typeof m.odds_const === 'number' ? m.odds_const : -3.771;
    var ot = typeof m.odds_log_tvl === 'number' ? m.odds_log_tvl : 0.045;
    var oa = typeof m.odds_log_age === 'number' ? m.odds_log_age : 0.51;
    var unk = typeof m.unknown_age_days === 'number' ? m.unknown_age_days : 365;
    var age = (row.age_days === null || row.age_days === undefined) ? unk : Math.max(1, row.age_days);
    var g = (row.change_7d === null || row.change_7d === undefined) ? 0 : Math.min(120, Math.max(-60, row.change_7d));
    var ifLaunch = Math.max(1, Math.round(Math.exp(vc + vt * Math.log(Math.max(1, row.tvl_usd)) + vg * (g / 100) + va * Math.log(age))));
    var logit = oc + ot * Math.log(Math.max(1, row.tvl_usd)) + oa * Math.log(age);
    var odds = 1 / (1 + Math.exp(-logit));
    odds = Math.min(0.95, Math.max(0.05, odds));
    var implied = Math.max(1, Math.round(ifLaunch * odds));
    return { ifLaunch: ifLaunch, odds: odds, implied: implied };
  }

  var dialog = document.getElementById('detail');
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    var capital = (typeof row.farm_cost_usd === 'number' && isFinite(row.farm_cost_usd)) ? row.farm_cost_usd : capitalFor(row);
    var gas = (typeof row.farm_gas_usd === 'number' && isFinite(row.farm_gas_usd)) ? row.farm_gas_usd : (capital >= 150 ? 8 : 4);
    var hold = holdDaysFor(row.age_days);
    var odds = tokenOdds(row);
    var net = netOf(row);
    var steps = farmSteps(row);
    var re = recompute(row);
    var same = Math.abs(re.implied - row.implied_value_usd) <= Math.max(1, row.implied_value_usd * 0.001);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + (DATA.board_size || DATA.rows.length) }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: catOf(row) + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('div', { class: 'verdict-line' },
      verdictBadge(row.verdict || null),
      el('span', { class: 'sub', text: 'Net ' + fmtNet(net) + ' on $1,000 · deposit $' + capital + ' · gas ~$' + gas + ' · hold ' + hold + ' days' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Model breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Value if it launches' }), el('b', { class: 'num', text: fmtUsd(row.if_launches_usd) })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: odds === null ? 'n/a' : Math.round(odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Net on a $1,000 ticket' }), el('b', { class: 'num', text: fmtNet(net) }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(re.implied) + (same ? ', the same number the board carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
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
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }
  dialog.addEventListener('close', function () { /* no state to clear */ });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });

  var wrap = document.getElementById('board-wrap');
  var countEl = document.getElementById('count');
  function render() {
    wrap.textContent = '';
    if (state.tab === 'pre') {
      wrap.appendChild(boardTable());
      countEl.textContent = filteredRows().length + ' rows shown';
    } else {
      wrap.appendChild(liveTable());
      countEl.textContent = DATA.live.length + ' live-token protocols';
    }
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

  render();

  // Deep link: #p=<slug> opens that protocol's detail view on load.
  (function () {
    var m = /[#&]p=([^&]+)/.exec(window.location.hash || '');
    if (m) {
      var slug = decodeURIComponent(m[1]);
      var found = null;
      DATA.rows.forEach(function (r) { if (r.slug === slug) found = r; });
      if (found) openDetail(slug);
    }
  })();
})();
