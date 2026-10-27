import React, { useState } from 'react';
import type { Member } from '../../../types/domain';
import { MemberAvatar, AVATAR_OPTIONS } from './MemberAvatar';
import {
  X,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  QrCode,
} from 'lucide-react';

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  members: Member[];
  onAddMember: (name: string, options?: { color?: string; avatarDataUrl?: string; upiId?: string }) => Promise<Member>;
  onUpdateMember: (memberId: string, patch: Partial<Member>) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  groupName,
  members,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}) => {
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState(AVATAR_OPTIONS[0]);
  const [newUpiId, setNewUpiId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUpiId, setEditUpiId] = useState('');
  const [editAvatar, setEditAvatar] = useState(AVATAR_OPTIONS[0]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddMember(newName.trim(), {
        avatarDataUrl: newAvatar,
        upiId: newUpiId.trim() || undefined,
      });
      setNewName('');
      setNewUpiId('');
      // Cycle to next avatar default
      setNewAvatar(AVATAR_OPTIONS[(members.length + 1) % AVATAR_OPTIONS.length]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (member: Member) => {
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditUpiId(member.upiId || '');
    setEditAvatar(member.avatarDataUrl || AVATAR_OPTIONS[0]);
  };

  const handleSaveEdit = async (memberId: string) => {
    if (!editName.trim()) return;
    await onUpdateMember(memberId, {
      name: editName.trim(),
      upiId: editUpiId.trim() || undefined,
      avatarDataUrl: editAvatar,
    });
    setEditingMemberId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <UserPlus className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Manage Members</h2>
              <p className="text-xs text-slate-400">Members for group: {groupName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAdd} className="p-6 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Member Name (e.g. Rahul Sharma)"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="UPI ID (optional, e.g. rahul@okaxis)"
              value={newUpiId}
              onChange={(e) => setNewUpiId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">Avatar:</span>
              {AVATAR_OPTIONS.map((avatarPath, idx) => (
                <button
                  key={avatarPath}
                  type="button"
                  onClick={() => setNewAvatar(avatarPath)}
                  className={`w-8 h-8 rounded-full transition-all overflow-hidden p-0.5 border cursor-pointer ${
                    newAvatar === avatarPath
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-110 shadow-md shadow-emerald-500/20'
                      : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                  }`}
                  title={`Avatar ${idx + 1}`}
                >
                  <img src={avatarPath} alt={`Avatar ${idx + 1}`} className="w-full h-full rounded-full object-cover" />
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!newName.trim() || isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>
        </form>

        {/* Members List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Group Members ({members.length})
          </span>

          {members.map((member) => {
            const isEditing = member.id === editingMemberId;

            return (
              <div
                key={member.id}
                className="p-3.5 rounded-2xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 transition-all flex items-center justify-between gap-3"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-100"
                      />
                      <input
                        type="text"
                        value={editUpiId}
                        onChange={(e) => setEditUpiId(e.target.value)}
                        placeholder="UPI ID"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-100"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {AVATAR_OPTIONS.map((avatarPath, idx) => (
                          <button
                            key={avatarPath}
                            type="button"
                            onClick={() => setEditAvatar(avatarPath)}
                            className={`w-7 h-7 rounded-full transition-all overflow-hidden p-0.5 border cursor-pointer ${
                              editAvatar === avatarPath
                                ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-110'
                                : 'border-slate-700 opacity-60 hover:opacity-100'
                            }`}
                            title={`Avatar ${idx + 1}`}
                          >
                            <img src={avatarPath} alt={`Avatar ${idx + 1}`} className="w-full h-full rounded-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSaveEdit(member.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingMemberId(null)}
                          className="p-1.5 rounded-lg bg-slate-700 text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={member} size="lg" className="border-2 border-slate-700/80 shadow-sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100">{member.name}</h4>
                          {!member.active && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                              Inactive
                            </span>
                          )}
                        </div>
                        {member.upiId ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                            <QrCode className="w-3 h-3" />
                            {member.upiId}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 mt-0.5 block">No UPI ID configured</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(member)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                        title="Edit member details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove member "${member.name}"? Historical records will be safely preserved.`)) {
                            onRemoveMember(member.id);
                          }
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
