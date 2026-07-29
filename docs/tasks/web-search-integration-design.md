# AI 联网检索与食物证据核实接入设计

> 日期：2026-07-29
> 状态：提案，尚未实施
> 目标：在不引入后端或 bundler 的前提下，为静态、本地优先 PWA 增加按任务可控的联网检索；优先解决品牌食品、包装食品和 D.I.Y. 快餐的营养核实。

## 1. 结论与范围

联网检索应成为 AI 的**受控能力**，而不是全局默认行为或任意 URL `fetch`。系统同时支持两条执行路径：

1. **模型原生联网**：在供应商 API 请求中启用该模型支持的 Web Search 工具，由供应商完成检索、网页理解和引用。
2. **外部搜索服务**：用户配置一个受支持的搜索服务；模型通过受限的 `search_web` 工具请求检索，应用将规范化结果回传给模型。

食物识别是第一优先级，但目标并非承诺“精确测出热量”。目标是建立可追溯链路：

```text
用户描述 / 图片 / 订单信息
→ 识别基础餐品与改动
→ 检索官方或结构化营养证据
→ 基础值 − 去除项 + 添加项
→ 展示假设、误差等级和证据
→ 用户确认后才写入饮食记录
```

本次不做：后端、通用网页爬虫、任意 URL 读取工具、自动修改康复处方、静默将联网结果写入用户记录。

## 2. 当前基础与接入点

项目已有适合复用的基础：

- `ai-routing.js` 注册 14 个任务，已按任务保存主模型、推理深度与备用模型；`food.text` 和 `food.vision` 已是独立任务。
- `ai-task-settings.js` 已有“功能模型”矩阵和完整设置 Sheet；不需要新增平行的设置入口。
- `ai-provider-manager.js` 已有供应商列表、详情、启用/归档、模型发现和测试连接的交互模型。
- `ai-api.js` 已按 OpenAI Chat、OpenAI Responses、Claude、Gemini 分发请求，但没有发送工具定义、处理 tool call 或保存搜索引用。
- 食物识别的 JSON 已包含 `ingredients`、`source`、`confidence`、`note`；但这些字段目前可由模型自行估算，不是可验证证据。
- `food-log.js` 已允许用户在保存前编辑 AI 识别草稿，是接入“核实后确认”最安全的落点。

现有 UI 使用 M3E 与液态玻璃：`ai-task-settings` 的紧凑控制、`ai-provider-manager` 的分层管理器、`20-settings-ai.css` 的设置容器、`18-health-diet.css` 的饮食结果卡以及既有玻璃变量、圆角 Chip、短弹簧反馈和底部 Sheet，均应复用。

## 3. 用户可见行为契约

### 3.1 每个 AI 任务的联网策略

每个任务在现有 `taskRoutes[taskId]` 中新增 `network` 子对象。默认值必须为离线，旧配置升级后行为不变。

| 字段 | 可选值 | 语义 |
|---|---|---|
| `mode` | `off` / `auto` / `required` | 不联网；模型按规则决定；本次必须先尝试检索 |
| `execution` | `native-first` / `native-only` / `external-first` / `external-only` | 模型原生联网与外部搜索的优先顺序 |
| `providerIds` | 搜索供应商 ID 列表 | 外部搜索的候选和顺序；空列表不代表任意供应商 |
| `sourcePolicy` | `official-preferred` / `official-only` / `any` | 来源筛选与降级边界 |
| `fallback` | `local-estimate` / `ask-user` / `fail` | 联网不可用或证据不足时的行为 |
| `allowedDomains` | 域名列表，最多 20 项 | 任务级附加白名单；只可进一步收紧全局规则 |

推荐默认值：

| 任务 | 联网 | 执行 | 来源 | 失败后的行为 |
|---|---|---|---|---|
| `food.text` | `auto` | `native-first` | `official-preferred` | 本地估算并标记 |
| `food.vision` | `auto` | `native-first` | `official-preferred` | 要求补充品牌/规格，或估算 |
| `advice.chat` / `advice.vision` | `off` | `native-first` | `official-preferred` | 普通离线回答 |
| 康复、计划、周/月总结、后台洞察 | `off` | — | — | 保持现状 |

`auto` 不等于不受限制地上网。它只在输入出现品牌、连锁餐品、包装食品、菜单/订单、D.I.Y. 改造、用户要求“核实/来源/最新”或模型无法形成可信份量时触发。普通“150 g 米饭、两个鸡蛋”保持离线。

