"use client";

import { useState } from "react";
import { createOffer } from "@/lib/webrtc";
import QrDisplay from "@/components/QRDisplay";

export default function SenderPage() {
  const [offer, setOffer] = useState("");
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);
  const [channel, setChannel] = useState<RTCDataChannel | null>(null);

  const start = async () => {
    const { offer, peerConnection, dataChannel } = await createOffer();
    setOffer(offer);
    setPeer(peerConnection);
    setChannel(dataChannel);
  };

  const handleAnswerPaste = async (answer: string) => {
    if (!peer) return;
    const answerDesc = JSON.parse(answer);
    await peer.setRemoteDescription(answerDesc);
    alert("Connection established!");
    channel?.send("Hello from Sender!");
  };

  return (
    <div className="p-6 flex flex-col items-center space-y-4">
      <h1 className="text-xl font-semibold">📤 Sender</h1>

      {!offer ? (
        <button
          onClick={start}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Create Offer
        </button>
      ) : (
        <>
          <QrDisplay value={offer} />
          <textarea
            className="border p-2 w-full mt-2 rounded"
            placeholder="Paste receiver's answer here..."
            onBlur={(e) => handleAnswerPaste(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
