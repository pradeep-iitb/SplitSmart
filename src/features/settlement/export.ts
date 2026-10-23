import type {
  Expense,
  Group,
  Member,
  MemberBalance,
  RecordedSettlement,
  SuggestedPayment,
} from '../../types/domain';
import { formatPaise, paiseToRupees } from './balances';

/**
 * Escapes a CSV cell value according to RFC 4180.
 * Wraps values with quotes if they contain commas, newlines, or double quotes.
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * PS Point 20: Export to CSV
 * Exports all group expenses with detailed itemized and share breakdowns.
 */
export function exportExpensesToCsv(
  expenses: Expense[],
  members: Member[]
): string {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  const headers = [
    'Expense ID',
    'Date',
    'Description',
    'Paid By',
    'Total Amount (INR)',
    'Split Mode',
    'Member Shares (INR)',
    'Line Items Count',
  ];

  const rows = expenses.map((exp) => {
    const payerName = memberNameMap.get(exp.payerId) ?? exp.payerId;
    const amountInr = paiseToRupees(exp.amountPaise).toFixed(2);
    const sharesDetail = exp.memberShares
      .map((s) => {
        const name = memberNameMap.get(s.memberId) ?? s.memberId;
        const shareInr = paiseToRupees(s.amountPaise).toFixed(2);
        return `${name}: ${shareInr}`;
      })
      .join('; ');

    return [
      escapeCsvCell(exp.id),
      escapeCsvCell(exp.date),
      escapeCsvCell(exp.description),
      escapeCsvCell(payerName),
      escapeCsvCell(amountInr),
      escapeCsvCell(exp.splitMode),
      escapeCsvCell(sharesDetail),
      escapeCsvCell(exp.items?.length ?? 0),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Exports balances, simplified settlement recommendations, and recorded settlement history to CSV.
 */
export function exportSettlementsToCsv(
  balances: MemberBalance[],
  suggestions: SuggestedPayment[],
  recorded: RecordedSettlement[],
  members: Member[]
): string {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
  const memberUpiMap = new Map(members.map((m) => [m.id, m.upiId || '']));

  const lines: string[] = [];

  // Section 1: Balances
  lines.push('--- MEMBER NET BALANCES ---');
  lines.push(['Member', 'Net Balance (INR)', 'Status'].join(','));
  for (const b of balances) {
    const name = memberNameMap.get(b.memberId) ?? b.memberId;
    const amountInr = (b.balancePaise / 100).toFixed(2);
    const status =
      b.balancePaise > 0
        ? 'Gets back money'
        : b.balancePaise < 0
        ? 'Owes money'
        : 'Settled up';
    lines.push([escapeCsvCell(name), escapeCsvCell(amountInr), escapeCsvCell(status)].join(','));
  }

  lines.push('');

  // Section 2: Suggested Payments (Debt Simplification)
  lines.push('--- SIMPLIFIED SETTLEMENT INSTRUCTIONS ---');
  lines.push(['Payer (Debtor)', 'Payee (Creditor)', 'Amount (INR)', 'Payee UPI ID'].join(','));
  for (const s of suggestions) {
    const fromName = memberNameMap.get(s.fromMemberId) ?? s.fromMemberId;
    const toName = memberNameMap.get(s.toMemberId) ?? s.toMemberId;
    const amountInr = paiseToRupees(s.amountPaise).toFixed(2);
    const upi = memberUpiMap.get(s.toMemberId) ?? '';
    lines.push([
      escapeCsvCell(fromName),
      escapeCsvCell(toName),
      escapeCsvCell(amountInr),
      escapeCsvCell(upi),
    ].join(','));
  }

  lines.push('');

  // Section 3: Recorded Settlements History
  lines.push('--- COMPLETED SETTLEMENTS HISTORY ---');
  lines.push(['Date Settled', 'From', 'To', 'Amount (INR)', 'Note'].join(','));
  for (const r of recorded) {
    const fromName = memberNameMap.get(r.fromMemberId) ?? r.fromMemberId;
    const toName = memberNameMap.get(r.toMemberId) ?? r.toMemberId;
    const amountInr = paiseToRupees(r.amountPaise).toFixed(2);
    lines.push([
      escapeCsvCell(r.settledAt),
      escapeCsvCell(fromName),
      escapeCsvCell(toName),
      escapeCsvCell(amountInr),
      escapeCsvCell(r.note ?? ''),
    ].join(','));
  }

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates an easy-to-read text summary suitable for WhatsApp, email, or chat.
 */
export function exportGroupSummaryText(
  group: Group,
  members: Member[],
  expenses: Expense[],
  balances: MemberBalance[],
  suggestions: SuggestedPayment[]
): string {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
  const memberUpiMap = new Map(members.map((m) => [m.id, m.upiId || '']));

  const totalSpent = expenses.reduce((s, e) => s + e.amountPaise, 0);

  const lines: string[] = [];
  lines.push(`📊 *SplitSmart Settlement Summary: ${group.name}*`);
  lines.push(`Total Group Spend: ${formatPaise(totalSpent)} (${expenses.length} expenses)`);
  lines.push('');

  lines.push('*👤 Member Balances:*');
  for (const b of balances) {
    const name = memberNameMap.get(b.memberId) ?? b.memberId;
    if (b.balancePaise > 0) {
      lines.push(`• ${name}: gets back ${formatPaise(b.balancePaise)}`);
    } else if (b.balancePaise < 0) {
      lines.push(`• ${name}: owes ${formatPaise(-b.balancePaise)}`);
    } else {
      lines.push(`• ${name}: settled up (₹0.00)`);
    }
  }

  lines.push('');
  if (suggestions.length === 0) {
    lines.push('🎉 *All debts are settled! No payments needed.*');
  } else {
    lines.push(`*💸 Simplified Payments (${suggestions.length} transfers needed):*`);
    for (const [idx, s] of suggestions.entries()) {
      const from = memberNameMap.get(s.fromMemberId) ?? s.fromMemberId;
      const to = memberNameMap.get(s.toMemberId) ?? s.toMemberId;
      const upi = memberUpiMap.get(s.toMemberId);
      const upiText = upi ? ` (UPI: ${upi})` : '';
      lines.push(`${idx + 1}. ${from} ➡️ ${to}: ${formatPaise(s.amountPaise)}${upiText}`);
    }
  }

  lines.push('');
  lines.push('Generated with SplitSmart · Web Brawl 2026');

  return lines.join('\n');
}

/**
 * Triggers a browser download of a text/csv file.
 */
export function downloadBlob(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8;'
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
