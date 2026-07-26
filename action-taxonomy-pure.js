// @ts-check
/**
 * 动作分类事实源。
 *
 * 项目里同时存在三套互不相同、但都叫「分类」的枚举，历史上分散在
 * routine-library / health-exercise / plan-ai-pure / plan-analytics 各自手写，
 * 导致同一个词在不同模块被折算成不同结果。这里是唯一定义处：
 *
 *  - nature  动作性质：training/stretch/mobility/warmup/recovery/cardio/other（可为空 = 未分类）
 *  - phase   计划阶段：warmup/main/cooldown —— AI 计划 JSON 的对外契约，不可改名改值
 *  - bucket  训练负荷桶：push/pull/lower/core/cardio/rehab —— 周容量分析用。
 *    有两个入口：normalizeTrainingBucket 是单词/别名查表（把已有分类词折算到桶键），
 *    inferTrainingBucket 是长文本正则扫描（从动作名+备注里认出桶）。
 *    每个桶另有一个中文展示标签（如 lower = 「下肢/髋膝踝」），会进 AI 提示词与写给用户看的
 *    aiReasoning 文案，属用户可见文案，改动即改用户可见输出。
 *  - logType 运动记录种类：strength/stretch/custom 或内置有氧类型键
 *  - bodyPart 部位：膝/踝/髋/腰背/肩/肘腕/颈 —— 诊断、检查、处方动作的部位。
 *    部位是**多值**维度：一个动作可以同时属于多个部位（「弓步蹲」既是髋也是膝）。
 *    数据模型上 bodyParts 是归一化后的枚举键**数组**（去重、按 BODY_PARTS 稳定排序），
 *    bodyPart 是兼容既有消费方的首要部位单值；存储层始终保留用户/AI 的自由文本原文
 *    （如「膝盖」「左膝内侧」不改写），归一化只发生在派生字段与比较/检索时。
 *    多值入口是 inferBodyParts（全部命中）与 normalizeBodyParts（数组/自由文本 → 枚举键数组），
 *    单值入口 inferBodyPart / normalizeBodyPart 保持「首个命中」语义不变，识别不了返回空串。
 *
 * nature 与 phase 是两个维度，不是同一枚举的粗细粒度：
 * 「拉伸」性质通常落在 cooldown 阶段，但「热身」性质的动作也可能是 main 阶段的激活动作。
 * 因此两者各有归一化函数，跨维度换算必须走下面显式命名的 xxxTo(yyy) 函数。
 */

/** 动作性质枚举：[键, 中文标签] */
const ACTION_NATURES = [
    ['training', '训练'],
    ['stretch', '拉伸'],
    ['mobility', '活动度'],
    ['warmup', '热身'],
    ['recovery', '恢复'],
    ['cardio', '有氧'],
    ['other', '其他'],
];

/** 计划阶段枚举（AI 计划 JSON 契约） */
const PLAN_PHASES = ['warmup', 'main', 'cooldown'];

/** 训练负荷桶枚举 */
const TRAINING_BUCKETS = ['push', 'pull', 'lower', 'core', 'cardio', 'rehab'];

/**
 * 训练负荷桶推断规则：[桶键, 中文展示标签, 关键词正则]，顺序即优先级，首个命中生效。
 * 词典与顺序逐字迁自 plan-auto-adjust.js 的 inferBodyPart（名为部位、实为负荷桶），不得随意增删改序。
 * 中文标签是用户可见文案（AI 提示词与 aiReasoning），不得改写。
 * @type {ReadonlyArray<readonly [string, string, RegExp]>}
 */
const TRAINING_BUCKET_RULES = [
    ['lower', '下肢/髋膝踝', /膝|踝|足|腿|臀|髋|深蹲|弓步|下肢|knee|ankle|leg|hip|glute|squat|lunge/],
    ['push', '上肢推/肩胸', /肩|胸|推|俯卧撑|上肢|shoulder|chest|press|push/],
    ['pull', '上肢拉/背', /背|划船|下拉|拉|row|pull|back/],
    ['core', '核心/躯干', /核心|腹|腰|平板|躯干|core|abs|plank|trunk/],
    ['cardio', '有氧', /有氧|跑|走|骑|游泳|cardio|run|walk|bike|cycling|swim/],
    ['rehab', '活动度/放松', /拉伸|活动度|放松|mobility|stretch/]
];

/**
 * 部位推断规则：[部位键, 关键词正则]，顺序即优先级，首个命中生效。
 * 词典逐字迁自 health-profile.js 的 inferBodyPart，不得随意增删改序。
 * @type {ReadonlyArray<readonly [string, RegExp]>}
 */
