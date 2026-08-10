import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileSpreadsheet,
  Download,
  Eye,
  Search,
  CheckCircle2,
  AlertTriangle,
  BarChart2,
  Users,
  Percent
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import Modal from '../../components/common/Modal';
import RiskBadge from '../../components/common/RiskBadge';
import { reportService } from '../../services/reportService';

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    reportService.getReports().then(setReports);
  }, []);

  const handleDownload = async (id, title) => {
    setDownloadingId(id);
    await reportService.downloadReportPdf(id);
    setTimeout(() => {
      setDownloadingId(null);
      alert(`Report for "${title}" downloaded successfully!`);
    }, 1200);
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
                <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
                Exam Analytics & Security Reports
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                View candidate completion rates, score distribution, and AI incident records.
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Exam Name</th>
                  <th className="p-4">Exam Code</th>
                  <th className="p-4">Candidates</th>
                  <th className="p-4">Average Score</th>
                  <th className="p-4">Avg Risk Score</th>
                  <th className="p-4">Completion Rate</th>
                  <th className="p-4 text-right">Download Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {reports.map((rep) => (
                  <tr
                    key={rep.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedReport(rep)}
                  >
                    <td className="p-4 font-bold text-slate-900">{rep.examTitle}</td>
                    <td className="p-4 font-mono font-bold text-indigo-600">{rep.examCode}</td>
                    <td className="p-4 font-semibold text-slate-700">{rep.totalStudents} Students</td>
                    <td className="p-4 font-bold text-slate-800">{rep.avgScore}</td>
                    <td className="p-4">
                      <RiskBadge score={parseInt(rep.avgRiskScore)} />
                    </td>
                    <td className="p-4 font-bold text-emerald-600">{rep.completionRate}</td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDownload(rep.id, rep.examTitle)}
                        disabled={downloadingId === rep.id}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadingId === rep.id ? "Exporting..." : "Download"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Analytics Modal */}
          {selectedReport && (
            <Modal
              isOpen={Boolean(selectedReport)}
              onClose={() => setSelectedReport(null)}
              title={`Analytics: ${selectedReport.examTitle}`}
            >
              <div className="space-y-6 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">Avg Score</span>
                    <p className="text-xl font-black text-indigo-900 mt-1">{selectedReport.avgScore}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                    <span className="text-[10px] font-bold text-amber-500 uppercase">Flagged Candidates</span>
                    <p className="text-xl font-black text-amber-900 mt-1">{selectedReport.flaggedStudents}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Completion Rate</span>
                    <p className="text-xl font-black text-emerald-900 mt-1">{selectedReport.completionRate}</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-2">Proctoring AI Summary</h4>
                  <p className="text-slate-600 leading-relaxed">
                    YOLO object detection logged 3 mobile phone flags and 1 book detection incident.
                    MediaPipe gaze vector tracking averaged 94% screen focus consistency across candidates.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleDownload(selectedReport.id, selectedReport.examTitle)}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Executive PDF</span>
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReportsPage;
