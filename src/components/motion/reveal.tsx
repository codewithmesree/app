"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Position within the page; capped by callers to keep entrances short. */
  order?: number;
};

/** Short fade and rise for a card on first entry (designs.md section 6). */
export function Reveal({ children, className, order = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: order * 0.04, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