const BODY_PART_RULES = [
    ['膝', /膝|髌|半月板|股四头|台阶|靠墙蹲|knee|patella|quad/],
    ['踝', /踝|跟腱|足底|小腿|提踵|踝泵|ankle|achilles|calf/],
    ['髋', /髋|臀|梨状|蚌式|髋外展|后踢腿|hip|glute/],
    ['腰背', /腰|背|脊柱|竖脊|核心|腰椎|low back|lumbar|spine|core/],
    ['肩', /肩|肩胛|袖|外旋|内旋|shoulder|scapula|rotator/],
    ['肘腕', /肘|腕|前臂|手腕|elbow|wrist|forearm/],
    ['颈', /颈|斜方|neck|cervical/]
];

/** 部位枚举（归一化目标键；顺序与推断规则一致） */
const BODY_PARTS = BODY_PART_RULES.map(([part]) => part);

/** 自由文本里常见的部位分隔符（「膝、踝」「髋/膝」「膝 踝」）。 */
const BODY_PART_SEPARATORS = /[、，,;；|｜／\/\s]+/;

const NATURE_ALIASES = {
    train: 'training',
    strength: 'training',
    main: 'training',
    训练: 'training',
    力量: 'training',
    stretch: 'stretch',
    cooldown: 'stretch',
    拉伸: 'stretch',
    放松: 'stretch',
    mobility: 'mobility',
    活动度: 'mobility',
    灵活性: 'mobility',
    warmup: 'warmup',
    热身: 'warmup',
    recovery: 'recovery',
    rehab: 'recovery',
    恢复: 'recovery',
    康复: 'recovery',
    cardio: 'cardio',
    有氧: 'cardio',
};

const PHASE_WARMUP_ALIASES = ['warmup', 'warm-up', '热身', 'warm'];
const PHASE_COOLDOWN_ALIASES = ['cooldown', 'cool-down', 'stretch', 'stretching', '拉伸', '放松'];

const BUCKET_ALIASES = {
    pushing: 'push', chest: 'push', shoulder: 'push', triceps: 'push', 推: 'push', 胸: 'push', 肩: 'push',
    pulling: 'pull', back: 'pull', biceps: 'pull', 拉: 'pull', 背: 'pull',
    legs: 'lower', leg: 'lower', lowerbody: 'lower', 下肢: 'lower', 腿: 'lower', 臀: 'lower',
    abs: 'core', trunk: 'core', 核心: 'core', 腹: 'core',
    aerobic: 'cardio', endurance: 'cardio', 有氧: 'cardio', 跑步: 'cardio', 步行: 'cardio', 骑行: 'cardio',
    rehabilitation: 'rehab', mobility: 'rehab', stretch: 'rehab', 康复: 'rehab', 拉伸: 'rehab',
};

function toKey(value) {
    return String(value || '').trim().toLowerCase();
}

/** 归一化动作性质；无法识别时返回空串（= 未分类），不臆造默认值。 */
function normalizeActionNature(value = '') {
    const raw = toKey(value);
    return NATURE_ALIASES[raw] || (ACTION_NATURES.some(([key]) => key === raw) ? raw : '');
}

/** 动作性质的中文标签；未分类返回空串。 */
function actionNatureLabel(value = '') {
    const normalized = normalizeActionNature(value);
    return ACTION_NATURES.find(([key]) => key === normalized)?.[1] || '';
}

/** 归一化计划阶段；识别不出时按主训练处理（AI 输出必须落在三选一内）。 */
function normalizePlanPhase(value = 'main') {
    const text = toKey(value);
    if (PHASE_WARMUP_ALIASES.includes(text)) return 'warmup';
    if (PHASE_COOLDOWN_ALIASES.includes(text)) return 'cooldown';
    return 'main';
}

/** 归一化训练负荷桶；无法识别时返回空串。 */
function normalizeTrainingBucket(value = '') {
    const key = toKey(value);
    const normalized = BUCKET_ALIASES[key] || key;
    return TRAINING_BUCKETS.includes(normalized) ? normalized : '';
}

/** 从自由文本推断训练负荷桶键；首个命中的规则生效，未命中返回空串。 */
function inferTrainingBucket(value = '') {
    const text = String(value || '').toLowerCase();
    return TRAINING_BUCKET_RULES.find(([, , pattern]) => pattern.test(text))?.[0] || '';
}

/** 训练负荷桶的中文展示标签（用户可见文案）；未知桶返回空串。 */
function trainingBucketLabel(value = '') {
    const key = toKey(value);
    return TRAINING_BUCKET_RULES.find(([bucket]) => bucket === key)?.[1] || '';
}

/** 从自由文本推断训练负荷桶的中文展示标签；未命中返回空串。 */
function inferTrainingBucketLabel(value = '') {
    return trainingBucketLabel(inferTrainingBucket(value));
}

