# Learnings

## [LRN-20260712-001] correction

**Logged**: 2026-07-12T00:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
AI 设置中的任务模型抽屉与 AI 教练的模型选择器是两条不同的交互路径，修复前者不能作为后者滑动体验的验证。

### Details
用户再次反馈 AI 教练处模型选择仍存在手势与文字不同步。上一轮只为 `.ai-task-quick-card` / `.ai-task-quick-body` 建立了单滚动容器，未覆盖 `advice-panel.js` 渲染的 `.model-picker-body` 和 `.model-picker-tabs`。

### Suggested Action
分别为 AI 教练模型选择器建立可复现测试与专属滚动/手势实现，并在 AI 教练入口完成移动端视觉验证。

### Resolution
AI 教练选择器现使用专属单滚动容器、三段式滑动指示器和 Pointer Events 横向分页。三页内容与指示器会随手势同步位移，松手后仅切换一页；已在全新 localhost 端口的 390×844 视口从真实 AI 教练入口验证。

### Metadata
- Source: user_feedback
- Related Files: advice-panel.js, css-src/48-advice-model-picker.css, sheet-drag.js
- Tags: ai-coach, model-picker, touch, correction

---

## [LRN-20260713-001] correction

**Logged**: 2026-07-13T00:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
不要仅凭文件在代理执行期间变脏就认定为代理越权；用户可能同时修改同一工作树。

### Details
审查 3.9 时发现 Advice 附件、模型 chip 与 CSS 文件新增差异，错误地归因给子代理并发出了撤回指令。用户确认这些是其本人修改。撤回指令被及时中止，未产生文件修改。

### Suggested Action
审查子代理前记录任务起始文件快照；发现额外差异时先向子代理询问实际修改清单，并保留用户明确认领的改动，不能按时间相关性自动归因或回退。

### Metadata
- Source: user_feedback
- Related Files: advice-attachments.js, advice-panel.js, css-src/46-advice-ai.css, css-src/54-v6-ai.css
- Tags: multi-agent, dirty-worktree, ownership, correction

---
