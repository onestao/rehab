# AI 功能路由与模型控件闭环：超细实施作战手册

> 日期：2026-07-12  
> 状态：待执行  
> 上位计划：`docs/tasks/ai-routing-wiring-completion-plan.md`  
> 主实施分支：`perfrom`  
> 对照同步分支：`ui-mockup`  
> 约束：只拆解既定方案，不改变产品决策，不直接实现运行代码。

## 1. 使用方式与总体拆分原则

1. 保持上位计划的阶段 0–5 不变，严格按本手册原子任务顺序执行。
2. 每个原子任务默认对应一个小 commit；无代码变化的任务对应独立审查记录。
3. 中等推理 agent 一次只领取一个任务，不跨任务顺手修复。
4. 高风险数据生命周期、UI 展示、Service Worker、跨分支同步必须分开提交。
5. 一个任务修改超过 5 个运行文件时，应先重新拆分。
6. 阶段 0 只建立红灯测试，不提前实现。
7. 每项先跑最小相关测试，再做阶段级和最终验证。
8. 遇到“需要人工确认的问题”时停止相关任务，不擅自扩展产品语义。

### 固定执行节奏

1. 阅读指定文件和适用 `AGENTS.md`。
2. 用 CodeGraph 查询目标符号 callers/impact；只有文字内容查询使用 `rg`。
3. 运行任务指定的基线测试。
4. 先写测试并确认预期红灯，或确认阶段 0 的红灯仍存在。
5. 实现最小行为，不处理任务外问题。
6. 运行任务级测试、静态检查和 `git diff --check`。
7. 检查安全边界、禁止修改范围和生成物。
8. 形成小 commit，确保可单独 revert。

### 禁止事项

- 禁止新增后端、数据库、bundler、全局状态框架或大规模重构。
- 禁止迁移 `data.db` schema，除非人工确认改变上位计划。
- 禁止把 `requiredCapabilities` 三态提示改成硬过滤。
- 禁止持久化图片 `File`、Blob、base64 或原始附件对象。
- 禁止在错误、日志、同步数据中写入 API Key、认证头或带凭据 URL。
- 禁止整分支覆盖 `ui-mockup`。
- 禁止提高 size-limit、跳过测试或削弱安全检查。
- 禁止在阶段 5 前大规模删除重复代码。

## 2. 模型分工建议

| 模型 | 适合任务 | 不适合任务 |
|---|---|---|
| Luna / 低成本 | 单文件测试脚手架、基线记录、简单输入规范化、CSS 生成物、文档收口 | 流式状态机、附件生命周期、安全规范化、复杂冲突 |
| Terra / 中等智能 | 纯 helper、注册表连接、设置页分组、最近使用、简单领域 `routeOverride`、常规测试 | AI 教练图片重试、部分流式输出、跨分支高冲突同步 |
| Sol / 高智能 | `aiFallback.target` 安全契约、AI 教练 chat/vision、附件内存生命周期、自动续写继承、跨分支同步审查、最终架构审查 | 单纯生成物更新等低价值任务 |

必须使用 Sol：3.1、3.9、3.10、3.11、4.1、4.3、5.1。这些任务同时涉及安全、异步状态、历史数据、动态 UI 或分支冲突，错误通常不会被单一测试捕获。

可交给 Luna：0.1、1.5、4.5、5.3；但必须由 Terra 或 Sol 审查差异。

## 3. 原子任务总览

| 阶段 | 编号 | 原子任务 | 推荐模型 | 风险 | 建议 commit |
|---|---|---|---|---|---|
| 0 | 0.1 | 固化分支与测试基线 | Luna | 低 | 无或 docs-only |
| 0 | 0.2 | 注册表/family/能力三态红灯 | Terra | 中 | `test: cover task registry wiring gaps` |
| 0 | 0.3 | 最近使用与 AI 教练红灯 | Terra | 中 | `test: cover shared model recents gaps` |
| 0 | 0.4 | 领域 routeOverride/fallback 红灯 | Sol | 高 | `test: cover manual fallback routing gaps` |
| 0 | 0.5 | AI 教练流式与附件红灯 | Sol | 高 | `test: cover advice fallback lifecycle gaps` |
| 1 | 1.1 | 能力三态与模型引用纯 helper | Terra | 中 | `feat: add AI routing metadata helpers` |
| 1 | 1.2 | selectable model 元数据透传 | Terra | 中 | `feat: connect selectable model metadata` |
| 1 | 1.3 | 设置页 group/localPicker 接线 | Terra | 中 | `feat: connect task registry UI metadata` |
| 1 | 1.4 | 三态 UI 与确认行为 | Terra | 中高 | `feat: show model capability compatibility` |
| 1 | 1.5 | 手动模型元数据规范化 | Luna | 低中 | `fix: normalize manual model metadata` |
| 2 | 2.1 | 共享收藏/最近接口 | Terra | 中 | `refactor: expose shared model preference helpers` |
| 2 | 2.2 | 通用 picker 排序与惰性清理 | Terra | 中 | `feat: order task models by favorites and recents` |
| 2 | 2.3 | AI 教练接入最近使用 | Terra | 中高 | `feat: share advice model recents` |
| 3 | 3.1 | aiFallback.target 安全规范化 | Sol | 高 | `fix: normalize manual AI fallback targets` |
| 3 | 3.2 | 饮食文字 override 与重试 | Terra | 中 | `feat: retry food text parsing with fallback` |
| 3 | 3.3 | 饮食图片 File 短期重试 | Sol | 高 | `feat: retry diet photos with fallback` |
| 3 | 3.4 | 身体目标 override 与重试 | Terra | 中 | `feat: retry body goal plans with fallback` |
| 3 | 3.5 | 今日/一周计划 override 与重试 | Terra | 中高 | `feat: retry generated plans with fallback` |
| 3 | 3.6 | 明日自动调整安全重试 | Sol | 高 | `feat: retry plan adjustment with fallback` |
| 3 | 3.7 | 报告/总结既有重试收敛 | Terra | 中 | `refactor: unify report fallback retries` |
| 3 | 3.8 | 快速洞察 override 与缓存隔离 | Terra | 中高 | `feat: retry quick insights with fallback` |
| 3 | 3.9 | advice.chat 气泡与 skipUserMessage | Sol | 高 | `feat: retry advice chat with fallback` |
| 3 | 3.10 | advice.vision 附件内存生命周期 | Sol | 极高 | `feat: retain advice vision retry payloads in memory` |
| 3 | 3.11 | 自动续写与跨模型保护 | Sol | 极高 | `fix: keep advice continuation on one route` |
| 4 | 4.1 | 同步前提交映射与冲突预审 | Sol | 高 | 无或 docs-only |
| 4 | 4.2 | ui-mockup 共享模型视觉移植 | Terra | 中高 | `feat: share model visuals in ui mockup` |
| 4 | 4.3 | 按阶段同步行为提交 | Sol | 高 | 保留原提交边界 |
| 4 | 4.4 | ui-mockup 推理/x/toast 对齐 | Terra | 中 | `fix: align ui mockup AI controls` |
| 4 | 4.5 | ui-mockup SW/CSS/size-limit 收口 | Luna | 中 | `chore: refresh ui mockup assets` |
| 5 | 5.1 | CodeGraph 死代码与动态入口审计 | Sol | 高 | 无或审计记录 |
| 5 | 5.2 | 删除确认无调用的重复适配 | Terra | 中高 | `refactor: remove duplicate AI picker adapters` |
| 5 | 5.3 | 文档状态、生成物与最终验收 | Luna | 低中 | `docs: close AI routing wiring plan` |

## 4. 需要人工确认的问题

1. **结构化解析失败是否提供备用重试**：`goal.body` 已明确允许；`food.text`、`food.vision`、`plan.today/week` 的完整响应 JSON 解析失败是否也显示备用操作，需确认。
2. **图片重试内存保留时长**：建议 10 分钟或会话结束前，具体 TTL 需确认。
3. **不兼容模型确认 UI**：使用原生 `confirm()` 还是现有 modal/sheet，需确认；不得自行引入新组件。
4. **失败气泡刷新后的文本 fallback**：是否允许持久化安全 target 并继续一键重试，需确认。
5. **自动 fallback 提示强度**：保持事件/结果元数据还是每次 toast，需确认。
6. **`ui-mockup` 供应商管理布局**：本轮默认保留旧内联布局；若要迁移全屏管理器需另行确认。
7. **任务 group 排序**：建议保持注册顺序；固定产品排序需确认。
8. **能力标签允许集合**：仅允许已知标签还是允许自定义标签，需确认。

---

# 阶段 0：建立红灯测试

## 任务 0.1：固化分支与测试基线

