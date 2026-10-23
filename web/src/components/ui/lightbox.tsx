import React, { useCallback, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  alt?: string;
  actions?: React.ReactNode;
}

/**
 * Fullscreen image preview.
 *
 * Rendered as a native `<dialog>` opened with `showModal()` so the browser places
 * it in the *top layer*: it paints above every overlay (including Radix portals
 * used by the admin form dialog) and is immune to ancestor overflow / transforms.
 *
 * Two things matter for the buttons to work while a Radix dialog is also open:
 *  1. `pointer-events: auto` is set explicitly. Radix's modal scroll lock sets
 *     `pointer-events: none` on `<body>`, which every portaled sibling inherits,
 *     the preview then swallows no clicks at all and the page behind stays live.
 *  2. Escape / arrow keydowns are stopped during the capture phase at `window`,
 *     which runs before Radix's document-level Escape handler, so the preview
 *     closes itself without also closing the form underneath.
 */
export function Lightbox({ images, currentIndex, isOpen, onClose, onNavigate, alt, actions }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const onNavigateRef = useRef(onNavigate);
  const indexRef = useRef(currentIndex);
  const countRef = useRef(images.length);

  onCloseRef.current = onClose;
  onNavigateRef.current = onNavigate;
  indexRef.current = currentIndex;
  countRef.current = images.length;

  const requestClose = useCallback(() => onCloseRef.current(), []);

  // Drive the native modal state from the `isOpen` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Already open elsewhere / not connected: fall back to a inline dialog.
        dialog.setAttribute('open', '');
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Keep React state in sync when the browser closes the dialog itself (Esc, form, ...).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => requestClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [requestClose]);

  // Capture-phase keyboard handling: keeps Radix's dialog from reacting to Esc
  // and gives the preview arrow-key navigation.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Stop it before it reaches the Radix dialog's document listener.
        event.stopPropagation();
      }
      if (event.key === 'ArrowLeft' && indexRef.current > 0) {
        onNavigateRef.current(indexRef.current - 1);
      }
      if (event.key === 'ArrowRight' && indexRef.current < countRef.current - 1) {
        onNavigateRef.current(indexRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  return (
    <dialog
      ref={dialogRef}
      aria-label={alt || 'Image preview'}
      className="m-auto max-h-[95vh] max-w-[95vw] rounded-2xl border border-white/15 bg-black/50 p-0 text-white shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-md"
      style={{ pointerEvents: 'auto' }}
      onClick={(event) => {
        // Clicks on the ::backdrop are dispatched with the dialog as the target.
        if (event.target === dialogRef.current) requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="relative flex items-center justify-center bg-black/20 backdrop-blur-xl">
        <img
          src={currentImage}
          alt={alt || `Image ${currentIndex + 1} of ${images.length}`}
          className="block max-h-[80vh] max-w-[90vw] object-contain"
        />

        {hasPrev && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            aria-label="Next image"
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
          {actions}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-2 text-white/70">
        <span className="hidden text-xs sm:inline">← → to navigate · Esc to close</span>
        <span className="text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      {/* Close control pinned to the viewport corner, above the backdrop. */}
      <button
        type="button"
        aria-label="Close preview"
        onClick={requestClose}
        className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
      >
        <X size={20} />
      </button>
    </dialog>
  );
}
