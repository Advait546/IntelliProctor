import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Copy, Check, QrCode, Rocket, Save, ShieldCheck, Clock, HelpCircle, ArrowLeft } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';

export const PublishTestPage = () => {
  const { currentDraft, generateExamCode, publishCurrentExam } = useExam();
  const navigate = useNavigate();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const examCode = currentDraft.code || 'AI2026CS01';
  const shareUrl = `${window.location.origin}/student/join?code=${examCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(examCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePublish = () => {
    publishCurrentExam();
    setIsPublished(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/create-test')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Test Setup
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {isPublished ? 'PUBLISHED & LIVE' : 'DRAFT READY TO PUBLISH'}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Publish & Share Examination
            </h1>
            <p className="text-xs text-slate-500 font-medium">Generate student access PIN and share join links</p>
          </div>

          <button
            onClick={() => generateExamCode()}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border border-indigo-200 transition-colors"
          >
            Regenerate Code
          </button>
        </div>

        {/* Unique Exam Code Banner (Kahoot Inspired) */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden">
          <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Unique Candidate Exam Code</div>

          <div className="mt-4 inline-flex items-center justify-center gap-4 bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20">
            <span className="text-4xl sm:text-5xl font-mono font-extrabold tracking-widest text-emerald-400">
              {examCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-3 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6" />}
            </button>
          </div>

          {copiedCode && <div className="mt-2 text-xs font-semibold text-emerald-300">Code Copied to Clipboard!</div>}
        </div>

        {/* Share Link & QR Code Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
          <div className="sm:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Direct Shareable Student Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono text-slate-700 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-colors flex items-center gap-1.5"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Test Summary Specs */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Examination Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div><span className="text-slate-500">Title:</span> <strong>{currentDraft.title}</strong></div>
                <div><span className="text-slate-500">Subject:</span> <strong>{currentDraft.subject}</strong></div>
                <div><span className="text-slate-500">Duration:</span> <strong>{currentDraft.duration} mins</strong></div>
                <div><span className="text-slate-500">Questions:</span> <strong>{currentDraft.questions.length} Total</strong></div>
                <div><span className="text-slate-500">AI Proctoring:</span> <strong className="text-emerald-600">Enabled</strong></div>
                <div><span className="text-slate-500">Browser Lock:</span> <strong className="text-emerald-600">Active</strong></div>
              </div>
            </div>
          </div>

          {/* QR Code Placeholder Component */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
            <div className="w-32 h-32 rounded-xl bg-white p-3 border border-slate-300 shadow-sm flex items-center justify-center">
              {/* Simulated SVG QR Code */}
              <div className="w-full h-full bg-slate-900 p-2 grid grid-cols-5 gap-1 rounded-lg">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`rounded-xs ${i % 2 === 0 || i % 3 === 0 ? 'bg-white' : 'bg-slate-900'}`}></div>
                ))}
              </div>
            </div>
            <span className="mt-3 text-[11px] font-bold text-slate-600">Scan QR Code to Join</span>
          </div>
        </div>

        {/* Bottom CTA Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => { alert("Draft Saved Successfully!"); navigate('/admin/dashboard'); }}
            className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublished}
            className={`px-8 py-4 rounded-2xl font-extrabold text-sm shadow-xl transition-all flex items-center gap-2 ${
              isPublished
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>{isPublished ? 'Examination Published & Live!' : 'Publish Examination Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
