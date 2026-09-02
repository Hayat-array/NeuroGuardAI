/**
 * useSocketIO.js — Custom hook for Socket.IO connection
 *
 * Connects directly to the backend URL (not through the Vite proxy) because
 * Socket.IO uses its own HTTP handshake and WebSocket upgrade, which the
 * proxy does not forward correctly.
 *
 * Exposes:
 *   - connected     : boolean
 *   - eegData       : number[] (rolling 200-point buffer, updated each eeg_data event)
 *   - prediction    : number (0–1, latest seizure probability)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_POINTS = 200;

export function useSocketIO() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [prediction, setPrediction] = useState(0);

  // Mutable ref so EEG chart can read without re-renders
  const eegBufferRef = useRef(new Array(MAX_POINTS).fill(0));
  const [eegTick, setEegTick] = useState(0); // increment to signal chart update

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("eeg_data", (msg) => {
      const chunk = msg.data || [];
      const buf = eegBufferRef.current;
      buf.splice(0, chunk.length);
      buf.push(...chunk);
      setEegTick((t) => t + 1); // trigger chart update
    });

    socket.on("prediction", (msg) => {
      setPrediction(Number(msg.probability) || 0);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected, eegBufferRef, eegTick, setEegTick, prediction, setPrediction };
}
