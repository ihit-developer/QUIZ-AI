import React from 'react';
import { Check, X, AlertTriangle, Info, Sparkles } from 'lucide-react';

export const Badge = ({
  children,
  variant = 'primary', // primary, success, error, warning, info
  icon: CustomIcon,
  style = {},
  className = '',
}) => {
  const icons = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
    primary: Sparkles,
  };

  const DefaultIcon = icons[variant];
  const IconComponent = CustomIcon || DefaultIcon;

  const variantClass = {
    primary: 'badge-primary',
    success: 'badge-success',
    error: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
  }[variant] || 'badge-primary';

  return (
    <span className={`badge ${variantClass} ${className}`} style={style}>
      {IconComponent && <IconComponent size={12} />}
      <span>{children}</span>
    </span>
  );
};
