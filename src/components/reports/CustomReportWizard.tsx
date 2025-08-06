import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { ArrowLeft, ArrowRight, Download, Save } from 'lucide-react';
import { StorageManager } from '../../services/StorageManager';
import { Referential, Trainer, Session, QuestionWithId, Theme, Bloc, SessionResult, Participant } from '@common/types';
import ExcelJS from 'exceljs';
import { calculateParticipantScore, calculateThemeScores, determineIndividualSuccess } from '../../utils/reportCalculators';

type ReportType = 'sessions' | 'participants';

interface ReportTemplate {
  name: string;
  config: ReportConfig;
}

interface ReportConfig {
  reportType: ReportType | null;
  filters: {
    referentialId: string;
    trainerId: string;
    sessionId: string;
  };
  fields: Set<string>;
}

const fieldConfig = {
    sessions: {
        "Détails Session": [ { id: 'session.nom', label: 'Nom de la session' }, { id: 'session.date', label: 'Date' }, { id: 'session.referentiel', label: 'Référentiel' }, { id: 'session.formateur', label: 'Formateur' }, { id: 'session.lieu', label: 'Lieu' }, ],
        "Statistiques": [ { id: 'session.nbParticipants', label: 'Nombre de participants' }, { id: 'session.scoreMoyen', label: 'Score moyen (%)' }, { id: 'session.tauxReussite', label: 'Taux de réussite (%)' }, ]
    },
    participants: {
        "Détails Participant": [ { id: 'participant.nom', label: 'Nom' }, { id: 'participant.prenom', label: 'Prénom' }, { id: 'participant.organisation', label: 'Organisation' }, ],
        "Contexte Session": [ { id: 'session.nom', label: 'Nom de la session' }, { id: 'session.date', label: 'Date' }, ],
        "Résultats": [ { id: 'resultat.scoreGlobal', label: 'Score Global (%)' }, { id: 'resultat.statut', label: 'Statut Réussite' }, { id: 'resultat.scoresParTheme', label: 'Scores par Thème (JSON)' }, ]
    }
};

