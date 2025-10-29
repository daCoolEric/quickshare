"use client";

import { useState } from "react";
import { createAnswer } from "@/lib/webrtc";
import QrScanner from "@/components/QRScanner";

export default function ReceiverPage() {
  const [answer, setAnswer] = useState("");
  const [connected, setConnected] = useState(false);

  const handleScan = async (offer: string) => {
    const { answer: answerSdp, peerConnection } = await createAnswer(offer);
    setAnswer(answerSdp);
    setConnected(true);
    console.log("Answer created:", answerSdp);

    // This can later be sent back to sender automatically via DataChannel or QR code.
    peerConnection.ondatachannel = (event) => {
      event.channel.onmessage = (e) => alert("Received: " + e.data);
    };
  };

  return (
    <div className="p-6 flex flex-col items-center space-y-4">
      <h1 className="text-xl font-semibold">📥 Receiver</h1>
      {!connected ? (
        <QrScanner onScan={handleScan} />
      ) : (
        <>
          <p>✅ Connection established.</p>
          <textarea
            readOnly
            className="border p-2 w-full rounded text-xs"
            value={answer}
          />
          <p className="text-sm text-gray-600">
            Copy and send this answer back to the sender.
          </p>
        </>
      )}
    </div>
  );
}
