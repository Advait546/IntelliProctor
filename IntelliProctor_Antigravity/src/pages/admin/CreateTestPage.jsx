import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Clock, Calendar, ShieldCheck, Lock, Mic, Maximize, ArrowRight, FilePlus, Upload, Database } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';

export const CreateTestPage = () => {
  const { currentDraft, updateDraft } = useExam();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(currentDraft);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateDraft(formData);
    if (formData.questionSource === 'csv') {
      navigate('/admin/question-bank');
    } else {
      navigate('/admin/question-creation');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Examination</h1>
            <p className="text-xs text-slate-500 font-medium">Configure exam rules, timing, and AI proctoring parameters</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          
          {/* General Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">1. General Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Test Name *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. AI & Computer Science Fundamentals 2026"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Department *</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="e.g. Artificial Intelligence"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    min={5}
                    max={360}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Schedule Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="date"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Schedule Time</label>
                <input
                  type="text"
                  name="scheduledTime"
                  value={formData.scheduledTime}
                  onChange={handleChange}
                  placeholder="10:00 AM"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Instructions for Candidates</label>
              <textarea
                rows={3}
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                placeholder="Enter rules and candidate instructions..."
                className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium resize-none"
              />
            </div>
          </div>

          {/* Marking & Security Settings */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">2. Scoring & Security Toggles</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Negative Marking</label>
                <select
                  name="negativeMarking"
                  value={formData.negativeMarking}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium bg-white"
                >
                  <option value={0}>No Negative Marking (0.0)</option>
                  <option value={0.25}>0.25 Marks Per Wrong Answer</option>
                  <option value={0.5}>0.50 Marks Per Wrong Answer</option>
                  <option value={1.0}>1.00 Mark Per Wrong Answer</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="shuffleQuestions"
                  name="shuffleQuestions"
                  checked={formData.shuffleQuestions}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="shuffleQuestions" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Shuffle Questions
                </label>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="shuffleOptions"
                  name="shuffleOptions"
                  checked={formData.shuffleOptions}
                  onChange={handleChange}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="shuffleOptions" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Shuffle MCQ Options
                </label>
              </div>
            </div>

            {/* AI Security Toggles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enable AI Monitoring</div>
                    <div className="text-[10px] text-slate-500">YOLO + MediaPipe live computer vision</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="aiMonitoring"
                  checked={formData.aiMonitoring}
                  onChange={handleChange}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enable Browser Lock</div>
                    <div className="text-[10px] text-slate-500">Detect tab switching and window blur</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="browserLock"
                  checked={formData.browserLock}
                  onChange={handleChange}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enable Audio Monitoring</div>
                    <div className="text-[10px] text-slate-500">Acoustic background voice spike detection</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="audioMonitoring"
                  checked={formData.audioMonitoring}
                  onChange={handleChange}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <Maximize className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enable Fullscreen Lock</div>
                    <div className="text-[10px] text-slate-500">Enforce browser fullscreen mode</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  name="fullscreenLock"
                  checked={formData.fullscreenLock}
                  onChange={handleChange}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Question Source Options */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">3. Question Source</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label
                className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  formData.questionSource === 'manual'
                    ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <FilePlus className="w-6 h-6 text-indigo-600" />
                  <input
                    type="radio"
                    name="questionSource"
                    value="manual"
                    checked={formData.questionSource === 'manual'}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Create Questions Manually</div>
                  <div className="text-xs text-slate-500 mt-0.5">Google Forms style builder</div>
                </div>
              </label>

              <label
                className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  formData.questionSource === 'csv'
                    ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Upload className="w-6 h-6 text-indigo-600" />
                  <input
                    type="radio"
                    name="questionSource"
                    value="csv"
                    checked={formData.questionSource === 'csv'}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Upload CSV File</div>
                  <div className="text-xs text-slate-500 mt-0.5">Bulk import question sheet</div>
                </div>
              </label>

              <label
                className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  formData.questionSource === 'bank'
                    ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Database className="w-6 h-6 text-indigo-600" />
                  <input
                    type="radio"
                    name="questionSource"
                    value="bank"
                    checked={formData.questionSource === 'bank'}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Choose Existing Set</div>
                  <div className="text-xs text-slate-500 mt-0.5">Select from repository</div>
                </div>
              </label>
            </div>
          </div>

          {/* Continue Button */}
          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <span>Continue to Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
