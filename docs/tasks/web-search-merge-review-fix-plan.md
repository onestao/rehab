# AI 联网检索合并复审修复计划

> 日期：2026-07-29  
> 状态：Sprint 1 历史修复记录；Sprint 2–4 与后续复审修复见 `web-search-next-capability-plan.md`
> 实施分支：`perfrom`  
> 固定审阅基线：`perfrom`
> 原始规格：`docs/tasks/web-search-integration-design.md`  
> 历史基线：v398；本文件保留为 Sprint 1 历史修复记录
> 浏览器门禁：通过 `AUDIT_CHANNEL` 明确选择宿主可用通道；本次自动化完整门禁实际使用 Chromium。Edge 仅在执行宿主可解析 `msedge` 分发时运行，不再把通道缺失写成代码失败或安装状态结论
> 目标：关闭合并复审剩余的 5 个 P1 与 4 个 P2 规格缺口，并补齐能证明行为闭环的回归测试。

## 1. 当前结论

本轮已关闭合并复审列出的 5 个 P1 与 4 个 P2 非浏览器缺口，并恢复 lint、typecheck、Node 测试、CSS、HTML safety、size-limit、版本和 diff 门禁。

本节仅记录 Sprint 1 当时的非浏览器修复范围。当前环境已可运行 Edge/Chromium 浏览器测试，最终是否可合并应以后续 Sprint 2–4 复审记录与当次干净 CI 为准。

以下 9 项为本轮关闭范围：

| 编号 | 优先级 | 问题 | 主要文件 |
|---|---|---|---|
| F1 | P1 | 编辑后可绕过 required 食物核实 | `food-log.js`、`food-evidence.js` |
| F2 | P1 | 官方等级未由证据匹配关系决定 | `food-evidence-pure.mjs`、`food-evidence.js` |
| F3 | P1 | `providerId` 可绕过有序后备 | `search-tool-loop.js` |
| F4 | P1 | JSON 重试未共享两次搜索预算 | `ai-api.js`、各任务调用方 |
| F5 | P1 | `advice.vision` 无外部搜索路径 | `search-tool-loop.js`、`ai-api.js`、`advice-panel.js` |
| F6 | P2 | `official-preferred` 未稳定优先官方结果 | `search-adapters.js` |
| F7 | P2 | 任务级多供应商选择与排序错误 | `ai-task-settings.js`、`search-registry.js` |
| F8 | P2 | 食物 DIY 证据卡缺少数值变化 | `search-evidence-ui.js`、`18-health-diet.css` |
| F9 | P2 | 首次联网说明及能力恢复路径缺失 | `ai-task-settings.js`、`search-registry.js` |

## 1.1 本轮实施结果（v391）

- [x] F1：新增独立食物核实状态，required 失败或已核实条目编辑后进入 `invalidated`，单项与批量保存共用同一判定。
- [x] F2：官方等级改由有效证据 ID、官方性和可信匹配关系确定，模型自报等级不再提升结果。
- [x] F3：模型 `providerId` 不再参与候选选择，外部供应商严格按任务顺序逐请求扣减预算。
- [x] F4：`run()` fallback 与 `runJson()` JSON 重试共享同一搜索预算；预算耗尽后 required 路径返回 `SEARCH_TOOL_LIMIT`。
- [x] F5：`advice.vision` external-only 接入隐藏的图片上下文提取 → 文本搜索工具循环两阶段路径，并保留统一来源。
- [x] F6：`official-preferred` 使用稳定分组排序，官方结果优先且组内顺序不变。
- [x] F7：任务级供应商可连续选择、上移/下移，并显示禁用、归档和已删除引用。
- [x] F8：食物证据卡统一展示基础值、add/remove/replace/portion 数值变化、合计、假设和安全来源。
- [x] F9：首次启用说明仅保存在本地偏好；不同任务显示准确隐私文案，并提供原生能力原因与恢复操作。

本轮历史验证当时聚焦非 Playwright 门禁；浏览器专项与完整门禁的现状以 `web-search-next-capability-plan.md` 为准。

