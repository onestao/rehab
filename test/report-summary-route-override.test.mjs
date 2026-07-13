// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { manualFallbackTarget } from '../ai-routing-pure.mjs';

const reportSource = readFileSync(new URL('../report-panel.js', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../weekly-summary.js', import.meta.url), 'utf8');
const versionSource = readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8');

test('weight report fallback retries with routeOverride and never saves it as the task route', async () => {
    const runCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-report' });
    const ai = {
        cfg: { enabled: true },
        run: async (options) => {
            runCalls.push(options);
            const error = new Error('report failed');
            if (runCalls.length === 1) error.aiFallback = { taskId: options.taskId, target };
            throw error;
        },
        setTaskRoute: () => { setTaskRouteCalls += 1; }
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: [], suggestions: [] })
            },
            reportVersionPure: {},
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(reportSource, sandbox);

    const data = {
        ...sandbox.window.dataReport,
        db: { aiProfiles: [], health: { reports: [] } },
        weightReportMetricAnchor: () => '2026-07-06',
        buildPeriodReportContext: () => 'ORIGINAL_REPORT_CONTEXT'
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });
    const retry = toastCalls[0]?.[2]?.onAction;
    await retry?.();

    assert.equal(typeof retry, 'function');
    assert.equal(runCalls.length, 2);
    assert.equal(runCalls[1].taskId, 'report.weight.weekly');
    assert.deepEqual(runCalls[1].routeOverride, target);
    assert.match(runCalls[1].messages[1].content, /ORIGINAL_REPORT_CONTEXT/);
    assert.equal(setTaskRouteCalls, 0);
    assert.deepEqual(data.db.health.reports, []);
});

test('weekly summary fallback retries with routeOverride and preserves the prompt', async () => {
    const runCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-summary' });
    const response = { innerHTML: '', scrollIntoView() {} };
    const body = { appendChild() {} };
    const ai = {
        cfg: { enabled: true },
        run: async (options) => {
            runCalls.push(options);
            const error = new Error('summary failed');
            if (runCalls.length === 1) error.aiFallback = { taskId: options.taskId, target };
            throw error;
        },
        setTaskRoute: () => { setTaskRouteCalls += 1; }
    };
    const sandbox = {
        ai,
        console,
        document: {
            createElement: () => response,
            getElementById: (id) => id === 'summarySheetBody' ? body : id === 'summaryAiResponse' ? response : null
        },
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            reportVersionPure: {},
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(summarySource, sandbox);

    const data = {
        ...sandbox.window.dataWeeklySummary,
        db: { aiProfiles: [], health: { reports: [] } },
        escapeHtml: (value) => String(value ?? ''),
        renderAdviceMarkdown: (value) => `<p>${value}</p>`
    };
    const prompt = 'ORIGINAL_WEEKLY_SUMMARY_PROMPT';
    await data._inlineSummaryAi('weekly', '2026-W28', prompt, '周总结');
    const retry = toastCalls[0]?.[2]?.onAction;
    await retry?.();

    assert.equal(typeof retry, 'function');
    assert.equal(runCalls.length, 2);
    assert.equal(runCalls[1].taskId, 'summary.weekly');
    assert.deepEqual(runCalls[1].routeOverride, target);
    assert.equal(runCalls[1].messages[1].content, prompt);
    assert.equal(setTaskRouteCalls, 0);
    assert.deepEqual(data.db.health.reports, []);
});

test('weight report ignores malformed fallback targets without exposing an action', async () => {
    const toastCalls = [];
    const ai = {
        cfg: { enabled: true },
        run: async () => {
            const error = new Error('report failed');
            error.aiFallback = { target: { profileId: 'backup-profile', modelId: 'bad\nmodel' } };
            throw error;
        }
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            reportMetricsPure: {
                buildWeeklyMetrics: () => ({ periodStart: '2026-07-06', periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: () => ({ periodStart: '2026-07-01', periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: [], suggestions: [] })
            },
            reportVersionPure: {},
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(reportSource, sandbox);

    const data = {
        ...sandbox.window.dataReport,
        db: { aiProfiles: [], health: { reports: [] } },
        buildPeriodReportContext: () => 'REPORT_CONTEXT'
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });

    assert.equal(toastCalls.length, 1);
    assert.equal(typeof toastCalls[0]?.[2]?.onAction, 'undefined');
    assert.deepEqual(data.db.health.reports, []);
});

test('weight report fallback action is single-use and appends only one active version', async () => {
    const runCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-report' });
    const ai = {
        cfg: { enabled: true },
        run: async (options) => {
            runCalls.push(options);
            if (runCalls.length === 1) {
                const error = new Error('report failed');
                error.aiFallback = { taskId: options.taskId, target };
                throw error;
            }
            return { text: '{"summary":"fallback ok","highlights":[],"suggestions":[]}', meta: { profileId: target.profileId, modelId: target.modelId } };
        },
        setTaskRoute: () => { setTaskRouteCalls += 1; }
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: [], suggestions: [] })
            },
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(versionSource, sandbox);
    vm.runInContext(reportSource, sandbox);

    const data = {
        ...sandbox.window.dataReport,
        db: { aiProfiles: [], health: { reports: [] } },
        activeRecords: (records) => records.filter((record) => !record.deleted),
        buildPeriodReportContext: () => 'ORIGINAL_REPORT_CONTEXT',
        generateRecordId: () => 'report-1',
        renderWeightReportSheet() {},
        renderHistory() {},
        saveAndBackup() {}
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });
    const retry = toastCalls[0]?.[2]?.onAction;
    await Promise.all([retry(), retry()]);

    assert.equal(runCalls.length, 2);
    assert.deepEqual(runCalls[1].routeOverride, target);
    assert.equal(setTaskRouteCalls, 0);
    assert.equal(data.db.health.reports.length, 1);
    assert.equal(data.db.health.reports[0].versions.length, 1);
    assert.equal(data.db.health.reports[0].activeVersionId, data.db.health.reports[0].versions[0].id);
    assert.equal(data.db.health.reports[0].metrics.weight, 78);
});

