import { useEffect, useMemo, useState } from 'react';
import { motion, MotionConfig, type Transition } from 'motion/react';
import { ChevronDown } from '@/components/ui/icons';
import useMeasure from 'react-use-measure';
import { cn } from '@/lib/utils';
import { parseItineraryDescription } from '@/lib/itinerary-text';
import type { ItineraryPhase } from '@/types';

const springTransition: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 50,
  mass: 1,
};

const BORDER_WIDTH = '1px';
const RADIUS = 20;

interface ItineraryAccordionProps {
  phases: ItineraryPhase[];
  onOpenPhoto: (phaseIndex: number, photoIndex: number) => void;
  className?: string;
}

interface PhaseItemProps {
  phase: ItineraryPhase;
  index: number;
  total: number;
  openIndex: number;
  onToggle: (index: number) => void;
  onOpenPhoto: (phaseIndex: number, photoIndex: number) => void;
}

function PhaseItem({ phase, index, total, openIndex, onToggle, onOpenPhoto }: PhaseItemProps) {
  const [ref, bounds] = useMeasure();
  const isOpen = index === openIndex;
  // Keep the photos mounted after the first open so closing never loses the
  // measured height, but avoid loading every phase's gallery up front.
  const [hasOpened, setHasOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);
  const showPhotos = hasOpened || isOpen;

  // `- ` lines in the stored description are the admin's bullets.
  const blocks = useMemo(() => parseItineraryDescription(phase.description), [phase.description]);

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isBeforeOpen = index === openIndex - 1;
  const isAfterOpen = index === openIndex + 1;
  const isAlone = (isAfterOpen && isLast) || (isBeforeOpen && isFirst);

  const borderTopWidth = isFirst || isAfterOpen || isOpen ? BORDER_WIDTH : '0px';
  const borderBottomWidth = isLast || isBeforeOpen || isOpen ? BORDER_WIDTH : '0px';

  let radii = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  if (isOpen || isAlone) {
    radii = { topLeft: RADIUS, topRight: RADIUS, bottomLeft: RADIUS, bottomRight: RADIUS };
  } else if (isBeforeOpen) {
    radii = { ...radii, bottomLeft: RADIUS, bottomRight: RADIUS };
  } else if (isAfterOpen || isFirst) {
    radii = { ...radii, topLeft: RADIUS, topRight: RADIUS };
  } else if (isLast) {
    radii = { ...radii, bottomLeft: RADIUS, bottomRight: RADIUS };
  }

  const title = phase.title || `Phase ${phase.phase}`;
  const contentId = `itinerary-phase-${index}`;

  return (
    <MotionConfig transition={springTransition}>
      <motion.li layout>
        <motion.div
          animate={{
            borderTopLeftRadius: radii.topLeft,
            borderTopRightRadius: radii.topRight,
            borderBottomLeftRadius: radii.bottomLeft,
            borderBottomRightRadius: radii.bottomRight,
          }}
          className="glass-soft overflow-hidden will-change-transform"
          style={{
            borderTopWidth,
            borderBottomWidth,
            borderLeftWidth: BORDER_WIDTH,
            borderRightWidth: BORDER_WIDTH,
            borderStyle: 'solid',
            marginBlock: isOpen ? '10px' : '0px',
          }}
        >
          <button
            type="button"
            onClick={() => onToggle(index)}
            aria-expanded={isOpen}
            aria-controls={contentId}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20 dark:hover:bg-white/5 md:px-5"
          >
            <span
              aria-hidden="true"
              className="glass-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums text-primary md:h-8 md:w-8 md:text-xs"
            >
              {String(phase.phase).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground md:text-base">
              {title}
            </span>
            <motion.span
              aria-hidden="true"
              animate={{ rotate: isOpen ? 180 : 0 }}
              className="shrink-0"
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </motion.span>
          </button>

          <motion.div
            id={contentId}
            initial={false}
            animate={{
              height: isOpen ? bounds.height : 0,
              opacity: isOpen ? 1 : 0,
            }}
            aria-hidden={!isOpen}
            {...(!isOpen ? { inert: '' } : {})}
            className="overflow-hidden will-change-transform"
          >
            <div ref={ref}>
              <div className="px-4 pb-4 md:px-5 md:pb-5">
                <div className="space-y-2">
                  {blocks.map((block, blockIndex) =>
                    block.kind === 'bullets' ? (
                      <ul
                        key={blockIndex}
                        className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary/70"
                      >
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        key={blockIndex}
                        className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                      >
                        {block.lines.join('\n')}
                      </p>
                    ),
                  )}
                </div>
                {showPhotos && phase.photos && phase.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {phase.photos.slice(0, 4).map((img, imgIdx) => (
                      <button
                        key={imgIdx}
                        type="button"
                        onClick={() => onOpenPhoto(index, imgIdx)}
                        aria-label={`Open ${title} photo ${imgIdx + 1}`}
                        className="overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                      >
                        <img
                          src={img}
                          alt={`${title} photo ${imgIdx + 1}`}
                          loading="lazy"
                          decoding="async"
                          onLoad={(event) => event.currentTarget.classList.add('is-in')}
                          ref={(node) => {
                            if (node?.complete && node.naturalWidth > 0) {
                              node.classList.add('is-in');
                            }
                          }}
                          className="photo-fade h-24 w-full object-cover transition-opacity hover:opacity-90 md:h-32"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.li>
    </MotionConfig>
  );
}

export function ItineraryAccordion({ phases, onOpenPhoto, className }: ItineraryAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <ul className={cn('w-full', className)}>
      {phases.map((phase, index) => (
        <PhaseItem
          key={`${phase.phase}-${index}`}
          phase={phase}
          index={index}
          total={phases.length}
          openIndex={openIndex}
          onToggle={(next) => setOpenIndex(next === openIndex ? -1 : next)}
          onOpenPhoto={onOpenPhoto}
        />
      ))}
    </ul>
  );
}
