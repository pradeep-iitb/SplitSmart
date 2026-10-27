import React, { useState } from 'react';
import type { Member } from '../../../types/domain';

export const AVATAR_OPTIONS = [
  '/Images/Avatar1.png',
  '/Images/Avatar2.png',
  '/Images/Avatar3.png',
  '/Images/Avatar4.png',
  '/Images/Avatar5.png',
  '/Images/Avatar6.png',
  '/Images/Avatar7.png',
  '/Images/Avatar8.png',
];

export function getMemberAvatarUrl(member?: Partial<Member> | null, fallbackIndex = 0): string {
  if (member?.avatarDataUrl) {
    return member.avatarDataUrl;
  }
  if (!member) {
    return AVATAR_OPTIONS[fallbackIndex % AVATAR_OPTIONS.length];
  }
  // Deterministic mapping based on ID or Name
  const str = member.id || member.name || `${fallbackIndex}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_OPTIONS[hash % AVATAR_OPTIONS.length];
}

interface MemberAvatarProps {
  member?: Partial<Member> | null;
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRing?: boolean;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  member,
  name,
  avatarUrl,
  size = 'md',
  className = '',
  showRing = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = avatarUrl || getMemberAvatarUrl(member);
  const displayName = name || member?.name || '?';

  const sizeClasses = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-12 h-12 text-lg',
  }[size];

  if (hasError || !resolvedUrl) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold shrink-0 ${
          showRing ? 'ring-2 ring-blue-500/50' : ''
        } ${className}`}
        style={member?.color ? { backgroundColor: member.color } : undefined}
      >
        {displayName.substring(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={displayName}
      onError={() => setHasError(true)}
      className={`${sizeClasses} rounded-full object-cover shrink-0 bg-slate-800 ${
        showRing ? 'ring-2 ring-blue-500/60' : ''
      } ${className}`}
    />
  );
};
