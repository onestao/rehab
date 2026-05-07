import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'build');
const outFile = path.join(outDir, 'generated.css');

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

const chunks = [];
for (const file of files) {
  const full = path.join(root, 'css-src', file);
  const content = await readFile(full, 'utf8');
  chunks.push(`/* ${file} */\n${content.trimEnd()}\n`);
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, chunks.join('\n'), 'utf8');
console.log(`Generated ${path.relative(root, outFile)} from ${files.length} source files`);
