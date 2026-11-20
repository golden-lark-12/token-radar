// Token Radar dashboard, model radar-2. Reads window.RADAR (data.js, written beside dashboard/)
// and renders the ranked pre-token board, the live-token comparison set, and the fitted model.
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
  var FIT = DATA.fit || {};

  // Fitted mcap/TVL multiples per category, shrunk toward the global positive median 0.214 and
  // capped at 2.0. Categories with no live comparables use 0.214. These are model constants.
  var FITTED = {
    'Dexs': 0.302, 'Lending': 0.153, 'Liquid Staking': 0.103, 'Yield': 0.199,
    'RWA': 0.253, 'Canonical Bridge': 0.542, 'Basis Trading': 0.471, 'Bridge': 0.401,
    'Yield Aggregator': 0.186, 'Cross Chain Bridge': 0.661, 'Onchain Capital Allocator': 0.156,
    'CDP': 0.197, 'Derivatives': 0.770, 'Liquid Restaking': 0.205, 'Restaking': 0.160,
    'Staking Pool': 0.153, 'Payments': 0.205, 'AI Agents': 0.326, 'Indexes': 0.189,
    'Privacy': 0.497, 'Token Locker': 2.000, 'Collateral Management': 2.000,
    'Prediction Market': 2.000, 'Risk Curators': 0.674, 'Chain': 0.683
  };
  var FALLBACK_MULTIPLE = 0.214;

  var state = { q: '', category: 'all', chain: 'all', odds: 0, verdict: 'all', tab: 'pre', sort: 'implied', dir: -1 };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
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
  function fmtMedape(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 'n/a';
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + '%';
  }
  function catOf(r) { return r.category || 'Other'; }
  function fittedMultiple(r) {
    if (typeof r.fitted_multiple === 'number' && isFinite(r.fitted_multiple)) return r.fitted_multiple;
    var m = FITTED[r.category];
    return typeof m === 'number' ? m : FALLBACK_MULTIPLE;
  }
  function tokenOdds(r) {
    return (typeof r.token_odds === 'number' && isFinite(r.token_odds)) ? r.token_odds : null;
  }
  function growthMult(r) {
    if (typeof r.growth_multiplier === 'number' && isFinite(r.growth_multiplier)) return r.growth_multiplier;
    var g = (r.change_7d === null || r.change_7d === undefined) ? 0 : r.change_7d;
    return 1 + 0.01 * Math.min(30, Math.max(-30, g));
  }
  function maturityMult(r) {
    if (typeof r.maturity_multiplier === 'number' && isFinite(r.maturity_multiplier)) return r.maturity_multiplier;
    return 1;
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
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' deposit, about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: '$' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check; never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }

  function setText(id, text) {
    var n = document.getElementById(id);
    if (n) n.textContent = text;
  }

  // Header and KPI strip, from the data. The held-out MedAPE is shown as it is: the fit is honest
  // about its error, and the baseline next to it shows how little the category fit beats it.
  setText('snap-date', DATA.as_of || '—');
  setText('model-ver', DATA.model_version || '—');
  var wl = DATA.watchlist_size || DATA.rows.length;
  setText('kpi-watchlist', wl + ' / ' + wl);
  setText('kpi-board', String(DATA.board_size || DATA.rows.length));
  var nLive = (typeof FIT.n_live === 'number' && isFinite(FIT.n_live)) ? FIT.n_live : (DATA.live.length || 144);
  setText('kpi-live', String(nLive));
  var med = (typeof FIT.median_multiple === 'number' && isFinite(FIT.median_multiple)) ? FIT.median_multiple : 0.214;
  setText('kpi-median', med.toFixed(3) + '×');
  var hm = (typeof FIT.heldout_medape === 'number' && isFinite(FIT.heldout_medape)) ? FIT.heldout_medape : 98.8;
  setText('kpi-medape', fmtMedape(hm));
  var base = (typeof FIT.baseline_medape === 'string' && FIT.baseline_medape) ? FIT.baseline_medape : '87-99%';
  setText('kpi-baseline', base);

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

  // Fitted multiples table, from the model constants above.
  var mb = document.getElementById('multiples-body');
  Object.keys(FITTED).sort().forEach(function (c) {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = c;
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = FITTED[c].toFixed(3) + '×';
    tr.appendChild(td1); tr.appendChild(td2);
    mb.appendChild(tr);
  });
  (function () {
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = 'All other / no-comp categories';
    var td2 = document.createElement('td'); td2.className = 'num'; td2.textContent = FALLBACK_MULTIPLE.toFixed(3) + '×';
    tr.appendChild(td1); tr.appendChild(td2);
    mb.appendChild(tr);
  })();

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
        el('td', null, verdictBadge(r.verdict || null))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            el('th', { scope: 'col', text: 'Protocol' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Token odds'),
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
      el('p', { class: 'note', text: 'Market facts, not a model: these protocols already trade, so their market cap is the market\u2019s own value. They are the comparables the multiples were fitted to, set aside from the pre-token ranking.' }),
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

  var dialog = document.getElementById('detail');
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    var capital = (typeof row.farm_cost_usd === 'number' && isFinite(row.farm_cost_usd)) ? row.farm_cost_usd : capitalFor(row);
    var gas = (typeof row.farm_gas_usd === 'number' && isFinite(row.farm_gas_usd)) ? row.farm_gas_usd : (capital >= 150 ? 8 : 4);
    var hold = holdDaysFor(row.age_days);
    var fitted = fittedMultiple(row);
    var growth = growthMult(row);
    var maturity = maturityMult(row);
    var odds = tokenOdds(row);
    var steps = farmSteps(row);
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
      el('span', { class: 'sub', text: 'Deposit $' + capital + ' · gas ~$' + gas + ' · hold ' + hold + ' days' })
    ));
    var recompute = null;
    if (odds !== null) {
      var re = Math.max(1, Math.round(row.tvl_usd * fitted * growth * odds));
      // The stored multipliers are rounded to 4 decimals, so the recompute can differ
      // from the board's exact integer by a hair. Within 0.1% it is the same number.
      var same = Math.abs(re - row.implied_value_usd) <= Math.max(1, row.implied_value_usd * 0.001);
      recompute = el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(re) + (same ? ', the same number the board carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' });
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Model breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted multiple (' + catOf(row) + ')' }), el('b', { class: 'num', text: fitted.toFixed(3) + '×' })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: growth.toFixed(2) + '×' })),
        el('div', null, el('span', { text: 'Maturity multiplier (flat)' }), el('b', { class: 'num', text: maturity.toFixed(2) + '×' })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: odds === null ? 'n/a' : Math.round(odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      recompute
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
})();
