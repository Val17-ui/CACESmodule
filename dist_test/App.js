import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Questionnaires from './pages/Questionnaires';
import Sessions from './pages/Sessions';
import Exams from './pages/Exams';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { logger } from './utils/logger';
function App() {
    const [activePage, setActivePage] = useState('dashboard');
    const handlePageChange = (page) => {
        logger.info(`Navigation vers ${page}`);
        setActivePage(page);
    };
    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return _jsx(Dashboard, { activePage: activePage, onPageChange: handlePageChange });
            case 'library':
                return _jsx(Library, { activePage: activePage, onPageChange: handlePageChange });
            case 'questionnaires':
                return _jsx(Questionnaires, { activePage: activePage, onPageChange: handlePageChange });
            case 'sessions':
                return _jsx(Sessions, { activePage: activePage, onPageChange: handlePageChange });
            case 'exams':
                return _jsx(Exams, { activePage: activePage, onPageChange: handlePageChange });
            case 'reports':
                return _jsx(Reports, { activePage: activePage, onPageChange: handlePageChange });
            case 'settings':
                return _jsx(Settings, { activePage: activePage, onPageChange: handlePageChange });
            default:
                return _jsx(Dashboard, { activePage: activePage, onPageChange: handlePageChange });
        }
    };
    return (_jsx("div", { className: "font-sans antialiased text-gray-900 bg-gray-50", children: renderPage() }));
}
export default App;
