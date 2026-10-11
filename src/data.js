// データ定義層 (v3: 街ごとの経済)
// 品目 / 街 / 施設 / 役人 / 研究 / パーク / クエスト / 実績 / イベント。
// 数値や内容はすべてオリジナル。ここを編集するだけでゲームを拡張できる。
'use strict';

// ---------- 品目(全街で共通の名前と基準価格。持ち物は街ごとに別) ----------
const ITEMS = {
  coin:     { name: 'コイン',   emoji: '🪙', price: 0 },
  timber:   { name: '建材',     emoji: '🏗️', price: 2 },
  // もちの里
  rice:     { name: '米',       emoji: '🌾', price: 1 },
  flour:    { name: '餅粉',     emoji: '🥣', price: 3 },
  mochi:    { name: 'お餅',     emoji: '🍡', price: 9 },
  bamboo:   { name: '竹',       emoji: '🎋', price: 1 },
  plank:    { name: '竹板',     emoji: '🪵', price: 4 },
  clay:     { name: '粘土',     emoji: '🧱', price: 2 },
  tile:     { name: '瓦',       emoji: '🏯', price: 8 },
  sake:     { name: '甘酒',     emoji: '🍶', price: 22 },
  tea:      { name: '茶葉',     emoji: '🍃', price: 6 },
  fish:     { name: '魚',       emoji: '🐟', price: 5 },
  sweets:   { name: '茶菓子',   emoji: '🍘', price: 45 },
  bento:    { name: '弁当',     emoji: '🍱', price: 34 },
  pickle:   { name: '漬物',     emoji: '🥒', price: 60 },
  tools:    { name: '農具',     emoji: '🛠️', price: 150 },
  cloth:    { name: '反物',     emoji: '🧵', price: 260 },
  // 潮見
  seafish:  { name: '鮮魚',     emoji: '🐠', price: 5 },
  salt:     { name: '塩',       emoji: '🧂', price: 4 },
  kelp:     { name: '昆布',     emoji: '🌿', price: 6 },
  dried:    { name: '干物',     emoji: '🐡', price: 20 },
  dashi:    { name: '出汁',     emoji: '🍲', price: 30 },
  // 霧ヶ峰
  wood:     { name: '木材',     emoji: '🪓', price: 2 },
  ore:      { name: '鉱石',     emoji: '⛏️', price: 4 },
  charcoal: { name: '炭',       emoji: '⚫', price: 8 },
  iron:     { name: '鉄',       emoji: '⛓️', price: 20 },
  herb:     { name: '薬草',     emoji: '🌱', price: 5 },
  tonic:    { name: '薬湯',     emoji: '♨️', price: 28 },
  // 糸川
  leaf:     { name: '桑の葉',   emoji: '🍃', price: 2 },
  cocoon:   { name: '繭',       emoji: '🥚', price: 8 },
  silk:     { name: '絹糸',     emoji: '🪢', price: 24 },
  indigo:   { name: '藍',       emoji: '🫐', price: 5 },
  dye:      { name: '染料',     emoji: '🎨', price: 12 },
  // 大都
  goldore:  { name: '金鉱石',   emoji: '🪨', price: 8 },
  goldleaf: { name: '金箔',     emoji: '🟡', price: 45 },
  gilded:   { name: '金箔菓子', emoji: '✨', price: 150 },
};

// ---------- 街道 ----------
// 街は「その街への道を切り拓く(街道Lv1)」ことで発見され、街として動き出す。道は親の街のお金で建設・強化する。
// 道のレベルが上がるほど、輸送力(毎秒の輸送量)が増え、輸送ロス(輸送の途中で失われる割合)が減る。
const ROOT_TOWN = 'home';
const ROAD = {
  max: 6,
  names: ['未踏', 'けもの道', '土の道', '砂利道', '石畳', '舗装路', '大街道'],
  cap:   [0, 50, 150, 400, 1000, 2500, 6000],      // 輸送力(個/秒)。その道を通る両方向の輸送の合計
  toll:  [1, 0.40, 0.30, 0.22, 0.15, 0.10, 0.06],  // 輸送ロス(送った量のうち失われる割合)
  growth: 3.2,                                      // 強化費の上昇率
};