## 2. 实施边界

### 2.1 必须遵守

1. 保持静态、本地优先 PWA；不新增后端、bundler、通用代理或任意 URL reader。
2. 不改变现有 AI/Search 密钥隔离和加密同步路径。
3. 所有网络策略默认仍为 `off`；旧配置升级后不能自动联网。
4. 每次用户动作的搜索预算固定为最多 2 次，模型重试、模型 fallback、供应商 fallback 和自动续写共享同一预算对象。
5. 搜索摘要、标题、URL、模型 JSON、同步记录继续视为不可信输入。
6. required 搜索失败时不能通过普通字段编辑隐式变成可保存状态。
7. 证据不足时宁可降级为估算或待确认，不得展示无法证明的官方精确等级。
8. 不顺手修改 Advice 附件图标、启动样式容错或其他与联网检索无关的现有差异。

### 2.2 明确不做

1. 不引入通用网页正文读取。
2. 不允许模型自行把任意域名提升为官方来源。
3. 不让搜索结果自动修改训练计划、康复处方或既有食物记录。
4. 不扩大每次动作的搜索次数来掩盖后备失败。
5. 不通过单纯提高 size-limit 完成门禁。

## 3. 目标状态机与核心契约

## 3.1 食物核实与保存状态

不要再以 `_aiFoodEvidence[idx] === null` 同时表达“从未核实”“编辑后失效”和“不需要核实”。为每个草稿增加独立、显式的核实状态。名称可以调整，但语义必须等价：

```js
{
  required: boolean,
  state: 'not-required' | 'pending' | 'verified' | 'estimated' |
         'needs-confirmation' | 'unavailable' | 'invalidated',
  evidence: FoodEvidence | null
}
```

保存规则：

| 状态 | 单项保存 | 批量保存 |
|---|---|---|
| `not-required` | 允许 | 允许 |
| `verified` | 允许 | 允许 |
| `estimated` 且策略允许 `local-estimate` | 允许，并保留估算标记 | 允许，并保留估算标记 |
| `pending` | 禁止 | 跳过并提示 |
| `needs-confirmation` | 禁止 | 跳过并提示 |
| `unavailable` | 禁止 | 跳过并提示 |
| `invalidated` | 禁止，必须重新核实 | 跳过并提示 |

任何编辑都执行：

1. 清除旧证据引用。
2. 将原本需要核实的条目标记为 `invalidated`，不能改回普通 `null`。
3. UI 显示“已编辑，需重新核实”，并保留重新核实按钮。
4. required 模式只有重新核实成功后才能保存。

如果产品以后需要“用户手动覆盖并确认”，必须单独设计显式确认操作和持久化来源标记；本轮不能把普通 `input` 事件当作确认。

## 3.2 官方证据等级

新增纯函数，例如：

```js
deriveFoodEvidenceTier({ base, modifications, evidence })
validateEvidenceLinks({ base, modifications, evidence })
```

规则：

1. `base.evidenceIds` 和每个 modification 的 `evidenceIds` 必须引用实际存在的证据 ID。
2. `official-exact` 至少需要一个与基础餐品关联的官方证据，并确认品牌、产品、市场和规格/份量匹配。
3. `official-composed` 要求基础项及参与计算的每个增减/替换项均有对应的官方证据引用。
4. 只有域名规则、结构化适配器或用户明确确认才能产生可信的 `match`；模型文本声明不能单独提升匹配状态。
5. `database-estimate` 至少需要数据库型证据或结构化食材拆分。
6. 其余情况统一降为 `vision-estimate`，并在存在规格冲突时设置 `needs-confirmation`。
7. 规范化层必须覆盖模型返回的 `confidenceTier`；UI 只消费规范化后的等级。

若当前外部搜索结果无法可靠填充 `match`，允许 v1 保守地不产生 `official-exact`，不能用“任意官方链接”替代精确匹配。

## 3.3 搜索预算

预算对象由一次用户动作的最上层入口创建：

```js
const searchBudget = { limit: 2, remaining: 2, attempts: [] };
```

必须在以下路径共享同一引用：

