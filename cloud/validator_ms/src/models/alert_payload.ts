export interface AlertPayload {
  timestamp: number[];
  alert_message: string;
  house_id?: string;
  metrics?: Record<string, number>;
}
