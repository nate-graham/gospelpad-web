import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PublicSharedNoteView } from '@/components/notes/public-shared-note-view';
import { fetchPublicNotePreview, previewExcerpt, previewTypeLabel } from '@/lib/public-note-server';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  const metadataBase = host ? new URL(`${proto}://${host}`) : undefined;

  const note = await fetchPublicNotePreview(token);
  if (!note) {
    return { metadataBase, title: 'A note shared from GospelPad' };
  }

  const title = `${note.title} · GospelPad`;
  const description =
    previewExcerpt(note.body, 160) || `${previewTypeLabel(note.type)}${note.speaker ? ` · ${note.speaker}` : ''}, shared from GospelPad.`;

  return {
    metadataBase,
    title,
    description,
    openGraph: { title: note.title, description, siteName: 'GospelPad', type: 'article', url: `/s/${token}` },
    twitter: { card: 'summary_large_image', title: note.title, description },
  };
}

export default async function PublicSharedNotePage({ params }: Props) {
  const { token } = await params;
  return <PublicSharedNoteView shareToken={token} />;
}
