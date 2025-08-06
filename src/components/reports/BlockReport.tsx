import React, { useState, useEffect, useMemo, useRef } from 'react';
import Card from '../ui/Card';
import { StorageManager } from '../../services/StorageManager';
import { Session, Referential, Theme, Bloc } from '@common/types';
import { calculateDrawStatistics, ReferentialDrawStat } from '../../utils/reportCalculators';
import Button from '../ui/Button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type BlockReportProps = {
  startDate?: string;
  endDate?: string;
  referentialFilter?: string;
};

const BlockReport: React.FC<BlockReportProps> = ({ startDate, endDate, referentialFilter }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allReferentielsDb, setAllReferentielsDb] = useState<Referential[]>([]);
  const [allThemesDb, setAllThemesDb] = useState<Theme[]>([]);
  const [allBlocsDb, setAllBlocsDb] = useState<Bloc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastSavedFilePath, setLastSavedFilePath] = useState<string | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!reportContentRef.current || stats.length === 0) {
      alert("Il n'y a aucune donnée à exporter.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
        const canvas = await html2canvas(reportContentRef.current, { scale: 2, useCORS: true });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const headerHeight = 20;
        const footerHeight = 20;

        const contentWidth = pdfWidth - margin * 2;
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        const pageContentHeight = pdfHeight - headerHeight - footerHeight;

        let heightLeft = contentHeight;
        let position = headerHeight;

        pdf.setFontSize(18);
        pdf.text('Rapport des Tirages', pdfWidth / 2, margin, { align: 'center' });

        pdf.addImage(canvas, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= pageContentHeight;

        let page = 1;
        while (heightLeft > 0) {
          position = -pageContentHeight * page + headerHeight;
          pdf.addPage();
          pdf.addImage(canvas, 'PNG', margin, position, contentWidth, contentHeight);

          // Re-add header to new page
          pdf.setFontSize(18);
          pdf.text('Rapport des Tirages', pdfWidth / 2, margin, { align: 'center' });

          heightLeft -= pageContentHeight;
          page++;
        }

        const pdfBlob = pdf.output('blob');
        const pdfBuffer = await pdfBlob.arrayBuffer();
        const fileName = `rapport_des_tirages_${new Date().toISOString().split('T')[0]}.pdf`;

        const result = await window.dbAPI?.saveReportFile?.(pdfBuffer, fileName);
        if (result?.success && result.filePath) {
            setLastSavedFilePath(result.filePath);
        } else {
           throw new Error(result?.error || 'Une erreur inconnue est survenue lors de la sauvegarde.');
        }
    } catch (error) {
        console.error("Erreur lors de l'export PDF du rapport des tirages:", error);
        alert(`Une erreur est survenue lors de la génération du PDF: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [
          fetchedSessions,
          fetchedReferentiels,
          fetchedThemes,
          fetchedBlocs
        ] = await Promise.all([
          StorageManager.getAllSessions(),
          StorageManager.getAllReferentiels(),
          StorageManager.getAllThemes(),
          StorageManager.getAllBlocs()
        ]);
        setSessions(fetchedSessions);
        setAllReferentielsDb(fetchedReferentiels);
        setAllThemesDb(fetchedThemes);
        setAllBlocsDb(fetchedBlocs);
      } catch (error) {
        console.error("Failed to fetch data for Block Report:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats: ReferentialDrawStat[] = useMemo(() => {
    const filteredSessions = sessions.filter(session => {
      if (session.status !== 'completed') return false;
      if (!startDate && !endDate) return true;
      const sessionDate = new Date(session.dateSession);
      if (startDate && sessionDate < new Date(startDate)) return false;
      if (endDate) {
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);
        if (sessionDate > endOfDayEndDate) return false;
      }
      return true;
    });

    const allStats = calculateDrawStatistics(
      filteredSessions,
      allReferentielsDb,
      allThemesDb,
      allBlocsDb
    );

    if (referentialFilter && referentialFilter !== 'all') {
      return allStats.filter(refStat => String(refStat.referentielId) === referentialFilter);
    }

    return allStats;
  }, [sessions, allReferentielsDb, allThemesDb, allBlocsDb, startDate, endDate, referentialFilter]);

  if (isLoading) {
    return <Card><p>Chargement des données...</p></Card>;
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Rapport des Tirages</h2>
        <div className="flex items-center space-x-2">
            {lastSavedFilePath && (
              <div className="text-sm text-green-600">
                Fichier enregistré !{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); window.dbAPI?.openFile(lastSavedFilePath); }} className="underline hover:text-green-800">Ouvrir</a>
              </div>
            )}
            <Button onClick={handleExportPDF} disabled={isGeneratingPdf || isLoading} icon={<Download size={16}/>}>
              {isGeneratingPdf ? 'Génération...' : 'Exporter en PDF'}
            </Button>
        </div>
      </div>
      <div ref={reportContentRef}>
        {isLoading ? (
          <p>Chargement des données...</p>
        ) : stats.length === 0 ? (
          <p className="text-gray-500">Aucune donnée de tirage à afficher pour la période ou les filtres sélectionnés.</p>
        ) : (
          stats.map(referentiel => (
            <div key={referentiel.referentielId} className="mb-8 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 bg-gray-100 p-3 rounded-t-md -m-4 mb-4 border-b border-gray-200">
                Référentiel: {referentiel.referentielCode}
              <span className="text-sm font-normal text-gray-600 ml-4">
                (Utilisé dans {referentiel.totalSessionUsage} session(s))
              </span>
            </h3>

            {referentiel.themes.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun thème utilisé pour ce référentiel dans la période sélectionnée.</p>
            ) : (
              <div className="space-y-4">
              {referentiel.themes.map(theme => (
                <div key={theme.themeId}>
                  <h4 className="text-md font-semibold text-gray-700">
                    Thème: {theme.themeName} <span className="font-normal text-gray-500">({theme.themeCode})</span>
                  </h4>
                  <div className="mt-2 pl-4 border-l-2 border-gray-200">
                    {theme.blocks.map(block => (
                      <div key={block.blocId} className="text-sm text-gray-800 py-1 flex justify-between">
                        <div>
                          <span className="font-semibold">{block.blocCode}:</span>
                          <span className="ml-2 text-gray-600">{block.usageCount} / {block.totalReferentielUsage} tirage(s)</span>
                        </div>
                        <div className="font-bold">
                          {block.usagePercentage.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        ))
      )}
      </div>
    </Card>
  );
};

export default BlockReport;
