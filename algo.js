/* ============================================================
 * 选址与覆盖分析：纯计算模块（不含任何界面、地图、网络依赖）
 * ------------------------------------------------------------
 * 设计原则：
 *   1. 可单独测试（node test/algo.test.js 能跑）
 *   2. 不依赖 Leaflet，换任何界面都能复用
 *   3. 所有中间量都能打印出来，方便手算核对
 * ------------------------------------------------------------
 * 坐标口径：输入为经纬度(WGS84)，内部投影为"以校园中心为原点的
 * 局部平面米制坐标"（等距圆柱近似）。校园尺度(<2km)误差可忽略，
 * 但报告里必须写明这是平面直线距离，不是步行距离。
 * ============================================================ */
(function (root) {
  'use strict';

  var M_PER_DEG_LAT = 110540; // 纬度 1 度对应的米数（近似）

  function mPerDegLon(latDeg) {
    return 111320 * Math.cos((latDeg * Math.PI) / 180);
  }

  /**
   * 生成投影函数：{lat, lon} -> {x, y}，单位米
   * meta.planar 为 true 时表示数据本身就是平面坐标（用于手算小样）
   */
  function makeProjector(meta) {
    if (meta && meta.planar) {
      return function (p) { return { x: p.lon, y: p.lat }; };
    }
    var lat0 = meta.center[0];
    var lon0 = meta.center[1];
    var kx = mPerDegLon(lat0);
    return function (p) {
      return { x: (p.lon - lon0) * kx, y: (p.lat - lat0) * M_PER_DEG_LAT };
    };
  }

  /** 权重情景：base=原始权重；flat=等权；dorm=宿舍类加权（情景假设） */
  function weightOf(d, mode) {
    if (mode === 'flat') return 1;
    if (mode === 'dorm') return (d.category || '').indexOf('宿舍') === 0 ? d.weight * 1.5 : d.weight;
    return d.weight;
  }

  /** 从 n 个里取 k 个的全部组合 */
  function combos(arr, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) {
        cur.push(arr[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    })(0, []);
    return out;
  }

  /**
   * 评估一个方案：新增 combo 这些设施后的加权覆盖率
   * 重复覆盖只计一次（按需求点取并集）
   */
  function evaluate(combo, ctx) {
    var r = ctx.r;
    var project = ctx.project;
    var demand = ctx.demand;
    var weightMode = ctx.weightMode;
    var facs = combo.concat(ctx.fixed || []).map(project);

    var covered = [], uncovered = [], gain = 0, total = 0;
    for (var i = 0; i < demand.length; i++) {
      var d = demand[i];
      var w = weightOf(d, weightMode);
      total += w;
      var p = project(d);
      var ok = false;
      for (var j = 0; j < facs.length; j++) {
        var dx = p.x - facs[j].x, dy = p.y - facs[j].y;
        if (Math.sqrt(dx * dx + dy * dy) <= r + 1e-9) { ok = true; break; }
      }
      if (ok) { covered.push(d.id); gain += w; }
      else uncovered.push(d.id);
    }
    return {
      covered: covered,
      uncovered: uncovered,
      gain: gain,
      total: total,
      coverage: total ? gain / total : 0,
      dists: null
    };
  }

  /** 距离矩阵：每个需求点到每个候选点/现有设施的米制距离，用于核对 */
  function distanceTable(data) {
    var project = makeProjector(data.meta);
    var facs = (data.existing || []).concat(data.candidate);
    var rows = [];
    for (var i = 0; i < data.demand.length; i++) {
      var d = data.demand[i], dp = project(d);
      var row = { id: d.id, name: d.name, weight: d.weight, dists: {} };
      for (var j = 0; j < facs.length; j++) {
        var f = facs[j], fp = project(f);
        var dx = dp.x - fp.x, dy = dp.y - fp.y;
        row.dists[f.id] = Math.round(Math.sqrt(dx * dx + dy * dy));
      }
      rows.push(row);
    }
    return rows;
  }

  /**
   * 求解：新增不超过 k 个设施时，各种 k 下的最优组合 + 指定 k 的前 5 名
   */
  function solve(data, opts) {
    var o = { r: 200, k: 2, weightMode: 'base' };
    if (opts) for (var key in opts) o[key] = opts[key];

    var project = makeProjector(data.meta);
    var ctx = {
      r: o.r, project: project, demand: data.demand,
      weightMode: o.weightMode, fixed: data.existing || []
    };

    var baseline = evaluate([], ctx);

    var perK = [];
    for (var kk = 1; kk <= o.k; kk++) {
      var best = null;
      var cs = combos(data.candidate, kk);
      for (var i = 0; i < cs.length; i++) {
        var res = evaluate(cs[i], ctx);
        // 修复记录（2026-11-12）：原写法 best.gain 为 undefined，
        // undefined + 1e-9 => NaN，任何比较都返回 false，
        // 导致循环只保留第一个组合（k=1 时错选 A 而非 B，k=2 恰好正确）。
        if (!best || res.gain > best.res.gain + 1e-9) {
          best = { combo: cs[i].map(function (x) { return x.id; }), res: res, n: cs.length };
        }
      }
      perK.push({ k: kk, best: best.combo, gain: best.res.gain, coverage: best.res.coverage,
                  covered: best.res.covered, uncovered: best.res.uncovered, nCombos: cs.length });
    }

    var all = combos(data.candidate, o.k).map(function (c) {
      var res = evaluate(c, ctx);
      return { combo: c.map(function (x) { return x.id; }), gain: res.gain,
               coverage: res.coverage, covered: res.covered, uncovered: res.uncovered };
    });
    all.sort(function (a, b) { return b.gain - a.gain; });

    return {
      options: o,
      baseline: baseline,
      perK: perK,
      top: all.slice(0, 5),
      nCombosAtK: all.length
    };
  }

  var api = {
    makeProjector: makeProjector,
    weightOf: weightOf,
    combos: combos,
    evaluate: evaluate,
    distanceTable: distanceTable,
    solve: solve,
    M_PER_DEG_LAT: M_PER_DEG_LAT
  };

  root.SITING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
