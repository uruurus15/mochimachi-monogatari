// シミュレーション層 (v3: 街ごとの経済)
// 状態 / 効果の集約 / 固定ステップ / 輸送 / 役人の自動化 / オフライン進行 / 転生 / セーブ。
// DOM に依存しないので Node でテストできる。
//
// 構造: G(全体) = { t: { 街id: Town }, ev, meta, stats:{playSec,offlineSec}, chk, savedAt }
//       Town は「お金(items.coin)・持ち物・施設・研究・クエスト・役人・輸送指示」を持つ。T.G で全体に戻れる(保存はされない)。
'use strict';

const NOTES = [];                         // UI が拾って表示する通知(状態には保存しない)
const notify = msg => NOTES.push(msg);
const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));

// 転生しても残る情報
function newMeta() { return { fuku: 0, fukuTotal: 0, perks: {}, resets: 0, ach: {}, eventsSeen: 0, playSecTotal: 0, goal: { clears: 0, best: 0, total: 0 }, goal2: { clears: 0, best: 0, total: 0 }, homare: 0, reset2: 0, seen: {}, mon: {}, bank: 0 }; }

// 自動販売の既定: その街の施設が材料に使う品は少し手元に残し、使わない品は売り切る(輸送で受け取った品を市場の高値で売れる)
function defaultAutosell(tid) {
  const used = new Set(); for (const id of BUILDINGS_OF[tid]) for (const it in BUILDINGS[id].recipe.in) used.add(it);
  const a = {}; for (const it in ITEMS) if (it !== 'coin') a[it] = it === 'timber' ? null : used.has(it) ? 10 : 0;   // 建材は売らない
  return a;
}
const attach = (T, G) => { Object.defineProperty(T, 'G', { value: G, enumerable: false, writable: true, configurable: true }); Object.defineProperty(T, 'hold', { value: {}, enumerable: false, writable: true, configurable: true }); Object.defineProperty(T, 'fl', { value: {}, enumerable: false, writable: true, configurable: true }); return T; };   // hold: 供出のために取っておく品(保存しない)

function newTown(id, G) {
  const T = { id, open: id === ROOT_TOWN, road: 0, items: {}, b: {}, gup: {}, res: {}, quests: {}, autosell: defaultAutosell(id), off: {},
    auto: { build: { on: false, reserve: AUTO_DEFAULT_RESERVE }, up: { on: false, reserve: AUTO_DEFAULT_RESERVE }, res: { on: false, reserve: AUTO_DEFAULT_RESERVE }, gup: { on: false, reserve: AUTO_DEFAULT_RESERVE }, road: { on: false, reserve: 0.3 } },
    keep: {}, ship: { down: {}, up: {} }, tflow: {}, stats: { produced: {}, received: {}, coinsEarned: 0, bonusCoins: 0 } };
  for (const k in ITEMS) { T.items[k] = 0; T.stats.produced[k] = 0; T.stats.received[k] = 0; }
  for (const k of BUILDINGS_OF[id]) T.b[k] = { count: 0, progress: 0, level: 0, stalled: false, why: '', noAuto: false };
  for (const k in GLOBAL_UPGRADES) T.gup[k] = 0;
  T.items.coin = TOWNS[id].start.coin; T.items.timber = MAT.start[id] || 0;
  return attach(T, G);
}

function newState(meta) {
  const G = { v: 3, t: {}, ev: { act: [], next: 300 }, chk: 0, meta: meta || newMeta(), stats: { playSec: 0, offlineSec: 0 }, goal: { done: {}, cleared: false }, goal2: { done: {}, cleared: false }, savedAt: Date.now() };
  for (const id of TOWN_IDS) G.t[id] = newTown(id, G);
  const lv = G.meta.perks.p_start | 0;
  G.t[ROOT_TOWN].items.coin += PERKS.find(p => p.id === 'p_start').fx.start * lv * lv;
  const H = G.t[ROOT_TOWN];                                          // 開幕特典: 博覧会の完成回数に応じて、最初から役人がいる
  for (const gf of LEGACY.gifts) if (G.meta.goal.total >= gf.at) for (const o of gf.offs) { H.off[o] = true; const k = LEGACY.autoKey[o]; if (k) H.auto[k].on = true; }
  return G;
}
const openTowns = G => TOWN_IDS.map(id => G.t[id]).filter(T => T.open);

// ---- 効果の集約: 施設・研究・パーク・実績・福・ランク・イベントを1つの係数表にする(街ごと) ----
function rankIndex(T) { const u = TOWNS[T.id].unit; let r = 0; for (let i = 0; i < RANKS.length; i++) if (T.stats.coinsEarned >= RANKS[i].at * u) r = i; return r; }

function mods(T) {
  const G = T.G;
  const m = { all: 0, b: {}, price: 0, cap: 0, off: SIM.baseOfflineSec, cost: 0, quest: 0, evFreq: 0, evDur: 0, roadCost: 0, roadCap: 0, toll: 0, evPrice: 1, evAll: 1, evB: {}, capMul: 1 };
  const add = (fx, k) => {
    if (!fx || !k) return;
    if (fx.speed) for (const t in fx.speed) { if (t === 'all') m.all += fx.speed.all * k; else m.b[t] = (m.b[t] || 0) + fx.speed[t] * k; }
    if (fx.capMul) m.capMul *= Math.pow(1 + fx.capMul, k);
    for (const key of ['price', 'cap', 'off', 'cost', 'quest', 'evFreq', 'evDur', 'roadCost', 'roadCap', 'toll']) if (fx[key]) m[key] += fx[key] * k;
  };
  for (const id in GLOBAL_UPGRADES) add(GLOBAL_UPGRADES[id].fx, T.gup[id]);
  for (const r of RESEARCH_OF[T.id]) if (T.res[r.id]) add(r.fx, 1);
  for (const p of PERKS) add(p.fx, G.meta.perks[p.id] | 0);
  for (const gs of GOALS) m.all += gs.bonus * G.meta[gs.key].clears;
  m.all += LEGACY.monBonus * Math.min(LEGACY.monMax, G.meta.mon[T.id] | 0);
  m.all += HOMARE_BONUS * G.meta.homare + FUKU_SPEED_BONUS * G.meta.fukuTotal + ACH_SPEED_BONUS * Object.keys(G.meta.ach).length + RANK_SPEED_BONUS * rankIndex(T);
  if (T.id === ROOT_TOWN && T.off.festival) { m.evFreq += 0.3; m.evDur += 0.3; }
  m.cost = Math.min(0.5, m.cost);
  for (const a of G.ev.act) {
    const mu = EVENT_BY_ID[a.id]?.mult; if (!mu) continue;
    if (mu.price) m.evPrice *= mu.price;
    if (mu.all) m.evAll *= mu.all;
    if (mu.b) for (const k in mu.b) m.evB[k] = (m.evB[k] || 1) * mu.b[k];
  }
  return m;
}

