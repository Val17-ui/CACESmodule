import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  className = '' 
}) => {
  const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  
  const variantStyles = {
    default: 'bg-gris-moyen/30 text-texte-principal',
    primary: 'bg-accent-neutre/20 text-accent-neutre',
    success: 'bg-vert-validation/20 text-vert-validation',
    warning: 'bg-amber-100 text-amber-800', // Laissé tel quel pour l'instant
    danger: 'bg-rouge-accent/20 text-rouge-accent',
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;