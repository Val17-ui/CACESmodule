import React, { useState, useEffect, useMemo, useRef, ChangeEvent, FC } from 'react';
import { FileText, Edit, Trash2, Image, AlertTriangle, TrendingUp, TrendingDown, Upload, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { Referential, Theme, Bloc, QuestionWithId as StoredQuestion } from '../../types'; // QuestionWithId is the main type for questions now
import * as db from '../../db'; // Using IPC calls via the renderer's db.ts
import { logger } from '../../utils/logger';


type QuestionLibraryProps = {
  onEditQuestion: (id: number) => void; // Changed id to number
};

const QuestionLibrary: FC<QuestionLibraryProps> = ({ onEditQuestion }) => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referentialFileInputRef = useRef<HTMLInputElement>(null);
  const themeFileInputRef = useRef<HTMLInputElement>(null);

  const [isImportingReferentiels, setIsImportingReferentiels] = useState(false);
  const [importReferentielsStatusMessage, setImportReferentielsStatusMessage] = useState<string | null>(null);
  const [importReferentielsError, setImportReferentielsError] = useState<string | null>(null);

  const [isImportingThemes, setIsImportingThemes] = useState(false);
  const [importThemesStatusMessage, setImportThemesStatusMessage] = useState<string | null>(null);
  const [importThemesError, setImportThemesError] = useState<string | null>(null);

  const fetchAndSetQuestions = async () => {
    setIsLoading(true);
    try {
      const fetchedQuestions = await db.getAllQuestions();
      setQuestions(fetchedQuestions || []); // Ensure it's an array
      setError(null);
    } catch (err: any) {
      logger.error("Error fetching questions: ", { error: err });
      setError("Failed to load questions.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilterData = async () => {
    try {
      const refs = await db.getAllReferentiels();
      setReferentielsData(refs || []);

      const allThemes = await db.getAllThemes();
      setAllThemesData(allThemes || []);

      const allBlocs = await db.getAllBlocs();
      setAllBlocsData(allBlocs || []);

      setThemesData([]);
      setBlocsData([]);
    } catch (error: any) {
      logger.error("Error loading filter data:", { error });
      setError("Erreur lors du chargement des données de filtre.");
    }
  };

  useEffect(() => {
    fetchAndSetQuestions();
    loadFilterData();
  }, []);

  useEffect(() => {
    if (selectedReferential) {
      db.getThemesByReferentielId(parseInt(selectedReferential, 10))
        .then(themes => setThemesData(themes || []))
        .catch(error => {
          logger.error("Error loading themes for filter:", { error });
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
      db.getBlocsByThemeId(parseInt(selectedTheme, 10))
        .then(blocs => setBlocsData(blocs || []))
        .catch(error => {
          logger.error("Error loading blocs for filter:", { error });
          setBlocsData([]);
        });
      setSelectedBloc('');
    } else {
      setBlocsData([]);
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

      if (jsonRows.length < 2) {
        throw new Error("Le fichier est vide ou ne contient pas de données de question.");
      }

      const headerRow = jsonRows[0] as string[];
      const expectedHeaders: Record<string, string> = {
        texte: 'texte',
        referentiel_code: 'referentiel_code',
        theme_code: 'theme_code',
        bloc_code: 'bloc_code',
        optiona: 'optionA',
        optionb: 'optionB',
        optionc: 'optionC',
        optiond: 'optionD',
        correctanswer: 'correctAnswer',
        iseliminatory: 'isEliminatory',
        timelimit: 'timeLimit',
        imagename: 'imageName',
      };

      const headerMap: Record<string, number> = {};
      headerRow.forEach((header, index) => {
        const normalizedHeader = (header || '').toString().toLowerCase().replace(/\s+/g, '');
        const internalKey = Object.keys(expectedHeaders).find(k => expectedHeaders[k].toLowerCase().replace(/\s+/g, '') === normalizedHeader || k.toLowerCase().replace(/\s+/g, '') === normalizedHeader);
        if (internalKey) {
            headerMap[expectedHeaders[internalKey]] = index;
        }
      });

      const requiredImportKeys = ['texte', 'referentiel_code', 'theme_code', 'bloc_code', 'correctAnswer', 'optionA', 'optionB', 'isEliminatory'];
      for (const key of requiredImportKeys) {
        if (headerMap[key] === undefined) {
          const displayNameForKey = Object.keys(expectedHeaders).find(k => expectedHeaders[k] === key) || key;
          throw new Error(`Colonne manquante ou mal nommée: "${displayNameForKey}"`);
        }
      }

      let questionsAdded = 0;
      const errorsEncountered: string[] = [];

      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i] as any[];
        if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

        const questionText = row[headerMap['texte']];
        if (!questionText || questionText.toString().trim() === '') {
            errorsEncountered.push(`Ligne ${i + 1}: Le champ 'texte' est manquant.`);
            continue;
        }

        const questionTypeResolved: StoredQuestion['type'] = 'multiple-choice'; // All imported questions are QCM for now, StoredQuestion is QuestionWithId now
        const optionsFromFile: string[] = [];
        const correctAnswersIndices: number[] = [];

        const optA = (row[headerMap['optionA']] || '').toString().trim();
        const optB = (row[headerMap['optionB']] || '').toString().trim();
        const optC = (row[headerMap['optionC']] || '').toString().trim();
        const optD = (row[headerMap['optionD']] || '').toString().trim();

        if (optA) optionsFromFile.push(optA);
        if (optB) optionsFromFile.push(optB);
        if (optC) optionsFromFile.push(optC);
        if (optD) optionsFromFile.push(optD);

        if (optionsFromFile.length < 2) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Au moins 2 options (OptionA et OptionB) doivent être renseignées.`);
            continue;
        }

        const correctAnswerLetter = (row[headerMap['correctAnswer']] || '').toString().trim().toUpperCase();
        const letterMap: Record<string, number> = {'A':0, 'B':1, 'C':2, 'D':3};

        if (letterMap[correctAnswerLetter] !== undefined && letterMap[correctAnswerLetter] < optionsFromFile.length) {
            correctAnswersIndices.push(letterMap[correctAnswerLetter]);
        } else {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Valeur de 'correctAnswer' (${correctAnswerLetter}) invalide ou option non disponible.`);
            continue;
        }

        const questionOptions = optionsFromFile.map((opt, index) => ({
            texte: opt,
            estCorrecte: correctAnswersIndices.includes(index)
        }));

        const referentielCode = (row[headerMap['referentiel_code']] || '').toString().trim();
        const themeCode = (row[headerMap['theme_code']] || '').toString().trim();
        const blocCode = (row[headerMap['bloc_code']] || '').toString().trim();

        if (!referentielCode || !themeCode || !blocCode) {
          errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): 'referentiel_code', 'theme_code', et 'bloc_code' sont requis.`);
          continue;
        }

        let blocIdToStore: number | undefined;
        try {
          // TODO: This logic needs to be robust. getReferentielByCode does not exist.
          // Assuming for now we need getReferentielById if a referential ID is available,
          // or a new function getReferentielByCode if 'referentielCode' is the input.
          // For now, this will likely fail or needs adjustment based on actual db function.
          const referentiel = referentielsData.find(r => r.code === referentielCode); // Temporary find by code in loaded data
          if (!referentiel || !referentiel.id) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Référentiel code "${referentielCode}" non trouvé dans les données chargées.`);
            continue;
          }

          // Similar issue for theme - needs robust fetching, possibly new db functions
          const theme = allThemesData.find(t => t.code_theme === themeCode && t.referentiel_id === referentiel.id);
          if (!theme || !theme.id ) {
             errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Thème code "${themeCode}" non trouvé pour référentiel "${referentielCode}" dans les données chargées.`);
             continue;
          }

          let bloc = allBlocsData.find(b => b.code_bloc === blocCode && b.theme_id === theme.id);
          if (!bloc || !bloc.id) {
            // Assuming db.addBloc takes { code_bloc: string, theme_id: number, nom_complet?: string }
            // And returns the ID of the new bloc.
            const newBlocId = await db.addBloc(blocCode, theme.id, blocCode); // Pass nom_complet as blocCode for now
            if (newBlocId) {
              blocIdToStore = newBlocId;
              // Add to local cache to avoid re-adding for subsequent rows in the same import
              allBlocsData.push({id: newBlocId, code_bloc: blocCode, theme_id: theme.id, nom_complet: blocCode});
            } else {
              errorsEncountered.push(`Ligne ${i+1}: Création bloc "${blocCode}" échouée.`); continue;
            }
          } else {
            blocIdToStore = bloc.id;
          }
        } catch (dbError: any) {
          errorsEncountered.push(`Ligne ${i + 1}: Erreur DB: ${dbError.message}`);
          continue;
        }

        if (blocIdToStore === undefined) {
            errorsEncountered.push(`Ligne ${i + 1}: Impossible de déterminer le blocId.`);
            continue;
        }

        const isEliminatoryRaw = (row[headerMap['isEliminatory']] || 'Non').toString().trim().toUpperCase();
        const isEliminatoryBool = ['OUI', 'TRUE', '1'].includes(isEliminatoryRaw);

        const newQuestionData: Omit<StoredQuestion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'correctResponseRate' | 'image' | 'slideGuid'> = {
          text: questionText.toString(), // Changed from texte_question
          type: questionTypeResolved, // Changed from type_question
          options: optionsFromFile, // Correctly string[] as per StoredQuestion (QuestionWithId)
          blocId: blocIdToStore, // Changed from bloc_id
          isEliminatory: isEliminatoryBool,
          timeLimit: parseInt(row[headerMap['timelimit']], 10) || 30,
          imageName: (row[headerMap['imagename']] || '').toString().trim() || null, // This field is in StoredQuestion
          points: 1, // Default points
          feedback: null,
        };

        try {
            await db.addQuestion(newQuestionData);
            questionsAdded++;
        } catch (e: any) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Erreur DB - ${e.message}`);
        }
      }

      let summaryMessage = `${questionsAdded} question(s) importée(s).`;
      if (errorsEncountered.length > 0) {
        summaryMessage += ` ${errorsEncountered.length} erreur(s).`;
        setImportError(errorsEncountered.join('\n'));
        logger.error("Erreurs d'importation:", { errors: errorsEncountered });
      } else {
        setImportError(null);
      }
      setImportStatusMessage(summaryMessage);
      if (questionsAdded > 0) await fetchAndSetQuestions();

    } catch (err: any) {
      logger.error("Error importing file: ", { error: err });
      setImportError(`Erreur: ${err.message}`);
      setImportStatusMessage(null);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReferentialFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingReferentiels(true);
    setImportReferentielsStatusMessage(`Importation des référentiels...`);
    setImportReferentielsError(null);

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonRows.length < 2) throw new Error("Fichier vide ou sans données.");

        const headerRow = jsonRows[0] as string[];
        const headerMap: Record<string, number> = {};
        headerRow.forEach((h, i) => headerMap[(h || '').toString().toLowerCase().trim()] = i);

        if (headerMap['code'] === undefined || headerMap['nom_complet'] === undefined) {
            throw new Error("Colonnes 'code' et 'nom_complet' requises.");
        }

        let addedCount = 0; const errors: string[] = [];
        for (let i = 1; i < jsonRows.length; i++) {
            const row = jsonRows[i] as any[];
            if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

            const code = row[headerMap['code']]?.toString().trim();
            const nom_complet = row[headerMap['nom_complet']]?.toString().trim();

            if (!code || !nom_complet) { errors.push(`Ligne ${i + 1}: 'code' et 'nom_complet' requis.`); continue; }

            try {
                // const existing = await db.getReferentialByCode(code); // This function does not exist with this name
                // For now, let's assume we check against loaded data or proceed with add, which might fail if unique constraint exists
                const existing = referentielsData.find(r => r.code === code);
                if (existing) { errors.push(`Ligne ${i + 1}: Code "${code}" existe déjà dans les données chargées.`); continue; }
                await db.addReferentiel(code, nom_complet ); // Corrected call
                addedCount++;
            } catch (e: any) { errors.push(`Ligne ${i + 1}: ${e.message}`); }
        }
        setImportReferentielsStatusMessage(`${addedCount} référentiel(s) importé(s). ${errors.length} erreur(s).`);
        if (errors.length > 0) setImportReferentielsError(errors.join('\n'));
        loadFilterData(); // Refresh referential data
    } catch (err: any) {
        setImportReferentielsError(err.message);
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
    setImportThemesStatusMessage(`Importation des thèmes...`);
    setImportThemesError(null);

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonRows.length < 2) throw new Error("Fichier vide ou sans données.");

        const headerRow = jsonRows[0] as string[];
        const headerMap: Record<string, number> = {};
        headerRow.forEach((h, i) => headerMap[(h || '').toString().toLowerCase().trim()] = i);

        const required = ['code_theme', 'nom_complet', 'referentiel_code'];
        if (required.some(h => headerMap[h] === undefined)) {
            throw new Error(`Colonnes requises: ${required.join(', ')}.`);
        }

        let addedCount = 0; const errors: string[] = [];
        for (let i = 1; i < jsonRows.length; i++) {
            const row = jsonRows[i] as any[];
            if (row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '')) continue;

            const code_theme = row[headerMap['code_theme']]?.toString().trim();
            const nom_complet = row[headerMap['nom_complet']]?.toString().trim();
            const referentiel_code = row[headerMap['referentiel_code']]?.toString().trim();

            if (!code_theme || !nom_complet || !referentiel_code) {
                errors.push(`Ligne ${i + 1}: Champs requis manquants.`); continue;
            }

            try {
                // const parentRef = await db.getReferentialByCode(referentiel_code); // Function name might be different or logic needs Id
                const parentRef = referentielsData.find(r => r.code === referentiel_code); // Temp find
                if (!parentRef || !parentRef.id) {
                    errors.push(`Ligne ${i + 1}: Référentiel "${referentiel_code}" non trouvé dans les données chargées.`); continue;
                }
                // Assuming getThemeByCodeAndReferentialId exists, or similar logic
                const existingTheme = allThemesData.find(t => t.code_theme === code_theme && t.referentiel_id === parentRef.id);
                if (existingTheme) { errors.push(`Ligne ${i + 1}: Thème "${code_theme}" existe déjà pour ce référentiel.`); continue; }

                await db.addTheme(code_theme, nom_complet, parentRef.id ); // Corrected call
                addedCount++;
            } catch (e: any) { errors.push(`Ligne ${i + 1}: ${e.message}`); }
        }
        setImportThemesStatusMessage(`${addedCount} thème(s) importé(s). ${errors.length} erreur(s).`);
        if (errors.length > 0) setImportThemesError(errors.join('\n'));
        loadFilterData(); // Refresh theme dependent data
    } catch (err: any) {
        setImportThemesError(err.message);
        setImportThemesStatusMessage(null);
    } finally {
        setIsImportingThemes(false);
        if (themeFileInputRef.current) themeFileInputRef.current.value = "";
    }
  };


  const triggerFileInput = () => fileInputRef.current?.click();
  const triggerReferentialFileInput = () => referentialFileInputRef.current?.click();
  const triggerThemeFileInput = () => themeFileInputRef.current?.click();

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
      const bloc = question.bloc_id ? allBlocsData.find(b => b.id === question.bloc_id) : null;
      const theme = bloc ? allThemesData.find(t => t.id === bloc.theme_id) : null;
      const referentiel = theme ? referentielsData.find(r => r.id === theme.referentiel_id) : null;

      const matchesReferential = !selectedReferential || (referentiel && referentiel.id?.toString() === selectedReferential);
      const matchesTheme = !selectedTheme || (theme && theme.id?.toString() === selectedTheme);
      const matchesBloc = !selectedBloc || (bloc && bloc.id?.toString() === selectedBloc);
      const matchesEliminatory = !selectedEliminatory ||
        (selectedEliminatory === 'true' && question.isEliminatory) ||
        (selectedEliminatory === 'false' && !question.isEliminatory);
      const matchesSearch = !searchText ||
        (question.text && question.text.toLowerCase().includes(searchText.toLowerCase())); // Changed from texte_question
      return matchesReferential && matchesTheme && matchesBloc && matchesEliminatory && matchesSearch;
    });
  }, [questions, selectedReferential, selectedTheme, selectedBloc, selectedEliminatory, searchText, referentielsData, allThemesData, allBlocsData]);

  const sortedQuestions = useMemo(() => {
    const sortableItems = [...filteredQuestions];
    sortableItems.sort((a, b) => {
      switch (sortBy) {
        case 'usage': return (b.usageCount || 0) - (a.usageCount || 0);
        case 'success-rate': return (b.correctResponseRate || 0) - (a.correctResponseRate || 0);
        case 'failure-rate': return (a.correctResponseRate ?? 100) - (b.correctResponseRate ?? 100);
        case 'recent': default: return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });
    return sortableItems;
  }, [filteredQuestions, sortBy]);

  const enrichedQuestions = useMemo(() => {
    return sortedQuestions.map(question => {
      const bloc = question.bloc_id ? allBlocsData.find(b => b.id === question.bloc_id) : null;
      const theme = bloc ? allThemesData.find(t => t.id === bloc.theme_id) : null;
      const referentiel = theme ? referentielsData.find(r => r.id === theme.referentiel_id) : null;
      return {
        ...question,
        referentialCode: referentiel?.code || 'N/A',
        themeName: theme?.nom_complet || 'N/A',
        blocName: bloc?.code_bloc || 'N/A',
      };
    });
  }, [sortedQuestions, referentielsData, allThemesData, allBlocsData]);

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
    setImagePreviews(prev => { // Revoke old ones not in newPreviews
        Object.values(prev).forEach(url => {
            if (!urlsCreatedInThisRun.includes(url) && !Object.values(newPreviews).includes(url)) {
                URL.revokeObjectURL(url);
            }
        });
        return newPreviews;
    });
    return () => urlsCreatedInThisRun.forEach(url => URL.revokeObjectURL(url));
  }, [enrichedQuestions]);

  const formatDate = (dateString?: string | number) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(dateString));
  };

  const getSuccessRateIcon = (rate?: number | null) => {
    if (rate == null) return null;
    if (rate >= 75) return <TrendingUp size={16} className="text-green-600" />;
    if (rate <= 50) return <TrendingDown size={16} className="text-red-600" />;
    return null;
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette question ?")) {
      try {
        await db.deleteQuestion(questionId);
        fetchAndSetQuestions(); // Refresh list
        logger.info(`Question ID ${questionId} supprimée.`);
      } catch (err: any) {
        logger.error(`Erreur lors de la suppression de la question ID ${questionId}`, { error: err });
        setError(`Erreur lors de la suppression: ${err.message}`);
      }
    }
  };


  if (isLoading) return <div className="container mx-auto p-4">Chargement...</div>;
  if (error && !questions.length) return <div className="container mx-auto p-4 text-red-500">{error}</div>;

  return (
    <div>
      <Card title="Filtres et recherche" className="mb-6">
        {/* Filter and import UI as before */}
        <div className="flex justify-between items-start mb-4">
            <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Select label="Recommandation" options={referentialOptions} value={selectedReferential} onChange={(e) => setSelectedReferential(e.target.value)} />
                    <Select label="Thème" options={themeOptions} value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)} disabled={!selectedReferential || themesData.length === 0} />
                    <Select label="Bloc" options={blocOptions} value={selectedBloc} onChange={(e) => setSelectedBloc(e.target.value)} disabled={!selectedTheme || blocsData.length === 0} />
                    <Select label="Type" options={eliminatoryOptions} value={selectedEliminatory} onChange={(e) => setSelectedEliminatory(e.target.value)} />
                    <Select label="Trier par" options={sortOptions} value={sortBy} onChange={(e) => setSortBy(e.target.value)} />
                </div>
                <div className="mt-4"> <Input label="Recherche texte" placeholder="Rechercher..." value={searchText} onChange={(e) => setSearchText(e.target.value)} /> </div>
            </div>
            <div className="ml-4 flex-shrink-0 mt-6 space-y-2">
                <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx,.xls,.csv" />
                <Button variant="primary" icon={<Upload size={16}/>} onClick={triggerFileInput} disabled={isImporting} className="w-full"> {isImporting ? 'Import Questions...' : 'Importer Questions'} </Button>
                <input type="file" ref={referentialFileInputRef} onChange={handleReferentialFileImport} className="hidden" accept=".xlsx,.xls,.csv" />
                <Button variant="secondary" icon={<Upload size={16}/>} onClick={triggerReferentialFileInput} disabled={isImportingReferentiels} className="w-full"> {isImportingReferentiels ? 'Import Réf...' : 'Importer Référentiels'} </Button>
                <input type="file" ref={themeFileInputRef} onChange={handleThemeFileImport} className="hidden" accept=".xlsx,.xls,.csv" />
                <Button variant="secondary" icon={<Upload size={16}/>} onClick={triggerThemeFileInput} disabled={isImportingThemes} className="w-full"> {isImportingThemes ? 'Import Thèmes...' : 'Importer Thèmes'} </Button>
            </div>
        </div>
        {importStatusMessage && <div className="mt-4 p-3 rounded-md bg-blue-100 text-blue-700 flex items-center"><CheckCircle size={20} className="mr-2" /><span>Questions: {importStatusMessage}</span></div>}
        {importError && <div className="mt-4 p-3 rounded-md bg-red-100 text-red-700 flex items-center"><XCircle size={20} className="mr-2" /><span>Questions: {importError}</span></div>}
        {importReferentielsStatusMessage && <div className={`mt-2 p-3 rounded-md ${importReferentielsError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>{importReferentielsError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}<span>Référentiels: {importReferentielsStatusMessage}</span></div>}
        {importReferentielsError && !importReferentielsStatusMessage && <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center"><XCircle size={20} className="mr-2" /><span>Référentiels: {importReferentielsError}</span></div>}
        {importThemesStatusMessage && <div className={`mt-2 p-3 rounded-md ${importThemesError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} flex items-center`}>{importThemesError ? <XCircle size={20} className="mr-2" /> : <CheckCircle size={20} className="mr-2" />}<span>Thèmes: {importThemesStatusMessage}</span></div>}
        {importThemesError && !importThemesStatusMessage && <div className="mt-2 p-3 rounded-md bg-red-100 text-red-700 flex items-center"><XCircle size={20} className="mr-2" /><span>Thèmes: {importThemesError}</span></div>}
      </Card>

      <Card title={`Questions (${enrichedQuestions.length})`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Question</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recommandation</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thème</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Taux réussite</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Créée le</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrichedQuestions.map((question) => {
                const imageUrl = question.id && question.image instanceof Blob ? imagePreviews[question.id.toString()] : null;
                return (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 mr-3"><FileText size={20} /></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1 break-words">
                          {question.text && question.text.length > 80 ? `${question.text.substring(0, 80)}...` : question.text}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {question.isEliminatory && (<Badge variant="danger"><AlertTriangle size={12} className="mr-1" />Éliminatoire</Badge>)}
                            {question.image instanceof Blob && imageUrl && (
                              <>
                                <Badge variant="default"><Image size={12} className="mr-1" />Image</Badge>
                                <img src={imageUrl} alt="Aperçu" className="max-w-[50px] max-h-[50px] mt-1 rounded border" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap"><Badge variant="primary">{question.referentialCode || 'N/A'}</Badge></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{question.themeName || 'N/A'} <br /><span className="text-xs text-gray-400">{question.blocName || 'N/A'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{question.correctResponseRate != null ? `${question.correctResponseRate}%` : 'N/A'}</span>
                        {getSuccessRateIcon(question.correctResponseRate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(question.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="sm" icon={<Edit size={16} />} onClick={() => question.id && onEditQuestion(question.id)}>Modifier</Button>
                        <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} type="button" onClick={() => question.id && handleDeleteQuestion(question.id)}>Supprimer</Button>
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