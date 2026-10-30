import React, { useState } from 'react';
import type {
  Expense,
  Group,
  Member,
  MemberBalance,
  RecordedSettlement,
  SuggestedPayment,
} from '../../../types/domain';
import {
  downloadBlob,
  exportExpensesToCsv,
  exportGroupSummaryText,
  exportSettlementsToCsv,
} from '../export';
import { Download, FileSpreadsheet, Share2, Check, Copy, Printer, Sparkles } from 'lucide-react';

interface ExportPanelProps {
  group: Group;
  members: Member[];
  expenses: Expense[];
  balances: MemberBalance[];
  suggestions: SuggestedPayment[];
  settlements: RecordedSettlement[];
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  group,
  members,
  expenses,
  balances,
  suggestions,
  settlements,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const summaryText = exportGroupSummaryText(group, members, expenses, balances, suggestions);

  const handleDownloadExpensesCsv = () => {
    const csv = exportExpensesToCsv(expenses, members);
    const filename = `${group.name.toLowerCase().replace(/\s+/g, '_')}_expenses.csv`;
    downloadBlob(csv, filename);
  };

  const handleDownloadSettlementsCsv = () => {
    const csv = exportSettlementsToCsv(balances, suggestions, settlements, members);
    const filename = `${group.name.toLowerCase().replace(/\s+/g, '_')}_settlement_report.csv`;
    downloadBlob(csv, filename);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-slate-100 text-lg">Export & Report Generator</h3>
        </div>
        <p className="text-xs text-slate-400">
          Export full group financial records as standard CSVs (Excel & Sheets compatible with UTF-8
          BOM) or copy formatted summaries for WhatsApp/email.
        </p>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <button
            type="button"
            onClick={handleDownloadExpensesCsv}
            disabled={expenses.length === 0}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Expenses CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSettlementsCsv}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Settlement CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Printable Summary</span>
          </button>
        </div>
      </div>

      {/* WhatsApp / Chat Summary Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="font-semibold text-slate-100 text-sm">Quick Chat / WhatsApp Summary</h4>
          </div>
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
          {summaryText}
        </div>
      </div>
    </div>
  );
};
