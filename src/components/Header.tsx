import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Moon, Sun, Settings, User, LogOut, Shield, Info, Bell, Check, 
  ChevronDown, ChevronUp, Search, Plus, LayoutDashboard, 
  ClipboardList, FlaskConical, Play, Repeat, Kanban, TrendingUp, Cpu, Users
} from 'lucide-react';
import KrigzisLogo from '@/components/branding/KrigzisLogo';
import { ProjectPicker } from '@/components/ProjectPicker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { SettingsModal } from '@/components/SettingsModal';
import { ProfileModal } from '@/components/ProfileModal';
import { NotificationModal, type NotificationItem } from '@/components/NotificationModal';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';

const ROLE_INFO: Record<string, { name: string; color: string; badge: string }> = {
  master:  { name: 'Master',         color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  admin:   { name: 'Administrador',  color: 'text-red-400',    badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  manager: { name: 'Gerente',        color: 'text-blue-400',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  tester:  { name: 'Testador',       color: 'text-emerald-400',badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  viewer:  { name: 'Visualizador',   color: 'text-zinc-400',   badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export const Header = () => {
  const location = useLocation();
  const { mode, toggleMode } = useTheme();
  const { user, signOut } = useAuth();
  const { role } = usePermissions();
  const navigate = useNavigate();

  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Global hotkey: Ctrl+K or Cmd+K to open Command Palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const unreadCount = notifs.filter(n => !n.read_at).length;

  // ── Initial fetch ───────────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    const { data } = await apiClient
      .from('notifications' as any)
      .select('id, title, body, link, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifs(data as NotificationItem[]);
  }, [user]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // ── SSE: real-time push ────────────────────────────────────────────────────
  useNotificationSSE({
    userId: user?.id,
    onNotification: (payload) => {
      setNotifs(prev => {
        const exists = prev.some(n => n.id === payload.id);
        if (exists) return prev;
        return [payload, ...prev];
      });
    },
  });

  // ── Group-allocation notification (on login) ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const checkGroup = async () => {
      const { data: members } = await apiClient
        .from('group_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (members && members.length > 0) return;

      const { data: existing } = await apiClient
        .from('notifications' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('title', 'Alocação de Grupo Pendente')
        .is('read_at', null)
        .limit(1);

      if (existing && existing.length > 0) return;

      await apiClient.from('notifications' as any).insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        title: 'Alocação de Grupo Pendente',
        body: 'Você não está vinculado a nenhum grupo. Solicite a um administrador sua alocação em um time.',
        created_at: new Date().toISOString(),
      });
    };
    checkGroup();
  }, [user]);

  // ── Mark as read ───────────────────────────────────────────────────────────
  const markAsRead = async (id: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    await apiClient
      .from('notifications' as any)
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifs.filter(n => !n.read_at).map(n => n.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    await apiClient
      .from('notifications' as any)
      .update({ read_at: now })
      .in('id', unreadIds)
      .eq('user_id', user.id);
    setNotifs(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read_at: now } : n));
  };

  const visibleNotifs = showAllNotifs ? notifs : notifs.slice(0, 3);

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs border-b border-border">
        <div className="flex items-center justify-between px-4 sm:px-6 h-[70px] gap-4">
          {/* Lado Esquerdo: Mobile Logo + Seletor de Projeto */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Logo visível apenas no mobile (onde a sidebar fica recolhida) */}
            <div className="flex items-center gap-2 lg:hidden">
              <KrigzisLogo size={22} className="h-5 w-5" />
              <span className="font-bold text-base text-foreground">Nexus</span>
            </div>
            
            {/* Seletor de Projeto enriquecido */}
            <ProjectPicker />
          </div>

          {/* Centro: Barra de Comando Global / Busca Rápida (Elimina espaço em branco) */}
          <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
            <button
              onClick={() => setCommandOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-md border border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-border text-xs text-muted-foreground transition-all shadow-xs group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                <span className="group-hover:text-foreground/90 transition-colors">Buscar casos, planos, execuções...</span>
              </div>
              <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-[10px]">Ctrl</span>K
              </kbd>
            </button>
          </div>

          {/* Lado Direito: Ações Rápidas + Notificações + Tema + Card de Usuário */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Botão de Criação Rápida */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  variant="default"
                  className="h-9 px-3 gap-1.5 text-xs font-semibold hidden sm:inline-flex shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Criar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/cases?create=true')}>
                  <FlaskConical className="mr-2 h-4 w-4 text-teal-400" />
                  <span>Novo Caso de Teste</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/plans?create=true')}>
                  <ClipboardList className="mr-2 h-4 w-4 text-purple-400" />
                  <span>Novo Plano de Teste</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/executions?create=true')}>
                  <Play className="mr-2 h-4 w-4 text-emerald-400" />
                  <span>Nova Execução</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/runs?create=true')}>
                  <Repeat className="mr-2 h-4 w-4 text-amber-400" />
                  <span>Novo Ciclo (Run)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Tema Claro/Escuro */}
            <Button variant="ghost" size="icon" onClick={toggleMode} className="h-9 w-9 rounded-md">
              {mode === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            {/* ── Notificações com Indicador Pulse ─── */}
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-md group"
                  aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
                >
                  <Bell
                    className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                      unreadCount > 0 ? 'text-brand animate-bell-pulse' : ''
                    }`}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute 1.5 1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-[9px] text-white font-bold border-2 border-background shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-semibold">Notificações</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                      className="text-[10px] text-brand hover:text-brand/80 flex items-center gap-1 font-bold"
                    >
                      <Check className="h-3 w-3" />
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3">Nenhuma notificação no momento.</div>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    {visibleNotifs.map((n) => (
                      <div
                        key={n.id}
                        className={`group relative px-3 py-3 text-sm cursor-pointer border-b border-border/50 last:border-0 ${
                          n.read_at ? 'opacity-70 bg-muted/30' : 'bg-background font-medium'
                        } hover:bg-accent/50 transition-colors`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropdownOpen(false);
                          setShowNotifModal(true);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{n.title}</div>
                            {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {new Date(n.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex border-t border-border">
                      <button
                        onClick={() => setShowAllNotifs(!showAllNotifs)}
                        className="flex-1 py-2.5 text-[11px] text-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1 border-r border-border"
                      >
                        {showAllNotifs
                          ? <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
                          : <><ChevronDown className="h-3 w-3" /> Carregar todas ({notifs.length})</>
                        }
                      </button>
                      <button
                        onClick={() => { setDropdownOpen(false); setShowNotifModal(true); }}
                        className="flex-1 py-2.5 text-[11px] text-center text-brand font-semibold hover:bg-brand/5 transition-colors flex items-center justify-center gap-1"
                      >
                        Visualizar todas
                      </button>
                    </div>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── User Card & Dropdown ─── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="h-9 px-2 sm:px-2.5 gap-2 rounded-md border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-border transition-all shadow-xs"
                >
                  <UserAvatar 
                    userId={user?.id} 
                    name={user?.user_metadata?.full_name || user?.email} 
                    size="sm" 
                    className="h-6 w-6 rounded-md border border-border/60" 
                  />
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[100px]">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-tight uppercase tracking-wider font-semibold">
                      {ROLE_INFO[role || 'viewer']?.name || 'Membro'}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/70 hidden sm:block ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate font-semibold">{user?.user_metadata?.full_name || user?.email}</div>
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    <Shield className={`h-3 w-3 mr-1 ${ROLE_INFO[role || 'viewer']?.color || ''}`} />
                    {ROLE_INFO[role || 'viewer']?.name || 'Usuário'}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowProfile(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSettings(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.location.href = '/about'}>
                  <Info className="mr-2 h-4 w-4" />
                  Sobre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-rose-500 focus:text-rose-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Global Command Palette Dialog (Ctrl+K) ─── */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Digite para buscar telas, planos, casos ou ações..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação Rápida">
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/'); }}>
              <LayoutDashboard className="mr-2 h-4 w-4 text-blue-400" />
              <span>Dashboard Principal</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/plans'); }}>
              <ClipboardList className="mr-2 h-4 w-4 text-purple-400" />
              <span>Planos de Teste</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/cases'); }}>
              <FlaskConical className="mr-2 h-4 w-4 text-teal-400" />
              <span>Casos de Teste</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/executions'); }}>
              <Play className="mr-2 h-4 w-4 text-green-400" />
              <span>Execuções de Teste</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/runs'); }}>
              <Repeat className="mr-2 h-4 w-4 text-amber-400" />
              <span>Ciclos de Teste (Runs)</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/management'); }}>
              <Kanban className="mr-2 h-4 w-4 text-orange-400" />
              <span>Gestão & Defeitos</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/reports'); }}>
              <TrendingUp className="mr-2 h-4 w-4 text-pink-400" />
              <span>Relatórios Executivos</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Administração & Configurações">
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/user-management'); }}>
              <Users className="mr-2 h-4 w-4 text-emerald-400" />
              <span>Gerenciamento de Usuários & Equipes</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); navigate('/model-control'); }}>
              <Cpu className="mr-2 h-4 w-4 text-cyan-400" />
              <span>Configuração de IA (Model Control)</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); setShowProfile(true); }}>
              <User className="mr-2 h-4 w-4 text-violet-400" />
              <span>Meu Perfil</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); setShowSettings(true); }}>
              <Settings className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Preferências do Sistema</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      <NotificationModal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        notifications={notifs}
        onMarkRead={markAsRead}
        onMarkAllRead={markAllAsRead}
      />
    </>
  );
};
