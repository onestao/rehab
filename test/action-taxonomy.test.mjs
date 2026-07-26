import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ACTION_NATURES,
    PLAN_PHASES,
    TRAINING_BUCKETS,
    BODY_PARTS,
    normalizeActionNature,
    actionNatureLabel,
    normalizePlanPhase,
    normalizeTrainingBucket,
    inferBodyPart,
    normalizeBodyPart,
    natureToExerciseLogType,
    exerciseLogTypeToNature
} from '../action-taxonomy-pure.js';

test('动作性质归一化：别名收敛，未知值留空而不臆造默认', () => {
    assert.equal(normalizeActionNature('training'), 'training');
    assert.equal(normalizeActionNature('strength'), 'training');
    assert.equal(normalizeActionNature('力量'), 'training');
    assert.equal(normalizeActionNature('MAIN'), 'training');
    assert.equal(normalizeActionNature('cooldown'), 'stretch');
    assert.equal(normalizeActionNature('rehab'), 'recovery');
    assert.equal(normalizeActionNature('康复'), 'recovery');
    assert.equal(normalizeActionNature('有氧'), 'cardio');
    assert.equal(normalizeActionNature(''), '');
    assert.equal(normalizeActionNature('不存在的分类'), '');
    // 动作库里的历史记录可能带 null 分类，归一化必须容忍。
    assert.equal(normalizeActionNature(/** @type {any} */ (null)), '');
});

test('动作性质标签只覆盖枚举内的值', () => {
    assert.equal(actionNatureLabel('training'), '训练');
    assert.equal(actionNatureLabel('cooldown'), '拉伸');
    assert.equal(actionNatureLabel('other'), '其他');
    assert.equal(actionNatureLabel('不存在的分类'), '');
    ACTION_NATURES.forEach(([key, label]) => assert.equal(actionNatureLabel(key), label));
});

test('计划阶段归一化：三选一契约，未知值落到 main', () => {
    assert.equal(normalizePlanPhase('warmup'), 'warmup');
    assert.equal(normalizePlanPhase('warm-up'), 'warmup');
    assert.equal(normalizePlanPhase('warm'), 'warmup');
    assert.equal(normalizePlanPhase('热身'), 'warmup');
    assert.equal(normalizePlanPhase('cooldown'), 'cooldown');
    assert.equal(normalizePlanPhase('stretch'), 'cooldown');
    assert.equal(normalizePlanPhase('拉伸'), 'cooldown');
    assert.equal(normalizePlanPhase('main'), 'main');
    assert.equal(normalizePlanPhase('mobility'), 'main');
    assert.equal(normalizePlanPhase(''), 'main');
    assert.deepEqual(PLAN_PHASES, ['warmup', 'main', 'cooldown']);
});

test('性质与阶段是两个维度，不能互相顶替', () => {
    // stretch 作为性质是「拉伸」，作为阶段是 cooldown；warmup 两边同名但含义不同。
    assert.equal(normalizeActionNature('stretch'), 'stretch');
    assert.equal(normalizePlanPhase('stretch'), 'cooldown');
    assert.equal(normalizeActionNature('mobility'), 'mobility');
    assert.equal(normalizePlanPhase('mobility'), 'main');
    // main 是阶段词，作为性质时被折算为 training —— 保留历史行为，但只此一处定义。
    assert.equal(normalizeActionNature('main'), 'training');
});

test('训练负荷桶归一化', () => {
    assert.equal(normalizeTrainingBucket('chest'), 'push');
    assert.equal(normalizeTrainingBucket('背'), 'pull');
    assert.equal(normalizeTrainingBucket('腿'), 'lower');
    assert.equal(normalizeTrainingBucket('核心'), 'core');
    assert.equal(normalizeTrainingBucket('有氧'), 'cardio');
    assert.equal(normalizeTrainingBucket('拉伸'), 'rehab');
    assert.equal(normalizeTrainingBucket('unknown'), '');
    TRAINING_BUCKETS.forEach((bucket) => assert.equal(normalizeTrainingBucket(bucket), bucket));
});

