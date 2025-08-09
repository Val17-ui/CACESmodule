import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { logger } from './utils/logger';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>(undefined);
  const [activeSubPage, setActiveSubPage] = useState<string | undefined>(undefined);

  const handlePageChange = (page: string, details?: number | string) => {
    logger.info(`Navigation vers ${page}${details ? ` (Details: ${details})` : ''}`);
    setActivePage(page);

    if (page === 'sessions' && typeof details === 'number') {
      setCurrentSessionId(details);
      setActiveSubPage(undefined);
    } else if (page === 'settings' && typeof details === 'string') {
      setActiveSubPage(details);
      setCurrentSessionId(undefined);
    } else {
      setCurrentSessionId(undefined);
      setActiveSubPage(undefined);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard activePage={activePage} onPageChange={handlePageChange} />;
      
      case 'sessions':
        return <Sessions activePage={activePage} onPageChange={handlePageChange} sessionId={currentSessionId} />;

      case 'reports':
        return <Reports activePage={activePage} onPageChange={handlePageChange} />;
      case 'settings':
        return <Settings activePage={activePage} onPageChange={handlePageChange} activeTabId={activeSubPage} />;
      default:
        return <Dashboard activePage={activePage} onPageChange={handlePageChange} />;
    }
  };

  return (
    <div className="font-sans antialiased text-gray-900 bg-gray-50">
      {renderPage()}
    </div>
  );
}

export default App;