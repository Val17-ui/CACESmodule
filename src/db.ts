import Dexie, { Table } from 'dexie';
import { CACESReferential, Session, Participant, SessionResult, Trainer } from './types'; // Ajout de Trainer

// Interfaces pour la DB
export interface QuestionWithId {
  id?: number;
  text: string;
  type: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  referential: CACESReferential | string;
  theme: string;
  image?: Blob | null;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  correctResponseRate?: number;
  slideGuid?: string;
  imageName?: string; // Added to store the name of the image file
}

export interface VotingDevice {
  id?: number;
  name: string;         // User-friendly name
  serialNumber: string; // Unique physical/serial ID (formerly physicalId)
}

export class MySubClassedDexie extends Dexie {
  questions!: Table<QuestionWithId, number>;
  sessions!: Table<Session, number>;
  sessionResults!: Table<SessionResult, number>;
  adminSettings!: Table<{ key: string; value: any }, string>;
  votingDevices!: Table<VotingDevice, number>;
  trainers!: Table<Trainer, number>; // Nouvelle table pour les formateurs

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
    });
    this.version(2).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referentiel, theme, createdAt, usageCount, correctResponseRate, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(3).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(4).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, timestamp'
    });
    this.version(5).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp'
    });
    this.version(6).stores({
      adminSettings: '&key'
    });
    this.version(7).stores({
      votingDevices: '++id, &physicalId'
    });
    // Nouvelle version pour ajouter la table trainers et le champ trainerId à sessions
    this.version(8).stores({
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId', // Ajout de trainerId
      trainers: '++id, name, isDefault' // Suppression de l'index unique sur isDefault
    });

    // Version 9: Mise à jour de votingDevices (name, serialNumber) et sessions (participants.assignedGlobalDeviceId)
    // IMPORTANT: Le changement de l'index de la table trainers doit être fait dans une NOUVELLE version de la base de données.
    // Si la version 9 est la dernière déployée et que des utilisateurs l'ont déjà,
    // nous devons passer à la version 10 pour modifier la table trainers.
    // Si la version 9 n'a jamais été en production ou si la base de données peut être réinitialisée pour le développement,
    // on pourrait modifier la v9. Cependant, la bonne pratique est d'incrémenter la version.

    // Supposons que nous devons créer une nouvelle version (v10) pour ce changement.
    // Si la v9 est déjà utilisée, la modification de 'trainers' dans la v9 ci-dessous serait incorrecte.
    // Pour cet exercice, je vais modifier la définition dans la v9 et ajouter une v10 pour illustrer la migration si nécessaire.
    // Mais pour le problème spécifique de l'index, il suffit de le changer là où il est défini.
    // La question est de savoir si la DB a déjà été ouverte avec v9 par des utilisateurs.
    // Pour l'instant, je corrige la définition dans la v9. Si cela cause des problèmes de migration, il faudra une nouvelle version.

    this.version(9).stores({
      votingDevices: '++id, name, &serialNumber', // physicalId -> serialNumber, ajout de name
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId',
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      trainers: '++id, name, isDefault' // Corrigé ici aussi pour la v9
    }).upgrade(async tx => {
      // 1. Migration pour votingDevices
      await tx.table('votingDevices').toCollection().modify(device => {
        // Renommer physicalId en serialNumber et ajouter un nom par défaut
        // @ts-ignore
        device.serialNumber = device.physicalId;
        // @ts-ignore
        delete device.physicalId;
        device.name = `Boîtier SN: ${device.serialNumber}`; // Nom par défaut
      });

      // 2. Migration pour sessions (participants)
      // On a besoin de la liste des votingDevices migrés pour trouver les IDs
      const allMigratedVotingDevices = await tx.table('votingDevices').toArray();
      const deviceMapBySerial = new Map(allMigratedVotingDevices.map(d => [d.serialNumber, d.id]));

      await tx.table('sessions').toCollection().modify(session => {
        if (session.participants && Array.isArray(session.participants)) {
          session.participants.forEach((participant: any) => {
            const oldIdBoitier = participant.idBoitier; // Ancien serialNumber
            delete participant.idBoitier; // Supprimer l'ancien champ

            if (oldIdBoitier) {
              const globalDeviceId = deviceMapBySerial.get(oldIdBoitier);
              if (globalDeviceId !== undefined) {
                participant.assignedGlobalDeviceId = globalDeviceId;
              } else {
                participant.assignedGlobalDeviceId = null; // ou logguer une erreur si un idBoitier ne correspond plus
                console.warn(`Impossible de trouver le GlobalDevice pour l'ancien idBoitier: ${oldIdBoitier} dans la session ${session.id}`);
              }
            } else {
              participant.assignedGlobalDeviceId = null;
            }
          });
        }
      });
    });

    // Version 10: S'assurer que l'index sur trainers.isDefault n'est pas unique.
    // Cette version est ajoutée pour forcer une mise à jour du schéma si les modifications
    // précédentes dans v8 et v9 n'ont pas été correctement appliquées à cause du caching du schéma par Dexie.
    this.version(10).stores({
      // On reprend toutes les tables de la v9
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      votingDevices: '++id, name, &serialNumber',
      trainers: '++id, name, isDefault' // Assurer que isDefault n'est pas unique ('&')
    }).upgrade(async tx => {
      console.log("Migrating to DB version 10: Rebuilding 'trainers' table to ensure data integrity for 'isDefault' index.");
      const trainersTable = tx.table('trainers');
      let allTrainersFromOldSchema = await trainersTable.toArray(); // Lire les données AVANT de potentiellement modifier la table.

      // Étape 1: Nettoyer les données en mémoire et s'assurer de l'unicité de isDefault
      // et que isDefault est toujours un booléen.
      let defaultTrainerId: number | undefined = undefined; // Utiliser undefined pour être clair qu'aucun ID n'a été trouvé

      // Première passe pour convertir isDefault en 0 ou 1 et trouver un candidat par défaut
      let cleanedTrainers = allTrainersFromOldSchema.map(trainer => {
        let numericIsDefault: 0 | 1 = 0;
        if (trainer.isDefault === true || trainer.isDefault === 1) {
          numericIsDefault = 1;
        }
        // Conserver le premier ID de formateur marqué comme défaut (booléen ou numérique)
        if (numericIsDefault === 1 && defaultTrainerId === undefined) {
          defaultTrainerId = trainer.id;
        }
        return { ...trainer, name: trainer.name || "Nom Inconnu", isDefault: numericIsDefault };
      });

      // Deuxième passe pour forcer un seul par défaut, en utilisant la valeur numérique 1
      let foundActiveDefault = false;
      cleanedTrainers = cleanedTrainers.map(trainer => {
        if (trainer.id === defaultTrainerId && trainer.id !== undefined) { // S'assurer que defaultTrainerId a été trouvé et est valide
          foundActiveDefault = true;
          return { ...trainer, isDefault: 1 as const };
        }
        return { ...trainer, isDefault: 0 as const };
      });

      // S'il n'y avait aucun formateur par défaut valablement identifié,
      // et que la liste n'est pas vide, définir le premier (trié par ID) comme par défaut.
      if (!foundActiveDefault && cleanedTrainers.length > 0) {
        const sortedTrainers = cleanedTrainers.sort((a, b) => (a.id || 0) - (b.id || 0));
        if (sortedTrainers.length > 0 && sortedTrainers[0].id !== undefined) {
            sortedTrainers[0].isDefault = 1; // Définir comme 1
             console.log(`No default trainer was clearly identified or valid. Setting trainer ID ${sortedTrainers[0].id} as default (1) during v10 migration.`);
        }
      }

      // Filtrer les trainers sans ID valide avant bulkAdd, car `id` est la clé primaire.
      const validTrainersForBulkAdd = cleanedTrainers.filter(trainer => trainer.id !== undefined);

      // Étape 2: Vider la table et la repeupler
      // Note: La table est déjà en cours de transaction (tx), donc les opérations sont atomiques pour cette version.
      await trainersTable.clear();
      console.log("'trainers' table cleared during v10 migration.");

      if (validTrainersForBulkAdd.length > 0) {
        await trainersTable.bulkAdd(validTrainersForBulkAdd);
        console.log(`'trainers' table repopulated with ${validTrainersForBulkAdd.length} entries after v10 cleaning.`);
      } else {
        console.log("'trainers' table is empty after v10 cleaning or all entries had invalid IDs.");
      }

      return tx.done;
    });
  }
}

