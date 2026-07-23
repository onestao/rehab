# 性能预算架构

## 首屏合同

`size-limit` 的首屏预算由 `index.html` 中带 `data-rehab-entry` 的同步启动脚本定义。合同测试会校验 `.size-limit.cjs` 与这些入口严格一致，避免预算与真实加载路径脱节。

当前 20 个启动脚本的 Brotli 合计为 `43.60 kB`，预算为 `52 kB`。页面 UI、更新运行时、延迟存储、食物库和凭据字段使用独立预算，不能通过扩大首屏清单掩盖增长。

## 启动分层

- `data-ui-core.js` 只提供启动期需要的 modal、busy、collapse 和健康 CSS intent。
- Records/Profile 交互实现保留在按页加载的 `data-ui-state.js`。
- `data-store.js` 同步建立稳定的 `data`/Advice interface，并负责持久化核心。
- 3 秒后的 IDB migration 和 Advice 冷数据补载由 `data-store-deferred.js` 按需加载。

这些拆分不改变静态 PWA、IIFE/`window` adapter 或 `data` facade 合同。

## 修改要求

新增启动脚本、页面依赖或延迟模块时，必须同步更新：

- `index.html` 的入口、`PAGE_DEPS` 或 prerequisites。
- `sw.js` 的 precache 资源。
- `.size-limit.cjs` 的对应预算分类。

验证命令：

```powershell
npm run check:size-limit-coverage
npx --yes size-limit
node scripts/bump-version.js --check
```
