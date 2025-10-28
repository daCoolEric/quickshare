// ProgressBar.tsx
import { Check } from "lucide-react";
import { Status } from "../utils/types";

interface ProgressBarProps {
  progress: number;
  status: Status;
  mode: "send" | "receive";
}

export default function ProgressBar({
  progress,
  status,
  mode,
}: ProgressBarProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>{mode === "send" ? "Transfer" : "Download"} Progress</span>
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
            File {mode === "send" ? "sent" : "downloaded"} successfully!
          </p>
        </div>
      )}
    </div>
  );
}
