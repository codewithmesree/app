"use client";

import { useEffect, useRef } from "react";

type StepIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  /** Moves keyboard and screen reader users to the new step after Back or Continue. */
  focusOnMount?: boolean;
};

export function StepIntro({ eyebrow, title, description, focusOnMount = false }: StepIntroProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [focusOnMount]);

  return (
    <div>
      <p className="label-mono text-lavender">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[28px] font-semibold leading-tight tracking-tight outline-none sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-ink-muted">{description}</p>
    </div>
  );
}
