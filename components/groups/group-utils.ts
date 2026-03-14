import type { Group } from '@/lib/groups';
import type { GroupMemberSummary } from '@/lib/groups';

export function formatGroupDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function getGroupVisibilityLabel(group: Pick<Group, 'is_public'>) {
  return group.is_public ? 'Public group' : 'Private group';
}

export function getGroupMemberLabel(member: Pick<GroupMemberSummary, 'display_name' | 'name' | 'username' | 'user_id'>) {
  return member.display_name?.trim()
    || member.name?.trim()
    || member.username?.trim()
    || `Member ${member.user_id.slice(0, 8)}`;
}