// ---------- 街 ----------
// parent: 道のつながる元 / needEarned: 親(本拠地)の累計獲得コインがこれ以上で道を切り拓ける / road.cost: Lv1の費用(親の街のお金。以降 ROAD.growth 倍)
// cur: その街の通貨 / unit: その街の経済の大きさ(役人・研究・施設の費用、ランクの基準にかかる) / start: 街が開いたときの所持金
// demand: その街の市場の買い取り倍率(基準価格 × 倍率)。コインを得る手段は市場での売却だけ=輸送でお金を生む抜け道は無い
// rec: 「おすすめ設定」の輸送指示(down=親→この街 / up=この街→親)と、売り切らずに手元に残す数(hold)
// theme: 画面の配色(UI)  /  pos: 世界地図の位置
const TOWNS = {
  home: {
    name: 'もちの里', emoji: '🍡', parent: null, unit: 1, start: { coin: 10 }, cur: { emoji: '🪙', name: 'もち銭' },
    desc: '田んぼと餅の里。本拠地。', demand: {},
    theme: { accent: '#ff8fb8', accent2: '#ffc9dd', bg1: '#2a1f3a', bg2: '#3d2545', card: '#3a2c52', glow: 'rgba(255,143,184,.45)' },
    pos: { x: 230, y: 250 },
  },
  shiomi: {
    name: '潮見', emoji: '⚓', parent: 'home', needEarned: 1e6, road: { cost: 1.5e6 }, unit: 0.12, start: { coin: 160 }, cur: { emoji: '🐚', name: '貝貨' },
    desc: '海辺の港町。魚・塩・昆布が名産で、米・お餅・お茶・竹板・農具を高く買ってくれる。',
    demand: { rice: 2.6, mochi: 2.2, tea: 2.4, plank: 2.0, tools: 2.2 },
    rec: { down: { rice: { keep: 30, max: 400 }, mochi: { keep: 10, max: 200 }, plank: { keep: 10, max: 200 }, tools: { keep: 5, max: 100 } }, up: { salt: { keep: 20, max: 300 }, kelp: { keep: 20, max: 300 }, silk: { keep: 0, max: 300 }, dye: { keep: 0, max: 300 } }, hold: { salt: 60, kelp: 60 } },   // silk・dye は糸川の産物を本拠地へ中継する
    theme: { accent: '#4fc3f7', accent2: '#b3e5fc', bg1: '#0e2a3d', bg2: '#12425c', card: '#17435c', glow: 'rgba(79,195,247,.45)' },
    pos: { x: 640, y: 105 },
  },
  kirigamine: {
    name: '霧ヶ峰', emoji: '⛰', parent: 'home', needEarned: 1.5e6, road: { cost: 2.5e6 }, unit: 0.12, start: { coin: 160 }, cur: { emoji: '💎', name: '鉱銭' },
    desc: '山あいの鉱山の里。木材・鉱石・鉄・炭・薬草が名産で、甘酒・瓦・弁当・魚・餅粉を高く買ってくれる。',
    demand: { sake: 2.4, tile: 2.2, bento: 2.4, fish: 2.6, flour: 2.0 },
    rec: { down: { fish: { keep: 20, max: 300 }, sweets: { keep: 10, max: 200 } }, up: { iron: { keep: 10, max: 200 }, charcoal: { keep: 20, max: 300 } }, hold: { iron: 40, charcoal: 80 } },   // sweets は大都の金箔工房へ中継する
    theme: { accent: '#ffb74d', accent2: '#ffe0b2', bg1: '#2b2016', bg2: '#42301d', card: '#4a3721', glow: 'rgba(255,183,77,.45)' },
    pos: { x: 660, y: 385 },
  },
  itokawa: {
    name: '糸川', emoji: '🧶', parent: 'shiomi', road: { cost: 2e6 }, unit: 0.16, start: { coin: 160 }, cur: { emoji: '🧵', name: '糸銭' },
    desc: '川沿いの染めの里(潮見の先)。桑・繭・絹糸・藍・染料が名産で、茶菓子・お餅・竹板・漬物を高く買ってくれる。',
    demand: { sweets: 2.4, mochi: 2.4, plank: 2.2, pickle: 2.2, bento: 2.0 },
    rec: { down: { mochi: { keep: 10, max: 200 }, plank: { keep: 10, max: 200 }, salt: { keep: 20, max: 200 }, kelp: { keep: 20, max: 200 } }, up: { silk: { keep: 10, max: 150 }, dye: { keep: 10, max: 150 } }, hold: { silk: 30, dye: 30 } },
    theme: { accent: '#ce93d8', accent2: '#f3d5f7', bg1: '#241a3a', bg2: '#33225a', card: '#3b2a63', glow: 'rgba(206,147,216,.45)' },
    pos: { x: 1040, y: 120 },
  },
  daito: {
    name: '大都', emoji: '🏯', parent: 'kirigamine', road: { cost: 3e6 }, unit: 0.2, start: { coin: 240 }, cur: { emoji: '🏵️', name: '小判' },
    desc: '栄える城下の大都(霧ヶ峰の先)。金鉱と金箔が名産で、贅沢な品を最も高く買ってくれる。',
    demand: { sweets: 2.8, sake: 2.8, bento: 2.6, tools: 2.6, cloth: 2.6, pickle: 2.4, tile: 2.4, dried: 2.4, dashi: 2.6, tonic: 2.4 },
    rec: { down: { sweets: { keep: 10, max: 200 }, iron: { keep: 10, max: 100 }, charcoal: { keep: 10, max: 100 } }, up: { gilded: { keep: 0, max: 100 }, goldleaf: { keep: 5, max: 60 } }, hold: { goldleaf: 15 } },
    theme: { accent: '#ffd54f', accent2: '#fff1b8', bg1: '#2e1212', bg2: '#4a1c16', card: '#52221a', glow: 'rgba(255,213,79,.5)' },
    pos: { x: 1130, y: 375 },
  },
};
const TOWN_IDS = Object.keys(TOWNS);
const CHILDREN_OF = {}; for (const id of TOWN_IDS) CHILDREN_OF[id] = TOWN_IDS.filter(c => TOWNS[c].parent === id);

