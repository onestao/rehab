# AI 提示词偏好化重构

> 分支：`ui-mockup`（当前分支，不要创建新分支，不要 push）

---

## 背景

当前项目中 AI 功能的提示词（system prompt / user prompt）分散在多个文件中硬编码：

| 文件 | 硬编码 prompt 所在函数 | 用途 |
|---|---|---|
| `advice-prompt.js` | `buildAdviceMessages()` | 综合建议（用户对话型 AI） |
| `ai-api.js` | `parseFood()` | 食物文本识别 |
| `ai-api.js` | `parseFoodFromImage()` | 图片食物识别 |
| `ai-api.js` | `bodyGoalPlan()` | 体重目标计划（增肌/减重） |
| `plan-ai.js` | `buildPlanAiContext()` | 训练计划生成 |
| `health-profile.js` | `buildRehabWeeklyPrompt()` | 康复处方解析 |
| `food-log.js` | `requestFoodAliasGroups()` | 食物别名合并 |
| `advice-panel.js` | `requestInsightAiAdvice()` | 跨域建议 / 训练标签分类 |
| `history-view.js` | `contextAiPrompts()` | 快捷 AI 按钮 prompt |
| `weekly-summary.js` | `weeklyAiPrompt()` | 周总结 prompt |
| `report-panel.js` | `generateReport()` | 周报/月报生成 |

项目已有 `ai-templates.js` + `advice-template-manager.js` 作为模板系统的雏形，但只覆盖了综合建议场景，且 UI 是通用文本编辑器，不适合结构化偏好配置。

---

## 目标

1. 把所有 AI 功能的提示词统一走 **表单化偏好配置**，用户可以微调语气、重点、禁忌等参数，但不能修改整体 prompt 骨架和 JSON schema 约束。
2. 每个 AI 用途的偏好 UI 是**独立表单**（chip group / select / number / textarea），不是通用的 system+user 文本框。
3. 内置默认偏好永远存在，用户偏好只做覆盖，删除用户偏好后自动恢复默认。
4. 最终 prompt = **固定骨架 + guardrail 规则 + 用户偏好参数 + 运行时数据**。
5. 区分"用户对话型 AI"（综合建议、快捷问答等）和"结构化后台任务"（食物识别、训练计划、处方解析等），两者 UI 入口和编辑深度不同。

---

## 涉及范围

### 需要修改的文件

| 文件 | 改什么 |
|---|---|
| `ai-templates.js` | 新增 `DEFAULT_PROMPT_PREFS` 对象，定义每个用途的默认偏好；新增 `getPromptPrefs(taskId)` / `resetPromptPrefs(taskId)` / `buildPromptMessages(taskId, vars)` 函数 |
| `data-schema.js` | 在 `normalizeDb()` 中初始化 `db.aiPromptPrefs = {}`，确保它始终存在 |
| `advice-prompt.js` | `buildAdviceMessages()` 不再硬编码 system prompt，改为调用 `buildPromptMessages('advice_general', vars)` |
| `ai-api.js` | `parseFood` / `parseFoodFromImage` / `bodyGoalPlan` 改为从偏好系统取 prompt |
| `plan-ai.js` | `buildPlanAiContext()` 改为从偏好系统取骨架，schema 规则仍由代码固定注入 |
| `health-profile.js` | `buildRehabWeeklyPrompt()` 改为从偏好系统取 prompt |
| `food-log.js` | `requestFoodAliasGroups()` 改为从偏好系统取 prompt |
| `advice-panel.js` | `requestInsightAiAdvice()` 改为从偏好系统取 prompt |
| `history-view.js` | `contextAiPrompts()` 改为从偏好系统读取快捷 prompt |
| `weekly-summary.js` | `weeklyAiPrompt()` 改为从偏好系统读取 |
| `advice-template-manager.js` | 重写 UI：从通用模板编辑器改为按用途分组的偏好面板；旧的高级模板编辑器保留为可折叠的高级模式 |
| `routine-library.js` | AI 设置入口文案可能需要微调（如"AI 设置"改为"AI 设置 / 提示词偏好"） |

### 需要新增或修改的 CSS

| 文件 | 改什么 |
|---|---|
| `css-src/20-settings-ai.css` | 新增偏好面板、状态徽章、预览折叠区的样式 |
| `css-src/35-components-modal.css` | 现有 `template-manager-*` 样式可能需要适配新的面板结构 |

### 不动的文件

