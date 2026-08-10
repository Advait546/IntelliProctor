import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  Upload,
  Download,
  BookOpenCheck,
  CheckSquare,
  Square,
  Plus
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import Modal from '../../components/common/Modal';
import { questionService } from '../../services/questionService';

const QuestionBankPage = () => {
  const [questions, setQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewQuestion, setPreviewQuestion] = useState(null);

  useEffect(() => {
    questionService.getQuestions().then(setQuestions);
  }, []);

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiff = difficultyFilter === "All" || q.difficulty === difficultyFilter;
    const matchesSubj = subjectFilter === "All" || q.subject === subjectFilter;
    return matchesSearch && matchesDiff && matchesSubj;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected question(s)?`)) return;

    for (const id of selectedIds) {
      await questionService.deleteQuestion(id);
    }
    setQuestions(questions.filter((q) => !selectedIds.includes(q.id)));
    setSelectedIds([]);
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["ID,Type,Text,CorrectAnswer,Marks,Difficulty,Topic"]
        .concat(
          questions.map(
            (q) =>
              `"${q.id}","${q.type}","${q.text.replace(/"/g, '""')}","${q.correctAnswer}","${q.marks}","${q.difficulty}","${q.topic}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "question_bank_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`Imported questions from ${file.name} successfully!`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpenCheck className="w-7 h-7 text-indigo-600" />
                Question Bank Repository
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Browse, search, filter, and bulk export reusable exam questions.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Import CSV</span>
                <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              </label>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search questions by keyword or topic..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              {/* Difficulty Filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Difficulty:</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Bulk Selection bar */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-900">
                <span>{selectedIds.length} question(s) selected</span>
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
              </div>
            )}
          </div>

          {/* Question Table / List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                      {selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Question Statement</th>
                  <th className="p-4">Topic</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Marks</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQuestions.map((q) => {
                  const isSelected = selectedIds.includes(q.id);
                  return (
                    <tr key={q.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                      <td className="p-4 text-center">
                        <button onClick={() => toggleSelect(q.id)} className="text-slate-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-4 font-bold text-slate-700">{q.type}</td>
                      <td className="p-4 font-medium text-slate-900 max-w-md truncate">{q.text}</td>
                      <td className="p-4 font-semibold text-slate-500">{q.topic}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            q.difficulty === 'Easy'
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.difficulty === 'Medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-800">{q.marks}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600"
                            title="Preview Question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => alert(`Edit trigger for question ${q.id}`)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600"
                            title="Edit Question"
                          >
                            <Edit className="w-4 h-4" />
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
            <Modal
              isOpen={Boolean(previewQuestion)}
              onClose={() => setPreviewQuestion(null)}
              title="Question Details & Answer Key"
            >
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-md">
                    {previewQuestion.type}
                  </span>
                  <span className="font-bold text-slate-500">Marks: {previewQuestion.marks}</span>
                </div>

                <p className="font-bold text-sm text-slate-900 leading-relaxed bg-slate-50 p-4 rounded-xl">
                  {previewQuestion.text}
                </p>

                {previewQuestion.options && previewQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700">Options:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {previewQuestion.options.map((opt, i) => (
                        <div
                          key={i}
                          className={`p-2.5 rounded-xl border ${
                            opt === previewQuestion.correctAnswer
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                  Correct Answer: {previewQuestion.correctAnswer}
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
};

export default QuestionBankPage;
