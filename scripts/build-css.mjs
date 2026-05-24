// @ts-nocheck
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cssFiles } from './css-sections.mjs';

const root = process.cwd();
const outDir = path.join(root, 'build');
const outFile = path.join(outDir, 'generated.css');

function layerFor(file) {
  const n = Number((file.match(/^(\d+)/) || [])[1] || 0);
  if (file === '99-custom-overrides.css') return 'overrides';
  if (n === 32) return 'utilities';
  if (n === 1 || n === 2) return 'base';
  return 'components';
}

function collectSelectors(file, content, acc) {
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}@]+)\{/g;
  let match;
  while ((match = re.exec(stripped))) {
    const selector = match[1].trim();
    if (!selector || selector.includes('\n    from') || selector.includes('\n    to')) continue;
    selector.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      acc.set(s, [...(acc.get(s) || []), file]);
    });
  }
}

const chunks = ['@layer fonts, base, components, utilities, overrides;\n'];
const selectorMap = new Map();
for (const file of cssFiles) {
  const content = await readFile(path.join(root, 'css-src', file), 'utf8');
  collectSelectors(file, content, selectorMap);
  chunks.push(`@layer ${layerFor(file)} {\n${content}\n}\n`);
}

await mkdir(outDir, { recursive: true });
let output = chunks.join('');
try {
  const lightning = await import('lightningcss');
  if (lightning?.transform) {
    output = lightning.transform({
      filename: outFile,
      code: Buffer.from(output),
      minify: true
    }).code.toString();
  }
} catch {}

await writeFile(outFile, output, 'utf8');

const duplicates = [...selectorMap.entries()]
  .filter(([, files]) => new Set(files).size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));
const report = duplicates.length
  ? duplicates.map(([selector, files]) => `${selector}\n  ${[...new Set(files)].join(', ')}`).join('\n\n')
  : 'No duplicate selectors found.';
await writeFile(path.join(outDir, 'css-dedup-report.txt'), `${report}\n`, 'utf8');
console.log(`Generated ${path.relative(root, outFile)} from ${cssFiles.length} source files`);
