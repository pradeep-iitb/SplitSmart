import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isModelAssetUrl,
  isDynamicServiceUrl,
  isStaticAssetUrl,
  getCachingStrategyForUrl,
  fetchDynamicGroupBalances,
  fetchDynamicGroupSettlements,
} from '../services/dynamicServices';
import { isOnline, getStorageEstimate } from '../serviceWorkerRegistration';
import { SplitSmartDatabase } from '../db/database';

describe('SplitSmart Caching Layer', () => {
  describe('URL Resource Classification & Strategies', () => {
    it('classifies AI/ML model assets as cache-first', () => {
      const modelUrls = [
        'https://splitsmart.local/assets/ort-wasm-simd-threaded.asyncify.wasm',
        'https://huggingface.co/Xenova/mobilebert-uncased-mnli/resolve/main/onnx/model_quantized.onnx',
        'https://cdn-lfs.huggingface.co/repos/123/weights.bin',
        'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
        '/models/receipt-classifier.onnx',
      ];

      for (const url of modelUrls) {
        expect(isModelAssetUrl(url)).toBe(true);
        expect(getCachingStrategyForUrl(url)).toBe('cache-first');
      }
    });

    it('classifies dynamic services (balances, settlements, APIs) as network-first', () => {
      const dynamicUrls = [
        '/api/groups/g-123/balances',
        '/api/groups/g-123/settlements',
        '/api/sync',
        '/balances/summary',
        '/settlements/history',
        'https://splitsmart.local/api/export',
      ];

      for (const url of dynamicUrls) {
        expect(isDynamicServiceUrl(url)).toBe(true);
        expect(getCachingStrategyForUrl(url)).toBe('network-first');
      }
    });

    it('classifies static assets (app shell, bundles, fonts, images) as cache-first', () => {
      const staticUrls = [
        '/',
        '/index.html',
        '/assets/index-DLTx_Eg1.js',
        '/assets/index-CBNL6b71.css',
        '/Images/SplitSmart Neon Receipt Logo.png',
        '/Fonts/Google_Sans/GoogleSans-Regular.ttf',
        '/favicon.svg',
        '/manifest.json',
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans',
        'https://fonts.gstatic.com/s/plusjakartasans/v8/font.woff2',
      ];

      for (const url of staticUrls) {
        expect(isStaticAssetUrl(url)).toBe(true);
        expect(getCachingStrategyForUrl(url)).toBe('cache-first');
      }
    });
  });

  describe('Dynamic Services Network-First Strategy with Local Fallback', () => {
    let testDb: SplitSmartDatabase;

    beforeEach(async () => {
      testDb = new SplitSmartDatabase(`test-caching-${Date.now()}-${Math.random()}`);
      await testDb.open();

      await testDb.groups.add({
        id: 'g-trip',
        name: 'Goa Trip',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      });

      await testDb.members.bulkAdd([
        { id: 'm-me', groupId: 'g-trip', name: 'Me', active: true, isCurrentUser: true },
        { id: 'm-riya', groupId: 'g-trip', name: 'Riya', active: true },
      ]);

      await testDb.expenses.add({
        id: 'exp-1',
        groupId: 'g-trip',
        description: 'Dinner',
        date: '2026-10-01T12:00:00Z',
        payerId: 'm-me',
        amountPaise: 10000, // ₹100.00
        splitMode: 'equal',
        memberShares: [
          { memberId: 'm-me', amountPaise: 5000 },
          { memberId: 'm-riya', amountPaise: 5000 },
        ],
        items: [],
        taxLines: [],
        serviceChargePaise: 0,
        discountPaise: 0,
        createdAt: '2026-10-01T12:00:00Z',
      });
    });

    it('falls back to local IndexedDB calculation when network is offline for balances', async () => {
      // Mock global fetch failure (simulating offline mode)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await fetchDynamicGroupBalances('g-trip', testDb);

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.source).toBe('offline-local');
      expect(result.data.length).toBe(2);

      const meBalance = result.data.find((b) => b.memberId === 'm-me');
      expect(meBalance?.balancePaise).toBe(5000); // Riya owes Me ₹50

      fetchSpy.mockRestore();
    });

    it('returns network data when network-first fetch succeeds', async () => {
      const mockNetworkBalances = [
        { memberId: 'm-me', balancePaise: 7000 },
        { memberId: 'm-riya', balancePaise: -7000 },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ balances: mockNetworkBalances }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchDynamicGroupBalances('g-trip', testDb);

      expect(result.source).toBe('network');
      expect(result.data).toEqual(mockNetworkBalances);

      fetchSpy.mockRestore();
    });

    it('indicates cached source when response contains offline cache header', async () => {
      const mockCachedBalances = [{ memberId: 'm-me', balancePaise: 5000 }];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ balances: mockCachedBalances }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-SplitSmart-Cache': 'HIT-OFFLINE',
          },
        })
      );

      const result = await fetchDynamicGroupBalances('g-trip', testDb);

      expect(result.source).toBe('cache');
      expect(result.data).toEqual(mockCachedBalances);

      fetchSpy.mockRestore();
    });

    it('falls back to local calculation for settlements when offline', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));

      const result = await fetchDynamicGroupSettlements('g-trip', testDb);

      expect(result.source).toBe('offline-local');
      expect(result.data.length).toBe(1);
      expect(result.data[0]).toEqual({
        fromMemberId: 'm-riya',
        toMemberId: 'm-me',
        amountPaise: 5000,
      });

      fetchSpy.mockRestore();
    });
  });

  describe('Service Worker & Storage Helpers', () => {
    it('provides online status helper', () => {
      expect(typeof isOnline()).toBe('boolean');
    });

    it('returns empty estimate gracefully when navigator storage is unavailable', async () => {
      const estimate = await getStorageEstimate();
      expect(estimate).toBeDefined();
    });
  });
});
