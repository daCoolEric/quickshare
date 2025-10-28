// App.tsx
"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  QrCode,
  FileText,
  X,
  WifiOff,
  Camera,
  AlertCircle,
} from "lucide-react";
import { Mode } from "../utils/types";
import { useFileTransfer } from "../hooks/useFileTransfer";
import StatusIndicator from "../components/StatusIndicator";
import QRScanner from "../components/QRScanner";
import QRCodeDisplay from "../components/QRCodeDisplay";
import ProgressBar from "../components/ProgressBar";

export default function OfflineFileTransfer() {
  const [mode, setMode] = useState<Mode>("send");
  const [file, setFile] = useState<File | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanningFor, setScanningFor] = useState<"connection" | "answer">(
    "connection"
  );
  const [isScanning, setIsScanning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    progress,
    connectionCode,
    receivedFileName,
    setupSender,
    handleConnectionCode,
    handleAnswerCode,
    reset,
  } = useFileTransfer();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setupSender(selectedFile);
    }
  };

  const handleReset = () => {
    reset();
    setFile(null);
    setShowScanner(false);
    setScanError("");
    setIsScanning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startScanner = (type: "connection" | "answer") => {
    console.log(`Starting scanner for ${type}`);
    setShowScanner(true);
    setScanError("");
    setScanningFor(type);
    setIsScanning(true);
  };

  const stopScanner = () => {
    console.log("Stopping scanner");
    setIsScanning(false);
    setShowScanner(false);
    setScanError("");
  };

  const handleScanSuccess = (code: string) => {
    console.log("QR code scanned, processing...");

    // Process the code based on what we're scanning for
    if (scanningFor === "connection") {
      handleConnectionCode(code);
    } else {
      // This is an answer code for the sender
      handleAnswerCode(code);
    }
  };

  const handlePasteConnectionCode = (code: string) => {
    console.log("Connection code pasted");
    stopScanner();
    handleConnectionCode(code);
  };

  const handlePasteAnswerCode = (code: string) => {
    console.log("Answer code pasted");
    stopScanner();
    handleAnswerCode(code);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    handleReset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <QrCode className="w-16 h-16 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Offline File Transfer
            </h1>
            <p className="text-gray-600">
              Transfer files directly between devices - No internet required
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <WifiOff className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-800">
              This app works completely offline using peer-to-peer connection.
              Both devices must be on the same WiFi network.
            </p>
          </div>

          <StatusIndicator status={status} />

          <div className="flex gap-4 mb-8">
            <button
              onClick={() => handleModeChange("send")}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                mode === "send"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Upload className="w-5 h-5 inline mr-2" />
              Send File
            </button>
            <button
              onClick={() => handleModeChange("receive")}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                mode === "receive"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Download className="w-5 h-5 inline mr-2" />
              Receive File
            </button>
          </div>

          {mode === "send" && (
            <div>
              {!file ? (
                <div className="border-3 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="fileInput"
                  />
                  <label htmlFor="fileInput" className="cursor-pointer">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Click to select a file
                    </p>
                    <p className="text-sm text-gray-500">
                      Any file type, any size
                    </p>
                  </label>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-8 h-8 text-purple-600 mr-3" />
                      <div>
                        <p className="font-medium text-gray-800">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {connectionCode && status === "waiting" && (
                    <QRCodeDisplay
                      code={connectionCode}
                      title="Step 1: Show this QR code to the receiver"
                      subtitle={`Connection Code: ${connectionCode.substring(
                        0,
                        20
                      )}...`}
                    />
                  )}

                  {status === "ready" && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Step 2: Scan the receiver's answer QR code
                      </p>

                      {!showScanner ? (
                        <div className="space-y-3">
                          <button
                            onClick={() => startScanner("answer")}
                            className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Camera className="w-5 h-5" />
                            Scan Answer QR Code
                          </button>
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                              <span className="px-2 bg-white text-gray-500">
                                or
                              </span>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Paste the answer code here"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            onPaste={(e) => {
                              const code = e.clipboardData.getData("text");
                              handlePasteAnswerCode(code);
                            }}
                          />
                        </div>
                      ) : (
                        <QRScanner
                          isScanning={isScanning}
                          scanError={scanError}
                          onScanSuccess={handleScanSuccess}
                          onScanError={setScanError}
                          onCancel={stopScanner}
                          onPaste={handlePasteAnswerCode}
                        />
                      )}
                    </div>
                  )}

                  {(status === "sending" || status === "complete") && (
                    <ProgressBar
                      progress={progress}
                      status={status}
                      mode="send"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "receive" && (
            <div>
              {status === "idle" && (
                <div className="text-center py-8">
                  <QrCode className="w-24 h-24 text-gray-300 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Ready to Receive
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Scan the sender's QR code or paste the connection code below
                  </p>

                  {!showScanner ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => startScanner("connection")}
                        className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Scan Sender's QR Code
                      </button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            or
                          </span>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Paste connection code here"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        onPaste={(e) => {
                          const code = e.clipboardData.getData("text");
                          handlePasteConnectionCode(code);
                        }}
                      />
                    </div>
                  ) : (
                    <QRScanner
                      isScanning={isScanning}
                      scanError={scanError}
                      onScanSuccess={handleScanSuccess}
                      onScanError={setScanError}
                      onCancel={stopScanner}
                      onPaste={handlePasteConnectionCode}
                    />
                  )}
                </div>
              )}

              {connectionCode && status === "ready_to_receive" && (
                <div className="text-center">
                  <QRCodeDisplay
                    code={connectionCode}
                    title="Step 2: Show this answer QR code to the sender"
                    subtitle={`Answer Code: ${connectionCode.substring(
                      0,
                      20
                    )}...`}
                  />
                  {receivedFileName && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600">Ready to receive:</p>
                      <p className="font-medium text-gray-800">
                        {receivedFileName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(progress > 0 || status === "complete") && (
                <div className="mb-6">
                  {receivedFileName && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <p className="font-medium text-gray-800 text-center">
                        {receivedFileName}
                      </p>
                    </div>
                  )}
                  <ProgressBar
                    progress={progress}
                    status={status}
                    mode="receive"
                  />
                </div>
              )}
            </div>
          )}

          {(status === "error" || status === "failed") && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-red-800 font-medium mb-2">Connection Failed</p>
              <p className="text-sm text-red-700 mb-4">
                Make sure both devices are on the same WiFi network and try
                again
              </p>
              <button
                onClick={handleReset}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p className="mb-2">
            🔒 100% Private • 📡 Peer-to-Peer • 🚫 No Internet Required
          </p>
          <p className="text-xs text-gray-500">
            Works on local WiFi network only
          </p>
        </div>
      </div>
    </div>
  );
}