// ---------- 施設(建物) ----------
// town: 建てられる街 / recipe: 1サイクル time 秒、count 台ぶんが並列 / cost: 1台目の建設費(その街の通貨) / growth: 台数ごとの上昇率
// unlock: produced={品目:その街での累計生産} / received={品目:輸送で受け取った累計} / earned=その街の累計獲得コイン (すべて満たすと建設可能)
// spr: 絵の指定(town.js)。省略時は建物idの専用スプライト、無ければ汎用
const BUILDINGS = {
  // ---- もちの里 ----
  paddy:    { town: 'home', name: '田んぼ',   emoji: '🌱', recipe: { in: {},                 out: { rice: 1 },   time: 2 },   cost: 10,      growth: 1.15 },
  yard_home: { town: 'home', name: '資材場', emoji: '🏗️', recipe: { in: {}, out: { timber: 1 }, time: 4 }, cost: 8, growth: 1.15, unlock: { produced: { rice: 10 } }, noMat: true, spr: { k: 'yard' } },
  mill:     { town: 'home', name: '水車小屋', emoji: '⚙️', recipe: { in: { rice: 2 },        out: { flour: 1 },  time: 3 },   cost: 60,      growth: 1.16, unlock: { produced: { rice: 20 } } },
  mochiya:  { town: 'home', name: '餅屋',     emoji: '🍡', recipe: { in: { flour: 2 },       out: { mochi: 1 },  time: 4 },   cost: 400,     growth: 1.17, unlock: { produced: { flour: 20 } } },
  grove:    { town: 'home', name: '竹林',     emoji: '🎋', recipe: { in: {},                 out: { bamboo: 1 }, time: 2.5 }, cost: 150,     growth: 1.15, unlock: { produced: { mochi: 5 } } },
  sawmill:  { town: 'home', name: '製材所',   emoji: '🪚', recipe: { in: { bamboo: 2 },      out: { plank: 1 },  time: 3.5 }, cost: 900,     growth: 1.17, unlock: { produced: { bamboo: 20 } } },
  claypit:  { town: 'home', name: '粘土採り', emoji: '⛏️', recipe: { in: {},                 out: { clay: 1 },   time: 3 },   cost: 2500,    growth: 1.16, unlock: { produced: { plank: 10 } } },
  kiln:     { town: 'home', name: '瓦窯',     emoji: '🔥', recipe: { in: { clay: 2, bamboo: 1 }, out: { tile: 1 }, time: 5 }, cost: 8000,    growth: 1.18, unlock: { produced: { clay: 20 } } },
  brewery:  { town: 'home', name: '酒蔵',     emoji: '🍶', recipe: { in: { rice: 6, plank: 1 },  out: { sake: 1 },  time: 8 }, cost: 40000,   growth: 1.2,  unlock: { produced: { tile: 10 } } },
  tea:      { town: 'home', name: '茶畑',     emoji: '🍃', recipe: { in: {},                 out: { tea: 1 },    time: 3 },   cost: 4e5,     growth: 1.17, unlock: { earned: 3e6 } },
  pond:     { town: 'home', name: '釣り堀',   emoji: '🐟', recipe: { in: {},                 out: { fish: 1 },   time: 3.5 }, cost: 1e6,     growth: 1.17, unlock: { earned: 1e7 } },
  teahouse: { town: 'home', name: '茶屋',     emoji: '🏮', recipe: { in: { tea: 2, mochi: 1 }, out: { sweets: 1 }, time: 6 }, cost: 4e6,     growth: 1.18, unlock: { produced: { tea: 60 } } },
  kitchen:  { town: 'home', name: '料理屋',   emoji: '🍱', recipe: { in: { rice: 3, fish: 1 }, out: { bento: 1 },  time: 6 }, cost: 1e7,     growth: 1.18, unlock: { produced: { fish: 60 } } },
  // 工房(他の街の産物を輸送で受け取って使う)
  pickle:   { town: 'home', name: '漬物屋',     emoji: '🥒', recipe: { in: { rice: 4, salt: 1, kelp: 1 },        out: { pickle: 1 }, time: 6 }, cost: 8e6,  growth: 1.18, unlock: { received: { salt: 20 } } },
  smithy:   { town: 'home', name: '鍛冶屋',     emoji: '⚒️', recipe: { in: { iron: 1, charcoal: 2, plank: 1 },   out: { tools: 1 },  time: 8 }, cost: 3e7,  growth: 1.18, unlock: { received: { iron: 10 } } },
  weaver:   { town: 'home', name: '機織り小屋', emoji: '🧵', recipe: { in: { silk: 2, dye: 1 },                  out: { cloth: 1 },  time: 8 }, cost: 1e8,  growth: 1.19, unlock: { received: { silk: 10 } } },
  // ---- 潮見(港町) ----
  boat:     { town: 'shiomi', name: '漁船',   emoji: '⛵', recipe: { in: {},                      out: { seafish: 1 }, time: 2.5 }, cost: 40,   growth: 1.15, spr: { k: 'boat' } },
  yard_shiomi: { town: 'shiomi', name: '資材場', emoji: '🏗️', recipe: { in: {}, out: { timber: 1 }, time: 5 }, cost: 36, growth: 1.15, unlock: { produced: { seafish: 10 } }, noMat: true, spr: { k: 'yard' } },
  saltern:  { town: 'shiomi', name: '塩田',   emoji: '🧂', recipe: { in: {},                      out: { salt: 1 },    time: 3 },   cost: 240,   growth: 1.16, unlock: { produced: { seafish: 10 } }, spr: { k: 'pan' } },
  kelpbed:  { town: 'shiomi', name: '昆布棚', emoji: '🌿', recipe: { in: {},                      out: { kelp: 1 },    time: 3 },   cost: 800,  growth: 1.16, unlock: { produced: { salt: 20 } },    spr: { k: 'rack', a: '#2f6b3a', b: '#4f9a55' } },
  dryhouse: { town: 'shiomi', name: '干物屋', emoji: '🐡', recipe: { in: { seafish: 2, salt: 1 }, out: { dried: 1 },   time: 4 },   cost: 3600,  growth: 1.17, unlock: { produced: { kelp: 20 } },    spr: { k: 'rack', a: '#d98a4a', b: '#c0c8d0' } },
  dashiya:  { town: 'shiomi', name: '出汁屋', emoji: '🍲', recipe: { in: { kelp: 2, seafish: 1 }, out: { dashi: 1 },   time: 5 },   cost: 16000, growth: 1.18, unlock: { produced: { dried: 10 } },   spr: { k: 'cottage', wall: '#e8dcc4', roof: '#4a6f8f', sign: '🍲' } },
  // ---- 霧ヶ峰(山里) ----
  lumber:   { town: 'kirigamine', name: '木こり',     emoji: '🪓', recipe: { in: {},                       out: { wood: 1 },    time: 2 },   cost: 40,   growth: 1.15, spr: { k: 'logcamp' } },
  yard_kirigamine: { town: 'kirigamine', name: '資材場', emoji: '🏗️', recipe: { in: {}, out: { timber: 1 }, time: 2.5 }, cost: 36, growth: 1.15, unlock: { produced: { wood: 10 } }, noMat: true, spr: { k: 'yard' } },
  mine:     { town: 'kirigamine', name: '鉱山',       emoji: '⛏️', recipe: { in: {},                       out: { ore: 1 },     time: 3 },   cost: 320,   growth: 1.16, unlock: { produced: { wood: 20 } },    spr: { k: 'mine', ore: '#8a8f98' } },
  charcoalkiln: { town: 'kirigamine', name: '炭焼き', emoji: '⚫', recipe: { in: { wood: 2 },                out: { charcoal: 1 }, time: 3.5 }, cost: 1200,  growth: 1.16, unlock: { produced: { ore: 20 } },     spr: { like: 'kiln' } },
  smelter:  { town: 'kirigamine', name: '製鉄所',     emoji: '⚒️', recipe: { in: { ore: 2, charcoal: 1 },    out: { iron: 1 },    time: 5 },   cost: 6000, growth: 1.17, unlock: { produced: { charcoal: 15 } }, spr: { like: 'smithy' } },
  herbs:    { town: 'kirigamine', name: '薬草園',     emoji: '🌱', recipe: { in: {},                         out: { herb: 1 },    time: 3 },   cost: 2400,  growth: 1.16, unlock: { produced: { wood: 50 } },    spr: { k: 'plot', bed: '#6b5a3a', crop: '#7fc47a' } },
  onsen:    { town: 'kirigamine', name: '薬湯の宿',   emoji: '♨️', recipe: { in: { herb: 3 },                out: { tonic: 1 },   time: 6 },   cost: 20000, growth: 1.18, unlock: { produced: { herb: 30 } },    spr: { k: 'onsen' } },
  // ---- 糸川(染めの里) ----
  mulberry: { town: 'itokawa', name: '桑畑',   emoji: '🍃', recipe: { in: {},                  out: { leaf: 1 },   time: 2 },   cost: 40,   growth: 1.15, spr: { k: 'plot', bed: '#7b5a3a', crop: '#5fae4a' } },
  yard_itokawa: { town: 'itokawa', name: '資材場', emoji: '🏗️', recipe: { in: {}, out: { timber: 1 }, time: 3.5 }, cost: 36, growth: 1.15, unlock: { produced: { leaf: 10 } }, noMat: true, spr: { k: 'yard' } },
  silkery:  { town: 'itokawa', name: '養蚕所', emoji: '🥚', recipe: { in: { leaf: 2 },         out: { cocoon: 1 }, time: 3 },   cost: 280,   growth: 1.16, unlock: { produced: { leaf: 20 } },    spr: { k: 'cottage', wall: '#f0ece0', roof: '#7a6a9a', sign: '🥚' } },
  reeling:  { town: 'itokawa', name: '製糸場', emoji: '🪢', recipe: { in: { cocoon: 2 },       out: { silk: 1 },   time: 4 },   cost: 1600,  growth: 1.17, unlock: { produced: { cocoon: 10 } },  spr: { like: 'mill' } },
  indigofield: { town: 'itokawa', name: '藍畑', emoji: '🫐', recipe: { in: {},                  out: { indigo: 1 }, time: 3 },   cost: 1000,  growth: 1.16, unlock: { produced: { leaf: 40 } },    spr: { k: 'plot', bed: '#5a4a6a', crop: '#4a5fb0' } },
  dyeworks: { town: 'itokawa', name: '染物屋', emoji: '🎨', recipe: { in: { indigo: 2 },       out: { dye: 1 },    time: 4 },   cost: 6000, growth: 1.17, unlock: { produced: { indigo: 20 } },  spr: { k: 'rack', a: '#c06a9a', b: '#6a8fc0' } },
  // ---- 大都(城下) ----
  goldmine: { town: 'daito', name: '金鉱',     emoji: '🪨', recipe: { in: {},                      out: { goldore: 1 },  time: 4 },  cost: 40,   growth: 1.16, spr: { k: 'mine', ore: '#e6c34a' } },
  yard_daito: { town: 'daito', name: '資材場', emoji: '🏗️', recipe: { in: {}, out: { timber: 1 }, time: 6 }, cost: 48, growth: 1.15, unlock: { produced: { goldore: 10 } }, noMat: true, spr: { k: 'yard' } },
  goldbeater: { town: 'daito', name: '金箔打ち', emoji: '🟡', recipe: { in: { goldore: 2 },        out: { goldleaf: 1 }, time: 5 },  cost: 600,  growth: 1.17, unlock: { produced: { goldore: 10 } }, spr: { like: 'smithy' } },
  gilder:   { town: 'daito', name: '金箔工房', emoji: '✨', recipe: { in: { goldleaf: 1, sweets: 1 }, out: { gilded: 1 },  time: 8 },  cost: 10000, growth: 1.18, unlock: { produced: { goldleaf: 5 }, received: { sweets: 5 } }, spr: { like: 'gilder' } },
};
// ---------- 建材: どの街でも、建物を建てるにはお金のほかに建材が要る(資材場で作る。作りやすさは街しだい) ----------
// 建材の量 = 建設費(お金)× ratio ÷ 建材の値段(保管上限の capFrac まで)。資材場そのものは建材なしで建てられる。start: 街が開いたときの建材
const MAT = { ratio: 0.03, capFrac: 0.5, start: { home: 10, shiomi: 30, kirigamine: 30, itokawa: 30, daito: 40 } };
// 売却の速さ: 自動販売は、1品目につき 1秒あたり 保管上限 × rate 個まで(倉庫が大きいほど速く売れる。作りすぎると倉庫が満杯になって止まる)
const SELL = { rate: 0.5 };
const BUILDINGS_OF = {}; for (const id of TOWN_IDS) BUILDINGS_OF[id] = Object.keys(BUILDINGS).filter(b => BUILDINGS[b].town === id);

