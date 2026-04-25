import { Starfield, TwinklingStars, Aurora } from './Starfield';

interface NightShellProps {
  children: React.ReactNode;
  dense?: boolean;
  twinkleColor?: string;
  twinkleCount?: number;
  auroraColor?: string;
  auroraTop?: number | string;
  auroraRight?: number | string;
  auroraLeft?: number | string;
  className?: string;
}

export function NightShell({
  children,
  dense = false,
  twinkleColor = '#7DE3FF',
  twinkleCount = 24,
  auroraColor = '#FF7AB8',
  auroraTop = -60,
  auroraRight = -60,
  auroraLeft,
  className,
}: NightShellProps) {
  return (
    <main
      className={`relative min-h-[100dvh] overflow-hidden text-ink ${className ?? ''}`}
      style={{
        background:
          'linear-gradient(180deg, var(--color-night-deep) 0%, var(--color-night) 55%, var(--color-night-soft) 100%)',
      }}
    >
      <Starfield dense={dense} />
      <TwinklingStars count={twinkleCount} color={twinkleColor} />
      <Aurora
        color={auroraColor}
        size={240}
        top={auroraTop}
        right={auroraRight}
        left={auroraLeft}
      />
      <div className="relative z-10 flex flex-col min-h-[100dvh]">{children}</div>
    </main>
  );
}

interface LightShellProps {
  children: React.ReactNode;
  className?: string;
}

export function LightShell({ children, className }: LightShellProps) {
  return (
    <main
      className={`relative min-h-[100dvh] flex flex-col overflow-x-hidden ${className ?? ''}`}
      style={{ background: 'var(--color-bg-light)', color: 'var(--color-ink-light)' }}
    >
      {children}
    </main>
  );
}
