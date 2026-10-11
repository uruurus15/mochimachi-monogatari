// 演出 (紙吹雪 / バナー / 効果音)。ゲームの状態には触れない、見た目と音だけの部品。
// - 紙吹雪: 画面全体の canvas#fx(クリックを邪魔しない)。粒子があるときだけ動く
// - バナー: 大きな文字が弾んで出て、消える(節目・実績・採用・街の発見・転生)
// - 効果音: WebAudio の小さなシンセ。AudioContext は最初のクリックで作る(自動再生の制限・ヘッドレスのエラーを避ける)
'use strict';
const FX = (function () {
  const cv = document.getElementById('fx'), g = cv ? cv.getContext('2d') : null;
  let parts = [], running = false, W = 0, H = 0;
  const fit = () => { if (!cv) return; W = cv.width = innerWidth; H = cv.height = innerHeight; };
  fit(); addEventListener('resize', fit);

  function loop(now) {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const dt = 1 / 60;
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; p.vx *= 0.995;
      g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.6)); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
      if (p.shape === 'star') { g.beginPath(); for (let i = 0; i < 5; i++) { g.lineTo(Math.cos(i * 1.2566 - 1.57) * p.s, Math.sin(i * 1.2566 - 1.57) * p.s); g.lineTo(Math.cos(i * 1.2566 - 0.94) * p.s * 0.45, Math.sin(i * 1.2566 - 0.94) * p.s * 0.45); } g.fill(); }
      else if (p.shape === 'dot') { g.beginPath(); g.arc(0, 0, p.s * 0.6, 0, 7); g.fill(); }
      else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, W, H); }
  }
  // x,y: 画面座標。opts: colors, n, power, shape, up(上向きに強く)
  function burst(x, y, opts = {}) {
    if (!g) return;
    const colors = opts.colors || ['#ffd54f', '#ff8fb8', '#4fc3f7', '#a5d6a7', '#ffffff'], n = Math.min(opts.n || 28, 120), power = opts.power || 320;
    for (let i = 0; i < n; i++) {
      const a = (opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * 6.283), v = power * (0.3 + Math.random() * 0.8), life = 0.9 + Math.random() * 0.9;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 5 + Math.random() * 6, c: colors[i % colors.length], life, max: life, shape: opts.shape || (Math.random() < 0.3 ? 'star' : 'rect') });
    }
    if (parts.length > 600) parts.splice(0, parts.length - 600);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  const burstAt = (el, opts) => { if (!el || !el.getBoundingClientRect) return; const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, opts); };
  function fireworks(colors) { for (let i = 0; i < 7; i++) setTimeout(() => burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.4), { colors, n: 46, power: 380, shape: 'star' }), i * 260); }

  // ---- バナー ----
  const banner = () => document.getElementById('banner');
  function showBanner(title, sub, color) {
    const el = banner(); if (!el) return;
    // 同じ見出しのバナーが出ている間に重ねて来たら、新しく出さずに「ほか N 件」としてまとめる(同じ表示が何個も並ばないように)
    const same = [...el.children].find(c => c._title === title && !c.classList.contains('out'));
    if (same) { same._n++; same.lastChild.textContent = `${sub || ''}(ほか ${same._n - 1} 件)`; clearTimeout(same._t1); clearTimeout(same._t2); same._t1 = setTimeout(() => same.classList.add('out'), 2600); same._t2 = setTimeout(() => same.remove(), 3200); return; }
    const d = document.createElement('div'); d.className = 'bn'; if (color) d.style.setProperty('--bc', color); d._title = title; d._n = 1;
    d.innerHTML = `<b></b><small></small>`; d.firstChild.textContent = title; d.lastChild.textContent = sub || '';
    el.appendChild(d); while (el.children.length > 3) el.firstChild.remove();
    d._t1 = setTimeout(() => d.classList.add('out'), 2600); d._t2 = setTimeout(() => d.remove(), 3200);
  }

  // ---- 効果音 ----
  let ac = null, muted = false, last = {};
  function unlock() { if (ac || muted) return; try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) { ac = null; } }
  function tone(freq, start, dur, type = 'sine', vol = 0.06) {
    if (!ac || muted) return;
    try {
      const o = ac.createOscillator(), gn = ac.createGain(), t0 = ac.currentTime + start;
      o.type = type; o.frequency.setValueAtTime(freq, t0); gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  const SOUNDS = {
    buy:   () => { tone(660, 0, 0.09, 'triangle'); tone(990, 0.05, 0.1, 'triangle'); },
    up:    () => { tone(520, 0, 0.08, 'square', 0.035); tone(780, 0.06, 0.08, 'square', 0.035); tone(1040, 0.12, 0.12, 'square', 0.035); },
    mile:  () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle', 0.07)); },
    ach:   () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.3, 'sine', 0.07)); },
    hire:  () => { tone(392, 0, 0.12, 'square', 0.04); tone(523, 0.1, 0.12, 'square', 0.04); tone(784, 0.2, 0.28, 'triangle', 0.07); },
    road:  () => { [330, 392, 494, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.06)); },
    fest:  () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.1, 0.4, 'sine', 0.07)); },
    sell:  () => { tone(880, 0, 0.05, 'sine', 0.04); tone(1320, 0.04, 0.07, 'sine', 0.04); },
    no:    () => { tone(180, 0, 0.12, 'sawtooth', 0.03); },
  };
  function sfx(kind) {
    if (muted || !ac || !SOUNDS[kind]) return;
    const now = performance.now(); if (last[kind] && now - last[kind] < 70) return; last[kind] = now;   // 連打でも音が割れない
    SOUNDS[kind]();
  }
  return { burst, burstAt, fireworks, showBanner, sfx, unlock, setMuted: m => { muted = m; }, get muted() { return muted; } };
})();
