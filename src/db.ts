// Ce fichier sert maintenant de couche d'abstraction pour communiquer
// avec le processus principal (et donc SQLite) via IPC.
// Les opérations Dexie ont été remplacées par des appels window.electronAPI.invoke(...).

import {
  // CACESReferential, // Utilisé dans BlockUsage, à voir si ce type est toujours pertinent ici
  Session, SessionResult, Trainer,
  SessionQuestion, SessionBoitier, Referential, Theme, Bloc,
  QuestionWithId, VotingDevice,
  DeviceKit, DeviceKitAssignment, Participant // Participant ajouté pour la signature de Session
} from './types'; // Assurez-vous que ce chemin est correct et que les types sont disponibles
import { logger } from './utils/logger'; // Maintenu, en supposant qu'il est configuré pour le renderer

// Helper pour gérer la réponse IPC standardisée
async function handleIPCResponse<T>(promise: Promise<{ success: boolean; data?: T; message?: string; id?: number }>): Promise<T> {
  const response = await promise;
  if (response.success) {
    // Si un ID est retourné (pour les opérations 'add'), on le priorise comme data si data n'est pas défini.
    // Sinon, on retourne data. Si ni data ni id n'est pertinent, T pourrait être void.
    return (response.data !== undefined ? response.data : response.id) as T;
  } else {
    logger.error(`Erreur IPC: ${response.message}`, { response });
    throw new Error(response.message || "Erreur IPC inconnue.");
  }
}

async function handleIPCResponseVoid(promise: Promise<{ success: boolean; message?: string }>): Promise<void> {
  const response = await promise;
  if (!response.success) {
    logger.error(`Erreur IPC (void): ${response.message}`, { response });
    throw new Error(response.message || "Erreur IPC inconnue (void).");
  }
}


// Fonctions CRUD pour Questions
export const addQuestion = async (question: Omit<QuestionWithId, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  // Le type QuestionWithId peut avoir des champs optionnels comme createdAt, etc.
  // L'handler IPC 'add-question' attend un objet correspondant à QuestionData dans main.ts
  // Assurez-vous que les types sont compatibles ou transformez l'objet 'question' ici si nécessaire.
  // Par exemple, si QuestionWithId a 'image' comme File/Blob et que l'IPC attend un Buffer.
  // Pour l'instant, on suppose une compatibilité directe ou une gestion de la conversion avant l'appel.

  // Exemple de conversion si question.image est un Blob et que l'IPC attend un Buffer:
  let imageBuffer: Buffer | undefined | null = undefined;
  if (question.image instanceof Blob) {
    imageBuffer = Buffer.from(await question.image.arrayBuffer());
  } else if (question.image === null) {
    imageBuffer = null;
  }

  const questionDataForIPC = {
    ...question,
    image: imageBuffer, // Utiliser le buffer converti
    // les champs comme createdAt/updatedAt ne sont pas envoyés car gérés par la DB/main process
  };

  return handleIPCResponse<number>(window.electronAPI.invoke('add-question', questionDataForIPC));
};

