import React from 'react';

type CardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

const Card: React.FC<CardProps> = ({ title, children, className = '', onClick }) => { // Added onClick to destructuring
  return (
    <div className={`bg-white rounded-2xl shadow-md overflow-hidden ${className}`} onClick={onClick}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default Card;