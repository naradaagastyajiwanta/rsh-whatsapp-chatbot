export interface Message {
  id: string;
  content: string;
  timestamp: string;
  isFromUser: boolean;
}

export interface Chat {
  id: string;
  sender: string;
  senderName?: string;
  lastMessage: string;
  lastTimestamp: string;
  messages: Message[];
  botEnabled?: boolean;
  unansweredCount?: number;
}

export interface ChatStats {
  totalChatsToday: number;
  totalChatsThisWeek: number;
  activeUsers: number;
  averageResponseTime: number;
  totalMessages?: number;
  totalConversations?: number;
  uniqueUsers?: number;
}