export const db = new MySubClassedDexie();

// Fonctions CRUD pour Questions
export const addQuestion = async (question: QuestionWithId): Promise<number | undefined> => {
  try {
    const id = await db.questions.add(question);
    return id;
  } catch (error) {
    console.error("Error adding question: ", error);
  }
};

// Specific function to get the globally stored PPTX template
export const getGlobalPptxTemplate = async (): Promise<File | null> => {
  try {
    const templateFile = await db.adminSettings.get('pptxTemplateFile');
    if (templateFile && templateFile.value instanceof File) {
      return templateFile.value;
    } else if (templateFile && templateFile.value instanceof Blob) {
      // If it's stored as a Blob, try to reconstruct a File object.
      // This might happen depending on how Dexie handles File objects across sessions/versions.
      // We'd ideally need the filename, but for now, a default name or just the blob is better than nothing.
      // For robust File reconstruction, storing filename alongside was a good idea.
      const fileName = (await db.adminSettings.get('pptxTemplateFileName'))?.value || 'template.pptx';
      return new File([templateFile.value], fileName, { type: templateFile.value.type });
    }
    return null;
  } catch (error) {
    console.error("Error getting global PPTX template:", error);
    return null;
  }
};

export const getAllQuestions = async (): Promise<QuestionWithId[]> => {
  try {
    return await db.questions.toArray();
  } catch (error) {
    console.error("Error getting all questions: ", error);
    return [];
  }
};

