import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  QrCode,
  Share2,
  Send,
  Save,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';

const PublishTestPage = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const examCode = "AI2026CS01";
  const shareUrl = `${window.location.origin}/give-test?code=${examCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePublish = () => {
    alert(`Exam ${examCode} is officially published and live for student entry!`);
    navigate('/admin/monitoring');
  };

  const handleSaveDraft = () => {
    alert(`Exam ${examCode} saved to drafts!`);
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="text-center max-w-2xl mx-auto space-y-2 py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Test Configured Successfully!
            </h2>
            <p className="text-xs text-slate-500">
              Review exam credentials and share the access PIN with registered candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Left Card: Exam Summary */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Assessment Summary
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Title:</span>
                  <span className="font-bold text-slate-900">Advanced AI & Neural Networks</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-bold text-slate-900">Computer Science</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Duration:</span>
                  <span className="font-bold text-slate-900">60 Minutes</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Scheduled Date:</span>
                  <span className="font-bold text-slate-900">2026-08-10 at 10:00 AM</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Security Engine:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> YOLO + MediaPipe Enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Right Card: Access PIN & QR Code */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5 text-center flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Unique Exam Code (PIN)
                </span>
                <div className="text-4xl font-mono font-black text-indigo-600 tracking-wider bg-indigo-50/80 py-3 rounded-2xl border border-indigo-200 shadow-inner">
                  {examCode}
                </div>
              </div>

              {/* QR Code Placeholder */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <div className="w-24 h-24 bg-white p-2 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center">
                  <QrCode className="w-20 h-20 text-slate-800" />
                </div>
                <span className="text-[11px] text-slate-400 mt-2">Scan QR to Join on Mobile / Tablet</span>
              </div>

              {/* Copy Share Link */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 transition-colors shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={handleSaveDraft}
              className="px-6 py-3.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save as Draft</span>
            </button>

            <button
              onClick={handlePublish}
              className="px-10 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Send className="w-4 h-4" />
              <span>Publish Assessment</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PublishTestPage;
