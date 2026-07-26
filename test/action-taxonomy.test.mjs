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
    inferTrainingBucket,
    trainingBucketLabel,
    inferTrainingBucketLabel,
    inferBodyPart,
    inferBodyParts,
    normalizeBodyPart,
    normalizeBodyParts,
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

test('训练负荷桶推断：六条规则各一个正例，未命中/空/null 留空', () => {
    assert.equal(inferTrainingBucket('靠墙深蹲'), 'lower');
    assert.equal(inferTrainingBucket('俯卧撑'), 'push');
    assert.equal(inferTrainingBucket('坐姿划船'), 'pull');
    assert.equal(inferTrainingBucket('平板支撑'), 'core');
    assert.equal(inferTrainingBucket('骑行 30 分钟'), 'cardio');
    assert.equal(inferTrainingBucket('髋关节活动度'), 'lower', '「髋」比「活动度」靠前，桶推断按顺序取首个命中');
    assert.equal(inferTrainingBucket('活动度训练'), 'rehab');
    assert.equal(inferTrainingBucket('Mobility Drill'), 'rehab', '大小写混合同样命中');
    assert.equal(inferTrainingBucket('冥想'), '');
    assert.equal(inferTrainingBucket(''), '');
    assert.equal(inferTrainingBucket(/** @type {any} */ (null)), '');
    assert.equal(inferTrainingBucket(), '');
});

test('训练负荷桶中文标签是用户可见文案，逐字锁定', () => {
    assert.equal(trainingBucketLabel('lower'), '下肢/髋膝踝');
    assert.equal(trainingBucketLabel('push'), '上肢推/肩胸');
    assert.equal(trainingBucketLabel('pull'), '上肢拉/背');
    assert.equal(trainingBucketLabel('core'), '核心/躯干');
    assert.equal(trainingBucketLabel('cardio'), '有氧');
    assert.equal(trainingBucketLabel('rehab'), '活动度/放松');
    assert.equal(trainingBucketLabel('unknown'), '');
    assert.equal(trainingBucketLabel(''), '');
});

test('桶推断顺序即优先级：同时命中时靠前的规则赢', () => {
    assert.equal(inferTrainingBucketLabel('深蹲后拉伸'), '下肢/髋膝踝', 'lower 在 rehab 之前');
    assert.equal(inferTrainingBucketLabel('肩部拉伸'), '上肢推/肩胸', 'push 在 rehab 之前');
    assert.equal(inferTrainingBucketLabel('划船机有氧'), '上肢拉/背', 'pull 在 cardio 之前');
    assert.equal(inferTrainingBucketLabel('核心跑步'), '核心/躯干', 'core 在 cardio 之前');
    assert.equal(inferTrainingBucketLabel('有氧后放松'), '有氧', 'cardio 在 rehab 之前');
    assert.equal(inferTrainingBucketLabel('冥想'), '');
    assert.equal(inferTrainingBucketLabel(/** @type {any} */ (null)), '');
});

