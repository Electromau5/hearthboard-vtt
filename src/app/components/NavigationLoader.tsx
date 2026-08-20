'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LoadingOverlay } from './LoadingOverlay';

export function NavigationLoader() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  const [visible, setVisible] = useState(true); // show on initial mount
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hide the initial-mount overlay once the app has hydrated
  useEffect(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // Intercept internal link clicks — show overlay immediately before Next.js navigates
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      // Skip external links, hash-only links, and download links
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto') || anchor.hasAttribute('download')) return;
      clearTimeout(hideTimer.current);
      setVisible(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Once the new pathname has settled, hide the overlay
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 250);
  }, [pathname]);

  if (!visible) return null;
  return <LoadingOverlay />;
}
