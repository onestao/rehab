/**
 * Ambient types for browser/unit test harness probes and loose fixtures.
 * Production facades live in ../globals.d.ts; keep test-only fields here.
 */
interface Window {
  // Deep-link / navigation probes
  __seenActivePages?: Array<string | null>;

  // Cancelled-navigation side-effect counters
  __sideFx?: {
    setMode?: any[];
    swipeInit?: number;
    workoutStateInit?: number;
    [key: string]: any;
  };
  __sideFxWatch?: ReturnType<typeof setInterval> | number | null;

  // Plan feature-gate concurrent open probes
  __planOpenErrors?: string[];
  __planOpenResults?: Promise<any> | any;

  // Route lifecycle leak instrumentation
  __rehabLifecycleProbe?: any;
  __rehabLifecycleProbeInstalled?: boolean;
  getEventListeners?: (target: EventTarget) => Record<string, Array<any>>;

  // AI picker readiness harness
  __rehabSeedAi?: () => Promise<void> | void;
  __profileActivated?: boolean;
  __pickerRuntimeCalls?: number;
}
