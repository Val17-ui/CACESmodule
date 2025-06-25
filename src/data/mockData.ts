import { Session, Participant, Question } from '../types'; // Questionnaire supprimé

export const mockSessions: Session[] = [
  {
    id: '1',
    name: 'Formation CACES R489 - Groupe Duval',
    date: '2025-07-15',
    referential: 'R489',
    status: 'planned',
    participantsCount: 12
  },
  {
    id: '2',
    name: 'CACES R486 - Entreprise Martin BTP',
    date: '2025-07-08',
    referential: 'R486',
    status: 'planned',
    participantsCount: 8
  },
  {
    id: '3',
    name: 'Formation Caristes R489 - LMN Logistics',
    date: '2025-06-30',
    referential: 'R489',
    status: 'in-progress',
    participantsCount: 15
  },
  {
    id: '4',
    name: 'CACES R482 - Chantier Nord',
    date: '2025-06-25',
    referential: 'R482',
    status: 'completed',
    participantsCount: 6
  },
  {
    id: '5',
    name: 'Session Ponts Roulants R484 - Industries ABC',
    date: '2025-06-20',
    referential: 'R484',
    status: 'completed',
    participantsCount: 10
  }
];

export const mockParticipants: Participant[] = [
  { id: '1', firstName: 'Jean', lastName: 'Dupont', organization: 'Duval Construction', identificationCode: 'DC001', deviceId: 1, hasSigned: true, score: 85, passed: true },
  { id: '2', firstName: 'Marie', lastName: 'Laurent', organization: 'Duval Construction', identificationCode: 'DC002', deviceId: 2, hasSigned: true, score: 92, passed: true },
  { id: '3', firstName: 'Pierre', lastName: 'Martin', organization: 'Martin BTP', identificationCode: 'MB001', deviceId: 3, hasSigned: false },
  { id: '4', firstName: 'Sophie', lastName: 'Dubois', organization: 'Martin BTP', identificationCode: 'MB002', deviceId: 4, hasSigned: false },
  { id: '5', firstName: 'Thomas', lastName: 'Leroy', organization: 'LMN Logistics', identificationCode: 'LMN001', deviceId: 5, hasSigned: true, score: 65, passed: false },
  { id: '6', firstName: 'Camille', lastName: 'Moreau', organization: 'Industries ABC', identificationCode: 'ABC001', deviceId: 6, hasSigned: true, score: 78, passed: true }
];

export const mockQuestions: Question[] = [
  {
    id: '1',
    text: 'Que signifie le pictogramme représentant une silhouette barrée dans la zone d\'évolution d\'un chariot élévateur ?',
    type: 'multiple-choice',
    options: [
      'Interdiction de lever des personnes', 
      'Présence d\'un opérateur obligatoire', 
      'Interdiction de circuler à pied', 
      'Obligation de porter un casque'
    ],
    correctAnswer: 2,
    timeLimit: 45,
    isEliminatory: true,
    referential: 'R489',
    theme: 'securite',
    createdAt: '2025-01-10',
    usageCount: 25,
    correctResponseRate: 78
  },
  {
    id: '2',
    text: 'Pour travailler en sécurité sur une PEMP (R486), le port du harnais de sécurité est obligatoire :',
    type: 'multiple-choice',
    options: [
      'Uniquement en cas de vent fort', 
      'Uniquement pour les PEMP du groupe B', 
      'En permanence une fois dans la nacelle', 
      'Uniquement si la hauteur dépasse 3 mètres'
    ],
    correctAnswer: 2,
    timeLimit: 30,
    isEliminatory: true,
    referential: 'R486',
    theme: 'securite',
    createdAt: '2025-01-15',
    usageCount: 18,
    correctResponseRate: 85
  },
  {
    id: '3',
    text: 'Avant d\'effectuer la prise en main d\'un chariot élévateur, l\'opérateur doit effectuer :',
    type: 'multiple-choice',
    options: [
      'Une vérification visuelle uniquement', 
      'Des vérifications et des essais de fonctionnement', 
      'Un essai en charge uniquement', 
      'Aucune vérification si le chariot a été utilisé le jour même'
    ],
    correctAnswer: 1,
    timeLimit: 45,
    isEliminatory: false,
    referential: 'R489',
    theme: 'technique',
    createdAt: '2025-01-20',
    usageCount: 32,
    correctResponseRate: 65
  },
  {
    id: '4',
    text: 'En cas de renversement latéral du chariot, l\'opérateur doit :',
    type: 'multiple-choice',
    options: [
      'Sauter immédiatement du chariot côté opposé au renversement', 
      'Rester dans le chariot et maintenir fermement le volant', 
      'Se pencher du côté opposé au renversement tout en restant dans le chariot', 
      'Essayer de contrebalancer le chariot avec son poids'
    ],
    correctAnswer: 1,
    timeLimit: 30,
    isEliminatory: true,
    referential: 'R489',
    theme: 'securite',
    createdAt: '2025-01-25',
    usageCount: 28,
    correctResponseRate: 45
  },
  {
    id: '5',
    text: 'Le VGP (Vérification Générale Périodique) d\'un engin de chantier CACES R482 doit être effectué :',
    type: 'multiple-choice',
    options: [
      'Tous les 3 mois', 
      'Tous les 6 mois', 
      'Tous les ans', 
      'Tous les 2 ans'
    ],
    correctAnswer: 2,
    timeLimit: 30,
    isEliminatory: false,
    referential: 'R482',
    theme: 'reglementation',
    createdAt: '2025-02-01',
    usageCount: 15,
    correctResponseRate: 72
  }
];

// mockQuestionnaires a été supprimé car l'entité Questionnaire n'est plus stockée.