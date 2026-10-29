'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { cn } from '@/lib/utils';
import { useComboboxContext } from './context';

export type ComboboxContentProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

const VIEWPORT_MARGIN = 8;
const MAX_PANEL_HEIGHT = 450;

type PanelPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function ComboboxContent({
  children,
  className,
  align = 'start',
  sideOffset = 4,
}: ComboboxContentProps) {
  const { open, setOpen, inputRef, triggerRef } = useComboboxContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, 200),
      window.innerWidth - VIEWPORT_MARGIN * 2,
    );
    const preferredLeft =
      align === 'start'
        ? rect.left
        : align === 'end'
          ? rect.right - width
          : rect.left + rect.width / 2 - width / 2;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, preferredLeft),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );

    const spaceBelow = Math.max(
      0,
      window.innerHeight - rect.bottom - sideOffset - VIEWPORT_MARGIN,
    );
    const spaceAbove = Math.max(0, rect.top - sideOffset - VIEWPORT_MARGIN);
    const placeAbove = spaceBelow < MAX_PANEL_HEIGHT && spaceAbove > spaceBelow;

    setPosition(
      placeAbove
        ? {
            bottom: window.innerHeight - rect.top + sideOffset,
            left,
            width,
            maxHeight: spaceAbove,
          }
        : {
            top: rect.bottom + sideOffset,
            left,
            width,
            maxHeight: spaceBelow,
          },
    );
  }, [align, sideOffset, triggerRef]);

  useLayoutEffect(() => {
    if (open) updatePosition();
    else setPosition(null);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    // The app scrolls inside a nested container, so listen in the capture
    // phase to catch its scroll events as well as the window's.
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.parentElement?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen, inputRef]);

  // Close on Escape. Claimed in the capture phase so an enclosing dialog does
  // not also see the key — its own dismiss handler would otherwise close the
  // form behind the list on the same press.
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, setOpen]);

  if (!open || !position) return null;

  return createPortal(
    // Glass surfaces create stacking contexts, so only a body portal keeps
    // this panel above cards that come later in the form.
    //
    // Living outside the form's own subtree costs us two things when the
    // combobox sits inside a modal dialog, so both are restored here:
    // a modal Radix dialog sets `pointer-events: none` on <body> (the panel
    // would be click-through), and it traps focus inside its own content node
    // (the search field would lose focus the moment it gained it). Opting the
    // panel back into pointer events and giving it its own focus scope — which
    // pauses the dialog's scope while open — makes it behave like the dialog's
    // own content.
    <FocusScope asChild loop trapped>
      <div
        ref={contentRef}
        // A modal dialog locks scrolling for everything outside its own
        // content, which would leave this list frozen under the wheel. Keeping
        // these two events local lets the browser scroll the list natively.
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        className={cn(
          'glass-strong pointer-events-auto fixed z-50 overflow-y-auto rounded-xl bg-white/85 p-1 text-popover-foreground dark:bg-[hsl(222_24%_17%/0.88)]',
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
        style={{
          top: position.top,
          bottom: position.bottom,
          left: position.left,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
      >
        {children}
      </div>
    </FocusScope>,
    document.body,
  );
}
