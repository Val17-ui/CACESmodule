import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { OnboardingStatus, QuestionWithId, DeviceKit, Trainer } from '@common/types';
import { StorageManager } from '../../services/StorageManager';
import { CheckCircle, Circle } from 'lucide-react';
import { logger } from '../../utils/logger';

// Define the structure for each onboarding step
interface OnboardingStep {
  id: keyof OnboardingStatus;
  title: string;
  isCompleted: boolean;
  link: string;
  page: string;
}

type DashboardCardsProps = {
  onPageChange: (page: string, details?: number | string) => void;
};

const DashboardCards: React.FC<DashboardCardsProps> = ({ onPageChange }) => {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      setIsLoading(true);
      try {
        const storedStatus = await StorageManager.getAdminSetting('onboardingStatus');
        const initialStatus: OnboardingStatus = storedStatus || {
          hasAddedQuestions: false,
          hasCreatedKits: false,
          hasAddedTrainers: false,
          hasConfiguredTechnicalSettings: false,
        };

        // Fetch actual data to verify status
        const [questions, kits, trainers, orsSavePath, reportSavePath, imagesFolderPath] = await Promise.all([
          window.dbAPI.getAllQuestions(),
          window.dbAPI.getAllDeviceKits(),
          window.dbAPI.getAllTrainers(),
          StorageManager.getAdminSetting('orsSavePath'),
          StorageManager.getAdminSetting('reportSavePath'),
          StorageManager.getAdminSetting('imagesFolderPath'),
        ]);

        const actualStatus: OnboardingStatus = {
          hasAddedQuestions: questions.length > 0,
          hasCreatedKits: kits.filter(k => !k.is_global).length > 0,
          hasAddedTrainers: trainers.length > 0,
          hasConfiguredTechnicalSettings: !!(orsSavePath && reportSavePath && imagesFolderPath),
        };

        // If the actual status is different from the stored status, update it
        if (JSON.stringify(initialStatus) !== JSON.stringify(actualStatus)) {
          await StorageManager.setAdminSetting('onboardingStatus', actualStatus);
          setOnboardingStatus(actualStatus);
          logger.info('Onboarding status updated.', actualStatus);
        } else {
          setOnboardingStatus(initialStatus);
        }

      } catch (error) {
        logger.error('Failed to check onboarding status:', error);
        // Fallback to a default state in case of error
        setOnboardingStatus({
          hasAddedQuestions: false,
          hasCreatedKits: false,
          hasAddedTrainers: false,
          hasConfiguredTechnicalSettings: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-gris-moyen/50 mb-6">
        <p>Chargement de la carte de personnalisation...</p>
      </Card>
    );
  }

  const allStepsCompleted = onboardingStatus && Object.values(onboardingStatus).every(status => status);

  if (allStepsCompleted) {
    return null;
  }

  const steps: OnboardingStep[] = [
    { id: 'hasAddedQuestions', title: 'Ajouter les questions dans la bibliothèque', isCompleted: onboardingStatus?.hasAddedQuestions || false, page: 'settings', link: 'library' },
    { id: 'hasCreatedKits', title: 'Ajouter vos boîtiers de vote et créer des kits', isCompleted: onboardingStatus?.hasCreatedKits || false, page: 'settings', link: 'devicesAndKits' },
    { id: 'hasAddedTrainers', title: 'Ajouter le nom de vos formateurs', isCompleted: onboardingStatus?.hasAddedTrainers || false, page: 'settings', link: 'trainers' },
    { id: 'hasConfiguredTechnicalSettings', title: 'Configurer les liens dans les préférences techniques', isCompleted: onboardingStatus?.hasConfiguredTechnicalSettings || false, page: 'settings', link: 'technical' },
  ];

  const completedCount = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <Card title="Installation & personnalisation" className="border-2 border-accent-neutre/50 mb-6">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-texte-principal/80">
            {completedCount}/{totalSteps} étapes complétées
          </p>
        </div>
        <div className="w-full bg-gris-moyen/30 rounded-full h-2.5">
          <div
            className="bg-vert-succes h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gris-clair/50">
            <div className="flex items-center">
              {step.isCompleted ? (
                <CheckCircle size={20} className="text-vert-succes mr-3" />
              ) : (
                <Circle size={20} className="text-gris-moyen mr-3" />
              )}
              <span className={`text-sm ${step.isCompleted ? 'line-through text-texte-principal/60' : 'text-texte-principal'}`}>
                {step.title}
              </span>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); onPageChange(step.page, step.link); }} className="text-sm font-medium text-accent-neutre hover:underline">
              {step.isCompleted ? 'Vérifier' : 'Commencer'}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default DashboardCards;