import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readRootFile(file) {
    return readFileSync(path.join(process.cwd(), file), 'utf8');
}

function extractBlock(source, start, end) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `${start} should exist`);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(endIndex, -1, `${end} should exist after ${start}`);
    return source.slice(startIndex, endIndex);
}

test('42 health profile CSS is lazy for profile and records training only', () => {
    const html = readRootFile('index.html');
    const cssDeps = extractBlock(html, 'const CSS_DEPS = {', 'const _loaded');

    assert.match(cssDeps, /profile:\s*\['42-health-profile'\]/);
    assert.doesNotMatch(cssDeps, /records:\s*\['42-health-profile'\]/);
    assert.match(html, /page === 'records' && view === 'training'\) deps\.add\('42-health-profile'\)/);
});

test('records training triggers health profile CSS without blocking records entry', () => {
    const state = readRootFile('data-ui-state.js');

    assert.match(state, /ensureHealthViewCss\(view\)/);
    assert.match(state, /window\.loadAppCss\?\.\('42-health-profile'\)/);
    assert.match(state, /this\.ensureHealthViewCss\(view\)/);
    assert.match(state, /this\.ensureHealthViewCss\(nextView\)/);
});

test('lazy CSS failures are reported without rejecting page dependency loading', () => {
    const html = readRootFile('index.html');

    assert.match(html, /Promise\.allSettled\(deps\.map\(loadCss\)\)/);
    assert.match(html, /errorBus\?\.report\?\.\('ui\.css\.lazy'/);
    assert.doesNotMatch(html, /await Promise\.all\(deps\.map\(loadCss\)\)/);
});

test('lazy CSS retry ignores failed link elements', () => {
    const html = readRootFile('index.html');

    assert.match(html, /link\[data-app-css="\$\{name\}"\]\[data-loaded="true"\]/);
    assert.match(html, /link\.dataset\.loaded = 'true'/);
    assert.match(html, /link\.remove\(\)/);
});

test('health profile lazy CSS is warmed only during idle-friendly conditions', () => {
    const html = readRootFile('index.html');

    assert.match(html, /function canIdlePreloadCss\(\)/);
    assert.match(html, /connection\?\.saveData\) return false/);
    assert.match(html, /function warmLazyCss\(name\)/);
    assert.match(html, /idle\(\(\) => warmLazyCss\('42-health-profile'\), \{ timeout: 6000 \}\)/);
});

test('records training keeps only critical health profile layout in eager CSS', () => {
    const css = readRootFile('css-src/53-v6-records.css');
    const critical = css.slice(css.indexOf('.health-swipe-page[data-health-page="training"] .health-profile-card'));

    assert.match(critical, /profile-head/);
    assert.match(critical, /grid-template-columns/);
    assert.doesNotMatch(critical, /radial-gradient|linear-gradient|box-shadow|transition|:hover/);
});

test('lazy health profile CSS uses the same versioned path as service worker precache', () => {
    const html = readRootFile('index.html');
    const sw = readRootFile('sw.js');
    const indexVersion = html.match(/css-src\/\$\{name\}\.css\?v=(\d+)/)?.[1];
    const swVersion = sw.match(/css-src\/42-health-profile\.css\?v=(\d+)/)?.[1];

    assert.equal(indexVersion, swVersion);
    assert.ok(swVersion);
    assert.match(swVersion, /^\d+$/);
});
