// @ts-nocheck
(function () {
    const TOP_LEVEL = ['today', 'workout', 'records', 'ai-coach', 'profile'];
    const HEALTH_VIEWS = ['diet', 'weight', 'training', 'calendar'];
    const PROFILE_VIEWS = ['home', 'library', 'weightloss', 'ai', 'sync', 'experiments'];
    const ADVICE_RANGES = ['today', 'week', 'month', 'all'];

    function stripHash(hash) {
        return String(hash || '').replace(/^#/, '').replace(/^!/, '').replace(/^\/?/, '');
    }

    function decodePart(value) {
        try { return decodeURIComponent(String(value || '').trim()); }
        catch { return String(value || '').trim(); }
    }

    function normalizePage(value) {
        const page = String(value || '').trim();
        if (page === 'ai' || page === 'advice') return 'ai-coach';
        if (page === 'me') return 'profile';
        if (page === 'training') return 'workout';
        return TOP_LEVEL.includes(page) ? page : 'today';
    }

    function parseHash(hash) {
        const raw = stripHash(hash);
        const [pathPart, queryPart = ''] = raw.split('?');
        const parts = pathPart.split('/').map(decodePart).filter(Boolean);
        const first = parts[0] || 'today';
        const page = normalizePage(first);
        const query = new URLSearchParams(queryPart);
        const route = { page };

        if (page === 'ai-coach') {
            route.view = 'advice';
            const range = query.get('range') || parts[2] || '';
            if (ADVICE_RANGES.includes(range)) route.adviceRange = range;
            return route;
        }

        if (page === 'records') {
            const view = parts[1] || query.get('view') || '';
            if (HEALTH_VIEWS.includes(view)) route.healthView = view;
            return route;
        }

        if (page === 'profile') {
            const view = parts[1] || query.get('view') || '';
            if (PROFILE_VIEWS.includes(view)) route.routineView = view;
            return route;
        }

        return route;
    }

    function serializeRoute(route = {}) {
        const page = normalizePage(route.page);
        if (page === 'ai-coach') {
            const params = new URLSearchParams();
            if (ADVICE_RANGES.includes(route.adviceRange) && route.adviceRange !== 'today') params.set('range', route.adviceRange);
            const suffix = params.toString();
            return '/ai/advice' + (suffix ? '?' + suffix : '');
        }
        if (page === 'records') {
            const view = HEALTH_VIEWS.includes(route.healthView) && route.healthView !== 'diet' ? '/' + route.healthView : '';
            return '/records' + view;
        }
        if (page === 'profile') {
            const view = PROFILE_VIEWS.includes(route.routineView) && route.routineView !== 'home' ? '/' + route.routineView : '';
            return '/profile' + view;
        }
        return '/' + page;
    }

    function currentRouteFromState() {
        const data = window.data || {};
        const page = normalizePage(data._activePageId || document.querySelector('.page.active')?.id || 'today');
        return {
            page,
            healthView: data.healthView,
            routineView: data.routineView,
            adviceRange: data.adviceRange
        };
    }

    function replaceHash(path) {
        const next = '#' + path;
        if (window.location.hash === next) return;
        try { history.replaceState(history.state, '', next); }
        catch { window.location.hash = path; }
    }

    const appRoute = {
        _applying: false,
        _applyingToken: 0,
        _intentToken: 0,
        parseHash,
        serializeRoute,

        beginNavigation() {
            this._intentToken += 1;
            return this._intentToken;
        },

        isApplying() {
            return !!this._applying && this._applyingToken === this._intentToken;
        },

        syncFromState() {
            if (this.isApplying()) return;
            replaceHash(serializeRoute(currentRouteFromState()));
        },

        async apply(route, options = {}) {
            if (!window.ui || !window.data) return;
            const intentToken = options.intentToken ?? this.beginNavigation();
            const navigationToken = window.ui.beginNavigation?.();
            const next = route || parseHash(window.location.hash);
            const page = normalizePage(next.page);
            const navIndex = { today: 0, workout: 1, records: 2, 'ai-coach': 3, profile: 4 }[page] || 0;
            const nav = document.querySelectorAll('.nav-item')[navIndex];
            this._applying = true;
            this._applyingToken = intentToken;
            try {
                if (page === 'records') window.data.healthView = next.healthView || 'diet';
                if (page === 'profile') window.data.routineView = next.routineView || 'home';
                if (page === 'ai-coach') window.data.adviceRange = next.adviceRange || 'today';
                const activated = await window.ui._activateTab(page, nav, { preserveSubroute: true, navigationToken });
                if (intentToken !== this._intentToken || (navigationToken != null && !window.ui.isCurrentNavigation?.(navigationToken))) return false;
                if (activated === false) return false;
            } finally {
                if (this._applyingToken === intentToken) this._applying = false;
            }
            if (intentToken !== this._intentToken || (navigationToken != null && !window.ui.isCurrentNavigation?.(navigationToken))) return false;
            this.syncFromState();
            return true;
        },

        async applyCurrent() {
            await this.apply(parseHash(window.location.hash));
        },

        init() {
            if (!window.location.hash) replaceHash('/today');
            window.addEventListener('hashchange', () => this.applyCurrent());
        }
    };

    window.appRoute = appRoute;
})();
