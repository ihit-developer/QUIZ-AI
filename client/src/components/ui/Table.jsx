import React from 'react';

export const Table = ({ headers = [], children, className = '' }) => {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        backgroundColor: 'var(--surface)',
      }}
      className={className}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.9rem',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            {headers.map((h, idx) => (
              <th
                key={idx}
                style={{
                  padding: '0.85rem 1.25rem',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};

export const TableRow = ({ children, onClick, active = false }) => {
  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: active ? 'var(--primary-soft)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, style = {}, className = '' }) => {
  return (
    <td
      className={className}
      style={{
        padding: '0.85rem 1.25rem',
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {children}
    </td>
  );
};
