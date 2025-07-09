import React from 'react';

type CardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

const Card: React.FC<CardProps> = ({ title, children, className = '', onClick }) => { // Added onClick to destructuring
  return (
    <div className={`bg-fond-clair-principal rounded-2xl shadow-md overflow-hidden ${className}`} onClick={onClick}>
      {title && (
        <div className="px-6 py-4 border-b border-gris-moyen/50">
          <h3 className="text-lg font-medium text-texte-principal">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default Card;