import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { useProject } from '@/contexts/ProjectContext';
import { applyProjectTheme, resetProjectTheme } from '@/lib/theme/projectTheme';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { 
  Palette, Shield, Settings, Users,
  FileText, PlayCircle, BarChart3, Download,
  UserCog, TestTube, ExternalLink, Bell, History,
  Sparkles, CheckCircle2, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { settings: dashboardSettings, updateSettings: updateDashboardSettings } = useDashboardSettings();
  const { role, permissions, hasPermission, isAdmin } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentProject } = useProject();

  const [notifPrefs, setNotifPrefs] = useState({
    email_enabled: true,
    system_enabled: true,
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // Carregar preferências de notificação
  useEffect(() => {
    const loadPrefs = async () => {
      if (!isOpen || !user) return;
      try {
        setLoadingPrefs(true);
        const { data, error } = await apiClient
          .from('notification_preferences' as any)
          .select('email_enabled, system_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!error && data) {
          setNotifPrefs(data as any);
        }
      } catch (err) {
        console.error('Erro ao carregar preferências:', err);
      } finally {
        setLoadingPrefs(false);
      }
    };
    loadPrefs();
  }, [isOpen, user]);

  const updateNotifPref = async (key: keyof typeof notifPrefs, value: boolean) => {
    if (!user) return;
    const newPrefs = { ...notifPrefs, [key]: value };
    setNotifPrefs(newPrefs);
    
    try {
      const { error } = await apiClient
        .from('notification_preferences' as any)
        .upsert({ user_id: user.id, ...newPrefs }, { onConflict: 'user_id' } as any);
      
      if (error) throw error;
    } catch (err: any) {
      toast({
        title: "Erro ao salvar preferência",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    }
  };

  const canManageUsers = hasPermission('can_manage_users');
  const canManageAI = role === 'master' || isAdmin;

  const navigateTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 p-6 shadow-xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Configurações do Sistema
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Personalize sua experiência e preferências no sistema
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ─── Aparência e Interface ─── */}
          <Section title="Aparência e Interface" icon={Palette}>
            <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-4 shadow-2xs">
              {/* Toggle cores do projeto */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground">
                    Aplicar cores do projeto ao tema
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Quando ativo, a interface adota automaticamente a cor de destaque do projeto atual.
                  </p>
                </div>
                <Switch
                  id="apply-project-theme"
                  checked={dashboardSettings.applyProjectThemeEnabled}
                  onCheckedChange={(checked) => {
                    updateDashboardSettings({ applyProjectThemeEnabled: checked });
                    if (checked) {
                      const hex = currentProject?.color;
                      if (hex) applyProjectTheme(hex);
                    } else {
                      resetProjectTheme();
                    }
                  }}
                  className="data-[state=checked]:bg-brand"
                />
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="quick-action" className="text-xs font-semibold text-foreground">
                    Ação rápida do Dashboard
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Ação primária disparada pelo botão "+" no cabeçalho do painel
                  </p>
                </div>
                <Select
                  value={dashboardSettings.quickActionType}
                  onValueChange={(v: 'plan' | 'case' | 'execution') => updateDashboardSettings({ quickActionType: v })}
                >
                  <SelectTrigger id="quick-action" className="w-[140px] h-8 text-xs bg-background/60 border-border/70 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border/70">
                    <SelectItem value="plan" className="text-xs">Novo Plano</SelectItem>
                    <SelectItem value="case" className="text-xs">Novo Caso</SelectItem>
                    <SelectItem value="execution" className="text-xs">Nova Execução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* ─── Notificações ─── */}
          <Section title="Notificações e Alertas" icon={Bell}>
            <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground">
                    Notificações no Sistema
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Alertas em tempo real na central de notificações do cabeçalho
                  </p>
                </div>
                <Switch
                  checked={notifPrefs.system_enabled}
                  onCheckedChange={(v) => updateNotifPref('system_enabled', v)}
                  disabled={loadingPrefs}
                  className="data-[state=checked]:bg-brand"
                />
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground">
                    Resumos por E-mail
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Receba resumos de execuções de testes e alertas críticos
                  </p>
                </div>
                <Switch
                  checked={notifPrefs.email_enabled}
                  onCheckedChange={(v) => updateNotifPref('email_enabled', v)}
                  disabled={loadingPrefs}
                  className="data-[state=checked]:bg-brand"
                />
              </div>
            </div>
          </Section>

          {/* ─── Permissões do Usuário ─── */}
          <Section title="Suas Permissões de Acesso" icon={Shield}>
            <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-3 shadow-2xs">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <PermItem icon={UserCog} label="Gerenciar Usuários" enabled={permissions.can_manage_users} />
                <PermItem icon={FileText} label="Planos de Teste" enabled={permissions.can_manage_plans} />
                <PermItem icon={TestTube} label="Casos de Teste" enabled={permissions.can_manage_cases} />
                <PermItem icon={PlayCircle} label="Execuções" enabled={permissions.can_manage_executions} />
                <PermItem icon={Sparkles} label="Inteligência Artificial" enabled={permissions.can_use_ai} />
                <PermItem icon={BarChart3} label="Relatórios & Métricas" enabled={permissions.can_view_reports} />
                <PermItem icon={Download} label="Exportação de Dados" enabled={permissions.can_export} />
                <PermItem icon={Settings} label="Painel Model Control" enabled={!!(isAdmin || role === 'master')} />
              </div>
              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Papel de Acesso:
                </span>
                <span className="text-xs font-bold text-foreground px-2.5 py-0.5 rounded-md bg-muted/60 border border-border/60">
                  {getRoleName(role)}
                </span>
              </div>
            </div>
          </Section>

          {/* ─── Atalhos e Administração ─── */}
          <Section title="Atalhos e Ferramentas" icon={History}>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 rounded-md bg-background/50 border-border/60 hover:bg-muted/60"
                onClick={() => navigateTo('/history')}
              >
                <History className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                Histórico de Atividade
                <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground/60" />
              </Button>

              {canManageUsers && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-md bg-background/50 border-border/60 hover:bg-muted/60"
                  onClick={() => navigateTo('/user-management')}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  Gerenciar Usuários
                  <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground/60" />
                </Button>
              )}

              {canManageAI && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-md bg-background/50 border-border/60 hover:bg-muted/60"
                  onClick={() => navigateTo('/model-control')}
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  Model Control (IA)
                  <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground/60" />
                </Button>
              )}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8.5 px-4 rounded-md border-border/60 font-medium hover:bg-muted/60"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Helper Components ──────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PermItem({ icon: Icon, label, enabled }: { icon: React.ElementType; label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {enabled ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
      )}
      <span className={`text-xs ${enabled ? 'text-foreground font-medium' : 'text-muted-foreground/60 line-through'}`}>
        {label}
      </span>
    </div>
  );
}

function getRoleName(role: string): string {
  const map: Record<string, string> = {
    master: 'Master',
    admin: 'Administrador',
    manager: 'Gerente',
    tester: 'Testador',
    viewer: 'Visualizador',
  };
  return map[role] || 'Usuário';
}
