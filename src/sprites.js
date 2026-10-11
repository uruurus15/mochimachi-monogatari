// 建物・施設・街の目印の絵 (ART の部品で描く)。town.js と world.js と tools/gallery.html が使う。
// 各スプライトは (t=時間(秒), sd=個体差, act=稼働中か, prog=進み具合 0..1, c=配色) で呼び、原点=スロットの中心・足元は y=+13 付近。
'use strict';
const SPRITES = (function () {
  const { S, M, OL, vg, hg, face, box, ell, dot, line, shadow, light, house3d, hipRoof, door, shoji, noren, lantern, chimney, smoke, sparks, barrel, crate, sack, logs, rock, bush, person, tileTexture } = ART;
  const sp = fn => (t, sd, act, prog, c) => fn(ART.ctx(), t, sd || 0, !!act, prog || 0, c || {});
  const SPR = {};

  // ---------- もちの里 ----------
  SPR.paddy = sp((g, t, sd, act, prog) => {                       // 水を張った田んぼ + 育つ稲
    shadow(2, 13, 21, 4.5, 0.25);
    g.beginPath(); g.roundRect(-20, -12, 40, 26, 5); g.fillStyle = vg(-12, 14, '#b08850', '#7a5630'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.roundRect(-17.5, -9.5, 35, 21, 3.5); g.fillStyle = vg(-9.5, 11.5, '#93d3ec', '#4f9fc8'); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-6 + Math.sin(t * 0.3 + sd) * 3, -6.5, 8, 1.7, 0, 0, 7); g.fill();
    const h = 3.2 + prog * 5;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = -13 + c * 6.6 + (r % 2) * 2.4, y = -3 + r * 6.4, sw = Math.sin(t * 1.8 + sd + c + r) * (act ? 1.5 : 0.7);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x, y + 1.6, 2.6, 0.9, 0, 0, 7); g.fill();
      for (const [dx, hh] of [[-1.2, 0.8], [0, 1], [1.2, 0.85]]) { g.strokeStyle = vg(y - h, y + 1, '#a6df63', '#4f9a35'); g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + dx, y + 1); g.quadraticCurveTo(x + dx + sw * 0.3, y - h * hh * 0.5, x + dx + sw, y - h * hh); g.stroke(); }
    }
    if (sd % 3 < 1) { line(15, 12, 15, 2, '#6a4a2a', 1.2); line(11, 5, 19, 5, '#6a4a2a', 1.2); face([[12, 3], [18, 3], [17, -1], [13, -1]], '#c9a45a', OL, 0.6); dot(15, -3, 2, '#e8c8a0'); }
  });

  SPR.mill = sp((g, t, sd, act) => {                              // 水車小屋: 回る水車と木の樋
    const m = house3d(5, 12, { w: 20, h: 11, d: 5, wall: '#e8e0cc', roof: '#5b6b82', rh: 8, ov: 2.5, baseC: '#7d8089' });
    door(9, 9.6, 4.2, 7.2, '#5a3a22'); shoji(0, 4.5, 4.5, 4, false);
    box(-23, 3, 14, 2.4, '#8a6a45', OL); for (const x of [-21, -14]) box(x, 5.4, 1.6, 8, '#6a4a2a', OL);
    g.save(); g.translate(-13, 4); g.rotate(act ? t * 1.3 + sd : sd);
    g.strokeStyle = '#6a4222'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 8.5, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); line(0, 0, 8.5, 0, '#8a5a30', 1.3); box(7.4, -1.8, 3.6, 3.6, '#a8743c', OL); }
    g.restore(); dot(-13, 4, 2.2, '#4a2e18'); dot(-13.6, 3.4, 0.8, '#a8743c');
    if (act) for (let i = 0; i < 4; i++) { const p = (t * 1.4 + i / 4 + sd) % 1; dot(-20 + i * 1.5, 6 + p * 8, 0.9, `rgba(190,230,255,${1 - p})`); }
  });

  SPR.mochiya = sp((g, t, sd, act) => {                           // 餅屋: 赤い瓦と暖簾、店先の臼と杵
    house3d(-2, 12, { w: 24, h: 12, d: 6, wall: '#fbf3e4', roof: '#c0473f', rh: 9, ov: 3.5, baseC: '#9a8f80' });
    noren(-4, 4.2, 12, 6.5, '#d94a42', t, sd, true); box(-12, 0.8, 3.6, 5, '#fff7e8', OL, 1); dot(-10.2, 3.3, 1.2, '#ffb3c6');
    shoji(6, 3.6, 5, 4.4, (Math.floor(t / 5) + sd) % 3 !== 0); dot(3, -4.2, 2.6, '#fff'); dot(3, -4.2, 1.2, '#f28aa6');
    barrel(15, 13, 3.8, '#9a8a78', 0, true); ell(15, 8.2, 3.2, 1.2, '#f7d6df', OL);
    const sw = act ? Math.abs(Math.sin(t * 4.5 + sd)) : 0.3; g.save(); g.translate(15, 5); g.rotate(-0.35 + sw * 0.45); line(0, 0, 0, -12, '#a0784a', 2); box(-3, -15, 6, 5.5, '#b48a56', OL, 1.4); g.restore();
    person(21, 11, t, sd, { body: '#d9534f', hat: 'eboshi', walk: false });
    if (act) smoke(-8, -6, t, sd / 7, '255,255,255', 3, 0.8);
  });

  SPR.grove = sp((g, t, sd, act, prog) => {                       // 竹: 節のある幹としなる葉
    shadow(2, 13, 15, 3.4, 0.28);
    const sw = Math.sin(t * (act ? 2.2 : 1.1) + sd) * (act ? 3.2 : 1.6), gr = 0.78 + 0.22 * prog, cols = ['#7fcf6a', '#68b95a', '#8bd871'];
    for (let i = 0; i < 7; i++) {
      const bx = -12 + i * 4 + (i % 2) * 1.2, h = (24 + (i * 7 % 11)) * gr, tx = bx + sw * h / 28, c = cols[i % 3];
      g.strokeStyle = 'rgba(30,60,28,.8)'; g.lineWidth = 3.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, 13); g.quadraticCurveTo((bx + tx) / 2 - 1, 13 - h / 2, tx, 13 - h); g.stroke();
      g.strokeStyle = c; g.lineWidth = 2.6; g.beginPath(); g.moveTo(bx, 13); g.quadraticCurveTo((bx + tx) / 2 - 1, 13 - h / 2, tx, 13 - h); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx - 0.8, 13); g.quadraticCurveTo((bx + tx) / 2 - 1.8, 13 - h / 2, tx - 0.8, 13 - h); g.stroke();
      for (let j = 1; j < 4; j++) { const f = j / 4, nx = bx + (tx - bx) * f - (1 - f) * f * 1, ny = 13 - h * f; line(nx - 1.6, ny, nx + 1.6, ny, '#356a30', 0.9); }
      for (const [dx, dy, a] of [[3.6, 1.8, -0.5], [-3.6, 5, 0.5], [3, 9, -0.35]]) { g.fillStyle = vg(13 - h, 13, '#8be070', '#4d9a45'); g.beginPath(); g.ellipse(tx + dx, 13 - h + dy, 5.4, 1.9, a + sw * 0.04, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,70,30,.5)'; g.lineWidth = 0.5; g.stroke(); }
    }
    for (const x of [-15, 14]) { line(x, 13, x + 0.6, 9, '#7fcf6a', 1.6); dot(x + 0.6, 8.6, 1, '#a6e68a'); }
  });

  SPR.sawmill = sp((g, t, sd, act) => {                           // 製材所: 吹きさらしの小屋・丸鋸・丸太
    shadow(2, 13, 22, 4.5, 0.28);
    for (const x of [-16, 14]) box(x, -4, 3, 17, '#8a6038', OL);
    hipRoof(-1, -4, 28, 8, '#6b4a30', 3, 5);
    box(-12, 7, 22, 6, '#a87a48', OL); g.strokeStyle = 'rgba(70,40,20,.5)'; g.lineWidth = 0.7; for (let i = -10; i < 10; i += 5) { g.beginPath(); g.moveTo(i, 7); g.lineTo(i, 13); g.stroke(); }
    g.save(); g.translate(-1, 4); g.rotate(act ? t * 9 + sd : 0); dot(0, 0, 6.6, '#d8dde4'); g.strokeStyle = OL; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 6.6, 0, 7); g.stroke();
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); face([[5.8, -1.1], [8.2, 0], [5.8, 1.1]], '#aab2bc', null); } dot(0, 0, 1.6, '#555'); g.restore();
    logs(-19, 13, 3, 3); logs(20, 13, 4, 2.8);
    if (act) { for (let i = 0; i < 5; i++) { const p = (t * 1.6 + i / 5 + sd) % 1; g.fillStyle = `rgba(240,215,160,${1 - p})`; g.fillRect(5 + p * 10, 4 - p * 8 + p * p * 12, 1.4, 1.4); } person(10, 8, t, sd, { body: '#4a6fa5', hat: 'cap', hatC: '#e8d28a', walk: false }); }
  });

  SPR.claypit = sp((g, t, sd, act) => {                           // 粘土採り: 層になった穴と作業員・手押し車
    shadow(2, 13, 22, 5, 0.25);
    ell(2, 8, 20, 9.5, '#c98a58', OL); ell(2, 8.6, 16.5, 7.4, '#a8683a'); ell(2, 9.2, 12.5, 5.4, '#7a4a28'); ell(2, 9.8, 8, 3.4, '#4f3018');
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(2, 7.2, 18, 8, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
    const sw = act ? Math.sin(t * 4 + sd) : 0;
    person(-13, 9, t, sd, { body: '#4a6fa5', hat: 'cap', hatC: '#f2c94c', walk: false });
    g.save(); g.translate(-9.5, 4); g.rotate(act ? -1.1 + (sw + 1) * 0.95 : -0.5); line(0, 0, 11, 0, '#8a6a45', 1.6); face([[10, -3.4], [14, 0], [10, 3.4]], '#aab2bc', OL, 0.6); g.restore();
    for (const [x, y, r] of [[16, 11, 3.6], [19.5, 12.5, 3], [13, 12.5, 2.6]]) dot(x, y, r, '#d9955f'); g.strokeStyle = OL; g.lineWidth = 0.6;
    face([[-4, 0], [4, 0], [3, 4], [-3, 4]], '#6a6a72', OL, 0.7); dot(-2.5, 5.2, 1.6, '#333');
  });

  SPR.kiln = sp((g, t, sd, act) => {                              // 瓦窯: 登り窯(段々のレンガの窯と煙突)
    shadow(3, 13, 22, 4.5, 0.28);
    box(10, -18, 6, 31, '#8a7a70', OL); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(9, -19, 8, 2.4);
    for (const [x, w, h] of [[-19, 13, 10], [-8, 14, 13], [4, 14, 16]]) {
      g.beginPath(); g.moveTo(x, 13); g.lineTo(x, 13 - h + 4); g.quadraticCurveTo(x + w / 2, 13 - h - 5, x + w, 13 - h + 4); g.lineTo(x + w, 13); g.closePath(); g.fillStyle = vg(13 - h, 13, '#d0705a', '#8f4a3c'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(60,20,14,.4)'; g.lineWidth = 0.7; for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(x + 1, 13 - 2 - r * 3.4); g.lineTo(x + w - 1, 13 - 2 - r * 3.4); g.stroke(); }
      const fl = act ? 0.65 + 0.35 * Math.sin(t * 8 + x) : 0.15; g.fillStyle = '#241410'; g.beginPath(); g.arc(x + w / 2, 13, 3.4, Math.PI, 0); g.fill();
      g.fillStyle = `rgba(255,${150 + 60 * fl | 0},60,${0.35 + fl * 0.6})`; g.beginPath(); g.arc(x + w / 2, 13, 2.6, Math.PI, 0); g.fill(); if (act) light(x + w / 2, 11, 13, 'rgba(255,140,60,A)');
    }
    if (act) smoke(13, -19, t, sd / 5, '90,90,98', 4, 1.1);
    for (let i = 0; i < 3; i++) box(-24 + i * 2, 11 - i * 2.4, 5, 2.4, '#b8604a', OL);
  });

  SPR.brewery = sp((g, t, sd, act) => {                           // 酒蔵: 白壁(なまこ壁)の蔵・黒瓦・杉玉・樽
    const m = house3d(1, 12, { w: 26, h: 14, d: 6, wall: '#f4f1ea', roof: '#454a56', rh: 10, ov: 3, baseC: '#6a6a70', beams: false });
    g.save(); g.beginPath(); g.rect(-12, -2, 26, 11.6); g.clip(); g.strokeStyle = 'rgba(40,40,50,.55)'; g.lineWidth = 0.9; for (let i = -16; i < 30; i += 4.5) { g.beginPath(); g.moveTo(i - 14, 10); g.lineTo(i, -2); g.stroke(); g.beginPath(); g.moveTo(i, 10); g.lineTo(i - 14, -2); g.stroke(); } g.restore();
    door(3, 9.6, 6, 8.5, '#3a2a22'); line(-8, -1.5, -8, 2.5, '#5a3a22', 1); dot(-8, 4.2, 3, '#6a8a3a'); g.strokeStyle = 'rgba(30,60,20,.6)'; g.lineWidth = 0.6; g.beginPath(); g.arc(-8, 4.2, 3, 0, 7); g.stroke();
    barrel(-17, 13, 3.8, '#a3703a'); barrel(21, 13, 3.8, '#a3703a'); barrel(25, 13, 3.4, '#8f6030');
    face([[-14, -8.4], [-9, -8.4], [-11.5, -12]], '#e0c27a', OL, 0.6); if (act) smoke(8, -10, t, sd / 11, '255,255,255', 3, 0.8);
  });

  SPR.tea = sp((g, t, sd, act) => {                               // 茶畑: かまぼこ形の茶の畝と摘み手
    shadow(2, 13, 21, 4, 0.22);
    g.beginPath(); g.roundRect(-20, -12, 40, 26, 5); g.fillStyle = vg(-12, 14, '#8a6a44', '#5e4630'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    for (let r = 0; r < 3; r++) {
      const y = -6 + r * 8.5; g.beginPath(); g.moveTo(-17, y + 4); g.quadraticCurveTo(-17, y - 2, -11, y - 2.4); g.lineTo(11, y - 2.4); g.quadraticCurveTo(17, y - 2, 17, y + 4); g.closePath();
      g.fillStyle = vg(y - 3, y + 4, '#79c26a', '#2f7a3d'); g.fill(); g.strokeStyle = 'rgba(20,60,25,.6)'; g.lineWidth = 0.8; g.stroke();
      for (let i = 0; i < 9; i++) dot(-14 + i * 3.6 + (r % 2), y - 0.8 + (i % 2) * 0.8, 0.9, 'rgba(255,255,255,.22)');
    }
    if (act) { const px = -14 + ((t * 7 + sd * 7) % 28); person(px, 10, t, sd, { body: '#c0504d', hat: 'kasa', walk: true }); }
  });

  SPR.pond = sp((g, t, sd, act) => {                              // 釣り堀: 石組みの池・鯉・睡蓮・釣り人
    shadow(2, 13, 24, 5, 0.25);
    ell(2, 6, 23, 12.5, '#6a645c', OL); ell(2, 6, 20.5, 10.4, vg(-4, 16, '#8fd0ea', '#3f8fb8'));
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-3, 1.5, 9, 2, 0, 0, 7); g.fill();
    for (const [x, y] of [[10, 9], [-8, 10], [14, 4]]) { ell(x, y, 3.6, 1.8, '#5fae5a', 'rgba(20,70,30,.6)'); dot(x + 0.6, y - 0.4, 0.9, '#f6b6d0'); }
    for (let i = 0; i < 3; i++) { const a = t * 0.7 + i * 2.1 + sd, fx = 2 + Math.cos(a) * 12, fy = 6 + Math.sin(a) * 5; g.save(); g.translate(fx, fy); g.rotate(a + 1.57); g.fillStyle = i === 1 ? '#fff4e6' : '#ff8a3c'; g.beginPath(); g.ellipse(0, 0, 3.4, 1.5, 0, 0, 7); g.fill(); g.fillStyle = i === 1 ? '#f2d0b0' : '#e0601e'; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(-5.4, -1.6); g.lineTo(-5.4, 1.6); g.closePath(); g.fill(); g.restore(); }
    for (const [x, y, s] of [[-20, 8, 4], [20, 1, 3.4], [-14, -4, 3.2]]) rock(x, y, s);
    box(-26, 6, 12, 2.6, '#9a7a4e', OL); person(-21, 4, t, sd, { body: '#4a6fa5', hat: 'kasa', walk: false });
    line(-17, -1, -4 + Math.sin(t * 1.5 + sd) * 2, -9, '#8a6a45', 1.1); line(-4 + Math.sin(t * 1.5 + sd) * 2, -9, -3, 5 + (act ? Math.sin(t * 6) * 0.8 : 0), 'rgba(255,255,255,.7)', 0.6); dot(-3, 5.5, 1.3, '#e0453a');
    if (act) { const p = (t * 0.7 + sd) % 1; if (p < 0.28) { const u = p / 0.28; g.save(); g.translate(8, 6 - Math.sin(u * Math.PI) * 11); g.rotate(-0.6 + u * 1.2); g.fillStyle = '#ff9a4c'; g.beginPath(); g.ellipse(0, 0, 3.4, 1.6, 0, 0, 7); g.fill(); g.restore(); } }
  });

  SPR.teahouse = sp((g, t, sd, act) => {                          // 茶屋: 大きな瓦屋根・暖簾・赤い野点傘
    house3d(-2, 12, { w: 26, h: 12, d: 6, wall: '#efe0c4', roof: '#5a4038', rh: 9, ov: 4, baseC: '#8a8478' });
    noren(-5, 3.6, 13, 7.5, '#2f4a7a', t, sd, true); lantern(8, -0.5, t, sd);
    box(10, 8.5, 9, 2.4, '#8a5a30', OL); box(11, 10.8, 1.6, 2.4, '#6a4222'); box(17, 10.8, 1.6, 2.4, '#6a4222'); box(10, 7.4, 9, 1.4, '#d9483a', OL);
    line(24, 13, 24, -2, '#8a5a30', 1.3); g.fillStyle = hg(16, 32, '#e8503f', '#a8302a'); g.beginPath(); g.moveTo(15.5, 0); g.quadraticCurveTo(24, -9, 32.5, 0); g.closePath(); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke();
    if (act) smoke(-10, -8, t, sd / 7, '255,255,255', 3, 0.8);
  });

  SPR.kitchen = sp((g, t, sd, act) => {                           // 料理屋: 煙突の湯気・縞の庇・弁当の看板
    house3d(-1, 12, { w: 26, h: 12, d: 6, wall: '#f4e4c8', roof: '#c8682f', rh: 9, ov: 3, baseC: '#8a8478' });
    chimney(8, -2, 11, '#8a6a5a'); if (act) smoke(10, -13, t, sd / 9, '255,255,255', 3, 1);
    for (let i = 0; i < 7; i++) { const x = -13 + i * 3.6; g.fillStyle = i % 2 ? '#fff' : '#e8892f'; g.beginPath(); g.moveTo(x, 1.4); g.lineTo(x + 3.6, 1.4); g.lineTo(x + 3.6, 5.2); g.lineTo(x, 5.2); g.closePath(); g.fill(); } g.strokeStyle = OL; g.lineWidth = 0.7; g.strokeRect(-13, 1.4, 25.2, 3.8);
    door(-7, 9.6, 4.6, 7.4, '#6a4a30'); box(1, 5.6, 9, 4.4, '#fff8e8', OL, 1); g.fillStyle = '#c0504d'; g.fillRect(2.4, 7, 2.6, 1.6); g.fillStyle = '#6aa66a'; g.fillRect(5.6, 7, 2.6, 1.6);
    const fl = act ? 0.6 + 0.4 * Math.sin(t * 9 + sd) : 0.2; g.fillStyle = `rgba(255,170,60,${fl})`; g.fillRect(12, 6, 3, 3.4); if (act) light(13.5, 7.6, 10);
    for (let i = 0; i < 3; i++) box(-16 + i * 3.4, 13 - i % 2 * 2.6, 3, 2.6, ['#e0b36a', '#c0504d', '#8a6a45'][i], OL);
  });

  SPR.pickle = sp((g, t, sd, act) => {                            // 漬物屋: 重石をのせた樽と胡瓜
    shadow(2, 13, 22, 4, 0.25);
    hipRoof(0, -3, 30, 8, '#6f8f55', 3, 5); for (const x of [-15, 13]) box(x, -3, 3, 16, '#8a6038', OL);
    for (const [x, c] of [[-9, '#a3703a'], [1, '#9a6a38'], [11, '#a3703a']]) { barrel(x, 13, 4.6, c, t, true); rock(x, 13 - 14.4, 3.2, '#8a8f98'); if (act) for (let i = 0; i < 2; i++) { const p = (t * 0.9 + i / 2 + sd + x) % 1; dot(x - 2 + i * 4, 4 - p * 9, 0.9, `rgba(190,235,160,${1 - p})`); } }
    ell(-18, 12.4, 4, 1.6, '#a07840', OL); for (let i = 0; i < 4; i++) { g.save(); g.translate(-20 + i * 2.2, 11.4); g.rotate(i * 0.4 - 0.6); g.fillStyle = '#5fae4a'; g.fillRect(-0.7, -3, 1.4, 5); g.restore(); }
  });

  SPR.smithy = sp((g, t, sd, act) => {                            // 鍛冶屋: 炉の火・金床・金槌・火花
    house3d(-3, 12, { w: 24, h: 12, d: 6, wall: '#78726c', roof: '#3a3634', rh: 9, ov: 3, baseC: '#5a5650', beams: false });
    chimney(5, -3, 15, '#5a5650'); if (act) smoke(7, -18, t, sd / 5, '70,70,76', 3, 1.2);
    const fl = act ? 0.7 + 0.3 * Math.sin(t * 10 + sd) : 0.25; box(-12, 4, 8, 7, '#1c1614', OL, 1); g.fillStyle = `rgba(255,${120 + 60 * fl | 0},40,${0.4 + fl * 0.6})`; g.beginPath(); g.roundRect(-11, 5.4, 6, 5, 1); g.fill(); if (act) light(-8, 8, 16, 'rgba(255,120,40,A)');
    face([[10, 13], [20, 13], [19, 9.6], [11, 9.6]], '#3a3a42', OL, 0.8); face([[8, 9.6], [22, 9.6], [20, 7.4], [10, 7.4]], '#55555e', OL, 0.8); box(13, 13, 4, 0, '#222');
    person(14, 6, t, sd, { body: '#8a3a30', hat: 'none', hair: '#2a2028', walk: false });
    const sw = act ? Math.abs(Math.sin(t * 5 + sd)) : 0.2; g.save(); g.translate(18, 3.4); g.rotate(-1.2 + sw * 1.4); line(0, 0, 0, -10, '#8a6a45', 1.8); box(-3.4, -13, 7, 4, '#6a6e78', OL, 1); g.restore();
    if (act && sw > 0.85) sparks(20, 8, t, sd, 6);
  });

  SPR.weaver = sp((g, t, sd, act) => {                            // 機織り小屋: 色糸を張った機と、すべる杼
    house3d(0, 12, { w: 26, h: 13, d: 6, wall: '#e6d3ae', roof: '#9a5446', rh: 9, ov: 3, baseC: '#8a8478' });
    box(-10, -1, 20, 11, '#8a6a45', OL, 1); box(-8.6, 0.4, 17.2, 8.2, '#f3e8d6', 'rgba(60,40,30,.6)', 0.5);
    const cols = ['#c06a9a', '#e0b36a', '#6a8fc0', '#7a5ac0', '#d9534f'];
    for (let i = 0; i < 11; i++) line(-7.6 + i * 1.55, 0.6, -7.6 + i * 1.55, 8.4, cols[i % 5], 0.9);
    const sx = act ? -7 + ((t * 12 + sd * 5) % 14) : 0; box(sx - 2.2, 4, 5.4, 2, '#fff', OL, 1); box(-8.6, 8.4, 17.2, 2.4, '#c06a9a', OL, 1);
    for (let i = 0; i < 3; i++) { const x = 15 + i * 2.6; g.fillStyle = cols[i]; g.fillRect(x, 2 + Math.sin(t * 1.5 + i) * 0.4, 2.2, 9); }
  });

  SPR.gilder = sp((g, t, sd, act) => {                            // 金箔工房: きらめく金の屋根
    house3d(-1, 12, { w: 26, h: 12, d: 6, wall: '#f2e8d0', roof: '#d9b84a', rh: 9, ov: 3, baseC: '#8a8478' });
    const gl = 0.5 + 0.5 * Math.sin(t * 2 + sd); g.fillStyle = `rgba(255,248,190,${0.2 + gl * 0.3})`; g.fillRect(-14, -3, 26, 3); door(-5, 9.6, 5, 8, '#6a4a30');
    box(8, 5, 8, 6, '#f6e08a', OL, 1); box(9.4, 3, 5.2, 3, '#e6c34a', OL, 1);
    for (let i = 0; i < 5; i++) { const p = (t * 0.7 + i / 5 + sd) % 1, x = -14 + i * 6, y = -8 + Math.sin(i * 3) * 3 - p * 5; if (act || p < 0.5) { g.globalAlpha = 1 - p; line(x - 2, y, x + 2, y, '#fff6c0', 1); line(x, y - 2, x, y + 2, '#fff6c0', 1); g.globalAlpha = 1; } }
    if (act) light(0, -4, 16, 'rgba(255,225,120,A)');
  });

  // ---------- 汎用の種類 ----------
  const KIND = {};
  KIND.plot = sp((g, t, sd, act, prog, c) => {                    // 畝に並ぶ作物と世話をする人
    shadow(2, 13, 21, 4, 0.22);
    g.beginPath(); g.roundRect(-20, -12, 40, 26, 5); g.fillStyle = vg(-12, 14, S(c.bed || '#7b5a3a', 1.15), S(c.bed || '#7b5a3a', 0.8)); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    const crop = c.crop || '#5fae4a';
    for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) { const x = -14 + q * 9.4, y = -5 + r * 8.6, sw = Math.sin(t * 1.6 + q + r + sd) * (act ? 1.3 : 0.6); dot(x + 0.8, y + 2, 4.4, 'rgba(20,10,5,.25)'); dot(x + sw * 0.3, y, 4.6, S(crop, 0.78)); dot(x + sw * 0.3 - 0.8, y - 1, 3.2, crop); dot(x + sw * 0.3 - 1.2, y - 1.8, 1.4, S(crop, 1.35)); }
    if (act) person(-14 + ((t * 7 + sd * 7) % 28), 11, t, sd, { body: '#4a6fa5', hat: 'kasa', walk: true });
  });
  KIND.pan = sp((g, t, sd, act) => {                              // 塩田: 白く結晶する浅い池と、熊手の人
    shadow(2, 13, 22, 4, 0.22);
    g.beginPath(); g.roundRect(-21, -12, 42, 26, 4); g.fillStyle = vg(-12, 14, '#a08a5e', '#6a5838'); g.fill(); g.strokeStyle = OL; g.stroke();
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const x = -19 + i * 20, y = -10 + j * 13.5; g.beginPath(); g.roundRect(x, y, 18, 11.5, 2); g.fillStyle = vg(y, y + 11.5, '#dff2f8', '#a8d4e4'); g.fill(); g.strokeStyle = 'rgba(60,40,24,.5)'; g.lineWidth = 0.7; g.stroke(); g.fillStyle = `rgba(255,255,255,${0.55 + 0.25 * Math.sin(t * 1.5 + i + j * 2 + sd)})`; g.fillRect(x + 2, y + 2, 14, 7.5); for (let k = 0; k < 4; k++) dot(x + 4 + k * 3.4, y + 5 + (k % 2) * 2, 0.8, 'rgba(120,150,170,.4)'); }
    if (act) { const x = -16 + ((t * 8 + sd * 5) % 32); person(x, 10, t, sd, { body: '#c0504d', hat: 'kasa', walk: true }); line(x + 4, 2, x + 4, 11, '#6a4a2a', 1.2); line(x + 1, 11, x + 7, 11, '#6a4a2a', 1.2); }
  });
  KIND.boat = sp((g, t, sd, act) => {                             // 桟橋と、波に揺れる漁船
    ell(2, 12, 24, 5, 'rgba(255,255,255,.22)');
    box(-24, 4, 17, 3.4, '#9a7a4e', OL); for (let i = 0; i < 3; i++) box(-22 + i * 7, 7, 2.4, 8, '#5a3a1a', OL);
    const bob = Math.sin(t * 1.7 + sd) * 2, tilt = Math.sin(t * 1.3 + sd) * 0.06;
    g.save(); g.translate(4, 4 + bob); g.rotate(tilt);
    g.beginPath(); g.moveTo(-17, -3); g.quadraticCurveTo(-18, 5, -11, 8); g.lineTo(11, 8); g.quadraticCurveTo(18, 5, 19, -4); g.closePath(); g.fillStyle = vg(-3, 8, '#b07a4a', '#6a4220'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    box(-15, -3.8, 33, 2, '#e8c890', OL); box(-1, -24, 2, 21, '#5a3a1a', OL);
    g.beginPath(); g.moveTo(1, -23); g.quadraticCurveTo(15 + Math.sin(t * 3 + sd), -14, 14, -6); g.lineTo(1, -6); g.closePath(); g.fillStyle = vg(-23, -6, '#ffffff', '#e0d8c4'); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke();
    box(-11, -9, 6, 5, '#c0504d', OL); dot(-8, -12, 2.4, SKIN_); g.restore();
    if (act) { const p = (t * 0.8 + sd) % 1; g.strokeStyle = `rgba(255,255,255,${1 - p})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(-8, 12, 4 + p * 8, 1.5 + p * 3, 0, 0, 7); g.stroke(); if (p < 0.25) { const u = p / 0.25; g.fillStyle = '#ffb27a'; g.beginPath(); g.ellipse(14, 8 - Math.sin(u * Math.PI) * 10, 3, 1.5, -0.6 + u, 0, 7); g.fill(); } }
  });
  const SKIN_ = '#f3d2b0';
  KIND.rack = sp((g, t, sd, act, prog, c) => {                    // 干し場: 竿に吊るした昆布/干物/布が風に揺れる
    shadow(2, 13, 22, 3.8, 0.22);
    for (const x of [-19, 16]) box(x, -11, 3.2, 25, '#7a5430', OL); box(-19, -11, 38, 3.2, '#9a6e40', OL); box(-19, 2, 38, 2.4, '#9a6e40', OL);
    for (let i = 0; i < 6; i++) { const x = -14 + i * 5.6, sw = Math.sin(t * 1.7 + i * 0.8 + sd) * (act ? 2 : 0.8), col = i % 2 ? (c.a || '#c06a9a') : (c.b || '#6a8fc0'); g.beginPath(); g.moveTo(x, -8); g.lineTo(x + 4.4, -8); g.lineTo(x + 4.4 + sw, 6 + (i % 2) * 4); g.lineTo(x + sw, 6 + (i % 2) * 4); g.closePath(); g.fillStyle = hg(x, x + 4.4, S(col, 1.18), S(col, 0.82)); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.7; g.stroke(); }
    if (act) for (let i = 0; i < 2; i++) { const p = (t * 0.7 + i / 2 + sd) % 1; dot(-8 + i * 14, 9 + p * 5, 1, `rgba(190,220,255,${1 - p})`); }
  });
  KIND.cottage = sp((g, t, sd, act, prog, c) => {                 // 煙突のある小屋と看板
    house3d(-1, 12, { w: 26, h: 12, d: 6, wall: c.wall || '#e8dcc4', roof: c.roof || '#4a6f8f', rh: 9, ov: 3, baseC: '#8a8478' });
    chimney(8, -2, 11); door(-6, 9.6, 5, 7.6, '#6a4a30'); shoji(2, 4, 6, 4.8, act);
    g.font = '10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; box(-9, 0, 5, 4, '#fff8e8', OL, 1); g.fillText(c.sign || '🏠', -6.4, 2.4); if (act) smoke(10, -12, t, sd / 6, '255,255,255', 3, 0.9);
  });
  KIND.mine = sp((g, t, sd, act, prog, c) => {                    // 坑道の入り口と、レールを走るトロッコ
    shadow(2, 13, 24, 4, 0.28);
    g.beginPath(); g.moveTo(-23, 14); g.quadraticCurveTo(-4, -26, 23, 14); g.closePath(); g.fillStyle = vg(-18, 14, '#9a9ca4', '#666870'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-8, -12, 0, -14); g.lineTo(-4, -5); g.closePath(); g.fill();
    g.fillStyle = '#16161c'; g.beginPath(); g.arc(-1, 14, 9.5, Math.PI, 0); g.fill(); box(-12, 3, 3, 11, '#8a6038', OL); box(9, 3, 3, 11, '#8a6038', OL); box(-13, 1.6, 26, 3.2, '#9a6e40', OL);
    box(-20, 13, 42, 2, '#5a4a3a', OL); for (let i = 0; i < 7; i++) box(-18 + i * 6, 14.4, 1.6, 1.6, '#3a2a1a');
    const cx = -16 + ((t * 13 + sd * 5) % 34); if (act || prog > 0) { face([[cx - 6.5, 6], [cx + 6.5, 6], [cx + 5, 12.4], [cx - 5, 12.4]], '#5a5f68', OL, 0.8); for (let i = 0; i < 3; i++) dot(cx - 3.4 + i * 3.4, 5.4, 2.4, c.ore || '#8a8f98'); dot(cx - 3, 13.4, 1.8, '#222'); dot(cx + 3, 13.4, 1.8, '#222'); }
    for (let i = 0; i < 5; i++) dot(15 + (i % 3) * 3.4, 12 - Math.floor(i / 3) * 3.6, 3, c.ore || '#8a8f98');
    if (act) light(-1, 10, 10, 'rgba(255,200,110,A)');
  });
  KIND.logcamp = sp((g, t, sd, act) => {                          // 丸太小屋と、薪割り
    house3d(-4, 12, { w: 22, h: 12, d: 6, wall: '#a8703c', roof: '#4a3a2a', rh: 8, ov: 3, baseC: '#6a5a48', beams: false });
    g.strokeStyle = 'rgba(60,34,16,.55)'; g.lineWidth = 0.9; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-15, 1.6 + i * 2.4); g.lineTo(7, 1.6 + i * 2.4); g.stroke(); } door(-1, 9.6, 5, 8, '#3a2a1a'); shoji(-11, 5, 4, 3.6, act);
    logs(15, 13, 4, 2.9); box(-24, 8, 7, 5, '#8a5a30', OL); dot(-20.5, 8, 3.5, '#d9a66a');
    g.save(); g.translate(-20, 6.4); g.rotate(act ? -0.9 + Math.abs(Math.sin(t * 4 + sd)) * 1.5 : -0.3); line(0, 0, 0, -11, '#8a6a45', 1.8); face([[-3, -11], [4, -11], [1, -15.4]], '#aab2bc', OL, 0.7); g.restore();
    if (act) { for (let i = 0; i < 3; i++) { const p = (t * 2 + i / 3 + sd) % 1; g.fillStyle = `rgba(230,200,150,${1 - p})`; g.fillRect(-22 + p * 8, 6 - p * 6 + p * p * 8, 1.6, 1.2); } }
  });
  KIND.yard = sp((g, t, sd, act) => {                             // 資材場: 板と丸太の山、クレーンで建材をつり上げる
    shadow(2, 13, 25, 4.5, 0.28);
    for (let i = 0; i < 4; i++) box(-23, 8 - i * 3.3, 24, 3, i % 2 ? '#d8b27a' : '#c79c62', OL);
    g.strokeStyle = 'rgba(80,50,20,.4)'; g.lineWidth = 0.6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-21, 9.5 - i * 3.3); g.lineTo(-3, 9.5 - i * 3.3); g.stroke(); }
    logs(15, 13, 4, 2.9);
    box(-3, -15, 3.2, 28, '#6a4a2a', OL); line(-1.4, -13, 15, -13, '#7a5a3a', 2); line(-1.4, -13, 9, -4, '#7a5a3a', 1.2);
    const sw = act ? Math.sin(t * 2 + sd) * 2.4 : 0, by = act ? -3 + Math.sin(t * 3 + sd) * 2.6 : 5;
    line(14, -13, 14 + sw * 0.4, by - 4, '#3a3028', 0.9); box(10 + sw, by - 4, 9, 4, '#d8b27a', OL); box(11 + sw, by - 0.4, 7, 2.6, '#c79c62', OL);
    face([[-1.4, -15], [6, -13.5], [-1.4, -11.5]], '#e0584a', OL, 0.7);
    if (act) light(4, 2, 9, 'rgba(255,215,130,A)');
  });
  KIND.onsen = sp((g, t, sd, act) => {                            // 湯けむりの上がる露天風呂
    shadow(2, 13, 24, 5, 0.25);
    ell(1, 7, 23, 11.5, '#8a8f98', OL); ell(1, 7, 20, 9.2, vg(-3, 16, '#bff0f2', '#69c2cf'));
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-4 + Math.sin(t + sd) * 2, 5, 7, 1.8, 0, 0, 7); g.fill();
    for (const [x, y, s] of [[-19, 9, 4], [20, 4, 3.6], [-10, 16, 3]]) rock(x, y, s, '#9a9aa2');
    for (const x of [-18, 17]) box(x, -9, 3, 15, '#7a5430', OL); hipRoof(0, -9, 36, 7, '#7a5a40', 3, 5);
    dot(3, 5, 2.8, SKIN_); dot(3, 4.4, 3, '#2a2230'); g.fillStyle = SKIN_; g.beginPath(); g.arc(3, 5, 2.6, 0, 7); g.fill();
    smoke(-8, 3, t, sd, '255,255,255', 4, 1); if (act) smoke(9, 3, t, sd + 0.5, '255,255,255', 3, 1);
  });

  // 汎用: 建物の絵の指定(BUILDINGS[id].spr)を実際の描画関数にする
  const generic = () => sp((g) => { house3d(0, 12, { w: 24, h: 12, wall: '#ddd', roof: '#888' }); });
  function spriteOf(id) {
    const spec = BUILDINGS[id] && BUILDINGS[id].spr;
    if (spec && spec.like && SPR[spec.like]) return SPR[spec.like];
    if (spec && spec.k && KIND[spec.k]) return (t, sd, act, prog) => KIND[spec.k](t, sd, act, prog, spec);
    return SPR[id] || generic();
  }

  return { SPR, KIND, spriteOf };
})();
