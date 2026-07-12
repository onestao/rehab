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
