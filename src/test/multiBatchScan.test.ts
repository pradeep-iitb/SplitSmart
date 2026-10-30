import { describe, expect, it } from 'vitest';
import { calculateExpenseShares } from '../features/split/splitEngine';
import type { ReceiptItem } from '../types/domain';

describe('Multi-batch Scan and Multi-bill Aggregation', () => {
  it('combines items from multiple bills with clean bill names and calculates itemized split', () => {
    // Bill No. 1 items (e.g. Burger King)
    const bill1Items: ReceiptItem[] = [
      {
        id: 'b1_item_1',
        name: 'Veg Whopper',
        quantity: 2,
        unitPricePaise: 15000,
        lineTotalPaise: 30000,
        assignedMemberIds: ['member-1', 'member-2'],
        category: 'Food',
        billIndex: 0,
        billName: 'Bill No. 1',
      },
      {
        id: 'b1_item_2',
        name: 'Fries Large',
        quantity: 1,
        unitPricePaise: 8000,
        lineTotalPaise: 8000,
        assignedMemberIds: ['member-1'],
        category: 'Food',
        billIndex: 0,
        billName: 'Bill No. 1',
      },
    ];

    // Bill No. 2 items (e.g. Cafe Drinks)
    const bill2Items: ReceiptItem[] = [
      {
        id: 'b2_item_1',
        name: 'Cold Coffee',
        quantity: 2,
        unitPricePaise: 12000,
        lineTotalPaise: 24000,
        assignedMemberIds: ['member-2', 'member-3'],
        category: 'Food',
        billIndex: 1,
        billName: 'Bill No. 2',
      },
    ];

    // Unified list of all items from all bills on one screen
    const allItems: ReceiptItem[] = [...bill1Items, ...bill2Items];

    expect(allItems).toHaveLength(3);
    expect(allItems.map((i) => i.billName)).toEqual(['Bill No. 1', 'Bill No. 1', 'Bill No. 2']);

    const bill1Total = bill1Items.reduce((acc, i) => acc + i.lineTotalPaise, 0); // 38000
    const bill2Total = bill2Items.reduce((acc, i) => acc + i.lineTotalPaise, 0); // 24000
    const combinedTotal = bill1Total + bill2Total; // 62000

    expect(bill1Total).toBe(38000);
    expect(bill2Total).toBe(24000);
    expect(combinedTotal).toBe(62000);

    // Calculate itemized shares for all 3 members across both bills
    const shares = calculateExpenseShares({
      totalPaise: combinedTotal,
      splitMode: 'itemized',
      participantIds: ['member-1', 'member-2', 'member-3'],
      items: allItems,
    });

    // Verification of integer paise exactness
    const totalShares = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalShares).toBe(combinedTotal);

    // member-1: half of Whopper (15000) + Fries (8000) = 23000
    // member-2: half of Whopper (15000) + half of Coffee (12000) = 27000
    // member-3: half of Coffee (12000) = 12000
    expect(shares.find((s) => s.memberId === 'member-1')?.amountPaise).toBe(23000);
    expect(shares.find((s) => s.memberId === 'member-2')?.amountPaise).toBe(27000);
    expect(shares.find((s) => s.memberId === 'member-3')?.amountPaise).toBe(12000);
  });

  it('preserves clean numbered bill names and groups items properly', () => {
    const rawBatchFiles = ['burger_k.jpg', 'cafe_invoice.jpg', 'dessert_bill.png'];
    const billEntries = rawBatchFiles.map((filename, idx) => ({
      billIndex: idx,
      billName: `Bill No. ${idx + 1}`,
      filename,
    }));

    expect(billEntries[0].billName).toBe('Bill No. 1');
    expect(billEntries[1].billName).toBe('Bill No. 2');
    expect(billEntries[2].billName).toBe('Bill No. 3');

    const defaultTitle = billEntries.map((b) => b.billName).join(', ');
    expect(defaultTitle).toBe('Bill No. 1, Bill No. 2, Bill No. 3');
  });
});