- **推荐模型**：Luna。
- **任务名称**：固化分支与测试基线。
- **目标行为**：记录两分支 commit、工作树状态、测试数、关键差异和 size-limit 基线，不修改运行代码。
- **涉及文件**：只允许审计记录；不修改 JS/CSS。
- **预计修改入口**：无运行入口；读取 `package.json` scripts 和 `.size-limit.cjs`。
- **禁止修改范围**：运行文件、测试断言、生成物、用户未提交改动。
- **实施前必须阅读**：根 `AGENTS.md`、上位计划、本手册、`package.json`。
- **推荐执行顺序**：状态 → commit → 两分支测试 → size-limit → 记录。
- **先写/修改测试**：无。
- **预期红灯**：无，本任务建立基线。
- **实现步骤**：执行 `git status --short --branch`；记录 HEAD/ui/merge-base；两分支分别测试；记录 size-limit；确认附件目录不进入提交。
- **验收命令**：两分支 `npm run test`；`npx --yes size-limit`；`git diff --check`。
- **通过标准**：基线可复现，工作树状态明确，无运行代码变化。
- **常见失败模式**：误把用户改动当基线；在错误 worktree 测试；擅自改全局 safe.directory。
- **回滚方式**：删除审计记录。
- **执行 agent 具体提示词**：
  > 只执行 0.1。不要修改运行代码或测试。记录 perfrom 与 ui-mockup 的 commit、merge-base、工作树、测试数和 size-limit。发现未提交改动时停止并报告，不清理、不覆盖。

## 任务 0.2：注册表、family 与能力三态红灯测试

- **推荐模型**：Terra。
- **任务名称**：注册表元数据接线红灯。
- **目标行为**：用失败测试固定 `family` 透传、`group` 分组、`localPicker` guard、能力三态。
- **涉及文件**：`test/ai-routing.test.mjs`、`test/ai-routing-runtime.test.mjs`、`test/ai-task-settings.test.mjs`。
- **预计修改入口**：测试中的 registry/runtime/UI harness。
- **禁止修改范围**：所有生产 JS/CSS。
- **实施前必须阅读**：`ai-routing.js`、`ai-routing-pure.mjs`、`ai-task-settings.js` 和三个测试文件。
- **推荐执行顺序**：纯契约 → runtime 透传 → UI 行为。
- **先写/修改测试**：三态；family row；group 被消费；localPicker=false 阻止挂载。
- **预期红灯**：缺 helper、family 丢失、设置页平铺、mount 无 guard。
- **实现步骤**：最小 fixture；覆盖能力缺失和 false；测试行为而非内部函数名；确认失败来自缺功能。
- **验收命令**：`node --test test/ai-routing.test.mjs test/ai-routing-runtime.test.mjs test/ai-task-settings.test.mjs`。
- **通过标准**：新增测试稳定红灯，原测试绿，无生产代码变化。
- **常见失败模式**：把不兼容写成硬过滤；只正则检查字符串；依赖真实 localStorage。
- **回滚方式**：revert 测试 commit。
- **执行 agent 具体提示词**：
  > 只增加注册表接线红灯测试，不写实现。覆盖 family、requiredCapabilities 三态、group 和 localPicker guard；保持“不兼容模型仍可选择”。

## 任务 0.3：最近使用与 AI 教练红灯测试

- **推荐模型**：Terra。
- **任务名称**：共享模型偏好红灯。
- **目标行为**：固定收藏/最近统一键、任务隔离、去重和 AI 教练写入。
- **涉及文件**：`test/ai-task-settings.test.mjs`、advice picker 测试，必要时新增专用测试。
- **预计修改入口**：`rememberRecent`、`chooseAdviceModel`、`renderAdviceModelPicker` 的测试 harness。
- **禁止修改范围**：生产 JS、localStorage key、schema。
- **实施前必须阅读**：`ai-task-settings.js`、`advice-panel.js` 模型区、delegated action security 测试。
- **推荐执行顺序**：共享语义 → advice 写入 → 排序 → 失效记录。
- **先写/修改测试**：chat/vision 分离；收藏不重复；选择后写现有 recents key；删除模型不报错。
- **预期红灯**：AI 教练不写 recent，picker 只按收藏排序。
- **实现步骤**：使用内存 localStorage stub；测试互相隔离；验证 `profileId::modelId`。
- **验收命令**：相关 `node --test`。
- **通过标准**：准确红灯，安全测试未削弱。
- **常见失败模式**：测试串扰；按 provider 区分模型；忽略同 ID 跨 profile。
- **回滚方式**：revert 测试 commit。
- **执行 agent 具体提示词**：
  > 只增加收藏和最近使用闭环红灯测试。证明 AI 教练按 taskId 写现有 recents key，收藏、最近、普通不重复。不要实现。

## 任务 0.4：领域 routeOverride/fallback 契约红灯测试

- **推荐模型**：Sol。
- **任务名称**：非 Advice 领域 override 透传红灯。
- **目标行为**：逐领域固定 UI 到 `ai.run/runStream` 的 override 透传，不包含 AI 教练附件。
- **涉及文件**：food、goal、plan、report、summary、insight 相关测试。
- **预计修改入口**：各领域最小 harness。
- **禁止修改范围**：生产代码；advice chat/vision 测试留给 0.5。
- **实施前必须阅读**：`ai-api.js`、`food-log.js`、`health-diet.js`、`goal-plan.js`、`plan-ai.js`、`plan-auto-adjust.js`、`report-panel.js`、`weekly-summary.js`。
- **推荐执行顺序**：简单非流式 → 计划 → 已有 report/summary 回归。
- **先写/修改测试**：每个入口传 override 后 mock `ai.run/runStream` 收到相同 ref；不调用 `setTaskRoute`。
- **预期红灯**：food text、body goal、plan、adjust、insight 丢 override；report/summary 基本路径应绿。
- **实现步骤**：每领域独立 harness；失败断言指出断点；不写巨型一测全包。
- **验收命令**：逐文件测试后组合测试。
- **通过标准**：每个缺口独立红灯，已有 report/summary 继续绿。
- **常见失败模式**：只测函数签名；重试意外修改保存路由。
- **回滚方式**：revert 测试 commit。
- **执行 agent 具体提示词**：
  > 为除 AI 教练外的每个 AI 任务增加 routeOverride 端到端红灯。逐领域验证到 ai.run/runStream，且不调用 setTaskRoute。不要改生产代码。

## 任务 0.5：AI 教练流式与附件红灯测试

- **推荐模型**：Sol。
- **任务名称**：Advice fallback 生命周期红灯。
- **目标行为**：固定 chat/vision 气泡、skipUserMessage、File 只存内存、续写继承、部分输出禁跨模型。
- **涉及文件**：advice 相关测试，建议新增 `test/advice-fallback.test.mjs`。
- **预计修改入口**：`sendAiAdvice`、`retryAdviceFrom`、失败渲染、续写循环的 harness。
- **禁止修改范围**：生产代码；不得把 File fixture 序列化进 db。
- **实施前必须阅读**：`advice-panel.js` 请求/失败/重试区、`advice-attachments.js`、`advice-render.js`、持久化测试。
- **推荐执行顺序**：chat override → skipUserMessage → vision File → partial guard → continuation。
- **先写/修改测试**：chat 不重复用户消息；vision 复用内存 File 且 db 无 File；刷新退化；已输出 token 无 action；续写同 override。
- **预期红灯**：send 不消费 override，无安全 target/附件重试内存。
- **实现步骤**：假 File 与序列化探针；分别模拟 0 token/已有 token；断言消息数和调用序列。
- **验收命令**：专用 advice 测试及 `test/advice-edit.test.mjs`。
- **通过标准**：红灯对应真实断点，编辑/版本/取消测试仍绿。
- **常见失败模式**：File fixture 进 db；混淆续写失败和主失败；只测 toast 文案。
- **回滚方式**：revert 测试 commit。
- **执行 agent 具体提示词**：
  > 只新增 AI 教练 fallback 生命周期红灯。覆盖 chat/vision、skipUserMessage、内存 File、刷新退化、部分输出禁重试、续写继承 override。不要实现，不持久化 File。

---

# 阶段 1：接通注册表与模型元数据

## 任务 1.1：能力三态与模型引用纯 helper

- **推荐模型**：Terra。
- **任务名称**：AI 路由纯元数据 helper。
- **目标行为**：提供无副作用的能力三态和模型引用规范化函数。
- **涉及文件**：`ai-routing-pure.mjs`、`test/ai-routing.test.mjs`。
- **预计修改函数/导出**：新增 `normalizeModelRef`、`requiredCapabilityState` 或等价纯导出。
- **禁止修改范围**：runtime、UI、task definitions、请求逻辑。
- **实施前必须阅读**：`ai-routing-pure.mjs` 全部导出和测试风格。
- **推荐执行顺序**：模型 ref → 三态 → 畸形输入。
- **先写/修改测试**：沿用 0.2；补原型污染、未知字段、数组/字符串输入。
- **预期红灯**：0.2 对应纯 helper 测试。
- **实现步骤**：只接受字符串 ID；返回新对象；明确 false 优先于 unknown；不访问 `window`。
- **验收命令**：`node --test test/ai-routing.test.mjs`；`npm run typecheck`。
- **通过标准**：纯测试绿；无 DOM/存储依赖；不改变现有路由结果。
- **常见失败模式**：缺失能力判 false；返回原引用；保留 API Key 等字段。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 仅修改 ai-routing-pure.mjs 和对应测试。实现安全模型 ref 规范化及 requiredCapabilities 三态 helper。不得改 UI/runtime，不得硬过滤模型。

## 任务 1.2：listSelectableModels 透传 family 与兼容状态

