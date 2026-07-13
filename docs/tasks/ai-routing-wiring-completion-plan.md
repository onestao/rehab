# AI 功能路由与模型控件闭环实施计划

> 日期：2026-07-12  
> 状态：实现与自动验收完成，待人工分批提交/合并  
> 当前主实现分支：`perfrom`  
> 对照分支：`ui-mockup`  
> 编写依据：`perfrom@b5e4da1`、`ui-mockup@80e00fe`、共同基线 `facaf9b`  
> 目标：把已经存在于界面、任务注册表和设计文档中的 AI 模型路由能力完整接到实际请求、失败恢复和跨分支 UI 上。

## 1. 背景与审计结论

当前应用已经具备任务级模型路由、推理深度、备用模型、自动回退、内联模型选择、模型收藏、报告多版本和供应商管理等基础能力。两条分支的自动化测试均通过，共计 404 项，但测试通过只说明现有单元行为没有回归，不能证明跨模块交互已经闭环。

本次审计确认以下能力仍处于“已设计、已出现于 UI 或数据结构中，但只接入一部分运行路径”的状态：

1. 手动备用模型重试只在体重报告和周/月总结中提供操作入口。
2. AI 教练使用独立模型选择器，没有写入或消费任务级最近使用模型记录。
3. 任务注册表中的 `requiredCapabilities`、`localPicker`、`group` 没有真正驱动 UI 行为。
4. `perfrom` 的模型 `family` 可以录入，也有按 family 分组的 UI，但 `listSelectableModels()` 没有透传该字段。
5. `ui-mockup` 尚未同步共享模型视觉模块、切换成功提示和当前分支的推理兼容策略。
6. `ui-mockup` 的推理菜单始终展示全部强度，但请求构造层可能在发出请求前拒绝这些已保存选项。

这些问题的共同根因不是缺少底层 AI API，而是路由元数据、UI 状态和具体任务入口之间仍存在多套适配逻辑。

## 2. 本次实施目标

### 2.1 必须完成

1. 所有注册任务都能在主模型失败且未启用自动回退时，提供明确、可执行的一次性备用模型重试。
2. 一次性备用模型重试不得修改用户保存的主模型、备用模型或自动回退设置。
3. AI 教练与通用任务选择器共享收藏和最近使用数据语义。
4. `family`、`group`、`localPicker`、`requiredCapabilities` 不再是无效元数据。
5. 能力元数据不可靠时继续尊重用户选择，但 UI 必须区分“确认兼容”“确认不兼容”“能力未知”。
6. `perfrom` 完成后，以小提交方式同步 `ui-mockup`，不得直接整分支覆盖。
7. 两条分支均通过完整 CI、size-limit、版本检查和移动端视觉验证。

### 2.2 明确不做

1. 不新增后端、数据库服务或 bundler。
2. 不改变 API Key 的现有保存、加密或同步路径。
3. 不把能力元数据改成绝对硬过滤；OpenAI 兼容端点的元数据经常不完整。
4. 不自动把备用模型提升为新的主模型。
5. 不持久化原始图片 `File`、Blob、图片 base64 或凭据到 `data.db`、localStorage、日志或同步数据。
6. 不在本次工作中重做供应商管理器整体视觉。
7. 不顺手合并两条分支的其他性能、饮食或布局差异。

## 3. 目标行为契约

## 3.1 主模型、自动回退与手动回退

请求行为必须遵守以下状态机：

| 路由状态 | 主模型失败且尚未输出内容 | 期望行为 |
|---|---|---|
| 无备用模型 | 任意可重试错误 | 显示普通错误，不显示无效操作 |
| 有备用模型，`fallbackMode=manual` | 任意可重试错误 | 停止请求，显示“使用备用模型重试” |
| 有备用模型，`fallbackMode=automatic` | 任意可重试错误 | 现有 `ai.run()` 自动切换逻辑继续执行 |
| 已经输出流式内容 | 后续失败 | 不自动或手动切换模型，保留部分结果 |
| 用户取消 | 任意阶段 | 不显示备用模型操作 |
| JSON 解析失败 | 请求已经成功返回完整文本 | 默认不自动切换；是否允许手动重试由具体任务明确决定 |