### 3.2 执行结果与降级

| 情况 | 行为 | UI 文案 |
|---|---|---|
| 原生联网可用且成功 | 使用供应商引用，记录证据 | `已联网核实 · 官方优先` |
| 原生能力不可用，外部后备成功 | 运行一次 `search_web`，返回证据给模型 | `已使用：{供应商名}` |
| 无匹配官方来源 | 不伪造精确值；使用本地库/配料估算 | `未找到匹配官方数据，以下为估算` |
| 必须联网但全部失败 | 不写入估算值；提供重试与编辑 | `联网核实失败，尚未生成可确认数据` |
| 结果与用户图片/改动矛盾 | 停在草稿状态，要求选择或补充 | `请确认规格或改动项` |

任何情形下，AI 不得因搜索结果直接保存食物、改动已有记录、修改训练计划或输出“医学诊断”。

## 4. 配置与持久化设计

### 4.1 全局搜索供应商

在 `ai.cfg` 中保存不含密钥的元数据；密钥单独保存在 IndexedDB/localStorage 的新 `searchKeyMap`，沿用现有 AI 凭据的加密同步路径。不得把 API Key、Authorization header、Cookie 或完整请求日志写入 `data.db`、普通同步数据或 toast。

```js
{
  searchSchemaVersion: 1,
  searchProviders: [{
    id: 'search_...',
    name: 'Tavily 主检索',
    type: 'tavily',             // v1 仅接受受支持的适配器类型
    enabled: true,
    archived: false,
    sortOrder: 0,
    region: 'CN',
    options: { maxResults: 5, timeoutMs: 8000 }
  }],
  networkDefaults: {
    sourcePolicy: 'official-preferred',
    allowedDomains: [],
    maxToolCalls: 2,
    maxResultChars: 12000
  }
}
```

v1 预设供应商应少而明确：一个无密钥/本地可用选项（若浏览器兼容性验证通过）、一个有 API Key 的搜索 API、一个可自托管实例类型。不要在第一版开放“任意 endpoint + 任意 JSONPath + 任意 header”；这类配置既难验证，也容易被误配为任意请求代理。

新增或修改供应商时：输入框使用 `type=password`；保存后只显示掩码；“测试连接”使用固定、无健康信息的查询；失败信息脱敏。

### 4.2 任务路由扩展

```js
taskRoutes['food.vision'] = {
  primary: { profileId, modelId },
  reasoningDepth: 'low',
  fallbackMode: 'manual',
  fallbacks: [],
  network: {
    mode: 'auto',
    execution: 'native-first',
    providerIds: ['search_...'],
    sourcePolicy: 'official-preferred',
    fallback: 'ask-user',
    allowedDomains: []
  }
};
```

`ai-routing-pure.mjs` 负责纯规范化、默认值、未知字段剔除、数组上限和原型污染防护。`ai-routing.js` 负责将规范化策略和模型能力汇入 `resolveTaskConfig()`；不得由 DOM 或调用方自行拼接策略。

旧备份、旧 `data.db.aiTaskRoutes`、旧加密 AI 配置均应采用“缺少 `network` 即默认 `off`”的惰性迁移。导出/加密同步包含供应商元数据、任务策略和密钥映射；普通同步只保存不含密钥的元数据。

## 5. 模块边界与接口

### 5.1 新增模块

| 模块 | 形态 | 职责 |
|---|---|---|
| `search-policy-pure.mjs` | 纯模块 | 策略、供应商引用、证据对象的规范化与校验 |
| `search-store.js` | IIFE adapter | IndexedDB/localStorage 读取、搜索密钥映射、加密导入导出 |
| `search-registry.js` | IIFE adapter | 已注册供应商的能力、选取顺序和健康状态 |
| `search-adapters.js` | IIFE adapter | 各受支持外部供应商的 HTTP 请求、超时和响应规范化 |
| `search-tool-loop.js` | IIFE adapter | 受限 `search_web` tool call 循环；最大调用数、结果回注与审计元数据 |
| `search-settings.js` | IIFE adapter | 搜索供应商管理器、任务联网设置 Sheet |
| `food-evidence-pure.mjs` | 纯模块 | 食物证据、基础餐品、改动项、估算等级的结构验证 |
| `food-evidence.js` | IIFE adapter | 食物解析后的联网核实编排、保存前状态与 UI 更新 |

