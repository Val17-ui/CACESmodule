import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, FileSpreadsheet } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { referentials, QuestionTheme, questionThemes } from '../../types'; // ReferentialType supprimé
import { mockQuestions } from '../../data/mockData';

const QuestionStatistics: React.FC = () => {
  const [selectedReferential, setSelectedReferential] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('usage');

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

  const sortOptions = [
    { value: 'usage', label: 'Plus utilisées' },
    { value: 'success-rate', label: 'Taux de réussite' },
    { value: 'failure-rate', label: 'Taux d\'échec' },
    { value: 'recent', label: 'Plus récentes' }
  ];

  const filteredQuestions = mockQuestions.filter(question => {
    const matchesReferential = !selectedReferential || question.referentiel === selectedReferential; // Corrigé: referential -> referentiel
    const matchesTheme = !selectedTheme || question.theme === selectedTheme;
    return matchesReferential && matchesTheme;
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
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

  const totalQuestions = filteredQuestions.length;
  const totalUsage = filteredQuestions.reduce((sum, q) => sum + (q.usageCount || 0), 0);
  const averageSuccessRate = filteredQuestions.reduce((sum, q) => sum + (q.correctResponseRate || 0), 0) / totalQuestions;

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 75) return 'text-green-600';
    if (rate >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getSuccessRateIcon = (rate: number) => {
    if (rate >= 75) return <TrendingUp size={16} className="text-green-600" />;
    if (rate <= 50) return <TrendingDown size={16} className="text-red-600" />;
    return null;
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Questions totales</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{totalQuestions}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <BarChart3 size={24} className="text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Utilisations totales</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{totalUsage}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50">
              <TrendingUp size={24} className="text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Taux moyen de réussite</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{averageSuccessRate.toFixed(0)}%</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <BarChart3 size={24} className="text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Questions problématiques</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {filteredQuestions.filter(q => (q.correctResponseRate || 0) < 50).length}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <TrendingDown size={24} className="text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Filtres et export" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            label="Trier par"
            options={sortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline" icon={<Download size={16} />}>
            Exporter PDF
          </Button>
          <Button variant="outline" icon={<FileSpreadsheet size={16} />}>
            Exporter Excel
          </Button>
        </div>
      </Card>

      <Card title={`Statistiques détaillées (${sortedQuestions.length} questions)`}>
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
                  Utilisations
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux de réussite
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dernière utilisation
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedQuestions.map((question) => (
                <tr key={question.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {question.text.length > 60 
                        ? `${question.text.substring(0, 60)}...` 
                        : question.text
                      }
                    </div>
                    {question.isEliminatory && (
                      <Badge variant="danger">Éliminatoire</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="primary">{question.referentiel}</Badge> {/* Corrigé: referential -> referentiel */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {questionThemes[question.theme as QuestionTheme] || question.theme} {/* Corrigé: indexation avec assertion et fallback */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {question.usageCount || 0} fois
                    </div>
                    <div className="text-xs text-gray-500">
                      en 2025
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium mr-2 ${getSuccessRateColor(question.correctResponseRate || 0)}`}>
                        {question.correctResponseRate || 0}%
                      </span>
                      {getSuccessRateIcon(question.correctResponseRate || 0)}
                    </div>
                    <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-1.5 rounded-full ${
                          (question.correctResponseRate || 0) >= 75 ? 'bg-green-600' :
                          (question.correctResponseRate || 0) >= 50 ? 'bg-amber-500' : 'bg-red-600'
                        }`}
                        style={{ width: `${question.correctResponseRate || 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {question.usageCount && question.usageCount > 0 ? '15/01/2025' : 'Jamais'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default QuestionStatistics;