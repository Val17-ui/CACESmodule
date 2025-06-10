import React from 'react';
import Layout from '../components/layout/Layout';
import DashboardCards from '../components/dashboard/DashboardCards';
import UpcomingSessions from '../components/dashboard/UpcomingSessions';
import QuickActions from '../components/dashboard/QuickActions';
import Button from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { mockSessions } from '../data/mockData';

type DashboardProps = {
  activePage: string;
  onPageChange: (page: string) => void;
};

const Dashboard: React.FC<DashboardProps> = ({ activePage, onPageChange }) => {
  const headerActions = (
    <Button 
      variant="primary"
      icon={<Plus size={16} />}
      onClick={() => onPageChange('sessions')}
    >
      Nouvelle session
    </Button>
  );

  return (
    <Layout
      title="Tableau de bord"
      subtitle="Vue d'ensemble des activités CACES"
      actions={headerActions}
      activePage={activePage}
      onPageChange={onPageChange}
    >
      <DashboardCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <UpcomingSessions sessions={mockSessions} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;