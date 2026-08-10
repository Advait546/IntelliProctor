import React, { useState } from 'react';
import { Download, FileText, BarChart2, Eye, ShieldAlert, Award, Users } from 'lucide-react';
import { MOCK_REPORTS } from '../../constants/mockData';
import { reportApi } from '../../api/reportApi';

export const ReportsPage = () => {
  const [reports] = useState(MOCK_REPORTS);
  const [activeModalReport, setActiveModalReport] = useState(null);

  const handleDownload = async (id, name) => {
    await reportApi.downloadReportCSV(id);
    alert(`Report for "${name}" downloaded successfully (CSV/PDF summary format).`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Examination Reports & Analytics</h1>
          <p className="text-xs text-slate-500 font-medium">Review candidate performance and AI proctoring integrity metrics</p>
        </div>

        <button
          onClick={() => handleDownload('all', 'All Examinations')}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Export All Reports</span>
        </button>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="py-4 px-6">Exam Name</th>
              <th className="py-4 px-6">Code</th>
              <th className="py-4 px-6 text-center">Students</th>
              <th className="py-4 px-6 text-center">Average Score</th>
              <th className="py-4 px-6 text-center">Average Risk Score</th>
              <th className="py-4 px-6 text-center">Completion Rate</th>
              <th className="py-4 px-6 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold">
            {reports.map((rep) => (
              <tr
                key={rep.id}
                onClick={() => setActiveModalReport(rep)}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <td className="py-4 px-6 text-slate-900 font-bold">{rep.examName}</td>
                <td className="py-4 px-6 font-mono text-indigo-600 font-bold">{rep.code}</td>
                <td className="py-4 px-6 text-center text-slate-700">{rep.students}</td>
                <td className="py-4 px-6 text-center text-emerald-700 font-bold">{rep.avgScore}</td>
                <td className="py-4 px-6 text-center text-amber-700 font-bold">{rep.avgRiskScore}</td>
                <td className="py-4 px-6 text-center text-slate-700">{rep.completionRate}</td>
                <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDownload(rep.id, rep.examName)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-indigo-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Analytics Modal View */}
      {activeModalReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                  {activeModalReport.code}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">{activeModalReport.examName}</h3>
              </div>
              <button
                onClick={() => setActiveModalReport(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Examinees</div>
                <div className="text-xl font-extrabold text-indigo-950 mt-0.5">{activeModalReport.students}</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                <Award className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Average Score</div>
                <div className="text-xl font-extrabold text-emerald-950 mt-0.5">{activeModalReport.avgScore}</div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <ShieldAlert className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Avg Risk Score</div>
                <div className="text-xl font-extrabold text-amber-950 mt-0.5">{activeModalReport.avgRiskScore}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <BarChart2 className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Completion</div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">{activeModalReport.completionRate}</div>
              </div>
            </div>

            {/* Incidents Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">AI Security Audit Notes</div>
              <p className="text-slate-600 leading-relaxed font-medium">
                During this examination, {activeModalReport.incidentsFlagged} high-risk anomaly incidents were flagged by the YOLO + MediaPipe model. Overall academic integrity level remains high.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => handleDownload(activeModalReport.id, activeModalReport.examName)}
                className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-xs shadow-md shadow-indigo-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Report (PDF/CSV)</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
