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
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [receivedFileName, setReceivedFileName] = useState("");
  
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentFileInfoRef = useRef<FileInfo | null>(null);
  const fileToSendRef = useRef<File | null>(null);

  const setupSender = useCallback(async (file: File) => {
    console.log("Setting up sender for:", file.name);
    setStatus("preparing");
    fileToSendRef.current = file;

    try {
      const pc = createPeerConnection(setStatus);
      setPeerConnection(pc);

      const channel = pc.createDataChannel("fileTransfer", { 
        ordered: true,
        maxRetransmits: 30
      });

      channel.onopen = () => {
        console.log("Data channel opened - ready to send file");
        setStatus("ready");
      };

      channel.onclose = () => {
        console.log("Data channel closed");
      };

      channel.onerror = (error) => {
        console.error("Data channel error:", error);
        setStatus("error");
      };

      setDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log("Waiting for ICE candidates...");
      await waitForIceGathering(pc);
      console.log("ICE gathering complete, generating QR code");

      const connectionData: ConnectionData = {
        offer: pc.localDescription!,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      };

      const code = btoa(JSON.stringify(connectionData));
      setConnectionCode(code);
      setStatus("waiting");
      console.log("Sender ready, connection code generated");
    } catch (error) {
      console.error("Error setting up sender:", error);
      setStatus("error");
    }
  }, []);

  const handleConnectionCode = useCallback(async (code: string) => {
    console.log("Receiver: Processing connection code");
    setStatus("connecting");

    try {
      const data: ConnectionData = JSON.parse(atob(code));
      console.log("Decoded connection data for file:", data.fileName);
      
      const pc = createPeerConnection(setStatus);
      setPeerConnection(pc);

      currentFileInfoRef.current = {
        name: data.fileName,
        size: data.fileSize,
        type: data.fileType,
      };
      setReceivedFileName(data.fileName);

      pc.ondatachannel = (event) => {
        console.log("Data channel received");
        const channel = event.channel;
        setDataChannel(channel);
        receivedChunksRef.current = [];
        setProgress(0);

        channel.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const message = JSON.parse(event.data);
              if (message.type === "EOF") {
                console.log("EOF marker received");
                completeFileDownload(
                  receivedChunksRef.current,
                  currentFileInfoRef.current!,
                  setStatus,
                  setProgress
                );
                receivedChunksRef.current = [];
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

        channel.onclose = () => {
          console.log("Data channel closed");
        };

        channel.onerror = (error) => {
          console.error("Data channel error:", error);
          setStatus("error");
        };
      };

      await pc.setRemoteDescription(data.offer);
      console.log("Remote description set");
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("Local answer created");
      
      console.log("Waiting for ICE candidates...");
      await waitForIceGathering(pc);
      console.log("ICE gathering complete");

      const answerData: AnswerData = { answer: pc.localDescription! };
      const answerCode = btoa(JSON.stringify(answerData));
      setConnectionCode(answerCode);
      setStatus("ready_to_receive");
      console.log("Answer code generated, ready to receive");
    } catch (error) {
      console.error("Error handling connection code:", error);
      setStatus("error");
    }
  }, []);

  const handleAnswerCode = useCallback(async (code: string) => {
    console.log("Sender: Processing answer code");
    try {
      const data: AnswerData = JSON.parse(atob(code));
      if (!peerConnection) {
        throw new Error("No peer connection");
      }
      
      await peerConnection.setRemoteDescription(data.answer);
      console.log("Remote answer set, waiting for connection...");
      setStatus("connecting");
      
      // Wait for connection to establish, then send file
      setTimeout(() => {
        const file = fileToSendRef.current;
        if (file && dataChannel) {
          console.log("Starting file transfer for:", file.name);
          sendFileUtil(file, dataChannel, setProgress, setStatus);
        } else {
          console.error("Cannot send: no file or channel", { 
            hasFile: !!file, 
            hasChannel: !!dataChannel 
          });
          setStatus("error");
        }
      }, 1000);
    } catch (error) {
      console.error("Error handling answer code:", error);
      setStatus("error");
    }
  }, [peerConnection, dataChannel]);

  const reset = useCallback(() => {
    console.log("Resetting connection");
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
    fileToSendRef.current = null;
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