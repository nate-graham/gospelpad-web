import { ImageResponse } from 'next/og';
import { fetchPublicNotePreview, previewExcerpt, previewTypeLabel } from '@/lib/public-note-server';
import { findScriptureReferences } from '@/lib/scripture-references';

export const alt = 'A note shared from GospelPad';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

const PAPER = '#f7f5ef';
const INK = '#2b2823';
const MUTED = '#6c655b';
const LAPIS = '#3d5a9c';
const VERMILION = '#b8432c';
const LINE = '#ddd7cb';

/** Load a Google font as TTF for the image renderer; falls back to the default font. */
async function loadFont(family: string, weight: number, italic = false) {
  try {
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${axis}`, {
        // An old user agent makes Google Fonts serve TTF, which the renderer understands.
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' },
      })
    ).text();
    const src = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) return null;
    return await (await fetch(src)).arrayBuffer();
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const note = await fetchPublicNotePreview(token);

  const [serif, serifItalic, sans, sansBold] = await Promise.all([
    loadFont('Newsreader', 500),
    loadFont('Newsreader', 400, true),
    loadFont('Instrument Sans', 500),
    loadFont('Instrument Sans', 700),
  ]);
  const fonts = [
    serif && { name: 'Serif', data: serif, weight: 500 as const, style: 'normal' as const },
    serifItalic && { name: 'Serif', data: serifItalic, weight: 400 as const, style: 'italic' as const },
    sans && { name: 'Sans', data: sans, weight: 500 as const, style: 'normal' as const },
    sansBold && { name: 'Sans', data: sansBold, weight: 700 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: 'normal' | 'italic' }[];

  const title = note?.title ?? 'A note shared from GospelPad';
  const excerpt = note ? previewExcerpt(note.body, 230) : 'Sermon notes, Scripture study, journals and prayer in one quiet place.';
  const verses = note ? findScriptureReferences(note.body).slice(0, 3) : [];
  const eyebrow = note
    ? [previewTypeLabel(note.type), formatDate(note.created_at)].filter(Boolean).join(' · ')
    : 'Where your notes meet the Word';
  const titleSize = title.length > 60 ? 58 : title.length > 34 ? 68 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: PAPER,
          fontFamily: 'Sans',
          color: INK,
          padding: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#fbfaf6',
            border: `1px solid ${LINE}`,
            borderRadius: 32,
            padding: '52px 64px 44px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 5, color: LAPIS }}>GOSPELPAD</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, letterSpacing: 3, color: MUTED }}>THE DIGITAL SANCTUARY</div>
          </div>

          <div style={{ display: 'flex', marginTop: 44, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: VERMILION }}>
            {eyebrow.toUpperCase()}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontFamily: 'Serif',
              fontWeight: 500,
              fontSize: titleSize,
              lineHeight: 1.06,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          {note?.speaker ? (
            <div style={{ display: 'flex', marginTop: 12, fontFamily: 'Serif', fontStyle: 'italic', fontSize: 26, color: MUTED }}>
              {note.speaker}
            </div>
          ) : null}
          {excerpt ? (
            <div
              style={{
                display: 'flex',
                marginTop: 26,
                paddingLeft: 22,
                borderLeft: `3px solid ${LAPIS}`,
                fontFamily: 'Serif',
                fontSize: 27,
                lineHeight: 1.5,
                color: '#3a362f',
                maxHeight: 128,
                overflow: 'hidden',
              }}
            >
              {excerpt}
            </div>
          ) : null}

          <div style={{ display: 'flex', flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${LINE}`, paddingTop: 22 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {verses.map((verse) => (
                <div
                  key={verse}
                  style={{
                    display: 'flex',
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: '#e6e8f3',
                    color: LAPIS,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  ¶ {verse}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: MUTED }}>Read it on gospelpad.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  );
}
