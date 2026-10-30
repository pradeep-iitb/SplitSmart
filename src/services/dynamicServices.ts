/**
 * Dynamic Services Client for SplitSmart
 *
 * Implements Network-First fetching for Balances, Settlements, and sync services,
 * with graceful offline fallback to local IndexedDB storage.
 */

import { db, SplitSmartDatabase } from '../db/database';
import { calculateGroupBalances } from '../features/settlement/balances';
import { suggestSettlements } from '../features/settlement/simplify';
import type { ID, MemberBalance, SuggestedPayment } from '../types/domain';

export type CachingStrategy = 'cache-first' | 'network-first' | 'network-only';

export interface DynamicServiceResponse<T> {
  data: T;
  source: 'network' | 'cache' | 'offline-local';
  timestamp: string;
}

/**
 * Checks whether a given URL corresponds to an AI/ML Model asset (Cache-First).
 */
export function isModelAssetUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr, 'https://splitsmart.local');
    const modelExtensions = /\.(wasm|onnx|bin|proto|traineddata)(\.gz)?($|\?)/i;
    const modelHosts = /(huggingface\.co|cdn-lfs\.huggingface\.co|tessdata|tesseract\.js-core)/i;
    const modelPaths = /(\/models\/|Xenova\/|ort-wasm)/i;

    return (
      modelExtensions.test(url.pathname) ||
      modelExtensions.test(url.href) ||
      modelHosts.test(url.hostname) ||
      modelPaths.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether a given URL corresponds to a dynamic service (Network-First).
 */
export function isDynamicServiceUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr, 'https://splitsmart.local');
    const dynamicPaths = /(\/api\/|\/balances|\/settlements|\/sync|\/export)/i;
    return dynamicPaths.test(url.pathname) || dynamicPaths.test(url.href);
  } catch {
    return false;
  }
}

/**
 * Checks whether a given URL corresponds to a static asset (Cache-First).
 */
export function isStaticAssetUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr, 'https://splitsmart.local');
    const staticExtensions =
      /\.(js|css|svg|png|jpg|jpeg|webp|ico|json|woff|woff2|ttf|eot|html)($|\?)/i;
    const staticHosts = /(fonts\.googleapis\.com|fonts\.gstatic\.com)/i;

    return (
      url.pathname === '/' ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/Fonts/') ||
      url.pathname.startsWith('/Images/') ||
      staticExtensions.test(url.pathname) ||
      staticHosts.test(url.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Identifies the recommended caching strategy for any URL.
 */
export function getCachingStrategyForUrl(urlStr: string): CachingStrategy {
  if (isModelAssetUrl(urlStr)) return 'cache-first';
  if (isDynamicServiceUrl(urlStr)) return 'network-first';
  if (isStaticAssetUrl(urlStr)) return 'cache-first';
  return 'network-first';
}

/**
 * Fetches dynamic group balances using a Network-First strategy.
 * If network is unreachable or fails, falls back to computing fresh balances
 * from local IndexedDB data.
 */
export async function fetchDynamicGroupBalances(
  groupId: ID,
  customDb: SplitSmartDatabase = db,
  endpointUrl?: string
): Promise<DynamicServiceResponse<MemberBalance[]>> {
  const url = endpointUrl ?? `/api/groups/${groupId}/balances`;

  // 1. Try Network-First if fetch is available in environment
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        const isOfflineCache = response.headers.get('X-SplitSmart-Cache') === 'HIT-OFFLINE';
        return {
          data: json.balances ?? json,
          source: isOfflineCache ? 'cache' : 'network',
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // Network failed or offline - fall through to offline local IndexedDB
    }
  }

  // 2. Offline Fallback: compute directly from local IndexedDB
  const [members, expenses, settlements] = await Promise.all([
    customDb.members.where('groupId').equals(groupId).toArray(),
    customDb.expenses.where('groupId').equals(groupId).toArray(),
    customDb.settlements.where('groupId').equals(groupId).toArray(),
  ]);

  const memberIds = members.map((m) => m.id);
  const localBalances = calculateGroupBalances(memberIds, expenses, settlements);

  return {
    data: localBalances,
    source: 'offline-local',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fetches dynamic suggested settlements using a Network-First strategy.
 * Falls back to computing settlements from local IndexedDB data if offline.
 */
export async function fetchDynamicGroupSettlements(
  groupId: ID,
  customDb: SplitSmartDatabase = db,
  endpointUrl?: string
): Promise<DynamicServiceResponse<SuggestedPayment[]>> {
  const url = endpointUrl ?? `/api/groups/${groupId}/settlements`;

  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const json = await response.json();
        const isOfflineCache = response.headers.get('X-SplitSmart-Cache') === 'HIT-OFFLINE';
        return {
          data: json.settlements ?? json,
          source: isOfflineCache ? 'cache' : 'network',
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to local fallback
    }
  }

  const [members, expenses, settlements] = await Promise.all([
    customDb.members.where('groupId').equals(groupId).toArray(),
    customDb.expenses.where('groupId').equals(groupId).toArray(),
    customDb.settlements.where('groupId').equals(groupId).toArray(),
  ]);

  const memberIds = members.map((m) => m.id);
  const localBalances = calculateGroupBalances(memberIds, expenses, settlements);
  const localTransfers = suggestSettlements(localBalances);

  return {
    data: localTransfers,
    source: 'offline-local',
    timestamp: new Date().toISOString(),
  };
}
