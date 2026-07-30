// @ts-nocheck
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const iconsPath = path.join(root, 'build', 'icons.csv');
const bundledIconsPath = path.join(root, 'assets', 'material-symbols-icons.txt');
const fontPath = path.join(root, 'assets', 'material-symbols-rounded.woff2');
const tempFontPath = `${fontPath}.tmp`;
const FONT_CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';

function fail(message) {
    throw new Error(`Material Symbols update failed: ${message}`);
}

function validateIcons(raw) {
    const icons = String(raw || '').trim().split(',').filter(Boolean);
    if (!icons.length) fail('empty icon list');
    if (icons.some(icon => !/^[a-z][a-z0-9_]*$/.test(icon))) fail('invalid icon name');
    const normalized = [...new Set(icons)].sort();
    if (normalized.join(',') !== icons.join(',')) fail('build/icons.csv must be sorted and unique');
    return icons;
}

async function fetchRequired(url, accept) {
    const response = await fetch(url, {
        headers: {
            accept,
            'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36'
        },
        redirect: 'follow'
    });
    if (!response.ok) fail(`${response.status} from ${new URL(url).hostname}`);
    return response;
}

const icons = validateIcons(await readFile(iconsPath, 'utf8'));
const cssUrl = new URL(FONT_CSS_ENDPOINT);
cssUrl.searchParams.set('family', 'Material Symbols Rounded');
cssUrl.searchParams.set('icon_names', icons.join(','));
cssUrl.searchParams.set('display', 'block');
if (cssUrl.href.length > 7000) fail('icon subset URL is too long');

const css = await (await fetchRequired(cssUrl, 'text/css,*/*;q=0.1')).text();
const fontUrl = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\(['"]woff2['"]\)/i)?.[1] || '';
if (!fontUrl || !fontUrl.startsWith('https://fonts.gstatic.com/')) fail('Google Fonts CSS did not return a trusted WOFF2 URL');
const fontResponse = await fetchRequired(fontUrl, 'font/woff2,*/*;q=0.1');
const font = Buffer.from(await fontResponse.arrayBuffer());
if (font.length < 1000 || font.subarray(0, 4).toString('ascii') !== 'wOF2') fail('downloaded file is not WOFF2');

try {
    writeFileSync(tempFontPath, font);
    renameSync(tempFontPath, fontPath);
    writeFileSync(bundledIconsPath, icons.join(','), 'utf8');
} finally {
    rmSync(tempFontPath, { force: true });
}
console.log(`Updated Material Symbols Rounded subset: ${icons.length} icons, ${font.length} bytes`);