// 台数の節目ボーナス: その建物が N 台に達するたびに、その建物の速度が ×2 になる
const MILESTONES = [10, 25, 50, 100, 150, 200, 300];

// 無限レベルの生産性アップグレード: レベルごとに +25% (加算)
const UPGRADE_GROWTH = 1.9;       // コスト上昇率
const UPGRADE_EFFECT = 0.25;      // 1レベルあたりの加算ボーナス
const UPGRADE_BASE_COST_MULT = 8; // 建物コストの何倍から始めるか

// 町の施設(その街のグローバル強化)。fx は1レベルあたりの効果。max があれば上限。費用は街の unit がかかる。
const GLOBAL_UPGRADES = {
  price:   { name: '商店街',     emoji: '🏪', desc: '販売価格 +10% / Lv',        base: 200,   growth: 2.1, fx: { price: 0.10 } },
  speed:   { name: '町の活気',   emoji: '🎏', desc: '全建物の速度 +5% / Lv',      base: 1500,  growth: 2.4, fx: { speed: { all: 0.05 } } },
  storage: { name: '倉庫',       emoji: '📦', desc: '保管上限・売却の速さ ×1.5 / Lv(最大30)', base: 800, growth: 2.1, fx: { capMul: 0.5 }, max: 30 },
  offline: { name: '夜警所',     emoji: '🏮', desc: 'オフライン上限 +1時間 / Lv(最大8)', base: 20000, growth: 2.2, fx: { off: 3600 }, max: 8 },
  cost:    { name: '大工の組合', emoji: '🔨', desc: '建設費 -2% / Lv(最大15)',     base: 5000,  growth: 2.3, fx: { cost: 0.02 }, max: 15 },
};

