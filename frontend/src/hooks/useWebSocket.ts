"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSEvent } from "@/types";
import { useToast } from "@/context/ToastContext";

// Dynamically resolve WebSocket URL based on current host (supports tunnels)
const getWsUrl = () => {
  if (typeof window === "undefined") return "ws://localhost:8000/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // In production/tunnel mode, WS goes through same host; in dev, direct to backend
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "ws://localhost:8000/ws";
  }
  // For tunneled/deployed environments, WS won't work through HTTP proxy
  // so we gracefully disable it (the app works fine without real-time updates)
  return "";
};
const WS_URL = getWsUrl();
const RECONNECT_DELAY = 3000;
const MAX_RETRIES = 10;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const { addToast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!WS_URL) return; // No WebSocket in tunnel/deployed mode

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          setLastEvent(data);

          // Handle specific event types with toasts
          if (data.type === "prescription_action") {
            const d = data.data;
            const actionLabels: Record<string, string> = {
              approve: "approved",
              deny: "denied",
              request_review: "sent for review",
              send_to_prescriber: "sent to prescriber",
            };
            const actionLabel = actionLabels[d.action] || d.action;
            addToast({
              type: d.action === "deny" ? "error" : d.action === "approve" ? "success" : "info",
              title: `Prescription ${actionLabel}`,
              message: `${d.drug_name} for ${d.patient_name}`,
              link: `/prescriptions/${d.prescription_id}`,
            });
          } else if (data.type === "new_prescription") {
            const d = data.data;
            const colorMap: Record<string, "error" | "warning" | "success"> = {
              RED: "error",
              YELLOW: "warning",
              GREEN: "success",
            };
            addToast({
              type: colorMap[d.flag_color] || "info",
              title: `New Prescription · ${d.flag_color}`,
              message: `${d.drug_name} for ${d.patient_name} (${d.flag_count} flags)`,
              link: `/prescriptions/${d.prescription_id}`,
            });
          }
        } catch {
          // Invalid message, ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current += 1;
          setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // WebSocket not available, silent fail
    }
  }, [addToast]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  // Heartbeat / ping every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return { connected, lastEvent };
}
