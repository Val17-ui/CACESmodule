
import { Session, QuestionWithId, Referential } from '@common/types';

export const filterSessionsBySearchTerm = (sessions: Session[], searchTerm: string, referentielsData: Referential[]) => {
  if (!searchTerm) return sessions;
  const term = searchTerm.toLowerCase();
  return sessions.filter(session =>
    session.nomSession.toLowerCase().includes(term) ||
    (session.referentielId && referentielsData.find(r => r.id === session.referentielId)?.code.toLowerCase().includes(term))
  );
};

export const filterSessionsByPeriod = (sessions: Session[], selectedPeriod: string, periodFilters: any[]) => {
  if (selectedPeriod === 'all') return sessions;
  const filterOption = periodFilters.find(f => f.value === selectedPeriod);
  if (filterOption && filterOption.getDateRange) {
    const { start, end } = filterOption.getDateRange();
    return sessions.filter(session => {
      if (!session.dateSession) return false;
      const sessionDate = new Date(session.dateSession);
      sessionDate.setHours(0,0,0,0);
      return sessionDate >= start && sessionDate <= end;
    });
  }
  return sessions;
};

export const filterQuestions = (questions: QuestionWithId[], filters: {
  selectedReferential: string;
  selectedTheme: string;
  selectedBloc: string;
  selectedEliminatory: string;
  searchText: string;
}, referentielsData: Referential[], themesData: any[], blocsData: any[]) => {
  return questions.filter(question => {
    const matchesReferential = !filters.selectedReferential ||
      (question.blocId && referentielsData.some(r =>
        r.id?.toString() === filters.selectedReferential &&
        themesData.some(t => t.referentiel_id === r.id && blocsData.some(b => b.theme_id === t.id && b.id === question.blocId))
      ));
    const matchesTheme = !filters.selectedTheme ||
      (question.blocId && themesData.some(t =>
        t.id?.toString() === filters.selectedTheme && blocsData.some(b => b.theme_id === t.id && b.id === question.blocId)
      ));
    const matchesBloc = !filters.selectedBloc || (question.blocId?.toString() === filters.selectedBloc);

    const matchesEliminatory = !filters.selectedEliminatory ||
      (filters.selectedEliminatory === 'true' && question.isEliminatory) ||
      (filters.selectedEliminatory === 'false' && !question.isEliminatory);
    const matchesSearch = !filters.searchText ||
      (question.text && question.text.toLowerCase().includes(filters.searchText.toLowerCase()));

    return matchesReferential && matchesTheme && matchesBloc && matchesEliminatory && matchesSearch;
  });
};
