import React from 'react';
import { FileText, Edit, Trash2, Copy, FileDown } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { StoredQuestionnaire } from '../../services/StorageManager'; // Updated import

type QuestionnairesListProps = {
  questionnaires: StoredQuestionnaire[]; // Updated prop type
  onEditQuestionnaire: (id: string) => void;
  onExportQuestionnaire: (id: string) => void; // New prop for export
};

const QuestionnairesList: React.FC<QuestionnairesListProps> = ({
  questionnaires,
  onEditQuestionnaire,
  onExportQuestionnaire, // Destructure new prop
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  return (
    <Card title="Questionnaires disponibles">
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Questionnaire
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Référentiel
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Questions
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mise à jour
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seuil
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questionnaires.map((questionnaire) => (
              <tr key={questionnaire.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600">
                      <FileText size={20} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {questionnaire.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="primary">{questionnaire.referential}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {questionnaire.questionIds.length} questions
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(questionnaire.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {questionnaire.passingThreshold}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit size={16} />}
                      // Ensure id is converted to string if it's a number, as onEditQuestionnaire expects string
                      onClick={() => onEditQuestionnaire(String(questionnaire.id))}
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
                      icon={<FileDown size={16} />}
                      onClick={() => onExportQuestionnaire(String(questionnaire.id))} // Call export handler
                    >
                      Exporter
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
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default QuestionnairesList;