补充约束：

- 手动重试通过 `routeOverride` 指向备用模型。
- `routeOverride` 只作用于当前一次请求。
- 重试成功后的结果元数据必须记录实际使用的 `profileId`、`modelId` 和 fallback 状态。
- 同一错误操作只能触发一次并受现有 busy/sending 状态保护。
- 错误对象或持久化记录中只能保存安全模型引用 `{ profileId, modelId }`，不得保存 API Key、Base URL 中的凭据参数或完整请求头。

## 3.2 模型能力兼容状态

任务定义的 `requiredCapabilities` 改为驱动“兼容性提示”，而不是硬过滤：

| 状态 | 判定 | UI |
|---|---|---|
| `compatible` | 所有必需能力明确为 `true` | 正常展示 |
| `incompatible` | 至少一个必需能力明确为 `false` | 展示警告标记；选择时二次确认 |
| `unknown` | 至少一个必需能力缺失或未识别，且没有明确 false | 展示“能力未验证”，允许直接选择 |

例如：

- `food.vision` 需要 `vision + json`。
- 模型 `vision=false` 时标记为不兼容，但不从列表中隐藏。
- 模型只有 `vision=true`、没有 `json` 字段时标记为未知，而不是不兼容。
- 自定义 OpenAI 兼容端点仍允许用户覆盖元数据判断。

## 3.3 最近使用与收藏

统一使用现有键，不新增重复存储：

- 收藏：`rehab.ai.modelFavorites.v2`
- 最近使用：`rehab.ai.modelRecents.v1`

行为规则：

1. 最近使用按 `taskId` 隔离。
2. 模型唯一键固定为 `profileId::modelId`。
3. 每个任务最多保留 3 个最近模型。
4. 收藏优先于最近使用；同一模型不能在两个区段重复出现。
5. `advice.chat` 与 `advice.vision` 分别记录最近使用。
6. 删除供应商或模型后，旧最近记录可以惰性清理，不得导致选择器报错。

## 3.4 任务注册表

注册表字段确定为以下语义：

| 字段 | 实施后用途 |
|---|---|
| `id` | 请求路由、持久化和选择器宿主标识 |
| `label` | 设置页和错误提示名称 |
| `group` | 设置页分组标题和排序 |
| `defaultReasoningDepth` | 默认推理深度 |
| `requiredCapabilities` | 兼容状态和警告文案 |
| `localPicker` | 控制该任务是否允许挂载页面内联选择器 |

`localPicker` 不负责自动猜测插入位置。各领域页面仍显式提供 `data-ai-task-picker` 宿主，但 `mountInlinePicker()` 必须检查注册表权限，避免任意任务被误挂载。

## 4. 设计方案

## 4.1 保持现有模块边界

本次不新增大型 facade。职责分配如下：

- `ai-routing-pure.mjs`：纯兼容性计算、备用引用规范化。
- `ai-routing.js`：任务定义、可选模型数据透传、一次请求路由解析。
- `ai-api.js`：执行请求、产生统一的 `aiFallback` 错误元数据。
- `ai-task-settings.js`：共享收藏/最近使用适配、设置页分组、内联选择器。
- 各领域适配器：保留具体请求输入，并决定如何展示和执行重试。
- `advice-panel.js`：AI 教练消息、附件和失败气泡的特殊处理。

不建议新建全局 `ai-fallback-ui.js`。每个任务的重试参数和生命周期差异较大，强行抽成一个自动重放器会隐藏图片、流式消息、计划预览和表单状态差异。可以共享纯 helper 和 toast 配置，但重试闭包由各领域适配器拥有。

## 4.2 新增纯 helper

在 `ai-routing-pure.mjs` 增加以下纯函数，名称可在实现时微调，但职责不能变化：

```js
normalizeModelRef(value)
// -> { profileId, modelId } | null

requiredCapabilityState(requiredCapabilities, modelCapabilities)
// -> { status, missing, incompatible }

manualFallbackTarget(errorLike)
// -> { profileId, modelId } | null
```

要求：

