import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionLibrary from '../components/library/QuestionLibrary';
import QuestionForm from '../components/library/QuestionForm';
import QuestionStatistics from '../components/library/QuestionStatistics';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card'; // Import Card for feedback display
import { Plus, FileUp, FileDown, BarChart3 } from 'lucide-react';
// import { exportQuestionsToCsv } from '../utils/csvProcessor'; // Remove or comment out
import { importQuestionsFromExcel, RawExcelQuestion, exportQuestionsToExcel } from '../utils/excelProcessor'; // Add Excel import and export
import { mockQuestions } from '../data/mockData'; // Using mockQuestions as a placeholder for actual data
import { Question, ReferentialType, QuestionTheme, referentials, questionThemes } from '../types';

// Helper for ID generation
const generateQuestionId = (): string => {
  return `q_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
};

type LibraryProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Library: React.FC<LibraryProps> = ({ activePage, onPageChange }) => {
  const [activeView, setActiveView] = useState<'library' | 'form' | 'statistics'>('library');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCreateNew = () => {
    setActiveView('form');
    setEditingQuestionId(null);
  };

  const handleEditQuestion = (id: string) => {
    setActiveView('form');
    setEditingQuestionId(id);
  };

  const handleViewStatistics = () => {
    setActiveView('statistics');
  };

  const handleBackToLibrary = () => {
    setActiveView('library');
    setEditingQuestionId(null);
  };

  const handleExportExcel = async () => { // Make it async
    // TODO: Replace mockQuestions with actual questions from state/store when available
    const questionsToExport: Question[] = mockQuestions;

    if (questionsToExport.length === 0) {
      console.log("No questions to export."); // Or use a logger/toast
      setImportFeedback(["Aucune question à exporter."]);
      return;
    }

    setImportFeedback(["Préparation du fichier Excel pour l'export..."]); // Inform user

    try {
      const blob = await exportQuestionsToExcel(questionsToExport); // await the promise

      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'questions_export.xlsx'); // New filename
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setImportFeedback(["Export Excel terminé avec succès."]);
      } else {
        console.error("Excel download not supported by this browser.");
        setImportFeedback(["Erreur: Téléchargement Excel non supporté par ce navigateur."]);
      }
    } catch (error: any) {
      console.error("Erreur lors de l'exportation Excel:", error);
      setImportFeedback([`Erreur inattendue lors de l'exportation Excel: ${error.message || error.toString()}`]);
    }
  };

  const handleImportExcelClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFeedback(["Traitement du fichier Excel..."]);

    try {
      const { data: rawQuestions, errors: processingErrors, rawHeaders } = await importQuestionsFromExcel(file);

      if (processingErrors.length > 0) {
        const feedbackMessages = ["Erreurs lors du traitement du fichier Excel :", ...processingErrors];
        if (rawHeaders && rawHeaders.length > 0) {
            feedbackMessages.push(`En-têtes détectés: ${rawHeaders.join(', ')}`);
        }
        setImportFeedback(feedbackMessages);
        // Stop if importQuestionsFromExcel reported errors and no data,
        // or if critical errors occurred (e.g. header mismatch)
        if (rawQuestions.length === 0 && processingErrors.some(e => e.includes("essentiel manquant") || e.includes("Aucune feuille"))) return;
      }

      if (rawQuestions.length === 0 && processingErrors.length === 0) { // No data and no initial processing errors
          setImportFeedback(["Aucune donnée de question valide trouvée dans le fichier Excel."]);
          return;
      }

      // Even if there were non-critical errors from importQuestionsFromExcel (e.g. no valid data after header)
      // but some rawQuestions were extracted, proceed to detailed validation.
      // If rawQuestions is empty here, it means either no data rows or they were all filtered by importQuestionsFromExcel.
      // processImportedQuestions will then confirm if 0 were valid.
      processImportedQuestions(rawQuestions);

    } catch (error: any) {
      console.error("Erreur lors de l'importation Excel:", error);
      setImportFeedback([`Erreur inattendue lors de l'importation : ${error.message || error.toString()}`]);
    }
  };

  const processImportedQuestions = (rawQuestions: RawExcelQuestion[]) => {
    const newQuestions: Question[] = [];
    // Keep initial feedback from handleFileSelected if any, or set new one.
    // For simplicity, this will overwrite. A better UX might append.
    const feedback: string[] = [`${rawQuestions.length} lignes de données brutes trouvées dans le fichier Excel.`];
    let importedCount = 0;

    rawQuestions.forEach((rawQ, index) => {
      const rowNum = index + 2; // Assuming data starts from Excel row 2
      const errorsForRow: string[] = [];

      const questionText = typeof rawQ.text === 'string' ? rawQ.text.trim() : null;
      if (!questionText) errorsForRow.push("Le champ 'Texte de la question' est manquant.");

      const referentialText = typeof rawQ.referential === 'string' ? rawQ.referential.trim() : null;
      if (!referentialText) errorsForRow.push("Le champ 'Référentiel (Code)' est manquant.");
      else if (!Object.keys(referentials).includes(referentialText as ReferentialType)) {
        errorsForRow.push(`Référentiel '${referentialText}' invalide.`);
      }

      const themeText = typeof rawQ.theme === 'string' ? rawQ.theme.trim() : null;
      if (!themeText) errorsForRow.push("Le champ 'Thème (Code)' est manquant.");
      else if (!Object.keys(questionThemes).includes(themeText as QuestionTheme)) {
        errorsForRow.push(`Thème '${themeText}' invalide.`);
      }

      const options: string[] = [];
      const optA = typeof rawQ.optionA === 'string' ? rawQ.optionA.trim() : null;
      const optB = typeof rawQ.optionB === 'string' ? rawQ.optionB.trim() : null;
      if (!optA) errorsForRow.push("Le champ 'Option A' est manquant ou vide."); else options.push(optA);
      if (!optB) errorsForRow.push("Le champ 'Option B' est manquant ou vide."); else options.push(optB);

      // Optional options C and D
      const optC = typeof rawQ.optionC === 'string' ? rawQ.optionC.trim() : null;
      if (optC) options.push(optC);
      const optD = typeof rawQ.optionD === 'string' ? rawQ.optionD.trim() : null;
      if (optD) options.push(optD);

      // definedOptions are already trimmed and non-null if pushed
      if (options.length < 2 && (errorsForRow.length === 0 || (!errorsForRow.includes("Le champ 'Option A' est manquant ou vide.") && !errorsForRow.includes("Le champ 'Option B' est manquant ou vide.")))) {
         // Avoid duplicate error if A or B already reported as missing
         errorsForRow.push("Au moins 2 options (A et B) avec du contenu sont requises.");
      }

      let correctAnswerIndex = -1;
      const caRaw = typeof rawQ.correctAnswer === 'string' ? rawQ.correctAnswer.trim().toUpperCase() : null;
      if (!caRaw) errorsForRow.push("Le champ 'Bonne Réponse (Lettre A-D)' est manquant.");
      else {
        if (caRaw === 'A') correctAnswerIndex = 0;
        else if (caRaw === 'B') correctAnswerIndex = 1;
        else if (caRaw === 'C') correctAnswerIndex = 2;
        else if (caRaw === 'D') correctAnswerIndex = 3;
        else errorsForRow.push(`Valeur de 'Bonne Réponse' (${caRaw}) invalide. Doit être A, B, C, ou D.`);
      }

      if (correctAnswerIndex !== -1 && correctAnswerIndex >= options.length) {
        errorsForRow.push(`'Bonne Réponse' (${caRaw}) pointe vers une option non définie ou vide.`);
      }

      let isEliminatoryBool: boolean | undefined = undefined;
      const elimValRaw = rawQ.isEliminatory;
      if (elimValRaw === null || elimValRaw === undefined || String(elimValRaw).trim() === '') {
        errorsForRow.push("Le champ 'Éliminatoire (OUI/NON)' est manquant.");
      } else if (typeof elimValRaw === 'boolean') {
        isEliminatoryBool = elimValRaw;
      } else if (typeof elimValRaw === 'string') {
        const elimVal = elimValRaw.trim().toUpperCase();
        if (elimVal === 'OUI' || elimVal === 'TRUE' || elimVal === '1') isEliminatoryBool = true;
        else if (elimVal === 'NON' || elimVal === 'FALSE' || elimVal === '0') isEliminatoryBool = false;
        else errorsForRow.push(`Valeur de 'Éliminatoire' (${elimValRaw}) invalide. Doit être OUI, NON, TRUE, FALSE, 1, ou 0.`);
      } else {
         errorsForRow.push(`Type de donnée inattendu pour 'Éliminatoire': ${typeof elimValRaw}`);
      }

      let timeLimitNum: number | undefined = undefined;
      if (rawQ.timeLimit !== null && rawQ.timeLimit !== undefined && String(rawQ.timeLimit).trim() !== '') {
        if (typeof rawQ.timeLimit === 'number') {
          timeLimitNum = rawQ.timeLimit;
        } else if (typeof rawQ.timeLimit === 'string') {
          timeLimitNum = parseInt(rawQ.timeLimit.trim(), 10);
          if (isNaN(timeLimitNum)) {
            errorsForRow.push(`Valeur de 'Temps Limite' (${rawQ.timeLimit}) invalide. Doit être un nombre.`);
            timeLimitNum = undefined;
          }
        }
         if (timeLimitNum !== undefined && (timeLimitNum < 5 || timeLimitNum > 120)) { // Example range validation
            errorsForRow.push(`'Temps Limite' (${timeLimitNum}) doit être entre 5 et 120 secondes.`);
        }
      } // timeLimit is optional, so no error if missing/empty

      if (errorsForRow.length > 0) {
        feedback.push(`Ligne ${rowNum}: Erreurs - ${errorsForRow.join('; ')}`);
      } else {
        const newQuestion: Question = {
          id: generateQuestionId(),
          text: questionText!, // Already validated as non-null
          referential: referentialText as ReferentialType, // Already validated
          theme: themeText as QuestionTheme, // Already validated
          options: options, // Already populated with trimmed, non-null strings
          correctAnswer: correctAnswerIndex, // Validated
          isEliminatory: isEliminatoryBool!, // Validated
          timeLimit: timeLimitNum,
          image: (typeof rawQ.imageName === 'string' ? rawQ.imageName.trim() : null) || undefined,
          type: ((typeof rawQ.type === 'string' ? rawQ.type.trim() : null) as 'multiple-choice' | 'true-false') || 'multiple-choice',
        };
        newQuestions.push(newQuestion);
        importedCount++;
      }
    });

    feedback.push(`${importedCount} questions importées avec succès sur ${rawQuestions.length} lignes de données brutes.`);
    setImportFeedback(feedback);

    console.log("Questions importées (prêtes à être ajoutées) :", newQuestions);
    if (newQuestions.length > 0) {
       alert(`Simulating: ${newQuestions.length} questions would be added. Check console for details.`);
    }
  };

  const getHeaderActions = () => {
    switch (activeView) {
      case 'library':
        return (
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              icon={<FileUp size={16} />}
              onClick={handleImportExcelClick}
            >
              Importer Excel
            </Button>
            <Button
              variant="outline"
              icon={<FileDown size={16} />}
              onClick={handleExportExcel} // Changed from handleExportCsv
            >
              Exporter Excel {/* Updated text */}
            </Button>
            <Button
              variant="outline"
              icon={<BarChart3 size={16} />}
              onClick={handleViewStatistics}
            >
              Statistiques
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={handleCreateNew}
            >
              Nouvelle question
            </Button>
          </div>
        );
      case 'form':
      case 'statistics':
        return (
          <Button
            variant="outline"
            onClick={handleBackToLibrary}
          >
            Retour à la bibliothèque
          </Button>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (activeView) {
      case 'form':
        return editingQuestionId ? 'Modifier une question' : 'Créer une question';
      case 'statistics':
        return 'Statistiques des questions';
      default:
        return 'Bibliothèque de questions';
    }
  };

  const getSubtitle = () => {
    switch (activeView) {
      case 'form':
        return editingQuestionId 
          ? 'Modifiez les paramètres et le contenu de la question'
          : 'Créez une nouvelle question pour la bibliothèque CACES';
      case 'statistics':
        return 'Analysez l\'utilisation et les performances des questions';
      default:
        return 'Gérez votre bibliothèque de questions CACES par recommandation';
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'form':
        return <QuestionForm questionId={editingQuestionId} onSave={handleBackToLibrary} />;
      case 'statistics':
        return <QuestionStatistics />;
      default:
        return <QuestionLibrary onEditQuestion={handleEditQuestion} />;
    }
  };

  return (
    <Layout
      title={getTitle()}
      subtitle={getSubtitle()}
      actions={getHeaderActions()}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".xlsx, .xls" // Updated accept types
        style={{ display: 'none' }}
      />
      {importFeedback.length > 0 && (
        <Card title="Résultat de l'importation Excel" className="mb-4"> {/* Updated title */}
          <div className="p-4 space-y-1 text-sm max-h-40 overflow-y-auto">
            {importFeedback.map((msg, idx) => (
              <p key={idx} className={msg.toLowerCase().includes("erreur") || msg.toLowerCase().includes("errors") ? "text-red-600" : ""}>{msg}</p>
            ))}
          </div>
        </Card>
      )}
      {renderContent()}
    </Layout>
  );
};

export default Library;