// ---- 派生値 ----
// 需給の集計(画面のグラフ用。保存しない): c=材料として消費 s=売却 e=輸送で送り出し b=建設で消費 t=供出で消費
const fl = (T, it) => T.fl[it] || (T.fl[it] = { c: 0, s: 0, e: 0, b: 0, t: 0 });
const sellLimit = (T, M, dt) => capOf(T, M) * SELL.rate * dt;      // 自動販売の1ステップの上限(1品目あたり)
const matOf = (coin, T, M) => Math.max(1, Math.min(Math.ceil(coin * MAT.ratio / ITEMS.timber.price), Math.floor(capOf(T, M) * MAT.capFrac)));
const buildingCost = (id, T, M = mods(T)) => Math.ceil(BUILDINGS[id].cost * Math.pow(BUILDINGS[id].growth, T.b[id].count) * (1 - M.cost));
const buildingMat = (id, T, M = mods(T)) => BUILDINGS[id].noMat ? 0 : matOf(buildingCost(id, T, M), T, M);
const yardOf = tid => BUILDINGS_OF[tid].find(b => BUILDINGS[b].noMat);
const upgradeCost  = (id, T) => Math.ceil(BUILDINGS[id].cost * UPGRADE_BASE_COST_MULT * Math.pow(UPGRADE_GROWTH, T.b[id].level));
const gupCost      = (id, T) => Math.max(10, Math.ceil(GLOBAL_UPGRADES[id].base * TOWNS[T.id].unit * Math.pow(GLOBAL_UPGRADES[id].growth, T.gup[id])));
const gupMaxed     = (id, T) => GLOBAL_UPGRADES[id].max != null && T.gup[id] >= GLOBAL_UPGRADES[id].max;
const perkCost     = (id, G) => { const p = PERKS.find(x => x.id === id); return Math.ceil(p.cost * Math.pow(p.growth, G.meta.perks[id] | 0)); };
const perkMaxed    = (id, G) => (G.meta.perks[id] | 0) >= PERKS.find(x => x.id === id).max;
const milestoneMult = count => { let m = 1; for (const n of MILESTONES) if (count >= n) m *= 2; return m; };
const nextMilestone = count => MILESTONES.find(n => count < n) || null;
const speedMult    = (id, T, M = mods(T)) => (1 + UPGRADE_EFFECT * T.b[id].level) * milestoneMult(T.b[id].count) * (1 + M.all + (M.b[id] || 0)) * M.evAll * (M.evB[id] || 1);
// その街の市場での売値(基準価格 × その街の買い取り倍率 × 価格ボーナス)
const sellPrice    = (item, T, M = mods(T)) => ITEMS[item].price * (TOWNS[T.id].demand[item] || 1) * (1 + M.price) * M.evPrice;
const ratePerSec   = (id, T, M = mods(T)) => T.b[id].count * speedMult(id, T, M) / BUILDINGS[id].recipe.time;
const capOf        = (T, M = mods(T)) => SIM.baseCap * (1 + M.cap) * M.capMul;

// 品目ごとの理論上の生産/消費(毎秒)と、直近の輸送の速さ。UI の「+x/s −y/s」と統計に使う
function flows(T, M = mods(T)) {
  const f = {}; for (const k in ITEMS) f[k] = { prod: 0, cons: 0, imp: (T.tflow[k] && T.tflow[k].imp) || 0, exp: (T.tflow[k] && T.tflow[k].exp) || 0 };
  for (const id of BUILDINGS_OF[T.id]) {
    if (!T.b[id].count) continue;
    const cyc = ratePerSec(id, T, M), r = BUILDINGS[id].recipe;
    for (const it in r.out) f[it].prod += cyc * r.out[it];
    for (const it in r.in) f[it].cons += cyc * r.in[it];
  }
  return f;
}

function isUnlocked(id, T) {
  const u = BUILDINGS[id].unlock;
  if (!u || T.b[id].count > 0) return true;
  if (u.earned != null && T.stats.coinsEarned < u.earned) return false;
  return Object.entries(u.produced || {}).every(([it, n]) => T.stats.produced[it] >= n) && Object.entries(u.received || {}).every(([it, n]) => T.stats.received[it] >= n);
}
const researchAvailable = (r, T) => !T.res[r.id] && r.req.every(q => T.res[q]);

// 生産したもの(addItem)・売って得たコインは「生産/獲得」に数える。報酬・輸送・送金は数えない(福やランクの基準を水増しさせない)
function addItem(T, item, n) {
  T.items[item] += n;
  if (n > 0) {
    T.stats.produced[item] = (T.stats.produced[item] || 0) + n;
    if (item === 'coin') T.stats.coinsEarned += n;
  }
}
function grantCoin(T, n) { T.items.coin += n; T.stats.bonusCoins = (T.stats.bonusCoins || 0) + n; }

