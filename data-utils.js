// @ts-nocheck
(function () {
    window.dataUtils = {
        foodCalUnitFactor(unit) {
            return unit === 'kj' ? 4.184 : 1;
        },

        foodCalLabel(unit) {
            return unit === 'kj' ? '千焦 kJ/100g' : '千卡 kcal/100g';
        },

        parseFoodCaloriesToKcal(value, unit) {
            const raw = Number(value || 0);
            if (!raw || raw <= 0) return 0;
            return raw / this.foodCalUnitFactor(unit);
        },

        convertFoodCaloriesValue(value, fromUnit, toUnit) {
            const raw = Number(value || 0);
            if (!raw || raw <= 0 || fromUnit === toUnit) return raw ? Number(raw.toFixed(1)) : '';
            const kcal = this.parseFoodCaloriesToKcal(raw, fromUnit);
            const converted = kcal * this.foodCalUnitFactor(toUnit);
            return Number(converted.toFixed(1));
        },

        escapeHtml(value = '') {
            return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
        },

        dayCutoffHour: 4,

        dateFromKey(value) {
            const text = String(value || '');
            const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return this.parseHistoryDate(value);
        },

        logicalDateKey(date = new Date()) {
            const d = new Date(date);
            if (d.getHours() < this.dayCutoffHour) d.setDate(d.getDate() - 1);
            return this.dateKey(d);
        },

        logicalDayStart(date = new Date()) {
            const d = new Date(date);
            if (d.getHours() < this.dayCutoffHour) d.setDate(d.getDate() - 1);
            d.setHours(this.dayCutoffHour, 0, 0, 0);
            return d;
        },

        historyDayKey(entry) {
            if (entry?.dayKey) return entry.dayKey;
            return this.logicalDateKey(this.parseHistoryDate(entry?.date));
        },

        ratio(value, total) {
            if (!total || total <= 0) return 0;
            return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
        },

        parseHistoryDate(value) {
            const direct = new Date(value);
            if (!Number.isNaN(direct.getTime())) return direct;
            const match = String(value || '').match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
            if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return new Date();
        },

        dateKey(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },

        uniqueActionNames(entries) {
            const set = new Set();
            entries.forEach(h => this.historyNames(h).forEach(name => set.add(name)));
            return [...set];
        },

        historyNames(h) {
            if (h.type === 'cardio' && h.cardio) return [h.cardio.name || '有氧训练'];
            return (h.actions || []).map(a => a.name || '未命名');
        },

        historyIcon(h) {
            if (h.type === 'cardio' && h.cardio) return this.sportIcon(h.cardio.type || h.cardio.name);
            return this.sportIcon(this.historyNames(h)[0] || '');
        },

        sportIcon(name = '') {
            const text = String(name).toLowerCase();
            if (/walk|步行|快走/.test(text)) return 'directions_walk';
            if (/run|jog|跑|慢跑/.test(text)) return 'directions_run';
            if (/cycling|骑/.test(text)) return 'directions_bike';
            if (/战绳|battle/.test(text)) return 'waterfall_chart';
            if (/动感单车|spin/.test(text)) return 'pedal_bike';
            if (/swim|游泳/.test(text)) return 'pool';
            if (/row|划船/.test(text)) return 'rowing';
            if (/elliptical|椭圆/.test(text)) return 'exercise';
            if (/拉伸|伸展|stretch/.test(text)) return 'self_improvement';
            if (/深蹲|蹲|腿|臀|squat/.test(text)) return 'accessibility_new';
            if (/肩|臂|手|推|拉|胸|背/.test(text)) return 'fitness_center';
            if (/核心|腹|腰|平板|plank/.test(text)) return 'sports_gymnastics';
            return 'fitness_center';
        },

        exerciseLabel(type = '', entry = null) {
            if (type === 'custom') return entry?.customName || entry?.note || '自定义运动';
            const map = {
                walk: '步行',
                run: '跑步',
                cycling: '骑行',
                swim: '游泳',
                battle_rope: '战绳',
                spin_bike: '动感单车',
                strength: '力量训练',
                stretch: '拉伸/瑜伽'
            };
            return map[type] || type || '运动';
        },

        actionColor(name) {
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
            return this.historyColors[hash % this.historyColors.length];
        },

        shortName(name) {
            return name.length > 4 ? name.slice(0, 4) : name;
        },

        bmiCategory(bmi) {
            if (bmi < 18.5) return { label: '偏瘦', color: '#0891b2', range: '< 18.5' };
            if (bmi < 24) return { label: '正常', color: '#059669', range: '18.5 - 24' };
            if (bmi < 28) return { label: '偏胖', color: '#f59e0b', range: '24 - 28' };
            return { label: '肥胖', color: '#e11d48', range: '≥ 28' };
        }
    };
})();
