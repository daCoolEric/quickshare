// QRCodeDisplay.tsx
import { Copy } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

interface QRCodeDisplayProps {
  code: string;
  title: string;
  subtitle?: string;
}

export default function QRCodeDisplay({
  code,
  title,
  subtitle,
}: QRCodeDisplayProps) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
        {title}
      </p>
      <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center mb-4">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            code
          )}`}
          alt="QR Code"
          className="w-64 h-64"
        />
      </div>
      <p className="text-xs text-gray-500 text-center mb-4">
        {subtitle || `Code: ${code.substring(0, 20)}...`}
      </p>
      <button
        onClick={() => copyToClipboard(code)}
        className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
      >
        <Copy className="w-4 h-4" />
        Copy Code
      </button>
    </div>
  );
}