- `index.html`：现有 `aiTemplateManagerSheet` 结构可以复用，不需要大改。
- `sw.js`：不需要新增 JS 文件，只修改现有文件。
- `ai-store.js` / `ai-profile.js` / `ai-models.js`：模型配置逻辑不动。

---

## 分层设计

### 第一层：内置默认偏好（不可删除）

定义在 `ai-templates.js` 的 `DEFAULT_PROMPT_PREFS` 中，编译到代码里，不存用户数据。

```js
const DEFAULT_PROMPT_PREFS = {
  advice_general: {
    tone: 'coach',          // coach | professional | brief | encouraging | cautious
    length: 'standard',     // short | standard | detailed
    focus: ['training', 'diet', 'weight'],
    avoid: [],
    suggestionCount: 2,
    customNote: ''
  },
  food_parse_text: {
    estimateMode: 'moderate',    // conservative | moderate | generous
    portionStyle: 'common',      // chinese_home | fitness | takeout | custom
    uncertainty: 'estimate',     // skip | estimate | return_empty
    customNote: ''
  },
  food_parse_image: {
    conservatism: 'moderate',    // conservative | moderate | generous
    portionStyle: 'common',
    splitStrategy: 'by_dish',    // merge | by_dish | by_ingredient
    customNote: ''
  },
  body_goal_plan: {
    // 此用途输入全部来自表单数值，用户偏好空间有限
    formulaPreference: 'mifflin_st_jeor',   // harris_benedict | mifflin_st_jeor | auto
    outputDetail: 'standard',               // brief | standard | detailed
    customNote: ''
  },
  plan_generate: {
    planStyle: 'rehab_conservative',   // rehab_conservative | progressive | cut | bulk | maintain | custom
    riskLevel: 'low',                   // very_low | low | standard | moderate
    equipment: ['bodyweight'],
    avoidMovements: [],
    duration: '20-30',                  // 10-15 | 20-30 | 30-45 | custom
    planDensity: 'standard',            // sparse | standard | dense
    painThreshold: 4,                   // 3 | 4 | 5
    customNote: ''
  },
  rehab_weekly_parse: {
    namingStyle: 'common',        // common | clinical | both
    lowConfidenceThreshold: 80,   // 70 | 80 | 90
    painThreshold: 4,             // 3 | 4 | 5
    progressionStrictness: 'strict',  // strict | moderate
    customNote: ''
  },
  food_alias_merge: {
    strictness: 'moderate',       // strict | moderate | loose
    customNote: ''
  },
  insight_advice: {
    style: 'concise',             // concise | detailed | coach
    customNote: ''
  },
  weekly_report: {
    focus: ['completion', 'fatigue', 'deload'],
    outputStyle: 'coach',         // data | coach | brief
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
    // history-view.js 里的快捷按钮 prompt 也可以微调
    // 但结构化程度低，主要是 label + prompt 文本对
    customNote: ''
  }
};
```

### 第二层：用户偏好覆盖（可删除，删后恢复默认）

存在 `data.db.aiPromptPrefs` 中，和备份/同步一起走。

```js
db.aiPromptPrefs = {
  advice_general: {
    tone: 'encouraging',
    focus: ['protein', 'fatigue', 'rehab_safety'],
    customNote: '我更喜欢居家训练建议'
  },
  plan_generate: {
    avoidMovements: ['jumping', 'running', 'deep_squat'],
    painThreshold: 3,
    customNote: '左膝半月板损伤，避免深膝屈'
  }
};
```

取偏好时合并：

```js
const prefs = { ...DEFAULT_PROMPT_PREFS[taskId], ...(db.aiPromptPrefs?.[taskId] || {}) };
```

### 第三层：固定骨架 + guardrail（不可编辑）

每个用途的 prompt 骨架和安全/schema 约束由 `buildPromptMessages(taskId, vars)` 内部硬编码，用户不可见不可改。

例如 `food_parse_text` 的骨架：

```
System: 你是营养师助手。
        严格只返回 JSON 数组，不要 markdown，不要解释。
        每个元素格式：{"name":"食物名","grams":克数,"cal":kcal,"pro":g,"carb":g,"fat":g}
        {estimateModeInstructions}
        {uncertaintyInstructions}
        {customNoteSection}

User:   用户描述：{text}
```

`{estimateModeInstructions}` 等占位符根据用户偏好动态拼接，用户看到的是 chip/select，不是这段文字。

---

## UI 设计要求

### 入口

在 `advice-template-manager.js` 现有的模板管理器 sheet（`aiTemplateManagerSheet`）中改造。

### 普通模式（默认）

按用途分组，每个用途是一个可折叠的卡片：

