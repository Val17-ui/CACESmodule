import React, { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { FileText, Edit, Trash2, Copy, Image, AlertTriangle, TrendingUp, TrendingDown, Upload, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { QuestionTheme, referentials, questionThemes } from '../../types';
import { StorageManager, StoredQuestion } from '../../services/StorageManager'; // Import StorageManager
type QuestionLibraryProps = {
  onEditQuestion: (id: string) => void;
};

const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onEditQuestion }) => {
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedEliminatory, setSelectedEliminatory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [questions, setQuestions] = useState<StoredQuestion[]>([]); // Changed to StoredQuestion[]
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

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
        referential: 'referential',
        theme: 'theme',
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
      const requiredImportKeys = ['texte', 'referential', 'correctAnswer', 'optionA', 'optionB', 'isEliminatory'];
      for (const key of requiredImportKeys) {
        if (headerMap[key] === undefined) {
          const displayName = Object.keys(expectedHeaders).find(k => expectedHeaders[k] === key) || key;
          throw new Error(`Colonne manquante ou mal nommée dans le fichier Excel : "${displayName}"`);
        }
      }

      let questionsAdded = 0;
      let errorsEncountered: string[] = [];

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

        const referentialRaw = (row[headerMap['referential']] || '').toString().toUpperCase();
        if (!Object.values(CACESReferential).includes(referentialRaw as CACESReferential)) {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Référentiel "${referentialRaw}" invalide.`);
            continue;
        }

        const isEliminatoryRaw = (row[headerMap['isEliminatory']] || 'Non').toString().trim().toUpperCase();
        let isEliminatoryBool = false;
        if (isEliminatoryRaw === 'OUI' || isEliminatoryRaw === 'TRUE' || isEliminatoryRaw === '1') {
            isEliminatoryBool = true;
        } else if (isEliminatoryRaw !== 'NON' && isEliminatoryRaw !== 'FALSE' && isEliminatoryRaw !== '0') {
            errorsEncountered.push(`Ligne ${i + 1} (${questionText.substring(0,20)}...): Valeur pour 'isEliminatory' (${isEliminatoryRaw}) invalide. Utilisez Oui/Non, True/False, 0/1.`);
            continue;
        }


        const newQuestionData: Omit<StoredQuestion, 'id'> = {
          text: questionText.toString(),
          type: StoredQuestionType,
          options: options,
          correctAnswer: correctAnswerStr,
          referential: referentialRaw as CACESReferential,
          theme: (row[headerMap['theme']] || '').toString(),
          isEliminatory: isEliminatoryBool,
          timeLimit: parseInt(row[headerMap['timelimit']], 10) || 30,
          imageName: (row[headerMap['imagename']] || '').toString().trim() || undefined,
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

  const referentialOptions = [
    { value: '', label: 'Toutes les recommandations' },
    ...Object.entries(referentials).map(([value, label]) => ({
      value,
      label: `${value} - ${label}`,
    }))
  ];

  const themeOptions = [
    { value: '', label: 'Tous les thèmes' },
    ...Object.entries(questionThemes).map(([value, label]) => ({
      value,
      label
    }))
  ];

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
      const matchesReferential = !selectedReferential || question.referential === selectedReferential;
      const matchesTheme = !selectedTheme || question.theme === selectedTheme;
      const matchesEliminatory = !selectedEliminatory ||
        (selectedEliminatory === 'true' && question.isEliminatory) ||
        (selectedEliminatory === 'false' && !question.isEliminatory);
      const matchesSearch = !searchText ||
        (question.text && question.text.toLowerCase().includes(searchText.toLowerCase()));
      return matchesReferential && matchesTheme && matchesEliminatory && matchesSearch;
    });
  }, [questions, selectedReferential, selectedTheme, selectedEliminatory, searchText]);

  const sortedQuestions = useMemo(() => {
    let sortableItems: StoredQuestion[] = [...filteredQuestions]; // Type will be StoredQuestion[] due to filteredQuestions
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

  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    const urlsCreatedInThisRun: string[] = [];

    sortedQuestions.forEach(question => {
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
            <div className="ml-4 flex-shrink-0 mt-6"> {/* Adjusted margin for button alignment */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    className="hidden"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                />
                <Button
                    variant="primary"
                    icon={<Upload size={16}/>}
                    onClick={triggerFileInput}
                    disabled={isImporting}
                >
                    {isImporting ? 'Importation...' : 'Importer des Questions'}
                </Button>
            </div>
        </div>

        {/* Display Import Status */}
        {importStatusMessage && (
          <div className="mt-4 p-3 rounded-md bg-blue-100 text-blue-700 flex items-center">
            <CheckCircle size={20} className="mr-2" />
            {importStatusMessage}
          </div>
        )}
        {importError && (
          <div className="mt-4 p-3 rounded-md bg-red-100 text-red-700 flex items-center">
            <XCircle size={20} className="mr-2" />
            {importError}
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisation
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
              {sortedQuestions.map((question) => {
                const imageUrl = question.id ? imagePreviews[question.id.toString()] : null;
                return (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 mr-3">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1 break-words">
                            {question.text && question.text.length > 80
                              ? `${question.text.substring(0, 80)}...`
                              : question.text
                            }
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {question.isEliminatory && (
                              <Badge variant="danger">
                                <AlertTriangle size={12} className="mr-1" />
                                Éliminatoire
                              </Badge>
                            )}
                            {question.image instanceof Blob && imageUrl && (
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
                    <Badge variant="primary">{question.referential}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {question.theme ? questionThemes[question.theme as QuestionTheme] : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {question.usageCount || 0} fois
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
                        icon={<Copy size={16} />}
                        type="button"
                      >
                        Dupliquer
                      </Button>
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