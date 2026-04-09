'use client';

interface OtherViewerNotesProps {
  // Map of viewer UID → display name (pre-resolved by parent)
  notes: Array<{ uid: string; displayName: string; note: string }>;
}

export function OtherViewerNotes({ notes }: OtherViewerNotesProps) {
  if (notes.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {notes.map(({ uid, displayName, note }) => (
        <p key={uid} className="text-sm text-[#6B7280]">
          <span className="font-medium">{displayName}:</span> {note}
        </p>
      ))}
    </div>
  );
}
