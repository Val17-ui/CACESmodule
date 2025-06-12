import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileDown, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { processExcel } from './utils/excelProcessor';
import { generatePPTX } from './utils/pptxGenerator';
import Header from './components/Header';

function App() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [defaultDuration, setDefaultDuration] = useState<number>(30);
  const [processing, setProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  const onExcelDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setExcelFile(acceptedFiles[0]);
      setStatus({ message: 'Excel file uploaded. Ready to process.', type: 'info' });
    }
  }, []);

  const onTemplateDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setTemplateFile(acceptedFiles[0]);
      setStatus({ message: 'Template PPTX file uploaded (optional).', type: 'info' });
    }
  }, []);

  const { getRootProps: getExcelRootProps, getInputProps: getExcelInputProps } = useDropzone({
    onDrop: onExcelDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const { getRootProps: getTemplateRootProps, getInputProps: getTemplateInputProps } = useDropzone({
    onDrop: onTemplateDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    maxFiles: 1
  });

  const handleProcessExcel = async () => {
    if (!excelFile) {
      setStatus({ message: 'Please upload an Excel file first.', type: 'error' });
      return;
    }

    setProcessing(true);
    setStatus({ message: 'Processing Excel file...', type: 'info' });

    try {
      const result = await processExcel(excelFile);
      setQuestions(result);
      setStatus({ message: `Successfully processed ${result.length} questions.`, type: 'success' });
    } catch (error) {
      console.error('Error processing Excel:', error);
      setStatus({ message: `Error processing Excel: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleGeneratePPTX = async () => {
    if (questions.length === 0) {
      setStatus({ message: 'Please process the Excel file first.', type: 'error' });
      return;
    }

    setProcessing(true);
    setStatus({ message: 'Generating PPTX file...', type: 'info' });

    try {
      await generatePPTX(templateFile, questions, defaultDuration);
      setStatus({ message: 'PPTX file generated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error generating PPTX:', error);
      setStatus({ message: `Error generating PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate OMBEA-Compatible PowerPoint</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Excel File Upload */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">1. Upload Questions Excel</h3>
              <div 
                {...getExcelRootProps()} 
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  excelFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input {...getExcelInputProps()} />
                <FileUp className={`w-12 h-12 mb-3 ${excelFile ? 'text-green-500' : 'text-blue-500'}`} />
                {excelFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{excelFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(excelFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop your Excel file here</p>
                    <p className="text-xs text-gray-500">or click to browse</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleProcessExcel}
                disabled={!excelFile || processing}
                className={`mt-4 py-2 px-4 rounded-md font-medium ${
                  !excelFile || processing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {processing ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Process Excel'
                )}
              </button>
            </div>

            {/* Template PPTX Upload (Optional) */}
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">2. Upload Template PPTX (Optional)</h3>
              <div 
                {...getTemplateRootProps()} 
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  templateFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input {...getTemplateInputProps()} />
                <FileUp className={`w-12 h-12 mb-3 ${templateFile ? 'text-green-500' : 'text-blue-500'}`} />
                {templateFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{templateFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(templateFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop your template PPTX here (optional)</p>
                    <p className="text-xs text-gray-500">or click to browse</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Default Duration Setting */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">3. Set Default Vote Duration</h3>
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-gray-500 mr-2" />
              <input
                type="number"
                min="5"
                max="120"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 30)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-600">seconds</span>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleGeneratePPTX}
              disabled={questions.length === 0 || processing}
              className={`py-3 px-8 rounded-md font-medium flex items-center ${
                questions.length === 0 || processing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5 mr-2" />
                  Generate OMBEA PowerPoint
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`rounded-lg p-4 flex items-start ${
            status.type === 'success' ? 'bg-green-100 text-green-800' :
            status.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            ) : status.type === 'error' ? (
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 mr-3 flex-shrink-0" />
            )}
            <p>{status.message}</p>
          </div>
        )}

        {/* Preview Section */}
        {questions.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Questions Preview</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Question
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Correct Answer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Has Image
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {questions.map((q, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {q.question.length > 50 ? q.question.substring(0, 50) + '...' : q.question}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {q.correctAnswer ? 'Vrai' : 'Faux'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {q.duration || defaultDuration}s
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {q.imagePath ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
