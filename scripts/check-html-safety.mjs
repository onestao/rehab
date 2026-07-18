import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const REVIEWED_HTML_SINK_FILES = new Map([
  ['action-history.js', { sinks: 1, review: 'rendered action history rows escape record text through renderSafe.' }],
  ['advice-attachments.js', { sinks: 2, review: 'attachment preview markup is controlled; user captions use textContent.' }],
  ['advice-panel.js', { sinks: 10, review: 'AI advice HTML funnels through renderAdviceMarkdown/render helpers before DOM insertion.' }],
  ['advice-render.js', { sinks: 4, review: 'markdown/table helpers sanitize with escapeHtml before returning HTML.' }],
  ['advice-stream-renderer.js', { sinks: 5, review: 'stream chunks are rendered through the supplied markdown renderer.' }],
  ['advice-template-manager.js', { sinks: 2, review: 'template manager HTML comes from renderTemplateManagerContent with escaped fields.' }],
  ['advice-virtual-list.js', { sinks: 6, review: 'virtual rows are produced by reviewed renderItem/renderAdviceMessages callbacks.' }],
  ['ai-models.js', { sinks: 2, review: 'model labels and ids are escaped before list rendering.' }],
  ['ai-profile.js', { sinks: 1, review: 'select options are built from escaped profile names.' }],
  ['credential-fields.js', { sinks: 1, review: 'static icon-only button markup.' }],
  ['data-ui-state.js', { sinks: 3, review: 'shared modal shell escapes title/icon; caller-provided modal bodies and diet/exercise renderers remain separately reviewed.' }],
  ['data-views.js', { sinks: 11, review: 'page shells compose reviewed renderer outputs, not raw user strings.' }],
  ['food-log.js', { sinks: 9, review: 'food search and modal renderers escape names before HTML insertion.' }],
  ['health-diet.js', { sinks: 1, review: 'diet modal renderer owns escaping for food log fields.' }],
  ['health-profile.js', { sinks: 8, review: 'profile editors escape profile, condition, exam, and action fields.' }],
  ['health-weight.js', { sinks: 3, review: 'weight chart/list renderers escape record labels before template use.' }],
  ['plan-ai.js', { sinks: 8, review: 'plan AI suggestion and sheet renderers escape user-visible strings.' }],
  ['plan-cooldown.js', { sinks: 1, review: 'cooldown panel markup is generated from structured local plan state.' }],
  ['plan-equipment.js', { sinks: 2, review: 'equipment cards are generated from structured action metadata.' }],
  ['plan-feedback.js', { sinks: 1, review: 'feedback panel markup is generated from controlled status text.' }],
  ['plan-ui.js', { sinks: 5, review: 'plan UI sections compose reviewed plan renderers; enhanceTodayPage only fills deferred timeline/AI skeleton slots from reviewed renderers.' }],
  ['plan-weekly.js', { sinks: 3, review: 'weekly plan panel markup is generated from structured plan state.' }],
  ['pwa-support.js', { sinks: 2, review: 'install/update banners use static controlled markup.' }],
  ['report-panel.js', { sinks: 4, review: 'report renderers escape report, version, model, and task fields before insertion.' }],
  ['routine-library.js', { sinks: 10, review: 'routine/action renderers escape library names and notes; the shared modal shell moved to data-ui-state.' }],
  ['routine-plan.js', { sinks: 5, review: 'routine plan renderers escape routine/action fields.' }],
  ['sync-status.js', { sinks: 1, review: 'sync status markup is controlled by local status enums.' }],
  ['sync-ui.js', { sinks: 1, review: 'sync settings panel uses reviewed credential renderers.' }],
  ['toast.js', { sinks: 1, review: 'toast text is escaped before innerHTML assignment.' }],
  ['weekly-summary.js', { sinks: 10, review: 'weekly and monthly summary renderers escape metadata and render AI content through the reviewed markdown renderer.' }],
  ['workout-readiness.js', { sinks: 1, review: 'readiness card markup is generated from controlled readiness state.' }],
]);

const SINK_PATTERN = /\b(?:innerHTML|insertAdjacentHTML)\b/g;
const ROOT = process.cwd();

function countHtmlSinks(source) {
  return Array.from(source.matchAll(SINK_PATTERN)).length;
}

const entries = await readdir(ROOT, { withFileTypes: true });
const problems = [];
let reviewedFiles = 0;
let reviewedSinks = 0;

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const filePath = path.join(ROOT, entry.name);
  const source = await readFile(filePath, 'utf8');
  const sinks = countHtmlSinks(source);
  if (!sinks) continue;

  const reviewed = REVIEWED_HTML_SINK_FILES.get(entry.name);
  if (!reviewed) {
    problems.push(`${entry.name}: ${sinks} HTML sink(s) are not reviewed. Add escaping or document the safety review in scripts/check-html-safety.mjs.`);
    continue;
  }
  if (sinks !== reviewed.sinks) {
    problems.push(`${entry.name}: expected ${reviewed.sinks} reviewed HTML sink(s), found ${sinks}. Re-review escaping before updating the baseline.`);
    continue;
  }
  reviewedFiles += 1;
  reviewedSinks += sinks;
}

for (const file of REVIEWED_HTML_SINK_FILES.keys()) {
  if (!entries.some((entry) => entry.isFile() && entry.name === file)) {
    problems.push(`${file}: reviewed HTML sink file no longer exists.`);
  }
}

if (problems.length) {
  console.error(`HTML safety check failed (${problems.length} issue${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`OK (${reviewedFiles} reviewed files, ${reviewedSinks} HTML sinks)`);
