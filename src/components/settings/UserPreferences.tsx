import React, { useState, useEffect, useCallback } from 'react'; // Ajout de useCallback
import Card from '../ui/Card';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Save, Trash2, Star, FileText, CheckCircle } from 'lucide-react'; // Ajout des icônes
import { StorageManager } from '../../services/StorageManager';

// Définition des types pour les préférences existantes
interface UserPreferencesData {
  pollStartMode: 'Automatic' | 'Manual';
  answersBulletStyle: 'ppBulletAlphaUCParenRight' | 'ppBulletAlphaUCPeriod' | 'ppBulletArabicParenRight' | 'ppBulletArabicPeriod';
  pollTimeLimit: number;
  pollCountdownStartMode: 'Automatic' | 'Manual';
  questionSlideTransition: 'Manual' | 'Automatic';
  questionSlideTransitionDelay: number;
}

// Nouvelle définition de type pour les modèles PPTX utilisateur
export interface UserPptxTemplate {
  id: string;
  name: string;
  fileBlob: Blob;
  addedDate: string;
}

// Constante pour l'ID du modèle par défaut de l'outil (pour référence)
// const TOOL_DEFAULT_TEMPLATE_ID = 'tool_default_template'; // Non utilisé directement dans la logique pour l'instant

const UserPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferencesData>({
    pollStartMode: 'Automatic',
    answersBulletStyle: 'ppBulletArabicPeriod',
    pollTimeLimit: 0,
    pollCountdownStartMode: 'Automatic',
    questionSlideTransition: 'Manual',
    questionSlideTransitionDelay: 5,
  });

  // Nouveaux états pour les modèles PPTX
  const [userPptxTemplates, setUserPptxTemplates] = useState<UserPptxTemplate[]>([]);
  const [userDefaultPptxTemplateId, setUserDefaultPptxTemplateId] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });


  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Charger tous les settings au montage
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [
          pollStartMode,
          answersBulletStyle,
          pollTimeLimit,
          pollCountdownStartMode,
          questionSlideTransition,
          questionSlideTransitionDelay,
          loadedTemplates,
          defaultTemplateId,
        ] = await Promise.all([
          StorageManager.getAdminSetting('pollStartMode'),
          StorageManager.getAdminSetting('answersBulletStyle'),
          StorageManager.getAdminSetting('pollTimeLimit'),
          StorageManager.getAdminSetting('pollCountdownStartMode'),
          StorageManager.getAdminSetting('questionSlideTransition'),
          StorageManager.getAdminSetting('questionSlideTransitionDelay'),
          StorageManager.getAdminSetting('userPptxTemplates'),
          StorageManager.getAdminSetting('userDefaultPptxTemplateId'),
        ]);

        setPreferences({
          pollStartMode: pollStartMode || 'Automatic',
          answersBulletStyle: answersBulletStyle || 'ppBulletArabicPeriod',
          pollTimeLimit: pollTimeLimit !== undefined ? pollTimeLimit : 30,
          pollCountdownStartMode: pollCountdownStartMode || 'Automatic',
          questionSlideTransition: questionSlideTransition || 'Manual',
          questionSlideTransitionDelay: questionSlideTransitionDelay !== undefined ? questionSlideTransitionDelay : 5,
        });

        setUserPptxTemplates(loadedTemplates || []);
        setUserDefaultPptxTemplateId(defaultTemplateId || null);

      } catch (error) {
        console.error("Failed to load settings:", error);
        // Gérer l'erreur de chargement (afficher un message à l'utilisateur, etc.)
        setSaveStatus('error'); // Peut-être un état d'erreur de chargement dédié
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Sauvegarde des préférences existantes
      await StorageManager.setAdminSetting('pollStartMode', preferences.pollStartMode);
      await StorageManager.setAdminSetting('answersBulletStyle', preferences.answersBulletStyle);
      await StorageManager.setAdminSetting('pollTimeLimit', preferences.pollTimeLimit);
      await StorageManager.setAdminSetting('pollCountdownStartMode', preferences.pollCountdownStartMode);
      await StorageManager.setAdminSetting('questionSlideTransition', preferences.questionSlideTransition);
      await StorageManager.setAdminSetting('questionSlideTransitionDelay', preferences.questionSlideTransitionDelay);

      // Sauvegarde des préférences de modèles
      await StorageManager.setAdminSetting('userPptxTemplates', userPptxTemplates);
      await StorageManager.setAdminSetting('userDefaultPptxTemplateId', userDefaultPptxTemplateId);

      setSaveStatus('success');
      setTemplateStatus({ type: 'idle', message: '' }); // Reset template status on global save
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error("Failed to save preferences", error);
      setSaveStatus('error');
      // Le message d'erreur spécifique aux templates est géré par templateStatus,
      // mais on peut aussi indiquer une erreur générale de sauvegarde.
    }
  };

  const handleChange = (key: keyof UserPreferencesData, value: string | number) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // --- Fonctions de gestion des modèles PPTX ---

  const handleTemplateUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Reset file input to allow re-uploading the same file name
    if (event.target) {
        event.target.value = '';
    }

    if (file) {
      if (!file.name.endsWith('.pptx') && !file.type.includes('presentationml')) {
        setTemplateStatus({ type: 'error', message: 'Veuillez sélectionner un fichier au format .pptx' });
        return;
      }
      // Vérifier si un template avec le même nom existe déjà
      if (userPptxTemplates.some(t => t.name === file.name)) {
        setTemplateStatus({ type: 'error', message: `Un modèle nommé "${file.name}" existe déjà.` });
        return;
      }

      try {
        const fileBlob = new Blob([file], { type: file.type });
        const newTemplate: UserPptxTemplate = {
          id: `${Date.now()}-${file.name}`, // ID plus unique
          name: file.name,
          fileBlob,
          addedDate: new Date().toISOString(),
        };
        setUserPptxTemplates(prevTemplates => [...prevTemplates, newTemplate]);
        setTemplateStatus({ type: 'success', message: `Modèle "${file.name}" prêt à être sauvegardé. N'oubliez pas d'enregistrer les préférences.` });
      } catch (error) {
        console.error("Error processing template upload:", error);
        setTemplateStatus({ type: 'error', message: "Erreur lors du traitement du fichier." });
      }
    }
  }, [userPptxTemplates]);

  const handleDeleteTemplate = useCallback((templateIdToDelete: string) => {
    setUserPptxTemplates(prevTemplates =>
      prevTemplates.filter(t => t.id !== templateIdToDelete)
    );
    if (userDefaultPptxTemplateId === templateIdToDelete) {
      setUserDefaultPptxTemplateId(null);
    }
    setTemplateStatus({ type: 'success', message: 'Modèle marqué pour suppression. N\'oubliez pas d\'enregistrer les préférences.' });
  }, [userDefaultPptxTemplateId]);

  const handleSetDefaultTemplate = useCallback((templateIdToSetAsDefault: string) => {
    if (userDefaultPptxTemplateId === templateIdToSetAsDefault) {
        // Option: permettre de désactiver le défaut en cliquant à nouveau sur l'étoile du modèle déjà par défaut.
        // setUserDefaultPptxTemplateId(null);
        // setTemplateStatus({ type: 'success', message: 'Modèle par défaut personnel désactivé. N\'oubliez pas d\'enregistrer.'});
    } else {
        setUserDefaultPptxTemplateId(templateIdToSetAsDefault);
        setTemplateStatus({ type: 'success', message: 'Nouveau modèle par défaut sélectionné. N\'oubliez pas d\'enregistrer les préférences.' });
    }
  }, [userDefaultPptxTemplateId]);


  if (isLoading) {
    return (
      <Card title="Préférences Utilisateur">
        <p>Chargement des préférences...</p>
      </Card>
    );
  }

  return (
    <Card title="Préférences Utilisateur">
      <p className="text-sm text-gray-600 mb-4">
        Ces paramètres affectent la génération des questionnaires.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8">
        {/* Left Column: Preferences */}
        <div className="space-y-6">
            {/* Ouverture du vote */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="font-medium text-gray-700">Ouverture du vote</label>
                <Select
                    options={[{ value: 'Automatic', label: 'Automatique' }, { value: 'Manual', label: 'Manuel' }]}
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
                    min="0"
                    value={preferences.pollTimeLimit}
                    onChange={e => handleChange('pollTimeLimit', parseInt(e.target.value, 10) || 0)}
                    placeholder="Ex: 30"
                />
            </div>

            {/* Déclenchement du chrono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="font-medium text-gray-700">Déclenchement du chrono</label>
                <Select
                    options={[{ value: 'Automatic', label: 'Automatique' }, { value: 'Manual', label: 'Manuel' }]}
                    value={preferences.pollCountdownStartMode}
                    onChange={e => handleChange('pollCountdownStartMode', e.target.value)}
                />
            </div>

            {/* Passage à la diapositive suivante */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="font-medium text-gray-700">Passage à la diapositive suivante (questions)</label>
                <Select
                    options={[{ value: 'Manual', label: 'Manuel' }, { value: 'Automatic', label: 'Automatique' }]}
                    value={preferences.questionSlideTransition}
                    onChange={e => handleChange('questionSlideTransition', e.target.value)}
                />
            </div>

            {/* Délai de passage automatique */}
            {preferences.questionSlideTransition === 'Automatic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <label className="font-medium text-gray-700">Délai avant passage (secondes)</label>
                    <Input
                        type="number"
                        min="2"
                        value={preferences.questionSlideTransitionDelay}
                        onChange={e => {
                            const value = parseInt(e.target.value, 10);
                            handleChange('questionSlideTransitionDelay', !value || value < 2 ? 2 : value);
                        }}
                        placeholder="Min: 2"
                    />
                </div>
            )}
        </div>

        {/* Right Column: Save Button and Template Management */}
        <div className="space-y-6">
            {/* Save button section */}
            <div className="flex justify-end items-center gap-4">
                {saveStatus === 'success' && (
                    <div className="flex items-center text-green-600">
                        <CheckCircle size={18} className="mr-1.5" />
                        <span className="text-sm font-medium">Préférences enregistrées !</span>
                    </div>
                )}
                {saveStatus === 'error' && (
                    <p className="text-red-500 text-sm font-medium">Erreur lors de la sauvegarde.</p>
                )}
                <Button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || isLoading}
                    className="min-w-[180px]"
                >
                    <Save size={16} className="mr-2" />
                    {saveStatus === 'saving' ? 'Enregistrement...' : 'Enregistrer les préférences'}
                </Button>
            </div>

            {/* Template Management Section */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Gestion des Modèles PowerPoint</h3>
              <div className="mb-6 p-4 border border-dashed border-gray-300 rounded-lg">
          <label htmlFor="template-upload" className="block text-sm font-medium text-gray-700 mb-1">
            Téléverser un nouveau modèle personnalisé (.pptx)
          </label>
          <div className="flex items-center mt-2">
            <Input
              id="template-upload"
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleTemplateUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
            />
            {/* L'icône UploadCloud peut être intégrée dans le style du bouton si désiré, ou à côté */}
          </div>
          {templateStatus.message && templateStatus.type !== 'idle' && (
            <p className={`mt-2 text-sm ${templateStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {templateStatus.message}
            </p>
          )}
        </div>

        <h4 className="text-md font-semibold text-gray-700 mb-3">Modèles disponibles</h4>
        {(userPptxTemplates.length === 0) && (
          <p className="text-sm text-gray-500 mb-3 px-1">Aucun modèle personnalisé n'a été ajouté. Le modèle par défaut de l'outil sera utilisé.</p>
        )}

        <ul className="space-y-3">
          {/* Modèle par défaut de l'outil */}
          <li className="p-3 bg-slate-50 rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center">
              <FileText size={20} className="text-slate-500 mr-3 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-800">Modèle par défaut (Outil)</span>
            </div>
            {/* Logique pour afficher "Actif" si c'est le fallback */}
            {(userDefaultPptxTemplateId === null || !userPptxTemplates.find(t => t.id === userDefaultPptxTemplateId)) && (
                 <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Actif</span>
            )}
          </li>

          {/* Modèles personnalisés */}
          {userPptxTemplates.map(template => (
            <li key={template.id} className="p-3 border border-gray-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-50 transition-colors duration-150 shadow-sm">
              <div className="flex items-center mb-2 sm:mb-0">
                <FileText size={20} className="text-indigo-500 mr-3 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-gray-800 block">{template.name}</span>
                  <p className="text-xs text-gray-500">Ajouté le: {new Date(template.addedDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-center">
                <Button
                  variant="outline" // Changé pour 'outline' pour une meilleure visibilité
                  size="sm" // Taille 'sm' pour les boutons d'action
                  onClick={() => handleSetDefaultTemplate(template.id)}
                  title={userDefaultPptxTemplateId === template.id ? "C'est votre modèle par défaut" : "Définir comme modèle par défaut"}
                  className={`p-1.5 ${userDefaultPptxTemplateId === template.id ? 'border-yellow-500 text-yellow-600 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-500 hover:text-yellow-600 hover:border-yellow-400'}`}
                >
                  <Star size={16} fill={userDefaultPptxTemplateId === template.id ? 'currentColor' : 'none'} />
                   <span className="ml-1.5 hidden sm:inline">{userDefaultPptxTemplateId === template.id ? 'Défaut' : 'Par défaut'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm" // Taille 'sm'
                  onClick={() => {
                    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le modèle "${template.name}" ?\n\nCette action sera effective après avoir cliqué sur "Enregistrer les préférences".`)) {
                      handleDeleteTemplate(template.id);
                    }
                  }}
                  title="Supprimer le modèle"
                  className="text-gray-500 hover:text-red-600 p-1.5"
                >
                  <Trash2 size={16} />
                   <span className="ml-1.5 hidden sm:inline">Supprimer</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      </div>
      </div>
    </Card>
  );
};

export default UserPreferences;