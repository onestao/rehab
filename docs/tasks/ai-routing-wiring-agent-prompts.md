# AI 功能路由与模型控件闭环：逐任务执行提示词

> 来源：`docs/tasks/ai-routing-wiring-execution-playbook.md`  
> 用途：每个代码块均可独立复制给代码 agent。  
> 原则：一次只执行一个编号，不跨任务修改。

## 执行前必须人工确认

以下事项未确认时，相关执行 agent 必须停止，不能自行设定：

1. `food.text`、`food.vision`、`plan.today`、`plan.week` 的完整响应 JSON 解析失败是否提供备用模型重试。
2. Advice 图片重试 File 的内存 TTL，建议值是否采用 10 分钟。
3. 明确不兼容模型的确认交互使用原生 `confirm()` 还是现有 modal/sheet。
4. 文本 Advice 失败气泡刷新后，是否仍允许使用持久化的安全 target 一键重试。
5. 自动 fallback 是否每次显示 toast，还是只保留事件和结果元数据。
6. `ui-mockup` 是否继续保留旧内联供应商布局。
7. 任务 `group` 是否保持注册顺序。
8. 手动能力标签是否只允许已知集合，还是允许自定义标签。

---

## 0.1 固化分支与测试基线

```text
当前任务：0.1 固化分支与测试基线。

本任务目标：只记录 perfrom 与 ui-mockup 的可复现基线；不得修改运行代码或测试。

允许修改：仅独立审计记录或本任务状态文档。
禁止修改：所有 JS、MJS、CSS、HTML、Service Worker、测试断言、生成物、API Key/凭据、data schema、同步结构；不得清理用户改动；不得提交其他任务内容。

实施前阅读：根 AGENTS.md、docs/tasks/ai-routing-wiring-completion-plan.md、docs/tasks/ai-routing-wiring-execution-playbook.md、package.json、.size-limit.cjs。

必须先运行：
1. git status --short --branch
2. git rev-parse HEAD
3. git rev-parse ui-mockup
4. git merge-base HEAD ui-mockup
5. git log --oneline --left-right HEAD...ui-mockup

测试要求：不新增测试。分别在两分支运行 npm run test，并运行 npx --yes size-limit，记录测试数、失败数和体积基线。
预期红灯：无。本任务只建立基线；若已有测试失败，停止并记录，不能修复。

执行步骤：
1. 确认当前工作树中哪些改动属于用户或其他 agent。
2. 记录当前分支、ui-mockup、merge-base 和工作树状态。
3. 两分支分别运行测试和 size-limit。
4. 记录关键 AI 文件的分支差异清单，不分析或修改内容。
5. 确认 .codex-remote-attachments、临时浏览器 profile、截图缓存未进入待提交文件。

完成后运行：git diff --check；git status --short。

安全检查：不得读取、输出或记录 API Key；不得修改全局 git safe.directory；不得删除文件。
git diff 检查：只能出现审计记录；若出现运行文件、测试或生成物，立即停止。

不确定时：停止并报告，不得自行清理、stash、reset、checkout 或覆盖。

最终输出必须包含：修改文件列表、两分支测试结果、size-limit 基线、git diff 摘要、未完成项、风险说明。没有修改也要明确写“未修改文件”。
```

## 0.2 注册表、family 与能力三态红灯测试

```text
当前任务：0.2 注册表、family 与能力三态红灯测试。

本任务目标：只用测试固定 family 透传、group 分组、localPicker guard 和 requiredCapabilities 三态契约；阶段 0 禁止实现生产代码。

允许修改：test/ai-routing.test.mjs、test/ai-routing-runtime.test.mjs、test/ai-task-settings.test.mjs；必要时仅新增专用测试文件。
禁止修改：ai-routing.js、ai-routing-pure.mjs、ai-task-settings.js、任何运行 JS/CSS/HTML/SW、API Key/凭据、data schema、同步结构、size-limit。

实施前阅读：根 AGENTS.md、上位计划、执行手册、ai-routing.js、ai-routing-pure.mjs、ai-task-settings.js、上述测试文件。

必须先运行：
1. git status --short --branch
2. node --test test/ai-routing.test.mjs test/ai-routing-runtime.test.mjs test/ai-task-settings.test.mjs

必须新增/修改测试：
1. compatible/incompatible/unknown 三态行为。
2. listSelectableModels 返回 family。
3. 设置页消费 definition.group，而非平铺。
4. localPicker=false 时不挂载内联 picker。
5. 保持“不兼容模型仍可由用户选择”，不得测试硬过滤。

预期红灯：缺少三态 helper；selectable row 没有 family；设置页仍平铺；mount 不检查 localPicker。原有测试必须继续通过。

具体步骤：
1. 使用最小 fixture，不加载真实浏览器或真实 localStorage。
2. 三态覆盖明确 false、字段缺失、全部 true、畸形对象。
3. 测行为，不只匹配源码字符串。
4. 单独运行每个新增测试，确认失败原因确为缺功能。
5. 不修改任何实现使测试变绿。

完成后运行：上述三个测试文件；git diff --check；git diff -- test/。

安全检查：测试数据中的模型名/family/group 按不可信字符串设计；不得加入真实凭据。
git diff 检查：只能有测试文件；不得出现生产文件或生成物。

不确定时：停止并报告，特别是 group 排序或确认交互未确定时不得假设。

最终输出：修改文件列表、每个新增测试及红灯原因、测试结果、git diff 摘要、未完成项、风险说明。
```

## 0.3 最近使用与 AI 教练红灯测试

```text
当前任务：0.3 最近使用与 AI 教练红灯测试。

本任务目标：只增加红灯测试，固定收藏/最近统一存储、taskId 隔离、去重、失效记录和 AI 教练写入行为；不得实现。

允许修改：test/ai-task-settings.test.mjs、现有 Advice 模型选择器测试；必要时新增 test/advice-model-recents.test.mjs。
禁止修改：ai-task-settings.js、advice-panel.js、任何生产代码/CSS/HTML/SW、localStorage key、schema、凭据、同步结构、size-limit。

实施前阅读：ai-task-settings.js 收藏/最近 helper、advice-panel.js 的 chooseAdviceModel/renderAdviceModelPicker、test/delegated-action-security.test.mjs、执行手册任务 0.3。

必须先运行：git status --short --branch；node --test test/ai-task-settings.test.mjs test/delegated-action-security.test.mjs 以及现有 Advice picker 测试。

必须新增/修改测试：
1. advice.chat 与 advice.vision 最近记录分离。
2. 模型 key 为 profileId::modelId。
3. 收藏项不重复出现在最近或普通区。
4. 选择模型成功后写 rehab.ai.modelRecents.v1。
5. 保存失败不写 recent。
6. 已删除/归档模型的旧 recent 不导致渲染错误。

预期红灯：AI 教练不写 recent；picker 只按收藏排序；共享 recent 读取接口不存在。原有安全测试应保持绿。

具体步骤：
1. 使用每测试独立的内存 localStorage stub。
2. 构造两个 profile 下同 modelId，防止错误按 modelId 去重。
3. 分别模拟 chat 和带图片附件的 vision task。
4. 只断言行为，不要求具体内部函数名。
5. 确认新增测试在当前实现稳定红灯。

完成后运行：所有修改/新增测试；test/delegated-action-security.test.mjs；git diff --check。

安全检查：恶意模型名不得进入可执行 inline JS；测试不得含真实凭据。
git diff 检查：只允许测试文件。

不确定时：停止并报告，不得新增第三套存储键或自行决定过期清理策略。

最终输出：修改文件列表、红灯测试清单、测试结果、git diff 摘要、未完成项、风险说明。
```

## 0.4 非 Advice 领域 routeOverride/fallback 红灯测试

