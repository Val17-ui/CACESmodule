import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Edit, Trash2, Copy, Image, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { Question, ReferentialType, QuestionTheme, referentials, questionThemes, QuestionType } from '../../types';
import { getAllQuestions, QuestionWithId } from '../../db';

type QuestionLibraryProps = {
  onEditQuestion: (id: string) => void;
};

const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onEditQuestion }) => {
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedEliminatory, setSelectedEliminatory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [questions, setQuestions] = useState<QuestionWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const fetchedQuestions = await getAllQuestions();
        setQuestions(fetchedQuestions);
        setError(null);
      } catch (err) {
        console.error("Error fetching questions: ", err);
        setError("Failed to load questions.");
        setQuestions([]); // Ensure questions is an empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

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
        question.text.toLowerCase().includes(searchText.toLowerCase());

      return matchesReferential && matchesTheme && matchesEliminatory && matchesSearch;
    });
  }, [questions, selectedReferential, selectedTheme, selectedEliminatory, searchText]);

  const sortedQuestions = useMemo(() => {
    let sortableItems: QuestionWithId[] = [...filteredQuestions];
    sortableItems.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'success-rate':
          return (b.correctResponseRate || 0) - (a.correctResponseRate || 0);
        case 'failure-rate':
          return (a.correctResponseRate || 100) - (b.correctResponseRate || 100);
        case 'recent':
        default:
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
    });
    return sortableItems;
  }, [filteredQuestions, sortBy]);

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    const newPreviews: Record<string, string> = {};

    sortedQuestions.forEach(question => {
      if (question.id && question.image instanceof Blob) {
        const url = URL.createObjectURL(question.image);
        newPreviews[question.id.toString()] = url;
        urlsToRevoke.push(url); // Keep track of URLs created in this run
      }
    });
    setImagePreviews(newPreviews);

    return () => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
    };
  }, [sortedQuestions]);


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    // const date = new Date(dateString); // Original line, seems new Date(dateString) is used directly below
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
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>;
  }

  return (
    <div>
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

      <Card title={`Questions (${sortedQuestions.length})`}>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux de réussite
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {question.text.length > 80
                              ? `${question.text.substring(0, 80)}...`
                              : question.text
                            }
                          </div>
                          <div className="flex items-center space-x-2">
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
                                  alt="Question image"
                                  style={{ maxWidth: '50px', maxHeight: '50px', marginTop: '4px', borderRadius: '4px' }}
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
                    <div className="flex justify-end space-x-2">
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
                      >
                        Dupliquer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={16} />}
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