// ---------- 役人(お金を払って雇うと、その街で機能が開放される) ----------
// cost: もちの里での費用(他の街は街の unit がかかる)。homeOnly=本拠地だけ
const OFFICIALS = [
  { id: 'merchant',  name: '商人頭',   emoji: '🧾', cost: 5e3,  desc: '自動販売の「手元に残す数」を細かく設定できる' },
  { id: 'builder',   name: '建築奉行', emoji: '🏗️', cost: 3e3,  desc: 'まとめ買い(×10 / 最大)と、自動建築(回収の早い順に買う)' },
  { id: 'upgrader',  name: '普請奉行', emoji: '🔧', cost: 2e4,  desc: '施設の強化を自動で行う' },
  { id: 'scholar',   name: '学者',     emoji: '📚', cost: 6e4,  desc: '「研究」が開放され、自動研究もできる' },
  { id: 'treasurer', name: '蔵奉行',   emoji: '🏦', cost: 3e5,  desc: '「町の施設」が開放され、自動購入もできる' },
  { id: 'courier',   name: '飛脚頭',   emoji: '📮', cost: 2e4,  desc: '輸送指示(自動輸送・自動送金)ができる。本拠地かどちらかの街にいれば道が動く' },
  { id: 'surveyor',  name: '検地役',   emoji: '🧭', cost: 2e6,  desc: '子の街への道を自動で切り拓き、強化する' },
  { id: 'festival',  name: '祭り奉行', emoji: '🎊', cost: 2e5,  desc: 'イベントの頻度 +30%・時間 +30%(本拠地のみ)', homeOnly: true },
];
const OFFICIAL_BY_ID = Object.fromEntries(OFFICIALS.map(o => [o.id, o]));
const AUTO_DEFAULT_RESERVE = 0.1;    // 自動購入が手元に残す割合

// ---------- 研究(街ごと。学者を雇うと開放。費用は街の unit がかかる) ----------
const RESEARCH_GENERAL = [
  { id: 'r_market1', name: '市場の拡張',   desc: '販売価格 +10%',          cost: 5e3,  req: [],            fx: { price: 0.10 } },
  { id: 'r_market2', name: '大市場',       desc: '販売価格 +15%',          cost: 5e5,  req: ['r_market1'], fx: { price: 0.15 } },
  { id: 'r_market3', name: '商人ギルド',   desc: '販売価格 +25%',          cost: 8e7,  req: ['r_market2'], fx: { price: 0.25 } },
  { id: 'r_store1',  name: '蔵の増築',     desc: '保管上限 +50%',          cost: 2e3,  req: [],            fx: { cap: 0.5 } },
  { id: 'r_store2',  name: '大蔵',         desc: '保管上限 +100%',         cost: 2e5,  req: ['r_store1'],  fx: { cap: 1 } },
  { id: 'r_night1',  name: '夜番制',       desc: 'オフライン上限 +4時間',  cost: 3e4,  req: [],            fx: { off: 4 * 3600 } },
  { id: 'r_night2',  name: '交代制の夜番', desc: 'オフライン上限 +8時間',  cost: 3e6,  req: ['r_night1'],  fx: { off: 8 * 3600 } },
  { id: 'r_cart1',   name: '荷車の改良',   desc: '全建物の速度 +10%',      cost: 1e5,  req: [],            fx: { speed: { all: 0.10 } } },
  { id: 'r_cart2',   name: '街道の整備',   desc: '全建物の速度 +15%',      cost: 2e7,  req: ['r_cart1'],   fx: { speed: { all: 0.15 } } },
  { id: 'r_cart3',   name: '水運の開通',   desc: '全建物の速度 +25%',      cost: 4e9,  req: ['r_cart2'],   fx: { speed: { all: 0.25 } } },
  { id: 'r_guild1',  name: '職人組合',     desc: '建設費 -5%',             cost: 4e4,  req: [],            fx: { cost: 0.05 } },
  { id: 'r_guild2',  name: '大棟梁',       desc: '建設費 -10%',            cost: 6e6,  req: ['r_guild1'],  fx: { cost: 0.10 } },
  { id: 'r_quest1',  name: '掲示板',       desc: 'クエスト報酬 +25%',      cost: 1e4,  req: [],            fx: { quest: 0.25 } },
  { id: 'r_road1',   name: '街道工事の心得', desc: '子の街への街道の建設・強化費 -15%', cost: 5e7, req: [],           fx: { roadCost: 0.15 } },
  { id: 'r_road2',   name: '大規模な土木',   desc: '子の街への街道の建設・強化費 -20%', cost: 2e9, req: ['r_road1'],  fx: { roadCost: 0.20 } },
  { id: 'r_caravan1', name: '隊商の荷車',   desc: '子の街への街道の輸送力 +30%', cost: 1e8, req: [],           fx: { roadCap: 0.3 } },
  { id: 'r_caravan2', name: '大型の隊商',   desc: '子の街への街道の輸送力 +50%', cost: 5e9, req: ['r_caravan1'], fx: { roadCap: 0.5 } },
  { id: 'r_toll1',   name: '通行手形',       desc: '輸送ロス -15%',          cost: 3e8,  req: [],            fx: { toll: 0.15 } },
  { id: 'r_toll2',   name: '関所の免除',     desc: '輸送ロス -20%',          cost: 2e10, req: ['r_toll1'],   fx: { toll: 0.20 } },
];
const RESEARCH_OF = {};
for (const tid of TOWN_IDS) {
  const unit = TOWNS[tid].unit, list = [];
  for (const id of BUILDINGS_OF[tid]) {
    const b = BUILDINGS[id];
    list.push({ id: `r_${id}_1`, name: `${b.name}の改良 I`,  desc: `${b.name}の速度 +40%`, cost: Math.ceil(b.cost * 12),  req: [],            fx: { speed: { [id]: 0.4 } } });
    list.push({ id: `r_${id}_2`, name: `${b.name}の改良 II`, desc: `${b.name}の速度 +80%`, cost: Math.ceil(b.cost * 160), req: [`r_${id}_1`], fx: { speed: { [id]: 0.8 } } });
  }
  for (const r of RESEARCH_GENERAL) list.push(Object.assign({}, r, { cost: Math.max(50, Math.ceil(r.cost * unit)) }));
  RESEARCH_OF[tid] = list;
}


