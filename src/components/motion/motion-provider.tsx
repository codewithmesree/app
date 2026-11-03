"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Drops transform animations for users who prefer reduced motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
