// node scripts/css-overlap-report.mjs
// @ts-nocheck
// Property-level CSS overlap report.
//
// Classifies multi-file selector occurrences:
//   - real-conflict: same selector + same property, different value (later file wins)
//   - duplicate:     same selector + same property + same value (pure duplication)
//   - complement:    same selector but disjoint property sets (intentional augmentation)
//
// Exits with code 1 when real-conflict count exceeds the threshold (env CSS_REAL_CONFLICT_MAX).
// Run via `npm run check:css-overlap`. Wired into `npm run ci`.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cssFiles } from './css-sections.mjs';

const root = process.cwd();
const outDir = path.join(root, 'build');
const outFile = path.join(outDir, 'css-overlap-report.txt');
const THRESHOLD = Number(process.env.CSS_REAL_CONFLICT_MAX ?? 220);

function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseRules(content) {
    // Returns array of { selector, declarations: Map<prop, value> } pairs.
    // Handles only top-level and one-level @media nesting (good enough for this codebase).
    const stripped = stripComments(content);
    const rules = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = re.exec(stripped))) {
        const head = match[1].trim();
        const body = match[2].trim();
        if (!head || head.startsWith('@')) continue;
        const decls = new Map();
        for (const decl of body.split(';')) {
            const trimmed = decl.trim();
            if (!trimmed) continue;
            const idx = trimmed.indexOf(':');
            if (idx < 0) continue;
            const prop = trimmed.slice(0, idx).trim().toLowerCase();
            const value = trimmed.slice(idx + 1).trim();
            decls.set(prop, value);
        }
        for (const sel of head.split(',').map(s => s.trim()).filter(Boolean)) {
            rules.push({ selector: sel, declarations: decls });
        }
    }
    return rules;
}

const bySelector = new Map();
for (const file of cssFiles) {
    const content = await readFile(path.join(root, 'css-src', file), 'utf8');
    for (const rule of parseRules(content)) {
        if (!bySelector.has(rule.selector)) bySelector.set(rule.selector, []);
        bySelector.get(rule.selector).push({ file, decls: rule.declarations });
    }
}

const conflicts = [];
const duplicates = [];
const complements = [];

for (const [selector, occurrences] of bySelector) {
    if (occurrences.length < 2) continue;
    const propIndex = new Map(); // prop -> [{file, value}]
    for (const occ of occurrences) {
        for (const [prop, value] of occ.decls) {
            if (!propIndex.has(prop)) propIndex.set(prop, []);
            propIndex.get(prop).push({ file: occ.file, value });
        }
    }
    let hasShared = false;
    let hasConflict = false;
    let hasDuplicate = false;
    const conflictRows = [];
    const duplicateRows = [];
    for (const [prop, hits] of propIndex) {
        if (hits.length < 2) continue;
        hasShared = true;
        const values = new Set(hits.map(h => h.value));
        const fileList = hits.map(h => h.file).join(' / ');
        if (values.size > 1) {
            hasConflict = true;
            conflictRows.push(`    ${prop}: ${[...values].join(' | ')} (${fileList})`);
        } else {
            hasDuplicate = true;
            duplicateRows.push(`    ${prop}: ${[...values][0]} (${fileList})`);
        }
    }
    const fileSet = [...new Set(occurrences.map(o => o.file))].join(', ');
    if (hasConflict) conflicts.push(`${selector}\n  files: ${fileSet}\n${conflictRows.join('\n')}`);
    else if (hasDuplicate) duplicates.push(`${selector}\n  files: ${fileSet}\n${duplicateRows.join('\n')}`);
    else if (!hasShared) complements.push(`${selector}\n  files: ${fileSet}`);
}

await mkdir(outDir, { recursive: true });
const report = [
    `# css overlap report`,
    `# real-conflict threshold: ${THRESHOLD}`,
    ``,
    `## REAL CONFLICTS (same selector + same property, different value): ${conflicts.length}`,
    conflicts.join('\n\n') || '(none)',
    ``,
    `## DUPLICATES (same selector + same property + same value): ${duplicates.length}`,
    duplicates.join('\n\n') || '(none)',
    ``,
    `## COMPLEMENTS (same selector, disjoint properties): ${complements.length}`,
    complements.join('\n\n') || '(none)',
    ``
].join('\n');
await writeFile(outFile, report, 'utf8');

console.log(`css-overlap-report: conflicts=${conflicts.length} duplicates=${duplicates.length} complements=${complements.length}`);
console.log(`written: ${path.relative(root, outFile)}`);

if (conflicts.length > THRESHOLD) {
    console.error(`\nFAIL: ${conflicts.length} real conflicts exceed threshold ${THRESHOLD}.`);
    console.error(`Either fix conflicts (preferred) or, if intentional, raise CSS_REAL_CONFLICT_MAX in package.json ci script after a review.`);
    process.exit(1);
}
