'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import { LoadingOverlay } from './LoadingOverlay';

// One full GIF cycle = 46 frames × 70 ms = 3 220 ms. Add a small buffer.
const CYCLE_MS = 3300;

export function NavigationLoader() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shownAt = useRef<number>(Date.now());

  // Schedule hide so that at least one full animation cycle has played
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, CYCLE_MS - elapsed);
    hideTimer.current = setTimeout(() => setVisible(false), wait);
  }, []);

  // Initial mount — only show on the homepage
  useEffect(() => {
    if (pathname !== '/') {
      setVisible(false);
      return;
    }
    shownAt.current = Date.now();
    scheduleHide();
    return () => clearTimeout(hideTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intercept link clicks — only show overlay when navigating to the homepage
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href !== '/') return;
      clearTimeout(hideTimer.current);
      shownAt.current = Date.now();
      setVisible(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Once pathname settles on '/', wait out the remaining cycle time; otherwise hide immediately
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (pathname === '/') {
      scheduleHide();
    } else {
      clearTimeout(hideTimer.current);
      setVisible(false);
    }
  }, [pathname, scheduleHide]);

  if (!visible) return null;
  return <LoadingOverlay />;
}
