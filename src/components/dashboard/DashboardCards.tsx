import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { OnboardingStatus, OnboardingStepStatus } from '@common/types';
import { StorageManager } from '../../services/StorageManager';
import { CheckCircle, Circle, Wrench } from 'lucide-react';
import { logger } from '../../utils/logger';

interface OnboardingStep {
  id: keyof OnboardingStatus;
  title: string;
  isOptional: boolean;
  page: string;
  link: string;
}

type DashboardCardsProps = {
  onPageChange: (page: string, details?: number | string) => void;
};

const DashboardCards: React.FC<DashboardCardsProps> = ({ onPageChange }) => {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const stepsDefinition: OnboardingStep[] = [
    { id: 'addQuestions', title: 'Ajouter les questions dans la bibliothèque', isOptional: false, page: 'settings', link: 'library' },
    { id: 'addTrainers', title: 'Ajouter le nom de vos formateurs', isOptional: false, page: 'settings', link: 'trainers' },
    { id: 'createKits', title: 'Créer des kits de boîtiers', isOptional: true, page: 'settings', link: 'devicesAndKits' },
    { id: 'modifyPreferences', title: 'Modification des préférences', isOptional: true, page: 'settings', link: 'preferences' },
    { id: 'configureTechnicalSettings', title: 'Paramètres techniques', isOptional: true, page: 'settings', link: 'technical' },
  ];

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      setIsLoading(true);
      try {
        const storedStatus = await StorageManager.getAdminSetting('onboardingStatus');
        const initialStatus: OnboardingStatus = storedStatus || {
          addQuestions: 'pending',
          addTrainers: 'pending',
          createKits: 'pending',
          modifyPreferences: 'pending',
          configureTechnicalSettings: 'pending',
        };

        const [questions, kits, trainers, orsSavePath, reportSavePath, imagesSavePath] = await Promise.all([
          window.dbAPI.getAllQuestions(),
          window.dbAPI.getAllDeviceKits(),
          window.dbAPI.getAllTrainers(),
          StorageManager.getAdminSetting('orsSavePath'),
          StorageManager.getAdminSetting('reportSavePath'),
          StorageManager.getAdminSetting('imagesSavePath'), // Corrected key
        ]);

        const newStatus: OnboardingStatus = { ...initialStatus };

        if (questions.length > 0) newStatus.addQuestions = 'completed_by_action';
        if (trainers.length > 0) newStatus.addTrainers = 'completed_by_action';
        if (kits.filter(k => !k.is_global).length > 0) newStatus.createKits = 'completed_by_action';
        // 'modifyPreferences' can only be completed by user action
        if (orsSavePath && reportSavePath && imagesSavePath) newStatus.configureTechnicalSettings = 'completed_by_action';

        // Don't downgrade a step completed by the user
        for (const key in newStatus) {
            const stepKey = key as keyof OnboardingStatus;
            if(initialStatus[stepKey] === 'completed_by_user') {
                newStatus[stepKey] = 'completed_by_user';
            }
        }

        if (JSON.stringify(initialStatus) !== JSON.stringify(newStatus)) {
          await StorageManager.setAdminSetting('onboardingStatus', newStatus);
          setOnboardingStatus(newStatus);
          logger.info('Onboarding status updated.', newStatus);
        } else {
          setOnboardingStatus(initialStatus);
        }

      } catch (error) {
        logger.error('Failed to check onboarding status:', error);
        setOnboardingStatus({
            addQuestions: 'pending',
            addTrainers: 'pending',
            createKits: 'pending',
            modifyPreferences: 'pending',
            configureTechnicalSettings: 'pending',
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const handleMarkAsDone = async (stepId: keyof OnboardingStatus) => {
    if (!onboardingStatus) return;
    const newStatus = { ...onboardingStatus, [stepId]: 'completed_by_user' };
    setOnboardingStatus(newStatus);
    await StorageManager.setAdminSetting('onboardingStatus', newStatus);
  };

  if (isLoading || !onboardingStatus) {
    return (
      <Card className="border border-gris-moyen/50 mb-6">
        <p>Chargement de la carte de personnalisation...</p>
      </Card>
    );
  }

  const isStepCompleted = (status: OnboardingStepStatus) => status !== 'pending';

  const allStepsCompleted = stepsDefinition.every(step => isStepCompleted(onboardingStatus[step.id]));

  if (allStepsCompleted) {
    return null;
  }

  const completedCount = stepsDefinition.filter(step => isStepCompleted(onboardingStatus[step.id])).length;
  const totalSteps = stepsDefinition.length;
  const progressPercentage = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  return (
    <Card
      title="Installation & personnalisation"
      icon={<Wrench size={20} className="text-rouge-accent" />}
      className="border-2 border-rouge-accent/50 mb-6"
    >
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-texte-principal/80">
            {completedCount}/{totalSteps} étapes complétées
          </p>
        </div>
        <div className="w-full bg-gris-moyen/30 rounded-full h-2.5">
          <div
            className="bg-vert-validation h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <ul className="space-y-3">
        {stepsDefinition.map((step) => {
          const isCompleted = isStepCompleted(onboardingStatus[step.id]);
          return (
            <li key={step.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gris-clair/50">
              <div className="flex items-center">
                {isCompleted ? (
                  <CheckCircle size={20} className="text-vert-validation mr-3" />
                ) : (
                  <Circle size={20} className="text-gris-moyen mr-3" />
                )}
                <span className={`text-sm ${isCompleted ? 'line-through text-texte-principal/60' : 'text-texte-principal'}`}>
                  {step.title} {step.isOptional && '(Optionnel)'}
                </span>
              </div>
              <div>
                {isCompleted ? (
                   <a href="#" onClick={(e) => { e.preventDefault(); onPageChange(step.page, step.link); }} className="text-sm font-medium text-accent-neutre hover:underline">
                     Vérifier
                   </a>
                ) : (
                    step.isOptional ? (
                        <Button onClick={() => handleMarkAsDone(step.id)} variant="outline" size="sm" className="mr-2">
                            Marquer comme fait
                        </Button>
                    ) : (
                        <a href="#" onClick={(e) => { e.preventDefault(); onPageChange(step.page, step.link); }} className="text-sm font-medium text-rouge-accent hover:underline">
                            Commencer
                        </a>
                    )
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  );
};

export default DashboardCards;