- 忽略对象上的未知字段。
- 返回新对象，不能共享原始引用。
- 对原型污染键、数组、字符串和畸形对象安全失败。
- helper 不访问 DOM、localStorage、toast 或 `window.data`。

## 4.3 统一一次性重试参数

所有支持 AI 请求的上层方法统一接受可选参数：

```js
{
  routeOverride: { profileId, modelId } | null,
  retrySource: 'manual-fallback' | '',
  suppressDuplicateInput: boolean
}
```

不要求所有函数使用完全相同的形参位置，但调用链必须完整透传到 `ai.run()` 或 `ai.runStream()`。

## 5. 分阶段实施

## 阶段 0：建立红灯测试

### 目标

先把当前缺口变成失败测试，避免实施过程中只验证字符串存在。

### 新增或扩展测试

1. `test/ai-routing.test.mjs`
   - 能力状态三分法。
   - 畸形能力对象安全处理。
   - 手动 fallback 引用只保留两个允许字段。
2. `test/ai-routing-runtime.test.mjs`
   - `listSelectableModels()` 透传 `family`。
   - 返回模型包含 `capabilityState` 或等价字段。
   - `localPicker=false` 不允许内联挂载。
3. `test/ai-task-settings.test.mjs`
   - 设置页按 `group` 分组。
   - 最近记录按任务隔离、去重并限制 3 项。
   - family 分组不再全部显示为“其他”。
4. `test/advice-model-picker-swipe.test.mjs` 或新的 advice picker 测试
   - AI 教练切换模型会记录最近使用。
   - 收藏、最近、普通模型不重复。
5. 各领域现有测试中增加 `routeOverride` 断言。

### 完成标准

至少有一组测试能在当前代码上稳定失败，并准确指出每个断链点。

## 阶段 1：接通注册表与模型元数据

### 修改 `ai-routing.js`

1. `listSelectableModels(taskId)`：
   - 获取任务定义。
   - 透传模型 `family`、`capabilities`、`iconKey`、`displayName`。
   - 计算兼容状态。
   - 保持当前“用户可选择能力不匹配模型”的产品决策。
2. 不恢复旧的 provider-only 模型去重；继续使用 `profileId::modelId`。
3. 供应商禁用、归档、缺少 API Key 的模型继续排除。

### 修改 `ai-task-settings.js`

1. `render()` 按任务定义 `group` 输出分组容器和标题。
2. `mountInlinePicker()` 读取任务定义并检查 `localPicker`。
3. 模型行显示：
   - `incompatible`：警告图标和缺失能力文案。
   - `unknown`：低强调“能力未验证”。
4. 选择明确不兼容模型时使用应用现有确认交互；不得静默拦截。
5. family 分组键使用 `供应商 · family`；空 family 才使用“其他”。

### 修改 `ai-provider-manager.js`

1. 手动模型能力标签继续保存为布尔能力对象。
2. 对输入标签执行 trim、去重和允许字符规范化。
3. 模型 family 保持原值，不在显示层改写模型身份。
4. 修改模型后触发任务选择器刷新。

### 验收

- `food.vision` 中明确无视觉能力的模型仍可见，但有清晰警告。
- 未知模型不会被错误隐藏。
- 设置页出现“建议 / 饮食 / 训练计划 / 健康目标 / 周期总结 / 后台分析”分组。
- 自定义 family 在快速模型抽屉中正确显示。

## 阶段 2：统一收藏与最近使用

### 修改 `ai-task-settings.js`

将以下内部函数作为稳定的小接口暴露到 `window.aiTaskSettings`：

```js
modelKey(model)
favoriteKeys()
recentKeysForTask(taskId)
rememberRecent(taskId, model)
```

暴露时仍返回副本或新集合，避免调用者修改内部状态。

### 修改 `advice-panel.js`

1. `chooseAdviceModel()` 保存成功后调用 `rememberRecent(taskId, modelRef)`。
2. `renderAdviceModelPicker()` 在每个范围页内按以下顺序渲染：
   - 收藏模型。
   - 当前 task 的最近模型。
   - 其余模型，按连接和 family 分组。
