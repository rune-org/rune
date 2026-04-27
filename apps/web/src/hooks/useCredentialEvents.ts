"use client";

import { useEffect, useRef } from "react";
import { client } from "@/client/client.gen";

// Create a custom event name
export const CREDENTIAL_CHANGED_EVENT = "rune:credential_changed";

/**
 * Hook to listen to global credential events (deleted, updated, shared) via SSE.
 * When an event is received, it dispatches a window event so components like
 * CredentialSelector can react instantly.
 */
export function useCredentialEvents() {
  const isConnected = useRef(false);

  useEffect(() => {
    if (isConnected.current) return;
    isConnected.current = true;

    const abortController = new AbortController();

    const connect = async () => {
      try {
        const { stream } = await client.sse.get({
          url: "/credentials/events",
          signal: abortController.signal,
          credentials: "include",
          onSseEvent: (event) => {
            if (event.data) {
              // Dispatch event to window
              window.dispatchEvent(
                new CustomEvent(CREDENTIAL_CHANGED_EVENT, { detail: event.data }),
              );
            }
          },
          onSseError: (err: unknown) => {
            if (
              (err instanceof Error && err.name === "AbortError") ||
              abortController.signal.aborted
            )
              return;
            console.error("Credential SSE Error:", err);
          },
        });

        // Start consuming the stream
        for await (const _ of stream) {
          // just consume
        }
      } catch (err: unknown) {
        if (
          !abortController.signal.aborted &&
          !(err instanceof Error && err.name === "AbortError")
        ) {
          console.error("Credential SSE failed:", err);
        }
      }
    };

    void connect();

    return () => {
      isConnected.current = false;
      abortController.abort();
    };
  }, []);
}
