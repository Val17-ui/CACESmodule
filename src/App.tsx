import React, { useState } from 'react';
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

  const handlePageChange = (page: string) => {
    logger.info(`Navigation vers ${page}`);
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard activePage={activePage} onPageChange={handlePageChange} />;
      case 'library':
        return <Library activePage={activePage} onPageChange={handlePageChange} />;
      case 'questionnaires':
        return <Questionnaires activePage={activePage} onPageChange={handlePageChange} />;
      case 'sessions':
        return <Sessions activePage={activePage} onPageChange={handlePageChange} />;
      case 'exams':
        return <Exams activePage={activePage} onPageChange={handlePageChange} />;
      case 'reports':
        return <Reports activePage={activePage} onPageChange={handlePageChange} />;
      case 'settings':
        return <Settings activePage={activePage} onPageChange={handlePageChange} />;
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