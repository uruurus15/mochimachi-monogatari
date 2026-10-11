// 進行・整合性テスト (Node):  node tests/bot.js
// 自動購入ボットで長時間プレイをシミュレートし、バランスと数値の健全性を確認する。
// テスト本体は tests/body.js(data.js + sim.js と同じ空間で実行する)。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const code = ['src/data.js', 'src/sim.js', 'tests/body.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
vm.runInNewContext(code, { console, Date, Math, process, localStorage: {}, btoa: () => '', unescape, escape }, { filename: 'mochimachi-tests' });
