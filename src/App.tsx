import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';

// import Questionnaires from './pages/Questionnaires'; // Supprimé
import Sessions from './pages/Sessions';
// import Exams from './pages/Exams'; // Supprimé car la fonctionnalité Mode Examen est enlevée
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { logger } from './utils/logger';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>(undefined);

  const handlePageChange = (page: string, sessionId?: number) => {
    logger.info(`Navigation vers ${page}${sessionId ? ` (Session ID: ${sessionId})` : ''}`);
    setActivePage(page);
    setCurrentSessionId(sessionId);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard activePage={activePage} onPageChange={handlePageChange} />;
      
      // case 'questionnaires': // Supprimé
      //   return <Questionnaires activePage={activePage} onPageChange={handlePageChange} />; // Supprimé
      case 'sessions':
        // Passe currentSessionId au composant Sessions
        // Ce composant devra gérer l'affichage de la liste ou d'un détail basé sur la présence de cet ID
        return <Sessions activePage={activePage} onPageChange={handlePageChange} sessionId={currentSessionId} />;
      // case 'exams': // Supprimé car la fonctionnalité Mode Examen est enlevée
      //   return <Exams activePage={activePage} onPageChange={handlePageChange} />;
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