# AI 训练计划与补练重排优化计划

> 生成日期：2026-07-01  
> 状态：方案已确认，尚未实现  
> 范围：AI 训练计划、进阶逻辑、漏练补偿、变更预览、用户反馈优先级

---

## 背景

当前项目已经具备训练计划生成、计划执行、反馈记录、自动调整和周计划视图：

| 能力 | 主要文件 |
|---|---|
| AI 生成训练计划 | `plan-ai.js`, `plan-ai-pure.js` |
| 计划数据和任务状态 | `plan-store.js`, `plan-store-pure.js` |
| 体感反馈和进阶评估 | `plan-feedback.js`, `plan-progression.js`, `rehab-progression-pure.js` |
| 训练执行回写计划 | `plan-ui.js`, `workout-core.js`, `workout-engine.js` |
| 自动调整明日计划 | `plan-auto-adjust.js` |
| 医嘱/安全策略清洗 | `rehab-policy.js` |
| 周计划和拖拽移动 | `plan-weekly.js` |

现有逻辑的基础是可用的，测试也覆盖了大量解析、策略、进阶和计划存储场景。但 AI 建议、规则进阶、用户反馈、漏练补偿和 UI 变更确认之间还缺少统一的“调整批次”模型，容易出现以下问题：

- 已完成任务被进阶逻辑直接改名或改参数，历史事实和下一次计划混在一起。
- AI 被 prompt 要求遵守 `progressionSignal`，但客户端保存前没有硬性验证。
- AI 重排时会保留已完成/锁定任务，再追加新任务，最终可能出现重复或等价动作堆叠。
- 用户关闭反馈 sheet 与点击“跳过”的后续流程不一致。
- 训练过短手动停止时，计划任务可能停留在 `in-progress`。
- 漏练任务已有手动移动能力，但没有完整的自动补练/等负载替代流程。

---

## 已确认决策

1. 已完成任务是历史事实，不再被进阶逻辑改名或改参数。
2. 进阶、降载、加组、替换动作只影响下一次和以后的计划。
3. 未来计划只自动改“未锁定、未完成、AI/系统生成”的任务；用户编辑、锁定、已完成的一律不碰。
4. 用户反馈是最高训练信号；AI 只能提案，规则引擎负责把用户反馈翻译成计划调整。
5. 系统可以提醒风险，但最终以用户决策为主。用户确认高风险动作后，该任务应标记为 `userOverride=true`，以后 AI 不自动覆盖。
6. 低风险小改自动应用并可撤销；换动作、升级动作、非医嘱新增、批量覆盖未来计划必须预览确认。
7. 漏练使用混合策略：康复/医嘱动作优先原样顺延；增肌/减脂/综合训练按相近部位、强度和训练量替代。
8. 漏练处理有两个触发点：今日页打开时轻提示并一键处理；AI 重排时把漏练作为强上下文。
9. 漏练合并今天计划时先做负载预算；能安全合并就合并，超过预算就给用户预览，由用户决定追加、替换、拆分或放弃。
10. 今日负载预算使用混合模型：动作数量硬上限 + 部位频率、RPE、疼痛、未完成历史、近期完成率动态调整。
11. 训练量要根据用户反馈动态调整，避免过低、过高或重复组数过多。
12. 重复组数先按同身份动作合并；合并后仍过量就降载或拆到未来。
13. 替换动作时，可以加入同部位但不同子部位、不同收缩方式的动作，例如静态 + 动态组合；替换必须让用户预览确认。
14. AI/补练/重排必须给“变更预览”，逐条显示保留、顺延、合并、替换、降载、拆到未来，并允许单条接受或拒绝。
15. 每次 AI 重排、补练、自动调整都保存 adjustment batch，记录变更前后、原因、用户接受/拒绝项、来源是 AI 还是本地规则；UI 默认突出最近一次撤销。
16. 用户拒绝某条调整后，先短期记住；如果多次拒绝同类调整，再升级为长期偏好/策略上下文。
17. 拒绝记录分两层：具体动作变更优先，调整类型作为泛化偏好。

---

## 目标

