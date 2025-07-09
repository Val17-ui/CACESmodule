import React, { ReactNode } from 'react';

type InputProps = {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  defaultValue?: string | number; // Ajout de defaultValue
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  id?: string;
  error?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  autoFocus?: boolean;
  accept?: string; // Ajout de la prop accept
};

const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  placeholder,
  value,
  defaultValue, // Déstructurer defaultValue
  onChange,
  name,
  id,
  error,
  className = '',
  required = false,
  disabled = false,
  min,
  max,
  icon,
  iconPosition = 'left',
  autoFocus = false,
  accept, // Ajout de accept aux props déstructurées
}) => {
  const inputId = id || name;

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-texte-principal mb-1"
        >
          {label}
          {required && <span className="text-rouge-accent ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && iconPosition === 'left' && (
          <span className="absolute left-3 inset-y-0 flex items-center justify-center">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          id={inputId}
          value={value}
          defaultValue={defaultValue} // Utiliser defaultValue ici
          onChange={onChange}
          placeholder={placeholder}
          className={`
            block w-full rounded-xl border-gris-moyen shadow-sm
            focus:border-accent-neutre focus:ring-accent-neutre sm:text-sm
            ${error ? 'border-rouge-accent' : 'border-gris-moyen'}
            ${disabled ? 'bg-gris-moyen/30 text-texte-principal/70 cursor-not-allowed' : ''}
            ${icon && iconPosition === 'left' ? 'pl-10' : ''}
            ${icon && iconPosition === 'right' ? 'pr-10' : ''}
          `}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          autoFocus={autoFocus}
          accept={accept} // Utilisation de la prop accept
        />
        {icon && iconPosition === 'right' && (
          <span className="absolute right-3 inset-y-0 flex items-center justify-center">
            {icon}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-rouge-accent">{error}</p>}
    </div>
  );
};

export default Input;