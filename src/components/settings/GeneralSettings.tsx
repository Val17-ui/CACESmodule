import React, { useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';

const GeneralSettings: React.FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('fr');
  const [autoSaveInterval, setAutoSaveInterval] = useState(5);
  const [logLevel, setLogLevel] = useState('INFO');

  const languageOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ];

  const logLevelOptions = [
    { value: 'ERROR', label: 'Erreurs uniquement' },
    { value: 'WARNING', label: 'Avertissements et erreurs' },
    { value: 'INFO', label: 'Informations, avertissements et erreurs' },
    { value: 'SUCCESS', label: 'Tous les événements' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de l'organisation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nom de l'organisation"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Ex: Centre de Formation CACES"
          />
          
          <Select
            label="Langue par défaut"
            options={languageOptions}
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Préférences de l'application</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Intervalle de sauvegarde automatique (minutes)"
            type="number"
            value={autoSaveInterval}
            onChange={(e) => setAutoSaveInterval(parseInt(e.target.value) || 5)}
            min={1}
            max={60}
          />
          
          <Select
            label="Niveau de journalisation"
            options={logLevelOptions}
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Conformité CACES</h3>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Exigences réglementaires
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Conservation des rapports : 5 ans minimum</li>
            <li>• Traçabilité complète des examens</li>
            <li>• Respect des recommandations Cnam</li>
            <li>• Archivage automatique des données</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;