// 街の目印の絵 (役所・交易所・噴水・石灯籠・天守・荷車)。art.js の部品で描く。
// 各関数は、原点=その物の足元の中心(y=0が地面)として描く。呼び出し側が translate する。
'use strict';
const LAND = (function () {
  const { S, M, OL, vg, hg, face, box, ell, dot, line, shadow, light, door, lantern, barrel, crate, sack, rock, bush, person, tileTexture, glow } = ART;
  const g0 = () => ART.ctx();

  // 家紋(三つの円: お餅をかたどった紋)
  function crest(x, y, r, c) { const g = g0(); dot(x, y, r, '#fff8ea'); g.strokeStyle = S(c, 0.7); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; dot(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.34, c); } }
  // 瓦の屋根(反り返る軒つき): cx 中心, y 軒の高さ, hw 半幅, rh 高さ, 色, 縁取りの色
  function kawara(cx, y, hw, rh, c, trim) {
    const g = g0(), top = hw * 0.62;
    const front = [[cx - hw, y + 4], [cx - hw + 3, y + 1], [cx - top, y - rh], [cx + top, y - rh], [cx + hw - 3, y + 1], [cx + hw, y + 4]];
    g.beginPath(); g.moveTo(front[0][0], front[0][1]); g.quadraticCurveTo(cx - hw + 1, y + 4.5, cx - hw + 5, y + 2); for (let i = 1; i < front.length - 1; i++) g.lineTo(front[i][0], front[i][1]); g.lineTo(cx + hw - 5, y + 2); g.quadraticCurveTo(cx + hw - 1, y + 4.5, cx + hw, y + 4); g.closePath();
    g.fillStyle = vg(y - rh, y + 4, S(c, 1.22), S(c, 0.86)); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.lineJoin = 'round'; g.stroke();
    tileTexture(front, 3, 0.2, true); g.strokeStyle = S(c, 1.4); g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - top, y - rh); g.lineTo(cx + top, y - rh); g.stroke();
    if (trim) { g.strokeStyle = trim; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - hw + 2, y + 3.2); g.quadraticCurveTo(cx, y + 5.2, cx + hw - 2, y + 3.2); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - hw + 3, y + 4.4, hw * 2 - 6, 1.8);
  }
  function shachi(x, y, flip) { const g = g0(); g.save(); g.translate(x, y); g.scale(flip, 1); g.fillStyle = '#e6c34a'; g.strokeStyle = '#8a6a1a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-3, -4, -1, -8); g.quadraticCurveTo(2, -7, 3, -3); g.quadraticCurveTo(4, -1, 2, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }

  // ---------- 役所: 町の中心の大きな建物。屋根の縁と幟は街の色。雇った役人が前に並ぶ ----------
  const ROLE_LOOK = { merchant: { body: '#d9a63a', hat: 'eboshi' }, builder: { body: '#c0504d', hat: 'cap', hatC: '#f2c94c' }, upgrader: { body: '#4a6fa5', hat: 'cap', hatC: '#c9d3e0' }, scholar: { body: '#7a5aa0', hat: 'eboshi' }, treasurer: { body: '#4f8a5a', hat: 'kasa' }, courier: { body: '#e07a3a', hat: 'cap', hatC: '#e0e0e0' }, surveyor: { body: '#2f9aa0', hat: 'kasa' }, festival: { body: '#e06a9a', hat: 'none', hair: '#3a2a3a' } };
  function hall(t, th, officialIds) {
    const g = g0(), acc = th.accent, acc2 = th.accent2;
    shadow(2, 3, 58, 7, 0.32);
    // 石の基壇(二段)
    face([[-50, 0], [50, 0], [50, -7], [-50, -7]], vg(-7, 0, '#d4cdc1', '#9a9388'), OL); face([[-44, -7], [44, -7], [44, -13], [-44, -13]], vg(-13, -7, '#e0d9cd', '#aaa397'), OL);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.7; for (let x = -42; x < 44; x += 7) { g.beginPath(); g.moveTo(x, -13); g.lineTo(x, -7); g.stroke(); } for (let x = -48; x < 50; x += 8) { g.beginPath(); g.moveTo(x, -7); g.lineTo(x, 0); g.stroke(); }
    // 一階: 白壁・朱の柱・障子
    const yb = -13, h = 24;
    face([[-34, yb], [34, yb], [34, yb - h], [-34, yb - h]], vg(yb - h, yb, '#f8f3e8', '#d8d0bc'), OL);
    for (const x of [-34, -23, -12, 12, 23, 34]) { box(x - 1.8, yb - h, 3.6, h, '#c8442c', OL); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x - 1.4, yb - h, 0.9, h); }
    for (const x of [-28.5, -17.5, 17.5, 28.5]) { box(x - 3.6, yb - 17, 7.2, 10, '#fff4d0', 'rgba(60,40,30,.7)', 0.5); g.strokeStyle = 'rgba(80,55,40,.7)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, yb - 17); g.lineTo(x, yb - 7); g.moveTo(x - 3.6, yb - 12); g.lineTo(x + 3.6, yb - 12); g.stroke(); light(x, yb - 12, 14); }
    // 正面の大扉
    box(-8, yb - 17, 16, 17, '#5a3a22', OL, 1); line(0, yb - 17, 0, yb, '#2a1a10', 1); for (const x of [-5.5, -2.5, 2.5, 5.5]) for (const y of [-14, -9, -4]) dot(x, yb + y, 0.7, '#e6c34a');
    box(-9.5, yb - 19, 19, 2.6, '#c8442c', OL, 1);
    // 一階の屋根と二階
    kawara(0, yb - h, 50, 12, '#4c5260', acc);
    const y2 = yb - h - 12 + 1, h2 = 12;
    face([[-22, y2], [22, y2], [22, y2 - h2], [-22, y2 - h2]], vg(y2 - h2, y2, '#f8f3e8', '#d8d0bc'), OL);
    for (const x of [-22, 0, 22]) box(x - 1.6, y2 - h2, 3.2, h2, '#c8442c', OL);
    for (const x of [-11, 11]) { box(x - 4, y2 - 9, 8, 6.5, '#fff4d0', 'rgba(60,40,30,.7)', 0.5); light(x, y2 - 6, 11); }
    crest(0, y2 - 6, 4.2, acc);
    kawara(0, y2 - h2, 34, 11, '#454b58', acc);
    shachi(-27, y2 - h2 - 9, 1); shachi(27, y2 - h2 - 9, -1);
    // 軒の提灯
    const sw = Math.sin(t * 1.7) * 0.8; for (const x of [-40, -20, 20, 40]) lantern(x, yb - h + 3, t, x, '#d9483a');
    // 幟(のぼり): 街の色の旗
    for (const x of [-60, 60]) {
      line(x, 0, x, -50, '#6a4a30', 1.6); dot(x, -51, 1.5, '#e6c34a'); const wv = Math.sin(t * 2.2 + x) * 2;
      g.beginPath(); g.moveTo(x, -48); g.quadraticCurveTo(x + 6 + wv, -38, x + 4 + wv * 1.4, -22); g.lineTo(x + 12 + wv * 1.4, -22); g.quadraticCurveTo(x + 14 + wv, -38, x + 12, -48); g.closePath(); g.fillStyle = hg(x, x + 12, S(acc, 1.15), S(acc, 0.8)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke(); crest(x + 8 + wv * 0.6, -38, 2.8, '#ffffff');
    }
    // 庭の松と石灯籠
    for (const x of [-70, 70]) { g.save(); g.translate(x, -2); ART.tree(t, x, 'pine'); g.restore(); }
    // 役人: 基壇の前に並ぶ
    officialIds.forEach((id, i) => { const n = officialIds.length, x = (i - (n - 1) / 2) * 11, look = ROLE_LOOK[id] || {}; person(x, -3, t + i * 0.3, i, Object.assign({ walk: false }, look)); });
  }

  // ---------- 交易所: 街との窓口。街道がつながるほど木箱が増え、取引中は旗がはためく ----------
  function post(t, roadSum, trading) {
    const g = g0(); shadow(2, 4, 24, 5, 0.3);
    face([[-20, 4], [20, 4], [20, -16], [-20, -16]], vg(-16, 4, '#d8c3a0', '#a8946e'), OL);
    g.strokeStyle = 'rgba(70,45,32,.6)'; g.lineWidth = 1; for (const x of [-20, -6, 6, 20]) { g.beginPath(); g.moveTo(x, -16); g.lineTo(x, 4); g.stroke(); }
    ART.hipRoof(0, -16, 40, 10, roadSum ? '#3f6f8f' : '#6a7077', 4, 6);
    box(-6.5, -10, 13, 14, '#5a3a22', OL, 1); line(0, -10, 0, 4, '#2a1a10', 1); crest(0, -14.5, 3.4, roadSum ? '#d9a63a' : '#9a9a9a');
    line(17, -22, 17, -42, '#6a4a30', 1.6); const wv = trading ? Math.sin(t * 6) * 2 : 0.4;
    g.beginPath(); g.moveTo(17, -41); g.quadraticCurveTo(26 + wv, -39, 29 + wv * 1.4, -34); g.quadraticCurveTo(25 + wv, -30, 17, -30); g.closePath(); g.fillStyle = roadSum ? '#d9534f' : '#8a8f98'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke();
    for (let i = 0; i < Math.min(8, roadSum); i++) crate(-30 + (i % 4) * 7.5, 10 - Math.floor(i / 4) * 8, 3.4, i % 2 ? '#c8a46a' : '#a98650');
    light(-12, -6, 12);
  }

  // ---------- 噴水 ----------
  function fountain(t) {
    const g = g0(); shadow(1, 6, 23, 8, 0.25);
    ell(0, 3, 20, 10.5, vg(-8, 14, '#c7ccd2', '#7e8690'), OL); ell(0, 3, 16.8, 8.4, vg(-5, 12, '#7fd0ee', '#3f93c0'));
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8; for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; g.beginPath(); g.ellipse(0, 3, 4 + p * 12, 2 + p * 6, 0, 0, 7); g.globalAlpha = 1 - p; g.stroke(); g.globalAlpha = 1; }
    box(-2.8, -6, 5.6, 9, '#c0c6cc', OL, 1); ell(0, -6, 8, 3.4, vg(-10, -3, '#d4d9de', '#9aa2ac'), OL); ell(0, -6, 6, 2.3, '#8fd6f0');
    for (let i = 0; i < 9; i++) { const p = (t * 0.9 + i / 9) % 1, a = i / 9 * 6.283, r = p * 11; dot(Math.cos(a) * r, -10 - Math.sin(p * Math.PI) * 11 + p * p * 11 + Math.sin(a) * r * 0.35, 1.3, `rgba(220,245,255,${1 - p * 0.7})`); }
    line(0, -9, 0, -17, '#cfe9f4', 1.2); dot(0, -18, 1.6, '#eaf8ff');
  }
  // ---------- 石灯籠 ----------
  function toro(t, sd) {
    const g = g0(); shadow(1, 4, 8, 2.4, 0.3);
    box(-6, 0, 12, 4, '#9a9aa2', OL, 1); box(-2.2, -9, 4.4, 9, '#aeaeb6', OL, 1); box(-6.5, -10.5, 13, 2, '#9a9aa2', OL, 1);
    box(-4.6, -18, 9.2, 7.6, '#8a8a94', OL, 1); g.fillStyle = `rgba(255,214,130,${0.65 + 0.3 * Math.sin(t * 3 + sd)})`; g.fillRect(-2.8, -16, 5.6, 4.4); light(0, -14, 15);
    face([[-8, -18], [8, -18], [4, -23], [-4, -23]], vg(-23, -18, '#b4b4bc', '#80808a'), OL, 1); dot(0, -24.4, 1.6, '#c0c0c8');
  }
  // ---------- 天守(大都の飾り) ----------
  function castle(t) {
    const g = g0(); shadow(0, 8, 70, 14, 0.28);
    ell(0, 4, 78, 40, '#4f9ac8', OL); ell(0, 4, 70, 34, '#b8a888');
    face([[-52, 8], [52, 8], [46, -8], [-46, -8]], vg(-8, 8, '#cfc8bc', '#8f887c'), OL); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.7; for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(-50 + r * 1.5, 6 - r * 3.6); g.lineTo(50 - r * 1.5, 6 - r * 3.6); g.stroke(); }
    let y = -8; const tiers = [[38, 16], [28, 14], [18, 12]];
    tiers.forEach(([hw, h], i) => { face([[-hw, y], [hw, y], [hw, y - h], [-hw, y - h]], vg(y - h, y, '#faf6ec', '#d8d0bc'), OL); for (const x of [-hw * 0.55, 0, hw * 0.55]) { box(x - 3, y - h + 4, 6, 6, '#3a3a46', OL, 0.8); light(x, y - h + 7, 9); } kawara(0, y - h, hw + 6, 9, i === 2 ? '#d9b84a' : '#4a4f5a', null); y = y - h - 8; });
    shachi(-14, y - 8, 1); shachi(14, y - 8, -1); line(0, y - 6, 0, y - 22, '#6a4a30', 1.4);
    const wv = Math.sin(t * 4) * 1.6; g.beginPath(); g.moveTo(0, y - 22); g.quadraticCurveTo(10 + wv, y - 20, 14 + wv, y - 15); g.lineTo(0, y - 12); g.closePath(); g.fillStyle = '#d9534f'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke();
    box(-8, -2, 16, 10, '#5a3a22', OL, 1);
  }
  // ---------- 荷車(引き手つき)。col=積荷の色(空荷は null) ----------
  function cart(x, y, dir, col, t, sd) {
    const g = g0(); g.save(); g.translate(x, y); g.scale(dir, 1);
    shadow(2, 6, 12, 2.2, 0.28);
    const spin = t * 6 + sd;
    g.beginPath(); g.roundRect(-10, -5, 20, 8, 1.5); g.fillStyle = vg(-5, 3, '#b07a44', '#6e4626'); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.9; g.stroke(); line(-10, -2, 10, -2, 'rgba(50,28,14,.5)', 0.7);
    if (col) { for (const [cx2, cy2, w2] of [[-5.5, -5, 4.4], [0, -5.4, 4.8], [5.5, -5, 4.4]]) { g.beginPath(); g.moveTo(cx2 - w2, cy2); g.quadraticCurveTo(cx2 - w2 * 1.1, cy2 - 4, cx2 - w2 * 0.5, cy2 - 5.4); g.lineTo(cx2 + w2 * 0.5, cy2 - 5.4); g.quadraticCurveTo(cx2 + w2 * 1.1, cy2 - 4, cx2 + w2, cy2); g.closePath(); g.fillStyle = hg(cx2 - w2, cx2 + w2, S(col, 1.15), S(col, 0.8)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke(); line(cx2 - 1.6, cy2 - 4.8, cx2 + 1.6, cy2 - 4.8, 'rgba(50,30,20,.5)', 0.7); } }
    for (const wx of [-6, 6]) { dot(wx, 3.4, 3.6, '#4a3020'); dot(wx, 3.4, 2.6, '#8a6038'); for (let i = 0; i < 4; i++) { const a = spin + i * 1.571; line(wx, 3.4, wx + Math.cos(a) * 2.6, 3.4 + Math.sin(a) * 2.6, '#3a2418', 0.7); } dot(wx, 3.4, 0.9, '#2a1a10'); }
    line(10, -2, 17, -1, '#6a4a2a', 1.4); person(20, -1, t * 1.2, sd, { body: '#8a6a45', hat: 'kasa', walk: true });
    g.restore();
  }
  return { hall, post, fountain, toro, castle, cart, crest, kawara };
})();
