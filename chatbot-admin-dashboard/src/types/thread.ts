export interface ThreadMessage {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  role: 'user' | 'assistant';
  content: {
    type: string;
    text: {
      value: string;
      annotations: any[];
    };
  }[];
  file_ids: string[];
  assistant_id: string | null;
  run_id: string | null;
  metadata: Record<string, any>;
}

export interface ThreadResponse {
  thread_id: string;
  messages: ThreadMessage[];
}
