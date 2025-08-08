# Documentation Technique - EvalActive

## 1. Introduction
   - **Objectif de l'application :** EvalActive est une application de bureau conçue pour la création, la gestion et l'analyse de sessions d'évaluation interactives. Elle permet aux formateurs d'utiliser des boîtiers de vote électroniques, d'importer les résultats en temps réel, et de générer des rapports détaillés.
   - **Public cible :** L'application est principalement destinée aux organismes de formation, aux formateurs et aux administrateurs chargés de piloter et de certifier des compétences, notamment dans le cadre de formations réglementées comme le CACES.

## 2. Architecture Générale
   L'application repose sur une architecture moderne combinant la robustesse d'un backend local avec la flexibilité d'une interface web.

   - **Framework Principal (Electron) :** Electron est utilisé pour créer une application de bureau multiplateforme à partir de technologies web (JavaScript, HTML, CSS). Il orchestre deux processus principaux :
     - **Processus Principal (`main`) :** Il s'exécute en arrière-plan (environnement Node.js). Il a accès à toutes les API du système d'exploitation (gestion des fichiers, réseau, etc.). Dans EvalActive, il gère la fenêtre de l'application, la communication avec la base de données et les opérations lourdes comme la manipulation de fichiers. Le code source se trouve dans le dossier `electron/`.
     - **Processus de Rendu (`renderer`) :** C'est l'interface utilisateur de l'application, une page web qui s'exécute dans une fenêtre Chromium. Il n'a pas d'accès direct aux ressources du système pour des raisons de sécurité. Le code source se trouve dans le dossier `src/`.

   - **Interface Utilisateur (React) :** L'intégralité de l'interface est construite avec React et TypeScript, compilée à l'aide de Vite. Cette approche permet de créer une UI réactive, modulaire et facile à maintenir. Le style est géré par TailwindCSS.

   - **Base de données (SQLite) :** Toutes les données de l'application (sessions, participants, questions, résultats) sont stockées localement dans une base de données SQLite. La bibliothèque `better-sqlite3` est utilisée pour des interactions performantes et synchrones avec la base de données depuis le processus principal d'Electron.

   - **Communication Inter-Processus (IPC) :** Pour que l'interface (renderer) puisse demander des données ou déclencher des actions (comme sauvegarder un fichier), elle communique avec le processus principal (main) via les canaux IPC d'Electron. Le `renderer` envoie un message sur un canal (ex: `'get-all-sessions'`), et le `main` écoute sur ce canal, exécute la tâche demandée (ex: interroger la base de données), puis renvoie le résultat au `renderer`. Cette communication est définie dans `electron/ipcHandlers.ts`.

## 3. Prérequis et Installation

   ### Logiciels Requis
   - **Node.js :** Assurez-vous d'avoir une version LTS (Long Term Support) de Node.js installée. Vous pouvez la télécharger sur [nodejs.org](https://nodejs.org/).
   - **npm :** npm (Node Package Manager) est installé automatiquement avec Node.js. Il est utilisé pour gérer les dépendances du projet.
   - **Git :** Nécessaire pour cloner le dépôt du projet depuis la source.

   ### Étapes d'Installation

   1. **Cloner le dépôt :**
      ```bash
      git clone <URL_DU_DEPOT>
      cd CACESmodule
      ```

   2. **Installer les dépendances :**
      Cette commande va télécharger toutes les bibliothèques nécessaires listées dans `package.json`.
      ```bash
      npm install
      ```
      *Note : L'installation peut prendre quelques minutes. Elle inclut une étape `postinstall` qui recompile certains modules natifs (comme `better-sqlite3`) pour qu'ils soient compatibles avec la version d'Electron utilisée.*

   ### Lancer l'Application en Mode Développement

   Pour lancer l'application sur votre machine locale avec le rechargement à chaud (hot-reloading) pour l'interface React, utilisez la commande suivante :

   ```bash
   npm run dev
   ```

   Cette commande effectue les actions suivantes :
   - Elle construit le code de l'interface React (`src/`) et le code du processus principal d'Electron (`electron/`).
   - Elle lance l'application Electron.
   - Le processus de rendu (React) bénéficie du Hot-Reloading : les modifications dans le code de l'interface (`src/`) sont visibles quasi-instantanément sans avoir à redémarrer toute l'application.

   Pour un rechargement complet de l'application (y compris le processus principal d'Electron), vous pouvez utiliser :
   ```bash
   npm run electron-watch
   ```

