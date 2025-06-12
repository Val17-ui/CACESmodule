import React, { useState } from 'react';
import { Upload, FileText, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generatePPTX } from '../../utils/pptxGenerator';
import { Question } from '../../types';
import { logger } from '../../utils/logger';

interface PPTXGeneratorProps {
  questions: Question[];
  questionnaireName: string;
  referential: string;
}

const PPTXGenerator: React.FC<PPTXGeneratorProps> = ({
  questions,
  questionnaireName,
  referential
}) => {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Convertir les questions de la plateforme au format PPTX
  const convertQuestionsForPPTX = (platformQuestions: Question[]) => {
    return platformQuestions.map(q => ({
      question: q.text,
      correctAnswer: q.type === 'true-false' ? (q.correctAnswer === 0) : true, // Pour Vrai/Faux: 0=Vrai, 1=Faux
      duration: q.timeLimit || 30,
      imagePath: q.image || undefined
    }));
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        setTemplateFile(file);
        setStatus({ message: 'Template PPTX chargé avec succès', type: 'success' });
        logger.info(`Template PPTX chargé: ${file.name}`);
      } else {
        setStatus({ message: 'Veuillez sélectionner un fichier PPTX valide', type: 'error' });
      }
    }
  };

  const handleGeneratePPTX = async () => {
    if (!templateFile) {
      setStatus({ message: 'Veuillez d\'abord charger un template PPTX', type: 'error' });
      return;
    }

    if (questions.length === 0) {
      setStatus({ message: 'Aucune question disponible pour la génération', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ message: 'Génération du PPTX interactif en cours...', type: 'info' });

    try {
      const pptxQuestions = convertQuestionsForPPTX(questions);
      const fileName = `${questionnaireName.replace(/[^a-zA-Z0-9]/g, '_')}_${referential}_OMBEA.pptx`;
      
      await generatePPTX(templateFile, pptxQuestions, { fileName });
      
      setStatus({ 
        message: `PPTX interactif généré avec succès! (${questions.length} questions)`, 
        type: 'success' 
      });
      
      logger.success(`PPTX OMBEA généré: ${fileName} avec ${questions.length} questions`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setStatus({ message: `Erreur lors de la génération: ${errorMessage}`, type: 'error' });
      logger.error('Échec de la génération PPTX OMBEA', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = templateFile && questions.length > 0 && !isGenerating;

  return (
    <Card title="Génération PPTX OMBEA" className="mb-6">
      <div className="space-y-6">
        {/* Information sur le questionnaire */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Questionnaire sélectionné
          </h4>
          <div className="text-sm text-blue-800">
            <p><strong>Nom :</strong> {questionnaireName}</p>
            <p><strong>Référentiel :</strong> {referential}</p>
            <p><strong>Questions disponibles :</strong> {questions.length}</p>
            <p><strong>Format :</strong> Questions Vrai/Faux pour boîtiers OMBEA</p>
          </div>
        </div>

        {/* Upload du template */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            1. Ajouter votre template PPTX
          </label>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="file"
                accept=".pptx"
                onChange={handleTemplateUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            {templateFile && (
              <div className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                <span className="text-sm">{templateFile.name}</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Sélectionnez un fichier PowerPoint (.pptx) qui servira de base pour votre présentation OMBEA
          </p>
        </div>

        {/* Bouton de génération */}
        <div>
          <Button
            variant="primary"
            icon={isGenerating ? undefined : <Download size={16} />}
            onClick={handleGeneratePPTX}
            disabled={!canGenerate}
            className="w-full"
          >
            {isGenerating ? 'Génération en cours...' : 'Générer le PPTX interactif'}
          </Button>
        </div>

        {/* Message de statut */}
        {status && (
          <div className={`rounded-lg p-4 flex items-start ${
            status.type === 'success' ? 'bg-green-100 text-green-800' :
            status.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            ) : status.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
            ) : (
              <FileText className="w-5 h-5 mr-3 flex-shrink-0" />
            )}
            <p className="text-sm">{status.message}</p>
          </div>
        )}

        {/* Informations sur le format */}
        <div className="bg-amber-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-amber-900 mb-2">
            <AlertTriangle size={16} className="inline mr-1" />
            Format des questions
          </h4>
          <div className="text-sm text-amber-800">
            <p className="mb-2">
              <strong>Important :</strong> Le système génère actuellement des questions au format Vrai/Faux uniquement.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Les questions à choix multiples sont converties en Vrai/Faux</li>
              <li>La première option est considérée comme "Vrai"</li>
              <li>Les autres options sont considérées comme "Faux"</li>
              <li>Le temps limite de chaque question est respecté</li>
              <li>Les images associées aux questions sont prises en compte</li>
            </ul>
          </div>
        </div>

        {/* Instructions d'utilisation */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Instructions d'utilisation
          </h4>
          <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
            <li>Chargez votre template PowerPoint (.pptx)</li>
            <li>Vérifiez que votre questionnaire contient des questions</li>
            <li>Cliquez sur "Générer le PPTX interactif"</li>
            <li>Le fichier sera téléchargé automatiquement</li>
            <li>Ouvrez le fichier dans PowerPoint avec les boîtiers OMBEA connectés</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default PPTXGenerator;