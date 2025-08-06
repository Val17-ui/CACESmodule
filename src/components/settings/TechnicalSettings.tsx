import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Save, CheckCircle } from 'lucide-react';
import { StorageManager } from '../../services/StorageManager';

interface TechnicalSettingsData {
  reportPrefix: string;
  pptxPrefix: string;
  backupFileName: string;
  orsSavePath: string;
  reportSavePath: string;
  imagesFolderPath: string;
}

const TechnicalSettings: React.FC = () => {
  const [settings, setSettings] = useState<TechnicalSettingsData>({
    reportPrefix: 'Rapport_',
    pptxPrefix: 'Questionnaire_',
    backupFileName: 'CACES_Manager_Backup.json',
    orsSavePath: '',
    reportSavePath: '',
    imagesFolderPath: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      const reportPrefix = await StorageManager.getAdminSetting('reportPrefix');
      const pptxPrefix = await StorageManager.getAdminSetting('pptxPrefix');
      const backupFileName = await StorageManager.getAdminSetting('backupFileName');
      const orsSavePath = await StorageManager.getAdminSetting('orsSavePath');
      const reportSavePath = await StorageManager.getAdminSetting('reportSavePath');
      const imagesFolderPath = await StorageManager.getAdminSetting('imagesFolderPath');

      setSettings({
        reportPrefix: reportPrefix || 'Rapport_',
        pptxPrefix: pptxPrefix || 'Questionnaire_',
        backupFileName: backupFileName || 'CACES_Manager_Backup.json',
        orsSavePath: orsSavePath || '',
        reportSavePath: reportSavePath || '',
        imagesFolderPath: imagesFolderPath || '',
      });
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await StorageManager.setAdminSetting('reportPrefix', settings.reportPrefix);
      await StorageManager.setAdminSetting('pptxPrefix', settings.pptxPrefix);
      await StorageManager.setAdminSetting('backupFileName', settings.backupFileName);
      await StorageManager.setAdminSetting('orsSavePath', settings.orsSavePath);
      await StorageManager.setAdminSetting('reportSavePath', settings.reportSavePath);
      await StorageManager.setAdminSetting('imagesFolderPath', settings.imagesFolderPath);
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

  const handleBrowseOrsSavePath = async () => {
    if (!window.dbAPI) {
      console.error("dbAPI not available");
      return;
    }
    try {
      const result = await window.dbAPI.openDirectoryDialog();
      if (!result.canceled && result.path) {
        handleChange('orsSavePath', result.path);
      }
    } catch (error) {
      console.error("Error opening directory dialog:", error);
      // Optionally, set an error state in the UI
    }
  };

  const handleBrowseReportSavePath = async () => {
    if (!window.dbAPI) {
      console.error("dbAPI not available");
      return;
    }
    try {
      const result = await window.dbAPI.openDirectoryDialog();
      if (!result.canceled && result.path) {
        handleChange('reportSavePath', result.path);
      }
    } catch (error) {
      console.error("Error opening directory dialog:", error);
    }
  };

  const handleBrowseImagesFolderPath = async () => {
    if (!window.dbAPI) {
      console.error("dbAPI not available");
      return;
    }
    try {
      const result = await window.dbAPI.openDirectoryDialog();
      if (!result.canceled && result.path) {
        handleChange('imagesFolderPath', result.path);
      }
    } catch (error) {
      console.error("Error opening directory dialog:", error);
    }
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Dossier de sauvegarde des ORS</label>
          <div className="flex items-center gap-2">
            <Input
              value={settings.orsSavePath}
              onChange={e => handleChange('orsSavePath', e.target.value)}
              placeholder="Ex: C:/Users/VotreNom/Documents/ORS"
              readOnly // User selects via dialog, not types freely
            />
            <Button onClick={handleBrowseOrsSavePath} type="button">
              Parcourir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Dossier de sauvegarde des Rapports</label>
          <div className="flex items-center gap-2">
            <Input
              value={settings.reportSavePath}
              onChange={e => handleChange('reportSavePath', e.target.value)}
              placeholder="Ex: C:/Users/VotreNom/Documents/Rapports"
              readOnly
            />
            <Button onClick={handleBrowseReportSavePath} type="button">
              Parcourir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Dossier des images pour questionnaires</label>
          <div className="flex items-center gap-2">
            <Input
              value={settings.imagesFolderPath}
              onChange={e => handleChange('imagesFolderPath', e.target.value)}
              placeholder="Ex: C:/Users/VotreNom/Documents/Images_CACES"
              readOnly
            />
            <Button onClick={handleBrowseImagesFolderPath} type="button">
              Parcourir
            </Button>
          </div>
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
