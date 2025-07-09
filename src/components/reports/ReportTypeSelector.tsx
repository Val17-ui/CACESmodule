
import React from 'react';
import Card from '../ui/Card';
import { FileText, User, Layers, BarChartHorizontal, Sliders } from 'lucide-react'; // Suppression de Calendar

export type ReportType = 'session' | 'participant' | 'referential' | 'block' | 'custom'; // Suppression de 'period'

type ReportItem = {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
};

const reportTypes: ReportItem[] = [
  { id: 'session', title: 'Rapport par session', description: 'Consulter les résultats détaillés pour une session spécifique.', icon: FileText },
  { id: 'participant', title: 'Rapport par participant', description: `Suivre la performance et l'historique d'un participant.`, icon: User },
  // { id: 'period', title: 'Rapport par période', description: 'Analyser les tendances sur une plage de dates définie.', icon: Calendar }, // Supprimé
  { id: 'referential', title: 'Rapport par référentiel', description: 'Comparer les statistiques entre différents référentiels CACES.', icon: Layers },
  { id: 'block', title: 'Rapport par bloc de questions', description: 'Évaluer la pertinence et la difficulté des blocs de questions.', icon: BarChartHorizontal },
  { id: 'custom', title: 'Rapport personnalisé', description: 'Créez vos propres rapports avec des filtres avancés.', icon: Sliders },
];

type ReportTypeSelectorProps = {
  onSelectReport: (reportType: ReportType) => void;
};

const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({ onSelectReport }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-texte-principal mb-4">Choisissez un type de rapport</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.id}
              className="hover:shadow-lg hover:border-accent-neutre transition-all duration-200 cursor-pointer"
              onClick={() => onSelectReport(report.id)}
            >
              <div className="flex items-start">
                <div className="p-3 rounded-lg bg-gris-moyen/20 mr-4">
                  <Icon size={28} className="text-rouge-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-texte-principal mb-1">{report.title}</h3>
                  <p className="text-sm text-texte-principal/80">{report.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ReportTypeSelector;
