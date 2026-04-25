import { Molly, Star, Sparkle } from '@/components/galaxy';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-12 pb-16 gap-5">
      <div className="relative anim-molly">
        <div
          aria-hidden="true"
          className="absolute -inset-5 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(125,227,255,0.45) 0%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />
        <Molly size={120} mood="sleepy" eyeColor="#0F1330" blushColor="#FF7AB8" style={{ position: 'relative' }} />
        <span className="anim-star-pop absolute" style={{ top: -10, right: -12 }}>
          <Star size={22} color="#FFD36E" style={{ filter: 'drop-shadow(0 0 6px rgba(255,211,110,0.7))' }} />
        </span>
        <span className="anim-sparkle absolute" style={{ bottom: 8, left: -16 }}>
          <Sparkle size={18} color="#7DE3FF" style={{ filter: 'drop-shadow(0 0 6px rgba(125,227,255,0.7))' }} />
        </span>
      </div>

      <div>
        <h2 className="font-display font-bold text-[28px] gradient-text leading-tight">
          Önska på en stjärna
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          Lägg till ditt första önskemål
          <br />
          och se galaxen tända!
        </p>
      </div>

      <button type="button" onClick={onAdd} className="neon-cta anim-fab">
        <Sparkle size={16} color="#fff" /> Tänd första stjärnan
      </button>
    </div>
  );
}
