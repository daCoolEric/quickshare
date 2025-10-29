// simpleSignaling.ts - Simple Peer ID based signaling

// Generate a simple 6-digit peer ID
export const generatePeerId = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store pending connections in memory (works for same browser tab sessions)
interface PendingConnection {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
  timestamp: number;
}

class SimpleSignaling {
  private connections: Map<string, PendingConnection> = new Map();
  private readonly EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

  // Cleanup old connections
  private cleanup() {
    const now = Date.now();
    for (const [id, conn] of this.connections.entries()) {
      if (now - conn.timestamp > this.EXPIRY_TIME) {
        this.connections.delete(id);
      }
    }
  }

  // Sender: Store offer and wait for answer
  storeOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit,
    fileInfo: { name: string; size: number; type: string }
  ): void {
    this.cleanup();
    this.connections.set(peerId, {
      offer,
      fileInfo,
      iceCandidates: [],
      timestamp: Date.now(),
    });
    console.log(`Stored offer for peer: ${peerId}`);
  }

  // Receiver: Get offer and store answer
  async getOfferAndStoreAnswer(
    peerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<{
    offer: RTCSessionDescriptionInit;
    fileInfo: { name: string; size: number; type: string };
  } | null> {
    this.cleanup();
    const connection = this.connections.get(peerId);
    if (!connection || !connection.offer || !connection.fileInfo) {
      console.error(`No offer found for peer: ${peerId}`);
      return null;
    }

    // Store the answer
    connection.answer = answer;
    connection.timestamp = Date.now();
    this.connections.set(peerId, connection);
    console.log(`Stored answer for peer: ${peerId}`);

    return {
      offer: connection.offer,
      fileInfo: connection.fileInfo,
    };
  }

  // Get offer for receiver
  getOffer(peerId: string): {
    offer: RTCSessionDescriptionInit;
    fileInfo: { name: string; size: number; type: string };
  } | null {
    this.cleanup();
    const connection = this.connections.get(peerId);
    if (!connection || !connection.offer || !connection.fileInfo) {
      console.error(`No offer found for peer: ${peerId}`);
      return null;
    }
    console.log(`Retrieved offer for peer: ${peerId}`);
    return {
      offer: connection.offer,
      fileInfo: connection.fileInfo,
    };
  }
  getAnswer(peerId: string): RTCSessionDescriptionInit | null {
    this.cleanup();
    const connection = this.connections.get(peerId);
    if (!connection || !connection.answer) {
      return null;
    }
    console.log(`Retrieved answer for peer: ${peerId}`);
    return connection.answer;
  }

  // Store ICE candidates
  storeIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.iceCandidates.push(candidate);
      connection.timestamp = Date.now();
      this.connections.set(peerId, connection);
    }
  }

  // Get ICE candidates
  getIceCandidates(peerId: string): RTCIceCandidateInit[] {
    const connection = this.connections.get(peerId);
    return connection?.iceCandidates || [];
  }

  // Clean up after connection
  removeConnection(peerId: string): void {
    this.connections.delete(peerId);
    console.log(`Removed peer: ${peerId}`);
  }
}

// Export singleton instance
export const signaling = new SimpleSignaling();

// Alternative: Use localStorage for cross-tab communication
export class LocalStorageSignaling {
  private readonly PREFIX = "file_transfer_";

  storeOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit,
    fileInfo: { name: string; size: number; type: string }
  ): void {
    const data = {
      offer,
      fileInfo,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${this.PREFIX}${peerId}`, JSON.stringify(data));
    console.log(`Stored offer in localStorage: ${peerId}`);
  }

  getOffer(peerId: string): {
    offer: RTCSessionDescriptionInit;
    fileInfo: { name: string; size: number; type: string };
  } | null {
    const data = localStorage.getItem(`${this.PREFIX}${peerId}`);
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      // Check if expired (5 minutes)
      if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
        localStorage.removeItem(`${this.PREFIX}${peerId}`);
        return null;
      }
      return { offer: parsed.offer, fileInfo: parsed.fileInfo };
    } catch {
      return null;
    }
  }

  storeAnswer(peerId: string, answer: RTCSessionDescriptionInit): void {
    localStorage.setItem(
      `${this.PREFIX}${peerId}_answer`,
      JSON.stringify(answer)
    );
    console.log(`Stored answer in localStorage: ${peerId}`);
  }

  getAnswer(peerId: string): RTCSessionDescriptionInit | null {
    const data = localStorage.getItem(`${this.PREFIX}${peerId}_answer`);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  cleanup(peerId: string): void {
    localStorage.removeItem(`${this.PREFIX}${peerId}`);
    localStorage.removeItem(`${this.PREFIX}${peerId}_answer`);
  }
}

export const localStorageSignaling = new LocalStorageSignaling();
