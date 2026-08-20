'use client';

export function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      animation: 'loaderFadeIn 0.15s ease',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt="Loading…"
        style={{
          width: 140,
          height: 140,
          filter: 'invert(1)',
          opacity: 0.9,
        }}
      />
      <style>{`
        @keyframes loaderFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
