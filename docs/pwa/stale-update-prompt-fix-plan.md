# PWA 更新完成后仍提示“发现新版本”修复计划

## 1. 任务目标

修复以下间歇性问题：PWA 已完成新版 Service Worker 激活，当前页面脚本和 controller 也已经是当前发布版本，但页面仍保留或再次弹出“发现新版本”提示。

完成后必须同时满足：

- 更新完成且当前文档已经是目标版本时，不重复刷新页面。
- 上述场景中，更新横幅、更新遮罩和内存中的 waiting worker 状态全部被清理。
- 手动“检测更新”不能把已经 `activated` 的旧 worker 引用识别为待安装更新。
- 真正处于 `installed`/waiting 状态的新 worker 仍然显示更新提示。
- 训练、待写入数据、未保存草稿的更新阻塞协议保持不变。
- 多标签页迁移、旧缓存保留和 `V327_PAGE_READY` 确认协议保持不变。

## 2. 已确认根因

主要链路位于 `app-update.js`：

1. `show(worker)` 将 worker 保存到 `appUpdate.waitingWorker`，并显示“发现新版本”。
2. 用户应用更新后，新 worker 激活并触发 `controllerchange`。
3. `reloadIfNeeded()` 发现当前文档已经加载目标版本脚本，于是正确跳过刷新。
4. 该成功分支目前只发送 `V327_PAGE_READY` 并关闭升级遮罩，没有：
   - 隐藏 `#appUpdateBanner`；
   - 清空 `appUpdate.waitingWorker`；
   - 清理可能存在的更新阻塞 watcher。
5. `checkNow()` 后续使用 `registration.waiting || this.waitingWorker`。即使浏览器中的 `registration.waiting` 已经为空，过期的内存引用仍可能被当作新更新。

确定性复现结果：

```json
{
  "pageVersion": "361",
  "controllerVersion": "361",
  "reloads": 0,
  "bannerHidden": false,
  "title": "发现新版本"
}
```

回归来源：提交 `bf81275`（2026-07-18）引入“当前文档已是目标版本时跳过刷新”的分支，但没有同步完成 UI/内存状态收尾。提交 `7e9402c` 后续补了遮罩关闭，仍未清理横幅和 worker 引用。提交 `e575601` 扩展了更新阻塞分类，但不是本问题的首次引入点。

## 3. 修改范围

### 必须修改

- `app-update.js`
- 新增或扩展一份 `test/*.test.mjs` 更新完成生命周期测试
- 按仓库版本规则更新 PWA 版本和生成产物

### 原则上不修改

- `sw.js` 的激活、迁移、缓存删除和 client defer 协议逻辑
- `index.html` 的 quiet registration 流程
- `docs/pwa/update-session-safety.md`，除非实际实现改变了该文档描述的协议
- CSS、后端或构建方式

如果测试证明必须修改 `sw.js` 或 quiet registration，先记录新的独立失败用例，再扩大范围；不要把推测性改动混入本修复。

## 4. 实施步骤

### 阶段 A：先增加失败测试

建议新建 `test/app-update-completion.test.mjs`，也可以扩展 `test/controller-reload-claim.test.mjs`。优先新建独立文件，避免继续扩大现有大型测试文件。

构造 VM harness，至少提供：

- 可观察的 `appUpdateBanner.classList`；
- 可变的 `navigator.serviceWorker.controller`；
- 可捕获的 `controllerchange` 回调；
- `document.scripts` 中的当前版本资源；
- reload 次数；
- registration 的 `waiting`、`installing` 和 `update()`；
- toast 消息和 `waitingWorker` 状态。

先写并确认以下测试在当前代码上失败：

#### T1：当前文档完成更新后收起提示

场景：

1. 页面脚本已经是当前发布版本。
2. 初始 controller 是旧版本。
3. `show(installedWorker)` 显示更新横幅。
4. 绑定 controller reload。
5. 将 controller 切换到当前版本并触发 `controllerchange`。

断言：

- `window.location.reload()` 调用次数为 0；
- 横幅包含 `hidden`；
- 升级遮罩不存在或已隐藏；
- `appUpdate.waitingWorker === null`；
- 当前 controller 收到一次版本正确的 `V327_PAGE_READY`。

当前代码预期失败点：横幅仍可见，`waitingWorker` 仍指向旧 worker。

#### T2：手动检测忽略已激活的旧引用

场景：

- `registration.waiting === null`；
- `registration.installing === null`；
- `appUpdate.waitingWorker.state === 'activated'`；
- `registration.update()` 正常完成。

断言：

- `checkNow()` 返回 `{ ok: true, updateFound: false }`；
- 提示为“已是最新版本”；
- 不重新显示更新横幅；
- 过期的 `waitingWorker` 被清空。

#### T3：真实 waiting worker 仍提示更新

场景：`registration.waiting.state === 'installed'`。

断言：

- `checkNow()` 返回 `updateFound: true`；
- 横幅显示“发现新版本”；
- `waitingWorker` 指向该 installed worker。

#### T4：不要过早抑制合法提示

场景：页面资源已经是目标版本，但 controller 仍为旧版本，目标 worker 仍处于 `installed`/waiting。

断言：更新横幅仍然显示。只有收到 controllerchange、确认新版 controller 已接管后，才能执行完成态清理。

这条测试用于防止错误实现：不能仅凭“页面脚本是当前版本”就在 `show()` 中无条件抑制更新提示。

### 阶段 B：实现集中式完成态清理