export const getQuestionById = async (id: number): Promise<QuestionWithId | undefined> => {
  try {
    return await db.questions.get(id);
  } catch (error) {
    console.error(`Error getting question with id ${id}: `, error);
  }
};

export const getQuestionsByIds = async (ids: number[]): Promise<QuestionWithId[]> => {
  try {
    const questions = await db.questions.bulkGet(ids);
    return questions.filter((q): q is QuestionWithId => q !== undefined);
  } catch (error) {
    console.error(`Error getting questions by ids: `, error);
    return [];
  }
};

// --- Fonctions de Reporting ---

export interface BlockUsage {
  referentiel: CACESReferential | string;
  theme: string;
  blockId: string;
  usageCount: number;
}

/**
 * Calcule le nombre de fois où chaque bloc a été utilisé dans les sessions terminées,
 * avec un filtre optionnel sur la période.
 * @param startDate - Date de début optionnelle (string ISO ou objet Date).
 * @param endDate - Date de fin optionnelle (string ISO ou objet Date).
 */
export const calculateBlockUsage = async (startDate?: string | Date, endDate?: string | Date): Promise<BlockUsage[]> => {
  const usageMap = new Map<string, BlockUsage>();

  try {
    let query = db.sessions.where('status').equals('completed');

    let sessionsQuery = db.sessions.where('status').equals('completed');

    if (startDate) {
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      start.setHours(0, 0, 0, 0);
      // Placeholder pour une requête Dexie plus performante si dateSession est indexé
      // sessionsQuery = sessionsQuery.and(session => new Date(session.dateSession) >= start);
    }

    if (endDate) {
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // Placeholder pour une requête Dexie plus performante
      // sessionsQuery = sessionsQuery.and(session => new Date(session.dateSession) <= end);
    }

    const completedSessions = await sessionsQuery.toArray();
    let filteredSessions = completedSessions;

    if (startDate) {
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filteredSessions = filteredSessions.filter(session => {
        const sessionDate = new Date(session.dateSession);
        return sessionDate >= start;
      });
    }

    if (endDate) {
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredSessions = filteredSessions.filter(session => {
        const sessionDate = new Date(session.dateSession);
        return sessionDate <= end;
      });
    }

    for (const session of filteredSessions) {
      if (session.selectionBlocs && session.selectionBlocs.length > 0) {
        const sessionReferentiel = session.referentiel;

        for (const bloc of session.selectionBlocs) {
          const key = `${sessionReferentiel}-${bloc.theme}-${bloc.blockId}`;

          if (usageMap.has(key)) {
            const currentUsage = usageMap.get(key)!;
            currentUsage.usageCount++;
          } else {
            usageMap.set(key, {
              referentiel: sessionReferentiel,
              theme: bloc.theme,
              blockId: bloc.blockId,
              usageCount: 1,
            });
          }
        }
      }
    }
    return Array.from(usageMap.values());
  } catch (error) {
    console.error("Erreur lors du calcul de l'utilisation des blocs:", error);
    return [];
  }
};

export const updateQuestion = async (id: number, updates: Partial<QuestionWithId>): Promise<number | undefined> => {
  try {
    await db.questions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating question with id ${id}: `, error);
  }
};

export const deleteQuestion = async (id: number): Promise<void> => {
  try {
    await db.questions.delete(id);
  } catch (error) {
    console.error(`Error deleting question with id ${id}: `, error);
  }
};

// --- Nouvelles fonctions CRUD pour Sessions ---
export const addSession = async (session: Session): Promise<number | undefined> => {
  try {
    const id = await db.sessions.add(session);
    return id;
  } catch (error) {
    console.error("Error adding session: ", error);
  }
};

export const getAllSessions = async (): Promise<Session[]> => {
  try {
    return await db.sessions.toArray();
  } catch (error) {
    console.error("Error getting all sessions: ", error);
    return [];
  }
};

export const getSessionById = async (id: number): Promise<Session | undefined> => {
  try {
    return await db.sessions.get(id);
  } catch (error) {
    console.error(`Error getting session with id ${id}: `, error);
  }
};

export const updateSession = async (id: number, updates: Partial<Session>): Promise<number | undefined> => {
  try {
    await db.sessions.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating session with id ${id}: `, error);
  }
};

