import React, { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { FileText, Edit, Trash2, Image, AlertTriangle, TrendingUp, TrendingDown, Upload, CheckCircle, XCircle } from 'lucide-react'; // Removed Copy
import * as XLSX from 'xlsx';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
// Removed CACESReferential, referentials, questionThemes from here as they will be dynamic
// Removed QuestionTheme, CACESReferential
import { Referential, Theme, Bloc } from '../../types'; 
import { StorageManager, StoredQuestion } from '../../services/StorageManager';
type QuestionLibraryProps = {
  onEditQuestion: (id: string) => void;
};

const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onEditQuestion }) => {
  const [selectedReferential, setSelectedReferential] = useState<string>(''); // Store ID
  const [selectedTheme, setSelectedTheme] = useState<string>(''); // Store ID
  const [selectedBloc, setSelectedBloc] = useState<string>(''); // Store ID, New filter
  const [selectedEliminatory, setSelectedEliminatory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data for filters
  const [referentielsData, setReferentielsData] = useState<Referential[]>([]); // For filters and enrichment
  const [themesData, setThemesData] = useState<Theme[]>([]); // For filter dropdowns
  const [blocsData, setBlocsData] = useState<Bloc[]>([]); // For filter dropdowns

  const [allThemesData, setAllThemesData] = useState<Theme[]>([]); // For enrichment lookup
  const [allBlocsData, setAllBlocsData] = useState<Bloc[]>([]); // For enrichment lookup

  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs pour les nouveaux imports
  const referentialFileInputRef = useRef<HTMLInputElement>(null);
  const themeFileInputRef = useRef<HTMLInputElement>(null);

  // États pour les messages d'import spécifiques
  const [isImportingReferentiels, setIsImportingReferentiels] = useState(false);
  const [importReferentielsStatusMessage, setImportReferentielsStatusMessage] = useState<string | null>(null);
  const [importReferentielsError, setImportReferentielsError] = useState<string | null>(null);

  const [isImportingThemes, setIsImportingThemes] = useState(false);
  const [importThemesStatusMessage, setImportThemesStatusMessage] = useState<string | null>(null);
  const [importThemesError, setImportThemesError] = useState<string | null>(null);


  const fetchQuestions = async () => { // Made fetchQuestions a standalone function
    setIsLoading(true);
    try {
      const fetchedQuestions = await StorageManager.getAllQuestions();
      setQuestions(fetchedQuestions);
      setError(null);
    } catch (err) {
      console.error("Error fetching questions: ", err);
      setError("Failed to load questions.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      const refs = await StorageManager.getAllReferentiels();
      setReferentielsData(refs); // Used for filters and enrichment

      const allThemes = await StorageManager.getAllThemes();
      setAllThemesData(allThemes); // Used for enrichment

      const allBlocs = await StorageManager.getAllBlocs();
      setAllBlocsData(allBlocs); // Used for enrichment

      // Initial load for filter-specific themes and blocs can be empty
      // or based on a default selection if any.
      // These will be populated by the useEffect hooks below based on filter selections.
      setThemesData([]); // For filter dropdown
      setBlocsData([]);  // For filter dropdown

    } catch (error) {
      console.error("Error loading filter data:", error);
      setError("Erreur lors du chargement des données de filtre.");
    }
  };

  useEffect(() => {
    // Load themes for FILTER dropdown when selectedReferential changes
    if (selectedReferential) {
      StorageManager.getThemesByReferentialId(parseInt(selectedReferential, 10))
        .then(themes => setThemesData(themes)) // Populates themesData for the filter dropdown
        .catch(error => {
          console.error("Error loading themes for filter:", error);
          setThemesData([]); // Ensure it's reset on error
        });
      setSelectedTheme(''); // Reset theme filter selection
      setBlocsData([]);   // Clear bloc filter dropdown
    } else {
      setThemesData([]); // Clear theme filter dropdown if no referential is selected
      setBlocsData([]);   // Clear bloc filter dropdown
    }
  }, [selectedReferential]);

  useEffect(() => {
    // Load blocs for FILTER dropdown when selectedTheme changes
    if (selectedTheme) {
      StorageManager.getBlocsByThemeId(parseInt(selectedTheme, 10))
        .then(blocs => setBlocsData(blocs)) // Populates blocsData for the filter dropdown
        .catch(error => {
          console.error("Error loading blocs for filter:", error);
          setBlocsData([]); // Ensure it's reset on error
        });
      setSelectedBloc(''); // Reset bloc filter selection
    } else {
      setBlocsData([]); // Clear bloc filter dropdown if no theme is selected
    }
  }, [selectedTheme]);

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatusMessage(`Importation du fichier ${file.name}...`);
    setImportError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) { // Header + at least one data row
        throw new Error("Le fichier est vide ou ne contient pas de données de question.");
      }

      const headerRow = jsonRows[0] as string[];
      // Define expected headers based on user's list (keys are normalized for internal use)
      const expectedHeaders: Record<string, string> = {
        texte: 'texte',
        // referential: 'referential', // Remplacé
        // theme: 'theme', // Remplacé
        referentiel_code: 'referentiel_code', // Nouveau
        theme_code: 'theme_code',         // Nouveau
        bloc_code: 'bloc_code',           // Nouveau
        optiona: 'optionA',
        optionb: 'optionB',
        optionc: 'optionC',
        optiond: 'optionD',
        correctanswer: 'correctAnswer',
        iseliminatory: 'isEliminatory',
        timelimit: 'timeLimit',
        imagename: 'imageName',
        // type: 'type', // Type column is no longer strictly needed for import logic, will default to multiple-choice
      };

      const headerMap: Record<string, number> = {}; // Maps internal key to column index
      headerRow.forEach((header, index) => {
        const normalizedHeader = (header || '').toString().toLowerCase().replace(/\s+/g, '');
        if (expectedHeaders[normalizedHeader]) { // If direct match with a normalized key
            headerMap[expectedHeaders[normalizedHeader]] = index;
        } else { // Fallback to check against display values if needed (less strict)
            for (const key in expectedHeaders) {
                if (normalizedHeader === expectedHeaders[key].toLowerCase().replace(/\s+/g, '')) {
                    headerMap[expectedHeaders[key]] = index; // Map internal key to index
                    break;
                }
            }
        }
      });

      // Validate required headers (using internal keys) - 'type' is removed from here
      const requiredImportKeys = ['texte', 'referentiel_code', 'theme_code', 'bloc_code', 'correctAnswer', 'optionA', 'optionB', 'isEliminatory'];
      for (const key of requiredImportKeys) {
        if (headerMap[key] === undefined) {
          // Try to find the display name for the error message
          let displayNameForKey = key;
          for (const k in expectedHeaders) {
            if (expectedHeaders[k] === key) {
              displayNameForKey = k; // Use the original key from expectedHeaders if found (e.g. 'referentiel_code')
              break;
            }
          }
          throw new Error(`Colonne manquante ou mal nommée dans le fichier Excel : "${displayNameForKey}"`);
        }
      }

      let questionsAdded = 0;
      const errorsEncountered: string[] = [];

      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i] as any[];
        if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) {
            continue; // Skip empty row
        }

        const questionText = row[headerMap['texte']];
        if (!questionText || questionText.toString().trim() === '') {
            errorsEncountered.push(`Ligne ${i + 1}: Le champ 'texte' est manquant.`);
            continue;
        }

        // All questions are now 'multiple-choice'
        const StoredQuestionType: 'multiple-choice' = 'multiple-choice';
        let options: string[] = [];
        let correctAnswerStr: string = '';

        // Check if it looks like a True/False question based on options (e.g. optionA is "Vrai", optionB is "Faux", C & D are empty)
        // This is an interpretation based on common patterns if the 'type' column is absent or ignored.
        const optA = (row[headerMap['optionA']] || '').toString().trim();
        const optB = (row[headerMap['optionB']] || '').toString().trim();
        const optC = (row[headerMap['optionC']] || '').toString().trim();
        const optD = (row[headerMap['optionD']] || '').toString().trim();

        options = [optA, optB];
        if (optC !== '') options.push(optC);
        if (optD !== '') options.push(optD);
        options = options.filter(opt => opt !== ''); // Remove any fully empty options that might have been added

        if (options.length < 2) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Au moins 2 options (OptionA et OptionB) doivent être renseignées.`);
            continue;
        }

        // Get referentiel_code, theme_code, bloc_code
        const referentielCode = (row[headerMap['referentiel_code']] || '').toString().trim();
        const themeCode = (row[headerMap['theme_code']] || '').toString().trim();
        const blocCode = (row[headerMap['bloc_code']] || '').toString().trim();

        if (!referentielCode || !themeCode || !blocCode) {
          errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): 'referentiel_code', 'theme_code', et 'bloc_code' sont requis.`);
          continue;
        }

        let blocIdToStore: number | undefined = undefined;
        try {
          const referentiel = await StorageManager.getReferentialByCode(referentielCode);
          if (!referentiel || !referentiel.id) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Référentiel avec code "${referentielCode}" non trouvé.`);
            continue;
          }
          const theme = await StorageManager.getThemeByCodeAndReferentialId(themeCode, referentiel.id);
          if (!theme || !theme.id) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Thème avec code "${themeCode}" non trouvé pour le référentiel "${referentielCode}".`);
            continue;
          }
          const bloc = await StorageManager.getBlocByCodeAndThemeId(blocCode, theme.id);
          if (!bloc || !bloc.id) {
            // MODIFICATION: Tentative de création de n'importe quel bloc (GEN ou non-GEN) s'il n'existe pas.
            console.log(`Bloc "${blocCode}" non trouvé pour le thème "${themeCode}". Tentative de création...`);
            const newBlocId = await StorageManager.addBloc({ code_bloc: blocCode, theme_id: theme.id });
            if (newBlocId) {
              blocIdToStore = newBlocId;
              console.log(`Bloc "${blocCode}" créé automatiquement pour le thème "${themeCode}" avec ID: ${newBlocId}.`);
            } else {
              errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Création automatique du bloc "${blocCode}" pour le thème "${themeCode}" a échoué.`);
              continue;
            }
          } else {
            blocIdToStore = bloc.id;
          }
        } catch (dbError: any) {
          errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Erreur DB lors de la recherche/création de référentiel/thème/bloc: ${dbError.message}`);
          continue;
        }

        if (blocIdToStore === undefined) {
            // This should ideally be caught by earlier checks, but as a safeguard:
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Impossible de déterminer le blocId.`);
            continue;
        }


        const correctAnswerLetter = (row[headerMap['correctAnswer']] || '').toString().toUpperCase();
        if (correctAnswerLetter === 'A') correctAnswerStr = "0";
        else if (correctAnswerLetter === 'B') correctAnswerStr = "1";
        else if (correctAnswerLetter === 'C' && options.length > 2) correctAnswerStr = "2";
        else if (correctAnswerLetter === 'D' && options.length > 3) correctAnswerStr = "3";
        else {
            // For a 2-option question that might be True/False, allow 'VRAI'/'FAUX' as correct answer
            if (options.length === 2) {
                if (correctAnswerLetter === 'VRAI' && (optA.toUpperCase() === 'VRAI' || options[0].toUpperCase() === correctAnswerLetter)) correctAnswerStr = "0";
                else if (correctAnswerLetter === 'FAUX' && (optB.toUpperCase() === 'FAUX' || options[1].toUpperCase() === correctAnswerLetter)) correctAnswerStr = "1";
                else {
                     errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Valeur de 'correctAnswer' (${correctAnswerLetter}) invalide. Utilisez A, B, C, D ou Vrai/Faux pour les questions à 2 options.`);
                     continue;
                }
            } else {
                errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Valeur de 'correctAnswer' (${correctAnswerLetter}) invalide ou option correspondante non disponible.`);
                continue;
            }
        }

        // Validate if the selected correct option actually has content
        const caIdx = parseInt(correctAnswerStr, 10);
        if (!options[caIdx]?.trim()) { // Check against the potentially filtered options list
           errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): L'option correcte '${correctAnswerLetter}' est vide ou non définie.`);
           continue;
        }

        // OBSOLETE VALIDATION BLOCK - referential is now determined by referentiel_code, theme_code, bloc_code
        // const referentialRaw = (row[headerMap['referential']] || '').toString().toUpperCase();
        // if (!Object.values(CACESReferential).includes(referentialRaw as CACESReferential)) {
        //     errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Référentiel "${referentialRaw}" invalide.`);
        //     continue;
        // }

        const isEliminatoryRaw = (row[headerMap['isEliminatory']] || 'Non').toString().trim().toUpperCase();
        let isEliminatoryBool = false;
        if (isEliminatoryRaw === 'OUI' || isEliminatoryRaw === 'TRUE' || isEliminatoryRaw === '1') {
            isEliminatoryBool = true;
        } else if (isEliminatoryRaw !== 'NON' && isEliminatoryRaw !== 'FALSE' && isEliminatoryRaw !== '0') {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Valeur pour 'isEliminatory' (${isEliminatoryRaw}) invalide. Utilisez Oui/Non, True/False, 0/1.`);
            continue;
        }

        // Construire l'objet newQuestionData avec blocIdToStore
        const newQuestionData: Omit<StoredQuestion, 'id'> = {
          text: questionText.toString(),
          type: StoredQuestionType,
          options: options,
          correctAnswer: correctAnswerStr,
          blocId: blocIdToStore, // Utiliser le blocId trouvé ou créé
          isEliminatory: isEliminatoryBool,
          timeLimit: parseInt(row[headerMap['timelimit']], 10) || 30,
          imageName: (row[headerMap['imagename']] || '').toString().trim() || undefined,
          // referential et theme sont supprimés de StoredQuestion et gérés via blocId
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
          correctResponseRate: 0,
          image: undefined, // Actual image blob not handled from this import
        };

        try {
            await StorageManager.addQuestion(newQuestionData);
            questionsAdded++;
        } catch (e: any) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Erreur DB - ${e.message}`);
        }
      }

      let summaryMessage = `${questionsAdded} question(s) importée(s) avec succès.`;
      if (errorsEncountered.length > 0) {
        summaryMessage += ` ${errorsEncountered.length} erreur(s) rencontrée(s).`;
        setImportError(errorsEncountered.join('\n'));
        console.error("Erreurs d'importation:", errorsEncountered);
      } else {
        setImportError(null);
      }
      setImportStatusMessage(summaryMessage);
      if (questionsAdded > 0) {
        await fetchQuestions(); // Refresh list
      }

    } catch (err: any) {
      console.error("Error importing file: ", err);
      setImportError(`Erreur lors de l'importation: ${err.message}`);
      setImportStatusMessage(null);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerReferentialFileInput = () => {
    referentialFileInputRef.current?.click();
  };

  const triggerThemeFileInput = () => {
    themeFileInputRef.current?.click();
  };

  // Placeholder import handlers for referentiels and themes
  const handleReferentialFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingReferentiels(true);
    setImportReferentielsStatusMessage(`Importation des référentiels du fichier ${file.name}...`);
    setImportReferentielsError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) {
        throw new Error("Le fichier est vide ou ne contient pas de données de référentiel.");
      }

      const headerRow = jsonRows[0] as string[];
      const expectedHeaders = { code: 'code', nom_complet: 'nom_complet' };
      const headerMap: Record<string, number> = {};

      headerRow.forEach((header, index) => {
        const normalizedHeader = (header || '').toString().toLowerCase().trim();
        if (normalizedHeader === expectedHeaders.code) headerMap.code = index;
        if (normalizedHeader === expectedHeaders.nom_complet) headerMap.nom_complet = index;
      });

      if (headerMap.code === undefined || headerMap.nom_complet === undefined) {
        throw new Error(`Colonnes manquantes ou mal nommées. Attendu: "${expectedHeaders.code}", "${expectedHeaders.nom_complet}".`);
      }

      let addedCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i] as any[];
        if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

        const code = row[headerMap.code]?.toString().trim();
        const nom_complet = row[headerMap.nom_complet]?.toString().trim();

        if (!code || !nom_complet) {
          errors.push(`Ligne ${i + 1}: Les champs 'code' et 'nom_complet' sont requis.`);
          continue;
        }

        try {
          // Vérifier si le référentiel existe déjà par son code
          const existing = await StorageManager.getReferentialByCode(code);
          if (existing) {
            errors.push(`Ligne ${i + 1}: Le référentiel avec le code "${code}" existe déjà (ID: ${existing.id}). Pas d'ajout.`);
            continue;
          }
          await StorageManager.addReferential({ code, nom_complet });
          addedCount++;
        } catch (e: any) {
          errors.push(`Ligne ${i + 1} (Code: ${code}): Erreur DB - ${e.message}`);
        }
      }

      let summaryMessage = `${addedCount} référentiel(s) importé(s) avec succès.`;
      if (errors.length > 0) {
        summaryMessage += ` ${errors.length} erreur(s) rencontrée(s).`;
        setImportReferentielsError(errors.join('\n'));
      } else {
        setImportReferentielsError(null);
      }
      setImportReferentielsStatusMessage(summaryMessage);
      // TODO: Rafraîchir la liste des référentiels si elle est affichée quelque part dynamiquement.
      // Pour l'instant, les filtres de questions sont statiques ou basés sur 'types/index.ts'

    } catch (err: any) {
      setImportReferentielsError(`Erreur lors de l'importation des référentiels: ${err.message}`);
      setImportReferentielsStatusMessage(null);
    } finally {
      setIsImportingReferentiels(false);
      if (referentialFileInputRef.current) referentialFileInputRef.current.value = "";
    }
  };

  const handleThemeFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingThemes(true);
    setImportThemesStatusMessage(`Importation des thèmes du fichier ${file.name}...`);
    setImportThemesError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) {
        throw new Error("Le fichier est vide ou ne contient pas de données de thème.");
      }

      const headerRow = jsonRows[0] as string[];
      const expectedHeaders = {
        code_theme: 'code_theme',
        nom_complet: 'nom_complet',
        referentiel_code: 'referentiel_code'
      };
      const headerMap: Record<string, number> = {};

      headerRow.forEach((header, index) => {
        const normalizedHeader = (header || '').toString().toLowerCase().trim();
        if (normalizedHeader === expectedHeaders.code_theme) headerMap.code_theme = index;
        if (normalizedHeader === expectedHeaders.nom_complet) headerMap.nom_complet = index;
        if (normalizedHeader === expectedHeaders.referentiel_code) headerMap.referentiel_code = index;
      });

      if (headerMap.code_theme === undefined || headerMap.nom_complet === undefined || headerMap.referentiel_code === undefined) {
        throw new Error(`Colonnes manquantes ou mal nommées. Attendu: "${expectedHeaders.code_theme}", "${expectedHeaders.nom_complet}", "${expectedHeaders.referentiel_code}".`);
      }

      let addedCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i] as any[];
        if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

        const code_theme = row[headerMap.code_theme]?.toString().trim();
        const nom_complet = row[headerMap.nom_complet]?.toString().trim();
        const referentiel_code = row[headerMap.referentiel_code]?.toString().trim();

        if (!code_theme || !nom_complet || !referentiel_code) {
          errors.push(`Ligne ${i + 1}: Les champs 'code_theme', 'nom_complet', et 'referentiel_code' sont requis.`);
          continue;
        }

        try {
          const parentReferentiel = await StorageManager.getReferentialByCode(referentiel_code);
          if (!parentReferentiel || parentReferentiel.id === undefined) {
            errors.push(`Ligne ${i + 1}: Référentiel parent avec code "${referentiel_code}" non trouvé pour le thème "${code_theme}".`);
            continue;
          }

          const existingTheme = await StorageManager.getThemeByCodeAndReferentialId(code_theme, parentReferentiel.id);
          if (existingTheme) {
            errors.push(`Ligne ${i + 1}: Le thème avec le code "${code_theme}" existe déjà pour le référentiel "${referentiel_code}". Pas d'ajout.`);
            continue;
          }

          await StorageManager.addTheme({ // Corrected: Call addTheme directly
            code_theme,
            nom_complet,
            referentiel_id: parentReferentiel.id
          });
          addedCount++;
        } catch (e: any) {
          errors.push(`Ligne ${i + 1} (Code Thème: ${code_theme}): Erreur DB - ${e.message}`);
        }
      }

      let summaryMessage = `${addedCount} thème(s) importé(s) avec succès (et bloc(s) par défaut "_GEN" créé(s)).`;
      if (errors.length > 0) {
        summaryMessage += ` ${errors.length} erreur(s) rencontrée(s).`;
        setImportThemesError(errors.join('\n'));
      } else {
        setImportThemesError(null);
      }
      setImportThemesStatusMessage(summaryMessage);
      // TODO: Rafraîchir la liste des thèmes si nécessaire

    } catch (err: any) {
      setImportThemesError(`Erreur lors de l'importation des thèmes: ${err.message}`);
      setImportThemesStatusMessage(null);
    } finally {
      setIsImportingThemes(false);
      if (themeFileInputRef.current) themeFileInputRef.current.value = "";
    }
  };

  const referentialOptions = useMemo(() => [
    { value: '', label: 'Tous les référentiels' },
    ...referentielsData.map(r => ({ value: r.id!.toString(), label: `${r.code} - ${r.nom_complet}` }))
  ], [referentielsData]);

  const themeOptions = useMemo(() => [
    { value: '', label: 'Tous les thèmes' },
    ...themesData.map(t => ({ value: t.id!.toString(), label: `${t.code_theme} - ${t.nom_complet}` }))
  ], [themesData]);

  const blocOptions = useMemo(() => [
    { value: '', label: 'Tous les blocs' },
    ...blocsData.map(b => ({ value: b.id!.toString(), label: b.code_bloc })) // Supposant que code_bloc est suffisant pour l'affichage
  ], [blocsData]);

  const eliminatoryOptions = [
    { value: '', label: 'Toutes les questions' },
    { value: 'true', label: 'Éliminatoires uniquement' },
    { value: 'false', label: 'Non éliminatoires uniquement' }
  ];

  const sortOptions = [
    { value: 'recent', label: 'Plus récentes' },
    { value: 'usage', label: 'Plus utilisées' },
    { value: 'success-rate', label: 'Taux de réussite' },
    { value: 'failure-rate', label: 'Taux d\'échec' }
  ];

  const filteredQuestions = useMemo(() => {
    return questions.filter(question => {
      const matchesReferential = !selectedReferential ||
        (question.blocId && referentielsData.some(r =>
          r.id?.toString() === selectedReferential &&
          themesData.some(t => t.referentiel_id === r.id && blocsData.some(b => b.theme_id === t.id && b.id === question.blocId))
        ));
      const matchesTheme = !selectedTheme ||
        (question.blocId && themesData.some(t =>
          t.id?.toString() === selectedTheme && blocsData.some(b => b.theme_id === t.id && b.id === question.blocId)
        ));
      const matchesBloc = !selectedBloc || (question.blocId?.toString() === selectedBloc);

      const matchesEliminatory = !selectedEliminatory ||
        (selectedEliminatory === 'true' && question.isEliminatory) ||
        (selectedEliminatory === 'false' && !question.isEliminatory);
      const matchesSearch = !searchText ||
        (question.text && question.text.toLowerCase().includes(searchText.toLowerCase()));

      return matchesReferential && matchesTheme && matchesBloc && matchesEliminatory && matchesSearch;
    });
  }, [questions, selectedReferential, selectedTheme, selectedBloc, selectedEliminatory, searchText, referentielsData, themesData, blocsData]);

  const sortedQuestions = useMemo(() => {
    const sortableItems: StoredQuestion[] = [...filteredQuestions];
    sortableItems.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'success-rate':
          return (b.correctResponseRate || 0) - (a.correctResponseRate || 0);
        case 'failure-rate':
          return (a.correctResponseRate ?? 100) - (b.correctResponseRate ?? 100);
        case 'recent':
        default:
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
    });
    return sortableItems;
  }, [filteredQuestions, sortBy]);

  // Enrichir les questions avec les noms de référentiel, thème, bloc
  const enrichedQuestions = useMemo(() => {
    // Use allReferentielsData, allThemesData, allBlocsData for enrichment lookups
    // Ensure these are populated before trying to enrich.
    // referentielsData is also fine as it contains all referentiels.
    if (isLoading || !referentielsData.length || !allThemesData.length || !allBlocsData.length) {
        // Show placeholders if master lookup data is not ready or questions are loading
        return sortedQuestions.map(q => ({
            ...q,
            referentialCode: q.blocId ? `ID Bloc: ${q.blocId}` : 'N/A', // Placeholder will be replaced by actual code or N/A
            themeName: q.blocId ? 'Chargement...' : 'N/A',
            blocName: q.blocId ? 'Chargement...' : 'N/A'
        }));
    }

    return sortedQuestions.map(question => {
      if (!question.blocId) {
        return { ...question, referentialCode: 'N/A', themeName: 'N/A', blocName: 'N/A' };
      }

      const bloc = allBlocsData.find(b => b.id === question.blocId);
      if (!bloc) {
        return { ...question, referentialCode: 'Erreur Bloc', themeName: 'Erreur Bloc', blocName: `ID Bloc: ${question.blocId}` };
      }

      const theme = allThemesData.find(t => t.id === bloc.theme_id);
      if (!theme) {
        return { ...question, referentialCode: 'Erreur Thème', themeName: `ID Thème: ${bloc.theme_id}`, blocName: bloc.code_bloc };
      }

      const referentiel = referentielsData.find(r => r.id === theme.referentiel_id); // referentielsData has all referentiels
      if (!referentiel) {
        return { ...question, referentialCode: `ID Réf: ${theme.referentiel_id}`, themeName: theme.nom_complet, blocName: bloc.code_bloc };
      }

      return {
        ...question,
        referentialCode: referentiel.code, // Use referentiel.code for display
        themeName: theme.nom_complet,    // Use theme.nom_complet for display
        blocName: bloc.code_bloc,        // Use bloc.code_bloc for display
      };
    });
  }, [sortedQuestions, referentielsData, allThemesData, allBlocsData, isLoading]);


  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    const urlsCreatedInThisRun: string[] = [];

    enrichedQuestions.forEach(question => { // Use enrichedQuestions here
      if (question.id && question.image instanceof Blob) {
        const url = URL.createObjectURL(question.image);
        newPreviews[question.id.toString()] = url;
        urlsCreatedInThisRun.push(url);
      }
    });

    // Revoke old URLs that are not in the new set
    Object.keys(imagePreviews).forEach(questionId => {
      if (!newPreviews[questionId]) {
        URL.revokeObjectURL(imagePreviews[questionId]);
      }
    });

    setImagePreviews(newPreviews);

    return () => {
      urlsCreatedInThisRun.forEach(url => URL.revokeObjectURL(url));
    };
  }, [sortedQuestions]);


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const getSuccessRateIcon = (rate?: number) => {
    if (rate == null) return null;
    if (rate >= 75) return <TrendingUp size={16} className="text-green-600" />;
    if (rate <= 50) return <TrendingDown size={16} className="text-red-600" />;
    return null;
  };

  if (isLoading) {
    return <div className="container mx-auto p-4">Chargement...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>;
  }

  return (
    <div>
      <Card title="Filtres et recherche" className="mb-6">
        <div className="flex justify-between items-start mb-4">
            <div> {/* Container for filter elements to allow them to take their natural space */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Select
                        label="Recommandation"
                        options={referentialOptions}
                        value={selectedReferential}
                        onChange={(e) => setSelectedReferential(e.target.value)}
                    />
                    <Select
                        label="Thème"
                        options={themeOptions}
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value)}
                        disabled={!selectedReferential || themesData.length === 0} // Désactiver si aucun référentiel sélectionné ou pas de thèmes
                    />
                    <Select
                        label="Bloc" // Nouveau filtre
                        options={blocOptions}
                        value={selectedBloc}
                        onChange={(e) => setSelectedBloc(e.target.value)}
                        disabled={!selectedTheme || blocsData.length === 0} // Désactiver si aucun thème sélectionné ou pas de blocs
                    />
                    <Select
                        label="Type"
                        options={eliminatoryOptions}
                        value={selectedEliminatory}
                        onChange={(e) => setSelectedEliminatory(e.target.value)}
                    />
                    <Select
                        label="Trier par"
                        options={sortOptions}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <Input
                        label="Recherche dans le texte"
                        placeholder="Rechercher une question..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                </div>
            </div>
            <div className="ml-4 flex-shrink-0 mt-6 space-y-2"> {/* Adjusted margin and added space-y-2 for button stacking */}
                {/* Input pour l'import de questions */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                />
                <Button
                    variant="primary"
                    icon={<Upload size={16}/>}
                    onClick={triggerFileInput}
                    disabled={isImporting}
                    className="w-full" // Make button full width
                >
                    {isImporting ? 'Importation Questions...' : 'Importer Questions'}
                </Button>

                {/* Input pour l'import de référentiels */}
                <input
                    type="file"
                    ref={referentialFileInputRef}
                    onChange={handleReferentialFileImport}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                />
                <Button
                    variant="secondary" // Different color for distinction
                    icon={<Upload size={16}/>}
                    onClick={triggerReferentialFileInput}
                    disabled={isImportingReferentiels}
                    className="w-full" // Make button full width
                >
                    {isImportingReferentiels ? 'Importation Référentiels...' : 'Importer Référentiels'}
                </Button>

                {/* Input pour l'import de thèmes */}
                <input
                    type="file"
                    ref={themeFileInputRef}
                    onChange={handleThemeFileImport}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                />
                <Button
                    variant="secondary" // Different color for distinction
                    icon={<Upload size={16}/>}
                    onClick={triggerThemeFileInput}
                    disabled={isImportingThemes}
                    className="w-full" // Make button full width
                >
                    {isImportingThemes ? 'Importation Thèmes...' : 'Importer Thèmes'}
                </Button>
            </div>
        </div>

        {/* Display Import Status for Questions */}
        {importStatusMessage && (
          <div className="mt-4 p-3 rounded-md bg-blue-100 text-blue-700 flex items-center">
            <CheckCircle size={20} className="mr-2" />
            <span>Questions: {importStatusMessage}</span>
          </div>
        )}
        {importError && (
          <div className="mt-4 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            <span>Questions: {importError}</span>
          </div>
        )}

        {/* Display Import Status for Referentiels */}
        {importReferentielsStatusMessage && (
          <div className={`mt-2 p-3 rounded-md ${importReferentielsError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>
            {importReferentielsError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}
            <span>Référentiels: {importReferentielsStatusMessage}</span>
          </div>
        )}
         {importReferentielsError && !importReferentielsStatusMessage && ( // Cas où il y a une erreur mais pas de message de statut (erreur initiale)
          <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            <span>Référentiels: {importReferentielsError}</span>
          </div>
        )}

        {/* Display Import Status for Themes */}
        {importThemesStatusMessage && (
          <div className={`mt-2 p-3 rounded-md ${importThemesError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>
            {importThemesError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}
            <span>Thèmes: {importThemesStatusMessage}</span>
          </div>
        )}
        {importThemesError && !importThemesStatusMessage && ( // Cas où il y a une erreur mais pas de message de statut
          <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            <span>Thèmes: {importThemesError}</span>
          </div>
        )}
      </Card>

      {/* Original filter and search card content moved above, this card is now just for the table */}
      {/*
      <Card title="Filtres et recherche" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Select
            label="Recommandation"
            options={referentialOptions}
            value={selectedReferential}
            onChange={(e) => setSelectedReferential(e.target.value)}
          />
          <Select
            label="Thème"
            options={themeOptions}
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
          />
          <Select
            label="Type"
            options={eliminatoryOptions}
            value={selectedEliminatory}
            onChange={(e) => setSelectedEliminatory(e.target.value)}
          />
          <Select
            label="Trier par"
            options={sortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
        </div>
        <Input
          label="Recherche dans le texte"
          placeholder="Rechercher une question..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </Card>
      */}

      <Card title={`Questions (${sortedQuestions.length})`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Question
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recommandation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thème
                </th>
                {/* Utilisation column removed */}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Taux de réussite
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Créée le
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrichedQuestions.map((question) => {
                // Cast question to include new properties for type safety in JSX
                const displayQuestion = question as StoredQuestion & { referentialCode?: string; themeName?: string; blocName?: string; };
                const imageUrl = displayQuestion.id ? imagePreviews[displayQuestion.id.toString()] : null;
                return (
                  <tr key={displayQuestion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 mr-3">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1 break-words">
                            {displayQuestion.text && displayQuestion.text.length > 80
                              ? `${displayQuestion.text.substring(0, 80)}...`
                              : displayQuestion.text
                            }
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {displayQuestion.isEliminatory && (
                              <Badge variant="danger">
                                <AlertTriangle size={12} className="mr-1" />
                                Éliminatoire
                              </Badge>
                            )}
                            {displayQuestion.image instanceof Blob && imageUrl && (
                              <>
                                <Badge variant="default">
                                  <Image size={12} className="mr-1" />
                                  Image
                                </Badge>
                                <img
                                  src={imageUrl}
                                  alt="Aperçu de la question"
                                  className="max-w-[50px] max-h-[50px] mt-1 rounded border"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="primary">{displayQuestion.referentialCode || 'N/A'}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {displayQuestion.themeName || 'N/A'} <br />
                      <span className="text-xs text-gray-400">{displayQuestion.blocName || 'N/A'}</span>
                    </td>
                    {/* Corresponding <td> for "Utilisation" removed */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900 mr-2">
                        {question.correctResponseRate != null ? `${question.correctResponseRate}%` : 'N/A'}
                      </span>
                      {getSuccessRateIcon(question.correctResponseRate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(question.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit size={16} />}
                        onClick={() => question.id && onEditQuestion(question.id.toString())}
                      >
                        Modifier
                      </Button>
                      {/* "Dupliquer" Button Removed
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Copy size={16} />}
                        type="button"
                      >
                        Dupliquer
                      </Button>
                      */}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
                        type="button"
                        // onClick={() => handleDelete(question.id)} // Placeholder
                      >
                        Supprimer
                      </Button>
                    </div>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default QuestionLibrary;