- **推荐模型**：Terra。
- **任务名称**：可选模型元数据闭环。
- **目标行为**：selectable row 包含 family 和三态兼容结果，仍允许用户选择不兼容模型。
- **涉及文件**：`ai-routing.js`、`test/ai-routing-runtime.test.mjs`。
- **预计修改函数/导出**：`listSelectableModels(taskId)`。
- **禁止修改范围**：`ai-task-settings.js`、provider manager、请求执行。
- **实施前必须阅读**：`ai-routing.js`、`ai-model-cache.js`、catalog normalization。
- **推荐执行顺序**：读取 definition → 透传字段 → 计算状态 → 回归排除规则。
- **先写/修改测试**：0.2 runtime 红灯；跨 profile 同名模型；unknown family。
- **预期红灯**：family/compatibility 缺失。
- **实现步骤**：调用纯 helper；保持 `profileId::modelId`；不硬过滤；不恢复 provider-only key。
- **验收命令**：routing runtime/pure 测试。
- **通过标准**：旧测试“用户可选不兼容模型”继续通过；supplier 禁用/归档规则不变。
- **常见失败模式**：误过滤 vision=false；family 靠 displayName 推断；破坏 archived 排除。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只修改 listSelectableModels 返回数据。透传 family，附加三态兼容信息，保留用户可选不兼容模型和现有 supplier 排除规则。不要改 UI。

## 任务 1.3：设置页 group 与 localPicker 接线

- **推荐模型**：Terra。
- **任务名称**：任务注册表驱动设置页。
- **目标行为**：设置页按 group 分组；内联 picker 受 localPicker guard 控制。
- **涉及文件**：`ai-task-settings.js`、`test/ai-task-settings.test.mjs`、必要时 `css-src/20-settings-ai.css` 及生成物。
- **预计修改函数/导出**：`render()`、`mountInlinePicker()`、`mountInlinePickers()`。
- **禁止修改范围**：能力警告视觉、最近使用、advice picker。
- **实施前必须阅读**：目标 JS、CSS marker、构建脚本。
- **推荐执行顺序**：guard → group DOM → 最小 CSS。
- **先写/修改测试**：0.2 红灯；group 保持注册顺序。
- **预期红灯**：render 平铺；mount 无 definition guard。
- **实现步骤**：安全 DOM API；group 用 textContent；未知 task 不挂载；不猜宿主位置。
- **验收命令**：task settings 测试；`npm run build:css`；`npm run check:css-overlap`。
- **通过标准**：分组可访问；已有宿主正常；无新 sink；CSS 冲突不增加。
- **常见失败模式**：按字母重排；guard 阻止合法 host；改错 CSS domain。
- **回滚方式**：revert JS/CSS/生成物同 commit。
- **执行 agent 具体提示词**：
  > 实现 group 分组与 localPicker guard。保持注册顺序，不自动创建宿主，不涉及能力警告或最近使用。CSS 只改 20-settings-ai.css 并更新生成物。

## 任务 1.4：兼容三态 UI 与确认行为

- **推荐模型**：Terra；交互方案未确认时停止。
- **任务名称**：模型能力三态提示。
- **目标行为**：模型行显示 compatible/incompatible/unknown；不兼容可选但需明确确认。
- **涉及文件**：`ai-task-settings.js`、`css-src/20-settings-ai.css`、相关测试和生成物。
- **预计修改函数/导出**：模型行构建、选择事件、aria/title 文案。
- **禁止修改范围**：`listSelectableModels`、请求层、AI 教练 picker。
- **实施前必须阅读**：1.2 输出结构、现有确认交互、a11y 测试。
- **推荐执行顺序**：状态标记 → a11y → 确认 → CSS。
- **先写/修改测试**：三态 DOM；取消不保存；unknown 不阻止。
- **预期红灯**：0.2 UI 红灯。
- **实现步骤**：文案列出不兼容/未知能力；不只靠颜色；拒绝确认时不调用保存。
- **验收命令**：task settings、a11y/security、CSS checks。
- **通过标准**：键盘可操作；不兼容仍由用户决定；unknown 不被误判。
- **常见失败模式**：unknown 显示为不支持；只用颜色；取消后仍写路由。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 增加 requiredCapabilities 三态提示和不兼容选择确认，保持用户控制，不硬过滤。先确认使用 confirm 还是现有 modal；未确认则停止。

## 任务 1.5：供应商手动元数据输入规范化

- **推荐模型**：Luna，Terra 审查。
- **任务名称**：手动模型 family/能力输入规范化。
- **目标行为**：trim、去重、稳定保存并刷新 task picker。
- **涉及文件**：`ai-provider-manager.js`、对应测试。
- **预计修改函数/导出**：`addManual()`、`addCandidates()`。
- **禁止修改范围**：供应商布局、凭据、发现协议、任务选择器。
- **实施前必须阅读**：provider manager 模型区、catalog normalization、安全规则。
- **推荐执行顺序**：输入规范 → 保存 → refresh 回归。
- **先写/修改测试**：重复标签、空标签、大小写、非法空白。
- **预期红灯**：当前字符串直接成为对象键。
- **实现步骤**：按人工确认的允许集合处理；不把未知标签伪装成已知能力；不改模型 ID。
- **验收命令**：provider manager、catalog、routing runtime 测试。
- **通过标准**：元数据稳定；不影响 API Key；family 原值可追踪。
- **常见失败模式**：删除自定义标签；把 displayName/family 当 ID；触碰凭据。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只规范化手动模型 family 和能力标签，不改供应商 UI、凭据或发现协议。按已确认策略实现并补最小测试。

---

# 阶段 2：统一收藏与最近使用

## 任务 2.1：共享收藏与最近使用适配接口

- **推荐模型**：Terra。
- **任务名称**：共享模型偏好 API。
- **目标行为**：不新增存储键，暴露稳定、不可变的收藏/最近接口。
- **涉及文件**：`ai-task-settings.js`、`test/ai-task-settings.test.mjs`。
- **预计修改函数/导出**：`modelKey`、`favoriteKeys`、`rememberRecent`、新增 `recentKeysForTask` 或等价导出对象成员。
- **禁止修改范围**：AI 教练、排序 UI、localStorage key、schema。
- **实施前必须阅读**：目标 JS 顶部 helper 与底部导出对象。
- **推荐执行顺序**：只读 → 写入 → 不可变返回 → 异常边界。
- **先写/修改测试**：0.3 红灯；存储不可用；每任务上限 3。
- **预期红灯**：helper 未稳定暴露。
- **实现步骤**：沿用两个 key；统一 `profileId::modelId`；返回新数组/Set；storage 异常安全失败。
- **验收命令**：task settings 测试；typecheck。
- **通过标准**：接口小、稳定、不可变；旧收藏兼容。
- **常见失败模式**：返回共享数组；按 provider key；新增第三套偏好。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只暴露共享收藏/最近使用小接口。沿用现有两个 key，按 profileId::modelId，返回副本。不要改选择器 UI。

## 任务 2.2：通用任务选择器排序与失效记录处理

- **推荐模型**：Terra。
- **任务名称**：通用 picker 收藏/最近/family 排序。
- **目标行为**：收藏、当前任务最近、其余 family 分组，失效记录不渲染。
- **涉及文件**：`ai-task-settings.js`、测试、必要 CSS 和生成物。
- **预计修改函数/导出**：`createCompactModelControl()` 的抽屉构建逻辑。
- **禁止修改范围**：AI 教练、收藏语义、路由保存。
- **实施前必须阅读**：2.1 接口、现有排序和 family 结构。
- **推荐执行顺序**：有效 key → 收藏 → 最近 → 去重 → family。
- **先写/修改测试**：收藏/最近重叠；失效 key；同 ID 跨 profile；空 family。
- **预期红灯**：0.3 排序测试。
- **实现步骤**：只匹配 selectable models；不在 render 全量重写 storage；选择成功继续 rememberRecent。
- **验收命令**：task settings 测试；如改 CSS，build/overlap。
- **通过标准**：无重复；顺序稳定；失效项不报错。
- **常见失败模式**：重复区段；只按 modelId；render 写存储。
- **回滚方式**：revert 单 commit及生成物。
- **执行 agent 具体提示词**：
  > 调整通用任务模型抽屉：收藏、当前任务最近、其余按连接与 family。只匹配有效模型，不重复，不在 render 主动写存储。不要改 AI 教练。

## 任务 2.3：AI 教练接入共享最近使用

- **推荐模型**：Terra，Sol 审查安全。
- **任务名称**：Advice picker 最近使用闭环。
- **目标行为**：选择成功后写对应 task recents；各范围页按收藏/最近/其余排序。
- **涉及文件**：`advice-panel.js`、picker 测试、必要 `css-src/48-advice-model-picker.css` 与生成物。
- **预计修改函数/导出**：`chooseAdviceModel()`、`renderAdviceModelPicker()`、委托事件。
- **禁止修改范围**：发送请求、失败气泡、附件、fallback、续写。
- **实施前必须阅读**：2.1/2.2、picker 安全测试、`advicePickerTaskId()`。
- **推荐执行顺序**：保存后写 recent → 读取 task → 分区 → 安全/a11y。
- **先写/修改测试**：0.3 advice 红灯；chat/vision 分离；收藏去重。
- **预期红灯**：choose 不记录；render 只按 starred。
- **实现步骤**：setTaskRoute 成功后记录；taskId 来自附件状态；安全 escape；不新增不可信 onclick。
- **验收命令**：advice picker、delegated security、task settings、CSS checks。
- **通过标准**：chat/vision 独立；保存失败不写 recent；收藏实时同步。
- **常见失败模式**：附件变化记错 task；保存失败仍写；动态标签未 escape。
- **回滚方式**：revert 单 commit及生成物。
- **执行 agent 具体提示词**：
  > 只把 AI 教练 picker 接入共享 recents。setTaskRoute 成功后按 advice.chat/advice.vision 记录，页内按收藏、最近、其余分区。不得修改发送、fallback 或附件。