// ---- 役人(雇うと機能が開放される) ----
const hasOff = (T, id) => !!T.off[id];
const officialCost = (T, id) => Math.max(1, Math.ceil(OFFICIAL_BY_ID[id].cost * TOWNS[T.id].unit));
// まだ意味のない役人は雇えない(飛脚頭は街が2つ開いてから、検地役は道を切り拓ける街が見えてから)
function hireBlock(T, id) {
  const G = T.G;
  if (id === 'courier' && openTowns(G).length < 2) return '2つ目の街が開くと雇えます';
  if (id === 'surveyor') { if (!CHILDREN_OF[T.id].length) return 'この街から先の街はありません'; if (!CHILDREN_OF[T.id].some(c => townVisible(G, c))) return '道を切り拓ける街が見えると雇えます'; }
  return '';
}
const canHire = (T, id) => !T.off[id] && !(OFFICIAL_BY_ID[id].homeOnly && T.id !== ROOT_TOWN) && !hireBlock(T, id);
function hireOfficial(T, id) {
  if (!canHire(T, id)) return false;
  const c = officialCost(T, id); if (T.items.coin < c) return false;
  T.items.coin -= c; T.off[id] = true;
  notify(`🎖 ${TOWNS[T.id].name}で${OFFICIAL_BY_ID[id].name}を雇った! ${OFFICIAL_BY_ID[id].desc}`);
  return true;
}
// 自動輸送は、その道のどちらかの街か本拠地に飛脚頭がいれば動く(貧しい新しい街が自分で雇えなくても詰まない)
const canAutoShip = (G, id) => { const P = TOWNS[id].parent; return !!(G.t[id].off.courier || (P && G.t[P].off.courier) || G.t[ROOT_TOWN].off.courier); };

// ---- 街道 ----
const roadMaxed = (G, id) => G.t[id].road >= ROAD.max;
function townVisible(G, id) {
  const P0 = TOWNS[id].parent; if (!P0) return true;
  const C = G.t[id], P = G.t[P0]; if (C.road >= 1) return true;
  return P0 === ROOT_TOWN ? P.stats.coinsEarned >= TOWNS[id].needEarned : (P.open && P.road >= 1);
}
const roadCost = (G, id, Mp) => { const P = G.t[TOWNS[id].parent], M = Mp || mods(P); return Math.ceil(TOWNS[id].road.cost * Math.pow(ROAD.growth, G.t[id].road) * (1 - Math.min(0.6, M.roadCost))); };
// 親の街と子の街の間の道の条件(輸送力は両方向で共有。研究の効果は道を出す親の街のもの)
function edgeInfo(G, id) {
  const lv = G.t[id].road, Mp = mods(G.t[TOWNS[id].parent]);
  return { cap: ROAD.cap[lv] * (1 + Mp.roadCap), toll: ROAD.toll[lv] * (1 - Math.min(0.6, Mp.toll)), level: lv };
}
function buyRoad(G, id) {
  if (!townVisible(G, id) || roadMaxed(G, id)) return false;
  const P = G.t[TOWNS[id].parent], C = G.t[id], c = roadCost(G, id); if (P.items.coin < c) return false;
  P.items.coin -= c; C.road++;
  if (!C.open) { C.open = true; applyRecommended(G, id); notify(`🗺 ${TOWNS[id].name}への道が開通した! ${TOWNS[id].desc}`); }
  return true;
}
// おすすめ設定: 輸送指示と、輸送する品を売り切らないための手元の数
function applyRecommended(G, id) {
  const rec = TOWNS[id].rec, C = G.t[id]; if (!rec) return;
  C.ship = { down: JSON.parse(JSON.stringify(rec.down || {})), up: JSON.parse(JSON.stringify(rec.up || {})) };
  for (const it in (rec.hold || {})) C.autosell[it] = rec.hold[it];
}

// ---- アクション(すべて「その街のお金」で行う) ----
// まとめ買い: qty = 1 / 10 / 'max'(建築奉行が必要)。買える台数と合計費用を返す
function planBuy(T, id, qty, M = mods(T)) {
  if (!hasOff(T, 'builder')) qty = 1;
  const d = BUILDINGS[id], n = qty === 'max' ? 500 : qty; let total = 0, cnt = 0, mat = 0;
  for (let i = 0; i < n; i++) {
    const c = Math.ceil(d.cost * Math.pow(d.growth, T.b[id].count + i) * (1 - M.cost)), m = d.noMat ? 0 : matOf(c, T, M);
    if (qty === 'max' && (total + c > T.items.coin || mat + m > T.items.timber)) break;
    total += c; mat += m; cnt++;
  }
  if (cnt === 0) { cnt = 1; total = buildingCost(id, T, M); mat = buildingMat(id, T, M); }
  return { cnt, total, mat };
}
function buyMany(T, id, qty) {
  if (!isUnlocked(id, T)) return 0;
  const p = planBuy(T, id, qty); if (T.items.coin < p.total || T.items.timber < p.mat) return 0;
  T.items.coin -= p.total; T.items.timber -= p.mat; fl(T, 'timber').b += p.mat; T.b[id].count += p.cnt; return p.cnt;
}
const buyBuilding = (T, id) => buyMany(T, id, 1) > 0;
function buyUpgrade(T, id) {
  const c = upgradeCost(id, T);
  if (T.b[id].count < 1 || T.items.coin < c) return false;
  T.items.coin -= c; T.b[id].level++; return true;
}

