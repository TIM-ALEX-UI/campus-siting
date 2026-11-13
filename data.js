/* ============================================================
 * 数据层：点位表（全部为示意坐标，必须由点位组实地核查后替换）
 * ------------------------------------------------------------
 * 字段约定：
 *   id        编号（需求点 D 开头，候选点 C 开头，现有设施 E 开头）
 *   name      名称
 *   category  类别（宿舍区 / 教学楼 / 图书馆 / 食堂 / 运动场 / 广场 / 实验楼）
 *   lon/lat   经度/纬度（WGS84，示意值）
 *   weight    需求权重：>0 的数是"情景假设"，不是真实人数
 *   source    来源（示意 / OSM / 实地标注 / 官方地图目测）
 *   verified  核查状态：未核查 / 已核查
 * ============================================================ */
(function (root) {
  'use strict';

  var D = function (id, name, category, lon, lat, weight, pop) {
    return { id: id, name: name, category: category, lon: lon, lat: lat,
             weight: weight, pop: (pop || 0), source: '示意位置', verified: '未核查' };
  };
  var C = function (id, name, lon, lat) {
    return { id: id, name: name, category: '候选空地', lon: lon, lat: lat,
             weight: 0, source: '示意位置', verified: '未核查' };
  };

  root.APP_DATA = {
    /* ---------- 主数据集：校园示意 ---------- */
    main: {
      meta: {
        title: 'AI辅助校园公共服务设施选址与覆盖分析',
        campus: '校园主校区（示意范围）',
        center: [34.8155, 113.5310],
        planar: false,
        note: '所有坐标为示意值，未实地核查；权重为情景假设，不代表真实人数。',
        /* ---- 作者与版本标识：导出 JSON / 结果表 / 图片时随数据一起带出 ---- */
        author: 'Tim & Alex',
        course: '人工智能通识与数字素养 · 项目设计大作业',
        build: '2026-11-12',
        fingerprint: 'TAL-2026-7f3a'
      },
      demand: [
        D('D01', '宿舍区A', '宿舍区', 113.528266, 34.817852, 3, 3200),
        D('D02', '宿舍区B', '宿舍区', 113.529031, 34.817309, 3, 2800),
        D('D03', '宿舍区C', '宿舍区', 113.528156, 34.816585, 2, 1500),
        D('D04', '教学楼A', '教学楼', 113.531656, 34.817671, 2, 4200),
        D('D05', '教学楼B', '教学楼', 113.532531, 34.817128, 2, 3900),
        D('D06', '图书馆',   '图书馆', 113.531328, 34.816224, 3, 2600),
        D('D07', '食堂A',   '食堂',   113.533187, 34.814957, 2, 5000),
        D('D08', '食堂B',   '食堂',   113.532312, 34.813872, 2, 4600),
        D('D09', '运动场',   '运动场', 113.529469, 34.813510, 1, 900),
        D('D10', '实验楼',   '实验楼', 113.534281, 34.816585, 1, 1200),
        D('D11', '中心广场', '广场',   113.530344, 34.814957, 1, 3000),
        D('D12', '体育馆',   '体育馆', 113.533625, 34.818214, 1, 700)
      ],
      candidate: [
        C('C01', '空地-西北', 113.528813, 34.816947),
        C('C02', '空地-北',   113.530563, 34.816947),
        C('C03', '空地-中',   113.532312, 34.816043),
        C('C04', '空地-东',   113.533844, 34.815500),
        C('C05', '空地-西南', 113.529688, 34.814414),
        C('C06', '空地-南',   113.531656, 34.813329)
      ],
      existing: [
        { id: 'E01', name: '现有服务点1', category: '现有设施', lon: 113.531000, lat: 34.815500,
          weight: 0, source: '示意位置', verified: '未核查' },
        { id: 'E02', name: '现有服务点2', category: '现有设施', lon: 113.532969, lat: 34.815138,
          weight: 0, source: '示意位置', verified: '未核查' }
      ]
    },

    /* ---------- 自检数据集：手算小样（纯平面坐标，单位任意） ---------- */
    selftest: {
      meta: {
        title: '手算核对小样（框架 §8 构造例）',
        campus: '构造平面坐标，不是真实校园',
        center: [0, 0],
        planar: true,
        note: 'D1(0,0)w2  D2(100,0)w1  D3(1000,0)w3  D4(1100,0)w1；A(50) B(1050) C(500)；r=100'
      },
      demand: [
        { id: 'D1', name: 'D1', category: '构造', lon: 0,    lat: 0, weight: 2, source: '构造', verified: '已核查' },
        { id: 'D2', name: 'D2', category: '构造', lon: 100,  lat: 0, weight: 1, source: '构造', verified: '已核查' },
        { id: 'D3', name: 'D3', category: '构造', lon: 1000, lat: 0, weight: 3, source: '构造', verified: '已核查' },
        { id: 'D4', name: 'D4', category: '构造', lon: 1100, lat: 0, weight: 1, source: '构造', verified: '已核查' }
      ],
      candidate: [
        { id: 'A', name: 'A', category: '构造', lon: 50,   lat: 0, weight: 0, source: '构造', verified: '已核查' },
        { id: 'B', name: 'B', category: '构造', lon: 1050, lat: 0, weight: 0, source: '构造', verified: '已核查' },
        { id: 'C', name: 'C', category: '构造', lon: 500,  lat: 0, weight: 0, source: '构造', verified: '已核查' }
      ],
      existing: []
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
