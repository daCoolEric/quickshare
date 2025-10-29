"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function QrScanner({
  onScan,
}: {
  onScan: (data: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setError("Camera access denied or not available.");
      }
    };
    startCamera();
  }, []);

  useEffect(() => {
    const scanLoop = () => {
      if (!videoRef.current) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code) {
        onScan(code.data);
      } else {
        requestAnimationFrame(scanLoop);
      }
    };

    const interval = setTimeout(() => scanLoop(), 1000);
    return () => clearTimeout(interval);
  }, [onScan]);

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full max-w-xs rounded-lg shadow-md"
        />
      )}
    </div>
  );
}
