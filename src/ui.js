// UI 層 (v3: 街ごとの画面・街ごとのテーマ・演出)
//
// 画面更新の方針(重要): 要素(特にボタン)は「構造が変わったときだけ」作り直し、数値・文言・有効無効は既存要素へ直接書き込む。
// 毎回 innerHTML を差し替えると、押している最中にボタンが別物になりクリックが成立しない
// (加速中はコインが毎フレーム変わるので顕著)。構造用の HTML にはコストや disabled を含めないこと。
// 見た目だけのアニメーション(数値のカウントアップ・カードの光)は、実際の所持金とは別に動く。ボタンの disabled は必ず実際の所持金で決める。
'use strict';

const $ = s => document.querySelector(s);
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
function fmt(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(2) : Math.floor(n).toString();
  const e = Math.min(Math.floor(Math.log10(n) / 3), SUFFIX.length - 1);
  return (n / Math.pow(1000, e)).toFixed(2) + SUFFIX[e];
}
const fmtRate = n => n >= 100 ? fmt(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
const fmtTime = s => s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor(s % 3600 / 60)}分` : s >= 60 ? `${Math.floor(s / 60)}分${Math.floor(s % 60)}秒` : `${Math.floor(s)}秒`;
const pct = x => (x * 100).toFixed(0) + '%';

let state = load() || newState();
let noSave = false; // リセット/インポート/転生後の再読み込み中は、終了時の自動保存で上書きしない
const away = applyOffline(state);
const toasts = [];  // { text, until }
const pushToast = (text, ms = 5000) => { toasts.push({ text, until: performance.now() + ms }); if (toasts.length > 4) toasts.shift(); };
if (away) pushToast(`おかえりなさい! ${fmtTime(away)} ぶんの生産を進めました`, 7000);

// ---- 表示状態(ブラウザに覚えさせる。失敗しても動く) ----
const FRESH = {};   // 新しく開放されたタブ(点滅させる。保存はしない)
const HIST = {};   // 需給の履歴(画面用・保存しない): HIST[街][品目] = { stock:[], sup:[], dem:[], sold:[] }
const HIST_N = 100, HIST_DT = 6;   // 100点 × ゲーム内6秒ごと
let histT = -1, histPrev = {};
const UI = { town: ROOT_TOWN, tab: 'items', qty: 1, view: 'town', muted: false, dn: true, lite: false, boost: 1 };
try { const t = localStorage.getItem('mochimachi.ui'); if (t) Object.assign(UI, JSON.parse(t)); } catch (e) { /* ignore */ }
const saveUI = () => { try { localStorage.setItem('mochimachi.ui', JSON.stringify({ town: UI.town, tab: UI.tab, qty: UI.qty, view: UI.view, muted: UI.muted, dn: UI.dn, lite: UI.lite })); } catch (e) { /* ignore */ } };
FX.setMuted(!!UI.muted); if (typeof PERF !== 'undefined') PERF.setLite(UI.lite);

// 画面が指す街・タブ・購入数を、いまのセーブで有効な値に直す(旧セーブの設定が残っていても壊れない)
const TABS = [
  { id: 'goal',     icon: '🎯', name: '目標',     global: true, seen: 'goal' },
  { id: 'items',    icon: '📦', name: '在庫' },
  { id: 'analysis', icon: '📈', name: '分析',     seen: 'analysis' },
  { id: 'office',   icon: '🏛️', name: '役所' },
  { id: 'research', icon: '📚', name: '研究',     gate: 'scholar' },
  { id: 'facility', icon: '🏪', name: '施設',     gate: 'treasurer' },
  { id: 'quest',    icon: '📜', name: 'クエスト' },
  { id: 'ship',     icon: '🚚', name: '輸送',     seen: 'towns' },
  { id: 'ach',      icon: '🏆', name: '実績',     global: true },
  { id: 'fest',     icon: '🎆', name: 'お祭り',   global: true, seen: 'fuku' },
  { id: 'stats',    icon: '📊', name: '統計',     global: true },
];
const visTabs = () => TABS.filter(t => !t.seen || state.meta.seen[t.seen]);
function clampUI() {
  if (!state.t[UI.town] || !state.t[UI.town].open) UI.town = ROOT_TOWN;
  if (!visTabs().some(t => t.id === UI.tab)) UI.tab = 'items';
  if (![1, 10, 'max'].includes(UI.qty)) UI.qty = 1;
  if (!['town', 'world'].includes(UI.view) || (UI.view === 'world' && !state.meta.seen.towns)) UI.view = 'town';
}
clampUI();
const curT = () => state.t[UI.town];

// ---- 差分更新ヘルパー ----
function setHTML(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }
function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
function setTitle(el, s) { if (el && el.title !== s) el.title = s; }
function setDisabled(el, v) { if (el && el.disabled !== v) el.disabled = v; }
function setWidth(el, p) { if (el) { const w = Math.max(0, Math.min(100, p)).toFixed(1) + '%'; if (el.style.width !== w) el.style.width = w; } }
function toggle(el, cls, on) { if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
const q = (root, sel) => root.querySelector(sel);
// キー列が変わったときだけ構造を作り直し、毎回 patch で値を書き込む
function keyed(el, keys, skel, patch) {
  setHTML(el, keys.map(skel).join(''));
  for (const k of keys) patch(q(el, `[data-k="${CSS.escape(k)}"]`), k);
}
const bar = () => '<div class="bar"><i data-f="bar"></i></div>';
const cur = T => TOWNS[T.id].cur;
const money = (T, n) => `${cur(T).emoji}${fmt(n)}`;
// 見た目だけの演出: クラスを付けて、アニメーションが終わったら外す(innerHTML には触れない)
function flash(el, cls = 'flash') { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 800); }

// ---- テーマ(街ごとの配色) ----
let themedTown = null;
function applyTheme(id, instant) {
  if (themedTown === id) return;
  const th = TOWNS[id].theme, r = document.documentElement.style;
  for (const [k, v] of Object.entries({ accent: th.accent, accent2: th.accent2, bg1: th.bg1, bg2: th.bg2, card: th.card, glow: th.glow })) r.setProperty('--' + k, v);
  document.documentElement.dataset.town = id;
  if (themedTown && !instant) { document.body.classList.remove('switching'); void document.body.offsetWidth; document.body.classList.add('switching'); }
  themedTown = id;
}

// ---- 数値のカウントアップ(見た目だけ) と 毎秒の収入の目安 ----
const disp = { coin: 0, town: null }, rateS = { t: 0, earned: 0, play: 0, v: 0, town: null };
function frameHUD(dtReal) {
  const T = curT();
  if (disp.town !== UI.town) { disp.coin = T.items.coin; disp.town = UI.town; }
  const target = T.items.coin, diff = target - disp.coin;
  if (Math.abs(diff) < Math.max(0.5, Math.abs(target) * 1e-4)) disp.coin = target; else disp.coin += diff * (1 - Math.exp(-dtReal * 9));
  setText($('#coin'), fmt(disp.coin));
  const now = performance.now();
  if (rateS.town !== UI.town) { rateS.town = UI.town; rateS.t = now; rateS.earned = T.stats.coinsEarned; rateS.play = state.stats.playSec; rateS.v = 0; }
  else if (now - rateS.t > 700) {
    const dp = state.stats.playSec - rateS.play;
    if (dp > 0) { const v = (T.stats.coinsEarned - rateS.earned) / dp; if (rateS.v > 0 && v > rateS.v * 1.15 + 1) bumpCoin(); rateS.v = rateS.v ? rateS.v * 0.5 + v * 0.5 : v; }
    rateS.t = now; rateS.earned = T.stats.coinsEarned; rateS.play = state.stats.playSec;
    setText($('#income'), rateS.v > 0 ? `+${fmtRate(rateS.v)}/s` : '');
  }
}
function bumpCoin() { const el = $('#coinicon'); if (el) flash(el, 'bump'); }

// ---- 各パネル ----
function renderHUD(st, T, M) {
  applyTheme(UI.town);
  setText($('#coinicon'), cur(T).emoji);
  const ri = rankIndex(T), next = RANKS[ri + 1], u = TOWNS[T.id].unit;
  setText($('#rank'), `${TOWNS[T.id].emoji} ${TOWNS[T.id].name} ${RANKS[ri].name}${next ? ` → ${next.name} ${Math.min(99, Math.floor((T.stats.coinsEarned - RANKS[ri].at * u) / ((next.at - RANKS[ri].at) * u) * 100))}%` : '(最高)'}`);
  const gain = fukuGain(totalEarned(st));
  toggle($('#fuku'), 'vhide', !st.meta.seen.fuku); setText($('#fuku'), `${st.meta.homare ? `誉 ${st.meta.homare}  ` : ''}福 ${st.meta.fuku}${gain >= 1 ? ` (+${gain}で転生可)` : ''}`);
  setText($('#mute'), UI.muted ? '🔇' : '🔊');
  // 通知(トースト)と、種類ごとの演出
  while (NOTES.length) onNote(NOTES.shift());
  const now = performance.now(); while (toasts.length && toasts[0].until < now) toasts.shift();
  setHTML($('#toast'), toasts.map(t => `<div>${t.text}</div>`).join(''));
  keyed($('#events'), st.ev.act.map(a => a.id), id => `<span class="ev" data-k="${id}"><b>${EVENT_BY_ID[id].name}</b> <small>${EVENT_BY_ID[id].desc}</small> <i data-f="t"></i></span>`,
    (el, id) => setText(q(el, '[data-f=t]'), fmtTime(st.ev.act.find(a => a.id === id).left)));
}
function onNote(m) {
  pushToast(m);
  const c = [...m][0], body = m.replace(/^\S+\s*/, '');
  if (c === '🏆') { FX.showBanner('実績達成!', body, '#ffd54f'); FX.sfx('ach'); FX.burst(innerWidth / 2, 120, { n: 50, colors: ['#ffd54f', '#fff1b8', '#ffffff'], shape: 'star' }); }
  else if (c === '🎖') { FX.showBanner('採用!', body, '#7be0a4'); FX.sfx('hire'); FX.burst(innerWidth / 2, 160, { n: 40, colors: ['#7be0a4', '#fff1b8', '#ffffff'] }); }
  else if (c === '🗺') { FX.showBanner('新しい街を発見!', body, '#4fc3f7'); FX.sfx('road'); FX.fireworks(['#4fc3f7', '#ffd54f', '#ffffff']); }
  else if (c === '🏯') { FX.showBanner('館が完成!', body, '#ffd54f'); FX.sfx('ach'); FX.burst(innerWidth / 2, 140, { n: 60, colors: ['#ffd54f', '#ff8fb8', '#ffffff'], shape: 'star' }); }
  else if (c === '🎆') { FX.showBanner('万国もち博覧会 開幕!', body, '#ffd54f'); FX.sfx('fest'); FX.fireworks(['#ffd54f', '#ff8fb8', '#4fc3f7', '#a5d6a7']); setTimeout(() => FX.fireworks(['#ffffff', '#ffd54f']), 900); setTimeout(() => showEnding(state, GOAL), 1800); }
  else if (c === '🌸') { FX.showBanner('天下一もち大祭 大成功!', body, '#ff8fb8'); FX.sfx('fest'); FX.fireworks(['#ff8fb8', '#ffd54f', '#ffffff']); setTimeout(() => FX.fireworks(['#ffd54f', '#4fc3f7', '#a5d6a7']), 800); setTimeout(() => FX.fireworks(['#ffffff', '#ff8fb8']), 1700); setTimeout(() => showEnding(state, GOAL2), 2600); }
  else if (c === '🔭') { FX.showBanner('新しい発見!', body, '#9be7ff'); FX.sfx('road'); FX.fireworks(['#9be7ff', '#ffffff']); const r = REVEALS.find(x => x.msg === m); const tab = r && ({ towns: 'ship', goal: 'goal', fuku: 'fest', homare: 'fest', goal2: 'goal', tribute: 'ship', analysis: 'analysis' })[r.id]; if (tab) FRESH[tab] = true; }
  else if (c === '⏳') { FX.sfx('hire'); }
  else if (c === '🎉') FX.sfx('mile');
}

// 街のタブ(開いた街と、道を切り拓ける街)
function renderTowns(st) {
  toggle($('#towns'), 'vhide', !st.meta.seen.towns); if (!st.meta.seen.towns) return;
  const keys = TOWN_IDS.filter(id => st.t[id].open || townVisible(st, id));
  keyed($('#towns'), keys, id => `<button class="ttab" data-k="${id}" data-act="town" data-id="${id}" style="--ta:${TOWNS[id].theme.accent};--tb:${TOWNS[id].theme.accent2}"><span class="te"></span><span class="tn"></span><small class="tc"></small></button>`,
    (el, id) => {
      const T = st.t[id], open = T.open;
      setText(q(el, '.te'), open ? TOWNS[id].emoji : '❓'); setText(q(el, '.tn'), open ? TOWNS[id].name : '未踏の地');
      setText(q(el, '.tc'), open ? money(T, T.items.coin) : '道を切り拓く');
      toggle(el, 'on', open && UI.town === id); toggle(el, 'locked', !open);
    });
}

function reqText(id, T) {
  const u = BUILDINGS[id].unlock || {}, p = [];
  if (u.earned) p.push(`累計 ${jpNum(u.earned)} を稼ぐ`);
  for (const it in (u.produced || {})) p.push(`${ITEMS[it].name}を${u.produced[it]}個作る`);
  for (const it in (u.received || {})) p.push(`${ITEMS[it].name}を${u.received[it]}個受け取る(輸送)`);
  return p.join(' / ');
}
function renderShop(st, T, M) {
  const tid = T.id, ids = BUILDINGS_OF[tid], open = ids.filter(id => isUnlocked(id, T)), tease = ids.find(id => !isUnlocked(id, T));
  setText($('#shoptitle'), `${TOWNS[tid].emoji} ${TOWNS[tid].name}の施設`);
  const builder = hasOff(T, 'builder'), anyAuto = builder || hasOff(T, 'upgrader'), keys = open.concat(tease ? ['?' + tease] : []);
  keyed($('#buildings'), keys, k => {
    if (k[0] === '?') return `<div class="bcard teaser" data-k="${k}"><div class="bhead"><span class="badge">？</span><div class="btitle"><b>？？？</b><small data-f="req"></small></div></div></div>`;
    const d = BUILDINGS[k];
    const inS = Object.entries(d.recipe.in).map(([i, v]) => `${v}${ITEMS[i].emoji}`).join('+') || '—', outS = Object.entries(d.recipe.out).map(([i, v]) => `${v}${ITEMS[i].emoji}`).join('+');
    return `<div class="bcard" data-k="${k}"><div class="bhead"><span class="badge">${d.emoji}</span><div class="btitle"><b>${d.name}</b><small>${inS} → ${outS} · ${d.recipe.time}秒</small></div><div class="bcount" data-f="cnt"></div></div>
      <div class="bstat"><span data-f="rate"></span><span class="pill" data-f="ms"></span></div>${bar()}<small class="bgain" data-f="gain"></small>
      <div class="bbtns"><button class="btn" data-act="build" data-id="${k}"></button><button class="btn alt" data-act="up" data-id="${k}"></button>${anyAuto ? `<button class="btn ghost" data-act="noauto" data-id="${k}" title="奉行におまかせ(自動建築・自動強化の対象にする/しない)">📜</button>` : ''}</div></div>`;
  }, (card, k) => {
    if (k[0] === '?') { setText(q(card, '[data-f=req]'), reqText(k.slice(1), T)); return; }
    const b = T.b[k], uc = upgradeCost(k, T), qty = builder ? UI.qty : 1, p = planBuy(T, k, qty, M), mm = milestoneMult(b.count), nm = nextMilestone(b.count), r = BUILDINGS[k].recipe;
    toggle(card, 'stalled', b.stalled); toggle(card, 'idle', !b.count);
    setText(q(card, '[data-f=cnt]'), `×${b.count}`);
    const out0 = Object.keys(r.out)[0];
    setText(q(card, '[data-f=rate]'), b.count ? `${ITEMS[out0].emoji} ${fmtRate(ratePerSec(k, T, M) * r.out[out0])}/秒${b.stalled ? (b.why === 'full' ? ' ⚠倉庫満杯' : ' ⚠材料不足') : ''}` : '未建設');
    setText(q(card, '[data-f=ms]'), `Lv${b.level}${mm > 1 ? ` · 節目×${mm}` : ''}${nm ? ` · 次の節目 ${nm}棟` : ''}`);
    setWidth(q(card, '[data-f=bar]'), b.count ? (b.progress % 1) * 100 : 0);
    const bb = q(card, '[data-act=build]'), ub = q(card, '[data-act=up]'), ab = q(card, '[data-act=noauto]');
    setText(bb, `建てる${p.cnt > 1 ? ' ×' + p.cnt : ''}  ${money(T, p.total)}${p.mat ? ' ' + ITEMS.timber.emoji + fmt(p.mat) : ''}`); setDisabled(bb, T.items.coin < p.total || T.items.timber < p.mat);
    toggle(bb, 'nomat', T.items.coin >= p.total && T.items.timber < p.mat);
    // 強化・建設の効果: 押すとどれだけ増えるかを、割合と毎秒の量で見せる
    const rt = b.count ? ratePerSec(k, T, M) * r.out[out0] : 0, lv = b.level, upRatio = (1 + UPGRADE_EFFECT * (lv + 1)) / (1 + UPGRADE_EFFECT * lv) - 1, bdRatio = b.count ? ((b.count + 1) * milestoneMult(b.count + 1)) / (b.count * milestoneMult(b.count)) - 1 : 0;
    setText(ub, `強化  ${money(T, uc)}${b.count ? `  +${(upRatio * 100).toFixed(upRatio < 0.1 ? 1 : 0)}%` : ''}`); setDisabled(ub, !b.count || T.items.coin < uc);
    setTitle(ub, b.count ? `強化 Lv${lv} → Lv${lv + 1}: この建物の速度 ×${(1 + UPGRADE_EFFECT * lv).toFixed(2)} → ×${(1 + UPGRADE_EFFECT * (lv + 1)).toFixed(2)}(+${(upRatio * 100).toFixed(1)}%)。${ITEMS[out0].name}が毎秒 +${fmtRate(rt * upRatio)} 増えます。強化は1レベルごとに基本の+${UPGRADE_EFFECT * 100}%ずつ足され、レベルが高いほど伸びは小さくなります。` : '建てると強化できます');
    setText(q(card, '[data-f=gain]'), b.count ? `強化 +${(upRatio * 100).toFixed(1)}%(毎秒 +${fmtRate(rt * upRatio)})  ·  あと1棟 +${(bdRatio * 100).toFixed(1)}%(毎秒 +${fmtRate(rt * bdRatio)})` : '');
    if (ab) toggle(ab, 'off', b.noAuto);
  });
  document.querySelectorAll('#qty button').forEach(b => { const id = b.dataset.id, ok = builder || id === '1'; toggle(b, 'on', String(builder ? UI.qty : 1) === id); setDisabled(b, !ok); b.title = ok ? '' : '建築奉行を雇うとまとめ買いができます'; });
}

function renderItems(st, T, M) {
  const shown = Object.keys(ITEMS).filter(k => k !== 'coin' && (T.stats.produced[k] > 0 || T.stats.received[k] > 0 || T.items[k] >= 1)), f = flows(T, M), cap = capOf(T, M), merchant = hasOff(T, 'merchant');
  keyed($('#items'), shown, k => `<div class="item" data-k="${k}"><span class="in">${ITEMS[k].emoji} ${ITEMS[k].name}</span><b data-f="qty"></b><small data-f="flow"></small>
      <button class="btn mini" data-act="sell" data-id="${k}"></button>
      <label class="chk"><input type="checkbox" data-act="auto" data-id="${k}">自動</label>
      ${merchant ? `<input type="number" min="0" class="num" data-act="keep" data-id="${k}" title="自動販売で手元に残す数">` : ''}</div>`,
    (el, k) => {
      const keep = T.autosell[k], on = keep != null, ff = f[k], eff = on ? effectiveKeep(T, k) : null, dem = TOWNS[T.id].demand[k];
      setText(q(el, '[data-f=qty]'), `${fmt(T.items[k])} / ${fmt(cap)}`); toggle(el, 'full', T.items[k] >= cap * 0.98);
      setText(q(el, '[data-f=flow]'), `${ff.prod ? '+' + fmtRate(ff.prod) : ''}${ff.imp > 0.01 ? ' 受取+' + fmtRate(ff.imp) : ''}${ff.cons ? ' −' + fmtRate(ff.cons) : ''}${ff.exp > 0.01 ? ' 送り−' + fmtRate(ff.exp) : ''}`);
      setText(q(el, '[data-act=sell]'), `売る ${money(T, sellPrice(k, T, M))}${dem ? ` ×${dem}` : ''}`);
      toggle(q(el, '[data-act=sell]'), 'hot', !!dem && dem >= 2);
      const cb = q(el, '[data-act=auto]'); if (cb.checked !== on) cb.checked = on;
      const kp = q(el, '.num'); if (kp) { if (document.activeElement !== kp) { const v = String(keepOf(T, k)); if (kp.value !== v) kp.value = v; } setTitle(kp, on && eff > keep ? `自動輸送のため、実際には ${fmt(eff)} まで手元に残します` : '手元に残す数(「売る」でも自動販売でも、この数は売りません)'); }
    });
}

// ---- 役所(役人を雇う・自動化の設定) ----
const AUTO_OF = { builder: ['build', '自動建築', '回収の早い順に建てます'], upgrader: ['up', '自動強化', '回収の早い順に強化します'], scholar: ['res', '自動研究', '安い研究から進めます'], treasurer: ['gup', '自動施設', '安い施設から買います'], surveyor: ['road', '自動街道', '子の街への道を切り拓き・強化します'] };
function renderOffice(st, T, M) {
  const list = OFFICIALS.filter(o => !(o.homeOnly && T.id !== ROOT_TOWN));
  if (!q($('#office'), '#offlist')) { $('#office')._h = null; $('#office').innerHTML = '<div class="officehead"><h2 id="offtitle"></h2><p class="note">この街のお金で役人を雇うと、機能が開放されます。自動化はオフラインでも働きます。</p></div><div id="offlist"></div>'; }
  setText($('#offtitle'), `🏛️ ${TOWNS[T.id].name}の役所 (${list.filter(o => T.off[o.id]).length}/${list.length}人)`);
  keyed($('#offlist'), list.map(o => o.id), id => {
    const o = OFFICIAL_BY_ID[id], hired = !!T.off[id], a = AUTO_OF[id];
    return `<div class="card off ${hired ? 'hired' : ''}" data-k="${id}"><div class="offtop"><span class="offface">${o.emoji}</span><div class="offtxt"><b>${o.name}</b><small>${o.desc}</small></div>
      ${hired ? '<span class="stamp">採用済</span>' : `<button class="btn" data-act="hire" data-id="${id}"></button>`}</div>${hired ? '' : '<small class="hint why" data-f="why"></small>'}
      ${hired && a ? `<div class="autorow"><label class="sw"><input type="checkbox" data-act="autotog" data-id="${a[0]}"><i></i><span>${a[1]}</span></label><label class="rsv">予備金 <input type="range" min="0" max="90" step="5" data-act="reserve" data-id="${a[0]}"><b data-f="rv"></b></label></div><small class="hint">${a[2]}</small>` : ''}
      ${hired && id === 'courier' ? '<small class="hint">「輸送」タブで輸送指示を設定できます。</small>' : ''}${hired && id === 'merchant' ? '<small class="hint">「在庫」タブで手元に残す数を設定できます。</small>' : ''}</div>`;
  }, (el, id) => {
    const a = AUTO_OF[id];
    if (!T.off[id]) { const b = q(el, '[data-act=hire]'), why = hireBlock(T, id); setText(b, why ? '🔒 まだ雇えません' : `雇う ${money(T, officialCost(T, id))}`); setDisabled(b, !!why || T.items.coin < officialCost(T, id)); b.title = why; toggle(el, 'blocked', !!why); setText(q(el, '[data-f=why]'), why); return; }
    if (!a) return;
    const A = T.auto[a[0]], cb = q(el, '[data-act=autotog]'), rg = q(el, '[data-act=reserve]');
    if (cb.checked !== A.on) cb.checked = A.on;
    if (document.activeElement !== rg && +rg.value !== Math.round(A.reserve * 100)) rg.value = Math.round(A.reserve * 100);
    setText(q(el, '[data-f=rv]'), pct(A.reserve)); toggle(el, 'running', A.on);
  });
}

function lockedPanel(el, T, offId, title, why) {
  const o = OFFICIAL_BY_ID[offId];
  setHTML(el, `<div class="card lockedpanel"><div class="bigemoji">${o.emoji}</div><h2>${title}</h2><p class="note">${why}</p><button class="btn wide" data-act="hire" data-id="${offId}"></button></div>`);
  const b = q(el, '[data-act=hire]'); setText(b, `${o.name}を雇う ${money(T, officialCost(T, offId))}`); setDisabled(b, T.items.coin < officialCost(T, offId));
}
// 供出(他の地方の特産品)の表示: 必要な品と手持ちの数
function tributeNote(T, tr) { return tr ? `${ITEMS[tr.item].emoji} ${ITEMS[tr.item].name} ×${fmt(tr.qty)} が必要(${TOWNS[PRODUCER_TOWN[tr.item]].name}の特産・手持ち ${fmt(T.items[tr.item])})` : ''; }
const tributeOn = st => openTowns(st).length >= TRIBUTE.towns;
const TRIB_NOTE = '<p class="note trib" data-f="tn"></p>';
function renderResearch(st, T, M) {
  const el = $('#research');
  if (!hasOff(T, 'scholar')) { lockedPanel(el, T, 'scholar', '研究', '学者を雇うと、この街で研究ができるようになります。'); return; }
  if (!q(el, '#reslist')) { el._h = null; el.innerHTML = '<h2>研究 <small id="resCount"></small></h2><p class="note" id="resTrib"></p><div id="reslist"></div>'; }
  setText($('#resTrib'), tributeOn(st) ? '⚠ 高額な研究には、お金のほかに他の地方の特産品が必要です(輸送で取り寄せましょう)。' : '');
  const list = RESEARCH_OF[T.id], avail = list.filter(r => researchAvailable(r, T)).sort((a, b) => a.cost - b.cost), shown = avail.slice(0, 10);
  setText($('#resCount'), `(完了 ${Object.keys(T.res).length}/${list.length})`);
  keyed($('#reslist'), shown.map(r => r.id), id => { const r = list.find(x => x.id === id);
      return `<div class="card" data-k="${id}"><div class="row"><b>${r.name}</b><button class="btn mini" data-act="res" data-id="${id}"></button></div><div class="rec">${r.desc}</div><div class="rec trib" data-f="tn"></div></div>`; },
    (el2, id) => { const r = list.find(x => x.id === id), b = q(el2, '[data-act=res]'), tr = researchTribute(T, r, M); setText(b, money(T, r.cost)); setDisabled(b, T.items.coin < r.cost || !tributeOk(T, tr)); const n = q(el2, '[data-f=tn]'); setText(n, tributeNote(T, tr)); toggle(n, 'short', !!tr && !tributeOk(T, tr)); });
}
function renderFacility(st, T, M) {
  const el = $('#facility');
  if (!hasOff(T, 'treasurer')) { lockedPanel(el, T, 'treasurer', '町の施設', '蔵奉行を雇うと、商店街・倉庫などの施設を整えられます。'); return; }
  if (!q(el, '#facilist')) { el._h = null; el.innerHTML = '<h2>町の施設</h2><p class="note" id="facTrib"></p><div id="facilist"></div>'; }
  setText($('#facTrib'), tributeOn(st) ? '⚠ 高額な施設の強化には、お金のほかに他の地方の特産品が必要です(輸送で取り寄せましょう)。' : '');
  keyed($('#facilist'), Object.keys(GLOBAL_UPGRADES), id => `<div class="card" data-k="${id}"><div class="row"><b data-f="n"></b><button class="btn mini" data-act="gup" data-id="${id}"></button></div><div class="rec">${GLOBAL_UPGRADES[id].desc}</div><div class="rec trib" data-f="tn"></div></div>`,
    (el2, id) => { const g = GLOBAL_UPGRADES[id], c = gupCost(id, T), mx = gupMaxed(id, T), btn = q(el2, '[data-act=gup]'), tr = mx ? null : gupTribute(T, id, M);
      setText(q(el2, '[data-f=n]'), `${g.emoji} ${g.name} Lv${T.gup[id]}${g.max != null ? '/' + g.max : ''}`); setText(btn, mx ? '最大' : money(T, c)); setDisabled(btn, mx || T.items.coin < c || !tributeOk(T, tr));
      const n = q(el2, '[data-f=tn]'); setText(n, tributeNote(T, tr)); toggle(n, 'short', !!tr && !tributeOk(T, tr)); });
}

function renderQuests(st, T) {
  const list = QUESTS_OF[T.id], todo = list.filter(qu => !T.quests[qu.id]).map(qu => { const [c, t] = qu.prog(T); return { qu, c, t, r: Math.min(1, c / t) }; }).sort((a, b) => b.r - a.r);
  setText($('#qCount'), `(達成 ${Object.keys(T.quests).length}/${list.length})`);
  keyed($('#quests'), todo.slice(0, 12).map(x => x.qu.id), id => { const qu = list.find(x => x.id === id);
      return `<div class="quest" data-k="${id}"><div class="row"><span>${qu.name}</span><small>報酬 ${money(T, qu.reward)}</small></div>${bar()}<small data-f="p"></small></div>`; },
    (el, id) => { const x = todo.find(y => y.qu.id === id); setWidth(q(el, '[data-f=bar]'), x.r * 100); setText(q(el, '[data-f=p]'), `${fmt(x.c)} / ${fmt(x.t)}`); });
}
function renderAch(st) {
  setText($('#aCount'), `(${Object.keys(st.meta.ach).length}/${ACHIEVEMENTS.length}  全体速度 +${(Object.keys(st.meta.ach).length * ACH_SPEED_BONUS * 100).toFixed(0)}%)`);
  keyed($('#achs'), ACHIEVEMENTS.map(a => a.id), id => { const a = ACHIEVEMENTS.find(x => x.id === id);
      return `<div class="ach" data-k="${id}"><b>${a.name}</b><small>${a.desc}</small>${bar()}</div>`; },
    (el, id) => { const a = ACHIEVEMENTS.find(x => x.id === id), done = !!st.meta.ach[id], [c, t] = a.prog(st);
      toggle(el, 'done', done); setWidth(q(el, '[data-f=bar]'), done ? 100 : Math.min(1, c / t) * 100); });
}

// ---- 最終目標(万国もち博覧会) ----
function renderGoal(st) {
  renderGoalSet(st, GOAL, '#goalInfo', '#goalStages'); setText($('#goalCount'), `(${GOAL.stages.filter(s => st.goal.done[s.id]).length}/${GOAL.stages.length})`);
  toggle($('#goal2Wrap'), 'vhide', !st.meta.seen.goal2); if (st.meta.seen.goal2) renderGoalSet(st, GOAL2, '#goalInfo2', '#goalStages2');
}
function renderGoalSet(st, def, infoSel, stagesSel) {
  const cur = st[def.key], gm = st.meta[def.key], n = def.stages.filter(s => cur.done[s.id]).length, two = def.key === 'goal2';
  setHTML($(infoSel), `<div class="goalhead"><b>${def.name}</b><div class="bar"><i style="width:${n / def.stages.length * 100}%"></i></div><small>${def.desc}</small>
    <div class="kv"><span>完成回数</span><b>${gm.total}回${gm.clears ? `(全体速度 +${(gm.clears * def.bonus * 100).toFixed(0)}%)` : ''}</b></div>${gm.best ? `<div class="kv"><span>最短記録</span><b>${fmtTime(gm.best)}</b></div>` : ''}
    <small>${cur.cleared ? (two ? '開催済み! 世代交代をすると、もう一度挑めます。' : '今回の博覧会は開幕済み! 転生(お祭り)すると、新しい博覧会に挑めます。完成するたびに全街の全体速度が上がります。') :
      two ? '館は転生しても残るので、何周かに分けて建てられます(世代交代で白紙に戻ります)。材料は「今回の挑戦で作った量」です。' : '館は「その街で作った量」と「その街のお金」で建ちます(在庫は減りません)。お金は自動購入の予備金を増やして貯めると早いです。'}</small></div>`);
  keyed($(stagesSel), def.stages.map(s => s.id), id => { const s = GOAL_BY_ID[id];
      return `<div class="card gstage" data-k="${id}"><div class="row"><b class="gtitle">${s.icon} ${s.name}</b><button class="btn mini" data-act="goal" data-id="${id}">建てる</button></div><div class="rec">${s.desc}</div><div data-f="needs"></div>${bar()}</div>`; },
    (el, id) => {
      const s = GOAL_BY_ID[id], gs = goalStatus(st, s), T = st.t[s.town];
      toggle(el, 'done', gs.done); toggle(el, 'lockd', !gs.done && (!gs.reqOk || !T.open));
      const need = gs.needs.map(x => `<div class="gneed ${x.have >= x.want ? 'ok' : ''}"><span>${ITEMS[x.it].emoji} ${ITEMS[x.it].name}を作る(${TOWNS[s.town].name})</span><b>${fmt(Math.min(x.have, x.want))} / ${fmt(x.want)}</b></div>`);
      need.push(`<div class="gneed ${gs.coinOk ? 'ok' : ''}"><span>${TOWNS[s.town].cur.emoji} ${TOWNS[s.town].cur.name}</span><b>${fmt(Math.min(T.items.coin, s.coin))} / ${fmt(s.coin)}</b></div>`);
      if (s.requires) need.push(`<div class="gneed ${gs.reqOk ? 'ok' : ''}"><span>5つの${two ? '殿' : '館'}がそろう</span><b>${s.requires.filter(r => cur.done[r]).length} / ${s.requires.length}</b></div>`);
      if (s.earned) need.push(`<div class="gneed ${gs.earnedOk ? 'ok' : ''}"><span>今回の全街の累計獲得</span><b>${fmt(Math.min(totalEarned(st), s.earned))} / ${fmt(s.earned)}</b></div>`);
      setHTML(q(el, '[data-f=needs]'), need.join(''));
      const parts = gs.needs.map(x => Math.min(1, x.have / x.want)).concat([Math.min(1, T.items.coin / s.coin)]);
      setWidth(q(el, '[data-f=bar]'), gs.done ? 100 : parts.reduce((a, b) => a + b, 0) / parts.length * 100);
      const btn = q(el, '[data-act=goal]'); setText(btn, gs.done ? '完成' : '建てる'); setDisabled(btn, !gs.canBuy);
    });
}
function showEnding(st, def) {
  const gm = st.meta[def.key];
  setText($('#endHead'), def.end.head); setText($('#endIcon'), def.key === 'goal' ? '🎆 🏯 🎆' : '🌸 🎇 🌸');
  setText($('#endText'), `${def.end.body}\nかかった時間 ${fmtTime(st.stats.playSec)} / 全街の累計獲得 ${fmt(totalEarned(st))}\n完成回数 ${gm.total}回 → 全街の全体速度 +${(gm.clears * def.bonus * 100).toFixed(0)}%${def.key === 'goal' && canReset2(st) ? '\n\n「お祭り」タブに、次の頂へ進む「世代交代」が現れました。' : ''}`);
  $('#ending').classList.remove('hide');
}

// ---- 需給と在庫の分析 ----
// 履歴の採取: ゲーム内で HIST_DT 秒ごとに、各街・各品目の「作った量・受け取った量・使った量・売った量・送った量」の差分を速さ(個/秒)にして記録する
function sampleHist(st) {
  const now = st.stats.playSec; if (histT >= 0 && now - histT < HIST_DT) return;
  const dt = histT < 0 ? 0 : now - histT; histT = now;
  for (const T of openTowns(st)) {
    const H = HIST[T.id] || (HIST[T.id] = {}), P = histPrev[T.id] || (histPrev[T.id] = {});
    for (const k in ITEMS) {
      if (k === 'coin') continue;
      const f = T.fl[k] || {}, cur = { p: T.stats.produced[k] || 0, i: T.stats.received[k] || 0, c: f.c || 0, s: f.s || 0, e: f.e || 0, b: f.b || 0, t: f.t || 0 }, pv = P[k]; P[k] = cur;
      if (!pv || dt <= 0 || !(cur.p > 0 || cur.i > 0 || T.items[k] >= 1)) continue;
      const h = H[k] || (H[k] = { stock: [], sup: [], dem: [], sold: [] });
      h.stock.push(T.items[k]); h.sup.push(((cur.p - pv.p) + (cur.i - pv.i)) / dt); h.dem.push(((cur.c - pv.c) + (cur.s - pv.s) + (cur.e - pv.e) + (cur.b - pv.b) + (cur.t - pv.t)) / dt); h.sold.push((cur.s - pv.s) / dt);
      for (const a in h) if (h[a].length > HIST_N) h[a].shift();
    }
  }
}
const polyPts = (arr, mn, mx, w = 100, h = 24) => { const n = arr.length; if (n < 2) return ''; const r = mx - mn || 1; return arr.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 1 - (v - mn) / r * (h - 2)).toFixed(1)}`).join(' '); };
const setPoly = (el, pts) => { if (el && el._p !== pts) { el.setAttribute('points', pts); el._p = pts; } };
const lastAvg = (a, n = 5) => { if (!a || !a.length) return 0; const s = a.slice(-n); return s.reduce((x, y) => x + y, 0) / s.length; };
const itemName = k => `${ITEMS[k].emoji}${ITEMS[k].name}`;
// 診断: 止まっている建物・満杯の倉庫・建材不足・余りなど、改善の手がかりを重要な順に並べる
function diagnose(st, T, M) {
  const out = [], f = flows(T, M), cap = capOf(T, M), sellCap = cap * SELL.rate, H = HIST[T.id] || {};
  const producers = it => BUILDINGS_OF[T.id].filter(b => BUILDINGS[b].recipe.out[it]);
  for (const id of BUILDINGS_OF[T.id]) {
    const b = T.b[id], r = BUILDINGS[id].recipe; if (!b.count || !b.stalled) continue;
    if (b.why === 'input') {
      let worst = null, wr = Infinity; for (const it in r.in) { const ratio = T.items[it] / r.in[it]; if (ratio < wr) { wr = ratio; worst = it; } }
      const sup = f[worst].prod + f[worst].imp, dem = f[worst].cons, mk = producers(worst)[0];
      const how = mk ? `${BUILDINGS[mk].name}を増やす・強化する` : (PRODUCER_TOWN[worst] && PRODUCER_TOWN[worst] !== T.id ? `${TOWNS[PRODUCER_TOWN[worst]].name}から輸送で取り寄せる(輸送タブ)` : '作っている建物を増やす');
      out.push({ lv: 'bad', w: 3, t: `⚠ ${BUILDINGS[id].name}が材料不足: ${itemName(worst)} が足りません(供給 ${fmtRate(sup)}/秒 < 需要 ${fmtRate(dem)}/秒)。→ ${how}` });
    } else if (b.why === 'full') {
      const it = Object.keys(r.out)[0], prod = f[it].prod;
      out.push({ lv: 'bad', w: 4, t: `📦 ${itemName(it)} の倉庫が満杯(${fmt(T.items[it])}/${fmt(cap)})。生産 ${fmtRate(prod)}/秒に対し、売れる速さの上限は ${fmtRate(sellCap)}/秒。→ 施設タブの「倉庫」を伸ばす・使う建物や輸送先を増やす` });
    }
  }
  // 建材不足
  const ts = BUILDINGS_OF[T.id].filter(id => isUnlocked(id, T) && !BUILDINGS[id].noMat && T.items.coin >= buildingCost(id, T, M) && T.items.timber < buildingMat(id, T, M));
  if (ts.length) { const y = yardOf(T.id), fy = f.timber; out.push({ lv: 'warn', w: 5, t: `🏗️ 建材が足りず建てられない建物があります(建材 ${fmt(T.items.timber)}、${BUILDINGS[ts[0]].name}は ${fmt(buildingMat(ts[0], T, M))} 必要)。→ ${BUILDINGS[y].name}を増やす(いまの建材 +${fmtRate(fy.prod)}/秒)` }); }
  // 余り・売れ筋
  for (const k in ITEMS) {
    if (k === 'coin' || k === 'timber') continue; const h = H[k]; if (!h) continue;
    const sup = lastAvg(h.sup), dem = lastAvg(h.dem), on = T.autosell[k] != null;
    if (!on && T.items[k] >= cap * 0.6) out.push({ lv: 'warn', w: 2, t: `💤 ${itemName(k)} が倉庫にたまっています(${fmt(T.items[k])}/${fmt(cap)})が自動販売がオフです。→ 在庫タブで自動販売をオンに` });
    else if (sup > 0 && dem < sup * 0.2 && T.items[k] >= cap * 0.5) out.push({ lv: 'tip', w: 1, t: `💡 ${itemName(k)} は作りすぎです(供給 ${fmtRate(sup)}/秒に対し消費・売却は ${fmtRate(dem)}/秒)。→ 別の街へ輸送するか、使う建物を増やす` });
    if (T.items[k] > 50) {
      const best = TOWN_IDS.filter(o => o !== T.id && st.t[o].open && TOWNS[o].demand[k] >= 2.2 && TOWNS[o].demand[k] > (TOWNS[T.id].demand[k] || 1) * 1.6)[0];
      if (best && sup > dem * 1.5 && sup > 1) out.push({ lv: 'tip', w: 0, t: `💡 ${itemName(k)} は ${TOWNS[best].name} で ×${TOWNS[best].demand[k]} の高値で売れます。→ 輸送タブで送ると収入が増えます` });
    }
  }
  // 供出(他の地方の特産品)
  if (tributeOn(st)) {
    const cands = [];
    if (hasOff(T, 'scholar')) for (const r of RESEARCH_OF[T.id]) if (researchAvailable(r, T) && T.items.coin >= r.cost * 0.5) { const tr = researchTribute(T, r, M); if (tr && !tributeOk(T, tr)) cands.push({ n: r.name, tr, c: r.cost }); }
    cands.sort((a, b) => a.c - b.c); if (cands[0]) out.push({ lv: 'warn', w: 3, t: `🧩 研究「${cands[0].n}」に ${itemName(cands[0].tr.item)} ×${cands[0].tr.qty} が必要です(手持ち ${fmt(T.items[cands[0].tr.item])})。→ ${TOWNS[PRODUCER_TOWN[cands[0].tr.item]].name}から輸送で取り寄せる` });
  }
  out.sort((a, b) => b.w - a.w);
  const seen = new Set(), uniq = out.filter(o => !seen.has(o.t) && seen.add(o.t));
  return uniq.length ? uniq.slice(0, 8) : [{ lv: 'ok', t: '✅ 目立ったボトルネックはありません。建物を増やして生産を伸ばしましょう。' }];
}
function renderAnalysis(st, T, M) {
  const el = $('#analysis');
  if (!q(el, '#anDiag')) { el._h = null; el.innerHTML = '<h2>📈 需給と在庫の分析 <small id="anWho"></small></h2><p class="note">いまの街の、品目ごとの在庫・供給(作る+受け取る)・需要(使う+売る+送る+建てる)です。行を選ぶと、直近約10分のグラフが見られます。赤は倉庫が満杯、橙は足りていません。</p><div id="anDiag" class="diag"></div><div class="atab"><div class="ahead"><span>品目</span><span>在庫 / 上限</span><span>供給/秒</span><span>需要/秒</span><span>収支</span><span>在庫の推移</span></div><div id="anTable" class="atab"></div></div><div id="anDetail" class="chartbox"></div>'; }
  const H = HIST[T.id] || {}, cap = capOf(T, M), keys = Object.keys(ITEMS).filter(k => k !== 'coin' && H[k] && (T.stats.produced[k] > 0 || T.stats.received[k] > 0 || T.items[k] >= 1));
  setText($('#anWho'), `(${TOWNS[T.id].name} · 売れる速さの上限 ${fmtRate(cap * SELL.rate)}/秒/品目)`);
  setHTML($('#anDiag'), diagnose(st, T, M).map(d => `<div class="${d.lv}">${d.t}</div>`).join(''));
  if (!keys.includes(UI.an)) UI.an = keys.includes('rice') ? 'rice' : keys[0] || null;
  keyed($('#anTable'), keys, k => `<div class="arow" data-k="${k}" data-act="anpick" data-id="${k}"><span class="an">${itemName(k)}</span><span class="astock"><i></i><b></b></span><span class="asup"></span><span class="adem"></span><span class="net"></span><svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline class="s1" points=""/></svg></div>`,
    (row, k) => {
      const h = H[k], sup = lastAvg(h.sup), dem = lastAvg(h.dem), net = sup - dem, stock = T.items[k], full = stock >= cap * 0.98, short = !full && dem > sup * 1.05 + 0.01 && stock < Math.max(10, dem * 3);
      toggle(row, 'sel', UI.an === k); toggle(row, 'full', full); toggle(row, 'short', short);
      setWidth(q(row, '.astock i'), Math.min(100, stock / cap * 100)); setText(q(row, '.astock b'), `${fmt(stock)} / ${fmt(cap)}`);
      setText(q(row, '.asup'), fmtRate(sup)); setText(q(row, '.adem'), fmtRate(dem)); const n = q(row, '.net'); setText(n, (net >= 0 ? '+' : '−') + fmtRate(Math.abs(net))); toggle(n, 'pos', net > 0.01); toggle(n, 'neg', net < -0.01);
      setPoly(q(row, 'polyline'), polyPts(h.stock, 0, Math.max(cap, ...h.stock)));
    });
  // 詳細
  const k = UI.an, box = $('#anDetail');
  if (!k || !H[k]) { setHTML(box, '<p class="note">まだ記録がありません。しばらく待つとグラフが出ます。</p>'); return; }
  if (box.dataset.k !== k) { box.dataset.k = k; box._h = null; box.innerHTML = `<b>${itemName(k)}</b><div class="legend"><span><i style="background:#7be0a4"></i>供給/秒</span><span><i style="background:#ff8a80"></i>需要/秒</span><span><i style="background:#4fc3f7"></i>在庫</span></div>
      <svg viewBox="0 0 100 48" preserveAspectRatio="none"><polyline id="cSup" class="s2" stroke="#7be0a4"/><polyline id="cDem" class="s3" stroke="#ff8a80"/></svg><div class="note" style="margin:6px 0 2px">在庫(点線=上限)</div>
      <svg viewBox="0 0 100 48" preserveAspectRatio="none"><line x1="0" y1="2" x2="100" y2="2" stroke="#ffffff55" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><polyline id="cStock" stroke="#4fc3f7"/></svg><div id="anWho2" class="an-who"></div>`; }
  const h = H[k], mx = Math.max(0.01, ...h.sup, ...h.dem);
  setPoly(q(box, '#cSup'), polyPts(h.sup, 0, mx, 100, 48)); setPoly(q(box, '#cDem'), polyPts(h.dem, 0, mx, 100, 48)); setPoly(q(box, '#cStock'), polyPts(h.stock, 0, Math.max(cap, ...h.stock), 100, 48));
  const prod = BUILDINGS_OF[T.id].filter(b => BUILDINGS[b].recipe.out[k] && T.b[b].count), cons = BUILDINGS_OF[T.id].filter(b => BUILDINGS[b].recipe.in[k] && T.b[b].count), f = flows(T, M)[k], fl2 = T.fl[k] || {};
  const lines = [];
  lines.push(`作る建物: ${prod.length ? prod.map(b => `${BUILDINGS[b].name}×${T.b[b].count}(${fmtRate(ratePerSec(b, T, M) * BUILDINGS[b].recipe.out[k])}/秒${T.b[b].stalled ? '・停止中' : ''})`).join(' / ') : 'なし'}`);
  lines.push(`使う建物: ${cons.length ? cons.map(b => `${BUILDINGS[b].name}×${T.b[b].count}(${fmtRate(ratePerSec(b, T, M) * BUILDINGS[b].recipe.in[k])}/秒${T.b[b].stalled ? '・停止中' : ''})`).join(' / ') : 'なし'}`);
  lines.push(`受け取り ${fmtRate(f.imp)}/秒 · 送り出し ${fmtRate(f.exp)}/秒 · 売却 ${fmtRate(lastAvg(h.sold))}/秒(上限 ${fmtRate(cap * SELL.rate)}) · ${T.autosell[k] != null ? `自動販売オン(手元に ${fmt(effectiveKeep(T, k) || 0)} 残す)` : '自動販売オフ'}`);
  setHTML($('#anWho2'), lines.map(l => `<div class="note" style="margin:2px 0">${l}</div>`).join(''));
}
function renderFest(st) {
  const total = totalEarned(st), gain = fukuGain(total);
  setHTML($('#festInfo'), `<p class="note">全街をまっさらにして「お祭り」を開くと、今回稼いだ額(全街の合計)に応じて<b>福</b>を得ます。コイン・施設・研究・クエスト・役人・街道はリセットされますが、
    福・パーク・実績は残り、福1点ごとに全街の全体速度が +${FUKU_SPEED_BONUS * 100}% されます。</p>
    <div class="kv"><span>現在の福</span><b>${st.meta.fuku}</b></div><div class="kv"><span>累計の福</span><b>${st.meta.fukuTotal}(全体速度 +${(st.meta.fukuTotal * FUKU_SPEED_BONUS * 100).toFixed(0)}%)</b></div>
    <div class="kv"><span>転生回数</span><b>${st.meta.resets}</b></div><div class="kv"><span>今回の全街の累計獲得</span><b>${fmt(total)}</b></div><div class="kv"><span>今すぐ転生すると</span><b>福 +${gain}</b></div>
    <div class="kv"><span>次の福まで</span><b>累計 ${fmt(Math.pow(gain + 1, 2) * 1e6)}</b></div>`);
  const pb = $('#prestigeBtn'); setText(pb, gain >= 1 ? `🎆 お祭りを開く(福 +${gain})` : 'お祭りを開く(全街の累計100万から)'); setDisabled(pb, gain < 1);
  setHTML($('#legacy'), `<p class="note">博覧会の館(大祭は殿)を建てるたびに<b>記念碑</b>が立ち、その街の全体速度が +${LEGACY.monBonus * 100}% ずつ(最大${LEGACY.monMax}回ぶん)上がります。転生しても残ります。博覧会を完成させるたびに、転生後の最初から役人が付いてきます(開幕特典)。</p>
    ${TOWN_IDS.map(id => { const n = st.meta.mon[id] | 0; return `<div class="kv"><span>${TOWNS[id].emoji} ${TOWNS[id].name}の記念碑</span><b>${n}基(全体速度 +${(Math.min(LEGACY.monMax, n) * LEGACY.monBonus * 100).toFixed(0)}%)</b></div>`; }).join('')}
    ${LEGACY.gifts.map(gf => `<div class="kv"><span>${st.meta.goal.total >= gf.at ? '✅' : '🔒'} 開幕特典(完成${gf.at}回): ${gf.offs.map(o => OFFICIAL_BY_ID[o].name).join('・')}</span><b>${st.meta.goal.total >= gf.at ? '最初から在任' : `あと${gf.at - st.meta.goal.total}回`}</b></div>`).join('')}`);
  const r2 = $('#reset2Wrap'); toggle(r2, 'vhide', !st.meta.seen.homare);
  if (st.meta.seen.homare) {
    const hg = homareGain(st);
    setHTML($('#reset2Info'), `<p class="note">博覧会を${RESET2_MIN_CLEARS}回以上完成させると行えます。<b>福・パーク・今までの完成回数のボーナスをすべて手放し</b>(街・施設・役人も転生と同じくまっさらに)、代わりに<b>誉</b>を得ます。誉1点ごとに全街の全体速度が +${HOMARE_BONUS * 100}% され、次の目標「${GOAL2.name}」に挑めるようになります。</p>
      <div class="kv"><span>いまの誉</span><b>${st.meta.homare}(全体速度 +${(st.meta.homare * HOMARE_BONUS * 100).toFixed(0)}%)</b></div><div class="kv"><span>世代交代の回数</span><b>${st.meta.reset2}</b></div>
      <div class="kv"><span>博覧会の完成回数(今回の世代)</span><b>${st.meta.goal.clears} / ${RESET2_MIN_CLEARS}</b></div><div class="kv"><span>今すぐ世代交代すると</span><b>誉 +${hg}</b></div>`);
    const rb = $('#reset2Btn'); setText(rb, hg >= 1 ? `🌸 世代交代する(誉 +${hg})` : `世代交代(博覧会を${RESET2_MIN_CLEARS}回完成させると解放)`); setDisabled(rb, hg < 1);
  }
  keyed($('#perks'), PERKS.map(p => p.id), id => { const p = PERKS.find(x => x.id === id);
      return `<div class="card" data-k="${id}"><div class="row"><b data-f="n"></b><button class="btn mini" data-act="perk" data-id="${id}"></button></div><div class="rec">${p.desc}</div></div>`; },
    (el, id) => { const p = PERKS.find(x => x.id === id), mx = perkMaxed(id, st), c = perkCost(id, st), btn = q(el, '[data-act=perk]');
      setText(q(el, '[data-f=n]'), `${p.name} Lv${st.meta.perks[id] | 0}/${p.max}`); setText(btn, mx ? '最大' : `福 ${c}`); setDisabled(btn, mx || st.meta.fuku < c); });
}
const KV = [['playSec', 'プレイ時間(今回)'], ['playTotal', 'プレイ時間(合計)'], ['offline', 'オフライン進行'], ['earned', 'この街の累計獲得'], ['bonus', 'この街の報酬コイン'], ['speed', 'この街の全体速度ボーナス'], ['price', '販売価格ボーナス'], ['cap', '保管上限'], ['off', 'オフライン上限'], ['cost', '建設費の割引'], ['events', 'イベント遭遇'], ['buildings', 'この街の施設の総数'], ['offs', 'この街の役人']];
function renderStats(st, T, M) {
  const val = { playSec: fmtTime(st.stats.playSec), playTotal: fmtTime(st.meta.playSecTotal + st.stats.playSec), offline: fmtTime(st.stats.offlineSec), earned: money(T, T.stats.coinsEarned), bonus: money(T, T.stats.bonusCoins || 0),
    speed: '+' + pct(M.all), price: '+' + pct(M.price), cap: fmt(capOf(T, M)) + ' / 品目', off: fmtTime(M.off), cost: pct(M.cost), events: st.meta.eventsSeen + '回', buildings: String(Object.values(T.b).reduce((s, b) => s + b.count, 0)), offs: `${Object.keys(T.off).length}人` };
  keyed($('#stats'), KV.map(x => x[0]), k => `<div class="kv" data-k="${k}"><span>${KV.find(x => x[0] === k)[1]}</span><b data-f="v"></b></div>`, (el, k) => setText(q(el, '[data-f=v]'), val[k]));
}