export const getGlobalPptxTemplate = async (): Promise<File | null> => {
  // Cette fonction est spécifique à Dexie et à la manière dont les fichiers sont stockés.
  // Pour SQLite, si le template est stocké comme un BLOB dans adminSettings :
  try {
    const response = await window.electronAPI.invoke('get-admin-setting', 'pptxTemplateFile');
    if (response.success && response.data) {
      // response.data serait un Buffer ou une représentation du BLOB.
      // Il faut le convertir en File.
      // Cela suppose que le nom du fichier est aussi stocké ou est standard.
      const fileNameResponse = await window.electronAPI.invoke('get-admin-setting', 'pptxTemplateFileName');
      const fileName = (fileNameResponse.success && fileNameResponse.data) ? fileNameResponse.data : 'template.pptx';

      if (response.data instanceof Buffer || (response.data.type === 'Buffer' && Array.isArray(response.data.data))) {
        const buffer = response.data instanceof Buffer ? response.data : Buffer.from(response.data.data);
        // Le type MIME pourrait aussi être stocké, ou déduit.
        return new File([buffer], fileName, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      }
      logger.warn("Le modèle PPTX récupéré n'est pas un Buffer attendu.", {data: response.data});
      return null;
    }
    return null;
  } catch (error) {
    logger.error("Erreur lors de la récupération du modèle PPTX global via IPC:", { error });
    return null;
  }
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  return handleIPCResponse<QuestionWithId[]>(window.electronAPI.invoke('get-all-questions'));
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  const response = await window.electronAPI.invoke('get-question-by-id', id);
  if (response.success) {
    return response.data as QuestionWithId | undefined;
  } else {
    // Si non trouvé, le handler retourne success: false. On pourrait retourner undefined ici.
    logger.warn(`Question ID ${id} non trouvée via IPC: ${response.message}`);
    return undefined;
  }
};

export const updateQuestion = async (id: number, updates: Partial<Omit<QuestionWithId, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number | undefined> => {
  // Gérer la conversion de l'image si elle est présente dans updates
  let imageBuffer: Buffer | undefined | null = undefined;
  let processedUpdates = { ...updates };

  if (updates.image !== undefined) {
    if (updates.image instanceof Blob) {
      imageBuffer = Buffer.from(await updates.image.arrayBuffer());
      processedUpdates = { ...processedUpdates, image: imageBuffer };
    } else if (updates.image === null) {
      processedUpdates = { ...processedUpdates, image: null };
    } else if (updates.image instanceof Buffer) { // déjà un buffer
        processedUpdates = { ...processedUpdates, image: updates.image };
    } else {
      // Si ce n'est ni Blob, ni null, ni Buffer, on pourrait choisir de ne pas l'envoyer
      // ou de logger une erreur si on s'attendait à un de ces types.
      logger.warn("Format d'image non géré dans updateQuestion, l'image ne sera pas mise à jour.", {imageField: updates.image});
      delete processedUpdates.image; // Ne pas envoyer un type incorrect
    }
  }
  await handleIPCResponseVoid(window.electronAPI.invoke('update-question', id, processedUpdates));
  return id; // Dexie update retournait le nombre de clés affectées (1 si succès), ou l'id. Ici on simule avec l'id.
};

export const deleteQuestion = async (id: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-question', id));
};

// --- CRUD pour DeviceKits ---
export const addDeviceKit = async (kit: Omit<DeviceKit, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-device-kit', kit));
};

export const getAllDeviceKits = async (): Promise<DeviceKit[]> => {
  return handleIPCResponse<DeviceKit[]>(window.electronAPI.invoke('get-all-device-kits'));
};

export const getDeviceKitById = async (id: number): Promise<DeviceKit | undefined> => {
   const response = await window.electronAPI.invoke('get-device-kit-by-id', id);
   return response.success ? response.data as DeviceKit | undefined : undefined;
};

export const updateDeviceKit = async (id: number, updates: Partial<Omit<DeviceKit, 'id'>>): Promise<number | undefined> => {
  await handleIPCResponseVoid(window.electronAPI.invoke('update-device-kit', id, updates));
  return id;
};

export const deleteDeviceKit = async (id: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-device-kit', id));
};

export const getDefaultDeviceKit = async (): Promise<DeviceKit | undefined> => {
  const response = await window.electronAPI.invoke('get-default-device-kit');
  return response.success ? response.data as DeviceKit | undefined : undefined;
};

export const setDefaultDeviceKit = async (kitId: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('set-default-device-kit', kitId));
};

// --- CRUD pour DeviceKitAssignments ---
export const assignDeviceToKit = async (kitId: number, votingDeviceId: number): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('assign-device-to-kit', kitId, votingDeviceId));
};

export const removeDeviceFromKit = async (kitId: number, votingDeviceId: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('remove-device-from-kit', kitId, votingDeviceId));
};

export const getVotingDevicesForKit = async (kitId: number): Promise<VotingDevice[]> => {
  return handleIPCResponse<VotingDevice[]>(window.electronAPI.invoke('get-voting-devices-for-kit', kitId));
};

