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
    <Card hoverLift style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {(title || label || 'Statistic').toUpperCase()}
        </span>
        {Icon && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--surface-2) 100%)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-text)',
              boxShadow: '0 2px 6px rgba(225, 29, 72, 0.08)',
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div style={{ 
        fontSize: '2.25rem', 
        fontWeight: 900, 
        color: 'var(--text)', 
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>

      {(description || subtext || trend) && (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {trend && (
            <span style={{ 
              color: 'var(--primary-text)', 
              fontWeight: 800,
              backgroundColor: 'var(--primary-soft)',
              padding: '0.1rem 0.45rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.78rem',
            }}>
              {trend}
            </span>
          )}
          {(description || subtext) && <span>{description || subtext}</span>}
        </div>
      )}
    </Card>
  );
};

