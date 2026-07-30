# 联网检索 Sprint 2–4 实施与验收记录

> 日期：2026-07-30  
> 状态：第九轮 Gemini 最终序列化快照 P1 已关闭；v410 无参数完整门禁通过  
> 分支：`perfrom`  
> 基线：v398；当前候选版本：v410  
> 前置记录：`web-search-integration-design.md`、`web-search-merge-review-fix-plan.md`

## 1. 本轮结论

Sprint 2–4 主体已从计划转为实现；能否合并仍以本文件所列安全边界和一次干净完整 CI 为准：

1. 外部搜索从 Tavily / Brave / SearXNG 扩展到 Exa / Jina / Serper / DuckDuckGo。
2. 新增受控 `fetch_url`，通过 Jina Reader 或 Tavily Extract 深读本轮证据或用户明确给出的 HTTPS URL。
3. 计划、目标、总结、体重报告和快速洞察均能保存安全引用摘要并在刷新后展示。
4. 未知来源不能通过自报 `sourceType: academic` 获得学术标签或排序权重。
5. Gemini URL Context 与 OpenRouter Web Search plugin 已进入原生联网变体。
6. 新增浏览器专项门禁，覆盖供应商表单、浏览器请求、无 Cookie、360/390 px 布局和引用刷新恢复。
7. `fetch_url` 授权只接受入口显式生成的冻结 `userProvidedUrls`；数据库/导入上下文即使序列化为 `user` 消息也不授权，JSON 修复与同动作 fallback 复用原集合。
8. 来源 schema 只在 `search-evidence-schema-pure.js` 定义；浏览器 ESM 与 CommonJS/VM 报告路径调用同一实现，未知域名自报无法提升等级。声明超限响应会在读取前 cancel body 并 abort。
9. `food.verify` 与 `rehab.weekly` 都只从当前原始输入生成冻结 `userProvidedUrls`；候选对象、健康档案和导入上下文中的 URL 即使进入 `user` 消息也不授权。`verifyAiFood()` 用自有 `input` 属性区分显式空输入与未传输入，永不回退 `item.name`。图片识别把模型描述仅作为 `queryContext`，并以空 `authorizationInput` 执行自动核实；图片结果手动核实也不会读取无关的 `foodAiText`。
10. Gemini 在合入全部 request options 与原生搜索工具后只生成一次可发送的纯 JSON 快照；该步骤统一触发自身/继承 `toJSON()` 与 getter。URL provenance、`url_context` 决策、原子预算和最终 fetch 字符串都基于该快照，原始对象不会再次序列化。快照中的字符串值和动态对象键只要出现任一未授权 HTTP(S) URL，就不添加 `url_context`，且不消耗 `native-fetch` 预算。

仍保留的边界：

- DuckDuckGo Instant Answers 不是稳定的通用搜索 API，继续标记为 `experimental`。
- 第三方公网 CORS 会受供应商、账号、区域和网络环境影响；拦截式浏览器契约通过不等于所有公网环境都可直连。
- DashScope、Grok、Claude 新工具版本与 Gemini 其他上下文工具按真实需求后续接入，不作为本轮硬门禁。

## 2. 供应商契约

| 类型 | Search endpoint | 认证 | 响应映射 | Key | 状态 |
|---|---|---|---|---|---|
| Tavily | `POST https://api.tavily.com/search` | Bearer | `results[].title/url/content` | 必需 | 稳定 |
| Brave | `GET https://api.search.brave.com/res/v1/web/search` | `X-Subscription-Token` | `web.results[]` | 必需 | 稳定 |
| SearXNG | 用户配置的 HTTPS `/search` | 无固定认证 | `results[]` | 否 | 自托管 |
| Exa | `POST https://api.exa.ai/search` | `x-api-key` | `results[].title/url/summary/text/highlights` | 必需 | 已接入 |
| Jina Search | `GET https://s.jina.ai/?q=...` | Bearer | `data[]` / `results[]` | 当前 Search 必需 | 已接入 |
| Serper | `POST https://google.serper.dev/search` | `X-API-KEY` | `organic[].title/link/snippet` | 必需 | 已接入 |
| DuckDuckGo | `GET https://api.duckduckgo.com/` | 无 | `Abstract*` + `RelatedTopics` | 否 | 实验性 |

