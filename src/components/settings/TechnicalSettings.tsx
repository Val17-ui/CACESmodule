import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Save, CheckCircle } from 'lucide-react';
import { getAdminSetting, setAdminSetting } from '../../db';

interface TechnicalSettingsData {
  reportPrefix: string;
  pptxPrefix: string;
  backupFileName: string;
}

const TechnicalSettings: React.FC = () => {
  const [settings, setSettings] = useState<TechnicalSettingsData>({
    reportPrefix: 'Rapport_',
    pptxPrefix: 'Questionnaire_',
    backupFileName: 'CACES_Manager_Backup.json',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      const reportPrefix = await getAdminSetting('reportPrefix');
      const pptxPrefix = await getAdminSetting('pptxPrefix');
      const backupFileName = await getAdminSetting('backupFileName');

      setSettings({
        reportPrefix: reportPrefix || 'Rapport_',
        pptxPrefix: pptxPrefix || 'Questionnaire_',
        backupFileName: backupFileName || 'CACES_Manager_Backup.json',
      });
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await setAdminSetting('reportPrefix', settings.reportPrefix);
      await setAdminSetting('pptxPrefix', settings.pptxPrefix);
      await setAdminSetting('backupFileName', settings.backupFileName);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error("Failed to save technical settings", error);
      setSaveStatus('error');
    }
  };

  const handleChange = (key: keyof TechnicalSettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <p>Chargement des paramètres...</p>;
  }

  return (
    <Card title="Paramètres Techniques">
      <p className="text-sm text-gray-600 mb-6">Configurez les noms par défaut des fichiers exportés.</p>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Préfixe des rapports PDF</label>
          <Input
            value={settings.reportPrefix}
            onChange={e => handleChange('reportPrefix', e.target.value)}
            placeholder="Ex: Rapport_"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Préfixe des questionnaires PPTX</label>
          <Input
            value={settings.pptxPrefix}
            onChange={e => handleChange('pptxPrefix', e.target.value)}
            placeholder="Ex: Questionnaire_"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Nom du fichier de sauvegarde</label>
          <Input
            value={settings.backupFileName}
            onChange={e => handleChange('backupFileName', e.target.value)}
            placeholder="Ex: CACES_Manager_Backup.json"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end items-center">
        {saveStatus === 'success' && (
          <div className="flex items-center text-green-600 mr-4">
            <CheckCircle size={16} className="mr-1" />
            <span className="text-sm font-medium">Paramètres enregistrés !</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={saveStatus === 'saving'}>
          <Save size={16} className="mr-2" />
          {saveStatus === 'saving' ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
      {saveStatus === 'error' && <p className="text-red-500 text-sm mt-2 text-right">Erreur lors de la sauvegarde.</p>}
    </Card>
  );
};

export default TechnicalSettings;