## 4. Structure des Dossiers
   Le projet est organisé en plusieurs répertoires principaux, chacun ayant un rôle spécifique dans l'architecture de l'application.

   - **`electron/` :** Contient tout le code du **processus principal** d'Electron. C'est ici que sont gérées les interactions avec le système d'exploitation, la base de données, et les communications IPC.
     - `electron/index.ts` : Point d'entrée principal de l'application Electron.
     - `electron/db.ts` : Logique d'initialisation et d'accès à la base de données SQLite.
     - `electron/ipcHandlers.ts` : Définit les gestionnaires pour la communication inter-processus (IPC) entre le `renderer` et le `main`.
     - `electron/utils/` : Utilitaires spécifiques au processus principal (ex: `logger.ts`, `pptxOrchestrator.ts`).

   - **`src/` :** Contient le code du **processus de rendu** (l'interface utilisateur React).
     - `src/App.tsx` : Composant racine de l'application React.
     - `src/main.tsx` : Point d'entrée de l'application React.
     - `src/components/` : Regroupe les composants React réutilisables, organisés par fonctionnalité ou type (ex: `dashboard/`, `sessions/`, `ui/`).
     - `src/pages/` : Contient les composants React représentant les vues principales de l'application (ex: `Dashboard.tsx`, `Sessions.tsx`, `Reports.tsx`).
     - `src/services/` : Services côté client (renderer) qui interagissent avec le processus principal via IPC ou gèrent la logique métier spécifique à l'UI.
     - `src/stores/` : Contient les stores Zustand pour la gestion de l'état global de l'application.
     - `src/utils/` : Fonctions utilitaires côté client (ex: `csvProcessor.ts`, `excelProcessor.ts`).
     - `src/db_data/` : Emplacement par défaut du fichier de la base de données SQLite (`database.sqlite3`) en mode développement.

   - **`common/` :** Contient les définitions de types TypeScript (`.d.ts` ou `.ts`) qui sont partagées entre le processus principal et le processus de rendu. Cela assure la cohérence des données et des interfaces.

   - **`public/` :** Contient les ressources statiques qui sont servies directement par l'application, comme les modèles de fichiers (`templates/default.pptx`).

   - **`dist/` et `dist-electron/` :** Dossiers générés lors du processus de build, contenant les fichiers compilés et prêts pour le déploiement. Ne doivent pas être modifiés manuellement.

   - **`node_modules/` :** Contient toutes les dépendances du projet installées par npm. Ce dossier est ignoré par Git.

## 5. Dépendances Clés
   - **`better-sqlite3`**: Pilote haute performance pour l'interaction avec la base de données SQLite depuis le processus principal (Node.js).
   - **`exceljs`**: Utilisé pour la génération de rapports au format Excel (`.xlsx`).
   - **`jspdf` & `jspdf-autotable`**: Permettent la création de documents PDF, notamment pour les rapports.
   - **`html2canvas`**: Convertit des éléments HTML/CSS en images canvas, utilisé pour intégrer des graphiques ou des tableaux stylisés dans les PDF.
   - **`jszip` & `fast-xml-parser`**: Combinaison essentielle pour manipuler les fichiers `.pptx`. `jszip` traite le conteneur (archive ZIP), tandis que `fast-xml-parser` analyse et modifie le contenu XML des diapositives.
   - **`zustand`**: Bibliothèque de gestion d'état pour React, utilisée pour partager l'état global (comme les logs) à travers l'application de manière simple et performante.

## 6. Base de Données
   EvalActive utilise une base de données SQLite pour stocker toutes les données de l'application localement.

   - **Fichier de la base de données :** Le fichier est `database.sqlite3`. En développement, il se trouve dans `src/db_data/`. En production, il est stocké dans le répertoire des données utilisateur de l'application (`app.getPath('userData')`).

   - **Gestion :** La logique est centralisée dans `electron/db.ts`, qui utilise `better-sqlite3`.

   - **Schéma de la base de données :**
     Voici un aperçu des tables principales :
     - **`sessions`**: Table centrale contenant les informations sur chaque session d'évaluation (nom, date, statut, etc.).
     - **`questions`**: Bibliothèque de toutes les questions disponibles.
     - **`sessionQuestions`**: Table de liaison qui associe les questions d'une session spécifique.
     - **`participants`**: Liste de tous les participants enregistrés.
     - **`session_iterations`**: Gère les différentes passes ou itérations au sein d'une même session.
     - **`participant_assignments`**: Associe un participant à une itération de session et à un boîtier de vote.
     - **`sessionResults`**: Stocke les réponses de chaque participant à chaque question.
     - **`votingDevices`**: Liste des boîtiers de vote physiques.
     - **`deviceKits`**: Permet de grouper des boîtiers de vote en kits réutilisables.
     - **`referentiels`, `themes`, `blocs`**: Structure hiérarchique pour catégoriser les questions (ex: CACES R489 -> Thème 1 -> Bloc 1.1).
     - **`trainers`**: Table des formateurs.
     - **`adminSettings`**: Stocke des configurations globales (ex: chemin vers un modèle de rapport).

## 7. Gestion de l'état (Frontend)
   L'application utilise **Zustand** pour une gestion d'état globale et légère côté client (processus de rendu).

   - **Objectif :** Zustand est utilisé pour partager des états qui doivent être accessibles par de nombreux composants sans avoir à passer des `props` à travers de multiples niveaux (ce qu'on appelle le "prop drilling").
   - **Exemple d'utilisation :** Le store de logs (`src/stores/logStore.ts`) est un exemple clé. Il collecte les messages de log de différentes parties de l'application et les rend disponibles pour le composant `AppLogViewer.tsx`, qui les affiche à l'utilisateur.

## 8. Build et Déploiement
   - **Commande de Build :**
     Pour créer un installeur (`.exe` pour Windows), utilisez la commande :
     ```bash
     npm run build
     ```
     Cette commande exécute `vite build` pour compiler le code, puis `electron-builder` pour empaqueter l'application dans un installeur.

   - **Configuration :** La configuration du build se trouve dans la section `"build"` du `package.json`. Elle définit l'ID de l'application, le nom du produit, les fichiers à inclure, et le format de l'installeur.

   - **Fichiers de sortie :** L'installeur généré se trouve dans le dossier `release/`.