```text
当前任务：0.4 非 Advice 领域 routeOverride/fallback 红灯测试。

本任务目标：只为 food、goal、plan、plan.adjust、report、summary、insight 建立 UI→领域方法→ai.run/runStream 的透传红灯；不得实现生产代码。

允许修改：上述领域现有测试文件；必要时新增单领域测试。
禁止修改：所有生产代码；Advice chat/vision 测试留给 0.5；不得修改 schema、凭据、同步结构、size-limit。

实施前阅读：ai-api.js、food-log.js、health-diet.js、goal-plan.js、plan-ai.js、plan-auto-adjust.js、report-panel.js、weekly-summary.js、advice-panel.js 的 quick insight、对应测试。

必须先运行：git status --short --branch；逐个运行上述领域现有测试并记录基线。

必须新增/修改测试：
1. 传入 routeOverride 后，最终 mock ai.run/runStream 收到相同 {profileId,modelId}。
2. 手动重试不调用 setTaskRoute。
3. report/summary 现有 fallback 保持回归测试。
4. 每个领域独立 harness，不写一个巨型测试。

预期红灯：food text、body goal、plan today/week、plan.adjust、insight 丢 override；report/summary 基本行为应保持绿。

具体步骤：
1. 按领域分别构造最小上下文。
2. 捕获最终 ai.run/runStream 参数，而非只检查上层函数形参。
3. 增加“未调用 setTaskRoute”断言。
4. 对解析失败是否 fallback 的未确认场景不写产品假设。
5. 确认红灯断点清晰后停止。

完成后运行：所有新增/修改测试；git diff --check；git diff -- test/。

安全检查：routeOverride fixture 仅 profileId/modelId；不得加入 key、headers、baseUrl 凭据。
git diff 检查：只允许测试文件。

不确定时：停止并报告，尤其是结构化解析失败语义不得自行决定。

最终输出：修改文件列表、每领域红灯断点、测试结果、git diff 摘要、未完成项、风险说明。
```

## 0.5 AI 教练流式与附件红灯测试

```text
当前任务：0.5 AI 教练流式与附件红灯测试。

本任务目标：只建立 Advice chat/vision、skipUserMessage、File 内存、续写继承和已输出内容禁跨模型的红灯测试；不得实现。

允许修改：Advice 相关测试；建议新增 test/advice-fallback.test.mjs。
禁止修改：advice-panel.js、advice-attachments.js、advice-render.js 及所有生产代码；不得持久化 File/Blob/base64；不得改 schema、凭据、同步结构、size-limit。

实施前阅读：advice-panel.js 的 send/failure/retry/continuation 全流程、advice-attachments.js、advice-render.js、持久化/同步/备份相关测试、执行手册任务 0.5。

必须先运行：git status --short --branch；现有 Advice edit/version/stream/attachment/security 测试。

必须新增/修改测试：
1. chat fallback 重试不新增第二条用户消息。
2. replyToId/versionIdx/versionActive 保持正确。
3. vision fallback 可使用内存 File，但 JSON.stringify(data.db) 不含 File 内容。
4. 模拟刷新丢失内存 payload 后只能要求重新附图。
5. 已输出 token 后错误不产生 fallback action。
6. 自动续写与首段使用同一 override。
7. 取消不保留附件或 fallback action。

预期红灯：sendAiAdvice 不消费 override；失败记录无安全 target；无附件重试 Map；续写不继承 override。

具体步骤：
1. 使用假 File 对象和序列化探针。
2. 分别模拟 0 token、已有 token、取消、续写失败。
3. 断言调用顺序、消息数量和持久化对象。
4. 不只匹配 toast 文案或源码字符串。
5. 确认现有版本/取消测试仍绿后停止。

完成后运行：新测试、Advice edit/version/stream/attachment/security 测试；git diff --check。

安全检查：File fixture 不得进入 db/localStorage/log/sync/backup；测试中不得出现真实凭据。
git diff 检查：只允许测试文件。

不确定时：停止并报告，尤其是 File TTL 和刷新后操作语义未确认时不得假设。

最终输出：修改文件列表、红灯场景与失败原因、测试结果、git diff 摘要、未完成项、风险说明。
```

---

## 1.1 能力三态与模型引用纯 helper

```text
当前任务：1.1 能力三态与模型引用纯 helper。

本任务目标：只在纯模块实现安全模型引用规范化与 requiredCapabilities 三态计算，使 0.2 对应纯测试转绿。

允许修改：ai-routing-pure.mjs、test/ai-routing.test.mjs。
禁止修改：ai-routing.js、ai-task-settings.js、任何 UI/runtime/CSS/HTML/SW、API Key/凭据、schema、同步结构、size-limit；不得处理其他任务。

实施前阅读：根 AGENTS.md、上位计划、执行手册 1.1、ai-routing-pure.mjs、test/ai-routing.test.mjs。

必须先运行：git status --short --branch；node --test test/ai-routing.test.mjs，确认 0.2 相关红灯存在。

必须新增/修改测试：保留阶段 0 红灯；补畸形对象、数组、原型污染键、未知字段、明确 false 优先于 unknown。
预期红灯：纯 helper 未实现或导出不存在。

具体实现步骤：
1. 新增等价于 normalizeModelRef 的纯函数，仅返回新对象 {profileId,modelId} 或 null。
2. 丢弃 apiKey、baseUrl、headers 等任何多余字段。
3. 新增能力三态函数：全部 true=compatible；任一明确 false=incompatible；其余缺失=unknown。
4. 不访问 window、DOM、storage。
5. 不改变现有任务路由结果或默认深度。

完成后运行：node --test test/ai-routing.test.mjs；npm run typecheck；git diff --check。

安全检查：返回对象无原始引用；未知字段不透传；不得记录输入。
git diff 检查：只允许 ai-routing-pure.mjs 和对应测试；无格式化全文件噪音。

不确定时：停止并报告，不得擅自规定能力标签集合或做硬过滤。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 1.2 listSelectableModels 元数据透传

```text
当前任务：1.2 listSelectableModels 元数据透传。

本任务目标：让 selectable model row 透传 family 并附带三态兼容结果；保持用户仍可选择不兼容模型。

允许修改：ai-routing.js、test/ai-routing-runtime.test.mjs；必要时只补相关 routing 测试。
禁止修改：ai-task-settings.js、advice-panel.js、provider manager、请求执行、CSS/HTML/SW、凭据、schema、同步结构、size-limit。

实施前阅读：执行手册 1.2、ai-routing.js、ai-routing-pure.mjs 1.1 新导出、ai-model-cache.js、catalog normalization、routing runtime 测试。

必须先运行：git status；node --test test/ai-routing.test.mjs test/ai-routing-runtime.test.mjs，确认 family/compatibility 红灯。

必须新增/修改测试：family 透传；三态结果；两个 profile 下相同 modelId 不合并；禁用/归档/无 key supplier 仍排除；能力不匹配仍出现在列表。
预期红灯：family 和 compatibility 字段缺失。

具体实现步骤：
1. 在 listSelectableModels(taskId) 获取 task definition。
2. 从模型缓存原样透传 family/capabilities/icon/displayName。
3. 调用纯 helper 计算兼容状态。
4. 保持 profileId::modelId 去重。
5. 不按 requiredCapabilities 过滤模型。

完成后运行：routing pure/runtime 测试；npm run typecheck；git diff --check。

安全检查：不透传凭据；不从 displayName 猜 family；不记录模型配置。
git diff 检查：只允许 ai-routing.js 和相关测试。

不确定时：停止并报告，不得自行改变 supplier/model enabled 语义。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 1.3 设置页 group 与 localPicker 接线

```text
当前任务：1.3 设置页 group 与 localPicker 接线。

本任务目标：设置页按 task definition.group 分组；mountInlinePicker 受 localPicker guard 控制。只处理这一个闭环。

允许修改：ai-task-settings.js、test/ai-task-settings.test.mjs、css-src/20-settings-ai.css；CSS 修改时允许相应 build 生成物。
禁止修改：能力三态视觉、最近使用、Advice picker、路由 runtime、HTML/SW、凭据、schema、同步结构、size-limit。

实施前阅读：执行手册 1.3、ai-task-settings.js、ai-routing.js definitions、css-src/20-settings-ai.css、CSS marker/build 脚本。

必须先运行：git status；node --test test/ai-task-settings.test.mjs；npm run check:css。

必须新增/修改测试：group 容器/标题按确认顺序；localPicker=false 不挂载；未知 task 不挂载；已有合法 hosts 保持。
预期红灯：render 平铺；mount 不检查 definition。

具体实现步骤：
1. 在 render 中按注册表顺序形成 group，不按字母自行排序。
2. 使用 DOM API/textContent 输出 group 名。
3. 在 mountInlinePicker 前读取 definition.localPicker。
4. localPicker 不负责自动创建宿主，只做 guard。
5. CSS 仅增加必要分组布局。

完成后运行：task settings 测试；npm run build:css；npm run check:css-overlap；npm run check:html-safety；git diff --check。

安全检查：group 名视为不可信；不得新增 innerHTML sink。
git diff 检查：只允许目标 JS/test/CSS 及脚本生成物；generated.css 不得手工编辑。

不确定时：group 排序未人工确认则停止，不得假设。

最终输出：修改文件列表、测试结果、CSS overlap 结果、git diff 摘要、未完成项、风险说明。
```

## 1.4 兼容三态 UI 与确认行为

