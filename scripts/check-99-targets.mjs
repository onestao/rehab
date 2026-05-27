// node scripts/check-99-targets.mjs
// @ts-nocheck
// Enforces that every rule block in css-src/99-custom-overrides.css
// is preceded by a `/* TARGET: <host>.css */` comment naming the
// module the rule should eventually be merged back into.
//
// Run via `npm run check:99-targets`. Wired into `npm run ci`.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'css-src', '99-custom-overrides.css');
const content = await readFile(file, 'utf8');

// Strip the opening contract comment(s) and any commented-out rules to leave
// only live CSS, then ensure each rule body is preceded (within the previous
// comment) by `TARGET:`.

const lines = content.split(/\r?\n/);
const errors = [];

let inComment = false;
let lastCommentText = '';
let pendingTarget = false;
let lineNo = 0;

for (const raw of lines) {
    lineNo += 1;
    let line = raw;
    while (line.length > 0) {
        if (inComment) {
            const end = line.indexOf('*/');
            if (end < 0) { lastCommentText += ' ' + line; line = ''; }
            else {
                lastCommentText += ' ' + line.slice(0, end);
                line = line.slice(end + 2);
                inComment = false;
                if (/TARGET\s*:/i.test(lastCommentText)) pendingTarget = true;
                lastCommentText = '';
            }
        } else {
            const start = line.indexOf('/*');
            const brace = line.indexOf('{');
            if (start >= 0 && (brace < 0 || start < brace)) {
                line = line.slice(start + 2);
                inComment = true;
                lastCommentText = '';
            } else if (brace >= 0) {
                if (!pendingTarget) {
                    const head = line.slice(0, brace).trim();
                    errors.push(`${file}:${lineNo}: rule "${head || '<empty>'}" missing /* TARGET: <host>.css */ comment`);
                }
                pendingTarget = false;
                line = line.slice(brace + 1);
                const close = line.indexOf('}');
                if (close >= 0) line = line.slice(close + 1);
                else line = '';
            } else {
                line = '';
            }
        }
    }
}

if (errors.length) {
    console.error('check-99-targets: FAIL');
    for (const err of errors) console.error('  ' + err);
    process.exit(1);
}
console.log('check-99-targets: OK');
