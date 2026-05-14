// @ts-nocheck
(function () {
    window.dataGoalPlan = {
        async requestWeightLossPlan() {
            const goalType = this.db.health.goalType || 'loss';
            const isGain = goalType === 'gain';
            const profile = this.db.health?.profile || {};
            const latest = this.sortedWeights().slice(-1)[0];
            const currentWeight = parseFloat(document.getElementById('planCurrentWeight')?.value) || latest?.weight;
            const targetWeight = parseFloat(document.getElementById('planTargetWeight')?.value);
            const height = parseFloat(document.getElementById('planHeight')?.value);
            const activityLevel = document.getElementById('planActivity')?.value || 'sedentary';
            const dailyTrainMin = parseInt(document.getElementById('planTrainMin')?.value) || 30;
            const weeklyFreq = parseInt(document.getElementById('planWeeklyFreq')?.value) || 3;
            const intensity = document.getElementById('planIntensity')?.value || 'moderate';
            const sportType = document.getElementById('planSportType')?.value || (isGain ? 'strength' : 'mixed');
            const experience = document.getElementById('planExperience')?.value || 'beginner';
            if (!currentWeight || currentWeight <= 0) return alert('请先填写当前体重');
            if (!targetWeight || targetWeight <= 0) return alert('请输入目标体重');
            if (!isGain && targetWeight >= currentWeight) return alert('减重目标体重需低于当前体重');
            if (isGain && targetWeight <= currentWeight) return alert('增肌目标体重需高于当前体重');
            const statusEl = document.getElementById('planStatus');
            if (statusEl) statusEl.textContent = 'AI 分析中...';
            try {
                const conditions = profile.conditions || [];
                const allergies = profile.allergies || [];
                const plan = await ai.bodyGoalPlan({ goalType, currentWeight, targetWeight, activityLevel, dailyTrainMin, height, weeklyFreq, intensity, sportType, experience, gender: profile.gender, age: profile.age, conditions, allergies });
                const normalized = this.normalizeBodyPlan(plan, { currentWeight, targetWeight }, goalType);
                this.db.health.bodyPlan = normalized;
                this.db.health.weightPlan = normalized;
                this.save();
                if (statusEl) statusEl.textContent = 'AI 方案已生成，请选择';
                this.renderHistory();
            } catch (e) {
                if (statusEl) statusEl.textContent = '生成失败: ' + (window.toast ? toast.sanitize(e) : e.message);
                alert('AI 方案生成失败: ' + (window.toast ? toast.sanitize(e) : e.message));
            }
        },

        normalizeBodyPlan(plan, meta, goalType) {
            const isGain = goalType === 'gain';
            const diff = isGain
                ? Math.max(0, (meta.targetWeight || 0) - (meta.currentWeight || 0))
                : Math.max(0, (meta.currentWeight || 0) - (meta.targetWeight || 0));
            const fixed = { ...plan, goalType, meta };
            const paceKeys = isGain ? ['conservative', 'moderate', 'aggressive'] : ['fast', 'moderate', 'slow'];
            paceKeys.forEach(key => {
                const p = fixed[key];
                if (!p) return;
                if (isGain) {
                    const weeklyChange = Math.max(0.1, Number(p.weeklyChange) || (key === 'aggressive' ? 0.5 : key === 'moderate' ? 0.3 : 0.15));
                    const weeks = diff > 0 ? diff / weeklyChange : 0;
                    const days = Math.max(7, Math.round(weeks * 7));
                    fixed[key] = {
                        ...p,
                        pace: key,
                        weeklyChange: Number(weeklyChange.toFixed(2)),
                        days,
                        dailyCal: Math.round(Number(p.dailyCal) || 0),
                        calorieDelta: Math.round(Number(p.calorieDelta) || 0),
                        proteinGoal: Math.round(Number(p.proteinGoal) || 0),
                        carbGoal: Math.round(Number(p.carbGoal) || 0),
                        fatGoal: Math.round(Number(p.fatGoal) || 0)
                    };
                } else {
                    const weeklyLoss = Math.max(0.1, Number(p.weeklyLoss) || (key === 'fast' ? 0.8 : key === 'moderate' ? 0.5 : 0.25));
                    const weeks = diff > 0 ? diff / weeklyLoss : 0;
                    const days = Math.max(7, Math.round(weeks * 7));
                    fixed[key] = {
                        ...p,
                        pace: key,
                        weeklyLoss: Number(weeklyLoss.toFixed(2)),
                        days,
                        dailyCal: Math.round(Number(p.dailyCal) || 0),
                        deficit: Math.round(Number(p.deficit) || 0),
                        proteinGoal: Math.round(Number(p.proteinGoal) || 0),
                        carbGoal: Math.round(Number(p.carbGoal) || 0),
                        fatGoal: Math.round(Number(p.fatGoal) || 0)
                    };
                }
            });
            return fixed;
        },

        applyWeightLossPlan(pace) {
            const goalType = this.db.health.goalType || 'loss';
            const plan = this.db.health.bodyPlan || this.db.health.weightPlan;
            if (!plan || !plan[pace]) return alert('请先生成 AI 方案');
            const p = plan[pace];
            const isGain = goalType === 'gain';
            this.db.health.dietGoal = {
                goalType,
                pace,
                dailyCal: p.dailyCal,
                calorieDelta: isGain ? p.calorieDelta : undefined,
                deficit: isGain ? undefined : p.deficit,
                weeklyChange: isGain ? p.weeklyChange : undefined,
                weeklyLoss: isGain ? undefined : p.weeklyLoss,
                days: p.days,
                proteinGoal: p.proteinGoal || (isGain ? Math.round(p.dailyCal * 0.3 / 4) : Math.round(p.dailyCal * 0.3 / 4)),
                carbGoal: p.carbGoal || (isGain ? Math.round(p.dailyCal * 0.45 / 4) : Math.round(p.dailyCal * 0.4 / 4)),
                fatGoal: p.fatGoal || (isGain ? Math.round(p.dailyCal * 0.25 / 9) : Math.round(p.dailyCal * 0.3 / 9)),
                appliedAt: new Date().toISOString()
            };
            this.saveAndBackup();
            const paceLabel = isGain
                ? (pace === 'conservative' ? '精益' : pace === 'moderate' ? '稳定' : '进取')
                : (pace === 'fast' ? '快速' : pace === 'moderate' ? '中等' : '慢速');
            alert(`已应用${paceLabel}${isGain ? '增肌' : '减重'}方案：每日 ${p.dailyCal} kcal`);
            this.renderHistory();
        },

        renderWeightLossPlanCard() {
            return this.renderWeightLossPanel();
        },

        renderWeightLossPanel() {
            const goalType = this.db.health.goalType || 'loss';
            const isGain = goalType === 'gain';
            const profile = this.db.health?.profile || {};
            const plan = this.db.health.bodyPlan || this.db.health.weightPlan;
            const goal = this.db.health.dietGoal;
            const latest = this.sortedWeights().slice(-1)[0];
            const currentWeight = latest?.weight || '';
            const diffText = plan?.meta ? (isGain
                ? `+${(plan.meta.targetWeight - plan.meta.currentWeight).toFixed(1)} kg`
                : `-${(plan.meta.currentWeight - plan.meta.targetWeight).toFixed(1)} kg`) : '';
            const paceLabel = goal ? (isGain
                ? (goal.pace === 'conservative' ? '精益' : goal.pace === 'moderate' ? '稳定' : '进取')
                : (goal.pace === 'fast' ? '快速' : goal.pace === 'moderate' ? '中等' : '慢速')) : '';
            const weeklyLabel = goal ? (isGain
                ? `${goal.weeklyChange || (plan?.[goal.pace]?.weeklyChange) || '--'} kg/周`
                : `${goal.weeklyLoss || (plan?.[goal.pace]?.weeklyLoss) || '--'} kg/周`) : '';
            return `<div class="md-card weightloss-card ${isGain ? 'goal-gain' : 'goal-loss'}">
            <div class="weightloss-head">
                <div>
                    <span class="cardio-kicker">${isGain ? 'AI 增肌指导' : 'AI 减重指导'}</span>
                    <h3>${isGain ? '制定增肌计划' : '制定减重计划'}</h3>
                    <small>${goal ? `当前方案：${paceLabel} · 每日 ${goal.dailyCal} kcal · 目标${diffText}` : '填写信息后 AI 帮你生成方案'}</small>
                </div>
                <span class="material-symbols-rounded weightloss-icon">${isGain ? 'fitness_center' : 'trending_down'}</span>
            </div>
            <div class="goal-mode-tabs">
                <button class="goal-mode-tab ${!isGain ? 'active' : ''}" onclick="data.setGoalType('loss')" type="button"><span class="material-symbols-rounded">trending_down</span>减重</button>
                <button class="goal-mode-tab ${isGain ? 'active' : ''}" onclick="data.setGoalType('gain')" type="button"><span class="material-symbols-rounded">fitness_center</span>增肌</button>
            </div>
            <div class="weightloss-form">
                <div class="md-grid weightloss-grid">
                    <div class="md-field"><input type="number" id="planCurrentWeight" step="0.1" value="${currentWeight || ''}" placeholder=" "><label>当前体重 kg</label></div>
                    <div class="md-field"><input type="number" id="planTargetWeight" step="0.1" placeholder=" "><label>目标体重 kg</label></div>
                    <div class="md-field"><input type="number" id="planHeight" step="1" value="${this.db.health?.height || ''}" placeholder=" "><label>身高 cm</label></div>
                    <div class="md-field"><select id="planActivity"><option value="sedentary">久坐</option><option value="light">轻度活动</option><option value="moderate">中等活动</option><option value="active">高强度活动</option></select><label>日常活动水平</label></div>
                    <div class="md-field"><input type="number" id="planTrainMin" value="30" step="5" placeholder=" "><label>每次运动分钟</label></div>
                    <div class="md-field"><input type="number" id="planWeeklyFreq" value="${isGain ? 4 : 3}" step="1" min="0" max="7" placeholder=" "><label>每周运动次数</label></div>
                    <div class="md-field"><select id="planIntensity"><option value="light">低强度</option><option value="moderate" ${!isGain ? 'selected' : ''}>中等强度</option><option value="vigorous" ${isGain ? 'selected' : ''}>高强度</option></select><label>运动强度</label></div>
                    <div class="md-field"><select id="planSportType"><option value="strength" ${isGain ? 'selected' : ''}>力量训练</option><option value="cardio">有氧运动</option><option value="mixed" ${!isGain ? 'selected' : ''}>力量+有氧混合</option><option value="flexibility">拉伸/瑜伽</option></select><label>主要运动项目</label></div>
                    ${isGain ? `<div class="md-field span-full"><select id="planExperience"><option value="beginner">新手</option><option value="intermediate">中级</option><option value="advanced">高级</option></select><label>训练经验</label></div>` : ''}
                </div>
                <div id="planProfileHint" class="food-ai-status">性别 / 年龄已从健康档案自动读取：${profile.gender === 'female' ? '女' : '男'} · ${profile.age || '未填写'} 岁${profile.age ? '' : '，建议先到「健康」页补充年龄以提升方案准确度'}</div>
                <button class="md-btn md-btn-filled" onclick="data.requestWeightLossPlan()"><span class="material-symbols-rounded">psychology</span> AI 生成${isGain ? '增肌' : '减重'}方案</button>
                <div id="planStatus" class="food-ai-status"></div>
            </div>
            <details class="goal-guide">
                <summary><span class="material-symbols-rounded">help</span> 如何选择活动水平、强度和经验</summary>
                <div class="goal-guide-content">
                    <div>
                        <b>日常活动水平</b>
                        <p>不包含专门训练，只看工作、通勤和日常走动。</p>
                        <ul>
                            <li><b>久坐</b> - 办公/学习为主，&lt;5000步/日</li>
                            <li><b>轻度</b> - 少量走动，5000-8000步/日</li>
                            <li><b>中等</b> - 经常走动或站立，8000-12000步/日</li>
                            <li><b>高强度</b> - 体力劳动或&gt;12000步/日</li>
                        </ul>
                    </div>
                    <div>
                        <b>训练强度</b>
                        <ul>
                            <li><b>低强度</b> - 轻松，可完整说话</li>
                            <li><b>中等强度</b> - 明显出汗，可短句交流</li>
                            <li><b>高强度</b> - 很喘，难以连续说话</li>
                        </ul>
                    </div>
                    <div>
                        <b>健康档案中的性别与年龄</b>
                        <p>目标指导会自动读取健康档案中的性别和年龄，用于估算基础代谢（BMR）和蛋白质需求；如果年龄缺失，每日热量可能偏差 100–200 kcal。</p>
                        <ul>
                            <li>同身高体重下，男性 BMR 通常比女性高 5–10%</li>
                            <li>每增长 10 岁 BMR 约下降 2–3%，建议在健康档案中如实填写</li>
                            <li>40 岁以上减重期建议提高蛋白质比例以保留肌肉</li>
                        </ul>
                    </div>
                    ${isGain ? `<div>
                        <b>训练经验</b>
                        <ul>
                            <li><b>新手</b> - 系统力量训练少于6个月</li>
                            <li><b>中级</b> - 规律训练6个月-2年</li>
                            <li><b>高级</b> - 规律训练超过2年，有周期化经验</li>
                        </ul>
                    </div>` : ''}
                </div>
            </details>
            ${plan ? `<div class="weightloss-options">
                ${isGain
                    ? ['conservative', 'moderate', 'aggressive'].map(pace => {
                        const p = plan[pace];
                        if (!p) return '';
                        const isActive = goal?.pace === pace;
                        const label = pace === 'conservative' ? '精益增肌' : pace === 'moderate' ? '稳定增肌' : '进取增肌';
                        return `<div class="weightloss-option ${isActive ? 'active' : ''}" onclick="data.applyWeightLossPlan('${pace}')">
                            <div class="weightloss-option-head">
                                <b>${label}</b>
                                ${isActive ? '<span class="item-chip">当前方案</span>' : ''}
                            </div>
                            <div class="weightloss-option-stats">
                                <span>+${p.weeklyChange || 0} kg/周</span>
                                <span>${p.days} 天</span>
                                <b>${p.dailyCal} kcal/日</b>
                            </div>
                            <small>${p.desc || ''}</small>
                        </div>`;
                    }).join('')
                    : ['fast', 'moderate', 'slow'].map(pace => {
                        const p = plan[pace];
                        if (!p) return '';
                        const isActive = goal?.pace === pace;
                        const label = pace === 'fast' ? '快速' : pace === 'moderate' ? '中等' : '慢速';
                        return `<div class="weightloss-option ${isActive ? 'active' : ''}" onclick="data.applyWeightLossPlan('${pace}')">
                            <div class="weightloss-option-head">
                                <b>${label}</b>
                                ${isActive ? '<span class="item-chip">当前方案</span>' : ''}
                            </div>
                            <div class="weightloss-option-stats">
                                <span>${p.weeklyLoss} kg/周</span>
                                <span>${p.days} 天</span>
                                <b>${p.dailyCal} kcal/日</b>
                            </div>
                            <small>${p.desc || ''}</small>
                        </div>`;
                    }).join('')}
                ${plan.tips ? `<div class="weightloss-tips">${plan.tips.map(t => `<span><span class="material-symbols-rounded">check_circle</span>${t}</span>`).join('')}</div>` : ''}
            </div>` : ''}
        </div>`;
        }
    };
})();
