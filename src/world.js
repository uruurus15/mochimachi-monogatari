// 世界地図 (Canvas)。状態を読むだけで、ゲームの進行には影響しない。
// 最初の街(もちの里)から街道が延び、道を切り拓いた先の街が霧の中から現れる。街ごとに所持金(通貨)を持つ。
// 街道はレベルが高いほど太く立派になり、街どうしの輸送が動いている間は隊商が荷物を積んで行き来する。
// 街をクリックすると、その街の画面に切り替わる。
// 町のミニチュア(town.js)とは独立していて、描画エラーが起きてもゲーム本体や町ビューには影響しない。
'use strict';
(function () {
  const cv = document.getElementById('world'); if (!cv) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const POS = {}; for (const id of TOWN_IDS) POS[id] = TOWNS[id].pos;
  const LEVEL_COLOR = [null, '#9b7a52', '#b0905e', '#a8a39a', '#8f9096', '#55575f', '#d8b85a'];
  const ITEM_COLOR = { rice: '#f4efd0', flour: '#fff', mochi: '#ffd6e4', bamboo: '#6fc16a', plank: '#d8b27a', clay: '#d0894f', tile: '#c05a48', sake: '#e8e0ff', tea: '#7fb069', fish: '#7aa6d8', sweets: '#e8a0b8', bento: '#e0b36a',
    pickle: '#9ec06a', tools: '#8a8f98', cloth: '#c06a9a', seafish: '#6fa8d8', salt: '#f4f4f4', kelp: '#3f7d4a', dried: '#d9a066', dashi: '#e0b070', wood: '#a9774a', ore: '#8a8f98', charcoal: '#3a3a3f', iron: '#7d838a', herb: '#7fc47a', tonic: '#9fe0e8',
    leaf: '#5fae4a', cocoon: '#f0ece0', silk: '#f0e0f0', indigo: '#4a5fb0', dye: '#7a5ac0', goldore: '#d9b84a', goldleaf: '#e6c34a', gilded: '#ffd54f' };
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // ---------- 静的な地形(一度だけ描いて使い回す) ----------
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  (function paint() {
    const c = bg.getContext('2d'), r = rng(11);
    c.fillStyle = '#5f9a4f'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.globalAlpha = 0.35; c.fillStyle = ['#66a455', '#58924a', '#6aa85a', '#5a9a52'][i % 4]; c.beginPath(); c.arc(r() * W, r() * H, 25 + r() * 70, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.fillStyle = '#3f93c9'; c.beginPath(); c.moveTo(340, 0); c.lineTo(1010, 0); c.lineTo(1010, 38); c.bezierCurveTo(900, 92, 800, 66, 700, 78); c.bezierCurveTo(580, 92, 460, 72, 340, 40); c.closePath(); c.fill();
    c.strokeStyle = '#efe6b8'; c.lineWidth = 6; c.beginPath(); c.moveTo(1010, 38); c.bezierCurveTo(900, 92, 800, 66, 700, 78); c.bezierCurveTo(580, 92, 460, 72, 340, 40); c.stroke();
    c.strokeStyle = '#4aa3d8'; c.lineWidth = 18; c.lineCap = 'round'; c.beginPath(); c.moveTo(1120, 0); c.bezierCurveTo(1000, 120, 1090, 300, 960, 480); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(1120, 0); c.bezierCurveTo(1000, 120, 1090, 300, 960, 480); c.stroke();
    for (let k = 0; k < 9; k++) { const cx = 60 + r() * (W - 120), cy = 150 + r() * 300; for (let i = 0; i < 16; i++) { const x = cx + (r() - 0.5) * 90, y = cy + (r() - 0.5) * 60; c.fillStyle = r() < 0.5 ? '#2f6e3a' : '#3a7f44'; c.beginPath(); c.arc(x, y, 6 + r() * 4, 0, 7); c.fill(); } }
    for (let i = 0; i < 16; i++) {
      const x = 400 + i * 32 + r() * 18, h = 38 + r() * 56, y = 485;
      c.fillStyle = '#7d7f86'; c.beginPath(); c.moveTo(x - 36, y); c.lineTo(x, y - h); c.lineTo(x + 36, y); c.closePath(); c.fill();
      c.fillStyle = '#6a6c73'; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + 36, y); c.lineTo(x + 8, y); c.closePath(); c.fill();
      c.fillStyle = '#f2f2f6'; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x - 9, y - h + 15); c.lineTo(x + 9, y - h + 15); c.closePath(); c.fill();
    }
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#c9d66a' : '#a8c85e'; c.fillRect(110 + (i % 3) * 38, 300 + Math.floor(i / 3) * 24, 34, 20); }
  })();

  // ---------- 街道の経路(曲線) ----------
  const ROADS = {};
  for (const id of TOWN_IDS) {
    const P0 = TOWNS[id].parent; if (!P0) continue;
    const A = POS[P0], B = POS[id], r = rng(id.length * 131 + 5), nx = -(B.y - A.y), ny = B.x - A.x, nl = Math.hypot(nx, ny), off = (r() - 0.5) * 120;
    const C = { x: (A.x + B.x) / 2 + nx / nl * off, y: (A.y + B.y) / 2 + ny / nl * off }, pts = [];
    for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push({ x: (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * C.x + u * u * B.x, y: (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * C.y + u * u * B.y }); }
    ROADS[id] = { pts, len: pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) };
  }
  function at(pts, s) {
    for (let i = 1; i < pts.length; i++) { const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, L = Math.hypot(dx, dy); if (s <= L || i === pts.length - 1) { const u = Math.min(1, s / (L || 1)); return { x: pts[i - 1].x + dx * u, y: pts[i - 1].y + dy * u, dx, dy }; } s -= L; }
  }

  // ---------- 描画ヘルパー ----------
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const circle = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
  const pill = (x, y, lines, alpha = 1, border) => {
    g.font = 'bold 14px sans-serif'; const w = Math.max(...lines.map(l => g.measureText(l).width)) + 18, h = lines.length * 18 + 6;
    g.globalAlpha = alpha; g.fillStyle = '#000b'; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 10); g.fill();
    if (border) { g.strokeStyle = border; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, x, y - (lines.length - 1) * 9 + i * 18 + 1)); g.globalAlpha = 1;
  };
  function smallHouse(x, y, k, S) { const wall = ['#f2d7b6', '#e6c3a3', '#d9e3c1', '#f0e0a8', '#cfd9e8'][k % 5], roof = S[(k * 3) % S.length]; rect(x - 6, y - 3, 12, 8, wall); poly([[x - 8, y - 3], [x, y - 10], [x + 8, y - 3]], roof); rect(x - 1, y + 1, 3, 4, '#6a4a30'); }
  function cart(x, y, dir, col, t, sd) {
    g.save(); g.translate(x, y); g.scale(dir * 1.15, 1.15);
    rect(-9, -6, 18, 7, '#8a5a30'); if (col) { rect(-8, -10, 16, 4, col); circle(-4, -10, 2, col); circle(2, -11, 2.2, col); }
    circle(-5, 3, 2.6, '#3a2a1a'); circle(5, 3, 2.6, '#3a2a1a'); g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(9, -3); g.lineTo(15, -2); g.stroke();
    const st = Math.sin(t * 8 + sd) * 2; g.strokeStyle = '#4a4a5a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(17, -1); g.lineTo(17 - st, 5); g.moveTo(17, -1); g.lineTo(17 + st, 5); g.stroke(); rect(14.5, -7, 5, 7, '#8a6a45'); circle(17, -9, 2.6, '#f3d2b0'); g.restore();
  }

  // ---------- 街の絵(特徴のある建物つき) ----------
  const ROOFS = { home: ['#c4574a', '#9a5b3c', '#4f78a0', '#7a5aa0'], shiomi: ['#4f78a0', '#3f6a8a', '#c4574a', '#e0e6ee'], kirigamine: ['#6b4a35', '#7a5a3c', '#4a4f5a', '#8a3a30'], itokawa: ['#7a5aa0', '#a05a8a', '#4f78a0', '#6a5a90'], daito: ['#c4574a', '#d4a843', '#7a2a2a', '#4a4f5a'] };
  function drawTown(id, x, y, t, T) {
    const r = rng((id.length + 3) * 977), total = Object.values(T.b).reduce((s, b) => s + b.count, 0), houses = 4 + Math.min(12, Math.floor(Math.sqrt(total) * 1.2) + (id === ROOT_TOWN ? 3 : 0));
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + 16, 62, 26, 0, 0, 7); g.fill();
    g.fillStyle = '#d2c29a'; g.beginPath(); g.ellipse(x, y + 12, 50, 21, 0, 0, 7); g.fill();
    const list = []; for (let i = 0; i < houses; i++) list.push({ x: x + (r() - 0.5) * 100, y: y + (r() - 0.5) * 40 + 6, k: i });
    list.sort((a, b) => a.y - b.y).forEach(h => smallHouse(h.x, h.y, h.k, ROOFS[id]));
    if (id === ROOT_TOWN) {
      rect(x - 3, y - 36, 6, 28, '#e8d8b8'); poly([[x - 8, y - 36], [x, y - 46], [x + 8, y - 36]], '#a05a4a');
      g.save(); g.translate(x, y - 38); g.rotate(t * 0.6); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); rect(-1.5, -22, 3, 22, '#fff'); rect(-6, -22, 5, 12, '#f4efe0'); } g.restore(); circle(x, y - 38, 2.4, '#6a4a30');
    } else if (id === 'shiomi') {
      rect(x - 70, y - 28, 46, 5, '#8a6a45'); for (let i = 0; i < 4; i++) rect(x - 68 + i * 12, y - 24, 3, 9, '#6a4a2a');
      const bob = Math.sin(t * 1.6) * 2; g.fillStyle = '#8a5a30'; g.beginPath(); g.moveTo(x - 80, y - 36 + bob); g.lineTo(x - 50, y - 36 + bob); g.lineTo(x - 56, y - 28 + bob); g.lineTo(x - 74, y - 28 + bob); g.closePath(); g.fill();
      rect(x - 66, y - 56 + bob, 2, 20, '#5a3a1a'); poly([[x - 64, y - 55 + bob], [x - 48, y - 44 + bob], [x - 64, y - 38 + bob]], '#f4f0e0');
    } else if (id === 'kirigamine') {
      g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(x + 54, y - 8, 14, Math.PI, 0); g.fill(); rect(x + 40, y - 8, 28, 5, '#4a4a52'); g.fillStyle = '#111'; g.beginPath(); g.arc(x + 54, y - 7, 9, Math.PI, 0); g.fill();
      rect(x + 40, y - 2, 40, 2, '#8a6a45'); const cx = x + 44 + ((t * 14) % 36); rect(cx - 6, y - 8, 12, 6, '#7d838a'); circle(cx - 3, y - 1, 2, '#333'); circle(cx + 3, y - 1, 2, '#333');
    } else if (id === 'itokawa') {
      for (let i = 0; i < 4; i++) { const sw = Math.sin(t * 2 + i) * 1.5; rect(x - 68 + i * 11 + sw, y - 34, 8, 20, ['#c06a9a', '#6a8fc0', '#e0b36a', '#7a5ac0'][i]); } rect(x - 72, y - 36, 50, 2.5, '#6a4a2a');
      g.save(); g.translate(x + 58, y - 4); g.rotate(t * 0.9); circle(0, 0, 13, '#7a5a3a'); for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); rect(-1, -13, 2, 13, '#5a4028'); } g.restore();
    } else if (id === 'daito') {
      for (let i = 0; i < 3; i++) { rect(x - 22 + i * 4, y - 14 - i * 14, 44 - i * 8, 14, '#f0e6d0'); poly([[x - 28 + i * 4, y - 14 - i * 14], [x, y - 24 - i * 14], [x + 28 - i * 4, y - 14 - i * 14]], i === 2 ? '#e6c34a' : '#4a4f5a'); }
      rect(x - 1, y - 62, 2, 14, '#6a4a30'); poly([[x + 1, y - 62], [x + 14 + Math.sin(t * 5) * 1.5, y - 58], [x + 1, y - 54]], '#d9534f');
    }
  }
  function drawFog(id, x, y, t, label) {
    const r = rng(id.length * 71 + 9);
    for (let i = 0; i < 9; i++) { const ox = (r() - 0.5) * 110 + Math.sin(t * 0.4 + i) * 5, oy = (r() - 0.5) * 50 + Math.cos(t * 0.5 + i) * 3, rad = 30 + r() * 22; g.fillStyle = 'rgba(232,236,242,.92)'; g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 7); g.fill(); }
    g.font = 'bold 34px sans-serif'; g.fillStyle = '#7d8795'; g.fillText('？', x, y + 2);
    if (label) pill(x, y + 62, [label], 0.95);
  }

  // ---------- 隊商の状態(街道ごと) ----------
  const carts = {}; let prevNow = 0, hover = null;
  function dominant(T, key) { let best = null, bv = 0.02; for (const it in T.tflow) { const v = T.tflow[it][key] || 0; if (v > bv) { bv = v; best = it; } } return best; }
  const nearestTown = (mx, my) => { let best = null, bd = 70; if (typeof state !== 'undefined' && state.meta.seen.goal && Math.hypot(mx - EXPO_AT.x, (my - EXPO_AT.y) * 1.6) < 100) return 'expo'; for (const id of TOWN_IDS) { const d = Math.hypot(mx - POS[id].x, my - POS[id].y); if (d < bd) { bd = d; best = id; } } return best; };
  const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  cv.addEventListener('mousemove', e => { const p = toCanvas(e); hover = nearestTown(p.x, p.y); cv.style.cursor = hover ? 'pointer' : 'default'; });
  cv.addEventListener('mouseleave', () => { hover = null; });
  cv.addEventListener('click', e => { const p = toCanvas(e), id = nearestTown(p.x, p.y); if (id && window.__worldPick) window.__worldPick(id); });

  function draw(now) {
    const st = state, t = now / 1000, dt = Math.min(0.1, (now - prevNow) / 1000); prevNow = now;
    g.textAlign = 'center'; g.textBaseline = 'middle'; ART.use(g); ART.lights.length = 0;
    g.drawImage(bg, 0, 0);
    for (let i = 0; i < 7; i++) { const p = (t * 0.12 + i / 7) % 1, x = 380 + i * 90 + Math.sin(t + i) * 8, y = 30 + Math.sin(i * 2) * 14; g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6 + p * 10, 0.2, 2.9); g.stroke(); }

    // 街道
    for (const id of TOWN_IDS) {
      const P0 = TOWNS[id].parent; if (!P0) continue;
      const C = st.t[id], P = st.t[P0], pts = ROADS[id].pts, parentOk = P.open;
      if (C.road >= 1) {
        const lv = C.road, w = 6 + lv * 1.6;
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = w + 4; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
        g.strokeStyle = LEVEL_COLOR[lv]; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
        if (lv >= 3) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.setLineDash([8, 10]); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.setLineDash([]); }
        const m = pts[20]; pill(m.x, m.y - 22, [`${ROAD.names[lv]} Lv${lv}`], 0.9);
      } else if (townVisible(st, id) && parentOk) {
        g.strokeStyle = 'rgba(250,242,200,.85)'; g.lineWidth = 4; g.setLineDash([3, 9]); g.lineCap = 'round'; g.lineDashOffset = -t * 6; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
        const m = pts[20]; pill(m.x, m.y - 22, [`未踏の道 ${cur0(P)}${fmt(roadCost(st, id))}`], 0.9);
      }
    }
    // 隊商(街どうしの輸送が動いている間だけ走る。走行中の1周は最後まで走って、出発の街に戻って消える)
    for (const id of TOWN_IDS) {
      const C = st.t[id]; if (!TOWNS[id].parent || C.road < 1 || !C.open) continue;
      const imp = dominant(C, 'imp'), exp = dominant(C, 'exp'), active = !!(imp || exp), ch = ROADS[id];
      const rate = Math.max(0, ...Object.values(C.tflow).map(f => Math.max(f.imp, f.exp))), n = rate > 300 ? 3 : rate > 40 ? 2 : 1, speed = 50 + 18 * C.road;
      for (let c = 0; c < n; c++) {
        const key = id + c, cs = carts[key] || (carts[key] = { s: (c / n) * ch.len * 2, a: 0, im: null, ex: null });
        if (active) { cs.im = imp; cs.ex = exp; }
        cs.a = (active || cs.s > 0) ? Math.min(1, cs.a + dt * 2) : Math.max(0, cs.a - dt * 2);
        if (active || cs.s > 0) { cs.s += dt * speed; if (cs.s >= ch.len * 2) cs.s = active ? cs.s - ch.len * 2 : 0; }
        if (cs.a <= 0) continue;
        const out = cs.s < ch.len, p = out ? at(ch.pts, cs.s) : at(ch.pts, ch.len * 2 - cs.s), col = out ? (cs.im && ITEM_COLOR[cs.im]) : (cs.ex && ITEM_COLOR[cs.ex]);
        g.globalAlpha = cs.a; cart(p.x, p.y - 6, out ? 1 : -1, col || null, t, c + id.length); g.globalAlpha = 1;
      }
    }
    // 街(所持金つき)。いま見ている街は光る輪で示す
    for (const id of TOWN_IDS) {
      const T = st.t[id], p = POS[id], th = TOWNS[id].theme;
      if (T.open) {
        if (UI.town === id) { g.strokeStyle = th.accent; g.lineWidth = 4; g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4); g.beginPath(); g.ellipse(p.x, p.y + 12, 78, 36, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
        drawTown(id, p.x, p.y, t, T);
        pill(p.x, p.y + 62, [`${TOWNS[id].emoji} ${TOWNS[id].name}${id === ROOT_TOWN ? '(本拠地)' : ''}`, `${TOWNS[id].cur.emoji}${fmt(T.items.coin)}`], hover === id ? 1 : 0.92, th.accent);
      } else drawFog(id, p.x, p.y, t, townVisible(st, id) && st.t[TOWNS[id].parent].open ? '未踏の地(道を切り拓こう)' : null);
    }
    if (st.meta.seen.goal) drawExpo(st, t);
  }

  // ---------- 博覧会・大祭(会場・各街の館/殿・提灯・花火・桜) ----------
  const EXPO_AT = { x: 880, y: 262 }, PAV = { home: [-96, -4], shiomi: [92, 6], kirigamine: [-98, 14], itokawa: [96, 20], daito: [-100, 10] };
  const SINGLE = set => set.stages.filter(s => !s.requires);
  function drawExpo(st, t) {
    const accents = TOWN_IDS.map(id => TOWNS[id].theme.accent), s1 = SINGLE(GOAL), s2 = SINGLE(GOAL2);
    const f1 = s1.map(s => !!st.goal.done[s.id]), f2 = s2.map(s => !!st.goal2.done[s.id]);
    const info = { n1: f1.filter(Boolean).length, n2: f2.filter(Boolean).length, done1: !!st.goal.done.g_final, done2: !!st.goal2.done.h_final, accents, flags1: f1, flags2: f2 };
    ART.use(g);
    TOWN_IDS.forEach((id, i) => {
      if (!st.t[id].open) return; const p = POS[id], o = PAV[id];
      g.save(); g.translate(p.x + o[0], p.y + o[1]); if (f2[i]) EXPO.pavilion(t, accents[i], 2, i); else if (f1[i]) EXPO.pavilion(t, accents[i], 1, i); else EXPO.plot(t, accents[i]); g.restore();
    });
    g.save(); g.translate(EXPO_AT.x, EXPO_AT.y); EXPO.grounds(t, info, LAND.castle); if (info.done1) EXPO.fireworks(t, info.done2 ? 4 : 2); g.restore();
    const lines = [`🎆 万国もち博覧会 ${info.n1 + (info.done1 ? 1 : 0)}/6`]; if (st.meta.seen.goal2) lines.push(`🌸 天下一もち大祭 ${info.n2 + (info.done2 ? 1 : 0)}/6`);
    pill(EXPO_AT.x, EXPO_AT.y + 62, lines, hover === 'expo' ? 1 : 0.92, info.done2 ? '#ff8fb8' : '#ffd54f');
    if (info.n2 >= 1) for (const id of TOWN_IDS) if (st.t[id].road >= 1 && st.t[id].open && TOWNS[id].parent) EXPO.festoon(ROADS[id].pts, t);
    if (info.done2) EXPO.petals(W, H, t);
  }
  const cur0 = P => TOWNS[P.id].cur.emoji;

  window.__world = { carts };   // 検証用(ゲームの動作には使わない)
  let lastDraw = 0;
  (function loop(now) {
    if (now - lastDraw > 33 && typeof UI !== 'undefined' && UI.view === 'world' && typeof state !== 'undefined') { try { draw(now); } catch (e) { console.error('world draw failed', e); } lastDraw = now; }
    requestAnimationFrame(loop);
  })(performance.now());
})();
