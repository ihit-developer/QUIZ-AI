import React from 'react';
import { Card } from './Card';

export const StatCard = ({
  title,
  label,
  value,
  description,
  subtext,
  icon: Icon,
  trend,
}) => {
  return (
    <Card hoverLift style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          {(title || label || 'Statistic').toUpperCase()}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-text)',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>

      {(description || subtext || trend) && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {trend && <span style={{ color: 'var(--primary-text)', fontWeight: 700 }}>{trend}</span>}
          {(description || subtext) && <span>{description || subtext}</span>}
        </div>
      )}
    </Card>
  );
};
