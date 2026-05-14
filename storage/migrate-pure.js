/**
 * @param {Record<string, unknown>} db
 * @param {number} [fallbackTs]
 */
export function migrateLegacyState(db, fallbackTs = Date.now()) {
    const next = JSON.parse(JSON.stringify(db || {}));
    next.actions = Array.isArray(next.actions) ? next.actions : [];
    next.routines = Array.isArray(next.routines) ? next.routines : [];
    next.history = Array.isArray(next.history) ? next.history : [];
    next.health = next.health && typeof next.health === 'object' ? next.health : {};
    next.health.weights = Array.isArray(next.health.weights) ? next.health.weights : [];
    next.health.foodLogs = Array.isArray(next.health.foodLogs) ? next.health.foodLogs : [];
    next.health.exerciseLogs = Array.isArray(next.health.exerciseLogs) ? next.health.exerciseLogs : [];
    next.health.aiAdviceChat = Array.isArray(next.health.aiAdviceChat) ? next.health.aiAdviceChat : [];
    next.health.profile = next.health.profile && typeof next.health.profile === 'object' ? next.health.profile : {};
    next.syncMeta = next.syncMeta && typeof next.syncMeta === 'object' ? next.syncMeta : {};
    const patch = (item, prefix) => ({
        id: item.id || `${prefix}-${fallbackTs}`,
        updatedAt: Number(item.updatedAt || fallbackTs),
        deleted: !!item.deleted,
        ...item
    });
    next.actions = next.actions.map(item => patch(item, 'action'));
    next.routines = next.routines.map(item => patch(item, 'routine'));
    next.history = next.history.map(item => patch(item, 'history'));
    next.health.weights = next.health.weights.map(item => patch(item, 'weight'));
    next.health.foodLogs = next.health.foodLogs.map(item => patch(item, 'food'));
    next.health.exerciseLogs = next.health.exerciseLogs.map(item => patch(item, 'exercise'));
    next.health.aiAdviceChat = next.health.aiAdviceChat.map(item => patch(item, 'advice'));
    next.health.profile = patch(next.health.profile, 'profile');
    return next;
}