---

# 阶段 3：接通所有手动备用模型重试

## 统一透传契约

每个领域任务必须证明以下完整路径，而不是只增加形参：

```text
UI 重试动作
→ 领域方法 options.routeOverride
→ ai-api helper 或领域 facade
→ ai.run()/ai.runStream()
→ getTaskRequestSequence(taskId, routeOverride)
→ resolveTaskConfig(taskId, target)
→ provider effective config
→ 结果 meta 记录实际模型
```

统一禁止：重试调用 `setTaskRoute()`；override 合并进 `cfg.taskRoutes`；已有流式输出后跨模型重试；持久化完整 error、File、请求 messages 或认证信息。

## 任务 3.1：aiFallback.target 安全规范化

- **推荐模型**：Sol。
- **任务名称**：手动 fallback 安全错误契约。
- **目标行为**：target 只保留 `{profileId, modelId}`；畸形 target 不产生 UI 操作。
- **涉及文件**：`ai-routing-pure.mjs`、`ai-api.js`、routing/run 测试。
- **预计修改函数/导出**：`manualFallbackTarget()`、`ai.run()` catch、`error.aiFallback`。
- **禁止修改范围**：领域 UI、toast、自动序列、重试调用。
- **实施前必须阅读**：`ai-api.run()`、request sequence、错误分类、安全规则。
- **推荐执行顺序**：纯规范化 → error shape → automatic 回归 → emitted guard。
- **先写/修改测试**：丢弃 apiKey/baseUrl/headers；空 ID 无 target；emitted 无 target；automatic 无手动 target。
- **预期红灯**：当前直接引用 fallback 对象。
- **实现步骤**：纯 helper 生成新对象；不 mutation 原 error/route；保留 taskId；不吞原错误。
- **验收命令**：routing pure/run tests；typecheck；HTML safety。
- **通过标准**：最小 error shape，无凭据；legacy result/metadata/automatic 全绿。
- **常见失败模式**：spread 原 target；不可重试错误被包装；规范化失败仍显示 action。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只处理 aiFallback.target 安全规范化和 ai.run 错误契约。target 仅 profileId/modelId；已输出、automatic、畸形 target 都不能产生手动 fallback。不要改 UI。

## 任务 3.2：饮食文字 routeOverride 与备用重试

- **推荐模型**：Terra。
- **任务名称**：food.text 一次性备用重试。
- **目标行为**：文字识别失败可用备用模型重试；原输入保留；保存路由不变。
- **涉及文件**：`ai-api.js`、`food-log.js`、food parse/log 测试。
- **预计修改函数/导出**：`parseFood(text, opts)`、`aiParseFood(options)`。
- **禁止修改范围**：图片识别、AI 教练、JSON parser 策略（未确认部分）。
- **实施前必须阅读**：3.1 契约、parseFood、aiParseFood、toast API。
- **推荐执行顺序**：api opts → UI opts → catch action → busy/status。
- **先写/修改测试**：0.4 food text 红灯；不调用 setTaskRoute；文本保持。
- **预期红灯**：parseFood 无 opts，catch 无 action。
- **实现步骤**：向后兼容 opts；action 捕获文本和安全 target；复用领域入口并加 busy guard。
- **验收命令**：food parse/log、routing、typecheck、HTML safety。
- **通过标准**：override 到 ai.run；结果正常；主路由不变。
- **常见失败模式**：并行重复请求；未经确认把所有解析失败当 fallback；重试清空输入。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 为 food.text 接通 routeOverride 和手动备用重试。保持输入和状态 UI，不改 task route，不涉及图片。解析失败语义未确认时只覆盖 aiFallback 错误。

## 任务 3.3：饮食图片 File 短期备用重试

- **推荐模型**：Sol。
- **任务名称**：food.vision 一次性 File fallback。
- **目标行为**：toast 有效期内用同一 File 和备用模型重试；File 不进入持久化/日志。
- **涉及文件**：`health-diet.js`、必要 `ai-api.js`、diet photo/vision 测试。
- **预计修改函数/导出**：`handleDietPhoto(file, options)`、`parseFoodFromImage(file, opts)`。
- **禁止修改范围**：Advice 附件、schema、sync、backup、File base64 持久化。
- **实施前必须阅读**：照片完整流程、vision pure、日志代码、3.1。
- **推荐执行顺序**：override → 新 controller → 一次性 action → 实际模型 failure cache → 泄漏测试。
- **先写/修改测试**：0.4 图片红灯；controller 不复用；db/log 无 File；取消无 action。
- **预期红灯**：catch 无 action，方法无 options。
- **实现步骤**：options 不保存到 db；仅安全 target 时创建 action；闭包引用 File 且触发后失效；每次新 controller；按实际模型更新 cache。
- **验收命令**：diet photo smoke、vision、routing、HTML safety；检查 data/sync 无 File。
- **通过标准**：一次性重试可用；File 仅栈/闭包；按钮状态恢复。
- **常见失败模式**：复用 aborted controller；File 放长期字段；清错模型 cache；toast 多击。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只实现饮食照片短期 File fallback。File 仅在当前调用和一次性 toast 闭包，不能进入 data.db/localStorage/log/sync。每次重试新建 AbortController。

## 任务 3.4：身体目标 routeOverride 与备用重试

- **推荐模型**：Terra。
- **任务名称**：goal.body 一次性备用重试。
- **目标行为**：失败后用备用模型重新生成；重试重新读取当前表单。
- **涉及文件**：`goal-plan.js`、`ai-api.js`、目标计划测试。
- **预计修改函数/导出**：`requestWeightLossPlan(options)`、`weightLossPlan/bodyGoalPlan`。
- **禁止修改范围**：目标算法、表单字段、schema、plan AI。
- **实施前必须阅读**：goal form、body prompt、JSON error。
- **推荐执行顺序**：api opts → UI opts → 表单重读 → error action。
- **先写/修改测试**：0.4 goal 红灯；表单变化；路由不变。
- **预期红灯**：bodyGoalPlan 不透传，catch 无 action。
- **实现步骤**：重试回调重新调用表单入口；不缓存旧参数；为解析错误提供明确 code 并按上位计划处理。
- **验收命令**：goal/JSON/routing tests；typecheck。
- **通过标准**：新表单值生效；override 到 ai.run；结果结构不变。
- **常见失败模式**：缓存旧体重；routeOverride 被拼进 prompt；改变公式。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 为 goal.body 接通 routeOverride 和备用重试。重试必须重读表单，不改保存路由或算法；按上位计划处理结构化解析失败。

## 任务 3.5：今日/一周计划 routeOverride 与备用重试

- **推荐模型**：Terra，Sol 审查预览状态。
- **任务名称**：plan.today/plan.week 一次性重试。
- **目标行为**：失败后保留用户选择与说明，用备用模型重新生成，不创建重复预览。
- **涉及文件**：`plan-ai.js`、`test/plan-ai.test.mjs`。
- **预计修改函数/导出**：`submitPlanAi(mode, options)`、`ai.runStream` 调用、预览 pending 状态。
- **禁止修改范围**：parser、确认保存策略、auto-adjust、rehab policy。
- **实施前必须阅读**：sheet 状态、submit、preview/confirm、pure tests。
- **推荐执行顺序**：options → request → catch action → 预览幂等。
- **先写/修改测试**：0.4 plan 红灯；taskId；状态保留；action once。
- **预期红灯**：submit 无 override/action。
- **实现步骤**：复用当前 sheet state；只清本次 pending；不重置用户编辑预览；实际模型 meta 正确。
- **验收命令**：plan-ai、routing run、typecheck。
- **通过标准**：两 mode 正确；无双预览；主路由不变。
- **常见失败模式**：mode 覆盖；重试清空预览；meta 仍主模型。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 为 submitPlanAi today/week 增加一次性 override 重试。保留 sheet 输入、病症和类型，不改 parser/confirm，不允许重复预览。

## 任务 3.6：明日自动调整安全重试

- **推荐模型**：Sol。
- **任务名称**：plan.adjust 状态重建式重试。
- **目标行为**：失败后可备用重试，但重试前重新验证目标日期和受保护计划。
- **涉及文件**：`plan-auto-adjust.js`、对应测试、routing tests。
- **预计修改函数/导出**：AI 调整执行方法、`runStream('plan.adjust')`、写入前 policy validation。
- **禁止修改范围**：progression 算法、保护语义、undo 结构。
- **实施前必须阅读**：auto-adjust 全流程、policy、store、undo、测试。
- **推荐执行顺序**：参数 → action → 重建 context → 再校验。
- **先写/修改测试**：0.4 adjust 红灯；失败后用户修改目标计划；重试基于新状态；undo 不重复。
- **预期红灯**：无 override/重试入口。
- **实现步骤**：不缓存最终写入 payload；只缓存用户意图；重新执行 readiness/context/policy；busy guard。
- **验收命令**：auto-adjust、policy、store、routing tests。
- **通过标准**：不覆盖用户新修改；override 仅本次；undo 正确。
- **常见失败模式**：复用旧 snapshot；重复 adjustment log；绕过 manual plan 保护。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 为 plan.adjust 增加手动备用重试。重试必须重新读取数据库、日期和保护计划，再走完整 policy；不得复用旧写入 payload或修改 progression。

