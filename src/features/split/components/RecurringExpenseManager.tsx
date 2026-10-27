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
  onExpensesMaterialized?: (newExpenses: Expense[]) => void;
}

export const RecurringExpenseManager: React.FC<RecurringExpenseManagerProps> = ({
  members,
  groupId,
  existingExpenses,
  onExpensesMaterialized,
}) => {
  // Preset default recurring templates
  const [templates, setTemplates] = useState<RecurringExpenseTemplate[]>([
    {
      id: 'tpl-wifi-fiber',
      groupId,
      description: 'High-speed Fiber Wi-Fi Recharge',
      category: 'Utilities',
      amountPaise: 80000, // ₹800.00
      payerId: members[0]?.id || '',
      splitMode: 'equal',
      participantIds: members.map((m) => m.id),
      frequency: 'monthly',
      startDate: '2026-09-01',
      dayOfMonth: 1,
      active: true,
      lastMaterializedDate: '2026-09-01',
      createdAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-apartment-maint',
      groupId,
      description: 'Society Maintenance & Water',
      category: 'Utilities',
      amountPaise: 240000, // ₹2,400.00
      payerId: members[1]?.id || members[0]?.id || '',
      splitMode: 'equal',
      participantIds: members.map((m) => m.id),
      frequency: 'monthly',
      startDate: '2026-10-01',
      dayOfMonth: 5,
      active: true,
      lastMaterializedDate: '2026-10-05',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ]);

  // Simulation date state (defaults to today or end of October)
  const [simulationDate, setSimulationDate] = useState('2026-11-05');
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

  const handleSimulateMaterialization = () => {
    const { newExpenses, updatedTemplates } = materializeDueRecurringExpenses(
      templates,
      existingExpenses,
      simulationDate
    );

    setTemplates(updatedTemplates);

    if (newExpenses.length > 0) {
      if (onExpensesMaterialized) {
        onExpensesMaterialized(newExpenses);
      }
      setMaterializationLog({
        count: newExpenses.length,
        message: `Successfully materialized ${newExpenses.length} recurring expense(s) up to ${simulationDate}`,
        items: newExpenses.map(
          (e) => `${e.description} • ${formatPaise(e.amountPaise)} on ${e.date}`
        ),
        timestamp: new Date().toLocaleTimeString(),
      });
    } else {
      setMaterializationLog({
        count: 0,
        message: `No new occurrences due up to ${simulationDate}. (Idempotency verified: zero duplicate expenses created)`,
        items: [],
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(newRupees);
    if (!newDesc || isNaN(rupees) || rupees <= 0) return;

    const newTpl: RecurringExpenseTemplate = {
      id: `tpl-${Date.now()}`,
      groupId,
      description: newDesc,
      category: 'Utilities',
      amountPaise: Math.round(rupees * 100),
      payerId: newPayerId,
      splitMode: 'equal',
      participantIds: members.map((m) => m.id),
      frequency: newFrequency,
      startDate: new Date().toISOString().substring(0, 10),
      dayOfMonth: newDayOfMonth,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setTemplates([...templates, newTpl]);
    setShowNewForm(false);
    setNewDesc('');
  };

  const toggleTemplateActive = (id: string) => {
    setTemplates(
      templates.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    );
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
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
                Recurring Expenses Engine
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Automated recurring schedules, deterministic occurrence materialization & guaranteed idempotency
            </p>
          </div>

          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30"
          >
            <Plus className="w-4 h-4" />
            Add Recurring Schedule
          </button>
        </div>

        {/* Simulator controls */}
        <div className="mt-5 pt-4 border-t border-slate-800 bg-slate-950/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Simulate Opening App On Date:
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
            className="px-4 py-2 rounded-xl bg-linear-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white text-xs font-bold flex items-center gap-2 shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Trigger Materialization Check
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
              <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 pl-2">
                {materializationLog.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* New Template Form */}
      {showNewForm && (
        <form
          onSubmit={handleAddTemplate}
          className="bg-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-lg space-y-4 text-xs animate-fade-in"
        >
          <h3 className="text-sm font-bold text-slate-100">Create New Recurring Schedule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Description</label>
              <input
                type="text"
                required
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Netflix 4K Plan"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newRupees}
                onChange={(e) => setNewRupees(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Payer</label>
              <select
                value={newPayerId}
                onChange={(e) => setNewPayerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Frequency</label>
              <select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value as RecurrenceFrequency)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            {newFrequency === 'monthly' && (
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Day of Month (1-31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={newDayOfMonth}
                  onChange={(e) => setNewDayOfMonth(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold"
            >
              Save Schedule
            </button>
          </div>
        </form>
      )}

      {/* Templates List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-slate-200">
          Configured Recurring Templates ({templates.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tpl) => {
            const payer = members.find((m) => m.id === tpl.payerId);
            return (
              <div
                key={tpl.id}
                className={`border rounded-xl p-4 space-y-3 transition-all ${
                  tpl.active
                    ? 'bg-slate-800/70 border-slate-700/80'
                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{tpl.description}</h4>
                    <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatRecurrenceLabel(tpl)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-400">
                      {formatPaise(tpl.amountPaise)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Payer: {payer?.name || tpl.payerId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTemplateActive(tpl.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        tpl.active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {tpl.active ? 'Active' : 'Paused'}
                    </button>
                    {tpl.lastMaterializedDate && (
                      <span className="text-[10px] text-slate-500">
                        Last created: {tpl.lastMaterializedDate}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
