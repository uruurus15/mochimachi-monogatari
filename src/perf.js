// 描画の軽さの管理。町と世界地図の絵が、パソコンに合わせて自動で軽くなる(画面の外・別のタブでは描かない)。
// レベル: 0=ふつう(30fps・動く絵は10fps) / 1=軽め(20fps・5fps) / 2=軽量(12fps・2.5fps) / 3=最軽量(8fps・1.5fps・住民なし)
// 最初はレベル1。描画に使った時間が 1秒の 12% を超えた状態が続くと、1段ずつ軽くする。「⚡軽量」ボタンはレベル2に固定する。
'use strict';
const PERF = (function () {
  const LV = [{ gap: 33, d: 100, people: true }, { gap: 50, d: 200, people: true }, { gap: 83, d: 400, people: true }, { gap: 125, d: 650, people: false }];
  let level = 1, lite = false, busy = 0, since = 0, lastChange = 0;
  const seen = new Map();                                      // canvas → 画面に見えているか
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting))) : null;
  return {
    get level() { return lite ? Math.max(2, level) : level; },
    cfg() { return LV[this.level]; },
    setLite(v) { lite = !!v; },
    watch(cv) { if (io) { seen.set(cv, true); io.observe(cv); } },
    visible(cv) { return !document.hidden && seen.get(cv) !== false; },
    // 1回の描画にかかった時間(ms)を記録する。1秒ごとに、描画が占めた割合を見て、重ければ軽くする
    note(ms, now) {
      busy += ms; if (!since) since = now;
      if (now - since >= 1000) {
        const frac = busy / (now - since); busy = 0; since = now;
        if (!lite && frac > 0.12 && level < 3 && now - lastChange > 1500) { level++; lastChange = now; }
      }
    },
  };
})();
