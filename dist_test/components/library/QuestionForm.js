import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Image as ImageIconLucide } from 'lucide-react'; // Renamed Image to ImageIconLucide
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea'; // Assuming Textarea is a custom component
import Checkbox from '../ui/Checkbox'; // Assuming Checkbox is a custom component
import { QuestionType, CACESReferential, referentials, questionThemes } from '../../types';
import { addQuestion, updateQuestion, getQuestionById } from '../../db';
import { logger } from '../../utils/logger';
const QuestionForm = ({ onSave, onCancel, questionId }) => {
    const initialQuestionState = {
        text: '',
        type: QuestionType.QCM,
        options: ['', '', '', ''],
        correctAnswer: '',
        timeLimit: 30,
        isEliminatory: false,
        referential: CACESReferential.R489,
        theme: QuestionTheme.Rules,
        image: undefined,
        createdAt: new Date().toISOString(),
        usageCount: 0,
        correctResponseRate: 0
    };
    const [question, setQuestion] = useState(initialQuestionState);
    const [hasImage, setHasImage] = useState(false);
    const [imageFile, setImageFile] = useState(null); // Changed to Blob | null
    const [imagePreview, setImagePreview] = useState(null);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const referentialOptions = Object.entries(referentials).map(([value, label]) => ({
        value,
        label: `${value} - ${label}`,
    }));
    const themeOptions = Object.entries(questionThemes).map(([value, label]) => ({
        value,
        label
    }));
    useEffect(() => {
        if (questionId) {
            setIsLoading(true);
            const fetchQuestion = async () => {
                try {
                    const existingQuestion = await getQuestionById(questionId);
                    if (existingQuestion) {
                        setQuestion(existingQuestion);
                        if (existingQuestion.image instanceof Blob) {
                            setHasImage(true);
                            setImageFile(existingQuestion.image);
                            setImagePreview(URL.createObjectURL(existingQuestion.image));
                        }
                        else {
                            setHasImage(false);
                            setImageFile(null);
                            setImagePreview(null);
                        }
                    }
                    else {
                        logger.error(`Question with id ${questionId} not found.`);
                    }
                }
                catch (error) {
                    logger.error("Error fetching question: ", error);
                }
                finally {
                    setIsLoading(false);
                }
            };
            fetchQuestion();
        }
    }, [questionId]);
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setQuestion(prev => ({ ...prev, [name]: name === 'timeLimit' ? parseInt(value, 10) : value }));
    };
    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        if (name === 'isEliminatory') {
            setQuestion(prev => ({ ...prev, [name]: checked }));
        }
        else if (name === 'hasImageToggle') {
            setHasImage(checked);
            if (!checked) {
                setImageFile(null);
                setImagePreview(null);
                setQuestion(prev => ({ ...prev, image: undefined }));
            }
        }
    };
    const handleOptionChange = (index, value) => {
        const newOptions = [...(question.options || [])];
        newOptions[index] = value;
        setQuestion(prev => ({ ...prev, options: newOptions }));
    };
    const addOption = () => {
        if ((question.options?.length || 0) < 4) {
            setQuestion(prev => ({ ...prev, options: [...(prev.options || []), ''] }));
        }
    };
    const removeOption = (index) => {
        if ((question.options?.length || 0) > 2) {
            const newOptions = (question.options || []).filter((_, i) => i !== index);
            setQuestion(prev => ({ ...prev, options: newOptions }));
            // Ensure correctAnswer is still valid
            if (Number(question.correctAnswer) === index) {
                setQuestion(prev => ({ ...prev, correctAnswer: '0' })); // Default to first option or handle as needed
            }
            else if (Number(question.correctAnswer) > index) {
                setQuestion(prev => ({ ...prev, correctAnswer: (Number(prev.correctAnswer) - 1).toString() }));
            }
        }
    };
    const handleImageUpload = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file); // Store as File, will be converted to Blob on save
            setImagePreview(URL.createObjectURL(file));
        }
    };
    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setHasImage(false);
        const fileInput = document.getElementById('image-upload');
        if (fileInput) {
            fileInput.value = "";
        }
    };
    const validateForm = () => {
        const newErrors = {};
        if (!question.text.trim())
            newErrors.text = 'Le texte de la question est requis.';
        if (question.type === QuestionType.QCM || question.type === QuestionType.QCU) {
            if (!question.options || question.options.length < 2 || question.options.some(opt => !(opt || "").trim())) {
                newErrors.options = 'Au moins deux options sont requises et toutes les options doivent être remplies.';
            }
            if (!question.correctAnswer.trim()) {
                newErrors.correctAnswer = 'La réponse correcte est requise.';
            }
            else if (question.options && !question.options.includes(question.correctAnswer) && !question.options.map((_, idx) => idx.toString()).includes(question.correctAnswer)) {
                // Check if correctAnswer is an index or the text of an option
                const correctIndex = parseInt(question.correctAnswer, 10);
                if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= (question.options?.length || 0) || !question.options[correctIndex]) {
                    newErrors.correctAnswer = 'La réponse correcte doit être l\'une des options valides.';
                }
            }
        }
        if (question.timeLimit <= 0)
            newErrors.timeLimit = 'Le temps limite doit être positif.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSave = async () => {
        if (!validateForm()) {
            logger.warning('Validation échouée', errors);
            return;
        }
        let imageToSave = undefined;
        if (hasImage && imageFile) {
            imageToSave = imageFile instanceof File ? new Blob([imageFile], { type: imageFile.type }) : imageFile;
        }
        const questionData = {
            ...question,
            image: imageToSave,
            options: question.options?.map(opt => opt.toString()) || [], // Ensure options are strings
            createdAt: question.createdAt || new Date().toISOString(),
            // Ensure correctAnswer is stored as string (option text)
            correctAnswer: question.options?.[parseInt(question.correctAnswer, 10)] || question.correctAnswer,
        };
        try {
            setIsLoading(true);
            if (questionId) {
                await updateQuestion(questionId, questionData);
                logger.success('Question modifiée avec succès');
            }
            else {
                const newId = await addQuestion(questionData);
                logger.success(`Question créée avec succès avec l'ID: ${newId}`);
                // If you need to use the new ID in the parent, include it in questionData
                if (newId)
                    questionData.id = newId;
            }
            onSave(questionData);
        }
        catch (error) {
            logger.error("Error saving question: ", error);
        }
        finally {
            setIsLoading(false);
        }
    };
    if (isLoading && questionId) { // Only show loading if fetching existing question
        return _jsx("div", { children: "Chargement de la question..." });
    }
    return (_jsxs("div", { children: [_jsxs(Card, { title: "Informations g\u00E9n\u00E9rales", className: "mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsx(Select, { label: "Recommandation CACES", options: referentialOptions, value: question.referential, onChange: (e) => setQuestion(prev => ({ ...prev, referential: e.target.value })), placeholder: "S\u00E9lectionner une recommandation", required: true }), _jsx(Select, { label: "Th\u00E8me", options: themeOptions, value: question.theme, onChange: (e) => setQuestion(prev => ({ ...prev, theme: e.target.value })), placeholder: "S\u00E9lectionner un th\u00E8me", required: true })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mt-4", children: [_jsx(Input, { label: "Temps limite (secondes)", type: "number", name: "timeLimit" // Added name for handleInputChange
                                , value: question.timeLimit, onChange: handleInputChange, min: 5, max: 120 }), _jsx("div", { className: "flex items-center space-x-4 mt-6", children: _jsx(Checkbox, { label: "Question \u00E9liminatoire", name: "isEliminatory", checked: question.isEliminatory, onChange: handleCheckboxChange }) })] })] }), _jsxs(Card, { title: "Contenu de la question", className: "mb-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Texte de la question *" }), _jsx(Textarea // Changed from textarea to Textarea component
                            , { name: "text" // Added name for handleInputChange
                                , rows: 4, value: question.text, onChange: (e) => handleInputChange(e), className: "block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm", placeholder: "Entrez le texte de la question...", required: true }), errors.text && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.text })] }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Image associ\u00E9e (optionnel)" }), _jsx(Checkbox, { label: "Ajouter une image", name: "hasImageToggle", checked: hasImage, onChange: handleCheckboxChange })] }), hasImage && (_jsx("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: _jsxs("div", { className: "text-center", children: [_jsx(ImageIconLucide, { className: "mx-auto h-12 w-12 text-gray-400" }), _jsxs("div", { className: "mt-4", children: [_jsxs("label", { htmlFor: "image-upload", className: "cursor-pointer", children: [_jsx("span", { className: "mt-2 block text-sm font-medium text-gray-900", children: imagePreview ? "Changer l'image" : "Sélectionner une image" }), _jsx("input", { id: "image-upload", type: "file", accept: "image/*", onChange: handleImageUpload, className: "sr-only" })] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "PNG, JPG, GIF jusqu'\u00E0 10MB" })] }), imagePreview && (_jsxs("div", { className: "mt-2 relative group inline-block", children: [_jsx("img", { src: imagePreview, alt: "Pr\u00E9visualisation", className: "max-h-40 rounded" }), _jsx(Button, { variant: "danger", size: "sm", className: "absolute top-1 right-1 opacity-0 group-hover:opacity-100", onClick: removeImage, children: _jsx(Trash2, { size: 16 }) })] }))] }) }))] })] }), _jsxs(Card, { title: "Options de r\u00E9ponse", className: "mb-6", children: [_jsxs("div", { className: "space-y-4", children: [(question.options || []).map((option, index) => (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("input", { type: "radio", name: "correctAnswer", value: index.toString(), checked: question.correctAnswer === index.toString() || question.correctAnswer === option, onChange: (e) => setQuestion(prev => ({ ...prev, correctAnswer: e.target.value })), className: "h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" }) }), _jsx("div", { className: "flex-1", children: _jsx(Input, { placeholder: `Option ${String.fromCharCode(65 + index)}`, value: option, onChange: (e) => handleOptionChange(index, e.target.value), className: "mb-0" }) }), _jsx("div", { className: "flex-shrink-0", children: (question.options?.length || 0) > 2 && (_jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash2, { size: 16 }), onClick: () => removeOption(index) })) })] }, index))), errors.options && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.options }), errors.correctAnswer && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.correctAnswer })] }), (question.options?.length || 0) < 4 && (_jsx("div", { className: "mt-4", children: _jsx(Button, { variant: "outline", icon: _jsx(Plus, { size: 16 }), onClick: handleAddOption, children: "Ajouter une option" }) })), _jsx("div", { className: "mt-4 p-3 bg-blue-50 rounded-lg", children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "R\u00E9ponse correcte :" }), " Option ", String.fromCharCode(65 + parseInt(question.correctAnswer, 10))] }) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(Button, { variant: "outline", onClick: onCancel, type: "button", children: "Annuler" }), _jsx(Button, { variant: "primary", icon: _jsx(Save, { size: 16 }), onClick: handleSave, type: "button", disabled: isLoading, children: isLoading ? 'Sauvegarde...' : (questionId ? 'Modifier la question' : 'Créer la question') })] })] }));
};
export default QuestionForm;
