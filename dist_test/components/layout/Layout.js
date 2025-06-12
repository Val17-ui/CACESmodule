import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Sidebar from './Sidebar';
import Header from './Header';
const Layout = ({ children, title, subtitle, actions, activePage, onPageChange, }) => {
    return (_jsxs("div", { className: "flex h-screen bg-gray-50", children: [_jsx(Sidebar, { activePage: activePage, onPageChange: onPageChange }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx(Header, { title: title, subtitle: subtitle, actions: actions }), _jsx("main", { className: "flex-1 overflow-y-auto p-6", children: children })] })] }));
};
export default Layout;
