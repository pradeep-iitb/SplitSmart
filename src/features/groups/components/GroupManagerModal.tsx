import React, { useState } from 'react';
import type { Group } from '../../../types/domain';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  FolderOpen,
} from 'lucide-react';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => Promise<Group>;
  onRenameGroup: (groupId: string, name: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateGroup(newGroupName.trim());
      setNewGroupName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (group: Group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveEdit = async (groupId: string) => {
    if (!editingName.trim()) return;
    await onRenameGroup(groupId, editingName.trim());
    setEditingGroupId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FolderOpen className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Switch & Manage Groups</h2>
              <p className="text-xs text-slate-400">All groups stored permanently in local IndexedDB</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Group Input */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/40">
          <form onSubmit={handleCreate} className="flex gap-2.5">
            <input
              type="text"
              placeholder="Enter new group name (e.g. Manali Roadtrip)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newGroupName.trim() || isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
          </form>
        </div>

        {/* Groups List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Available Groups ({groups.length})
          </span>

          {groups.map((group) => {
            const isActive = group.id === activeGroupId;
            const isEditing = group.id === editingGroupId;

            return (
              <div
                key={group.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-blue-600/10 border-blue-500/60 shadow-md shadow-blue-900/10'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                }`}
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-100"
                    />
                    <button
                      onClick={() => handleSaveEdit(group.id)}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingGroupId(null)}
                      className="p-1.5 rounded-lg bg-slate-700 text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      onSelectGroup(group.id);
                      onClose();
                    }}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-100">{group.name}</h4>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Created: {new Date(group.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(group)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      title="Rename group"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {groups.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete group "${group.name}"?`)) {
                            onDeleteGroup(group.id);
                          }
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50"
                        title="Delete group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
