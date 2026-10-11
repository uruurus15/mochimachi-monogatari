// 描画ライブラリ (ジオラマ調のミニチュアの絵)。town.js と world.js が使う。ゲームの状態には触れない。
// 絵のルール: 光は左上から。すべての物に細い暗い輪郭・下に落ちる影・上が明るく下が暗いグラデーション。
// 建物は 3/4 視点(正面の壁 + 右側の壁 + 瓦の屋根)。夜は窓や炉の灯りを ART.lights に登録し、town.js が加算で光らせる。
// 各スプライトは、スロットの中心を原点(0,0)・足元を y=+13 付近として描く。
'use strict';
const ART = (function () {
  let g = null; const lights = [];
  const use = ctx => { g = ctx; };

  // ---------- 色 ----------
  const hexN = h => { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return parseInt(h.slice(1), 16); };
  const toHex = (r, gg, b) => '#' + ((1 << 24) + (Math.max(0, Math.min(255, r | 0)) << 16) + (Math.max(0, Math.min(255, gg | 0)) << 8) + Math.max(0, Math.min(255, b | 0))).toString(16).slice(1);
  const S = (h, k) => { const n = hexN(h); return toHex((n >> 16) * k, ((n >> 8) & 255) * k, (n & 255) * k); };            // 明るさを変える(k>1で明るく)
  const M = (a, b, t) => { const x = hexN(a), y = hexN(b); return toHex((x >> 16) + ((y >> 16) - (x >> 16)) * t, ((x >> 8) & 255) + (((y >> 8) & 255) - ((x >> 8) & 255)) * t, (x & 255) + ((y & 255) - (x & 255)) * t); };
  const OL = 'rgba(48,30,24,.6)';                                                                                      // 輪郭の色

  // ---------- グラデーションのキャッシュ(原点基準で描くので同じ座標なら使い回せる) ----------
  const gc = new Map();
  function vg(y0, y1, c0, c1) { const k = `v${y0}|${y1}|${c0}|${c1}`; let o = gc.get(k); if (!o) { o = g.createLinearGradient(0, y0, 0, y1); o.addColorStop(0, c0); o.addColorStop(1, c1); gc.set(k, o); } return o; }
  function hg(x0, x1, c0, c1) { const k = `h${x0}|${x1}|${c0}|${c1}`; let o = gc.get(k); if (!o) { o = g.createLinearGradient(x0, 0, x1, 0); o.addColorStop(0, c0); o.addColorStop(1, c1); gc.set(k, o); } return o; }
  const lit = (c, h) => vg(-h, 0, S(c, 1.14), S(c, 0.9));                                                              // 上が明るく下が暗い塗り(原点の上 h px を想定)

  // ---------- 基本図形 ----------
  function path(pts) { g.beginPath(); for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]); g.closePath(); }
  function face(pts, fill, edge = OL, lw = 1) { path(pts); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); } }
  function box(x, y, w, h, c, edge = OL, r = 0) {                                                                       // 左上が(x,y)の角丸の長方形。縦グラデーション付き
    g.beginPath(); r ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
    g.fillStyle = vg(y, y + h, S(c, 1.12), S(c, 0.88)); g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); }
  }
  function ell(x, y, rx, ry, fill, edge) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); } }
  function dot(x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); }
  function line(x1, y1, x2, y2, c, w = 1) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function shadow(x, y, rx, ry, a = 0.3) { g.fillStyle = `rgba(24,14,34,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }
  function glow(x, y, r, c, a = 1) {                                                                                    // やわらかい光(加算合成の上で使う)
    const k = `g${r}|${c}|${a}`; let o = gc.get(k);
    if (!o) { o = g.createRadialGradient(0, 0, 0, 0, 0, r); o.addColorStop(0, c.replace('A', a)); o.addColorStop(1, c.replace('A', 0)); gc.set(k, o); }
    g.save(); g.translate(x, y); g.fillStyle = o; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
  }
  function abs(x, y) { const m = g.getTransform(); return { x: m.e + x * m.a, y: m.f + y * m.d, k: m.a }; }
  function light(x, y, r, c = 'rgba(255,200,110,A)') { const p = abs(x, y); lights.push({ x: p.x, y: p.y, r: r * p.k, c }); }  // 夜に光らせる点

  // 瓦の質感(多角形の中だけに描く)
  function tileTexture(pts, step = 3, a = 0.2, ticks = false) {
    g.save(); path(pts); g.clip();
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 0.8;
    for (let y = y0 + step, r = 0; y < y1; y += step, r++) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); if (ticks) for (let x = x0 + (r % 2) * 2; x < x1; x += 4) { g.beginPath(); g.moveTo(x, y - step); g.lineTo(x, y); g.stroke(); } }
    g.strokeStyle = `rgba(255,255,255,${a * 0.7})`; g.beginPath(); g.moveTo(x0, y0 + 1); g.lineTo(x1, y0 + 1); g.stroke();
    g.restore();
  }

  // ---------- 屋根・壁・建物(3/4 視点) ----------
  // 寄棟の屋根。cx=中心 yE=軒の高さ w=壁の幅 rh=屋根の高さ ov=軒の出 d=奥行き(右側面)
  function hipRoof(cx, yE, w, rh, c, ov = 3, d = 6) {
    const L = cx - w / 2 - ov, R = cx + w / 2 + ov, inset = Math.min(w * 0.3, 8) + 2;
    const front = [[L, yE + 2], [R, yE + 2], [R - inset, yE - rh], [L + inset, yE - rh]];
    const side = [[R, yE + 2], [R + d, yE + 2 - d * 0.62], [R - inset + d * 0.5, yE - rh - d * 0.3], [R - inset, yE - rh]];
    face(side, S(c, 0.72), OL); tileTexture(side, 3, 0.22);
    face(front, vg(yE - rh, yE + 2, S(c, 1.18), S(c, 0.92)), OL); tileTexture(front, 3, 0.2);
    g.strokeStyle = S(c, 1.35); g.lineWidth = 1.4; g.beginPath(); g.moveTo(L + inset, yE - rh); g.lineTo(R - inset, yE - rh); g.stroke();          // 棟
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(L + 1, yE + 2, R - L - 1, 1.6);                                                                      // 軒の影
  }
  // 建物の本体(壁 + 屋根)。x,y は壁の下辺の中心。戻り値は座標(戸や窓を置くのに使う)
  function house3d(x, yb, o) {
    const w = o.w || 24, h = o.h || 13, d = o.d || 6, wall = o.wall || '#f2e6d0', roof = o.roof || '#7a5a50', rh = o.rh || 10;
    const x0 = x - w / 2, x1 = x + w / 2;
    shadow(x + 3, yb + 1, w / 2 + d, 4.5, 0.3);
    face([[x1, yb], [x1 + d, yb - d * 0.62], [x1 + d, yb - h - d * 0.62], [x1, yb - h]], S(wall, 0.72), OL);                                          // 右側の壁(影側)
    face([[x0, yb], [x1, yb], [x1, yb - h], [x0, yb - h]], vg(yb - h, yb, S(wall, 1.06), S(wall, 0.88)), OL);                                       // 正面の壁
    if (o.base !== false) { g.fillStyle = o.baseC || '#8a8479'; g.fillRect(x0, yb - 2.4, w, 2.4); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, yb - 2.4, w, 0.8); }   // 石の基礎
    if (o.beams !== false) { g.strokeStyle = o.beamC || 'rgba(70,45,32,.75)'; g.lineWidth = 1.1; for (const bx of [x0 + 0.5, x1 - 0.5, x]) { g.beginPath(); g.moveTo(bx, yb - h); g.lineTo(bx, yb - 2.4); g.stroke(); } g.beginPath(); g.moveTo(x0, yb - h + 3); g.lineTo(x1, yb - h + 3); g.stroke(); }
    hipRoof(x, yb - h, w, rh, roof, o.ov == null ? 3 : o.ov, d);
    return { x0, x1, yb, yt: yb - h, ridge: yb - h - rh };
  }
  function door(x, yb, w, h, c = '#6a4a30') { box(x - w / 2, yb - h, w, h, c, OL, 1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - w / 2 + w * 0.5, yb - h, 0.8, h); dot(x + w * 0.25, yb - h * 0.45, 0.7, '#e0c070'); }
  function shoji(x, y, w, h, on) {                                                                                       // 障子窓。夜(on)は暖色に光る
    box(x, y, w, h, on ? '#ffe9a6' : '#cfdbe6', 'rgba(60,40,30,.7)', 0.5);
    g.strokeStyle = 'rgba(80,55,40,.7)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    if (on) light(x + w / 2, y + h / 2, 12);
  }
  function noren(x, y, w, h, c, t, sd, crest) {                                                                          // 暖簾
    const sw = Math.sin(t * 1.6 + sd) * 0.8; g.fillStyle = c;
    for (let i = 0; i < 3; i++) { const px = x - w / 2 + i * (w / 3); g.beginPath(); g.moveTo(px + 0.4, y); g.lineTo(px + w / 3 - 0.4, y); g.lineTo(px + w / 3 - 0.4 + sw, y + h); g.lineTo(px + 0.4 + sw, y + h); g.closePath(); g.fillStyle = i === 1 ? S(c, 1.15) : c; g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - w / 2, y - 1, w, 1.4); if (crest) dot(x + sw * 0.5, y + h * 0.45, 1.8, 'rgba(255,255,255,.85)');
  }
  function lantern(x, y, t, sd, c = '#d9483a') {                                                                          // 提灯
    const sw = Math.sin(t * 1.8 + sd) * 0.8; line(x, y - 4, x + sw * 0.3, y, '#5a3a22', 0.8);
    g.beginPath(); g.ellipse(x + sw, y + 3.5, 2.6, 3.6, 0, 0, 7); g.fillStyle = hg(x - 2.6, x + 2.6, S(c, 1.2), S(c, 0.85)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#3a2a22'; g.fillRect(x + sw - 1.4, y - 0.3, 2.8, 0.8); g.fillRect(x + sw - 1.4, y + 6.6, 2.8, 0.8); light(x + sw, y + 3.5, 11, 'rgba(255,150,90,A)');
  }
  function chimney(x, yb, h, c = '#7a6a5e') { box(x, yb - h, 4, h, c, OL); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 0.6, yb - h - 1, 5.2, 1.6); }
  function smoke(x, y, t, sd, col = '240,240,245', n = 3, size = 1) {
    for (let i = 0; i < n; i++) { const p = (t * 0.45 + i / n + sd) % 1, r = (2.4 + p * 5) * size; g.fillStyle = `rgba(${col},${0.5 * (1 - p)})`; g.beginPath(); g.arc(x + Math.sin(p * 5 + i + sd) * 3 + p * 6, y - p * 26 * size, r, 0, 7); g.fill(); }
  }
  function sparks(x, y, t, sd, n = 5, col = '255,214,120') { for (let i = 0; i < n; i++) { const p = (t * 1.8 + i / n + sd) % 1; g.fillStyle = `rgba(${col},${1 - p})`; g.fillRect(x + Math.cos(i * 2.3 + sd) * p * 9, y - p * 11 + p * p * 10, 1.4, 1.4); } }
  function barrel(x, y, r = 4, c = '#a3703a', t = 0, lid = true) {
    g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r * 1.18, y - r * 1.5, x - r, y - r * 3); g.lineTo(x + r, y - r * 3); g.quadraticCurveTo(x + r * 1.18, y - r * 1.5, x + r, y); g.closePath();
    g.fillStyle = hg(x - r, x + r, S(c, 1.15), S(c, 0.78)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = '#4a3220'; g.lineWidth = 0.9; for (const k of [0.8, 2.2]) { g.beginPath(); g.moveTo(x - r * 1.1, y - r * k); g.lineTo(x + r * 1.1, y - r * k); g.stroke(); }
    if (lid) ell(x, y - r * 3, r, r * 0.38, S(c, 1.25), OL);
  }
  function crate(x, y, s = 5, c = '#b88a54') { face([[x - s, y], [x + s, y], [x + s, y - s * 1.6], [x - s, y - s * 1.6]], vg(y - s * 1.6, y, S(c, 1.12), S(c, 0.85))); line(x - s, y - s * 0.8, x + s, y - s * 0.8, 'rgba(60,40,24,.5)', 0.8); line(x, y, x, y - s * 1.6, 'rgba(60,40,24,.4)', 0.8); face([[x - s, y - s * 1.6], [x + s, y - s * 1.6], [x + s + 1.6, y - s * 1.6 - 1.4], [x - s + 1.6, y - s * 1.6 - 1.4]], S(c, 1.3)); }
  function sack(x, y, s = 4, c = '#e8dcc0') { g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s * 1.2, y - s * 1.4, x - s * 0.5, y - s * 2); g.lineTo(x + s * 0.5, y - s * 2); g.quadraticCurveTo(x + s * 1.2, y - s * 1.4, x + s, y); g.closePath(); g.fillStyle = hg(x - s, x + s, S(c, 1.1), S(c, 0.82)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke(); line(x - s * 0.5, y - s * 1.9, x + s * 0.5, y - s * 1.9, 'rgba(60,40,24,.55)', 0.9); }
  function logs(x, y, n = 3, r = 3) { for (let i = 0; i < n; i++) { const lx = x + (i % 2) * r * 1.6 - (n > 2 ? r * 0.8 : 0) + (i >= 2 ? r * 0.8 : 0), ly = y - Math.floor(i / 2) * r * 1.5; dot(lx, ly, r, '#b07a44'); g.strokeStyle = OL; g.lineWidth = 0.7; g.beginPath(); g.arc(lx, ly, r, 0, 7); g.stroke(); dot(lx, ly, r * 0.55, '#d9a66a'); g.strokeStyle = 'rgba(100,60,30,.5)'; g.beginPath(); g.arc(lx, ly, r * 0.3, 0, 7); g.stroke(); } }
  function rock(x, y, s = 4, c = '#8a8a90') { g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s * 1.1, y - s * 0.9, x - s * 0.3, y - s * 1.2); g.quadraticCurveTo(x + s * 0.8, y - s * 1.3, x + s, y); g.closePath(); g.fillStyle = vg(y - s * 1.2, y, S(c, 1.2), S(c, 0.8)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke(); }
  function bush(x, y, s = 5, c = '#4f9a50') { shadow(x + 1, y, s, s * 0.35, 0.25); dot(x - s * 0.5, y - s * 0.5, s * 0.7, S(c, 0.85)); dot(x + s * 0.5, y - s * 0.5, s * 0.7, S(c, 0.95)); dot(x, y - s * 0.9, s * 0.8, c); dot(x - s * 0.2, y - s * 1.1, s * 0.4, S(c, 1.3)); }

  // ---------- 人 ----------
  const SKIN = '#f3d2b0';
  // o: body(服の色) hat('kasa' | 'cap' | 'eboshi' | 'none') hair walking(歩く) dir
  function person(x, y, t, sd, o = {}) {
    const body = o.body || '#4a6fa5', wk = o.walk !== false, step = wk ? Math.sin(t * 8 + sd) * 2.2 : 0, bob = wk ? Math.abs(Math.sin(t * 8 + sd)) * 0.6 : 0;
    shadow(x + 1, y + 7.5, 4, 1.4, 0.28);
    line(x - 1, y + 2, x - 1 - step * 0.6, y + 7, '#3a3340', 1.7); line(x + 1, y + 2, x + 1 + step * 0.6, y + 7, '#3a3340', 1.7);
    const yy = y - bob;
    g.beginPath(); g.roundRect(x - 3, yy - 5, 6, 8.5, 2); g.fillStyle = hg(x - 3, x + 3, S(body, 1.15), S(body, 0.8)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = S(body, 0.6); g.fillRect(x - 3, yy - 0.5, 6, 1.1);                                       // 帯
    line(x - 3, yy - 3, x - 4.2, yy + 0.5 + (wk ? step * 0.3 : 0), S(body, 0.9), 1.3); line(x + 3, yy - 3, x + 4.2, yy + 0.5 - (wk ? step * 0.3 : 0), S(body, 0.9), 1.3);
    dot(x, yy - 7.4, 2.7, SKIN); g.strokeStyle = OL; g.lineWidth = 0.6; g.beginPath(); g.arc(x, yy - 7.4, 2.7, 0, 7); g.stroke();
    const hat = o.hat || 'none';
    if (hat === 'kasa') { face([[x - 6, yy - 8.4], [x + 6, yy - 8.4], [x, yy - 13.5]], '#e0c27a', OL, 0.7); line(x - 5, yy - 9.2, x + 5, yy - 9.2, 'rgba(120,80,30,.4)', 0.6); }
    else if (hat === 'eboshi') { face([[x - 3, yy - 9.3], [x + 3, yy - 9.3], [x + 1.5, yy - 14.5], [x - 0.5, yy - 14.5]], '#222230', OL, 0.6); }
    else if (hat === 'cap') { g.fillStyle = o.hatC || '#f2c94c'; g.beginPath(); g.arc(x, yy - 8.6, 3, Math.PI, 0); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.6; g.stroke(); }
    else { g.fillStyle = o.hair || '#2a2230'; g.beginPath(); g.arc(x, yy - 8.4, 2.9, Math.PI, 0); g.fill(); }
  }

  // ---------- 木 ----------
  function tree(t, sd, kind) {
    const sw = Math.sin(t * 1.3 + sd) * 1.1;
    shadow(3, 8, 8, 2.6, 0.28);
    g.fillStyle = hg(-2, 2, '#8a6038', '#5a3a22'); g.fillRect(-1.6, -1, 3.2, 9); g.strokeStyle = OL; g.lineWidth = 0.6; g.strokeRect(-1.6, -1, 3.2, 9);
    if (kind === 'pine') {
      for (const [dy, hw, c] of [[3, 9, '#2a5236'], [-3, 7.5, '#33653f'], [-9, 5.8, '#3d7648'], [-14, 4, '#478652']]) { face([[-hw + sw * 0.2, dy + 3], [hw + sw * 0.2, dy + 3], [sw * 0.6, dy - 7]], hg(-hw, hw, S(c, 1.15), S(c, 0.8)), OL, 0.7); }
      return;
    }
    for (const [ox, oy, r, c] of [[-3, -1, 6.2, '#2f6e3a'], [4, -2, 5.6, '#2c6836'], [0, -6, 7.2, '#3b8044'], [-2, -9, 4.4, '#4a9650']]) { dot(ox + sw, oy, r, S(c, 0.85)); }
    for (const [ox, oy, r, c] of [[-3, -1, 6.2, '#2f6e3a'], [4, -2, 5.6, '#2c6836'], [0, -6, 7.2, '#3b8044'], [-2, -9, 4.4, '#4a9650']]) { g.beginPath(); g.arc(ox + sw, oy, r, 0, 7); g.fillStyle = vg(oy - r, oy + r, S(c, 1.22), S(c, 0.85)); g.fill(); g.strokeStyle = 'rgba(20,50,25,.55)'; g.lineWidth = 0.6; g.stroke(); }
    dot(-2 + sw, -10, 1.8, 'rgba(255,255,255,.2)');
  }

  // ---------- 住宅 ----------
  function house(t, k, up, st) {
    const walls = (st && st.walls) || ['#f2e6d0', '#e8d8bc', '#e0e6d0', '#f0e4b8', '#d8e0e8'], roofs = (st && st.roofs) || ['#7a5a50', '#8a4a40', '#4a5a78', '#6a5a7a'];
    const wall = walls[k % walls.length], roof = roofs[(k * 3) % roofs.length], kind = (k * 7 + 3) % 5, on = (Math.floor(t / 5) + k) % 3 !== 0;
    const w = 19 + (k % 3) * 2, h = 10 + (kind === 2 ? 5 : 0);
    const m = house3d(0, 12, { w, h, d: 5, wall, roof, rh: 8, ov: 2, baseC: '#8a8478' });
    door(-w * 0.18, 12 - 2.4, 4, 7, '#6a4a30'); shoji(w * 0.12, 12 - h + 3.5, 5, 4.2, on);
    if (kind === 2) shoji(-w * 0.3, 12 - h + 1.5, 4, 3.6, on);
    if (kind === 1) { chimney(w * 0.1, 12 - h - 5, 7); smoke(w * 0.1 + 2, 12 - h - 12, t, k * 0.17, '240,240,245', 2, 0.8); }
    if (kind === 3) { box(-w / 2 - 4, 11 - 6, 3, 6, '#8a5a30', OL); }
    if (kind === 4) { bush(-w / 2 - 3, 13, 3.4, '#5fa860'); }
    if (kind === 0) { dot(w / 2 - 2, 12.5, 1.2, '#f06a8a'); dot(w / 2 - 4, 12.8, 1.2, '#ffd54f'); }
  }

  const ctx = () => g;
  return { use, ctx, lights, S, M, OL, vg, hg, lit, path, face, box, ell, dot, line, shadow, glow, light, abs, tileTexture, hipRoof, house3d, door, shoji, noren, lantern, chimney, smoke, sparks, barrel, crate, sack, logs, rock, bush, person, tree, house };
})();
