// @ts-nocheck
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'build');
const allowlistPath = path.join(root, 'scripts', 'icons-allowlist.txt');

const DIRECT_ICON_RE = /class\s*=\s*["'][^"']*material-symbols-rounded[^"']*["'][^>]*>\s*([a-z][a-z0-9_]*)\s*</g;
const SPAN_ICON_RE = />([a-z][a-z0-9_]+)<\/span>/g;
const TERNARY_ICON_RE = /\$\{[^}]*\?\s*["']([a-z][a-z0-9_]*)["']\s*:\s*["']([a-z][a-z0-9_]*)["'][^}]*\}/g;
const PROPERTY_ICON_RE = /\bicon\s*:\s*["']([a-z][a-z0-9_]*)["']/g;
const TUPLE_ICON_RE = /\[\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["']([a-z][a-z0-9_]*)["']\s*\]/g;
const STATUS_ICON_RE = /:\s*\[\s*["']([a-z][a-z0-9_]*)["']\s*,/g;
const ICON_TEXT_ASSIGN_RE = /(?:innerText|textContent)\s*=\s*[^;\n]*(?:\?\s*)?["']([a-z][a-z0-9_]*)["'](?:\s*:\s*["']([a-z][a-z0-9_]*)["'])?/g;
const SPORT_RETURN_RE = /return\s+["']([a-z][a-z0-9_]*)["']/g;
const CONTEXT_RADIUS = 200;
const SKIP_DIRS = new Set(['.git', 'build', 'scripts']);

function shouldSkipFile(fullPath) {
    const rel = path.relative(root, fullPath).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..')) return true;
    if (rel.endsWith('.bak')) return true;
    return false;
}

function collectFiles(dir, files = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const rel = path.relative(root, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            collectFiles(fullPath, files);
            continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(html|js)$/i.test(entry.name)) continue;
        if (shouldSkipFile(fullPath)) continue;
        files.push(fullPath);
    }
    return files;
}

function readText(filePath) {
    return readFileSync(filePath, 'utf8');
}

function extractFromContent(content, icons) {
    DIRECT_ICON_RE.lastIndex = 0;
    let match;
    while ((match = DIRECT_ICON_RE.exec(content)) !== null) {
        icons.add(match[1]);
    }

    SPAN_ICON_RE.lastIndex = 0;
    while ((match = SPAN_ICON_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS);
        const context = content.slice(start, end);
        if (context.includes('material-symbols-rounded')) {
            icons.add(match[1]);
        }
    }

    TERNARY_ICON_RE.lastIndex = 0;
    while ((match = TERNARY_ICON_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS);
        const context = content.slice(start, end);
        if (context.includes('material-symbols-rounded') || context.includes('Icon')) {
            icons.add(match[1]);
            icons.add(match[2]);
        }
    }

    PROPERTY_ICON_RE.lastIndex = 0;
    while ((match = PROPERTY_ICON_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS);
        const context = content.slice(start, end);
        if (context.includes('material-symbols-rounded') || context.includes('icon')) icons.add(match[1]);
    }

    TUPLE_ICON_RE.lastIndex = 0;
    while ((match = TUPLE_ICON_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS);
        const context = content.slice(start, end);
        if (context.includes('material-symbols-rounded') || context.includes('icon')) icons.add(match[1]);
    }

    STATUS_ICON_RE.lastIndex = 0;
    while ((match = STATUS_ICON_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS * 3);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS * 3);
        const context = content.slice(start, end);
        if (context.includes('material-symbols-rounded') || context.includes('setStatus')) icons.add(match[1]);
    }

    ICON_TEXT_ASSIGN_RE.lastIndex = 0;
    while ((match = ICON_TEXT_ASSIGN_RE.exec(content)) !== null) {
        const start = Math.max(0, match.index - CONTEXT_RADIUS);
        const end = Math.min(content.length, match.index + match[0].length + CONTEXT_RADIUS);
        const context = content.slice(start, end);
        if (context.includes('playIcon') || context.includes('pipIcon') || context.includes('material-symbols-rounded')) {
            icons.add(match[1]);
            if (match[2]) icons.add(match[2]);
        }
    }

    if (content.includes('sportIcon(')) {
        SPORT_RETURN_RE.lastIndex = 0;
        while ((match = SPORT_RETURN_RE.exec(content)) !== null) icons.add(match[1]);
    }
}

function readAllowlist() {
    const lines = readText(allowlistPath).split(/\r?\n/);
    return lines
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

const icons = new Set();
for (const filePath of collectFiles(root)) {
    extractFromContent(readText(filePath), icons);
}
for (const icon of readAllowlist()) {
    icons.add(icon);
}

const sortedIcons = [...icons].sort();
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'icons.txt'), sortedIcons.join('\n'), 'utf8');
writeFileSync(path.join(outDir, 'icons.csv'), sortedIcons.join(','), 'utf8');

console.log(`Collected ${sortedIcons.length} icons → build/icons.txt, build/icons.csv`);
