import React from 'react';
import { PlusCircle, FilePlus, FileSpreadsheet, Download } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

type ActionItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

const ActionItem: React.FC<ActionItemProps> = ({
  icon,
  title,
  description,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="flex items-start p-4 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
    >
      <div className="mr-4 p-2 rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </button>
  );
};

const QuickActions: React.FC = () => {
  const actions = [
    {
      icon: <PlusCircle size={20} />,
      title: 'Nouvelle session',
      description: 'Planifier une nouvelle session CACES',
      onClick: () => console.log('New session clicked'),
    },
    {
      icon: <FilePlus size={20} />,
      title: 'Créer questionnaire',
      description: 'Créer ou modifier un questionnaire',
      onClick: () => console.log('Create questionnaire clicked'),
    },
    {
      icon: <FileSpreadsheet size={20} />,
      title: 'Démarrer examen',
      description: 'Lancer une session d\'examen',
      onClick: () => console.log('Start exam clicked'),
    },
    {
      icon: <Download size={20} />,
      title: 'Exporter rapport',
      description: 'Générer un rapport d\'activité',
      onClick: () => console.log('Export report clicked'),
    },
  ];

  return (
    <Card title="Actions rapides" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {actions.map((action, index) => (
          <ActionItem
            key={index}
            icon={action.icon}
            title={action.title}
            description={action.description}
            onClick={action.onClick}
          />
        ))}
      </div>
    </Card>
  );
};

export default QuickActions;