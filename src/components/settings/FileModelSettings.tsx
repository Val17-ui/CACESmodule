import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Save, File as FileIcon, CheckCircle } from 'lucide-react';
import { getAdminSetting, setAdminSetting } from '../../db';

const FileModelSettings: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savedTemplateName, setSavedTemplateName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadTemplateName = async () => {
      const name = await getAdminSetting('pptxTemplateFileName');
      if (name) {
        setSavedTemplateName(name);
      }
    };
    loadTemplateName();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.pptx')) {
      setSelectedFile(file);
      setStatus('idle');
    } else {
      setSelectedFile(null);
      alert('Veuillez sélectionner un fichier au format .pptx');
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedFile) {
      alert('Aucun fichier sélectionné.');
      return;
    }
    setStatus('saving');
    try {
      // Stocker le contenu du fichier (Blob) et son nom
      await setAdminSetting('pptxTemplateFile', selectedFile);
      await setAdminSetting('pptxTemplateFileName', selectedFile.name);
      setSavedTemplateName(selectedFile.name);
      setStatus('success');
      setSelectedFile(null); // Reset file input
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save template:', error);
      setStatus('error');
    }
  };

  return (
    <Card title="Modèle PowerPoint" description="Gérez le modèle .pptx par défaut pour la génération des questionnaires.">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modèle actuel</label>
          {savedTemplateName ? (
            <div className="flex items-center p-3 bg-gray-100 rounded-lg">
              <FileIcon size={20} className="text-gray-500 mr-3" />
              <span className="text-sm font-medium text-gray-800">{savedTemplateName}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun modèle par défaut n'est configuré.</p>
          )}
        </div>

        <div>
          <label htmlFor="template-upload" className="block text-sm font-medium text-gray-700 mb-1">
            {savedTemplateName ? 'Remplacer le modèle' : 'Télécharger un nouveau modèle'}
          </label>
          <Input
            id="template-upload"
            type="file"
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex justify-end items-center pt-4">
           {status === 'success' && (
            <div className="flex items-center text-green-600 mr-4">
              <CheckCircle size={16} className="mr-1" />
              <span className="text-sm font-medium">Modèle enregistré !</span>
            </div>
          )}
          <Button onClick={handleSaveTemplate} disabled={!selectedFile || status === 'saving'}>
            <Save size={16} className="mr-2" />
            {status === 'saving' ? 'Enregistrement...' : 'Enregistrer le modèle'}
          </Button>
        </div>
         {status === 'error' && <p className="text-red-500 text-sm mt-2 text-right">Erreur lors de la sauvegarde du modèle.</p>}
      </div>
    </Card>
  );
};

export default FileModelSettings;