## 任务 3.7：报告与总结既有重试收敛

- **推荐模型**：Terra。
- **任务名称**：report/summary fallback 安全收敛。
- **目标行为**：使用安全 target helper，防 action 多击生成重复版本。
- **涉及文件**：`report-panel.js`、`weekly-summary.js`、对应测试。
- **预计修改函数/导出**：`generateReport`、`_inlineSummaryAi`、toast action。
- **禁止修改范围**：版本上限、指标、prompt、布局。
- **实施前必须阅读**：report-version-pure、已有 fallback、toast once 行为。
- **推荐执行顺序**：target helper → action guard → route persistence 回归。
- **先写/修改测试**：畸形 target 无 action；双击只一次；task route 不变。
- **预期红灯**：安全 helper/多击断言红；基本重试应绿。
- **实现步骤**：不重写已有流程；替换 target 读取；复用 busy 或局部 once flag。
- **验收命令**：report/summary/version/toast/routing tests。
- **通过标准**：功能不变；无重复版本；安全 target。
- **常见失败模式**：改变 active version；guard 永久锁死；重复 toast。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 收敛 report-panel 和 weekly-summary 已有 fallback：接安全 target helper、防多击。保持版本、指标、prompt、UI 不变。

## 任务 3.8：快速洞察 override 与缓存隔离

- **推荐模型**：Terra。
- **任务名称**：insight.quick 一次性备用重试。
- **目标行为**：失败后可备用重试；缓存按实际模型身份隔离。
- **涉及文件**：`advice-panel.js` 快速洞察区、相关测试。
- **预计修改函数/导出**：`requestInsightAiAdvice(options)`、insight cache key/meta。
- **禁止修改范围**：主 Advice 发送、对话、附件、版本。
- **实施前必须阅读**：quick insight、cache helper、task route meta。
- **推荐执行顺序**：options → effective override → request → cache identity → action。
- **先写/修改测试**：0.4 insight 红灯；主/备用 cache 不串；路由不变。
- **预期红灯**：无 override；cache 不含实际模型。
- **实现步骤**：按 actual effective model 构造 key；失败不写 cache；备用成功存实际 meta。
- **验收命令**：insight/advice/routing tests。
- **通过标准**：cache 隔离；force 语义不变；无对话副作用。
- **常见失败模式**：fallback 结果进主 key；触发完整 send；缓存空结果。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只处理 insight.quick：routeOverride、备用重试、实际模型缓存隔离。不得触碰主对话、附件或消息版本。

## 任务 3.9：advice.chat 失败气泡与 skipUserMessage

- **推荐模型**：Sol。
- **任务名称**：文本 Advice fallback 闭环。
- **目标行为**：失败气泡提供安全一次性备用重试；不重复用户消息；保持版本关系。
- **涉及文件**：`advice-panel.js`、`advice-render.js` 或现有失败渲染适配、fallback/edit/version/security 测试。
- **预计修改函数/导出**：`sendAiAdvice`、失败 record、`retryAdviceFrom` 或新增小委托入口、chat `ai.run` 调用。
- **禁止修改范围**：vision File、自动续写循环、收藏/最近、schema 大迁移。
- **实施前必须阅读**：send 全流程、retry/edit/version、failure render、委托安全。
- **推荐执行顺序**：override effective config → ai.run → 安全 target → 气泡 action → skip/version。
- **先写/修改测试**：0.5 chat 红灯；消息数；replyToId/versionIdx；路由不持久化；畸形 target。
- **预期红灯**：send 不消费 override；failed record 无 target/action。
- **实现步骤**：
  1. options 接受安全 override。
  2. model/provider/temporaryModel 使用 override effective config。
  3. failed record 只保存规范化 target。
  4. action 使用委托事件。
  5. 重试 `skipUserMessage=true`，复用 prompt 和插入位置。
- **验收命令**：advice fallback/edit/version/security；typecheck；HTML safety。
- **通过标准**：无重复用户消息；版本关系正确；主路由不变；无不可信 inline JS。
- **常见失败模式**：重复 user；错误 replyToId；持久化完整 error；meta 仍主模型。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 实现 advice.chat fallback。routeOverride 进入 effective config 和 ai.run；失败气泡保存最小 target；重试 skipUserMessage，保持版本。不要处理 vision 或续写。

## 任务 3.10：advice.vision 附件内存生命周期

- **推荐模型**：Sol。
- **任务名称**：视觉 Advice 短期附件重试。
- **目标行为**：失败时短期保留附件用于备用重试；持久化只含元数据。
- **涉及文件**：`advice-panel.js`、必要 `advice-attachments.js`、fallback/persistence/sync 测试。
- **预计修改函数/导出**：attachments 获取/清理、运行期 payload Map、vision `ai.run`、气泡 action。
- **禁止修改范围**：schema、backup/sync 格式、图片持久化、food vision。
- **实施前必须阅读**：附件全生命周期、save/sync/backup tests、3.9。
- **推荐执行顺序**：Map 生命周期 → 请求登记 → 失败保留 → 重试消费 → success/delete/timeout 清理 → refresh 退化。
- **先写/修改测试**：0.5 vision 红灯；序列化无 File；重试清理；刷新要求重新附图；取消不保留。
- **预期红灯**：无 Map，发送后附件已 clear。
- **实现步骤**：
  1. 运行期 Map 键为失败消息 ID。
  2. value 仅内存含 File。
  3. 使用人工确认 TTL。
  4. 重试传 `attachmentsOverride` 和 `skipUserMessage`。
  5. failed record 仅安全 target/已有元数据。
  6. 无 Map 时退化为重新附图。
- **验收命令**：advice fallback/attachment/edit/persistence/sync/backup/security tests。
- **通过标准**：File 不在 db/localStorage/log/sync；所有出口释放；原附件+备用模型重试成功。
- **常见失败模式**：Map 无 TTL；删除后泄漏；File 进 record；刷新仍声称直接重试；取消保留。
- **回滚方式**：revert 单 commit，无数据迁移回滚。
- **执行 agent 具体提示词**：
  > 实现 advice.vision 短期附件重试。仅运行期 Map 保存 File，绝不能进入 data.db/localStorage/log/sync/backup。覆盖 success、retry、delete、cancel、TTL、刷新退化。不要改续写。

## 任务 3.11：自动续写、部分输出与跨模型保护

- **推荐模型**：Sol。
- **任务名称**：单回答路由一致性保护。
- **目标行为**：续写继承首段 override；已有内容后不得跨模型 fallback。
- **涉及文件**：`advice-panel.js`、必要 `ai-api.js` 契约核对、stream/fallback tests。
- **预计修改函数/导出**：`createOnToken`、首次 run、auto-continue loop、continue catch、action 判定。
- **禁止修改范围**：stream renderer 性能、Markdown、附件生命周期、task route。
- **实施前必须阅读**：send/continue/cancel 全流程、ai.run emitted、stream tests、3.9/3.10。
- **推荐执行顺序**：冻结 request route → 首段 → 续写 → emitted → continue failure → action suppression。
- **先写/修改测试**：0.5 continuation/partial 红灯；首段/续写同 target；有 token 无 fallback；vision 回归。
- **预期红灯**：续写不传 override；UI 缺明确 partial guard。
- **实现步骤**：请求开始复制 override；所有续写使用同副本；结合 accumulated/full 与 emitted 契约；continue 失败保留部分内容和 finishReason；禁止拼接备用模型。
- **验收命令**：advice stream/fallback/edit/version、routing run、typecheck。
- **通过标准**：一个回答一个 route；部分结果保留；无跨模型拼接；取消不变。
- **常见失败模式**：续写回主模型；只看空字符串判断 emitted；continue error 覆盖首段；仍显示备用按钮。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 冻结一次 Advice 请求的 routeOverride，首段和所有续写都使用它。任何已输出 token/部分内容后的失败不得提供备用重试或跨模型拼接。不要改 renderer 性能。

---

# 阶段 4：同步 `ui-mockup`

## 任务 4.1：同步前提交映射与冲突预审

- **推荐模型**：Sol。
- **任务名称**：跨分支同步设计审查。
- **目标行为**：建立 perfrom 阶段提交到 ui-mockup 的文件/冲突映射，不修改目标分支代码。
- **涉及文件**：git 历史、阶段 0–3 commit、两分支差异；可新增同步记录。
- **预计修改函数/导出**：无。
- **禁止修改范围**：禁止 merge、cherry-pick、checkout 覆盖、复制整文件。
- **实施前必须阅读**：两分支 log/range-diff；`index.html` PAGE_DEPS；`sw.js`；冲突高发 JS。
- **推荐执行顺序**：刷新 commit 基线 → 按阶段列 commit → 文件交集 → 语义冲突 → 同步顺序。
- **先写/修改测试**：无，但记录两分支当前测试基线。
- **预期红灯**：无。
- **实现步骤**：为每个 commit 标记 clean cherry-pick/需 patch/禁止同步；特别标记 advice、task settings、index、sw。
- **验收命令**：`git log --left-right`、`git range-diff`、`git diff --name-status`；不产生运行 diff。
- **通过标准**：同步表能指导中等 agent；每个高冲突文件有处理策略；未改目标代码。
- **常见失败模式**：使用旧 hash；按相似 commit message 假设内容相同；整文件复制。
- **回滚方式**：删除同步记录。
- **执行 agent 具体提示词**：
  > 只做 ui-mockup 同步预审。刷新两分支 commit/merge-base，为阶段提交建立 cherry-pick/patch/禁止同步矩阵。绝对不要 merge、cherry-pick 或复制文件。

