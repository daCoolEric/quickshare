// useSimpleFileTransfer.ts - Much simpler approach
import { useState, useRef, useCallback } from "react";
import { Status, FileInfo } from "../utils/types";
import { createPeerConnection, waitForIceGathering } from "../utils/webrtc";
import {
  sendFile as sendFileUtil,
  completeFileDownload,
} from "../utils/fileTransfer";
import { generatePeerId, signaling } from "../utils/simpleSignaling";

export const useSimpleFileTransfer = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [peerId, setPeerId] = useState("");
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [receivedFileName, setReceivedFileName] = useState("");

  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentFileInfoRef = useRef<FileInfo | null>(null);
  const fileToSendRef = useRef<File | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const setupSender = useCallback(async (file: File) => {
    console.log("Setting up sender for:", file.name);
    setStatus("preparing");
    fileToSendRef.current = file;

    const newPeerId = generatePeerId();
    setPeerId(newPeerId);

    try {
      const pc = createPeerConnection(setStatus);
      setPeerConnection(pc);

      const channel = pc.createDataChannel("fileTransfer", {
        ordered: true,
        maxRetransmits: 30,
      });

      channel.onopen = () => {
        console.log("Data channel opened - starting file transfer");
        const fileToSend = fileToSendRef.current;
        if (fileToSend) {
          sendFileUtil(fileToSend, channel, setProgress, setStatus);
        }
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

      // Store offer with peer ID
      signaling.storeOffer(newPeerId, pc.localDescription!, {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setStatus("waiting");
      console.log(`Share this code with receiver: ${newPeerId}`);

      // Poll for answer
      startPollingForAnswer(newPeerId, pc);
    } catch (error) {
      console.error("Error setting up sender:", error);
      setStatus("error");
    }
  }, []);

  const startPollingForAnswer = (peerId: string, pc: RTCPeerConnection) => {
    pollingIntervalRef.current = setInterval(async () => {
      const answer = signaling.getAnswer(peerId);
      if (answer) {
        console.log("Answer received, establishing connection");
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;

        try {
          await pc.setRemoteDescription(answer);
          setStatus("connecting");
        } catch (error) {
          console.error("Error setting remote description:", error);
          setStatus("error");
        }
      }
    }, 1000); // Check every second

    // Stop polling after 5 minutes
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        if (status === "waiting") {
          setStatus("error");
        }
      }
    }, 5 * 60 * 1000);
  };

  const connectAsReceiver = useCallback(
    async (peerIdInput: string) => {
      console.log("Receiver: Connecting with peer ID:", peerIdInput);
      setStatus("connecting");
      setPeerId(peerIdInput);

      try {
        const pc = createPeerConnection(setStatus);
        setPeerConnection(pc);

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

        // Get offer from signaling
        const data = signaling.getOffer(peerIdInput);
        if (!data) {
          throw new Error(`No connection found for peer ID: ${peerIdInput}`);
        }

        currentFileInfoRef.current = data.fileInfo;
        setReceivedFileName(data.fileInfo.name);

        await pc.setRemoteDescription(data.offer);
        console.log("Remote offer set");

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("Local answer created");

        await waitForIceGathering(pc);

        // Store answer
        await signaling.getOfferAndStoreAnswer(
          peerIdInput,
          pc.localDescription!
        );

        setStatus("ready_to_receive");
        console.log("Answer stored, waiting for connection");
      } catch (error) {
        console.error("Error connecting as receiver:", error);
        setStatus("error");
      }
    },
    [status]
  );

  const reset = useCallback(() => {
    console.log("Resetting connection");

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (peerId) {
      signaling.removeConnection(peerId);
    }

    peerConnection?.close();
    dataChannel?.close();

    setStatus("idle");
    setProgress(0);
    setPeerId("");
    setPeerConnection(null);
    setDataChannel(null);
    setReceivedFileName("");
    receivedChunksRef.current = [];
    currentFileInfoRef.current = null;
    fileToSendRef.current = null;
  }, [peerConnection, dataChannel, peerId]);

  return {
    status,
    progress,
    peerId,
    receivedFileName,
    setupSender,
    connectAsReceiver,
    reset,
  };
};