1. 建立统一的计划调整模型，让 AI、规则引擎、漏练补偿、用户手动确认都走同一套变更预览和落库流程。
2. 把“用户反馈优先”落到数据结构和保存校验中，而不是只写在 prompt 里。
3. 让漏练补偿从“手动移动任务”升级为“负载预算 + 原样顺延/等负载替代 + 用户可确认”的完整工作流。
4. 提高 UI 可解释性：用户能看见每次计划为什么被改、改了什么、能不能撤销。
5. 保持项目现有静态 PWA 架构，不引入后端或 bundler。

---

## 非目标

- 不重新设计整个训练计划系统。
- 不改动 AI provider、模型配置、同步底层或备份底层。
- 不让 AI 直接绕过本地策略写入计划。
- 不把所有变更都自动应用；高风险和大幅变化必须预览。
- 不把漏练简单堆到今天，避免训练量失控。

---

## 现状观察

### 进阶会修改当前任务

`plan-feedback.js` 保存反馈后调用 `maybeApplyProgression()`：

```js
this.maybeApplyProgression?.(ctx.planId, ctx.taskId);
```

`plan-store.js` 中 `maybeApplyProgression()` 当前会直接改当前任务：

- `task.currentLevel = result.targetLevel`
- `task.name = target.name`
- `task.spec = { ...task.spec, ...suggestedSpec }`

这与“已完成任务是历史事实”冲突。后续应改成生成下一次建议，而不是改当前完成项。

### AI 进阶约束主要停留在 prompt

`plan-ai.js` 的 prompt 已要求 AI 遵守：

- `hold`
- `progress`
- `deload`
- `volume-up`
- `userOverride`
- `pain >= 4`

但保存前主要依赖 `rehab-policy.js` 的 `sanitizeGeneratedPlans()` 做安全清洗，没有专门验证 AI 是否违反 `progressionSignal`。后续需要本地 validator。

### 自动调整只处理已完成计划

`plan-auto-adjust.js` 的 `autoAdjustNextDayPlans()` 会从已完成计划生成明日计划：

```js
.filter((plan) => plan.date === sourceDate && completion(plan).complete)
```

这意味着漏练计划不会进入自动调整主路径。目前存在手动 `moveTask()` 和周计划 missed 统计，但没有自动 carry-over 策略。

### UI 已有部分能力但缺少统一预览

现有 UI 能做到：

- 手动完成任务并记录反馈。
- 从计划任务启动训练器。
- 训练完成后回写 `done`。
- 手动把任务移动到今天/明天。
- AI 计划生成后有可编辑预览。

缺失的是：

- “变更 diff 预览”。
- 逐条接受/拒绝。
- 调整批次记录。
- 用户拒绝短期记忆。
- 漏练自动处理入口。

---

## 建议数据模型

### Adjustment Batch

新增或扩展 `db.planAdjustments`，保存每次计划调整批次。

```js
{
  id: 'adj_...',
  source: 'local-rule' | 'ai' | 'missed-carryover' | 'auto-after-feedback' | 'manual-preview',
  status: 'previewed' | 'applied' | 'partially-applied' | 'reverted' | 'dismissed',
  createdAt: 1710000000000,
  appliedAt: 1710000000000,
  sourceDate: '2026-07-01',
  targetDates: ['2026-07-02'],
  trigger: {
    type: 'feedback-saved' | 'today-opened' | 'ai-regenerate' | 'manual-click',
    planId: '...',
    taskId: '...'
  },
  summary: '根据今日反馈调整明天计划',
  beforePlans: [],
  afterPlans: [],
  changes: [
    {
      id: 'chg_...',
      type: 'keep' | 'carry-over' | 'merge' | 'replace' | 'deload' | 'volume-up' | 'progress' | 'split-future' | 'remove',
      risk: 'low' | 'medium' | 'high',
      status: 'accepted' | 'rejected' | 'auto-applied' | 'pending',
      reason: '用户反馈太轻，主训练小幅加一组',
      sourceTask: {
        planId: '...',
        taskId: '...',
        date: '2026-07-01',
        name: '基础臀桥'
      },
      targetTask: {
        planId: '...',
        taskId: '...',
        date: '2026-07-02',
        name: '夹砖臀桥'
      },
      identity: {
        actionKey: '...',
        prescriptionActionId: '...',
        progressionGroup: '...',
        bodyPart: '髋',
        subBodyPart: '臀中肌',
        contractionType: 'dynamic'
      },
      loadDelta: {
        sets: 1,
        reps: 0,
        work: 0,
        estimatedLoad: 12
      }
    }
  ],
  rejectedChangeIds: [],
  acceptedChangeIds: [],
  undo: {
    beforePlansRef: 'inline',
    canUndo: true
  }
}
```