`food.text` 与 `food.vision` 继续只负责产出严格的食物候选 JSON。新增内部执行任务 `food.verify`，负责“候选 → 证据 → D.I.Y. 计算”；它默认继承来源任务的模型与联网策略。设置 UI 将它合并展示为“食物营养核实”，避免让用户理解两次 AI 调用；高级用户可在完整设置 Sheet 中选择覆盖其模型与策略。这样不会把原有严格 JSON 解析和供应商的搜索/引用事件混在同一响应契约中。

新浏览器脚本必须加入 `index.html` 加载顺序和 `sw.js` 预缓存；纯模块需有 Node 测试入口。

### 5.2 统一搜索结果

所有外部供应商先归一为以下结构，模型不得直接相信供应商原始字段：

```js
{
  id: 'ev_...',
  title: '...',
  url: 'https://...',
  domain: 'example.com',
  snippet: '...',
  providerId: 'search_...',
  retrievedAt: 0,
  sourceType: 'official-nutrition' | 'official-menu' | 'database' | 'other',
  official: false,
  match: { brand: '', product: '', market: '', serving: '' }
}
```

`official` 只能由显式域名/来源规则或用户确认提升；模型声明“这看起来是官网”不能单独将其置为 `true`。`snippet` 和任何网页文本都属于不可信输入，必须作为引用资料而非系统指令；禁止其覆盖任务规则。

### 5.3 原生联网适配

为 OpenAI Responses、Claude、Gemini 分别新增小型 request builder：仅在以下条件同时满足时注入供应商原生工具：

1. 该任务策略允许联网；
2. 当前模型确认支持该供应商工具，或用户明确接受“能力未知”；
3. 当前请求不是必须严格 JSON、且供应商工具与该 JSON 模式不冲突，或适配器已验证二者兼容；
4. 域名策略能映射到该供应商字段。

原生响应解析不仅抽取文本，还需抽取引用/来源事件，规范化为 `SearchEvidence`。对流式响应，搜索事件与文字事件分开缓存，结束后一次性写入消息元数据；不得把原始工具事件拼接进用户可见正文。

### 5.4 外部搜索 tool loop

外部搜索不是简单给 `ai-api.js` 加一行 `fetch()`。需要完整循环：

```text
请求携带 function schema（search_web）
→ 模型请求工具
→ 校验 query 长度、次数、任务策略和供应商 ID
→ 外部适配器检索
→ 规范化并截断结果
→ 以 tool result 回传模型
→ 模型生成最终文本或食物 JSON
```

硬限制：每次用户动作最多 2 次搜索调用；query 最长 240 字符；单条 snippet 最长 2,000 字符；合并结果最长 12,000 字符；默认 8 秒超时；只允许 HTTPS；不发送 cookies；不自动读取结果页。任何失败只返回安全错误码和可展示消息。

v1 不实现通用 `read_url`。若以后需要读取用户指定页面，应独立设计受限 reader：HTTPS GET、`credentials: 'omit'`、禁止 localhost/私网 IP、重定向与 MIME/大小上限、HTML 去脚本提正文、显式用户确认。浏览器 CORS 失败不得通过不受控公开代理绕过。

## 6. 食物核实领域设计

### 6.1 触发与隐私

在 `food.text` / `food.vision` 完成初步识别之后、保存草稿之前运行核实。对外只发送解析本身所需的最小信息：品牌、餐品名、地区、规格、可选改动项和用户明确附带的图片/订单信息；不发送完整健康档案、体重历史、训练记录或无关 AI 对话。

自动触发信号包括：品牌/连锁名、条码/包装标签、菜单/订单截图、套餐、`去/不要/加/换/双倍/半份` 等 D.I.Y. 词、模型低置信或用户点击“联网核实”。

### 6.2 食物证据与计算输出

```js
{
  status: 'verified' | 'estimated' | 'needs-confirmation' | 'unavailable',
  confidenceTier: 'official-exact' | 'official-composed' | 'database-estimate' | 'vision-estimate',
  base: { name, market, servingLabel, grams, nutrients, evidenceIds: [] },
  modifications: [{ kind: 'remove' | 'add' | 'replace' | 'portion', label, nutrients, evidenceIds: [], assumption: '' }],
  total: { nutrients, range: { cal: [0, 0] } },
  evidence: [SearchEvidence],
  assumptions: [],
  requiredUserInput: []
}
```

置信等级由证据决定，而非仅使用模型给出的百分数：