export const getKitsForVotingDevice = async (votingDeviceId: number): Promise<DeviceKit[]> => {
  return handleIPCResponse<DeviceKit[]>(window.electronAPI.invoke('get-kits-for-voting-device', votingDeviceId));
};

// removeAssignmentsByKitId et removeAssignmentsByVotingDeviceId sont principalement utilisés côté DB/main.
// Si le renderer a besoin de les appeler, il faudrait ajouter des handlers IPC.

// --- Fonctions de récupération spécifiques par ID (si non existantes ou différentes) ---
export const getReferentialById = async (id: number): Promise<Referential | undefined> => {
  const response = await window.electronAPI.invoke('get-referentiel-by-id', id);
  return response.success ? response.data as Referential | undefined : undefined;
};

export const getThemeById = async (id: number): Promise<Theme | undefined> => {
  const response = await window.electronAPI.invoke('get-theme-by-id', id);
  return response.success ? response.data as Theme | undefined : undefined;
};

export const getBlocById = async (id: number): Promise<Bloc | undefined> => {
  const response = await window.electronAPI.invoke('get-bloc-by-id', id);
  return response.success ? response.data as Bloc | undefined : undefined;
};

export const getQuestionsByBlocId = async (blocId: number): Promise<QuestionWithId[]> => {
  return handleIPCResponse<QuestionWithId[]>(window.electronAPI.invoke('get-questions-by-bloc-id', blocId));
};

// getBlocByCodeAndThemeId - Ajouter un handler IPC si nécessaire. Pour l'instant, non porté.

export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  // Dexie `bulkGet` est pratique. Pour SQLite, on pourrait faire un `WHERE id IN (...)`.
  // Il faudrait un handler IPC spécifique pour cela: 'get-questions-by-ids'
  // Pour l'instant, on peut simuler par des appels multiples, ou attendre d'implémenter le handler.
  // Simulation (moins performante) :
  // const questions = await Promise.all(ids.map(id => getQuestionById(id)));
  // return questions.filter(q => q !== undefined) as QuestionWithId[];
  // Ou, mieux, implémenter 'get-questions-by-ids' côté main.
  // Supposons qu'il existe :
  return handleIPCResponse<QuestionWithId[]>(window.electronAPI.invoke('get-questions-by-ids', ids));
  // **Action requise**: Ajouter un handler `get-questions-by-ids` dans `main.ts` s'il est utilisé.
};

// --- Fonctions de Reporting ---
// calculateBlockUsage - Cette fonction contient une logique métier complexe.
// Elle pourrait être portée dans le processus principal si la performance est un problème,
// ou si l'accès direct aux données est plus simple là-bas.
// Pour l'instant, si elle doit rester côté renderer, elle doit appeler les IPC nécessaires
// pour récupérer les sessions, référentiels, thèmes, blocs.
// La version actuelle utilise directement db.sessions.toArray() etc. qui ne fonctionneront plus.
// Cette fonction nécessite une refonte significative.
// Exemple de refonte partielle (conceptuelle) :
/*
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  const sessionsResponse = await window.electronAPI.invoke('get-all-sessions-with-participants'); // Ou une version filtrée par date
  if (!sessionsResponse.success) throw new Error(sessionsResponse.message);
  const allSessions: Session[] = sessionsResponse.data;

  // Filtrer les sessions par date et statut ici, côté renderer
  // ...

  const referentielsResponse = await window.electronAPI.invoke('get-all-referentiels');
  // ... et ainsi de suite pour themes, blocs
  // ... puis appliquer la logique de comptage.
  logger.warn("calculateBlockUsage n'est pas entièrement porté sur IPC et nécessite une refonte.");
  return []; // Placeholder
};
*/
// **Action requise**: Refondre `calculateBlockUsage` pour utiliser les appels IPC.

