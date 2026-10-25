import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X } from '@/components/ui/icons';
import { FaMap } from 'react-icons/fa6';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';

interface ViewOnMapProps {
  /** Embed URL for the map iframe. */
  mapSrc: string;
  /** The place this map points at, used in the iframe title. */
  locationName: string;
  className?: string;
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

/*
 * The pill is the whole control: it morphs into the map in place, so the
 * footer never grows a second surface. The iframe mounts only while open.
 */
export function ViewOnMap({ mapSrc, locationName, className }: ViewOnMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleOpen = () => {
    if (isOpen) setIsMapLoaded(false);
    setIsOpen((open) => !open);
  };

  return (
    <div className={cn('w-full', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!isOpen ? (
          <motion.button
            key="map-pill"
            type="button"
            layoutId="footer-map"
            onClick={toggleOpen}
            aria-expanded={false}
            aria-label={`View ${locationName} on the map`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={springTransition}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="glass-field relative flex h-[52px] w-full max-w-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-[26px] transition-colors hover:bg-white/80 dark:hover:bg-white/10"
          >
            <span className="relative z-10 flex items-center gap-2.5 px-4">
              <FaMap aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                View on Map
              </span>
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="map-panel"
            layoutId="footer-map"
            transition={springTransition}
            className="relative aspect-square w-full max-w-[380px] overflow-hidden rounded-[32px] bg-muted shadow-lg"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="absolute inset-0"
            >
              <iframe
                title={`Map of ${locationName}`}
                src={mapSrc}
                width="100%"
                height="100%"
                style={{
                  border: 0,
                  filter: isDark
                    ? 'invert(90%) hue-rotate(180deg)'
                    : 'invert(15%) hue-rotate(180deg)',
                }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setIsMapLoaded(true)}
                className={cn(
                  'h-full w-full transition-opacity duration-700',
                  isMapLoaded ? 'opacity-100' : 'opacity-0',
                )}
              />
            </motion.div>

            {!isMapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            <motion.button
              type="button"
              onClick={toggleOpen}
              aria-label="Close map"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground active:scale-90 md:right-4 md:top-4 md:h-10 md:w-10"
            >
              <X className="h-5 w-5" strokeWidth={3} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
