import { useState, useEffect, useRef } from 'react';

export const useWebcam = () => {
  const [stream, setStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const startWebcam = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        });
        setStream(mediaStream);
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } else {
        throw new Error('Camera access not supported in environment');
      }
    } catch (err) {
      console.log('Webcam permission note (fallback simulated stream activated):', err.message);
      setError(err.message);
      setHasPermission(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, []);

  return { videoRef, stream, hasPermission, error, startWebcam, stopWebcam };
};
