import { GroupNoteForm } from '@/components/groups/group-note-form';
import { getGroupNativeNoteById } from '@/lib/groups';
import Link from 'next/link';

export default async function EditGroupNotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const note = await getGroupNativeNoteById(id, noteId);

  if (!note) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Group note not available</strong>
        <span style={{ color: 'var(--muted)' }}>
          This group note may have been removed or may no longer be visible to your account.
        </span>
        <div className="cta-row">
          <Link className="button button-primary" href={`/groups/${id}`}>
            Back to group
          </Link>
        </div>
      </section>
    );
  }

  return <GroupNoteForm groupId={id} mode="edit" note={note} />;
}