- `ai.run()` 的模型 fallback 序列。
- `runJson()` 的首次生成和 JSON 格式重试。
- Advice 自动续写。
- 多食物并发核实。
- 原生搜索失败后的外部搜索。
- 外部供应商按序故障转移。

计数语义：一次实际原生工具尝试或一次外部供应商 HTTP 搜索请求消耗 1。供应商 A 失败后请求供应商 B 应再消耗 1，不能把整条故障转移链计为一次。

预算耗尽时返回稳定错误码 `SEARCH_TOOL_LIMIT`；不得继续联网，但允许按任务策略进入本地估算、要求用户或失败路径。

## 3.4 有序供应商选择

模型不负责选择搜索供应商。推荐从 `search_web` function schema 中移除 `providerId`；为兼容旧响应，解析器可以继续接受该字段，但不能用它缩窄候选列表。

运行规则固定为：

1. 根据任务 `providerIds` 得到唯一、有序、启用且未归档的候选列表。
2. 按列表顺序尝试。
3. 每次真实供应商请求单独扣减预算。
4. 成功返回非空规范化结果后停止。
5. 空结果是否继续后备需固定：`required` 和 `official-only` 继续尝试；普通 `auto` 可在全部失败后降级。
6. 错误只向模型回注安全错误码，不暴露密钥、请求头或原始响应。

## 3.5 图片建议的外部检索

不直接把带图片的现有请求强塞进文本 tool loop。采用两阶段路径：

```text
图片 + 用户问题
→ 视觉模型提取最小、非诊断性的检索上下文/关键词
→ 文本 search_web 工具循环
→ 搜索证据 + 图片摘要 + 原问题生成最终回答
```

要求：

1. 第一阶段不得输出给用户，也不得写入聊天记录。
2. 只生成检索所需的图像描述和关键词，不生成医学诊断。
3. 外部检索继续使用原任务的策略、供应商顺序和共享预算。
4. 最终回答保存统一 `SearchEvidence`。
5. `external-only` 不得静默执行离线回答；不可用时按配置明确失败/询问/估算。
6. 视觉模型或附件处理失败时保持现有安全错误与备用模型行为。

## 4. 分阶段实施

## 阶段 0：先建立红灯测试

在改实现前增加能在当前代码上失败的测试：

1. `test/search-policy.test.mjs`
   - 无关官方链接不能产生 `official-exact`。
   - `official-composed` 缺少任一组件证据时降级。
   - 伪造/缺失 `evidenceIds` 被拒绝或降级。
   - 品牌、市场、规格不一致进入 `needs-confirmation`。
2. `test/food-evidence-adapter.test.mjs`
   - required 失败后编辑仍不可保存。
   - 编辑已核实条目进入 `invalidated`。
   - 重新核实成功后恢复可保存。
3. `test/search-tool-loop.test.mjs`
   - 指定旧 `providerId` 后仍按策略顺序后备。
   - 第一个供应商失败、第二个成功消耗两次预算。
   - 预算剩余 1 时不得请求第二个供应商。
4. `test/ai-run-json.test.mjs`
   - JSON 重试复用同一个预算对象。
   - 首次已消耗两次时，重试不能再次联网。
5. 新建或扩展 Advice 网络测试
   - `advice.vision + external-only` 进入两阶段外部检索。
   - 图片路径证据被持久化并可渲染。
6. 新建 `test/search-evidence-ui.test.mjs`
   - add/remove/replace/portion 均展示数值变化。
   - 来源、标题、假设和数值继续安全转义。
7. 新建或扩展任务设置测试
   - 连续勾选两个供应商不会互相覆盖。
   - 上移/下移改变 `providerIds` 的任务级顺序。
   - 首次启用说明只显示一次。
   - 原生不可用时展示原因与恢复建议。

阶段完成标准：上述每个缺口至少有一个稳定红灯，失败原因必须指向行为而不是仅检查源码字符串。

## 阶段 1：修复食物状态与证据等级

### 修改 `food-log.js`

