// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { manualFallbackTarget } from '../ai-routing-pure.mjs';

const reportSource = readFileSync(new URL('../report-panel.js', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../weekly-summary.js', import.meta.url), 'utf8');
const versionSource = readFileSync(new URL('../report-version-pure.js', import.meta.url), 'utf8');
const searchEvidenceUi = {
    summary: value => Array.isArray(value) ? value.map(({ contentExcerpt: _body, ...item }) => item) : [],
    version(payload = {}) {
        const ai = { ...(payload.ai || {}) };
        const searchEvidence = this.summary(payload.searchEvidence || ai.searchEvidence);
        delete ai.searchEvidence;
        return { ai, searchEvidence };
    }
};
const searchPolicyPure = {
    summarizeSearchEvidence: searchEvidenceUi.summary,
    searchEvidenceVersion: searchEvidenceUi.version.bind(searchEvidenceUi)
};

test('weight report fallback retries with routeOverride and never saves it as the task route', async () => {
    const runCalls = [];
    const toastCalls = [];
    let setTaskRouteCalls = 0;
    const target = Object.freeze({ profileId: 'backup-profile', modelId: 'backup-report' });
    const ai = {
        cfg: { enabled: true },
        runJson: async (options) => {
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
            searchEvidenceUi, searchPolicyPure,
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
            searchEvidenceUi, searchPolicyPure,
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
            searchEvidenceUi, searchPolicyPure,
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
        runJson: async (options) => {
            runCalls.push(options);
            if (runCalls.length === 1) {
                const error = new Error('report failed');
                error.aiFallback = { taskId: options.taskId, target };
                throw error;
            }
            return { value: { summary: 'fallback ok', highlights: ['h'], suggestions: ['s'] }, meta: { profileId: target.profileId, modelId: target.modelId } };
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
            searchEvidenceUi, searchPolicyPure,
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
            searchEvidenceUi, searchPolicyPure,
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
            searchEvidenceUi, searchPolicyPure,
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

test('weight report runJson retry succeeds and stores AI model metadata', async () => {
    const runCalls = [];
    const ai = {
        cfg: { enabled: true },
        async runJson(options = {}) {
            runCalls.push(options);
            if (runCalls.length === 1) {
                // simulate internal first-attempt truncation/retry success contract
                runCalls.push({ ...options, retry: true, routeOverride: {
                    primary: { profileId: 'p1', modelId: 'm1' },
                    reasoningDepth: 'off',
                    fallbackMode: 'manual',
                    fallbacks: []
                }});
            }
            return {
                value: {
                    summary: '本周体重略有下降',
                    highlights: ['训练完成度尚可'],
                    suggestions: ['继续记录饮食']
                },
                meta: {
                    taskId: options.taskId,
                    profileId: 'p1',
                    modelId: 'm1',
                    reasoningDepth: 'off',
                    fallback: { used: false, index: 0, mode: 'manual' }
                }
            };
        }
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            searchEvidenceUi, searchPolicyPure,
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: ['local'], suggestions: ['local-tip'], model: 'offline', prompt_id: 'weekly_report_offline' })
            },
            toast: { show() {} }
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
        buildPeriodReportContext: () => 'CTX',
        generateRecordId: () => 'report-1',
        renderWeightReportSheet() {},
        renderHistory() {},
        saveAndBackup() {}
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });
    assert.equal(runCalls.length, 2);
    assert.equal(data.db.health.reports.length, 1);
    const aiMeta = data.db.health.reports[0].versions[0].ai;
    assert.equal(aiMeta.summary, '本周体重略有下降');
    assert.equal(aiMeta.model, 'm1');
    assert.notEqual(aiMeta.model, 'offline');
    assert.equal(aiMeta.prompt_id, 'weekly_report');
});

test('weight report final AI failure keeps empty reports and does not save offline as AI success', async () => {
    const toastCalls = [];
    const ai = {
        cfg: { enabled: true },
        runJson: async () => {
            const err = new Error('AI 返回的 JSON 缺少当前功能所需字段，请切换模型后重试。');
            err.code = 'AI_JSON_SHAPE_MISMATCH';
            err.retryAttempted = true;
            throw err;
        }
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            searchEvidenceUi, searchPolicyPure,
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: ['local'], suggestions: ['local-tip'], model: 'offline' })
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
        buildPeriodReportContext: () => 'CTX'
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });
    assert.deepEqual(data.db.health.reports, []);
    assert.match(String(toastCalls[0]?.[0] || ''), /缺少当前功能所需字段|AI/);
});

test('weight report without runJson reports unavailable and does not save', async () => {
    const toastCalls = [];
    const ai = {
        cfg: { enabled: true },
        run: async () => ({ text: '{"summary":"should-not-save","highlights":[],"suggestions":[]}', meta: { modelId: 'm1' } })
    };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            searchEvidenceUi, searchPolicyPure,
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline', highlights: ['local'], suggestions: ['local-tip'], model: 'offline' })
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
        buildPeriodReportContext: () => 'CTX',
        saveAndBackup() { data._saved = true; }
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: true });
    assert.deepEqual(data.db.health.reports, []);
    assert.equal(data._saved, undefined);
    assert.match(String(toastCalls[0]?.[0] || ''), /JSON 运行时不可用|AI/);
});

test('weight report offline path still saves when useAi is false', async () => {
    const ai = { cfg: { enabled: false } };
    const sandbox = {
        ai,
        console,
        document: {},
        window: {
            ai,
            aiRoutingPure: { manualFallbackTarget },
            searchEvidenceUi, searchPolicyPure,
            reportMetricsPure: {
                buildWeeklyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-12', metrics: { weight: 78 } }),
                buildMonthlyMetrics: (_db, anchor) => ({ periodStart: anchor, periodEnd: '2026-07-31', metrics: { weight: 78 } }),
                summarizeReportPlain: () => ({ summary: 'offline-summary', highlights: ['local'], suggestions: ['local-tip'], model: 'offline', prompt_id: 'weekly_report_offline' })
            },
            toast: { show() {} }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(versionSource, sandbox);
    vm.runInContext(reportSource, sandbox);
    let saved = 0;
    const data = {
        ...sandbox.window.dataReport,
        db: { aiProfiles: [], health: { reports: [] } },
        activeRecords: (records) => records.filter((record) => !record.deleted),
        weightReportMetricAnchor: () => '2026-07-06',
        buildPeriodReportContext: () => 'CTX',
        generateRecordId: () => 'report-offline-1',
        renderWeightReportSheet() {},
        renderHistory() {},
        saveAndBackup() { saved += 1; }
    };
    await data.generateReport('weekly', '2026-07-06', { useAi: false });
    assert.equal(data.db.health.reports.length, 1);
    assert.equal(data.db.health.reports[0].versions[0].ai.model, 'offline');
    assert.equal(saved, 1);
});