// ---- 供出(他の地方の特産品): 後半の研究・施設は、お金のほかに他の街の品が必要 ----
const strHash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
function tributeOf(T, key, cost, M) {
  const G = T.G; if (cost < TRIBUTE.from * TOWNS[T.id].unit || openTowns(G).length < TRIBUTE.towns) return null;
  const goods = TRIBUTE.goods[T.id] || [], n = goods.length; if (!n) return null;
  const h = strHash(key);
  for (let k = 0; k < n; k++) {
    const it = goods[(h + k) % n], src = G.t[PRODUCER_TOWN[it]];
    if (!src || !src.open || src.id === T.id || (src.id !== ROOT_TOWN && src.road < 1)) continue;
    const m = M || mods(T), qty = Math.max(TRIBUTE.min, Math.min(Math.ceil(cost * TRIBUTE.share / ITEMS[it].price), TRIBUTE.max, Math.floor(capOf(T, m) * 0.8)));
    return { item: it, qty };
  }
  return null;
}
const researchTribute = (T, r, M) => tributeOf(T, r.id, r.cost, M);
const gupTribute = (T, id, M) => tributeOf(T, 'gup_' + id, gupCost(id, T), M);
const tributeOk = (T, tr) => !tr || T.items[tr.item] >= tr.qty;
const payTribute = (T, tr) => { if (tr) { T.items[tr.item] -= tr.qty; fl(T, tr.item).t += tr.qty; } };
// これから買う研究・施設に必要な品は、自動販売・輸送で手放さないように取っておく(1品あたり最大 TRIBUTE.max 個)
function refreshHold(T, M) {
  const hold = {}; T.hold = hold;
  const c = [];
  if (hasOff(T, 'scholar')) for (const r of RESEARCH_OF[T.id]) if (researchAvailable(r, T)) { const tr = researchTribute(T, r, M); if (tr) c.push({ cost: r.cost, tr }); }
  if (hasOff(T, 'treasurer')) for (const g in GLOBAL_UPGRADES) if (!gupMaxed(g, T)) { const tr = gupTribute(T, g, M); if (tr) c.push({ cost: gupCost(g, T), tr }); }
  for (const x of c) hold[x.tr.item] = Math.max(hold[x.tr.item] || 0, x.tr.qty);
}
function buyGlobal(T, id) {
  const c = gupCost(id, T);
  if (!hasOff(T, 'treasurer') || gupMaxed(id, T) || T.items.coin < c) return false;
  const tr = gupTribute(T, id); if (!tributeOk(T, tr)) return false;
  T.items.coin -= c; payTribute(T, tr); T.gup[id]++; return true;
}
function buyResearch(T, id) {
  const r = RESEARCH_OF[T.id].find(x => x.id === id);
  if (!r || !hasOff(T, 'scholar') || !researchAvailable(r, T) || T.items.coin < r.cost) return false;
  const tr = researchTribute(T, r); if (!tributeOk(T, tr)) return false;
  T.items.coin -= r.cost; payTribute(T, tr); T.res[id] = true; return true;
}
function buyPerk(G, id) {
  const c = perkCost(id, G);
  if (perkMaxed(id, G) || G.meta.fuku < c) return false;
  G.meta.fuku -= c; G.meta.perks[id] = (G.meta.perks[id] | 0) + 1; return true;
}
const keepOf = (T, it) => T.keep[it] != null ? T.keep[it] : (T.autosell[it] != null ? T.autosell[it] : 0);   // 「手元に残す数」(自動販売のオン・オフに関わらず設定できる)
function sellItem(T, item, keep = 0, M, limit = Infinity) {
  const n = Math.min(Math.floor(T.items[item] - keep), Math.floor(limit));
  if (n <= 0 || item === 'coin') return 0;
  T.items[item] -= n; fl(T, item).s += n;
  const gain = n * sellPrice(item, T, M);
  addItem(T, 'coin', gain);
  return gain;
}

// 手動の輸送・送金(無料・いつでも可・隣の街へ)。道のロス率の分だけ目減りする。受け取りは「生産/獲得」に数えない
function adjacent(G, a, b) { return TOWNS[a].parent === b || TOWNS[b].parent === a; }
function shipNow(G, fromId, toId, item, n) {
  if (!adjacent(G, fromId, toId)) return 0;
  const S = G.t[fromId], D = G.t[toId], child = TOWNS[fromId].parent === toId ? fromId : toId;
  if (!S.open || !D.open || G.t[child].road < 1) return 0;
  n = Math.min(n, S.items[item]); if (!(n > 0)) return 0;
  const got = n * (1 - edgeInfo(G, child).toll);
  S.items[item] -= n; D.items[item] += got;
  if (item !== 'coin') D.stats.received[item] += got;
  return got;
}

// ---- クエスト・実績 ----
function claimQuests(T, M = mods(T)) {
  let got = 0;
  for (const q of QUESTS_OF[T.id]) {
    if (T.quests[q.id]) continue;
    const [cur, tgt] = q.prog(T);
    if (cur >= tgt) { T.quests[q.id] = 'done'; const r = q.reward * (1 + M.quest); grantCoin(T, r); got += r; }
  }
  return got;
}
function checkAchievements(G) {
  for (const a of ACHIEVEMENTS) {
    if (G.meta.ach[a.id]) continue;
    const [cur, tgt] = a.prog(G);
    if (cur >= tgt) { G.meta.ach[a.id] = 1; notify(`🏆 実績「${a.name}」を達成! 全体速度 +${ACH_SPEED_BONUS * 100}%`); }
  }
}

// ---- 最終目標: 万国もち博覧会 ----
// 館の状況: 材料(その街で作った量)・お金・前提の館・累計獲得 のどれが足りないかを返す
function goalStatus(G, st) {
  const T = G.t[st.town], gs = G[st.set], done = !!gs.done[st.id];
  const needs = Object.keys(st.need).map(it => ({ it, have: T.stats.produced[it] || 0, want: st.need[it] }));
  const reqOk = (st.requires || []).every(r => gs.done[r]), earned = totalEarned(G), earnedOk = !st.earned || earned >= st.earned;
  const needOk = needs.every(n => n.have >= n.want), coinOk = T.items.coin >= st.coin, avail = st.set !== 'goal2' || G.meta.homare > 0;
  return { done, needs, needOk, coinOk, reqOk, earnedOk, avail, ready: !done && avail && needOk && reqOk && earnedOk, canBuy: !done && avail && needOk && reqOk && earnedOk && coinOk && T.open };
}
function buildStage(G, id) {
  const st = GOAL_BY_ID[id]; if (!st) return false;
  const gs = goalStatus(G, st); if (!gs.canBuy) return false;
  const def = GOALS.find(x => x.key === st.set), cur = G[st.set];
  G.t[st.town].items.coin -= st.coin; cur.done[id] = 1;
  G.meta.mon[st.town] = (G.meta.mon[st.town] | 0) + (st.set === 'goal2' ? 2 : 1);
  notify(`🏯 ${st.name}が完成した!`);
  if (def.stages.every(x => cur.done[x.id]) && !cur.cleared) {
    cur.cleared = true; const m = G.meta[def.key]; m.clears++; m.total++; const sec = G.stats.playSec; if (!m.best || sec < m.best) m.best = sec;
    notify(`${def.key === 'goal' ? '🎆' : '🌸'} ${def.name}が開幕した!(完成 ${m.total} 回目) 全街の全体速度 +${def.bonus * 100}%`);
  }
  return true;
}