// ---- 輸送(街道・自動輸送・送金) ----
const oid = (c, dir, it) => `${c}|${dir}|${it}`;
// 輸送の対象に出す品目: 送り元が作る(または中継で受け取る)もので、受け取る側が材料に使うか高く買うもの。すでに指示があるものも出す
function shipItems(S, D, orders) {
  const uses = new Set(), makes = new Set();
  for (const b of BUILDINGS_OF[D.id]) for (const it in BUILDINGS[b].recipe.in) uses.add(it);
  for (const b of BUILDINGS_OF[S.id]) for (const it in BUILDINGS[b].recipe.out) makes.add(it);
  return Object.keys(ITEMS).filter(k => k !== 'coin' && (orders[k] || ((makes.has(k) || S.stats.received[k] > 0) && (uses.has(k) || TOWNS[D.id].demand[k]))));
}
function edgeCard(st, T, cid) {
  const P = st.t[TOWNS[cid].parent], C = st.t[cid], conn = C.road >= 1 && C.open;
  let h = `<div class="card edge" data-k="${cid}" style="--ea:${TOWNS[cid].theme.accent}"><div class="row"><h3>${TOWNS[P.id].emoji} ${TOWNS[P.id].name} ⇄ <span data-f="cn"></span></h3><button class="btn mini" data-act="road" data-id="${cid}"></button></div>
    <div class="rec" data-f="desc"></div>`;
  if (!conn) return h + '</div>';
  h += `<div class="chips"><span class="chip">街道 <b data-f="lv"></b></span><span class="chip">輸送力 <b data-f="cap"></b></span><span class="chip">ロス <b data-f="toll"></b></span></div>
    <div class="courier" data-f="courier"></div>`;
  for (const [dir, S] of [['down', P], ['up', C]]) {
    const D = dir === 'down' ? C : P;
    h += `<div class="sub">${TOWNS[S.id].emoji} ${TOWNS[S.id].name} → ${TOWNS[D.id].emoji} ${TOWNS[D.id].name}</div>`;
    h += `<div class="trow coinrow" data-ti="${oid(cid, dir, 'coin')}"><span>${cur(S).emoji} ${cur(S).name}(送金)</span><b data-f="have"></b><label class="chk"><input type="checkbox" data-act="ord" data-id="${oid(cid, dir, 'coin')}">自動</label><input type="number" min="0" class="num" data-act="ordkeep" data-id="${oid(cid, dir, 'coin')}" title="手元に残す額"><span class="ship"><button class="btn mini alt" data-act="shipnow" data-id="${oid(cid, dir, 'coin')}|0.1">10%</button><button class="btn mini alt" data-act="shipnow" data-id="${oid(cid, dir, 'coin')}|0.5">50%</button><button class="btn mini alt" data-act="shipnow" data-id="${oid(cid, dir, 'coin')}|1">全部</button></span></div>`;
    for (const it of shipItems(S, D, C.ship[dir])) h += `<div class="trow" data-ti="${oid(cid, dir, it)}"><span>${ITEMS[it].emoji} ${ITEMS[it].name} <small data-f="info"></small></span><b data-f="have"></b><label class="chk"><input type="checkbox" data-act="ord" data-id="${oid(cid, dir, it)}">自動</label><input type="number" min="0" class="num" data-act="ordkeep" data-id="${oid(cid, dir, it)}" title="送り元に残す数"><span class="ship"><button class="btn mini alt" data-act="shipnow" data-id="${oid(cid, dir, it)}|0.5">50%</button><button class="btn mini alt" data-act="shipnow" data-id="${oid(cid, dir, it)}|1">全部</button></span></div>`;
  }
  return h + `<button class="btn wide alt" data-act="rec" data-id="${cid}">おすすめ設定にする</button></div>`;
}
function patchEdge(el, st, cid) {
  const P = st.t[TOWNS[cid].parent], C = st.t[cid], conn = C.road >= 1 && C.open, btn = q(el, '[data-act=road]'), Mp = mods(P);
  setText(q(el, '[data-f=cn]'), conn ? `${TOWNS[cid].emoji} ${TOWNS[cid].name}` : '❓ 未踏の地');
  setText(q(el, '[data-f=desc]'), conn ? TOWNS[cid].desc : '道を切り拓くと、新しい街が見つかるかもしれない…');
  const mx = roadMaxed(st, cid), c = roadCost(st, cid, Mp);
  setText(btn, mx ? '最大' : C.road === 0 ? `道を切り拓く ${money(P, c)}` : `強化 ${ROAD.names[C.road]}→${ROAD.names[C.road + 1]} ${money(P, c)}`); btn.title = `${TOWNS[P.id].name}のお金で支払います`;
  setDisabled(btn, mx || P.items.coin < c);
  if (!conn) return;
  const info = edgeInfo(st, cid);
  setText(q(el, '[data-f=lv]'), `Lv${C.road} ${ROAD.names[C.road]}`); setText(q(el, '[data-f=cap]'), `${fmt(info.cap)}個/秒`); setText(q(el, '[data-f=toll]'), pct(info.toll));
  const auto = canAutoShip(st, cid), cEl = q(el, '[data-f=courier]'); setText(cEl, auto ? '' : '⚠ 飛脚頭を雇うと自動輸送が動きます(「全部」「50%」ボタンは手動でいつでも使えます)'); toggle(cEl, 'warn', !auto);
  for (const [dir, S, D] of [['down', P, C], ['up', C, P]]) {
    const orders = C.ship[dir];
    for (const it of ['coin', ...shipItems(S, D, orders)]) {
      const row = q(el, `[data-ti="${oid(cid, dir, it)}"]`); if (!row) continue;
      const o = orders[it], on = o != null;
      setText(q(row, '[data-f=have]'), it === 'coin' ? `${money(S, S.items.coin)}` : `手元 ${fmt(S.items[it])}`);
      if (it !== 'coin') setText(q(row, '[data-f=info]'), TOWNS[D.id].demand[it] ? `(${TOWNS[D.id].name}で×${TOWNS[D.id].demand[it]})` : '');
      const cb = q(row, 'input[type=checkbox]'); if (cb.checked !== on) cb.checked = on;
      const kp = q(row, '.num'); kp.disabled = !on; if (document.activeElement !== kp) { const v = on ? String(o.keep) : ''; if (kp.value !== v) kp.value = v; }
    }
  }
}
function renderShip(st, T, M) {
  const edges = [];
  if (TOWNS[T.id].parent && townVisible(st, T.id)) edges.push(T.id);
  for (const c of CHILDREN_OF[T.id]) if (townVisible(st, c)) edges.push(c);
  const el = $('#ship');
  if (!q(el, '#shiplist')) { el._h = null; el.innerHTML = '<h2>🚚 輸送と街道</h2><p class="note">街は、道を切り拓くと見つかります。お金・資源は街ごとに別で、隣の街へ送れます(道のレベルで輸送力が増え、ロスが減ります)。道の費用は親の街のお金です。</p><div id="shiplist"></div>'; }
  if (!edges.length) { setHTML($('#shiplist'), `<p class="note">まだ道を切り拓ける街がありません。もちの里で累計 ${jpNum(Math.min(...CHILDREN_OF[ROOT_TOWN].map(c => TOWNS[c].needEarned)))} を稼ぐと、最初の街が見えてきます。</p>`); return; }
  keyed($('#shiplist'), edges, cid => edgeCard(st, T, cid), (card, cid) => patchEdge(card, st, cid));
}

