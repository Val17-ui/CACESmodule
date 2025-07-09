import React from 'react';

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="bg-fond-clair-principal shadow-sm border-b border-gris-moyen/50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texte-principal">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-texte-principal/80">{subtitle}</p>}
        </div>
        
        <div className="flex items-center space-x-4">
          {actions}
          
          {/* <div className="relative">
            <Button variant="ghost" className="rounded-full p-2">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
          </div> */}
          
          {/* <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mr-2">
              <User size={16} />
            </div>
            <span className="text-sm font-medium text-gray-700">Admin</span>
          </div> */}
        </div>
      </div>
    </header>
  );
};

export default Header;