```
AI 提示词偏好

┌─ 综合建议 ──────────────────────────────┐
│  [已自定义]                              │
│                                          │
│  回答语气  [专业] [简洁] [鼓励] [教练●]  │
│  回答长度  [简短] [标准●] [详细]         │
│  重点关注  [热量] [蛋白质●] [训练量●]    │
│            [疲劳●] [体重] [康复●]       │
│  避免内容  [术语] [高冲击●] ...          │
│  建议数量  [1] [2●] [3]                  │
│  自定义补充  [textarea____________]      │
│                                          │
│  [查看最终提示词预览 ▼]                  │
│  [恢复此用途默认设置]                    │
└──────────────────────────────────────────┘

┌─ 饮食识别（文本） ──────────────────────┐
│  [默认]                                  │
│  估算策略  [保守] [标准●] [偏高]         │
│  份量风格  [中国家庭●] [健身餐] ...      │
│  不确定时  [跳过] [合理估算●] [返回空]  │
│  自定义补充  [____________]              │
│  [查看最终提示词预览 ▼]                  │
│  [恢复此用途默认设置]                    │
└──────────────────────────────────────────┘

...（其余用途同理）

底部：
[全部恢复默认]  [导出偏好]  [导入偏好]
```

### 高级模式（折叠/开关）

在普通模式顶部加一个开关：

```
[ ] 启用高级提示词编辑
```

打开后，每个用途卡片底部额外显示：

```
┌─ System Prompt 预览（只读） ────────────┐
│  你是营养师助手。严格只返回 JSON 数组... │
│  ...                                     │
└──────────────────────────────────────────┘
```

以及整个面板底部显示"高级模板编辑"按钮，点击展开旧的 `renderTemplateManagerContent()` UI（现有代码），但标注为"实验性：修改可能导致功能异常"。

### 按钮逻辑

- **恢复此用途默认设置**：`delete db.aiPromptPrefs[taskId]`，然后 `data.save()` 和刷新 UI。
- **全部恢复默认**：`db.aiPromptPrefs = {}`，然后 `data.save()` 和刷新 UI。
- **导出偏好**：导出 `db.aiPromptPrefs` 为 JSON 文件。
- **导入偏好**：读取 JSON 文件，合并到 `db.aiPromptPrefs`（不覆盖用户未改过的字段，或者提供合并/覆盖选项）。
- **查看最终提示词预览**：折叠/展开只读预览区，显示 `buildPromptMessages()` 拼接后的完整 prompt（运行时变量用 `{placeholder}` 显示）。

---

## 自查清单（agent 容易忽略的问题）

执行过程中和完成后，请逐项检查：

### 数据层

- [ ] `data-schema.js` 的 `normalizeDb()` 是否初始化了 `db.aiPromptPrefs = {}`？
- [ ] `ensureDefaultTemplates()` 逻辑是否仍然正确（不要因为重构而破坏现有的 `db.aiTemplates` 初始化）？
- [ ] 合并偏好时是否正确 fallback：`{ ...DEFAULT_PROMPT_PREFS[taskId], ...(db.aiPromptPrefs?.[taskId] || {}) }`？
- [ ] 用户偏好为空对象 `{}` 时，是否能正确 fallback 到默认值（而不是产生空 prompt）？

### Prompt 骨架

- [ ] 每个用途的 JSON schema 约束是否**仍然硬编码在骨架中**，没有被用户偏好覆盖掉？
- [ ] `parseFood` / `parseFoodFromImage` 的输出格式 `[{"name":"...","grams":0,...}]` 是否完整保留？
- [ ] `bodyGoalPlan` 的 JSON 结构（conservative/moderate/aggressive 或 fast/moderate/slow）是否完整保留？
- [ ] `buildPlanAiContext` 的 `specRules`（sets/reps/work/mode 等 schema 要求）是否完整保留？
- [ ] `buildRehabWeeklyPrompt` 的 JSON 结构（actions/status/spec 等）是否完整保留？
- [ ] 所有 `"不要 markdown"` / `"只返回 JSON"` / `"不要解释"` 这类 guardrail 是否**不可被用户配置删除**？

### 安全规则

- [ ] `buildAdviceMessages()` 中的健康档案优先级规则（"用户健康档案为最高优先级"）是否保留在骨架中？
- [ ] `buildRehabWeeklyPrompt()` 中的"不要编造用户没提到的动作"是否保留？
- [ ] `requestInsightAiAdvice()` 中的"只基于数据"规则是否保留？
- [ ] 所有涉及 `escapeHtml` / `renderSafe` 的地方是否仍然正确转义用户输入？

