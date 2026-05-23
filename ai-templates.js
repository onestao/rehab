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

    window.dataAiTemplates = {
        DEFAULT_TEMPLATES,
        ensureDefaultTemplates,
        sanitizeTemplate,
        normalizeTemplates,
        applyTemplate
    };
})();
