"use client";
import {
  useScroll,
  useTransform,
  useInView,
  motion,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TimelineTheme {
  line: string;       // gradient colors for the draw-on line
  pin: string;        // active pin color
  pinBorder: string;  // pin border color
  sidebarActive: string; // sidebar active indicator
}

export const THEMES: Record<string, TimelineTheme> = {
  ocean: {
    line: "from-cyan-500 via-blue-500 to-transparent",
    pin: "rgb(6, 182, 212)",
    pinBorder: "rgb(103, 232, 249)",
    sidebarActive: "rgb(6, 182, 212)",
  },
  sunset: {
    line: "from-orange-500 via-rose-500 to-transparent",
    pin: "rgb(249, 115, 22)",
    pinBorder: "rgb(253, 186, 116)",
    sidebarActive: "rgb(249, 115, 22)",
  },
  forest: {
    line: "from-emerald-500 via-teal-500 to-transparent",
    pin: "rgb(16, 185, 129)",
    pinBorder: "rgb(52, 211, 153)",
    sidebarActive: "rgb(16, 185, 129)",
  },
  royal: {
    line: "from-purple-500 via-indigo-500 to-transparent",
    pin: "rgb(139, 92, 246)",
    pinBorder: "rgb(167, 139, 250)",
    sidebarActive: "rgb(139, 92, 246)",
  },
  cherry: {
    line: "from-pink-500 via-rose-500 to-transparent",
    pin: "rgb(236, 72, 153)",
    pinBorder: "rgb(244, 114, 182)",
    sidebarActive: "rgb(236, 72, 153)",
  },
  amber: {
    line: "from-amber-500 via-yellow-500 to-transparent",
    pin: "rgb(245, 158, 11)",
    pinBorder: "rgb(252, 211, 77)",
    sidebarActive: "rgb(245, 158, 11)",
  },
};

export const DEFAULT_THEME: TimelineTheme = THEMES.ocean;

// Hash a string to a consistent index for theme selection
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getThemeForDeal(dealTitle: string, destination: string): TimelineTheme {
  const themeKeys = Object.keys(THEMES);
  const combined = `${dealTitle}-${destination}`;
  const index = hashString(combined) % themeKeys.length;
  return THEMES[themeKeys[index]];
}

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

const AnimatedEntry = ({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-20% 0px -20% 0px", once: false });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30, filter: "blur(4px)" }}
      animate={
        isInView
          ? { opacity: 1, x: 0, filter: "blur(0px)" }
          : { opacity: 0, x: -30, filter: "blur(4px)" }
      }
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.05 }}
    >
      {children}
    </motion.div>
  );
};

export const Timeline = ({ data, theme = DEFAULT_THEME, className, hideHeader }: { data: TimelineEntry[]; theme?: TimelineTheme; className?: string; hideHeader?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  // Track which timeline entry is currently in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    entryRefs.current.forEach((entry, index) => {
      if (!entry) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((observedEntry) => {
            if (observedEntry.isIntersecting) {
              setActiveIndex(index);
            }
          });
        },
        {
          rootMargin: "-40% 0px -40% 0px",
          threshold: 0,
        }
      );

      observer.observe(entry);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [data.length]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div
      className={cn("w-full bg-white dark:bg-neutral-950 font-sans md:px-10 lg:px-0", className)}
      ref={containerRef}
    >
      {/*
        Nested inside the deal page's site-container, so from lg up it drops all
        of its own horizontal padding: the root's md:px-10 and this block's
        px-4/md:px-8/lg:px-10 stacked to put the heading 112px in while the
        timeline body sat at 72px and the page's own cards at 32px — three
        different lines. Below lg the original paddings are untouched.
      */}
      {!hideHeader && (
        <div className="py-12 px-4 md:px-8 lg:px-0">
          <h2 className="text-2xl font-semibold leading-none tracking-tight mb-4 text-black dark:text-white max-w-4xl">
            Itinerary
          </h2>
          <p className="text-neutral-700 dark:text-neutral-300 text-sm md:text-base max-w-sm">
            Follow the phases of this tour, in order.
          </p>
        </div>
      )}

      <div ref={ref} className="relative pb-20">
        {/* Sticky phase counter sidebar */}
        <div className="hidden lg:block fixed right-2 top-1/2 -translate-y-1/2 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-4 min-w-[80px]">
            <div className="text-center">
              <motion.div
                key={activeIndex}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-4xl font-bold text-neutral-900 dark:text-white"
              >
                {activeIndex + 1}
              </motion.div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                of {data.length}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {data.map((_, index) => (
                <motion.div
                  key={index}
                  className="h-1.5 rounded-full cursor-pointer transition-colors"
                  animate={{
                    backgroundColor:
                      index === activeIndex
                        ? theme.sidebarActive
                        : index < activeIndex
                        ? "rgb(156, 163, 175)"
                        : "rgb(229, 231, 235)",
                  }}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => {
                    entryRefs.current[index]?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {data.map((item, index) => (
          <div
            key={index}
            ref={(el) => { entryRefs.current[index] = el; }}
            className="flex justify-start pt-10 md:pt-20 md:gap-10"
          >
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-20 md:top-28 self-start max-w-xs lg:max-w-sm md:w-full">
              <motion.div
                className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-white dark:bg-black flex items-center justify-center"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ margin: "-30% 0px -30% 0px", once: false }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              >
                <motion.div
                  className="h-4 w-4 rounded-full bg-neutral-200 dark:bg-neutral-800 p-2"
                  style={{ borderColor: theme.pinBorder }}
                  animate={
                    index === activeIndex
                      ? { scale: [1, 1.3, 1], backgroundColor: theme.pin, borderColor: theme.pinBorder }
                      : { scale: 1, borderColor: theme.pinBorder }
                  }
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
              <h3 className="hidden md:block text-lg md:pl-20 md:text-2xl font-bold text-neutral-500 dark:text-neutral-500 ">
                {item.title}
              </h3>
            </div>

            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              <h3 className="md:hidden block text-lg mb-4 text-left font-bold text-neutral-500 dark:text-neutral-500">
                {item.title}
              </h3>
              <AnimatedEntry index={index}>{item.content}</AnimatedEntry>
            </div>
          </div>
        ))}
        <div
          style={{
            height: height + "px",
          }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-neutral-200 dark:via-neutral-700 to-transparent to-[99%]  [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] "
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className={`absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t ${theme.line} from-[0%] via-[10%] rounded-full`}
          />
        </div>
      </div>
    </div>
  );
};
