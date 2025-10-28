// webrtc.ts
import { Status } from "./types";

export const createPeerConnection = (
  onStatusChange: (status: Status) => void
): RTCPeerConnection => {
  const pc = new RTCPeerConnection({
    iceServers: [], // Empty for true offline - rely only on local network
  });

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "connected") {
      onStatusChange("connected");
    } else if (pc.iceConnectionState === "failed") {
      onStatusChange("failed");
    } else if (pc.iceConnectionState === "disconnected") {
      onStatusChange("disconnected");
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
  };

  return pc;
};

export const waitForIceGathering = (pc: RTCPeerConnection): Promise<void> => {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
    } else {
      const checkState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", checkState);

      // Timeout fallback
      setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }, 2000);
    }
  });
};
