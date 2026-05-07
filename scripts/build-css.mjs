import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cssFiles } from './css-sections.mjs';

const root = process.cwd();
const outDir = path.join(root, 'build');
const outFile = path.join(outDir, 'generated.css');

const chunks = [];
for (const file of cssFiles) {
  chunks.push(await readFile(path.join(root, 'css-src', file), 'utf8'));
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, chunks.join('\n'), 'utf8');
console.log(`Generated ${path.relative(root, outFile)} from ${cssFiles.length} source files`);
