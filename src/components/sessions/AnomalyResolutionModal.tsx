import React, { useState, useEffect } from 'react';
import { ExtractedResultFromXml } from '../../utils/resultsParser';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Input from '../ui/Input'; // Assurez-vous qu'il est bien importé

// Informations sur les réponses d'un boîtier attendu (pour savoir ce qui manque)
export interface ExpectedDeviceResponseInfo {
  respondedToQuestionsGuids: string[];
  responsesProvidedByExpected: ExtractedResultFromXml[];
  missedQuestionsGuids: string[];
  totalSessionQuestionsCount: number;
}

// Structure pour un boîtier attendu qui n'a pas fourni toutes les réponses
export interface ExpectedDeviceWithIssue {
  serialNumber: string;
  visualId: number;
  participantName: string;
  responseInfo: ExpectedDeviceResponseInfo;
}

// Structure pour un boîtier inconnu ayant répondu
export interface UnknownDeviceWithResponses {
  serialNumber: string;
  responses: ExtractedResultFromXml[];
}

import {
  ExpectedIssueAction,
  UnknownDeviceAction,
  ExpectedIssueResolution,
  UnknownDeviceResolution
} from '../../types'; // Importer les types déplacés

// Structure pour les anomalies détectées
export interface DetectedAnomalies {
  expectedHavingIssues: ExpectedDeviceWithIssue[];
  unknownThatResponded: UnknownDeviceWithResponses[];
}

// LES TYPES SUIVANTS ONT ÉTÉ DÉPLACÉS VERS src/types/index.ts
// // Actions pour un boîtier ATTENDU AYANT DES PROBLÈMES (muet total/partiel)
// export type ExpectedIssueAction =
//   | 'pending'
//   | 'mark_absent'
//   | 'aggregate_with_unknown'
//   | 'ignore_device';

// // Actions pour un boîtier INCONNU
// export type UnknownDeviceAction =
//   | 'pending'
//   | 'ignore_responses'
//   | 'add_as_new_participant';

// // Résolution pour un boîtier attendu ayant des problèmes
// export interface ExpectedIssueResolution {
//   serialNumber: string;
//   action: ExpectedIssueAction;
//   sourceUnknownSerialNumber?: string;
// }

// // Résolution pour un boîtier inconnu
// export interface UnknownDeviceResolution {
//   serialNumber: string;
//   action: UnknownDeviceAction;
//   newParticipantName?: string;
// }

interface AnomalyResolutionModalProps {
  isOpen: boolean;
  detectedAnomalies: DetectedAnomalies | null;
  pendingValidResults: ExtractedResultFromXml[];
  onResolve: (
    finalResultsToImport: ExtractedResultFromXml[],
    expectedIssueResolutions: ExpectedIssueResolution[],
    unknownDeviceResolutions: UnknownDeviceResolution[],
    updatedParticipantsData?: any[] // Ce paramètre semble inutilisé dans l'appel onResolve actuel
  ) => void;
  onCancel: () => void;
  availableUnknownsForAggregation?: Array<{ serialNumber: string, responseCount: number }>;
  // sessionQuestionsCount?: number; // Supprimé car non utilisé
}

