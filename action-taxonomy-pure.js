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
 *  - bucket  训练负荷桶：push/pull/lower/core/cardio/rehab —— 周容量分析用
 *  - logType 运动记录种类：strength/stretch/custom 或内置有氧类型键
 *  - bodyPart 部位：膝/踝/髋/腰背/肩/肘腕/颈 —— 诊断、检查、处方动作的主要部位。
 *    存储层保持用户/AI 的自由文本原文（如「膝盖」「左膝内侧」不改写），
 *    normalizeBodyPart 只在比较/检索时把自由文本折算到枚举键，识别不了返回空串。
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

/** 从自由文本推断主要部位；首个命中的规则生效，未命中返回空串。 */
function inferBodyPart(value = '') {
    const text = String(value || '').toLowerCase();
    return BODY_PART_RULES.find(([, pattern]) => pattern.test(text))?.[0] || '';
}

/** 归一化部位：恰为枚举键直接返回；否则从文本推断；仍无返回空串。 */
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
    inferBodyPart,
    normalizeBodyPart,
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
    inferBodyPart,
    normalizeBodyPart,
    natureToExerciseLogType,
    exerciseLogTypeToNature,
};

export default actionTaxonomy;
