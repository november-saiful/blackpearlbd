import { motion, useReducedMotion, type Transition } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { ContentLocale } from '@/lib/locale';
import { Globe } from '@/components/ui/icons';

/*
 * The language control: a Hugeicons globe anchored in the button with the
 * active language's wordmark riding a badge on its edge. Switching language
 * slides the old wordmark out and the new one in, so the swap still reads as
 * one continuous morph.
 */
export function LanguageGlobe({
  locale,
  className,
  instant = false,
}: {
  locale: ContentLocale;
  className?: string;
  instant?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const isBn = locale === 'bn';
  const transition: Transition = {
    duration: instant ? 0 : reduceMotion ? 0.12 : 0.3,
    ease: [0.32, 0.72, 0, 1],
  };

  return (
    <span className={cn('relative block size-full', className)} aria-hidden="true">
      <Globe className="size-full" strokeWidth={1.6} />
      <span className="absolute -bottom-[6%] -right-[6%] grid h-[42%] min-w-[42%] place-items-center overflow-hidden rounded-full bg-foreground px-[3%] text-background">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={locale}
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-110%', opacity: 0 }}
            transition={transition}
            className="text-[0.5rem] font-semibold leading-none"
            style={
              isBn
                ? {
                    fontFamily:
                      "'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif",
                  }
                : undefined
            }
          >
            {isBn ? 'বাং' : 'EN'}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