```text
当前任务：1.4 兼容三态 UI 与确认行为。

本任务目标：在通用任务模型行显示 compatible/incompatible/unknown；不兼容模型仍可选，但按人工确认的交互要求二次确认。

允许修改：ai-task-settings.js、test/ai-task-settings.test.mjs、css-src/20-settings-ai.css 及生成物。
禁止修改：ai-routing.js、ai-routing-pure.mjs、AI 教练 picker、请求层、provider manager、凭据、schema、同步结构、size-limit。

实施前阅读：执行手册 1.4、1.2 返回结构、项目现有 confirm/modal 规范、a11y/security 测试、目标 CSS。

必须先运行：git status；task settings/a11y/security 测试；npm run check:css。

必须新增/修改测试：三态 DOM/aria；incompatible 取消不保存；确认后保存；unknown 不阻止；状态不只靠颜色。
预期红灯：当前没有兼容状态 UI 或确认行为。

具体实现步骤：
1. 先确认使用原生 confirm 还是现有 modal；未确认立即停止。
2. 使用 runtime 返回状态，不在 UI 重算另一套规则。
3. incompatible 显示明确能力缺失；unknown 显示未验证。
4. 取消确认时不得调用 setTaskRoute/rememberRecent。
5. 保持所有模型可见。

完成后运行：task settings、a11y、security；build CSS；check CSS/overlap；HTML safety；git diff --check。

安全检查：能力标签和模型名视为不可信；不新增未经审计 HTML sink。
git diff 检查：只允许目标文件和生成物；不得改 requiredCapabilities 过滤逻辑。

不确定时：停止并报告，不能自行选择确认组件或硬过滤。

最终输出：修改文件列表、测试结果、CSS/安全结果、git diff 摘要、未完成项、风险说明。
```

## 1.5 手动模型元数据输入规范化

```text
当前任务：1.5 手动模型元数据输入规范化。

本任务目标：只规范化手动模型 family 和能力标签输入，保持供应商管理、凭据和发现协议不变。

允许修改：ai-provider-manager.js、对应 provider/catalog 测试。
禁止修改：供应商布局、ai-profile 凭据、API Key、模型发现请求、任务选择器、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 1.5、ai-provider-manager.js 的 addManual/addCandidates、catalog normalization、provider manager tests。

必须先运行：git status；provider manager/catalog/routing runtime 测试。

必须新增/修改测试：trim、去重、空标签、大小写、非法空白；保存后 task settings refresh；不改变 model ID。
预期红灯：当前任意输入直接成为能力对象键。

具体实现步骤：
1. 先确认能力标签允许集合；未确认停止。
2. 规范化输入但不伪造能力。
3. family 保持用户值语义，不从名称猜测。
4. 继续走现有 catalog normalization/persist。
5. 保存后调用现有 task picker 刷新。

完成后运行：provider manager、catalog、routing runtime 测试；typecheck；git diff --check。

安全检查：不得读取/修改 API Key；输入按不可信处理；不得新增日志。
git diff 检查：只允许 provider manager 和对应测试。

不确定时：停止并报告，不得自行删除自定义能力标签。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

---

## 2.1 共享收藏与最近使用适配接口

```text
当前任务：2.1 共享收藏与最近使用适配接口。

本任务目标：只暴露稳定、不可变的模型偏好小接口，不修改任何选择器 UI。

允许修改：ai-task-settings.js、test/ai-task-settings.test.mjs。
禁止修改：advice-panel.js、任何 picker UI/CSS、localStorage key、API Key/凭据、schema、同步结构、HTML/SW、size-limit。

实施前阅读：执行手册 2.1、ai-task-settings.js 的 modelKey/favoriteKeys/rememberRecent 与底部导出、现有测试。

必须先运行：git status；node --test test/ai-task-settings.test.mjs，确认 0.3 共享接口红灯。

必须新增/修改测试：读取返回副本；按 taskId 隔离；最多 3 项；重复模型前移；storage 不可用安全失败；key 为 profileId::modelId。
预期红灯：共享 recent 读取接口或导出不存在。

具体实现步骤：
1. 沿用 rehab.ai.modelFavorites.v2 和 rehab.ai.modelRecents.v1。
2. 暴露 modelKey、favoriteKeys、recentKeysForTask、rememberRecent 或等价最小接口。
3. 返回新数组/Set，不暴露内部可变对象。
4. 不在读取时写 storage。
5. 不新增迁移或第三套 key。

完成后运行：task settings 测试；typecheck；git diff --check。

安全检查：storage 内容按不可信 JSON 处理；异常不得中断渲染。
git diff 检查：只允许 ai-task-settings.js 和测试；不得出现 UI/CSS 改动。

不确定时：停止并报告，不得自行改变上限或存储格式。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 2.2 通用 picker 收藏/最近/family 排序

```text
当前任务：2.2 通用 picker 收藏/最近/family 排序。

本任务目标：只调整通用任务模型抽屉的排序和失效记录处理，不碰 AI 教练。

允许修改：ai-task-settings.js、test/ai-task-settings.test.mjs；必要时 css-src/20-settings-ai.css 及生成物。
禁止修改：advice-panel.js、收藏/最近存储格式、路由 runtime、API Key/凭据、schema、同步结构、HTML/SW、size-limit。

实施前阅读：执行手册 2.2、2.1 新接口、createCompactModelControl、family 透传结构、相关测试/CSS。

必须先运行：git status；task settings 测试；如涉及 CSS 先 npm run check:css。

必须新增/修改测试：收藏与 recent 重叠；失效 key；同 modelId 跨 profile；空 family；选择成功继续更新 recent。
预期红灯：当前排序未完整消费共享接口或 family。

具体实现步骤：
1. 只在当前 selectable models 中匹配偏好 key。
2. 顺序固定为收藏→当前 task 最近→其余按连接/family。
3. 使用 promoted set 去重。
4. 失效记录惰性忽略，不在 render 全量改写 storage。
5. 保持选择/保存/收藏行为不变。

完成后运行：task settings 测试；如改 CSS，build CSS/check overlap；HTML safety；git diff --check。

安全检查：模型名/family 不可信；不得新增 inline JS sink。
git diff 检查：只允许目标文件及生成物；不出现 Advice 文件。

不确定时：停止并报告，不得自行改变最近记录上限或分区文案产品语义。

最终输出：修改文件列表、测试结果、CSS 结果、git diff 摘要、未完成项、风险说明。
```

## 2.3 AI 教练接入共享最近使用

```text
当前任务：2.3 AI 教练接入共享最近使用。

本任务目标：只让 Advice picker 在路由保存成功后记录对应 task recent，并按收藏/最近/其余渲染。

允许修改：advice-panel.js、Advice picker/安全测试；必要时 css-src/48-advice-model-picker.css 及生成物。
禁止修改：sendAiAdvice、失败气泡、附件、fallback、自动续写、路由 runtime、凭据、schema、同步结构、HTML/SW、size-limit。

实施前阅读：执行手册 2.3、2.1/2.2 实现、chooseAdviceModel、renderAdviceModelPicker、advicePickerTaskId、delegated security tests。

必须先运行：git status；Advice picker、task settings、delegated security 测试。

必须新增/修改测试：chat/vision recent 分离；setTaskRoute 成功后记录；失败不记录；收藏去重；失效模型不渲染。
预期红灯：chooseAdviceModel 不记录 recent；render 只按 starred。

具体实现步骤：
1. 使用 advicePickerTaskId() 获取 advice.chat 或 advice.vision。
2. 仅在 setTaskRoute 成功后调用共享 rememberRecent。
3. 每个 scope 页按收藏/最近/其余分区。
4. 保持现有委托事件和安全转义。
5. 不修改模型发送逻辑。

完成后运行：Advice picker、task settings、delegated security；如改 CSS，build/check CSS；HTML safety；git diff --check。

安全检查：不得将不可信模型信息拼进可执行 onclick；不得读取/记录凭据。
git diff 检查：不得出现 send/fallback/attachment 区域无关改动；只允许目标 picker 逻辑、测试、CSS/生成物。

不确定时：停止并报告，不得自行改变 scope tabs 或请求 task 选择逻辑。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

---

## 3.1 aiFallback.target 安全规范化

```text
当前任务：3.1 aiFallback.target 安全规范化。

本任务目标：只建立运行时的安全 fallback error 契约；不实现任何领域 UI。

允许修改：ai-routing-pure.mjs、ai-api.js、test/ai-routing.test.mjs、test/ai-run-routing.test.mjs 或紧邻 routing 测试。
禁止修改：food/goal/plan/advice/report UI、toast、CSS/HTML/SW、API Key/凭据、schema、同步结构、size-limit；不得处理其他任务。

