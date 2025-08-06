import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { StorageManager } from '../../services/StorageManager';
import { Session, Referential } from '@common/types'; // Ajout de Referential, CACESReferential enlevé
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import { Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';


interface ReportTemplate {
  name: string;
  filters: {
    referentialId: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  fields: string[];
}

// CustomReport.tsx
// ... (imports existants)
// Assurez-vous que Referential et CACESReferential (si utilisé pour les options statiques) sont importés
// import { Referential, CACESReferential } from '../../types';
// import { getAllReferentiels } from '../../db'; // Si vous chargez dynamiquement les options de référentiel

const CustomReport = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]); // Ajouté
  const [filters, setFilters] = useState({
    referentialId: 'all', // Changé pour referentialId, stockera l'ID (string) ou 'all'
    startDate: '',
    endDate: '',
    status: 'all',
  });
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['session.nomSession', 'session.dateSession']));
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      const stored = await StorageManager.getAdminSetting('customReportTemplates');
      if (stored?.value) {
        try {
          const parsed = JSON.parse(stored.value);
          if (Array.isArray(parsed)) {
            setSavedTemplates(parsed);
          }
        } catch (e) {
          console.error("Failed to parse custom report templates from storage.", e);
        }
      }
    };
    loadTemplates();
  }, []);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(name);
      } else {
        newSet.delete(name);
      }
      return newSet;
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName) return;
    const newTemplate: ReportTemplate = {
        name: templateName,
        filters: { ...filters },
        fields: Array.from(selectedFields)
    };
    const updatedTemplates = [...savedTemplates.filter(t => t.name !== templateName), newTemplate].sort((a,b) => a.name.localeCompare(b.name));

    try {
      await StorageManager.setAdminSetting('customReportTemplates', JSON.stringify(updatedTemplates));
      setSavedTemplates(updatedTemplates);
      setTemplateName('');
      alert(`Modèle '${templateName}' enregistré !`);
    } catch (error) {
      console.error("Failed to save template", error);
      alert("Erreur lors de la sauvegarde du modèle.");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    // Using window.confirm for simplicity, in a real app a custom modal would be better.
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le modèle '${selectedTemplate}' ?`)) {
        const updatedTemplates = savedTemplates.filter(t => t.name !== selectedTemplate);
        try {
          await StorageManager.setAdminSetting('customReportTemplates', JSON.stringify(updatedTemplates));
          setSavedTemplates(updatedTemplates);
          setSelectedTemplate('');
        } catch (error) {
          console.error("Failed to delete template", error);
          alert("Erreur lors de la suppression du modèle.");
        }
    }
  };

  useEffect(() => {
    if (!selectedTemplate) {
      // Optional: reset fields when no template is selected
      // setFilters({ referentialId: 'all', startDate: '', endDate: '', status: 'all' });
      // setSelectedFields(new Set(['session.nomSession', 'session.dateSession']));
      return;
    };
    const template = savedTemplates.find(t => t.name === selectedTemplate);
    if (template) {
        setFilters(template.filters);
        setSelectedFields(new Set(template.fields));
    }
  }, [selectedTemplate, savedTemplates]);

  const handleExportExcel = async () => {
    if (filteredSessions.length === 0) {
      alert("Il n'y a aucune donnée à exporter pour les filtres actuels.");
      return;
    }
    if (selectedFields.size === 0) {
      alert("Veuillez sélectionner au moins un champ à exporter.");
      return;
    }
    setIsExporting(true);

    try {
      console.log("Fetching all data for export...");
      const [
        allTrainers,
        allResults,
        allQuestions,
        allThemes,
        allBlocs,
      ] = await Promise.all([
        StorageManager.getAllTrainers(),
        StorageManager.getAllResults(),
        StorageManager.getAllQuestions(),
        StorageManager.getAllThemes(),
        StorageManager.getAllBlocs(),
      ]);

      const trainerMap = new Map(allTrainers.map(t => [t.id, t.name]));
      const blocMap = new Map(allBlocs.map(b => [b.id, b]));
      const themeMap = new Map(allThemes.map(t => [t.id, t]));

      const exportRows = [];
      for (const session of filteredSessions) {
        const sessionReferentiel = allReferentielsDb.find(ref => ref.id === session.referentielId);
        const sessionTrainer = trainerMap.get(session.trainerId) || 'N/A';

        const sessionQuestions = allQuestions.filter(q => session.selectedBlocIds?.includes(q.blocId));
        const enrichedSessionQuestions = sessionQuestions.map(q => {
          const bloc = blocMap.get(q.blocId);
          const theme = themeMap.get(bloc?.theme_id);
          return { ...q, resolvedThemeName: theme?.nom_complet || 'N/A', resolvedThemeCode: theme?.code_theme || 'N/A' };
        });

        if (!session.participants || session.participants.length === 0) {
          const row: { [key: string]: any } = {};
          if (selectedFields.has('session.nomSession')) row['Nom Session'] = session.nomSession;
          if (selectedFields.has('session.dateSession')) row['Date Session'] = new Date(session.dateSession).toLocaleDateString('fr-FR');
          if (selectedFields.has('session.referentiel')) row['Référentiel'] = sessionReferentiel?.code || 'N/A';
          if (selectedFields.has('session.formateur')) row['Formateur'] = sessionTrainer;
          exportRows.push(row);
        } else {
          for (const participant of session.participants) {
            const row: { [key: string]: any } = {};

            if (selectedFields.has('session.nomSession')) row['Nom Session'] = session.nomSession;
            if (selectedFields.has('session.dateSession')) row['Date Session'] = new Date(session.dateSession).toLocaleDateString('fr-FR');
            if (selectedFields.has('session.referentiel')) row['Référentiel'] = sessionReferentiel?.code || 'N/A';
            if (selectedFields.has('session.formateur')) row['Formateur'] = sessionTrainer;

            if (selectedFields.has('participant.nom')) row['Nom Participant'] = participant.nom;
            if (selectedFields.has('participant.prenom')) row['Prénom Participant'] = participant.prenom;
            if (selectedFields.has('participant.organisation')) row['Organisation'] = participant.organization;

            const participantResults = allResults.filter(r => r.participantId === participant.id && r.sessionId === session.id);
            const score = calculateParticipantScore(participantResults, enrichedSessionQuestions);
            const themeScores = calculateThemeScores(participantResults, enrichedSessionQuestions);
            const success = determineIndividualSuccess(score, Object.values(themeScores));

            if (selectedFields.has('scores.global')) row['Score Global (%)'] = score.toFixed(0);
            if (selectedFields.has('scores.statut')) row['Statut Réussite'] = success ? 'Réussi' : 'Ajourné';
            if (selectedFields.has('scores.parTheme')) row['Scores par Thème (JSON)'] = JSON.stringify(themeScores);

            exportRows.push(row);
          }
        }
      }

      console.log(`Processing complete. ${exportRows.length} rows generated.`);
      if (exportRows.length === 0) {
        alert("Aucune ligne de donnée n'a été générée avec les filtres et champs actuels.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rapport Personnalisé');
      const headers = Object.keys(exportRows[0]).map(key => ({ header: key, key: key, width: 25 }));
      worksheet.columns = headers;
      worksheet.addRows(exportRows);
      worksheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `rapport_personnalise_${new Date().toISOString().split('T')[0]}.xlsx`;
      const result = await window.dbAPI?.saveReportFile?.(buffer, fileName);

      if(result?.success) {
          alert(`Fichier Excel exporté avec succès : ${result.filePath}`);
      } else {
          throw new Error(result?.error || 'Erreur lors de la sauvegarde du fichier Excel.');
      }

    } catch (error) {
      console.error("Failed to export custom report:", error);
      alert(`Une erreur est survenue lors de l'export: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Map pour obtenir le code du référentiel par son ID pour l'affichage
  const referentialCodeMap = useMemo(() => {
    return new Map(allReferentielsDb.map(ref => [ref.id, ref.code]));
  }, [allReferentielsDb]);

  // Options pour le Select, maintenant basées sur les ID et affichant les codes
  const referentialOptionsForFilter = useMemo(() => {
    return [
      { value: 'all', label: 'Tous les référentiels' },
      ...allReferentielsDb.map(ref => ({
        value: String(ref.id), // Le filtre se fera sur l'ID
        label: ref.code        // On affiche le code
      }))
    ];
  }, [allReferentielsDb]);

  useEffect(() => {
    const loadData = async () => {
      const [fetchedSessions, fetchedReferentiels] = await Promise.all([
        StorageManager.getAllSessions(),
        StorageManager.getAllReferentiels(),
      ]);
      setSessions(fetchedSessions);
      setAllReferentielsDb(fetchedReferentiels.sort((a: Referential, b: Referential) => a.code.localeCompare(b.code)));
    };
    loadData();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Filtre par référentiel basé sur l'ID
      if (filters.referentialId !== 'all' && String(session.referentielId) !== filters.referentialId) return false;

      if (filters.status !== 'all' && session.status !== filters.status) return false;

      const sessionDate = new Date(session.dateSession);
      if (filters.startDate && sessionDate < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (sessionDate > endOfDay) return false;
      }
      return true;
    });
  }, [sessions, filters]); // referentialCodeMap n'est pas nécessaire ici car on filtre par ID

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Rapport Personnalisé</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg">
        <Select
          name="referentialId" // Changé pour correspondre à l'état du filtre
          label="Référentiel"
          value={filters.referentialId}
          onChange={handleFilterChange}
          options={referentialOptionsForFilter} // Utilise les options dynamiques
        />
        <Select
          name="status"
          label="Statut"
          value={filters.status}
          onChange={handleFilterChange}
          options={[
            { value: 'all', label: 'Tous les statuts' },
            { value: 'planned', label: 'Planifié' },
            { value: 'in-progress', label: 'En cours' },
            { value: 'completed', label: 'Terminé' },
            { value: 'cancelled', label: 'Annulé' }
          ]}
        />
        <Input name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
        <Input name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
      </div>

      <div className="mb-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Champs à Exporter</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
          {/* Groupe Session */}
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Session</h4>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="session.nomSession" checked={selectedFields.has('session.nomSession')} onChange={handleFieldChange} className="rounded" />
              <span>Nom Session</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="session.dateSession" checked={selectedFields.has('session.dateSession')} onChange={handleFieldChange} className="rounded" />
              <span>Date Session</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="session.referentiel" checked={selectedFields.has('session.referentiel')} onChange={handleFieldChange} className="rounded" />
              <span>Référentiel</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="session.formateur" checked={selectedFields.has('session.formateur')} onChange={handleFieldChange} className="rounded" />
              <span>Formateur</span>
            </label>
          </div>

          {/* Groupe Participant */}
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Participant</h4>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="participant.nom" checked={selectedFields.has('participant.nom')} onChange={handleFieldChange} className="rounded" />
              <span>Nom</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="participant.prenom" checked={selectedFields.has('participant.prenom')} onChange={handleFieldChange} className="rounded" />
              <span>Prénom</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="participant.organisation" checked={selectedFields.has('participant.organisation')} onChange={handleFieldChange} className="rounded" />
              <span>Organisation</span>
            </label>
          </div>

          {/* Groupe Scores */}
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Scores</h4>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="scores.global" checked={selectedFields.has('scores.global')} onChange={handleFieldChange} className="rounded" />
              <span>Score Global (%)</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="scores.statut" checked={selectedFields.has('scores.statut')} onChange={handleFieldChange} className="rounded" />
              <span>Statut Réussite</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" name="scores.parTheme" checked={selectedFields.has('scores.parTheme')} onChange={handleFieldChange} className="rounded" />
              <span>Scores par Thème (JSON)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mb-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Gérer les Modèles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">Charger un modèle</label>
            <div className="flex items-center space-x-2">
              <Select
                  id="template-select"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  options={[
                      { value: '', label: 'Sélectionner...' },
                      ...savedTemplates.map(t => ({ value: t.name, label: t.name }))
                  ]}
                  className="flex-grow"
              />
              <Button variant="danger" onClick={handleDeleteTemplate} disabled={!selectedTemplate}>Supprimer</Button>
            </div>
          </div>
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">Sauvegarder la sélection actuelle</label>
            <div className="flex items-center space-x-2">
              <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nom du nouveau modèle"
                  className="flex-grow"
              />
              <Button onClick={handleSaveTemplate} disabled={!templateName}>Sauvegarder</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          icon={<Download size={16}/>}
          onClick={handleExportExcel}
          disabled={isExporting}
        >
          {isExporting ? 'Exportation...' : 'Exporter les données sélectionnées'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessions.map(session => (
            <TableRow key={session.id}>
              <TableCell>{session.nomSession}</TableCell>
              <TableCell>{new Date(session.dateSession).toLocaleDateString('fr-FR')}</TableCell>
              {/* Afficher le code du référentiel en utilisant la map */}
              <TableCell>{session.referentielId ? referentialCodeMap.get(session.referentielId) : 'N/A'}</TableCell>
              <TableCell>{session.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default CustomReport;
