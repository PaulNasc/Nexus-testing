import { useEffect, useRef, useCallback } from 'react';

type SSENotificationPayload = {
  type: 'notification';
  payload: {
    id: string;
    user_id: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: string;
    read_at: string | null;
  };
};

type UseNotificationSSEOptions = {
  userId: string | undefined;
  onNotification: (payload: SSENotificationPayload['payload']) => void;
};

const TOKEN_KEY = 'krg_local_auth_token';

export function useNotificationSSE({ userId, onNotification }: UseNotificationSSEOptions) {
  const esRef = useRef<EventSource | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const connect = useCallback(() => {
    if (!userId) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSENotificationPayload;
        if (data.type === 'notification') {
          onNotificationRef.current(data.payload);
        }
      } catch { /* ignore malformed events */ }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Reconnect after 5s on error (network hiccup, server restart)
      setTimeout(connect, 5000);
    };
  }, [userId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
