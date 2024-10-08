import { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";
import { baseUrl } from "@/services/jenkinsService";

const SOCKET_SERVER_URL = baseUrl;

export const useLogStream = (jobName: string, buildNumber: string) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectToSocket = useCallback(() => {
    const socket = io(SOCKET_SERVER_URL, {
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      socket.emit("subscribe_log", { jobName, buildNumber });
    });

    socket.on("log_update", (data) => {
      setLogs((prevLogs) => [...prevLogs, data.log]);
    });

    socket.on("log_end", () => {
      socket.disconnect();
    });

    socket.on("log_error", (data) => {
      setError(`Error: ${data.error}`);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [jobName, buildNumber]);

  useEffect(() => {
    const cleanup = connectToSocket();
    return cleanup;
  }, [connectToSocket]);

  return { logs, isConnected, error };
};
