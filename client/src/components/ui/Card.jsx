import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({
  children,
  className = '',
  style = {},
  hoverLift = false,
  onClick,
  ...props
}) => {
  const Component = hoverLift ? motion.div : 'div';
  const motionProps = hoverLift
    ? {
        whileHover: { y: -2 },
        transition: { duration: 0.18, ease: 'easeOut' },
      }
    : {};

  return (
    <Component
      onClick={onClick}
      className={`card-solid ${className}`}
      style={{
        padding: '1.5rem',
        ...style,
      }}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
};
