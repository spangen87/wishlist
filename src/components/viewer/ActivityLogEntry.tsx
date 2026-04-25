'use client';
import { Check, Pencil, Sparkle } from '@/components/galaxy';
import type { ActivityLogDoc } from '@/types/firestore';

interface ActivityLogEntryProps {
  entry: ActivityLogDoc & { id?: string };
  viewerDisplayName: string;
}

const ACTION_META: Record<
  ActivityLogDoc['action'],
  { verb: string; color: string; bg: string; icon: 'check' | 'pencil' | 'sparkle' }
> = {
  marked_purchased: { verb: 'markerade', color: '#85F2CA', bg: '#85F2CA', icon: 'check' },
  unmarked_purchased: { verb: 'avmarkerade', color: '#FF7AB8', bg: '#FF7AB8', icon: 'check' },
  added_note: { verb: 'antecknade på', color: '#F59E0B', bg: '#FFD36E', icon: 'pencil' },
  reserved: { verb: 'reserverade', color: '#7DE3FF', bg: '#7DE3FF', icon: 'sparkle' },
  unreserved: { verb: 'avbokade reservation på', color: '#9B9AC6', bg: '#9B9AC6', icon: 'sparkle' },
};

function actionFallback(action: ActivityLogDoc['action']) {
  return ACTION_META[action] ?? { verb: 'utförde en åtgärd på', color: '#6B7280', bg: '#9CA3AF', icon: 'sparkle' as const };
}

function ActionIcon({ icon, color }: { icon: 'check' | 'pencil' | 'sparkle'; color: string }) {
  if (icon === 'check') return <Check size={12} color={color} />;
  if (icon === 'pencil') return <Pencil size={12} color={color} />;
  return <Sparkle size={12} color={color} />;
}

export function ActivityLogEntry({ entry, viewerDisplayName }: ActivityLogEntryProps) {
  const meta = actionFallback(entry.action);
  const timestamp = entry.timestamp?.toDate?.();
  const isoString = timestamp?.toISOString() ?? '';
  const localString = timestamp
    ? timestamp.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          background: `${meta.bg}26`,
          color: meta.color,
        }}
        aria-hidden="true"
      >
        <ActionIcon icon={meta.icon} color={meta.color} />
      </div>
      <div
        className="flex-1 min-w-0"
        style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: 12 }}
      >
        <p className="text-[13px] leading-snug" style={{ color: 'var(--color-ink-light)' }}>
          <span className="font-bold">{viewerDisplayName}</span>{' '}
          <span style={{ color: 'var(--color-muted-light)' }}>{meta.verb}</span>{' '}
          <span className="font-display italic">&ldquo;{entry.itemTitle}&rdquo;</span>
        </p>
        <time
          dateTime={isoString}
          className="block mt-1 text-[11px] font-tabular"
          style={{ color: 'var(--color-muted-light)' }}
        >
          {localString}
        </time>
      </div>
    </li>
  );
}
