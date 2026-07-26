import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import actionTaxonomy from '../action-taxonomy-pure.js';
import { cardioTypes } from '../workout-cardio-pure.js';

// routine-library.js 与 health-exercise.js 各带一份 exerciseLibraryActions /
// cardioTypeOptionsFromLibrary（文本不同、语义应当等价，实际生效者由加载顺序决定）。
// 本测试把两个文件分别加载进独立沙箱，对同一动作矩阵断言行为逐一相同，
// 防止任何一份实现单独漂移。

function loadModule(file, globalName) {
    const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const sandbox = {
        window: { cardioPure: { cardioTypes }, actionTaxonomy },
        document: { getElementById: () => null },
        alert(message) { throw new Error(`Unexpected alert: ${message}`); },
        console
    };
    vm.runInNewContext(code, sandbox);
    return sandbox.window[globalName];
}

function createApp(moduleApi, actions) {
    /** @type {any} */
    const app = {
        db: { actions: JSON.parse(JSON.stringify(actions)), health: { exerciseLogs: [] } },
        activeRecords: (records) => (records || []).filter((record) => record && !record.deleted),
        findActionById(actionId) {
            return (this.db.actions || []).find((action) => action && action.id === actionId);
        }
    };
    Object.assign(app, moduleApi);
    return app;
}

function actionMatrix() {
    const categories = ['training', 'stretch', 'mobility', 'warmup', 'recovery', 'cardio', 'other', '', '力量', 'cooldown'];
    const actions = [];
    let index = 0;
    for (const category of categories) {
        for (const met of [0, 5]) {
            for (const libOnly of [true, false]) {
                for (const exerciseLogEnabled of [true, false]) {
                    index += 1;
                    actions.push({
                        id: `action-${index}`,
                        name: `${category || '未分类'}动作${index}`,
                        category,
                        met,
                        libOnly,
                        exerciseLogEnabled
                    });
                }
            }
        }
    }
    return actions;
}

test('routine-library 与 health-exercise 的运动库筛选实现保持行为等价', () => {
    const actions = actionMatrix();
    // 两个文件各自加载进独立沙箱：health-exercise 的实现不依赖
    // this.normalizeActionCategory，缺少该方法也必须得出与 routine-library 相同的结果。
    const libraryApp = createApp(loadModule('routine-library.js', 'dataRoutineLibrary'), actions);
    const healthApp = createApp(loadModule('health-exercise.js', 'dataHealthExercise'), actions);

    for (const kind of ['', 'cardio', 'strength']) {
        const libraryIds = libraryApp.exerciseLibraryActions(kind).map((action) => action.id);
        const healthIds = healthApp.exerciseLibraryActions(kind).map((action) => action.id);
        assert.ok(libraryIds.length > 0, `kind=${kind || '<all>'} 的筛选结果不应为空，否则护栏形同虚设`);
        assert.deepEqual(libraryIds, healthIds, `kind=${kind || '<all>'} 两份实现返回的动作 id 列表必须逐一相同`);
    }

    // JSON 往返抹平 vm 沙箱各自的 Object.prototype，deepEqual 才比较纯数据。
    const libraryOptions = JSON.parse(JSON.stringify(libraryApp.cardioTypeOptionsFromLibrary()));
    const healthOptions = JSON.parse(JSON.stringify(healthApp.cardioTypeOptionsFromLibrary()));
    assert.ok(Object.keys(libraryOptions).length > 0, '有氧选项不应为空，否则护栏形同虚设');
    assert.deepEqual(libraryOptions, healthOptions);
});
