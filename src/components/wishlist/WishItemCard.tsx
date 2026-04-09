import type { WishItemDoc } from '@/types/firestore';

interface WishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  onEditStart: () => void;
  // Plan 03 will add: dragHandleProps from useSortable
}

export function WishItemCard({ item, onEditStart }: WishItemCardProps) {
  return (
    <li
      role="listitem"
      className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex gap-3 items-start"
    >
      {/* Drag handle stub */}
      <button
        aria-label="Dra för att ändra ordning"
        style={{ touchAction: 'none' }}
        className="flex-shrink-0 flex items-center justify-center w-6 min-h-[44px] text-gray-400 cursor-grab"
      >
        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/>
          <circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/>
        </svg>
      </button>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-semibold text-[#171717] leading-tight">{item.title}</h2>
        {item.price !== undefined && (
          <span className="text-sm text-gray-500">~{item.price} kr</span>
        )}
        {item.productUrl && (
          <a
            href={item.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 truncate block max-w-full hover:underline"
          >
            {item.productUrl}
          </a>
        )}
        {item.note && (
          <p className="text-base text-[#171717] line-clamp-3">{item.note}</p>
        )}
      </div>

      {/* Right column: thumbnail + edit button */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            width={64}
            height={64}
            className="w-16 h-16 rounded-md object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-md bg-[#E5D5CC]" aria-hidden="true" />
        )}
        <button
          onClick={onEditStart}
          aria-label={`Redigera ${item.title}`}
          className="text-sm text-[#F97316] hover:underline min-h-[44px] flex items-center"
        >
          Redigera
        </button>
      </div>
    </li>
  );
}
