// node scripts/check-size-limit-coverage.mjs
// @ts-nocheck
// Ensures every browser-loaded or precached local JS/MJS file belongs to a
// size-limit budget. This closes name/extension escapes such as new page
// modules, helper prefixes, or .mjs files that do not match existing globs.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const sizeLimitConfig = require(path.join(root, '.size-limit.cjs'));

const allowedUnbudgetedScripts = new Map([
    [
        'assets/heic2any.min.js',
        'special-purpose vendor HEIC converter; intentionally not constrained by app bundle thresholds'
    ]
]);

function toPosix(filePath) {
    return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function stripQuery(src) {
    return toPosix(String(src || '').split(/[?#]/)[0]);
}

function isLocalScript(src) {
    return src && !/^(?:https?:|data:|blob:)/i.test(src) && /\.(?:mjs|js)$/i.test(stripQuery(src));
}

function escapeRegExp(value) {
    return String(value).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
    return new RegExp(`^${escapeRegExp(toPosix(pattern)).replace(/\*/g, '.*')}$`);
}

function budgetMatchers() {
    const matchers = [];
    for (const entry of sizeLimitConfig) {
        const paths = Array.isArray(entry.path) ? entry.path : [entry.path];
        for (const item of paths) {
            const budgetPath = toPosix(item);
            if (!/\.(?:mjs|js)(?:$|\*)/i.test(budgetPath) && !/\*.*\.(?:mjs|js)$/i.test(budgetPath)) continue;
            matchers.push({
                name: entry.name || '<unnamed>',
                path: budgetPath,
                test: budgetPath.includes('*')
                    ? (file) => globToRegExp(budgetPath).test(file)
                    : (file) => file === budgetPath
            });
        }
    }
    return matchers;
}

function extractStaticScripts(html) {
    const scripts = new Set();
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)/gi)) {
        const src = match[1];
        if (isLocalScript(src)) scripts.add(stripQuery(src));
    }
    return scripts;
}

function resolveDynamicScriptName(name) {
    const js = `${name}.js`;
    const mjs = `${name}.mjs`;
    if (existsSync(path.join(root, js))) return js;
    if (existsSync(path.join(root, mjs))) return mjs;
    return js;
}

function extractScriptArrayObject(html, objectName, endMarker) {
    const scripts = new Set();
    const match = html.match(new RegExp(`${objectName}\\s*=\\s*({[\\s\\S]*?});\\s*${endMarker}`));
    if (!match) return scripts;

    for (const group of match[1].matchAll(/["']?[\w-]+["']?\s*:\s*\[([^\]]*)\]/g)) {
        for (const script of group[1].matchAll(/["']([^"']+)["']/g)) {
            scripts.add(resolveDynamicScriptName(script[1]));
        }
    }
    return scripts;
}

function extractPageDeps(html) {
    return extractScriptArrayObject(html, 'PAGE_DEPS', 'const _loaded');
}

function extractScriptPrerequisites(html) {
    return extractScriptArrayObject(html, 'SCRIPT_PREREQUISITES', 'function idlePreloadBudget');
}

function extractServiceWorkerScripts(sw) {
    const scripts = new Set();
    for (const match of sw.matchAll(/["']([^"']+\.(?:mjs|js)(?:\?v=\d+)?)["']/gi)) {
        const src = match[1];
        if (isLocalScript(src)) scripts.add(stripQuery(src));
    }
    return scripts;
}

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
const scripts = new Set([
    ...extractStaticScripts(html),
    ...extractPageDeps(html),
    ...extractScriptPrerequisites(html),
    ...extractServiceWorkerScripts(sw)
]);
const matchers = budgetMatchers();
const missing = [];
const uncovered = [];
const allowed = [];

for (const script of [...scripts].sort()) {
    const absolutePath = path.join(root, script);
    if (!existsSync(absolutePath)) {
        missing.push(script);
        continue;
    }
    if (matchers.some((matcher) => matcher.test(script))) continue;
    const reason = allowedUnbudgetedScripts.get(script);
    if (reason) allowed.push(`${script}: ${reason}`);
    else uncovered.push(script);
}

if (missing.length || uncovered.length) {
    console.error('check-size-limit-coverage: FAIL');
    for (const script of missing) console.error(`  missing referenced script: ${script}`);
    for (const script of uncovered) console.error(`  unbudgeted script: ${script}`);
    if (allowed.length) {
        console.error('  allowed unbudgeted scripts:');
        for (const script of allowed) console.error(`    ${script}`);
    }
    process.exit(1);
}

const coveredCount = scripts.size - allowed.length;
console.log(`check-size-limit-coverage: OK (${coveredCount} budgeted scripts, ${allowed.length} allowed unbudgeted)`);
