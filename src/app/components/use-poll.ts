'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `poll` now and every `ms` after — but only while the tab is showing
 * and `active` holds, and at once whenever either comes back. Every poll is a
 * request against the shared Redis quota, so a hidden tab or a board covered
 * by a walkthrough spends nothing.
 *
 * `poll` may change between renders; the latest one is called.
 */
export function usePoll(poll: () => void, ms: number, active = true) {
  const pollRef = useRef(poll);
  useEffect(() => { pollRef.current = poll; });

  useEffect(() => {
    if (!active) return;
    const run = () => { if (!document.hidden) pollRef.current(); };
    run();
    const timer = window.setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', run); };
  }, [ms, active]);
}