设置 UI 契约：

- SearXNG 显示自托管 HTTPS 地址。
- SearXNG 与 DuckDuckGo 隐藏 API Key。
- Exa、Jina、Serper、Tavily、Brave 显示本机密钥字段。
- 密钥继续由 `search-store.js` 隔离保存，不进入 `data.db` 或普通同步数据。

每个新增供应商均有成功、空结果、HTTP 错误和缺 Key 运行时测试。浏览器测试还验证请求方法、认证 header 名称，以及 `credentials: omit` 下不发送环境 Cookie。

## 3. 受控网页深读

### 3.1 工具契约

```text
search_web({ query })
fetch_url({ url })
```

`fetch_url` 仅接受：

- 本轮 `search_web` 返回的 URL；或
- 由业务入口从当前原始输入字段显式提取并传入的 URL。序列化为 `user` 消息的档案、历史和导入内容不属于授权来源。

URL 安全规则：

- 仅 HTTPS。
- 禁止用户名、密码和非 443 端口。
- 拒绝 localhost、IP 地址、内部域名后缀和 `.onion`。
- 去除 fragment。
- Reader 返回 URL 必须与请求 URL 同源，防止跨域重定向偷换目标。

### 3.2 Reader

| Reader | Endpoint | 认证 | 限制 |
|---|---|---|---|
| Tavily Extract | `POST https://api.tavily.com/extract` | Bearer | 响应 750 KB；规范化正文 24,000 字符 |
| Jina Reader | `GET https://r.jina.ai/<https-url>` | Bearer 可选 | 响应 750 KB；规范化正文 24,000 字符 |

正文在工具回传中标记为 `untrusted-web-content`。持久化时只保存来源摘要，不保存 `contentExcerpt`。

### 3.3 共享预算

一次用户动作仍最多两次真实网络动作：

```text
search_web → fetch_url = 2 次
Reader A 失败 → Reader B 成功 = 2 次
provider A 失败 → provider B 成功 = 2 次
```

JSON 修复、模型 fallback、供应商 fallback 和网页深读复用同一个 `searchBudget`。计划任务运行时测试验证：第一次供应商后备耗尽两次预算后，第二次 JSON 修复不能获得新预算。

## 4. 来源信任修复

`sourceType` 与 `official` 默认只由 URL 域名规则推导。未知域名即使传入：

```json
{ "sourceType": "academic", "official": true }
```

也会降级为：

```json
{ "sourceType": "other", "official": false }
```

只有可信结构化适配器调用可以显式设置 `trustedSourceType: true`。健康任务排序不再接受不可信数据自报的学术权重。

浏览器与 CommonJS 不再各自维护证据 schema：`search-policy-pure.mjs` 通过静态依赖复用 `search-evidence-schema-pure.js`，`report-search-evidence-pure.cjs` 只是同一源文件的无 DOM 加载器。跨环境测试同时覆盖未知域名伪造 `medical-guideline/official=true` 和 `who.int` 的可信域名推导。

## 5. 跨任务引用闭环

统一生命周期：

```text
搜索 / 原生引用 / 网页深读
→ normalizeSearchEvidence
→ result.meta.searchEvidence
→ summarizeSearchEvidence
→ 业务记录安全落盘
→ searchEvidenceUi 刷新后渲染
```

