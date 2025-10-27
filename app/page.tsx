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
} from "lucide-react";
import jsQR from "jsqr";

type Status =
  | "idle"
  | "preparing"
  | "waiting"
  | "connecting"
  | "connected"
  | "ready"
  | "ready_to_receive"
  | "sending"
  | "receiving"
  | "complete"
  | "error"
  | "failed"
  | "disconnected";

type Mode = "send" | "receive";

export default function OfflineFileTransfer() {
  const [mode, setMode] = useState<Mode>("send");
  const [file, setFile] = useState<File | null>(null);
  const [connectionCode, setConnectionCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [receivedFileName, setReceivedFileName] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanningFor, setScanningFor] = useState<"connection" | "answer">(
    "connection"
  );
  const [isScanning, setIsScanning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const createPeerConnection = (): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [], // No STUN/TURN servers - works on local network only
    });

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected") {
        setStatus("connected");
      } else if (pc.iceConnectionState === "failed") {
        setStatus("failed");
      }
    };

    return pc;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setupSender(selectedFile);
    }
  };

  const setupSender = async (fileToSend: File) => {
    setStatus("preparing");

    try {
      const pc = createPeerConnection();
      setPeerConnection(pc);

      const channel = pc.createDataChannel("fileTransfer", {
        ordered: true,
      });

      channel.onopen = () => {
        setStatus("ready");
        console.log("Data channel opened");
      };

      channel.onclose = () => {
        setStatus("disconnected");
        console.log("Data channel closed");
      };

      setDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          };
        }
      });

      const code = btoa(
        JSON.stringify({
          offer: pc.localDescription,
          fileName: fileToSend.name,
          fileSize: fileToSend.size,
          fileType: fileToSend.type,
        })
      );

      setConnectionCode(code);
      setStatus("waiting");
    } catch (error) {
      console.error("Error setting up sender:", error);
      setStatus("error");
    }
  };

  const sendFile = async () => {
    if (!file || !dataChannel || dataChannel.readyState !== "open") {
      console.error("Cannot send file: channel not ready");
      return;
    }

    setStatus("sending");
    const chunkSize = 16384; // 16KB chunks
    const fileReader = new FileReader();
    let offset = 0;

    fileReader.onload = (e) => {
      if (e.target?.result && dataChannel.readyState === "open") {
        dataChannel.send(e.target.result as ArrayBuffer);
        offset += (e.target.result as ArrayBuffer).byteLength;
        setProgress(Math.round((offset / file.size) * 100));

        if (offset < file.size) {
          readSlice(offset);
        } else {
          dataChannel.send("EOF");
          setStatus("complete");
        }
      }
    };

    const readSlice = (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  };

  const handleConnectionCode = async (code: string) => {
    setStatus("connecting");

    try {
      const data = JSON.parse(atob(code));
      const pc = createPeerConnection();
      setPeerConnection(pc);

      setReceivedFileName(data.fileName);

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        setDataChannel(channel);
        receivedChunksRef.current = [];

        channel.onmessage = (e) => {
          if (typeof e.data === "string" && e.data === "EOF") {
            const blob = new Blob(receivedChunksRef.current, {
              type: data.fileType,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatus("complete");
            setProgress(100);
          } else {
            receivedChunksRef.current.push(e.data);
            const received = receivedChunksRef.current.reduce(
              (acc, chunk) => acc + chunk.byteLength,
              0
            );
            setProgress(Math.round((received / data.fileSize) * 100));
          }
        };

        channel.onopen = () => {
          setStatus("connected");
        };
      };

      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          };
        }
      });

      const answerCode = btoa(
        JSON.stringify({
          answer: pc.localDescription,
        })
      );

      setConnectionCode(answerCode);
      setStatus("ready_to_receive");
    } catch (error) {
      console.error("Error handling connection code:", error);
      setStatus("error");
    }
  };

  const handleAnswerCode = async (code: string) => {
    try {
      const data = JSON.parse(atob(code));
      await peerConnection?.setRemoteDescription(data.answer);
      setStatus("connected");
      setTimeout(() => sendFile(), 500);
    } catch (error) {
      console.error("Error handling answer code:", error);
      setStatus("error");
    }
  };

  const reset = () => {
    if (peerConnection) {
      peerConnection.close();
    }
    if (dataChannel) {
      dataChannel.close();
    }
    stopScanner();
    setFile(null);
    setConnectionCode("");
    setStatus("idle");
    setProgress(0);
    setPeerConnection(null);
    setDataChannel(null);
    setReceivedFileName("");
    receivedChunksRef.current = [];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // PRODUCTION-READY QR CODE SCANNER
  const startScanner = async (type: "connection" | "answer") => {
    setShowScanner(true);
    setScanError("");
    setScanningFor(type);
    scanningRef.current = true;
    setIsScanning(true);

    try {
      // Request camera access with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });

        // Start scanning loop
        scanQRCode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      let errorMessage =
        "Camera access denied. Please enable camera permissions in your browser settings.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage =
            "Camera permission denied. Please allow camera access and try again.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "No camera found on this device.";
        } else if (error.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another application.";
        }
      }

      setScanError(errorMessage);
      scanningRef.current = false;
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    scanningRef.current = false;
    setIsScanning(false);

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }

    setShowScanner(false);
    setScanError("");
  };

  const scanQRCode = () => {
    // Stop if scanning was cancelled
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data from canvas
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // Scan for QR code using jsQR
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert", // Faster performance
      });

      if (qrCode && qrCode.data) {
        console.log("QR Code detected!");

        // Validate that it looks like a base64 encoded connection code
        if (qrCode.data.length > 50) {
          try {
            // Try to decode to verify it's valid
            const decoded = atob(qrCode.data);
            const parsed = JSON.parse(decoded);

            // Check if it has the expected structure
            if ((parsed.offer || parsed.answer) && typeof parsed === "object") {
              console.log("Valid connection code detected");

              // Stop scanner
              stopScanner();

              // Process the scanned code based on what we're scanning for
              if (scanningFor === "connection") {
                handleConnectionCode(qrCode.data);
              } else {
                handleAnswerCode(qrCode.data);
              }

              return; // Exit scanning loop
            }
          } catch (error) {
            console.log("Invalid QR code format, continuing scan...");
          }
        }
      }
    }

    // Continue scanning if still active
    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Code copied to clipboard! Share it with the other device.");
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        alert("✅ Code copied to clipboard!");
      } catch (e) {
        alert(
          "❌ Failed to copy. Please copy manually: " +
            text.substring(0, 30) +
            "..."
        );
      }
      document.body.removeChild(textArea);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const StatusIndicator = () => {
    const statusConfig: Record<
      Status,
      { icon: React.ElementType; color: string; text: string }
    > = {
      idle: { icon: WifiOff, color: "text-gray-400", text: "Not connected" },
      preparing: { icon: Wifi, color: "text-blue-500", text: "Preparing..." },
      waiting: {
        icon: Wifi,
        color: "text-yellow-500",
        text: "Waiting for receiver",
      },
      connecting: { icon: Wifi, color: "text-blue-500", text: "Connecting..." },
      connected: { icon: Wifi, color: "text-green-500", text: "Connected" },
      ready: { icon: Check, color: "text-green-500", text: "Ready to send" },
      ready_to_receive: {
        icon: Check,
        color: "text-green-500",
        text: "Ready to receive",
      },
      sending: { icon: Upload, color: "text-blue-500", text: "Sending..." },
      receiving: {
        icon: Download,
        color: "text-blue-500",
        text: "Receiving...",
      },
      complete: { icon: Check, color: "text-green-500", text: "Complete!" },
      error: {
        icon: AlertCircle,
        color: "text-red-500",
        text: "Connection error",
      },
      failed: {
        icon: AlertCircle,
        color: "text-red-500",
        text: "Connection failed",
      },
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

                  {connectionCode && status === "waiting" && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Step 1: Show this QR code to the receiver
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
                      <p className="text-xs text-gray-500 text-center mb-4">
                        Connection Code: {connectionCode.substring(0, 20)}...
                      </p>
                      <button
                        onClick={() => copyToClipboard(connectionCode)}
                        className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Code
                      </button>
                    </div>
                  )}

                  {status === "connected" && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Step 2: Scan the receiver&apos;s QR code
                      </p>

                      {!showScanner ? (
                        <div className="space-y-3">
                          <button
                            onClick={() => startScanner("answer")}
                            className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Camera className="w-5 h-5" />
                            Scan QR Code with Camera
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
                              handleAnswerCode(code);
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

                            {/* Scanning overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="relative w-48 h-48">
                                {/* Scanning frame */}
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
                                handleAnswerCode(code);
                                stopScanner();
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(status === "sending" || status === "complete") && (
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
                    Scan the sender&apos;s QR code or paste the connection code
                    below
                  </p>

                  {!showScanner ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => startScanner("connection")}
                        className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Scan QR Code with Camera
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

              {connectionCode && status === "ready_to_receive" && (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Show this QR code to the sender
                  </p>
                  <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center mb-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                        connectionCode
                      )}`}
                      alt="Answer QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Answer Code: {connectionCode.substring(0, 20)}...
                  </p>
                  <button
                    onClick={() => copyToClipboard(connectionCode)}
                    className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2 mb-4"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </button>
                  {receivedFileName && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600">Waiting for:</p>
                      <p className="font-medium text-gray-800">
                        {receivedFileName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(progress > 0 || status === "complete") && (
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-800 text-center">
                      {receivedFileName}
                    </p>
                  </div>
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

          {(status === "error" || status === "failed") && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-red-800 font-medium mb-2">Connection Failed</p>
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
            🔒 100% Private • 📡 Peer-to-Peer • 🚫 No Internet Required
          </p>
          <p className="text-xs text-gray-500">
            Works on local WiFi network only
          </p>
        </div>
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
