import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraWidget } from '../exam/CameraWidget';
import { RiskBadge } from '../common/RiskBadge';
import { AIStatusChip } from '../common/AIStatusChip';

export const StudentLiveCard = ({ student }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/admin/student-detail/${student.id}`)}
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-lg transition-all cursor-pointer group hover:border-indigo-300"
    >
      {/* Student Camera Feed */}
      <CameraWidget
        size="small"
        showOverlays={true}
        customState={student}
        compact={true}
      />

      {/* Examinee Details Header */}
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
            {student.name}
          </h4>
          <p className="text-[11px] text-slate-500 font-mono">{student.rollNumber}</p>
        </div>
        <RiskBadge status={student.status} riskScore={student.riskScore} />
      </div>

      {/* AI Detections Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
        <AIStatusChip type="face" active={student.faceVisible} />
        {student.phoneDetected && <AIStatusChip type="phone" active={true} />}
        {student.bookDetected && <AIStatusChip type="book" active={true} />}
        {student.multiplePersons && <AIStatusChip type="persons" active={true} />}
      </div>

      {/* Last Incident Footer */}
      {student.lastIncident && student.lastIncident !== 'None' && (
        <div className="mt-2 text-[10px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 truncate">
          ⚠️ {student.lastIncident}
        </div>
      )}
    </div>
  );
};