const AnomalyResolutionModal: React.FC<AnomalyResolutionModalProps> = ({
  isOpen,
  detectedAnomalies,
  pendingValidResults,
  onResolve,
  onCancel,
  availableUnknownsForAggregation,
  // sessionQuestionsCount, // Supprimé de la déstructuration
}) => {
  const [expectedIssueResolutions, setExpectedIssueResolutions] = useState<ExpectedIssueResolution[]>([]);
  const [unknownDeviceResolutions, setUnknownDeviceResolutions] = useState<UnknownDeviceResolution[]>([]);
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(true);

  useEffect(() => {
    if (detectedAnomalies) {
      setExpectedIssueResolutions(
        (detectedAnomalies.expectedHavingIssues || []).map(e => ({
          serialNumber: e.serialNumber,
          action: 'pending',
        }))
      );
      setUnknownDeviceResolutions(
        (detectedAnomalies.unknownThatResponded || []).map(u => ({
          serialNumber: u.serialNumber,
          action: 'pending',
          newParticipantName: u.serialNumber // Pré-remplir avec SN comme placeholder
        }))
      );
    }
  }, [detectedAnomalies]);

  useEffect(() => {
    if (!detectedAnomalies) {
      setIsConfirmDisabled(true);
      return;
    }
    const totalExpectedIssues = detectedAnomalies.expectedHavingIssues?.length || 0;
    const totalUnknowns = detectedAnomalies.unknownThatResponded?.length || 0;

    const resolvedExpected = expectedIssueResolutions.filter(r => {
        if (r.action === 'pending') return false;
        if (r.action === 'aggregate_with_unknown' && !r.sourceUnknownSerialNumber) return false; // Invalide si pas de source
        return true;
    }).length;
    const resolvedUnknowns = unknownDeviceResolutions.filter(r => {
        if (r.action === 'pending') return false;
        if (r.action === 'add_as_new_participant' && (!r.newParticipantName || r.newParticipantName.trim() === '')) return false; // Invalide si nom vide
        return true;
    }).length;

    const allAnomaliesCount = totalExpectedIssues + totalUnknowns;
    const allResolvedCount = resolvedExpected + resolvedUnknowns;

    if (allAnomaliesCount === 0) {
      setIsConfirmDisabled(false);
    } else {
      // Vérifier aussi que si une action 'add_as_new_participant' est choisie, un nom est fourni.
      // Et si 'aggregate_with_unknown' est choisi, une source est sélectionnée.
      let allValidlyResolved = true;
      for (const res of expectedIssueResolutions) {
          if (res.action === 'aggregate_with_unknown' && !res.sourceUnknownSerialNumber) {
              allValidlyResolved = false;
              break;
          }
      }
      if (allValidlyResolved) {
          for (const res of unknownDeviceResolutions) {
              if (res.action === 'add_as_new_participant' && (!res.newParticipantName || res.newParticipantName.trim() === '')) {
                  allValidlyResolved = false;
                  break;
              }
          }
      }
      setIsConfirmDisabled(allResolvedCount !== allAnomaliesCount || !allValidlyResolved);
    }
  }, [expectedIssueResolutions, unknownDeviceResolutions, detectedAnomalies]);

  if (!isOpen || !detectedAnomalies) {
    return null;
  }

  const { expectedHavingIssues = [], unknownThatResponded = [] } = detectedAnomalies;

  const handleExpectedIssueActionChange = (
    serialNumber: string,
    action: ExpectedIssueAction,
    sourceUnknownSn?: string
  ) => {
    setExpectedIssueResolutions(prev =>
      prev.map(r => (r.serialNumber === serialNumber ? { ...r, action, sourceUnknownSerialNumber: sourceUnknownSn } : r))
    );
  };

  const handleUnknownDeviceActionChange = (
    serialNumber: string,
    action: UnknownDeviceAction,
    newName?: string
  ) => {
    setUnknownDeviceResolutions(prev =>
      prev.map(r => {
        if (r.serialNumber === serialNumber) {
          const nameToStore = action === 'add_as_new_participant' ? (newName !== undefined ? newName : r.newParticipantName) : undefined;
          return { ...r, action, newParticipantName: nameToStore };
        }
        return r;
      })
    );
  };

  const handleConfirm = () => {
    onResolve(
      pendingValidResults,
      expectedIssueResolutions,
      unknownDeviceResolutions
    );
  };

  const renderExpectedIssues = () => {
    if (!detectedAnomalies || expectedHavingIssues.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-red-600 mb-2">
          Boîtiers Attendus avec Réponses Manquantes ({expectedHavingIssues.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Visuel</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N Boîtier</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut Réponses</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expectedHavingIssues.map(e => {
                const currentResolution = expectedIssueResolutions.find(r => r.serialNumber === e.serialNumber);
                return (
                  <tr key={e.serialNumber}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{e.visualId}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{e.participantName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{e.serialNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500">
                      {e.responseInfo.respondedToQuestionsGuids.length} / {e.responseInfo.totalSessionQuestionsCount} répondues
                      ({e.responseInfo.missedQuestionsGuids.length} manquante(s))
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div className="flex flex-col space-y-1">
                        <Select
                          value={currentResolution?.action || 'pending'}
                          onChange={(event) => {
                            const action = event.target.value as ExpectedIssueAction;
                            const targetUnknown = action === 'aggregate_with_unknown' ? currentResolution?.sourceUnknownSerialNumber : undefined;
                            handleExpectedIssueActionChange(e.serialNumber, action, targetUnknown);
                          }}
                          options={[
                            { value: 'pending', label: 'Choisir une action...' },
                            { value: 'mark_absent', label: 'Marquer Participant Absent' },
                            { value: 'aggregate_with_unknown', label: 'Agréger avec réponses d\'un Inconnu...' },
                            { value: 'ignore_device', label: 'Ignorer ce Boîtier (et ses réponses partielles)' },
                          ]}
                          className="text-xs w-full"
                        />
                        {currentResolution?.action === 'aggregate_with_unknown' && (
                          <Select
                            value={currentResolution?.sourceUnknownSerialNumber || ''}
                            onChange={(event) => handleExpectedIssueActionChange(e.serialNumber, 'aggregate_with_unknown', event.target.value || undefined)}
                            options={[
                              { value: '', label: 'Choisir S/N inconnu source...' },
                              ...(availableUnknownsForAggregation || []).map(unk => ({
                                value: unk.serialNumber,
                                label: `Inconnu S/N: ${unk.serialNumber} (${unk.responseCount} rép.)`
                              }))
                            ]}
                            className="text-xs w-full mt-1"
                            disabled={!availableUnknownsForAggregation || availableUnknownsForAggregation.length === 0}
                          />
                        )}
                         {currentResolution?.action === 'aggregate_with_unknown' && (!availableUnknownsForAggregation || availableUnknownsForAggregation.length === 0) && (
                            <p className="text-xs text-yellow-600 mt-1">Aucun boîtier inconnu disponible pour l'agrégation.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

   const renderUnknownDevices = () => {
    if (!detectedAnomalies || unknownThatResponded.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-orange-600 mb-2">
          Boîtiers Inconnus Ayant Répondu ({unknownThatResponded.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N Boîtier Inconnu</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nb Réponses Fournies</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unknownThatResponded.map(u => {
                const currentResolution = unknownDeviceResolutions.find(r => r.serialNumber === u.serialNumber);
                const isUsedForAggregation = expectedIssueResolutions.some(
                  expectedRes => expectedRes.action === 'aggregate_with_unknown' && expectedRes.sourceUnknownSerialNumber === u.serialNumber
                );

                return (
                  <tr key={u.serialNumber}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{u.serialNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{u.responses.length}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div className="flex flex-col space-y-1">
                        {isUsedForAggregation ? (
                          <span className="text-xs text-blue-600 italic">Utilisé pour agréger avec un boîtier attendu.</span>
                        ) : (
                          <Select
                            value={currentResolution?.action || 'pending'}
                            onChange={(event) => {
                              const action = event.target.value as UnknownDeviceAction;
                              handleUnknownDeviceActionChange(u.serialNumber, action, currentResolution?.newParticipantName);
                            }}
                            options={[
                              { value: 'pending', label: 'Choisir une action...' },
                              { value: 'ignore_responses', label: 'Ignorer ces réponses' },
                              { value: 'add_as_new_participant', label: 'Ajouter comme Nouveau Participant' },
                            ]}
                            className="text-xs w-full"
                          />
                        )}
                        {currentResolution?.action === 'add_as_new_participant' && !isUsedForAggregation && (
                          <Input
                            type="text"
                            placeholder="Nom du nouveau participant"
                            value={currentResolution?.newParticipantName || `Inconnu ${u.serialNumber.slice(-4)}`}
                            onChange={(e) => handleUnknownDeviceActionChange(u.serialNumber, 'add_as_new_participant', e.target.value)}
                            className="text-xs mt-1 w-full"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center px-4 py-8">
      <Card title="Résolution des Anomalies d'Importation" className="bg-white p-4 md:p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto">
        <div className="mb-4">
          <p className="text-sm text-gray-700">
            Des anomalies ont été détectées. Veuillez choisir une action pour chaque cas.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {pendingValidResults.length} réponses de boîtiers attendus (sans anomalie directe de boîtier) seront incluses si vous validez.
          </p>
        </div>

        {renderExpectedIssues()}
        {renderUnknownDevices()}

        {(!detectedAnomalies || (expectedHavingIssues.length === 0 && unknownThatResponded.length === 0)) && (
            <p className="text-sm text-gray-600">Aucune anomalie de boîtier détectée nécessitant une résolution manuelle.</p>
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
// Les types ExpectedIssueResolution, UnknownDeviceResolution, ExpectedIssueAction, UnknownDeviceAction
// sont importés depuis ../../types et ne doivent pas être réexportés ici.
// Les types DetectedAnomalies, ExpectedDeviceWithIssue, UnknownDeviceWithResponses, ExpectedDeviceResponseInfo
// sont définis et exportés au début de ce fichier, donc pas besoin de les réexporter ici non plus.
// Supprimer cette section d'export pour éviter les conflits.