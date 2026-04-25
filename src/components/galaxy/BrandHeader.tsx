import { Molly } from './Molly';

interface BrandHeaderProps {
  eyebrow?: string;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  showMolly?: boolean;
  mollySize?: number;
  mollyMood?: 'happy' | 'sleepy' | 'excited' | 'thinking';
  rightSlot?: React.ReactNode;
  className?: string;
}

const TITLE_SIZE: Record<NonNullable<BrandHeaderProps['size']>, string> = {
  sm: 'text-[20px]',
  md: 'text-[22px]',
  lg: 'text-[28px]',
};

export function BrandHeader({
  eyebrow,
  title,
  size = 'md',
  showMolly = true,
  mollySize = 44,
  mollyMood = 'happy',
  rightSlot,
  className,
}: BrandHeaderProps) {
  return (
    <header className={`flex items-center justify-between gap-3 min-w-0 ${className ?? ''}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showMolly && (
          <div className="relative shrink-0 anim-molly">
            <div
              aria-hidden="true"
              className="absolute -inset-2 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(125,227,255,0.55) 0%, transparent 70%)',
                filter: 'blur(8px)',
              }}
            />
            <Molly size={mollySize} mood={mollyMood} eyeColor="#0F1330" blushColor="#FF7AB8" style={{ position: 'relative' }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className="text-[11px] tracking-caps font-semibold truncate"
              style={{ color: 'var(--color-muted)' }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className={`font-display font-bold leading-tight gradient-text ${TITLE_SIZE[size]} truncate`}
          >
            {title}
          </h1>
        </div>
      </div>
      {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
    </header>
  );
}
