// 進行・整合性テストの本体 (data.js + sim.js と同じ空間で実行される。直接は実行しない: node tests/bot.js)
'use strict';

// 乱数(イベントの発生)を固定して、毎回同じ結果になるようにする
Math.random = (function () { let s = 20240611; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };
const fmt = n => n >= 1e3 ? n.toExponential(2) : n.toFixed(0);
const fin = n => Number.isFinite(n);

function finite(G) {
  for (const id of TOWN_IDS) {
    const T = G.t[id];
    for (const k in T.items) if (!fin(T.items[k]) || T.items[k] < -1e-6) return `${id} item ${k}=${T.items[k]}`;
    for (const k in T.b) if (!fin(T.b[k].progress)) return `${id} progress ${k}`;
    if (!fin(T.stats.coinsEarned)) return `${id} earned`;
  }
  return null;
}

// ---- ボット: 人間のプレイを模す ----
// 役人を雇う → 自動化をオンにする。役人が揃うまでは手動で「一番安い物」を買う。街道は貯金して切り拓く。本拠地から新しい街へ少し送金する
const HIRE_ORDER = ['builder', 'merchant', 'upgrader', 'courier', 'scholar', 'treasurer', 'surveyor', 'festival'];
let TRADE = true;      // false: 街道を使わない(本拠地だけで遊ぶ比較用)
let AUTOMATE = true;   // false: 役人を雇わない(手動だけ)
function manualBuy(T) {
  for (let i = 0; i < 100; i++) {
    const M = mods(T); let best = null, bc = Infinity;
    for (const id of BUILDINGS_OF[T.id]) {
      if (BUILDINGS[id].noMat && (T.items.timber > 20 || T.b[id].count >= 3 + T.b[id].count * 0 && T.items.timber > 5)) continue;     // 人間は、建材が足りなくなるまで資材場を増やさない
      if (isUnlocked(id, T) && buildingMat(id, T, M) <= T.items.timber) { const c = buildingCost(id, T, M); if (c < bc) { bc = c; best = ['b', id]; } }
      if (T.b[id].count) { const c = upgradeCost(id, T); if (c < bc) { bc = c; best = ['u', id]; } }
    }
    if (!best || T.items.coin < bc) break;
    if (best[0] === 'b') buyBuilding(T, best[1]); else buyUpgrade(T, best[1]);
  }
}
function botTown(G, T) {
  if (AUTOMATE) {
    // 貯金: 次に雇う役人か、次に切り拓く道が「収入の20分ぶん」以内に届くなら、自動購入の予備金を増やして貯める(人間が貯金するプレイを模す)
    const rate = T.stats.coinsEarned / Math.max(60, G.stats.playSec);
    const next = HIRE_ORDER.find(id => canHire(T, id) && !hasOff(T, id) && !(id === 'festival' && T.id !== ROOT_TOWN) && !(id === 'surveyor' && !TRADE));
    let goal = next ? officialCost(T, next) * 1.1 : Infinity;
    if (TRADE && !hasOff(T, 'surveyor')) for (const cid of CHILDREN_OF[T.id]) if (townVisible(G, cid) && !roadMaxed(G, cid)) goal = Math.min(goal, roadCost(G, cid));
    const reserve = goal <= rate * 1200 && T.items.coin < goal ? 0.9 : AUTO_DEFAULT_RESERVE;
    for (const k in T.auto) T.auto[k].reserve = reserve;
    for (const id of HIRE_ORDER) {
      if (!canHire(T, id) || (id === 'festival' && T.id !== ROOT_TOWN) || (id === 'surveyor' && !TRADE)) continue;   // 本拠地のみの比較では検地役(自動で街道を開く)を雇わない
      if (T.items.coin >= officialCost(T, id) * 1.1) hireOfficial(T, id);
    }
    for (const [off, key] of [['builder', 'build'], ['upgrader', 'up'], ['scholar', 'res'], ['treasurer', 'gup'], ['surveyor', 'road']]) if (hasOff(T, off)) T.auto[key].on = true;
  }
  if (!hasOff(T, 'builder')) manualBuy(T);
}
function bot(G) {
  for (const T of openTowns(G)) botTown(G, T);
  // 最終目標: 材料がそろった館は、お金を貯めて(予備金を高くして)建てる
  for (const st of GOALS.flatMap(x => x.stages)) { const gs = goalStatus(G, st); if (gs.done || !gs.ready) continue; if (!buildStage(G, st.id)) for (const k in G.t[st.town].auto) G.t[st.town].auto[k].reserve = 0.95; }
  if (!TRADE) return;
  // 街道(手動): 検地役がいない間は、一番安い見えている道を貯金して切り拓く
  const H = G.t[ROOT_TOWN];
  for (const id of TOWN_IDS) {
    const P0 = TOWNS[id].parent; if (!P0 || G.t[P0].off.surveyor) continue;
    if (townVisible(G, id) && !roadMaxed(G, id) && G.t[P0].open) { if (G.t[P0].items.coin >= roadCost(G, id)) buyRoad(G, id); }
  }
  for (const id of TOWN_IDS) if (G.t[id].open && TOWNS[id].parent && !G.t[id].__funded) { G.t[id].__funded = true; const P = G.t[TOWNS[id].parent]; shipNow(G, P.id, id, 'coin', P.items.coin * 0.02); }   // 新しい街へ開拓資金を1回だけ送る
}
const STAGE_T = {};   // 館が建った時刻(秒)
function run(G, marks, tag) {
  const out = []; let t = Math.round(G.stats.playSec);
  for (const m of marks) {
    while (t < m) { advance(G, 1, 0.5); bot(G); t++; for (const k in G.goal.done) if (!STAGE_T[tag + k]) STAGE_T[tag + k] = t; const f = finite(G); if (f) throw new Error(`${tag} invalid at ${t}s: ${f}`); }
    out.push({ min: m / 60, towns: openTowns(G).length, earned: totalEarned(G), home: G.t[ROOT_TOWN].stats.coinsEarned,
      unlocked: Object.keys(BUILDINGS).filter(id => isUnlocked(id, G.t[BUILDINGS[id].town])).length,
      roads: TOWN_IDS.filter(i => TOWNS[i].parent).map(i => G.t[i].road).join('/'),
      offs: sumTowns(G, T => Object.keys(T.off).length), quests: sumTowns(G, T => Object.keys(T.quests).length), res: sumTowns(G, T => Object.keys(T.res).length), ach: Object.keys(G.meta.ach).length, goal: Object.keys(G.goal.done).length,
      perTown: TOWN_IDS.map(i => G.t[i].open ? fmt(G.t[i].stats.coinsEarned) : '-').join(' ') });
  }
  return out;
}
const botPerks = G => { for (let i = 0; i < 100; i++) { const p = PERKS.filter(x => !perkMaxed(x.id, G) && perkCost(x.id, G) <= G.meta.fuku).sort((a, b) => perkCost(a.id, G) - perkCost(b.id, G))[0]; if (!p) break; buyPerk(G, p.id); } };
const totalQuests = TOWN_IDS.reduce((s, id) => s + QUESTS_OF[id].length, 0), totalRes = TOWN_IDS.reduce((s, id) => s + RESEARCH_OF[id].length, 0);

// 1) 5つの街を、役人の自動化を使って12時間
const G1 = newState();
const marks = [300, 900, 1800, 3600, 7200, 14400, 28800, 43200];
const r1 = run(G1, marks, 'run1');
console.log('--- 1周目(役人を雇う自動化ボット) ---');
for (const r of r1) console.log(`${(r.min + 'min').padStart(7)} 街${r.towns} earned=${fmt(r.earned).padStart(9)} 解放${r.unlocked}/${Object.keys(BUILDINGS).length} 道${r.roads} 役人${r.offs} クエスト${r.quests}/${totalQuests} 研究${r.res}/${totalRes} 実績${r.ach}/${ACHIEVEMENTS.length} 博覧会${r.goal}/${GOAL.stages.length}  [${r.perTown}]`);
console.log('  12時間で未解放の施設: ' + Object.keys(BUILDINGS).filter(id => !isUnlocked(id, G1.t[BUILDINGS[id].town])).map(id => BUILDINGS[id].name).join('・'));
const last = r1[r1.length - 1], at = (min, key) => (r1.find(r => r.min === min) || {})[key];
const gT = tag => GOAL.stages.map(s => STAGE_T[tag + s.id] ? (STAGE_T[tag + s.id] / 3600).toFixed(1) + 'h' : '-').join(' ');
console.log('  博覧会の館の完成時刻: ' + gT('run1'));
const clear1 = STAGE_T['run1g_final'];
check(clear1 && clear1 >= 4 * 3600 && clear1 <= 11 * 3600, `最終目標の完成が4〜11時間に収まらない: ${clear1 ? (clear1 / 3600).toFixed(1) + 'h' : '未達'}`);
check(last.unlocked === Object.keys(BUILDINGS).length, '12時間までに全施設が解放されない');
check(last.towns === TOWN_IDS.length, '12時間までに全ての街が開かない');
check(last.quests >= totalQuests * 0.5, `12時間でクエスト達成率が50%未満: ${last.quests}/${totalQuests}`);
check(at(60, 'towns') >= 2, '60分までに最初の街道が開通しない');

// 2) 各街の開始所持金で「材料のいらない施設」が最初の1棟を買える(街が開いても詰まない)
for (const id of TOWN_IDS) {
  const first = BUILDINGS_OF[id].find(b => Object.keys(BUILDINGS[b].recipe.in).length === 0);
  check(first && TOWNS[id].start.coin >= BUILDINGS[first].cost, `${id}: 開始所持金で最初の施設(${first})が買えない`);
}

// 3) 会計: 送金・輸送の往復で「獲得」「生産」は増えない(福・ランクの水増しができない)
{
  const G = newState(); for (const id of TOWN_IDS) { G.t[id].open = true; if (TOWNS[id].parent) G.t[id].road = 3; }
  G.t.home.items.coin = 1e9; const earned0 = totalEarned(G), fuku0 = fukuGain(totalEarned(G));
  const coin0 = TOWN_IDS.reduce((s, id) => s + G.t[id].items.coin, 0);
  for (let i = 0; i < 400; i++) for (const id of TOWN_IDS) { const P0 = TOWNS[id].parent; if (!P0) continue; shipNow(G, P0, id, 'coin', G.t[P0].items.coin); shipNow(G, id, P0, 'coin', G.t[id].items.coin); }
  const coin1 = TOWN_IDS.reduce((s, id) => s + G.t[id].items.coin, 0);
  console.log(`\n--- 会計(送金の往復) --- お金の合計 ${fmt(coin0)} → ${fmt(coin1)} (減るだけ) / 獲得 ${fmt(earned0)} → ${fmt(totalEarned(G))}`);
  check(coin1 <= coin0 + 1e-6, '送金の往復でお金が増えた');
  check(totalEarned(G) === earned0 && fukuGain(totalEarned(G)) === fuku0, '送金が「獲得」に数えられた(福の水増し)');
  // 品物の輸送も、生産には数えない
  const H = G.t.home; H.items.rice = 1000; const before = H.stats.produced.rice; shipNow(G, 'home', 'shiomi', 'rice', 500);
  check(G.t.shiomi.stats.produced.rice === 0 && H.stats.produced.rice === before, '輸送が「生産」に数えられた');
}

// 4) 裁定: 建物ゼロで全街に自動輸送を回しても、お金の合計は増えない
{
  const G = newState(); for (const id of TOWN_IDS) { G.t[id].open = true; if (TOWNS[id].parent) { G.t[id].road = ROAD.max; applyRecommended(G, id); } }
  G.t.home.off.courier = true; for (const q of TOWN_IDS) for (const x of QUESTS_OF[q]) G.t[q].quests[x.id] = 'done';
  for (const id of TOWN_IDS) for (const it in ITEMS) if (it !== 'coin') G.t[id].items[it] = 300;     // 在庫だけを持たせ、建物は無い
  G.ev.next = 1e9; const coin0 = TOWN_IDS.reduce((s, id) => s + G.t[id].items.coin, 0), items0 = TOWN_IDS.reduce((s, id) => s + Object.keys(ITEMS).reduce((a, k) => a + (k === 'coin' ? 0 : G.t[id].items[k] * ITEMS[k].price), 0), 0);
  advance(G, 3600, 0.5);
  const coin1 = TOWN_IDS.reduce((s, id) => s + G.t[id].items.coin, 0);
  // 在庫(最大でも各街の最高買い取り倍率で売れた額)を超えて増えてはいけない
  const ceiling = items0 * Math.max(...TOWN_IDS.map(id => Math.max(1, ...Object.values(TOWNS[id].demand)))) * 1.2;
  console.log(`--- 裁定(建物ゼロで1時間・全街の自動輸送) --- お金 ${fmt(coin0)} → ${fmt(coin1)} / 在庫の評価額 ${fmt(items0)}(上限 ${fmt(coin0 + ceiling)})`);
  check(coin1 <= coin0 + ceiling, '建物なしの自動輸送で、在庫の評価額を超えてお金が増えた(転売の抜け道)');
  check(!finite(G), '裁定チェックの状態が不正');
}

// 5) 刻み幅の等価性(自動化なし): 潮見の塩・昆布 → 本拠地の漬物屋 → 売却。0.1s / 0.83s / 1s
function chain(step) {
  const G = newState(); G.ev.next = 1e9; G.t.home.off.courier = true;
  G.t.shiomi.open = true; G.t.shiomi.road = 2; applyRecommended(G, 'shiomi');
  Object.assign(G.t.home.b.paddy, { count: 40 }); Object.assign(G.t.home.b.pickle, { count: 6 });
  Object.assign(G.t.shiomi.b.boat, { count: 6 }); Object.assign(G.t.shiomi.b.saltern, { count: 10 }); Object.assign(G.t.shiomi.b.kelpbed, { count: 10 });
  G.t.home.stats.received.salt = 99; G.t.shiomi.items.coin = 1e9;
  advance(G, 1200, step);
  return { pickle: G.t.home.stats.produced.pickle, coin: totalEarned(G), salt: G.t.home.stats.received.salt };
}
const c01 = chain(0.1), c083 = chain(0.83), c1 = chain(1);
console.log(`\n--- 輸送チェーンの刻み幅(20分) --- 0.1s: ${fmt(c01.coin)} 漬物${fmt(c01.pickle)} / 0.83s: ${fmt(c083.coin)} 漬物${fmt(c083.pickle)} / 1s: ${fmt(c1.coin)} 漬物${fmt(c1.pickle)}`);
check(c01.pickle > 50, '潮見→本拠地→漬物屋のチェーンが動いていない');
for (const [n, t] of [['0.83s', c083], ['1s', c1]]) { check(Math.abs(t.pickle / c01.pickle - 1) < 0.03, `${n}刻みの漬物生産量が0.1s刻みと3%以上ずれる`); check(Math.abs(t.coin / c01.coin - 1) < 0.03, `${n}刻みの収入が3%以上ずれる`); }

// 6) 自動化の効果: 同じ条件で、役人の自動建築・自動強化ありのほうが、10分でよく育つ
function autoRun(on) {
  const G = newState(); G.ev.next = 1e9; const T = G.t.home; T.items.coin = 5e4; Object.assign(T.b.paddy, { count: 12 });
  if (on) { T.off.builder = true; T.off.upgrader = true; T.auto.build.on = true; T.auto.up.on = true; }
  advance(G, 600, 0.5); return { earned: T.stats.coinsEarned, count: Object.values(T.b).reduce((s, b) => s + b.count, 0), G };
}
const aOn = autoRun(true), aOff = autoRun(false);
console.log(`\n--- 自動化の効果(10分) --- 自動あり: 獲得${fmt(aOn.earned)} 建物${aOn.count} / なし: 獲得${fmt(aOff.earned)} 建物${aOff.count}`);
check(aOn.earned > aOff.earned * 1.5 && aOn.count > aOff.count + 20, '役人の自動建築・自動強化の効果が出ていない');
{ // 自動化はオフライン(粗い刻み)でも働く
  const a = newState(); a.ev.next = 1e9; a.t.home.items.coin = 5e4; Object.assign(a.t.home.b.paddy, { count: 12 }); a.t.home.off.builder = true; a.t.home.auto.build.on = true;
  advance(a, 3600, SIM.offlineStep);
  const n = Object.values(a.t.home.b).reduce((s, b) => s + b.count, 0);
  console.log(`--- 自動化のオフライン(1時間・1秒刻み) --- 建物 ${n}`); check(n > 40 && !finite(a), 'オフライン計算で自動建築が働かない/数値が不正');
}
// 役人の機能開放: 学者がいないと研究は買えない、蔵奉行がいないと施設は買えない、建築奉行がいないとまとめ買いは1棟だけ
{
  const G = newState(), T = G.t.home; T.items.coin = 1e9; T.stats.coinsEarned = 1e9;
  check(!buyResearch(T, 'r_market1') && !buyGlobal(T, 'price'), '役人がいないのに研究/施設が買えた');
  check(planBuy(T, 'paddy', 10).cnt === 1, '建築奉行がいないのに、まとめ買いができる');
  T.off.scholar = T.off.treasurer = T.off.builder = true;
  check(buyResearch(T, 'r_market1') && buyGlobal(T, 'price') && planBuy(T, 'paddy', 10).cnt === 10, '役人を雇っても機能が開放されない');
  check(officialCost(G.t.shiomi, 'builder') < officialCost(T, 'builder'), '新しい街の役人の費用が本拠地と同じ高さ');
}

// 7) 取引・街の効果: 本拠地だけで遊ぶより、5つの街を使うほうが 8h で上回る
TRADE = false; const Gh = newState(); const rh = run(Gh, [28800, 43200], 'homeonly'); TRADE = true;
const Gt = newState(); const rt = run(Gt, [28800, 43200], 'multi');
console.log(`\n--- 5つの街の効果 --- 8h  本拠地のみ: ${fmt(rh[0].earned)}  全街: ${fmt(rt[0].earned)} (${((rt[0].earned / rh[0].earned - 1) * 100).toFixed(1)}%)    12h  本拠地のみ: ${fmt(rh[1].earned)}  全街: ${fmt(rt[1].earned)} (${((rt[1].earned / rh[1].earned - 1) * 100).toFixed(1)}%)`);
check(rt[0].earned >= rh[0].earned * 1.1, '8時間で、全街のプレイが本拠地だけを10%以上上回らない');

// 8) 転生: 全街が初期化され、福・パーク・実績は残り、2周目は速い
const fuku = fukuGain(totalEarned(G1)); console.log(`\n--- 転生 --- 福の獲得: ${fuku} (1周目12hの累計 ${fmt(totalEarned(G1))})`);
check(fuku >= 1, '転生で福が得られない');
prestige(G1); botPerks(G1);
check(TOWN_IDS.filter(i => G1.t[i].open).join() === ROOT_TOWN && G1.t.shiomi.road === 0 && Object.keys(G1.t.home.off).every(o => LEGACY.gifts.some(gf => gf.offs.includes(o))), '転生で街・役人がリセットされない');
check(G1.meta.fukuTotal === fuku && G1.meta.resets === 1, '転生で福・回数が残らない');
const r2 = run(G1, [3600, 14400, 28800], 'run2');
console.log('--- 2周目 ---');
console.log('  博覧会の館の完成時刻(2周目): ' + gT('run2'));
check(STAGE_T['run2g_final'] && STAGE_T['run2g_final'] < clear1 * 0.7, '2周目の博覧会の完成が1周目より十分速くない'); for (const r of r2) console.log(`${(r.min + 'min').padStart(7)} 街${r.towns} earned=${fmt(r.earned).padStart(9)} 解放${r.unlocked}`);
check(r2[2].earned > rt[0].earned * 1.5, `2周目(8h)が1周目(8h)の1.5倍に届かない: ${fmt(r2[2].earned)} vs ${fmt(rt[0].earned)}`);

// 9) オフライン: イベントが連発せず、数値が壊れない
{ const G = newState(); G.t.home.b.paddy.count = 10; G.ev.next = 1; const b = G.meta.eventsSeen; advance(G, 8 * 3600, SIM.offlineStep);
  console.log(`\n--- オフライン8h --- 発生したイベント: ${G.meta.eventsSeen - b} 回(0であること)`); check(G.meta.eventsSeen - b === 0 && !finite(G), 'オフライン計算でイベントが発生した/数値が不正'); }

// 10) 旧セーブの移行(v1 / v2): 読めて、使っていた機能に応じて役人が付く
{
  const v1 = { v: 1, items: { coin: 500, rice: 3 }, b: { paddy: { count: 4, progress: 0.2, level: 1, stalled: false } }, gup: { price: 1, speed: 0 }, autosell: { rice: 10, mochi: null }, quests: { q_rice: 'done' }, stats: { produced: { rice: 100 }, coinsEarned: 100, playSec: 50, offlineSec: 0 }, savedAt: Date.now() };
  const m1 = normalize(v1), H = m1.t.home;
  check(H.b.paddy.count === 4 && H.items.coin === 500 && H.gup.price === 1 && H.autosell.mochi === null && H.autosell.tea === 10, 'v1セーブの内容が本拠地に引き継がれない');
  check(H.off.treasurer && H.off.merchant, 'v1セーブで施設を使っていたのに、蔵奉行(施設)が付与されない');
  advance(m1, 60, 0.1); check(!finite(m1), 'v1セーブ移行後の進行で数値が不正');
  const v2 = { v: 2, items: { coin: 1e6, salt: 5 }, b: { paddy: { count: 30, progress: 0, level: 3 }, gilder: { count: 2, progress: 0, level: 0 }, pickle: { count: 3, progress: 0, level: 0 } }, gup: {}, autosell: {}, quests: {}, res: { r_market1: true, r_paddy_1: true, r_nonexistent: true },
    meta: { fuku: 3, perks: { p_speed: 1 }, ach: { a_friend: 1, a_reset_1: 1 }, resets: 1, eventsSeen: 0, playSecTotal: 0, rel: { shiomi: 5 } }, towns: { shiomi: { road: 2 }, itokawa: { road: 1 } },
    stats: { produced: { rice: 900 }, imported: { salt: 400 }, exported: 5, tradeValue: 9, coinsEarned: 5e7, playSec: 7000, offlineSec: 0 }, ev: { act: [], next: 100 }, savedAt: Date.now() };
  const m2 = normalize(v2), H2 = m2.t.home;
  check(H2.b.paddy.count === 30 && H2.b.pickle.count === 3 && H2.stats.received.salt === 400 && H2.stats.coinsEarned === 5e7, 'v2セーブの本拠地が引き継がれない');
  check(m2.t.shiomi.road === 2 && m2.t.shiomi.open && m2.t.itokawa.open && H2.off.courier && H2.off.surveyor && H2.off.scholar && H2.off.builder, 'v2セーブの街道・役人の移行が正しくない');
  check(H2.res.r_market1 && !H2.res.r_nonexistent && m2.meta.fuku === 3 && m2.meta.perks.p_speed === 1 && !m2.meta.ach.a_friend && m2.meta.ach.a_reset_1 && m2.meta.rel === undefined, 'v2セーブのメタ情報の移行が正しくない');
  check(H2.items.coin > 1e6 + 1e9, '金箔工房を大都へ移した分の払い戻しが無い');
  advance(m2, 120, 0.1); check(!finite(m2), 'v2セーブ移行後の進行で数値が不正');
  // v3 の保存→読み込みの往復
  const m3 = normalize(JSON.parse(JSON.stringify(m2))); check(m3.t.shiomi.road === 2 && m3.t.home.off.courier && m3.t.home.b.paddy.count === 30, 'v3セーブの保存→読み込みで内容が変わる');
  console.log('\n--- 旧セーブ移行 --- OK (v1/v2/v3)');
}

// 11) 最終目標: 材料・お金・前提が足りないと建たない / 完成すると記録と速度ボーナス / 保存の往復 / 転生で今回の進捗だけ戻る
{
  const G = newState(), st = GOAL.stages[0], T = G.t[st.town];
  check(!buildStage(G, st.id), '材料もお金も無いのに館が建った');
  for (const it in st.need) T.stats.produced[it] = st.need[it];
  check(!buildStage(G, st.id), 'お金が足りないのに館が建った');
  T.items.coin = st.coin; const c0 = T.items.coin;
  check(buildStage(G, st.id) && T.items.coin === c0 - st.coin && !buildStage(G, st.id), '館の建設でお金が引かれない/二重に建つ');
  const fin = GOAL_BY_ID.g_final; G.t.home.items.coin = fin.coin; G.t.home.stats.coinsEarned = fin.earned;
  check(!buildStage(G, fin.id), '前提の館が無いのに開会式が開けた');
  const sp0 = mods(G.t.home).all - LEGACY.monBonus * Math.min(LEGACY.monMax, G.meta.mon.home | 0);
  for (const s of GOAL.stages) { const T2 = G.t[s.town]; T2.open = true; for (const it in s.need) T2.stats.produced[it] = s.need[it]; T2.items.coin = s.coin; if (s.earned) T2.stats.coinsEarned = s.earned; buildStage(G, s.id); }
  check(G.goal.cleared && G.meta.goal.clears === 1 && Math.abs(mods(G.t.home).all - LEGACY.monBonus * Math.min(LEGACY.monMax, G.meta.mon.home | 0) - sp0 - GOAL_CLEAR_BONUS) < 0.05, '完成の記録/速度ボーナスが付かない');
  const H = normalize(JSON.parse(JSON.stringify(G)));
  check(H.goal.cleared && H.meta.goal.clears === 1 && Object.keys(H.goal.done).length === GOAL.stages.length, '最終目標の進捗が保存→読み込みで変わる');
  G.t.home.stats.coinsEarned = 5e9; prestige(G);
  check(!G.goal.cleared && Object.keys(G.goal.done).length === 0 && G.meta.goal.clears === 1, '転生で目標の進捗が戻らない/記録が消えた');
  console.log('\n--- 最終目標 --- OK (建設条件・完成・保存・転生)');
}

// 12) 世代交代(2ndリセット)と、さらなる最終目標: 完成2回で解放 → 福・パーク・完成回数を手放し誉を得る → 誉の力で天下一もち大祭を完成させる
{
  const G = newState(); let phase = 1, c1 = 0, c2 = 0, c3 = 0, t = 0, before = 0, after = 0, prest3 = 0;
  check(!canReset2(G) && reset2(G) === 0, '完成していないのに世代交代できた');
  const stg = GOAL2.stages[0], T0 = G.t[stg.town]; for (const it in stg.need) T0.stats.produced[it] = stg.need[it]; T0.items.coin = stg.coin;
  check(!buildStage(G, stg.id), '誉が無いのに天下一もち大祭の館が建った');
  const T = () => (G.stats.playSec / 3600).toFixed(1) + 'h';
  for (; t < 60 * 3600 && !(phase === 3 && G.goal2.cleared); t++) {
    advance(G, 1, 0.5); bot(G);
    if (phase === 1 && G.goal.cleared) { c1 = G.stats.playSec; prestige(G); botPerks(G); phase = 2; }
    else if (phase === 2 && G.goal.cleared) {
      c2 = G.stats.playSec; check(canReset2(G) && homareGain(G) >= 1, '完成2回で世代交代が解放されない'); before = mods(G.t.home).all;
      const fk = G.meta.fukuTotal; reset2(G); after = mods(G.t.home).all; phase = 3;
      check(G.meta.fuku === 0 && G.meta.fukuTotal === 0 && Object.keys(G.meta.perks).length === 0 && G.meta.goal.clears === 0 && G.meta.homare >= 1 && G.meta.reset2 === 1 && fk > 0, '世代交代で福・パーク・完成回数が戻らない/誉が付かない');
      check(Object.keys(G.goal2.done).length === 0 && G.meta.ach && Object.keys(G.meta.ach).length > 0 && G.meta.goal.total >= 2, '世代交代で目標の進捗/実績/累計記録の扱いが正しくない');
      check(after > before, `世代交代のあとが前より弱い: ${before.toFixed(1)} → ${after.toFixed(1)}`);
    }
    else if (phase === 3 && G.stats.playSec >= 8 * 3600 && !G.goal2.cleared) { const k = Object.keys(G.goal2.done).length; prest3++; prestige(G); botPerks(G); check(Object.keys(G.goal2.done).length === k, '転生で天下一もち大祭の館が消えた'); }
  }
  c3 = (G.meta.goal2.best || 0);
  console.log(`\n--- 世代交代と天下一もち大祭(ボット) --- 1周目の完成 ${(c1 / 3600).toFixed(1)}h / 2周目の完成 ${(c2 / 3600).toFixed(1)}h / 世代交代 全体速度 +${before.toFixed(1)}→+${after.toFixed(1)}(誉${G.meta.homare}) / 天下一もち大祭 完成: 世代交代から転生${prest3}回(通算 ${G.goal2.cleared ? (G.meta.playSecTotal / 3600 + G.stats.playSec / 3600).toFixed(1) + 'h' : '未達'})`);
  check(G.goal2.cleared && G.meta.goal2.clears === 1, '世代交代のあと、天下一もち大祭が完成しない(60時間以内)');
  check(prest3 >= 1 && prest3 <= 4, `天下一もち大祭が転生1〜4回で収まらない: ${prest3}回`);
  const gm = mods(G.t.home).all; check(gm > after + GOAL2.bonus * 0.9, '天下一もち大祭の完成ボーナスが付かない');
  const H = normalize(JSON.parse(JSON.stringify(G))); check(H.meta.homare === G.meta.homare && H.goal2.cleared && H.meta.goal2.clears === 1 && H.meta.seen.goal2, '誉/大祭の保存→読み込みが合わない');
  check(!finite(G), '世代交代後の状態が不正');
}
// 13) 順次開放: 最初はもちの里だけ。条件を満たした瞬間に世界地図・目標・福・世代交代・さらなる目標が現れ、一度見えたら消えない
{
  const G = newState(); checkReveal(G, true);
  check(Object.keys(G.meta.seen).length === 0, '最初から機能が見えている');
  G.t.home.stats.coinsEarned = Math.min(...CHILDREN_OF[ROOT_TOWN].map(c => TOWNS[c].needEarned)); checkReveal(G, true); check(G.meta.seen.towns && !G.meta.seen.goal && !G.meta.seen.fuku, '最初の街の気配で世界地図だけが開かない');
  G.t.shiomi.open = true; checkReveal(G, true); check(G.meta.seen.goal && !G.meta.seen.fuku, '2つ目の街で目標だけが開かない');
  G.meta.goal.total = 1; G.meta.goal.clears = 1; checkReveal(G, true); check(G.meta.seen.fuku && !G.meta.seen.homare, '完成で福だけが開かない');
  G.meta.goal.clears = 2; checkReveal(G, true); check(G.meta.seen.homare && !G.meta.seen.goal2, '完成2回で世代交代だけが開かない');
  G.meta.homare = 1; checkReveal(G, true); check(G.meta.seen.goal2, '誉でさらなる目標が開かない');
  G.meta.homare = 0; G.meta.goal.clears = 0; checkReveal(G, true); check(G.meta.seen.homare && G.meta.seen.goal2, '一度見えた機能が消えた');
  const N = normalize(JSON.parse(JSON.stringify(newState()))); check(Object.keys(N.meta.seen).length === 0, '新しいセーブの読み込みで機能が開放される');
  const old = normalize({ v: 3, t: { home: { stats: { coinsEarned: 5e9 } } }, meta: { fukuTotal: 5, fuku: 5, resets: 1 } }); check(old.meta.seen.fuku && old.meta.seen.towns, '進んだ旧セーブの機能が開放されない');
  console.log('\n--- 順次開放 --- OK');
}

// 14) 博覧会の特典: 記念碑は転生しても残り速度が上がる / 完成回数に応じて開幕から役人がいる
{
  const G = newState(), st = GOAL.stages[0], T = G.t[st.town]; for (const it in st.need) T.stats.produced[it] = st.need[it]; T.items.coin = st.coin;
  const sp0 = mods(T).all; buildStage(G, st.id);
  check(G.meta.mon.home === 1 && Math.abs(mods(T).all - sp0 - LEGACY.monBonus) < 1e-9, '記念碑が立たない/速度が上がらない');
  G.t.home.stats.coinsEarned = 5e9; G.meta.goal.total = 1; prestige(G);
  check(G.meta.mon.home === 1 && mods(G.t.home).all > LEGACY.monBonus - 1e-9, '記念碑が転生で消えた');
  check(G.t.home.off.builder && G.t.home.off.merchant && G.t.home.auto.build.on && !G.t.home.off.scholar, '完成1回の開幕特典の役人がいない');
  G.meta.goal.total = 3; const F = newState(G.meta); check(F.t.home.off.scholar && F.t.home.off.treasurer && F.t.home.auto.gup.on && !F.t.shiomi.off.builder, '完成3回の開幕特典が付かない');
  console.log('\n--- 博覧会の特典 --- OK');
}
// 15) 供出(他の地方の特産品): 後半の高額な研究・施設は、お金があっても他の街の品が無いと買えない。使わないぶんは手放さない
{
  const G = newState(), T = G.t.home; T.off.scholar = T.off.treasurer = true; T.items.coin = 1e12;
  const big = RESEARCH_OF.home.find(r => r.cost >= TRIBUTE.from * TOWNS.home.unit && !r.req.length);
  check(!tributeOf(T, big.id, big.cost) && buyResearch(T, big.id), '街が1つのうちから供出が必要になっている');
  for (const id of ['shiomi', 'kirigamine', 'itokawa']) { G.t[id].open = true; G.t[id].road = 1; }
  const big2 = RESEARCH_OF.home.find(r => r.cost >= TRIBUTE.from * TOWNS.home.unit && !r.req.length && !G.t.home.res[r.id]);
  const tr = tributeOf(T, big2.id, big2.cost), cheap = RESEARCH_OF.home.find(r => r.cost < TRIBUTE.from * TOWNS.home.unit && !T.res[r.id] && !r.req.length);
  check(tr && PRODUCER_TOWN[tr.item] !== 'home' && tr.qty >= TRIBUTE.min, '街が3つ以上でも供出が必要にならない');
  check(!tributeOf(T, cheap.id, cheap.cost), '安い研究にまで供出が必要');
  check(!buyResearch(T, big2.id) && !T.res[big2.id], '特産品が無いのに高額な研究が買えた');
  T.items[tr.item] = tr.qty + 3; const coin0 = T.items.coin; check(buyResearch(T, big2.id) && T.res[big2.id] && T.items[tr.item] === 3 && T.items.coin === coin0 - big2.cost, '特産品を払って研究が買えない/二重払い');
  // 自動購入も特産品が無いと買わない / 取り置き(hold)で自動販売・輸送から守る
  const G2 = newState(), A = G2.t.home; A.off.scholar = true; A.auto.res.on = true; A.items.coin = 1e12; A.autosell[tr.item] = 0;
  for (const id of ['shiomi', 'kirigamine', 'itokawa']) { G2.t[id].open = true; G2.t[id].road = 1; }
  const m = mods(A); refreshHold(A, m); check(Object.keys(A.hold).length > 0, '近く買う研究に必要な品が取り置かれない');
  const k = Object.keys(A.hold)[0]; A.items[k] = 1000; sellItem(A, k, effectiveKeep(A, k), m); check(A.items[k] >= A.hold[k], '取り置いた特産品が自動販売で売られた');
  check(!finite(G2), '供出の状態が不正');
  console.log('\n--- 供出(他の地方の特産品) --- OK');
}
// 16) 建材: どの街でも、建物は建材が無いと建てられない(資材場だけ例外)/ 売却の速さには上限があり、倉庫が大きいほど速い / 需給の集計
{
  for (const tid of TOWN_IDS) check(yardOf(tid) && BUILDINGS[yardOf(tid)].noMat && BUILDINGS[yardOf(tid)].recipe.out.timber, `${tid}: 資材場が無い`);
  const G = newState(), T = G.t.home; T.items.coin = 1e6; T.items.timber = 0;
  const first = BUILDINGS_OF.home.find(id => !BUILDINGS[id].noMat && !BUILDINGS[id].unlock);
  check(buildingMat(first, T) >= 1 && !buyBuilding(T, first) && T.b[first].count === 0, '建材が無いのに建てられた');
  T.items.timber = buildingMat(first, T); const t0 = T.items.timber; check(buyBuilding(T, first) && T.items.timber === 0 && t0 > 0, '建材を払って建てられない');
  T.stats.produced.rice = 100; T.items.coin = 1e6; T.items.timber = 0; const y = yardOf('home'); check(isUnlocked(y, T) && buyBuilding(T, y) && T.b[y].count === 1, '資材場は建材なしで建てられるはず');
  T.off.builder = true; T.items.coin = 1e9; T.items.timber = buildingMat(first, T) * 3.5; const p = planBuy(T, first, 'max'); check(p.cnt >= 1 && p.cnt <= 4 && p.mat <= T.items.timber, '最大まとめ買いが建材で頭打ちにならない');
  // 売却の速さ: 1ステップで売れる量は 保管上限 × SELL.rate × dt まで
  const H = newState().t.home; H.items.rice = 400; H.autosell.rice = 0; const cap = capOf(H), lim = Math.floor(cap * SELL.rate * 0.1);
  const before = H.items.rice; sellItem(H, 'rice', 0, mods(H), sellLimit(H, mods(H), 0.1)); check(before - H.items.rice === Math.min(before, lim), `売却の速さに上限が効かない: ${before - H.items.rice} vs ${lim}`);
  // 倉庫(施設)を伸ばすと上限が掛け算で増える
  const c0 = capOf(H); H.off.treasurer = true; H.gup.storage = 2; check(Math.abs(capOf(H) / c0 - 2.25) < 1e-9, '倉庫の施設が掛け算で効かない');
  // 作りすぎると倉庫が満杯になって止まる(自動販売があっても)
  const F = newState(), A = F.t.home; A.b.paddy.count = 5000; A.items.rice = 0; A.autosell.rice = 0; A.b.paddy.progress = 0;
  advance(F, 60, 0.1); check(A.stats.produced.rice > 0 && A.b.paddy.stalled && A.b.paddy.why === 'full', '売れる速さを超えて作っても止まらない(倉庫が機能していない)');
  // 需給の集計
  const K = newState(), B = K.t.home; B.b.paddy.count = 20; B.b.mill.count = 3; B.stats.produced.rice = 0; advance(K, 30, 0.1);
  check(B.fl.rice && B.fl.rice.c > 0 && B.fl.rice.s >= 0, '材料の消費が集計されない');
  check(!finite(F) && !finite(K), '建材・売却上限の状態が不正');
  console.log('\n--- 建材・売却の速さ・需給の集計 --- OK');
}
// 17) 役人の雇える条件: 飛脚頭は街が2つ開くまで、検地役は道を切り拓ける街が見えるまで雇えない
{
  const G = newState(), H = G.t.home; H.items.coin = 1e12;
  check(!canHire(H, 'courier') && !hireOfficial(H, 'courier') && !H.off.courier, '街が1つなのに飛脚頭を雇えた');
  check(!canHire(H, 'surveyor'), '道を切り拓ける街が見えないのに検地役を雇えた');
  check(canHire(H, 'builder') && canHire(H, 'merchant'), '建築奉行・商人頭は最初から雇えるはず');
  H.stats.coinsEarned = Math.min(...CHILDREN_OF.home.map(c => TOWNS[c].needEarned)); check(canHire(H, 'surveyor'), '街が見えたのに検地役を雇えない');
  G.t.shiomi.open = true; check(canHire(H, 'courier') && hireOfficial(H, 'courier'), '街が2つになっても飛脚頭を雇えない');
  check(!canHire(G.t.daito, 'surveyor') && hireBlock(G.t.daito, 'surveyor'), '先の街が無い大都で検地役を雇える');
  console.log('\n--- 役人の雇える条件 --- OK');
}
// 18) タイムトークン(オフラインで貯めた時間)と、手元に残す数
{
  const G = newState(); G.t.home.b.paddy.count = 5; G.ev.next = 1e9; const cap = mods(G.t.home).off;
  G.savedAt = Date.now() - 3600 * 1000; applyOffline(G);
  check(Math.abs(G.meta.bank - 3600 * TIMETOKEN.share) < 5, `上限以内の離席で貯まる量が違う: ${G.meta.bank}`);
  const G2 = newState(); G2.t.home.b.paddy.count = 5; G2.ev.next = 1e9; G2.savedAt = Date.now() - (cap + 4 * 3600) * 1000; applyOffline(G2);
  check(Math.abs(G2.meta.bank - (4 * 3600 + cap * TIMETOKEN.share)) < 5, `上限を超えた分が貯まらない: ${G2.meta.bank}`);
  const G3 = newState(); G3.ev.next = 1e9; G3.savedAt = Date.now() - 400 * 3600 * 1000; applyOffline(G3); check(G3.meta.bank <= TIMETOKEN.max && G3.meta.bank > TIMETOKEN.max - 10, '貯めた時間の上限が効かない');
  const G4 = newState(); G4.ev.next = 1e9; G4.savedAt = Date.now() - 3 * 1000; applyOffline(G4); check(G4.meta.bank === 0, '数秒の離席で貯まった');
  const H = normalize(JSON.parse(JSON.stringify(G2))); check(Math.abs(H.meta.bank - G2.meta.bank) < 1e-6, '貯めた時間が保存→読み込みで変わる');
  check(checkReveal(G2, true) === undefined && G2.meta.seen.timetoken, 'タイムトークンが開放されない');
  // 手元に残す数: 自動販売のオン・オフに関わらず設定でき、手動で売るときにも効く
  const T = newState().t.home; T.items.rice = 100; T.autosell.rice = null; T.keep.rice = 30; check(keepOf(T, 'rice') === 30, '自動販売オフでも残す数が設定できない');
  const got = sellItem(T, 'rice', keepOf(T, 'rice')); check(T.items.rice === 30 && got > 0, '手動で売るときに残す数が効かない');
  const N = normalize(JSON.parse(JSON.stringify(Object.assign(newState(), {})))); N.t.home.keep.rice = 7; check(normalize(JSON.parse(JSON.stringify(N))).t.home.keep.rice === 7, '残す数が保存されない');
  console.log('\n--- タイムトークンと手元に残す数 --- OK');
}
console.log(fail.length ? '\n失敗:\n - ' + fail.join('\n - ') : '\nすべてのチェックに合格');
if (fail.length) process.exitCode = 1;
