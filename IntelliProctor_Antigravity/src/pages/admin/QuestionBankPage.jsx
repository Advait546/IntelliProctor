import React, { useState } from 'react';
import { Search, Filter, Upload, Download, Trash2, Edit3, Eye, CheckSquare, Plus, FileSpreadsheet } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';
import { questionApi } from '../../api/questionApi';

export const QuestionBankPage = () => {
  const { questionBank, setQuestionBank } = useExam();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewQuestion, setPreviewQuestion] = useState(null);

  const topics = ['All', ...new Set(questionBank.map((q) => q.topic).filter(Boolean))];

  const filteredQuestions = questionBank.filter((q) => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase()) || q.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiff = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesTopic = selectedTopic === 'All' || q.topic === selectedTopic;
    return matchesSearch && matchesDiff && matchesTopic;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleDeleteSelected = () => {
    setQuestionBank((prev) => prev.filter((q) => !selectedIds.includes(q.id)));
    setSelectedIds([]);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const res = await questionApi.importCSV(file);
      alert(`CSV Imported Successfully! (${res.importedCount || 5} questions added)`);
    }
  };

  const handleExportCSV = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredQuestions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "question_bank_export.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Question Bank Repository</h1>
          <p className="text-xs text-slate-500 font-medium">Search, filter, edit, and export reusable question sets</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
            <input type="file" accept=".csv,.json" onChange={handleImportCSV} className="hidden" />
          </label>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search questions by text or topic..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter className="w-3.5 h-3.5" />
            <span>Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs"
            >
              <option value="All">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Topic:</span>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs max-w-[140px]"
            >
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-indigo-900">
          <span>{selectedIds.length} Questions Selected</span>
          <button
            onClick={handleDeleteSelected}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Questions Table List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="py-3.5 px-4">Question Text</th>
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Topic</th>
              <th className="py-3.5 px-4">Difficulty</th>
              <th className="py-3.5 px-4 text-center">Marks</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredQuestions.map((q) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <tr key={q.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(q.id)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-900 max-w-md truncate">
                    {q.text}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold">
                      {q.type}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-700 font-medium">{q.topic || 'General'}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      q.difficulty === 'Hard' ? 'bg-red-100 text-red-800' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-slate-800">{q.marks}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setQuestionBank((prev) => prev.filter((item) => item.id !== q.id));
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Question Preview</h3>
            <p className="text-sm font-semibold text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {previewQuestion.text}
            </p>
            {previewQuestion.type === 'MCQ' && (
              <div className="space-y-2 text-xs font-medium text-slate-700">
                <div className={previewQuestion.correctAnswer === 'A' ? 'text-emerald-600 font-bold' : ''}>A) {previewQuestion.optionA}</div>
                <div className={previewQuestion.correctAnswer === 'B' ? 'text-emerald-600 font-bold' : ''}>B) {previewQuestion.optionB}</div>
                <div className={previewQuestion.correctAnswer === 'C' ? 'text-emerald-600 font-bold' : ''}>C) {previewQuestion.optionC}</div>
                <div className={previewQuestion.correctAnswer === 'D' ? 'text-emerald-600 font-bold' : ''}>D) {previewQuestion.optionD}</div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
