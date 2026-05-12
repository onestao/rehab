// node scripts/bump-version.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const htmlPath = path.join(root, 'index.html');

const sw = fs.readFileSync(swPath, 'utf8');
const m = sw.match(/training-assistant-v(\d+)/);
if (!m) { console.error('未找到 CACHE 版本号'); process.exit(1); }
const next = parseInt(m[1], 10) + 1;

let swContent = sw.replace(/training-assistant-v\d+/, `training-assistant-v${next}`);
swContent = swContent.replace(/\?v=\d+/g, `?v=${next}`);
fs.writeFileSync(swPath, swContent);

let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\?v=\d+/g, `?v=${next}`);
fs.writeFileSync(htmlPath, html);

console.log(`bumped to v${next}`);
