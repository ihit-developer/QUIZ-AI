import React from 'react';
import { Check } from 'lucide-react';

export const Stepper = ({ steps = [], currentStep = 1, onStepClick }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.75rem',
        overflowX: 'auto',
        gap: '1rem',
      }}
    >
      {steps.map((step, idx) => {
        const isDone = currentStep > step.num;
        const isActive = currentStep === step.num;
        const Icon = step.icon;

        return (
          <div
            key={step.num}
            onClick={() => onStepClick && onStepClick(step.num)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: onStepClick ? 'pointer' : 'default',
              opacity: isActive || isDone ? 1 : 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive
                  ? 'var(--primary)'
                  : isDone
                  ? 'var(--hero)'
                  : 'var(--surface-2)',
                color: isActive || isDone ? 'var(--on-primary)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
                transition: 'background-color 0.15s ease',
              }}
            >
              {isDone ? <Check size={16} /> : step.num}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: isActive ? 'var(--primary-text)' : 'var(--text)',
                }}
              >
                {step.label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                style={{
                  width: '30px',
                  height: '2px',
                  backgroundColor: isDone ? 'var(--primary)' : 'var(--border)',
                  marginLeft: '0.5rem',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
