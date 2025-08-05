import React from 'react';
import { AlertTriangle, PackagePlus } from 'lucide-react';
import Button from '../../ui/Button';
import Card from '../../ui/Card';

interface QuestionnaireGeneratorProps {
  isReadOnly: boolean;
  isGeneratingOrs: boolean;
  isFirstGenerationDone: boolean;
  iterationHasResults: Record<number, boolean>;
  handleGenerateQuestionnaire: () => void;
  handleRegenerateIteration: (iterationIndex: number) => void;
  editingSessionData: any; // Simplified
  modifiedAfterOrsGeneration: boolean;
  importSummary: string | null;
  activeTab: string;
  currentSessionDbId: number | null;
  selectedReferential: string;
}

const QuestionnaireGenerator: React.FC<QuestionnaireGeneratorProps> = ({
  isReadOnly,
  isGeneratingOrs,
  isFirstGenerationDone,
  iterationHasResults,
  handleGenerateQuestionnaire,
  handleRegenerateIteration,
  editingSessionData,
  modifiedAfterOrsGeneration,
  importSummary,
  activeTab,
  currentSessionDbId,
  selectedReferential,
}) => {
  const isGenerationDisabled = isGeneratingOrs || isReadOnly || (!selectedReferential && !currentSessionDbId && !editingSessionData?.referentielId);
  const mainButtonText = isGeneratingOrs ? "Génération..." : "Générer tous les questionnaires";
  const mainButtonTitle = isGenerationDisabled ? "Veuillez d'abord sélectionner un référentiel" :
                         isReadOnly ? "La session est terminée, regénération bloquée." :
                         isFirstGenerationDone ? "Les questionnaires ont déjà été générés. Utilisez les boutons ci-dessous pour une regénération." :
                         "Générer tous les questionnaires pour chaque itération";

  return (
    <Card title="Générer le questionnaire" className="mb-6">
      <Button
        variant="primary"
        icon={<PackagePlus size={16} />}
        onClick={handleGenerateQuestionnaire}
        disabled={isGenerationDisabled || isFirstGenerationDone}
        title={mainButtonTitle}
      >
        {mainButtonText}
      </Button>
      {isReadOnly && (
             <p className="mt-2 text-sm text-yellow-700">La session est terminée, la génération/régénération est bloquée.</p>
      )}
       {(!selectedReferential && !currentSessionDbId && !editingSessionData?.referentielId) && !isReadOnly && (
         <p className="mt-2 text-sm text-yellow-700">Veuillez sélectionner un référentiel pour activer la génération.</p>
      )}
      {modifiedAfterOrsGeneration && !!editingSessionData?.orsFilePath && !isReadOnly && (
        <p className="mt-3 text-sm text-orange-600 bg-orange-100 p-3 rounded-md flex items-center">
          <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
          <span>
                <strong className="font-semibold">Attention :</strong> Les informations des participants ont été modifiées après la dernière génération.
                Veuillez regénérer le questionnaire pour inclure ces changements.
          </span>
        </p>
      )}
          {importSummary && activeTab === 'generateQuestionnaire' && (
            <div className={`mt-4 p-3 rounded-md text-sm ${importSummary.toLowerCase().includes("erreur") || importSummary.toLowerCase().includes("échoué") || importSummary.toLowerCase().includes("impossible") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{importSummary}</p>
            </div>
          )}
      {editingSessionData?.iterations && editingSessionData.iterations.length > 0 && isFirstGenerationDone && (
        <div className="mt-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Génération par itération</h4>
          <ul className="space-y-3">
            {editingSessionData.iterations.map((iter: any, index: number) => (
              <li key={index} className="p-2 bg-white rounded-md border border-gray-300 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{iter.name}</span>
                  {iter.ors_file_path ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => { if (iter.ors_file_path) window.dbAPI?.openFile(iter.ors_file_path); }}
                        className="ml-2 text-xs"
                        title={`Ouvrir ${iter.ors_file_path}`}
                      >
                        {iter.ors_file_path}
                      </Button>
                  ) : (
                    <span className="ml-3 text-xs text-gray-500">(en attente de génération)</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerateIteration(index)}
                  disabled={isGeneratingOrs || isReadOnly}
                  title={iterationHasResults[index] ? "Des résultats ont déjà été importés pour cette itération, la regénération est bloquée." : "Régénérer uniquement le questionnaire de cette itération."}
                >
                  Régénérer ce questionnaire
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-gray-300">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateQuestionnaire}
              disabled={isGeneratingOrs || isReadOnly}
              title="Regénérer tous les questionnaires pour toutes les itérations. Attention, cela peut écraser les fichiers existants."
            >
              Régénérer tout (toutes les itérations)
            </Button>
          </div>
        </div>
      )}
 </Card>
  );
};

export default QuestionnaireGenerator;