### Adjustment Preference Memory

新增或扩展 `db.planAdjustmentPrefs`，先短期记忆，多次拒绝后升级长期偏好。

```js
{
  shortTermRejects: [
    {
      id: 'rej_...',
      createdAt: 1710000000000,
      expiresAt: 1710604800000,
      changeType: 'progress',
      fromActionKey: 'bridge-basic',
      toActionKey: 'bridge-single-leg',
      progressionGroup: 'bridge-adduction',
      bodyPart: '髋',
      reason: '用户拒绝本次升级'
    }
  ],
  longTermPrefs: [
    {
      id: 'pref_...',
      createdAt: 1710000000000,
      scope: 'specific-action-change' | 'adjustment-type',
      changeType: 'volume-up',
      fromActionKey: '',
      toActionKey: '',
      rule: '不要自动加组',
      enabled: true
    }
  ]
}
```

推荐升级规则：

- 同一具体动作变更 7 天内拒绝 1 次：短期不再主动建议。
- 30 天内拒绝同类 2-3 次：升级为长期偏好。
- 长期偏好应在设置或预览 UI 中可撤销。

### Next Progression Suggestion

当前 `maybeApplyProgression()` 不应直接修改当前 task。可以改为写入 plan/task 或 adjustment batch：

```js
task.nextProgressionSuggestion = {
  createdAt: Date.now(),
  decision: 'volume-up' | 'progress' | 'deload' | 'hold',
  targetLevel: 2,
  suggestedSpec: {},
  reason: '连续 2 次太轻，建议进入下一阶动作',
  appliesTo: 'future-only'
};
```

更推荐统一写入 adjustment batch，由未来计划应用流程消费。

---

## 核心规则

### 任务保护规则

以下任务不能被自动覆盖：

- `status === 'done'`
- `userOverride === true`
- 用户编辑过的任务，例如 `policy.source === 'user-edit'`
- 用户确认高风险后锁定的任务
- 已经执行过训练器并产生 history 的任务

以下任务可以被低风险自动调整：

- 未完成
- 未锁定
- AI/系统生成
- 没有用户显式拒绝同类调整
- 不违反医嘱/安全策略

### 用户反馈优先级

优先级从高到低：

1. 用户明确决策：确认、拒绝、锁定、编辑、删除。
2. 用户训练反馈：RPE、疼痛、是否继续、不加量、下次保持、不适合。
3. 医嘱/安全策略：暂停、避免、谨慎、非医嘱新增。
4. 本地规则引擎：进阶、降载、负载预算、去重。
5. AI 建议。

AI 不能直接覆盖前四层，只能生成候选方案。

### 负载预算规则

硬上限：

- 每日主训练动作数量建议 3-6 个。
- 热身 1-2 个。
- 冷却 1-2 个。
- 同一动作重复项先合并。
- 同一部位重复过多时拆分或替换。

动态调整：

- RPE 1：低风险时可小幅加量或进阶。
- RPE 2-3：保持为主，连续稳定后再进阶。
- RPE 4：不自动加量，保持或轻微降载。
- RPE 5：降载、替换或拆到未来。
- 疼痛 >= 4：优先降载或阻止自动安排。
- 不想继续/不适合：停止自动进阶，要求用户确认。
- 不加量/下次保持：未来计划保持，不自动加组。

### 漏练补偿规则

康复/医嘱计划：

- 优先原样顺延。
- 如果今天同部位负载已高，则降载或拆到未来。
- 禁止把暂停/避免动作自动补回来。
- 非医嘱新增动作必须确认。

