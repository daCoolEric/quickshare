// /lib/webrtc.ts
export async function createOffer() {
  const peerConnection = new RTCPeerConnection();

  // For data transfer
  const dataChannel = peerConnection.createDataChannel("p2p");
  dataChannel.onopen = () => console.log("Data channel open!");
  dataChannel.onmessage = (e) => console.log("Received:", e.data);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  return {
    offer: JSON.stringify(offer),
    peerConnection,
    dataChannel,
  };
}

export async function createAnswer(offerSdp: string) {
  const peerConnection = new RTCPeerConnection();

  peerConnection.ondatachannel = (event) => {
    const channel = event.channel;
    channel.onopen = () => console.log("Connected!");
    channel.onmessage = (e) => console.log("Got message:", e.data);
  };

  const offer = JSON.parse(offerSdp);
  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  return {
    answer: JSON.stringify(answer),
    peerConnection,
  };
}