// ---- 世代交代: 福・パーク・完成回数をすべて手放して「誉」を得る。全街は転生と同じくまっさらになる ----
const canReset2 = G => G.meta.goal.clears >= RESET2_MIN_CLEARS;
const homareGain = G => canReset2(G) ? G.meta.goal.clears + Math.floor(G.meta.fukuTotal / HOMARE_PER_FUKU) : 0;
function reset2(G) {
  const gain = homareGain(G); if (gain < 1) return 0;
  const meta = G.meta; meta.homare += gain; meta.reset2++; meta.playSecTotal += G.stats.playSec;
  meta.fuku = 0; meta.fukuTotal = 0; meta.perks = {}; meta.goal.clears = 0;
  const fresh = newState(meta);
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, fresh);
  for (const id of TOWN_IDS) attach(G.t[id], G);
  checkAchievements(G); checkReveal(G, true);
  return gain;
}

// ---- 順次開放: 見えていなかった機能が、条件を満たした瞬間に現れる(一度見えたら消えない) ----
const REVEALS = [
  { id: 'analysis', msg: '🔭 「分析」タブが開放された: 在庫と需給のグラフで、改善点を探そう', test: G => G.t[ROOT_TOWN].stats.coinsEarned >= 2000 || G.meta.goal.total > 0 || G.meta.resets > 0 },
  { id: 'towns',  msg: '🔭 遠くに新しい街の気配…! 世界地図が開けた', test: G => TOWN_IDS.some(id => TOWNS[id].parent && townVisible(G, id)) },
  { id: 'goal',   msg: '🔭 新しい目標が見えてきた: 万国もち博覧会',   test: G => TOWN_IDS.filter(id => G.t[id].open).length >= 2 || G.meta.goal.total > 0 },
  { id: 'fuku',   msg: '🔭 「福」と「お祭り(転生)」が開放された',     test: G => G.meta.goal.total > 0 || G.meta.resets > 0 || G.meta.fuku > 0 },
  { id: 'homare', msg: '🔭 「世代交代」が開放された: 次の頂へ',        test: G => G.meta.homare > 0 || G.meta.goal.clears >= RESET2_MIN_CLEARS },
  { id: 'tribute', msg: '🔭 研究・施設に「他の地方の特産品」が必要になった。輸送を使いこなそう', test: G => openTowns(G).length >= TRIBUTE.towns },
  { id: 'timetoken', msg: '🔭 「タイムトークン」が貯まった: 貯めた時間で、ゲームを加速できる', test: G => G.meta.bank >= 60 },
  { id: 'goal2',  msg: '🔭 新たな目標が見えた: 天下一もち大祭',  test: G => G.meta.homare > 0 || G.meta.goal2.total > 0 },
];
function checkReveal(G, silent) {
  for (const r of REVEALS) if (!G.meta.seen[r.id] && r.test(G)) { G.meta.seen[r.id] = 1; if (!silent) notify(r.msg); }
}

// ---- 転生(お祭り): 全街をまっさらにして福を得る。福・パーク・実績は残る ----
function prestige(G) {
  const gain = fukuGain(totalEarned(G)); if (gain < 1) return 0;
  const meta = G.meta; meta.fuku += gain; meta.fukuTotal += gain; meta.resets++; meta.playSecTotal += G.stats.playSec;
  const fresh = newState(meta); fresh.goal2 = G.goal2;      // 天下一もち大祭の館は転生しても残る
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, fresh);
  for (const id of TOWN_IDS) attach(G.t[id], G);
  checkAchievements(G); checkReveal(G, true);
  return gain;
}

// ---- イベント(全街に効く) ----
function triggerEvent(G) {
  const pool = EVENTS.filter(e => !G.ev.act.some(a => a.id === e.id));
  const def = pool[Math.floor(Math.random() * pool.length)]; if (!def) return;
  const Mh = mods(G.t[ROOT_TOWN]);
  G.meta.eventsSeen++;
  if (def.dur > 0) G.ev.act.push({ id: def.id, left: def.dur * (1 + Mh.evDur) });
  if (def.bonusCoinsSec) {
    for (const T of openTowns(G)) { const rate = T.stats.coinsEarned / Math.max(60, G.stats.playSec); grantCoin(T, Math.max(50 * TOWNS[T.id].unit, rate * def.bonusCoinsSec)); }
    notify(`🎉 ${def.name}: すべての街がコインを授かった!`);
  } else notify(`🎉 ${def.name}! ${def.desc}`);
  G.ev.next = (SIM.eventMin + Math.random() * (SIM.eventMax - SIM.eventMin)) / (1 + Mh.evFreq);
}

// ---- 生産(1つの街・1ステップ。dt が長くても破綻しないバッチ処理) ----
function produce(T, dt, M) {
  const cap = capOf(T, M);
  for (const id of BUILDINGS_OF[T.id]) {
    const b = T.b[id]; if (!b.count) continue;
    const r = BUILDINGS[id].recipe;
    b.progress += dt * speedMult(id, T, M) * b.count / r.time;
    const n = Math.floor(b.progress);
    if (n <= 0) { b.stalled = false; b.why = ''; continue; }
    let byInput = n, bySpace = n;
    for (const it in r.in) byInput = Math.min(byInput, Math.floor(T.items[it] / r.in[it]));
    // 自動販売が有効な品目は同じステップで売れるので上限なし。無効な品目だけ保管上限で止まる
    for (const it in r.out) bySpace = Math.min(bySpace, Math.max(0, Math.floor((cap - T.items[it]) / r.out[it])));
    const can = Math.min(byInput, bySpace);
    b.stalled = can < n; b.why = !b.stalled ? '' : bySpace < byInput ? 'full' : 'input';
    if (can > 0) {
      for (const it in r.in) { T.items[it] -= r.in[it] * can; fl(T, it).c += r.in[it] * can; }
      for (const it in r.out) addItem(T, it, r.out[it] * can);
    }
    // 止まっている間は進捗を持ち越しすぎない(最大1サイクル分で待機)
    b.progress = b.stalled ? Math.min(b.progress - can, 1) : b.progress - n;
  }
}