// ---------- 供出: 他の地方の特産品(後半から、研究・町の施設の購入に必要) ----------
// 街が3つ以上開いたら、費用が cost×(街の unit) 以上の研究・施設には、お金のほかに「他の地方の特産品」が必要になる(費用の share ぶんの市場価値。min〜max 個、保管上限の8割まで)。
// 品は研究・施設ごとに goods の中から決まる(産地の街がまだ開いていない品は除く)。輸送を使わないと進めなくなる。
const TRIBUTE = {
  towns: 3, from: 3e6, share: 0.002, min: 5, max: 50,
  goods: { home: ['salt', 'iron', 'silk'], shiomi: ['silk', 'dye', 'tools'], kirigamine: ['goldleaf', 'gilded', 'fish'], itokawa: ['salt', 'kelp', 'mochi'], daito: ['iron', 'charcoal', 'sweets'] },
};
const PRODUCER_TOWN = {}; for (const id in BUILDINGS) for (const it in BUILDINGS[id].recipe.out) PRODUCER_TOWN[it] = BUILDINGS[id].town;

// ---------- 転生パーク(福ポイントで購入。転生しても残る。全街に効く) ----------
const FUKU_SPEED_BONUS = 0.02;      // 累計福1点につき全街の全体速度 +2%
const PERKS = [
  { id: 'p_speed', name: '福の風',   desc: '全体速度 +8% / Lv',            cost: 1, growth: 1.6, max: 30, fx: { speed: { all: 0.08 } } },
  { id: 'p_price', name: '福の市',   desc: '販売価格 +6% / Lv',            cost: 1, growth: 1.7, max: 30, fx: { price: 0.06 } },
  { id: 'p_cost',  name: '倹約の心', desc: '建設費 -2% / Lv',              cost: 2, growth: 1.7, max: 10, fx: { cost: 0.02 } },
  { id: 'p_cap',   name: '福蔵',     desc: '保管上限 +30% / Lv',           cost: 1, growth: 1.8, max: 10, fx: { cap: 0.3 } },
  { id: 'p_off',   name: '長旅の守り', desc: 'オフライン上限 +2時間 / Lv', cost: 2, growth: 2.0, max: 6,  fx: { off: 7200 } },
  { id: 'p_quest', name: '吉報',     desc: 'クエスト報酬 +20% / Lv',       cost: 1, growth: 1.8, max: 10, fx: { quest: 0.2 } },
  { id: 'p_evf',   name: '縁起物',   desc: 'イベントの頻度 +15% / Lv',     cost: 2, growth: 1.8, max: 8,  fx: { evFreq: 0.15 } },
  { id: 'p_evd',   name: '長い祭り', desc: 'イベントの時間 +20% / Lv',     cost: 2, growth: 1.8, max: 8,  fx: { evDur: 0.2 } },
  { id: 'p_road',  name: '街道の守り', desc: '街道の建設・強化費 -5% / Lv', cost: 2, growth: 1.8, max: 10, fx: { roadCost: 0.05 } },
  { id: 'p_start', name: '元手',     desc: '転生後の本拠地の開始コイン +1000 × Lv²', cost: 1, growth: 1.9, max: 12, fx: { start: 1000 } },
];
const fukuGain = total => Math.floor(Math.sqrt(total / 1e6));   // total = 全街の今回の累計獲得コイン(街の重み付き)
const TOWN_FUKU_WEIGHT = { home: 1, shiomi: 1, kirigamine: 1, itokawa: 1, daito: 1 };

// ---------- 町のランク(その街の累計獲得コインで上がる。全体速度 +3% / ランク。基準は街の unit がかかる) ----------
const RANKS = [
  { name: '集落',     at: 0 }, { name: '村',   at: 1e4 }, { name: '町',     at: 1e6 },
  { name: '大きな町', at: 1e8 }, { name: '城下町', at: 1e10 }, { name: '都',  at: 1e12 }, { name: '大都', at: 1e14 },
];
const RANK_SPEED_BONUS = 0.03;

// ---------- イベント(ランダムに発生する期間限定ボーナス。全街に効く) ----------
const EVENTS = [
  { id: 'merchant', name: '行商人が来た',   desc: '販売価格 ×2',                dur: 60, mult: { price: 2 } },
  { id: 'harvest',  name: '豊作',           desc: '田畑・漁・採集の施設 ×2',    dur: 60, mult: { b: { paddy: 2, tea: 2, pond: 2, boat: 2, kelpbed: 2, mulberry: 2, indigofield: 2, herbs: 2 } } },
  { id: 'craft',    name: '職人の日',       desc: '加工系の施設 ×1.6',          dur: 60, mult: { b: { mill: 1.6, mochiya: 1.6, sawmill: 1.6, kiln: 1.6, brewery: 1.6, teahouse: 1.6, kitchen: 1.6, pickle: 1.6, smithy: 1.6, weaver: 1.6, dryhouse: 1.6, dashiya: 1.6, charcoalkiln: 1.6, smelter: 1.6, onsen: 1.6, silkery: 1.6, reeling: 1.6, dyeworks: 1.6, goldbeater: 1.6, gilder: 1.6 } } },
  { id: 'festival', name: 'お祭り',         desc: '全施設の速度 ×1.5',          dur: 45, mult: { all: 1.5 } },
  { id: 'god',      name: '福の神の来訪',   desc: 'すべての街が2分ぶんのコインを授かる', dur: 0,  bonusCoinsSec: 120 },
];

// ---------- 数の日本語表記 ----------
function jpNum(n) {
  if (n >= 1e12) return `${+(n / 1e12).toPrecision(3)}兆`;
  if (n >= 1e8) return `${+(n / 1e8).toPrecision(3)}億`;
  if (n >= 1e4) return `${+(n / 1e4).toPrecision(3)}万`;
  return String(Math.round(n * 100) / 100);
}

