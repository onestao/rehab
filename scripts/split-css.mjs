import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcText = await readFile(path.join(root, 'styles.css'), 'utf8');
const srcLines = srcText.split('\n');

const outDir = path.join(root, 'css-src');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const boundaries = [
  1,
  83,
  96,
  115,
  144,
  158,
  168,
  186,
  202,
  289,
  343,
  352,
  360,
  411,
  474,
  554,
  577,
  874,
  1094,
  1509,
  1580,
  1670,
  1687,
  1724,
  1733,
  1798,
  1847,
  1878,
  1966,
  2102,
  2116,
  2143,
  2161,
  2173,
  2177,
  2252,
  2294,
  2325,
];

const files = [
  '01-vars.css',
  '02-base.css',
  '03-banner.css',
  '04-layout-appbar.css',
  '05-layout-chip.css',
  '06-layout-page.css',
  '07-layout-page-header.css',
  '08-components-cards.css',
  '09-workout-timer.css',
  '10-components-fields.css',
  '11-components-grid.css',
  '12-components-divider.css',
  '13-components-switch.css',
  '14-components-buttons.css',
  '15-components-lists.css',
  '16-history-month-groups.css',
  '17-history-hero-calendar.css',
  '18-record-tabs-health.css',
  '19-health-diet.css',
  '20-health-weightloss-ai.css',
  '21-workout-rate.css',
  '22-workout-mode-tabs.css',
  '23-routines-tool.css',
  '24-routines-cards.css',
  '25-workout-cardio.css',
  '26-settings-sync.css',
  '27-layout-nav.css',
  '28-workout-fab.css',
  '29-workout-skip.css',
  '30-components-toast.css',
  '31-components-empty.css',
  '32-utilities-hidden.css',
  '33-workout-input-card.css',
  '34-settings-theme.css',
  '35-components-modal.css',
  '36-responsive.css',
  '37-dark-mode.css',
];

const results = [];
for (let i = 0; i < files.length; i++) {
  const start = boundaries[i];
  const end = (i + 1 < boundaries.length) ? boundaries[i + 1] - 1 : srcLines.length;
  const content = srcLines.slice(start - 1, end).join('\n');
  await writeFile(path.join(outDir, files[i]), content, 'utf8');
  results.push({ file: files[i], start, end, lines: end - start + 1 });
}

const total = results.reduce((sum, item) => sum + item.lines, 0);
console.log(`Wrote ${results.length} files, total ${total} lines (styles.css: ${srcLines.length})`);
for (const item of results) {
  console.log(`  ${item.file}: ${item.start}-${item.end} (${item.lines})`);
}
