/* ============================================================
 * 自检模块：独立的验证逻辑（不含任何界面代码）
 * 用途：把"算对了吗"这件事变成可点的一个按钮
 * 作者：Tim & Alex / 2026-11-12
 * ============================================================ */
(function (root) {
  'use strict';

  function run() {
    var S = root.SITING;
    var A = root.APP_DATA;
    var out = [];

    function chk(name, fn) {
      try {
        var r = fn() || {};
        out.push({ name: name, ok: !!r.ok, got: r.got, want: r.want });
      } catch (e) {
        out.push({ name: name, ok: false, got: '异常：' + e.message, want: '—' });
      }
    }

    if (!S || !A) {
      out.push({ name: '模块加载', ok: false, got: 'SITING 或 APP_DATA 未加载', want: '已加载' });
      return out;
    }

    var st = A.selftest;
    var main = A.main;
    var r1 = S.solve(st, { r: 100, k: 2, weightMode: 'base' });
    var ctx = {
      r: 100, project: S.makeProjector(st.meta),
      demand: st.demand, weightMode: 'base', fixed: []
    };

    /* ---- 一组：手算小样（与框架构造例逐项对照） ---- */
    chk('小样·不新增任何设施，覆盖权重为 0', function () {
      return { ok: r1.baseline.gain === 0, got: r1.baseline.gain, want: 0 };
    });
    chk('小样·新增 1 点应选 B 而不是 A', function () {
      return { ok: r1.perK[0].best.join('') === 'B', got: r1.perK[0].best.join(''), want: 'B' };
    });
    chk('小样·新增 1 点覆盖率 4/7', function () {
      return { ok: r1.perK[0].gain === 4, got: r1.perK[0].gain, want: 4 };
    });
    chk('小样·新增 2 点应选 A+B', function () {
      return { ok: r1.perK[1].best.slice().sort().join('') === 'AB', got: r1.perK[1].best.join('+'), want: 'A+B' };
    });
    chk('小样·新增 2 点覆盖率 7/7', function () {
      return { ok: r1.perK[1].gain === 7, got: r1.perK[1].gain, want: 7 };
    });
    chk('小样·A+B 覆盖全部 4 个需求点', function () {
      return { ok: r1.perK[1].covered.length === 4, got: r1.perK[1].covered.length, want: 4 };
    });
    chk('小样·3 个候选选 2 个共 3 种组合', function () {
      return { ok: r1.nCombosAtK === 3, got: r1.nCombosAtK, want: 3 };
    });
    chk('小样·方案 A 单独覆盖 3/7', function () {
      var g = S.evaluate([st.candidate[0]], ctx).gain;
      return { ok: g === 3, got: g, want: 3 };
    });
    chk('小样·方案 B 单独覆盖 4/7', function () {
      var g = S.evaluate([st.candidate[1]], ctx).gain;
      return { ok: g === 4, got: g, want: 4 };
    });
    chk('小样·方案 C 单独覆盖 0/7', function () {
      var g = S.evaluate([st.candidate[2]], ctx).gain;
      return { ok: g === 0, got: g, want: 0 };
    });

    /* ---- 二组：主数据集的性质检查 ---- */
    chk('性质·半径 50→500 递增时，2 点最优覆盖率不下降', function () {
      var prev = -1, bad = null;
      for (var r = 50; r <= 500; r += 50) {
        var c = S.solve(main, { r: r, k: 2, weightMode: 'base' }).perK[1].coverage;
        if (c < prev - 1e-9) bad = r + ' 米时降到 ' + c.toFixed(3);
        prev = c;
      }
      return { ok: !bad, got: bad || '全程单调', want: '无下降' };
    });

    var s2 = S.solve(main, { r: 300, k: 2, weightMode: 'base' });
    chk('性质·覆盖清单里没有重复的需求点', function () {
      var uniq = {};
      s2.perK[1].covered.forEach(function (id) { uniq[id] = 1; });
      var n = Object.keys(uniq).length;
      return { ok: n === s2.perK[1].covered.length, got: n + ' 个唯一 / ' + s2.perK[1].covered.length + ' 条', want: '相等' };
    });
    chk('性质·覆盖率恒在 0 与 1 之间', function () {
      var c = s2.perK[1].coverage;
      return { ok: c >= 0 && c <= 1, got: c.toFixed(4), want: '0 ~ 1' };
    });
    chk('边界·半径极小时不会算出负的覆盖权重', function () {
      var g = S.solve(main, { r: 1, k: 1, weightMode: 'base' }).perK[0].gain;
      return { ok: g >= 0, got: g, want: '≥ 0' };
    });
    chk('边界·覆盖数 + 未覆盖数 = 需求点总数', function () {
      var s = s2.perK[1];
      var sum = s.covered.length + s.uncovered.length;
      return { ok: sum === main.demand.length, got: sum, want: main.demand.length };
    });
    chk('枚举·6 个候选选 2 个 = 15 种组合', function () {
      var n = S.combos(main.candidate, 2).length;
      return { ok: n === 15, got: n, want: 15 };
    });
    chk('枚举·6 个候选选 3 个 = 20 种组合', function () {
      var n = S.combos(main.candidate, 3).length;
      return { ok: n === 20, got: n, want: 20 };
    });

    return out;
  }

  function summary(list) {
    var p = 0, f = 0;
    list.forEach(function (x) { x.ok ? p++ : f++; });
    return { pass: p, fail: f, total: list.length };
  }

  root.SELFTEST = { run: run, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SELFTEST;
})(typeof window !== 'undefined' ? window : globalThis);