// --- Nouvelles fonctions CRUD pour Sessions ---
export const addSession = async (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<number | undefined> => {
  // La structure de Session dans types.ts inclut participants: Participant[]
  // L'handler 'add-session' s'attend à ce que ce champ soit présent.
  // Si session.donneesOrs est un Blob, il faudra le convertir en Buffer.
  let donneesOrsBuffer: Buffer | undefined | null = undefined;
  if (session.donneesOrs instanceof Blob) {
    donneesOrsBuffer = Buffer.from(await session.donneesOrs.arrayBuffer());
  } else if (session.donneesOrs === null) {
    donneesOrsBuffer = null;
  }

  const sessionDataForIPC = {
      ...session,
      donneesOrs: donneesOrsBuffer,
  };
  const response = await window.electronAPI.invoke('add-session', sessionDataForIPC);
  if (response.success) {
    // Logique de logger originale
    logger.info(`Session créée : "${session.nomSession}" via IPC`, {
      eventType: 'SESSION_CREATED_IPC', // Adapter eventType si besoin
      sessionId: response.id,
      sessionName: session.nomSession,
      referentialId: session.referentielId,
      participantsCount: session.participants?.length || 0
    });
    return response.id;
  } else {
    logger.error(`Erreur IPC lors de la création de la session "${session.nomSession}"`, { error: response.message, sessionDetails: session });
    throw new Error(response.message || "Erreur inconnue lors de l'ajout de la session.");
  }
};

export const getAllSessions = async (): Promise<Session[]> => {
  // L'handler 'get-all-sessions-with-participants' inclut déjà les participants.
  return handleIPCResponse<Session[]>(window.electronAPI.invoke('get-all-sessions-with-participants'));
};

export const getSessionById = async (id: number): Promise<Session | undefined> => {
  const response = await window.electronAPI.invoke('get-session-by-id', id);
  return response.success ? response.data as Session | undefined : undefined;
};

export const updateSession = async (id: number, updates: Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>>): Promise<number | undefined> => {
  let processedUpdates = { ...updates };
  if (updates.donneesOrs !== undefined) {
    if (updates.donneesOrs instanceof Blob) {
      processedUpdates = { ...processedUpdates, donneesOrs: Buffer.from(await updates.donneesOrs.arrayBuffer())};
    } else if (updates.donneesOrs === null) {
      processedUpdates = { ...processedUpdates, donneesOrs: null };
    } else if (updates.donneesOrs instanceof Buffer) {
        processedUpdates = { ...processedUpdates, donneesOrs: updates.donneesOrs };
    } else {
      logger.warn("Format de donneesOrs non géré dans updateSession.", {donneesOrs: updates.donneesOrs});
      delete processedUpdates.donneesOrs;
    }
  }

  const response = await window.electronAPI.invoke('update-session', id, processedUpdates);
  if (response.success) {
    logger.info(`Session modifiée ID : "${id}" via IPC`, { eventType: 'SESSION_UPDATED_IPC', sessionId: id, updatedFields: Object.keys(updates) });
    return id;
  } else {
    logger.error(`Erreur IPC lors de la modification de la session ID ${id}`, { error: response.message, updates });
    throw new Error(response.message || "Erreur inconnue lors de la mise à jour de la session.");
  }
};

export const deleteSession = async (id: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-session', id));
};

// --- Nouvelles fonctions CRUD pour SessionResults ---
export const addSessionResult = async (result: Omit<SessionResult, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-session-result', result));
};

export const addBulkSessionResults = async (results: SessionResult[]): Promise<(number | undefined)[]> => {
  // L'handler 'add-bulk-session-results' ne retourne pas les IDs.
  // Si les IDs sont nécessaires, l'handler IPC doit être modifié.
  // Pour l'instant, on simule le retour Dexie (qui pouvait retourner les clés).
  await handleIPCResponseVoid(window.electronAPI.invoke('add-bulk-session-results', results));
  // On ne peut pas facilement retourner les IDs ici sans changer l'IPC.
  // Retourner un tableau de 'undefined' de la bonne longueur ou lever une exception si ce retour est critique.
  logger.warn("addBulkSessionResults via IPC ne retourne pas les IDs individuels actuellement.");
  return results.map(() => undefined); // Placeholder
};

export const getAllResults = async (): Promise<SessionResult[]> => {
    // Il n'y a pas d'handler 'get-all-results'. Si nécessaire, il faut le créer.
    // Cette fonction n'était pas dans la liste des opérations typiques.
    logger.warn("getAllResults n'a pas d'handler IPC direct. Implémenter si nécessaire.");
    return []; // Placeholder
};

export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  return handleIPCResponse<SessionResult[]>(window.electronAPI.invoke('get-session-results-by-session-id', sessionId));
};