3. 当前模型仍显示选中状态，即使它同时属于收藏或最近。
4. `advice.chat` 与 `advice.vision` 根据当前附件状态使用各自最近记录。
5. 切换成功 toast 保持当前分支行为。

### 数据迁移

不增加迁移版本。读取时兼容旧的 provider 级收藏键，写入时只写 `profileId::modelId`。

### 验收

- 从 AI 教练选择模型后，设置页和其他内联选择器能看到同一任务的最近记录。
- 删除或归档模型后不会出现无法点击的空壳最近项。
- 收藏切换在 AI 教练和设置页立即同步。

## 阶段 3：接通所有手动备用模型重试

## 3A. 底层参数透传

### `ai-api.js`

1. `parseFood(text, opts = {})` 接受并透传 `routeOverride`。
2. `parseFoodFromImage(file, opts = {})` 保持现有接口并验证 `routeOverride` 透传。
3. `bodyGoalPlan(params, opts = {})` 或等价兼容签名透传 `routeOverride`。
4. `weightLossPlan()` 同步透传。
5. 不改变 `ai.run()` 当前自动回退序列和“已输出内容后不回退”规则。

### 统一错误结构

`ai.run()` 继续在满足手动回退条件时设置：

```js
error.aiFallback = {
  taskId,
  target: { profileId, modelId }
}
```

在设置前通过纯 helper 规范化 target，避免多余字段进入 UI 或持久化数据。

## 3B. AI 教练

### `advice-panel.js`

1. `sendAiAdvice(promptOverride, options)` 新增 `routeOverride` 和 `attachmentsOverride` 支持。
2. 解析当前有效模型时同时使用 `routeOverride`，保证消息元数据显示实际备用模型。
3. 文本请求、视觉请求和自动续写均明确决定是否继承 override：
   - 初次备用重试继承 override。
   - 同一回答的自动续写继续使用相同 override。
4. 主请求失败且存在 `aiFallback.target` 时：
   - 失败记录保存安全的 fallback target。
   - 渲染“使用备用模型重试”操作。
   - 重试使用 `skipUserMessage`，不能重复插入用户问题。
5. 图片附件：
   - 仅在内存中按失败消息 ID 暂存原始附件对象。
   - 不写入 `data.db`、localStorage 或同步数据。
   - 重试成功、删除消息、切换会话或超时后释放引用。
   - 页面刷新后若附件已丢失，按钮改为“重新附图并用备用模型”，不得假装可以无图重试。
6. 已产生部分输出、主动停止或自动续写失败时不显示备用重试。

### 安全要求

- 失败操作使用委托事件和安全 `data-*` 属性。
- 不把模型引用直接拼接到可执行 `onclick` 字符串。
- 模型名和供应商名继续经过 `escapeHtml`。

## 3C. 饮食文字与照片识别

### `food-log.js`

1. `aiParseFood(options = {})` 保存本次文本并把 `routeOverride` 传给 `ai.parseFood()`。
2. 捕获 `aiFallback.target` 后显示 toast 操作。
3. 重试期间复用现有 busy/status UI，不重复清空用户输入。

### `health-diet.js`

1. `handleDietPhoto(file, options = {})` 接受 `routeOverride`。
2. 失败 toast 的操作闭包保留当前 `File`，在 toast 有效期内可直接备用重试。
3. 重试重新创建 AbortController，不能复用已经 aborted 的 controller。
4. 备用模型成功后按实际模型清除视觉失败缓存；不能错误清除主模型缓存。
5. 取消操作不显示 fallback。

## 3D. 今日/一周计划与自动调整

### `plan-ai.js`

1. `submitPlanAi(mode, options = {})` 接受 `routeOverride`。
2. 失败时保留用户已选计划类型、病症、临时条件和输入说明。
3. toast 操作调用同一提交方法并传备用引用。
4. 备用重试不得创建第二个预览容器或覆盖用户已编辑预览。

### `plan-auto-adjust.js`

1. 自动调整执行方法接受 `routeOverride`。
2. 手动模式失败后显示“使用备用模型重试明日调整”。
3. 重试前重新检查目标日期、受保护计划和当前完成状态，不能复用过期写入快照。
4. 自动回退模式保持现有静默重试加明确提示行为。