1. 引入独立草稿核实状态，不再以 evidence 是否为 `null` 判断保存权限。
2. `updateAiFoodDraft()` 将需核实条目标记为 `invalidated`。
3. 单项和批量保存调用同一个纯保存判定 helper，避免规则再次分叉。
4. 批量保存结束后明确提示保存数、跳过数和跳过原因。
5. 持久化结构继续只保存安全的证据摘要和 URL。

### 修改 `food-evidence-pure.mjs`

1. 增加证据引用校验和等级推导函数。
2. 忽略模型自报的更高等级；输出等级由证据推导结果覆盖。
3. 校验 base、replace、portion 和普通增减项的证据完整性。
4. 保持现有 replace/portion 算术及空区间行为不回归。

### 修改 `food-evidence.js`

1. 第二阶段模型只负责提出结构化基础项、改动项、假设及证据 ID 关联。
2. 最终状态和等级完全交给 pure 模块决定。
3. required 无证据、匹配冲突或证据引用错误时返回不可保存状态。

## 阶段 2：修复预算和有序后备

### 修改 `ai-api.js`

1. `runJson()` 在入口创建或接收共享 `searchBudget`。
2. 首次 `run()` 和格式重试均透传同一预算引用及显式 `networkPolicy`。
3. JSON 重试前若预算耗尽，强制关闭联网并复用已有证据上下文；required 且无法满足时明确失败。
4. 不让模型 fallback 创建新预算。

### 修改 `search-tool-loop.js`

1. 从 function schema 移除模型可控的 `providerId`。
2. 兼容解析旧字段，但候选顺序始终来自任务策略。
3. 将预算扣减移动到每个实际 provider 请求之前。
4. 记录安全的 attempts 元数据用于测试和诊断，不记录 query 全文或凭据。
5. 对空结果、超时、HTTP 错误和预算耗尽写清楚故障转移边界。

### 修改任务调用方

以下入口应在一次用户动作开始时建立预算并完整透传：

- `advice-panel.js`
- `health-profile.js`
- `food-log.js`
- `health-diet.js`
- 其他允许联网且可能触发 `runJson()` 重试的任务入口

不要只修康复入口；应由 `runJson()` 提供默认共享保证，调用方只在跨多个 AI 调用组成同一动作时显式共享。

## 阶段 3：接通 `advice.vision` 外部路径

1. 在 adapter 层增加图片到检索上下文的最小转换，不把图片处理放入 pure 模块。
2. 第一阶段输出采用严格 JSON，例如 `{ query, imageContext, uncertainties }`。
3. 对 query 执行现有 240 字符限制和控制字符清理。
4. 外部 tool loop 使用文本消息，不携带完整健康档案或无关历史。
5. 最终回答调用保留原来的 Advice 流式渲染，并在结束时一次性保存引用。
6. required/external-only 全部失败时保留失败气泡与重试，不产生伪装成联网结果的离线回答。

## 阶段 4：修复来源策略和任务供应商 UI

### `search-adapters.js`

对 `official-preferred` 做稳定分组排序：官方结果在前，组内保持供应商原始顺序。不得删除非官方结果；`official-only` 继续严格过滤。

### `ai-task-settings.js`

1. 每次 checkbox change 都从最新 `currentNetwork().providerIds` 计算，不捕获初始数组。
2. 为已选供应商提供任务级上移/下移按钮。
3. 展示序号、禁用/归档状态和已删除引用，不让不可用项静默消失。
4. 全局供应商排序只用于新任务的初始推荐顺序；已有任务以自身 `providerIds` 为准。
5. 删除供应商时以不可变方式重建 route/network，不能直接修改可能已冻结的 network 对象。

### `search-registry.js`

1. 保持任务 `providerIds` 顺序为唯一运行优先级。
2. 对重复、未知、禁用和归档 ID 做稳定过滤。
3. 增加返回能力原因的接口，例如 `nativeCapabilityState()`；保留 `nativeUsable()` 作为布尔兼容 facade。

## 阶段 5：补齐证据 UI 与首次启用体验

### `search-evidence-ui.js`

DIY 行显示实际变化：