### 加载顺序与模块

- [ ] 如果新增了 JS 文件，是否已加入 `index.html` 的 `<script>` 顺序？
- [ ] 新增的 JS 文件是否符合项目模块规范（IIFE + `window` 挂载，或者纯函数 export）？
- [ ] `advice-template-manager.js` 的加载顺序是否仍然在 `ai-templates.js` 之后？（检查 `index.html` 中的 `loadOrder` 对象）

### CSS

- [ ] CSS 改动后是否运行了 `npm run build:css`？
- [ ] 新增的 CSS 规则是否放在了正确的文件中（`20-settings-ai.css` 或 `35-components-modal.css`）？
- [ ] 是否运行了 `npm run check:css` 检查 section markers 和 overlap？
- [ ] 是否使用了项目的 CSS 变量（`--md-sys-*` / `--glass-*`）而不是硬编码颜色值？
- [ ] 是否检查了 `99-custom-overrides.css` 是否需要清理？

### 测试与验证

- [ ] 是否运行了 `npm run ci`？（lint + typecheck + test + check:css + size-limit）
- [ ] 现有测试是否全部通过？特别是 `test/ai-templates.test.mjs` 和 `test/plan-ai.test.mjs`。
- [ ] 如果修改了 `buildPromptMessages` 的签名或行为，是否更新了相关测试？
- [ ] `buildAdviceMessages()` 修改后，是否确认 `advice-prompt.js` 的调用方（`requestAiAdvice`、`sendAiAdvice` 等）仍然正常工作？

### 用户体验

- [ ] 偏好面板在移动端（360px 宽）是否可用？chip 是否换行而不是溢出？
- [ ] 恢复默认后，UI 是否立即刷新显示默认状态（而不是需要重新打开面板）？
- [ ] 导出/导入偏好后，是否有 toast 提示？
- [ ] "已自定义" / "默认" 状态徽章是否正确反映 `db.aiPromptPrefs` 中有无该用途的覆盖？
- [ ] 高级模式开关关闭后，是否隐藏了所有高级编辑区域？

### 边界情况

- [ ] 用户从未配置过 AI（`ai.cfg.enabled === false`）时，偏好面板是否仍然可访问且不报错？
- [ ] 用户清空所有数据（`data.db = {}`）后重新打开，偏好系统是否能正确初始化？
- [ ] 从旧版本升级（`db.aiPromptPrefs` 不存在）时，是否兼容？
- [ ] 导入损坏的偏好 JSON 时，是否有错误处理而不是白屏？

---

## 验收标准

1. 所有 AI 功能的 prompt 都通过 `buildPromptMessages(taskId, vars)` 或类似统一入口获取，业务代码中不再有内联的完整 prompt 字符串（允许保留占位符变量拼接）。
2. AI 设置页有一个按用途分组的偏好面板，每个用途的表单字段不同，普通用户不能编辑 prompt 骨架。
3. 恢复默认后，所有偏好参数回到 `DEFAULT_PROMPT_PREFS` 中定义的值。
4. `npm run ci` 全部通过。
5. 未推送到 GitHub。

---

## 不需要做的事

- 不需要创建新的 git 分支。
- 不需要推送到 GitHub。
- 不需要改动 `ai-store.js` / `ai-profile.js` / `ai-models.js`（模型配置逻辑）。
- 不需要改动 TTS / voice engine 的模板系统（`voice-engine.js` 的 `renderTemplate` 是独立的）。
- 不需要改动 `advice-rules.js` 中的本地离线规则。
- 不需要给每个用途都做"查看最终提示词预览"，可以先做 3-5 个高频用途，其余后续补充。
- 不需要做完整的端到端测试（没有真实的 AI API 可调用），只需要确保 prompt 拼接逻辑正确。
- 不需要改动备份/同步的底层逻辑，`db.aiPromptPrefs` 会自动跟随 `data.db` 走现有同步路径。

---

## 参考：项目关键约定（摘自 AGENTS.md）

- Runtime modules 用 IIFE + `window` 挂载。
- 新增 browser-facing JS 必须加入 `index.html` 加载顺序和 `sw.js` precache。
- CSS 源在 `css-src/`，改 CSS 后跑 `npm run build:css`。
- 所有涉及 sync / data persistence / AI 的改动必须过 `npm run ci`。
- 不要把 untrusted string 直接插 innerHTML，用 `escapeHtml` 或 `textContent`。
- 数值前缀分组：`20..32` 为 settings/features，新样式沿用现有文件。
