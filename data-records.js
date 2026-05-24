// @ts-nocheck
(function () {
    window.dataRecords = {
        generateRecordId(prefix = 'rec') {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        },

        ensureRecordMeta(record, prefix = 'rec', fallbackTs = Date.now()) {
            if (!record || typeof record !== 'object') return record;
            if (!record.id) record.id = this.generateRecordId(prefix);
            const ts = Number(record.updatedAt || 0);
            record.updatedAt = Number.isFinite(ts) && ts > 0 ? ts : Number(fallbackTs || Date.now());
            record.deleted = !!record.deleted;
            return record;
        },

        touchRecord(record, changedFields = null) {
            if (!record || typeof record !== 'object') return;
            if (!record.id) record.id = this.generateRecordId('rec');
            const now = Date.now();
            record.updatedAt = now;
            if (typeof record.deleted !== 'boolean') record.deleted = false;
            if (Array.isArray(changedFields) && changedFields.length) {
                record.__fieldUpdatedAt = record.__fieldUpdatedAt || {};
                const iso = new Date(now).toISOString();
                changedFields.forEach(k => { record.__fieldUpdatedAt[k] = iso; });
            }
        },

        activeRecords(list) {
            return (list || []).filter(item => item && !item.deleted);
        },

        softDeleteById(list, id) {
            const record = (list || []).find(item => item && item.id === id);
            if (!record) return false;
            record.deleted = true;
            record.updatedAt = Date.now();
            return true;
        },

        restoreById(list, id) {
            const record = (list || []).find(item => item && item.id === id);
            if (!record) return false;
            record.deleted = false;
            record.updatedAt = Date.now();
            return true;
        },

        deleteWithUndo(list, id, options = {}) {
            const record = (list || []).find(item => item && item.id === id);
            if (!record || record.deleted) return false;
            this.softDeleteById(list, id);
            const save = typeof options.save === 'function'
                ? options.save
                : () => (this.saveAndBackup?.() || this.save?.());
            const render = typeof options.render === 'function'
                ? options.render
                : () => this.render?.();
            save.call(this);
            render.call(this);
            if (window.toast?.show) {
                toast.show(options.message || '已删除', 'info', {
                    action: options.actionLabel || '撤销',
                    timeout: Number(options.timeout || 5000),
                    onAction: () => {
                        if (!this.restoreById(list, id)) return;
                        save.call(this);
                        render.call(this);
                        window.haptics?.success?.();
                    }
                });
            }
            return true;
        }
    };
})();