- remove：`−80 kcal · 蛋白 −1 g`
- add：`+120 kcal · 蛋白 +6 g`
- replace：`旧项 −220 + 新项 160 = 净 −60 kcal`
- portion：`份量 ×0.5`

同时显示基础值、小计/合计、假设、待确认项和来源；草稿与历史记录使用同一安全 renderer 或同一组小 helper，避免语义分叉。

### `css-src/18-health-diet.css`

1. 为 `.food-evidence-panel/line/block/list/sources` 补齐 M3E + 液态玻璃容器样式。
2. 保持 360 px 可读，不使用横向宽表。
3. 操作按钮至少 44 px 点击高度。
4. 使用现有 glass token，不新增深浅主题 token。
5. 遵守 reduced-motion。

### `ai-task-settings.js`

1. 首次把食物任务从 `off` 改为 `auto/required` 时显示一次性隐私说明。
2. 文案说明只发送餐品、品牌、地区、规格和用户明确附带的信息。
3. 非食物任务使用真实任务文案；康复任务不得显示“只发送餐品信息”。
4. 显示当前模型的原生联网状态及原因：可用、能力未知、Chat dialect 未确认、Gemini 域名白名单不兼容等。
5. 提供恢复操作：切换外部优先、配置后备供应商、移除不兼容域名限制或选择支持模型。
6. 一次性说明状态只保存在本地 UI preference，不进入普通同步数据。

## 5. 文件级任务清单

| 文件 | 必要修改 |
|---|---|
| `food-evidence-pure.mjs` | 证据引用校验、确定性等级推导、匹配冲突处理 |
| `food-evidence.js` | 模型输出与最终等级解耦、required 失败状态 |
| `food-log.js` | 独立草稿核实状态、编辑失效、统一保存 guard |
| `search-tool-loop.js` | 移除模型供应商决策、逐请求预算、有序后备 |
| `ai-api.js` | `runJson` 首次/重试共享预算与策略 |
| `search-adapters.js` | `official-preferred` 稳定排序 |
| `search-registry.js` | 任务顺序、能力状态原因接口 |
| `ai-task-settings.js` | 最新状态 checkbox、任务级排序、首次说明、恢复路径 |
| `advice-panel.js` | 图片外部检索两阶段编排及共享预算 |
| `health-profile.js` | 康复 JSON 重试共享预算、来源保留 |
| `search-evidence-ui.js` | DIY 数值、基础/改动/合计、历史一致展示 |
| `css-src/18-health-diet.css` | 完整食物证据卡 M3E/玻璃样式 |
| `build/generated.css` | CSS 构建产物 |
| 对应测试文件 | 阶段 0 的红灯和回归测试 |
| `index.html` / `sw.js` | 仅在新增浏览器脚本时修改并提升版本 |

## 6. 验收场景

## 6.1 食物

- [ ] required 联网失败后，编辑名称、克数或热量仍不能保存。
- [ ] 编辑已核实条目后显示“需重新核实”，旧来源不再显示。
- [ ] 无匹配品牌/市场/规格证据时不能显示“官方数据”。
- [ ] 任意官方域名链接不能单独产生 `official-exact`。
- [ ] official composed 的基础项及每个 DIY 项均能追溯到对应证据。
- [ ] replace、portion、remove、add 均显示数值变化和最终合计。
- [ ] 历史记录继续显示等级、计算、假设和可点击来源。

## 6.2 搜索循环

- [ ] 模型返回旧 `providerId` 时仍遵守任务配置顺序。
- [ ] 供应商 A 失败、B 成功消耗两次预算。
- [ ] 预算只剩一次时不会请求第二个供应商。
- [ ] JSON 格式重试不会获得新预算。
- [ ] 模型 fallback、外部 fallback 和自动续写共享预算。
- [ ] `official-preferred` 稳定地把官方来源排在前面。
- [ ] empty `providerIds` 仍不会选择任意供应商。

## 6.3 健康与康复

