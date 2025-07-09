import React from 'react';

type Option = {
  value: string;
  label: string;
};

type SelectProps = {
  label?: string;
  options: Option[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  id?: string;
  error?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  name,
  id,
  error,
  className = '',
  required = false,
  disabled = false,
  placeholder,
}) => {
  const selectId = id || name;
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-texte-principal mb-1"
        >
          {label}
          {required && <span className="text-rouge-accent ml-1">*</span>}
        </label>
      )}
      <select
        name={name}
        id={selectId}
        value={value}
        onChange={onChange}
        className={`
          block w-full rounded-xl border-gris-moyen shadow-sm
          focus:border-accent-neutre focus:ring-accent-neutre sm:text-sm
          ${error ? 'border-rouge-accent' : 'border-gris-moyen'}
          ${disabled ? 'bg-gris-moyen/30 text-texte-principal/70 cursor-not-allowed' : ''}
        `}
        required={required}
        disabled={disabled}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-rouge-accent">{error}</p>}
    </div>
  );
};

export default Select;