## 3E. 身体目标

### `goal-plan.js`

1. `requestWeightLossPlan(options = {})` 透传 `routeOverride`。
2. 重试时重新读取当前表单值；如果用户在错误后修改了体重或目标，应使用新值。
3. 备用重试不改变保存的任务路由。

### `ai-api.js`

`bodyGoalPlan()` 返回结构解析失败时，错误需要保留可判断的 code。是否显示备用操作按以下规则：

- HTTP/网络/限流等可重试错误：显示。
- 返回完整但 JSON 不合法：默认显示“使用备用模型重新生成”，因为该任务要求严格结构化输出。
- 本地参数缺失：不显示。

## 3F. 快速洞察

### `advice-panel.js`

1. `requestInsightAiAdvice(options)` 接受 `routeOverride`。
2. 缓存键必须包含实际模型身份，避免备用模型结果错误复用主模型缓存。
3. 失败时 toast 提供备用操作；重试成功后正常写入当日缓存。

## 3G. 报告与总结已有实现收敛

### `report-panel.js`、`weekly-summary.js`

1. 保留现有手动备用重试行为。
2. 改用统一的 fallback target 规范化 helper。
3. 补测一次性 override 不修改任务持久化路由。
4. 防止多次点击 toast action 生成重复版本。

## 阶段 4：同步 `ui-mockup`

`ui-mockup` 与 `perfrom` 已有大量等价但 commit hash 不同的提交，禁止直接 merge 整条分支或按文件覆盖 85 个差异文件。

### 同步策略

1. 在 `perfrom` 完成阶段 0–3 并通过 CI。
2. 每个阶段形成独立、小范围提交。
3. 在 `ui-mockup` 工作树逐个 cherry-pick 或生成目标文件 patch。
4. 每次只解决当前提交的冲突，不借机同步无关性能代码。
5. `advice-panel.js`、`ai-task-settings.js`、`index.html`、`sw.js` 必须人工审阅冲突。

### `ui-mockup` 额外任务

1. 引入 `ai-model-visual.js`。
2. 加入 `index.html` 的 lazy dependency 和 prerequisite。
3. 加入 `sw.js` 预缓存和版本号。
4. `ai-task-settings.js` 从首字母色块改为共享模型视觉。
5. `advice-render.js` 和 AI 教练选择器改用共享 resolver。
6. 模型切换后补充成功 toast。
7. 移除输入栏模型按钮里的恢复默认 `×`；恢复默认只保留在完整抽屉。
8. 将推理行为与 `perfrom` 对齐：显式用户选择不因不完整能力元数据被本地提前拒绝，但 UI 显示兼容警告。

### 同步后的边界

`ui-mockup` 可以继续保留旧的内联供应商管理布局；本次不强制迁移到 `ai-provider-manager.js`。模型视觉、任务路由语义、最近使用和 fallback 行为必须一致。

## 阶段 5：清理重复与死代码

完成行为闭环后再清理，不能在红灯测试建立前先删代码。

### 候选清理项

1. `advice-panel.js` 中已被 `ai-model-visual.js` 替代的品牌识别 helper。
2. 只服务旧模型选择器的 provider-only key 兼容代码；保留必要读取迁移层。
3. 重复的 fallback toast 配置。
4. 不再使用的 `setAdviceModel()` 旧入口，确认无动态调用后删除。
5. 任务注册表字段的重复说明和过期计划状态。

### 清理原则

- 先用 CodeGraph 查看 callers/impact。
- 动态 HTML、全局 `window` 方法和测试加载入口不能只凭文本搜索判定无用。
- 每次删除后运行最相关测试。

## 6. 文件级修改清单