const CustomReportWizard = () => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<ReportConfig>({ reportType: null, filters: { referentialId: 'all', trainerId: 'all', sessionId: 'all', }, fields: new Set<string>(), });
  const [isExporting, setIsExporting] = useState(false);
  const [referentiels, setReferentiels] = useState<Referential[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [refs, trs, sess, templates] = await Promise.all([
        StorageManager.getAllReferentiels(),
        StorageManager.getAllTrainers(),
        StorageManager.getAllSessions(),
        StorageManager.getAdminSetting('reportTemplates'),
      ]);
      setReferentiels(refs);
      setTrainers(trs);
      setSessions(sess);
      if (templates?.value) {
        try {
          const parsed = JSON.parse(templates.value);
          if(Array.isArray(parsed)) setSavedTemplates(parsed);
        } catch(e) { console.error("Failed to parse templates", e); }
      }
    };
    loadData();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, filters: { ...prev.filters, [name]: value } }));
  };

  const handleFieldChange = (fieldId: string) => {
    setConfig(prev => {
        const newFields = new Set(prev.fields);
        if (newFields.has(fieldId)) newFields.delete(fieldId);
        else newFields.add(fieldId);
        return { ...prev, fields: newFields };
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName) return;
    const newTemplate: ReportTemplate = { name: templateName, config: { ...config, fields: Array.from(config.fields) as any } };
    const updatedTemplates = [...savedTemplates.filter(t => t.name !== templateName), newTemplate].sort((a,b) => a.name.localeCompare(b.name));
    await StorageManager.setAdminSetting('reportTemplates', JSON.stringify(updatedTemplates));
    setSavedTemplates(updatedTemplates);
    setTemplateName('');
    alert(`Modèle '${templateName}' enregistré !`);
  };

  const handleLoadTemplate = (templateName: string) => {
      const template = savedTemplates.find(t => t.name === templateName);
      if(template) {
          setConfig({...template.config, fields: new Set(template.config.fields)});
          alert(`Modèle '${templateName}' chargé.`);
      }
  }

  const handleExportExcel = async () => {
      if (!config.reportType || config.fields.size === 0) {
          alert("Veuillez sélectionner un type de rapport et au moins un champ.");
          return;
      }
      setIsExporting(true);
      try {
          const allData = await fetchAllDataForReport();
          const reportRows = processDataForReport(allData, config);
          await generateAndSaveExcel(reportRows, config);
          alert('Exportation terminée avec succès !');
      } catch (error) {
          console.error("Export failed", error);
          alert(`L'exportation a échoué: ${error}`);
      } finally {
          setIsExporting(false);
      }
  }

  const fetchAllDataForReport = async () => {
      return Promise.all([
        StorageManager.getAllSessions(),
        StorageManager.getAllTrainers(),
        StorageManager.getAllReferentiels(),
        StorageManager.getAllThemes(),
        StorageManager.getAllBlocs(),
        StorageManager.getAllResults(),
        StorageManager.getAllQuestions(),
      ]).then(([sessions, trainers, referentiels, themes, blocs, results, questions]) => ({
          sessions, trainers, referentiels, themes, blocs, results, questions
      }));
  }

  const processDataForReport = (allData: any, config: ReportConfig) => {
      let filteredSessions = allData.sessions;
      if (config.filters.referentialId !== 'all') filteredSessions = filteredSessions.filter((s: Session) => String(s.referentielId) === config.filters.referentialId);
      if (config.filters.trainerId !== 'all') filteredSessions = filteredSessions.filter((s: Session) => String(s.trainerId) === config.filters.trainerId);
      if (config.filters.sessionId !== 'all') filteredSessions = filteredSessions.filter((s: Session) => String(s.id) === config.filters.sessionId);

      const rows: any[] = [];
      const trainerMap = new Map(allData.trainers.map((t: Trainer) => [t.id, t.name]));
      const referentielMap = new Map(allData.referentiels.map((r: Referential) => [r.id, r.code]));

      if (config.reportType === 'sessions') {
          filteredSessions.forEach((s: Session) => {
              const row: any = {};
              if (config.fields.has('session.nom')) row['Nom Session'] = s.nomSession;
              if (config.fields.has('session.date')) row['Date'] = s.dateSession;
              if (config.fields.has('session.referentiel')) row['Référentiel'] = s.referentielId ? referentielMap.get(s.referentielId) : '';
              if (config.fields.has('session.formateur')) row['Formateur'] = s.trainerId ? trainerMap.get(s.trainerId) : '';
              if (config.fields.has('session.lieu')) row['Lieu'] = s.location;
              if (config.fields.has('session.nbParticipants')) row['Nb Participants'] = s.participants?.length || 0;
              // Score calculations would need more logic here
              rows.push(row);
          });
      } else if (config.reportType === 'participants') {
          filteredSessions.forEach((s: Session) => {
              if (s.participants) {
                  s.participants.forEach((p: Participant) => {
                      const row: any = {};
                      if (config.fields.has('participant.nom')) row['Nom'] = p.nom;
                      if (config.fields.has('participant.prenom')) row['Prénom'] = p.prenom;
                      if (config.fields.has('session.nom')) row['Session'] = s.nomSession;
                      // ... more fields
                      rows.push(row);
                  });
              }
          });
      }
      return rows;
  }

  const generateAndSaveExcel = async (rows: any[], config: ReportConfig) => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rapport');

      if (rows.length > 0) {
          const headers = Array.from(config.fields).map(fieldId => {
              const [type, key] = fieldId.split('.');
              const group = fieldConfig[config.reportType as ReportType];
              const field = Object.values(group).flat().find(f => f.id === fieldId);
              return { header: field?.label || fieldId, key: field?.label || fieldId, width: 25 };
          });
          worksheet.columns = headers;

          const dataForSheet = rows.map(row => {
              const newRow: any = {};
              headers.forEach(h => {
                  newRow[h.header] = row[h.header];
              });
              return newRow;
          });

          worksheet.addRows(dataForSheet);
          worksheet.getRow(1).font = { bold: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `rapport_${config.reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const result = await window.dbAPI?.saveReportFile?.(buffer, fileName);

      if(!result?.success) {
          throw new Error(result?.error || 'Erreur lors de la sauvegarde du fichier Excel.');
      }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
            <div>
              <h3 className="text-lg font-semibold mb-4">Étape 1: Choisissez le type de rapport</h3>
              <div className="space-y-2">
                <button onClick={() => setConfig(prev => ({ ...prev, reportType: 'sessions' }))} className={`w-full text-left p-4 rounded-lg border ${config.reportType === 'sessions' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                  <h4 className="font-bold">Rapport par Sessions</h4>
                  <p className="text-sm text-gray-600">Génère une ligne par session.</p>
                </button>
                <button onClick={() => setConfig(prev => ({ ...prev, reportType: 'participants' }))} className={`w-full text-left p-4 rounded-lg border ${config.reportType === 'participants' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                  <h4 className="font-bold">Rapport par Participants</h4>
                  <p className="text-sm text-gray-600">Génère une ligne par participant et par session.</p>
                </button>
              </div>
            </div>
        );
      case 2:
        return (
            <div>
                <h3 className="text-lg font-semibold mb-4">Étape 2: Appliquez des filtres</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Référentiel" name="referentialId" value={config.filters.referentialId} onChange={handleFilterChange} options={[{ value: 'all', label: 'Tous' }, ...referentiels.map(r => ({ value: String(r.id), label: r.code }))]} />
                    <Select label="Formateur" name="trainerId" value={config.filters.trainerId} onChange={handleFilterChange} options={[{ value: 'all', label: 'Tous' }, ...trainers.map(t => ({ value: String(t.id), label: t.name }))]} />
                    <Select label="Session" name="sessionId" value={config.filters.sessionId} onChange={handleFilterChange} options={[{ value: 'all', label: 'Toutes' }, ...sessions.map(s => ({ value: String(s.id), label: s.nomSession }))]} />
                </div>
            </div>
        );
      case 3:
        if (!config.reportType) return <div>Veuillez retourner à l'étape 1.</div>;
        const currentFields = fieldConfig[config.reportType] || {};
        return (
            <div>
                <h3 className="text-lg font-semibold mb-4">Étape 3: Choisissez les champs</h3>
                <div className="space-y-4">
                    {Object.entries(currentFields).map(([groupName, fields]) => (
                        <div key={groupName}><h4 className="font-bold text-gray-700 mb-2 border-b pb-1">{groupName}</h4><div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {fields.map((field: any) => (<label key={field.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                <input type="checkbox" checked={config.fields.has(field.id)} onChange={() => handleFieldChange(field.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                                <span className="text-sm text-gray-800">{field.label}</span>
                            </label>))}
                        </div></div>
                    ))}
                </div>
            </div>
        );
      case 4:
        return (
            <div>
                <h3 className="text-lg font-semibold mb-4">Étape 4: Sauvegarde et Export</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-gray-700 mb-2">Sauvegarder ce modèle</h4>
                        <div className="flex items-center space-x-2">
                            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nom du modèle..." className="flex-grow"/>
                            <Button onClick={handleSaveTemplate} disabled={!templateName} icon={<Save size={16}/>}>Sauvegarder</Button>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-700 mb-2">Charger un modèle</h4>
                        <Select onChange={(e) => handleLoadTemplate(e.target.value)} options={[{value: '', label: 'Choisir...'}, ...savedTemplates.map(t => ({ value: t.name, label: t.name }))]}/>
                    </div>
                    <div className="text-center pt-4">
                        <Button size="lg" variant="primary" icon={<Download size={20}/>} onClick={handleExportExcel} disabled={isExporting}>
                            {isExporting ? 'Génération en cours...' : 'Générer et Exporter'}
                        </Button>
                    </div>
                </div>
            </div>
        );
      default:
        return <div>Étape inconnue</div>;
    }
  };

  const handleNext = () => {
    if (step < 4) {
      if (step === 1) setConfig(prev => ({...prev, fields: new Set()}));
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Assistant de Rapport en Excel</h2>
      <div className="mb-6"><div className="h-2 w-full bg-gray-200 rounded"><div style={{ width: `${(step / 4) * 100}%`}} className="h-2 bg-blue-500 rounded transition-all duration-300"></div></div></div>
      <div className="min-h-[300px]">{renderStepContent()}</div>
      <div className="flex justify-between mt-8 pt-4 border-t">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}><ArrowLeft className="mr-2 h-4 w-4" /> Précédent</Button>
        <Button variant="primary" onClick={handleNext} disabled={step === 4 || (step === 1 && !config.reportType) || (step === 3 && config.fields.size === 0)}>Suivant <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </Card>
  );
};

export default CustomReportWizard;
