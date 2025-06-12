import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const Input = ({ label, type = 'text', placeholder, value, onChange, name, id, error, className = '', required = false, disabled = false, min, max, }) => {
    const inputId = id || name;
    return (_jsxs("div", { className: `mb-4 ${className}`, children: [label && (_jsxs("label", { htmlFor: inputId, className: "block text-sm font-medium text-gray-700 mb-1", children: [label, required && _jsx("span", { className: "text-red-500 ml-1", children: "*" })] })), _jsx("input", { type: type, name: name, id: inputId, value: value, onChange: onChange, placeholder: placeholder, className: `
          block w-full rounded-xl border-gray-300 shadow-sm
          focus:border-blue-500 focus:ring-blue-500 sm:text-sm
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
        `, required: required, disabled: disabled, min: min, max: max }), error && _jsx("p", { className: "mt-1 text-sm text-red-600", children: error })] }));
};
export default Input;
