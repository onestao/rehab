import { readFile, mkdir, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { cssSections } from './css-sections.mjs';

const root = process.cwd();
const srcText = await readFile(path.join(root, 'styles.css'), 'utf8');
const srcLines = srcText.split('\n');

const outDir = path.join(root, 'css-src');
const customFile = path.join(outDir, '99-custom-overrides.css');
let customContent = '';
try {
  await access(customFile);
  customContent = await readFile(customFile, 'utf8');
} catch {}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

function findMarkerIndex(marker) {
  if (marker.type === 'start') return 0;
  if (marker.type === 'exact') {
    const idx = srcLines.findIndex(line => line.trim() === marker.value.trim());
    if (idx < 0) throw new Error(`Marker not found: ${marker.value}`);
    return idx;
  }
  if (marker.type === 'pair') {
    for (let i = 0; i < srcLines.length - 1; i++) {
      if (srcLines[i].trim() === marker.line.trim() && srcLines[i + 1].includes(marker.nextIncludes)) {
        return i;
      }
    }
    throw new Error(`Pair marker not found: ${marker.nextIncludes}`);
  }
  throw new Error(`Unknown marker type: ${marker.type}`);
}

const resolved = cssSections.map(section => ({
  ...section,
  startIndex: findMarkerIndex(section.marker),
})).sort((a, b) => a.startIndex - b.startIndex);

for (let i = 0; i < resolved.length; i++) {
  const start = resolved[i].startIndex;
  const end = i + 1 < resolved.length ? resolved[i + 1].startIndex : srcLines.length;
  const content = srcLines.slice(start, end).join('\n');
  await writeFile(path.join(outDir, resolved[i].file), content, 'utf8');
}

await writeFile(customFile, customContent || '/* Migration branch custom overrides live here. */\n', 'utf8');

console.log(`Wrote ${resolved.length} files from marker-based split (styles.css: ${srcLines.length} lines)`);
