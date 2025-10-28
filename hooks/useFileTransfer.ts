// useFileTransfer.ts
import { useState, useRef, useCallback } from "react";
import { Status, FileInfo, ConnectionData, AnswerData } from "../utils/types";
import { createPeerConnection, waitForIceGathering } from "../utils/webrtc";
import {
  sendFile as sendFileUtil,
  completeFileDownload,
} from "../utils/fileTransfer";

export const useFileTransfer = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [connectionCode, setConnectionCode] = useState("");
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [receivedFileName, setReceivedFileName] = useState("");

  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentFileInfoRef = useRef<FileInfo | null>(null);

  const setupSender = useCallback(async (file: File) => {
    setStatus("preparing");

    try {
      const pc = createPeerConnection(setStatus);
      setPeerConnection(pc);

      const channel = pc.createDataChannel("fileTransfer", { ordered: true });

      channel.onopen = () => {
        console.log("Data channel opened - ready to send file");
        setStatus("ready");
      };

      channel.onclose = () => {
        console.log("Data channel closed");
        setStatus("disconnected");
      };

      channel.onerror = (error) => {
        console.error("Data channel error:", error);
        setStatus("error");
      };

      setDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const connectionData: ConnectionData = {
        offer: pc.localDescription!,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      };

      const code = btoa(JSON.stringify(connectionData));
      setConnectionCode(code);
      setStatus("waiting");
    } catch (error) {
      console.error("Error setting up sender:", error);
      setStatus("error");
    }
  }, []);

  const sendFile = useCallback(
    async (file: File) => {
      if (!dataChannel) return;
      await sendFileUtil(file, dataChannel, setProgress, setStatus);
    },
    [dataChannel]
  );

  const handleConnectionCode = useCallback(async (code: string) => {
    setStatus("connecting");

    try {
      const data: ConnectionData = JSON.parse(atob(code));
      const pc = createPeerConnection(setStatus);
      setPeerConnection(pc);

      currentFileInfoRef.current = {
        name: data.fileName,
        size: data.fileSize,
        type: data.fileType,
      };
      setReceivedFileName(data.fileName);

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        setDataChannel(channel);
        receivedChunksRef.current = [];
        setProgress(0);

        channel.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const message = JSON.parse(event.data);
              if (message.type === "EOF") {
                completeFileDownload(
                  receivedChunksRef.current,
                  currentFileInfoRef.current!,
                  setStatus,
                  setProgress
                );
                return;
              }
            } catch {}
          }

          if (event.data instanceof ArrayBuffer) {
            receivedChunksRef.current.push(event.data);
            const receivedBytes = receivedChunksRef.current.reduce(
              (acc, chunk) => acc + chunk.byteLength,
              0
            );

            if (currentFileInfoRef.current) {
              const newProgress = Math.round(
                (receivedBytes / currentFileInfoRef.current.size) * 100
              );
              setProgress(newProgress);
              setStatus("receiving");
            }
          }
        };

        channel.onopen = () => {
          console.log("Data channel opened - ready to receive");
          setStatus("connected");
        };

        channel.onclose = () => setStatus("disconnected");
        channel.onerror = () => setStatus("error");
      };

      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);

      const answerData: AnswerData = { answer: pc.localDescription! };
      const answerCode = btoa(JSON.stringify(answerData));
      setConnectionCode(answerCode);
      setStatus("ready_to_receive");
    } catch (error) {
      console.error("Error handling connection code:", error);
      setStatus("error");
    }
  }, []);

  const handleAnswerCode = useCallback(
    async (code: string, file: File) => {
      try {
        const data: AnswerData = JSON.parse(atob(code));
        if (!peerConnection) throw new Error("No peer connection");

        await peerConnection.setRemoteDescription(data.answer);
        setStatus("connected");

        setTimeout(() => {
          sendFile(file);
        }, 500);
      } catch (error) {
        console.error("Error handling answer code:", error);
        setStatus("error");
      }
    },
    [peerConnection, sendFile]
  );

  const reset = useCallback(() => {
    peerConnection?.close();
    dataChannel?.close();

    setStatus("idle");
    setProgress(0);
    setConnectionCode("");
    setPeerConnection(null);
    setDataChannel(null);
    setReceivedFileName("");
    receivedChunksRef.current = [];
    currentFileInfoRef.current = null;
  }, [peerConnection, dataChannel]);

  return {
    status,
    progress,
    connectionCode,
    receivedFileName,
    setupSender,
    handleConnectionCode,
    handleAnswerCode,
    reset,
  };
};
