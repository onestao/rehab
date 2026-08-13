import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('P0 accessibility structure keeps zoom, headings, and form labels available', () => {
    const html = read('index.html');

    assert.doesNotMatch(html, /user-scalable\s*=\s*no/i);
    for (const [pageId, titleId] of [
        ['workout', 'workoutPageTitle'],
        ['today', 'todayPageTitle'],
        ['records', 'recordsPageTitle'],
        ['ai-coach', 'aiCoachPageTitle'],
        ['profile', 'profilePageTitle'],
    ]) {
        assert.match(html, new RegExp(`<section id="${pageId}"[^>]*aria-labelledby="${titleId}"`));
        assert.match(html, new RegExp(`<h1 id="${titleId}" class="visually-hidden">`));
    }

    for (const id of [
        'name', 'actionPhase', 'sets', 'reps', 'work', 'repRest', 'actionRest', 'groupRest',
        'cardioType', 'cardioWeight', 'cardioTarget', 'slLibraryAction', 'slName',
        'slWeight', 'slSets', 'slReps', 'slMinutes', 'slNote', 'newRoutineName', 'routineTagsInput',
    ]) {
        assert.match(html, new RegExp(`<label for="${id}">`));
    }
    assert.match(html, /class="skip-btn"[^>]*type="button"[^>]*aria-label="跳过当前阶段"/);
    assert.match(html, /id="ttsRate"[^>]*aria-label="语速"/);
});

test('P0 manual theme mode resolves complete semantic colors in both directions', () => {
    const js = read('theme.js');
    const css = read('css-src/37-dark-mode.css');

    assert.match(js, /this\.cfg = \{ \.\.\.this\.cfg, mode: 'custom', seed \};/);
    assert.match(js, /this\.cfg = \{ \.\.\.this\.cfg, mode: 'monet', seed \};/);
    assert.match(css, /:root:not\(\[data-theme-mode="light"\]\)\s*\{[\s\S]*color-scheme:\s*dark;/);
    assert.match(css, /\[data-theme-mode="dark"\]\s*\{[\s\S]*--md-sys-on-surface:\s*#e3e2e6;/);
    assert.match(css, /\[data-theme-mode="dark"\]\s*\{[\s\S]*--md-sys-on-error-container:\s*#ffdad6;/);
    assert.match(css, /\[data-theme-mode="dark"\]\s+\.md-field input/);
    assert.match(css, /\[data-theme-mode="light"\]\s*\{\s*color-scheme:\s*light;\s*\}/);
});

test('P1 mobile controls and text inputs meet the selected sizing baseline', () => {
    const workout = read('css-src/52-v6-workout.css');
    const timer = read('css-src/09-workout-timer.css');
    const mode = read('css-src/22-workout-mode-tabs.css');
    const ui = read('css-src/50-v6-ui.css');
    const advice = read('css-src/46-advice-ai.css');
    const ai = read('css-src/54-v6-ai.css');

    assert.match(timer, /\.timer-tts-btn\s*\{[\s\S]*min-width:\s*42px;[\s\S]*height:\s*26px;/);
    assert.match(mode, /@media \(max-width: 480px\)[\s\S]*\.mode-tab\s*\{[^}]*height:\s*44px;/);
    assert.match(workout, /#workout \.md-chip\s*\{[^}]*min-height:\s*44px;/);
    assert.match(workout, /\.md-field textarea\s*\{[^}]*font-size:\s*16px;/);
    assert.match(ui, /\.md-icon-btn-bar\s*\{[^}]*width:\s*40px;\s*height:\s*40px;/);
    assert.match(ui, /\.sect-head \.a\s*\{[^}]*min-height:\s*44px;/);
    assert.match(advice, /\.advice-search-toggle\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    assert.match(advice, /\.advice-search-row input\s*\{[\s\S]*font-size:\s*16px;/);
    assert.match(advice, /\.advice-pill,[\s\S]*min-height:\s*44px;/);
    assert.match(ai, /\.ai-input\s*\{[^}]*min-height:\s*56px;/);
    assert.match(ai, /\.ai-input textarea\s*\{[^}]*font-size:\s*16px;/);
    assert.match(ai, /\.ai-input \.advice-model-picker\.advice-model-chip\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/);
    assert.match(ai, /\.ai-send\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/);
    assert.match(ai, /\.advice-attach-btn\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/);
    assert.match(ai, /\.advice-rail-btn\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    assert.doesNotMatch(ai, /\.advice-rail-btn\s*\{\s*width:\s*34px;\s*height:\s*34px;/);
});

test('P1 AI page reduces persistent density without removing capabilities', () => {
    const js = read('advice-panel.js');
    const css = read('css-src/54-v6-ai.css');

    assert.match(js, /<details class="glass-card advice-v6-suggestions-card"/);
    assert.match(js, /<summary>快速建议<\/summary>/);
    assert.match(js, /<nav class="advice-scroll-rail" aria-label="对话快速跳转">/);
    assert.match(js, /class="advice-rail-btn advice-rail-step"/);
    assert.match(js, /id="advicePrompt"[^>]*aria-label="向 AI 提问"/);
    assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.advice-rail-step\s*\{\s*display:\s*none;/);
});


test('dark theme is not overridden by unlayered critical shell colors', () => {
    const html = read('index.html');
    const base = read('css-src/02-base.css');
    const dark = read('css-src/37-dark-mode.css');
    const library = read('css-src/45-library-segment.css');

    assert.match(html, /html, body \{[^}]*background:\s*var\(--md-sys-surface,\s*#fff\);[^}]*color:\s*var\(--md-sys-on-surface,\s*#1a1a1a\);/);
    assert.doesNotMatch(html, /html, body \{[^}]*background:\s*#fff;[^}]*color:\s*#1a1a1a;/);
    assert.match(base, /button, input, select, textarea \{[^}]*font:\s*inherit;[^}]*color:\s*inherit;/);
    assert.match(dark, /\[data-theme-mode="dark"\] body \{[^}]*background:\s*var\(--md-sys-surface\);[^}]*color:\s*var\(--md-sys-on-surface\);/);
    assert.match(library, /\.prescription-action-main \{[^}]*color:\s*var\(--md-sys-on-surface\);[^}]*font:\s*inherit;/);
});

test('manual dark and manual light scope every dark-only compatibility rule', () => {
    const dark = read('css-src/37-dark-mode.css');
    const cards = read('css-src/08-components-cards.css');
    const calendar = read('css-src/16-history-hero-calendar.css');
    const profile = read('css-src/42-health-profile.css');

    assert.match(dark, /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-theme-mode="light"\]\) body/);
    assert.match(dark, /\[data-theme-mode="dark"\] \.workout-controls/);
    assert.match(dark, /\[data-theme-mode="dark"\] \.advice-model-openai/);
    for (const [source, selector] of [
        [cards, 'mark\\.ai-hit'],
        [calendar, '\\.calendar-event'],
        [profile, '\\.profile-condition-type\\.type-injury'],
    ]) {
        assert.match(source, new RegExp(`:root:not\\(\\[data-theme-mode="light"\\]\\) ${selector}`));
        assert.match(source, new RegExp(`\\[data-theme-mode="dark"\\] ${selector}`));
    }
});
