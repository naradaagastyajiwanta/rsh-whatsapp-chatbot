export interface DailyMetric {
  api_calls: number;
  total_response_time: number;
  error_count: number;
}

export interface PerformanceMetrics {
  api_calls: number;
  total_response_time: number;
  average_response_time: number;
  success_rate: number;
  error_count: number;
  daily_metrics: {
    [date: string]: DailyMetric;
  };
}

export interface UserInsight {
  name: string | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  location: string | null;
  health_complaints: string[];
  symptoms: string[];
  medical_history: string | null;
  urgency_level: 'low' | 'medium' | 'high' | null;
  emotion: 'positive' | 'neutral' | 'negative' | null;
  conversion_barriers: string[];
  interest_level: 'low' | 'medium' | 'high' | null;
  program_awareness: 'none' | 'basic' | 'detailed' | null;
  timestamp: string;
}

export interface UserDetails {
  name: string | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  location: string | null;
  health_complaints: string[];
  conversion_barriers: string[];
  first_interaction: string;
  last_interaction: string;
}

export interface UserInteraction {
  timestamp: string;
  analysis: UserInsight;
}

export interface UserHistory {
  interactions: UserInteraction[];
  latest_analysis: UserInsight;
  first_interaction: string;
  details: UserDetails;
}

export interface UserData {
  interactions: UserInteraction[];
  latest_analysis: UserInsight;
  first_interaction: string;
  details: UserDetails;
}

export interface UserAnalytics {
  total_users: number;
  active_users: number;
  new_users: number;
  users: {
    [phone: string]: UserData;
  };
}
