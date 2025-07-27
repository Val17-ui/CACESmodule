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
            {!editingSessionData?.orsFilePath && !isReadOnly && (
              <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Générez d'abord le .ors pour cette session avant d'importer les résultats.</p>
            )}
            {isReadOnly && (
              <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Résultats déjà importés (session terminée).</p>
            )}
            <p className="text-xs text-gray-500">Importez le fichier .zip contenant ORSession.xml après le vote.</p>
            {editingSessionData?.iterations?.map((iter: any, index: number) => (
              <Button
                key={index}
                variant="secondary"
                icon={<FileUp size={16} />}
                onClick={() => handleImportResults(index)}
                disabled={!editingSessionData?.questionMappings || isReadOnly || !editingSessionData?.orsFilePath}
              >
                Importer les Résultats pour {iter.name}
              </Button>
            ))}
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
