// node scripts/bump-version.js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const htmlPath = path.join(root, 'index.html');
const iconsCsvPath = path.join(root, 'build', 'icons.csv');
const collectIconsPath = path.join(root, 'scripts', 'collect-icons.mjs');

function runCollectIcons() {
    const result = spawnSync(process.execPath, [collectIconsPath], {
        cwd: root,
        stdio: 'inherit'
    });
    if (result.status !== 0) {
        console.error('collect-icons.mjs failed');
        process.exit(result.status || 1);
    }
}

function syncIconSubset() {
    const iconList = fs.readFileSync(iconsCsvPath, 'utf8').trim();
    let html = fs.readFileSync(htmlPath, 'utf8');
    const withIconNames = /(https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Rounded[^"']*?)(&icon_names=)([^"']*)/;
    const baseUrl = /(https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Rounded[^"']*?)(&display=swap)/;

    if (withIconNames.test(html)) {
        html = html.replace(withIconNames, `$1$2${iconList}`);
    } else if (baseUrl.test(html)) {
        html = html.replace(baseUrl, `$1&icon_names=${iconList}$2`);
    } else {
        console.error('未找到 Material Symbols 字体链接');
        process.exit(1);
    }

    fs.writeFileSync(htmlPath, html);
}

runCollectIcons();
syncIconSubset();

const sw = fs.readFileSync(swPath, 'utf8');
const m = sw.match(/training-assistant-v(\d+)/);
if (!m) {
    console.error('未找到 CACHE 版本号');
    process.exit(1);
}
const next = parseInt(m[1], 10) + 1;

let swContent = sw.replace(/training-assistant-v\d+/, `training-assistant-v${next}`);
swContent = swContent.replace(/\?v=\d+/g, `?v=${next}`);
fs.writeFileSync(swPath, swContent);

let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\?v=\d+/g, `?v=${next}`);
fs.writeFileSync(htmlPath, html);

console.log(`bumped to v${next}`);
