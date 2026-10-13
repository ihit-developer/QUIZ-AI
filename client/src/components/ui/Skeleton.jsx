import React from 'react';

/**
 * Skeleton: Hardware-accelerated placeholder loading element with neutral shimmer.
 */
export const Skeleton = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-btn)',
  style = {},
  className = '',
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export const PageSkeletonLoader = () => {
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="220px" height="38px" />
        <Skeleton width="120px" height="38px" borderRadius="999px" />
      </div>
      <div className="card-solid" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Skeleton width="60%" height="32px" />
        <Skeleton width="40%" height="20px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
        </div>
      </div>
    </div>
  );
};
