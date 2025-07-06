import React, { useState, useEffect } from 'react';
import { ExtractedResultFromXml } from '../../utils/resultsParser';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Select from '../ui/Select'; // Importer le composant Select

// Types pour les actions
type MuetAction = 'mark_absent' | 'pending' | 'aggregate'; // 'aggregate' pour plus tard
type InconnuAction = 'ignore' | 'add_participant' | 'assign_to_muet' | 'pending';

interface MuetResolution {
  serialNumber: string;
  action: MuetAction;
  // targetForAggregation?: string; // Pour l'action 'aggregate'
}

interface InconnuResolution {
  serialNumber: string;
  action: InconnuAction;
  // assignToVisualId?: number; // Pour l'action 'assign_to_muet'
  // newParticipantName?: string; // Pour l'action 'add_participant'
}

interface DetectedAnomalies {
  muets: Array<{ serialNumber: string; visualId: number; participantName: string; responses: ExtractedResultFromXml[] }>;
  inconnus: Array<{ serialNumber: string; responses: ExtractedResultFromXml[] }>;
}

interface AnomalyResolutionModalProps {
  isOpen: boolean;
  detectedAnomalies: DetectedAnomalies | null;
  pendingValidResults: ExtractedResultFromXml[];
  onResolve: (resolvedResults: ExtractedResultFromXml[], muetResolutions: MuetResolution[], inconnuResolutions: InconnuResolution[]) => void;
  onCancel: () => void;
}

const AnomalyResolutionModal: React.FC<AnomalyResolutionModalProps> = ({
  isOpen,
  detectedAnomalies,
  pendingValidResults, // Reçoit le tableau complet
  onResolve,
  onCancel,
}) => {
  const [muetResolutions, setMuetResolutions] = useState<MuetResolution[]>([]);
  const [inconnuResolutions, setInconnuResolutions] = useState<InconnuResolution[]>([]);
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(true);

  useEffect(() => {
    if (detectedAnomalies) {
      setMuetResolutions(
        (detectedAnomalies.muets || []).map(m => ({ serialNumber: m.serialNumber, action: 'pending' }))
      );
      setInconnuResolutions(
        (detectedAnomalies.inconnus || []).map(i => ({ serialNumber: i.serialNumber, action: 'pending' }))
      );
    }
  }, [detectedAnomalies]);

  useEffect(() => {
    // Vérifier si detectedAnomalies est non null avant d'accéder à ses propriétés
    const totalAnomalies = (detectedAnomalies?.muets?.length || 0) + (detectedAnomalies?.inconnus?.length || 0);
    const resolvedAnomalies = muetResolutions.filter(r => r.action !== 'pending').length +
                              inconnuResolutions.filter(r => r.action !== 'pending').length;

    if (totalAnomalies === 0) { // S'il n'y a pas d'anomalies à résoudre (cas peu probable si le modal est ouvert)
        setIsConfirmDisabled(false);
    } else {
        setIsConfirmDisabled(resolvedAnomalies !== totalAnomalies);
    }
  }, [muetResolutions, inconnuResolutions, detectedAnomalies]);

  if (!isOpen || !detectedAnomalies) {
    return null;
  }

  // Initialisation défensive des listes d'anomalies pour le rendu
  const muets = detectedAnomalies.muets || [];
  const inconnus = detectedAnomalies.inconnus || [];

  const handleMuetActionChange = (serialNumber: string, action: MuetAction) => {
    setMuetResolutions(prev =>
      prev.map(r => (r.serialNumber === serialNumber ? { ...r, action } : r))
    );
  };

  const handleInconnuActionChange = (serialNumber: string, action: InconnuAction) => {
    setInconnuResolutions(prev =>
      prev.map(r => (r.serialNumber === serialNumber ? { ...r, action } : r))
    );
  };

  const handleConfirm = () => {
    let finalResults = [...pendingValidResults];

    inconnuResolutions.forEach(resInconnu => {
      const inconnuData = detectedAnomalies.inconnus.find(i => i.serialNumber === resInconnu.serialNumber);
      if (inconnuData) {
        if (resInconnu.action === 'add_participant') { // Pour l'instant, 'add_participant' ajoute les réponses
          finalResults = finalResults.concat(inconnuData.responses);
        } else if (resInconnu.action === 'assign_to_muet') {
          // TODO: Logique d'assignation à un muet. Nécessite de savoir à QUI assigner.
          // Pour l'instant, on pourrait les ajouter, et le participantIdBoitier sera le serialNumber de l'inconnu.
          // La réassignation se ferait dans SessionForm après le retour du modal.
          // Ou alors, on modifie le participantIdBoitier ici si on a l'info.
          // Pour cette étape, on les ajoute tels quels.
          finalResults = finalResults.concat(inconnuData.responses);
        }
        // Si 'ignore' ou 'pending' (ce dernier ne devrait pas arriver si bouton activé), on ne fait rien = les réponses sont ignorées.
      }
    });
    onResolve(finalResults, muetResolutions, inconnuResolutions);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center px-4 py-8">
      <Card title="Résolution des Anomalies d'Importation" className="bg-white p-4 md:p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto">
        <div className="mb-4">
          <p className="text-sm text-gray-700">
            Des anomalies ont été détectées lors de l'importation des résultats.
            Veuillez choisir une action pour chaque anomalie listée ci-dessous.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {pendingValidResults.length} réponses de boîtiers attendus (sans anomalie de boîtier) seront incluses si vous validez.
          </p>
        </div>

        {muets.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Boîtiers Attendus Muets ({muets.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Visuel</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N Boîtier</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {muets.map((muet) => (
                    <tr key={`muet-${muet.serialNumber}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{muet.visualId}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{muet.participantName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{muet.serialNumber}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500">Muet</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <Select
                          value={muetResolutions.find(r => r.serialNumber === muet.serialNumber)?.action || 'pending'}
                          onChange={(e) => handleMuetActionChange(muet.serialNumber, e.target.value as MuetAction)}
                          options={[
                            { value: 'pending', label: 'Choisir une action...' },
                            { value: 'mark_absent', label: 'Marquer Absent' },
                            // { value: 'aggregate', label: 'Agréger avec...' }, // Pour plus tard
                          ]}
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {inconnus.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-orange-600 mb-2">Boîtiers Inconnus Ayant Répondu ({inconnus.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N Boîtier Inconnu</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nb Réponses</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inconnus.map((inconnu) => (
                    <tr key={`inconnu-${inconnu.serialNumber}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{inconnu.serialNumber}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{inconnu.responses.length}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-orange-500">Inconnu</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <Select
                          value={inconnuResolutions.find(r => r.serialNumber === inconnu.serialNumber)?.action || 'pending'}
                          onChange={(e) => handleInconnuActionChange(inconnu.serialNumber, e.target.value as InconnuAction)}
                          options={[
                            { value: 'pending', label: 'Choisir une action...' },
                            { value: 'ignore', label: 'Ignorer les réponses' },
                            { value: 'add_participant', label: 'Ajouter comme nouveau participant' },
                            // { value: 'assign_to_muet', label: 'Assigner à un boîtier muet...' }, // Pour plus tard
                          ]}
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Annuler l'Import
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isConfirmDisabled}>
            Valider et Importer
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AnomalyResolutionModal;
export type { DetectedAnomalies as AnomalyDataForModal, MuetResolution, InconnuResolution }; // Exporter les types pour SessionForm