// ---------- クエスト(街ごと。達成するとその街のコインで自動報酬) ----------
// prog(T) => [現在値, 目標値]
const QUESTS_OF = {};
for (const tid of TOWN_IDS) {
  const unit = TOWNS[tid].unit, list = [];
  for (const id of BUILDINGS_OF[tid]) {
    const b = BUILDINGS[id];
    list.push({ id: `q_${id}_5`,  name: `${b.name}を5棟建てる`,  prog: T => [T.b[id].count, 5],  reward: Math.ceil(b.cost * 4) });
    list.push({ id: `q_${id}_25`, name: `${b.name}を25棟建てる`, prog: T => [T.b[id].count, 25], reward: Math.ceil(b.cost * 30) });
  }
  const outs = new Set(); for (const id of BUILDINGS_OF[tid]) for (const it in BUILDINGS[id].recipe.out) outs.add(it);
  for (const it of outs) for (const n of [100, 2000]) list.push({ id: `q_p_${it}_${n}`, name: `${ITEMS[it].name}を${n}個作る`, prog: T => [T.stats.produced[it], n], reward: Math.ceil(ITEMS[it].price * n * 3) });
  for (const [n, r] of [[1e3, 50], [1e5, 5000], [1e7, 5e5], [1e9, 5e7], [1e11, 5e9]]) {
    const th = Math.max(200, n * unit);
    list.push({ id: `q_e_${n}`, name: `累計 ${jpNum(th)} を稼ぐ`, prog: T => [T.stats.coinsEarned, th], reward: Math.ceil(th * 0.05) });
  }
  if (tid === ROOT_TOWN) for (const c of CHILDREN_OF[tid]) {
    list.push({ id: `q_open_${c}`, name: `${TOWNS[c].name}への道を切り拓く`, prog: T => [T.G.t[c].road, 1], reward: TOWNS[c].road.cost });
  }
  QUESTS_OF[tid] = list;
}

// ---------- 実績(全街・全体。一度達成すると転生後も残り、全体速度 +1% ずつ) ----------
// prog(G) => [現在値, 目標値]  (G = 全体の状態)
const ACH_SPEED_BONUS = 0.01;
const sumTowns = (G, f) => TOWN_IDS.reduce((s, id) => s + f(G.t[id]), 0);
const totalEarned = G => TOWN_IDS.reduce((s, id) => s + G.t[id].stats.coinsEarned * (TOWN_FUKU_WEIGHT[id] || 1), 0);
// ---------- 最終目標: 万国もち博覧会 ----------
// 5つの街に、それぞれの特産物で「館」を建て、最後に本拠地で開会式を開く。館は「その街で作った量(need)」と「その街のお金(coin)」で建つ(在庫は減らない)。
// 全部そろうと「完成」: 記録が残り、以後ずっと全街の全体速度が +25% ずつ(完成回数ぶん)上がる。完成後も遊び続けられ、転生すると新しい博覧会を目指せる。
const GOAL = {
  key: 'goal', name: '万国もち博覧会', bonus: 0.25,
  desc: '5つの街に特産の館を建て、もちの里で開会式を開こう。完成すると、もちの里の名が世界に広まる。',
  end: { head: '万国もち博覧会、開幕!', body: '5つの街の館がそろい、もちの里で開会式が開かれました。' },
  stages: [
    { id: 'g_home',  town: 'home',       name: 'もちの里 お餅館',   icon: '🍡', coin: 3e8,   need: { mochi: 2e7, tile: 3e6 },       desc: '里のお餅と瓦を、世界へ披露する館。' },
    { id: 'g_shiomi', town: 'shiomi',    name: '潮見 海の幸館',     icon: '⚓', coin: 1e9,   need: { dashi: 1.2e7, dried: 2.5e7 },  desc: '出汁と干物の味を伝える館。' },
    { id: 'g_kiri',  town: 'kirigamine', name: '霧ヶ峰 山の恵み館', icon: '⛰', coin: 5e8,   need: { iron: 1.2e7, tonic: 5e6 },      desc: '鉄と薬湯で、山の技を見せる館。' },
    { id: 'g_ito',   town: 'itokawa',    name: '糸川 織り染め館',   icon: '🧶', coin: 5e8,   need: { silk: 2.5e7, dye: 1.8e7 },      desc: '絹糸と染料が織りなす彩りの館。' },
    { id: 'g_daito', town: 'daito',      name: '大都 黄金館',       icon: '🏯', coin: 8e8,   need: { gilded: 1e4, goldleaf: 2e7 },   desc: '金箔と金箔菓子が輝く、博覧会の目玉。' },
    { id: 'g_final', town: 'home',       name: '開会式(大天守)',   icon: '🎆', coin: 4e8,   need: {}, requires: ['g_home', 'g_shiomi', 'g_kiri', 'g_ito', 'g_daito'], earned: 4e10, desc: '5つの館がそろったら、もちの里で開会式。全街の累計獲得が必要。' },
  ],
};
// ---------- さらなる最終目標: 天下一もち大祭(「世代交代」で誉を得てから挑める。館は転生しても残り、何周かに分けて建てられる。世代交代で白紙に戻る) ----------
const GOAL2 = {
  key: 'goal2', name: '天下一もち大祭', bonus: 4,
  desc: '博覧会の先にある、世界最大のお祭り。5つの街に「大祭殿」を建て、もちの里で大宴を開こう。誉の力が必要。',
  end: { head: '天下一もち大祭、大成功!', body: '世界中の街から人々が集まり、もちの里は天下一の町になりました。' },
  stages: [
    { id: 'h_home',  town: 'home',       name: 'もちの里 餅の大蔵',   icon: '🍡', coin: 1e9,   need: { mochi: 2e8, tile: 4e7 },        desc: '山のようなお餅を納める大蔵。' },
    { id: 'h_shiomi', town: 'shiomi',    name: '潮見 大漁の殿',       icon: '⚓', coin: 6e9,   need: { dashi: 1.5e8, dried: 3e8 },     desc: '海の幸を余すところなく振る舞う殿。' },
    { id: 'h_kiri',  town: 'kirigamine', name: '霧ヶ峰 鉄と湯の殿',   icon: '⛰', coin: 3e9,   need: { iron: 1.5e8, tonic: 8e7 },        desc: '鍛冶と湯治で人々をもてなす殿。' },
    { id: 'h_ito',   town: 'itokawa',    name: '糸川 錦の殿',         icon: '🧶', coin: 2.5e9, need: { silk: 3e8, dye: 2.5e8 },        desc: '錦の幕が会場を彩る殿。' },
    { id: 'h_daito', town: 'daito',      name: '大都 黄金の大殿',     icon: '🏯', coin: 4e9,   need: { gilded: 3e5, goldleaf: 3e8 },   desc: '大祭の中心となる、黄金の大殿。' },
    { id: 'h_final', town: 'home',       name: '天下一の大宴',       icon: '🌸', coin: 1e9,   need: {}, requires: ['h_home', 'h_shiomi', 'h_kiri', 'h_ito', 'h_daito'], earned: 1e11, desc: '5つの殿がそろったら、天下一の大宴を開く。全街の累計獲得が必要。' },
  ],
};
// ---------- 博覧会の特典(転生しても残る) ----------
// 記念碑: 館(殿)を建てるたびに、その街の全体速度 +6%(最大10回ぶん。大祭の殿は2回ぶん)。
// 開幕特典: 博覧会の完成が通算 at 回に達するごとに、新しい挑戦の最初から、もちの里にその役人が(自動化オンで)いる。
const LEGACY = {
  monBonus: 0.06, monMax: 10,
  gifts: [{ at: 1, offs: ['merchant', 'builder'] }, { at: 2, offs: ['upgrader', 'courier'] }, { at: 3, offs: ['scholar', 'treasurer'] }],
  autoKey: { builder: 'build', upgrader: 'up', scholar: 'res', treasurer: 'gup' },
};
const GOALS = [GOAL, GOAL2];
for (const gs of GOALS) for (const s of gs.stages) s.set = gs.key;
const GOAL_BY_ID = Object.fromEntries(GOALS.flatMap(gs => gs.stages.map(s => [s.id, s])));
const GOAL_CLEAR_BONUS = GOAL.bonus;     // 完成1回につき全街の全体速度 +25%(転生しても残る。世代交代でリセット)
// 世代交代: 完成を2回以上重ねると行える。福・パーク・完成回数をすべて手放し、「誉」を得る。誉1点ごとに全街の全体速度 +400%
const RESET2_MIN_CLEARS = 2, HOMARE_BONUS = 4, HOMARE_PER_FUKU = 400;