// ---- 全体の描画 ----
const prevMs = {};
function detectMilestones(st) {          // 自動購入などで節目に届いたら、小さく祝う(最初の描画では祝わない)。同時に届いた分は1つのバナーにまとめる
  const first = !Object.keys(prevMs).length; let hit = false;
  for (const id of TOWN_IDS) {
    const T = st.t[id]; if (!T.open) continue;
    for (const b of BUILDINGS_OF[id]) {
      const m = milestoneMult(T.b[b].count), key = id + b;
      if (!first && prevMs[key] != null && m > prevMs[key] && id === UI.town) {
        if (!hit) { hit = true; FX.showBanner('節目ボーナス!', `${BUILDINGS[b].name} ${T.b[b].count}棟 → 速度 ×${m}`, TOWNS[id].theme.accent); FX.sfx('mile'); } else FX.showBanner('節目ボーナス!', '', TOWNS[id].theme.accent);
        const card = q(document, `#buildings [data-k="${b}"]`); if (card) { flash(card); FX.burstAt(card, { n: 30, colors: [TOWNS[id].theme.accent, TOWNS[id].theme.accent2, '#ffffff'] }); }
      }
      prevMs[key] = m;
    }
  }
}
// タイムトークン(貯めた時間)の表示と、加速ボタン
function renderTokens(st) {
  const bank = st.meta.bank, show = !!st.meta.seen.timetoken || bank >= 1;
  toggle($('#ttbox'), 'vhide', !show); if (!show) return;
  setText($('#ttval'), `${Math.floor(bank / TIMETOKEN.unit)}個(${fmtTime(bank)})`);
  document.querySelectorAll('#ttbox [data-act=boost]').forEach(b => { toggle(b, 'on', UI.boost === +b.dataset.id); setDisabled(b, bank <= 0 && UI.boost !== +b.dataset.id); });
}
function renderTabs(st, T) {
  const vt = visTabs();
  keyed($('#tabs'), vt.map(t => t.id), id => { const t = TABS.find(x => x.id === id); return `<button class="tabbtn" data-k="${id}" data-act="tab" data-id="${id}"><span class="ti">${t.icon}</span><span class="tl">${t.name}</span><i class="dot"></i></button>`; },
    (el, id) => {
      const t = TABS.find(x => x.id === id), locked = t.gate && !hasOff(T, t.gate); toggle(el, 'on', UI.tab === id); toggle(el, 'lock', !!locked); setText(q(el, '.ti'), locked ? '🔒' : t.icon); toggle(el, 'fresh', !!FRESH[id]);
      let n = 0; if (id === 'office') n = OFFICIALS.filter(o => canHire(T, o.id) && T.items.coin >= officialCost(T, o.id)).length; toggle(q(el, '.dot'), 'show', n > 0);
    });
}
function render() {
  clampUI(); sampleHist(state);
  const st = state, T = curT(), M = mods(T);
  renderHUD(st, T, M); renderTowns(st); renderShop(st, T, M); renderTabs(st, T); detectMilestones(st);
  const t = $('#town'), w = $('#world'); toggle(t, 'hide', UI.view !== 'town'); toggle(w, 'hide', UI.view !== 'world');
  document.querySelectorAll('#viewbar button[data-id]').forEach(b => toggle(b, 'on', b.dataset.id === UI.view)); toggle($('#dnbtn'), 'on', UI.dn !== false); renderTokens(st); toggle($('#litebtn'), 'on', !!UI.lite); toggle(document.querySelector('#viewbar [data-id=world]'), 'vhide', !st.meta.seen.towns);
  setText($('#viewhint'), UI.view === 'world' ? `発見した街 ${TOWN_IDS.filter(id => st.t[id].open).length}/${TOWN_IDS.length} · 街をクリックで切り替え` : '');
  document.querySelectorAll('[data-panel]').forEach(p => toggle(p, 'show', p.dataset.panel === UI.tab));
  switch (UI.tab) {
    case 'goal': renderGoal(st); break; case 'analysis': renderAnalysis(st, T, M); break; case 'items': renderItems(st, T, M); break; case 'office': renderOffice(st, T, M); break; case 'research': renderResearch(st, T, M); break; case 'facility': renderFacility(st, T, M); break;
    case 'quest': renderQuests(st, T); break; case 'ship': renderShip(st, T, M); break; case 'ach': renderAch(st); break; case 'fest': renderFest(st); break; case 'stats': renderStats(st, T, M); break;
  }
  setText($('#foot'), `プレイ ${fmtTime(st.stats.playSec)} / オフライン ${fmtTime(st.stats.offlineSec)} / 全街の累計獲得 ${fmt(totalEarned(st))}`);
}