实施前阅读：执行手册 3.1、ai.run、getTaskRequestSequence、resolveTaskConfig、1.1 规范化 helper、错误重试分类测试。

必须先运行：git status；routing pure/runtime/run 测试，确认 0.4/0.5 中安全 target 红灯。

必须新增/修改测试：target 丢弃 apiKey/baseUrl/headers；空 ID 无 action；automatic 无手动 target；不可重试错误无 target；已 emitted 无 target；原 error 信息仍保留。
预期红灯：当前直接使用 route.fallbacks[0]，可能保留多余字段。

具体实现步骤：
1. 使用纯 helper 将候选 target 复制为 {profileId,modelId} 或 null。
2. 仅在 manual mode、可重试、无 emitted、存在下一目标时设置 error.aiFallback。
3. 不 mutation route 或 fallback 原对象。
4. 不吞原 error，不改变 automatic sequence。
5. 不记录 target 或错误正文。

完成后运行：routing pure/runtime/run tests；typecheck；HTML safety；git diff --check。

安全检查：error.aiFallback.target 只能有两个允许字段；不得包含凭据或 headers。
git diff 检查：只允许 routing pure/api 和相关测试；无领域 UI 改动。

不确定时：停止并报告，不得扩大可重试错误集合或改变 emitted 定义。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 3.2 food.text routeOverride 与备用重试

```text
当前任务：3.2 food.text routeOverride 与备用重试。

本任务目标：只闭环文字食物识别的 UI→parseFood→ai.run override 和一次性重试。

允许修改：ai-api.js 的 parseFood 相关小段、food-log.js 的 aiParseFood 相关小段、food text 相关测试。
禁止修改：图片识别、Advice、goal/plan/report、JSON parser 通用策略、API Key/凭据、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.2、3.1 error 契约、parseFood、aiParseFood、toast API、food tests。

必须先运行：git status；food parse/log 和 routing run 测试，确认 food.text override 红灯。

必须新增/修改测试：parseFood opts.routeOverride 到 ai.run；UI action 重试同文本；不调用 setTaskRoute；busy 防多击；输入/状态保留。
预期红灯：parseFood 无 opts；catch 无 fallback action。

具体实现步骤：
1. 以向后兼容方式给 parseFood 增加 opts。
2. 仅透传安全 routeOverride 到 ai.run。
3. aiParseFood 接受 options 或增加最小重试入口。
4. catch 仅在 3.1 规范化 target 存在时显示 action。
5. action 复用当前文本并受 busy guard 保护。
6. 未人工确认前，不把所有 JSON 解析失败自动纳入 fallback。

完成后运行：food parse/log、routing run、toast 相关测试；typecheck；HTML safety；git diff --check。

安全检查：routeOverride 不持久化；不记录输入全文以外的新敏感数据；不触碰凭据。
git diff 检查：只允许 ai-api parseFood、food-log 相关区域和测试；无图片/Advice 改动。

不确定时：结构化解析失败语义未确认则停止该部分并报告。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 3.3 food.vision 短期 File fallback

```text
当前任务：3.3 food.vision 短期 File fallback。

本任务目标：只闭环饮食照片的 File 一次性备用重试；File 只能存在当前调用和 toast 闭包。

允许修改：health-diet.js 的 handleDietPhoto 流程、ai-api.js 的 parseFoodFromImage 透传小段、diet photo/vision 测试。
禁止修改：Advice 附件、data.db/schema、localStorage/sync/backup、File/base64 持久化、其他领域、size-limit、无关 CSS/HTML/SW。

实施前阅读：执行手册 3.3、handleDietPhoto 全流程、parseFoodFromImage、ai-vision-pure、日志、安全/照片测试、3.1 契约。

必须先运行：git status；diet photo smoke、vision、routing run 测试，确认图片 override 红灯。

必须新增/修改测试：routeOverride 到 ai.run；每次新 AbortController；取消无 action；toast action 一次性；File 不在 JSON.stringify(data.db)、日志参数、localStorage/sync/backup fixture；按实际模型清 failure cache。
预期红灯：catch 无 fallback action；方法无 options。

具体实现步骤：
1. handleDietPhoto 接受 options，但不保存 options/File 到对象持久状态。
2. 每次请求创建新的 AbortController。
3. catch 中仅安全 manual target 时创建一次性 action。
4. action 闭包短期引用 File，触发或超时后释放。
5. retry 透传 routeOverride 到 parseFoodFromImage/ai.run。
6. 使用实际 effective 模型更新 vision failure cache。

完成后运行：diet photo smoke、vision、routing、toast/security；typecheck；HTML safety；git diff --check。

安全检查：搜索确认 File/Blob/base64 未进入 data、storage、log、sync、backup；不得输出文件内容。
git diff 检查：只允许 health-diet、parseFoodFromImage 小段和测试；不得出现 Advice 文件。

不确定时：File 生命周期或解析失败 fallback 未确认时停止并报告，不得自行持久化解决。

最终输出：修改文件列表、测试结果、File 生命周期检查、git diff 摘要、未完成项、风险说明。
```

## 3.4 goal.body routeOverride 与备用重试

```text
当前任务：3.4 goal.body routeOverride 与备用重试。

本任务目标：只闭环身体目标生成的 override 和备用重试；重试重新读取当前表单。

允许修改：goal-plan.js 的 requestWeightLossPlan、ai-api.js 的 weightLossPlan/bodyGoalPlan 透传与明确错误 code、相关测试。
禁止修改：目标算法、表单结构、plan AI、API Key/凭据、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.4、goal form 读取、bodyGoalPlan prompt/parse、3.1 契约、goal/JSON tests。

必须先运行：git status；goal、AI JSON、routing run 测试，确认 override 红灯。

必须新增/修改测试：override 到 ai.run；重试前修改表单并使用新值；不调用 setTaskRoute；结构化解析失败按上位计划显示重新生成；正常结构不变。
预期红灯：bodyGoalPlan 不透传 override；UI 无 action。

具体实现步骤：
1. 为 bodyGoalPlan/weightLossPlan 增加向后兼容 options 透传。
2. requestWeightLossPlan 接受 options。
3. 重试回调重新进入表单读取入口，不缓存旧体重/目标。
4. 解析错误使用明确 code，不改变解析结果结构。
5. routeOverride 只作用当前请求。

完成后运行：goal、JSON、routing run、toast tests；typecheck；git diff --check。

安全检查：不把 routeOverride 或健康表单数据写入凭据/同步新结构；不新增敏感日志。
git diff 检查：只允许 goal-plan、body goal 小段和测试。

不确定时：停止并报告，不得改变公式、目标策略或数据 schema。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 3.5 plan.today/plan.week routeOverride 与备用重试

```text
当前任务：3.5 plan.today/plan.week routeOverride 与备用重试。

本任务目标：只闭环今日/一周计划生成重试；保留当前 sheet 输入、病症和类型，不创建重复预览。

允许修改：plan-ai.js 的 submitPlanAi/request/catch 相关小段、test/plan-ai.test.mjs、必要 routing 测试。
禁止修改：plan parser、preview 编辑规则、confirm/save、plan-auto-adjust、rehab policy、API Key/凭据、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.5、plan-ai sheet 状态、submitPlanAi、preview/confirm、plan-ai-pure tests、3.1 契约。

必须先运行：git status；plan-ai 和 routing run 测试，确认 today/week override 红灯。

必须新增/修改测试：两个 mode taskId 正确；override 到 runStream；失败后状态保留；重试不清用户编辑预览；action once；不调用 setTaskRoute；实际模型 meta 正确。
预期红灯：submitPlanAi 无 options/override/action。

具体实现步骤：
1. 给 submitPlanAi 增加向后兼容 options。
2. 将安全 routeOverride 透传到 runStream。
3. catch 显示一次性备用 action。
4. 重试复用当前 sheet state，只重置本次 pending/error。
5. 不创建第二 preview host，不改 parser/confirm。

完成后运行：plan-ai、routing run、toast tests；typecheck；git diff --check。

安全检查：不把健康信息或 override 写入新日志/同步结构；不触碰凭据。
git diff 检查：只允许 submit/request/catch 小段和测试；parser/confirm 区无改动。

不确定时：解析失败 fallback 未确认则停止该部分；不得自行清空或覆盖已有预览。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 3.6 plan.adjust 状态重建式重试

```text
当前任务：3.6 plan.adjust 状态重建式重试。

本任务目标：只为明日自动调整增加备用重试；重试必须重新读取数据库、日期和受保护计划，再走完整 policy。

