import type { Expense, Group, Member, RecordedSettlement } from '../../types/domain';
import { calculateGroupBalances } from './balances';

export type PersonalGroupSummary = {
  group: Group;
  members: Member[];
  expenseCount: number;
  myExpenseSharePaise: number;
  balancePaise: number;
};

export function summarizePersonalGroup(
  group: Group,
  members: Member[],
  expenses: Expense[],
  settlements: RecordedSettlement[]
): PersonalGroupSummary {
  const me = members.find((member) => member.isCurrentUser);
  const myExpenseSharePaise = me
    ? expenses.reduce(
        (total, expense) =>
          total +
          (expense.memberShares.find((share) => share.memberId === me.id)?.amountPaise ?? 0),
        0
      )
    : 0;
  const balancePaise = me
    ? (calculateGroupBalances(
        members.map((member) => member.id),
        expenses,
        settlements
      ).find((balance) => balance.memberId === me.id)?.balancePaise ?? 0)
    : 0;
  return { group, members, expenseCount: expenses.length, myExpenseSharePaise, balancePaise };
}

export function summarizePersonalTotals(summaries: PersonalGroupSummary[]) {
  return summaries.reduce(
    (totals, summary) => ({
      spentPaise: totals.spentPaise + summary.myExpenseSharePaise,
      owePaise: totals.owePaise + Math.max(0, -summary.balancePaise),
      owedPaise: totals.owedPaise + Math.max(0, summary.balancePaise),
    }),
    { spentPaise: 0, owePaise: 0, owedPaise: 0 }
  );
}
