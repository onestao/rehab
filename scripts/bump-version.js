// node scripts/bump-version.js [--check|--patch|--minor|--major|--print-cache-revision]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.env.REHAB_VERSION_ROOT
    ? path.resolve(process.env.REHAB_VERSION_ROOT)
    : path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const htmlPath = path.join(root, 'index.html');
const appUpdatePath = path.join(root, 'app-update.js');
const iconsCsvPath = path.join(root, 'build', 'icons.csv');
const materialIconsPath = path.join(root, 'assets', 'material-symbols-icons.txt');
const collectIconsPath = path.join(root, 'scripts', 'collect-icons.mjs');

const argv = new Set(process.argv.slice(2));
const checkMode = argv.has('--check');
const patchMode = argv.has('--patch');
const minorMode = argv.has('--minor');
const majorMode = argv.has('--major');
const printCacheRevisionMode = argv.has('--print-cache-revision');
const bumpFlags = [patchMode, minorMode, majorMode].filter(Boolean).length;
if (bumpFlags > 1) {
    console.error('Specify only one of --patch / --minor / --major');
    process.exit(1);
}
if (checkMode && bumpFlags > 0) {
    console.error('--check cannot be combined with --patch / --minor / --major');
    process.exit(1);
}
if (printCacheRevisionMode && (checkMode || bumpFlags > 0)) {
    console.error('--print-cache-revision cannot be combined with other modes');
    process.exit(1);
}

const CACHE_REVISION_PATTERN = /const CACHE_ASSET_REVISION = ['"]([a-f0-9]{64})['"]/;

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
    const bundledIconList = fs.readFileSync(materialIconsPath, 'utf8').trim();
    if (bundledIconList !== iconList) {
        console.error('Material Symbols subset is stale. Regenerate assets/material-symbols-rounded.woff2 and update assets/material-symbols-icons.txt.');
        process.exit(1);
    }
}

function addTreeFiles(target, relativeDir, extensions) {
    const absoluteDir = path.join(root, relativeDir);
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
        const relative = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name);
        if (entry.isDirectory()) addTreeFiles(target, relative, extensions);
        else if (extensions.has(path.extname(entry.name))) target.add(relative);
    }
}

function cacheManagedFiles(swText) {
    const files = new Set(['sw.js', 'index.html', 'app-update.js']);
    const assetsBlock = swText.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] || '';
    for (const match of assetsBlock.matchAll(/['"]([^'"]+)['"]/g)) {
        const asset = match[1].split(/[?#]/, 1)[0].replace(/^\.\//, '');
        if (asset && !/^[a-z]+:/i.test(asset)) files.add(asset);
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isFile() && ['.js', '.mjs'].includes(path.extname(entry.name))) files.add(entry.name);
    }
    addTreeFiles(files, 'storage', new Set(['.js', '.mjs']));
    addTreeFiles(files, 'css-src', new Set(['.css']));
    addTreeFiles(files, 'i18n', new Set(['.json']));
    if (fs.existsSync(path.join(root, 'build', 'generated.css'))) files.add('build/generated.css');
    return [...files].filter((relative) => fs.existsSync(path.join(root, relative))).sort();
}

function normalizedCacheAsset(relative, buffer) {
    const textExtensions = new Set(['.js', '.mjs', '.css', '.json', '.html', '.svg', '.txt', '.csv', '.webmanifest']);
    if (!textExtensions.has(path.extname(relative))) return buffer;
    let normalized = buffer.toString('utf8').replace(/\r\n/g, '\n');
    if (['sw.js', 'index.html', 'app-update.js'].includes(relative)) {
        normalized = normalized
            .replace(/training-assistant-v\d+/g, 'training-assistant-v<VERSION>')
            .replace(/\?v=\d+/g, '?v=<VERSION>')
            .replace(/version:\s*['"]\d+['"]/g, "version: '<VERSION>'")
            .replace(/rehab-sw-controller-reload-v\d+/g, 'rehab-sw-controller-reload-v<VERSION>')
            .replace(CACHE_REVISION_PATTERN, "const CACHE_ASSET_REVISION = '<REVISION>'");
    }
    return Buffer.from(normalized, 'utf8');
}

function computeCacheAssetRevision() {
    const sw = fs.readFileSync(swPath, 'utf8');
    const hash = crypto.createHash('sha256');
    for (const relative of cacheManagedFiles(sw)) {
        hash.update(relative.replaceAll('\\', '/'));
        hash.update('\0');
        hash.update(normalizedCacheAsset(relative, fs.readFileSync(path.join(root, relative))));
        hash.update('\0');
    }
    return hash.digest('hex');
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
    const appUpdate = fs.readFileSync(appUpdatePath, 'utf8');
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

    const appUpdateVersions = readHtmlVersions(appUpdate);
    const appUpdateMismatched = [...appUpdateVersions].filter(v => v !== swVersion);
    if (appUpdateMismatched.length) {
        console.error(`app-update.js has ?v=${appUpdateMismatched.join(',')} but sw.js CACHE is v${swVersion}`);
        process.exit(1);
    }

    const appUpdateVersion = appUpdate.match(/version:\s*['"](\d+)['"]/);
    if (!appUpdateVersion) {
        console.error('app-update.js version property not found');
        process.exit(1);
    }
    if (parseInt(appUpdateVersion[1], 10) !== swVersion) {
        console.error(`app-update.js version is ${appUpdateVersion[1]} but sw.js CACHE is v${swVersion}`);
        process.exit(1);
    }

    for (const [label, source] of [['index.html', html], ['app-update.js', appUpdate]]) {
        const reloadVersions = [...source.matchAll(/rehab-sw-controller-reload-v(\d+)/g)].map((match) => parseInt(match[1], 10));
        if (!reloadVersions.length || reloadVersions.some((version) => version !== swVersion)) {
            console.error(`${label} controller reload key is missing or does not match v${swVersion}`);
            process.exit(1);
        }
    }

    const storedRevision = sw.match(CACHE_REVISION_PATTERN)?.[1];
    if (!storedRevision) {
        console.error('sw.js CACHE_ASSET_REVISION not found');
        process.exit(1);
    }
    const actualRevision = computeCacheAssetRevision();
    if (storedRevision !== actualRevision) {
        console.error('cache-managed asset fingerprint changed without a version bump; run node scripts/bump-version.js --patch');
        console.error(`stored=${storedRevision}`);
        console.error(`actual=${actualRevision}`);
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
    html = html.replace(/rehab-sw-controller-reload-v\d+/g, `rehab-sw-controller-reload-v${next}`);
    fs.writeFileSync(htmlPath, html);

    let appUpdate = fs.readFileSync(appUpdatePath, 'utf8');
    appUpdate = appUpdate.replace(/\?v=\d+/g, `?v=${next}`);
    appUpdate = appUpdate.replace(/version:\s*['"]\d+['"]/, `version: '${next}'`);
    appUpdate = appUpdate.replace(/rehab-sw-controller-reload-v\d+/g, `rehab-sw-controller-reload-v${next}`);
    fs.writeFileSync(appUpdatePath, appUpdate);

    const revision = computeCacheAssetRevision();
    swContent = fs.readFileSync(swPath, 'utf8').replace(CACHE_REVISION_PATTERN, `const CACHE_ASSET_REVISION = '${revision}'`);
    fs.writeFileSync(swPath, swContent);

    console.log(`bumped to v${next} (${mode})`);
}

if (printCacheRevisionMode) {
    console.log(computeCacheAssetRevision());
} else if (checkMode) {
    checkVersionSync();
} else {
    bumpVersion();
}