| 任务 | 落盘位置 | 刷新后展示 |
|---|---|---|
| `plan.today` / `plan.week` | daily plan 的 `searchEvidence` | Today 计划卡 |
| `goal.body` | `bodyPlan` / `weightPlan` | 目标方案卡 |
| `summary.weekly` / `summary.monthly` | report version | 周/月总结结果 |
| `report.weight.weekly` / `report.weight.monthly` | report version | 体重报告详情 |
| `insight.quick` | 当日洞察缓存 | 快速洞察结果区 |
| `advice.*` / `rehab.weekly` / `food.*` | 原有记录结构 | 原有引用 trail / 证据卡 |

入口授权回归还验证：food 的 `ingredients/candidate` 内历史 URL、康复健康档案内导入 URL可以进入模型上下文，但对应 `userProvidedUrls` 必须为空；当前食物描述或康复 textarea 中的 HTTPS URL 则保持冻结集合并跨 JSON 重试复用。

安全摘要只保留：

```text
id, title, url, domain, providerId, retrievedAt,
sourceType, official, readStatus, readerProviderId
```

`contentExcerpt` 不进入持久化记录；报告版本删除 `ai.searchEvidence` 副本，只保留顶层安全摘要。

UI 明确显示：`仅摘要` 或 `已深读`。

## 6. 原生联网变体

### Gemini URL Context

- Gemini 模型支持 URL Context、授权集合非空，且合入全部 request options 和原生工具后生成的纯 JSON 快照中，字符串值与动态对象键的所有 HTTP(S) URL 都能在冻结授权集合中逐一匹配时，`google_search` 与 `url_context` 才可同时进入请求。
- `urlContextMetadata` 成功项转换为 `readStatus: deep-read` 的统一证据。
- 自身或继承的 `toJSON()` 注入、状态型 getter、动态对象键、后合入 request options、混合来源请求、未授权 HTTPS URL、HTTP URL 或安全规范化失败的 URL 都会在同一快照上禁用 `url_context`；发送字符串不会再次读取原始 getter/`toJSON()`。
- 域名白名单与 Gemini 原生 Search 不兼容时，继续提供外部服务恢复路径。

### OpenRouter Web Search plugin

- 根据 OpenRouter hostname 或连接名称识别。
- Chat 与图片 Chat 请求使用统一 `web` plugin。
- 传递任务级 `max_results` 与 `include_domains`。
- 引用继续经过统一 evidence 归一化与持久化链路。

## 7. 浏览器与运行时验收

新增命令：

```text
npm run test:browser:web-search
```

浏览器专项场景：

1. 设置表单列出 Exa、Jina、Serper、DuckDuckGo，并正确显示/隐藏 Key。
2. 浏览器请求验证 Exa/Jina/Serper/DDG 的方法、认证 header 名称和无 Cookie。
3. AI 任务控件在 360 px 保持单行，无水平溢出。
4. AI 任务控件在 390 px 保持单行，无水平溢出。
5. 引用安全摘要经本地存储和页面刷新后仍显示 `已深读`，且不存在正文副本。

浏览器启动策略：优先 `AUDIT_CHANNEL` 或 Edge；执行环境无法解析 Edge channel 时，回退已安装的 Playwright Chromium 并记录实际通道。该回退只影响测试通道，不改变应用行为。

DDG 公网探针不作为发布硬门禁。若目标浏览器或网络无法直连，可通过用户自建 SearXNG 选择 DuckDuckGo 引擎。

## 8. 发布门禁

```powershell
npm run build:css
npm run ci
npm run test:browser:lazyload
npm run test:browser:lifecycle
npm run test:browser:web-search
node scripts/bump-version.js --check
git diff --check
```

不得通过提高 size-limit 或 CSS 冲突阈值完成验收。

本轮 v410 最终结果：`tests 1025 / pass 1025 / fail 0`；CSS overlap 仍为 219/220，HTML safety 为 32 个文件 / 125 个 sink，全部 size-limit、版本同步与 `git diff --check` 均通过。`ai-bundle` 为 143.86/144 KB，`search-bundle` 为 25.72/30 KB。第九轮新增自身/继承 `toJSON()`、状态型 getter、动态键、后合入 request options，以及快照预算与最终发送一致性回归。
