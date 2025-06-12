import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const Card = ({ title, children, className = '' }) => {
    return (_jsxs("div", { className: `bg-white rounded-2xl shadow-md overflow-hidden ${className}`, children: [title && (_jsx("div", { className: "px-6 py-4 border-b border-gray-100", children: _jsx("h3", { className: "text-lg font-medium text-gray-900", children: title }) })), _jsx("div", { className: "p-6", children: children })] }));
};
export default Card;
