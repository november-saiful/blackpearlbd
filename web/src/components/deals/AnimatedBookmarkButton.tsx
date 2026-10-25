import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, Check } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnimatedBookmarkButtonProps {
  isBookmarked: boolean;
  onClick: () => void;
  className?: string;
}

export function AnimatedBookmarkButton({ 
  isBookmarked, 
  onClick, 
  className 
}: AnimatedBookmarkButtonProps) {
  const [showReaction, setShowReaction] = useState(false);

  useEffect(() => {
    if (isBookmarked) {
      setShowReaction(true);
      const timer = setTimeout(() => setShowReaction(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isBookmarked]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          "relative overflow-hidden",
          className
        )}
      >
        <motion.div
          animate={isBookmarked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Bookmark 
            className={cn(
              "w-5 h-5 transition-colors duration-200",
              isBookmarked ? "fill-primary text-primary" : "text-muted-foreground"
            )} 
          />
        </motion.div>
      </Button>

      <AnimatePresence>
        {showReaction && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -20 }}
            exit={{ opacity: 0, scale: 0, y: -40 }}
            transition={{ duration: 0.3 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
              <Check className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-primary">Saved</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
