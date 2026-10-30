import type { Member } from '../../types/domain';

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
