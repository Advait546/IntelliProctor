import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, ArrowRight, HelpCircle, CheckCircle } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';

export const QuestionCreationPage = () => {
  const { currentDraft, addQuestionToDraft, updateDraftQuestion, deleteDraftQuestion, duplicateDraftQuestion } = useExam();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState(currentDraft.questions);

  const handleFieldChange = (id, field, value) => {
    updateDraftQuestion(id, { [field]: value });
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const handleAddNew = () => {
    const newQ = {
      id: `q-${Date.now()}`,
      type: 'MCQ',
      text: 'New Question Prompt Text',
      optionA: 'Option 1',
      optionB: 'Option 2',
      optionC: 'Option 3',
      optionD: 'Option 4',
      correctAnswer: 'A',
      marks: 2,
      difficulty: 'Medium',
      topic: 'General'
    };
    addQuestionToDraft(newQ);
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleDelete = (id) => {
    deleteDraftQuestion(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleDuplicate = (id) => {
    duplicateDraftQuestion(id);
    const target = questions.find((q) => q.id === id);
    if (target) {
      const duplicated = { ...target, id: `q-${Date.now()}`, text: `${target.text} (Copy)` };
      setQuestions((prev) => [...prev, duplicated]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            Google Forms Style Builder
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Question Creation & Configuration
          </h1>
          <p className="text-xs text-slate-500 font-medium">Add, duplicate, and edit dynamic questions for "{currentDraft.title}"</p>
        </div>

        <button
          onClick={() => navigate('/admin/publish-test')}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
        >
          <span>Publish Test</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Question Forms List */}
      <div className="space-y-6">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all relative border-l-8 border-l-indigo-600"
          >
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                  {index + 1}
                </span>
                <select
                  value={q.type}
                  onChange={(e) => handleFieldChange(q.id, 'type', e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="MCQ">Multiple Choice (MCQ)</option>
                  <option value="TrueFalse">True / False</option>
                  <option value="FillBlank">Fill in the Blank</option>
                  <option value="Subjective">Subjective (AI Auto-Grading Placeholder)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="text-slate-500">Marks:</span>
                  <input
                    type="number"
                    value={q.marks || 2}
                    onChange={(e) => handleFieldChange(q.id, 'marks', parseInt(e.target.value) || 1)}
                    className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-center font-bold"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(q.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Duplicate Question"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Question Prompt</label>
              <textarea
                rows={2}
                value={q.text}
                onChange={(e) => handleFieldChange(q.id, 'text', e.target.value)}
                placeholder="Enter question statement..."
                className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-semibold resize-none"
              />
            </div>

            {/* Options Configuration for MCQ */}
            {q.type === 'MCQ' && (
              <div className="mt-4 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700">Options & Correct Answer Key</label>
                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const fieldName = `option${optKey}`;
                  const isCorrect = q.correctAnswer === optKey;
                  return (
                    <div key={optKey} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleFieldChange(q.id, 'correctAnswer', optKey)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${
                          isCorrect ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                        title={isCorrect ? 'Correct Answer' : 'Click to set as correct answer'}
                      >
                        {optKey}
                      </button>
                      <input
                        type="text"
                        value={q[fieldName] || ''}
                        onChange={(e) => handleFieldChange(q.id, fieldName, e.target.value)}
                        placeholder={`Option ${optKey} text`}
                        className={`flex-1 px-4 py-2.5 rounded-xl border outline-none text-xs font-medium ${
                          isCorrect ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-bold' : 'border-slate-300'
                        }`}
                      />
                      {isCorrect && (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Correct Key
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True / False Selection */}
            {q.type === 'TrueFalse' && (
              <div className="mt-4 flex items-center gap-4">
                <label className="text-xs font-bold text-slate-700">Correct Answer:</label>
                <button
                  type="button"
                  onClick={() => handleFieldChange(q.id, 'correctAnswer', 'A')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    q.correctAnswer === 'A' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  True
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange(q.id, 'correctAnswer', 'B')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    q.correctAnswer === 'B' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  False
                </button>
              </div>
            )}

            {/* Meta Tags */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Difficulty Level</label>
                <select
                  value={q.difficulty || 'Medium'}
                  onChange={(e) => handleFieldChange(q.id, 'difficulty', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-medium"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Topic Tag</label>
                <input
                  type="text"
                  value={q.topic || 'General'}
                  onChange={(e) => handleFieldChange(q.id, 'topic', e.target.value)}
                  placeholder="e.g. Neural Networks"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-medium"
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Add Question CTA & Floating Bar */}
      <div className="pt-4 flex items-center justify-between">
        <button
          onClick={handleAddNew}
          className="px-6 py-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs border border-indigo-200 shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question (Unlimited)</span>
        </button>

        <button
          onClick={() => navigate('/admin/publish-test')}
          className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
        >
          <span>Continue to Publish</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
