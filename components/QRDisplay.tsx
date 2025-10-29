"use client";
import { QRCodeCanvas } from "qrcode.react";

export default function QrDisplay({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-gray-600 text-sm">
        Scan this QR code on the receiver device
      </p>
      <QRCodeCanvas value={value} size={200} includeMargin />
    </div>
  );
}