| 文件 | 计划修改 |
|---|---|
| `ai-routing-pure.mjs` | 能力状态、模型引用和 manual fallback 纯 helper |
| `ai-routing.js` | 透传 family、计算兼容状态、连接任务定义 |
| `ai-api.js` | food/body goal override 透传、统一安全 fallback error |
| `ai-task-settings.js` | 分组、兼容提示、共享最近记录、localPicker guard |
| `ai-provider-manager.js` | family/能力输入规范化及刷新 |
| `advice-panel.js` | AI 教练最近模型、文本/图片 fallback 重试、快速洞察重试 |
| `advice-render.js` | 必要的失败操作和共享视觉适配 |
| `food-log.js` | 文字识别 fallback 重试 |
| `health-diet.js` | 照片识别 fallback 重试和 File 生命周期 |
| `plan-ai.js` | 今日/一周计划 override 与重试 |
| `plan-auto-adjust.js` | 明日调整 override 与重新校验 |
| `goal-plan.js` | 身体目标 override 与表单重读 |
| `report-panel.js` | 统一已有 fallback helper、去重保护 |
| `weekly-summary.js` | 统一已有 fallback helper、去重保护 |
| `index.html` | 仅 `ui-mockup` 新增共享视觉加载时修改 |
| `sw.js` | 仅脚本/资产加载变化时更新预缓存与版本 |
| `css-src/20-settings-ai.css` | 任务分组、能力状态、模型区段样式 |
| `css-src/48-advice-model-picker.css` | 收藏/最近/family 区段和警告样式 |
| `build/generated.css` | CSS 构建产物 |
| `build/css-dedup-report.txt` | CSS 构建产物 |
| `build/css-overlap-report.txt` | CSS 检查产物 |

## 7. 测试计划

## 7.1 纯逻辑测试

1. 能力状态：true、false、缺失、空对象、错误类型。
2. 模型 ref：重复字段、恶意键、空 ID、跨 profile 同名模型。
3. 最近记录：任务隔离、顺序、上限、去重、失效模型。
4. family：手动模型、发现模型、空 family。
5. 自动和手动 fallback 序列保持不可变。

## 7.2 任务级测试矩阵

| 任务 | 主模型错误 | 手动备用 | 自动备用 | 无备用 | 取消/部分输出 |
|---|---:|---:|---:|---:|---:|
| `advice.chat` | 必测 | 必测 | 必测 | 必测 | 必测 |
| `advice.vision` | 必测 | 必测 | 必测 | 必测 | 必测 |
| `food.text` | 必测 | 必测 | 必测 | 必测 | 不适用 |
| `food.vision` | 必测 | 必测 | 必测 | 必测 | 必测取消 |
| `plan.today` | 必测 | 必测 | 必测 | 必测 | 不适用 |
| `plan.week` | 必测 | 必测 | 必测 | 必测 | 不适用 |
| `plan.adjust` | 必测 | 必测 | 必测 | 必测 | 必测过期状态 |
| `goal.body` | 必测 | 必测 | 必测 | 必测 | 必测表单变化 |
| `summary.weekly/monthly` | 回归 | 回归 | 回归 | 回归 | 防重复版本 |
| `report.weight.*` | 回归 | 回归 | 回归 | 回归 | 防重复版本 |
| `insight.quick` | 必测 | 必测 | 必测 | 必测 | 缓存隔离 |

## 7.3 安全测试

1. fallback 的 profile/model ID 包含引号、HTML 和事件字符串时不能执行。
2. 模型名称、family、group 和能力标签均视为不可信字符串。
3. 不新增未审计的 `innerHTML` 或 `insertAdjacentHTML` sink。
4. 错误日志中没有 API Key、Authorization、完整凭据 URL。
5. 图片 File 不进入序列化数据和同步快照。

## 7.4 视觉 QA

至少验证以下视口：

- `430 x 932`
- `390 x 844`
- `360 x 800`
- 桌面宽屏

截图状态：

1. 设置页任务分组。
2. 兼容、未知、不兼容三类模型行。
3. AI 教练收藏、最近、普通模型区段。
4. 手动 fallback toast 和失败气泡操作。
5. 图片失败后的即时重试与刷新后退化状态。
6. 浅色、暗色、减少动效。

## 7.5 必跑命令

每条分支均执行：

```bash
npm run build:css
npm run check:css-overlap
node scripts/bump-version.js --check
npm run ci
npx --yes size-limit
```

如果 `perfrom` 未改变脚本加载顺序，仍需执行版本检查，但不应无理由新增预缓存项。`ui-mockup` 引入 `ai-model-visual.js` 后必须同步修改 `index.html` 与 `sw.js`。

