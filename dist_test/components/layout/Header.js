import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bell, User } from 'lucide-react';
import Button from '../ui/Button';
const Header = ({ title, subtitle, actions }) => {
    return (_jsx("header", { className: "bg-white shadow-sm border-b border-gray-200", children: _jsxs("div", { className: "px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-gray-900", children: title }), subtitle && _jsx("p", { className: "mt-1 text-sm text-gray-500", children: subtitle })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [actions, _jsx("div", { className: "relative", children: _jsxs(Button, { variant: "ghost", className: "rounded-full p-2", children: [_jsx(Bell, { size: 20 }), _jsx("span", { className: "absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" })] }) }), _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mr-2", children: _jsx(User, { size: 16 }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Admin" })] })] })] }) }));
};
export default Header;
