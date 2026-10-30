/**
 * Persistent Crash and Diagnostic Logger for SplitSmart
 *
 * Catches unhandled errors, promise rejections, and mobile Out-Of-Memory (OOM)
 * crashes by recording breadcrumbs into localStorage. Survives page reloads.
 */

export interface Breadcrumb {
  timestamp: string;
  category: 'CAMERA' | 'OCR' | 'WORKER' | 'APP' | 'ERROR';
  message: string;
  data?: unknown;
}

export interface CrashReport {
  timestamp: string;
  type: 'JS_ERROR' | 'UNHANDLED_REJECTION' | 'ABRUPT_RELOAD_OOM';
  message: string;
  stack?: string;
  deviceInfo: {
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
  };
  lastActiveOperation?: {
    name: string;
    startedAt: string;
    metadata?: Record<string, unknown>;
  };
  breadcrumbs: Breadcrumb[];
}

const STORAGE_KEY_LAST_CRASH = 'splitsmart_last_crash_report';
const STORAGE_KEY_BREADCRUMBS = 'splitsmart_diagnostic_breadcrumbs';
const STORAGE_KEY_ACTIVE_OP = 'splitsmart_active_operation';
const MAX_BREADCRUMBS = 25;

let isInitialized = false;

function getDeviceInfo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfMemory = (performance as any)?.memory;
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    memory: perfMemory
      ? {
          jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
          totalJSHeapSize: perfMemory.totalJSHeapSize,
          usedJSHeapSize: perfMemory.usedJSHeapSize,
        }
      : undefined,
  };
}

/**
 * Appends a diagnostic breadcrumb to localStorage.
 */
export function recordBreadcrumb(
  category: Breadcrumb['category'],
  message: string,
  data?: unknown
): void {
  if (typeof window === 'undefined') return;

  const entry: Breadcrumb = {
    timestamp: new Date().toLocaleTimeString(),
    category,
    message,
    data: data ? JSON.parse(JSON.stringify(data)) : undefined,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_BREADCRUMBS);
    const crumbs: Breadcrumb[] = raw ? JSON.parse(raw) : [];
    crumbs.push(entry);
    if (crumbs.length > MAX_BREADCRUMBS) {
      crumbs.shift();
    }
    localStorage.setItem(STORAGE_KEY_BREADCRUMBS, JSON.stringify(crumbs));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Tracks an in-progress operation (e.g. camera capture, OCR processing).
 * If the page refreshes before finishOperation is called, this reveals an OOM crash.
 */
export function startOperation(name: string, metadata?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  recordBreadcrumb('APP', `Started: ${name}`, metadata);
  try {
    localStorage.setItem(
      STORAGE_KEY_ACTIVE_OP,
      JSON.stringify({
        name,
        startedAt: new Date().toISOString(),
        metadata,
      })
    );
  } catch {
    // Ignore
  }
}

/**
 * Clears an in-progress operation when it finishes cleanly.
 */
export function finishOperation(name: string): void {
  if (typeof window === 'undefined') return;
  recordBreadcrumb('APP', `Finished: ${name}`);
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_OP);
  } catch {
    // Ignore
  }
}

/**
 * Saves a crash report into localStorage.
 */
function saveCrashReport(type: CrashReport['type'], message: string, stack?: string): void {
  if (typeof window === 'undefined') return;

  let activeOp = undefined;
  try {
    const activeOpRaw = localStorage.getItem(STORAGE_KEY_ACTIVE_OP);
    if (activeOpRaw) activeOp = JSON.parse(activeOpRaw);
  } catch {
    // Ignore
  }

  let crumbs: Breadcrumb[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BREADCRUMBS);
    if (raw) crumbs = JSON.parse(raw);
  } catch {
    // Ignore
  }

  const report: CrashReport = {
    timestamp: new Date().toISOString(),
    type,
    message,
    stack,
    deviceInfo: getDeviceInfo(),
    lastActiveOperation: activeOp,
    breadcrumbs: crumbs,
  };

  try {
    localStorage.setItem(STORAGE_KEY_LAST_CRASH, JSON.stringify(report));
    localStorage.removeItem(STORAGE_KEY_ACTIVE_OP);
  } catch {
    // Ignore
  }
}

/**
 * Initializes global error listeners and checks for abnormal previous termination.
 */
export function initPersistentLogger(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // 1. Check if previous session was killed mid-operation (OOM / Camera Activity Kill)
  try {
    const pendingOpRaw = localStorage.getItem(STORAGE_KEY_ACTIVE_OP);
    if (pendingOpRaw) {
      const pendingOp = JSON.parse(pendingOpRaw);
      // The page was terminated while an intensive operation was active!
      saveCrashReport(
        'ABRUPT_RELOAD_OOM',
        `Browser screen refreshed abruptly during: "${pendingOp.name}". This usually happens when mobile RAM is exhausted (Out-Of-Memory) or the camera app forced the browser to restart.`
      );
      recordBreadcrumb('ERROR', `Detected previous abrupt crash during: ${pendingOp.name}`);
    }
  } catch {
    // Ignore
  }

  // 2. Global uncaught error listener
  window.addEventListener('error', (event) => {
    recordBreadcrumb('ERROR', `Uncaught Error: ${event.message}`);
    saveCrashReport(
      'JS_ERROR',
      event.message || 'Unknown window error',
      event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`
    );
  });

  // 3. Global unhandled promise rejection listener
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr =
      event.reason instanceof Error
        ? `${event.reason.message}\n${event.reason.stack}`
        : String(event.reason);
    recordBreadcrumb('ERROR', `Unhandled Rejection: ${reasonStr}`);
    saveCrashReport(
      'UNHANDLED_REJECTION',
      event.reason?.message || String(event.reason),
      event.reason?.stack
    );
  });

  // 4. Track normal page clean exit so we don't false-alarm on intentional navigation
  window.addEventListener('beforeunload', () => {
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_OP);
    } catch {
      // Ignore
    }
  });

  recordBreadcrumb('APP', 'SplitSmart initialized');
}

/**
 * Returns the last detected crash report, if any.
 */
export function getLastCrashReport(): CrashReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_CRASH);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the stored crash report.
 */
export function clearLastCrashReport(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_LAST_CRASH);
  } catch {
    // Ignore
  }
}

/**
 * Returns current breadcrumbs.
 */
export function getRecentBreadcrumbs(): Breadcrumb[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BREADCRUMBS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
