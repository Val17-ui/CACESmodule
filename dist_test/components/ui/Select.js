import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const Select = ({ label, options, value, onChange, name, id, error, className = '', required = false, disabled = false, placeholder, }) => {
    const selectId = id || name;
    return (_jsxs("div", { className: `mb-4 ${className}`, children: [label && (_jsxs("label", { htmlFor: selectId, className: "block text-sm font-medium text-gray-700 mb-1", children: [label, required && _jsx("span", { className: "text-red-500 ml-1", children: "*" })] })), _jsxs("select", { name: name, id: selectId, value: value, onChange: onChange, className: `
          block w-full rounded-xl border-gray-300 shadow-sm
          focus:border-blue-500 focus:ring-blue-500 sm:text-sm
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
        `, required: required, disabled: disabled, children: [placeholder && (_jsx("option", { value: "", disabled: true, children: placeholder })), options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value)))] }), error && _jsx("p", { className: "mt-1 text-sm text-red-600", children: error })] }));
};
export default Select;
