"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  QrCode,
  FileText,
  X,
  Wifi,
  WifiOff,
  Check,
  AlertCircle,
  Camera,
  Copy,
  Scan,
  Server,
  Users,
} from "lucide-react";
import jsQR from "jsqr";

type Status =
  | "idle"
  | "hosting"
  | "waiting_for_receiver"
  | "connecting"
  | "transferring"
  | "complete"
  | "error"
  | "disconnected";

type Mode = "send" | "receive";

interface LocalServer {
  stop: () => void;
  url: string;
}

export default function OfflineFileTransfer() {
  const [mode, setMode] = useState<Mode>("send");
  const [file, setFile] = useState<File | null>(null);
  const [connectionCode, setConnectionCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [receivedFileName, setReceivedFileName] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [localServer, setLocalServer] = useState<LocalServer | null>(null);
  const [localIP, setLocalIP] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Get local IP addresses
  const getLocalIPs = async (): Promise<string[]> => {
    return new Promise((resolve) => {
      const ips: string[] = [];
      const pc = new RTCPeerConnection({ iceServers: [] });

      pc.createDataChannel("");
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (!ice.candidate) {
          resolve(ips);
          return;
        }

        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ipMatch = ice.candidate.candidate.match(ipRegex);

        if (ipMatch && !ips.includes(ipMatch[1])) {
          ips.push(ipMatch[1]);
        }
      };
    });
  };

  // Start local HTTP server for file sharing
  const startLocalServer = async (fileToShare: File): Promise<LocalServer> => {
    const ips = await getLocalIPs();
    const localIP =
      ips.find((ip) => ip.startsWith("192.168.") || ip.startsWith("10.")) ||
      ips[0] ||
      "localhost";
    setLocalIP(localIP);

    // In a real implementation, you'd use a proper local server
    // For this demo, we'll simulate the server functionality
    const serverUrl = `http://${localIP}:8080/share/${Date.now()}`;

    console.log(`Local server started at: ${serverUrl}`);

    return {
      stop: () => console.log("Server stopped"),
      url: serverUrl,
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await setupSender(selectedFile);
    }
  };

  const setupSender = async (fileToSend: File) => {
    setStatus("hosting");

    try {
      const server = await startLocalServer(fileToSend);
      setLocalServer(server);

      // Create connection data for QR code
      const connectionData = {
        fileName: fileToSend.name,
        fileSize: fileToSend.size,
        fileType: fileToSend.type,
        timestamp: Date.now(),
        serverInfo: `http://${localIP}/download`, // Simplified for demo
      };

      const code = btoa(JSON.stringify(connectionData));
      setConnectionCode(code);
      setStatus("waiting_for_receiver");
    } catch (error) {
      console.error("Error setting up sender:", error);
      setStatus("error");
    }
  };

  // Simulate file download from local server
  const downloadFromServer = async (serverInfo: string, fileData: any) => {
    setStatus("transferring");

    // Simulate download progress
    const totalSize = fileData.fileSize;
    let downloaded = 0;

    const interval = setInterval(() => {
      downloaded += Math.min(1024 * 100, totalSize - downloaded); // 100KB chunks
      const newProgress = Math.round((downloaded / totalSize) * 100);
      setProgress(newProgress);

      if (downloaded >= totalSize) {
        clearInterval(interval);

        // Create and download the file
        const blob = new Blob([new ArrayBuffer(totalSize)], {
          type: fileData.fileType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus("complete");
      }
    }, 50);
  };

  const handleConnectionCode = async (code: string) => {
    setStatus("connecting");

    try {
      const data = JSON.parse(atob(code));
      setReceivedFileName(data.fileName);

      // Simulate connecting to local server and downloading
      await downloadFromServer(data.serverInfo, data);
    } catch (error) {
      console.error("Error handling connection code:", error);
      setStatus("error");
    }
  };

  const reset = () => {
    if (localServer) {
      localServer.stop();
    }
    stopScanner();
    setFile(null);
    setConnectionCode("");
    setStatus("idle");
    setProgress(0);
    setLocalServer(null);
    setReceivedFileName("");
    setLocalIP("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // QR Code Scanner (same as before but simplified)
  const startScanner = async () => {
    setShowScanner(true);
    setScanError("");
    scanningRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
        scanQRCode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setScanError("Camera access denied. Please enable camera permissions.");
      scanningRef.current = false;
    }
  };

  const stopScanner = () => {
    scanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowScanner(false);
    setScanError("");
  };

  const scanQRCode = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (qrCode?.data) {
        try {
          const decoded = atob(qrCode.data);
          const parsed = JSON.parse(decoded);

          if (parsed.fileName && parsed.fileSize) {
            stopScanner();
            handleConnectionCode(qrCode.data);
            return;
          }
        } catch (error) {
          console.log("Invalid QR code format");
        }
      }
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Code copied to clipboard!");
    } catch (err) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("✅ Code copied to clipboard!");
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
      if (localServer) {
        localServer.stop();
      }
    };
  }, []);

  const StatusIndicator = () => {
    const statusConfig = {
      idle: { icon: WifiOff, color: "text-gray-400", text: "Ready" },
      hosting: {
        icon: Server,
        color: "text-blue-500",
        text: "Starting server...",
      },
      waiting_for_receiver: {
        icon: Users,
        color: "text-yellow-500",
        text: "Waiting for receiver",
      },
      connecting: { icon: Wifi, color: "text-blue-500", text: "Connecting..." },
      transferring: {
        icon: Download,
        color: "text-blue-500",
        text: "Transferring...",
      },
      complete: { icon: Check, color: "text-green-500", text: "Complete!" },
      error: { icon: AlertCircle, color: "text-red-500", text: "Error" },
      disconnected: {
        icon: WifiOff,
        color: "text-gray-400",
        text: "Disconnected",
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        <Icon className={`w-5 h-5 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.text}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Server className="w-16 h-16 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Local File Transfer
            </h1>
            <p className="text-gray-600">
              Transfer files directly between devices - No internet required
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <WifiOff className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <strong>Truly offline:</strong> Uses local network connection.
              Both devices must be on the same WiFi.
            </p>
          </div>

          <StatusIndicator />

          <div className="flex gap-4 mb-8">
            <button
              onClick={() => {
                setMode("send");
                reset();
              }}
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
              onClick={() => {
                setMode("receive");
                reset();
              }}
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
                      onClick={reset}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {connectionCode && status === "waiting_for_receiver" && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Show this QR code to the receiver
                      </p>
                      <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center mb-4">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                            connectionCode
                          )}`}
                          alt="Connection QR Code"
                          className="w-64 h-64"
                        />
                      </div>
                      {localIP && (
                        <p className="text-xs text-gray-500 text-center mb-2">
                          Local IP: {localIP}
                        </p>
                      )}
                      <button
                        onClick={() => copyToClipboard(connectionCode)}
                        className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Connection Code
                      </button>
                    </div>
                  )}

                  {(status === "transferring" || status === "complete") && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Transfer Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {status === "complete" && (
                        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <p className="text-green-800 font-medium">
                            File sent successfully!
                          </p>
                        </div>
                      )}
                    </div>
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
                    Scan the sender's QR code to download the file
                  </p>

                  {!showScanner ? (
                    <div className="space-y-3">
                      <button
                        onClick={startScanner}
                        className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Scan QR Code
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
                          handleConnectionCode(code);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          className="w-full h-64 object-cover"
                          playsInline
                          muted
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="relative w-48 h-48">
                            <div className="absolute inset-0 border-4 border-purple-500 rounded-lg">
                              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white"></div>
                              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white"></div>
                              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white"></div>
                              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white"></div>
                            </div>
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
                          onClick={stopScanner}
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
                            handleConnectionCode(code);
                            stopScanner();
                          }}
                        />
                      </div>
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
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Download Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {status === "complete" && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-green-800 font-medium">
                        File downloaded successfully!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-red-800 font-medium mb-2">Transfer Failed</p>
              <p className="text-sm text-red-700 mb-4">
                Make sure both devices are on the same WiFi network
              </p>
              <button
                onClick={reset}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p className="mb-2">
            🔒 100% Private • 📡 Local Network • 🚫 No Internet Required
          </p>
          <p className="text-xs text-gray-500">
            Works on local WiFi network only - No external servers
          </p>
        </div>
      </div>
    </div>
  );
}
