// QRScanner.tsx
import { useRef, useEffect } from "react";
import { Scan } from "lucide-react";
import {
  startCamera,
  stopCamera,
  scanQRFromVideo,
  getCameraErrorMessage,
} from "../utils/qrScanner";

interface QRScannerProps {
  isScanning: boolean;
  scanError: string;
  onScanSuccess: (code: string) => void;
  onScanError: (error: string) => void;
  onCancel: () => void;
  onPaste: (code: string) => void;
}

export default function QRScanner({
  isScanning,
  scanError,
  onScanSuccess,
  onScanError,
  onCancel,
  onPaste,
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isScanning) {
      startScanning();
    }
    return () => {
      cleanup();
    };
  }, [isScanning]);

  const startScanning = async () => {
    scanningRef.current = true;

    try {
      if (videoRef.current) {
        await startCamera(videoRef.current);
        scanLoop();
      }
    } catch (error) {
      const errorMessage = getCameraErrorMessage(error);
      onScanError(errorMessage);
      scanningRef.current = false;
    }
  };

  const scanLoop = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const qrData = scanQRFromVideo(videoRef.current, canvasRef.current);

    if (qrData) {
      console.log("Valid QR code detected");
      cleanup();
      onScanSuccess(qrData);
      return;
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    }
  };

  const cleanup = () => {
    scanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current) {
      stopCamera(videoRef.current);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-64 object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-48 h-48">
            <div className="absolute inset-0 border-4 border-purple-500 rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white"></div>
            </div>

            {/* Scanning animation */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <div className="absolute w-full h-0.5 bg-purple-400 animate-scan"></div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-white text-sm bg-black bg-opacity-60 px-4 py-2 rounded-full inline-block">
            <Scan className="w-4 h-4 inline mr-2" />
            Point camera at QR code
          </p>
        </div>
      </div>

      {scanError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          {scanError}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <input
          type="text"
          placeholder="Or paste code"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          onPaste={(e) => {
            const code = e.clipboardData.getData("text");
            onPaste(code);
          }}
        />
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }

        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