test('weekly summary ignores malformed fallback targets without exposing an action', async () => {
    const toastCalls = [];
    const response = { innerHTML: '', scrollIntoView() {} };
    const body = { appendChild() {} };
    const ai = {
        cfg: { enabled: true },
        run: async () => {
            const error = new Error('summary failed');
            error.aiFallback = { target: { profileId: 'backup-profile', modelId: 'bad\nmodel' } };
            throw error;
        }
    };
    const sandbox = {
        ai,
        console,
        document: {
            createElement: () => response,
            getElementById: (id) => id === 'summarySheetBody' ? body : id === 'summaryAiResponse' ? response : null
        },
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            reportVersionPure: {},
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(summarySource, sandbox);

    const data = {
        ...sandbox.window.dataWeeklySummary,
        db: { aiProfiles: [], health: { reports: [] } },
        escapeHtml: (value) => String(value ?? ''),
        renderAdviceMarkdown: (value) => `<p>${value}</p>`
    };
    await data._inlineSummaryAi('weekly', '2026-W28', 'SUMMARY_PROMPT', '周总结');

    assert.equal(toastCalls.length, 0);
    assert.deepEqual(data.db.health.reports, []);
});

test('weekly summary fallback action is single-use and appends only one active version', async () => {
    const runCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-summary' });
    const response = { innerHTML: '', scrollIntoView() {} };
    const body = { appendChild() {} };
    const ai = {
        cfg: { enabled: true },
        run: async (options) => {
            runCalls.push(options);
            if (runCalls.length === 1) {
                const error = new Error('summary failed');
                error.aiFallback = { taskId: options.taskId, target };
                throw error;
            }
            return { text: 'fallback summary', meta: { profileId: target.profileId, modelId: target.modelId } };
        },
        setTaskRoute: () => { setTaskRouteCalls += 1; }
    };
    const sandbox = {
        ai,
        console,
        document: {
            createElement: () => response,
            getElementById: (id) => id === 'summarySheetBody' ? body : id === 'summaryAiResponse' ? response : null
        },
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            toast: { show: (...args) => toastCalls.push(args) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(versionSource, sandbox);
    vm.runInContext(summarySource, sandbox);

    const data = {
        ...sandbox.window.dataWeeklySummary,
        db: { aiProfiles: [], health: { reports: [] } },
        activeRecords: (records) => records.filter((record) => !record.deleted),
        escapeHtml: (value) => String(value ?? ''),
        generateRecordId: () => 'summary-1',
        renderAdviceMarkdown: (value) => `<p>${value}</p>`,
        renderSavedSummaryResult() {},
        saveAndBackup() {}
    };
    const prompt = 'ORIGINAL_WEEKLY_SUMMARY_PROMPT';
    await data._inlineSummaryAi('weekly', '2026-W28', prompt, '周总结');
    const retry = toastCalls[0]?.[2]?.onAction;
    await Promise.all([retry(), retry()]);

    assert.equal(runCalls.length, 2);
    assert.equal(runCalls[1].messages[1].content, prompt);
    assert.deepEqual(runCalls[1].routeOverride, target);
    assert.equal(setTaskRouteCalls, 0);
    assert.equal(data.db.health.reports.length, 1);
    assert.equal(data.db.health.reports[0].versions.length, 1);
    assert.equal(data.db.health.reports[0].activeVersionId, data.db.health.reports[0].versions[0].id);
});