## 8. 验收清单

### 功能

- [x] 所有 13 个注册任务的请求入口均能消费任务路由。
- [x] 所有适用任务均提供手动备用模型操作。
- [x] 手动重试不持久化覆盖主模型。
- [x] 自动回退行为无回归。
- [x] 已输出内容后不跨模型拼接回答。
- [x] AI 教练最近使用按 chat/vision 分离。
- [x] family 在设置和 AI 教练选择器中正确分组。
- [x] group、localPicker、requiredCapabilities 有可测试行为。
- [x] `ui-mockup` 使用共享模型视觉并显示切换成功提示。

### 数据与安全

- [x] 不新增数据 schema 迁移。
- [x] 不持久化图片 File、Blob、base64 或原始附件对象。
- [x] 不记录或同步凭据。
- [x] 所有新动态文本安全渲染。

### 工程

- [x] CSS 源和生成产物一致。
- [x] `perfrom` 完整 CI 通过；`ui-mockup` 因位于 `.worktrees/` 被 ESLint 默认忽略，已逐项运行等效门禁并对变更 JS 使用 `eslint --no-ignore`。
- [x] size-limit 仅按用户在 2026-07-13 的明确授权做最小上调，未以提高阈值掩盖超限。
- [x] Service Worker 版本和资源列表一致。
- [x] 非本计划 UI/CSS 与 Advice 附件视觉差异已由用户确认为其本人修改，均保留且不视为越权。

## 9. 建议提交顺序

建议使用以下小提交，便于切换模型后继续执行，也便于向 `ui-mockup` 定向同步：

1. `test: cover AI routing wiring gaps`
2. `feat: connect task capability metadata`
3. `feat: share task model recents`
4. `feat: add manual fallback retries`
5. `refactor: remove duplicate AI picker adapters`
6. `feat: align ui mockup AI routing controls`
7. `docs: record AI routing closure verification`

不要把 CSS 构建产物、Service Worker 版本和所有功能逻辑压进一个提交。

## 10. 实施者开工前检查

