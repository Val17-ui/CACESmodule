import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FormParticipant,
  VotingDevice,
  Session as DBSession,
  Participant as DBParticipantType,
} from '@common/types';

interface UseParticipantManagerProps {
  initialParticipants: FormParticipant[];
  initialAssignments: Record<number, { id: string; assignedGlobalDeviceId: number | null }[]>;
  editingSessionData: DBSession | null;
  selectedKitIdState: number | null;
  votingDevicesInSelectedKit: VotingDevice[];
}

export const useParticipantManager = ({
  initialParticipants,
  initialAssignments,
  editingSessionData,
  selectedKitIdState,
  votingDevicesInSelectedKit,
}: UseParticipantManagerProps) => {
  const [participants, setParticipants] = useState<FormParticipant[]>(initialParticipants);
  const [participantAssignments, setParticipantAssignments] = useState(initialAssignments);
  const [modifiedAfterOrsGeneration, setModifiedAfterOrsGeneration] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const handleAddParticipant = () => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (!selectedKitIdState) {
      alert("Veuillez d'abord sélectionner un kit de boîtiers dans l'onglet 'Participants'.");
      // Consider a better way to communicate this to the user, perhaps by disabling the button
      return;
    }
    if (votingDevicesInSelectedKit.length === 0) {
      alert("Le kit sélectionné ne contient aucun boîtier. Veuillez ajouter des boîtiers au kit ou en sélectionner un autre.");
      return;
    }

    const assignedDeviceIds = participants.map(p => p.assignedGlobalDeviceId).filter(id => id !== null);
    const nextAvailableDevice = votingDevicesInSelectedKit.find(d => !assignedDeviceIds.includes(d.id));

    const newParticipant: FormParticipant = {
      nom: '',
      prenom: '',
      identificationCode: '',
      score: undefined,
      reussite: undefined,
      assignedGlobalDeviceId: nextAvailableDevice?.id || null,
      statusInSession: 'present',
      uiId: Date.now().toString(),
      firstName: '',
      lastName: '',
      organization: '',
      deviceId: null,
      hasSigned: false,
    };
    setParticipants(prev => [...prev, newParticipant]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    setParticipants(prev => prev.filter(p => p.uiId !== id));
    setParticipantAssignments(prev => {
        const newAssignments = { ...prev };
        Object.keys(newAssignments).forEach(iterIndex => {
            const index = parseInt(iterIndex, 10);
            newAssignments[index] = (newAssignments[index] || []).filter(p => p.id !== id);
        });
        return newAssignments;
    });
  };

  const handleParticipantChange = (id: string, field: keyof FormParticipant, value: string | number | boolean | null) => {
    if (editingSessionData?.orsFilePath && field !== 'deviceId' && editingSessionData.status !== 'completed') {
      setModifiedAfterOrsGeneration(true);
    }
    setParticipants(prev => prev.map((p: FormParticipant) => {
      if (p.uiId === id) {
        const updatedP = { ...p, [field]: value };
        if (field === 'firstName') updatedP.prenom = value as string;
        if (field === 'lastName') updatedP.nom = value as string;
        return updatedP;
      }
      return p;
    }));
  };

  const handleParticipantIterationChange = (participantUiId: string, newIterationIndex: number) => {
    setParticipantAssignments(prev => {
        const newAssignments = { ...prev };
        const participantToMove = participants.find(p => p.uiId === participantUiId);
        if (!participantToMove) {
            console.warn(`[IterationChange] Participant with uiId ${participantUiId} not found in state.`);
            return prev;
        }

        Object.keys(newAssignments).forEach(iterIndex => {
            const index = parseInt(iterIndex, 10);
            newAssignments[index] = (newAssignments[index] || []).filter(p => p.id !== participantUiId);
        });

        if (!newAssignments[newIterationIndex]) {
            newAssignments[newIterationIndex] = [];
        }
        newAssignments[newIterationIndex].push({ id: participantToMove.uiId, assignedGlobalDeviceId: participantToMove.assignedGlobalDeviceId || null });

        return newAssignments;
    });
  };

  const parseCsvParticipants = (fileContent: string): Array<Partial<DBParticipantType>> => {
    const parsed: Array<Partial<DBParticipantType>> = [];
    const lines = fileContent.split(/\r\n|\n/);
    lines.forEach(line => {
      if (line.trim() === '') return;
      const values = line.split(',');
      if (values.length >= 2) {
        parsed.push({
          prenom: values[0]?.trim() || '', nom: values[1]?.trim() || '',
          organization: values[2]?.trim() || '', identificationCode: values[3]?.trim() || '',
        });
      }
    });
    return parsed;
  };

  const parseExcelParticipants = (data: Uint8Array): Array<Partial<DBParticipantType> & { iteration?: number }> => {
    const parsed: Array<Partial<DBParticipantType> & { iteration?: number }> = [];
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    if (jsonData.length === 0) return parsed;
    let headers: string[] = [];
    let dataStartIndex = 0;
    const potentialHeaders = jsonData[0].map((h: any) => h.toString().toLowerCase());
    const hasPrenom = potentialHeaders.includes('prénom') || potentialHeaders.includes('prenom');
    const hasNom = potentialHeaders.includes('nom');
    if (hasPrenom && hasNom) {
      headers = potentialHeaders; dataStartIndex = 1;
    } else {
      headers = ['prénom', 'nom', 'organisation', 'code identification', 'itération']; dataStartIndex = 0;
    }
    const prenomIndex = headers.findIndex(h => h === 'prénom' || h === 'prenom');
    const nomIndex = headers.findIndex(h => h === 'nom');
    const orgIndex = headers.findIndex(h => h === 'organisation');
    const codeIndex = headers.findIndex(h => h === 'code identification' || h === 'code');
    const iterationIndex = headers.findIndex(h => h === 'itération' || h === 'iteration');
    for (let i = dataStartIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.toString().trim() !== '')) {
        const prenom = prenomIndex !== -1 ? row[prenomIndex]?.toString().trim() || '' : row[0]?.toString().trim() || '';
        const nom = nomIndex !== -1 ? row[nomIndex]?.toString().trim() || '' : row[1]?.toString().trim() || '';
        if (prenom || nom) {
            parsed.push({
            prenom, nom,
            organization: orgIndex !== -1 ? row[orgIndex]?.toString().trim() || '' : row[2]?.toString().trim() || '',
            identificationCode: codeIndex !== -1 ? row[codeIndex]?.toString().trim() || '' : row[3]?.toString().trim() || '',
            iteration: iterationIndex !== -1 ? parseInt(row[iterationIndex]?.toString().trim(), 10) : 1,
            });
        }
      }
    }
    return parsed;
  };

  const addImportedParticipants = (
    parsedData: Array<Partial<DBParticipantType> & { iteration?: number }>,
    fileName: string
  ) => {
    if (editingSessionData?.orsFilePath && editingSessionData.status !== 'completed') { setModifiedAfterOrsGeneration(true); }
    if (parsedData.length > 0) {
      const newFormParticipants: FormParticipant[] = parsedData.map((p, index) => ({
        nom: p.nom || '',
        prenom: p.prenom || '',
        identificationCode: p.identificationCode || '',
        score: undefined,
        reussite: undefined,
        assignedGlobalDeviceId: null,
        statusInSession: 'present',
        uiId: `imported-${Date.now()}-${index}`,
        firstName: p.prenom || '',
        lastName: p.nom || '',
        organization: (p as any).organization || '',
        deviceId: null,
        hasSigned: false,
      }));
      setParticipants(prev => [...prev, ...newFormParticipants]);
      setParticipantAssignments(prev => {
        const newAssignments = { ...prev };
        newFormParticipants.forEach((p, index) => {
          const parsedInfo = parsedData[index];
          const targetIteration = parsedInfo?.iteration || 1;
          const iterationIndex = targetIteration - 1;
          if (!newAssignments[iterationIndex]) {
            newAssignments[iterationIndex] = [];
          }
          newAssignments[iterationIndex].push({ id: p.uiId, assignedGlobalDeviceId: p.assignedGlobalDeviceId || null });
        });
        return newAssignments;
      });
      setImportSummary(`${parsedData.length} participants importés de ${fileName}. Assignez les boîtiers.`);
    } else {
      setImportSummary(`Aucun participant valide trouvé dans ${fileName}.`);
    }
  };

  const handleParticipantFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportSummary(`Import du fichier ${file.name}...`);
    try {
      let parsedData: Array<Partial<DBParticipantType>> = [];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          parsedData = parseCsvParticipants(text);
          addImportedParticipants(parsedData, file.name);
        };
        reader.onerror = () => setImportSummary(`Erreur lecture fichier CSV: ${reader.error}`);
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result as ArrayBuffer;
          const byteArray = new Uint8Array(data);
          parsedData = parseExcelParticipants(byteArray);
          addImportedParticipants(parsedData, file.name);
        };
        reader.onerror = () => setImportSummary(`Erreur lecture fichier Excel: ${reader.error}`);
        reader.readAsArrayBuffer(file);
      } else {
        setImportSummary(`Type de fichier non supporté: ${file.name}`);
      }
    } catch (error: any) {
      setImportSummary(`Erreur import: ${error.message}`);
      console.error("Erreur import participants:", error);
    } finally {
      if (event.target) { event.target.value = ''; }
    }
  };

  return {
    participants,
    setParticipants,
    participantAssignments,
    setParticipantAssignments,
    handleAddParticipant,
    handleRemoveParticipant,
    handleParticipantChange,
    handleParticipantIterationChange,
    handleParticipantFileSelect,
    importSummary,
    modifiedAfterOrsGeneration,
  };
};
