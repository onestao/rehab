// node scripts/check-css-source-registry.mjs
// @ts-nocheck
// Ensures every css-src/*.css file is registered as eager CSS, lazy CSS, or
// the managed 99-custom-overrides.css queue.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { cssFiles, lazyCssFiles } from './css-sections.mjs';

const root = process.cwd();
const sourceDir = path.join(root, 'css-src');
const sourceFiles = (await readdir(sourceDir))
    .filter(file => file.endsWith('.css'))
    .sort((a, b) => a.localeCompare(b));

const customFile = '99-custom-overrides.css';
const eagerCssFiles = cssFiles.filter(file => file !== customFile);
const registered = new Set([...eagerCssFiles, ...lazyCssFiles, customFile]);
const eagerSet = new Set(eagerCssFiles);
const lazySet = new Set(lazyCssFiles);
const errors = [];

for (const file of sourceFiles) {
    if (!registered.has(file)) {
        errors.push(`${file}: not registered in cssFiles, lazyCssFiles, or 99-custom-overrides.css`);
    }
}

for (const file of registered) {
    if (!sourceFiles.includes(file)) {
        errors.push(`${file}: registered but missing from css-src/`);
    }
}

for (const file of lazyCssFiles) {
    if (eagerSet.has(file)) {
        errors.push(`${file}: registered as both eager and lazy CSS`);
    }
}

for (const file of eagerCssFiles) {
    if (lazySet.has(file)) {
        errors.push(`${file}: registered as both eager and lazy CSS`);
    }
}

if (errors.length) {
    console.error('check-css-source-registry: FAIL');
    for (const err of errors) console.error('  ' + err);
    process.exit(1);
}

console.log(`check-css-source-registry: OK (${sourceFiles.length} source files; ${eagerCssFiles.length} eager, ${lazyCssFiles.length} lazy, 1 custom)`);
