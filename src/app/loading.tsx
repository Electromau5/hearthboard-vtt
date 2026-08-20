'use client';

import { usePathname } from 'next/navigation';
import { LoadingOverlay } from './components/LoadingOverlay';

export default function Loading() {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return <LoadingOverlay />;
}
