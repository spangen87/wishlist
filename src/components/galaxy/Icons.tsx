interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Star({ size = 16, color = '#FFD36E', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} aria-hidden="true">
      <path d="M10 1l2.5 6L19 8l-5 4.5L15.5 19 10 15.5 4.5 19 6 12.5 1 8l6.5-1z" fill={color} />
    </svg>
  );
}

export function Sparkle({ size = 14, color = '#7DE3FF', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} aria-hidden="true">
      <path d="M10 0c0 5 5 10 10 10-5 0-10 5-10 10 0-5-5-10-10-10 5 0 10-5 10-10z" fill={color} />
    </svg>
  );
}

export function Heart({ size = 14, color = '#FF7AB8', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} aria-hidden="true">
      <path
        d="M10 17s-7-4.5-7-10c0-3 2-5 5-5 1.5 0 3 1 3 3 0-2 1.5-3 3-3 3 0 5 2 5 5 0 5.5-7 10-7 10z"
        fill={color}
      />
    </svg>
  );
}

export function Check({ size = 12, color = '#fff', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={className}
      style={style}
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

export function Cog({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      style={style}
      fill={color}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Pencil({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} fill={color} aria-hidden="true">
      <path d="M14.06 2.94a1.5 1.5 0 012.12 0l.88.88a1.5 1.5 0 010 2.12l-9.5 9.5L4 16l.56-3.56 9.5-9.5z" />
    </svg>
  );
}

export function Trash({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} fill={color} aria-hidden="true">
      <path d="M7 2a1 1 0 011-1h4a1 1 0 011 1v1h4a1 1 0 110 2h-1l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 5H4a1 1 0 010-2h4V2zm2 5a1 1 0 00-2 0v8a1 1 0 002 0V7zm4 0a1 1 0 10-2 0v8a1 1 0 102 0V7z" />
    </svg>
  );
}

export function Plus({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} fill={color} aria-hidden="true">
      <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
    </svg>
  );
}

export function ArrowLeft({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 4l-6 6 6 6" />
    </svg>
  );
}

export function DotsVertical({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} fill={color} aria-hidden="true">
      <circle cx="10" cy="4" r="2" />
      <circle cx="10" cy="10" r="2" />
      <circle cx="10" cy="16" r="2" />
    </svg>
  );
}

export function GripDots({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size * (12 / 20)} height={size} viewBox="0 0 12 20" className={className} style={style} fill={color} aria-hidden="true">
      <circle cx="3" cy="4" r="1.5" />
      <circle cx="9" cy="4" r="1.5" />
      <circle cx="3" cy="10" r="1.5" />
      <circle cx="9" cy="10" r="1.5" />
      <circle cx="3" cy="16" r="1.5" />
      <circle cx="9" cy="16" r="1.5" />
    </svg>
  );
}

export function Link({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M9 11a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" />
      <path d="M11 9a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5" />
    </svg>
  );
}

export function Calendar({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="3" y="4" width="14" height="14" rx="2" />
      <path d="M3 8h14M7 2v4M13 2v4" />
    </svg>
  );
}

export function User({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} className={className} style={style} aria-hidden="true">
      <path d="M10 11a4 4 0 100-8 4 4 0 000 8zm-7 7a7 7 0 1114 0H3z" />
    </svg>
  );
}

export function Tag({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M3 10V3h7l8 8-7 7-8-8z" />
      <circle cx="7" cy="7" r="1.2" fill={color} />
    </svg>
  );
}

export function Image({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <circle cx="7" cy="7.5" r="1.2" fill={color} />
      <path d="M3 14l4-4 4 4 3-3 3 3" />
    </svg>
  );
}

export function Note({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M5 3h7l4 4v10H5z" />
      <path d="M12 3v4h4" />
    </svg>
  );
}

export function LogOut({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M11 4H4v12h7" />
      <path d="M14 7l3 3-3 3M9 10h8" />
    </svg>
  );
}
