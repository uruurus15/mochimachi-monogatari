// デバッグ用の操作パネル (debug.html でのみ読み込まれる)
// 「いま見ている街」に対して働く操作と、全体に対する操作がある。
'use strict';
(function () {
  const speeds = [0, 1, 10, 100, 1000];
  const skips = [['+1分', 60], ['+10分', 600], ['+1時間', 3600], ['+8時間', 28800]];
  const el = document.createElement('div'); el.id = 'dbg';
  el.innerHTML = `<h3>🛠 DEBUG</h3>
    <div class="grp"><span>速度</span>${speeds.map(v => `<button data-sp="${v}">${v === 0 ? '停止' : '×' + v}</button>`).join('')}</div>
    <div class="grp"><span>スキップ</span>${skips.map(([l, s]) => `<button data-skip="${s}">${l}</button>`).join('')}</div>
    <div class="grp"><span>この街のコイン</span>${[1e3, 1e5, 1e7, 1e9].map(v => `<button data-coin="${v}">+${fmt(v)}</button>`).join('')}</div>
    <div class="grp"><span>この街</span><button data-d="quests">クエスト全達成</button><button data-d="unlock">全施設解放</button><button data-d="research">研究を一括</button><button data-d="items">全品目+1000</button><button data-d="hire">役人を全員雇う</button><button data-d="auto">自動化を全ON</button><button data-d="earn">累計獲得+1e9</button></div>
    <div class="grp"><span>全体</span><button data-d="towns">全街を開く</button><button data-d="road+">街道+1</button><button data-d="event">イベント発生</button><button data-d="clearev">イベント終了</button><button data-d="fuku">福+10</button><button data-d="goal">博覧会を完成</button><button data-d="clear2">完成を2回にする</button><button data-d="seeall">全機能を見せる</button><button data-d="prestige">転生する</button><button data-d="view">町/世界地図</button></div>
    <div class="info" id="dbg-info"></div>`;
  // フッターのボタンと重ならないよう、固定表示ではなく通常の流れ(町ビューの上)に置く
  document.getElementById('hero').before(el);

  const mark = () => el.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === timeScale));
  // コマンド表(if/else の連鎖にすると、for の中の if に else が結びついて後ろのコマンドが効かなくなる事故が起きるので、関数の表にしてある)
  const AUTO_MAP = [['builder', 'build'], ['upgrader', 'up'], ['scholar', 'res'], ['treasurer', 'gup'], ['surveyor', 'road']];
  const CMD = {
    quests: T => { for (const qu of QUESTS_OF[T.id]) T.quests[qu.id] = 'done'; },
    unlock: T => {
      for (const id of BUILDINGS_OF[T.id]) {
        const u = BUILDINGS[id].unlock || {};
        for (const it in (u.produced || {})) T.stats.produced[it] = Math.max(T.stats.produced[it], u.produced[it]);
        for (const it in (u.received || {})) T.stats.received[it] = Math.max(T.stats.received[it], u.received[it]);
        if (u.earned) T.stats.coinsEarned = Math.max(T.stats.coinsEarned, u.earned);
      }
    },
    research: T => { for (let i = 0; i < 80; i++) { const r = RESEARCH_OF[T.id].filter(x => researchAvailable(x, T)).sort((a, b) => a.cost - b.cost)[0]; if (!r) break; T.res[r.id] = true; } },
    items: T => { for (const k in ITEMS) { if (k !== 'coin') T.items[k] += 1000; } },
    hire: T => { for (const o of OFFICIALS) { if (canHire(T, o.id)) T.off[o.id] = true; } },
    auto: T => { for (const [off, key] of AUTO_MAP) { if (hasOff(T, off)) T.auto[key].on = true; } },
    earn: T => { T.stats.coinsEarned += 1e9; },
    towns: () => { for (const id of TOWN_IDS) { if (TOWNS[id].parent && !state.t[id].open) { state.t[id].road = 1; state.t[id].open = true; applyRecommended(state, id); } } },
    'road+': () => { for (const id of TOWN_IDS) { if (TOWNS[id].parent && state.t[id].open && state.t[id].road < ROAD.max) state.t[id].road++; } },
    event: () => triggerEvent(state),
    clearev: () => { state.ev.act.length = 0; },
    seeall: () => { for (const r of REVEALS) state.meta.seen[r.id] = 1; },
    clear2: () => { state.meta.goal.clears = RESET2_MIN_CLEARS; state.meta.goal.total = Math.max(state.meta.goal.total, RESET2_MIN_CLEARS); },
    goal: () => { for (const s of GOALS.flatMap(x => x.stages)) { if (s.set === 'goal2' && !state.meta.homare) continue; const T = state.t[s.town]; T.open = true; for (const it in s.need) T.stats.produced[it] = Math.max(T.stats.produced[it] || 0, s.need[it]); T.items.coin = Math.max(T.items.coin, s.coin); if (s.earned) T.stats.coinsEarned = Math.max(T.stats.coinsEarned, s.earned); buildStage(state, s.id); } },
    fuku: () => { state.meta.fuku += 10; state.meta.fukuTotal += 10; },
    view: () => { UI.view = UI.view === 'world' ? 'town' : 'world'; saveUI(); },
    prestige: () => { prestige(state); save(state); noSave = true; location.reload(); },
  };
  el.addEventListener('click', e => {
    FX.unlock();
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset, T = curT();
    if (d.sp !== undefined) timeScale = +d.sp;
    else if (d.skip) advance(state, +d.skip, SIM.offlineStep);
    else if (d.coin) grantCoin(T, +d.coin);   // 報酬扱い(累計獲得コイン・福には数えない)
    else if (CMD[d.d]) { CMD[d.d](T); if (d.d === 'prestige') return; }
    mark(); render();
  });
  // 1秒あたりのコイン収入の目安 (直近1秒の累計差分)
  let prev = 0, prevT = performance.now(), prevTown = null;
  setInterval(() => {
    const T = curT(), now = performance.now(), dtReal = (now - prevT) / 1000;
    if (prevTown !== UI.town) { prevTown = UI.town; prev = T.stats.coinsEarned; }
    const gained = T.stats.coinsEarned - prev; prev = T.stats.coinsEarned; prevT = now;
    const perGameSec = timeScale ? gained / (dtReal * timeScale) : 0;
    $('#dbg-info').textContent = `速度 ×${timeScale} / ${TOWNS[T.id].name}の収入 ${fmt(perGameSec)}/ゲーム秒 / 経過 ${fmtTime(state.stats.playSec)}`;
  }, 1000);
  mark();
})();