/**
 * 从自由文本推断**全部**命中的部位键（「弓步蹲」→ 髋 + 膝）。
 * 顺序与 BODY_PART_RULES 一致，未命中返回空数组。
 * @returns {string[]}
 */
function inferBodyParts(value = '') {
    const text = String(value || '').toLowerCase();
    return BODY_PART_RULES.filter(([, pattern]) => pattern.test(text)).map(([part]) => part);
}

/** 从自由文本推断主要部位；首个命中的规则生效，未命中返回空串（兼容既有单值消费方）。 */
function inferBodyPart(value = '') {
    return inferBodyParts(value)[0] || '';
}

/**
 * 归一化部位为枚举键数组（多值）。
 * 接受数组或自由文本，也容忍 null/undefined/非数组：
 * 文本先按常见分隔符拆分逐项归一（先枚举直通、再推断），再对整串补推断一次
 * ——拆分会切断含空格的关键词（如 low back），补这一次才不丢信息。
 * 结果去重、按 BODY_PARTS 稳定排序、剔除空值；无结果返回空数组。
 * 幂等：normalizeBodyParts(normalizeBodyParts(x)) 恒等于 normalizeBodyParts(x)。
 * @param {string|string[]|null|undefined} [value]
 * @returns {string[]}
 */
function normalizeBodyParts(value = '') {
    const hits = new Set();
    const collect = (item) => {
        const text = String(item ?? '').trim();
        if (!text) return;
        if (BODY_PARTS.includes(text)) hits.add(text);
        else inferBodyParts(text).forEach((part) => hits.add(part));
    };
    if (Array.isArray(value)) {
        value.forEach(collect);
    } else {
        const text = String(value ?? '').trim();
        text.split(BODY_PART_SEPARATORS).forEach(collect);
        inferBodyParts(text).forEach((part) => hits.add(part));
    }
    return BODY_PARTS.filter((part) => hits.has(part));
}

/**
 * 三处编辑器保存路径共用：按值变化写入用户填的部位并派生多值字段。
 * 输入与现存 bodyPart（各自 trim 后）相同 → 不碰任何字段：AI/词典分类的记录
 * bodyPart 为空、输入框预填也为空，原样保存不得抹掉已派生的 bodyParts。
 * 不同 → 写入原文（trim，不改写）、派生 bodyParts、来源记 user；
 * 清空 = 用户撤回表态，派生与来源同步清空，词典/AI 之后可重填。
 * @param {any} record
 * @param {any} [nextText] 编辑器输入的部位自由文本；缺省视为空串
 * @returns {boolean} 是否真的变化，调用方据此决定要不要打字段级时间戳
 */
function applyUserBodyParts(record, nextText) {
    if (!record || typeof record !== 'object') return false;
    const next = String(nextText ?? '').trim();
    if (next === String(record.bodyPart || '').trim()) return false;
    record.bodyPart = next;
    record.bodyParts = normalizeBodyParts(next);
    record.bodyPartsSource = next ? 'user' : '';
    return true;
}

/**
 * 归一化部位为单值：恰为枚举键直接返回；否则从文本推断；仍无返回空串。
 * 刻意不走 normalizeBodyParts —— 后者会拆分空格，会让「low back」这类含空格关键词失配。
 */
function normalizeBodyPart(value = '') {
    const text = String(value || '').trim();
    if (BODY_PARTS.includes(text)) return text;
    return inferBodyPart(text);
}

/**
 * 动作性质 → 运动记录种类。
 * 只有力量和拉伸在记录表单里有专属字段，其余性质统一按自定义运动记录。
 */
function natureToExerciseLogType(value = '') {
    const nature = normalizeActionNature(value);
    if (nature === 'training') return 'strength';
    if (nature === 'stretch') return 'stretch';
    return 'custom';
}

/**
 * 运动记录种类 → 动作性质（回存动作库时用）。
 * 内置有氧类型键不在枚举里，靠 met 判定：有 MET 即有氧，否则归其他。
 */
function exerciseLogTypeToNature(type = '', met = 0) {
    const key = toKey(type);
    if (key === 'strength') return 'training';
    if (Number(met || 0) > 0) return 'cardio';
    if (key === 'stretch') return 'stretch';
    return 'other';
}

const actionTaxonomy = {
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
    applyUserBodyParts,
    natureToExerciseLogType,
    exerciseLogTypeToNature,
};

if (typeof window !== 'undefined') {
    window['actionTaxonomy'] = actionTaxonomy;
}

export {
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
    applyUserBodyParts,
    natureToExerciseLogType,
    exerciseLogTypeToNature,
};

export default actionTaxonomy;
