import React from 'react';
import QuestionLibrary from '../components/library/QuestionLibrary';
import Layout from '../components/layout/Layout';

const LibraryPage: React.FC = () => {
  const handleEditQuestion = (questionId: string) => {
    // Rediriger vers la page de modification de question ou ouvrir un modal
    console.log("Edit question with id:", questionId);
  };

  return (
    <Layout activePage="library" onPageChange={() => {}}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Bibliothèque de Questions</h1>
        <p className="mt-1 text-sm text-gray-600">Gérez, importez et explorez vos référentiels, thèmes et questions.</p>
        <div className="mt-8">
          <QuestionLibrary onEditQuestion={handleEditQuestion} />
        </div>
      </div>
    </Layout>
  );
};

export default LibraryPage;