// ---- 入力(イベント委譲) ----
function parseOid(id) { const [c, dir, it] = id.split('|'); return { c, dir, it }; }
document.addEventListener('click', e => {
  FX.unlock();
  const t = e.target.closest('[data-act]'); if (!t) return;
  const { act, id } = t.dataset, st = state, T = curT();
  if (act === 'build') {
    const before = T.b[id].count, mm = milestoneMult(before), n = buyMany(T, id, hasOff(T, 'builder') ? UI.qty : 1);
    if (n) {
      FX.sfx('buy'); FX.burstAt(t, { n: 10, power: 200, colors: [TOWNS[T.id].theme.accent, TOWNS[T.id].theme.accent2, '#ffffff'] }); flash(t.closest('.bcard'));
      if (milestoneMult(T.b[id].count) > mm) { FX.showBanner('節目ボーナス!', `${BUILDINGS[id].name} ${T.b[id].count}棟 → 速度 ×${milestoneMult(T.b[id].count)}`, TOWNS[T.id].theme.accent); FX.sfx('mile'); FX.burstAt(t, { n: 60, up: true, colors: [TOWNS[T.id].theme.accent, TOWNS[T.id].theme.accent2, '#ffd54f', '#ffffff'] }); }
    } else FX.sfx('no');
  }
  else if (act === 'up') { if (buyUpgrade(T, id)) { FX.sfx('up'); FX.burstAt(t, { n: 8, power: 180 }); flash(t.closest('.bcard')); } else FX.sfx('no'); }
  else if (act === 'noauto') { T.b[id].noAuto = !T.b[id].noAuto; }
  else if (act === 'gup') { if (buyGlobal(T, id)) FX.sfx('up'); }
  else if (act === 'res') { if (buyResearch(T, id)) { FX.sfx('up'); FX.burstAt(t, { n: 14 }); } }
  else if (act === 'perk') { if (buyPerk(st, id)) FX.sfx('up'); }
  else if (act === 'sell') { if (sellItem(T, id, keepOf(T, id))) FX.sfx('sell'); else FX.sfx('no'); }
  else if (act === 'sellall') { for (const k in ITEMS) sellItem(T, k); FX.sfx('sell'); }
  else if (act === 'auto') { if (t.checked) T.autosell[id] = T.keep[id] != null ? T.keep[id] : (defaultAutosell(T.id)[id] || 10); else { if (T.autosell[id] != null) T.keep[id] = T.autosell[id]; T.autosell[id] = null; } return; }
  else if (act === 'keep' || act === 'ordkeep' || act === 'reserve') return;
  else if (act === 'hire') { hireOfficial(T, id); }
  else if (act === 'autotog') { T.auto[id].on = t.checked; return; }
  else if (act === 'anpick') { UI.an = id; }
  else if (act === 'tab') { UI.tab = id; delete FRESH[id]; saveUI(); }
  else if (act === 'town') { if (st.t[id].open) { UI.town = id; saveUI(); FX.sfx('buy'); } else if (townVisible(st, id)) { UI.town = TOWNS[id].parent; UI.tab = 'ship'; saveUI(); } }
  else if (act === 'view') { UI.view = id; saveUI(); }
  else if (act === 'qty') { UI.qty = id === 'max' ? 'max' : +id; saveUI(); }
  else if (act === 'goal') { if (buildStage(st, id)) { FX.burstAt(t, { n: 30, colors: ['#ffd54f', '#ffffff'] }); save(st); } else FX.sfx('no'); }
  else if (act === 'endclose') { $('#ending').classList.add('hide'); }
  else if (act === 'lite') { UI.lite = !UI.lite; PERF.setLite(UI.lite); saveUI(); }
  else if (act === 'boost') { const v = +id; UI.boost = UI.boost === v ? 1 : (state.meta.bank > 0 ? v : 1); FX.sfx(UI.boost > 1 ? 'road' : 'buy'); }
  else if (act === 'daynight') { UI.dn = UI.dn === false; saveUI(); }
  else if (act === 'mute') { UI.muted = !UI.muted; FX.setMuted(UI.muted); saveUI(); }
  else if (act === 'road') { if (buyRoad(st, id)) { FX.sfx('road'); FX.burstAt(t, { n: 24, colors: [TOWNS[id].theme.accent, '#ffffff'] }); } else FX.sfx('no'); }
  else if (act === 'rec') { applyRecommended(st, id); FX.sfx('buy'); }
  else if (act === 'ord') {
    const { c, dir, it } = parseOid(id), C = st.t[c], tbl = C.ship[dir], sender = dir === 'down' ? TOWNS[c].parent : c;
    if (t.checked) tbl[it] = it === 'coin' ? { keep: Math.ceil(100 * TOWNS[sender].unit), max: 1e18 } : ((TOWNS[c].rec && TOWNS[c].rec[dir] && TOWNS[c].rec[dir][it]) || { keep: 20, max: 300 }); else delete tbl[it];
    return;
  }
  else if (act === 'shipnow') {
    const parts = id.split('|'), frac = +parts[3], { c, dir, it } = parseOid(parts.slice(0, 3).join('|')), P = st.t[TOWNS[c].parent], C = st.t[c], S = dir === 'down' ? P : C, D = dir === 'down' ? C : P;
    const got = shipNow(st, S.id, D.id, it, Math.floor(S.items[it] * frac));
    if (got > 0) { FX.sfx('sell'); pushToast(`${TOWNS[S.id].name} → ${TOWNS[D.id].name}: ${it === 'coin' ? cur(D).emoji : ITEMS[it].emoji}${fmt(got)} 届きました`, 2500); } else FX.sfx('no');
  }
  else if (act === 'prestige') {
    const g = fukuGain(totalEarned(st));
    if (g >= 1 && confirm(`お祭りを開きますか?\n福 +${g} を得て、全街のコイン・施設・研究・クエスト・役人・街道がリセットされます(福・パーク・実績は残ります)。`)) {
      FX.fireworks(['#ffd54f', '#ff8fb8', '#4fc3f7', '#a5d6a7']); FX.sfx('fest'); FX.showBanner('お祭り開催!', `福 +${g}`, '#ffd54f');
      prestige(st); save(st); noSave = true; setTimeout(() => location.reload(), 1600); return;
    }
  }
  else if (act === 'reset2') {
    const g = homareGain(st);
    if (g >= 1 && confirm(`世代交代しますか?\n誉 +${g} を得ますが、福・パーク・博覧会の完成回数のボーナスがすべて消え、全街がリセットされます(実績は残ります)。`)) {
      FX.fireworks(['#ffd54f', '#ff8fb8', '#ffffff']); FX.sfx('fest'); FX.showBanner('世代交代!', `誉 +${g}`, '#ff8fb8');
      reset2(st); save(st); noSave = true; setTimeout(() => location.reload(), 1800); return;
    }
  }
  else if (act === 'export') { navigator.clipboard?.writeText(exportSave(st)); pushToast('セーブデータをコピーしました', 3000); }
  else if (act === 'import') { const s = prompt('セーブ文字列を貼り付け'); if (s) { try { importSave(s); noSave = true; location.reload(); } catch { alert('読み込みに失敗しました'); } } }
  else if (act === 'reset') { if (confirm('本当にリセットしますか?(福・パーク・実績も消えます)')) { noSave = true; localStorage.removeItem(SIM.saveKey); location.reload(); } }
  render();
});
document.addEventListener('change', e => {   // 数値入力・スライダー
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, T = curT(), v = Math.max(0, Math.floor(+t.value || 0));
  if (act === 'keep') { T.keep[t.dataset.id] = v; if (T.autosell[t.dataset.id] != null) T.autosell[t.dataset.id] = v; }
  else if (act === 'ordkeep') { const { c, dir, it } = parseOid(t.dataset.id), o = state.t[c].ship[dir][it]; if (o) o.keep = v; }
  else if (act === 'reserve') { T.auto[t.dataset.id].reserve = Math.min(0.9, v / 100); }
  else return;
  render();
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-act=reserve]'); if (!t) return;
  const A = curT().auto[t.dataset.id]; A.reserve = Math.min(0.9, (+t.value || 0) / 100); setText(t.parentElement.querySelector('[data-f=rv]'), pct(A.reserve));
});
// 世界地図で街をクリックしたら、その街の画面へ(world.js が呼ぶ)
window.__worldPick = id => {
  if (id === 'expo') { UI.tab = 'goal'; delete FRESH.goal; saveUI(); FX.sfx('buy'); render(); return; }
  if (state.t[id].open) { UI.town = id; UI.view = 'town'; saveUI(); FX.sfx('buy'); }
  else { UI.town = TOWNS[id].parent; UI.tab = 'ship'; saveUI(); }
  render();
};

