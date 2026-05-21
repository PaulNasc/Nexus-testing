import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Users, FileText, FlaskConical, Play, Bug,
  Sparkles, Check, AlertTriangle, Clock, ExternalLink,
  ShieldAlert, UserPlus, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

function resolveNotificationIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('grupo') || t.includes('group') || t.includes('alocaç')) return { Icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  if (t.includes('plano') || t.includes('plan')) return { Icon: FileText, color: 'text-brand', bg: 'bg-brand/10' };
  if (t.includes('caso') || t.includes('case')) return { Icon: FlaskConical, color: 'text-teal-500', bg: 'bg-teal-500/10' };
  if (t.includes('execuç') || t.includes('execution') || t.includes('ciclo')) return { Icon: Play, color: 'text-green-500', bg: 'bg-green-500/10' };
  if (t.includes('defeito') || t.includes('defect') || t.includes('bug')) return { Icon: Bug, color: 'text-destructive', bg: 'bg-destructive/10' };
  if (t.includes('ia') || t.includes('ai') || t.includes('modelo')) return { Icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10' };
  if (t.includes('pendente') || t.includes('pending') || t.includes('solicita')) return { Icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' };
  if (t.includes('segurança') || t.includes('security') || t.includes('acesso')) return { Icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' };
  if (t.includes('usuário') || t.includes('user') || t.includes('convite')) return { Icon: UserPlus, color: 'text-blue-400', bg: 'bg-blue-400/10' };
  if (t.includes('configur') || t.includes('config')) return { Icon: Settings, color: 'text-muted-foreground', bg: 'bg-muted/30' };
  if (t.includes('alerta') || t.includes('warning')) return { Icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' };
  return { Icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted/20' };
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

export const NotificationModal = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationModalProps) => {
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const handleClick = async (n: NotificationItem) => {
    if (!n.read_at) await onMarkRead(n.id);
    if (n.link) {
      onClose();
      setTimeout(() => navigate(n.link!), 100);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="h-4 w-4" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-[1.1rem] rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </DialogTitle>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-brand hover:text-brand/80 font-medium transition-colors"
              >
                <Check className="h-3 w-3" />
                Marcar todas lidas
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Você está em dia com tudo.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map((n) => {
                const { Icon, color, bg } = resolveNotificationIcon(n.title);
                const isUnread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-5 py-4 flex items-start gap-3 transition-colors hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/30',
                      isUnread ? 'bg-brand/3' : 'opacity-75'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5', bg)}>
                      <Icon className={cn('h-4 w-4', color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('text-sm leading-snug', isUnread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      {n.link && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-brand mt-1.5 font-medium">
                          <ExternalLink className="h-2.5 w-2.5" />
                          Ver detalhes
                        </span>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-brand" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-border/60 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