// 自動販売が実際に手元に残す数: 自動輸送の指示がある品は、その「手元に残す数」より下まで売らない(輸送する分を売り切ってしまわないように)。
// これにより、1ステップの長さ(オフライン・高倍率)が変わっても輸送量が変わらない。
function effectiveKeep(T, it) {
  let k = T.autosell[it]; if (k == null) return null;
  if (T.hold[it]) k = Math.max(k, T.hold[it]);
  const G = T.G, P0 = TOWNS[T.id].parent;
  if (P0 && T.open && T.road >= 1 && canAutoShip(G, T.id) && T.ship.up[it]) k = Math.max(k, T.ship.up[it].keep);
  for (const cid of CHILDREN_OF[T.id]) { const C = G.t[cid]; if (C.open && C.road >= 1 && canAutoShip(G, cid) && C.ship.down[it]) k = Math.max(k, C.ship.down[it].keep); }
  return k;
}

// ---- 輸送(自動輸送指示): 親子の街の間で、道の輸送力 × dt を上限に品物とお金を動かす ----
// 受け取りは plain add(stats.received のみ)。お金の送金はロス率の分だけ目減りし、「獲得」には数えない。
function shipping(G, dt) {
  const acc = {};   // 街ごとの今回の輸入/輸出量(表示用)
  const bump = (id, it, key, n) => { ((acc[id] = acc[id] || {})[it] = (acc[id][it] || { imp: 0, exp: 0 }))[key] += n; };
  for (const id of TOWN_IDS) {
    const P0 = TOWNS[id].parent; if (!P0) continue;
    const C = G.t[id], P = G.t[P0]; if (!C.open || !P.open || C.road < 1 || !canAutoShip(G, id)) continue;
    const info = edgeInfo(G, id), keepRate = 1 - info.toll, capD = capOf(C), capP = capOf(P), jobs = [];
    for (const [dir, S, D, capDst] of [['down', P, C, capD], ['up', C, P, capP]]) {
      const orders = C.ship[dir];
      for (const it in orders) {
        const o = orders[it]; if (o == null) continue;
        if (it === 'coin') {                                    // 送金: 輸送力は使わない
          const n = Math.max(0, Math.min(S.items.coin - o.keep, (o.max ?? Infinity) - D.items.coin)); if (n <= 0) continue;
          S.items.coin -= n; D.items.coin += n * keepRate; continue;
        }
        const space = capDst - D.items[it];
        const w = Math.max(0, Math.min(S.items[it] - Math.max(o.keep, S.hold[it] || 0), (o.max ?? Infinity) - D.items[it], space)); if (w > 0) jobs.push({ S, D, it, w, dir });
      }
    }
    const total = jobs.reduce((a, j) => a + j.w, 0), budget = info.cap * dt, share = total > budget ? budget / total : 1;
    for (const j of jobs) {
      const n = j.w * share; if (n <= 0) continue;
      j.S.items[j.it] -= n; fl(j.S, j.it).e += n; j.D.items[j.it] += n * keepRate; j.D.stats.received[j.it] += n * keepRate;
      bump(j.S.id, j.it, 'exp', n); bump(j.D.id, j.it, 'imp', n * keepRate);
    }
  }
  // 表示用: 直近の輸送の速さ(なめらかに追従)
  const k = Math.min(1, dt / 2);
  for (const id of TOWN_IDS) {
    const T = G.t[id], a = acc[id] || {};
    for (const it of new Set([...Object.keys(T.tflow), ...Object.keys(a)])) {
      const cur = T.tflow[it] || (T.tflow[it] = { imp: 0, exp: 0 }), f = a[it] || { imp: 0, exp: 0 };
      cur.imp += (f.imp / dt - cur.imp) * k; cur.exp += (f.exp / dt - cur.exp) * k;
      if (cur.imp < 1e-4 && cur.exp < 1e-4 && !a[it]) delete T.tflow[it];
    }
  }
}

// ---- 役人の自動化(その街のお金で働く。sim の中で動くので、画面を閉じていても・オフラインでも働く) ----
// 施設の「1台ぶんの価値(毎秒)」= (出力の市場価値 − 入力の市場価値) ÷ 時間。回収の早さ = 費用 ÷ 追加で得られる価値
function unitValue(id, T, M) {
  const r = BUILDINGS[id].recipe; let v = 0;
  for (const it in r.out) v += r.out[it] * sellPrice(it, T, M);
  for (const it in r.in) v -= r.in[it] * sellPrice(it, T, M);
  return Math.max(v, 0.01) / r.time * (1 + UPGRADE_EFFECT * T.b[id].level) * (1 + M.all + (M.b[id] || 0)) * M.evAll * (M.evB[id] || 1);
}
function buildGain(id, T, M) { const c = T.b[id].count; return unitValue(id, T, M) * ((c + 1) * milestoneMult(c + 1) - c * milestoneMult(c)); }
function upGain(id, T, M) { const b = T.b[id]; return unitValue(id, T, M) * b.count * milestoneMult(b.count) * (UPGRADE_EFFECT / (1 + UPGRADE_EFFECT * b.level)); }

