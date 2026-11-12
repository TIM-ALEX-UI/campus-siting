/* ============================================================
 * 界面与交互层：选址与覆盖分析演示系统
 * 作者：Tim & Alex / 2026-11-12
 * 依赖：Leaflet(可选) / CONFIG / APP_DATA / SITING / SELFTEST
 * 设计原则：地图加载失败时，计算与结果表仍可正常使用
 * ============================================================ */
(function () {
  'use strict';

  var CFG = window.CONFIG || {
    build: 'public', author: 'Tim & Alex',
    accounts: {}, defaults: { radius: 200, k: 2, weightMode: 'base' }
  };
  var DATA = (window.APP_DATA || {}).main;
  var S = window.SITING;
  var ST = window.SELFTEST;

  var M = {
    r: (CFG.defaults && CFG.defaults.radius) || 200,
    k: (CFG.defaults && CFG.defaults.k) || 2,
    weightMode: (CFG.defaults && CFG.defaults.weightMode) || 'base',
    tiles: true,
    map: null,
    layer: null,
    last: null
  };

  function $(id) { return document.getElementById(id); }
  function fmtPct(x) { return (x * 100).toFixed(1) + '%'; }

  /* ==================== 登录门 ==================== */

  function bootAuth() {
    var role = sessionStorage.getItem('role');
    if (role) { enter(role); return; }
    // 没有账号表（例如本地未放 config.js）→ 直接以 guest 进入
    if (!CFG.accounts || Object.keys(CFG.accounts).length === 0) { enter('guest'); return; }
    $('login').classList.remove('hidden');
    $('loginBtn').addEventListener('click', doLogin);
    $('p').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('u').focus();
  }

  function doLogin() {
    var u = $('u').value.trim(), p = $('p').value;
    var acc = (CFG.accounts || {})[u];
    if (!acc || acc.pass !== p) {
      $('loginErr').textContent = '账号或密码不正确';
      return;
    }
    // 只写会话态：关掉标签页即失效，不做任何长期记录
    sessionStorage.setItem('role', acc.role);
    sessionStorage.setItem('who', u);
    enter(acc.role);
  }

  function enter(role) {
    $('login').classList.add('hidden');
    document.body.setAttribute('data-role', role);

    var tag = { guest: '演示系统（只读）', editor: '编辑系统', admin: '内部管理系统', owner: '内部管理系统（作者）' };
    $('modeTag').textContent = tag[role] || '演示系统';
    $('roleTag').textContent = '当前身份：' + role;

    if (role === 'guest') {
      $('modeTag').style.color = '#8b9bb4';
    }
    init();
  }

  /* ==================== 初始化 ==================== */

  function init() {
    if (!DATA || !S) {
      $('results').innerHTML = '<p style="color:var(--bad)">数据或计算模块未加载，请检查 data.js / algo.js 是否存在。</p>';
      return;
    }

    $('rVal').textContent = M.r;
    $('rRange').value = M.r;
    $('kSel').value = String(M.k);
    $('wSel').value = M.weightMode;

    $('rRange').addEventListener('input', function () {
      M.r = +this.value; $('rVal').textContent = M.r; compute();
    });
    $('kSel').addEventListener('change', function () { M.k = +this.value; compute(); });
    $('wSel').addEventListener('change', function () { M.weightMode = this.value; compute(); });
    $('tileChk').addEventListener('change', function () { M.tiles = this.checked; applyTiles(); });
    $('stBtn').addEventListener('click', runSelfTest);

    initMap();
    compute();
  }

  /* ==================== 地图 ==================== */

  function initMap() {
    if (typeof L === 'undefined') {
      $('mapnote').style.display = 'flex';
      return;
    }
    try {
      M.map = L.map('map', { zoomControl: true, attributionControl: true })
        .setView(DATA.meta.center, 16);
      M.tilesLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      });
      applyTiles();
      M.layer = L.layerGroup().addTo(M.map);

      var pts = DATA.demand.concat(DATA.candidate, DATA.existing)
        .map(function (d) { return [d.lat, d.lon]; });
      if (pts.length > 1) M.map.fitBounds(L.latLngBounds(pts).pad(0.25));
    } catch (e) {
      $('mapnote').style.display = 'flex';
      M.map = null;
    }
  }

  function applyTiles() {
    if (!M.map || !M.tilesLayer) return;
    if (M.tiles) {
      M.tilesLayer.addTo(M.map);
      $('map').style.background = '#1b2434';
    } else {
      M.map.removeLayer(M.tilesLayer);
      $('map').style.background = '#232b3a';   // 断网备用：纯色底，点位照常显示
    }
  }

  function drawMap(res) {
    if (!M.map || !M.layer) return;
    M.layer.clearLayers();

    var best = (res.perK[M.k - 1] || {}).best || [];
    var covered = {};
    ((res.perK[M.k - 1] || {}).covered || []).forEach(function (id) { covered[id] = 1; });

    // 现有设施的服务圆
    (DATA.existing || []).forEach(function (f) {
      L.circle([f.lat, f.lon], {
        radius: M.r, color: '#7b1fa2', weight: 1, opacity: .7,
        fillColor: '#7b1fa2', fillOpacity: .05
      }).addTo(M.layer).bindPopup('<b>' + f.name + '</b><br>现有设施');
    });

    // 推荐新增点的服务圆
    best.forEach(function (id) {
      var c = DATA.candidate.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      L.circle([c.lat, c.lon], {
        radius: M.r, color: '#ef6c00', weight: 2,
        fillColor: '#ef6c00', fillOpacity: .12
      }).addTo(M.layer);
    });

    // 候选点
    DATA.candidate.forEach(function (c) {
      var pick = best.indexOf(c.id) >= 0;
      L.circleMarker([c.lat, c.lon], {
        radius: pick ? 9 : 6, color: '#fff', weight: pick ? 2 : 1,
        fillColor: pick ? '#ef6c00' : '#1565c0', fillOpacity: 1
      }).addTo(M.layer)
        .bindPopup('<b>' + c.name + '</b><br>' + c.id + (pick ? ' · <b>已推荐</b>' : ' · 候选'));
    });

    // 需求点
    DATA.demand.forEach(function (d) {
      var ok = !!covered[d.id];
      L.circleMarker([d.lat, d.lon], {
        radius: 7, color: '#fff', weight: 1,
        fillColor: ok ? '#2e7d32' : '#c62828', fillOpacity: 1
      }).addTo(M.layer)
        .bindPopup('<b>' + d.name + '</b><br>' + d.id +
          '<br>权重：' + d.weight +
          '<br>状态：' + (ok ? '已覆盖' : '未覆盖') +
          '<br><span style="color:#888">' + d.source + ' / ' + d.verified + '</span>');
    });
  }

  /* ==================== 计算与渲染 ==================== */

  function compute() {
    var res = S.solve(DATA, { r: M.r, k: M.k, weightMode: M.weightMode });
    M.last = res;
    drawMap(res);
    renderCards(res);
    renderTables(res);
  }

  function renderCards(res) {
    var base = res.baseline;
    var best = res.perK[M.k - 1];
    var gain = best.gain - base.gain;
    var atK = res.nCombosAtK;

    var html = '';
    html += card('基线覆盖（现有设施）', fmtPct(base.coverage), base.gain + ' / ' + base.total);
    html += card('推荐方案（新增 ' + M.k + ' 个）', fmtPct(best.coverage), best.best.join(' + '));
    html += card('相对基线增量', '+' + fmtPct(best.coverage - base.coverage), '权重 +' + gain.toFixed(1));
    html += card('枚举规模', atK + ' 种组合', '全部穷举，非启发式');
    $('cards').innerHTML = html;

    function card(k, v, sub) {
      return '<div class="card"><div class="k">' + k + '</div>' +
        '<div class="v">' + v + '</div>' +
        '<div class="k" style="margin-top:2px">' + sub + '</div></div>';
    }
  }

  function renderTables(res) {
    var h = '';

    // 表一：各 k 下的最优方案
    h += '<table><thead><tr><th>新增数量</th><th>推荐组合</th><th class="num">覆盖权重</th><th class="num">覆盖率</th><th class="num">组合数</th></tr></thead><tbody>';
    h += '<tr><td>0（基线）</td><td>—</td><td class="num">' + res.baseline.gain + ' / ' + res.baseline.total + '</td><td class="num">' + fmtPct(res.baseline.coverage) + '</td><td class="num">—</td></tr>';
    res.perK.forEach(function (p) {
      h += '<tr><td>' + p.k + ' 个</td><td><b>' + p.best.join(' + ') + '</b></td>' +
        '<td class="num">' + p.gain + ' / ' + res.baseline.total + '</td>' +
        '<td class="num">' + fmtPct(p.coverage) + '</td>' +
        '<td class="num">' + p.nCombos + '</td></tr>';
    });
    h += '</tbody></table>';

    // 表二：当前 k 的前 5 名
    h += '<table><thead><tr><th>排名</th><th>组合</th><th class="num">覆盖权重</th><th class="num">覆盖率</th><th>未覆盖点</th></tr></thead><tbody>';
    res.top.forEach(function (t, i) {
      var un = t.uncovered.length ? t.uncovered.join('、') : '<span class="tag ok">全覆盖</span>';
      h += '<tr><td>' + (i + 1) + '</td><td>' + t.combo.join(' + ') + '</td>' +
        '<td class="num">' + t.gain + '</td>' +
        '<td class="num">' + fmtPct(t.coverage) + '</td>' +
        '<td>' + un + '</td></tr>';
    });
    h += '</tbody></table>';

    // 表三：当前方案的未覆盖清单
    var best = res.perK[M.k - 1];
    var nameOf = {};
    DATA.demand.forEach(function (d) { nameOf[d.id] = d.name + '（权重 ' + d.weight + '）'; });
    h += '<table><thead><tr><th>当前推荐方案的未覆盖需求点</th></tr></thead><tbody><tr><td>' +
      (best.uncovered.length
        ? best.uncovered.map(function (id) { return '<span class="tag no">' + nameOf[id] + '</span>'; }).join(' ')
        : '<span class="tag ok">全部需求点已被覆盖</span>') +
      '</td></tr></tbody></table>';

    $('tables').innerHTML = h;
  }

  /* ==================== 自检 ==================== */

  function runSelfTest() {
    if (!ST) { alert('自检模块未加载'); return; }
    var list = ST.run();
    var sum = ST.summary(list);

    $('stBox').classList.remove('hidden');
    $('stSum').innerHTML = '<span style="color:' + (sum.fail ? 'var(--bad)' : 'var(--ok)') + '">' +
      sum.pass + ' 项通过，' + sum.fail + ' 项失败（共 ' + sum.total + ' 项）</span>';

    $('stList').innerHTML = list.map(function (x) {
      var mark = x.ok ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--bad)">✗</span>';
      var detail = x.ok ? '' : ' <span style="color:var(--dim)">（实得 ' + x.got + '，应得 ' + x.want + '）</span>';
      return '<div><span>' + mark + '</span><span class="n">' + x.name + detail + '</span></div>';
    }).join('');
  }

  /* ==================== 启动 ==================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAuth);
  } else {
    bootAuth();
  }
})();
