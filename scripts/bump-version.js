// node scripts/bump-version.js [--check|--patch|--minor|--major]
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

const argv = new Set(process.argv.slice(2));
const checkMode = argv.has('--check');
const patchMode = argv.has('--patch');
const minorMode = argv.has('--minor');
const majorMode = argv.has('--major');
const bumpFlags = [patchMode, minorMode, majorMode].filter(Boolean).length;
if (bumpFlags > 1) {
    console.error('Specify only one of --patch / --minor / --major');
    process.exit(1);
}
if (checkMode && bumpFlags > 0) {
    console.error('--check cannot be combined with --patch / --minor / --major');
    process.exit(1);
}

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
        console.error('Material Symbols font link not found');
        process.exit(1);
    }

    fs.writeFileSync(htmlPath, html);
}

function readSwVersion(swText) {
    const m = swText.match(/training-assistant-v(\d+)/);
    if (!m) {
        console.error('sw.js CACHE version not found');
        process.exit(1);
    }
    return parseInt(m[1], 10);
}

function readHtmlVersions(htmlText) {
    const set = new Set();
    const re = /\?v=(\d+)/g;
    let match;
    while ((match = re.exec(htmlText)) !== null) {
        set.add(parseInt(match[1], 10));
    }
    return set;
}

function checkVersionSync() {
    const sw = fs.readFileSync(swPath, 'utf8');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const swVersion = readSwVersion(sw);

    const swParamSet = new Set();
    sw.replace(/\?v=(\d+)/g, (_, n) => { swParamSet.add(parseInt(n, 10)); return _; });
    const swMismatched = [...swParamSet].filter(v => v !== swVersion);
    if (swMismatched.length) {
        console.error(`sw.js has ?v=${swMismatched.join(',')} but CACHE is v${swVersion}`);
        process.exit(1);
    }

    const htmlVersions = readHtmlVersions(html);
    const htmlMismatched = [...htmlVersions].filter(v => v !== swVersion);
    if (htmlMismatched.length) {
        console.error(`index.html has ?v=${htmlMismatched.join(',')} but sw.js CACHE is v${swVersion}`);
        process.exit(1);
    }

    console.log(`version sync OK (v${swVersion})`);
}

function bumpVersionMode() {
    return majorMode ? 'major' : minorMode ? 'minor' : 'patch';
}

function nextVersion(current, mode) {
    const value = Number.isFinite(current) ? current : 0;
    if (mode === 'major') return (Math.floor(value / 100) + 1) * 100;
    if (mode === 'minor') return (Math.floor(value / 10) + 1) * 10;
    return value + 1;
}

function bumpVersion() {
    runCollectIcons();
    syncIconSubset();

    const sw = fs.readFileSync(swPath, 'utf8');
    const current = readSwVersion(sw);
    const mode = bumpVersionMode();
    const next = nextVersion(current, mode);

    let swContent = sw.replace(/training-assistant-v\d+/, `training-assistant-v${next}`);
    swContent = swContent.replace(/\?v=\d+/g, `?v=${next}`);
    fs.writeFileSync(swPath, swContent);

    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/\?v=\d+/g, `?v=${next}`);
    fs.writeFileSync(htmlPath, html);

    console.log(`bumped to v${next} (${mode})`);
}

if (checkMode) {
    checkVersionSync();
} else {
    bumpVersion();
}