function autoTown(G, T, M) {
  const A = T.auto, ids = BUILDINGS_OF[T.id];
  // 検地役: 子の街への道が「収入の15分ぶん」以内で届くなら、他の自動購入は収入の半分までにして貯金し、買える額になったら先に道を切り拓く
  let saving = 1;
  if (hasOff(T, 'surveyor') && A.road.on) {
    const rate = T.stats.coinsEarned / Math.max(60, G.stats.playSec);
    for (const cid of CHILDREN_OF[T.id]) {
      if (!townVisible(G, cid) || roadMaxed(G, cid)) continue;
      const c = roadCost(G, cid, M);
      if (T.items.coin * (1 - A.road.reserve) >= c) { buyRoad(G, cid); continue; }
      if (c <= 900 * rate) saving = 0.5;       // 収入の15分ぶん以内で届く間だけ貯金する(常時だと再投資が半分になって成長が止まる)
    }
  }
  if (hasOff(T, 'builder') && A.build.on) {
    let budget = T.items.coin * (1 - A.build.reserve) * saving, yardBought = false;
    for (let i = 0; i < 40; i++) {
      let best = null, bp = Infinity, starved = false, lack = Infinity;
      for (const id of ids) {
        if (T.b[id].noAuto || BUILDINGS[id].noMat || !isUnlocked(id, T)) continue;        // 資材場は、建材が足りないときだけ増やす
        const c = buildingCost(id, T, M); if (c > budget) continue;
        const m = buildingMat(id, T, M); if (m > T.items.timber) { starved = true; lack = Math.min(lack, m); continue; }          // 建材が足りない
        const p = (c + m * ITEMS.timber.price) / buildGain(id, T, M); if (p < bp) { bp = p; best = id; }
      }
      if (!best && starved && !yardBought) { const y = yardOf(T.id); if (y && !T.b[y].noAuto && isUnlocked(y, T) && buildingCost(y, T, M) <= budget && ratePerSec(y, T, M) * 40 < lack) { best = y; yardBought = true; } }   // 40秒ぶんの生産でも届かないときだけ   // 建材が足りないときは、資材場を増やす
      if (!best) break;
      const c = buildingCost(best, T, M), m = buildingMat(best, T, M); T.items.coin -= c; T.items.timber -= m; fl(T, 'timber').b += m; T.b[best].count++; budget -= c;
    }
  }
  if (hasOff(T, 'upgrader') && A.up.on) {
    let budget = T.items.coin * (1 - A.up.reserve) * saving;
    for (let i = 0; i < 40; i++) {
      let best = null, bp = Infinity;
      for (const id of ids) { if (T.b[id].noAuto || !T.b[id].count) continue; const c = upgradeCost(id, T); if (c > budget) continue; const p = c / upGain(id, T, M); if (p < bp) { bp = p; best = id; } }
      if (!best) break;
      const c = upgradeCost(best, T); T.items.coin -= c; T.b[best].level++; budget -= c;
    }
  }
  if (hasOff(T, 'scholar') && A.res.on) {
    let budget = T.items.coin * (1 - A.res.reserve) * saving;
    for (let i = 0; i < 10; i++) {
      const r = RESEARCH_OF[T.id].filter(x => researchAvailable(x, T) && x.cost <= budget && tributeOk(T, researchTribute(T, x, M))).sort((a, b) => a.cost - b.cost)[0]; if (!r) break;
      payTribute(T, researchTribute(T, r, M)); T.items.coin -= r.cost; T.res[r.id] = true; budget -= r.cost;
    }
  }
  if (hasOff(T, 'treasurer') && A.gup.on) {
    let budget = T.items.coin * (1 - A.gup.reserve) * saving;
    for (let i = 0; i < 10; i++) {
      const id = Object.keys(GLOBAL_UPGRADES).filter(g => !gupMaxed(g, T) && gupCost(g, T) <= budget && tributeOk(T, gupTribute(T, g, M))).sort((a, b) => gupCost(a, T) - gupCost(b, T))[0]; if (!id) break;
      const c = gupCost(id, T); payTribute(T, gupTribute(T, id, M)); T.items.coin -= c; T.gup[id]++; budget -= c;
    }
  }
}

// ---- 1ステップ進める ----
function tick(G, dt) {
  G.stats.playSec += dt;
  for (let i = G.ev.act.length - 1; i >= 0; i--) { G.ev.act[i].left -= dt; if (G.ev.act[i].left <= 0) G.ev.act.splice(i, 1); }
  // 粗い刻み(オフライン計算・高倍率)ではイベントの新規発生を止める(長時間スキップで何十回も発生しないように)
  if (dt <= 0.5) { G.ev.next -= dt; if (G.ev.next <= 0) triggerEvent(G); }

  const towns = openTowns(G), M = {};
  for (const T of towns) { M[T.id] = mods(T); produce(T, dt, M[T.id]); }
  shipping(G, dt);                                                   // 生産 → 輸送 → 自動販売 の順(輸送は自動販売より先)
  for (const T of towns) for (const it in T.autosell) if (T.autosell[it] != null) sellItem(T, it, effectiveKeep(T, it), M[T.id], sellLimit(T, M[T.id], dt));

  G.chk -= dt;
  if (G.chk <= 0) {
    for (const T of towns) { const m = mods(T); claimQuests(T, m); autoTown(G, T, m); refreshHold(T, m); }
    checkAchievements(G); checkReveal(G);
    G.chk = SIM.checkInterval;
  }
}
function advance(G, seconds, step) {
  let left = seconds;
  while (left > 1e-9) { const d = Math.min(step, left); tick(G, d); left -= d; }
}