test('bucket 维度的两个入口自洽：单词查表与长文本扫描落到同一批桶键', () => {
    TRAINING_BUCKETS.forEach((bucket) => assert.equal(normalizeTrainingBucket(bucket), bucket));
    ['靠墙深蹲', '俯卧撑', '坐姿划船', '平板支撑', '骑行', '活动度'].forEach((text) => {
        const bucket = inferTrainingBucket(text);
        assert.ok(TRAINING_BUCKETS.includes(bucket), `${text} 应落在桶枚举内`);
        assert.equal(normalizeTrainingBucket(bucket), bucket, '推断出的桶键必须能被别名表原样接受');
        assert.equal(inferTrainingBucketLabel(text), trainingBucketLabel(bucket));
    });
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

test('部位多值推断：一个动作可命中多个部位，顺序跟随规则表', () => {
    // 部位是多值维度：跨关节动作同时属于多个部位，单值入口只会看见第一个。
    assert.deepEqual(inferBodyParts('股四头肌与臀肌激活'), ['膝', '髋']);
    assert.deepEqual(inferBodyParts('髌骨稳定与踝泵'), ['膝', '踝']);
    assert.deepEqual(inferBodyParts('核心稳定 + 肩胛控制'), ['腰背', '肩']);
    // 命中顺序按 BODY_PART_RULES，与文本里出现的先后无关。
    assert.deepEqual(inferBodyParts('踝泵后做髌骨滑动'), ['膝', '踝']);
    assert.deepEqual(inferBodyParts('靠墙蹲'), ['膝'], '单部位动作只返回一个键');
    assert.deepEqual(inferBodyParts('呼吸训练'), [], '未命中返回空数组');
    assert.deepEqual(inferBodyParts(''), []);
    assert.deepEqual(inferBodyParts(/** @type {any} */ (null)), []);
    assert.deepEqual(inferBodyParts(), []);
});

test('多值与单值入口自洽：单值恒等于多值的第一项', () => {
    ['股四头肌与臀肌激活', '髌骨稳定与踝泵', '靠墙蹲', '呼吸训练', ''].forEach((text) => {
        assert.equal(inferBodyPart(text), inferBodyParts(text)[0] || '', `text=${text || '<empty>'}`);
    });
});

test('部位多值归一化：字符串拆分、数组入参、去重与稳定排序', () => {
    assert.deepEqual(normalizeBodyParts('膝'), ['膝']);
    assert.deepEqual(normalizeBodyParts('膝、踝'), ['膝', '踝']);
    assert.deepEqual(normalizeBodyParts('髋/膝'), ['膝', '髋'], '排序跟随 BODY_PARTS，不跟随输入顺序');
    assert.deepEqual(normalizeBodyParts('踝 膝'), ['膝', '踝']);
    assert.deepEqual(normalizeBodyParts('膝盖，肩膀'), ['膝', '肩'], '自由文本别名逐项推断');
    assert.deepEqual(normalizeBodyParts('左膝内侧'), ['膝']);
    assert.deepEqual(normalizeBodyParts(['踝', '膝', '膝', '', '  ']), ['膝', '踝'], '数组入参去重剔空');
    assert.deepEqual(normalizeBodyParts(['膝盖', '髋关节']), ['膝', '髋']);
    assert.deepEqual(normalizeBodyParts('low back'), ['腰背'], '含空格的关键词不能被拆分切断');
    assert.deepEqual(normalizeBodyParts('全身'), [], '识别不了返回空数组');
    assert.deepEqual(normalizeBodyParts(''), []);
    assert.deepEqual(normalizeBodyParts([]), []);
    // 历史数据可能带 null / 非数组值，归一化必须容忍而不是抛错。
    assert.deepEqual(normalizeBodyParts(/** @type {any} */ (null)), []);
    assert.deepEqual(normalizeBodyParts(/** @type {any} */ (undefined)), []);
    assert.deepEqual(normalizeBodyParts(/** @type {any} */ ({ bodyPart: '膝' })), []);
    assert.deepEqual(normalizeBodyParts(), []);
});

test('部位多值归一化幂等：再归一化一次结果完全一致（sync 不会乒乓）', () => {
    const inputs = [
        '膝、踝', '髋/膝', '膝盖，肩膀', '左膝内侧', 'low back', '全身', '',
        ['踝', '膝'], ['膝盖', '髋关节'], [], /** @type {any} */ (null)
    ];
    inputs.forEach((input) => {
        const once = normalizeBodyParts(input);
        assert.deepEqual(normalizeBodyParts(once), once, `input=${JSON.stringify(input)}`);
        assert.deepEqual(normalizeBodyParts(normalizeBodyParts(once)), once);
    });
    // 归一化结果一定落在枚举内，且能被自身原样接受。
    BODY_PARTS.forEach((part) => assert.deepEqual(normalizeBodyParts(part), [part]));
    assert.deepEqual(normalizeBodyParts(BODY_PARTS), BODY_PARTS);
});

test('多值化不改变单值入口的既有语义', () => {
    // 既有消费方仍按「首个命中」读 bodyPart，多值化不得改变任何一个既有返回值。
    assert.equal(normalizeBodyPart('膝盖'), '膝');
    assert.equal(normalizeBodyPart('左膝内侧'), '膝');
    assert.equal(normalizeBodyPart('low back'), '腰背');
    assert.equal(normalizeBodyPart('全身'), '');
    assert.equal(inferBodyPart('股四头肌与臀肌激活'), '膝', '多命中时单值仍取规则表里靠前的那个');
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