// getResultBySessionAndQuestion - Pas d'handler IPC direct. Combiner les appels ou créer un handler spécifique.
// updateSessionResult - Pas d'handler IPC direct.
// deleteResultsForSession - Pas d'handler IPC direct, mais 'delete-session-results-by-session-id' existe.

// --- Fonctions pour AdminSettings ---
export const getAdminSetting = async (key: string): Promise<any> => {
  const response = await window.electronAPI.invoke('get-admin-setting', key);
  // La fonction originale retournait `setting?.value`. L'IPC retourne `data`.
  return response.success ? response.data : undefined;
};

export const setAdminSetting = async (key: string, value: any): Promise<void> => {
  // Si value est un File/Blob (ex: pptxTemplateFile), il faut le convertir en Buffer avant IPC.
  let valueForIPC = value;
  if (value instanceof File || value instanceof Blob) {
    logger.info(`Conversion de ${key} (File/Blob) en Buffer pour IPC.`);
    valueForIPC = Buffer.from(await (value as Blob).arrayBuffer());
    // Il faudrait aussi stocker le nom du fichier et le type MIME séparément si on veut reconstruire un File.
    // Par exemple, appeler setAdminSetting pour 'pptxTemplateFileName' et 'pptxTemplateFileType'.
    if (value instanceof File) {
        await window.electronAPI.invoke('set-admin-setting', `${key}Name`, value.name);
        await window.electronAPI.invoke('set-admin-setting', `${key}Type`, value.type);
    }
  }
  return handleIPCResponseVoid(window.electronAPI.invoke('set-admin-setting', key, valueForIPC));
};

export const getAllAdminSettings = async (): Promise<Record<string, any>> => {
  // La fonction originale retournait un tableau {key, value}[]. L'IPC retourne un objet Record<string, any>.
  // Adapter si le format tableau est strictement nécessaire par les composants.
  return handleIPCResponse<Record<string, any>>(window.electronAPI.invoke('get-all-admin-settings'));
};

// --- Fonctions CRUD pour VotingDevices ---
export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-voting-device', device));
};

export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  return handleIPCResponse<VotingDevice[]>(window.electronAPI.invoke('get-all-voting-devices'));
};

export const updateVotingDevice = async (id: number, updates: Partial<VotingDevice>): Promise<number> => {
  // L'IPC ne retourne pas l'ID, mais la fonction Dexie le faisait (implicitement 1 si succès).
  await handleIPCResponseVoid(window.electronAPI.invoke('update-voting-device', id, updates));
  return 1; // Simule le retour de Dexie (nombre d'enregistrements affectés)
};

export const deleteVotingDevice = async (id: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-voting-device', id));
};

export const bulkAddVotingDevices = async (devices: VotingDevice[]): Promise<void> => {
  // La fonction Dexie ne retournait pas les clés, donc void est OK.
  return handleIPCResponseVoid(window.electronAPI.invoke('bulk-add-voting-devices', devices.map(d => ({name: d.name, serialNumber: d.serialNumber}))));
};

// --- Fonctions CRUD pour Trainers ---
export const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-trainer', trainer));
};

export const getAllTrainers = async (): Promise<Trainer[]> => {
  return handleIPCResponse<Trainer[]>(window.electronAPI.invoke('get-all-trainers'));
};

export const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
  const response = await window.electronAPI.invoke('get-trainer-by-id', id);
  return response.success ? response.data as Trainer | undefined : undefined;
};

export const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
  await handleIPCResponseVoid(window.electronAPI.invoke('update-trainer', id, updates));
  return id; // Similaire à Dexie qui pouvait retourner l'ID ou le nombre d'affectations.
};

export const deleteTrainer = async (id: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-trainer', id));
};

