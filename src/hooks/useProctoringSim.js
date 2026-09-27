import { useEffect } from 'react';
import { useProctoring } from '../contexts/ProctoringContext';

export const useProctoringSim = (enableSimulation = true) => {
  const { setLiveStudentAI, triggerNotification } = useProctoring();

  useEffect(() => {
    if (!enableSimulation) return;

    // Simulate periodic random AI proctoring events during student exam
    const events = [
      {
        type: 'warning',
        message: 'Looking Away: Head pose yaw angle exceeded 20°',
        update: { gazeDirection: 'Left', headPose: { pitch: 5, yaw: 24, roll: 2 }, riskScore: 28, status: 'Warning' }
      },
      {
        type: 'critical',
        message: 'YOLO Detection: Smartphone identified near desk',
        update: { phoneDetected: true, riskScore: 72, warningCount: 1, status: 'Critical' }
      },
      {
        type: 'warning',
        message: 'Face Missing: Candidate face left frame boundary',
        update: { faceVisible: false, riskScore: 54, status: 'Warning' }
      },
      {
        type: 'info',
        message: 'AI Proctor: Face mesh re-aligned. Environment Safe.',
        update: { faceVisible: true, phoneDetected: false, bookDetected: false, multiplePersons: false, gazeDirection: 'Center', headPose: { pitch: 0, yaw: 0, roll: 0 }, riskScore: 8, status: 'Safe' }
      }
    ];

    let step = 0;
    const interval = setInterval(() => {
      const currentEvt = events[step % events.length];
      triggerNotification(currentEvt.type, currentEvt.message);
      setLiveStudentAI((prev) => ({ ...prev, ...currentEvt.update }));
      step++;
    }, 18000); // Trigger event every 18 seconds

    return () => clearInterval(interval);
  }, [enableSimulation, setLiveStudentAI, triggerNotification]);
};
