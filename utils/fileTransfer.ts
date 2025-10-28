// fileTransfer.ts
import { Status, FileInfo } from "./types";

const CHUNK_SIZE = 16 * 1024; // 16KB chunks

export const sendFile = async (
  file: File,
  dataChannel: RTCDataChannel,
  onProgress: (progress: number) => void,
  onStatusChange: (status: Status) => void
): Promise<void> => {
  if (!dataChannel || dataChannel.readyState !== "open") {
    console.error("Cannot send file: channel not ready");
    onStatusChange("error");
    return;
  }

  onStatusChange("sending");
  let offset = 0;

  try {
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await chunk.arrayBuffer();

      dataChannel.send(arrayBuffer);

      offset += arrayBuffer.byteLength;
      const newProgress = Math.round((offset / file.size) * 100);
      onProgress(newProgress);

      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    dataChannel.send(JSON.stringify({ type: "EOF" }));
    console.log("File transfer complete");
    onStatusChange("complete");
  } catch (error) {
    console.error("Error sending file:", error);
    onStatusChange("error");
  }
};

export const completeFileDownload = (
  receivedChunks: ArrayBuffer[],
  fileInfo: FileInfo,
  onStatusChange: (status: Status) => void,
  onProgress: (progress: number) => void
): void => {
  try {
    const blob = new Blob(receivedChunks, { type: fileInfo.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileInfo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onStatusChange("complete");
    onProgress(100);
  } catch (error) {
    console.error("Error completing file download:", error);
    onStatusChange("error");
  }
};
