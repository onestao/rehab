import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { cardioTypes } from '../workout-cardio-pure.js';

const source = [
    readFileSync(new URL('../routine-library.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../health-exercise.js', import.meta.url), 'utf8')
].join('\n');

function loadModules(elements = new Map()) {
    const sandbox = {
        window: { cardioPure: { cardioTypes } },
        document: { getElementById: (id) => elements.get(id) || null },
        alert(message) { throw new Error(`Unexpected alert: ${message}`); },
        console
    };
    vm.runInNewContext(source, sandbox);
    return {
        elements,
        health: sandbox.window.dataHealthExercise,
        library: sandbox.window.dataRoutineLibrary
    };
}

function createApp(elements = new Map()) {
    const modules = loadModules(elements);
    /** @type {any} */
    const app = {
        db: { actions: [], health: { exerciseLogs: [] } },
        activeRecords: (records) => records.filter((record) => record && !record.deleted),
        generateRecordId: (kind) => `${kind}-${app.db.actions.length + 1}`,
        logicalDateKey: () => '2026-07-24',
        sortedWeights: () => [{ weight: 70 }],
        exerciseLabel: (type, entry) => entry?.customName || cardioTypes[type]?.name || type,
        escapeHtml: (value) => String(value ?? ''),
        saveAndBackup: () => {},
        touchRecord: () => {},
        toggleManualCustomExercise: () => {}
    };
    Object.assign(app, modules.health, modules.library);
    return app;
}

function manualExerciseElements(type, customName = '') {
    return new Map(Object.entries({
        manualExerciseType: { value: type },
        manualExerciseCustom: { value: customName },
        manualExerciseMinutes: { value: '30' },
        manualExerciseCalories: { value: '' },
        manualExerciseDistance: { value: '' },
        manualExerciseNote: { value: '' },
        manualExerciseWeight: { value: '' },
        manualExerciseSets: { value: '' },
        manualExerciseReps: { value: '' },
        manualExerciseLibraryAction: { value: '' },
        manualExerciseSaveToLibrary: { checked: true }
    }));
}

test('strength library contains only explicitly classified training actions', () => {
    const app = createApp();
    app.db.actions = [
        { id: 'training', category: 'training', libOnly: true, exerciseLogEnabled: true },
        { id: 'cardio', category: 'cardio', met: 5, libOnly: true, exerciseLogEnabled: true },
        { id: 'stretch', category: 'stretch', libOnly: true, exerciseLogEnabled: true },
        { id: 'mobility', category: 'mobility', libOnly: true, exerciseLogEnabled: true },
        { id: 'warmup', category: 'warmup', libOnly: true, exerciseLogEnabled: true },
        { id: 'recovery', category: 'recovery', libOnly: true, exerciseLogEnabled: true },
        { id: 'other', category: 'other', libOnly: true, exerciseLogEnabled: true },
        { id: 'uncategorized', category: '', libOnly: true, exerciseLogEnabled: true }
    ];

    assert.deepEqual(
        app.exerciseLibraryActions('strength').map((action) => action.id),
        ['training']
    );
    assert.deepEqual(
        app.exerciseLibraryActions('cardio').map((action) => action.id),
        ['cardio']
    );
});

test('library actions map back to matching manual exercise types', () => {
    const typeElement = { value: '' };
    const elements = new Map([
        ['manualExerciseType', typeElement],
        ['manualExerciseCustom', { value: '' }],
        ['manualExerciseWeight', { value: '' }],
        ['manualExerciseSets', { value: '' }],
        ['manualExerciseReps', { value: '' }],
        ['manualExerciseLibraryAction', { value: '' }]
    ]);
    const app = createApp(elements);
    const expected = new Map([
        ['training', 'strength'],
        ['cardio', 'custom'],
        ['stretch', 'stretch'],
        ['mobility', 'custom'],
        ['warmup', 'custom'],
        ['recovery', 'custom'],
        ['other', 'custom'],
        ['', 'custom']
    ]);

    for (const [category, type] of expected) {
        app.db.actions = [{
            id: 'action-1',
            name: category || '未分类动作',
            category,
            libOnly: true,
            exerciseLogEnabled: true
        }];
        typeElement.value = '';
        app.applyExerciseLibraryAction('action-1');
        assert.equal(typeElement.value, type, `category=${category || '<empty>'}`);
    }
});

test('custom elliptical stays custom while built-in elliptical stays cardio', () => {
    const customElements = manualExerciseElements('custom', '椭圆机');
    const customApp = createApp(customElements);
    assert.equal(customApp.addManualExercise(), true);
    assert.equal(customApp.db.actions[0].category, 'other');
    assert.equal(customApp.db.actions[0].met, 0);
    assert.equal(customApp.exerciseLibraryActions('strength').length, 0);
    const customTypeElement = customElements.get('manualExerciseType');
    assert.ok(customTypeElement);
    customTypeElement.value = '';
    customApp.applyExerciseLibraryAction(customApp.db.actions[0].id);
    assert.equal(customTypeElement.value, 'custom');

    const cardioElements = manualExerciseElements('elliptical');
    const cardioApp = createApp(cardioElements);
    assert.equal(cardioApp.addManualExercise(), true);
    assert.equal(cardioApp.db.actions[0].category, 'cardio');
    assert.equal(cardioApp.db.actions[0].met, 5);
    assert.equal(cardioApp.exerciseLibraryActions('strength').length, 0);
    assert.equal(cardioApp.exerciseLibraryActions('cardio').length, 1);
});

test('non-strength library cards and editor hide strength-only fields', () => {
    const app = createApp();
    app.db.actions = [{
        id: 'other-1',
        name: '椭圆机',
        category: 'other',
        libOnly: true,
        exerciseLogEnabled: true,
        sets: 1,
        reps: 1,
        work: 5,
        phase: 'main'
    }];

    const html = app.renderActionLibrary();
    assert.match(html, /其他/);
    assert.doesNotMatch(html, /1组 × 1次/);
    assert.doesNotMatch(html, /5s/);

    app._openModal = (options) => options;
    const modal = app.editActionFromLibrary('other-1');
    assert.match(modal.bodyHtml, /md-field hidden" data-rl-strength-field/);

    app.db.actions[0].category = 'training';
    const trainingHtml = app.renderActionLibrary();
    assert.match(trainingHtml, /1组 × 1次/);
    assert.match(trainingHtml, /5s/);
});
