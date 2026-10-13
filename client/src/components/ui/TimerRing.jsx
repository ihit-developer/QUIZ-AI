import React from 'react';

export const TimerRing = ({
  secondsLeft = 30,
  totalSeconds = 30,
  size = 54,
  strokeWidth = 4,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(1, secondsLeft / (totalSeconds || 1)));
  const offset = circumference - percentage * circumference;

  const isLow = secondsLeft <= 5;
  const strokeColor = isLow ? 'var(--hero)' : 'var(--primary)';

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.2s ease' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: size <= 48 ? '0.75rem' : '0.92rem',
          fontWeight: 800,
          color: isLow ? 'var(--primary-text)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {secondsLeft}
      </span>
    </div>
  );
};
