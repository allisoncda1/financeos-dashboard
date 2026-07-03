"use client";

/**
 * FinanceOS motion primitives — Framer Motion v12
 *
 * Philosophy: Stripe / Linear / Ramp feel.
 * - Fast (150–250ms), eased, never bouncy.
 * - All respect prefers-reduced-motion via useReducedMotion().
 * - Variants are defined once here; consumers just wrap.
 */

import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

// ─── Shared easing ────────────────────────────────────────────────────────────

export const ease = {
  standard: [0.16, 1, 0.3, 1] as [number, number, number, number],   // fast-in, slow-out
  out:      [0.0,  0, 0.2, 1] as [number, number, number, number],
  in:       [0.4,  0, 1,   1] as [number, number, number, number],
};

// ─── Page transition ──────────────────────────────────────────────────────────

export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="h-full flex flex-col"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: ease.standard }}
    >
      {children}
    </motion.div>
  );
}

// ─── Fade in ──────────────────────────────────────────────────────────────────

export function FadeIn({
  children,
  delay = 0,
  duration = 0.2,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Slide up (for cards, list items) ────────────────────────────────────────

export function SlideUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: ease.standard }}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger container ────────────────────────────────────────────────────────

const staggerVariants = {
  hidden: {},
  show: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.2, ease: ease.standard } },
};

// Reduced-motion version skips animation entirely
const staggerItemReduced = {
  hidden: { opacity: 1, y: 0 },
  show:   { opacity: 1, y: 0 },
};

export function StaggerContainer({
  children,
  stagger = 0.06,
  className,
  delay = 0,
}: {
  children: ReactNode;
  stagger?: number;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      custom={stagger}
      variants={staggerVariants}
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduced ? staggerItemReduced : staggerItemVariants}
    >
      {children}
    </motion.div>
  );
}

// ─── Motion card (hover lift + subtle shadow) ─────────────────────────────────

export function MotionCard({
  children,
  className,
  onClick,
  selected,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={reduced ? undefined : { y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      animate={selected ? { scale: 1 } : { scale: 1 }}
      transition={{ duration: 0.15, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated number (count-up) ──────────────────────────────────────────────

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 1.0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const motionVal = useMotionValue(reduced ? value : 0);
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(motionVal, value, {
      duration,
      ease: ease.standard,
      onUpdate: (v) => {
        if (displayRef.current) {
          displayRef.current.textContent = `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
        }
      },
    });
    return controls.stop;
  }, [value, duration, motionVal, prefix, suffix, reduced]);

  return (
    <span className={className} ref={displayRef}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function LoadingSkeleton({
  className = "h-4 rounded",
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className={`bg-gray-100 ${className}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
        />
      ))}
    </>
  );
}

// ─── Slide-in overlay (for panels, command bar) ───────────────────────────────

export function SlideInOverlay({
  show,
  children,
  direction = "up",
}: {
  show: boolean;
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right";
}) {
  const reduced = useReducedMotion();
  const axes: Record<string, { x?: number; y?: number }> = {
    up:    { y:  16 },
    down:  { y: -16 },
    left:  { x:  16 },
    right: { x: -16 },
  };
  const initial = reduced ? { opacity: 0 } : { opacity: 0, ...axes[direction] };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={initial}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={initial}
          transition={{ duration: 0.18, ease: ease.standard }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Toast / Success feedback ─────────────────────────────────────────────────

export function Toast({
  message,
  show,
  type = "success",
}: {
  message: string;
  show: boolean;
  type?: "success" | "info" | "warning";
}) {
  const reduced = useReducedMotion();
  const colors = {
    success: "bg-emerald-600 text-white",
    info:    "bg-gray-900 text-white",
    warning: "bg-amber-500 text-white",
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-semibold ${colors[type]}`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1,  y: 0,  scale: 1 }}
          exit={reduced    ? { opacity: 0 } : { opacity: 0, y: 8,  scale: 0.97 }}
          transition={{ duration: 0.2, ease: ease.standard }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Re-export AnimatePresence for convenience ────────────────────────────────
export { AnimatePresence, motion };