export const setDefaultTrainer = async (id: number): Promise<number | undefined> => {
  await handleIPCResponseVoid(window.electronAPI.invoke('set-default-trainer', id));
  return id;
};

export const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
  const response = await window.electronAPI.invoke('get-default-trainer');
  return response.success ? response.data as Trainer | undefined : undefined;
};

// --- CRUD pour SessionQuestion (Snapshots) ---
export const addSessionQuestion = async (sq: Omit<SessionQuestion, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-session-question', sq));
};

export const addBulkSessionQuestions = async (questions: SessionQuestion[]): Promise<(number | undefined)[]> => {
  // L'IPC attend (sessionId, questionsDataSansSessionId).
  // Si les SessionQuestion[] ont déjà sessionId, il faut extraire.
  // Supposons pour l'instant que le premier élément a le bon sessionId et que tous les autres aussi.
  if (questions.length === 0) return [];
  const sessionId = questions[0].sessionId;
  const questionsData = questions.map(q => {
      const {sessionId, ...rest} = q; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
  });
  await handleIPCResponseVoid(window.electronAPI.invoke('add-bulk-session-questions', sessionId, questionsData));
  logger.warn("addBulkSessionQuestions via IPC ne retourne pas les IDs individuels actuellement.");
  return questions.map(() => undefined); // Placeholder
};

export const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
  return handleIPCResponse<SessionQuestion[]>(window.electronAPI.invoke('get-session-questions-by-session-id', sessionId));
};

export const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-session-questions-by-session-id', sessionId));
};

// --- CRUD pour SessionBoitier (Snapshots) ---
export const addSessionBoitier = async (sb: Omit<SessionBoitier, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-session-boitier', sb));
};

export const addBulkSessionBoitiers = async (boitiers: SessionBoitier[]): Promise<(number|undefined)[]> => {
  if (boitiers.length === 0) return [];
  const sessionId = boitiers[0].sessionId;
  const boitiersData = boitiers.map(b => {
      const {sessionId, ...rest} = b; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
  });
  await handleIPCResponseVoid(window.electronAPI.invoke('add-bulk-session-boitiers', sessionId, boitiersData));
  logger.warn("addBulkSessionBoitiers via IPC ne retourne pas les IDs individuels actuellement.");
  return boitiers.map(() => undefined); // Placeholder
};

export const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
  return handleIPCResponse<SessionBoitier[]>(window.electronAPI.invoke('get-session-boitiers-by-session-id', sessionId));
};

export const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
  return handleIPCResponseVoid(window.electronAPI.invoke('delete-session-boitiers-by-session-id', sessionId));
};

// --- CRUD pour Referentiels (déjà définis dans votre code SQLite, ici on les mappe à IPC) ---
export const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-referentiel', referential.code, referential.nom_complet));
};

export const getAllReferentiels = async (): Promise<Referential[]> => {
  return handleIPCResponse<Referential[]>(window.electronAPI.invoke('get-all-referentiels'));
};

export const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
  // Il n'y a pas d'handler 'get-referential-by-code'. Il faudrait l'ajouter si nécessaire.
  // Ou filtrer côté renderer à partir de getAllReferentiels, moins optimal.
  logger.warn("getReferentialByCode n'a pas d'handler IPC direct. Implémenter si nécessaire.");
  const all = await getAllReferentiels();
  return all.find(r => r.code === code);
};

// --- CRUD pour Themes (déjà définis dans votre code SQLite, ici on les mappe à IPC) ---
export const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-theme', theme.code_theme, theme.nom_complet, theme.referentiel_id));
};

export const getAllThemes = async (): Promise<Theme[]> => {
  return handleIPCResponse<Theme[]>(window.electronAPI.invoke('get-all-themes'));
};

export const getThemesByReferentialId = async (referentielId: number): Promise<Theme[]> => {
  return handleIPCResponse<Theme[]>(window.electronAPI.invoke('get-themes-by-referentiel-id', referentielId));
};

// getThemeByCodeAndReferentialId - Pas d'handler IPC direct.