export const deleteSession = async (id: number): Promise<void> => {
  try {
    await db.sessions.delete(id);
    await db.sessionResults.where('sessionId').equals(id).delete();
  } catch (error) {
    console.error(`Error deleting session with id ${id}: `, error);
  }
};

// --- Nouvelles fonctions CRUD pour SessionResults ---
export const addSessionResult = async (result: SessionResult): Promise<number | undefined> => {
  try {
    const id = await db.sessionResults.add(result);
    return id;
  } catch (error) {
    console.error("Error adding session result: ", error);
  }
};

export const addBulkSessionResults = async (results: SessionResult[]): Promise<number[] | undefined> => {
  try {
    const ids = await db.sessionResults.bulkAdd(results, { allKeys: true });
    return ids as number[];
  } catch (error) {
    console.error("Error adding bulk session results: ", error);
  }
}

export const getAllResults = async (): Promise<SessionResult[]> => {
  try {
    return await db.sessionResults.toArray();
  } catch (error) {
    console.error("Error getting all session results: ", error);
    return [];
  }
};

export const getResultsForSession = async (sessionId: number): Promise<SessionResult[]> => {
  try {
    return await db.sessionResults.where('sessionId').equals(sessionId).toArray();
  } catch (error) {
    console.error(`Error getting results for session ${sessionId}: `, error);
    return [];
  }
};

export const getResultBySessionAndQuestion = async (sessionId: number, questionId: number, participantIdBoitier: string): Promise<SessionResult | undefined> => {
  try {
    return await db.sessionResults
      .where({ sessionId, questionId, participantIdBoitier })
      .first();
  } catch (error) {
    console.error(`Error getting specific result: `, error);
  }
};

