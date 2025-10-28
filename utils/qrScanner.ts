// qrScanner.ts
import jsQR from "jsqr";

export const startCamera = async (
  videoRef: HTMLVideoElement
): Promise<MediaStream> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  videoRef.srcObject = stream;
  await new Promise<void>((resolve) => {
    videoRef.onloadedmetadata = () => {
      videoRef.play();
      resolve();
    };
  });

  return stream;
};

export const stopCamera = (videoRef: HTMLVideoElement | null): void => {
  if (videoRef?.srcObject) {
    const stream = videoRef.srcObject as MediaStream;
    stream.getTracks().forEach((track) => track.stop());
    videoRef.srcObject = null;
  }
};

export const validateConnectionCode = (
  code: string
): { valid: boolean; type: "offer" | "answer" | null } => {
  try {
    const decoded = atob(code);
    const parsed = JSON.parse(decoded);

    if (parsed.offer && parsed.fileName) {
      return { valid: true, type: "offer" };
    }
    if (parsed.answer) {
      return { valid: true, type: "answer" };
    }
    return { valid: false, type: null };
  } catch (error) {
    return { valid: false, type: null };
  }
};

export const scanQRFromVideo = (
  videoRef: HTMLVideoElement,
  canvasRef: HTMLCanvasElement
): string | null => {
  const context = canvasRef.getContext("2d", { willReadFrequently: true });

  if (videoRef.readyState === videoRef.HAVE_ENOUGH_DATA && context) {
    canvasRef.width = videoRef.videoWidth;
    canvasRef.height = videoRef.videoHeight;
    context.drawImage(videoRef, 0, 0, canvasRef.width, canvasRef.height);

    const imageData = context.getImageData(
      0,
      0,
      canvasRef.width,
      canvasRef.height
    );
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (qrCode?.data) {
      const validation = validateConnectionCode(qrCode.data);
      if (validation.valid) {
        console.log(`Valid ${validation.type} QR code detected`);
        return qrCode.data;
      }
    }
  }

  return null;
};

export const getCameraErrorMessage = (error: unknown): string => {
  let errorMessage = "Camera access denied. Please enable camera permissions.";

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

  return errorMessage;
};
