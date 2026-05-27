// node scripts/check-css-section-markers.mjs
// @ts-nocheck
// Verifies that each css-src/<file>.css starts with the marker registered in
// scripts/css-sections.mjs. Catches drift between the file header comment
// and the marker the snapshot rebuild relies on.
//
// Run via `npm run check:css-markers`. Wired into `npm run ci`.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cssSections } from './css-sections.mjs';

const root = process.cwd();
const errors = [];

for (const section of cssSections) {
    const file = section.file;
    const marker = section.marker;
    const content = await readFile(path.join(root, 'css-src', file), 'utf8');
    const head = content.slice(0, 400);
    if (marker.type === 'exact') {
        if (!head.startsWith(marker.value)) {
            errors.push(`${file}: missing marker "${marker.value.replace(/\n/g, '\\n')}" at file head`);
        }
    } else if (marker.type === 'pair') {
        if (!head.startsWith(marker.line)) {
            errors.push(`${file}: missing marker line "${marker.line}" at file head`);
        } else if (!head.includes(marker.nextIncludes)) {
            errors.push(`${file}: marker pair next-includes "${marker.nextIncludes}" not found near head`);
        }
    } else if (marker.type !== 'start') {
        errors.push(`${file}: unsupported marker type "${marker.type}"`);
    }
}

if (errors.length) {
    console.error('check-css-section-markers: FAIL');
    for (const err of errors) console.error('  ' + err);
    process.exit(1);
}
console.log(`check-css-section-markers: OK (${cssSections.length} files)`);
