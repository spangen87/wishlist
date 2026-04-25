'use client';
import { useMemo } from 'react';

interface StarfieldProps {
  dense?: boolean;
  className?: string;
}

const ACCENTS = [
  { x: 18, y: 15, c: '#7DE3FF' },
  { x: 82, y: 22, c: '#FF7AB8' },
  { x: 10, y: 60, c: '#FFD36E' },
  { x: 90, y: 70, c: '#B28BFF' },
  { x: 50, y: 8, c: '#85F2CA' },
];

export function Starfield({ dense = false, className }: StarfieldProps) {
  const stars = useMemo(() => {
    const n = dense ? 60 : 40;
    const out: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        x: (i * 37.3) % 100,
        y: (i * 53.7) % 100,
        r: i % 7 === 0 ? 1.5 : 0.7,
        o: 0.3 + ((i * 13) % 70) / 100,
      });
    }
    return out;
  }, [dense]);

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      aria-hidden="true"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      {ACCENTS.map((s, i) => (
        <g key={`a-${i}`} transform={`translate(${s.x}% ${s.y}%)`}>
          <path d="M0-5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill={s.c} />
        </g>
      ))}
    </svg>
  );
}

interface TwinklingStarsProps {
  count?: number;
  color?: string;
  className?: string;
}

export function TwinklingStars({ count = 20, color = '#7DE3FF', className }: TwinklingStarsProps) {
  const stars = useMemo(() => {
    const out: { left: number; top: number; size: number; delay: number }[] = [];
    for (let i = 0; i < count; i++) {
      // deterministic-ish distribution to avoid SSR/CSR mismatch
      out.push({
        left: (i * 47.13) % 100,
        top: (i * 71.97) % 100,
        size: 1 + ((i * 11) % 25) / 10,
        delay: ((i * 17) % 100) / 50,
      });
    }
    return out;
  }, [count]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
      style={{ mixBlendMode: 'screen' }}
      aria-hidden="true"
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="anim-twinkle absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: color,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

interface AuroraProps {
  color?: string;
  size?: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  blur?: number;
  className?: string;
}

export function Aurora({
  color = '#FF7AB8',
  size = 220,
  top,
  left,
  right,
  bottom,
  blur = 20,
  className,
}: AuroraProps) {
  return (
    <div
      aria-hidden="true"
      className={`anim-aurora pointer-events-none absolute rounded-full ${className ?? ''}`}
      style={{
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
      }}
    />
  );
}
