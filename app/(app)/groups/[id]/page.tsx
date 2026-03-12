import { GroupDetailView } from '@/components/groups/group-detail-view';

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupDetailView groupId={id} />;
}