// --- CRUD pour Blocs (déjà définis dans votre code SQLite, ici on les mappe à IPC) ---
export const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
  return handleIPCResponse<number>(window.electronAPI.invoke('add-bloc', bloc.code_bloc, bloc.theme_id));
};

export const getAllBlocs = async (): Promise<Bloc[]> => {
  return handleIPCResponse<Bloc[]>(window.electronAPI.invoke('get-all-blocs'));
};

export const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
  return handleIPCResponse<Bloc[]>(window.electronAPI.invoke('get-blocs-by-theme-id', themeId));
};

// --- Fonctions manquantes ou à adapter ---
// getQuestionsForSessionBlocks: Cette fonction dépendait de la logique Dexie pour récupérer les questions.
// Elle devra être réécrite pour utiliser les appels IPC, potentiellement en récupérant tous les blocs
// puis toutes les questions pour ces blocs.
export const getQuestionsForSessionBlocks = async (selectedBlocIds?: number[]): Promise<QuestionWithId[]> => {
    if (!selectedBlocIds || selectedBlocIds.length === 0) {
        return [];
    }
    // Pour chaque blocId, récupérer les questions.
    // Cela peut entraîner plusieurs appels IPC.
    // Une alternative serait un handler IPC qui prend une liste de blocIds.
    let allQuestions: QuestionWithId[] = [];
    for (const blocId of selectedBlocIds) {
        const questionsForBloc = await getQuestionsByBlocId(blocId);
        allQuestions = allQuestions.concat(questionsForBloc);
    }
    // Éliminer les doublons si une question pouvait appartenir à plusieurs blocs sélectionnés (peu probable ici)
    const uniqueQuestions = Array.from(new Map(allQuestions.map(q => [q.id, q])).values());
    return uniqueQuestions;
};

// calculateBlockUsage: Comme mentionné, nécessite une refonte majeure pour utiliser IPC.
// Pour l'instant, je la commente ou la laisse comme placeholder.
/*
export interface BlockUsage {
  referentiel: CACESReferential | string; // Adapter CACESReferential si besoin
  theme: string;
  blockId: string;
  usageCount: number;
}
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  logger.warn("calculateBlockUsage IPC version non implémentée.");
  return [];
};
*/

// La table 'participants' générale (celle avec juste nom et id)
// Les fonctions addGeneralParticipant etc. sont déjà dans le fichier SQLite db.ts que j'ai généré.
// Ici, on s'assure qu'elles sont exposées si elles étaient dans l'ancien db.ts avec Dexie.
// Si votre ancien db.ts avait une fonction comme `addParticipant(nom: string)`, elle deviendrait:
/*
export const addParticipant = async (nom: string): Promise<number | undefined> => {
    return handleIPCResponse<number>(window.electronAPI.invoke('insert-participant', nom));
};
*/
// Les autres (getAll, getById, update, delete) pour cette table `participants` simple
// suivraient le même modèle, en appelant les handlers IPC 'get-all-general-participants', etc.

// NOTE: Ce fichier ne définit plus de classe Dexie ni n'exporte 'db'.
// Il exporte uniquement les fonctions qui interagissent avec le backend via IPC.
// Les importations initiales de Dexie et MySubClassedDexie sont donc supprimées.
// L'instance 'db' n'est plus utilisée ici.
// Les références à `db.table.operation` sont remplacées par `window.electronAPI.invoke`.
// Les fonctions .upgrade de Dexie ne sont plus pertinentes ici. La structure de la DB SQLite
// est gérée dans le src/db.ts du processus principal.

// Assurez-vous que window.electronAPI est bien typé dans un fichier de déclaration (par exemple, preload.d.ts ou renderer.d.ts)
// pour que TypeScript reconnaisse `invoke`.
// Exemple dans renderer.d.ts:
/*
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      // Vous pouvez aussi typer les canaux spécifiques si vous le souhaitez pour plus de sécurité
      // exemple: invoke(channel: 'get-all-questions'): Promise<{success: boolean, data: QuestionWithId[]}>;
    };
  }
}
*/
console.log("Couche d'accès aux données (frontend via IPC) initialisée.");