允许修改：plan-auto-adjust.js 的 AI 调整入口/错误动作/override 透传小段、test/plan-auto-adjust.test.mjs、必要 routing 测试。
禁止修改：progression 算法、plan policy 语义、undo 结构、plan store schema、其他 AI 领域、API Key/凭据、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.6、plan-auto-adjust 全流程、rehab-policy.js、plan-store.js、undo 和保护策略测试、3.1 契约。

必须先运行：git status；plan-auto-adjust、policy、store、routing run 测试。

必须新增/修改测试：override 到 runStream；失败后用户修改目标计划，重试基于新状态；manual plan 保护仍生效；undo/log 不重复；不调用 setTaskRoute；双击 guard。
预期红灯：执行方法无 override，错误后无备用入口。

具体实现步骤：
1. 只缓存“用户要求重试”的意图和安全 target，不缓存最终写入 payload。
2. 重试重新调用 readiness/context 构建。
3. 写入前重新执行 policy validation。
4. 保持 existing automatic fallback 和 undo 流程。
5. action 受 busy/once guard。

完成后运行：plan-auto-adjust、policy、store、routing run、toast tests；typecheck；git diff --check。

安全检查：不持久化 override；不绕过用户保护；不记录凭据或完整健康 prompt。
git diff 检查：只允许 AI 调整入口/错误处理和测试；progression/policy 核心无语义改动。

不确定时：停止并报告，不得复用旧 snapshot 或自行改变保护规则。

最终输出：修改文件列表、测试结果、保护策略回归、git diff 摘要、未完成项、风险说明。
```

## 3.7 report/summary 既有 fallback 安全收敛

```text
当前任务：3.7 report/summary 既有 fallback 安全收敛。

本任务目标：只把现有体重报告和周/月总结重试接入安全 target helper，并防止多击重复版本。

允许修改：report-panel.js 的现有 fallback 小段、weekly-summary.js 的现有 fallback 小段、对应 report/summary/version/toast 测试。
禁止修改：指标计算、prompt、版本上限/选择、布局/CSS、其他领域、凭据、schema、同步结构、HTML/SW、size-limit。

实施前阅读：执行手册 3.7、report-version-pure、两个现有 fallback 实现、toast action、3.1 helper。

必须先运行：git status；report、summary、version、toast、routing tests。

必须新增/修改测试：畸形 target 无 action；双击只执行一次；routeOverride 不持久化；现有重试仍生成正确版本。
预期红灯：新安全/多击断言可能红；基本重试应绿。

具体实现步骤：
1. 不重写已有调用链。
2. 用统一 helper 读取 target。
3. 增加局部一次性或复用现有 busy guard。
4. 保持 routeOverride 和版本 meta。
5. 不改变版本裁剪/active 逻辑。

完成后运行：report/summary/version/toast/routing tests；typecheck；git diff --check。

安全检查：target 仅 profileId/modelId；不持久化完整 error；不触碰凭据。
git diff 检查：仅两个 fallback 小段和测试；指标/版本 pure 无无关改动。

不确定时：停止并报告，不得自行改变版本产品规则。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 3.8 insight.quick override 与缓存隔离

```text
当前任务：3.8 insight.quick override 与缓存隔离。

本任务目标：只闭环快速洞察的备用重试，并让缓存按实际模型身份隔离。

允许修改：advice-panel.js 的 requestInsightAiAdvice/cache 相关小段、快速洞察测试。
禁止修改：sendAiAdvice、对话记录、失败气泡、附件、消息版本、其他领域、凭据、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.8、requestInsightAiAdvice、insight cache helper、task routing meta、3.1 契约。

必须先运行：git status；quick insight、advice 基础、routing tests。

必须新增/修改测试：override 到 ai.run；主/备用模型 cache key 不串；失败不写 cache；备用成功记录实际模型；不调用 setTaskRoute。
预期红灯：options 无 override；cache identity 不含实际模型。

具体实现步骤：
1. options 接受安全 routeOverride。
2. resolve effective config 时消费 override。
3. 按实际 profile/model 构造 cache identity。
4. catch 提供一次性备用 action。
5. 不触发完整 Advice send 或新增聊天消息。

完成后运行：insight/advice/routing/toast tests；typecheck；git diff --check。

安全检查：cache 不含 API Key/完整 prompt；不新增同步字段。
git diff 检查：只允许 quick insight/cache 小段和测试；send/attachment/version 区无改动。

不确定时：自动 fallback 提示策略未确认时停止相关 toast 扩展，不得假设。

最终输出：修改文件列表、测试结果、缓存隔离证据、git diff 摘要、未完成项、风险说明。
```

## 3.9 advice.chat 失败气泡与 skipUserMessage

```text
当前任务：3.9 advice.chat 失败气泡与 skipUserMessage。

本任务目标：只完成文本 Advice 的安全备用重试闭环；不处理视觉附件或自动续写。

允许修改：advice-panel.js 的 sendAiAdvice chat 路径、失败 record、文本 fallback 委托入口；必要时 advice-render.js 的失败操作小段；Advice fallback/edit/version/security 测试。
禁止修改：advice.vision File、自动续写循环、收藏/最近、stream renderer、API Key/凭据、schema 大迁移、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.9、sendAiAdvice 全流程、retryAdviceFrom、edit/version 逻辑、failure render、delegated security、3.1 helper。

必须先运行：git status；Advice fallback/edit/version/security 和 routing run 测试，确认 chat 红灯。

必须新增/修改测试：override 到 effective config 和 chat ai.run；失败 record 只存安全 target；重试 skipUserMessage；用户消息数不增加；replyToId/versionIdx 正确；不调用 setTaskRoute；畸形 target 无 action。
预期红灯：send 不消费 override；failed record/action 缺失。

具体实现步骤：
1. 为 sendAiAdvice options 增加向后兼容 routeOverride。
2. effective model/provider/temporaryModel 必须依据 override。
3. chat ai.run 接收同一 override。
4. 零输出失败时 failed record 保存最小 target。
5. 失败操作使用现有委托事件，不拼接不可信 inline JS。
6. 重试复用原 prompt/插入位置并设置 skipUserMessage=true。
7. 不修改 vision/continuation。

完成后运行：Advice fallback/edit/version/security、routing run；typecheck；HTML safety；git diff --check。

安全检查：target 仅两个字段；不持久化完整 error/messages/凭据；动态文本 escape。
git diff 检查：只允许 chat send/failure/retry 小段、必要 render 和测试；vision/continuation 区无改动。

不确定时：刷新后文本 fallback 语义未确认则停止持久化交互部分并报告。

最终输出：修改文件列表、测试结果、消息/版本断言结果、git diff 摘要、未完成项、风险说明。
```

## 3.10 advice.vision 附件内存生命周期

```text
当前任务：3.10 advice.vision 附件内存生命周期。

本任务目标：只完成视觉 Advice 的短期附件备用重试；File 只能保存在运行期 Map，绝不能持久化。

允许修改：advice-panel.js 的 vision 请求/失败/清理路径；必要时 advice-attachments.js 的最小运行期接口；Advice fallback/attachment/persistence/sync/backup/security 测试。
禁止修改：data schema、backup/sync 格式、localStorage 持久化、File/Blob/base64 序列化、food vision、自动续写、其他领域、API Key/凭据、size-limit。

实施前阅读：执行手册 3.10、sendAiAdvice vision 路径、advice-attachments 完整生命周期、save/sync/backup tests、3.9 实现。

必须先运行：git status；Advice fallback/attachment/edit/persistence/sync/backup/security 测试，确认 vision 红灯。

必须新增/修改测试：运行期 Map；File 不在 JSON.stringify(data.db)、localStorage/log/sync/backup；重试使用 attachmentsOverride+skipUserMessage；success/retry/delete/cancel/TTL 清理；刷新后退化为重新附图；无 Map 不伪装可直接重试。
预期红灯：无运行期 payload Map；发送后附件清空无法重试。

具体实现步骤：
1. 先取得人工确认的 TTL；未确认停止。
2. 创建只存在内存的 Map，以失败消息 ID 为键。
3. 请求期间保留本次附件引用；零输出失败时登记。
4. persisted failed record 只保存安全 target 和现有附件元数据。
5. action 消费 Map，传 attachmentsOverride 和 skipUserMessage。
6. success、retry、delete、cancel、TTL、会话结束时释放引用。
7. 页面恢复无 Map 时显示重新附图语义。

完成后运行：Advice fallback/attachment/edit/persistence/sync/backup/security；typecheck；HTML safety；git diff --check。

安全检查：搜索并证明 File/Blob/base64 未进入 data.db/localStorage/log/sync/backup；不得输出文件名以外敏感内容；不得读 API Key。
git diff 检查：只允许 vision/attachment 生命周期和测试；schema/sync/backup 生产文件不得改。

不确定时：TTL、刷新后行为或附件所有权不明确时立即停止并报告，不得用持久化绕过。

最终输出：修改文件列表、测试结果、内存生命周期出口清单、持久化安全检查、git diff 摘要、未完成项、风险说明。
```

