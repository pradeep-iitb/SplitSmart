import type { Expense, ID, ISODate } from '../../types/domain';
import { calculateExpenseShares } from './splitEngine';
import type { RecurringExpenseTemplate } from './types';

/**
 * Generates a deterministic occurrence ID for an instance of a recurring expense.
 * Guarantees idempotency across page reloads and multiple materialization checks.
 */
export function getDeterministicOccurrenceId(templateId: ID, occurrenceDate: ISODate): ID {
  return `rec-${templateId}-${occurrenceDate}`;
}

export function todayLocalISO(date = new Date()): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes all dates when an occurrence was due between the start/last-materialized date
 * and the target `asOfDate`.
 */
export function calculateDueOccurrenceDates(
  template: RecurringExpenseTemplate,
  asOfDate: ISODate,
  sinceDate?: ISODate
): ISODate[] {
  if (!template.active) return [];

  const dueDates: ISODate[] = [];
  const targetTime = new Date(`${asOfDate}T23:59:59Z`).getTime();

  // Determine starting point: day after sinceDate, or template.startDate
  const cursor = new Date(sinceDate ? `${sinceDate}T00:00:00Z` : `${template.startDate}T00:00:00Z`);

  // If sinceDate was provided, advance by 1 day to not re-generate the same date
  if (sinceDate) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const endTime = template.endDate
    ? Math.min(new Date(`${template.endDate}T23:59:59Z`).getTime(), targetTime)
    : targetTime;

  // Allow long offline gaps while keeping malformed dates from looping forever.
  let iterations = 0;
  const maxIterations = 36525;

  while (cursor.getTime() <= endTime && iterations < maxIterations) {
    iterations++;
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cursor.getUTCDate()).padStart(2, '0');
    const dateStr: ISODate = `${year}-${month}-${day}`;

    let isMatch = false;

    switch (template.frequency) {
      case 'daily':
        isMatch = true;
        break;

      case 'weekly': {
        const targetDay = template.dayOfWeek ?? 0;
        isMatch = cursor.getUTCDay() === targetDay;
        break;
      }

      case 'monthly': {
        const targetDayOfMonth =
          template.dayOfMonth ?? new Date(`${template.startDate}T00:00:00Z`).getUTCDate();

        // Handle end of month (e.g., target 31 in a 30-day month)
        const daysInCurrentMonth = new Date(
          Date.UTC(year, cursor.getUTCMonth() + 1, 0)
        ).getUTCDate();
        const adjustedTarget = Math.min(targetDayOfMonth, daysInCurrentMonth);
        isMatch = cursor.getUTCDate() === adjustedTarget;
        break;
      }

      case 'yearly': {
        const startD = new Date(`${template.startDate}T00:00:00Z`);
        isMatch =
          cursor.getUTCMonth() === startD.getUTCMonth() &&
          cursor.getUTCDate() === startD.getUTCDate();
        break;
      }
    }

    if (isMatch) {
      dueDates.push(dateStr);
    }

    // Advance cursor by 1 day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dueDates;
}

/**
 * Materializes all due occurrences of recurring expenses up to currentDate (PS Point 19).
 * Runs safely when the app opens or refreshes.
 *
 * Idempotency guarantee:
 * Generates deterministic occurrence IDs like `rec-${templateId}-${date}`.
 * If an expense with this ID already exists, it is skipped.
 */
export function materializeDueRecurringExpenses(
  templates: RecurringExpenseTemplate[],
  existingExpenses: Expense[],
  currentDate: ISODate
): {
  newExpenses: Expense[];
  updatedTemplates: RecurringExpenseTemplate[];
} {
  const existingIds = new Set(existingExpenses.map((e) => e.id));
  const newExpenses: Expense[] = [];
  const updatedTemplates: RecurringExpenseTemplate[] = [];

  for (const template of templates) {
    if (!template.active) {
      updatedTemplates.push(template);
      continue;
    }

    const dueDates = calculateDueOccurrenceDates(
      template,
      currentDate,
      template.lastMaterializedDate
    );

    let latestDate = template.lastMaterializedDate;

    for (const cycleDate of dueDates) {
      const occurrenceId = getDeterministicOccurrenceId(template.id, cycleDate);

      // Idempotency: skip if already materialized in existing expenses
      if (existingIds.has(occurrenceId)) {
        continue;
      }

      // Calculate shares for this occurrence
      const memberShares = calculateExpenseShares({
        totalPaise: template.amountPaise,
        splitMode: template.splitMode,
        participantIds: template.participantIds,
        exactAmounts: template.splitDetails?.exactAmounts,
        percentagesBasisPoints: template.splitDetails?.percentagesBasisPoints,
        sharesWeights: template.splitDetails?.sharesWeights,
      });

      const recurringExpense: Expense = {
        id: occurrenceId,
        groupId: template.groupId,
        description: `${template.description} (${cycleDate})`,
        date: cycleDate,
        payerId: template.payerId,
        amountPaise: template.amountPaise,
        splitMode: template.splitMode,
        memberShares,
        items: [],
        taxLines: [],
        serviceChargePaise: 0,
        discountPaise: 0,
        createdAt: new Date().toISOString(),
      };

      newExpenses.push(recurringExpense);
      existingIds.add(occurrenceId);
      latestDate = cycleDate;
    }

    updatedTemplates.push({
      ...template,
      lastMaterializedDate: latestDate,
    });
  }

  return {
    newExpenses,
    updatedTemplates,
  };
}

/**
 * Returns a human-friendly description of recurrence frequency.
 */
export function formatRecurrenceLabel(template: RecurringExpenseTemplate): string {
  switch (template.frequency) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = template.dayOfWeek !== undefined ? days[template.dayOfWeek] : 'Sunday';
      return `Weekly on ${day}`;
    }
    case 'monthly': {
      const day = template.dayOfMonth ?? 1;
      const suffix =
        day === 1 || day === 21 || day === 31
          ? 'st'
          : day === 2 || day === 22
            ? 'nd'
            : day === 3 || day === 23
              ? 'rd'
              : 'th';
      return `Monthly on the ${day}${suffix}`;
    }
    case 'yearly':
      return `Yearly on ${template.startDate.substring(5)}`;
    default:
      return template.frequency;
  }
}
