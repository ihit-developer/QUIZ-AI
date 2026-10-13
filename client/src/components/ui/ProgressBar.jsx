import React from 'react';

export const ProgressBar = ({ progress = 0, height = 5 }) => {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: 'var(--surface-2)',
        borderRadius: 9999,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: 'var(--primary)',
          borderRadius: 9999,
          transition: 'width 0.25s ease-out',
        }}
      />
    </div>
  );
};