// ---- メインループ: 実時間を蓄積し固定ステップで消化 (TimeManager の accumulator 方式) ----
const MAX_STEPS_PER_FRAME = 20;
let timeScale = 1; // デバッグ版(debug.js)が書き換える。通常版は常に1
let last = performance.now(), acc = 0, sinceSave = 0, sinceRender = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1); last = now;
  // タイムトークン: 加速中は、増えた時間ぶんだけ貯めた時間を使う(なくなったら通常の速さに戻る)
  let boost = 1;
  if (UI.boost > 1) { if (state.meta.bank > 0) { boost = UI.boost; state.meta.bank = Math.max(0, state.meta.bank - dt * (boost - 1)); } if (state.meta.bank <= 0) { UI.boost = 1; boost = 1; pushToast('⏳ 貯めた時間を使い切りました。ふつうの速さに戻ります', 3500); } }
  acc += dt * timeScale * boost; sinceSave += dt; sinceRender += dt;
  // 1フレームの計算量に上限を設ける。倍率が高いときは刻みを粗くして(生産はバッチ計算なので結果は同じ)、画面が固まらないようにする
  const steps = Math.floor(acc / SIM.step);
  if (steps > 0) {
    const n = Math.min(steps, MAX_STEPS_PER_FRAME), d = n === steps ? SIM.step : acc / n;
    for (let i = 0; i < n; i++) tick(state, d);
    acc = n === steps ? acc - steps * SIM.step : 0;
  }
  if (sinceRender > 0.25) { render(); sinceRender = 0; }
  frameHUD(dt);
  if (sinceSave > SIM.autosaveSec && !noSave) { save(state); sinceSave = 0; }
  requestAnimationFrame(frame);
}
// タブが隠れて rAF が止まっても、復帰時にオフライン扱いで追いつく
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!noSave) save(state); }
  else { const a = applyOffline(state); if (a) pushToast(`${fmtTime(a)} ぶん進みました`, 4000); last = performance.now(); }
});
window.addEventListener('beforeunload', () => { if (!noSave) save(state); });
applyTheme(UI.town, true); render(); requestAnimationFrame(frame);
