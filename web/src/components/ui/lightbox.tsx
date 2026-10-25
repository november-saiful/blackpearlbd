import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, X } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  alt?: string;
  actions?: React.ReactNode;
}

type Point = { x: number; y: number };

type SingleGesture = {
  kind: 'single';
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: Point;
  startZoom: number;
  lastX: number;
  lastY: number;
  lastT: number;
  moved: boolean;
  axis: 'x' | 'y' | null;
  velocityX: number;
  /** Whether the gesture began on the photo; taps elsewhere dismiss the viewer. */
  startedOnImage: boolean;
};

type PinchGesture = {
  kind: 'pinch';
  startDistance: number;
  startZoom: number;
  startOffset: Point;
  startMid: Point;
};

type Gesture = SingleGesture | PinchGesture;

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 0.45;
const CLOSE_DISTANCE = 90;
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 320;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampZoom = (value: number) => clamp(value, 1, MAX_ZOOM);

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
 *
 * Gestures are pointer-driven rather than touch-only, so the same swipe, pinch
 * and drag code serves phones, trackpads and pens. The page's scroller is frozen
 * while the viewer is open: the dialog sits in the top layer, not inside the
 * scroll container, and wheel events would otherwise chain through to it.
 */
export function Lightbox({ images, currentIndex, isOpen, onClose, onNavigate, alt, actions }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const onNavigateRef = useRef(onNavigate);
  const imagesRef = useRef(images);

  const count = images.length;
  const safeIndex = count === 0 ? 0 : clamp(currentIndex, 0, count - 1);
  const currentImage = images[safeIndex];
  const countRef = useRef(count);
  const indexRef = useRef(safeIndex);

  onCloseRef.current = onClose;
  onNavigateRef.current = onNavigate;
  imagesRef.current = images;
  countRef.current = count;
  indexRef.current = safeIndex;

  const reduceMotion = useReducedMotion();
  const [direction, setDirection] = useState(0);
  const [zoom, setZoomState] = useState(1);
  const [offset, setOffsetState] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const zoomRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const tapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const wheelNavAtRef = useRef(0);
  const navTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const setZoom = useCallback((value: number) => {
    zoomRef.current = value;
    setZoomState(value);
  }, []);

  const setOffset = useCallback((value: Point) => {
    offsetRef.current = value;
    setOffsetState(value);
  }, []);

  const requestClose = useCallback(() => onCloseRef.current(), []);

  // Drive the native modal state from the `isOpen` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Already open elsewhere / not connected: fall back to an inline dialog.
        dialog.setAttribute('open', '');
      }
      // Start on the close control, not on the zoom group.
      closeButtonRef.current?.focus({ preventScroll: true });
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

  // Freeze the page scroller behind the top-layer dialog.
  useEffect(() => {
    if (!isOpen) return;
    const scroller = document.querySelector<HTMLElement>('[data-app-scroller]');
    if (!scroller) return;
    const previousOverflow = scroller.style.overflow;
    const previousOverscroll = scroller.style.overscrollBehavior;
    scroller.style.overflow = 'hidden';
    scroller.style.overscrollBehavior = 'contain';
    return () => {
      scroller.style.overflow = previousOverflow;
      scroller.style.overscrollBehavior = previousOverscroll;
    };
  }, [isOpen]);

  // Start every viewing session at 100%, and re-centre when the photo changes.
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    tapRef.current = null;
  }, [safeIndex, currentImage, isOpen, setOffset, setZoom]);

  // A cached photo can finish decoding before React attaches `onLoad`; adopt it
  // instead of leaving the spinner up for an image that is already on screen.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoadedSrc(currentImage);
  }, [safeIndex, currentImage]);

  // Warm the neighbours so a swipe shows the next photo instead of a spinner.
  useEffect(() => {
    if (!isOpen || count < 2) return;
    const list = imagesRef.current;
    const neighbours = [list[(safeIndex + 1) % count], list[(safeIndex - 1 + count) % count]];
    for (const src of neighbours) {
      if (!src) continue;
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = src;
    }
  }, [isOpen, safeIndex, count, currentImage]);

  useEffect(
    () => () => {
      if (navTimerRef.current !== null) window.clearTimeout(navTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const boundsFor = (value: Point, scale: number): Point => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image || scale <= 1) return { x: 0, y: 0 };
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2);
    return { x: clamp(value.x, -maxX, maxX), y: clamp(value.y, -maxY, maxY) };
  };

  const zoomTo = (targetZoom: number, point?: Point) => {
    const nextZoom = clampZoom(targetZoom);
    const currentZoom = zoomRef.current;
    if (Math.abs(nextZoom - currentZoom) < 0.001) return;

    let nextOffset = offsetRef.current;
    if (point && nextZoom > 1) {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) {
        // Keep the point under the fingers/pointer fixed while scaling:
        // t' = p - (newScale / oldScale) * (p - t), with p from the stage centre.
        const p = {
          x: point.x - (rect.left + rect.width / 2),
          y: point.y - (rect.top + rect.height / 2),
        };
        const ratio = nextZoom / currentZoom;
        nextOffset = {
          x: p.x - ratio * (p.x - offsetRef.current.x),
          y: p.y - ratio * (p.y - offsetRef.current.y),
        };
      }
    }
    if (nextZoom <= 1) nextOffset = { x: 0, y: 0 };

    setIsDragging(false);
    setZoom(nextZoom);
    setOffset(boundsFor(nextOffset, nextZoom));
  };

  const resetZoom = () => {
    setIsDragging(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const toggleZoomAt = (clientX: number, clientY: number) => {
    if (zoomRef.current > 1.01) {
      resetZoom();
    } else {
      zoomTo(DOUBLE_TAP_ZOOM, { x: clientX, y: clientY });
    }
  };

  const resetTransform = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const go = (step: 1 | -1, options?: { fromSwipe?: boolean }) => {
    const total = countRef.current;
    if (total < 2) return;
    setDirection(step);

    const navigate = () => {
      resetTransform();
      onNavigateRef.current((indexRef.current + step + total) % total);
    };

    if (navTimerRef.current !== null) window.clearTimeout(navTimerRef.current);
    if (!options?.fromSwipe) {
      navigate();
      return;
    }

    // Let the dragged photo continue off-screen before the next one appears.
    const width = stageRef.current?.clientWidth ?? window.innerWidth;
    setIsDragging(false);
    setOffset({ x: step > 0 ? -width : width, y: 0 });
    navTimerRef.current = window.setTimeout(navigate, reduceMotion ? 0 : 180);
  };

  const closeWithSlide = (distance: number) => {
    const height = stageRef.current?.clientHeight ?? window.innerHeight;
    setIsDragging(false);
    setOffset({ x: 0, y: Math.max(distance, height * 0.6) });
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), reduceMotion ? 0 : 180);
  };

  const apiRef = useRef({ go, requestClose, zoomTo, resetZoom });
  apiRef.current = { go, requestClose, zoomTo, resetZoom };

  // Capture-phase keyboard handling: keeps Radix's dialog from reacting to Esc
  // and gives the preview arrow-key navigation, zoom and reset.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const isHandled =
        key === 'Escape' || key === 'ArrowLeft' || key === 'ArrowRight' ||
        key === '+' || key === '=' || key === '-' || key === '_' || key === '0';
      if (!isHandled) return;

      // Stop it before it reaches the Radix dialog's document listener.
      event.stopPropagation();
      event.preventDefault();

      const api = apiRef.current;
      if (key === 'Escape') api.requestClose();
      else if (key === 'ArrowLeft') api.go(-1);
      else if (key === 'ArrowRight') api.go(1);
      else if (key === '+' || key === '=') api.zoomTo(zoomRef.current * 1.4);
      else if (key === '-' || key === '_') api.zoomTo(zoomRef.current / 1.4);
      else if (key === '0') api.resetZoom();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  // Wheel/trackpad support: ctrl/⌘ + wheel zooms, a plain wheel pages through.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        apiRef.current.zoomTo(zoomRef.current * Math.exp(-event.deltaY * 0.0025), {
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }

      // The viewer owns the gesture; without this a trackpad can scroll the
      // page under the modal while the photo stays put.
      event.preventDefault();
      if (zoomRef.current > 1.01 || countRef.current < 2) return;

      const now = performance.now();
      if (now - wheelNavAtRef.current < 420) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 16) return;
      wheelNavAtRef.current = now;
      apiRef.current.go(delta > 0 ? 1 : -1);
    };

    dialog.addEventListener('wheel', onWheel, { passive: false });
    return () => dialog.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        kind: 'single',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offsetRef.current,
        startZoom: zoomRef.current,
        lastX: event.clientX,
        lastY: event.clientY,
        lastT: performance.now(),
        moved: false,
        axis: null,
        velocityX: 0,
        startedOnImage: Boolean((event.target as HTMLElement).closest('[data-lightbox-image]')),
      };
      setIsDragging(true);
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const rect = stage.getBoundingClientRect();
      gestureRef.current = {
        kind: 'pinch',
        startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startZoom: zoomRef.current,
        startOffset: offsetRef.current,
        startMid: {
          x: (a.x + b.x) / 2 - (rect.left + rect.width / 2),
          y: (a.y + b.y) / 2 - (rect.top + rect.height / 2),
        },
      };
      setIsDragging(true);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const gesture = gestureRef.current;
    const stage = stageRef.current;
    if (!gesture || !stage) return;

    if (gesture.kind === 'pinch') {
      if (pointersRef.current.size < 2) return;
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const rect = stage.getBoundingClientRect();
      const mid = {
        x: (a.x + b.x) / 2 - (rect.left + rect.width / 2),
        y: (a.y + b.y) / 2 - (rect.top + rect.height / 2),
      };
      const nextZoom = clampZoom(gesture.startZoom * (distance / gesture.startDistance));
      const ratio = nextZoom / gesture.startZoom;
      const nextOffset =
        Math.abs(ratio - 1) < 0.001
          ? gesture.startOffset
          : {
              x: mid.x - ratio * (gesture.startMid.x - gesture.startOffset.x),
              y: mid.y - ratio * (gesture.startMid.y - gesture.startOffset.y),
            };

      setZoom(nextZoom);
      setOffset(nextZoom <= 1.001 ? { x: 0, y: 0 } : boundsFor(nextOffset, nextZoom));
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) > 5) gesture.moved = true;
    if (!gesture.axis && Math.hypot(dx, dy) > TAP_SLOP) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastT);
    gesture.velocityX = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    gesture.lastT = now;

    if (gesture.startZoom > 1 || zoomRef.current > 1) {
      setOffset(boundsFor({ x: gesture.startOffset.x + dx, y: gesture.startOffset.y + dy }, zoomRef.current));
    } else if (gesture.axis === 'x') {
      setOffset({ x: dx, y: 0 });
    } else if (gesture.axis === 'y') {
      setOffset({ x: 0, y: dy });
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
    setIsDragging(false);
    setOffset(boundsFor(offsetRef.current, zoomRef.current));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);

    if (!gesture) {
      setIsDragging(false);
      return;
    }

    if (gesture.kind === 'pinch') {
      if (pointersRef.current.size > 0) {
        // Continue as a pan with the finger that is still down.
        const [id, point] = Array.from(pointersRef.current.entries())[0];
        gestureRef.current = {
          kind: 'single',
          pointerId: id,
          startX: point.x,
          startY: point.y,
          startOffset: offsetRef.current,
          startZoom: zoomRef.current,
          lastX: point.x,
          lastY: point.y,
          lastT: performance.now(),
          moved: true,
          axis: null,
          velocityX: 0,
          startedOnImage: true,
        };
        return;
      }
      gestureRef.current = null;
      setIsDragging(false);
      if (zoomRef.current < 1.03) resetZoom();
      else setOffset(boundsFor(offsetRef.current, zoomRef.current));
      return;
    }

    if (gesture.pointerId !== event.pointerId) {
      if (pointersRef.current.size === 0) {
        gestureRef.current = null;
        setIsDragging(false);
      }
      return;
    }

    gestureRef.current = null;
    setIsDragging(false);

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.moved) {
      // The pointer target, not the later click: pointer capture retargets the
      // click to the stage, which would make every tap on the photo look like a
      // tap on the backdrop.
      if (!gesture.startedOnImage) {
        requestClose();
        return;
      }

      const now = performance.now();
      const lastTap = tapRef.current;
      if (
        lastTap &&
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24
      ) {
        tapRef.current = null;
        toggleZoomAt(event.clientX, event.clientY);
      } else {
        tapRef.current = { time: now, x: event.clientX, y: event.clientY };
      }
      return;
    }

    if (zoomRef.current > 1) {
      setOffset(boundsFor(offsetRef.current, zoomRef.current));
      return;
    }

    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (horizontal && (Math.abs(dx) > SWIPE_DISTANCE || Math.abs(gesture.velocityX) > SWIPE_VELOCITY)) {
      go(dx < 0 ? 1 : -1, { fromSwipe: true });
    } else if (!horizontal && dy > CLOSE_DISTANCE) {
      closeWithSlide(dy);
    } else {
      setOffset({ x: 0, y: 0 });
    }
  };

  if (images.length === 0) return null;

  const isLoaded = loadedSrc === currentImage;
  const hasFailed = failedSrc === currentImage;
  const canNavigate = count > 1;

  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: reduceMotion ? 0 : dir > 0 ? 48 : dir < 0 ? -48 : 0,
      scale: reduceMotion ? 1 : 0.985,
    }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({
      opacity: 0,
      x: reduceMotion ? 0 : dir > 0 ? -48 : dir < 0 ? 48 : 0,
      scale: reduceMotion ? 1 : 0.985,
    }),
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={alt || 'Image preview'}
      className="lightbox-dialog"
      style={{ pointerEvents: 'auto' }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-white/40 to-white/80 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${((safeIndex + 1) / count) * 100}%` }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="lightbox-glass pointer-events-auto flex items-center rounded-full p-0.5">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= 1.01}
            onClick={() => zoomTo(zoom / 1.4)}
            className="lightbox-icon-button"
          >
            <Minus size={17} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={resetZoom}
            className="lightbox-icon-button w-12 text-[0.7rem] font-semibold tabular-nums tracking-wide"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM - 0.01}
            onClick={() => zoomTo(zoom * 1.4)}
            className="lightbox-icon-button"
          >
            <Plus size={17} strokeWidth={2.4} />
          </button>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close preview"
          onClick={requestClose}
          className="lightbox-glass lightbox-icon-button pointer-events-auto h-11 w-11 shadow-lg md:h-12 md:w-12"
        >
          <X size={21} strokeWidth={2.2} />
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={cn(
          'lightbox-stage absolute inset-0 z-10 flex items-center justify-center px-3 pt-20 md:px-20 md:pt-20',
          actions ? 'pb-40 md:pb-32' : 'pb-28 md:pb-24',
          zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={`${safeIndex}:${currentImage}`}
            custom={direction}
            variants={slideVariants}
            initial={reduceMotion ? false : 'enter'}
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
            className="flex h-full w-full items-center justify-center"
          >
            <div
              className="will-change-transform"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                transition: isDragging || reduceMotion ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <img
                ref={imageRef}
                data-lightbox-image
                src={currentImage}
                alt={alt || `Image ${safeIndex + 1} of ${count}`}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                onLoad={() => {
                  setLoadedSrc(currentImage);
                  setFailedSrc(null);
                }}
                onError={() => setFailedSrc(currentImage)}
                className={cn(
                  'block max-w-full rounded-xl object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] transition-opacity duration-500 motion-reduce:transition-none md:rounded-2xl',
                  actions
                    ? 'max-h-[calc(100dvh-16rem)] md:max-h-[calc(100dvh-14rem)]'
                    : 'max-h-[calc(100dvh-13rem)] md:max-h-[calc(100dvh-12rem)]',
                  isLoaded ? 'opacity-100' : 'opacity-0',
                )}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {!isLoaded && !hasFailed && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="lightbox-glass flex h-16 w-16 items-center justify-center rounded-full">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          </div>
        )}

        {hasFailed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
            <div className="lightbox-glass rounded-2xl px-6 py-5 text-center text-sm text-white/70">
              This photo could not be loaded.
            </div>
          </div>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-5 left-5 z-20 hidden text-[0.68rem] font-medium tracking-wide text-white/45 lg:block"
      >
        ← → to browse · Esc to close
      </div>

      {(canNavigate || actions) && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pt-8"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {actions && <div className="pointer-events-auto flex items-center gap-2">{actions}</div>}

          {canNavigate && (
            <div className="lightbox-glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1">
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="lightbox-icon-button"
              >
                <ChevronLeft size={22} strokeWidth={2.2} />
              </button>
              <span
                aria-hidden
                className="min-w-[3.5rem] px-1 text-center text-xs font-semibold tabular-nums tracking-wide text-white/75"
              >
                {safeIndex + 1} / {count}
              </span>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="lightbox-icon-button"
              >
                <ChevronRight size={22} strokeWidth={2.2} />
              </button>
            </div>
          )}

          <span className="sr-only" aria-live="polite">
            Image {safeIndex + 1} of {count}
          </span>
        </div>
      )}
    </dialog>
  );
}