test('部位枚举：7 个中文键，保持推断规则顺序', () => {
    assert.deepEqual(BODY_PARTS, ['膝', '踝', '髋', '腰背', '肩', '肘腕', '颈']);
});

test('部位推断：每个部位至少一个关键词正例，未命中留空', () => {
    assert.equal(inferBodyPart('髌骨轨迹不良'), '膝');
    assert.equal(inferBodyPart('跟腱离心训练'), '踝');
    assert.equal(inferBodyPart('梨状肌综合征'), '髋');
    assert.equal(inferBodyPart('竖脊肌激活'), '腰背');
    assert.equal(inferBodyPart('肩胛稳定练习'), '肩');
    assert.equal(inferBodyPart('前臂支撑'), '肘腕');
    assert.equal(inferBodyPart('斜方肌上束放松'), '颈');
    assert.equal(inferBodyPart('Knee Extension'), '膝');
    assert.equal(inferBodyPart('呼吸训练'), '');
    assert.equal(inferBodyPart(''), '');
    assert.equal(inferBodyPart(/** @type {any} */ (null)), '');
});

test('部位归一化：枚举直通、别名折算、未知留空', () => {
    BODY_PARTS.forEach((part) => assert.equal(normalizeBodyPart(part), part));
    assert.equal(normalizeBodyPart('膝'), '膝');
    assert.equal(normalizeBodyPart(' 膝 '), '膝');
    assert.equal(normalizeBodyPart('膝盖'), '膝');
    assert.equal(normalizeBodyPart('左膝内侧'), '膝');
    assert.equal(normalizeBodyPart('全身'), '');
    assert.equal(normalizeBodyPart(''), '');
    assert.equal(normalizeBodyPart(/** @type {any} */ (null)), '');
});

test('性质 → 运动记录种类：只有力量和拉伸有专属表单', () => {
    assert.equal(natureToExerciseLogType('training'), 'strength');
    assert.equal(natureToExerciseLogType('stretch'), 'stretch');
    assert.equal(natureToExerciseLogType('cardio'), 'custom');
    assert.equal(natureToExerciseLogType('mobility'), 'custom');
    assert.equal(natureToExerciseLogType('warmup'), 'custom');
    assert.equal(natureToExerciseLogType('recovery'), 'custom');
    assert.equal(natureToExerciseLogType('other'), 'custom');
    assert.equal(natureToExerciseLogType(''), 'custom');
});

test('运动记录种类 → 性质：有 MET 即有氧，力量优先于 MET', () => {
    assert.equal(exerciseLogTypeToNature('strength', 0), 'training');
    assert.equal(exerciseLogTypeToNature('strength', 5), 'training');
    assert.equal(exerciseLogTypeToNature('elliptical', 5), 'cardio');
    assert.equal(exerciseLogTypeToNature('custom', 3.5), 'cardio');
    assert.equal(exerciseLogTypeToNature('stretch', 0), 'stretch');
    assert.equal(exerciseLogTypeToNature('custom', 0), 'other');
    assert.equal(exerciseLogTypeToNature('', 0), 'other');
});

test('换算函数在力量/拉伸上可往返', () => {
    ['training', 'stretch'].forEach((nature) => {
        assert.equal(exerciseLogTypeToNature(natureToExerciseLogType(nature), 0), nature);
    });
});

test('先归一化性质再折算阶段，与直接折算阶段结果一致', () => {
    // 阶段2把处方 category 归一化为性质枚举；AI 计划把 category 折算成阶段。
    // 该不变量保证归一化不会改变任何处方动作在 AI 计划里的 warmup/main/cooldown 落点。
    const aliases = [
        'train', 'strength', 'main', '训练', '力量',
        'stretch', 'cooldown', '拉伸', '放松',
        'mobility', '活动度', '灵活性',
        'warmup', '热身', 'warm',
        'recovery', 'rehab', '恢复', '康复',
        'cardio', '有氧',
        'training', 'other', '', '医生手写的自由文本'
    ];
    aliases.forEach((alias) => {
        const normalized = normalizeActionNature(alias) || alias;
        assert.equal(
            normalizePlanPhase(normalized),
            normalizePlanPhase(alias),
            `alias=${alias || '<empty>'}`
        );
    });
});
