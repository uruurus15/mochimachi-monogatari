// 万国もち博覧会・天下一もち大祭の絵(世界地図用)。art.js の部品で描く。ゲームの状態には触れない。
// 各関数は、原点=その物の足元の中心(y=0が地面)として描く。呼び出し側が translate する。ART.use(ctx) は呼び出し側が済ませておく。
'use strict';
const EXPO = (function () {
  const { S, M, OL, vg, face, box, ell, dot, line, shadow, glow, door, shoji, lantern, house3d } = ART;
  const g0 = () => ART.ctx();
  const GOLD = '#e6c34a', RED = '#c0463a';

  // 点線の予定地(まだ建てていない館): 土台の輪郭と旗
  function plot(t, ac) {
    const g = g0(); g.save(); g.globalAlpha = 0.75;
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.4; g.setLineDash([4, 4]); g.lineDashOffset = -t * 6; g.beginPath(); g.ellipse(0, 6, 22, 8, 0, 0, 7); g.stroke(); g.setLineDash([]);
    line(-14, 8, -14, -8, '#8a6a45', 1.4); face([[-14, -8], [-4, -5], [-14, -2]], ac, OL, 0.7);
    line(14, 8, 14, -8, '#8a6a45', 1.4); face([[14, -8], [4, -5], [14, -2]], ac, OL, 0.7);
    g.restore();
  }

  // 館(lvl1)・殿(lvl2): 街の色の幟を立てた金の屋根の会場
  function pavilion(t, ac, lvl, sd) {
    const g = g0(), W = lvl > 1 ? 34 : 28, H = lvl > 1 ? 14 : 12;
    shadow(2, 9, W * 0.85, 6, 0.3);
    face([[-W / 2 - 5, 9], [W / 2 + 5, 9], [W / 2 + 5, 4], [-W / 2 - 5, 4]], vg(4, 9, '#d8d2c6', '#9a9488'), OL);                                  // 石の基壇
    const m = house3d(0, 4, { w: W, h: H, d: 6, wall: '#f7f0e0', roof: lvl > 1 ? RED : GOLD, rh: lvl > 1 ? 11 : 9, ov: 3, baseC: '#a8a296', beams: true });
    g.fillStyle = ac; g.fillRect(m.x0 - 2.5, m.yt + 1.4, W + 5, 2.2);                                                                              // 軒下の街の色の帯
    door(0, 4, 8, 9, '#8a3a30'); shoji(-W / 2 + 4, 4 - H + 4, 5, 5, true); shoji(W / 2 - 9, 4 - H + 4, 5, 5, true);
    if (lvl > 1) {                                                                                                                                    // 二層目と提灯
      const m2 = house3d(0, m.ridge + 3, { w: W * 0.6, h: 8, d: 4, wall: '#f7f0e0', roof: RED, rh: 8, ov: 2.4, baseC: ac, beams: true });
      ART.dot(0, m2.ridge - 2, 2.2, GOLD);
      for (let i = -2; i <= 2; i++) lantern(i * 7, 2 - H + 4, t, sd + i, i % 2 ? '#ff8fb8' : '#d9483a');
    } else {
      line(W / 2 + 2, 4, W / 2 + 2, -26, '#6a4a2a', 1.6); const sw = Math.sin(t * 2 + sd) * 1.6;                                                      // 幟
      face([[W / 2 + 2, -26], [W / 2 + 14 + sw, -23], [W / 2 + 13 + sw, -12], [W / 2 + 2, -15]], ac, OL, 0.8);
      dot(W / 2 + 8 + sw * 0.5, -19, 2.4, 'rgba(255,255,255,.9)');
      ART.light(0, m.yt + 3, 16, 'rgba(255,215,130,A)');
    }
  }

  // 提灯の連なり(街道に沿って。大祭の殿を建てた分だけ増える)
  function festoon(pts, t, every = 46, col) {
    const g = g0(); let acc = 0, prev = pts[0], k = 0; const ps = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); acc += d; if (acc >= every) { acc = 0; ps.push(pts[i]); } }
    g.save(); g.lineWidth = 0.9; g.strokeStyle = 'rgba(60,40,30,.55)';
    ps.forEach((p, i) => { const q = ps[i + 1]; if (!q) return; g.beginPath(); g.moveTo(p.x, p.y - 15); g.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 - 9, q.x, q.y - 15); g.stroke(); });
    ps.forEach((p, i) => { const sw = Math.sin(t * 1.7 + i) * 0.8; line(p.x, p.y, p.x, p.y - 15, '#5a3a22', 1.1); const c = col || (i % 2 ? '#ff8fb8' : '#d9483a'); dot(p.x + sw, p.y - 12.5, 3, c); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.6; g.beginPath(); g.arc(p.x + sw, p.y - 12.5, 3, 3.6, 5.6); g.stroke(); });
    g.restore();
  }

  // 桜の花びら(世界地図全体に舞う)
  function petals(W, H, t, n = 46) {
    const g = g0(); g.save();
    for (let i = 0; i < n; i++) {
      const x = (i * 97 + t * (14 + (i % 5) * 3) + Math.sin(t + i) * 12) % W, y = (i * 53 + t * (20 + (i % 7) * 4)) % H, a = t * 1.5 + i;
      g.fillStyle = i % 3 ? 'rgba(255,196,220,.88)' : 'rgba(255,236,244,.9)'; g.beginPath(); g.ellipse(x, y, 3.2, 1.8, a, 0, 7); g.fill();
    }
    g.restore();
  }

  // 花火(会場の上で次々に開く)
  const FW = ['#ffd54f', '#ff8fb8', '#9be7ff', '#b2f5a0', '#ffffff'];
  function fireworks(t, n = 3) {
    const g = g0(); g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const P = 3.4 + k * 0.9, ph = (t / P + k * 0.37) % 1; if (ph > 0.55) continue;
      const id = Math.floor(t / P + k * 0.37), cx = ((id * 53 + k * 41) % 150) - 75, cy = -120 - ((id * 29 + k * 17) % 40), r = Math.pow(ph / 0.55, 0.6) * 40, a = 1 - ph / 0.55, c = FW[(id + k) % FW.length];
      g.strokeStyle = c; g.globalAlpha = a; g.lineWidth = 1.6;
      for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283, r0 = r * 0.55; g.beginPath(); g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 + ph * 8); g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r + ph * 14); g.stroke(); }
      g.globalAlpha = a * 0.35; glow(cx, cy, r + 14, 'rgba(255,230,160,A)', 1);
    }
    g.restore();
  }

  // 櫓(大祭の太鼓櫓): 紅白の幕と提灯
  function yagura(t) {
    const g = g0(); shadow(2, 7, 24, 6, 0.3);
    face([[-18, 7], [18, 7], [18, 2], [-18, 2]], vg(2, 7, '#a8754a', '#7a5230'), OL);
    face([[-14, 2], [14, 2], [12, -14], [-12, -14]], vg(-14, 2, '#c0463a', '#8a2a24'), OL);
    for (let i = -2; i <= 2; i++) { g.fillStyle = i % 2 ? '#fff' : '#c0463a'; g.fillRect(i * 5 - 2.5, -13, 5, 14); }
    g.strokeStyle = OL; g.lineWidth = 0.7; g.strokeRect(-14, -13, 28, 15);
    face([[-18, -14], [18, -14], [14, -22], [-14, -22]], vg(-22, -14, '#d9a63a', '#a8782a'), OL);
    box(-9, -30, 18, 8, '#8a3a30', OL, 1.5);
    const bob = Math.abs(Math.sin(t * 5)) * 2; ell(0, -26, 6, 3.4 + bob * 0.1, '#e8d8b0', OL); dot(0, -26, 1.4, '#7a4a2a');                     // 太鼓
    line(-5, -33 - bob, 5, -29 + bob, '#5a3a22', 1.4);
    lantern(-14, -22, t, 1); lantern(14, -22, t, 2);
  }

  // 会場(広場・旗・中央の建物・櫓・花火)。info: { n1, n2, done1, done2, accents[5], flags1[5], flags2[5] }
  function grounds(t, info, castle) {
    const g = g0();
    // 広場の舗装
    g.fillStyle = 'rgba(24,14,34,.28)'; g.beginPath(); g.ellipse(3, 8, 108, 40, 0, 0, 7); g.fill();
    g.fillStyle = vg(-30, 40, '#e0d4b0', '#b8a880'); g.beginPath(); g.ellipse(0, 4, 104, 37, 0, 0, 7); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 0.8; for (let r = 0.35; r < 1; r += 0.2) { g.beginPath(); g.ellipse(0, 4, 104 * r, 37 * r, 0, 0, 7); g.stroke(); }
    for (let a = 0; a < 6.283; a += 0.45) { g.beginPath(); g.moveTo(Math.cos(a) * 36, 4 + Math.sin(a) * 13); g.lineTo(Math.cos(a) * 104, 4 + Math.sin(a) * 37); g.stroke(); }
    // 五色の旗(建てた館の街の色。まだなら色あせた旗が下がっている)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.12 + i * 0.19) + Math.PI, px = Math.cos(a) * 92 * 0.98, py = 4 + Math.sin(a) * 33 * 0.98 + 3, on = info.flags1[i], sw = Math.sin(t * 2.2 + i) * 2;
      line(px, py, px, py - 34, '#6a4a2a', 1.6); dot(px, py - 35, 1.6, GOLD);
      const top = py - 33, hgt = on ? 14 : 8;
      face([[px, top], [px + 15 + sw, top + 2], [px + 14 + sw, top + hgt], [px, top + hgt - 2]], on ? info.accents[i] : '#8a8a92', OL, 0.8);
      if (on) dot(px + 7 + sw * 0.5, top + hgt / 2, 2.2, 'rgba(255,255,255,.9)');
      if (info.flags2[i]) { face([[px, top + 16], [px + 12 + sw, top + 17], [px, top + 24]], '#ff8fb8', OL, 0.7); }
    }
    // 中央: 建物(館が建つごとに高くなる。完成すると天守のような万博館)
    const p = info.done1 ? 1 : Math.min(0.92, info.n1 / 5 * 0.9);
    g.save();
    g.translate(0, 6);
    if (!info.done1) {
      g.save(); g.beginPath(); g.rect(-70, -(p * 96), 140, p * 96 + 20); g.clip(); g.globalAlpha = 0.95; g.scale(1.1, 1.1); castle(t); g.restore();
      // 足場
      const hh = 20 + p * 84; g.strokeStyle = '#8a6a45'; g.lineWidth = 1.6;
      for (const x of [-34, 34]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, -hh - 8); g.stroke(); }
      g.lineWidth = 1.1; for (let y = 0; y > -hh - 8; y -= 16) { g.beginPath(); g.moveTo(-34, y); g.lineTo(34, y); g.stroke(); g.beginPath(); g.moveTo(-34, y); g.lineTo(34, y - 16); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-34, -hh - 8, 68, 3);
      line(40, 6, 40, -hh - 30, '#555', 2); line(40, -hh - 30, 6, -hh - 30, '#555', 2); line(14, -hh - 30, 14, -hh - 8 + Math.sin(t * 2) * 2, '#333', 0.8);    // クレーン
    } else {
      g.save(); g.scale(1.1, 1.1); castle(t); g.restore();
      for (const sx of [-1, 1]) { line(sx * 56, 6, sx * 56, -44, '#6a4a2a', 1.8); face([[sx * 56, -44], [sx * 56 + sx * 4, -44], [sx * 56 + sx * 4, -4], [sx * 56, -4]], '#c0463a', OL, 0.8); dot(sx * 56 + sx * 2, -24, 1.8, '#fff'); }
      ART.light(0, -60, 40, 'rgba(255,225,150,A)');
      // 屋根の上の金の飾り
      glow(0, -92, 30, 'rgba(255,224,120,A)', 0.5);
    }
    g.restore();
    // 大祭: 太鼓櫓と提灯
    if (info.n2 >= 2 || info.done2) { g.save(); g.translate(78, 12); yagura(t); g.restore(); }
    if (info.n2 >= 1) for (let i = -3; i <= 3; i++) { const lx = i * 28, ly = 38 - Math.abs(i) * 2; lantern(lx, ly - 4, t, i, i % 2 ? '#ff8fb8' : '#d9483a'); }
  }

  return { plot, pavilion, festoon, petals, fireworks, yagura, grounds };
})();
