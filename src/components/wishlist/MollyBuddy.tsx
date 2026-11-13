'use client';
import { Molly, Star, Heart } from '@/components/galaxy';

export type MollyReactionKind = 'added' | 'favorite' | 'removed';

export interface MollyReaction {
  kind: MollyReactionKind;
  /** Changes on every reaction so the same one can play twice in a row. */
  id: number;
  /** Milestone message, shown in a speech bubble. */
  bubble?: string;
}

/** Speech bubble for the wish counts worth celebrating. */
export function milestoneMessage(wishCount: number): string | undefined {
  switch (wishCount) {
    case 1:
      return 'Första stjärnan är tänd!';
    case 5:
      return 'Fem stjärnor tända!';
    case 10:
      return 'Tio stjärnor – vilken galax!';
    case 20:
      return 'Tjugo stjärnor! Wow!';
    default:
      return undefined;
  }
}

interface MollyBuddyProps {
  /** What just happened on the list, or null when nothing did. */
  reaction: MollyReaction | null;
  /** A wish is being written or edited. */
  thinking: boolean;
  size?: number;
}

const REACTION_CLASS: Record<MollyReactionKind, string> = {
  added: 'anim-molly-cheer',
  favorite: 'anim-molly-love',
  removed: 'anim-molly-droop',
};

/**
 * Molly in the child's header, reacting to what the child does with the list:
 * she cheers and sends up a star for a new wish, blushes at a favorite, droops
 * for a moment when a wish is removed and looks thoughtful while one is being
 * written. Purely decorative apart from the milestone bubble, which is
 * announced politely to screen readers.
 */
export function MollyBuddy({ reaction, thinking, size = 44 }: MollyBuddyProps) {
  const mood =
    reaction?.kind === 'added'
      ? 'excited'
      : reaction?.kind === 'removed'
      ? 'sleepy'
      : reaction?.kind === 'favorite'
      ? 'happy'
      : thinking
      ? 'thinking'
      : 'happy';

  return (
    <div className="relative shrink-0" data-molly-mood={mood} data-molly-reaction={reaction?.kind}>
      {/* Keyed so a new reaction restarts the animation from the top. */}
      <div
        key={reaction?.id ?? 'idle'}
        className={`relative ${reaction ? REACTION_CLASS[reaction.kind] : 'anim-molly'}`}
      >
        <div
          aria-hidden="true"
          className="absolute -inset-2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(125,227,255,0.55) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        <Molly
          size={size}
          mood={mood}
          eyeColor="#0F1330"
          blushColor="#FF7AB8"
          blushOpacity={reaction?.kind === 'favorite' ? 1 : undefined}
          style={{ position: 'relative' }}
        />
      </div>

      {reaction?.kind === 'added' && (
        <span
          key={`star-${reaction.id}`}
          aria-hidden="true"
          className="anim-molly-star absolute pointer-events-none"
          style={{ top: 2, right: 0 }}
        >
          <Star size={16} color="#FFD36E" style={{ filter: 'drop-shadow(0 0 6px rgba(255,211,110,0.9))' }} />
        </span>
      )}
      {reaction?.kind === 'favorite' && (
        <span
          key={`heart-${reaction.id}`}
          aria-hidden="true"
          className="anim-molly-heart absolute pointer-events-none"
          style={{ top: 0, right: 2 }}
        >
          <Heart size={14} color="#FF7AB8" style={{ filter: 'drop-shadow(0 0 6px rgba(255,122,184,0.9))' }} />
        </span>
      )}

      <div role="status" aria-live="polite">
        {reaction?.bubble && (
          <span key={`bubble-${reaction.id}`} className="molly-bubble">
            {reaction.bubble}
          </span>
        )}
      </div>
    </div>
  );
}
