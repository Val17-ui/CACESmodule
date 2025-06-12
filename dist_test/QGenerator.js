import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileDown, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { processExcel } from './utils/excelProcessor';
import { generatePPTX } from './utils/pptxGenerator';
import Header from './components/Header';
function App() {
    const [excelFile, setExcelFile] = useState(null);
    const [templateFile, setTemplateFile] = useState(null);
    const [defaultDuration, setDefaultDuration] = useState(30);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState(null);
    const [questions, setQuestions] = useState([]);
    const onExcelDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setExcelFile(acceptedFiles[0]);
            setStatus({ message: 'Excel file uploaded. Ready to process.', type: 'info' });
        }
    }, []);
    const onTemplateDrop = useCallback((acceptedFiles) => {
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
        }
        catch (error) {
            console.error('Error processing Excel:', error);
            setStatus({ message: `Error processing Excel: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
        }
        finally {
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
        }
        catch (error) {
            console.error('Error generating PPTX:', error);
            setStatus({ message: `Error generating PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
        }
        finally {
            setProcessing(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100", children: [_jsx(Header, {}), _jsxs("main", { className: "container mx-auto px-4 py-8", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-6 mb-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-800 mb-6", children: "Generate OMBEA-Compatible PowerPoint" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "flex flex-col", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-700 mb-3", children: "1. Upload Questions Excel" }), _jsxs("div", { ...getExcelRootProps(), className: `border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${excelFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`, children: [_jsx("input", { ...getExcelInputProps() }), _jsx(FileUp, { className: `w-12 h-12 mb-3 ${excelFile ? 'text-green-500' : 'text-blue-500'}` }), excelFile ? (_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: excelFile.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [(excelFile.size / 1024).toFixed(2), " KB"] })] })) : (_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-700", children: "Drop your Excel file here" }), _jsx("p", { className: "text-xs text-gray-500", children: "or click to browse" })] }))] }), _jsx("button", { onClick: handleProcessExcel, disabled: !excelFile || processing, className: `mt-4 py-2 px-4 rounded-md font-medium ${!excelFile || processing
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: processing ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Processing..."] })) : ('Process Excel') })] }), _jsxs("div", { className: "flex flex-col", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-700 mb-3", children: "2. Upload Template PPTX (Optional)" }), _jsxs("div", { ...getTemplateRootProps(), className: `border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${templateFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`, children: [_jsx("input", { ...getTemplateInputProps() }), _jsx(FileUp, { className: `w-12 h-12 mb-3 ${templateFile ? 'text-green-500' : 'text-blue-500'}` }), templateFile ? (_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: templateFile.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [(templateFile.size / 1024).toFixed(2), " KB"] })] })) : (_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-700", children: "Drop your template PPTX here (optional)" }), _jsx("p", { className: "text-xs text-gray-500", children: "or click to browse" })] }))] })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-700 mb-3", children: "3. Set Default Vote Duration" }), _jsxs("div", { className: "flex items-center", children: [_jsx(Clock, { className: "w-5 h-5 text-gray-500 mr-2" }), _jsx("input", { type: "number", min: "5", max: "120", value: defaultDuration, onChange: (e) => setDefaultDuration(parseInt(e.target.value) || 30), className: "w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" }), _jsx("span", { className: "ml-2 text-gray-600", children: "seconds" })] })] }), _jsx("div", { className: "flex flex-col items-center", children: _jsx("button", { onClick: handleGeneratePPTX, disabled: questions.length === 0 || processing, className: `py-3 px-8 rounded-md font-medium flex items-center ${questions.length === 0 || processing
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'}`, children: processing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-5 h-5 mr-2 animate-spin" }), "Generating..."] })) : (_jsxs(_Fragment, { children: [_jsx(FileDown, { className: "w-5 h-5 mr-2" }), "Generate OMBEA PowerPoint"] })) }) })] }), status && (_jsxs("div", { className: `rounded-lg p-4 flex items-start ${status.type === 'success' ? 'bg-green-100 text-green-800' :
                            status.type === 'error' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'}`, children: [status.type === 'success' ? (_jsx(CheckCircle, { className: "w-5 h-5 mr-3 flex-shrink-0" })) : status.type === 'error' ? (_jsx(AlertCircle, { className: "w-5 h-5 mr-3 flex-shrink-0" })) : (_jsx(Loader2, { className: "w-5 h-5 mr-3 flex-shrink-0" })), _jsx("p", { children: status.message })] })), questions.length > 0 && (_jsxs("div", { className: "mt-8 bg-white rounded-xl shadow-lg p-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-800 mb-4", children: "Questions Preview" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "#" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Question" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Correct Answer" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Duration" }), _jsx("th", { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Has Image" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: questions.map((q, idx) => (_jsxs("tr", { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50', children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: idx + 1 }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-500", children: q.question.length > 50 ? q.question.substring(0, 50) + '...' : q.question }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: q.correctAnswer ? 'Vrai' : 'Faux' }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: [q.duration || defaultDuration, "s"] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: q.imagePath ? 'Yes' : 'No' })] }, idx))) })] }) })] }))] })] }));
}
export default App;