| 等级 | 条件 | 显示 |
|---|---|---|
| `official-exact` | 匹配品牌、地区、规格和官方营养表 | `官方数据` |
| `official-composed` | 官方基础项与官方配料项组合 | `官方拆分计算` |
| `database-estimate` | 结构化食物库或通用食材拆分 | `食材估算` |
| `vision-estimate` | 图片或文字的份量推断 | `识别估算` |

每个条目必须能查看“基础餐品、去除项、添加项、假设、来源”。若去酱量、加料规格或地区未知，优先请求补充，而不是把未知项当作 0 kcal。

## 7. UI/UX 方案：M3E + 液态玻璃

### 7.1 信息架构

沿用现有“AI 设置卡 → 管理器/功能矩阵 → 完整设置 Sheet”三层，避免新增顶级导航。

1. **AI 设置卡**：在“供应商”下方增加一行 `联网检索` 摘要入口。左侧 `travel_explore` 图标，文案显示“模型原生 + 2 个后备服务”或“未启用”；右侧 chevron。
2. **联网检索管理器**：复用 `ai-provider-manager` 的列表、详情、归档、测试连接和新增入口，不把搜索服务混进 AI 模型供应商列表。
3. **功能模型矩阵**：食物任务和存在显式覆盖的任务显示一个紧凑联网状态按钮：`cloud_off`（关闭）、`auto_awesome`（自动）、`travel_explore`（必须）。无网络需求的任务维持现有密度；按钮只展示状态，点按进入现有完整设置 Sheet。
4. **任务完整设置 Sheet**：在主/备用模型与推理强度之后新增“联网检索”区块，选择模式、执行顺序、来源策略与失败处理。高级域名/供应商顺序收进“高级选项”，不占用默认视图。
5. **食物草稿**：识别结果上方显示一枚状态 Chip；品牌/DIY 餐品显示 `联网核实` 次要按钮。核实后以可折叠“证据与计算”卡呈现，确认保存仍沿用现有按钮。

### 7.2 方案比较与最终选择

界面设计经过三个互斥方向的比较：

1. **极简食物优先**：AI 设置首页只露出“食物营养核实”的三态，其他任务放入“任务例外”。日常用户不必理解供应商、工具和模型的嵌套关系。
2. **全量可配置管理器**：独立联网检索管理器可维护原生能力、多个外部服务、优先级、来源策略、隐私与诊断；适合个人研究和高级供应商配置。
3. **食物证据引导流**：识别后、保存前在候选卡内显示核实状态；只有品牌、包装、菜单截图和 D.I.Y. 改造进入“基础值 ± 改动项”的确认分支。

最终采用三者组合：顶层使用方案 1 的低认知入口，管理器使用方案 2 的完整能力，食物录入使用方案 3 的轻量证据层。不会让用户在每次记录时选择搜索供应商；供应商优先级和域名策略只在管理器的高级区调整。

AI 设置首页的推荐摘要文案：

```text
联网检索                         食物核实：自动 · 原生优先  >
```

无可用来源时改为：`未配置 · 仅使用本地估算`。首次将食物任务从关闭改为自动/必须时，显示一次性说明：只发送餐品、品牌、地区和用户明确附带的订单/图片信息，不发送完整健康档案。

### 7.3 关键状态与文案

| 状态 | 视觉 | 文案 |
|---|---|---|
| 离线 | 低强调描边 Chip，`cloud_off` | `不联网` |
| 自动 | primary-container 玻璃 Chip，`auto_awesome` | `需要时联网` |
| 必须 | tertiary-container 玻璃 Chip，`travel_explore` | `本次先核实` |
| 正在核实 | 骨架/细进度条，不旋转整张卡 | `正在查询官方营养信息…` |
| 官方数据 | success/primary 低饱和 Chip，`verified` | `官方数据 · {来源数}` |
| 估算 | secondary 低强调 Chip，`calculate` | `估算，建议确认` |
| 失败 | error-container 低强调 Chip，`error_outline` | `未能联网核实` |

不要用纯颜色传达证据等级；图标、文本和屏幕阅读器说明必须同时存在。点击来源在新标签页打开，链接展示前用 `textContent` 处理，不得插入不可信 HTML。

### 7.4 视觉和交互约束