在 `appUpdate` 内新增一个小型、无异步副作用的收尾方法，例如 `clearCompletedUpdateState()`。名称可调整，但职责必须集中，不要在多个分支复制清理语句。

该方法应：

1. 将 `this.waitingWorker` 设为 `null`。
2. 将 `this.deferredForSession` 恢复为 `false`。
3. 清除 `_updateBlockClearWatch` / `_sessionClearWatch` 中仍存在的 interval，并将两个字段归一为 `null`。
4. 调用 `dismiss()` 隐藏更新横幅。
5. 调用 `hideUpgradeOverlay()` 清除更新遮罩。

注意：

- 不要修改或伪造只读的 `registration.waiting`。
- 不要在该方法中删除 Cache Storage。
- 不要在该方法中调用 `skipWaiting()` 或强制 reload。
- `V327_PAGE_READY` 仍由现有 controllerchange 成功分支发送；不要删除这一步。

在 `reloadIfNeeded()` 的 `documentNeedsControllerReload() === false` 分支中：

1. 保留 errorBus 事件。
2. 保留带当前版本号的 `V327_PAGE_READY`。
3. 随后调用集中式完成态清理。
4. 返回，不刷新页面。

### 阶段 C：防御过期 worker 引用

新增一个很小的 worker 状态判断，例如 `isPendingUpdateWorker(worker)`：

- 只有真实 `ServiceWorker` 的 `state === 'installed'` 才可作为待应用更新。
- `activating`、`activated`、`redundant` 和空引用都不是待应用更新。

将判断用于以下位置：

- `checkNow()` 选择 `registration.waiting`、`this.waitingWorker` 或 installing worker 时；
- 必要时用于 `show(worker)` 的入口保护；
- update blocker watcher 解除后准备重新显示横幅时。

推荐行为：

- 如果 remembered worker 已不是 `installed`，清空该引用。
- 如果页面仍需要刷新但 worker 已激活，应使用现有“更新已完成，请刷新页面”状态，不要再次显示“发现新版本”。
- `show()` 是否改为返回 boolean 由实现者决定；如果修改返回值，确保 `checkNow()` 只在真正显示/确认 pending worker 后返回 `updateFound: true`。

避免以下错误修法：

- 不要因为当前页面脚本版本匹配就一律隐藏 waiting worker；页面资源可能已新、controller 仍旧，激活仍未完成。
- 不要只改提示文字而保留 stale `waitingWorker`。
- 不要通过无条件 reload 掩盖问题；跳过重复刷新本身是正确行为。
- 不要让 `checkNow()` 仅以对象是否存在判断更新状态。

### 阶段 D：版本更新

`app-update.js` 是已缓存的浏览器运行资源。逻辑和测试通过后，执行一次仓库版本更新脚本，使修复能够被现有 PWA 获取：

```powershell
node scripts/bump-version.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

检查版本脚本更新的 `app-update.js`、`index.html`、`sw.js`、相关 scripts 和 `build/` 生成产物。不要手工只改其中一个版本号。

随后执行：

```powershell
node scripts/bump-version.js --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

本任务没有 CSS 修改，不需要仅为本修复运行 `npm run build:css`；如果 agent 顺带改了 CSS，则必须按项目规则构建并检查 CSS。

## 5. 验证顺序

先运行最小反馈环：

```powershell
node --test test/app-update-completion.test.mjs
```

如果测试追加到已有文件，则改为对应文件名。确认测试经历过一次“修复前失败、修复后通过”。

再运行 PWA 相关回归：

```powershell
node --test test/app-update-session-safety.test.mjs test/controller-reload-claim.test.mjs test/service-worker-version-gate.test.mjs test/service-worker-version-fetch.test.mjs test/sw-client-defer-protocol.test.mjs
```

最后运行完整门禁：

```powershell
npm run ci
```

每条重要命令执行后检查 `$LASTEXITCODE`，前一阶段失败时不要继续后续验证。

## 6. 验收标准

- T1–T4 全部通过。
- 现有 session safety、controller reload、version gate、SW migration 测试全部通过。
- `npm run ci` 通过。
- `node scripts/bump-version.js --check` 通过。
- 当前版本页面完成 controllerchange 后：不 reload、不显示更新横幅、无升级遮罩、无 stale waiting worker。
- 真正 waiting 的新 worker 仍显示更新提示。
- 训练中、待保存、未保存草稿场景仍不会被强制刷新。
- 没有新增 Cache Storage 删除、自动 `skipWaiting` 或跨标签页共享 reload claim。
- `git diff --check` 无空白错误，工作区中没有临时 harness 或调试日志。

## 7. 建议提交方式

建议使用一个原子提交，包含失败测试、运行时修复、版本更新和必要生成产物，避免出现“代码已改但 PWA 版本未更新”的中间提交：

```text
fix: clear stale PWA update prompt after activation
```

提交说明应记录根因：当前文档跳过重复 reload 后，没有清理横幅和 remembered waiting worker，导致后续检测误报更新。

## 8. Agent 完成报告模板

执行 agent 最终应报告：

- 修改了哪些文件和核心行为。
- 修复前失败测试的具体断言。
- 修复后最小测试、PWA 回归、版本检查和 `npm run ci` 的真实结果。
- 最终发布版本号。
- 是否扩大了 `sw.js` 或 quiet registration 的修改范围；若扩大，说明对应失败证据。
- 仍存在的浏览器实机或多标签页验证风险。
