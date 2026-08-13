// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('settings subpages and nested managers participate in Android back navigation', () => {
    const uiState = read('data-ui-state.js');
    const providers = read('ai-provider-manager.js');
    const search = read('search-settings.js');
    const index = read('index.html');

    assert.match(uiState, /navStack\?\.open\?\.\(['"]subtab['"],\s*['"]routine['"]/);
    assert.match(providers, /navStack\?\.open\?\.\(['"]modal['"],\s*['"]aiProviderManager['"]/);
    assert.match(providers, /navStack\?\.open\?\.\(['"]panel['"],\s*['"]aiProviderManagerPanel['"]/);
    assert.match(providers, /back\(\)[\s\S]*this\.panel === ['"]list['"] \? this\.close\(\) : this\.showList\(\)/);
    assert.match(search, /navStack\?\.open\?\.\(['"]modal['"],\s*['"]searchProviderManager['"]/);
    assert.match(search, /navStack\?\.open\?\.\(['"]panel['"],\s*['"]searchProviderEditor['"]/);
    assert.match(index, /onclick="window\.aiProviderManager\?\.back\(\)"/);
    assert.match(index, /onclick="window\.searchSettings\?\.back\(\)"/);
    assert.doesNotMatch(index, /aiProviderManager\.panel='list'/);
});

test('new sheets use direct close callbacks so popstate does not recurse through history', () => {
    const contracts = [
        ['theme.js', 'themeSheet', 'closeSheetInternal'],
        ['workout-voice.js', 'voiceSettingsSheet', 'closeSettingsInternal'],
        ['workout-voice.js', 'voiceImportDialog', 'closeImportDialogInternal'],
        ['workout-voice.js', 'voiceEngineEditor', 'cancelEngineEditInternal'],
        ['advice-template-manager.js', 'aiTemplateManagerSheet', 'closeTemplateManager(true)'],
        ['advice-attachments.js', 'adviceAttachmentPreview', 'closeAdviceAttachmentPreview(true)'],
        ['advice-panel.js', 'aiModelPickerSheet', 'closeAdviceModelPicker(true)'],
        ['routine-library.js', 'workoutLibrarySheet', 'closeWorkoutLibraryInternal'],
        ['plan-equipment.js', 'planEquipmentSheet', 'closePlanEquipmentSheetInternal'],
        ['plan-ui.js', 'planTaskDrawer', 'closePlanTaskDrawerInternal'],
    ];
    for (const [file, id, directClose] of contracts) {
        const source = read(file);
        assert.ok(source.includes(id), `${file} missing ${id}`);
        assert.ok(source.includes('navStack?.open'), `${file} does not register ${id}`);
        assert.ok(source.includes(directClose), `${file} lacks direct close for ${id}`);
    }
});

test('navigation stack exposes keyed layers and targeted dismissal', () => {
    const source = read('nav-stack.js');
    assert.match(source, /open\(type, id, close\)/);
    assert.match(source, /find\(type, id = ['"]['"]\)/);
    assert.match(source, /close\(type, id, fn\)/);
    assert.match(source, /const count = this\.stack\.length - idx[\s\S]*this\.rewind\(count\)/);
});
