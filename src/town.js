// ミニチュアの町 (Canvas)。状態を読むだけで、ゲームの進行には影響しない。
// 街ごとに別のマップ(レイアウト・地面の配色・建物の絵)を持つ。町の中心の大通りの奥に「役所」があり、雇った役人が並ぶ。
// 未解放=森 → 解放済み=荒れ地(建設予定地) → 建物が増えるほど開拓され、柵で囲われ、田んぼには水路が延び、水車小屋の下には川が延びる。
// 絵は art.js / sprites.js / landmarks.js(輪郭・陰影・瓦の質感のあるジオラマ調)。夜は窓や炉が光る(昼夜はビューの切り替えボタンでオフにできる)。
'use strict';
(function () {
  const cv = document.getElementById('town'); if (!cv) return;
  const main = cv.getContext('2d', { alpha: false }); let g = main; ART.use(g);
  const use = c => { g = c; ART.use(c); };   // 描画先を切り替える(レイヤー用)
  const CELL = 32, H = 15, ROAD_Y = 7;
  const MAX_HOUSES = 60;
  const WASTE = '#a58f6c';
  const { S, M: MIX } = ART;

  // ---------- 街ごとのマップ ----------
  // roads: 縦の大通り {x:左端のマス, w:幅(マス)}。最初の1本は「役所の大通り」(幅3マス。奥に役所、手前に広場と噴水)
  // post: 交易所を置く大通りの番号(省略=東の端) / lantern: 石灯籠を置く大通りの番号
  // style: 地面・道・家の配色。zones: 建物のid か decor(forest / sea / castle)。w,h=大きさ(省略=6マス)。grow=開拓後の地面色
  const Z = (x, y, grow, tuft, extra) => Object.assign({ x, y, grow, tuft }, extra);
  const SEA = { base: '#8fc4de', speck: '#7fb5d6' };
  const MAPS = {
    home: { W: 47, roads: [{ x: 12, w: 3 }, { x: 27, w: 1 }, { x: 40, w: 1 }], post: 1, lantern: 2,
      style: { g1: '#5c8c4e', g2: '#6a9a58', road: '#cdbb92', edge: '#e3d6b4', plaza: ['#c9b684', '#dccfa8'], tree: 'broad', flowers: ['#f6b6d0', '#fff3b0', '#ffffff'], walls: ['#f2e6d0', '#e8d8bc', '#e0e6d0', '#f0e4b8', '#d8e0e8'], roofs: ['#7a5a50', '#8a4a40', '#4a5a78', '#6a5a7a'] },
      zones: { grove: Z(0, 0, '#4a8545', 'grass'), sawmill: Z(6, 0, '#b79e6e', 'chip'), claypit: Z(15, 0, '#c08a58', 'chunk'), kiln: Z(21, 0, '#a49c96', 'soot'),
        paddy: Z(0, 9, '#7fb356', 'grass'), mill: Z(6, 9, '#6aa66a', 'grass'), mochiya: Z(15, 9, '#c9b9a0', 'stone'), brewery: Z(21, 9, '#a79bc0', 'stone'),
        tea: Z(28, 0, '#5d9a4b', 'grass'), pond: Z(34, 0, '#6aa85f', 'grass'), teahouse: Z(28, 9, '#d6c2a8', 'stone'), kitchen: Z(34, 9, '#cdb39e', 'stone'),
        pickle: Z(41, 0, '#cfc2a2', 'stone', { w: 3 }), smithy: Z(44, 0, '#a8a29d', 'soot', { w: 3 }), weaver: Z(41, 9, '#d6c0cc', 'stone', { w: 3 }), yard_home: Z(44, 9, '#b79e6e', 'chip', { w: 3 }) } },
    shiomi: { W: 21, roads: [{ x: 12, w: 3 }],
      style: { g1: '#d2c598', g2: '#c8bb8c', road: '#e6dbbb', edge: '#f4ecd2', plaza: ['#d8c9a0', '#e8dcc0'], tree: 'broad', flowers: ['#ffffff', '#cfe8f4'], walls: ['#f4efe0', '#e0e8ee', '#d9e3c1', '#f0e0a8'], roofs: ['#4f78a0', '#3f6a8a', '#8a4a40', '#e0e6ee'] },
      zones: { boat: Z(0, 0, '#5aa6d4', 'wave', SEA), saltern: Z(6, 0, '#f3ecd0', 'chip', { base: '#e3d7ae', speck: '#d0c496' }), kelpbed: Z(15, 0, '#4f9ac8', 'wave', SEA),
        dryhouse: Z(0, 9, '#e8d7ae', 'chip', { base: '#d8c89c', speck: '#c4b488' }), dashiya: Z(6, 9, '#d9c9a8', 'stone', { base: '#cdbd9a' }), yard_shiomi: Z(15, 9, '#e8d7ae', 'chip', { base: '#d8c89c', speck: '#c4b488' }) } },
    kirigamine: { W: 24, roads: [{ x: 12, w: 3 }],
      style: { g1: '#6c7a5e', g2: '#78876a', road: '#a99d85', edge: '#c4b9a0', plaza: ['#9c9078', '#b5a98f'], tree: 'pine', flowers: ['#e8d0f0', '#fff3b0'], walls: ['#cdb48a', '#b89a70', '#d9c9a8'], roofs: ['#6b4a35', '#7a5a3c', '#4a4f5a', '#8a3a30'] },
      zones: { lumber: Z(0, 0, '#4d7a42', 'grass'), mine: Z(6, 0, '#8f949b', 'chunk', { base: '#9a9890' }), charcoalkiln: Z(15, 0, '#6a6560', 'soot'),
        smelter: Z(0, 9, '#8a847e', 'soot'), herbs: Z(6, 9, '#6fa660', 'grass'), onsen: Z(15, 9, '#b0c4c8', 'stone'),
        yard_kirigamine: Z(21, 0, '#b79e6e', 'chip', { w: 3 }), decor_a: Z(21, 9, '#4a8545', 'grass', { w: 3, decor: 'forest' }) } },
    itokawa: { W: 21, roads: [{ x: 12, w: 3 }],
      style: { g1: '#68a072', g2: '#74ae7e', road: '#d9cfb5', edge: '#ece4cf', plaza: ['#cdc2a4', '#e0d6bc'], tree: 'broad', flowers: ['#d9b6f0', '#fff3b0', '#ffffff'], walls: ['#efe6f2', '#e4d9ee', '#f4efe0'], roofs: ['#7a5aa0', '#a05a8a', '#4f78a0', '#6a5a90'] },
      zones: { mulberry: Z(0, 0, '#6aa84f', 'grass'), silkery: Z(6, 0, '#e0d8e8', 'stone'), reeling: Z(15, 0, '#7fb3b0', 'grass'),
        indigofield: Z(0, 9, '#6a5fa0', 'grass'), dyeworks: Z(6, 9, '#cfb8d8', 'stone'), yard_itokawa: Z(15, 9, '#d6cfa8', 'chip', { base: '#cfc59a', speck: '#b8ac80' }) } },
    daito: { W: 21, roads: [{ x: 12, w: 3 }],
      style: { g1: '#8d8f95', g2: '#999ba1', road: '#c9b79a', edge: '#e0d1b6', plaza: ['#b8a888', '#d4c4a4'], tree: 'broad', flowers: ['#ffe9a6', '#ffffff'], walls: ['#f0e6d0', '#e8dcc0', '#f4efe0'], roofs: ['#8a3a30', '#c89a3a', '#6a2a2a', '#4a4f5a'] },
      zones: { goldmine: Z(0, 0, '#c9b873', 'chunk', { base: '#a89a6a' }), goldbeater: Z(6, 0, '#a89a7a', 'soot'), gilder: Z(15, 0, '#e6d6a0', 'stone'),
        yard_daito: Z(0, 9, '#b79e6e', 'chip'), decor_b: Z(6, 9, '#b8a888', 'stone', { decor: 'castle' }), decor_c: Z(15, 9, '#4a8545', 'grass', { decor: 'forest' }) } },
  };
  const CARGO = { rice: '#f4efd0', flour: '#ffffff', mochi: '#ffd6e4', bamboo: '#6fc16a', plank: '#d8b27a', clay: '#d0894f', tile: '#c05a48', sake: '#e8e0ff', tea: '#7fb069', fish: '#7aa6d8', sweets: '#e8a0b8', bento: '#e0b36a', pickle: '#9ec06a', tools: '#8a8f98', cloth: '#c06a9a',
    seafish: '#6fa8d8', salt: '#f4f4f4', kelp: '#3f7d4a', dried: '#d9a066', dashi: '#e0b070', wood: '#a9774a', ore: '#8a8f98', charcoal: '#3a3a3f', iron: '#7d838a', herb: '#7fc47a', tonic: '#9fe0e8', leaf: '#5fae4a', cocoon: '#f0ece0', silk: '#f0e0f0', indigo: '#4a5fb0', dye: '#7a5ac0', goldore: '#d9b84a', goldleaf: '#e6c34a', gilded: '#ffd54f' };

  const visibleCount = (n, cap) => n <= 8 ? Math.min(n, cap) : Math.min(cap, 8 + Math.floor(Math.log2(n / 8) * 2.5));
  const dev = n => n <= 0 ? 0 : Math.min(1, Math.log(1 + n) / Math.log(41));   // 開拓度 0..1
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const pathLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  function pathAt(pts, s) {
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dy);
      if (s <= L || i === pts.length - 1) { const u = Math.min(1, s / (L || 1)); return { x: pts[i - 1][0] + dx * u, y: pts[i - 1][1] + dy * u, dx, dy }; }
      s -= L;
    }
  }
  const smooth = x => x * x * (3 - 2 * x);

  // ---------- 地面の下絵(街ごとに一度だけ描く): 芝の質感・花・石畳の道・広場 ----------
  function buildBg(M, tid) {
    const W = M.W * CELL, HH = H * CELL, c = document.createElement('canvas'); c.width = W; c.height = HH;
    const x = c.getContext('2d'), r = rng(tid.length * 313 + 7), st = M.style;
    x.fillStyle = st.g1; x.fillRect(0, 0, W, HH);
    for (let i = 0; i < W * HH / 1500; i++) { x.globalAlpha = 0.3; x.fillStyle = MIX(st.g1, st.g2, r()); x.beginPath(); x.arc(r() * W, r() * HH, 12 + r() * 40, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    for (let i = 0; i < W * HH / 220; i++) { const gx = r() * W, gy = r() * HH, a = r() < 0.5 ? S(st.g2, 1.18) : S(st.g1, 0.82); x.strokeStyle = a; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 1, gy - 3); x.moveTo(gx + 2, gy); x.lineTo(gx + 3, gy - 3.4); x.stroke(); }
    for (let i = 0; i < W * HH / 5000; i++) { const f = st.flowers[(r() * st.flowers.length) | 0], fx = r() * W, fy = r() * HH; x.fillStyle = f; x.beginPath(); x.arc(fx, fy, 1.3, 0, 7); x.fill(); x.fillStyle = 'rgba(255,220,100,.9)'; x.beginPath(); x.arc(fx, fy, 0.5, 0, 7); x.fill(); }
    // 道: 石畳 + 縁石
    const roadRects = [{ x: 0, y: ROAD_Y * CELL, w: W, h: CELL }]; for (const rd of M.roads) roadRects.push({ x: rd.x * CELL, y: 0, w: rd.w * CELL, h: HH });
    for (const rc of roadRects) {
      x.fillStyle = st.road; x.fillRect(rc.x, rc.y, rc.w, rc.h);
      for (let yy = rc.y + 1; yy < rc.y + rc.h - 1; yy += 5) for (let xx = rc.x + ((yy / 5 | 0) % 2) * 3; xx < rc.x + rc.w - 1; xx += 6) { x.fillStyle = r() < 0.5 ? S(st.road, 0.93 + r() * 0.05) : S(st.road, 1.04 + r() * 0.05); x.beginPath(); x.roundRect(xx + 0.5, yy + 0.5, 5, 4, 1.4); x.fill(); }
      x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 0.6; for (let yy = rc.y + 5; yy < rc.y + rc.h; yy += 5) { x.beginPath(); x.moveTo(rc.x, yy); x.lineTo(rc.x + rc.w, yy); x.stroke(); }
    }
    for (const rc of roadRects) { x.fillStyle = st.edge; if (rc.w > rc.h) { x.fillRect(rc.x, rc.y, rc.w, 3); x.fillRect(rc.x, rc.y + rc.h - 3, rc.w, 3); x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(rc.x, rc.y + 3, rc.w, 1.2); x.fillRect(rc.x, rc.y + rc.h - 4.2, rc.w, 1.2); } else { x.fillRect(rc.x, rc.y, 3, rc.h); x.fillRect(rc.x + rc.w - 3, rc.y, 3, rc.h); x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(rc.x + 3, rc.y, 1.2, rc.h); x.fillRect(rc.x + rc.w - 4.2, rc.y, 1.2, rc.h); } }
    // 広場(交差点)の舗装
    for (const rd of M.roads) {
      const cx = (rd.x + rd.w / 2) * CELL, cy = ROAD_Y * CELL + CELL / 2, R = rd.w > 1 ? 54 : 30;
      x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.ellipse(cx + 1, cy + 3, R + 1, R * 0.92, 0, 0, 7); x.fill();
      x.fillStyle = st.plaza[0]; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.fillStyle = st.plaza[1]; x.beginPath(); x.arc(cx, cy, R - 5, 0, 7); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 0.8; for (let a = 0; a < 6.283; a += 0.2) { x.beginPath(); x.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); x.lineTo(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5)); x.stroke(); }
      for (let rr = 14; rr < R - 5; rr += 8) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.stroke(); }
    }
    return c;
  }
  // 役所の大通りの奥(北側)は、白砂利の参道と植え込み
  function buildAvenueNorth(c, M, st) {
    const x = c.getContext('2d'), rd = M.roads[0], X = rd.x * CELL, Wd = rd.w * CELL, r = rng(91);
    const gr = x.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, S(st.plaza[1], 1.02)); gr.addColorStop(1, S(st.plaza[0], 0.98)); x.fillStyle = gr; x.fillRect(X + 3, 0, Wd - 6, 200);
    for (let i = 0; i < 340; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.08)'; x.beginPath(); x.arc(X + 6 + r() * (Wd - 12), r() * 196, 0.9 + r() * 0.8, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(X + 6, 12 + i * 13); x.bezierCurveTo(X + Wd * 0.3, 8 + i * 13, X + Wd * 0.7, 16 + i * 13, X + Wd - 6, 12 + i * 13); x.stroke(); }   // 砂紋
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(X + 3, 0, 1.4, 200); x.fillRect(X + Wd - 4.4, 0, 1.4, 200);
  }

  // ---------- マップの生成(街ごとに1つ。状態もマップごとに持つ) ----------
  function makeMap(tid) {
    const M = MAPS[tid], W = M.W, ROADS = M.roads, st = M.style, ZONES = M.zones, th = TOWNS[tid].theme;
    const AVE = ROADS[0], AVE_CX = (AVE.x + AVE.w / 2) * CELL, ROAD_CY = ROAD_Y * CELL + CELL / 2;
    const zw = id => ZONES[id].w || 6, zh = id => ZONES[id].h || 6;
    const ids = Object.keys(ZONES).filter(id => BUILDINGS[id] && BUILDINGS[id].town === tid);
    const maxVis = id => zw(id) === 3 ? 8 : 16;
    const feat = {}, slots = {}, trees = {};
    const bg = buildBg(M, tid); buildAvenueNorth(bg, M, st);

    // 静的な地形の特徴(固定シード)・建物スロット
    for (const id in ZONES) {
      const z = ZONES[id], r = rng(id.length * 977 + z.x * 31 + z.y * 17 + tid.length * 7), X = z.x * CELL, Y = z.y * CELL;
      const SW = zw(id) * CELL - 8, SH = zh(id) * CELL - 8, cx = X + 4 + SW / 2, cy = Y + 4 + SH / 2, R0 = Math.hypot(SW, SH) / 2, k = Math.max(0.3, SW * SH / (184 * 184));
      const pt = () => { const x = X + 10 + r() * (SW - 12), y = Y + 10 + r() * (SH - 12); return { x, y, d: Math.hypot(x - cx, y - cy) / R0 }; };
      const f = { specks: [], rocks: [], bushes: [], tufts: [] };
      for (let i = 0; i < Math.round(70 * k); i++) f.specks.push(pt());
      for (let i = 0; i < Math.max(5, Math.round(12 * k)); i++) { const p = pt(); p.thr = 0.3 + r() * 0.75; p.s = 3 + r() * 5; f.rocks.push(p); }
      for (let i = 0; i < Math.max(3, Math.round(7 * k)); i++) { const p = pt(); p.thr = 0.3 + r() * 0.6; f.bushes.push(p); }
      for (let i = 0; i < Math.round(70 * k); i++) { const p = pt(); p.thr = Math.min(0.95, p.d * 0.85 + r() * 0.15); f.tufts.push(p); }
      feat[id] = f;
      trees[id] = []; for (let n = 0; n < Math.max(5, Math.round((z.decor === 'forest' ? 24 : 12) * k)); n++) { const p = pt(); trees[id].push({ x: p.x, y: p.y, sd: r() * 6 }); }
      if (!BUILDINGS[id]) continue;
      const list = [], cols = zw(id) === 6 ? 4 : 2;
      for (let j = 0; j < 4; j++) for (let i = 0; i < cols; i++) {
        const jit = (((i * 7 + j * 13 + id.length) % 5) - 2) * 0.7;
        if (id === 'paddy') list.push({ i, j, px: X + 52 + i * 40, py: Y + 38 + j * 40, d: j * 10 + i });
        else if (cols === 4) list.push({ i, j, px: X + 4 + 0.6 * CELL + i * 1.4 * CELL + 14 + jit, py: Y + 4 + 0.45 * CELL + j * 1.25 * CELL + 16 + jit * 0.6, d: Math.hypot(i - 1.5, j - 1.5) + ((i * 7 + j * 3) % 5) * 0.01 });
        else list.push({ i, j, px: X + 4 + SW * (i + 0.5) / cols, py: Y + 4 + SH * (j + 0.5) / 4 + 2, d: Math.hypot(i - 0.5, j - 1.5) + ((i * 7 + j * 3) % 5) * 0.01 });
      }
      slots[id] = list.sort((a, b) => a.d - b.d);
    }

    // 出入口の列(家を置かない)・家のスロット
    const gateCell = id => ZONES[id].x + (zw(id) === 6 ? 2 : 1);
    const GATE_CELLS = [...new Set(Object.keys(ZONES).map(gateCell))];
    const nearRoad = px => ROADS.some(rd => Math.abs(px - (rd.x + rd.w / 2) * CELL) < (rd.w > 1 ? rd.w * CELL / 2 + 46 : 58));
    const houseSlots = [];
    for (let x = 0; x < W; x++) {
      const px = x * CELL + CELL / 2; if (nearRoad(px) || GATE_CELLS.includes(x)) continue;
      for (const y of [ROAD_Y - 1, ROAD_Y + 1]) houseSlots.push({ px, py: y * CELL + CELL / 2 + (y < ROAD_Y ? 4 : 0), d: Math.abs(px - AVE_CX) / CELL + (y > ROAD_Y ? 0.3 : 0), up: y < ROAD_Y });
    }
    houseSlots.sort((a, b) => a.d - b.d);

    // 物流: 町の中の材料、余剰(→広場)、輸入品(交易所→使う建物)、輸出品(作る建物→交易所)
    const LANE_R = ROAD_Y * CELL + 9, LANE_L = ROAD_Y * CELL + 23, PLAZA_X = AVE_CX;
    const POST_X = M.post != null ? (ROADS[M.post].x + ROADS[M.post].w / 2) * CELL : (W - 1) * CELL;
    const NODE = {}; for (const id of Object.keys(ZONES)) { const z = ZONES[id]; NODE[id] = { x: gateCell(id) * CELL + CELL / 2, e: z.y === 0 ? (z.y + zh(id)) * CELL - 6 : z.y * CELL + 6 }; }
    function pathBetween(a, b) { const lane = b.x >= a.x ? LANE_R : LANE_L, pts = []; if (a.e != null) pts.push([a.x, a.e]); pts.push([a.x, lane], [b.x, lane]); if (b.e != null) pts.push([b.x, b.e]); return pts; }
    const SPEED = 60, DW = 70, PLAZA_STOP = 66, POST_STOP = 40;
    const nodeX = id => id === 'plaza' ? PLAZA_X : id === 'post' ? POST_X : NODE[id].x;
    const endNode = (id, otherX) => id === 'plaza' ? { x: PLAZA_X + (otherX < PLAZA_X ? -PLAZA_STOP : PLAZA_STOP), e: null } : id === 'post' ? { x: POST_X + (otherX < POST_X ? -POST_STOP : POST_STOP), e: null } : NODE[id];
    const ROUTES = [];
    function addRoute(from, to, item, kind) {
      const A = endNode(from, nodeX(to)), B = endNode(to, nodeX(from));
      const out = pathBetween(A, B), back = pathBetween(B, A), end = out[out.length - 1];
      if (Math.hypot(back[0][0] - end[0], back[0][1] - end[1]) > 0.5) back.unshift(end);
      const lo = pathLen(out), lb = pathLen(back);
      ROUTES.push({ from, to, item, kind, out, back, lo, lb, face: B.x >= A.x ? 1 : -1, cycle: lo + lb + 2 * DW });
    }
    const producerOf = {}; for (const id of ids) for (const it in BUILDINGS[id].recipe.out) producerOf[it] = id;
    for (const id of ids) for (const it in BUILDINGS[id].recipe.in) { if (producerOf[it]) addRoute(producerOf[it], id, it, 'prod'); else addRoute('post', id, it, 'import'); }
    for (const it in producerOf) addRoute(producerOf[it], 'plaza', it, 'prod');
    for (const it in producerOf) addRoute(producerOf[it], 'post', it, 'export');

    // 噴水・交易所・石灯籠の外側へ押し出す(歩く人や荷車がこれらを貫通しないように)
    const OBST = ROADS.map((rd, i) => ({ x: (rd.x + rd.w / 2) * CELL, y: ROAD_CY, cart: i === 0 ? 34 : (i === M.lantern ? 17 : 28), walk: i === 0 ? 36 : (i === M.lantern ? 19 : 30) }));
    function avoidY(x, y, kind) { for (const o of OBST) { const R = o[kind], dx = x - o.x; if (Math.abs(dx) >= R) continue; const off = Math.sqrt(R * R - dx * dx); y = y < o.y ? Math.min(y, o.y - off) : Math.max(y, o.y + off); } return y; }
    function avoidX(x, y, kind) { for (const o of OBST) { const R = o[kind], dy = y - o.y; if (Math.abs(dy) >= R) continue; const off = Math.sqrt(R * R - dy * dy); x = x < o.x ? Math.min(x, o.x - off) : Math.max(x, o.x + off); } return x; }

    const born = {}, shownPrev = {}, carts = {}, fences = {}; let prevNow = 0, first = true, lastPop = -1e9;
    function track(group, shown, now) { if (shownPrev[group] === undefined) shownPrev[group] = first ? shown : 0; for (let k = shownPrev[group]; k < shown; k++) { born[group + k] = now; if (!first) lastPop = now; } shownPrev[group] = shown; }
    const pop = (key, now) => { const a = (now - (born[key] || 0)) / 1000; return a < 0.45 ? Math.sin(a / 0.45 * Math.PI / 2) * 1.12 : 1; };

    // 木の柵(ゾーンごとに一度だけ描いて使い回す)
    function fenceOf(id) {
      if (fences[id]) return fences[id];
      const z = ZONES[id], SW = zw(id) * CELL - 8, SH = zh(id) * CELL - 8, c = document.createElement('canvas'); c.width = SW + 8; c.height = SH + 8; const x = c.getContext('2d');
      const post = (px, py) => { x.fillStyle = '#6a4a2a'; x.fillRect(px - 1.4, py - 5, 2.8, 6); x.fillStyle = '#a8845a'; x.fillRect(px - 1.4, py - 5, 1, 6); x.fillStyle = '#c4a070'; x.fillRect(px - 1.4, py - 5.6, 2.8, 1.2); };
      const ix = 8, iy = 8, iw = SW - 8, ih = SH - 8;
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(ix, iy + 1); x.lineTo(ix + iw, iy + 1); x.moveTo(ix, iy + ih + 1); x.lineTo(ix + iw, iy + ih + 1); x.stroke();
      x.strokeStyle = '#8a6a44'; x.lineWidth = 1.6; x.beginPath(); x.rect(ix, iy - 2, iw, ih); x.moveTo(ix, iy + ih - 3); x.stroke(); x.strokeStyle = '#a8845a'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(ix, iy - 2.6); x.lineTo(ix + iw, iy - 2.6); x.stroke();
      for (let px = ix; px <= ix + iw; px += 14) { post(px, iy); post(px, iy + ih); } for (let py = iy; py <= iy + ih; py += 14) { post(ix, py); post(ix + iw, py); }
      return (fences[id] = c);
    }

    // 1エリアの地面
    function drawZoneGround(id, T, t) {
      const z = ZONES[id], f = feat[id], isB = !!BUILDINGS[id], open = !isB || isUnlocked(id, T), b = isB ? T.b[id] : null, dv = isB ? dev(b.count) : 1;
      const X = z.x * CELL + 4, Y = z.y * CELL + 4, SW = zw(id) * CELL - 8, SH = zh(id) * CELL - 8, cx = X + SW / 2, cy = Y + SH / 2, R0 = Math.hypot(SW, SH) / 2;
      g.save(); g.beginPath(); g.roundRect(X, Y, SW, SH, 14); g.clip();
      if (z.decor === 'sea') {
        g.fillStyle = ART.vg(Y, Y + SH, '#7cc4e6', '#3f8fc0'); g.fillRect(X, Y, SW, SH);
        for (let i = 0; i < 10; i++) { const wx = X + 12 + ((i * 37 + t * 14) % (SW - 24)), wy = Y + 14 + (i * 23) % (SH - 28); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.4; g.beginPath(); g.arc(wx, wy, 5, 0.2, 2.9); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 6; g.beginPath(); g.roundRect(X, Y, SW, SH, 14); g.stroke(); g.restore(); return;
      }
      if (!open) { g.fillStyle = '#3a6a34'; g.fillRect(X, Y, SW, SH); f.specks.forEach(p => { g.fillStyle = '#2f5a2c'; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); }); }
      else if (z.decor) { g.fillStyle = z.grow; g.fillRect(X, Y, SW, SH); f.specks.forEach(p => { g.fillStyle = S(z.grow, 0.86); g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 7); g.fill(); }); }
      else {
        g.fillStyle = z.base || WASTE; g.fillRect(X, Y, SW, SH); f.specks.forEach(p => { g.fillStyle = z.speck || '#8d7854'; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 7); g.fill(); });
        if (dv > 0) { const R = 18 + dv * (R0 - 2), gr = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R); gr.addColorStop(0, z.grow); gr.addColorStop(0.8, z.grow); gr.addColorStop(1, z.grow + '00'); g.fillStyle = gr; g.fillRect(X, Y, SW, SH); }
        if (!z.base) {
          f.rocks.forEach(p => { if (dv < p.thr) ART.rock(p.x, p.y + 2, p.s * 0.8, '#938a80'); });
          f.bushes.forEach(p => { if (dv < p.thr) { for (let k = -1; k <= 1; k++) ART.line(p.x, p.y + 3, p.x + k * 4, p.y - 4 - Math.abs(k), '#6a4a2a', 1.3); } });
        }
        f.tufts.forEach(p => {
          if (dv <= p.thr) return;
          if (z.tuft === 'grass') { const sw = Math.sin(t * 1.5 + p.x) * 1; for (let k = -1; k <= 1; k++) ART.line(p.x + k * 2, p.y + 2, p.x + k * 2.6 + sw, p.y - 3, '#4a9640', 1.1); }
          else if (z.tuft === 'stone') { g.fillStyle = 'rgba(120,110,100,.3)'; g.fillRect(p.x, p.y, 5, 3); }
          else if (z.tuft === 'wave') { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, 4 + Math.sin(t + p.x) * 1, 0.3, 2.8); g.stroke(); }
          else { g.fillStyle = z.tuft === 'soot' ? '#7d7773' : z.tuft === 'chip' ? '#e7d3a2' : '#a8683a'; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 7); g.fill(); }
        });
        if (id === 'paddy' && b.count > 0) {                                               // 田んぼに水路が延びる
          const sl = slots.paddy.slice(0, visibleCount(b.count, maxVis(id))), tx = z.x * CELL + 18, rows = {}; sl.forEach(s => { rows[s.j] = Math.max(rows[s.j] || 0, s.px + 19); });
          const lastJ = Math.max(...sl.map(s => s.j));
          ART.ell(tx, Y + 12, 15, 9, '#4fa8d8', '#8a6a45'); vchannel(tx, Y + 12, Y + 38 + lastJ * 40 - 19 + 3, t); for (const j in rows) channel(tx, Y + 38 + (+j) * 40 - 19, rows[j], t);
        }
        if (id === 'mill' && b.count > 0) {                                                // 水車小屋の下に川が延びる
          const sl = slots.mill.slice(0, visibleCount(b.count, maxVis(id))), rows = {}; sl.forEach(s => { rows[s.j] = Math.max(rows[s.j] || 0, s.px + 4); });
          for (const j in rows) channel(X, Y + 4 + 0.45 * CELL + (+j) * 1.25 * CELL + 16 + 15, rows[j], t);
        }
      }
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 6; g.beginPath(); g.roundRect(X, Y, SW, SH, 14); g.stroke();      // 縁の内側の影
      g.restore();
      if (isB && open && dv > 0.15) { g.globalAlpha = Math.min(1, dv * 2.4); g.drawImage(fenceOf(id), X - 4, Y - 4); g.globalAlpha = 1; }
      if (isB && open && b.count === 0) for (const [sx, sy] of [[X + 22, Y + 22], [X + SW - 22, Y + 22], [X + 22, Y + SH - 30], [X + SW - 22, Y + SH - 30]]) { ART.line(sx, sy, sx, sy + 14, '#6a4a2a', 2); ART.face([[sx, sy], [sx + 9, sy + 3], [sx, sy + 6]], '#d9534f', ART.OL, 0.7); }
    }
    function channel(x1, y, x2, t) {
      if (x2 <= x1) return; g.fillStyle = '#7a5a38'; g.fillRect(x1, y - 2.4, x2 - x1, 5.2); g.fillStyle = ART.vg(y - 1.6, y + 1.6, '#6fc2ee', '#3f8fc0'); g.fillRect(x1, y - 1.5, x2 - x1, 3);
      g.strokeStyle = 'rgba(220,245,255,.9)'; g.lineWidth = 1; g.setLineDash([4, 7]); g.lineDashOffset = -t * 22; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke(); g.setLineDash([]);
    }
    function vchannel(x, y1, y2, t) {
      if (y2 <= y1) return; g.fillStyle = '#7a5a38'; g.fillRect(x - 2.4, y1, 5.2, y2 - y1); g.fillStyle = '#4fa8d8'; g.fillRect(x - 1.5, y1, 3, y2 - y1);
      g.strokeStyle = 'rgba(220,245,255,.9)'; g.lineWidth = 1; g.setLineDash([4, 7]); g.lineDashOffset = -t * 22; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke(); g.setLineDash([]);
    }
    // 木札(ゾーンの名前)
    function plaque(lines, lx, ly, open) {
      g.font = 'bold 12px "Yu Gothic UI",sans-serif'; const w = Math.max(...lines.map(l => g.measureText(l).width)) + 16, hgt = lines.length * 14 + 6, x0 = lx - w / 2, y0 = ly - hgt / 2;
      g.globalAlpha = open ? 1 : 0.7; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x0 + 1, y0 + 2, w, hgt, 6); g.fill();
      g.beginPath(); g.roundRect(x0, y0, w, hgt, 6); g.fillStyle = ART.vg(y0, y0 + hgt, open ? '#6e4a2a' : '#4a4a52', open ? '#4a3018' : '#303038'); g.fill(); g.strokeStyle = open ? S(th.accent, 0.9) : '#707078'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x0 + 3, y0 + 1.5, w - 6, 1.4);
      g.fillStyle = '#fff6e0'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 2; lines.forEach((l, i) => g.fillText(l, lx, y0 + 10 + i * 14)); g.shadowBlur = 0; g.globalAlpha = 1;
    }

    // ---------- レイヤー(軽量化) ----------
    // 地面・柵・小道・街灯・木札など、建物の数が変わらない限り動かない部分は、変わったときだけ描き直して使い回す。
    // 建物・住宅・役所など動きのある絵は 1秒12回だけ描き直し(新しく建った瞬間は毎フレーム)、荷車と住民は毎フレーム描く。
    const PW = W * CELL, PH = H * CELL;
    const mkLayer = (alpha = true) => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d', { alpha }); x.textAlign = 'center'; x.textBaseline = 'middle'; return { c, x }; };
    const LS = mkLayer(false), LD = mkLayer(false), LL = mkLayer(), LO = mkLayer(), LV = mkLayer();   // LS=静的 LD=静的+動く絵(1枚に合成) LL=灯り LO=周辺の暗がり+木札 LV=暗がりの元
    { const x = LV.x, vg = x.createRadialGradient(PW / 2, PH / 2, PH * 0.45, PW / 2, PH / 2, PW * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,20,.22)'); x.fillStyle = vg; x.fillRect(0, 0, PW, PH); }   // 周辺を少し暗くして奥行きを出す
    let sigS = '', sLights = [], dLights = [], lastD = -1e9, lightsDirty = true;

    function renderStatic(T) {
      use(LS.x); ART.lights.length = 0; g.clearRect(0, 0, PW, PH);
      g.drawImage(bg, 0, 0);
      for (const id in ZONES) drawZoneGround(id, T, 0);
      for (const id of ids) if (isUnlocked(id, T)) {                                       // エリアの出入口から大通りへつながる小道
        const n = NODE[id], top = ZONES[id].y === 0, y0 = top ? n.e - 2 : ROAD_Y * CELL + CELL, hh = top ? ROAD_Y * CELL - n.e + 2 : n.e - (ROAD_Y * CELL + CELL) + 2;
        g.fillStyle = S(st.road, 0.97); g.fillRect(n.x - 9, y0, 18, hh); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(n.x - 9, y0, 1.4, hh); g.fillRect(n.x + 7.6, y0, 1.4, hh);
      }
      const q0 = [];
      for (let x = 3; x < W; x += 6) for (const yy of [ROAD_Y * CELL + 1, ROAD_Y * CELL + CELL - 1]) { if (nearRoad(x * CELL)) continue; q0.push({ y: yy, fn: () => { ART.line(x * CELL, yy, x * CELL, yy - 13, '#44444f', 2); ART.dot(x * CELL, yy - 14.5, 2.6, '#ffe9a6'); ART.light(x * CELL, yy - 14.5, 15, 'rgba(255,225,150,A)'); } }); }   // 街灯
      for (const id in ZONES) {                                                           // 森(未解放の区画・飾りの森)
        const z = ZONES[id], isB = !!BUILDINGS[id], locked = isB && !isUnlocked(id, T);
        if (locked || z.decor === 'forest') for (const tr of trees[id]) q0.push({ y: tr.y, fn: () => { g.save(); g.translate(tr.x, tr.y); ART.tree(0, tr.sd, st.tree); g.restore(); } });
      }
      q0.sort((a, b) => a.y - b.y).forEach(q2 => q2.fn());
      sLights = ART.lights.slice();
      // 木札(いちばん手前)
      use(LO.x); g.clearRect(0, 0, PW, PH); g.drawImage(LV.c, 0, 0);
      for (const id of ids) {
        const z = ZONES[id], b = T.b[id], open = isUnlocked(id, T), narrow = zw(id) === 3;
        const lines = open ? (narrow ? [BUILDINGS[id].name, `×${b.count}${b.stalled ? ' ⚠' : ''}`] : [`${BUILDINGS[id].name}  ×${b.count}${b.stalled ? ' ⚠' : ''}`]) : [narrow ? '未開拓' : '未開拓の森'];
        plaque(lines, (z.x + zw(id) / 2) * CELL, (z.y + zh(id) - 0.38) * CELL - (lines.length - 1) * 7, open);
      }
      plaque([`${TOWNS[tid].emoji} ${TOWNS[tid].name}`], AVE_CX, 12, true);
      lightsDirty = true;
    }

    function renderDynamic(T, t, now, G) {
      use(LD.x); ART.lights.length = 0; g.clearRect(0, 0, PW, PH); g.drawImage(LS.c, 0, 0);
      const total = ids.reduce((s, id) => s + T.b[id].count, 0), houses = Math.min(MAX_HOUSES, houseSlots.length, Math.floor(2 + Math.sqrt(total) * 3));
      const queue = [], add = (y, fn) => queue.push({ y, fn });
      for (const id in ZONES) { const z = ZONES[id]; if (z.decor === 'castle') add((z.y + zh(id)) * CELL - 20, () => { g.save(); g.translate((z.x + zw(id) / 2) * CELL, (z.y + zh(id) / 2) * CELL + 26); LAND.castle(t); g.restore(); }); }
      // 役所(大通りの奥)と、参道の灯籠・松
      const offIds = OFFICIALS.filter(o => T.off[o.id]).map(o => o.id), hallY = 176;
      add(hallY, () => { g.save(); g.translate(AVE_CX, hallY); g.scale(0.9, 0.9); LAND.hall(t, th, offIds); g.restore(); });
      for (const dx of [-34, 34]) add(hallY + 22, () => { g.save(); g.translate(AVE_CX + dx, hallY + 22); LAND.toro(t, dx); g.restore(); });
      for (const dx of [-30, 30]) add(84, () => { g.save(); g.translate(AVE_CX + dx, 84); ART.tree(t, dx, 'pine'); g.restore(); });
      // 広場の噴水・交易所・石灯籠
      add(ROAD_CY, () => { g.save(); g.translate(AVE_CX, ROAD_CY); LAND.fountain(t); g.restore(); });
      const postX = M.post != null ? POST_X : POST_X - 14, roadSum = TOWN_IDS.reduce((a, id) => a + G.t[id].road, 0), trading = Object.values(T.tflow).some(f => f.imp + f.exp > 0.02);
      add(ROAD_CY + 4, () => { g.save(); g.translate(postX, ROAD_CY + 8); LAND.post(t, roadSum, trading); g.restore(); });
      if (M.lantern != null) { const lx = (ROADS[M.lantern].x + ROADS[M.lantern].w / 2) * CELL; add(ROAD_CY + 4, () => { g.save(); g.translate(lx, ROAD_CY + 8); LAND.toro(t, 5); g.restore(); }); }
      // 住宅
      track('house', houses, now);
      for (let k = 0; k < houses; k++) { const s = houseSlots[k], p = pop('house' + k, now); add(s.py + 10, () => { g.save(); g.translate(s.px, s.py); g.scale(p, p); ART.house(t, k, s.up, st); g.restore(); }); }
      // 施設
      for (const id of ids) {
        const b = T.b[id]; if (!isUnlocked(id, T) || !b.count) continue;
        const shown = visibleCount(b.count, maxVis(id)), spr = SPRITES.spriteOf(id); track(id, shown, now);
        const act = !b.stalled, prog = Math.min(1, b.progress % 1 || (b.progress >= 1 ? 1 : 0));
        for (let k = 0; k < shown; k++) {
          const s = slots[id][k], p = pop(id + k, now), drop = (1 - Math.min(1, p)) * -14;
          add(s.py + 13, () => { g.save(); g.translate(s.px, s.py + drop); g.scale(p, p); g.globalAlpha = act ? 1 : 0.6; spr(t, k * 1.7 + 0.3, act, prog); g.restore(); });
        }
      }
      queue.sort((a, b) => a.y - b.y).forEach(q2 => q2.fn());
      dLights = ART.lights.slice(); lightsDirty = true;
      g.drawImage(LO.c, 0, 0);                                   // 周辺の暗がりと木札は、絵の上に重ねて1枚にしておく
    }
    function renderLights() {                                    // 夜の灯り(加算で重ねる用)。灯りの位置が変わったときだけ描き直す
      use(LL.x); g.clearRect(0, 0, PW, PH); g.globalCompositeOperation = 'lighter';
      for (const l of sLights) ART.glow(l.x, l.y, l.r, l.c, 1);
      for (const l of dLights) ART.glow(l.x, l.y, l.r, l.c, 1);
      g.globalCompositeOperation = 'source-over'; lightsDirty = false;
    }

    function draw(now, stt) {
      const T = stt.t[tid], t = now / 1000, G = stt;
      const sig = ids.map(id => { const b = T.b[id]; return b.count + (b.stalled ? 's' : '') + (isUnlocked(id, T) ? 'u' : 'l'); }).join(',');
      if (sig !== sigS) { renderStatic(T); sigS = sig; lastD = -1e9; }
      if (now - lastD >= 95 || now - lastPop < 700) { renderDynamic(T, t, now, G); lastD = now; }
      if (lightsDirty) renderLights();
      use(main); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.drawImage(LD.c, 0, 0);

      // 荷車: 経路ごとに1台、常に実在する。出発口で積む → 運ぶ → 到着口で降ろす → 空で戻る。止まる条件になっても走行中の1周は最後まで走る
      const dt = Math.min(0.1, (now - prevNow) / 1000); prevNow = now;
      ROUTES.forEach((r, ri) => {
        const pb = r.kind === 'import' ? null : T.b[r.from], cb = r.to === 'plaza' || r.to === 'post' ? null : T.b[r.to], cs = carts[ri] || (carts[ri] = { s: 0, a: 0, face: r.face });
        const tf = T.tflow[r.item] || { imp: 0, exp: 0 };
        let visible, active;
        if (r.kind === 'import') { visible = cb.count > 0 && T.stats.received[r.item] > 0; active = visible && tf.imp > 0.02; }
        else if (r.kind === 'export') { visible = pb.count > 0 && T.stats.produced[r.item] > 0 && tf.exp > 0.0001; active = visible && tf.exp > 0.02; }
        else { visible = pb.count > 0 && (!cb || cb.count > 0); active = visible && !pb.stalled; }
        cs.a = visible ? Math.min(1, cs.a + dt * 3) : Math.max(0, cs.a - dt * 3);
        if (active || cs.s > 0) { cs.s += dt * SPEED; if (cs.s >= r.cycle) cs.s = active ? cs.s - r.cycle : 0; }
        if (cs.a <= 0) return;
        const s = cs.s; let p;
        if (s < DW) p = { ...pathAt(r.out, 0), dx: 0 }; else if (s < DW + r.lo) p = pathAt(r.out, s - DW); else if (s < 2 * DW + r.lo) p = { ...pathAt(r.out, r.lo), dx: 0 }; else p = pathAt(r.back, s - 2 * DW - r.lo);
        if (Math.abs(p.dx) > 0.01) cs.face = p.dx > 0 ? 1 : -1;
        const loaded = s >= DW * 0.5 && s < DW + r.lo + DW * 0.5, bob = (s < DW || (s >= DW + r.lo && s < 2 * DW + r.lo)) ? Math.abs(Math.sin(t * 6)) * 1.2 : 0;
        cs.px = p.x; cs.py = avoidY(p.x, p.y, 'cart') - bob; g.globalAlpha = cs.a; LAND.cart(cs.px, cs.py, cs.face, loaded ? (CARGO[r.item] || '#ccc') : null, t, ri); g.globalAlpha = 1;
      });
      // 住民: 道を行き来する。噴水は避けて歩く
      const total = ids.reduce((s, id) => s + T.b[id].count, 0), houses = Math.min(MAX_HOUSES, houseSlots.length, Math.floor(2 + Math.sqrt(total) * 3));
      const walkers = Math.min(14, 2 + Math.floor(houses / 3)), looks = [{ body: '#d9534f', hat: 'kasa' }, { body: '#4a6fa5', hat: 'none' }, { body: '#e0a63a', hat: 'cap', hatC: '#f2c94c' }, { body: '#6aa66a', hat: 'kasa' }, { body: '#9a6ac0', hat: 'none', hair: '#4a3a2a' }];
      for (let i = 0; i < walkers; i++) {
        const sp = 0.04 + (i % 4) * 0.012, u = (t * sp + i * 0.37) % 2, f = u < 1 ? u : 2 - u, look = looks[i % 5];
        if (i % 3 === 2) { const y = f * (H * CELL - 20) + 10, rd = ROADS[(i >> 1) % ROADS.length], rx = rd.x * CELL + 8 + (i % rd.w) * 24; ART.person(avoidX(rx, y, 'walk'), y, t, i, look); }
        else { const x = f * (W * CELL - 20) + 10; ART.person(x, avoidY(x, ROAD_Y * CELL + 6 + (i % 2) * 20, 'walk'), t, i, look); }
      }
      // 昼夜: 夜は青く暗くなり、窓・炉・街灯が光る
      const nightOn = typeof UI === 'undefined' || UI.dn !== false;
      if (nightOn) {
        const ph = window.__ph != null ? window.__ph : (t % 240) / 240, sn = Math.sin(ph * Math.PI * 2), n = smooth(Math.max(0, Math.min(1, (sn - 0.2) / 0.55)));
        if (n > 0.01) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(${90 - n * 20 | 0},${100 - n * 14 | 0},${160 + n * 10 | 0},${0.62 * n})`; g.fillRect(0, 0, PW, PH); g.restore();
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, n * 1.1); g.drawImage(LL.c, 0, 0); g.restore();
        } else if (sn > -0.1 && sn < 0.2) { g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(255,200,160,${0.18 * (1 - Math.abs(sn - 0.05) / 0.15)})`; g.fillRect(0, 0, PW, PH); g.restore(); }   // 夕焼けの色
      }
      first = false;
    }
    return { W, draw, ROUTES, carts, OBST, ZONES, avoidX, avoidY };
  }

  const maps = {};
  const getMap = tid => maps[tid] || (maps[tid] = makeMap(tid));
  window.__town = { get map() { return getMap(UI.town); }, maps };   // 検証用(ゲームの動作には使わない)
  let lastDraw = 0;
  (function loop(now) {
    if (now - lastDraw > 45 && typeof UI !== 'undefined' && UI.view === 'town' && typeof state !== 'undefined') {
      try {
        const m = getMap(UI.town);
        if (cv.width !== m.W * CELL || cv.height !== H * CELL) { cv.width = m.W * CELL; cv.height = H * CELL; }   // 街が変わったらキャンバスの大きさを合わせる(描画状態はリセットされる)
        m.draw(now, state);
      } catch (e) { console.error('town draw failed', e); }
      lastDraw = now;
    }
    requestAnimationFrame(loop);
  })(performance.now());
})();
