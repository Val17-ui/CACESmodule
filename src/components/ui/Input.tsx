import React, { ReactNode } from "react";
type InputProps = {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
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
  iconPosition?: "left" | "right";
};

const Input: React.FC<InputProps> = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  id,
  error,
  className = "",
  required = false,
  disabled = false,
  min,
  max,
  icon,
  iconPosition = "left",
}) => {
  const inputId = id || name;

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && iconPosition === "left" && (
          <span className="absolute left-3 inset-y-0 flex items-center justify-center">
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          id={inputId}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            block w-full rounded-xl border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500 sm:text-sm
            ${error ? "border-red-300" : "border-gray-300"}
            ${disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
            ${icon && iconPosition === "left" ? "pl-10" : ""}
            ${icon && iconPosition === "right" ? "pr-10" : ""}
          `}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
        />
        {icon && iconPosition === "right" && (
          <span className="absolute right-3 inset-y-0 flex items-center justify-center">
            {icon}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