增肌/减脂/综合训练：

- 优先补偿相近训练刺激，而不是机械补同一动作。
- 可用同部位不同子部位、不同角度、不同收缩方式替代。
- 静态 + 动态组合优先于重复堆同一动作组数。
- 超出预算时进入预览，由用户决定。

### 重复与替换规则

1. 同一身份动作重复：自动合并。
2. 同一 progression group 重复：优先保留更合适等级，其他降载或拆到未来。
3. 同一部位重复但动作不同：检查子部位和收缩方式。
4. 如果刺激过窄：可建议同部位不同子部位动作。
5. 如果替换动作：必须预览确认。

---

## UI 方案

### 今日页轻提示

触发条件：

- 打开今日页。
- 昨天或最近 N 天存在未完成主训练任务。
- 这些任务不是已删除、已跳过、已锁定放弃。

示例文案：

```text
昨天有 3 个训练未完成
可补到今天，或按今日负载重新安排

[查看补练建议] [忽略]
```

点击“查看补练建议”进入 adjustment preview。

### AI 重排入口

点击 AI 重排时，`buildPlanAiContext()` 应加入漏练摘要：

- 漏练日期。
- 漏练计划类型。
- 漏练动作身份。
- 是否医嘱动作。
- 上次反馈。
- 近期同部位负载。
- 用户拒绝/偏好约束。

AI 输出仍然只是候选，保存前必须走本地 diff 和 validator。

### 变更预览

预览按 change 分组：

```text
计划调整预览

保留
- 基础臀桥：用户锁定，不自动覆盖

顺延
- 侧卧髋外展：昨天漏练，补到今天

合并
- 臀桥 2 组 + 臀桥 2 组 -> 臀桥 3 组
  原因：避免重复组数过多

替换
- 深蹲 -> 靠墙静蹲
  原因：同部位低冲击替代，减少膝关节压力
  [接受] [拒绝]

拆到未来
- 单腿平衡：移到明天
  原因：今天髋部负载已接近上限
```

每条变更都应支持：

- 接受。
- 拒绝。
- 查看原因。
- 编辑参数。
- 锁定相关任务。

底部按钮：

```text
[全部接受安全小改] [应用已选择] [取消]
```

### 调整历史

默认只在 toast 中突出最近一次：

```text
已根据反馈调整明天计划
[撤销]
```

在计划菜单或设置中可查看 adjustment history：

- 时间。
- 来源。
- 变更数量。
- 接受/拒绝数量。
- 是否已撤销。

---

## 分阶段实施

### Phase 1：冻结历史任务，进阶只生成未来建议

目标：

- `maybeApplyProgression()` 不再直接修改当前已完成 task。
- 保存反馈后生成下一次调整建议。
- 保持现有反馈 UI 不大改。

建议改动：

| 文件 | 改动 |
|---|---|
| `plan-store.js` | 将 `maybeApplyProgression()` 改为生成 suggestion，不直接改 task name/spec |
| `plan-feedback.js` | 保存反馈后调用新方法，例如 `createProgressionAdjustmentSuggestion()` |
| `plan-auto-adjust.js` | 读取 progression suggestion，应用到未来计划 |
| `test/plan-progression.test.mjs` | 保留纯规则测试 |
| `test/plan-store.test.mjs` 或新增测试 | 验证完成任务不会被改名/改参数 |

验收：

- 完成任务后，今日任务显示保持原动作和原参数。
- 下一次/明日计划可以体现进阶或降载。
- 用户锁定任务仍然 hold。

### Phase 2：Adjustment Batch 基础设施

目标：

- 引入统一 adjustment batch 数据结构。
- 自动调整、AI 保存、漏练补偿都能产出 changes。
- 保留最近一次撤销能力，并为历史记录留接口。

建议改动：

| 文件 | 改动 |
|---|---|
| `data-schema.js` | 初始化 `db.planAdjustments = []`, `db.planAdjustmentPrefs = {}` |
| `plan-auto-adjust.js` | `applyAutoAdjustedPlans()` 写 adjustment batch |
| `plan-store.js` | 新增 batch helper：create/apply/revert |
| `test/plan-auto-adjust.test.mjs` | 验证 batch before/after 和撤销 |

