import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  // Allows any other standard input props like name, value, disabled, etc.
}

const Checkbox: React.FC<CheckboxProps> = ({ id, label, className, ...props }) => {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        id={id}
        {...props}
        className={`h-4 w-4 text-accent-neutre border-gris-moyen rounded focus:ring-accent-neutre ${className || ''}`}
      />
      {label && (
        <label htmlFor={id} className="ml-2 block text-sm text-texte-principal">
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
