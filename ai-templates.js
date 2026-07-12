// @ts-check
(function () {
    const DEFAULT_TEMPLATES = [
        {
            id: 'tpl-weight-loss',
            name: '减重指导',
            scenario: 'weight-loss',
            system: '你是训练与营养健康顾问，面向减重用户输出可执行建议。',
            user: '目标：减重。我的基本信息：{gender} {age} 岁，身高 {height}cm，体重 {weight}kg。近期记录：\n{recentRecords}\n请给出今天/本周的训练与饮食调整建议。',
            vars: ['weight', 'height', 'age', 'gender', 'recentRecords']
        },
        {
            id: 'tpl-muscle-gain',
            name: '增肌方案',
            scenario: 'muscle-gain',
            system: '你是训练与营养健康顾问，面向增肌用户输出可执行建议。',
            user: '目标：增肌。我的基本信息：{gender} {age} 岁，身高 {height}cm，体重 {weight}kg。近期记录：\n{recentRecords}\n请给出本周训练重点与饮食建议。',
            vars: ['weight', 'height', 'age', 'gender', 'recentRecords']
        },
        {
            id: 'tpl-rehab',
            name: '康复训练',
            scenario: 'rehab',
            system: '你是康复训练顾问，需优先考虑安全与避免项。',
            user: '目标：康复训练。我的基本信息：{gender} {age} 岁，身高 {height}cm，体重 {weight}kg。近期记录：\n{recentRecords}\n请给出低风险康复动作与恢复建议。',
            vars: ['weight', 'height', 'age', 'gender', 'recentRecords']
        },
        {
            id: 'tpl-custom',
            name: '自由对话',
            scenario: 'custom',
            system: '你是训练与营养健康顾问。',
            user: '{recentRecords}\n用户问题：{prompt}',
            vars: ['recentRecords', 'prompt']
        },
        {
            id: 'tpl-weekly-report',
            name: '周报复盘',
            scenario: 'weekly_report',
            system: '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。',
            user: '输入仅包含 metrics JSON 与关键事件清单：\n{prompt}\n输出固定结构：summary 不超过 80 字，highlights 不超过 3 条，suggestions 不超过 3 条。',
            vars: ['prompt']
        },
        {
            id: 'tpl-monthly-report',
            name: '月报复盘',
            scenario: 'monthly_report',
            system: '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。',
            user: '输入仅包含 metrics JSON 与关键事件清单：\n{prompt}\n输出固定结构：summary 不超过 80 字，highlights 不超过 3 条，suggestions 不超过 3 条。',
            vars: ['prompt']
        }
    ];

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function ensureDefaultTemplates(db) {
        if (!db || !Array.isArray(db.aiTemplates)) return;
        const existing = new Set(db.aiTemplates.map(t => t?.id).filter(Boolean));
        const missing = DEFAULT_TEMPLATES.filter(t => !existing.has(t.id));
        if (missing.length) db.aiTemplates = db.aiTemplates.concat(clone(missing));
        db.aiTemplateActiveId = db.aiTemplateActiveId || db.aiTemplates[0]?.id || '';
    }

    function sanitizeTemplate(raw) {
        const tpl = raw && typeof raw === 'object' ? raw : {};
        return {
            id: String(tpl.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
            name: String(tpl.name || '未命名模板'),
            scenario: String(tpl.scenario || 'custom'),
            system: String(tpl.system || ''),
            user: String(tpl.user || ''),
            vars: Array.isArray(tpl.vars) ? tpl.vars.map(v => String(v)) : []
        };
    }

    function normalizeTemplates(list) {
        const items = Array.isArray(list) ? list : [];
        return items.map(sanitizeTemplate);
    }

    function applyTemplate(text, vars) {
        return String(text || '').replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key] ?? '') : `{${key}}`));
    }

    // ============================================================
    // AI Prompt Preferences System
    // ============================================================

    const DEFAULT_PROMPT_PREFS = {
        advice_general: {
            tone: 'coach',
            length: 'standard',
            focus: ['training', 'diet', 'weight'],
            avoid: [],
            suggestionCount: 2,
            customNote: ''
        },
        food_parse_text: {
            estimateMode: 'moderate',
            portionStyle: 'common',
            uncertainty: 'estimate',
            customNote: ''
        },
        food_parse_image: {
            conservatism: 'moderate',
            portionStyle: 'common',
            splitStrategy: 'by_dish',
            customNote: ''
        },
        body_goal_plan: {
            formulaPreference: 'mifflin_st_jeor',
            outputDetail: 'standard',
            customNote: ''
        },
        plan_generate: {
            planStyle: 'rehab_conservative',
            riskLevel: 'low',
            equipment: ['bodyweight'],
            avoidMovements: [],
            duration: '20-30',
            planDensity: 'standard',
            painThreshold: 4,
            customNote: ''
        },
        rehab_weekly_parse: {
            namingStyle: 'common',
            lowConfidenceThreshold: 80,
            painThreshold: 4,
            progressionStrictness: 'strict',
            customNote: ''
        },
        food_alias_merge: {
            strictness: 'moderate',
            customNote: ''
        },
        insight_advice: {
            style: 'concise',
            customNote: ''
        },
        weekly_report: {
            focus: ['completion', 'fatigue', 'deload'],
            outputStyle: 'coach',
            suggestionCount: 3,
            includeEncouragement: false,
            customNote: ''
        },
        monthly_report: {
            focus: ['weight_trend', 'training_volume', 'diet_adherence'],
            outputStyle: 'data',
            suggestionCount: 3,
            includeEncouragement: false,
            customNote: ''
        },
        quick_prompts: {
            customNote: ''
        }
    };

    const TASK_PREF_META = {
        advice_general: {
            label: '综合建议',
            desc: '用户对话型 AI，回答训练/饮食/体重问题',
            category: 'conversation',
            fields: [
                { key: 'tone', label: '回答语气', type: 'chips', options: [
                    { value: 'coach', label: '教练' },
                    { value: 'professional', label: '专业' },
                    { value: 'brief', label: '简洁' },
                    { value: 'encouraging', label: '鼓励' },
                    { value: 'cautious', label: '谨慎' }
                ]},
                { key: 'length', label: '回答长度', type: 'chips', options: [
                    { value: 'short', label: '简短' },
                    { value: 'standard', label: '标准' },
                    { value: 'detailed', label: '详细' }
                ]},
                { key: 'focus', label: '重点关注', type: 'multi-chips', options: [
                    { value: 'training', label: '训练量' },
                    { value: 'diet', label: '饮食' },
                    { value: 'weight', label: '体重' },
                    { value: 'protein', label: '蛋白质' },
                    { value: 'fatigue', label: '疲劳' },
                    { value: 'rehab_safety', label: '康复安全' }
                ]},
                { key: 'avoid', label: '避免内容', type: 'multi-chips', options: [
                    { value: 'jargon', label: '术语' },
                    { value: 'high_impact', label: '高冲击' },
                    { value: 'long_text', label: '长篇大论' }
                ]},
                { key: 'suggestionCount', label: '建议数量', type: 'number', min: 1, max: 5 },
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        food_parse_text: {
            label: '饮食识别（文本）',
            desc: '从文字描述识别食物和营养',
            category: 'structured',
            fields: [
                { key: 'estimateMode', label: '估算策略', type: 'chips', options: [
                    { value: 'conservative', label: '保守' },
                    { value: 'moderate', label: '标准' },
                    { value: 'generous', label: '偏高' }
                ]},
                { key: 'portionStyle', label: '份量风格', type: 'chips', options: [
                    { value: 'chinese_home', label: '中国家庭' },
                    { value: 'fitness', label: '健身餐' },
                    { value: 'takeout', label: '外卖' },
                    { value: 'common', label: '通用' }
                ]},
                { key: 'uncertainty', label: '不确定时', type: 'chips', options: [
                    { value: 'skip', label: '跳过' },
                    { value: 'estimate', label: '合理估算' },
                    { value: 'return_empty', label: '返回空' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        food_parse_image: {
            label: '饮食识别（图片）',
            desc: '从食物照片识别营养',
            category: 'structured',
            fields: [
                { key: 'conservatism', label: '估算策略', type: 'chips', options: [
                    { value: 'conservative', label: '保守' },
                    { value: 'moderate', label: '标准' },
                    { value: 'generous', label: '偏高' }
                ]},
                { key: 'portionStyle', label: '份量风格', type: 'chips', options: [
                    { value: 'chinese_home', label: '中国家庭' },
                    { value: 'fitness', label: '健身餐' },
                    { value: 'takeout', label: '外卖' },
                    { value: 'common', label: '通用' }
                ]},
                { key: 'splitStrategy', label: '拆分策略', type: 'chips', options: [
                    { value: 'merge', label: '合并' },
                    { value: 'by_dish', label: '按菜' },
                    { value: 'by_ingredient', label: '按食材' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        body_goal_plan: {
            label: '体重目标计划',
            desc: '增肌/减重热量和营养计划',
            category: 'structured',
            fields: [
                { key: 'formulaPreference', label: '热量公式', type: 'chips', options: [
                    { value: 'mifflin_st_jeor', label: 'Mifflin-St Jeor' },
                    { value: 'harris_benedict', label: 'Harris-Benedict' },
                    { value: 'auto', label: '自动' }
                ]},
                { key: 'outputDetail', label: '输出详细度', type: 'chips', options: [
                    { value: 'brief', label: '简要' },
                    { value: 'standard', label: '标准' },
                    { value: 'detailed', label: '详细' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        plan_generate: {
            label: '训练计划生成',
            desc: '生成每日/每周训练计划',
            category: 'structured',
            fields: [
                { key: 'planStyle', label: '计划风格', type: 'chips', options: [
                    { value: 'rehab_conservative', label: '康复保守' },
                    { value: 'progressive', label: '渐进' },
                    { value: 'cut', label: '减脂' },
                    { value: 'bulk', label: '增肌' },
                    { value: 'maintain', label: '维持' }
                ]},
                { key: 'riskLevel', label: '风险等级', type: 'chips', options: [
                    { value: 'very_low', label: '极低' },
                    { value: 'low', label: '低' },
                    { value: 'standard', label: '标准' },
                    { value: 'moderate', label: '中等' }
                ]},
                { key: 'painThreshold', label: '疼痛阈值', type: 'chips', options: [
                    { value: 3, label: '3/10' },
                    { value: 4, label: '4/10' },
                    { value: 5, label: '5/10' }
                ]},
                { key: 'avoidMovements', label: '避免动作', type: 'tags' },
                { key: 'duration', label: '时长', type: 'chips', options: [
                    { value: '10-15', label: '10-15分' },
                    { value: '20-30', label: '20-30分' },
                    { value: '30-45', label: '30-45分' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        rehab_weekly_parse: {
            label: '康复处方解析',
            desc: '解析康复师自然语言处方',
            category: 'structured',
            fields: [
                { key: 'namingStyle', label: '命名风格', type: 'chips', options: [
                    { value: 'common', label: '通俗' },
                    { value: 'clinical', label: '临床' },
                    { value: 'both', label: '两者' }
                ]},
                { key: 'lowConfidenceThreshold', label: '低置信阈值', type: 'chips', options: [
                    { value: 70, label: '70%' },
                    { value: 80, label: '80%' },
                    { value: 90, label: '90%' }
                ]},
                { key: 'painThreshold', label: '疼痛阈值', type: 'chips', options: [
                    { value: 3, label: '3/10' },
                    { value: 4, label: '4/10' },
                    { value: 5, label: '5/10' }
                ]},
                { key: 'progressionStrictness', label: '进阶严格度', type: 'chips', options: [
                    { value: 'strict', label: '严格' },
                    { value: 'moderate', label: '适中' }
                ]},
                { key: 'includeLastRawText', label: '附带上周原文', type: 'chips', options: [
                    { value: false, label: '不附带' },
                    { value: true, label: '附带（fallback）' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        food_alias_merge: {
            label: '食物别名合并',
            desc: '合并历史食物同类项',
            category: 'structured',
            fields: [
                { key: 'strictness', label: '合并严格度', type: 'chips', options: [
                    { value: 'strict', label: '严格' },
                    { value: 'moderate', label: '适中' },
                    { value: 'loose', label: '宽松' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        insight_advice: {
            label: '跨域建议',
            desc: '训练面板 AI 建议',
            category: 'conversation',
            fields: [
                { key: 'style', label: '输出风格', type: 'chips', options: [
                    { value: 'concise', label: '简洁' },
                    { value: 'detailed', label: '详细' },
                    { value: 'coach', label: '教练' }
                ]},
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        weekly_report: {
            label: '周报生成',
            desc: '每周训练/饮食/体重复盘',
            category: 'structured',
            fields: [
                { key: 'focus', label: '关注点', type: 'multi-chips', options: [
                    { value: 'completion', label: '完成率' },
                    { value: 'fatigue', label: '疲劳' },
                    { value: 'deload', label: '降载' },
                    { value: 'diet', label: '饮食' },
                    { value: 'weight', label: '体重' }
                ]},
                { key: 'outputStyle', label: '输出风格', type: 'chips', options: [
                    { value: 'data', label: '数据' },
                    { value: 'coach', label: '教练' },
                    { value: 'brief', label: '简洁' }
                ]},
                { key: 'suggestionCount', label: '建议数量', type: 'number', min: 1, max: 5 },
                { key: 'includeEncouragement', label: '包含鼓励', type: 'toggle' },
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        monthly_report: {
            label: '月报生成',
            desc: '每月训练/体重趋势复盘',
            category: 'structured',
            fields: [
                { key: 'focus', label: '关注点', type: 'multi-chips', options: [
                    { value: 'weight_trend', label: '体重趋势' },
                    { value: 'training_volume', label: '训练量' },
                    { value: 'diet_adherence', label: '饮食达标' },
                    { value: 'strength_pr', label: '力量PR' },
                    { value: 'cardio', label: '有氧' }
                ]},
                { key: 'outputStyle', label: '输出风格', type: 'chips', options: [
                    { value: 'data', label: '数据' },
                    { value: 'coach', label: '教练' },
                    { value: 'brief', label: '简洁' }
                ]},
                { key: 'suggestionCount', label: '建议数量', type: 'number', min: 1, max: 5 },
                { key: 'includeEncouragement', label: '包含鼓励', type: 'toggle' },
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        },
        quick_prompts: {
            label: '快捷问答',
            desc: '记录页快捷 AI 按钮',
            category: 'conversation',
            fields: [
                { key: 'customNote', label: '自定义补充', type: 'textarea' }
            ]
        }
    };

    function getPromptPrefs(taskId, db) {
        if (!taskId || !DEFAULT_PROMPT_PREFS[taskId]) return {};
        const userPrefs = db?.aiPromptPrefs?.[taskId] || {};
        return { ...DEFAULT_PROMPT_PREFS[taskId], ...userPrefs };
    }

    function resetPromptPrefs(taskId, db, saveFn) {
        if (!taskId || !db) return;
        if (!db.aiPromptPrefs) db.aiPromptPrefs = {};
        delete db.aiPromptPrefs[taskId];
        if (typeof saveFn === 'function') saveFn();
    }

    function resetAllPromptPrefs(db, saveFn) {
        if (!db) return;
        db.aiPromptPrefs = {};
        if (typeof saveFn === 'function') saveFn();
    }

    function isTaskCustomized(taskId, db) {
        return !!(db?.aiPromptPrefs?.[taskId] && Object.keys(db.aiPromptPrefs[taskId]).length > 0);
    }

    function buildToneInstructions(tone) {
        const map = {
            coach: '以教练口吻回答，注重可执行性和激励',
            professional: '以专业营养师/训练师口吻回答，注重科学依据',
            brief: '回答尽量简洁，直击要点',
            encouraging: '以鼓励为主，正面引导',
            cautious: '保守谨慎，优先提示风险'
        };
        return map[tone] || map.coach;
    }

    function buildLengthInstructions(length) {
        const map = { short: '回答控制在 100 字以内', standard: '回答 150-300 字', detailed: '回答可以详细展开，400-600 字' };
        return map[length] || map.standard;
    }

    function buildFocusTag(focus, customNote) {
        const parts = [];
        if (Array.isArray(focus) && focus.length) {
            const map = { training: '训练量', diet: '饮食', weight: '体重', protein: '蛋白质', fatigue: '疲劳', rehab_safety: '康复安全' };
            parts.push('重点关注：' + focus.map(f => map[f] || f).join('、'));
        }
        if (customNote) parts.push('用户补充：' + customNote);
        return parts.length ? '\n' + parts.join('。') + '。' : '';
    }

    function buildEstimateModeInstructions(mode) {
        const map = {
            conservative: '估算热量和份量时偏保守，宁可少算不多算',
            moderate: '用常见份量合理估算',
            generous: '估算时可以偏宽松'
        };
        return map[mode] || map.moderate;
    }

    function buildPortionStyleTag(style) {
        const map = {
            chinese_home: '优先按中国家庭常见份量（碗、盘、个）估算',
            fitness: '优先按健身餐常见份量估算',
            takeout: '优先按外卖常见份量估算',
            common: '用通用常见份量估算'
        };
        return map[style] || map.common;
    }

    function buildUncertaintyInstructions(uncertainty) {
        const map = {
            skip: '如果无法判断，跳过该项，不要编造',
            estimate: '如果无法判断，用合理估算',
            return_empty: '如果完全无法判断，返回空数组 []'
        };
        return map[uncertainty] || map.estimate;
    }

    function buildConservatismTag(conservatism) {
        const map = {
            conservative: '估算偏保守，宁少勿多',
            moderate: '用常见份量合理估算',
            generous: '估算可以偏宽松'
        };
        return map[conservatism] || map.moderate;
    }

    function buildSplitStrategyTag(strategy) {
        const map = {
            merge: '如果图片中有多种食物，合并为一条估算',
            by_dish: '按图片中的每个菜/盘分别估算',
            by_ingredient: '尽量按单独食材分别估算'
        };
        return map[strategy] || map.by_dish;
    }

    function buildFormulaTag(formula) {
        const map = {
            harris_benedict: '请使用 Harris-Benedict 公式计算 BMR',
            mifflin_st_jeor: '请使用 Mifflin-St Jeor 公式：\n  男：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 + 5\n  女：BMR = 10*体重(kg) + 6.25*身高(cm) - 5*年龄 - 161\n  计算 BMR 后再乘以活动系数得到 TDEE',
            auto: '选择最合适的公式计算 BMR 和 TDEE'
        };
        return map[formula] || map.mifflin_st_jeor;
    }

    function buildOutputDetailTag(detail) {
        const map = { brief: '每个方案只输出关键数值和一句话说明', standard: '输出标准方案详情', detailed: '输出详细方案，包含每日营养素分配和分阶段建议' };
        return map[detail] || map.standard;
    }

    function buildPlanStyleTag(style) {
        const map = {
            rehab_conservative: '康复保守型：优先安全，低强度，避免高冲击',
            progressive: '渐进型：稳步增加强度和训练量',
            cut: '减脂型：侧重消耗，中高强度有氧+力量',
            bulk: '增肌型：侧重力量训练，高蛋白支持',
            maintain: '维持型：保持当前水平，适度变化'
        };
        return map[style] || map.rehab_conservative;
    }

    function buildRiskLevelTag(level) {
        const map = { very_low: '极低风险：只选最安全的动作', low: '低风险：避免高冲击和高负荷', standard: '标准风险：常规训练动作均可', moderate: '中等风险：可包含部分高强度动作' };
        return map[level] || map.low;
    }

    function buildPlanDurationTag(duration) {
        const map = { '10-15': '每组训练 10-15 分钟', '20-30': '每组训练 20-30 分钟', '30-45': '每组训练 30-45 分钟' };
        return map[duration] || '每组训练 20-30 分钟';
    }

    function buildNamingStyleTag(style) {
        const map = { common: '用通俗中文名', clinical: '用临床/学术名称', both: '同时给出通俗名和临床名' };
        return map[style] || map.common;
    }

    function buildProgressionTag(strictness) {
        const map = {
            strict: '严格执行：疼痛 >= 阈值必须降级，低置信必须确认，不自动加量',
            moderate: '适度执行：疼痛 >= 阈值建议降级，低置信标记确认'
        };
        return map[strictness] || map.strict;
    }

    function buildStrictnessTag(strictness) {
        const map = {
            strict: '只合并确认为同食材且营养非常接近的项',
            moderate: '合并同食材且营养接近的项，但鸡胸/鸡腿、米饭/蛋炒饭不合并',
            loose: '适当放宽合并条件，减少历史食物种类'
        };
        return map[strictness] || map.moderate;
    }

    function buildInsightStyleTag(style) {
        const map = { concise: '用 3 条以内短建议，必须可执行', detailed: '详细分析后给出可执行建议', coach: '以教练口吻给出激励性建议' };
        return map[style] || map.concise;
    }

    function buildReportOutputStyleTag(style) {
        const map = { data: '以数据为主，客观分析', coach: '以教练口吻，结合数据给出指导', brief: '简洁摘要' };
        return map[style] || map.data;
    }

    function buildCustomNoteSection(customNote) {
        return customNote ? '\n用户偏好补充：' + customNote : '';
    }

    var SKELETON_BUILDERS = {
        food_parse_text: function (prefs) {
            var sys = '你是营养师助手。用户描述了食物，请严格只返回 JSON 数组，不要其他文字。\n每个元素必须包含核心字段 name、grams、cal、pro、carb、fat，不能省略；这些字段的值必须是数字，即使为 0 也必须明确输出。格式：{"name":"食物名","grams":克数,"cal":热量kcal,"pro":蛋白质g,"carb":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sugar":糖g,"sodium":钠mg,"saturatedFat":饱和脂肪g,"ingredients":["主要配料"],"cooking":"烹饪方式","source":"估算依据","confidence":0-100,"note":"健康性备注"}\n无法判断的扩展字段用 0、空数组或空字符串；热量可按蛋白质、碳水和脂肪计算，但不要省略 cal。' + buildEstimateModeInstructions(prefs.estimateMode) + '。' + buildPortionStyleTag(prefs.portionStyle) + '。\n' + buildUncertaintyInstructions(prefs.uncertainty) + '。不要输出 markdown、不要解释。';
            var user = '用户描述：{text}' + buildCustomNoteSection(prefs.customNote);
            return { system: sys, user: user };
        },
        food_parse_image: function (prefs) {
            var sys = '你是营养师助手。用户给出了一张食物照片。请你根据图片内容识别食物，并严格只返回 JSON 数组，不要其他文字。\n每个元素必须包含核心字段 name、grams、cal、pro、carb、fat，不能省略；这些字段的值必须是数字，即使为 0 也必须明确输出。格式：{"name":"食物名","grams":克数,"cal":热量kcal,"pro":蛋白质g,"carb":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sugar":糖g,"sodium":钠mg,"saturatedFat":饱和脂肪g,"ingredients":["主要配料"],"cooking":"烹饪方式","source":"估算依据","confidence":0-100,"note":"健康性备注"}\n无法判断的扩展字段用 0、空数组或空字符串；热量可按蛋白质、碳水和脂肪计算，但不要省略 cal。' + buildConservatismTag(prefs.conservatism) + '。\n' + buildPortionStyleTag(prefs.portionStyle) + '。\n' + buildSplitStrategyTag(prefs.splitStrategy) + '。\n如果图片中看不清或不确定，请不要编造，返回空数组 [] 或减少条目。不要输出 markdown、不要解释。';
            return { system: sys };
        },
        body_goal_plan_gain: function (prefs) {
            var sys = '你是运动营养师。只返回纯 JSON，不要 markdown，不要解释。';
            var user = '请使用 ' + buildFormulaTag(prefs.formulaPreference) + '。\n' + buildOutputDetailTag(prefs.outputDetail) + buildCustomNoteSection(prefs.customNote);
            return { system: sys, user: user };
        },
        body_goal_plan_loss: function (prefs) {
            var sys = '你是运动营养师。只返回纯 JSON，不要 markdown，不要解释。';
            var user = '请使用 ' + buildFormulaTag(prefs.formulaPreference) + '。\n' + buildOutputDetailTag(prefs.outputDetail) + buildCustomNoteSection(prefs.customNote);
            return { system: sys, user: user };
        },
        plan_generate: function (prefs) {
            var sys = '你是训练日程计划助手。只输出严格 JSON 文本，不要 Markdown 代码块、不要解释、不要追加任何说明。';
            var tags = [
                '计划风格：' + buildPlanStyleTag(prefs.planStyle),
                '风险等级：' + buildRiskLevelTag(prefs.riskLevel),
                buildPlanDurationTag(prefs.duration),
                '疼痛阈值：' + prefs.painThreshold + '/10'
            ];
            if (Array.isArray(prefs.avoidMovements) && prefs.avoidMovements.length) {
                tags.push('避免动作：' + prefs.avoidMovements.join('、'));
            }
            if (prefs.customNote) tags.push('用户补充：' + prefs.customNote);
            return { system: sys, prefTags: tags.join('\n') };
        },
        rehab_weekly_parse: function (prefs) {
            var sys = '你是康复训练处方结构化助手。用户只能提供康复师的自然语言描述，你需要把它解析为本周康复处方。\n必须只返回严格 JSON，不要 Markdown，不要解释。\n命名风格：' + buildNamingStyleTag(prefs.namingStyle) + '。\n' + buildProgressionTag(prefs.progressionStrictness) + '。\n低置信阈值：' + prefs.lowConfidenceThreshold + '%。疼痛阈值：' + prefs.painThreshold + '/10。';
            return { system: sys };
        },
        food_alias_merge: function (prefs) {
            var sys = '只返回纯 JSON 数组，不要 markdown，不要解释。' + buildStrictnessTag(prefs.strictness) + '。canonical 用简洁中文名，aliases 只能来自输入。';
            return { system: sys };
        },
        insight_advice: function (prefs) {
            var sys = '你是训练与营养健康顾问。只基于数据。' + buildInsightStyleTag(prefs.style) + '。若存在待判训练标签，先判断它们属于 push、pull、lower、core、cardio、rehab 之一，并在最后用 JSON 单独输出：{"classifications":[{"label":"原标签","bucket":"lower"}],"advice":"建议正文"}。bucket 只能用这六个英文值。';
            return { system: sys };
        },
        weekly_report: function (prefs) {
            var sys = '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。';
            var user = '请按以下偏好生成周报：\n- ' + buildReportOutputStyleTag(prefs.outputStyle) + '\n- 建议不超过 ' + (prefs.suggestionCount || 3) + ' 条';
            if (Array.isArray(prefs.focus) && prefs.focus.length) {
                var fmap = { completion: '完成率', fatigue: '疲劳', deload: '降载', diet: '饮食', weight: '体重' };
                user += '\n- 重点分析：' + prefs.focus.map(function (f) { return fmap[f] || f; }).join('、');
            }
            if (prefs.includeEncouragement) user += '\n- 结尾加一句简短鼓励';
            if (prefs.customNote) user += '\n- 用户补充：' + prefs.customNote;
            return { system: sys, user: user };
        },
        monthly_report: function (prefs) {
            var sys = '你是严谨的训练与体重数据复盘助手。禁止编造数据，只能引用输入字段。';
            var user = '请按以下偏好生成月报：\n- ' + buildReportOutputStyleTag(prefs.outputStyle) + '\n- 建议不超过 ' + (prefs.suggestionCount || 3) + ' 条';
            if (Array.isArray(prefs.focus) && prefs.focus.length) {
                var fmap = { weight_trend: '体重趋势', training_volume: '训练量', diet_adherence: '饮食达标', strength_pr: '力量PR', cardio: '有氧' };
                user += '\n- 重点分析：' + prefs.focus.map(function (f) { return fmap[f] || f; }).join('、');
            }
            if (prefs.includeEncouragement) user += '\n- 结尾加一句简短鼓励';
            if (prefs.customNote) user += '\n- 用户补充：' + prefs.customNote;
            return { system: sys, user: user };
        },
        advice_general: function (prefs) {
            var sys = '你是训练与营养健康顾问。基于用户的实际记录回答问题。\n规则：\n0. 用户健康档案为最高优先级：在生成任何训练或饮食建议前必须先核对【健康档案】。如果建议涉及档案中标记的避免项或用户过敏/不耐受的食物，必须替换为安全替代方案，并在回答中显式说明。\n1. 只能引用下方实际提供的记录，不能凭空编造数据\n2. 必须引用至少 2 条具体记录作为证据（如果数据足够）\n3. 引用时写出具体日期和内容\n4. 如果某一类数据为空或未启用，简要说明，不要笼统说全部不足\n5. 优先用短段落和清单表达，不要输出 markdown 表格\n6. 如果用户问题提到了某个具体日期，优先分析该日期的数据\n7. 回答后给出 ' + (prefs.suggestionCount || 2) + ' 条具体可执行的建议\n8. 体重为状态量，进行趋势分析时应综合"近30条体重记录"，不局限于当前分析范围\n9. 体重记录如标注"默认晨起空腹"或 07:00，按早晨称重解释，不要推断为晚间体重\n10. 输出先给结论和行动清单，控制篇幅并确保结尾完整；问题很大时优先覆盖关键判断，不展开无关背景\n' + buildToneInstructions(prefs.tone) + '。\n' + buildLengthInstructions(prefs.length) + '.' + buildFocusTag(prefs.focus, prefs.customNote);
            return { system: sys };
        }
    };

    function buildPromptMessages(taskId, vars, db) {
        var prefs = getPromptPrefs(taskId, db);
        var builder = SKELETON_BUILDERS[taskId];
        if (!builder) return null;
        var skeleton = builder(prefs);
        var messages = [];
        if (skeleton.system) {
            messages.push({ role: 'system', content: skeleton.system });
        }
        if (skeleton.user && vars) {
            messages.push({ role: 'user', content: applyTemplate(skeleton.user, vars) });
        }
        return { messages: messages, prefs: prefs, prefTags: skeleton.prefTags || '' };
    }

    window.dataAiTemplates = {
        DEFAULT_TEMPLATES,
        ensureDefaultTemplates,
        sanitizeTemplate,
        normalizeTemplates,
        applyTemplate,
        DEFAULT_PROMPT_PREFS,
        TASK_PREF_META,
        getPromptPrefs,
        resetPromptPrefs,
        resetAllPromptPrefs,
        isTaskCustomized,
        buildPromptMessages,
        buildToneInstructions,
        buildLengthInstructions,
        buildFocusTag,
        buildEstimateModeInstructions,
        buildPortionStyleTag,
        buildUncertaintyInstructions,
        buildConservatismTag,
        buildSplitStrategyTag,
        buildFormulaTag,
        buildOutputDetailTag,
        buildPlanStyleTag,
        buildRiskLevelTag,
        buildPlanDurationTag,
        buildNamingStyleTag,
        buildProgressionTag,
        buildStrictnessTag,
        buildInsightStyleTag,
        buildReportOutputStyleTag,
        buildCustomNoteSection
    };
})();
