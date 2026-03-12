import type { Group } from '@/lib/groups';

export function formatGroupDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function getGroupVisibilityLabel(group: Pick<Group, 'is_public'>) {
  return group.is_public ? 'Public group' : 'Private group';
}

