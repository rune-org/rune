import type { CreateClientConfig } from "./client/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
  credentials: "include", // Include cookies in requests
  throwOnError: true, // Throw on non-2xx responses to prevent false success feedback
});
