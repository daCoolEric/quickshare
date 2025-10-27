// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
//       <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={100}
//           height={20}
//           priority
//         />
//         <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
//           <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
//             To get started, edit the page.tsx file.
//           </h1>
//           <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
//             Looking for a starting point or more instructions? Head over to{" "}
//             <a
//               href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Templates
//             </a>{" "}
//             or the{" "}
//             <a
//               href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Learning
//             </a>{" "}
//             center.
//           </p>
//         </div>
//         <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
//           <a
//             className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={16}
//               height={16}
//             />
//             Deploy Now
//           </a>
//           <a
//             className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Documentation
//           </a>
//         </div>
//       </main>
//     </div>
//   );
// }

"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import Image from "next/image";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);

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
                    </div>
                  )}

                  {status === "connected" && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                        Step 2: Scan the receiver&apos;s QR code
                      </p>
                      <input
                        type="text"
                        placeholder="Or paste the answer code here"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        onPaste={(e) => {
                          const code = e.clipboardData.getData("text");
                          handleAnswerCode(code);
                        }}
                      />
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
    </div>
  );
}
