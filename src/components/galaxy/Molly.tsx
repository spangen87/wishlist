type MollyMood = 'happy' | 'sleepy' | 'excited' | 'thinking';

interface MollyProps {
  size?: number;
  mood?: MollyMood;
  color?: string;
  eyeColor?: string;
  blushColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Molly({
  size = 48,
  mood = 'happy',
  color = '#fff',
  eyeColor = '#0F1330',
  blushColor = '#FF7AB8',
  className,
  style,
}: MollyProps) {
  const eyes = {
    happy: (
      <>
        <circle cx="38" cy="52" r="3.5" fill={eyeColor} />
        <circle cx="62" cy="52" r="3.5" fill={eyeColor} />
      </>
    ),
    sleepy: (
      <>
        <path d="M34 52c2-2 6-2 8 0" stroke={eyeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M58 52c2-2 6-2 8 0" stroke={eyeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    excited: (
      <>
        <path d="M34 48l8 8M42 48l-8 8" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M58 48l8 8M66 48l-8 8" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    thinking: (
      <>
        <circle cx="38" cy="52" r="3.5" fill={eyeColor} />
        <path d="M58 52c2-2 6-2 8 0" stroke={eyeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
  } satisfies Record<MollyMood, React.ReactNode>;

  const mouth = {
    happy: <path d="M45 62c2 3 8 3 10 0" stroke={eyeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />,
    sleepy: <ellipse cx="50" cy="64" rx="3" ry="2" fill={eyeColor} />,
    excited: <path d="M44 60c2 5 10 5 12 0 0 3-3 5-6 5s-6-2-6-5z" fill={eyeColor} />,
    thinking: <ellipse cx="50" cy="63" rx="4" ry="1.5" fill={eyeColor} />,
  } satisfies Record<MollyMood, React.ReactNode>;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      role="img"
      aria-label="Molly molnet"
    >
      <path
        d="M22 58c-8 0-14-6-14-13s6-13 14-13c1-8 8-14 16-14 6 0 12 3 14 8 3-2 6-3 10-3 8 0 15 6 15 14 0 1 0 2-1 3 6 1 11 7 11 13 0 7-6 13-14 13H22z"
        fill={color}
      />
      <ellipse cx="30" cy="62" rx="5" ry="3" fill={blushColor} opacity="0.7" />
      <ellipse cx="70" cy="62" rx="5" ry="3" fill={blushColor} opacity="0.7" />
      {eyes[mood]}
      {mouth[mood]}
    </svg>
  );
}
