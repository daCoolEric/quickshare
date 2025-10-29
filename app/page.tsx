// SimpleApp.tsx - Much simpler connection flow
"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileText,
  X,
  WifiOff,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Mode } from "../utils/types";
import { useSimpleFileTransfer } from "../hooks/useFileTransfer";
import StatusIndicator from "../components/StatusIndicator";
import ProgressBar from "../components/ProgressBar";

export default function SimpleOfflineFileTransfer() {
  const [mode, setMode] = useState<Mode>("send");
  const [file, setFile] = useState<File | null>(null);
  const [inputPeerId, setInputPeerId] = useState("");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    progress,
    peerId,
    receivedFileName,
    setupSender,
    connectAsReceiver,
    reset,
  } = useSimpleFileTransfer();

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
    setInputPeerId("");
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    handleReset();
  };

  const handleConnect = () => {
    if (inputPeerId.trim().length === 6) {
      connectAsReceiver(inputPeerId.trim());
    }
  };

  const copyPeerId = async () => {
    try {
      await navigator.clipboard.writeText(peerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy code");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">📁</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Offline File Transfer
            </h1>
            <p className="text-gray-600">
              Simple 6-digit code • No QR scanning needed
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <WifiOff className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-800">
              Both devices must be on the same WiFi network. Just share a simple
              6-digit code!
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

                  {peerId && status === "waiting" && (
                    <div className="mb-6">
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 text-center">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Share this code with the receiver:
                        </p>
                        <div className="bg-white rounded-lg p-4 mb-4 inline-block">
                          <span className="text-5xl font-bold text-purple-600 tracking-widest">
                            {peerId}
                          </span>
                        </div>
                        <button
                          onClick={copyPeerId}
                          className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                        >
                          {copied ? (
                            <>
                              <Check className="w-5 h-5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-5 h-5" />
                              Copy Code
                            </>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 mt-3">
                          Waiting for receiver to connect...
                        </p>
                      </div>
                    </div>
                  )}

                  {(status === "sending" ||
                    status === "complete" ||
                    status === "connecting") && (
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
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Download className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Ready to Receive
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Enter the 6-digit code from the sender
                  </p>

                  <div className="max-w-md mx-auto">
                    <input
                      type="text"
                      value={inputPeerId}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setInputPeerId(value);
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-6 py-4 text-center text-3xl font-bold tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                    />
                    <button
                      onClick={handleConnect}
                      disabled={inputPeerId.length !== 6}
                      className="w-full py-3 px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              )}

              {status === "connecting" && (
                <div className="text-center py-8">
                  <div className="animate-pulse mb-4">
                    <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto"></div>
                  </div>
                  <p className="text-gray-600">Connecting to sender...</p>
                </div>
              )}

              {receivedFileName && status === "ready_to_receive" && (
                <div className="bg-blue-50 rounded-lg p-6 text-center mb-6">
                  <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">
                    Ready to receive:
                  </p>
                  <p className="font-semibold text-gray-800 text-lg">
                    {receivedFileName}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Waiting for sender to start transfer...
                  </p>
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
                {mode === "receive"
                  ? "Invalid code or sender not ready. Check the code and try again."
                  : "Make sure both devices are on the same WiFi network"}
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
            Works on local WiFi network • No QR scanning needed
          </p>
        </div>
      </div>
    </div>
  );
}
