// @ts-nocheck
(function attachHealthSummaryPure(root) {
    'use strict';

    function number(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function activeRecords(records) {
        return (Array.isArray(records) ? records : []).filter(record => record && !record.deleted);
    }

    function latestWeight(weights) {
        return activeRecords(weights)
            .slice()
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
            .slice(-1)[0] || null;
    }

    function dietGoals(health, weight) {
        const goal = health?.dietGoal || {};
        const cal = number(goal.dailyCal);
        const goalType = goal.goalType || health?.goalType || 'loss';
        if (goalType === 'gain' && cal) {
            const bodyWeight = number(weight?.weight) || 70;
            const pro = number(goal.proteinGoal) || Math.round(bodyWeight * 1.8);
            const fat = number(goal.fatGoal) || Math.round(cal * 0.25 / 9);
            const carb = number(goal.carbGoal) || Math.max(0, Math.round((cal - pro * 4 - fat * 9) / 4));
            return { cal, pro, carb, fat };
        }
        return {
            cal,
            pro: number(goal.proteinGoal) || (cal ? Math.round(cal * 0.3 / 4) : 90),
            carb: number(goal.carbGoal) || (cal ? Math.round(cal * 0.4 / 4) : 180),
            fat: number(goal.fatGoal) || (cal ? Math.round(cal * 0.3 / 9) : 55)
        };
    }

    function summarizeToday(db, today, options = {}) {
        const health = db?.health || {};
        const weights = activeRecords(health.weights);
        const weight = weights.find(record => record.date === today) || latestWeight(weights);
        const foods = activeRecords(health.foodLogs).filter(record => record.date === today);
        const exercises = activeRecords(health.exerciseLogs).filter(record => record.date === today);
        const historyDayKey = typeof options.historyDayKey === 'function'
            ? options.historyDayKey
            : record => record?.dayKey || record?.date || '';
        const histories = activeRecords(db?.history).filter(record => historyDayKey(record) === today);
        const macros = foods.reduce((total, record) => {
            total.pro += number(record.pro);
            total.carb += number(record.carb);
            total.fat += number(record.fat);
            return total;
        }, { pro: 0, carb: 0, fat: 0 });
        const intake = foods.reduce((total, record) => total + number(record.cal), 0);
        const exerciseCal = histories.reduce((total, record) => total + number(record.cardio?.calories), 0) +
            exercises.reduce((total, record) => total + number(record.calories), 0);
        return {
            weight,
            intake,
            exerciseCal,
            macros,
            goals: dietGoals(health, latestWeight(weights))
        };
    }

    root.healthSummaryPure = { activeRecords, latestWeight, dietGoals, summarizeToday };
})(typeof window !== 'undefined' ? window : globalThis);
