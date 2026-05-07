import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'build');
const outFile = path.join(outDir, 'generated.css');
const srcFile = path.join(root, 'styles.css');

await mkdir(outDir, { recursive: true });
await copyFile(srcFile, outFile);
console.log(`Copied styles.css -> ${path.relative(root, outFile)}`);
