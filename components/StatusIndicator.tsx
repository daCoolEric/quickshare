// StatusIndicator.tsx
import {
  Upload,
  Download,
  Wifi,
  WifiOff,
  Check,
  AlertCircle,
} from "lucide-react";
import { Status } from "../utils/types";

interface StatusIndicatorProps {
  status: Status;
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
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
}
