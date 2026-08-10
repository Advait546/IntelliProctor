import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  FilePlus,
  Clock,
  ShieldCheck,
  CheckCircle,
  Upload,
  BookOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import { examService } from '../../services/examService';

const CreateTestPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      title: "Advanced Computer Vision & Neural Networks",
      subject: "Computer Science",
      duration: 60,
      instructions: "Ensure your camera and microphone remain active throughout the test. Tab switching or phone usage will trigger immediate security flags.",
      negativeMarking: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      enableAIMonitoring: true,
      enableBrowserLock: true,
      enableAudioMonitoring: true,
      enableFullscreenLock: true,
      scheduledDate: "2026-08-10",
      scheduledTime: "10:00",
      questionSource: "manual" // manual, csv, existing
    }
  });

  const questionSource = watch("questionSource");

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const created = await examService.createExam(data);
      // Store current draft in localStorage for Question Creation page
      localStorage.setItem('current_test_draft', JSON.stringify(created));
      
      if (data.questionSource === "manual") {
        navigate('/admin/create-questions');
      } else if (data.questionSource === "existing") {
        navigate('/admin/question-bank');
      } else {
        navigate('/admin/create-questions');
      }
    } catch (err) {
      alert("Error saving test configuration: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <FilePlus className="w-7 h-7 text-indigo-600" />
                Create New Examination
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure test parameters, AI proctoring rules, and scheduled dates.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200">
              Step 1 of 3: General Setup
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Basic Information */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                1. Test Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Test Name *
                  </label>
                  <input
                    type="text"
                    {...register("title", { required: "Test name is required" })}
                    placeholder="e.g. Midterm Machine Learning Exam"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subject / Domain *
                  </label>
                  <input
                    type="text"
                    {...register("subject", { required: "Subject is required" })}
                    placeholder="e.g. Computer Science"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    {...register("duration", { required: "Duration is required", min: 5 })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Schedule Date
                    </label>
                    <input
                      type="date"
                      {...register("scheduledDate")}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Schedule Time
                    </label>
                    <input
                      type="time"
                      {...register("scheduledTime")}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Examination Instructions
                </label>
                <textarea
                  rows={3}
                  {...register("instructions")}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  placeholder="Enter detailed rules visible to students prior to exam start..."
                />
              </div>
            </div>

            {/* Section 2: AI & Security Configuration */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                2. AI Proctoring & Security Rules
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-indigo-50/50 transition-colors">
                  <input
                    type="checkbox"
                    {...register("negativeMarking")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Negative Marking</span>
                    <span className="text-[11px] text-slate-500">Deduct 0.25 marks per wrong answer</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-indigo-50/50 transition-colors">
                  <input
                    type="checkbox"
                    {...register("shuffleQuestions")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Shuffle Questions</span>
                    <span className="text-[11px] text-slate-500">Randomize question sequence</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-indigo-50/50 transition-colors">
                  <input
                    type="checkbox"
                    {...register("shuffleOptions")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Shuffle Options</span>
                    <span className="text-[11px] text-slate-500">Randomize MCQ choices</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("enableAIMonitoring")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-indigo-900">Enable AI Monitoring</span>
                    <span className="text-[11px] text-indigo-700">YOLO object & MediaPipe face tracking</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("enableBrowserLock")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-indigo-900">Enable Browser Lock</span>
                    <span className="text-[11px] text-indigo-700">Detect tab switching and window blur</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("enableFullscreenLock")}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-indigo-900">Enable Fullscreen Lock</span>
                    <span className="text-[11px] text-indigo-700">Force browser into fullscreen mode</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 3: Question Source Selection */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                3. Question Source
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    questionSource === "manual"
                      ? "border-indigo-600 bg-indigo-50/50 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="radio"
                        value="manual"
                        {...register("questionSource")}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="block font-bold text-sm text-slate-900 mb-1">
                      Create Questions Manually
                    </span>
                    <span className="text-xs text-slate-500 leading-snug">
                      Google Forms-style interactive builder for MCQ, T/F & Fill-in-blanks.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    questionSource === "csv"
                      ? "border-indigo-600 bg-indigo-50/50 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="radio"
                        value="csv"
                        {...register("questionSource")}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="block font-bold text-sm text-slate-900 mb-1">
                      Upload CSV File
                    </span>
                    <span className="text-xs text-slate-500 leading-snug">
                      Bulk import formatted spreadsheet with questions and answer keys.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    questionSource === "existing"
                      ? "border-indigo-600 bg-indigo-50/50 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="radio"
                        value="existing"
                        {...register("questionSource")}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="block font-bold text-sm text-slate-900 mb-1">
                      Choose Existing Question Set
                    </span>
                    <span className="text-xs text-slate-500 leading-snug">
                      Select pre-approved questions from your saved question repository.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                <span>Continue to Question Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default CreateTestPage;
