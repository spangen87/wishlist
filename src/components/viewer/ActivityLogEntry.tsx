'use client';
import type { ActivityLogDoc } from '@/types/firestore';

interface ActivityLogEntryProps {
  entry: ActivityLogDoc & { id?: string };
  viewerDisplayName: string;  // resolved username/email for entry.viewerUid
}

function formatAction(
  action: ActivityLogDoc['action'],
  viewerName: string,
  itemTitle: string
): string {
  switch (action) {
    case 'marked_purchased':
      return `${viewerName} markerade "${itemTitle}" som köpt`;
    case 'unmarked_purchased':
      return `${viewerName} avmarkerade "${itemTitle}"`;
    case 'added_note':
      return `${viewerName} lämnade en anteckning på "${itemTitle}"`;
    case 'reserved':
      return `${viewerName} reserverade "${itemTitle}"`;
    case 'unreserved':
      return `${viewerName} avbokade sin reservation på "${itemTitle}"`;
    default:
      return `${viewerName} utförde en åtgärd på "${itemTitle}"`;
  }
}

export function ActivityLogEntry({ entry, viewerDisplayName }: ActivityLogEntryProps) {
  const timestamp = entry.timestamp?.toDate?.();
  const isoString = timestamp?.toISOString() ?? '';
  const localString = timestamp
    ? timestamp.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <li className="flex items-start justify-between gap-4 py-3 border-b border-[#E5D5CC] last:border-0">
      <p className="text-sm text-[#171717] flex-1">
        {formatAction(entry.action, viewerDisplayName, entry.itemTitle)}
      </p>
      <time
        dateTime={isoString}
        className="text-sm text-[#6B7280] flex-shrink-0 whitespace-nowrap"
      >
        {localString}
      </time>
    </li>
  );
}
