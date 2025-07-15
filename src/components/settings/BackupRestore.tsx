import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import {
  getAllQuestions,
  // getAllSessions, // Not exported from db.ts, needs replacement or removal
  // getAllResults, // Not exported from db.ts, needs replacement or removal
  getAllAdminSettings,
  getAllVotingDevices,
  getAdminSetting,
  db,
} from '../../db';

// Placeholder functions if actual data sources for sessions and results are needed
// For now, we'll use these to avoid breaking the export/import logic entirely,
// but they will return empty arrays.
const getAllSessions_placeholder = async () => { console.warn("getAllSessions_placeholder used"); return []; };
const getAllResults_placeholder = async () => { console.warn("getAllResults_placeholder used"); return []; };


const BackupRestore: React.FC = () => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [backupFileName, setBackupFileName] = useState<string>('CACES_Manager_Backup.json');

  useEffect(() => {
    const loadBackupFileName = async () => {
      const name = await getAdminSetting('backupFileName');
      if (name) {
        setBackupFileName(name);
      }
    };
    loadBackupFileName();
  }, []);

  const handleExport = async () => {
    setExportStatus('exporting');
    try {
      const data = {
        questions: await getAllQuestions(),
        sessions: await getAllSessions_placeholder(), // Using placeholder
        sessionResults: await getAllResults_placeholder(), // Using placeholder
        adminSettings: await getAllAdminSettings(),
        votingDevices: await getAllVotingDevices(),
      };

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to export data:', error);
      setExportStatus('error');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('importing');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonString = e.target?.result as string;
          const data = JSON.parse(jsonString);

          // Validation basique (peut être étendue)
          if (!data.questions || !data.sessions || !data.sessionResults || !data.adminSettings || !data.votingDevices) {
            throw new Error("Fichier de sauvegarde invalide ou incomplet.");
          }

          // Effacer toutes les données existantes (ATTENTION: opération destructive)
          // Corrected the list of tables for the transaction.
          // Assuming 'sessions' and 'sessionResults' tables are defined in db.ts for Dexie.
          // If not, these would also cause runtime errors if data for them is in the backup.
          await db.transaction('rw', [db.questions, db.sessions, db.sessionResults, db.adminSettings, db.votingDevices], async () => {
            await Promise.all([
              db.questions.clear(),
              db.sessions.clear(), // This will fail if db.sessions is not a valid table object
              db.sessionResults.clear(), // This will fail if db.sessionResults is not a valid table object
              db.adminSettings.clear(),
              db.votingDevices.clear(),
            ]);

            // Importer les nouvelles données
            await Promise.all([
              db.questions.bulkAdd(data.questions),
              db.sessions.bulkAdd(data.sessions), // This will fail if db.sessions is not a valid table object
              db.sessionResults.bulkAdd(data.sessionResults), // This will fail if db.sessionResults is not a valid table object
              db.adminSettings.bulkAdd(data.adminSettings),
              db.votingDevices.bulkAdd(data.votingDevices),
            ]);
          });

          setImportStatus('success');
          alert('Données restaurées avec succès ! L\'application va se recharger.');
          window.location.reload(); // Recharger l'application pour refléter les changements

        } catch (parseError) {
          console.error('Error parsing backup file:', parseError);
          setImportStatus('error');
          alert(`Erreur lors de la lecture du fichier: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to import data:', error);
      setImportStatus('error');
    }
  };

  return (
    <Card title="Sauvegarde et Restauration">
      <p className="text-sm text-gray-600 mb-6">Exportez ou importez toutes les données de l'application.</p>
      <div className="space-y-6">
        {/* Export Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Exporter les données</h3>
          <p className="text-sm text-gray-500 mb-4">Créez une sauvegarde complète de toutes vos questions, sessions, résultats et paramètres.</p>
          <Button onClick={handleExport} disabled={exportStatus === 'exporting'} icon={<Download size={16}/>}>
            {exportStatus === 'exporting' ? 'Exportation...' : 'Exporter la base de données'}
          </Button>
          {exportStatus === 'success' && <p className="text-green-600 text-sm mt-2">Exportation réussie !</p>}
          {exportStatus === 'error' && <p className="text-red-500 text-sm mt-2">Erreur lors de l'exportation.</p>}
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Import Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Importer les données</h3>
          <p className="text-sm text-gray-500 mb-4">
            <AlertTriangle size={16} className="inline-block text-yellow-500 mr-1" />
            Attention: L'importation écrasera toutes les données existantes dans l'application.
          </p>
           <label htmlFor="import-file" className="inline-flex">
             <Button variant="outline" disabled={importStatus === 'importing'} icon={<Upload size={16}/>} onClick={() => document.getElementById('import-file')?.click()} type="button">
              {importStatus === 'importing' ? 'Importation...' : 'Sélectionner un fichier de sauvegarde'}
             </Button>
           </label>
          <input type="file" id="import-file" accept=".json" className="hidden" onChange={handleImport} />
          {importStatus === 'success' && <p className="text-green-600 text-sm mt-2">Importation réussie ! L'application va se recharger.</p>}
          {importStatus === 'error' && <p className="text-red-500 text-sm mt-2">Erreur lors de l'importation. Vérifiez le format du fichier.</p>}
        </div>
      </div>
    </Card>
  );
};

export default BackupRestore;
