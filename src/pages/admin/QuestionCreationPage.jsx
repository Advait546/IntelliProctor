import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Save
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import { questionService } from '../../services/questionService';

const QuestionCreationPage = () => {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([
    {
      id: "q-1",
      type: "MCQ",
      text: "Which layer in a Convolutional Neural Network (CNN) performs spatial downsampling of feature maps?",
      options: [
        "Convolutional Layer",
        "Max Pooling Layer",
        "Fully Connected Layer",
        "Batch Normalization Layer"
      ],
      correctAnswer: "Max Pooling Layer",
      marks: 2,
      difficulty: "Medium",
      topic: "Neural Networks"
    },
    {
      id: "q-2",
      type: "True/False",
      text: "YOLO (You Only Look Once) frames object detection as a single regression problem directly from image pixels to bounding box coordinates.",
      options: ["True", "False"],
      correctAnswer: "True",
      marks: 1,
      difficulty: "Easy",
      topic: "Computer Vision"
    }
  ]);

  const addQuestion = () => {
    const newQ = {
      id: `q-${Date.now()}`,
      type: "MCQ",
      text: "",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
      marks: 2,
      difficulty: "Medium",
      topic: "General"
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const prevOpt = updated[qIndex].options[optIndex];
    updated[qIndex].options[optIndex] = value;
    // If the changed option was the selected correct answer, keep correct answer updated
    if (updated[qIndex].correctAnswer === prevOpt) {
      updated[qIndex].correctAnswer = value;
    }
    setQuestions(updated);
  };

  const duplicateQuestion = (index) => {
    const qToCopy = questions[index];
    const copy = {
      ...qToCopy,
      id: `q-${Date.now()}`,
      text: `${qToCopy.text} (Copy)`
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, copy);
    setQuestions(updated);
  };

  const deleteQuestion = (index) => {
    if (questions.length === 1) {
      alert("At least one question is required for the exam!");
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleSaveAndPublish = async () => {
    // Validate empty question texts
    const emptyCount = questions.filter(q => !q.text.trim()).length;
    if (emptyCount > 0) {
      alert("Please enter question text for all added questions before publishing.");
      return;
    }

    // Save to mock repository & draft
    for (const q of questions) {
      await questionService.saveQuestion(q);
    }
    localStorage.setItem('created_questions_list', JSON.stringify(questions));

    navigate('/admin/publish-test');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <HelpCircle className="w-7 h-7 text-indigo-600" />
                Google Forms-Style Question Creation
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Add, edit, duplicate, and assign marks to questions dynamically.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 bg-white border px-3.5 py-2 rounded-xl">
                Total Questions: {questions.length}
              </span>
              <button
                onClick={handleSaveAndPublish}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                <span>Save & Continue to Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dynamic Question List */}
          <div className="space-y-6">
            <AnimatePresence>
              {questions.map((q, qIdx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 border-2 border-slate-200 focus-within:border-indigo-500/80 shadow-xs hover:shadow-md transition-all relative space-y-5"
                >
                  {/* Top Bar inside Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-sm flex items-center justify-center">
                        Q{qIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-400">Question Item</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Question Type Selector */}
                      <select
                        value={q.type}
                        onChange={(e) => updateQuestion(qIdx, "type", e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="MCQ">Multiple Choice (MCQ)</option>
                        <option value="True/False">True / False</option>
                        <option value="Fill in the Blank">Fill in the Blank</option>
                        <option value="Subjective">Subjective (AI Auto-Graded Placeholder)</option>
                      </select>

                      {/* Marks */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-500">Marks:</span>
                        <input
                          type="number"
                          value={q.marks}
                          onChange={(e) => updateQuestion(qIdx, "marks", e.target.value)}
                          className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                        />
                      </div>

                      {/* Difficulty */}
                      <select
                        value={q.difficulty}
                        onChange={(e) => updateQuestion(qIdx, "difficulty", e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Question Description *
                    </label>
                    <textarea
                      rows={2}
                      value={q.text}
                      onChange={(e) => updateQuestion(qIdx, "text", e.target.value)}
                      placeholder="Type your question statement here..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>

                  {/* Options rendering depending on Question Type */}
                  {q.type === "MCQ" && (
                    <div className="space-y-3 pl-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Options & Correct Answer Selection:
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correctAnswer === opt;
                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/30'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => updateQuestion(qIdx, "correctAnswer", opt)}
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isCorrect ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 bg-white'
                                }`}
                                title="Mark as correct answer"
                              >
                                {isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                                className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {q.type === "True/False" && (
                    <div className="flex items-center gap-4 pl-2">
                      <span className="text-xs font-bold text-slate-700">Select Correct Answer:</span>
                      {["True", "False"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateQuestion(qIdx, "correctAnswer", val)}
                          className={`px-5 py-2 rounded-xl text-xs font-bold border transition-all ${
                            q.correctAnswer === val
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === "Fill in the Blank" && (
                    <div className="pl-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Expected Blank Answer Key *
                      </label>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(qIdx, "correctAnswer", e.target.value)}
                        placeholder="e.g. attention"
                        className="w-full max-w-md px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                  )}

                  {q.type === "Subjective" && (
                    <div className="pl-2 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900">
                      <span className="font-bold">Subjective Response Placeholder:</span> Candidates will be presented with an open text area. AI evaluation model will grade response after submission.
                    </div>
                  )}

                  {/* Card Bottom Toolbar */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">Topic Tag:</span>
                      <input
                        type="text"
                        value={q.topic}
                        onChange={(e) => updateQuestion(qIdx, "topic", e.target.value)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                        placeholder="e.g. Computer Vision"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateQuestion(qIdx)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplicate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteQuestion(qIdx)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add Question Button */}
          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={addQuestion}
              className="px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span>Add Question (Unlimited)</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default QuestionCreationPage;
