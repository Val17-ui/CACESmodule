import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

type LayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
};

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  subtitle,
  actions,
  activePage,
  onPageChange,
}) => {
  return (
    <div className="flex h-screen bg-fond-clair-principal">
      <Sidebar activePage={activePage} onPageChange={onPageChange} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} actions={actions} />
        
        <main className="flex-1 overflow-y-auto p-6 text-texte-principal">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;