切换模型或恢复任务后，先执行：

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse ui-mockup
git merge-base HEAD ui-mockup
```

然后确认：

1. 当前工作树没有用户未提交改动，或已明确哪些文件不能覆盖。
2. 本计划记录的 commit 只用于历史背景，不假设分支仍停留在相同 hash。
3. 先运行最小相关测试，再开始阶段 0。
4. 每完成一个阶段更新本文件状态和验收勾选项。
5. 若发现任务注册表或供应商模型 schema 已变化，先更新计划，再修改运行代码。

## 11. 关键风险与缓解

### 风险 1：视觉请求无法持久化重试附件

缓解：附件只保留短期内存引用；刷新后明确要求重新附图，不伪造无附件重试。

### 风险 2：手动 fallback 造成重复记录或版本

缓解：所有重试入口复用现有 pending/version 身份，并增加 busy 和 action once guard。

### 风险 3：能力元数据误判自定义端点

缓解：只提示和确认，不硬过滤；显式用户选择继续交给 provider 验证。

### 风险 4：两分支大量重复提交导致冲突

缓解：先在 `perfrom` 形成小提交，按阶段定向同步，不整分支合并。

### 风险 5：新增 UI 文案扩大 HTML 安全面

缓解：优先 DOM API 和 `textContent`；必须模板化时统一 escape，并扩展安全测试。

### 风险 6：Service Worker 缓存旧脚本

缓解：任何加载顺序或新增资产变化都执行版本检查并同步预缓存列表。

## 12. 完成定义

只有同时满足以下条件，本计划才可标记为“已实施”：

1. 计划中的行为契约均有自动化测试。
2. 两条分支都能完成手动备用模型闭环。
3. AI 教练和通用选择器共享最近使用语义。
4. 任务注册表不再包含完全无效的声明字段。
5. `ui-mockup` 不再保留已被当前设计否决的模型按钮 `×` 和无提示切换。
6. 两条分支的完整 CI、size-limit、CSS 检查和版本检查全部通过。
7. 移动端关键状态经过实际视觉验证。
8. 没有引入后端、bundler、凭据泄漏或图片持久化。

## 13. 实际执行与验收记录

### 13.1 分支与工作树

- 主实现工作树：`perfrom@b5e4da1cfe87e414642f2464ad8a3e46a3de28cf`，当前改动尚未提交。
- 同步工作树：`ui-mockup@80e00fe36febfa38ee224f00be254d502fad41d8`，位于 `.worktrees/ui-mockup-fix`，当前改动尚未提交。
- 共同基线：`facaf9b7cc6ce836e8f1d080396b98abb4aa58fb`。
- 未执行整分支 merge、整文件 ours/theirs 覆盖或自动冲突选择；同步采用阶段化小 patch。
- 用户现有 UI/CSS、Advice 附件视觉和 model-chip 修改均作为受保护基线保留。

### 13.2 行为闭环

- `routeOverride` 已从各领域 UI/options 透传至 `ai.run()` / `ai.runStream()`；一次性 fallback 不写回任务路由。
- `aiFallback.target` 仅保留自有字符串 `profileId/modelId`，拒绝 getter、继承属性、污染键、控制字符和过长值。
- `requiredCapabilities` 保持 `compatible/incompatible/unknown` 三态提示；自定义标签按 `unknown`，不硬过滤。
- 收藏与最近使用沿用既有 storage key，模型身份统一为 `profileId::modelId`；保存路由失败时不记录 recent 或显示成功 toast。
- Advice chat/vision 已覆盖失败气泡、`skipUserMessage`、一次性 action、File 短期内存生命周期、自动续写 override 继承和 partial-output 禁跨模型重试。
- 图片 `File`、Blob、base64 和原始附件对象未进入 `data.db`、localStorage、日志、同步或备份。
- 经 CodeGraph callers/impact、动态入口和测试 harness 补查，已删除确认无调用的旧 visual/provider/`setAdviceModel` 适配；保留共享 visual resolver、动态全局入口和兼容读取层。

### 13.3 自动化结果

| 分支 | 测试 | CI/等效门禁 | CSS | HTML safety | size-limit | 版本 |
|---|---:|---|---|---|---|---|
| `perfrom` | 521/521 | `npm run ci` 通过 | CI 内全部通过 | CI 内通过 | AI 133.53/134 kB；plan 72.48/72.5 kB | v323 |
| `ui-mockup` | 486/486 | typecheck、CSS、HTML safety、size coverage、专项 `eslint --no-ignore` 均通过 | overlap 220，全部检查通过 | 31 文件、126 sinks | AI 127.52/130 kB；plan 72.07/72.1 kB | v316 |

`ui-mockup` 的 `npm run ci` 包装命令不能直接用于 `.worktrees/` 路径，因为 ESLint 将该目录视为忽略目录；这是工作树位置限制，不是 lint 失败。逐项门禁和实际变更 JS 的 `eslint --no-ignore` 已替代验证。

### 13.4 Service Worker 与运行时复验

- `ui-mockup` 的 `app-update.js` 只保留 idle lazy load，删除重复静态加载；新增加载测试，运行时只观察到 1 个脚本节点。
- 修复后重新加载未再出现 `Identifier 'appUpdate' has already been declared`。
- `ai-model-visual.js` 已进入 `index.html` 加载前置和 `sw.js` precache，版本检查通过。
- 两分支均在 430×932、390×844、360×800 和 1440×900 检查 AI 教练模型 chip/picker：无页面横向溢出、chip 无内联 `×`、完整 picker 保留“恢复默认”。

### 13.5 尚需人工完成

- 尚未创建阶段性 commit；应按第 9 节顺序人工分批提交，避免把用户 UI/CSS 基线误拆或覆盖。
- 暗色、减少动效、虚拟键盘、真实 API 失败气泡和刷新后视觉附件退化文案尚未完成全场景人工视觉复验；对应行为已有自动化测试，但合并前仍应按真实设备检查。
- 浏览器刷新时仍可观察到既有 `AbortError: Transition was skipped` 记录；本轮未将其归因于 AI 路由闭环，也未顺手修改。
