'use client';
import { useState, useRef } from 'react';

interface ViewerNoteFieldProps {
  itemId: string;
  itemTitle: string;
  currentNote: string;
  isSaving?: boolean;
  onSave: (note: string) => Promise<void>;
}

export function ViewerNoteField({
  currentNote,
  onSave,
}: ViewerNoteFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState(currentNote);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);

  if (!expanded && value !== currentNote) {
    setValue(currentNote);
  }

  async function handleBlur() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(value);
      setExpanded(false);
    } catch {
      setSaveError('Anteckningen kunde inte sparas. Försök igen.');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  if (!expanded && !currentNote) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[12px] font-semibold flex items-center min-h-[36px]"
        style={{ color: 'var(--color-accent)' }}
      >
        + Lämna en anteckning
      </button>
    );
  }

  if (!expanded && currentNote) {
    return (
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'var(--color-accent-soft)' }}
      >
        <p
          className="text-[12px] flex-1 italic line-clamp-2"
          style={{ color: 'var(--color-ink-light)' }}
        >
          “{currentNote}”
        </p>
        <button
          type="button"
          onClick={() => {
            setValue(currentNote);
            setExpanded(true);
          }}
          className="text-[12px] font-semibold shrink-0"
          style={{ color: 'var(--color-accent)' }}
        >
          Redigera
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        rows={3}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Din anteckning…"
        className="light-input italic resize-none"
      />
      {saving && (
        <span className="text-[11px]" style={{ color: 'var(--color-muted-light)' }}>
          Sparar…
        </span>
      )}
      {saveError && (
        <p role="alert" className="text-[12px]" style={{ color: 'var(--color-destructive)' }}>
          {saveError}
        </p>
      )}
    </div>
  );
}
