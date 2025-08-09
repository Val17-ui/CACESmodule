import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Edit, Trash2, Image, AlertTriangle, TrendingUp, TrendingDown, Upload, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../ui/Table';
import { Referential, Theme, Bloc, QuestionType } from '@common/types';
import { StorageManager, StoredQuestion } from '../../services/StorageManager';

type QuestionLibraryProps = {
  onEditQuestion: (id: string) => void;
};

const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onEditQuestion }) => {
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedBloc, setSelectedBloc] = useState<string>('');
  const [selectedEliminatory, setSelectedEliminatory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [questions, setQuestions] = useState<StoredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [referentielsData, setReferentielsData] = useState<Referential[]>([]);
  const [themesData, setThemesData] = useState<Theme[]>([]);
  const [blocsData, setBlocsData] = useState<Bloc[]>([]);
  const [allThemesData, setAllThemesData] = useState<Theme[]>([]);
  const [allBlocsData, setAllBlocsData] = useState<Bloc[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [isImportingReferentiels, setIsImportingReferentiels] = useState(false);
  const [importReferentielsStatusMessage, setImportReferentielsStatusMessage] = useState<string | null>(null);
  const [importReferentielsError, setImportReferentielsError] = useState<string | null>(null);

  const [isImportingThemes, setIsImportingThemes] = useState(false);
  const [importThemesStatusMessage, setImportThemesStatusMessage] = useState<string | null>(null);
  const [importThemesError, setImportThemesError] = useState<string | null>(null);

  const fetchQuestions = async () => {
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
      setReferentielsData(refs);
      const allThemes = await StorageManager.getAllThemes();
      setAllThemesData(allThemes);
      const allBlocs = await StorageManager.getAllBlocs();
      setAllBlocsData(allBlocs);
      setThemesData([]);
      setBlocsData([]);
    } catch (error) {
      console.error("Error loading filter data:", error);
      setError("Erreur lors du chargement des données de filtre.");
    }
  };

  useEffect(() => {
    if (selectedReferential) {
      StorageManager.getThemesByReferentialId(parseInt(selectedReferential, 10))
        .then(themes => setThemesData(themes))
        .catch(error => {
          console.error("Error loading themes for filter:", error);
          setThemesData([]);
        });
      setSelectedTheme('');
      setBlocsData([]);
    } else {
      setThemesData([]);
      setBlocsData([]);
    }
  }, [selectedReferential]);

  useEffect(() => {
    if (selectedTheme) {
      StorageManager.getBlocsByThemeId(parseInt(selectedTheme, 10))
        .then(blocs => setBlocsData(blocs))
        .catch(error => {
          console.error("Error loading blocs for filter:", error);
          setBlocsData([]);
        });
      setSelectedBloc('');
    } else {
      setBlocsData([]);
    }
  }, [selectedTheme]);

  const handleFileImport = async () => {
    setIsImporting(true);
    setImportStatusMessage(null);
    setImportError(null);
    setImportProgress({ current: 0, total: 0 });

    try {
      const fileDialogResult = await window.dbAPI?.openExcelFileDialog();
      if (fileDialogResult?.canceled) {
        setIsImporting(false);
        return;
      }
      if (!fileDialogResult || fileDialogResult.error) {
        throw new Error(`Erreur de lecture du fichier: ${fileDialogResult?.error || 'inconnue'}`);
      }

      const fileBuffer = window.electronAPI?.Buffer_from(fileDialogResult.fileBuffer || '', 'base64');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) throw new Error("Le fichier est vide ou ne contient pas de données de question.");

      const headerRow = jsonRows[0] as string[];
      const dataRows = jsonRows.slice(1);
      setImportProgress({ current: 0, total: dataRows.length });

      const expectedHeaders: Record<string, string> = {
        id_question: 'userQuestionId', texte: 'texte', referentiel_code: 'referentiel_code',
        theme_code: 'theme_code', bloc_code: 'bloc_code', optiona: 'optionA', optionb: 'optionB',
        optionc: 'optionC', optiond: 'optionD', correctanswer: 'correctAnswer',
        iseliminatory: 'isEliminatory', timelimit: 'timeLimit', imagename: 'imageName', version: 'version',
      };

      const headerMap: Record<string, number> = {};
      headerRow.forEach((header, index) => {
        const normalizedHeader = (header || '').toString().toLowerCase().replace(/\s+/g, '');
        const internalKey = Object.keys(expectedHeaders).find(k => k === normalizedHeader || expectedHeaders[k].toLowerCase().replace(/\s+/g, '') === normalizedHeader);
        if (internalKey) {
            headerMap[expectedHeaders[internalKey]] = index;
        }
      });

      const requiredImportKeys = ['userQuestionId', 'texte', 'referentiel_code', 'theme_code', 'bloc_code', 'correctAnswer', 'optionA', 'optionB', 'isEliminatory', 'version'];
      for (const key of requiredImportKeys) {
        if (headerMap[key] === undefined) {
          const displayName = Object.keys(expectedHeaders).find(k => expectedHeaders[k] === key) || key;
          throw new Error(`Colonne manquante ou mal nommée dans le fichier Excel : "${displayName}"`);
        }
      }

      const questionsToUpsert: Omit<StoredQuestion, 'id'>[] = [];
      const errorsEncountered: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as any[];
        setImportProgress(prev => ({ ...prev, current: i + 1 }));

        if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

        const questionText = row[headerMap['texte']];
        if (!questionText || questionText.toString().trim() === '') {
            errorsEncountered.push(`Ligne ${i + 2}: Le champ 'texte' est manquant.`);
            continue;
        }

        const options = [
            (row[headerMap['optionA']] || '').toString().trim(),
            (row[headerMap['optionB']] || '').toString().trim(),
            (row[headerMap['optionC']] || '').toString().trim(),
            (row[headerMap['optionD']] || '').toString().trim()
        ].filter(opt => opt !== '');

        if (options.length < 2) {
            errorsEncountered.push(`Ligne ${i + 2} (${questionText.substring(0,20)}...): Au moins 2 options (OptionA et OptionB) doivent être renseignées.`);
            continue;
        }

        const referentielCode = (row[headerMap['referentiel_code']] || '').toString().trim();
        const themeCode = (row[headerMap['theme_code']] || '').toString().trim();
        const blocCode = (row[headerMap['bloc_code']] || '').toString().trim();

        if (!referentielCode || !themeCode || !blocCode) {
          errorsEncountered.push(`Ligne ${i + 2} (${questionText.substring(0,20)}...): 'referentiel_code', 'theme_code', et 'bloc_code' sont requis.`);
          continue;
        }

        let blocIdToStore: number | undefined;
        try {
          const referentiel = await StorageManager.getReferentialByCode(referentielCode);
          if (!referentiel?.id) { throw new Error(`Référentiel avec code "${referentielCode}" non trouvé.`); }

          const theme = await StorageManager.getThemeByCodeAndReferentialId(themeCode, referentiel.id);
          if (!theme?.id) { throw new Error(`Thème avec code "${themeCode}" non trouvé pour le référentiel "${referentielCode}".`); }

          let bloc = await StorageManager.getBlocByCodeAndThemeId(blocCode, theme.id);
          if (!bloc?.id) {
            const newBlocId = await StorageManager.addBloc({ code_bloc: blocCode, nom_complet: blocCode, theme_id: theme.id });
            if (!newBlocId) throw new Error(`Création automatique du bloc "${blocCode}" a échoué.`);
            blocIdToStore = newBlocId;
          } else {
            blocIdToStore = bloc.id;
          }
        } catch (dbError: any) {
          errorsEncountered.push(`Ligne ${i + 2} (${questionText.substring(0,20)}...): Erreur de structure - ${dbError.message}`);
          continue;
        }

        const correctAnswerLetter = (row[headerMap['correctAnswer']] || '').toString().toUpperCase();
        let correctAnswerStr = '';
        const letterMap: { [key: string]: string } = { 'A': '0', 'B': '1', 'C': '2', 'D': '3' };
        correctAnswerStr = letterMap[correctAnswerLetter];

        if (!correctAnswerStr && options.length === 2) {
            if (correctAnswerLetter === 'VRAI') correctAnswerStr = '0';
            else if (correctAnswerLetter === 'FAUX') correctAnswerStr = '1';
        }

        if (!correctAnswerStr || !options[parseInt(correctAnswerStr, 10)]?.trim()) {
            errorsEncountered.push(`Ligne ${i + 2} (${questionText.substring(0,20)}...): 'correctAnswer' ('${correctAnswerLetter}') invalide ou l'option est vide.`);
            continue;
        }

        const isEliminatoryRaw = (row[headerMap['isEliminatory']] || 'Non').toString().trim().toUpperCase();
        let isEliminatoryBool = false;
        if (['OUI', 'TRUE', '1'].includes(isEliminatoryRaw)) {
            isEliminatoryBool = true;
        } else if (!['NON', 'FALSE', '0'].includes(isEliminatoryRaw)) {
            errorsEncountered.push(`Ligne ${i + 2} (${questionText.substring(0,20)}...): Valeur pour 'isEliminatory' invalide. Utilisez Oui/Non, True/False, 0/1.`);
            continue;
        }

        questionsToUpsert.push({
          userQuestionId: (row[headerMap['userQuestionId']] || '').toString().trim(),
          text: questionText.toString(),
          type: QuestionType.QCM,
          options: options,
          correctAnswer: correctAnswerStr,
          blocId: blocIdToStore,
          isEliminatory: isEliminatoryBool,
          timeLimit: parseInt(row[headerMap['timelimit']], 10) || 30,
          imageName: (row[headerMap['imageName']] || '').toString().trim() || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
          correctResponseRate: 0,
          version: (row[headerMap['version']] || '').toString().trim(),
        });
      }

      if (questionsToUpsert.length > 0) {
        await StorageManager.bulkUpsertQuestions(questionsToUpsert);
      }

      let summaryMessage = `${questionsToUpsert.length} question(s) importée(s) avec succès.`;
      if (errorsEncountered.length > 0) {
        summaryMessage += ` ${errorsEncountered.length} erreur(s) rencontrée(s).`;
        setImportError(errorsEncountered.join('\n'));
      } else {
        setImportError(null);
      }
      setImportStatusMessage(summaryMessage);
      if (questionsToUpsert.length > 0) {
        await fetchQuestions();
      }

    } catch (err: any) {
      console.error("Error importing file: ", err);
      setImportError(`Erreur lors de l'importation: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ... (rest of the file is the same)
  const triggerFileInput = () => {
    handleFileImport();
  };

  const triggerReferentialFileInput = () => {
    handleReferentialFileImport();
  };

  const triggerThemeFileInput = () => {
    handleThemeFileImport();
  };

  // Placeholder import handlers for referentiels and themes
  const handleReferentialFileImport = async () => {
    setIsImportingReferentiels(true);
    setImportReferentielsStatusMessage(`Ouverture de la boîte de dialogue...`);
    setImportReferentielsError(null);

    try {
      if (!window.dbAPI || !window.dbAPI.openExcelFileDialog) {
        throw new Error("window.dbAPI.openExcelFileDialog is not available.");
      }

      const fileDialogResult = await window.dbAPI.openExcelFileDialog();

      if (fileDialogResult?.canceled) {
        setImportReferentielsStatusMessage('Importation annulée.');
        setIsImportingReferentiels(false);
        return;
      }

      if (!fileDialogResult) {
        throw new Error("File dialog did not return a result.");
      }

      if (fileDialogResult.error) {
        throw new Error(`Erreur de lecture du fichier: ${fileDialogResult.error}`);
      }
      const fileBuffer = window.electronAPI?.Buffer_from(fileDialogResult.fileBuffer || '', 'base64');
      setImportStatusMessage(`Importation du fichier ${fileDialogResult.fileName || 'inconnu'}...`);

      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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
          const existing = await StorageManager.getReferentialByCode(code);
          if (existing) {
            console.log(`Ligne ${i + 1}: Le référentiel avec le code "${code}" existe déjà (ID: ${existing.id}). Ignoré.`);
            continue;
          }
          await StorageManager.addReferential({ code, nom_complet });
          addedCount++;
        } catch (e: any) {
          const errorMessage = e.message || 'Erreur inconnue';
          console.error(`[Import Referentiels] Erreur à la ligne ${i + 1} (Code: ${code}):`, errorMessage);
          errors.push(`Ligne ${i + 1} (Code: ${code}): Erreur DB - ${errorMessage}`);
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

    } catch (err: any) {
      setImportReferentielsError(`Erreur lors de l'importation des référentiels: ${err.message}`);
      setImportReferentielsStatusMessage(null);
    } finally {
      setIsImportingReferentiels(false);
    }
  };

  const handleThemeFileImport = async () => {
    setIsImportingThemes(true);
    setImportThemesStatusMessage(`Ouverture de la boîte de dialogue...`);
    setImportThemesError(null);

    try {
      if (!window.dbAPI || !window.dbAPI.openExcelFileDialog) {
        throw new Error("window.dbAPI.openExcelFileDialog is not available.");
      }

      const fileDialogResult = await window.dbAPI.openExcelFileDialog();

      if (fileDialogResult?.canceled) {
        setImportThemesStatusMessage('Importation annulée.');
        setIsImportingThemes(false);
        return;
      }

      if (!fileDialogResult) {
        throw new Error("File dialog did not return a result.");
      }

      if (fileDialogResult.error) {
        throw new Error(`Erreur de lecture du fichier: ${fileDialogResult.error}`);
      }
      const fileBuffer = window.electronAPI?.Buffer_from(fileDialogResult.fileBuffer || '', 'base64');
      setImportStatusMessage(`Importation du fichier ${fileDialogResult.fileName || 'inconnu'}...`);

      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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
            console.log(`Ligne ${i + 1}: Le thème avec le code "${code_theme}" existe déjà pour le référentiel "${referentiel_code}". Ignoré.`);
            continue;
          }

          await StorageManager.addTheme({
            code_theme,
            nom_complet,
            referentiel_id: parentReferentiel.id
          });
          addedCount++;
        } catch (e: any) {
          const errorMessage = e.message || 'Erreur inconnue';
          console.error(`[Import Themes] Erreur à la ligne ${i + 1} (Code Thème: ${code_theme}):`, errorMessage);
          errors.push(`Ligne ${i + 1} (Code Thème: ${code_theme}): Erreur DB - ${errorMessage}`);
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

    } catch (err: any) {
      setImportThemesError(`Erreur lors de l'importation des thèmes: ${err.message}`);
      setImportThemesStatusMessage(null);
    } finally {
      setIsImportingThemes(false);
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
    ...blocsData.map(b => ({ value: b.id!.toString(), label: b.code_bloc }))
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

  const enrichedQuestions = useMemo(() => {
    if (isLoading || !referentielsData.length || !allThemesData.length || !allBlocsData.length) {
        return sortedQuestions.map(q => ({
            ...q,
            referentialCode: q.blocId ? `ID Bloc: ${q.blocId}` : 'N/A',
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

      const referentiel = referentielsData.find(r => r.id === theme.referentiel_id);
      if (!referentiel) {
        return { ...question, referentialCode: `ID Réf: ${theme.referentiel_id}`, themeName: theme.nom_complet, blocName: bloc.code_bloc };
      }

      return {
        ...question,
        referentialCode: referentiel.code,
        themeName: theme.nom_complet,
        blocName: bloc.code_bloc,
      };
    });
  }, [sortedQuestions, referentielsData, allThemesData, allBlocsData, isLoading]);


  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    const urlsCreatedInThisRun: string[] = [];

    enrichedQuestions.forEach(question => {
      if (question.id && question.image instanceof Blob) {
        const url = URL.createObjectURL(question.image);
        newPreviews[question.id.toString()] = url;
        urlsCreatedInThisRun.push(url);
      }
    });

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
            <div>
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
                        disabled={!selectedReferential || themesData.length === 0}
                    />
                    <Select
                        label="Bloc"
                        options={blocOptions}
                        value={selectedBloc}
                        onChange={(e) => setSelectedBloc(e.target.value)}
                        disabled={!selectedTheme || blocsData.length === 0}
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
            <div className="ml-4 flex-shrink-0 mt-6 space-y-2 flex flex-col">
              <Tooltip
                content={
                  <div className="text-left">
                    <p className="font-bold">Format Référentiels (.xlsx):</p>
                    <p>code, nom_complet</p>
                  </div>
                }
                position="left"
              >
                <Button
                    variant="secondary"
                    icon={<Upload size={16}/>}
                    onClick={triggerReferentialFileInput}
                    disabled={isImportingReferentiels}
                    className="w-full"
                >
                    {isImportingReferentiels ? 'Importation Référentiels...' : 'Importer Référentiels'}
                </Button>
              </Tooltip>
              <Tooltip
                content={
                  <div className="text-left">
                    <p className="font-bold">Format Thèmes (.xlsx):</p>
                    <p>code_theme, nom_complet, referentiel_code</p>
                  </div>
                }
                position="left"
              >
                <Button
                    variant="secondary"
                    icon={<Upload size={16}/>}
                    onClick={triggerThemeFileInput}
                    disabled={isImportingThemes}
                    className="w-full"
                >
                    {isImportingThemes ? 'Importation Thèmes...' : 'Importer Thèmes'}
                </Button>
              </Tooltip>
              <Tooltip
                content={
                  <div className="text-left">
                    <p className="font-bold">Format Questions (.xlsx):</p>
                    <p>id_question, texte, referentiel_code, theme_code, bloc_code, optionA, optionB, optionC, optionD, correctAnswer, isEliminatory, version</p>
                  </div>
                }
                position="left"
              >
                <Button
                    variant="primary"
                    icon={<Upload size={16}/>}
                    onClick={triggerFileInput}
                    disabled={isImporting}
                    className="w-full"
                >
                    {isImporting ? 'Importation en cours...' : 'Importer Questions'}
                </Button>
              </Tooltip>
            </div>
        </div>

        {isImporting && (
          <div className="mt-4 p-4 rounded-md bg-blue-50 border border-blue-200">
            <p className="font-semibold text-blue-800">Importation en cours...</p>
            <p className="text-sm text-blue-700 mb-2">Veuillez patienter. Ne quittez pas cette page.</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${(importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0)}%` }}
              ></div>
            </div>
            <p className="text-right text-sm text-blue-700 mt-1">
              {importProgress.current} / {importProgress.total} questions traitées
            </p>
          </div>
        )}
        {!isImporting && importStatusMessage && (
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

        {importReferentielsStatusMessage && (
          <div className={`mt-2 p-3 rounded-md ${importReferentielsError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>
            {importReferentielsError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}
            <span>Référentiels: {importReferentielsStatusMessage}</span>
          </div>
        )}
         {importReferentielsError && !importReferentielsStatusMessage && (
          <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            <span>Référentiels: {importReferentielsError}</span>
          </div>
        )}

        {importThemesStatusMessage && (
          <div className={`mt-2 p-3 rounded-md ${importThemesError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>
            {importThemesError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}
            <span>Thèmes: {importThemesStatusMessage}</span>
          </div>
        )}
        {importThemesError && !importThemesStatusMessage && (
          <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            <span>Thèmes: {importThemesError}</span>
          </div>
        )}
      </Card>

      <Card title={`Référentiels (${referentielsData.length})`} className="mb-6">
        <div className="overflow-x-auto">
          <Table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <TableRow>
                <TableHead scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</TableHead>
                <TableHead scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</TableHead>
              </TableRow>
            </thead>
            <TableBody className="bg-white divide-y divide-gray-200">
              {referentielsData.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ref.code}</TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ref.nom_complet}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card title={`Thèmes (${allThemesData.length})`} className="mb-6">
        <div className="overflow-x-auto">
          <Table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <TableRow>
                <TableHead scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code Thème</TableHead>
                <TableHead scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</TableHead>
                <TableHead scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référentiel</TableHead>
              </TableRow>
            </thead>
            <TableBody className="bg-white divide-y divide-gray-200">
              {allThemesData.map((theme) => {
                const referentiel = referentielsData.find(r => r.id === theme.referentiel_id);
                return (
                  <TableRow key={theme.id}>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{theme.code_theme}</TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{theme.nom_complet}</TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{referentiel ? referentiel.code : 'N/A'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

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
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
                        type="button"
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