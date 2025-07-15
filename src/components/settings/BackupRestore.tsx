import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { StorageManager } from '../../services/StorageManager';


const BackupRestore: React.FC = () => {
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [backupFileName, setBackupFileName] = useState<string>('CACES_Manager_Backup.json');

  useEffect(() => {
    const loadBackupFileName = async () => {
      const name = await StorageManager.getAdminSetting('backupFileName');
      if (name) {
        setBackupFileName(name);
      }
    };
    loadBackupFileName();
  }, []);

  const handleExport = async () => {
    setExportStatus('exporting');
    try {
      const data = await StorageManager.exportAllData();
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

          await StorageManager.importAllData(data);

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
