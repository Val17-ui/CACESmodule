import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import QuestionLibrary from '../components/library/QuestionLibrary';
import QuestionForm from '../components/library/QuestionForm';
import QuestionStatistics from '../components/library/QuestionStatistics';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Plus, FileUp, FileDown, BarChart3 } from 'lucide-react';
import { exportQuestionsToExcel, parseQuestionsExcel, RawExcelQuestion } from '../utils/excelProcessor';
import { mockQuestions } from '../data/mockData';
import { Question, QuestionType, CACESReferential, QuestionTheme, referentials, questionThemes } from '../types';
import { saveAs } from 'file-saver';

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

  const handleExportExcel = async () => {
    const questionsToExport: Question[] = mockQuestions;

    if (questionsToExport.length === 0) {
      console.log("Aucune question à exporter.");
      return;
    }

    try {
      const excelBlob = await exportQuestionsToExcel(questionsToExport);
      const fileName = `questions_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(excelBlob, fileName);
      console.log(`Export Excel réussi: ${fileName}`);
    } catch (error) {
      console.error("Erreur lors de l'export Excel:", error);
    }
  };

  const handleImportExcelClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportFeedback(["Traitement du fichier Excel..."]);

    try {
      const { data: rawQuestions, errors: parsingErrors, columnHeaders } = await parseQuestionsExcel(file);

      if (parsingErrors.length > 0) {
        setImportFeedback([
          "Erreurs lors du parsing Excel:",
          ...parsingErrors,
          `En-têtes détectés: ${columnHeaders.join(', ')}`
        ]);
        return;
      }

      if (rawQuestions.length === 0) {
        setImportFeedback(["Aucune donnée trouvée dans le fichier Excel."]);
        return;
      }

      processImportedQuestions(rawQuestions);
    } catch (error) {
      setImportFeedback([`Erreur de lecture du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`]);
    }
  };

  const processImportedQuestions = (rawQuestions: RawExcelQuestion[]) => {
    const newQuestions: Question[] = [];
    const feedback: string[] = [`${rawQuestions.length} lignes trouvées dans le fichier Excel.`];
    let importedCount = 0;

    rawQuestions.forEach((rawQ, index) => {
      const rowNum = index + 2; // Excel data starts from row 2 (after header)
      const errorsForRow: string[] = [];

      if (!rawQ.text) errorsForRow.push("Le champ 'text' est manquant.");
      if (!rawQ.referential) errorsForRow.push("Le champ 'referential' est manquant.");
      if (!rawQ.theme) errorsForRow.push("Le champ 'theme' est manquant.");
      if (!rawQ.optionA) errorsForRow.push("Le champ 'optionA' est manquant.");
      if (!rawQ.optionB) errorsForRow.push("Le champ 'optionB' est manquant.");
      if (!rawQ.correctAnswer) errorsForRow.push("Le champ 'correctAnswer' est manquant.");
      if (rawQ.isEliminatory === undefined || rawQ.isEliminatory === null || rawQ.isEliminatory.trim() === '') {
        errorsForRow.push("Le champ 'isEliminatory' est manquant.");
      }

      if (rawQ.referential && !Object.values(CACESReferential).includes(rawQ.referential as CACESReferential)) {
        errorsForRow.push(`Référentiel '${rawQ.referential}' invalide.`);
      }
      if (rawQ.theme && !Object.keys(questionThemes).includes(rawQ.theme as QuestionTheme)) {
        errorsForRow.push(`Thème '${rawQ.theme}' invalide.`);
      }

      const options: string[] = [];
      if (rawQ.optionA) options.push(rawQ.optionA);
      if (rawQ.optionB) options.push(rawQ.optionB);
      if (rawQ.optionC) options.push(rawQ.optionC);
      if (rawQ.optionD) options.push(rawQ.optionD);

      const definedOptions = options.filter(opt => opt !== undefined && opt !== null).map(opt => opt.trim());
      if (definedOptions.length < 2) errorsForRow.push("Au moins 2 options (A et B) avec du contenu sont requises.");

      let correctAnswerText = '';
      const caLetter = rawQ.correctAnswer?.trim().toUpperCase();
      if (caLetter === 'A' && definedOptions[0]) correctAnswerText = definedOptions[0];
      else if (caLetter === 'B' && definedOptions[1]) correctAnswerText = definedOptions[1];
      else if (caLetter === 'C' && definedOptions[2]) correctAnswerText = definedOptions[2];
      else if (caLetter === 'D' && definedOptions[3]) correctAnswerText = definedOptions[3];
      else errorsForRow.push(`Valeur de 'correctAnswer' (${rawQ.correctAnswer}) invalide ou option correspondante manquante.`);

      let isEliminatoryBool: boolean | undefined = undefined;
      if (rawQ.isEliminatory !== undefined && rawQ.isEliminatory !== null) {
        const elimVal = rawQ.isEliminatory.trim().toUpperCase();
        if (elimVal === 'TRUE' || elimVal === '1') isEliminatoryBool = true;
        else if (elimVal === 'FALSE' || elimVal === '0') isEliminatoryBool = false;
        else errorsForRow.push(`Valeur de 'isEliminatory' (${rawQ.isEliminatory}) invalide. Doit être TRUE, FALSE, 1, ou 0.`);
      }

      if (errorsForRow.length > 0) {
        feedback.push(`Ligne ${rowNum}: Erreurs - ${errorsForRow.join('; ')}`);
      } else {
        const newQuestion: Question = {
          id: generateQuestionId(),
          text: rawQ.text!,
          referential: rawQ.referential as CACESReferential,
          theme: rawQ.theme as QuestionTheme,
          options: definedOptions,
          correctAnswer: correctAnswerText,
          isEliminatory: isEliminatoryBool!,
          timeLimit: rawQ.timeLimit || 30,
          image: undefined, // Les images seront gérées séparément
          type: (rawQ.type as QuestionType) || QuestionType.QCM,
          createdAt: new Date().toISOString(),
          usageCount: 0,
          correctResponseRate: 0
        };

        newQuestions.push(newQuestion);
        importedCount++;
      }
    });

    feedback.push(`${importedCount} questions importées avec succès.`);
    setImportFeedback(feedback);

    console.log("Questions importées (prêtes à être ajoutées) :", newQuestions);
    if (newQuestions.length > 0) {
      alert(`Simulation: ${newQuestions.length} questions seraient ajoutées. Consultez la console pour les détails.`);
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
              onClick={handleExportExcel}
            >
              Exporter Excel
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
        return <QuestionForm questionId={editingQuestionId} onSave={handleBackToLibrary} onCancel={handleBackToLibrary} />;
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
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
      />
      {importFeedback.length > 0 && (
        <Card title="Résultat de l'importation Excel" className="mb-4">
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