## 任务 4.2：ui-mockup 共享模型视觉移植

- **推荐模型**：Terra，Sol 审查加载顺序。
- **任务名称**：共享模型视觉模块移植。
- **目标行为**：ui-mockup 使用 `ai-model-visual.js`，设置页和 Advice 使用同一 resolver。
- **涉及文件**：`ai-model-visual.js`、`ai-task-settings.js`、`advice-render.js`、`index.html`、`sw.js`、视觉测试、必要 CSS/生成物。
- **预计修改函数/导出**：`window.aiModelVisual`、lazy prerequisite、visual node/adapter。
- **禁止修改范围**：供应商管理布局、fallback 行为、最近使用、路由语义。
- **实施前必须阅读**：perfrom 对应实现和测试；ui-mockup lazy deps/SW；模型图标资产。
- **推荐执行顺序**：纯模块+测试 → task settings → advice render → index loading → SW → CSS/size。
- **先写/修改测试**：ui-mockup 缺失 shared visual 红灯；加载顺序/precache；本地 fallback。
- **预期红灯**：无模块/引用；settings 仍首字母色块。
- **实现步骤**：优先 cherry-pick 独立模块 commit；冲突文件用小 patch；新增浏览器脚本必须同时更新 index/SW/version。
- **验收命令**：visual/task/advice/lazy/SW tests；build CSS；version check；size-limit。
- **通过标准**：离线本地图标可用；无未定义 global；加载顺序正确；不迁移 supplier UI。
- **常见失败模式**：只复制模块不加载；漏 SW；重复 visual resolver；提高 size 上限。
- **回滚方式**：revert 此移植 commit，必须同时回滚 index/SW/生成物。
- **执行 agent 具体提示词**：
  > 在 ui-mockup 独立移植共享 ai-model-visual。设置和 Advice 用同一 resolver；同步 index lazy prerequisite、sw precache、版本与测试。不要迁移供应商管理或其他行为。

## 任务 4.3：按阶段同步行为提交

- **推荐模型**：Sol。
- **任务名称**：阶段 1–3 行为定向同步。
- **目标行为**：按 4.1 矩阵逐 commit 同步，不整分支覆盖，不混入无关差异。
- **涉及文件**：每次仅当前源 commit 的文件；高冲突文件人工合并。
- **预计修改函数/导出**：由源 commit 决定。
- **禁止修改范围**：禁止 `git merge perfrom`、整目录复制、一次解决所有冲突、同步饮食/性能无关提交。
- **实施前必须阅读**：4.1 映射、源 commit diff、目标文件当前内容、相关测试。
- **推荐执行顺序**：阶段 1 commits → 测试 → 阶段 2 → 测试 → 阶段 3 基础 → 简单领域 → Advice 高风险最后。
- **先写/修改测试**：目标分支缺失测试先同步；每个 commit 保持源测试语义。
- **预期红灯**：每阶段测试在同步实现前应红或缺失。
- **实现步骤**：一次处理一个 commit；冲突时重建语义而非选 ours/theirs；检查 diff 只含预期文件；每步测试并提交。
- **验收命令**：每 commit 相关测试；阶段结束 `npm run test`；`git diff --check`。
- **通过标准**：提交边界保留；无无关文件；行为与 perfrom 测试一致；ui 特有布局保留。
- **常见失败模式**：整文件采用 theirs；版本号来回跳；漏掉目标分支特有修复；一口气 cherry-pick 多提交。
- **回滚方式**：按逆序 revert 单个同步 commit，不 reset 整分支。
- **执行 agent 具体提示词**：
  > 严格按 4.1 映射逐个同步阶段提交。一次只处理一个 commit；高冲突文件语义合并，禁止整分支 merge、整文件覆盖或带入无关性能/饮食差异。每步测试并检查文件清单。

## 任务 4.4：ui-mockup 推理、恢复默认与 toast 对齐

- **推荐模型**：Terra。
- **任务名称**：UI 分支交互语义收口。
- **目标行为**：显式推理选择采用 perfrom 的 advisory 策略；移除模型按钮 `×`；切换成功 toast。
- **涉及文件**：`ai-routing-pure.mjs`、`advice-panel.js`、对应测试/CSS。
- **预计修改函数/导出**：`buildReasoningOptions`、`renderAdviceModelChip`、`chooseAdviceModel`。
- **禁止修改范围**：provider manager、fallback、最近存储、视觉模块（已由 4.2）。
- **实施前必须阅读**：两分支当前实现和对应测试；上位计划视觉规则。
- **推荐执行顺序**：推理测试对齐 → x 移除 → toast → CSS 清理。
- **先写/修改测试**：显式选择不因不完整 metadata 本地拒绝；chip 无 x；切换 toast 一次。
- **预期红灯**：ui runtime 抛 unsupported；chip 有 x；无 toast。
- **实现步骤**：只对齐已确认产品决策；保留“恢复默认”在完整抽屉；不扩大 provider 协议支持。
- **验收命令**：routing/advice chip/picker/CSS tests；typecheck。
- **通过标准**：与 perfrom 交互一致；无重复 toast；恢复默认仍可达。
- **常见失败模式**：删除所有恢复默认入口；忽略 unknown protocol；toast 在保存失败时仍显示。
- **回滚方式**：revert 单 commit。
- **执行 agent 具体提示词**：
  > 只对齐 ui-mockup 的三项语义：显式推理 advisory、模型 chip 移除 x、切换成功 toast。完整抽屉保留恢复默认；不得改 provider/fallback/最近使用。

## 任务 4.5：ui-mockup Service Worker、CSS 与 size-limit 收口

- **推荐模型**：Luna，Terra 审查。
- **任务名称**：UI 分支生成物和缓存收口。
- **目标行为**：加载顺序、预缓存、版本、CSS 产物和 size-limit 一致。
- **涉及文件**：`index.html`、`sw.js`、`app-update.js`、CSS 源/生成物、`.size-limit.cjs`；默认仅检查，只有用户明确授权后才可最小调整。
- **预计修改函数/导出**：无业务逻辑；版本和资产列表。
- **禁止修改范围**：不得擅自提高 size-limit；不得手工编辑 generated CSS；不得加入不存在资产。
- **实施前必须阅读**：版本脚本、SW tests、CSS build scripts、size-limit config。
- **推荐执行顺序**：build CSS → overlap → icons 如需要 → bump/check → SW tests → size-limit。
- **先写/修改测试**：资源加载/预缓存缺口测试；不要只改快照。
- **预期红灯**：若 4.2 已正确同步，版本检查可能提示需更新。
- **实现步骤**：通过脚本生成产物；核对 diff；`.size-limit.cjs` 仅在内容意外变化时恢复，不增加阈值。
- **验收命令**：build CSS、check CSS、version check、CI、size-limit、SW tests。
- **通过标准**：所有引用资产存在；版本一致；size 未超原上限；生成物可重建。
- **常见失败模式**：手改 generated.css；漏 app-update version；把无关资源加入 precache；提高阈值。
- **回滚方式**：revert 生成物/版本 commit，不能只回滚 sw。
- **执行 agent 具体提示词**：
  > 只收口 ui-mockup 的 CSS 生成物、脚本加载、SW precache、版本和 size-limit。使用项目脚本；除非用户明确授权，不提高阈值；即使授权也只做可解释的最小调整。不改业务逻辑，逐项核对资产存在。

---

# 阶段 5：清理重复与最终收口

## 任务 5.1：CodeGraph 死代码与动态入口审计

- **推荐模型**：Sol。
- **任务名称**：AI picker 重复适配审计。
- **目标行为**：形成可删除/必须保留/待确认清单，不直接删除。
- **涉及文件**：`advice-panel.js`、`advice-render.js`、`ai-task-settings.js`、`ai-model-visual.js`、全局导出和测试 harness。
- **预计修改函数/导出**：无；审计 `providerKeyForModel`、`providerIcon`、`setAdviceModel` 等候选。
- **禁止修改范围**：生产代码、测试、分支历史。
- **实施前必须阅读**：CodeGraph instructions、动态 HTML/global window/Node test 加载方式。
- **推荐执行顺序**：search → callers → impact → 动态字符串/测试检查 → 分类。
- **先写/修改测试**：无；对待删除候选记录现有覆盖情况。
- **预期红灯**：无。
- **实现步骤**：每个候选记录定义、调用、动态入口、测试覆盖、删除风险；无法证明无调用则保留。
- **验收命令**：CodeGraph 查询结果和 `rg` 动态文字补查；无代码 diff。
- **通过标准**：清单有证据；不凭一次 grep 判死代码；两分支分别审计。
- **常见失败模式**：CodeGraph 找不到对象方法就判死；忽略 inline onclick/global attach；混淆两分支。
- **回滚方式**：删除审计记录。
- **执行 agent 具体提示词**：
  > 只做阶段 5 死代码审计，不删除。使用 CodeGraph callers/impact，并补查动态 HTML、window global、Node test harness。每个候选分类为可删/保留/待确认并给证据。