export const updateSessionResult = async (id: number, updates: Partial<SessionResult>): Promise<number | undefined> => {
  try {
    await db.sessionResults.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating session result with id ${id}: `, error);
  }
};

export const deleteResultsForSession = async (sessionId: number): Promise<void> => {
  try {
    await db.sessionResults.where('sessionId').equals(sessionId).delete();
  } catch (error) {
    console.error(`Error deleting results for session ${sessionId}: `, error);
  }
};

export const getQuestionsForSessionBlocks = async (selectionBlocs: { theme: string; blockId: string }[]): Promise<QuestionWithId[]> => {
  if (!selectionBlocs || selectionBlocs.length === 0) {
    return [];
  }
  const allMatchingQuestions: QuestionWithId[] = [];
  try {
    for (const bloc of selectionBlocs) {
      const questionsFromDb = await db.questions.where('theme').startsWith(bloc.theme).toArray();
      questionsFromDb.forEach(q => {
        if (!allMatchingQuestions.some(mq => mq.id === q.id)) {
          allMatchingQuestions.push(q);
        }
      });
    }
    console.log(`Récupéré ${allMatchingQuestions.length} questions pour les blocs de la session.`);
    return allMatchingQuestions;
  } catch (error) {
    console.error("Erreur lors de la récupération des questions pour les blocs de session:", error);
    return [];
  }
};

// Fonctions pour AdminSettings
export const getAdminSetting = async (key: string): Promise<any> => {
  try {
    const setting = await db.adminSettings.get(key);
    return setting?.value;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return undefined;
  }
};

export const setAdminSetting = async (key: string, value: any): Promise<void> => {
  try {
    await db.adminSettings.put({ key, value });
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
  }
};

export const getAllAdminSettings = async (): Promise<{ key: string; value: any }[]> => {
  try {
    return await db.adminSettings.toArray();
  } catch (error) {
    console.error("Error getting all admin settings:", error);
    return [];
  }
};

// Fonctions CRUD pour VotingDevices
export const addVotingDevice = async (device: Omit<VotingDevice, 'id'>): Promise<number | undefined> => {
  try {
    return await db.votingDevices.add(device as VotingDevice);
  } catch (error) {
    console.error("Error adding voting device:", error);
  }
};

export const getAllVotingDevices = async (): Promise<VotingDevice[]> => {
  try {
    return await db.votingDevices.toArray();
  } catch (error) {
    console.error("Error getting all voting devices:", error);
    return [];
  }
};

export const updateVotingDevice = async (id: number, updates: Partial<VotingDevice>): Promise<number> => {
  try {
    return await db.votingDevices.update(id, updates);
  } catch (error) {
    console.error(`Error updating voting device ${id}:`, error);
    return 0;
  }
};

export const deleteVotingDevice = async (id: number): Promise<void> => {
  try {
    await db.votingDevices.delete(id);
  } catch (error) {
    console.error(`Error deleting voting device ${id}:`, error);
  }
};

export const bulkAddVotingDevices = async (devices: VotingDevice[]): Promise<void> => {
  try {
    await db.votingDevices.bulkAdd(devices, { allKeys: false });
  } catch (error) {
    console.error("Error bulk adding voting devices:", error);
  }
};

// --- Fonctions CRUD pour Formateurs (Trainers) ---

export const addTrainer = async (trainer: Omit<Trainer, 'id'>): Promise<number | undefined> => {
  // s'assurer que trainer.isDefault est 0 ou 1. Le type Omit<Trainer, 'id'> le garantit déjà.
  try {
    // S'assurer qu'aucun autre formateur n'est par défaut si celui-ci l'est (isDefault === 1)
    if (trainer.isDefault === 1) {
      await db.trainers.where('isDefault').equals(1).modify({ isDefault: 0 });
    }
    const id = await db.trainers.add(trainer as Trainer); // trainer contient déjà isDefault: 0 ou 1
    return id;
  } catch (error) {
    console.error("Error adding trainer: ", error);
  }
};

export const getAllTrainers = async (): Promise<Trainer[]> => {
  try {
    return await db.trainers.toArray();
  } catch (error) {
    console.error("Error getting all trainers: ", error);
    return [];
  }
};

export const getTrainerById = async (id: number): Promise<Trainer | undefined> => {
  try {
    return await db.trainers.get(id);
  } catch (error) {
    console.error(`Error getting trainer with id ${id}: `, error);
  }
};

export const updateTrainer = async (id: number, updates: Partial<Omit<Trainer, 'id'>>): Promise<number | undefined> => {
  // updates.isDefault peut être 0, 1, ou undefined.
  // Si undefined, on ne touche pas à isDefault.
  // Si 0 ou 1, on met à jour.
  try {
    // Si on met à jour un formateur pour qu'il soit par défaut (isDefault === 1)
    if (updates.isDefault === 1) {
      await db.trainers.where('isDefault').equals(1).modify({ isDefault: 0 });
    }
    // Si updates.isDefault est undefined, il ne sera pas inclus dans l'objet d'update pour Dexie,
    // donc la valeur existante de isDefault pour ce formateur ne sera pas modifiée.
    // Si updates.isDefault est 0, il mettra isDefault à 0.
    await db.trainers.update(id, updates);
    return id;
  } catch (error) {
    console.error(`Error updating trainer with id ${id}: `, error);
  }
};

export const deleteTrainer = async (id: number): Promise<void> => {
  try {
    // TODO: Que faire si on supprime le formateur par défaut ?
    // Option 1: Le prochain formateur (par ordre alpha?) devient par défaut.
    // Option 2: Aucun formateur n'est par défaut.
    // Option 3: Interdire la suppression du formateur par défaut s'il en reste.
    // Pour l'instant, suppression simple.
    await db.trainers.delete(id);
    // TODO: Mettre à jour les sessions qui utilisaient ce trainerId ? Mettre à undefined ?
  } catch (error) {
    console.error(`Error deleting trainer with id ${id}: `, error);
  }
};

export const setDefaultTrainer = async (id: number): Promise<number | undefined> => {
  try {
    // D'abord, s'assurer qu'aucun autre formateur n'est par défaut (isDefault === 1)
    await db.trainers.where('isDefault').equals(1).modify({ isDefault: 0 });
    // Ensuite, définir le formateur spécifié comme par défaut (isDefault === 1)
    await db.trainers.update(id, { isDefault: 1 });
    return id;
  } catch (error) {
    console.error(`Error setting default trainer for id ${id}:`, error);
  }
};

export const getDefaultTrainer = async (): Promise<Trainer | undefined> => {
  try {
    // Récupérer le formateur où isDefault est 1
    return await db.trainers.where('isDefault').equals(1).first();
  } catch (error) {
    console.error("Error getting default trainer:", error);
    // En cas d'erreur (par exemple, si l'index est toujours problématique),
    // on pourrait retourner le premier formateur par ID comme fallback,
    // mais il vaut mieux que l'erreur soit visible pour diagnostic.
  }
};