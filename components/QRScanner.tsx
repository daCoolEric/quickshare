"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function QrScanner({
  onScan,
}: {
  onScan: (data: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
        }
      } catch (err) {
        console.error(err);
        setError("Camera access denied or not available.");
      }
    };

    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Only scan if video is ready
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
          setScanning(false);
          onScan(code.data);
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          return;
        }
      }

      animationId = requestAnimationFrame(scanFrame);
    };

    startCamera().then(() => {
      animationId = requestAnimationFrame(scanFrame);
    });

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animationId);
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-xs rounded-lg shadow-md"
          />
          {scanning && (
            <p className="text-sm mt-2 text-gray-600">Scanning QR code...</p>
          )}
        </>
      )}
    </div>
  );
}
