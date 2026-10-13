import React from 'react';

/**
 * Universal Button Component
 * Variants: primary, secondary, outline, ghost, danger
 * Hardware-accelerated hover & press scaling
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  icon: Icon,
  style = {},
  ...props
}) => {
  const sizeStyles = {
    sm: { padding: '0.45rem 0.9rem', fontSize: '0.8rem', minHeight: '36px' },
    md: { padding: '0.7rem 1.4rem', fontSize: '0.92rem', minHeight: '44px' },
    lg: { padding: '0.9rem 1.85rem', fontSize: '1.05rem', minHeight: '50px' },
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-secondary',
    danger: 'btn-danger',
    ghost: '',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${variantClasses[variant] || 'btn-primary'} ${className}`}
      style={{
        ...sizeStyles[size],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      {children}
    </button>
  );
};