- 容器复用 `--glass-bg` / `--glass-bg-strong`、`--glass-border`、`--glass-shadow-inset`、`--glass-blur-sm`，不在新模块定义深浅主题 token。
- 任务矩阵控制保持至少 44 px 点击高度、圆角全形 Chip、短弹簧按压；完整配置放进现有 `md-modal-sheet`。
- 食物证据卡使用 14–20 px 圆角、轻描边、可展开行；`基础值 → 改动 → 合计` 以纵向小计而非宽表格呈现，保证 360 px 屏幕可读。
- 动画只用现有 M3E duration/spring；遵守 `prefers-reduced-motion`，加载时使用 `58-skeleton.css` 的骨架而非持续旋转。
- 样式归属：AI 设置/任务路由放 `20-settings-ai.css`；食物核实结果放 `18-health-diet.css`。若新增页面级 partial，按 `5x` 规则注册；不能堆入 `99-custom-overrides.css`。

## 8. 实施阶段与测试

### 阶段 0：纯数据契约

新增 `search-policy-pure` 与 `food-evidence-pure` 测试：默认离线、畸形配置、未知字段、数组/文本上限、供应商 ID 去重、策略继承、证据等级与 D.I.Y. 加减计算。此阶段不发网络请求。

### 阶段 1：配置、迁移与设置 UI

实现搜索供应商元数据、独立密钥映射、加密导入导出、任务 `network` 策略，以及管理器/Sheet/矩阵状态。测试旧配置导入后仍为离线，删除/归档供应商会从策略中安全剔除或显示不可用，而不会清空 AI 模型路由。

### 阶段 2：模型原生联网

先接 OpenAI Responses，再逐个补 Claude、Gemini。为每种 API 写请求体和非流式/流式引用解析 fixture；模型或兼容端点不支持时必须无副作用地降级，不能把 `tools` 发送给所有 OpenAI 兼容接口。

### 阶段 3：外部搜索工具循环

实现受支持适配器、统一结果、固定次数 tool loop、超时和错误分类。使用 mock `fetch` 测试：一次工具调用成功、超过调用上限、供应商失败、恶意超长结果、无配置、`required` 模式失败。真实 API 连通性只作为手工检查，不能写入自动测试密钥。

### 阶段 4：食物证据核实

将核实插入 `food-log.js` 的草稿确认前。覆盖：普通食材不联网、官方包装食品、品牌基础餐品、去酱/加料/换配菜、地区/规格冲突、无来源、用户取消、编辑后保存。记录仅保存安全的结构化证据摘要和 URL，不保存原始网页 HTML。

### 阶段 5：可访问性与完整验证

验证键盘焦点、Sheet 焦点陷阱、屏幕阅读器状态、窄屏、深色模式、断网与 Service Worker 离线降级。任何新浏览器脚本/预缓存变更执行版本检查；CSS 变更执行 CSS 构建与 overlap 检查；涉及 AI 渲染、持久化或 Service Worker 的最终实现必须执行 `npm run ci`。

## 9. 验收标准

1. 旧用户升级后没有任务被自动联网，现有 AI 请求与离线行为保持不变。
2. 用户能添加、测试、启停和归档受支持的外部搜索服务，凭据不出现在普通同步数据、日志或页面文本中。
3. 每个任务能独立选择关闭、自动、必须联网及执行顺序；能力不支持时显示原因和可恢复路径。
4. 原生联网和外部检索的来源均以统一证据格式显示；来源不得由模型伪造为“官方”。
5. 食物识别结果可区分官方数据、官方拆分计算和估算；D.I.Y. 项目显示加减明细，用户确认前不写入记录。
6. 外部检索受次数、长度、超时、HTTPS 与隐私边界限制；不实现任意网页读取。
7. 新 UI 与既有 M3E + 液态玻璃组件一致，并通过深色、360 px、键盘和 reduced-motion 检查。

## 10. 参考与取舍

[Kelivo](https://github.com/Chevey339/kelivo) 提供了有价值的方向：统一外部搜索服务、将 `search_web` 作为模型函数工具、并按供应商/模型启用原生搜索。它适合借鉴分层思想，不适合直接移植：本项目是原生浏览器 PWA，须额外处理 CORS、客户端密钥和 Service Worker；而营养任务还需要其通用 `title/url/snippet` 之外的官方性、地区、规格、份量及改动证据。

Kelivo 的 AGPL-3.0 许可可接受时可以参考或选择性复用，但复制代码前仍应保留版权与许可证声明，并评估与本项目许可证的兼容性。优先采用本设计中的独立实现，以减少跨技术栈和许可证耦合。
