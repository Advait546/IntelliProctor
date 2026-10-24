import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Copy, Check, Rocket, Save, ArrowLeft, Eye, PlusCircle, KeyRound } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';
import { errorMessage } from '../../api/client';

export const PublishTestPage = () => {
  const { currentDraft, generateExamCode, publishCurrentExam, saveDraftToServer, resetDraft } = useExam();
  const navigate = useNavigate();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [publishedExam, setPublishedExam] = useState(null);

  const examCode = currentDraft.code || 'AUTO';
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

  const handlePublish = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await publishCurrentExam();
      setPublishedExam(res.exam);
      setIsPublished(true);
    } catch (err) {
      setError(errorMessage(err, 'Publishing failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setError('');
    try {
      await saveDraftToServer();
      navigate('/admin/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Saving failed'));
    } finally {
      setBusy(false);
    }
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
            disabled={isPublished}
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
                <div><span className="text-slate-500">AI Proctoring:</span> <strong className={currentDraft.aiMonitoring ? 'text-emerald-600' : 'text-slate-500'}>{currentDraft.aiMonitoring ? 'Enabled' : 'Off'}</strong></div>
                <div><span className="text-slate-500">Tab Monitoring:</span> <strong className="text-emerald-600">Always on (0 pts)</strong></div>
                <div><span className="text-slate-500">Window:</span> <strong>{currentDraft.availabilityHours || 24} h</strong></div>
                <div><span className="text-slate-500">Negative marking:</span> <strong>{Number(currentDraft.negativeMarking) || 0}</strong></div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center gap-2">
            <KeyRound className="w-10 h-10 text-indigo-600" />
            <span className="text-[11px] font-bold text-slate-600">
              {isPublished ? 'Share the code or link with candidates. The code is stored hashed on the server.' : 'Leave the code as AUTO for a server-generated code, or use Regenerate.'}
            </span>
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">{error}</div>}

        {/* Bottom CTA Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          {isPublished ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/admin/live-monitoring?exam=${publishedExam?.id || ''}`)}
                className="px-5 py-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" /> Monitor Live
              </button>
              <button
                onClick={() => {
                  resetDraft();
                  navigate('/admin/create-test');
                }}
                className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Create Another Exam
              </button>
            </div>
          ) : (
            <button
              onClick={handleSaveDraft}
              disabled={busy}
              className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save as Draft (unpublished)</span>
            </button>
          )}

          <button
            onClick={handlePublish}
            disabled={isPublished || busy}
            className={`px-8 py-4 rounded-2xl font-extrabold text-sm shadow-xl transition-all flex items-center gap-2 ${
              isPublished
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>{isPublished ? 'Examination Published & Live!' : busy ? 'Publishing...' : 'Publish Examination Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