## 3.11 自动续写、部分输出与跨模型保护

```text
当前任务：3.11 自动续写、部分输出与跨模型保护。

本任务目标：只保证一个 Advice 回答始终使用同一路由；续写继承首段 override；已有输出后不得跨模型重试。

允许修改：advice-panel.js 的 route snapshot、chat ai.run、auto-continue loop、continue catch、fallback action 判定；必要时 ai-api.js 仅核对 emitted 契约；stream/fallback 测试。
禁止修改：stream renderer 性能、Markdown、附件生命周期、task route 持久化、其他领域、API Key/凭据、schema、同步结构、CSS/HTML/SW、size-limit。

实施前阅读：执行手册 3.11、send/continue/cancel 全流程、ai.run emitted 判定、3.9/3.10、stream renderer tests。

必须先运行：git status；Advice stream/fallback/edit/version、routing run 测试，确认 continuation/partial 红灯。

必须新增/修改测试：首段和每次 continuation 使用相同 override；已有 token 后错误无 fallback action；continue 失败保留首段/finishReason；取消不变；vision 不进入 auto-continue；不跨模型拼接。
预期红灯：continuation 未传 override；UI 缺明确 partial guard。

具体实现步骤：
1. 请求开始复制并冻结本次 routeOverride。
2. 首段和所有 continuation 使用同一副本。
3. 结合 ai.run emitted contract 与真实 accumulated/full 判断是否已有输出。
4. continue 失败只记录 auto_continue_failed，保留已有内容和原 finishReason。
5. 任何已有内容的错误都不生成 manual fallback target/action。
6. 不改 renderer 调度或 chunk 策略。

完成后运行：Advice stream/fallback/edit/version、routing run；typecheck；HTML safety；git diff --check。

安全检查：route snapshot 只含 profileId/modelId；不记录请求 messages/凭据；不持久化 override 到 task route。
git diff 检查：只允许 continuation/route snapshot/guard 和测试；renderer/attachment/其他领域无改动。

不确定时：emitted 与部分内容状态冲突时停止并报告，不得选择更宽松的跨模型策略。

最终输出：修改文件列表、测试结果、调用序列证据、git diff 摘要、未完成项、风险说明。
```

---

## 4.1 ui-mockup 同步前提交映射与冲突预审

```text
当前任务：4.1 ui-mockup 同步前提交映射与冲突预审。

本任务目标：只建立 perfrom 阶段提交到 ui-mockup 的同步矩阵；不得执行同步。

允许修改：独立同步审计文档。
禁止修改：任何运行/测试/CSS/HTML/SW 文件；禁止 merge、cherry-pick、rebase、整文件复制、checkout 覆盖；不得修改凭据/schema/同步结构/size-limit。

实施前阅读：执行手册 4.1、阶段 0–3 commits、两分支 AGENTS、index PAGE_DEPS、SCRIPT_PREREQUISITES、sw.js、冲突高发文件。

必须先运行：git status；git rev-parse HEAD/ui-mockup/merge-base；git log --left-right；git range-diff；git diff --name-status HEAD..ui-mockup。

测试要求：不新增测试；分别记录两分支 npm run test 和 size-limit 当前结果。
预期红灯：无；若任一分支已有失败，只记录并停止同步准备。

具体实现步骤：
1. 列出阶段 1–3 每个源 commit。
2. 标记 clean cherry-pick、需小 patch、禁止同步。
3. 为 advice-panel、ai-task-settings、index、sw 单独记录冲突语义。
4. 记录目标分支特有布局/修复必须保留项。
5. 给出严格同步顺序，不实际执行。

完成后运行：git diff --check；git status；确认只有审计文档。

安全检查：不读取凭据；不修改 git 全局配置；不执行破坏性命令。
git diff 检查：不得出现运行文件或分支内容变化。

不确定时：停止并报告，不得按 commit message 猜等价性。

最终输出：修改文件列表、同步矩阵摘要、两分支测试基线、git diff 摘要、未完成项、风险说明。
```

## 4.2 ui-mockup 共享模型视觉移植

```text
当前任务：4.2 ui-mockup 共享模型视觉移植。

本任务目标：只在 ui-mockup 引入共享 ai-model-visual，并接通设置页和 Advice visual；不同步其他行为。

允许修改：ui-mockup 工作树中的 ai-model-visual.js、ai-task-settings.js visual 小段、advice-render.js visual 小段、index.html 加载/prerequisite、sw.js precache、相关视觉/加载/SW 测试、必要 CSS/生成物。
禁止修改：供应商管理布局、fallback、最近使用、路由语义、API Key/凭据、schema、同步结构、size-limit 上限；禁止整分支 merge/整文件覆盖。

实施前阅读：4.1 矩阵、perfrom 对应模块/测试、ui-mockup 当前 visual/加载/SW、模型图标资产、版本脚本。

必须先运行：ui-mockup git status；视觉/task/advice/lazy/SW 测试；version check；size-limit 基线。

必须新增/修改测试：shared global 可用；task/advice 使用同 resolver；本地 icon fallback；加载顺序；SW precache 资产存在；离线不破图。
预期红灯：ui-mockup 无模块/引用，settings 仍首字母色块。

具体实现步骤：
1. 优先移植独立纯模块和测试。
2. 用小 patch 接入 task/advice visual，不复制整文件。
3. 更新 lazy prerequisite/加载顺序。
4. 同步 SW precache 和版本。
5. 运行 CSS 构建，仅提交脚本生成物。
6. 不迁移供应商管理器或 fallback。

完成后运行：visual/task/advice/lazy/SW tests；build/check CSS；version check；size-limit；git diff --check。

安全检查：图标 key/模型名不可信；不得加载任意用户 URL；不触碰凭据。
git diff 检查：文件列表必须与本任务允许范围一致；不得出现大面积 ours/theirs 覆盖；不得提高 size-limit。

不确定时：加载顺序或冲突语义不清时停止并报告，不得复制 perfrom 整文件。

最终输出：修改文件列表、测试/版本/size 结果、git diff 摘要、未完成项、风险说明。
```

## 4.3 按阶段同步行为提交

```text
当前任务：4.3 按阶段同步行为提交。

本任务目标：严格按 4.1 矩阵，一次只同步一个已完成源 commit；本提示词每次执行只能处理一个指定 commit。

允许修改：仅该源 commit 涉及且矩阵允许的目标文件和对应测试。
禁止修改：禁止整分支 merge、批量 cherry-pick、rebase、整文件覆盖、同步无关性能/饮食变化、提高 size-limit、改凭据/schema/同步结构；禁止同时处理下一个 commit。

实施前阅读：4.1 矩阵、指定源 commit 完整 diff、目标文件当前内容、对应测试、适用 AGENTS。

必须先运行：ui-mockup git status；git show --stat/--format=fuller 指定 commit；目标分支相关测试；git diff 指定源/目标文件。

必须新增/修改测试：先同步该 commit 对应测试；若目标分支 harness 不同，只做最小等价适配。
预期红灯：同步测试后、实现前应出现与源 commit 相同的行为红灯。

具体实现步骤：
1. 明确本次唯一源 commit hash 和任务编号。
2. 若矩阵标 clean，单 commit cherry-pick；若冲突，停止自动选择并做语义小 patch。
3. 冲突时同时阅读 ours/theirs/base，不使用整文件 theirs。
4. 只解决当前 commit 的测试红灯。
5. 检查文件清单与源 commit/矩阵一致。
6. 运行相关测试并结束，不继续下一个 commit。

完成后运行：当前 commit 相关测试；git diff --check；git status；阶段边界要求的 test 子集。

安全检查：不得引入凭据或 File 持久化；不得改变 target/schema；不触碰无关同步代码。
git diff 检查：无整文件覆盖噪音；无无关文件；版本变化仅在源 commit要求时出现。

不确定时：任何冲突语义不清立即停止并报告，不能选 ours/theirs 猜测。

最终输出：源 commit/任务编号、修改文件列表、冲突处理说明、测试结果、git diff 摘要、未完成项、风险说明。
```

## 4.4 ui-mockup 推理、恢复默认与 toast 对齐

