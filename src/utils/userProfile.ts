/**
 * User Profile Management for SplitSmart
 *
 * Allows users to set their real name and default UPI ID.
 * Replaces generic 'Me' across member records, exports, CSV files, and WhatsApp summaries.
 */

import { db, SplitSmartDatabase } from '../db/database';
import type { Member } from '../types/domain';

export const USER_NAME_STORAGE_KEY = 'splitsmart_user_name';
export const USER_UPI_STORAGE_KEY = 'splitsmart_user_upi';

export interface UserProfile {
  name: string;
  upiId: string;
}

/**
 * Retrieves the user's saved profile name from localStorage.
 * Defaults to an empty string if not configured.
 */
export function getUserProfileName(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(USER_NAME_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Retrieves the user's saved default UPI ID from localStorage.
 */
export function getUserProfileUpi(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(USER_UPI_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Retrieves the full user profile.
 */
export function getUserProfile(): UserProfile {
  return {
    name: getUserProfileName(),
    upiId: getUserProfileUpi(),
  };
}

/**
 * Saves the user's profile to localStorage.
 */
export function saveUserProfile(profile: { name: string; upiId?: string }): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cleanName = profile.name.trim();
    if (cleanName) {
      localStorage.setItem(USER_NAME_STORAGE_KEY, cleanName);
    } else {
      localStorage.removeItem(USER_NAME_STORAGE_KEY);
    }

    const cleanUpi = profile.upiId?.trim() || '';
    if (cleanUpi) {
      localStorage.setItem(USER_UPI_STORAGE_KEY, cleanUpi);
    } else {
      localStorage.removeItem(USER_UPI_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota
  }
}

/**
 * Synchronizes the user's real name across all groups in IndexedDB.
 * Updates any member marked as `isCurrentUser: true` with the new name and UPI ID.
 */
export async function syncUserProfileAcrossGroups(
  name: string,
  upiId?: string,
  customDb: SplitSmartDatabase = db
): Promise<Member[]> {
  const cleanName = name.trim();
  if (!cleanName) return [];

  const updatedMembers: Member[] = [];
  const allMembers = await customDb.members.toArray();

  await customDb.transaction('rw', customDb.members, async () => {
    for (const member of allMembers) {
      if (member.isCurrentUser) {
        const patch: Partial<Member> = {
          name: cleanName,
        };
        if (upiId !== undefined) {
          patch.upiId = upiId.trim() || undefined;
        }
        await customDb.members.update(member.id, patch);
        updatedMembers.push({ ...member, ...patch });
      }
    }
  });

  return updatedMembers;
}