## 任务 5.2：删除确认无调用的重复适配

- **推荐模型**：Terra，Sol 审查。
- **任务名称**：最小重复适配清理。
- **目标行为**：只删除 5.1 明确认定可删的代码，保留兼容层和公共接口。
- **涉及文件**：由 5.1 清单限定；原则上不超过 3 个生产文件。
- **预计修改函数/导出**：仅“可删”项。
- **禁止修改范围**：行为重写、命名大改、模块拆分、公共 API 未经确认删除。
- **实施前必须阅读**：5.1 证据、相关测试、size-limit。
- **推荐执行顺序**：一组强相关候选 → 测试 → 下一组；必要时拆 commit。
- **先写/修改测试**：若被删代码承担兼容行为，先补公共行为测试；否则不写字符串存在测试。
- **预期红灯**：不要求红灯；目标是保持行为绿。
- **实现步骤**：删除最小代码和导出；清理对应 CSS 仅在选择器无宿主时；不迁移逻辑。
- **验收命令**：相关测试、CI、size-limit、HTML safety、CSS overlap（如改 CSS）。
- **通过标准**：行为不变；体积不增加；无悬空引用；两分支适配一致。
- **常见失败模式**：顺手重构；删除测试 harness 入口；清错 CSS；把兼容读取也删掉。
- **回滚方式**：revert 每个小清理 commit。
- **执行 agent 具体提示词**：
  > 仅删除 5.1 标记“可删”的重复适配。一次一组、最多 3 个生产文件，不重构、不改公共行为。动态入口或兼容层证据不足就保留。

## 任务 5.3：文档状态、生成物与最终验收

- **推荐模型**：Luna，Sol 最终审查。
- **任务名称**：计划闭环与可复现验收。
- **目标行为**：更新两份计划状态、勾选验收、记录命令和视觉 QA，不修改业务。
- **涉及文件**：上位计划、本手册、必要生成物；不得新增业务改动。
- **预计修改函数/导出**：无。
- **禁止修改范围**：运行代码、测试逻辑、size 上限。
- **实施前必须阅读**：所有阶段提交、CI 输出、视觉截图/记录、人工确认结论。
- **推荐执行顺序**：重建生成物 → 两分支总验收 → 视觉 QA → 更新文档。
- **先写/修改测试**：无新增；必须运行全部既定测试。
- **预期红灯**：无；发现失败回到对应任务修复，不在本任务补丁。
- **实现步骤**：记录实际 commit；标记未完成项；不要把未验证项勾选；清理临时测试文件和 profile 目录。
- **验收命令**：最终 checklist 全部命令。
- **通过标准**：文档与代码事实一致；无未解释 diff；两分支可复现。
- **常见失败模式**：仅写“CI 通过”；提前标完成；生成物与源不一致；遗漏 ui 分支。
- **回滚方式**：revert docs-only commit。
- **执行 agent 具体提示词**：
  > 只做最终收口：重跑总验收、记录结果、更新两份计划状态和 checklist。任何业务失败返回对应任务修，不在本任务修改运行代码或提高阈值。

> **执行结果（2026-07-13）**：两分支实现和自动化门禁已收口；`perfrom` 521/521、完整 CI 通过，`ui-mockup` 486/486、逐项等效门禁通过。两分支 430×932、390×844、360×800、1440×900 的模型 chip/picker 已复验。尚未创建 commit；暗色、减少动效、虚拟键盘和真实失败态保留为最终人工视觉检查项。size-limit 的最小调整来自用户明确授权，不是 agent 自行放宽。

---

# 6. 推荐 commit 顺序

以下顺序是逻辑依赖，不代表可以一次性批量提交：

1. `test: cover task registry wiring gaps`
2. `test: cover shared model recents gaps`
3. `test: cover manual fallback routing gaps`
4. `test: cover advice fallback lifecycle gaps`
5. `feat: add AI routing metadata helpers`
6. `feat: connect selectable model metadata`
7. `feat: connect task registry UI metadata`
8. `feat: show model capability compatibility`
9. `fix: normalize manual model metadata`
10. `refactor: expose shared model preference helpers`
11. `feat: order task models by favorites and recents`
12. `feat: share advice model recents`
13. `fix: normalize manual AI fallback targets`
14. `feat: retry food text parsing with fallback`
15. `feat: retry diet photos with fallback`
16. `feat: retry body goal plans with fallback`
17. `feat: retry generated plans with fallback`
18. `feat: retry plan adjustment with fallback`
19. `refactor: unify report fallback retries`
20. `feat: retry quick insights with fallback`
21. `feat: retry advice chat with fallback`
22. `feat: retain advice vision retry payloads in memory`
23. `fix: keep advice continuation on one route`
24. `feat: share model visuals in ui mockup`
25. 按 5–23 的原边界向 `ui-mockup` 同步。
26. `fix: align ui mockup AI controls`
27. `chore: refresh ui mockup assets`
28. 经过 5.1 后的一个或多个小型 `refactor: remove duplicate AI picker adapters`
29. `docs: close AI routing wiring plan`

任何阶段出现回归时，从当前最小 commit 回滚，不跨阶段 squash 后再调试。最终是否 squash 由人工决定。

# 7. 每阶段交给执行 agent 的完整提示词

## 阶段 0 完整提示词

> 你正在执行《AI 功能路由与模型控件闭环：超细实施作战手册》的阶段 0。只建立基线和红灯测试，不得修改生产 JS/CSS。依次完成 0.1–0.5，每个测试主题独立 commit。测试必须覆盖注册表元数据、family、能力三态、最近使用、routeOverride、手动 fallback、Advice chat/vision、File 内存约束、skipUserMessage、自动续写继承和已输出内容禁跨模型。使用最小 harness，不能只检查源码字符串存在。每完成一个任务运行其指定测试并确认新增测试在当前实现上按预期失败，同时原有测试仍通过。发现产品语义不明确时列入人工确认并停止对应测试设计。

## 阶段 1 完整提示词

> 执行阶段 1，只接通任务注册表与模型元数据。先实现纯 helper，再修改 listSelectableModels，再做 group/localPicker，最后做兼容三态 UI 和手动元数据规范化。requiredCapabilities 只驱动 compatible/incompatible/unknown 提示，不硬过滤；不兼容模型仍可由用户确认选择。family 必须从模型缓存透传，不得从名称猜测。group 保持注册顺序，localPicker 只作为显式宿主 guard。每个原子任务独立 commit；不触碰 fallback、Advice 发送、最近使用或供应商凭据。

## 阶段 2 完整提示词

> 执行阶段 2，统一模型收藏和最近使用。沿用 `rehab.ai.modelFavorites.v2` 与 `rehab.ai.modelRecents.v1`，key 固定 `profileId::modelId`，最近记录按 taskId 隔离且最多 3 项。先暴露不可变共享接口，再调整通用 picker，最后接入 Advice picker。收藏、最近、普通模型不得重复；advice.chat 与 advice.vision 必须分开；只有 setTaskRoute 成功后才记录 recent。不得修改发送请求、fallback、附件或数据 schema。

## 阶段 3 完整提示词

> 执行阶段 3，严格按 3.1–3.11 顺序。先规范化 `aiFallback.target`，它只能包含 profileId/modelId；随后逐领域接通 routeOverride。所有手动重试必须从 UI options 一直透传到 ai.run/runStream，不得调用 setTaskRoute 或修改 cfg.taskRoutes。简单领域分别提交；Advice chat、vision、自动续写必须拆开。File 只允许短期内存，不能进入 data.db/localStorage/log/sync/backup。文本 fallback 使用 skipUserMessage 保持消息和版本关系。自动续写继承首段 override；一旦已输出 token/部分内容，禁止跨模型重试。每个任务先跑专用测试，再跑相关回归，不得用完整 CI 替代行为验收。

## 阶段 4 完整提示词

> 执行阶段 4，将 perfrom 已通过的阶段提交同步到 ui-mockup。先做 4.1 提交映射，不得直接修改；随后独立移植共享模型视觉，再按阶段逐 commit cherry-pick 或小 patch。禁止整分支 merge、整文件覆盖和一次解决多组冲突。`advice-panel.js`、`ai-task-settings.js`、`index.html`、`sw.js` 必须人工语义合并。ui-mockup 保留旧供应商布局，只对齐共享视觉、路由、最近使用、fallback、显式推理 advisory、模型 chip 无 x 和切换成功 toast。新增脚本必须同步 index、SW、版本、测试和 size-limit；不得擅自提高阈值，用户明确授权时也只允许最小调整并记录实测体积。

## 阶段 5 完整提示词

> 执行阶段 5，先审计后清理。使用 CodeGraph callers/impact，并补查动态 HTML、window global 和 Node test harness；先形成可删/保留/待确认清单，不得直接删除。只删除有充分证据且有行为测试保护的重复适配，一次最多 3 个生产文件，不做重命名或模块重构。最后重跑两分支总验收、视觉 QA、CSS/版本/size-limit，更新计划状态。任何失败回到对应原子任务修复，阶段 5 不承担业务补丁。