- [ ] `advice.chat` 原生/外部来源继续持久化并展示。
- [ ] `advice.vision + external-only` 能实际完成外部检索。
- [ ] 图片检索失败时不伪装为已联网回答。
- [ ] `rehab.weekly` JSON 重试不突破两次搜索预算。
- [ ] 康复引用保存到处方记录并可点击查看。
- [ ] 康复任务的隐私说明准确描述将发送的处方文本，而非餐品信息。

## 6.4 设置 UI

- [ ] 连续勾选两个供应商后两者均保留。
- [ ] 任务级上移/下移会改变实际故障转移顺序。
- [ ] 归档、删除和禁用状态不会静默留下可重新激活的隐藏引用。
- [ ] 首次启用联网显示一次性说明，此后不重复打扰。
- [ ] 原生搜索不可用时显示具体原因和至少一个恢复操作。

## 7. 安全与回归测试

1. 恶意 evidence title/url/domain/assumption/DIY label 不能注入 HTML 或属性。
2. 搜索错误、预算 attempts 和日志中不得出现 API Key、Authorization、Cookie、完整响应或敏感健康上下文。
3. SearXNG 继续只允许 HTTPS 公网域名、固定 `/search` 路径和 `credentials: 'omit'`。
4. 证据关联数组限制 20 项，文本和 query 限制保持不变。
5. 断网时旧的本地食物、建议和康复功能保持可用。
6. 普通 `150 g 米饭` 不触发 auto 搜索。
7. 旧备份缺少 network/evidence 新字段时仍默认离线且可读取。
8. 新增 HTML sink 必须经过现有 HTML safety 审核。

## 8. 必跑命令

每完成一个阶段先运行最相关测试，最终必须依次执行：

```powershell
npm run build:css
npm run check:css-overlap
node scripts/bump-version.js --check
npm run ci
git diff --check perfrom
```

如果新增或调整浏览器脚本：

1. 同步 `index.html` 加载顺序和依赖声明。
2. 同步 `sw.js` precache。
3. 执行 `node scripts/bump-version.js --patch` 后再次运行版本检查。

不要声称完成，除非命令实际执行且退出码为 0。

## 9. 建议提交顺序

1. `test: cover remaining web search merge gaps`
2. `fix: enforce food verification and evidence tiers`
3. `fix: share search budgets across retries`
4. `fix: enforce ordered provider failover`
5. `feat: support external search for advice images`
6. `fix: align task search provider controls`
7. `feat: complete food evidence and network onboarding ui`
8. `test: close web search integration regressions`
9. `chore: rebuild css and bump pwa version`

每个提交只包含一个可独立验证的行为切片；不要把所有业务逻辑、CSS 产物和版本更新压成单个提交。

## 10. 接手 Agent 开工检查

开始前执行：

```powershell
git rev-parse --show-toplevel
git status --short --branch
git log perfrom..HEAD --oneline
```

然后确认：

1. 当前改动仍位于 `perfrom` 工作区，且未覆盖用户的其他修改。
2. 先阅读 `AGENTS.md` 和 `docs/tasks/web-search-integration-design.md`。
3. 先补红灯测试，再实现对应阶段。
4. 不执行 `git reset --hard`、`git checkout --` 或整分支覆盖。
5. 每完成一个阶段更新本文件的状态与验收勾选项。

## 11. 完成定义

只有同时满足以下条件，本计划才能标记为完成：

1. 9 个复审问题均有对应自动化回归测试。
2. required 食物状态无法通过普通编辑绕过。
3. 官方等级由证据链接和匹配关系决定，而非模型自报。
4. 所有重试、后备和多模型调用共享每次动作最多 2 次搜索预算。
5. 外部供应商始终按任务配置顺序自动后备。
6. `advice.vision` 的 external-first/external-only 设置具有真实运行路径。
7. DIY 数值证据链、首次隐私说明和能力恢复 UI 完整可用。
8. 离线降级、凭据隔离和历史证据完整性无回归。
9. 完整 CI、CSS、size-limit、版本和 diff 检查全部通过。
10. 再次以 `perfrom` 为基线执行 Standards/Spec 合并复审，两个轴均为 0 findings。
