import React from 'react';

type ButtonProps = {
  children?: React.ReactNode; // Make children optional
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; // Modifié pour accepter l'événement
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  onClick,
  disabled = false,
  type = 'button',
  title, // Added title to destructuring
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    primary: 'bg-accent-neutre hover:bg-accent-neutre-hover text-white focus:ring-accent-neutre',
    secondary: 'bg-gris-moyen hover:bg-gray-500 text-texte-principal focus:ring-gris-moyen', // Utilise gray-500 pour le hover pour l'instant
    success: 'bg-vert-validation hover:brightness-90 text-white focus:ring-vert-validation',
    danger: 'bg-rouge-accent hover:brightness-90 text-white focus:ring-rouge-accent',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500', // Laissé tel quel pour l'instant
    outline: 'border border-gris-moyen bg-fond-clair-principal hover:bg-gris-moyen/20 text-texte-principal focus:ring-accent-neutre',
    ghost: 'bg-transparent hover:bg-gris-moyen/20 text-texte-principal focus:ring-gris-moyen',
  };
  
  const sizeStyles = {
    sm: 'text-sm py-2 px-3',
    md: 'text-base py-2 px-4',
    lg: 'text-lg py-3 px-6',
  };
  
  const disabledStyles = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'cursor-pointer';
  
  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {/* Add margin to icon only if children are present */}
      {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;