```text
当前任务：4.4 ui-mockup 推理、恢复默认与 toast 对齐。

本任务目标：只对齐三项已定语义：显式推理 advisory、模型 chip 移除 x、路由保存成功后 toast。

允许修改：ui-mockup 的 ai-routing-pure.mjs 对应小段、advice-panel.js 的 chip/choose 小段、对应测试、必要 CSS/生成物。
禁止修改：provider manager、fallback、最近使用、shared visual、API Key/凭据、schema、同步结构、HTML/SW、size-limit；禁止整文件覆盖。

实施前阅读：执行手册 4.4、两分支对应实现/测试、完整抽屉恢复默认入口、当前 CSS。

必须先运行：ui-mockup git status；routing/advice chip/picker/CSS 测试。

必须新增/修改测试：显式深度不因不完整 metadata 本地拒绝；unknown protocol 仍按既有错误；chip 无 x；完整抽屉仍有恢复默认；toast 仅 setTaskRoute 成功后一次。
预期红灯：ui runtime 抛 unsupported；chip 有 x；choose 无 toast。

具体实现步骤：
1. 只移植 perfrom 已确认的 explicit reasoning advisory 语义。
2. 移除 chip 内 x 和相关 CSS/事件。
3. 确认完整抽屉恢复默认仍可达。
4. 在路由保存成功后显示一次 toast；失败不显示。
5. 不修改 provider 协议支持范围。

完成后运行：routing/advice chip/picker/CSS tests；typecheck；HTML safety；git diff --check。

安全检查：toast 模型名安全；不触碰凭据；不扩大协议。
git diff 检查：仅三个语义相关小段、测试和必要 CSS；无 fallback/最近/provider 改动。

不确定时：恢复默认入口或推理策略与当前测试冲突时停止并报告。

最终输出：修改文件列表、测试结果、git diff 摘要、未完成项、风险说明。
```

## 4.5 ui-mockup SW/CSS/size-limit 收口

```text
当前任务：4.5 ui-mockup SW/CSS/size-limit 收口。

本任务目标：只收口脚本加载、SW precache、版本、CSS 生成物和体积；不改业务逻辑。

允许修改：ui-mockup 的 index.html、sw.js、app-update.js、相关加载/SW 测试、CSS 生成物；.size-limit.cjs 仅允许恢复意外改动，禁止提高阈值。
禁止修改：业务 JS、API Key/凭据、schema、同步结构、size-limit 上限；不得手工编辑 generated.css；不得整分支 merge。

实施前阅读：执行手册 4.5、版本脚本、SW tests、CSS build scripts、.size-limit.cjs、4.2/4.4 diff。

必须先运行：ui-mockup git status；npm run check:css；node scripts/bump-version.js --check；SW/lazy tests；npx --yes size-limit。

必须新增/修改测试：仅在已有测试不能证明新增资产加载/预缓存时补行为测试；不得只改快照绕过。
预期红灯：版本或 precache 检查可能提示需更新；业务测试不应新增红灯。

具体实现步骤：
1. 运行 npm run build:css 生成产物。
2. 更新 index/SW/app-update 的同一版本链。
3. 核对每个 precache 资产存在。
4. 运行 CSS overlap 并检查增量。
5. 运行 size-limit，超限则停止并报告，不提高阈值。

完成后运行：build CSS；check CSS；version check；SW/lazy tests；npm run ci；size-limit；git diff --check。

安全检查：precache 不含用户文件/凭据；不新增远程脚本。
git diff 检查：生成物必须可由脚本重建；.size-limit.cjs 阈值不增加；无业务逻辑变化。

不确定时：超限、版本冲突或生成物出现无关差异时停止并报告。

最终输出：修改文件列表、测试/CSS/版本/size 结果、git diff 摘要、未完成项、风险说明。
```

---

## 5.1 CodeGraph 死代码与动态入口审计

```text
当前任务：5.1 CodeGraph 死代码与动态入口审计。

本任务目标：只形成“可删/必须保留/待确认”清单；不得删除代码。

允许修改：独立审计文档。
禁止修改：所有生产代码、测试、CSS/HTML/SW、API Key/凭据、schema、同步结构、size-limit；阶段 5.1 不允许删除任何候选。

实施前阅读：执行手册 5.1、CodeGraph instructions、advice-panel.js、advice-render.js、ai-task-settings.js、ai-model-visual.js、全局 attach 与 Node test harness。

必须先运行：git status；CodeGraph status；对 providerKeyForModel/providerIcon/setAdviceModel 等候选执行 search/callers/impact；相关测试基线。

测试要求：不新增测试；记录每个候选现有覆盖。若对象方法 CodeGraph 不识别，必须补查动态 HTML、window global、inline onclick、测试 vm 加载。
预期红灯：无。

具体实现步骤：
1. 为每个候选记录定义位置、静态调用、动态入口、测试入口。
2. 分类为可删/保留/待确认。
3. 可删必须有明确“无调用+有行为覆盖”证据。
4. 两分支分别审计，不假设相同。
5. 不执行任何删除。

完成后运行：git diff --check；git status；确认仅审计文档变化。

安全检查：不输出凭据；不运行破坏性 git；不读取用户数据。
git diff 检查：不得出现生产/测试删除。

不确定时：一律标记待确认，不得判可删。

最终输出：修改文件列表、候选分类及证据、测试覆盖摘要、git diff 摘要、未完成项、风险说明。
```

## 5.2 删除已审计的重复适配

```text
当前任务：5.2 删除已审计的重复适配。

本任务目标：每次只删除 5.1 清单中一组明确“可删”的重复适配；最多 3 个生产文件。

允许修改：本次指定候选所在的最多 3 个生产文件、直接相关测试/CSS。
禁止修改：5.1 未标可删项、公共 API 未确认项、模块边界、命名大改、业务行为、API Key/凭据、schema、同步结构、size-limit；不得顺手重构。

实施前阅读：5.1 证据、候选文件、callers/impact、相关测试、size-limit。

必须先运行：git status；候选相关测试；重新执行 CodeGraph callers/impact 确认索引无滞后。

必须新增/修改测试：若删除项承担兼容行为，先补公共行为测试；不得新增“源码不含字符串”作为唯一测试。
预期红灯：通常无；目标是删除后行为继续绿。若先补行为测试，应先确认当前实现绿。

具体实现步骤：
1. 明确本次唯一候选组。
2. 删除最小实现和确定无用导出。
3. 仅当 CSS selector 无宿主且有证据时删除 CSS。
4. 不搬迁逻辑、不重命名公共 API。
5. 运行相关测试和 size-limit 比较。

完成后运行：相关测试；npm run lint/typecheck；HTML safety；如改 CSS 则 build/check；size-limit；git diff --check。

安全检查：兼容读取层和安全 escape 不得误删；不触碰凭据。
git diff 检查：最多 3 个生产文件；无大面积格式化；删除量与 5.1 清单一致。

不确定时：停止并报告，保留代码，不得凭 grep 无结果删除。

最终输出：候选组、修改文件列表、测试/size 结果、git diff 摘要、未完成项、风险说明。
```

## 5.3 文档状态、生成物与最终验收

```text
当前任务：5.3 文档状态、生成物与最终验收。

本任务目标：只做最终验证和文档收口；任何业务失败返回对应任务，不在本任务修业务。

允许修改：docs/tasks/ai-routing-wiring-completion-plan.md、execution playbook、agent prompts、必要脚本生成物。
禁止修改：业务 JS、测试逻辑、API Key/凭据、schema、同步结构、size-limit 上限；不得掩盖失败。

实施前阅读：所有阶段 commit、人工确认结论、CI/视觉记录、上位计划与清单。

必须先运行：git status；两分支专用测试、lint、typecheck、build/check CSS、HTML safety、version check、SW tests、size-limit、npm run ci。

测试要求：不新增业务测试；如发现缺测试，停止并返回对应原子任务。
预期红灯：无；任何失败都不是本任务可顺手修复的范围。

具体实现步骤：
1. 重建 CSS/生成物并确认无额外 diff。
2. 两分支执行总验收。
3. 完成 430/390/360/桌面、浅暗色、减少动效视觉 QA。
4. 仅勾选已验证项。
5. 记录实际 commit、残余风险和回滚点。

完成后运行：最终总审查提示词中的全部命令；git diff --check；git status。

安全检查：确认无 File/Blob/base64、凭据、用户附件进入提交；HTML safety 无新增未审计 sink。
git diff 检查：仅文档和脚本生成物；无业务补丁；生成物可重建；size-limit 不提高。

不确定时：停止并报告，未验证项不得勾选完成。

最终输出：修改文件列表、两分支完整测试结果、视觉 QA 结果、git diff 摘要、未完成项、风险说明、回滚点。
```

