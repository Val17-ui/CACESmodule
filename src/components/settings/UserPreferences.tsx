import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Save } from 'lucide-react'; // Supprimé Info car non utilisé
import { getAdminSetting, setAdminSetting } from '../../db';

// Définition des types pour les préférences
interface UserPreferencesData {
  pollStartMode: 'Automatic' | 'Manual';
  answersBulletStyle: 'ppBulletAlphaUCParenRight' | 'ppBulletAlphaUCPeriod' | 'ppBulletArabicParenRight' | 'ppBulletArabicPeriod';
  pollTimeLimit: number;
  pollCountdownStartMode: 'Automatic' | 'Manual';
}

const UserPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferencesData>({
    pollStartMode: 'Automatic',
    answersBulletStyle: 'ppBulletArabicPeriod',
    pollTimeLimit: 0,
    pollCountdownStartMode: 'Automatic',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Charger les préférences au montage
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      const pollStartMode = await getAdminSetting('pollStartMode');
      const answersBulletStyle = await getAdminSetting('answersBulletStyle');
      const pollTimeLimit = await getAdminSetting('pollTimeLimit');
      const pollCountdownStartMode = await getAdminSetting('pollCountdownStartMode');

      setPreferences({
        pollStartMode: pollStartMode || 'Automatic',
        answersBulletStyle: answersBulletStyle || 'ppBulletArabicPeriod',
        pollTimeLimit: pollTimeLimit !== undefined ? pollTimeLimit : 30,
        pollCountdownStartMode: pollCountdownStartMode || 'Automatic',
      });
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await setAdminSetting('pollStartMode', preferences.pollStartMode);
      await setAdminSetting('answersBulletStyle', preferences.answersBulletStyle);
      await setAdminSetting('pollTimeLimit', preferences.pollTimeLimit);
      await setAdminSetting('pollCountdownStartMode', preferences.pollCountdownStartMode);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000); // Reset status after 2s
    } catch (error) {
      console.error("Failed to save preferences", error);
      setSaveStatus('error');
    }
  };

  const handleChange = (key: keyof UserPreferencesData, value: string | number) => {
    setPreferences((prev: UserPreferencesData) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <p>Chargement des préférences...</p>;
  }

  return (
    <Card title="Préférences Utilisateur">
      <p className="text-sm text-gray-600 mb-6">Ces paramètres affectent la génération des questionnaires .pptx et .ors.</p>
      <div className="space-y-6">
        {/* Ouverture du vote */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Ouverture du vote</label>
          <Select
            options={[
              { value: 'Automatic', label: 'Automatique' },
              { value: 'Manual', label: 'Manuel' },
            ]}
            value={preferences.pollStartMode}
            onChange={e => handleChange('pollStartMode', e.target.value)}
          />
        </div>

        {/* Style des réponses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Style des réponses</label>
          <Select
            options={[
              { value: 'ppBulletAlphaUCParenRight', label: 'A) B) C)' },
              { value: 'ppBulletAlphaUCPeriod', label: 'A. B. C.' },
              { value: 'ppBulletArabicParenRight', label: '1) 2) 3)' },
              { value: 'ppBulletArabicPeriod', label: '1. 2. 3.' },
            ]}
            value={preferences.answersBulletStyle}
            onChange={e => handleChange('answersBulletStyle', e.target.value)}
          />
        </div>

        {/* Durée du compte à rebours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Durée du compte à rebours (secondes)</label>
          <Input
            type="number"
            value={preferences.pollTimeLimit}
            onChange={e => handleChange('pollTimeLimit', parseInt(e.target.value, 10) || 0)}
            placeholder="Ex: 30"
          />
        </div>

        {/* Déclenchement du chrono */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <label className="font-medium text-gray-700">Déclenchement du chrono</label>
          <Select
            options={[
              { value: 'Automatic', label: 'Automatique' },
              { value: 'Manual', label: 'Manuel' },
            ]}
            value={preferences.pollCountdownStartMode}
            onChange={e => handleChange('pollCountdownStartMode', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave} disabled={saveStatus === 'saving'}>
          <Save size={16} className="mr-2" />
          {saveStatus === 'saving' ? 'Enregistrement...' : saveStatus === 'success' ? 'Enregistré !' : 'Enregistrer les préférences'}
        </Button>
      </div>
       {saveStatus === 'error' && <p className="text-red-500 text-sm mt-2 text-right">Erreur lors de la sauvegarde.</p>}
    </Card>
  );
};

export default UserPreferences;