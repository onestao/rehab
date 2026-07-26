// @ts-nocheck
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  if (root.planPolicy) return;

  const PLAN_TYPES = ['warmup', 'main', 'cooldown'];
  const BLOCKED_STATUS = new Set(['dropped', 'avoid', 'stopped', 'paused', '禁止', '暂停', '停做', '不要做']);
  const PREFERRED_STATUS = new Set(['continued', 'progressed', 'new']);
  const CAUTIOUS_STATUS = new Set(['watch', 'cautious', 'review', 'conditional']);
  const AUTO_PLAN_SOURCES = new Set(['ai', 'local-rule', 'system']);
  const USER_PLAN_SOURCES = new Set(['manual', 'imported', 'user', 'rehab-center']);

  const ACTIONS = [
    {
      actionKey: 'bridge-pelvic-adduction-brick',
      canonicalName: '骨盆内收夹砖臀桥',
      progressionGroup: 'bridge-adduction',
      progressionLevel: 3,
      chainId: 'plan-chain-bridge',
      categoryHint: 'main',
      aliases: ['骨盆内收夹砖臀桥', '骨盆内收夹砖桥'],
      patterns: [/骨盆.*内收.*夹砖.*(臀桥|桥)/, /夹砖.*骨盆.*内收.*(臀桥|桥)/]
    },
    {
      actionKey: 'bridge-brick',
      canonicalName: '夹砖臀桥',
      progressionGroup: 'bridge-adduction',
      progressionLevel: 2,
      chainId: 'plan-chain-bridge',
      categoryHint: 'main',
      aliases: ['夹砖臀桥', '夹瑜伽砖臀桥', '夹砖内收臀桥'],
      patterns: [/夹(砖|瑜伽砖).*(臀桥|桥)/, /(臀桥|桥).*夹(砖|瑜伽砖)/]
    },
    {
      actionKey: 'bridge-basic',
      canonicalName: '基础臀桥',
      progressionGroup: 'bridge-adduction',
      progressionLevel: 1,
      chainId: 'plan-chain-bridge',
      categoryHint: 'main',
      aliases: ['基础臀桥', '普通臀桥', '桥式保持', '桥式慢速重复'],
      patterns: [/基础.*臀桥/, /普通.*臀桥/, /桥式保持/, /桥式慢速/, /^臀桥$/, /^桥式$/]
    },
    {
      actionKey: 'single-leg-bridge',
      canonicalName: '单腿臀桥',
      progressionGroup: 'single-leg-bridge',
      progressionLevel: 1,
      categoryHint: 'main',
      conditional: true,
      aliases: ['单腿臀桥'],
      patterns: [/单腿.*臀桥/]
    },
    {
      actionKey: 'dynamic-copenhagen-side-plank',
      canonicalName: '动态哥本哈根侧桥',
      progressionGroup: 'copenhagen-side-plank',
      progressionLevel: 2,
      categoryHint: 'main',
      aliases: ['动态哥本哈根侧桥', '动态哥本哈根'],
      patterns: [/动态.*哥本哈根/, /哥本哈根.*侧桥/]
    },
    {
      actionKey: 'tfl-brush-sensory',
      canonicalName: '刷子轻抚阔筋膜张肌',
      progressionGroup: 'tfl-sensory-activation',
      progressionLevel: 1,
      categoryHint: 'warmup',
      aliases: ['刷子轻抚阔筋膜张肌', '轻抚阔筋膜张肌'],
      patterns: [/刷子.*(阔筋膜张肌|髋部)/, /轻抚.*(阔筋膜张肌|髋部)/]
    },
    {
      actionKey: 'tfl-ball-release',
      canonicalName: '球按压阔筋膜张肌',
      progressionGroup: 'tfl-release',
      progressionLevel: 1,
      categoryHint: 'cooldown',
      aliases: ['球按压阔筋膜张肌', '球放松阔筋膜张肌'],
      patterns: [/(球|按摩球).*(按|压|放松).*(阔筋膜张肌|TFL)/i, /(阔筋膜张肌|TFL).*(球|按摩球)/i]
    },
    {
      actionKey: 'groin-press-leg-flexion',
      canonicalName: '按压腹股沟同时腿屈伸',
      progressionGroup: 'groin-press-mobility',
      progressionLevel: 1,
      categoryHint: 'warmup',
      aliases: ['按压腹股沟同时腿屈伸', '腹股沟按压腿屈伸'],
      patterns: [/按压.*腹股沟.*(屈伸|腿)/, /腹股沟.*按压.*(屈伸|腿)/]
    },
    {
      actionKey: 'side-lying-hip-extension-knee-adduction',
      canonicalName: '侧卧髋伸直曲腿内收活动',
      progressionGroup: 'glute-med-anterior-mobility',
      progressionLevel: 1,
      categoryHint: 'main',
      aliases: ['侧卧髋伸直曲腿内收活动', '侧卧髋伸直屈膝内收'],
      patterns: [/侧卧.*髋.*伸直.*(曲腿|屈膝).*内收/, /侧卧.*内收.*臀中肌前束/]
    },
    {
      actionKey: 'foam-roller-adductor',
      canonicalName: '泡沫轴放松大腿内侧',
      progressionGroup: 'adductor-release',
      progressionLevel: 1,
      categoryHint: 'cooldown',
      aliases: ['泡沫轴放松大腿内侧', '泡沫轴内收肌'],
      patterns: [/泡沫轴.*(大腿内侧|内收肌)/, /(大腿内侧|内收肌).*泡沫轴/]
    },
    {
      actionKey: 'foam-roller-glute-med',
      canonicalName: '泡沫轴放松臀中肌',
      progressionGroup: 'glute-med-release',
      progressionLevel: 1,
      categoryHint: 'cooldown',
      aliases: ['泡沫轴放松臀中肌'],
      patterns: [/泡沫轴.*臀中肌/, /臀中肌.*泡沫轴/]
    },
    {
      actionKey: 'warrior-three-walk',
      canonicalName: '战士三式支撑行走',
      progressionGroup: 'single-leg-balance',
      progressionLevel: 2,
      categoryHint: 'main',
      aliases: ['战士三式支撑行走', '战士三式行走'],
      patterns: [/战士三.*(支撑)?行走/, /单脚.*平衡.*行走/]
    },
    {
      actionKey: 'yoga-ball-assisted-single-leg-squat',
      canonicalName: '瑜伽球辅助单腿下蹲',
      progressionGroup: 'single-leg-squat',
      progressionLevel: 1,
      categoryHint: 'main',
      aliases: ['瑜伽球辅助单腿下蹲', '瑜伽球辅助单腿蹲'],
      patterns: [/瑜伽球.*单腿.*(下蹲|蹲)/, /球.*辅助.*单腿.*(下蹲|蹲)/]
    },
    {
      actionKey: 'side-lying-hip-abduction',
      canonicalName: '侧卧髋外展',
      progressionGroup: 'hip-abduction',
      progressionLevel: 1,
      categoryHint: 'main',
      aliases: ['侧卧髋外展', '侧卧夹毛巾抬腿'],
      patterns: [/侧卧.*(髋外展|外展)/, /侧卧.*夹毛巾.*抬腿/]
    },
    {
      actionKey: 'wall-squat',
      canonicalName: '靠墙深蹲',
      progressionGroup: 'squat',
      progressionLevel: 1,
      categoryHint: 'main',
      aliases: ['靠墙深蹲', '靠墙静蹲'],
      patterns: [/靠墙.*(深蹲|静蹲)/]
    }
  ];

  function normalizeActionName(value) {
    return String(value || '')
      .replace(/[\s·•、，。；;:：()（）【】\[\]_-]+/g, '')
      .replace(/^(计划|训练|动作|康复|热身|主训练|放松)+/g, '')
      .toLowerCase();
  }

  function sourceText(action) {
    if (!action) return '';
    return [
      action.name,
      action.title,
      action.actionName,
      action.rawDescription,
      action.description,
      action.coachNote,
      action.note,
      action.displayName,
      action.aliases && Array.isArray(action.aliases) ? action.aliases.join(' ') : '',
      action.tags && Array.isArray(action.tags) ? action.tags.join(' ') : ''
    ].filter(Boolean).join(' ');
  }

  function actionMetaForName(name) {
    const text = String(name || '');
    const compact = normalizeActionName(text);
    if (!compact) return null;
    for (const action of ACTIONS) {
      if (action.patterns.some((pattern) => pattern.test(text) || pattern.test(compact))) {
        return { ...action };
      }
      if (action.aliases.some((alias) => compact.includes(normalizeActionName(alias)))) {
        return { ...action };
      }
    }
    return {
      actionKey: compact,
      canonicalName: text.trim() || compact,
      progressionGroup: '',
      progressionLevel: 0,
      chainId: '',
      categoryHint: inferCategory('', text)
    };
  }

  // 临床部位推断走分类事实源（action-taxonomy-pure.js）。
  function inferActionBodyPart(text) {
    return (typeof window !== 'undefined' ? window.actionTaxonomy : null)?.inferBodyPart?.(text) || '';
  }

  function inferCategory(type, name) {
    const normalizedType = String(type || '').toLowerCase();
    if (PLAN_TYPES.includes(normalizedType)) return normalizedType;
    const text = String(name || '');
    if (/泡沫轴|放松|松解|拉伸|按摩|球.*(按|压|放松)/.test(text)) return 'cooldown';
    if (/热身|激活|轻抚|刷子|腹股沟.*按压|动态活动/.test(text)) return 'warmup';
    return 'main';
  }

  function hasLegacyContinueIntent(text) {
    return /之前.*(动作|训练|项目)?.*(都)?(可以)?继续|原来.*(动作|训练|项目)?.*(可以)?继续|此前.*(动作|训练|项目)?.*(可以)?继续|之前的.*都.*继续/.test(String(text || ''));
  }

  function isBlockedAction(action) {
    const status = String(action?.status || '').toLowerCase();
    const text = sourceText(action);
    const pain = Number(action?.painScore ?? action?.painLevel ?? action?.pain ?? 0);
    if (BLOCKED_STATUS.has(status) || pain >= 4) return true;
    if (/停做|暂停|不要做|禁止|先别做|疼痛明显/.test(text)) return true;
    if (!/避免/.test(text)) return false;
    const name = action?.name || action?.title || action?.actionName || '';
    const escapedName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedName && new RegExp(`避免.{0,16}${escapedName}|${escapedName}.{0,8}避免`).test(text)) return true;
    return /避免.{0,12}(臀桥|桥式|侧桥|深蹲|下蹲|外展|内收|行走|跑步|跳跃|拉伸|放松|按压)/.test(text);
  }

  function isCautiousAction(action) {
    const status = String(action?.status || '').toLowerCase();
    const text = sourceText(action);
    const confidence = Number(action?.confidence ?? 100);
    return Boolean(action?.needsReview)
      || CAUTIOUS_STATUS.has(status)
      || confidence < 80
      || /如果|视情况|不稳|不舒服|观察|谨慎|可选|需要确认|疼痛/.test(text);
  }

  function classifyPrescriptionAction(action) {
    const name = action?.name || action?.title || action?.actionName || '';
    const meta = actionMetaForName(sourceText(action));
    const blocked = isBlockedAction(action);
    const cautious = !blocked && isCautiousAction(action);
    const status = String(action?.status || '').toLowerCase();
    const preferred = !blocked && !cautious && (PREFERRED_STATUS.has(status) || !status || status === 'baseline');
    const canAutoProgress = preferred && (status === 'progressed' || status === 'continued');
    return {
      ...action,
      ...(meta || {}),
      name: name || meta?.canonicalName || '',
      canonicalName: meta?.canonicalName || name || '',
      policyType: blocked ? 'blocked' : cautious ? 'cautious' : preferred ? 'preferred' : 'baseline',
      canAutoAdd: preferred,
      canAutoProgress,
      requiresUserConfirm: cautious || Boolean(meta?.conditional),
      reason: blocked ? '医嘱或反馈要求暂停/避免' : cautious ? '条件性或需要确认的医嘱' : '最新医嘱可作为候选'
    };
  }

  function activeRecords(records) {
    return Array.isArray(records) ? records.filter((record) => !record?.deletedAt && !record?.deleted) : [];
  }

  function parseJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function repairPlanAiJson(rawText = '') {
    const source = String(rawText || '').trim();
    const marker = source.match(/"items"\s*:\s*\[/);
    if (!marker) return null;
    const itemRe = /\{(?:[^{}"\\]|\\.|"(?:\\.|[^"\\])*"|\{(?:[^{}"\\]|\\.|"(?:\\.|[^"\\])*")*\})*\}/g;
    const items = [...source.slice(marker.index + marker[0].length).matchAll(itemRe)]
      .map((match) => parseJson(match[0]))
      .filter(Boolean);
    if (!items.length) return null;
    const read = (key) => source.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))?.[1] || '';
    return { date: read('date'), type: read('type'), title: read('title'), notes: read('notes'), items };
  }

  function latestRehabWeeks(db, limit = 3) {
    const weeks = activeRecords(db?.health?.rehabWeekly || db?.rehabWeekly || db?.rehabWeeklies || []);
    return weeks
      .slice()
      .sort((a, b) => String(b.date || b.weekStart || b.createdAt || '').localeCompare(String(a.date || a.weekStart || a.createdAt || '')))
      .slice(0, limit);
  }

  function activePlanItems(plan) {
    if (Array.isArray(plan?.items)) {
      return plan.items
        .filter((item) => item && !item.deletedAt && !item.deleted)
        .map((item) => ({ ...item, type: inferCategory(item.type || item.category || item.phase, item.name) }));
    }
    return PLAN_TYPES.flatMap((type) => Array.isArray(plan?.[type]) ? plan[type].filter((item) => !item?.deletedAt).map((item) => ({ ...item, type })) : []);
  }

  function itemsMatch(a, b) {
    const leftPrescriptionId = typeof a === 'object' ? String(a?.prescriptionActionId || '') : '';
    const rightPrescriptionId = typeof b === 'object' ? String(b?.prescriptionActionId || '') : '';
    if (leftPrescriptionId && rightPrescriptionId && leftPrescriptionId === rightPrescriptionId) return true;
    const leftSourceIds = sourceIdsForMatch(a);
    const rightSourceIds = sourceIdsForMatch(b);
    if (leftSourceIds.some((id) => rightSourceIds.includes(id))) return true;
    const left = typeof a === 'string' ? actionMetaForName(a) : (a?.actionKey ? a : actionMetaForName(sourceText(a)));
    const right = typeof b === 'string' ? actionMetaForName(b) : (b?.actionKey ? b : actionMetaForName(sourceText(b)));
    if (!left || !right) return false;
    if (left.actionKey && right.actionKey && left.actionKey === right.actionKey) return true;
    if (left.progressionGroup && right.progressionGroup && left.progressionGroup === right.progressionGroup) return true;
    const leftName = normalizeActionName(left.canonicalName || sourceText(a));
    const rightName = normalizeActionName(right.canonicalName || sourceText(b));
    return leftName.length >= 3 && rightName.length >= 3 && (leftName.includes(rightName) || rightName.includes(leftName));
  }

  function tasksShareIdentity(a = {}, b = {}) {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;
    if (itemsMatch(a, b)) return true;
    const left = { ...actionMetaForName(sourceText(a)), ...a };
    const right = { ...actionMetaForName(sourceText(b)), ...b };
    if (left.prescriptionActionId && right.prescriptionActionId && left.prescriptionActionId === right.prescriptionActionId) return true;
    if (left.actionKey && right.actionKey && left.actionKey === right.actionKey) return true;
    return Boolean(left.progressionGroup && right.progressionGroup && left.progressionGroup === right.progressionGroup);
  }

  function itemsExactMatch(a, b) {
    const leftPrescriptionId = typeof a === 'object' ? String(a?.prescriptionActionId || '') : '';
    const rightPrescriptionId = typeof b === 'object' ? String(b?.prescriptionActionId || '') : '';
    if (leftPrescriptionId && rightPrescriptionId && leftPrescriptionId === rightPrescriptionId) return true;
    const leftSourceIds = sourceIdsForMatch(a);
    const rightSourceIds = sourceIdsForMatch(b);
    if (leftSourceIds.some((id) => rightSourceIds.includes(id))) return true;
    const left = typeof a === 'string' ? actionMetaForName(a) : (a?.actionKey ? a : actionMetaForName(sourceText(a)));
    const right = typeof b === 'string' ? actionMetaForName(b) : (b?.actionKey ? b : actionMetaForName(sourceText(b)));
    if (!left || !right) return false;
    if (left.actionKey && right.actionKey && left.actionKey === right.actionKey) return true;
    const leftName = normalizeActionName(left.canonicalName || sourceText(a));
    const rightName = normalizeActionName(right.canonicalName || sourceText(b));
    return Boolean(leftName && rightName && leftName === rightName);
  }

  function itemCoversMustKeepAction(item, action) {
    if (itemsExactMatch(item, action)) return true;
    const left = item?.actionKey ? item : actionMetaForName(sourceText(item));
    const right = action?.actionKey ? action : actionMetaForName(sourceText(action));
    if (!left || !right) return false;
    const leftLevel = Number(item?.progressionLevel || left.progressionLevel || 0);
    const rightLevel = Number(action?.progressionLevel || right.progressionLevel || 0);
    return Boolean(left.progressionGroup
      && right.progressionGroup
      && left.progressionGroup === right.progressionGroup
      && leftLevel
      && rightLevel
      && leftLevel >= rightLevel);
  }

  function sourceIdsForMatch(value) {
    if (!value || typeof value !== 'object') return [];
    return [
      value.sourceActionId,
      value.linkedActionId,
      ...(Array.isArray(value.sourceActionIds) ? value.sourceActionIds : [])
    ].map((id) => String(id || '').trim()).filter(Boolean);
  }

  function summarizePolicyItemForDebug(item = {}) {
    return {
      name: item.name || item.canonicalName || '',
      source: item.policy?.source || item.source || '',
      category: inferCategory(item.type || item.category, item.name || item.canonicalName || ''),
      actionKey: item.actionKey || '',
      progressionGroup: item.progressionGroup || '',
      progressionLevel: Number(item.progressionLevel || 0),
      reason: item.aiReasoning || item.reason || ''
    };
  }

  function itemFeedbackFlags(item) {
    const feedback = item?.feedback || {};
    const painScore = Number(feedback.painScore ?? feedback.painLevel ?? feedback.pain ?? 0);
    return {
      painScore: Number.isFinite(painScore) ? painScore : 0,
      noIncrease: Boolean(feedback.noIncrease || feedback.dontIncrease),
      keepNextTime: Boolean(feedback.keepNextTime),
      unsuitable: Boolean(feedback.unsuitable),
      wantsContinue: feedback.wantsContinue !== false
    };
  }

  function isStableLegacyItem(item) {
    const flags = itemFeedbackFlags(item);
    if (flags.unsuitable || flags.wantsContinue === false || flags.painScore >= 4) return false;
    if (!item?.feedback?.doneAt && item?.status !== 'done' && item?.done !== true) return false;
    return true;
  }

  function buildPlanPolicyContext({ db, activeRecords: activeRecordsFn, sourcePlans, types } = {}) {
    const getActive = typeof activeRecordsFn === 'function' ? activeRecordsFn : activeRecords;
    if (window.actionIdentity?.ensurePrescriptionActionCatalog) {
      window.actionIdentity.ensurePrescriptionActionCatalog(db || {});
    }
    const prescriptionCatalog = window.actionIdentity?.getPrescriptionActionCatalog?.(db || {}) || activeRecords(db?.health?.prescriptionActions || []);
    const prescriptionById = new Map(prescriptionCatalog.map((item) => [item.id, item]));
    const weeks = latestRehabWeeks(db, 4);
    const latestWeek = weeks[0] || {};
    const actions = weeks.flatMap((week, weekIndex) => activeRecords(week.actions || []).map((action) => {
      const identity = prescriptionById.get(action.prescriptionActionId);
      return {
      ...classifyPrescriptionAction({
        ...action,
        name: identity?.displayName || action.name,
        canonicalName: identity?.displayName || action.canonicalName || action.name,
        aliases: identity?.aliases || action.aliases || [],
        sourceActionIds: identity?.sourceActionIds || action.sourceActionIds || [],
        linkedActionId: identity?.linkedActionId || action.linkedActionId || '',
        prescriptionActionId: identity?.id || action.prescriptionActionId || ''
      }),
      weekIndex,
      weekDate: week.date || week.weekStart || week.createdAt || ''
    }; }));
    const catalogActions = [...prescriptionById.values()]
      .filter((item) => item && !actions.some((action) => action.prescriptionActionId && action.prescriptionActionId === item.id))
      .map((item) => classifyPrescriptionAction({
        name: item.displayName,
        aliases: item.aliases || [],
        rawDescription: [item.notes, item.bodyPart, item.conditionLabel].filter(Boolean).join(' '),
        status: item.latestStatus || '',
        painLevel: item.latestPainLevel || 0,
        spec: item.defaultSpec || null,
        prescriptionActionId: item.id,
        sourceActionIds: item.sourceActionIds || [],
        linkedActionId: item.linkedActionId || '',
        progressionGroup: item.progressionGroup || '',
        progressionLevel: item.progressionLevel || 0
      }));
    const latestText = [latestWeek.rawText, latestWeek.notes, latestWeek.homework, latestWeek.therapistAssessment].filter(Boolean).join('\n');
    const legacyContinueAllowed = Boolean(latestWeek.legacyContinueAllowed) || hasLegacyContinueIntent(latestText);
    const hardBlocks = actions.filter((action) => action.policyType === 'blocked');
    const cautiousActions = actions.filter((action) => action.policyType === 'cautious');
    const prescriptionActions = [...actions, ...catalogActions].filter((action) => action.policyType !== 'blocked');
    const preferredActions = prescriptionActions.filter((action) => action.weekIndex === 0 && action.policyType === 'preferred');
    const dailyPlans = getActive(db?.dailyPlans || []);
    const historicalPlans = activeRecords([...(Array.isArray(sourcePlans) ? sourcePlans : []), ...dailyPlans]);
    const stableLegacyItems = historicalPlans
      .flatMap(activePlanItems)
      .filter(isStableLegacyItem)
      .map((item) => ({ ...item, ...actionMetaForName(sourceText(item)) }))
      .filter((item, index, list) => list.findIndex((other) => itemsMatch(item, other)) === index);
    return {
      types: Array.isArray(types) && types.length ? types : PLAN_TYPES,
      weeks,
      latestWeek,
      latestText,
      legacyContinueAllowed,
      hardBlocks,
      cautiousActions,
      prescriptionActions,
      preferredActions,
      mustKeepActions: preferredActions.filter((action) => action.canAutoAdd),
      stableLegacyItems,
      summary: {
        latestWeek: latestWeek.date || latestWeek.weekStart || '',
        legacyContinueAllowed,
        blocked: hardBlocks.map((action) => action.canonicalName || action.name),
        cautious: cautiousActions.map((action) => action.canonicalName || action.name),
        preferred: preferredActions.map((action) => action.canonicalName || action.name),
        stableLegacy: stableLegacyItems.map((item) => item.canonicalName || item.name)
      }
    };
  }

  function matchAction(list, item) {
    return (Array.isArray(list) ? list : []).find((candidate) => itemsMatch(candidate, item));
  }

  function appendReason(item, reason) {
    if (!reason) return item;
    const existing = item.aiReasoning || item.reason || '';
    return { ...item, aiReasoning: existing ? `${existing}；${reason}` : reason };
  }

  function annotatePlanItem(item, context, sourceItems = []) {
    const meta = actionMetaForName(sourceText(item));
    const type = inferCategory(item?.type, item?.name || meta?.canonicalName || '');
    const blocked = matchAction(context?.hardBlocks, item);
    const cautious = matchAction(context?.cautiousActions, item);
    const prescription = matchAction(context?.prescriptionActions, item);
    const sourceItem = matchAction(sourceItems, item);
    const stableLegacy = context?.legacyContinueAllowed && matchAction(context?.stableLegacyItems, item);
    const userChosen = Boolean(item?.userOverride) || ['action-library', 'routine-library', 'user-preview', 'user-edit'].includes(String(item?.policy?.source || item?.source || ''));
    const nonPrescriptionNew = type === 'main' && !prescription && !sourceItem && !stableLegacy && !userChosen;
    const requiresUserConfirm = Boolean(item?.requiresUserConfirm)
      || Boolean(blocked)
      || Boolean(cautious)
      || Boolean(meta?.conditional)
      || nonPrescriptionNew;
    const policySource = blocked ? 'blocked'
      : prescription ? 'prescription'
        : sourceItem ? 'current-plan'
          : stableLegacy ? 'legacy-continue'
            : userChosen && (item?.policy?.source || item?.source) ? String(item.policy?.source || item.source)
              : 'non-prescription';
    const annotated = {
      ...item,
      type,
      category: item?.category || type,
      actionKey: item?.actionKey || meta?.actionKey || '',
      canonicalName: item?.canonicalName || meta?.canonicalName || item?.name || '',
      progressionGroup: item?.progressionGroup || meta?.progressionGroup || '',
      progressionLevel: Number(item?.progressionLevel || meta?.progressionLevel || 0),
      chainId: item?.chainId || meta?.chainId || '',
      sourceActionId: item?.sourceActionId || '',
      prescriptionActionId: item?.prescriptionActionId || prescription?.prescriptionActionId || '',
      requiresUserConfirm,
      userConfirmed: requiresUserConfirm ? item?.userConfirmed === true : item?.userConfirmed !== false,
      policy: {
        ...(item?.policy && typeof item.policy === 'object' ? item.policy : {}),
        source: policySource,
        blocked: Boolean(blocked),
        cautious: Boolean(cautious),
        prescriptionName: prescription?.canonicalName || prescription?.name || '',
        requiresUserConfirm
      }
    };
    if (blocked) return appendReason(annotated, '与最新医嘱或反馈中的暂停/避免记录冲突，需要用户主动确认后才执行');
    if (requiresUserConfirm && nonPrescriptionNew) return appendReason(annotated, '非医嘱新增动作，需要用户确认后再执行');
    if (requiresUserConfirm && cautious) return appendReason(annotated, '条件性医嘱，需要用户确认当前状态符合后再执行');
    return annotated;
  }

  function prescriptionTask(action) {
    const meta = actionMetaForName(sourceText(action)) || {};
    const name = action.canonicalName || action.name || meta.canonicalName || '医嘱动作';
    const category = inferCategory(meta.categoryHint, name);
    const spec = action.spec || action.suggestedSpec || action.reps || action.dosage || '5秒 × 12次 × 1组';
    return {
      id: `prescription-${action.actionKey || meta.actionKey || normalizeActionName(name)}-${Date.now().toString(36)}`,
      name,
      type: category,
      spec,
      status: 'todo',
      source: 'prescription',
      prescriptionActionId: action.prescriptionActionId || '',
      actionKey: action.actionKey || meta.actionKey || '',
      canonicalName: name,
      progressionGroup: action.progressionGroup || meta.progressionGroup || '',
      progressionLevel: Number(action.progressionLevel || meta.progressionLevel || 0),
      chainId: action.chainId || meta.chainId || '',
      requiresUserConfirm: Boolean(action.requiresUserConfirm),
      userConfirmed: !action.requiresUserConfirm,
      policy: { source: 'prescription', prescriptionName: name, requiresUserConfirm: Boolean(action.requiresUserConfirm) },
      aiReasoning: '补入最新医嘱中应保留的动作'
    };
  }

  function capItems(items) {
    const caps = { warmup: 2, main: 6, cooldown: 2 };
    const bucket = { warmup: [], main: [], cooldown: [] };
    items.forEach((item) => {
      const type = inferCategory(item.type, item.name);
      if (bucket[type].length < caps[type]) bucket[type].push({ ...item, type });
    });
    return [...bucket.warmup, ...bucket.main, ...bucket.cooldown];
  }

  function sanitizeGeneratedPlans(plans, options = {}) {
    const context = options.policyContext || buildPlanPolicyContext(options);
    const sourcePlans = activeRecords(options.sourcePlans || []);
    const ensureTaskShape = typeof options.ensureTaskShape === 'function' ? options.ensureTaskShape : (item) => item;
    const emitDebug = typeof options.onDebug === 'function' ? options.onDebug : null;
    const keepBlockedAsConfirm = options.keepBlockedAsConfirm === true;
    const respectUserOverride = options.respectUserOverride === true;
    const canReplaceItem = (item) => !(respectUserOverride && item?.userOverride);
    return activeRecords(plans).map((plan) => {
      const policyDebug = {
        date: plan.date || options.targetDate || '',
        type: plan.type || 'rehab',
        removedBlocked: [],
        keptBlockedForConfirm: [],
        addedCooldown: [],
        mustKeep: []
      };
      const sourcePlan = sourcePlans.find((candidate) => candidate.type === plan.type) || sourcePlans[0] || {};
      const sourceItems = activePlanItems(sourcePlan);
      let items = activePlanItems(plan).map((item) => annotatePlanItem(item, context, sourceItems));
      items = items.filter((item) => {
        if (!item.policy?.blocked) return true;
        if (keepBlockedAsConfirm) {
          policyDebug.keptBlockedForConfirm.push(summarizePolicyItemForDebug(item));
          return true;
        }
        policyDebug.removedBlocked.push(summarizePolicyItemForDebug(item));
        return false;
      });

      sourceItems.filter((item) => inferCategory(item.type, item.name) === 'cooldown').slice(0, 2).forEach((sourceItem) => {
        if (!items.some((item) => inferCategory(item.type, item.name) === 'cooldown' && itemsMatch(item, sourceItem))) {
          const cooldownTask = appendReason(annotatePlanItem({ ...sourceItem, status: 'todo' }, context, sourceItems), '保留原计划放松，避免自动调整后缺少收操');
          policyDebug.addedCooldown.push(summarizePolicyItemForDebug(cooldownTask));
          items.push(cooldownTask);
        }
      });

      const mainCount = () => items.filter((item) => inferCategory(item.type, item.name) === 'main').length;
      const missingMustKeep = context.mustKeepActions.filter((action) => {
        const coveringItem = items.find((item) => itemCoversMustKeepAction(item, action));
        if (coveringItem && !itemsExactMatch(coveringItem, action)) {
          policyDebug.mustKeep.push({
            action: action.canonicalName || action.name || '',
            mode: 'covered-by-progression',
            item: summarizePolicyItemForDebug(coveringItem)
          });
        }
        return !coveringItem;
      });
      missingMustKeep.forEach((action) => {
        const task = annotatePlanItem(prescriptionTask(action), context, sourceItems);
        const chainReplaceIndex = items.findIndex((item) => canReplaceItem(item)
          && inferCategory(item.type, item.name) === inferCategory(task.type, task.name)
          && item.progressionGroup
          && item.progressionGroup === task.progressionGroup
          && Number(item.progressionLevel || 0) < Number(task.progressionLevel || 0));
        if (chainReplaceIndex >= 0) {
          policyDebug.mustKeep.push({
            action: action.canonicalName || action.name || '',
            mode: 'replace-lower-progression',
            replaced: summarizePolicyItemForDebug(items[chainReplaceIndex]),
            item: summarizePolicyItemForDebug(task)
          });
          items[chainReplaceIndex] = task;
          return;
        }
        if (mainCount() >= 6 && inferCategory(task.type, task.name) === 'main') {
          const replaceIndex = items.findIndex((item) => canReplaceItem(item) && inferCategory(item.type, item.name) === 'main' && item.policy?.source === 'non-prescription');
          if (replaceIndex >= 0) {
            policyDebug.mustKeep.push({
              action: action.canonicalName || action.name || '',
              mode: 'replace-non-prescription',
              replaced: summarizePolicyItemForDebug(items[replaceIndex]),
              item: summarizePolicyItemForDebug(task)
            });
            items[replaceIndex] = task;
          }
        } else {
          policyDebug.mustKeep.push({
            action: action.canonicalName || action.name || '',
            mode: 'append',
            item: summarizePolicyItemForDebug(task)
          });
          items.push(task);
        }
      });

      items = capItems(items).map((item) => ensureTaskShape(item, plan.type));
      const result = {
        ...plan,
        date: plan.date || options.targetDate || '',
        items,
        warmup: items.filter((item) => inferCategory(item.type, item.name) === 'warmup'),
        main: items.filter((item) => inferCategory(item.type, item.name) === 'main'),
        cooldown: items.filter((item) => inferCategory(item.type, item.name) === 'cooldown')
      };
      if (emitDebug) emitDebug(policyDebug);
      return result;
    });
  }

  function isUserOwnedPlan(plan = {}) {
    const source = String(plan?.source || '').trim();
    return USER_PLAN_SOURCES.has(source);
  }

  function isProtectedPlanTask(item = {}, plan = null) {
    const source = String(item?.policy?.source || item?.source || '');
    const planSource = String(plan?.source || '').trim();
    return Boolean(item && !item.deleted && (
      item.status === 'done'
      || item.userOverride === true
      || source === 'user-edit'
      || USER_PLAN_SOURCES.has(source)
      || (planSource && !AUTO_PLAN_SOURCES.has(planSource))
    ));
  }

  function normalizedSpecFingerprint(spec = {}) {
    return JSON.stringify({
      sets: Number(spec.sets || 0),
      reps: Number(spec.reps || 0),
      work: Number(spec.work || 0),
      weight: Number(spec.weight || 0),
      repRest: Number(spec.repRest || 0),
      actionRest: Number(spec.actionRest || 0),
      isAlt: !!spec.isAlt,
      mode: String(spec.mode || '')
    });
  }

  function normalizedFeedbackFingerprint(feedback = null) {
    if (!feedback || typeof feedback !== 'object') return '';
    return JSON.stringify({
      rpe: feedback.rpe == null ? null : Number(feedback.rpe),
      painScore: feedback.painScore == null ? feedback.painLevel == null ? feedback.pain == null ? null : Number(feedback.pain) : Number(feedback.painLevel) : Number(feedback.painScore),
      painPart: String(feedback.painPart || feedback.painBodyPart || feedback.painLocation || ''),
      wantsContinue: feedback.wantsContinue === true ? true : feedback.wantsContinue === false ? false : null,
      noIncrease: !!(feedback.noIncrease || feedback.dontIncrease),
      keepNextTime: !!feedback.keepNextTime,
      unsuitable: !!feedback.unsuitable,
      note: String(feedback.note || ''),
      doneAt: Number(feedback.doneAt || 0)
    });
  }

  function protectedTaskShapeChanged(before = {}, after = {}) {
    return String(before.name || '') !== String(after.name || '')
      || inferCategory(before.type || before.category, before.name) !== inferCategory(after.type || after.category, after.name)
      || normalizedSpecFingerprint(before.spec || {}) !== normalizedSpecFingerprint(after.spec || {})
      || String(before.status || 'todo') !== String(after.status || 'todo')
      || Number(before.doneSets || 0) !== Number(after.doneSets || 0)
      || normalizedFeedbackFingerprint(before.feedback) !== normalizedFeedbackFingerprint(after.feedback);
  }

  function findMatchingTask(items = [], source = {}) {
    return items.find((item) => item.id && source.id && item.id === source.id)
      || items.find((item) => itemsExactMatch(item, source))
      || items.find((item) => itemsMatch(item, source))
      || null;
  }

  function validatePlanChanges({ beforePlans = [], afterPlans = [], source = '' } = {}) {
    const violations = [];
    activeRecords(beforePlans).forEach((beforePlan) => {
      const beforeItems = activePlanItems(beforePlan);
      const protectedItems = beforeItems.filter((item) => isProtectedPlanTask(item, beforePlan));
      const afterPlan = activeRecords(afterPlans).find((plan) => String(plan.date || '') === String(beforePlan.date || '')
        && String(plan.type || 'rehab') === String(beforePlan.type || 'rehab'));
      const afterItems = activePlanItems(afterPlan || {});
      if (isUserOwnedPlan(beforePlan) && (!afterPlan || String(afterPlan.source || '') !== String(beforePlan.source || '') || afterItems.length !== beforeItems.length)) {
        violations.push({
          type: afterPlan ? 'protected-plan-mutated' : 'protected-plan-removed',
          source,
          planId: beforePlan.id || '',
          reason: '手工/导入计划不能被自动改写'
        });
      }
      if (!protectedItems.length) return;
      protectedItems.forEach((item) => {
        const match = findMatchingTask(afterItems, item);
        if (!match) {
          violations.push({
            type: 'protected-task-removed',
            source,
            planId: beforePlan.id || '',
            taskId: item.id || '',
            taskName: item.name || '',
            reason: '已完成、锁定或用户编辑任务不能被自动删除'
          });
          return;
        }
        if (protectedTaskShapeChanged(item, match)) {
          violations.push({
            type: 'protected-task-mutated',
            source,
            planId: beforePlan.id || '',
            taskId: item.id || '',
            taskName: item.name || '',
            reason: '已完成、锁定或用户编辑任务不能被自动改名或改参数'
          });
        }
        const duplicate = afterItems.find((candidate) => candidate !== match
          && (!candidate.id || candidate.id !== item.id)
          && tasksShareIdentity(candidate, item));
        if (duplicate) {
          violations.push({
            type: 'protected-task-duplicated',
            source,
            planId: beforePlan.id || '',
            taskId: item.id || '',
            taskName: item.name || '',
            duplicateName: duplicate.name || '',
            reason: '自动调整不能绕过保护任务追加同身份重复动作'
          });
        }
      });
    });
    return { ok: violations.length === 0, violations };
  }

  function specLoad(spec = {}) {
    return Math.max(0, Number(spec.sets || 0))
      * Math.max(1, Number(spec.reps || 0) || 1)
      * Math.max(1, Number(spec.work || 0) || 1);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniq(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
  }

  function buildAdjustmentBatch(input = {}, id = '') {
    const nowTs = Number(input.createdAt || Date.now());
    const changes = Array.isArray(input.changes) ? input.changes : [];
    return {
      id: input.id || id || `adj-${nowTs}`,
      source: input.source || 'local-rule',
      status: input.status || 'previewed',
      createdAt: nowTs,
      appliedAt: Number(input.appliedAt || 0),
      sourceDate: String(input.sourceDate || ''),
      targetDates: uniq(input.targetDates),
      trigger: input.trigger || {},
      summary: String(input.summary || ''),
      beforePlans: Array.isArray(input.beforePlans) ? clone(input.beforePlans) : [],
      afterPlans: Array.isArray(input.afterPlans) ? clone(input.afterPlans) : [],
      changes,
      rejectedChangeIds: uniq(input.rejectedChangeIds),
      acceptedChangeIds: uniq(input.acceptedChangeIds || changes.filter((change) => ['accepted', 'auto-applied'].includes(change.status)).map((change) => change.id)),
      undo: { beforePlansRef: 'inline', canUndo: input.undo?.canUndo !== false && Array.isArray(input.beforePlans) }
    };
  }

  function samePlanIdentity(a = {}, b = {}) {
    return Boolean((a.id && b.id && a.id === b.id)
      || (String(a.date || '') === String(b.date || '') && String(a.type || 'rehab') === String(b.type || 'rehab')));
  }

  function samePlanForRemoval(current = {}, removed = {}) {
    return removed.id ? current.id === removed.id : samePlanIdentity(current, removed);
  }

  function samePlanForRestore(current = {}, restored = {}) {
    return restored.id ? current.id === restored.id : samePlanIdentity(current, restored);
  }

  function restorePlanAdjustmentPlans(current = [], before = [], after = [], ensurePlan = (plan) => plan) {
    const beforePlans = (Array.isArray(before) ? before : []).map((plan) => ensurePlan(clone(plan)));
    const afterPlans = (Array.isArray(after) ? after : []).map((plan) => ensurePlan(clone(plan)));
    const next = (Array.isArray(current) ? current : []).map((plan) => ensurePlan(clone(plan)));
    [...beforePlans, ...afterPlans]
      .filter((plan, index, list) => list.findIndex((item) => samePlanIdentity(item, plan)) === index)
      .forEach((ref) => {
        const beforePlan = beforePlans.find((plan) => samePlanIdentity(plan, ref));
        const index = next.findIndex((plan) => beforePlan ? samePlanForRestore(plan, ref) : samePlanForRemoval(plan, ref));
        if (beforePlan) {
          if (index >= 0) next[index] = beforePlan;
          else if (!beforePlan.id) next.push(beforePlan);
        } else if (index >= 0) {
          next.splice(index, 1);
        }
      });
    return next;
  }

  function buildProgressionSuggestion(result = {}, { plan = {}, task = {}, chain = {} } = {}) {
    const targetLevel = result.targetLevel == null ? task.currentLevel ?? null : Number(result.targetLevel);
    const target = (Array.isArray(chain.levels) ? chain.levels : []).find((item) => Number(item.lv) === Number(targetLevel));
    return {
      createdAt: Date.now(),
      decision: result.decision || result.suggestion || 'hold',
      phase: result.phase || '',
      targetLevel,
      targetName: target?.name || '',
      suggestedSpec: result.suggestedSpec && typeof result.suggestedSpec === 'object' ? { ...result.suggestedSpec } : {},
      fallbackSpec: result.fallbackSpec && typeof result.fallbackSpec === 'object' ? { ...result.fallbackSpec } : {},
      reason: String(result.reason || ''),
      appliesTo: 'future-only',
      sourcePlanId: plan.id || '',
      sourceTaskId: task.id || '',
      sourceDate: plan.date || '',
      chainId: task.chainId || chain.id || '',
      status: 'pending',
      chainAlternatives: Array.isArray(result.chainAlternatives) ? result.chainAlternatives.map((item) => ({ ...item })) : []
    };
  }

  function applyFutureProgressionSuggestion(next = {}, source = {}, { chain = null } = {}) {
    const suggestion = source.nextProgressionSuggestion;
    const decision = suggestion?.decision || '';
    delete next.nextProgressionSuggestion;
    if (!suggestion || suggestion.appliesTo !== 'future-only' || !['progress', 'volume-up', 'deload'].includes(decision)) return next;
      const targetLevel = Number(suggestion.targetLevel || 0);
      if (targetLevel && chain?.levels?.length && targetLevel !== Number(source.currentLevel || 0)) {
        const target = chain.levels.find((item) => Number(item.lv) === targetLevel);
        if (target?.name) next.name = target.name;
        next.currentLevel = targetLevel;
        next.chainId = chain.id || source.chainId || '';
      }
      const targetMeta = actionMetaForName(suggestion.targetName || next.name || '');
      if (targetMeta.actionKey) next.actionKey = targetMeta.actionKey;
      if (targetMeta.canonicalName) next.canonicalName = targetMeta.canonicalName;
      if (targetMeta.progressionGroup) next.progressionGroup = targetMeta.progressionGroup;
      if (targetMeta.progressionLevel) next.progressionLevel = Number(targetMeta.progressionLevel || 0);
      if (targetMeta.chainId) next.chainId = chain?.id || targetMeta.chainId || next.chainId || '';
    const suggestedSpec = suggestion.suggestedSpec && Object.keys(suggestion.suggestedSpec).length ? suggestion.suggestedSpec : suggestion.fallbackSpec;
    if (suggestedSpec && Object.keys(suggestedSpec).length) next.spec = { ...(next.spec || {}), ...suggestedSpec };
    next.progressionPhase = suggestion.phase || next.progressionPhase || '';
    next.aiReasoning = `${next.aiReasoning ? `${next.aiReasoning}；` : ''}应用上次反馈生成的下次建议：${suggestion.reason || decision}`;
    return next;
  }

  function isoDateOffset(baseKey, days) {
    const m = String(baseKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function detectMissedPlanCandidates(plans = [], options = {}) {
    const targetDate = String(options.targetDate || options.today || '');
    if (!targetDate) return [];
    const startDate = String(options.startDate || isoDateOffset(targetDate, -Math.max(1, Number(options.lookbackDays || 3))) || '');
    const typeSet = options.types ? new Set((Array.isArray(options.types) ? options.types : [options.types]).map((type) => String(type || 'rehab'))) : null;
    return activeRecords(plans)
      .filter((plan) => plan.date && plan.date < targetDate && (!startDate || plan.date >= startDate))
      .filter((plan) => !typeSet || typeSet.has(plan.type || 'rehab'))
      .flatMap((plan) => activePlanItems(plan)
        .filter((item) => inferCategory(item.type || item.category, item.name) === 'main')
        .filter((item) => item.status !== 'done' && item.status !== 'skipped')
        .filter((item) => !isProtectedPlanTask(item, plan) && !item.policy?.blocked && item.policy?.source !== 'blocked')
        .map((item, index) => {
          const meta = actionMetaForName(sourceText(item));
          const risk = (plan.type || 'rehab') === 'rehab' || item.prescriptionActionId || item.policy?.source === 'prescription' ? 'low' : 'medium';
          return {
            id: `missed-${plan.id || plan.date}-${item.id || index}`,
            type: 'carry-over',
            risk,
            status: 'pending',
            reason: risk === 'low' ? '漏练康复/医嘱动作，优先原样顺延候选' : '漏练训练任务，需按今日负载预算确认补偿方式',
            sourceTask: { planId: plan.id || '', taskId: item.id || '', date: plan.date || '', name: item.name || '' },
            targetTask: { planId: '', taskId: '', date: targetDate, name: item.name || '' },
            identity: {
              actionKey: item.actionKey || meta.actionKey || '',
              prescriptionActionId: item.prescriptionActionId || '',
              progressionGroup: item.progressionGroup || meta.progressionGroup || '',
              bodyPart: inferActionBodyPart(sourceText(item))
            },
            loadDelta: {
              sets: Number(item.spec?.sets || 0),
              reps: Number(item.spec?.reps || 0),
              work: Number(item.spec?.work || 0),
              estimatedLoad: specLoad(item.spec || {})
            }
          };
        }));
  }

  function adjustmentTypeForItem(item = {}) {
    const reason = String(item.aiReasoning || '');
    if (/降载|降低|deload/.test(reason)) return 'deload';
    if (/加量|加组|太轻|volume/.test(reason)) return 'volume-up';
    if (/进阶|升级|下一阶/.test(reason)) return 'progress';
    return 'replace';
  }

  function adjustmentTypeForPair(before = {}, after = {}) {
    const explicit = adjustmentTypeForItem(after);
    if (explicit !== 'replace') return explicit;
    const beforeSpec = before.spec || {};
    const afterSpec = after.spec || {};
    const beforeLevel = Number(before.progressionLevel || before.currentLevel || 0);
    const afterLevel = Number(after.progressionLevel || after.currentLevel || 0);
    if (afterLevel > beforeLevel || (before.progressionGroup && before.progressionGroup === after.progressionGroup && before.actionKey && after.actionKey && before.actionKey !== after.actionKey)) return 'progress';
    if (specLoad(afterSpec) < specLoad(beforeSpec)) return 'deload';
    if (Number(afterSpec.sets || 0) > Number(beforeSpec.sets || 0)
      || Number(afterSpec.reps || 0) > Number(beforeSpec.reps || 0)
      || Number(afterSpec.work || 0) > Number(beforeSpec.work || 0)) return 'volume-up';
    return 'replace';
  }

  function taskShapeChanged(before = {}, after = {}) {
    return String(before.name || '') !== String(after.name || '')
      || inferCategory(before.type || before.category, before.name) !== inferCategory(after.type || after.category, after.name)
      || Number(before.progressionLevel || before.currentLevel || 0) !== Number(after.progressionLevel || after.currentLevel || 0)
      || normalizedSpecFingerprint(before.spec || {}) !== normalizedSpecFingerprint(after.spec || {});
  }

  function buildPlanAdjustmentChanges(current = {}, merged = {}, sourcePlan = {}) {
    const currentItems = activePlanItems(current);
    const nextItems = activePlanItems(merged);
    const preserved = currentItems.filter((item) => isProtectedPlanTask(item, current));
    const removed = currentItems.filter((item) => !isProtectedPlanTask(item, current) && !nextItems.some((next) => tasksShareIdentity(next, item)));
    const added = nextItems.filter((item) => !currentItems.some((before) => tasksShareIdentity(item, before)));
    const paired = currentItems
      .filter((item) => !isProtectedPlanTask(item, current) && !removed.includes(item))
      .map((before) => ({ before, after: nextItems.find((next) => tasksShareIdentity(next, before)) }))
      .filter(({ before, after }) => after && taskShapeChanged(before, after));
    return [
      ...preserved.map((item) => ({
        type: 'keep',
        risk: 'low',
        status: 'auto-applied',
        reason: item.status === 'done' ? '已完成任务作为历史事实保留' : item.userOverride ? '用户锁定任务不自动覆盖' : '用户编辑任务不自动覆盖',
        sourceTask: { planId: current.id || '', taskId: item.id || '', date: current.date || '', name: item.name || '' },
        targetTask: { planId: merged.id || '', taskId: item.id || '', date: merged.date || '', name: item.name || '' }
      })),
      ...removed.map((item) => ({
        type: 'remove',
        risk: 'medium',
        status: 'auto-applied',
        reason: '未完成且未锁定任务被自动调整替换',
        sourceTask: { planId: current.id || '', taskId: item.id || '', date: current.date || '', name: item.name || '' },
        targetTask: null
      })),
      ...paired.map(({ before, after }) => ({
        type: adjustmentTypeForPair(before, after),
        risk: after.requiresUserConfirm ? 'medium' : 'low',
        status: 'auto-applied',
        reason: after.aiReasoning || sourcePlan.notes || '同身份任务参数调整',
        sourceTask: { planId: current.id || '', taskId: before.id || '', date: current.date || '', name: before.name || '' },
        targetTask: { planId: merged.id || '', taskId: after.id || '', date: merged.date || '', name: after.name || '' },
        identity: { actionKey: after.actionKey || before.actionKey || '', prescriptionActionId: after.prescriptionActionId || before.prescriptionActionId || '', progressionGroup: after.progressionGroup || before.progressionGroup || '' },
        loadDelta: {
          sets: Number(after.spec?.sets || 0) - Number(before.spec?.sets || 0),
          reps: Number(after.spec?.reps || 0) - Number(before.spec?.reps || 0),
          work: Number(after.spec?.work || 0) - Number(before.spec?.work || 0),
          estimatedLoad: specLoad(after.spec || {}) - specLoad(before.spec || {})
        }
      })),
      ...added.map((item) => ({
        type: adjustmentTypeForItem(item),
        risk: item.requiresUserConfirm ? 'medium' : 'low',
        status: 'auto-applied',
        reason: item.aiReasoning || sourcePlan.notes || '自动调整生成',
        sourceTask: null,
        targetTask: { planId: merged.id || '', taskId: item.id || '', date: merged.date || '', name: item.name || '' },
        identity: {
          actionKey: item.actionKey || '',
          prescriptionActionId: item.prescriptionActionId || '',
          progressionGroup: item.progressionGroup || ''
        },
        loadDelta: {
          sets: Number(item.spec?.sets || 0),
          reps: Number(item.spec?.reps || 0),
          work: Number(item.spec?.work || 0),
          estimatedLoad: specLoad(item.spec || {})
        }
      }))
    ];
  }

  root.planPolicy = {
    ACTIONS,
    PLAN_TYPES,
    normalizeActionName,
    actionMetaForName,
    classifyPrescriptionAction,
    hasLegacyContinueIntent,
    buildPlanPolicyContext,
    annotatePlanItem,
    sanitizeGeneratedPlans,
    repairPlanAiJson,
    itemsMatch,
    itemsExactMatch,
    tasksShareIdentity,
    inferCategory,
    itemFeedbackFlags,
    isUserOwnedPlan,
    isProtectedPlanTask,
    validatePlanChanges,
    buildPlanAdjustmentChanges,
    detectMissedPlanCandidates,
    buildAdjustmentBatch,
    restorePlanAdjustmentPlans,
    buildProgressionSuggestion,
    applyFutureProgressionSuggestion
  };
})();
