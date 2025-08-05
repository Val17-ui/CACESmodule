import React from 'react';
import { FileUp } from 'lucide-react';
import Button from '../../ui/Button';
import Card from '../../ui/Card';

interface ResultsImporterProps {
  isReadOnly: boolean;
  editingSessionData: any; // Simplified
  handleImportResults: (iterationIndex: number) => void;
  importSummary: string | null;
  activeTab: string;
  currentSessionDbId: number | null;
}

const ResultsImporter: React.FC<ResultsImporterProps> = ({
  isReadOnly,
  editingSessionData,
  handleImportResults,
  importSummary,
  activeTab,
  currentSessionDbId,
}) => {
  return (
    <>
      {currentSessionDbId && (
        <Card title="Résultats de la Session (Import)" className="mb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="resultsFileInput" className="block text-sm font-medium text-gray-700 mb-1">Fichier résultats (.ors)</label>
            </div>
            {isReadOnly && (
              <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Résultats déjà importés (session terminée).</p>
            )}

            {editingSessionData?.iterations?.some((iter: any) => !iter.ors_file_path) && !isReadOnly && (
              <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">
                Générez d'abord le questionnaire pour chaque itération avant d'importer les résultats.
              </p>
            )}

            <div className="space-y-3 mt-4">
              {editingSessionData?.iterations?.map((iter: any, index: number) => {
                const isCompleted = iter.status === 'completed';
                const hasFilePath = !!iter.ors_file_path;

                return (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                    <span className="font-medium text-gray-800">{iter.name}</span>
                    <Button
                      variant={isCompleted ? 'secondary' : 'success'}
                      icon={<FileUp size={16} />}
                      onClick={() => handleImportResults(index)}
                      disabled={isCompleted || !hasFilePath}
                      title={!hasFilePath ? "Générez d'abord le questionnaire pour cette itération." : isCompleted ? "Les résultats ont déjà été importés." : `Importer les résultats pour ${iter.name}`}
                    >
                      {isCompleted ? 'Résultats importés' : `Importer les résultats`}
                    </Button>
                  </div>
                );
              })}
            </div>
            {importSummary && activeTab === 'importResults' && (
              <div className={`mt-4 p-3 rounded-md text-sm ${importSummary.toLowerCase().includes("erreur") || importSummary.toLowerCase().includes("échoué") || importSummary.toLowerCase().includes("impossible") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{importSummary}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};

export default ResultsImporter;
