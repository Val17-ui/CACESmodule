import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const Button = ({ children, variant = 'primary', size = 'md', className = '', icon, onClick, disabled = false, type = 'button', }) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
    const variantStyles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
        success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
        warning: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500',
        outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-blue-500',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-500',
    };
    const sizeStyles = {
        sm: 'text-sm py-2 px-3',
        md: 'text-base py-2 px-4',
        lg: 'text-lg py-3 px-6',
    };
    const disabledStyles = disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer';
    return (_jsxs("button", { type: type, className: `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`, onClick: onClick, disabled: disabled, children: [icon && _jsx("span", { className: "mr-2", children: icon }), children] }));
};
export default Button;
