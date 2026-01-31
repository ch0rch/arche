/**
 * UI types for workspace components.
 * These are the shapes expected by UI components, independent of the OpenCode SDK types.
 */

export type ChatSession = {
  id: string;
  title: string;
  status: "active" | "idle" | "archived";
  updatedAt: string;
  agent: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: Array<{
    type: "file" | "snippet";
    label: string;
    path?: string;
  }>;
};