// ---- セーブ / ロード ----
function save(G) {
  G.savedAt = Date.now();
  try { localStorage.setItem(SIM.saveKey, JSON.stringify(G)); } catch (e) { /* ignore */ }
}
// 1つの街を、保存値で上書きする(新しい項目は既定値のまま)
function mergeTown(T, o) {
  if (!o) return;
  T.open = T.id === ROOT_TOWN ? true : !!o.open; T.road = Math.min(ROAD.max, o.road | 0);
  for (const k in T.items) if (o.items && o.items[k] != null) T.items[k] = o.items[k];
  for (const k in T.b) Object.assign(T.b[k], o.b?.[k]);
  for (const k in T.gup) T.gup[k] = o.gup?.[k] ?? 0;
  const validRes = new Set(RESEARCH_OF[T.id].map(r => r.id)); for (const k in o.res) if (validRes.has(k)) T.res[k] = true;
  const validQ = new Set(QUESTS_OF[T.id].map(q => q.id)); for (const k in o.quests) if (validQ.has(k)) T.quests[k] = o.quests[k];
  Object.assign(T.keep, o.keep);
  Object.assign(T.autosell, o.autosell);              // 既定値の上に保存値(null=ユーザーがオフにした)を重ねる
  for (const k in o.off) if (OFFICIAL_BY_ID[k]) T.off[k] = true;
  for (const k in T.auto) Object.assign(T.auto[k], o.auto?.[k]);
  T.ship = { down: Object.assign({}, o.ship?.down), up: Object.assign({}, o.ship?.up) };
  for (const k in T.stats.produced) { T.stats.produced[k] = o.stats?.produced?.[k] ?? 0; T.stats.received[k] = o.stats?.received?.[k] ?? 0; }
  T.stats.coinsEarned = o.stats?.coinsEarned ?? 0; T.stats.bonusCoins = o.stats?.bonusCoins ?? 0;
  if (o.open && (!o.items || o.items.timber == null)) T.items.timber = Math.floor(capOf(T) * 0.3);       // 建材ができる前のセーブ: 当座の建材を渡す
}
// v2(本拠地だけの経済 + 街道)のセーブを、本拠地に取り込む。使っていた機能に合わせて役人を付与する(有料化で失わないように)
function migrateV2(G, o) {
  const H = G.t[ROOT_TOWN], oldB = o.b || {};
  for (const k in H.items) if (o.items && o.items[k] != null) H.items[k] = o.items[k];
  for (const id of BUILDINGS_OF[ROOT_TOWN]) Object.assign(H.b[id], oldB[id]);
  if (oldB.gilder && oldB.gilder.count > 0) {                 // 金箔工房は大都へ移った: 払った費用ぶんを返す
    let refund = 0; for (let i = 0; i < oldB.gilder.count; i++) refund += 2.5e9 * Math.pow(1.2, i); H.items.coin += refund;
  }
  for (const k in H.gup) H.gup[k] = o.gup?.[k] ?? 0;
  const validRes = new Set(RESEARCH_OF[ROOT_TOWN].map(r => r.id)); for (const k in o.res) if (validRes.has(k)) H.res[k] = true;
  const validQ = new Set(QUESTS_OF[ROOT_TOWN].map(q => q.id)); for (const k in o.quests) if (validQ.has(k)) H.quests[k] = o.quests[k];
  Object.assign(H.autosell, o.autosell);
  for (const k in H.stats.produced) { H.stats.produced[k] = o.stats?.produced?.[k] ?? 0; H.stats.received[k] = o.stats?.imported?.[k] ?? 0; }
  H.stats.coinsEarned = o.stats?.coinsEarned ?? 0; H.stats.bonusCoins = o.stats?.bonusCoins ?? 0;
  G.stats.playSec = o.stats?.playSec ?? 0; G.stats.offlineSec = o.stats?.offlineSec ?? 0;
  H.off.merchant = true;                                                                    // 旧版は自動販売の設定が自由にできた
  if (Object.values(oldB).some(b => b && b.count >= 10)) H.off.builder = true;               // まとめ買いを使っていた
  if (Object.keys(H.res).length) H.off.scholar = true;
  if (Object.values(H.gup).some(v => v > 0)) H.off.treasurer = true;
  let anyRoad = false;
  for (const id of TOWN_IDS) {
    const lv = o.towns?.[id]?.road | 0; if (!lv || !TOWNS[id].parent) continue;
    G.t[id].road = Math.min(ROAD.max, lv); G.t[id].open = true; applyRecommended(G, id); anyRoad = true;
  }
  if (anyRoad) { H.off.courier = true; H.off.surveyor = true; }
}
function normalize(o) {
  const G = newState(null);
  const meta = Object.assign(newMeta(), o.meta); meta.perks = Object.assign({}, o.meta?.perks); meta.ach = Object.assign({}, o.meta?.ach);
  delete meta.rel; delete meta.ach.a_friend;                                                // 廃止した項目
  meta.goal = Object.assign({ clears: 0, best: 0, total: 0 }, o.meta?.goal); meta.goal.total = Math.max(meta.goal.total, meta.goal.clears);
  meta.goal2 = Object.assign({ clears: 0, best: 0, total: 0 }, o.meta?.goal2); meta.goal2.total = Math.max(meta.goal2.total, meta.goal2.clears);
  meta.seen = Object.assign({}, o.meta?.seen); meta.mon = Object.assign({}, o.meta?.mon); meta.bank = Math.max(0, Math.min(TIMETOKEN.max, +o.meta?.bank || 0));
  G.meta = meta; if (o.ev) G.ev = { act: (o.ev.act || []).filter(a => EVENT_BY_ID[a.id]), next: o.ev.next ?? 300 };
  if ((o.v | 0) >= 3) {
    for (const id of TOWN_IDS) mergeTown(G.t[id], o.t?.[id]);
    G.stats.playSec = o.stats?.playSec ?? 0; G.stats.offlineSec = o.stats?.offlineSec ?? 0;
  } else migrateV2(G, o);
  for (const gs of GOALS) { const og = o[gs.key]; if (!og) continue; for (const k in og.done || {}) if (GOAL_BY_ID[k] && GOAL_BY_ID[k].set === gs.key) G[gs.key].done[k] = 1; G[gs.key].cleared = !!og.cleared && gs.stages.every(x => G[gs.key].done[x.id]); }
  G.savedAt = o.savedAt ?? Date.now();
  for (const id of TOWN_IDS) attach(G.t[id], G);
  checkReveal(G, true);
  return G;
}
function load() {
  try {
    const raw = localStorage.getItem(SIM.saveKey); if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch (e) { return null; }
}
function applyOffline(G) {
  const cap = Math.max(...openTowns(G).map(T => mods(T).off)), raw = Math.max(0, (Date.now() - G.savedAt) / 1000), away = Math.min(raw, cap);
  if (away < 5) return 0;
  advance(G, away, SIM.offlineStep);
  G.stats.offlineSec += away;
  // タイムトークン: 上限を超えた分と、上限以内の分の一部を「貯めた時間」にする
  const gain = Math.min(TIMETOKEN.max - G.meta.bank, Math.max(0, raw - cap) + away * TIMETOKEN.share);
  if (gain >= 1) { G.meta.bank += gain; notify(`⏳ タイムトークンが ${Math.floor(gain / TIMETOKEN.unit)} 個(${Math.floor(gain / 60)}分ぶん)貯まりました`); }
  return away;
}
const exportSave = G => btoa(unescape(encodeURIComponent(JSON.stringify(G))));
const importSave = txt => { const o = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); localStorage.setItem(SIM.saveKey, JSON.stringify(o)); };
