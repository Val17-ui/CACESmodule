import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import db, * as dbFunctions from './db'; // Importez la config DB et les fonctions CRUD

// Gestionnaire IPC pour insérer un participant (table générale 'participants')
ipcMain.handle('insert-participant', async (event, nom: string) => {
  try {
    const newId = await dbFunctions.addGeneralParticipant(nom);
    // addGeneralParticipant gère le cas où le nom existe déjà et retourne l'ID existant.
    return { success: true, id: newId, nom: nom, message: `Participant traité avec ID: ${newId}` };
  } catch (error: any) {
    console.error('IPC Error insert-participant (general):', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour Participants (table générale) ---
ipcMain.handle('get-all-general-participants', async () => {
    try {
        const participants = await dbFunctions.getAllGeneralParticipants();
        return { success: true, data: participants };
    } catch (error: any) {
        console.error('IPC Error get-all-general-participants:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-general-participant-by-id', async (event, id: number) => {
    try {
        const participant = await dbFunctions.getGeneralParticipantById(id);
        if (participant) {
            return { success: true, data: participant };
        } else {
            return { success: false, message: 'Participant général non trouvé' };
        }
    } catch (error: any) {
        console.error('IPC Error get-general-participant-by-id:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-general-participant', async (event, id: number, nom: string) => {
    try {
        await dbFunctions.updateGeneralParticipant(id, nom);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error update-general-participant:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-general-participant', async (event, id: number) => {
    try {
        await dbFunctions.deleteGeneralParticipant(id);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-general-participant:', error);
        return { success: false, message: error.message };
    }
});


// --- Handlers IPC pour Referentiels ---
ipcMain.handle('add-referentiel', async (event, code, nom_complet) => {
  try {
    const newId = await dbFunctions.addReferentiel(code, nom_complet);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-referentiel:', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour DeviceKits & Assignments ---
ipcMain.handle('add-device-kit', async (event, kitData: Omit<dbFunctions.DeviceKitData, 'id'>) => {
  try {
    const newId = await dbFunctions.addDeviceKit(kitData);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-device-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-device-kits', async () => {
  try {
    const kits = await dbFunctions.getAllDeviceKits();
    return { success: true, data: kits };
  } catch (error: any) {
    console.error('IPC Error get-all-device-kits:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-device-kit-by-id', async (event, id) => {
  try {
    const kit = await dbFunctions.getDeviceKitById(id);
    if (kit) {
      return { success: true, data: kit };
    } else {
      return { success: false, message: 'Kit non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-device-kit-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-device-kit', async (event, id, kitData: Partial<Omit<dbFunctions.DeviceKitData, 'id'>>) => {
  try {
    await dbFunctions.updateDeviceKit(id, kitData);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-device-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-device-kit', async (event, id) => {
  try {
    // La logique de suppression dans db.ts devrait gérer la suppression des assignations grâce à ON DELETE CASCADE
    // ou par une fonction explicite removeAllAssignmentsByKitId si nécessaire avant de supprimer le kit.
    // Pour l'instant, on se fie à ON DELETE CASCADE sur deviceKitAssignments et ON DELETE SET NULL sur sessions.
    await dbFunctions.deleteDeviceKit(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-device-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-default-device-kit', async () => {
    try {
        const kit = await dbFunctions.getDefaultDeviceKit();
        return { success: true, data: kit };
    } catch (error: any) {
        console.error('IPC Error get-default-device-kit:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('set-default-device-kit', async (event, id) => {
    try {
        await dbFunctions.setDefaultDeviceKit(id);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error set-default-device-kit:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('assign-device-to-kit', async (event, kitId, votingDeviceId) => {
  try {
    const assignmentId = await dbFunctions.assignDeviceToKit(kitId, votingDeviceId);
    return { success: true, id: assignmentId };
  } catch (error: any) {
    console.error('IPC Error assign-device-to-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('remove-device-from-kit', async (event, kitId, votingDeviceId) => {
  try {
    await dbFunctions.removeDeviceFromKit(kitId, votingDeviceId);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error remove-device-from-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-voting-devices-for-kit', async (event, kitId) => {
  try {
    const devices = await dbFunctions.getVotingDevicesForKit(kitId);
    return { success: true, data: devices };
  } catch (error: any) {
    console.error('IPC Error get-voting-devices-for-kit:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-kits-for-voting-device', async (event, votingDeviceId) => {
  try {
    const kits = await dbFunctions.getKitsForVotingDevice(votingDeviceId);
    return { success: true, data: kits };
  } catch (error: any) {
    console.error('IPC Error get-kits-for-voting-device:', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour Questions ---
// Note: Pour les fonctions qui attendent QuestionData, l'objet reçu du renderer doit correspondre.
// Spécialement, si une image est envoyée, elle doit être sous forme de Buffer ou ArrayBuffer côté renderer
// que le processus principal peut interpréter comme Buffer.

ipcMain.handle('add-question', async (event, questionData) => {
  try {
    // Assurer que questionData.image est un Buffer ou null si transmis
    if (questionData.image && !(questionData.image instanceof Buffer)) {
      // Si ce n'est pas un Buffer (par ex. un simple objet après IPC), essayer de le convertir
      // Ceci est une tentative basique, la gestion des ArrayBuffer/TypedArray peut être nécessaire
      if (questionData.image.type === 'Buffer' && Array.isArray(questionData.image.data)) {
        questionData.image = Buffer.from(questionData.image.data);
      } else {
        // Si on ne peut pas convertir, mettre à null pour éviter une erreur SQL, ou rejeter
        console.warn("add-question: Données d'image non reconnues, mise à null.");
        questionData.image = null;
      }
    }
    const newId = await dbFunctions.addQuestion(questionData);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-question:', error);
    return { success: false, message: error.message, data: questionData };
  }
});

ipcMain.handle('get-all-questions', async () => {
  try {
    const questions = await dbFunctions.getAllQuestions();
    return { success: true, data: questions };
  } catch (error: any) {
    console.error('IPC Error get-all-questions:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-questions-by-bloc-id', async (event, blocId) => {
  try {
    const questions = await dbFunctions.getQuestionsByBlocId(blocId);
    return { success: true, data: questions };
  } catch (error: any) {
    console.error('IPC Error get-questions-by-bloc-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-question-by-id', async (event, id) => {
  try {
    const question = await dbFunctions.getQuestionById(id);
    if (question) {
      return { success: true, data: question };
    } else {
      return { success: false, message: 'Question non trouvée' };
    }
  } catch (error: any) {
    console.error('IPC Error get-question-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-question', async (event, id, questionData) => {
  try {
    if (questionData.image && !(questionData.image instanceof Buffer)) {
       if (questionData.image.type === 'Buffer' && Array.isArray(questionData.image.data)) {
        questionData.image = Buffer.from(questionData.image.data);
      } else {
        console.warn("update-question: Données d'image non reconnues pour le champ 'image', ignorées pour ce champ.");
        delete questionData.image; // Ne pas essayer de mettre à jour l'image si format incorrect
      }
    }
    await dbFunctions.updateQuestion(id, questionData);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-question:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-question', async (event, id) => {
  try {
    await dbFunctions.deleteQuestion(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-question:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-question-image', async (event, id, image, imageName) => {
  try {
    let imageBuffer: Buffer | null = null;
    if (image) {
      if (image instanceof Buffer) {
        imageBuffer = image;
      } else if (image.type === 'Buffer' && Array.isArray(image.data)) {
        imageBuffer = Buffer.from(image.data);
      } else {
        throw new Error("Format d'image non supporté pour la mise à jour.");
      }
    }
    await dbFunctions.updateQuestionImage(id, imageBuffer, imageName);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-question-image:', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour Blocs ---
ipcMain.handle('add-bloc', async (event, code_bloc, theme_id) => {
  try {
    const newId = await dbFunctions.addBloc(code_bloc, theme_id);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-bloc:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-blocs', async () => {
  try {
    const blocs = await dbFunctions.getAllBlocs();
    return { success: true, data: blocs };
  } catch (error: any) {
    console.error('IPC Error get-all-blocs:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-blocs-by-theme-id', async (event, theme_id) => {
  try {
    const blocs = await dbFunctions.getBlocsByThemeId(theme_id);
    return { success: true, data: blocs };
  } catch (error: any) {
    console.error('IPC Error get-blocs-by-theme-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-bloc-by-id', async (event, id) => {
  try {
    const bloc = await dbFunctions.getBlocById(id);
    if (bloc) {
      return { success: true, data: bloc };
    } else {
      return { success: false, message: 'Bloc non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-bloc-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-bloc', async (event, id, code_bloc, theme_id) => {
  try {
    await dbFunctions.updateBloc(id, code_bloc, theme_id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-bloc:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-bloc', async (event, id) => {
  try {
    await dbFunctions.deleteBloc(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-bloc:', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour Themes ---
ipcMain.handle('add-theme', async (event, code_theme, nom_complet, referentiel_id) => {
  try {
    const newId = await dbFunctions.addTheme(code_theme, nom_complet, referentiel_id);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-theme:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-themes', async () => {
  try {
    const themes = await dbFunctions.getAllThemes();
    return { success: true, data: themes };
  } catch (error: any) {
    console.error('IPC Error get-all-themes:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-themes-by-referentiel-id', async (event, referentiel_id) => {
  try {
    const themes = await dbFunctions.getThemesByReferentielId(referentiel_id);
    return { success: true, data: themes };
  } catch (error: any) {
    console.error('IPC Error get-themes-by-referentiel-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-theme-by-id', async (event, id) => {
  try {
    const theme = await dbFunctions.getThemeById(id);
    if (theme) {
      return { success: true, data: theme };
    } else {
      return { success: false, message: 'Thème non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-theme-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-theme', async (event, id, code_theme, nom_complet, referentiel_id) => {
  try {
    await dbFunctions.updateTheme(id, code_theme, nom_complet, referentiel_id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-theme:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-theme', async (event, id) => {
  try {
    await dbFunctions.deleteTheme(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-theme:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-referentiels', async () => {
  try {
    const referentiels = await dbFunctions.getAllReferentiels();
    return { success: true, data: referentiels };
  } catch (error: any) {
    console.error('IPC Error get-all-referentiels:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-referentiel-by-id', async (event, id) => {
  try {
    const referentiel = await dbFunctions.getReferentielById(id);
    if (referentiel) {
      return { success: true, data: referentiel };
    } else {
      return { success: false, message: 'Référentiel non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-referentiel-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-referentiel', async (event, id, code, nom_complet) => {
  try {
    await dbFunctions.updateReferentiel(id, code, nom_complet);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-referentiel:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-referentiel', async (event, id) => {
  try {
    await dbFunctions.deleteReferentiel(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-referentiel:', error);
    return { success: false, message: error.message };
  }
});

// --- Handlers IPC pour Trainers ---
ipcMain.handle('add-trainer', async (event, trainerData: Omit<dbFunctions.TrainerData, 'id'>) => {
  try {
    const newId = await dbFunctions.addTrainer(trainerData);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-trainer:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-trainers', async () => {
  try {
    const trainers = await dbFunctions.getAllTrainers();
    return { success: true, data: trainers };
  } catch (error: any) {
    console.error('IPC Error get-all-trainers:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-trainer-by-id', async (event, id) => {
  try {
    const trainer = await dbFunctions.getTrainerById(id);
    if (trainer) {
      return { success: true, data: trainer };
    } else {
      return { success: false, message: 'Formateur non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-trainer-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-trainer', async (event, id, trainerData: Partial<Omit<dbFunctions.TrainerData, 'id'>>) => {
  try {
    await dbFunctions.updateTrainer(id, trainerData);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-trainer:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-trainer', async (event, id) => {
  try {
    await dbFunctions.deleteTrainer(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-trainer:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-default-trainer', async () => {
    try {
        const trainer = await dbFunctions.getDefaultTrainer();
        return { success: true, data: trainer }; // Peut être null si aucun n'est défini par défaut
    } catch (error: any) {
        console.error('IPC Error get-default-trainer:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('set-default-trainer', async (event, id) => {
    try {
        await dbFunctions.setDefaultTrainer(id);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error set-default-trainer:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour VotingDevices ---
ipcMain.handle('add-voting-device', async (event, deviceData: Omit<dbFunctions.VotingDeviceData, 'id'>) => {
  try {
    const newId = await dbFunctions.addVotingDevice(deviceData);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-voting-device:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-voting-devices', async () => {
  try {
    const devices = await dbFunctions.getAllVotingDevices();
    return { success: true, data: devices };
  } catch (error: any) {
    console.error('IPC Error get-all-voting-devices:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-voting-device-by-id', async (event, id) => {
  try {
    const device = await dbFunctions.getVotingDeviceById(id);
    if (device) {
      return { success: true, data: device };
    } else {
      return { success: false, message: 'Boîtier de vote non trouvé' };
    }
  } catch (error: any) {
    console.error('IPC Error get-voting-device-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-voting-device-by-sn', async (event, serialNumber) => {
  try {
    const device = await dbFunctions.getVotingDeviceBySerialNumber(serialNumber);
    if (device) {
      return { success: true, data: device };
    } else {
      return { success: false, message: 'Boîtier de vote non trouvé par SN' };
    }
  } catch (error: any) {
    console.error('IPC Error get-voting-device-by-sn:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('update-voting-device', async (event, id, deviceData: Partial<Omit<dbFunctions.VotingDeviceData, 'id'>>) => {
  try {
    await dbFunctions.updateVotingDevice(id, deviceData);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-voting-device:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-voting-device', async (event, id) => {
  try {
    await dbFunctions.deleteVotingDevice(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-voting-device:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('bulk-add-voting-devices', async (event, devicesData: Omit<dbFunctions.VotingDeviceData, 'id'>[]) => {
    try {
        await dbFunctions.bulkAddVotingDevices(devicesData);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error bulk-add-voting-devices:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour Sessions & SessionParticipants ---
ipcMain.handle('add-session', async (event, sessionData: Omit<dbFunctions.SessionData, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    // Assurer la conversion des données JSON et BLOB si nécessaire avant d'appeler dbFunctions
    // Pour l'instant, on suppose que sessionData est correctement formaté par le renderer
    // (par exemple, les champs JSON sont des objets/tableaux, les BLOBs sont des Buffers)
    const newId = await dbFunctions.addSession(sessionData);
    return { success: true, id: newId };
  } catch (error: any) {
    console.error('IPC Error add-session:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-session-by-id', async (event, id) => {
  try {
    const session = await dbFunctions.getSessionById(id);
    if (session) {
      return { success: true, data: session };
    } else {
      return { success: false, message: 'Session non trouvée' };
    }
  } catch (error: any) {
    console.error('IPC Error get-session-by-id:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-all-sessions-with-participants', async () => {
    try {
        const sessions = await dbFunctions.getAllSessionsWithParticipants();
        return { success: true, data: sessions };
    } catch (error: any) {
        console.error('IPC Error get-all-sessions-with-participants:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-session', async (event, id, sessionData: Partial<Omit<dbFunctions.SessionData, 'id' | 'createdAt' | 'updatedAt'>>) => {
  try {
    await dbFunctions.updateSession(id, sessionData);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error update-session:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-session', async (event, id) => {
  try {
    await dbFunctions.deleteSession(id);
    return { success: true };
  } catch (error: any) {
    console.error('IPC Error delete-session:', error);
    return { success: false, message: error.message };
  }
});

// Handlers pour session_participants (si gestion individuelle nécessaire)
ipcMain.handle('add-session-participant', async (event, sessionId, participantData: Omit<dbFunctions.SessionParticipantData, 'id' | 'sessionId'>) => {
    try {
        const newId = await dbFunctions.addSessionParticipant(sessionId, participantData);
        return { success: true, id: newId };
    } catch (error: any) {
        console.error('IPC Error add-session-participant:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-session-participants-by-session-id', async (event, sessionId) => {
    try {
        const participants = await dbFunctions.getSessionParticipantsBySessionId(sessionId);
        return { success: true, data: participants };
    } catch (error: any) {
        console.error('IPC Error get-session-participants-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-session-participant', async (event, participantId, data: Partial<Omit<dbFunctions.SessionParticipantData, 'id' | 'sessionId'>>) => {
    try {
        await dbFunctions.updateSessionParticipant(participantId, data);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error update-session-participant:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-session-participant', async (event, participantId) => {
    try {
        await dbFunctions.deleteSessionParticipant(participantId);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-session-participant:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour SessionQuestions (Snapshots) ---
ipcMain.handle('add-session-question', async (event, data: Omit<dbFunctions.SessionQuestionData, 'id'>) => {
    try {
        const newId = await dbFunctions.addSessionQuestion(data);
        return { success: true, id: newId };
    } catch (error: any) {
        console.error('IPC Error add-session-question:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('add-bulk-session-questions', async (event, sessionId: number, questions: Omit<dbFunctions.SessionQuestionData, 'id' | 'sessionId'>[]) => {
    try {
        await dbFunctions.addBulkSessionQuestions(sessionId, questions);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error add-bulk-session-questions:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-session-questions-by-session-id', async (event, sessionId: number) => {
    try {
        const questions = await dbFunctions.getSessionQuestionsBySessionId(sessionId);
        return { success: true, data: questions };
    } catch (error: any) {
        console.error('IPC Error get-session-questions-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-session-questions-by-session-id', async (event, sessionId: number) => {
    try {
        await dbFunctions.deleteSessionQuestionsBySessionId(sessionId);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-session-questions-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour SessionBoitiers (Snapshots) ---
ipcMain.handle('add-session-boitier', async (event, data: Omit<dbFunctions.SessionBoitierData, 'id'>) => {
    try {
        const newId = await dbFunctions.addSessionBoitier(data);
        return { success: true, id: newId };
    } catch (error: any) {
        console.error('IPC Error add-session-boitier:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('add-bulk-session-boitiers', async (event, sessionId: number, boitiers: Omit<dbFunctions.SessionBoitierData, 'id' | 'sessionId'>[]) => {
    try {
        await dbFunctions.addBulkSessionBoitiers(sessionId, boitiers);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error add-bulk-session-boitiers:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-session-boitiers-by-session-id', async (event, sessionId: number) => {
    try {
        const boitiers = await dbFunctions.getSessionBoitiersBySessionId(sessionId);
        return { success: true, data: boitiers };
    } catch (error: any) {
        console.error('IPC Error get-session-boitiers-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-session-boitiers-by-session-id', async (event, sessionId: number) => {
    try {
        await dbFunctions.deleteSessionBoitiersBySessionId(sessionId);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-session-boitiers-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour SessionResults ---
ipcMain.handle('add-session-result', async (event, data: Omit<dbFunctions.SessionResultData, 'id'>) => {
    try {
        const newId = await dbFunctions.addSessionResult(data);
        return { success: true, id: newId };
    } catch (error: any) {
        console.error('IPC Error add-session-result:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('add-bulk-session-results', async (event, results: Omit<dbFunctions.SessionResultData, 'id'>[]) => {
    try {
        await dbFunctions.addBulkSessionResults(results);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error add-bulk-session-results:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-session-results-by-session-id', async (event, sessionId: number) => {
    try {
        const results = await dbFunctions.getSessionResultsBySessionId(sessionId);
        return { success: true, data: results };
    } catch (error: any) {
        console.error('IPC Error get-session-results-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-session-results-by-participant-boitier', async (event, sessionId: number, participantIdBoitier: string) => {
    try {
        const results = await dbFunctions.getSessionResultsByParticipantBoitier(sessionId, participantIdBoitier);
        return { success: true, data: results };
    } catch (error: any) {
        console.error('IPC Error get-session-results-by-participant-boitier:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-session-result', async (event, id: number, data: Partial<Omit<dbFunctions.SessionResultData, 'id' | 'sessionId' | 'questionId' | 'participantIdBoitier'>>) => {
    try {
        await dbFunctions.updateSessionResult(id, data);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error update-session-result:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-session-results-by-session-id', async (event, sessionId: number) => {
    try {
        await dbFunctions.deleteSessionResultsBySessionId(sessionId);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-session-results-by-session-id:', error);
        return { success: false, message: error.message };
    }
});

// --- Handlers IPC pour AdminSettings ---
ipcMain.handle('get-admin-setting', async (event, key: string) => {
    try {
        const value = await dbFunctions.getAdminSetting(key);
        return { success: true, data: value }; // value peut être undefined si la clé n'existe pas
    } catch (error: any) {
        console.error('IPC Error get-admin-setting:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('set-admin-setting', async (event, key: string, value: any) => {
    try {
        await dbFunctions.setAdminSetting(key, value);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error set-admin-setting:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-all-admin-settings', async () => {
    try {
        const settings = await dbFunctions.getAllAdminSettings();
        return { success: true, data: settings };
    } catch (error: any) {
        console.error('IPC Error get-all-admin-settings:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-admin-setting', async (event, key: string) => {
    try {
        await dbFunctions.deleteAdminSetting(key);
        return { success: true };
    } catch (error: any) {
        console.error('IPC Error delete-admin-setting:', error);
        return { success: false, message: error.message };
    }
});


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js') // Nous créerons preload.js plus tard
    }
  });

  // Charge index.html
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  // Ouvre les DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Sur macOS, il est courant que les applications et leur barre de menu
  // restent actives jusqu'à ce que l'utilisateur quitte explicitement avec Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  // Fermer la connexion à la base de données lorsque l'application se termine
  db.close((err) => {
    if (err) {
      console.error('Erreur lors de la fermeture de la base de données SQLite dans main.ts', err.message);
    } else {
      console.log('Base de données SQLite fermée depuis main.ts.');
    }
  });
});