# 8. 阶段完成后的审查 checklist

## 阶段 0 审查

- [x] 两分支基线 commit、merge-base、测试数和 size-limit 已记录。
- [x] 新测试只修改测试文件或审计文档。
- [x] 每个缺口有独立、可解释的红灯。
- [x] 未通过源码字符串存在替代行为测试。
- [x] File 测试明确验证没有序列化进入 db。
- [x] 原有测试未因 harness 污染而失败。
- [x] 所有人工确认问题已记录。

## 阶段 1 审查

- [x] 纯 helper 无 DOM、storage、window 依赖。
- [x] target 规范化不保留未知字段。
- [x] family 正确透传，未由 displayName 推断。
- [x] requiredCapabilities 是三态提示，不是硬过滤。
- [x] unknown 与 incompatible 有不同文案。
- [x] group 保持确认的顺序。
- [x] localPicker 只 guard 显式宿主。
- [x] 不兼容选择取消后不写路由。
- [x] CSS 不只靠颜色表达状态。

## 阶段 2 审查

- [x] 未新增 localStorage key。
- [x] 模型 key 为 `profileId::modelId`。
- [x] 每 task 最近记录最多 3 项。
- [x] 收藏/最近/普通无重复。
- [x] chat/vision 最近记录独立。
- [x] 保存路由失败时不记录 recent。
- [x] 失效模型记录不会渲染空壳。
- [x] 动态名称均安全转义。

## 阶段 3 审查

- [x] 每个领域都有 UI → options → ai helper → run/runStream 的参数断言。
- [x] 手动重试从未调用 `setTaskRoute`。
- [x] `aiFallback.target` 只含 profileId/modelId。
- [x] automatic fallback 行为无回归。
- [x] 不可重试、取消、已 emitted 错误不显示手动 action。
- [x] food text 输入、goal 表单、plan sheet 状态按契约保留。
- [x] auto-adjust 重试重新读取数据并走 policy。
- [x] report/summary action 防多击。
- [x] insight cache 使用实际模型身份。
- [x] Advice chat 不重复用户消息，版本关系正确。
- [x] Advice vision File 只在运行期 Map，所有出口清理。
- [x] 页面刷新后视觉重试正确退化为重新附图。
- [x] 自动续写继承同一 override。
- [x] 已输出部分内容后无跨模型拼接。
- [x] 日志、错误、同步、备份不含凭据和 File。

## 阶段 4 审查

- [x] 有最新同步矩阵，不使用旧 hash 猜测。
- [x] 未执行整分支 merge 或整文件覆盖。
- [x] 同步按原子任务文件范围执行；当前尚未创建 commit。
- [x] ui 特有供应商布局保留。
- [x] 共享 visual 加载顺序和 prerequisite 正确。
- [x] `ai-model-visual.js` 已进入 SW precache。
- [x] 模型 chip 无 x，完整抽屉仍可恢复默认。
- [x] toast 只在保存成功后显示。
- [x] 显式推理 advisory 与 perfrom 一致。
- [x] CSS 生成物由脚本生成。
- [x] size-limit 仅按用户明确授权最小调整。

## 阶段 5 审查

- [x] 每个删除项有 CodeGraph、动态入口和测试证据。
- [x] 未因 CodeGraph 不识别对象方法就误删。
- [x] 兼容读取层仍保留。
- [x] 清理后体积未突破授权后的预算。
- [x] 两分支行为测试一致。
- [x] 上位计划和本手册状态与事实一致。
- [x] 未验证项没有被勾选完成。

# 9. Service Worker、CSS 与 size-limit 处理边界

## Service Worker

- 只有新增/删除/改名浏览器脚本或资产、改变加载顺序时修改 `index.html` 和 `sw.js`。
- 新浏览器脚本必须同时进入 lazy dependency/prerequisite 和 precache。
- 版本号必须由项目版本脚本校验，不手工只改一处。
- 不因普通函数内部修改额外增加 precache 项。
- SW 测试必须验证资产实际存在，而非仅匹配字符串。

## CSS

- 设置页状态与分组放 `css-src/20-settings-ai.css`。
- Advice picker 区段放 `css-src/48-advice-model-picker.css`。
- 暗色 token 只允许在 `css-src/37-dark-mode.css`。
- 不把本轮规则临时塞进 `99-custom-overrides.css`；若触碰 host，清空对应 queue。
- 任何 CSS 修改后运行 build、markers、sources、99-targets、overlap。
- `build/generated.css` 和报告必须由脚本生成，不手工编辑。

## size-limit

- 每个新增模块或显著 UI 逻辑任务后运行局部 size-limit，而不是只在最后运行。
- 默认禁止提高 `.size-limit.cjs` 上限；本轮仅接受用户在 2026-07-13 明确授权的最小调整，并在最终记录中保留调整后实际体积与余量。
- 超限时先删除重复、缩小接口、复用 helper；不得压缩可读性或删除测试。
- `.size-limit.cjs` 若被并发任务修改，必须先确认改动来源，不能直接覆盖。

# 10. 最终合并前总验收 checklist

## 分支与差异

- [x] `perfrom` 和 `ui-mockup` 工作树改动来源明确；尚未提交。
- [ ] 每个 commit 单一目的且可独立 revert。
- [x] 无 `.codex-remote-attachments/`、临时 profile、截图缓存或用户文件进入工作树变更。
- [x] 两分支不存在意外整文件覆盖痕迹。

## 产品行为

- [x] 13 个注册任务均实际消费任务路由。
- [x] 所有适用任务有手动备用重试。
- [x] 手动重试不改变持久化主/备用设置。
- [x] 自动 fallback 无回归。
- [x] 已输出内容后不跨模型。
- [x] Advice chat/vision 最近使用分离。
- [x] 收藏与最近语义跨 picker 一致。
- [x] family/group/localPicker/requiredCapabilities 均有行为测试。
- [x] ui-mockup 与 perfrom 的模型视觉和路由语义一致。

## 安全与数据

- [x] target 只含 profileId/modelId。
- [x] 未记录 API Key、Authorization、带凭据 URL。
- [x] File/Blob/base64 未进入 db、localStorage、日志、sync、backup。
- [x] 新动态字符串均 textContent 或 escape。
- [x] `npm run check:html-safety` 通过且新增 sink 已明确审计。
- [x] 无数据 schema 迁移。

## 测试与构建

- [x] 每个原子任务的专用测试通过。
- [x] 两分支 `npm run test` 通过：`perfrom` 521/521，`ui-mockup` 486/486。
- [x] 两分支 lint/typecheck 通过；`ui-mockup` 变更 JS 使用 `eslint --no-ignore`。
- [x] `npm run build:css` 可重复生成无额外业务 diff。
- [x] `npm run check:css` 通过，overlap 无未解释增加。
- [x] `node scripts/bump-version.js --check` 通过：v323 / v316。
- [x] Service Worker 离线导航和新增资产测试通过。
- [x] `npx --yes size-limit` 在用户授权后的最小预算下通过。
- [x] `perfrom` 的 `npm run ci` 通过，并有上述专项证据。
- [x] `ui-mockup` 因 `.worktrees/` 被 ESLint 默认忽略而无法直接使用 CI 包装命令；已逐项执行等效门禁。

## 视觉与交互

- [x] `430×932`、`390×844`、`360×800` 和 `1440×900` 的模型 chip/picker 已检查，两分支均无页面横向溢出。
- [ ] 浅色/暗色/减少动效状态已检查。
- [x] 三态能力提示有图标/文案，不只靠颜色；行为和样式测试通过。
- [ ] 收藏/最近/family 区段无横向溢出。
- [ ] fallback toast/气泡可键盘操作且不会多击。
- [ ] 虚拟键盘下 Advice composer 和错误操作可见。
- [ ] 视觉附件刷新后的退化文案准确。

## 文档与人工确认

- [x] 所有实施阻塞问题已有明确结论：1.4 复用现有 modal；1.5 自定义标签按 unknown；size-limit 可最小扩大；用户 UI/CSS 不视为越权。
- [x] 结论已反映到测试和实现，没有隐含假设。
- [x] 上位计划状态已更新。
- [x] 阶段 0–5 自动化审查 checklist 已签核。
- [x] 最终审查记录包含未解决视觉风险、未提交状态和回滚点。

## 10.1 最终执行摘要（2026-07-13）

- `perfrom`：521/521；`npm run ci`、CSS、HTML safety、size-limit、版本 v323 全部通过；AI 133.53/134 kB，plan 72.48/72.5 kB。
- `ui-mockup`：486/486；typecheck、CSS、HTML safety、size coverage、`eslint --no-ignore`、size-limit、版本 v316 全部通过；AI 127.52/130 kB，plan 72.07/72.1 kB。
- `ui-mockup` 修复 `app-update.js` 静态与 idle lazy 双加载；修复后运行时脚本节点为 1，未再出现重复声明错误。
- CodeGraph 清理保留共享 resolver、动态全局和兼容读取层，仅删除有 callers/impact、动态入口和行为测试证据的旧适配。
- 两分支改动尚未提交；回滚应按原子任务文件组或未来小 commit 进行，不能整分支 ours/theirs。
- 未完成的人工视觉项：暗色、减少动效、虚拟键盘、真实 fallback toast/气泡、视觉附件刷新退化文案。
