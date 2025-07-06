import Dexie, { Table } from 'dexie';
import { CACESReferential, Session, Participant, SessionResult, Trainer, SessionQuestion, SessionBoitier, Referential, Theme, Bloc } from './types'; // Ajout de Referential, Theme, Bloc
import { logger } from './utils/logger'; // Importer le logger

// Interfaces pour la DB
export interface QuestionWithId {
  id?: number;
  text: string;
  type: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: string;
  timeLimit?: number;
  isEliminatory: boolean;
  // referential: CACESReferential | string; // Supprimé
  // theme: string; // Supprimé
  blocId?: number; // Ajouté
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
  trainers!: Table<Trainer, number>;
  sessionQuestions!: Table<SessionQuestion, number>;
  sessionBoitiers!: Table<SessionBoitier, number>;

  // Nouvelles tables
  referentiels!: Table<Referential, number>;
  themes!: Table<Theme, number>;
  blocs!: Table<Bloc, number>;

  constructor() {
    super('myDatabase');
    this.version(1).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, *options'
    });
    this.version(2).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referentiel, theme, createdAt, usageCount, correctResponseRate, *options', // 'referentiel' au lieu de 'referential'
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
      // Cette migration était pour la v10, si elle doit être rejouée ou si de nouvelles données pour trainers sont problématiques
      // il faudra peut-être la revoir. Pour l'instant, on la laisse telle quelle.
      console.log("Executing DB version 10 upgrade logic (trainers table)...");
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

      // return tx.done; // Dexie handles promise completion for async upgrade functions implicitly.
      return;
    });

    // Version 11: Ajout des tables sessionQuestions, sessionBoitiers et du champ testSlideGuid à sessions
    this.version(11).stores({
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId, testSlideGuid', // Ajout de testSlideGuid
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      votingDevices: '++id, name, &serialNumber',
      trainers: '++id, name, isDefault',
      // Nouvelles tables
      sessionQuestions: '++id, sessionId, dbQuestionId, slideGuid, blockId', // Index pour recherche par sessionId
      sessionBoitiers: '++id, sessionId, participantId, visualId, serialNumber' // Index pour recherche par sessionId
    }).upgrade(async tx => {
      // Logique de migration pour la v11 si nécessaire (par exemple, initialiser testSlideGuid à null pour les sessions existantes)
      // Pour l'instant, Dexie gérera l'ajout de nouvelles tables et champs avec des valeurs undefined par défaut.
      // Si testSlideGuid doit être explicitement null pour les anciennes sessions:
      await tx.table('sessions').toCollection().modify(session => {
        if (session.testSlideGuid === undefined) { // Champ de la v10 et avant
          session.testSlideGuid = null;
        }
      });
      console.log("DB version 11 upgrade: Added sessionQuestions, sessionBoitiers tables and testSlideGuid to sessions. Ensured testSlideGuid is null for existing sessions if it was undefined.");
    });

    // Version 12: Remplacement de testSlideGuid par ignoredSlideGuids[] dans la table sessions
    this.version(12).stores({
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId, *ignoredSlideGuids, resolvedImportAnomalies', // Ajout de resolvedImportAnomalies
      // Reprise des autres tables pour que Dexie sache qu'elles existent toujours
      questions: '++id, text, type, correctAnswer, timeLimit, isEliminatory, referential, theme, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      votingDevices: '++id, name, &serialNumber',
      trainers: '++id, name, isDefault',
      sessionQuestions: '++id, sessionId, dbQuestionId, slideGuid, blockId',
      sessionBoitiers: '++id, sessionId, participantId, visualId, serialNumber'
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify(session => {
        // @ts-ignore (pour accéder à l'ancien champ testSlideGuid qui n'est plus dans le type Session)
        const oldTestSlideGuid = session.testSlideGuid;

        if (typeof oldTestSlideGuid === 'string' && oldTestSlideGuid.trim() !== '') {
          session.ignoredSlideGuids = [oldTestSlideGuid];
        } else {
          session.ignoredSlideGuids = []; // Initialiser comme tableau vide si pas de testSlideGuid précédent ou s'il était invalide
        }
        // @ts-ignore
        delete session.testSlideGuid; // Supprimer l'ancien champ

        // NOUVELLE MIGRATION pour resolvedImportAnomalies
        if (session.resolvedImportAnomalies === undefined) {
          session.resolvedImportAnomalies = null; // Initialiser à null pour les sessions existantes
        }
      });
      console.log("DB version 12 upgrade: Replaced testSlideGuid with ignoredSlideGuids and initialized resolvedImportAnomalies to null for existing sessions.");
    });

    // Version 13: Ajout des tables referentiels, themes, blocs et modification de la table questions
    this.version(13).stores({
      // Nouvelles tables
      referentiels: '++id, &code', // code doit être unique
      themes: '++id, &code_theme, referentiel_id', // code_theme doit être unique
      blocs: '++id, &code_bloc, theme_id', // code_bloc doit être unique

      // Table questions modifiée
      questions: '++id, blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, *options', // suppression de referential, theme et ajout de blocId

      // Reprise des autres tables pour que Dexie sache qu'elles existent toujours
      sessions: '++id, nomSession, dateSession, referentiel, createdAt, location, status, questionMappings, notes, trainerId, *ignoredSlideGuids, resolvedImportAnomalies', // Garder referentiel pour l'instant, migration à la v14
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      votingDevices: '++id, name, &serialNumber',
      trainers: '++id, name, isDefault',
      sessionQuestions: '++id, sessionId, dbQuestionId, slideGuid, blockId', // blockId ici est l'ancien, devra peut-être être mis à jour si on veut le lier au nouveau systeme de blocId
      sessionBoitiers: '++id, sessionId, participantId, visualId, serialNumber'
    }).upgrade(async tx => {
      console.log("DB version 13 upgrade: Adding referentiels, themes, blocs tables and modifying questions table.");
      // Logique de migration des données de l'ancienne structure (questions.referential, questions.theme)
      // vers les nouvelles tables referentiels, themes, blocs et mise à jour de questions.blocId.

      const oldQuestions = await tx.table('questions').toArray();
      const referentielsMap = new Map<string, number>();
      const themesMap = new Map<string, number>();
      const blocsMap = new Map<string, number>();

      for (const oldQuestion of oldQuestions) {
        // @ts-ignore
        const oldReferentialCode = oldQuestion.referential;
        // @ts-ignore
        const oldThemeName = oldQuestion.theme; // Supposons que c'est le nom/code du thème

        if (!oldReferentialCode || !oldThemeName) {
          console.warn(`Question ID ${oldQuestion.id} has missing referential or theme. Skipping migration for this question.`);
          // @ts-ignore
          oldQuestion.blocId = null; // ou une valeur par défaut si nécessaire
          continue;
        }

        let referentielId = referentielsMap.get(oldReferentialCode);
        if (!referentielId) {
          try {
            const newRefId = await tx.table('referentiels').add({
              code: oldReferentialCode,
              nom_complet: oldReferentialCode // Utiliser le code comme nom complet par défaut
            });
            referentielId = newRefId as number;
            referentielsMap.set(oldReferentialCode, referentielId);
          } catch (e) {
            // Gérer le cas où le référentiel existe déjà (si plusieurs questions partagent le même)
            const existingRef = await tx.table('referentiels').where('code').equals(oldReferentialCode).first();
            if (existingRef) referentielId = existingRef.id;
            else throw e; // Renvoyer l'erreur si ce n'est pas une contrainte d'unicité
          }
        }

        const themeCodeForMap = `${referentielId}_${oldThemeName}`;
        let themeId = themesMap.get(themeCodeForMap);
        if (!themeId && referentielId) {
          try {
            const newThemeId = await tx.table('themes').add({
              code_theme: oldThemeName, // Utiliser l'ancien nom du thème comme code
              nom_complet: oldThemeName, // Utiliser l'ancien nom du thème comme nom complet
              referentiel_id: referentielId
            });
            themeId = newThemeId as number;
            themesMap.set(themeCodeForMap, themeId);
          } catch (e) {
            const existingTheme = await tx.table('themes').where('code_theme').equals(oldThemeName).and(t => t.referentiel_id === referentielId).first();
            if (existingTheme) themeId = existingTheme.id;
            else throw e;
          }
        }

        // Création d'un bloc par défaut pour ce thème. Le code_bloc sera THEMECODE_DEFAULTBLOC
        const blocCodeForMap = `${themeId}_DEFAULTBLOC`;
        let blocId = blocsMap.get(blocCodeForMap);
        if (!blocId && themeId) {
          const defaultBlocCode = `${oldThemeName}_GEN`; // Exemple: R489PR_GEN
          try {
            const newBlocId = await tx.table('blocs').add({
              code_bloc: defaultBlocCode,
              theme_id: themeId
            });
            blocId = newBlocId as number;
            blocsMap.set(blocCodeForMap, blocId);
          } catch (e) {
             const existingBloc = await tx.table('blocs').where('code_bloc').equals(defaultBlocCode).and(b => b.theme_id === themeId).first();
             if (existingBloc) blocId = existingBloc.id;
             else throw e;
          }
        }

        // Mettre à jour la question avec le nouveau blocId
        // @ts-ignore
        oldQuestion.blocId = blocId;
        // @ts-ignore
        delete oldQuestion.referential;
        // @ts-ignore
        delete oldQuestion.theme;
      }

      // Mettre à jour toutes les questions en une seule fois
      if (oldQuestions.length > 0) {
        await tx.table('questions').bulkPut(oldQuestions);
      }
      console.log(`DB version 13 upgrade: Migrated ${oldQuestions.length} questions to new structure.`);
    });

    // Version 14: Mise à jour de la table sessions (referentiel -> referentielId, selectionBlocs -> selectedBlocIds)
    this.version(14).stores({
      sessions: '++id, nomSession, dateSession, referentielId, *selectedBlocIds, createdAt, location, status, questionMappings, notes, trainerId, *ignoredSlideGuids, resolvedImportAnomalies', // referentiel -> referentielId, selectionBlocs -> *selectedBlocIds

      // Reprise des autres tables
      questions: '++id, blocId, text, type, correctAnswer, timeLimit, isEliminatory, createdAt, usageCount, correctResponseRate, slideGuid, *options',
      referentiels: '++id, &code',
      themes: '++id, &code_theme, referentiel_id',
      blocs: '++id, &code_bloc, theme_id',
      sessionResults: '++id, sessionId, questionId, participantIdBoitier, answer, isCorrect, pointsObtained, timestamp',
      adminSettings: '&key',
      votingDevices: '++id, name, &serialNumber',
      trainers: '++id, name, isDefault',
      sessionQuestions: '++id, sessionId, dbQuestionId, slideGuid, blockId',
      sessionBoitiers: '++id, sessionId, participantId, visualId, serialNumber'
    }).upgrade(async tx => {
      console.log("DB version 14 upgrade: Modifying sessions table (referentiel -> referentielId, selectionBlocs -> selectedBlocIds).");
      await tx.table('sessions').toCollection().modify(async (session: any) => {
        if (session.referentiel && typeof session.referentiel === 'string') {
          const refCode = session.referentiel;
          const referentielObj = await tx.table('referentiels').where('code').equals(refCode).first();
          if (referentielObj) {
            session.referentielId = referentielObj.id;
          } else {
            // Gérer le cas où le code du référentiel n'existe pas :
            // peut-être créer un référentiel par défaut ou laisser referentielId undefined/null
            // Pour l'instant, on logue une erreur et on ne met pas de referentielId
            console.warn(`Migration v14: Référentiel avec code "${refCode}" non trouvé pour la session ID ${session.id}. referentielId ne sera pas défini.`);
            session.referentielId = null;
          }
        } else if (session.referentiel && typeof session.referentiel === 'number') {
             // Si c'était déjà un ID par hasard (peu probable vu la structure précédente)
            session.referentielId = session.referentiel;
        }
        delete session.referentiel; // Supprimer l'ancien champ

        // Migration de selectionBlocs vers selectedBlocIds
        // L'ancienne structure de selectionBlocs était { theme: string (nom du theme), blockId: string (lettre A, B...) }
        // La nouvelle structure attend un tableau d'IDs de blocs numériques.
        // Cette migration sera complexe car elle nécessite de retrouver les IDs à partir des noms/codes.
        // Pour simplifier, si selectionBlocs existe, on le met à un tableau vide,
        // car la logique de sélection des blocs sera revue.
        // Une migration plus poussée nécessiterait de :
        // 1. Pour chaque item dans session.selectionBlocs:
        //    a. Trouver le themeId basé sur themeName (et potentiellement referentielId si les noms de thèmes ne sont pas uniques globalement)
        //    b. Trouver le blocId basé sur blockLetter et themeId.
        //    c. Ajouter ce blocId numérique à selectedBlocIds.
        if (session.selectionBlocs && Array.isArray(session.selectionBlocs)) {
            // Logique de migration complexe omise pour l'instant.
            // On va juste initialiser selectedBlocIds comme un tableau vide.
            // Les sessions existantes perdront leur ancienne sélection de blocs,
            // mais la nouvelle logique de génération les recréera.
            console.warn(`Migration v14: Session ID ${session.id} avait 'selectionBlocs'. Il sera réinitialisé. Les blocs devront être re-sélectionnés si la session n'est pas encore 'completed'.`);
            session.selectedBlocIds = [];
        } else {
            session.selectedBlocIds = []; // Initialiser s'il n'existait pas
        }
        delete session.selectionBlocs;
      });
      console.log("DB version 14 upgrade: Sessions table modified.");
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

export const getBlocByCodeAndThemeId = async (code_bloc: string, theme_id: number): Promise<Bloc | undefined> => {
  try {
    return await db.blocs.where({ code_bloc, theme_id }).first();
  } catch (error) {
    console.error(`Error getting bloc with code_bloc ${code_bloc} and theme_id ${theme_id}: `, error);
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
    // let query = db.sessions.where('status').equals('completed'); // Unused variable

    let sessionsQuery = db.sessions.where('status').equals('completed');

    // Date filtering logic remains the same, but applied after fetching all completed sessions.
    // For very large datasets, fetching all then filtering in JS can be inefficient.
    // If performance becomes an issue, consider if Dexie's date range queries can be optimized
    // (e.g., by ensuring dateSession is properly indexed and queried).

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

    // Fetch all referentiels, themes, and blocs once to create lookup maps
    // This avoids repeated DB queries inside the loop.
    const allReferentiels = await db.referentiels.toArray();
    const allThemes = await db.themes.toArray();
    const allBlocs = await db.blocs.toArray();

    const referentielsMap = new Map(allReferentiels.map(r => [r.id, r]));
    const themesMap = new Map(allThemes.map(t => [t.id, t]));
    const blocsMap = new Map(allBlocs.map(b => [b.id, b]));

    for (const session of filteredSessions) {
      // session.selectedBlocIds is an array of numbers (bloc IDs)
      if (session.selectedBlocIds && session.selectedBlocIds.length > 0) {
        // session.referentielId should exist if selectedBlocIds exist and point to valid data.
        // However, the original BlockUsage interface expects a referential code/string.
        // We need to reconstruct this information.

        for (const blocId of session.selectedBlocIds) {
          const bloc = blocsMap.get(blocId);
          if (!bloc) {
            console.warn(`Bloc with ID ${blocId} not found for session ${session.id}. Skipping.`);
            continue;
          }

          const theme = themesMap.get(bloc.theme_id);
          if (!theme) {
            console.warn(`Theme with ID ${bloc.theme_id} not found for bloc ${blocId}. Skipping.`);
            continue;
          }

          const referentiel = referentielsMap.get(theme.referentiel_id);
          if (!referentiel) {
            console.warn(`Referentiel with ID ${theme.referentiel_id} not found for theme ${theme.id}. Skipping.`);
            continue;
          }

          // The key for usageMap should uniquely identify the block.
          // Using referentiel.code, theme.code_theme, and bloc.code_bloc provides human-readable unique key.
          const key = `${referentiel.code}-${theme.code_theme}-${bloc.code_bloc}`;

          if (usageMap.has(key)) {
            const currentUsage = usageMap.get(key)!;
            currentUsage.usageCount++;
          } else {
            usageMap.set(key, {
              referentiel: referentiel.code, // Use code as per original BlockUsage interface
              theme: theme.code_theme,     // Use code_theme
              blockId: bloc.code_bloc,     // Use code_bloc
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
    if (id !== undefined) {
      logger.info(`Session créée : "${session.nomSession}"`, {
        eventType: 'SESSION_CREATED',
        sessionId: id,
        sessionName: session.nomSession,
        referentialId: session.referentielId, // Changed from session.referentiel
        participantsCount: session.participants?.length || 0
      });
    }
    return id;
  } catch (error) {
    logger.error(`Erreur lors de la création de la session "${session.nomSession}"`, { error, sessionDetails: session });
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
    const numAffected = await db.sessions.update(id, updates);
    if (numAffected > 0) {
      // Pour obtenir le nom de la session, il faudrait soit le passer dans `updates` (s'il change),
      // soit le récupérer. Pour l'instant, on logue avec l'ID.
      // Si `updates.nomSession` existe, on peut l'utiliser.
      const sessionName = updates.nomSession || (await db.sessions.get(id))?.nomSession || `ID ${id}`;
      const logDetails: any = {
        eventType: 'SESSION_UPDATED',
        sessionId: id,
        updatedFields: Object.keys(updates)
      };
      if (updates.participants) {
        logDetails.participantsCount = updates.participants.length;
      }
      logger.info(`Session modifiée : "${sessionName}"`, logDetails);
    }
    return id; // update ne retourne pas l'id directement, mais on le passe en argument
  } catch (error) {
    logger.error(`Erreur lors de la modification de la session ID ${id}`, { error, updates });
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

// --- CRUD pour SessionQuestion ---
export const addSessionQuestion = async (sq: SessionQuestion): Promise<number | undefined> => {
  try {
    return await db.sessionQuestions.add(sq);
  } catch (error) {
    console.error("Error adding session question:", error);
  }
};

export const addBulkSessionQuestions = async (questions: SessionQuestion[]): Promise<number[] | undefined> => {
  try {
    const ids = await db.sessionQuestions.bulkAdd(questions, { allKeys: true });
    return ids as number[];
  } catch (error) {
    console.error("Error bulk adding session questions:", error);
  }
};

export const getSessionQuestionsBySessionId = async (sessionId: number): Promise<SessionQuestion[]> => {
  try {
    return await db.sessionQuestions.where({ sessionId }).toArray();
  } catch (error) {
    console.error(`Error getting session questions for session ${sessionId}:`, error);
    return [];
  }
};

export const deleteSessionQuestionsBySessionId = async (sessionId: number): Promise<void> => {
  try {
    await db.sessionQuestions.where({ sessionId }).delete();
  } catch (error) {
    console.error(`Error deleting session questions for session ${sessionId}:`, error);
  }
};

// --- CRUD pour SessionBoitier ---
export const addSessionBoitier = async (sb: SessionBoitier): Promise<number | undefined> => {
  try {
    return await db.sessionBoitiers.add(sb);
  } catch (error) {
    console.error("Error adding session boitier:", error);
  }
};

export const addBulkSessionBoitiers = async (boitiers: SessionBoitier[]): Promise<number[] | undefined> => {
  try {
    const ids = await db.sessionBoitiers.bulkAdd(boitiers, { allKeys: true });
    return ids as number[];
  } catch (error) {
    console.error("Error bulk adding session boitiers:", error);
  }
};

export const getSessionBoitiersBySessionId = async (sessionId: number): Promise<SessionBoitier[]> => {
  try {
    return await db.sessionBoitiers.where({ sessionId }).toArray();
  } catch (error) {
    console.error(`Error getting session boitiers for session ${sessionId}:`, error);
    return [];
  }
};

export const deleteSessionBoitiersBySessionId = async (sessionId: number): Promise<void> => {
  try {
    await db.sessionBoitiers.where({ sessionId }).delete();
  } catch (error) {
    console.error(`Error deleting session boitiers for session ${sessionId}:`, error);
  }
};

// --- CRUD pour Referentiels ---
export const addReferential = async (referential: Omit<Referential, 'id'>): Promise<number | undefined> => {
  try {
    const id = await db.referentiels.add(referential as Referential);
    return id;
  } catch (error) {
    console.error("Error adding referential: ", error);
    throw error; // Renvoyer l'erreur pour la gestion dans l'UI
  }
};

export const getAllReferentiels = async (): Promise<Referential[]> => {
  try {
    return await db.referentiels.toArray();
  } catch (error) {
    console.error("Error getting all referentiels: ", error);
    return [];
  }
};

export const getReferentialByCode = async (code: string): Promise<Referential | undefined> => {
  try {
    return await db.referentiels.where('code').equals(code).first();
  } catch (error) {
    console.error(`Error getting referential with code ${code}: `, error);
  }
};

// --- CRUD pour Themes ---
export const addTheme = async (theme: Omit<Theme, 'id'>): Promise<number | undefined> => {
  try {
    const id = await db.themes.add(theme as Theme);
    // Création automatique d'un bloc par défaut pour ce thème
    if (id) {
      const defaultBlocCode = `${theme.code_theme}_GEN`; // Ex: R489PR_GEN
      await addBloc({ code_bloc: defaultBlocCode, theme_id: id });
    }
    return id;
  } catch (error) {
    console.error("Error adding theme: ", error);
    throw error;
  }
};

export const getAllThemes = async (): Promise<Theme[]> => {
  try {
    return await db.themes.toArray();
  } catch (error) {
    console.error("Error getting all themes: ", error);
    return [];
  }
};

export const getThemesByReferentialId = async (referentielId: number): Promise<Theme[]> => {
  try {
    return await db.themes.where('referentiel_id').equals(referentielId).toArray();
  } catch (error) {
    console.error(`Error getting themes for referential id ${referentielId}:`, error);
    return [];
  }
};

export const getThemeByCodeAndReferentialId = async (code_theme: string, referentiel_id: number): Promise<Theme | undefined> => {
  try {
    return await db.themes.where({ code_theme, referentiel_id }).first();
  } catch (error) {
    console.error(`Error getting theme with code_theme ${code_theme} and referentiel_id ${referentiel_id}: `, error);
  }
};


// --- CRUD pour Blocs ---
export const addBloc = async (bloc: Omit<Bloc, 'id'>): Promise<number | undefined> => {
  try {
    const id = await db.blocs.add(bloc as Bloc);
    return id;
  } catch (error) {
    console.error("Error adding bloc: ", error);
    throw error;
  }
};

export const getAllBlocs = async (): Promise<Bloc[]> => {
  try {
    return await db.blocs.toArray();
  } catch (error) {
    console.error("Error getting all blocs: ", error);
    return [];
  }
};

export const getBlocsByThemeId = async (themeId: number): Promise<Bloc[]> => {
  try {
    return await db.blocs.where('theme_id').equals(themeId).toArray();
  } catch (error) {
    console.error(`Error getting blocs for theme id ${themeId}:`, error);
    return [];
  }
};