---

# 专项审查提示词

## 阶段 3 Sol 审查提示词

```text
审查任务：阶段 3 手动备用模型重试与 Advice 生命周期总审查。

角色：资深前端架构师、异步状态机审查员、安全审查员。只审查阶段 3 已完成差异；不要直接修代码，除非用户另行授权。

审查目标：证明 routeOverride 在每个领域完整透传，manual/automatic/emitted 语义正确，Advice chat/vision 不重复消息、不泄漏 File、不跨模型拼接。

必须阅读：执行手册阶段 3、阶段 3 各 commit、ai-routing-pure.mjs、ai-routing.js、ai-api.js、所有被改领域文件、Advice send/failure/retry/continuation、相关测试。

必须先运行：
1. git status --short --branch
2. git log --oneline <阶段3起点>..HEAD
3. git diff --stat <阶段3起点>..HEAD
4. git diff <阶段3起点>..HEAD -- 相关文件
5. 阶段 3 专项测试、typecheck、HTML safety、size-limit

逐项审查：
1. UI action→领域 options→ai helper→ai.run/runStream→resolveTaskConfig 的参数链是否每段有测试。
2. 是否有任一重试调用 setTaskRoute 或写 cfg.taskRoutes。
3. aiFallback.target 是否严格只有 profileId/modelId。
4. automatic mode、不可重试错误、取消、emitted 后是否错误显示 manual action。
5. food/goal/plan/adjust/report/summary/insight 的重试状态是否幂等。
6. auto-adjust 是否重新读取和重新走 policy。
7. Advice chat 是否 skipUserMessage 且保持 replyToId/versionIdx。
8. Advice vision File 是否只在运行期 Map；success/retry/delete/cancel/TTL/刷新是否清理。
9. File/Blob/base64 是否进入 data.db/localStorage/log/sync/backup。
10. 自动续写是否使用与首段完全相同的 route snapshot。
11. 已有部分输出后是否存在任何跨模型重试入口。
12. 实际模型 meta/cache 是否正确，不仍显示主模型。
13. 是否出现未确认的产品假设。

禁止事项：不得修改凭据/schema/同步结构；不得建议大重构；不得用 CI 通过替代行为审查；不得顺手修无关问题。

git diff 检查：按 commit 核对文件边界；识别大面积格式化、意外生成物、无关功能、阈值变化。

发现问题时：给出严重级别、文件/函数、可复现路径、缺失测试、建议回滚到哪个原子 commit。信息不足时标记“需人工确认”，不得猜测。

输出格式：
1. 审查结论：通过/有条件通过/不通过。
2. P0/P1/P2 发现列表。
3. routeOverride 路径矩阵。
4. Advice 生命周期矩阵。
5. 安全与持久化检查结果。
6. 测试证据。
7. git diff/commit 边界评价。
8. 必须回滚或补测项。
9. 残余风险。
```

## 阶段 4 ui-mockup 同步审查提示词

```text
审查任务：阶段 4 ui-mockup 同步完整性与分支污染审查。

角色：Git 集成负责人、前端架构师、Service Worker 审查员。只审查同步结果，不直接修代码。

审查目标：确认同步按阶段/小 commit 完成，没有整分支覆盖，没有丢失 ui 特有布局，并且共享视觉、路由、最近、fallback、推理语义一致。

必须阅读：4.1 同步矩阵、perfrom 源 commits、ui-mockup 同步 commits、两分支高冲突文件、index loading、sw precache、版本脚本、CSS/size-limit 配置。

必须先运行：
1. 两分支 git status
2. rev-parse HEAD/ui/merge-base
3. git log --left-right --cherry-pick
4. git range-diff 阶段源/目标提交
5. git diff --name-status 和 --stat
6. ui-mockup 相关测试、version check、CSS checks、SW tests、size-limit

逐项审查：
1. 每个目标 commit 是否对应一个源任务，边界是否保留。
2. 是否存在 merge perfrom、批量 cherry-pick、整文件 theirs/ours 痕迹。
3. advice-panel、ai-task-settings、index、sw 的冲突是否语义合并。
4. ui 旧供应商布局是否按人工决定保留。
5. ai-model-visual 是否加载、被两处复用并进入 precache。
6. 新增资产是否实际存在，版本是否一致。
7. 模型 chip 是否无 x，完整抽屉是否仍有恢复默认。
8. toast 是否只在保存成功后出现。
9. 显式推理 advisory 是否与 perfrom 一致且不扩大协议。
10. routeOverride/fallback/recents 的测试是否在 ui 分支同样覆盖。
11. CSS 生成物是否脚本生成，overlap 是否无未解释增加。
12. size-limit 是否未提高。
13. 是否带入无关性能、饮食、附件或用户文件。

禁止事项：不得建议整分支重建；不得修改 size 阈值；不得把 CI 当唯一证据；不得修无关差异。

发现问题时：指出源 commit、目标 commit、冲突文件、丢失语义、推荐 revert/重新 patch 的最小范围。不能判断时标人工确认。

输出格式：
1. 同步结论。
2. commit 映射核验表。
3. 冲突高风险文件审查。
4. SW/版本/资产结果。
5. CSS/size-limit 结果。
6. 无关差异与污染列表。
7. 必须回滚/重做项。
8. 残余风险。
```

## 最终合并前总审查提示词

```text
审查任务：AI 功能路由与模型控件闭环最终合并审查。

角色：最终代码审查负责人、测试负责人、安全负责人。只审查，不直接写代码。

审查目标：确认阶段 0–5 的产品行为、测试、安全、分支同步、Service Worker、CSS 和 size-limit 全部满足计划，并判断是否可合并。

必须阅读：上位计划、执行手册、逐任务提示词、人工确认结论、所有阶段 commits、阶段 3/4 专项审查、视觉 QA 记录。

必须先运行：
1. 两分支 git status/commit/merge-base
2. 全部专用测试
3. npm run lint
4. npm run typecheck
5. npm run test
6. npm run build:css 后确认无额外 diff
7. npm run check:css
8. npm run check:html-safety
9. node scripts/bump-version.js --check
10. Service Worker/离线测试
11. npx --yes size-limit
12. npm run ci

必须验证的非 CI 行为：
1. 13 个 task 实际消费路由。
2. manual fallback 不持久化改变 route。
3. automatic/manual/no fallback/emitted/cancel 状态矩阵。
4. Advice chat/vision 消息、版本、附件和续写矩阵。
5. File/Blob/base64 未持久化。
6. recents/favorites 跨 picker 语义。
7. requiredCapabilities 三态且不硬过滤。
8. family/group/localPicker 实际有行为。
9. ui-mockup 无整分支覆盖。
10. 430/390/360/桌面，浅色/暗色/减少动效视觉结果。
11. SW 资产存在、版本一致、离线可用。
12. CSS 生成可重复、overlap 无未解释增加。
13. size-limit 未提高。
14. 无用户附件、临时 profile、截图缓存、凭据进入提交。

git diff 审查：按 commit 验证单一目的和可 revert；查找大面积格式化、无关修复、阈值变化、schema/sync 变化、手工 generated CSS。

发现不明确或冲突：列入“阻塞合并的人工确认”，不得擅自解释为通过。

输出格式：
1. 最终结论：可合并/有条件可合并/禁止合并。
2. 阻塞项。
3. 非阻塞风险。
4. 产品行为矩阵结果。
5. 安全/数据检查结果。
6. 测试/构建/视觉证据。
7. commit 与回滚评价。
8. ui-mockup 同步评价。
9. 合并后监测建议（只限现有日志/事件，不新增系统）。
```

---

# 执行 agent 卡住时的报告模板

```text
【阻塞报告】

任务编号与名称：
当前分支 / commit：
工作树状态：

已完成：
-

阻塞点：
- 具体文件/函数：
- 触发命令或操作：
- 实际结果：
- 预期结果：

已尝试且未解决：
1.
2.
3.

证据：
- 测试命令与失败摘要：
- CodeGraph callers/impact 摘要：
- git diff --stat：
- 相关日志（必须脱敏，不得包含 API Key、Authorization、File 内容或用户隐私）：

为什么不能安全继续：
-

需要人工确认的问题：
1.

建议选项（只陈述影响，不替用户决定）：
- 选项 A：
- 选项 B：

当前修改文件：
-

是否产生未提交改动：是 / 否
是否需要回滚：是 / 否
最小回滚方式：

未完成项：
-

残余风险：
-

注意：已停止继续修改；未执行 reset/clean/checkout/整分支 merge；未自行假设产品语义。
```
