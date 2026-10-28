import React, { useState } from 'react';
import type { Expense, Member } from '../../../types/domain';
import {
  formatRecurrenceLabel,
  materializeDueRecurringExpenses,
} from '../recurring';
import type { RecurringExpenseTemplate, RecurrenceFrequency } from '../types';
import { formatPaise } from '../../settlement/balances';
import {
  Repeat,
  Calendar,
  CheckCircle2,
  Plus,
  Play,
  Clock,
  Trash2,
} from 'lucide-react';

interface RecurringExpenseManagerProps {
  members: Member[];
  groupId: string;
  existingExpenses: Expense[];
  templates: RecurringExpenseTemplate[];
  onSaveTemplate: (template: RecurringExpenseTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onMaterializeExpenses: (newExpenses: Expense[], updatedTemplates: RecurringExpenseTemplate[]) => Promise<void>;
}

export const RecurringExpenseManager: React.FC<RecurringExpenseManagerProps> = ({
  members,
  groupId,
  existingExpenses,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onMaterializeExpenses,
}) => {
  // Simulation date state (defaults to today)
  const [simulationDate, setSimulationDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [materializationLog, setMaterializationLog] = useState<{
    count: number;
    message: string;
    items: string[];
    timestamp: string;
  } | null>(null);

  // New Template form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newRupees, setNewRupees] = useState('500');
  const [newPayerId, setNewPayerId] = useState(members[0]?.id || '');
  const [newFrequency, setNewFrequency] = useState<RecurrenceFrequency>('monthly');
  const [newDayOfMonth, setNewDayOfMonth] = useState<number>(1);

  const handleSimulateMaterialization = async () => {
    const { newExpenses, updatedTemplates } = materializeDueRecurringExpenses(
      templates,
      existingExpenses,
      simulationDate
    );

    await onMaterializeExpenses(newExpenses, updatedTemplates);

    if (newExpenses.length > 0) {
      setMaterializationLog({
        count: newExpenses.length,
        message: `Generated ${newExpenses.length} recurring expense(s) up to ${simulationDate}`,
        items: newExpenses.map(
          (e) => `${e.description} • ${formatPaise(e.amountPaise)} on ${e.date}`
        ),
        timestamp: new Date().toLocaleTimeString(),
      });
    } else {
      setMaterializationLog({
        count: 0,
        message: `All recurring expenses up to ${simulationDate} are already up to date.`,
        items: [],
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(newRupees);
    if (!newDesc || isNaN(rupees) || rupees <= 0) return;

    const newTpl: RecurringExpenseTemplate = {
      id: `tpl-${Date.now()}`,
      groupId,
      description: newDesc,
      category: 'Utilities',
      amountPaise: Math.round(rupees * 100),
      payerId: newPayerId || members[0]?.id || '',
      splitMode: 'equal',
      participantIds: members.map((m) => m.id),
      frequency: newFrequency,
      startDate: new Date().toISOString().substring(0, 10),
      dayOfMonth: newDayOfMonth,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await onSaveTemplate(newTpl);
    setShowNewForm(false);
    setNewDesc('');
  };

  const toggleTemplateActive = async (tpl: RecurringExpenseTemplate) => {
    await onSaveTemplate({
      ...tpl,
      active: !tpl.active,
    });
  };

  const deleteTemplate = async (id: string) => {
    await onDeleteTemplate(id);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Repeat className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                Recurring Expenses
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Automate repeating shared bills like Wi-Fi, rent, subscriptions, and utilities
            </p>
          </div>

          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Recurring Schedule
          </button>
        </div>

        {/* Check controls */}
        <div className="mt-5 pt-4 border-t border-slate-800 bg-slate-950/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Check Due Expenses Up To:
            </span>
            <input
              type="date"
              value={simulationDate}
              onChange={(e) => setSimulationDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-semibold focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleSimulateMaterialization}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Check & Add Due Bills
          </button>
        </div>

        {/* Materialization Log Banner */}
        {materializationLog && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs space-y-2 ${
              materializationLog.count > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {materializationLog.message}
              </span>
              <span className="text-[10px] opacity-75">{materializationLog.timestamp}</span>
            </div>
            {materializationLog.items.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 pl-1">
                {materializationLog.items.map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* New Schedule Modal / Inline Form */}
      {showNewForm && (
        <form
          onSubmit={handleAddTemplate}
          className="bg-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-sm text-purple-300 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Recurring Schedule
            </h3>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Description
              </label>
              <input
                type="text"
                placeholder="e.g. Netflix Subscription, Maid, Cook"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="649.00"
                value={newRupees}
                onChange={(e) => setNewRupees(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Payer
              </label>
              <select
                value={newPayerId}
                onChange={(e) => setNewPayerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Frequency
              </label>
              <select
                value={newFrequency}
                onChange={(e) =>
                  setNewFrequency(e.target.value as RecurrenceFrequency)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {newFrequency === 'monthly' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Day of Month (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={newDayOfMonth}
                  onChange={(e) => setNewDayOfMonth(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer"
            >
              Save Schedule
            </button>
          </div>
        </form>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => {
          const payer = members.find((m) => m.id === tpl.payerId);
          return (
            <div
              key={tpl.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 transition-all ${
                tpl.active
                  ? 'border-slate-800 hover:border-slate-700'
                  : 'border-slate-800/50 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      {formatRecurrenceLabel(tpl)}
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-2">
                      {tpl.description}
                    </h3>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-slate-100">
                      {formatPaise(tpl.amountPaise)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Paid by <span className="text-slate-200">{payer?.name || 'Someone'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Last recorded:{' '}
                    {tpl.lastMaterializedDate ? tpl.lastMaterializedDate : 'Never'}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleTemplateActive(tpl)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    tpl.active
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tpl.active ? 'Active' : 'Paused'}
                </button>

                <button
                  type="button"
                  onClick={() => deleteTemplate(tpl.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete schedule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
