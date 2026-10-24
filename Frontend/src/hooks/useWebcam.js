import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Local webcam preview (Stream 1, FRONTEND_ARCHITECTURE.md 8.2). Video only is
 * required; the microphone is requested separately and is optional.
 */
export const useWebcam = ({ enabled = true, withAudio = false } = {}) => {
  const [stream, setStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setHasPermission(false);
  }, []);

  const startWebcam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser (use Chrome/Edge over http://localhost).');
      return null;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: withAudio,
      });
      streamRef.current = media;
      setStream(media);
      setHasPermission(true);
      setError(null);
      return media;
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Camera permission was denied.' : err?.message || 'Camera unavailable');
      setHasPermission(false);
      return null;
    }
  }, [withAudio]);

  useEffect(() => {
    if (!enabled) return undefined;
    startWebcam();
    return () => stopWebcam();
  }, [enabled, startWebcam, stopWebcam]);

  // Attach the stream whenever the <video> element (re)mounts.
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  });

  return { videoRef, stream, hasPermission, error, startWebcam, stopWebcam };
};

/** Grab the current video frame as a JPEG data URL (or Blob). */
export const captureFrame = (video, { quality = 0.75, maxWidth = 1280, asBlob = false } = {}) => {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  if (asBlob) return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return canvas.toDataURL('image/jpeg', quality);
};

/** Mean luminance (0-255) of a video frame, for the lighting pre-check. */
export const frameBrightness = (video) => {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 36;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, 64, 36);
  const { data } = ctx.getImageData(0, 0, 64, 36);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
};
