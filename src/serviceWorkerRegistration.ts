/**
 * Service Worker Registration and Cache Management for SplitSmart
 *
 * Provides lifecycle registration, cache management, and persistent storage
 * request helpers (especially important for storing AI/ML models).
 */

export interface StorageEstimateResult {
  quotaBytes?: number;
  usageBytes?: number;
  percentageUsed?: number;
  persistent?: boolean;
}

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

/**
 * Registers the SplitSmart Service Worker (/sw.js) in supporting browsers.
 */
export async function registerServiceWorker(
  config?: ServiceWorkerConfig
): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }

  // Allow registration in production or if explicitly enabled for testing
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content is available; please refresh.
            config?.onUpdate?.(registration);
          } else {
            // Content is cached for offline use.
            config?.onSuccess?.(registration);
          }
        }
      };
    };

    return registration;
  } catch (error) {
    console.error('[SplitSmart] Service worker registration failed:', error);
    config?.onError?.(error as Error);
    return undefined;
  }
}

/**
 * Unregisters the service worker if needed (e.g. for complete teardown or debug).
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return registration.unregister();
    }
  }
  return false;
}

/**
 * Requests persistent storage from the browser.
 * This prevents the browser from evicting large cached items (such as ONNX and Tesseract ML models)
 * when device storage is under pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch (e) {
      console.warn('[SplitSmart] Could not request persistent storage:', e);
      return false;
    }
  }
  return false;
}

/**
 * Returns the browser's current storage quota and usage estimates.
 */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const [estimate, persisted] = await Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
      ]);

      const quotaBytes = estimate.quota;
      const usageBytes = estimate.usage;
      const percentageUsed =
        quotaBytes && usageBytes ? Math.round((usageBytes / quotaBytes) * 1000) / 10 : undefined;

      return {
        quotaBytes,
        usageBytes,
        percentageUsed,
        persistent: persisted,
      };
    } catch (e) {
      console.warn('[SplitSmart] Failed to estimate storage:', e);
    }
  }

  return {};
}

/**
 * Clears all SplitSmart caches (static, dynamic, models) from CacheStorage.
 */
export async function clearAllSplitSmartCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith('splitsmart-'))
      .map((name) => window.caches.delete(name))
  );
}

/**
 * Helper to check current network connectivity status.
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}
