import React from 'react';

export const Tabs = ({ tabs = [], activeTab, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.4rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '2px',
        overflowX: 'auto',
      }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1.15rem',
              borderRadius: 'var(--radius-btn) var(--radius-btn) 0 0',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: isActive ? 'var(--primary-text)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'var(--surface-2)' : 'transparent',
              borderBottom: isActive ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {Icon && <Icon size={16} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--border)',
                  color: isActive ? 'var(--on-primary)' : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
