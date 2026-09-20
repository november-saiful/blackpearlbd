import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 60_000, // Fallback if Realtime disconnects
  });

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    refetchInterval: 60_000, // Fallback if Realtime disconnects
  });

  // Supabase Realtime: live push for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Any change (INSERT or UPDATE) — refetch both queries
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: listQuery.data?.notifications || [],
    unreadCount: unreadQuery.data?.count || 0,
    isLoading: listQuery.isLoading,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
