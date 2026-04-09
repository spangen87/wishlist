export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
      <span className="text-[64px]" aria-hidden="true">⭐</span>
      <h2 className="text-3xl font-semibold text-[#171717]">Din lista är tom</h2>
      <p className="text-base text-[#171717] max-w-xs">
        Vad önskar du dig? Lägg till ditt första önskemål!
      </p>
      <button
        onClick={onAdd}
        className="mt-2 bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-6 py-3 font-semibold min-h-[44px] transition-colors"
      >
        Lägg till önskemål
      </button>
    </div>
  );
}