验收：

- 自动调整后 `db.planAdjustments` 有记录。
- 最近一次撤销仍可用。
- batch 中能区分 AI 和本地 fallback。

### Phase 3：漏练检测与补练建议

目标：

- 今日页检测昨天/最近未完成任务。
- 生成 carry-over change candidates。
- 低风险可自动合并，高风险进入预览。

建议改动：

| 文件 | 改动 |
|---|---|
| `plan-auto-adjust.js` 或新模块 `plan-missed.js` | 漏练检测、负载预算、carry-over 候选 |
| `plan-ui.js` | 今日页轻提示和入口 |
| `plan-weekly.js` | 复用 missed 统计，必要时显示补练入口 |
| `test/plan-auto-adjust.test.mjs` 或新增测试 | 验证漏练识别、康复顺延、普通训练等负载替代 |

是否新增文件：

- 如果逻辑较小，可先放 `plan-auto-adjust.js`。
- 如果超过约 200 行并形成独立领域，建议新增 `plan-missed.js`，并加入 `index.html` 加载顺序和 `sw.js` precache。

验收：

- 昨天未完成康复动作会生成顺延建议。
- 普通训练漏练会生成等负载替代或拆分建议。
- 用户锁定/编辑/已完成任务不被覆盖。

### Phase 4：变更预览 UI

目标：

- 所有大变化进入统一预览。
- 逐条接受/拒绝。
- 拒绝写入短期记忆。

建议改动：

| 文件 | 改动 |
|---|---|
| `plan-ui.js` | 新增 adjustment preview modal/sheet |
| `css-src/49-plan.css` 或 `css-src/49-plan-ai.css` | 预览样式 |
| `plan-auto-adjust.js` | 输出 changes 而不是直接只输出 plans |
| `test/plan-ui.test.mjs` | 验证预览渲染、安全小改/高风险变更区分 |

验收：

- 预览显示保留、顺延、合并、替换、降载、拆到未来。
- 每条变更能接受/拒绝。
- 应用后计划按选择落库。
- 拒绝后 7 天内不重复主动建议同一具体动作变更。

### Phase 5：AI 保存前硬校验

目标：

- AI 计划保存前验证是否违反用户反馈、锁定、进阶信号和 policy。
- prompt 不再是唯一约束。

建议改动：

| 文件 | 改动 |
|---|---|
| `plan-ai.js` | preview/confirm 前生成 diff，并调用 validator |
| `rehab-policy.js` | 暴露或新增 plan change validation helper |
| `plan-auto-adjust.js` | 复用 validator |
| `test/plan-ai.test.mjs` | 验证 hold 被改动时阻止或标红 |

验收：

- `hold` 动作被 AI 改名/加量时，预览标红或阻止。
- 疼痛 >= 4 的动作不能被 AI 自动进阶。
- 非医嘱新增动作必须确认。
- 用户锁定任务不会被覆盖。

### Phase 6：长期偏好升级

目标：

- 多次拒绝同类建议后升级长期偏好。
- 长期偏好进入 AI 上下文和本地规则。

建议改动：

| 文件 | 改动 |
|---|---|
| `data-schema.js` | 初始化和迁移偏好结构 |
| `plan-auto-adjust.js` | 读取 shortTermRejects/longTermPrefs |
| `plan-ai.js` | `buildPlanAiContext()` 注入偏好约束 |
| `plan-ui.js` | 在预览或设置中展示/清除偏好 |

验收：

- 拒绝一次后短期不重复建议。
- 多次拒绝后生成长期偏好。
- 长期偏好能被用户关闭。

---

## 测试计划

### 必测单元

- 完成任务后保存反馈，不改变当前任务名称和 spec。
- 进阶建议只应用到未来计划。
- 自动调整不会覆盖 `done/userOverride/user-edit` 任务。
- 漏练康复医嘱动作优先顺延。
- 漏练普通训练在预算内可等负载替代。
- 同身份重复动作自动合并。
- 合并后过量时拆到未来。
- 替换动作必须进入预览确认。
- 用户拒绝写入短期记忆。
- 多次拒绝升级长期偏好。
- AI 输出违反 hold/deload 时被 validator 捕获。

