const theme = {
    KEY: 'rehab_pro_theme_cfg',
    presets: {
        blue: '#0061a4',
        purple: '#6750a4',
        green: '#1a5e1f',
        orange: '#9a4600',
        rose: '#ba005c'
    },
    cfg: { mode: 'blue', seed: '#0061a4' },

    init() {
        const saved = localStorage.getItem(this.KEY);
        if (saved) this.cfg = { ...this.cfg, ...JSON.parse(saved) };
        this.apply(this.cfg.seed);
        this.syncUI();
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.apply(this.cfg.seed));
        }
    },

    setPreset(name) {
        const seed = this.presets[name] || this.presets.blue;
        this.cfg = { mode: name, seed };
        this.persist();
        this.apply(seed);
        this.syncUI();
    },

    setCustom(seed) {
        this.cfg = { mode: 'custom', seed };
        this.persist();
        this.apply(seed);
        this.syncUI();
    },

    useMonet() {
        const seed = this.pickMonetSeed();
        this.cfg = { mode: 'monet', seed };
        this.persist();
        this.apply(seed);
        this.syncUI();
    },

    pickMonetSeed() {
        const hour = new Date().getHours();
        const hues = [207, 261, 145, 28, 330];
        const hue = hues[Math.floor(hour / 5) % hues.length];
        return this.hslToHex(hue, 0.58, 0.40);
    },

    apply(seed) {
        const rgb = this.hexToRgb(seed);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const primary = this.hslToHex(hsl.h, Math.max(0.48, hsl.s), 0.36);
        const primaryContainer = this.hslToHex(hsl.h, 0.84, 0.88);
        const darkPrimary = this.hslToHex(hsl.h, 0.74, 0.80);
        const darkPrimaryContainer = this.hslToHex(hsl.h, 0.62, 0.26);
        const secondary = this.hslToHex((hsl.h + 16) % 360, 0.24, 0.38);
        const secondaryContainer = this.hslToHex((hsl.h + 16) % 360, 0.42, 0.86);
        const darkSecondary = this.hslToHex((hsl.h + 16) % 360, 0.34, 0.78);
        const darkSecondaryContainer = this.hslToHex((hsl.h + 16) % 360, 0.30, 0.28);
        const tertiary = this.hslToHex((hsl.h + 60) % 360, 0.38, 0.40);
        const tertiaryContainer = this.hslToHex((hsl.h + 60) % 360, 0.76, 0.88);
        const darkTertiary = this.hslToHex((hsl.h + 60) % 360, 0.48, 0.78);
        const darkTertiaryContainer = this.hslToHex((hsl.h + 60) % 360, 0.38, 0.30);
        const surfaceHue = hsl.h;

        this.setVars({
            '--md-sys-primary': dark ? darkPrimary : primary,
            '--md-sys-on-primary': dark ? this.hslToHex(hsl.h, 0.78, 0.14) : '#ffffff',
            '--md-sys-primary-container': dark ? darkPrimaryContainer : primaryContainer,
            '--md-sys-on-primary-container': dark ? this.hslToHex(hsl.h, 0.82, 0.90) : this.hslToHex(hsl.h, 0.70, 0.12),
            '--md-sys-secondary': dark ? darkSecondary : secondary,
            '--md-sys-on-secondary': dark ? this.hslToHex((hsl.h + 16) % 360, 0.36, 0.14) : '#ffffff',
            '--md-sys-secondary-container': dark ? darkSecondaryContainer : secondaryContainer,
            '--md-sys-on-secondary-container': dark ? this.hslToHex((hsl.h + 16) % 360, 0.42, 0.88) : this.hslToHex((hsl.h + 16) % 360, 0.36, 0.14),
            '--md-sys-tertiary': dark ? darkTertiary : tertiary,
            '--md-sys-on-tertiary': dark ? this.hslToHex((hsl.h + 60) % 360, 0.48, 0.14) : '#ffffff',
            '--md-sys-tertiary-container': dark ? darkTertiaryContainer : tertiaryContainer,
            '--md-sys-on-tertiary-container': dark ? this.hslToHex((hsl.h + 60) % 360, 0.58, 0.88) : this.hslToHex((hsl.h + 60) % 360, 0.48, 0.14),
            '--md-sys-surface': dark ? this.hslToHex(surfaceHue, 0.18, 0.08) : this.hslToHex(surfaceHue, 0.38, 0.98),
            '--md-sys-surface-container-lowest': dark ? this.hslToHex(surfaceHue, 0.18, 0.05) : '#ffffff',
            '--md-sys-surface-container-low': dark ? this.hslToHex(surfaceHue, 0.16, 0.12) : this.hslToHex(surfaceHue, 0.30, 0.95),
            '--md-sys-surface-container': dark ? this.hslToHex(surfaceHue, 0.15, 0.14) : this.hslToHex(surfaceHue, 0.28, 0.92),
            '--md-sys-surface-container-high': dark ? this.hslToHex(surfaceHue, 0.14, 0.18) : this.hslToHex(surfaceHue, 0.24, 0.89),
            '--md-sys-surface-container-highest': dark ? this.hslToHex(surfaceHue, 0.13, 0.22) : this.hslToHex(surfaceHue, 0.22, 0.86),
            '--md-sys-outline-variant': dark ? this.hslToHex(surfaceHue, 0.12, 0.30) : this.hslToHex(surfaceHue, 0.16, 0.76),
            '--timer-gradient-start': this.hslToHex(hsl.h, 0.82, dark ? 0.10 : 0.16),
            '--timer-gradient-mid': dark ? darkPrimaryContainer : primary,
            '--timer-gradient-end': this.hslToHex(hsl.h, 0.58, dark ? 0.32 : 0.46),
            '--timer-time-color': this.hslToHex(hsl.h, 0.88, dark ? 0.84 : 0.84),
            '--timer-orb': this.hexToRgba(dark ? darkPrimary : primaryContainer, dark ? 0.10 : 0.15),
            '--theme-seed': seed
        });
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary);
    },

    setVars(vars) {
        Object.entries(vars).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    },

    syncUI() {
        const color = document.getElementById('themeColor');
        if (color) color.value = this.cfg.seed;
        document.querySelectorAll('.theme-swatch').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === this.cfg.mode));
    },

    persist() { localStorage.setItem(this.KEY, JSON.stringify(this.cfg)); },

    hexToRgb(hex) {
        const clean = hex.replace('#', '');
        const value = parseInt(clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean, 16);
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
    },

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                default: h = (r - g) / d + 4;
            }
            h *= 60;
        }
        return { h, s, l };
    },

    hslToHex(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    hexToRgba(hex, alpha) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
};
