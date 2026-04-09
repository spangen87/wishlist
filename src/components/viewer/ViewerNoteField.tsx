'use client';
import { useState, useRef } from 'react';

interface ViewerNoteFieldProps {
  itemId: string;
  itemTitle: string;
  currentNote: string;   // Own note — empty string if no note yet
  isSaving?: boolean;    // Optional external saving indicator
  onSave: (note: string) => Promise<void>;  // Called on blur with note value
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

  // Sync value if parent passes updated note (e.g. from onSnapshot)
  // Only sync when not currently editing
  if (!expanded && value !== currentNote) {
    setValue(currentNote);
  }

  async function handleBlur() {
    if (savingRef.current) return; // debounce: prevent double-save
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
        className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
      >
        Lämna en anteckning
      </button>
    );
  }

  if (!expanded && currentNote) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <p className="text-[#171717] text-sm line-clamp-2 flex-1">{currentNote}</p>
        <button
          type="button"
          onClick={() => { setValue(currentNote); setExpanded(true); }}
          className="text-[#F97316] hover:underline flex-shrink-0 min-h-[44px] flex items-center"
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
        className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white resize-none transition-all duration-150"
      />
      {saving && (
        <span className="text-xs text-[#6B7280]">Sparar…</span>
      )}
      {saveError && (
        <p role="alert" className="text-[#DC2626] text-sm">{saveError}</p>
      )}
    </div>
  );
}
