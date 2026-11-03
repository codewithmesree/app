"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      {children}
    </motion.div>
  );
}
