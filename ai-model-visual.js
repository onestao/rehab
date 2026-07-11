// @ts-nocheck
/* global module */
(function attachAiModelVisual(root) {
    'use strict';
    const CDN_BASE = 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/';
    const ICON_SLUGS = { openai:'openai',gemini:'gemini',grok:'grok',deepseek:'deepseek',claude:'claude',qwen:'qwen',doubao:'doubao',kimi:'kimi',minimax:'minimax',mimo:'xiaomimimo',glm:'zhipu',mistral:'mistral',meta:'meta',llama:'meta',ollama:'ollama',perplexity:'perplexity',cohere:'cohere',baichuan:'baichuan',yi:'zeroone',stepfun:'stepfun',siliconflow:'siliconcloud',openrouter:'openrouter',azure:'azure',huggingface:'huggingface' };
    const ICONS = Object.fromEntries(['openai','gemini','grok','deepseek','claude','qwen','doubao','kimi','minimax','mimo','glm','generic'].map(key => [key, `assets/model-icons/${key}.svg`]));
    const MARKS = { openai:'GPT',gemini:'Gem',grok:'G',deepseek:'DS',claude:'C',qwen:'Q',doubao:'豆',kimi:'K',minimax:'MM',mimo:'Mi',glm:'GLM' };
    function detect(value='') {
        const s=String(value||'').toLowerCase();
        const rules=[[/grok|x-ai|\bxai\b/,'grok','Grok','G'],[/gemini|google/,'gemini','Gemini','Gem'],[/deepseek/,'deepseek','DeepSeek','DS'],[/claude|anthropic/,'claude','Claude','C'],[/qwen|通义|tongyi/,'qwen','Qwen','Q'],[/doubao|豆包|volc|火山/,'doubao','豆包','豆'],[/kimi|moonshot|moon/,'kimi','Kimi','K'],[/minimax/,'minimax','MiniMax','MM'],[/mimo/,'mimo','Mimo','Mi'],[/glm|chatglm|zhipu|智谱/,'glm','GLM','GLM'],[/gpt|openai|chatgpt|\bo[134]\b|o1|o3|o4/,'openai','OpenAI','GPT']];
        const found=rules.find(([re])=>re.test(s)); return found ? {key:found[1],label:found[2],mark:found[3]} : {key:'generic',label:'AI 模型',mark:'AI'};
    }
    function normalizeKey(value=''){ return String(value||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,''); }
    function providerKey(provider=''){ const found=detect(provider); return found.key!=='generic' ? found.key : normalizeKey(String(provider||'').split(':')[0])||'generic'; }
    function iconFallbackSrcs(key='generic'){ const safe=normalizeKey(key)||'generic'; if(safe==='generic') return [ICONS.generic]; const slug=ICON_SLUGS[safe]||safe; const remote=safe==='kimi'?[`${CDN_BASE}${slug}.svg`]:[`${CDN_BASE}${slug}-color.svg`,`${CDN_BASE}${slug}.svg`]; return [...new Set([ICONS[safe],...remote,ICONS.generic].filter(Boolean))]; }
    function hashHue(key='generic'){ let h=0; for(const c of String(key||'generic')) h=((h<<5)-h+c.charCodeAt(0))|0; return Math.abs(h)%360; }
    function themeFor(key='generic',dark){ const h=hashHue(key); const d=dark==null?!!root.matchMedia?.('(prefers-color-scheme: dark)').matches:!!dark; return d?{bg:`linear-gradient(135deg, hsl(${h} 28% 22%), hsl(${(h+28)%360} 24% 16%))`,color:`hsl(${h} 62% 90%)`,markBg:`color-mix(in srgb, hsl(${h} 36% 36%) 58%, var(--md-sys-surface-container-highest))`}:{bg:`linear-gradient(135deg, hsl(${h} 64% 93%), hsl(${(h+28)%360} 60% 90%))`,color:`hsl(${h} 52% 22%)`,markBg:`color-mix(in srgb, hsl(${h} 72% 80%) 56%, white)`}; }
    function resolve({modelId='',provider='',iconKey='',dark}={}){ const found=detect(modelId); const candidate=normalizeKey(iconKey); const explicit=(ICONS[candidate]||ICON_SLUGS[candidate])?candidate:''; const key=explicit||(found.key!=='generic'?found.key:providerKey(provider))||'generic'; return {...found,key,mark:MARKS[key]||found.mark||'AI',iconSrcs:iconFallbackSrcs(key),theme:themeFor(key,dark)}; }
    root.aiModelVisual={resolve,detect,iconFallbackSrcs,providerKey,hashHue,themeFor,ICON_SLUGS,ICONS,CDN_BASE};
    if(typeof module!=='undefined'&&module.exports) module.exports=root.aiModelVisual;
})(typeof window!=='undefined'?window:globalThis);
