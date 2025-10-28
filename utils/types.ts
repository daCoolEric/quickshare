// types.ts
export type Status =
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

export type Mode = "send" | "receive";

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export interface ConnectionData {
  offer: RTCSessionDescriptionInit;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface AnswerData {
  answer: RTCSessionDescriptionInit;
}