const ACHIEVEMENTS = [];
{
  for (const n of [1e3, 1e5, 1e7, 1e9, 1e11, 1e13]) ACHIEVEMENTS.push({ id: `a_earn_${n}`, name: `大商人 ${jpNum(n)}`, desc: `1回の挑戦で、全街の累計 ${jpNum(n)} コインを稼ぐ`, prog: G => [totalEarned(G), n] });
  for (const id in BUILDINGS) ACHIEVEMENTS.push({ id: `a_b_${id}`, name: `${BUILDINGS[id].name}の名人`, desc: `${TOWNS[BUILDINGS[id].town].name}の${BUILDINGS[id].name}を50棟建てる`, prog: G => [G.t[BUILDINGS[id].town].b[id].count, 50] });
  for (const [it, n] of [['mochi', 5000], ['plank', 5000], ['tile', 2000], ['sake', 1000], ['sweets', 1000], ['bento', 1000], ['iron', 1000], ['silk', 1000]])
    ACHIEVEMENTS.push({ id: `a_p_${it}`, name: `${ITEMS[it].name}づくしの国`, desc: `${ITEMS[it].name}を全街で合計${n}個作る(1回の挑戦で)`, prog: G => [sumTowns(G, T => T.stats.produced[it]), n] });
  ACHIEVEMENTS.push(
    { id: 'a_towns_all', name: '街道の開拓者',   desc: 'すべての街へ道を通す',                 prog: G => [TOWN_IDS.filter(id => G.t[id].open).length, TOWN_IDS.length] },
    { id: 'a_road_max',  name: '大街道',         desc: 'いずれかの街道を最大レベルにする',     prog: G => [Math.max(0, ...TOWN_IDS.map(id => G.t[id].road)), ROAD.max] },
    { id: 'a_off_5',     name: '役所の顔ぶれ',   desc: '役人を合計5人雇う',                     prog: G => [sumTowns(G, T => Object.keys(T.off).length), 5] },
    { id: 'a_off_15',    name: '大所帯の役所',   desc: '役人を合計15人雇う',                    prog: G => [sumTowns(G, T => Object.keys(T.off).length), 15] },
    { id: 'a_ship_1',    name: '荷運びの名人',   desc: '輸送で合計 1万 個を受け取る',           prog: G => [sumTowns(G, T => Object.values(T.stats.received).reduce((a, b) => a + b, 0)), 1e4] },
  );
  for (const n of [10, 30, 60]) ACHIEVEMENTS.push({ id: `a_res_${n}`, name: `研究者 ${n}`, desc: `研究を全街で合計${n}個完了する`, prog: G => [sumTowns(G, T => Object.keys(T.res).length), n] });
  for (const n of [1, 3]) ACHIEVEMENTS.push({ id: `a_goal_${n}`, name: `博覧会の主催者 ${n}`, desc: `${GOAL.name}を${n}回完成させる`, prog: G => [G.meta.goal.total, n] });
  ACHIEVEMENTS.push({ id: 'a_goal2_1', name: '天下一の主催者', desc: `${GOAL2.name}を完成させる`, prog: G => [G.meta.goal2.total, 1] }, { id: 'a_reset2_1', name: '世代交代', desc: '世代交代を行う', prog: G => [G.meta.reset2, 1] });
  for (const n of [1, 3, 10]) ACHIEVEMENTS.push({ id: `a_reset_${n}`, name: `お祭り ${n}回`, desc: `転生を${n}回行う`, prog: G => [G.meta.resets, n] });
  for (const [n, l] of [[3600, '1時間'], [36000, '10時間']]) ACHIEVEMENTS.push({ id: `a_play_${n}`, name: `町の住人 ${l}`, desc: `合計プレイ時間 ${l}`, prog: G => [G.meta.playSecTotal + G.stats.playSec, n] });
  for (const n of [5, 25]) ACHIEVEMENTS.push({ id: `a_ev_${n}`, name: `縁起がいい ${n}`, desc: `イベントに${n}回遭遇する`, prog: G => [G.meta.eventsSeen, n] });
}


const VERSION = '0.1.1';   // 公開版のバージョン
const SIM = {
  step: 0.1,            // 固定ステップ(秒)
  baseOfflineSec: 8 * 3600,
  offlineStep: 1,       // オフライン計算の刻み
  autosaveSec: 15,
  baseCap: 500,         // 1品目あたりの基本保管上限(自動販売が有効な品目は上限なし)
  checkInterval: 0.25,  // クエスト・実績・自動化の判定間隔(ゲーム内秒)
  eventMin: 240, eventMax: 420,
  saveKey: 'mochimachi.save',
};
