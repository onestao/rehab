import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./plan-ai-pure.js', import.meta.url), 'utf8');
const sandbox = { window: {} };

vm.runInNewContext(source, sandbox);

const api = sandbox.window.planAiPure;

function toHostValue(value) {
    if (value == null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
}

export const VALID_MODES = [...api.VALID_MODES];
export const safeJsonParse = (...args) => toHostValue(api.safeJsonParse(...args));
export const readNumber = api.readNumber;
export const parseBoolean = api.parseBoolean;
export const inferSpecMode = api.inferSpecMode;
export const validateAiSpec = (...args) => toHostValue(api.validateAiSpec(...args));
export const isTimedAiAction = api.isTimedAiAction;
export const phaseIntensityCaps = (...args) => toHostValue(api.phaseIntensityCaps(...args));
export const coerceAiSpec = (...args) => toHostValue(api.coerceAiSpec(...args));
export const normalizeAiCategory = api.normalizeAiCategory;
export const parsePlanAiJson = (...args) => toHostValue(api.parsePlanAiJson(...args));
export const planAiPure = api;

export default api;
