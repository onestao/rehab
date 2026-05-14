// @ts-nocheck
window.onboarding = {
    pages: [
        { icon: 'fitness_center', title: '智能训练计时', desc: '语音播报 + 双侧交替 + 画中画' },
        { icon: 'restaurant', title: '饮食 AI 识别', desc: '一句话描述，自动算出热量与营养' },
        { icon: 'psychology', title: 'AI 教练', desc: '结合你的记录给出建议' },
        { icon: 'cloud_sync', title: '云端备份', desc: 'S3 / WebDAV 自动同步，多端不丢失' }
    ],
    show() {
        if (!window.data || !data.db) return;
        if (data.db.onboarded) return;
        const root = document.createElement('div');
        root.id = 'onboardingRoot';
        root.className = 'onboarding-root';
        root.innerHTML = this.pages.map((p, i) => `
            <div class="onboarding-page" data-i="${i}">
                <span class="material-symbols-rounded onboarding-icon">${p.icon}</span>
                <h2>${p.title}</h2>
                <p>${p.desc}</p>
            </div>`).join('') + `
            <div class="onboarding-controls">
                <div class="onboarding-dots">${this.pages.map((_, i) => `<span data-i="${i}"></span>`).join('')}</div>
                <button class="md-btn md-btn-filled" onclick="onboarding.next()">下一步</button>
            </div>`;
        document.body.appendChild(root);
        this.idx = 0; this.update();
    },
    next() {
        this.idx++;
        if (this.idx >= this.pages.length) return this.finish();
        this.update();
    },
    update() {
        const root = document.getElementById('onboardingRoot');
        if (!root) return;
        root.querySelectorAll('.onboarding-page').forEach(el => el.classList.toggle('active', +el.dataset.i === this.idx));
        root.querySelectorAll('.onboarding-dots span').forEach(el => el.classList.toggle('active', +el.dataset.i === this.idx));
        const btn = root.querySelector('.md-btn');
        if (btn) btn.textContent = this.idx === this.pages.length - 1 ? '开始使用' : '下一步';
    },
    finish() {
        data.db.onboarded = true;
        data.save({ render: false });
        data.flushSync?.();
        const root = document.getElementById('onboardingRoot');
        if (root) { root.classList.add('fade-out'); setTimeout(() => root.remove(), 300); }
    }
};
