'use client';

interface OtherViewerNotesProps {
  notes: Array<{ uid: string; displayName: string; note: string }>;
}

export function OtherViewerNotes({ notes }: OtherViewerNotesProps) {
  if (notes.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {notes.map(({ uid, displayName, note }) => (
        <div
          key={uid}
          className="rounded-lg px-3 py-2 text-[12px]"
          style={{ background: 'var(--color-accent-soft)' }}
        >
          <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
            {displayName}:
          </span>{' '}
          <span style={{ color: 'var(--color-ink-light)' }}>{note}</span>
        </div>
      ))}
    </div>
  );
}