### 回归测试

运行：

```bash
npm run test
```

涉及 CSS 或新增 UI 样式时运行：

```bash
npm run build:css
npm run check:css
```

涉及 AI、数据持久化、计划、Service Worker 或加载顺序时最终运行：

```bash
npm run ci
```

---

## 文件级实施提示

### `plan-store.js`

当前重点：

- `maybeApplyProgression()` 应从“直接 apply”改为“生成 future-only suggestion/change”。
- `moveTask()` 已可用于手动移动任务，可作为 carry-over 的底层能力之一。
- 新增 batch helper 时要保持 facade 轻量，复杂纯逻辑可下沉到 pure module。

### `plan-auto-adjust.js`

当前重点：

- 已有 `cloneForTomorrow()` 和 fallback 明日计划逻辑。
- 可扩展为“根据 source plans + missed plans + feedback stats 生成 adjustment changes”。
- 不应只处理 completed plans，漏练处理要走独立入口，避免混淆“完成后调整”和“漏练补偿”。

### `plan-ai.js`

当前重点：

- `buildPlanAiContext()` 已包含当前目标计划、最近计划、反馈、医嘱等信息。
- 需要加入 missed/carry-over 摘要和 adjustment preference 约束。
- `confirmPlanAiPlans()` 保存前应走 diff + validator。

### `rehab-policy.js`

当前重点：

- 已有 `sanitizeGeneratedPlans()`、`itemsMatch()`、`actionMetaForName()`。
- 可复用动作身份判断和安全策略。
- 需要补“变更级”验证，而不仅是“计划项级”清洗。

### `plan-ui.js`

当前重点：

- 今日页和计划抽屉已有入口。
- 新增 preview UI 时注意不要把复杂业务规则塞进 UI。
- 所有用户输入和计划字段进入 HTML 前必须 `escapeHtml`。

### `plan-weekly.js`

当前重点：

- 已有 missed 统计和拖拽移动能力。
- 可以作为漏练可视化入口，但不要把核心漏练逻辑写在 weekly UI 里。

---

## 风险与取舍

### 风险：调整模型过大

缓解：

- 先做 Phase 1 和 Phase 2 的最小闭环。
- adjustment batch 可以先只支持最近一次撤销，历史 UI 后补。

### 风险：AI 与规则重复生成不同计划

缓解：

- AI 永远只生成候选。
- 本地 validator 和 diff 是保存前最后一道门。

### 风险：漏练补偿导致训练量过高

缓解：

- 先做动作数量硬上限。
- 再逐步加入部位/RPE/疼痛预算。
- 超出预算一律预览，不自动应用。

### 风险：用户拒绝偏好误泛化

缓解：

- 先短期记忆。
- 多次拒绝再升级长期偏好。
- 具体动作变更优先于泛化类型。

---

## 第一批最小闭环建议

建议新会话优先实现：

1. 修改 `maybeApplyProgression()`：完成任务不再直接改当前 task，只产出 future-only suggestion。
2. 增加最小 adjustment batch：记录 before/after、changes、source、最近一次撤销。
3. 增加漏练检测纯函数：输出 missed candidates，不先做完整 UI。
4. 给 AI/自动调整保存前增加最小 diff：保护 done/userOverride/user-edit。
5. 补对应测试，跑 `npm run test`。

这样能先把最危险的逻辑问题压住，再逐步扩展 UI 预览和偏好记忆。

---

## 给下一个会话的启动语

可以把下面这段直接发给新会话：

```text
请阅读 docs/tasks/training-plan-ai-adjustment-plan.md，并先实现 Phase 1：训练反馈后的进阶只影响下一次和以后的计划，不再修改已完成任务。遵守 AGENTS.md：静态 PWA，不引入后端或 bundler；涉及计划/AI/数据持久化改动后跑 npm run test，必要时跑 npm run ci。
```
