import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { useProject } from '@/contexts/ProjectContext';
import { applyProjectTheme, resetProjectTheme } from '@/lib/theme/projectTheme';
import { useAISettings } from '@/hooks/useAISettings';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { 
  Palette, Sparkles, Shield, Settings, Users,
  FileText, PlayCircle, BarChart3, Download,
  UserCog, TestTube, ExternalLink, Bell, History
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
  const { settings: aiSettings, updateSettings: updateAISettings } = useAISettings();
  const { role, permissions, hasPermission, isAdmin } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentProject } = useProject();

  const [notifPrefs, setNotifPrefs] = useState({
    email_enabled: true,
    system_enabled: true,
    push_enabled: false
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
          .select('email_enabled, system_enabled, push_enabled')
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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4.5 w-4.5" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Personalize sua experiência no sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* ─── Aparência ─── */}
          <Section title="Aparência" icon={Palette}>
            {/* Toggle cores do projeto */}
            <SettingRow
              label="Aplicar cores do projeto ao tema"
              description="Quando ativo, a interface usa a cor do projeto selecionado como tema. Trocar de projeto aplica a nova cor automaticamente."
            >
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
              />
            </SettingRow>

            {/* Ação rápida do Dashboard */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="quick-action" className="text-sm font-medium">Botão principal do Dashboard</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ação executada pelo botão "+" no painel</p>
              </div>
              <Select
                value={dashboardSettings.quickActionType}
                onValueChange={(v: 'plan' | 'case' | 'execution') => updateDashboardSettings({ quickActionType: v })}
              >
                <SelectTrigger id="quick-action" className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan">Novo Plano</SelectItem>
                  <SelectItem value="case">Novo Caso</SelectItem>
                  <SelectItem value="execution">Nova Execução</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          {/* ─── IA ─── */}
          {canManageAI && (
            <Section title="Gerador IA" icon={Sparkles}>
              <SettingRow
                label="Geração em lote de planos"
                description="Gerar múltiplos planos a partir de um documento"
              >
                <Switch
                  checked={aiSettings.batchGenerationEnabled}
                  onCheckedChange={(checked) => updateAISettings({ batchGenerationEnabled: checked })}
                />
              </SettingRow>
              <SettingRow
                label="Geração em lote de casos"
                description="Gerar casos em lote (PDF, XLSX, etc)"
              >
                <Switch
                  checked={aiSettings.batchCaseGenerationEnabled}
                  onCheckedChange={(checked) => updateAISettings({ batchCaseGenerationEnabled: checked })}
                />
              </SettingRow>
            </Section>
          )}

          {/* ─── Permissões (read-only) ─── */}
          <Section title="Suas Permissões" icon={Shield}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <PermItem icon={UserCog} label="Gerenciar Usuários" enabled={permissions.can_manage_users} />
              <PermItem icon={FileText} label="Planos de Teste" enabled={permissions.can_manage_plans} />
              <PermItem icon={TestTube} label="Casos de Teste" enabled={permissions.can_manage_cases} />
              <PermItem icon={PlayCircle} label="Execuções" enabled={permissions.can_manage_executions} />
              <PermItem icon={Sparkles} label="Usar IA" enabled={permissions.can_use_ai} />
              <PermItem icon={BarChart3} label="Relatórios" enabled={permissions.can_view_reports} />
              <PermItem icon={Download} label="Exportar" enabled={permissions.can_export} />
              <PermItem icon={Settings} label="Model Control" enabled={!!(isAdmin || role === 'master')} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Seu papel: <strong className="text-foreground">{getRoleName(role)}</strong> — permissões são gerenciadas por administradores.
            </p>
          </Section>

          {/* ─── Notificações ─── */}
          <Section title="Notificações" icon={Bell}>
            <SettingRow
              label="Notificações por E-mail"
              description="Receba resumos de execuções e alertas críticos por e-mail"
            >
              <Switch
                checked={notifPrefs.email_enabled}
                onCheckedChange={(v) => updateNotifPref('email_enabled', v)}
                disabled={loadingPrefs}
              />
            </SettingRow>
            <SettingRow
              label="Notificações no Sistema"
              description="Alertas em tempo real no sino de notificações do cabeçalho"
            >
              <Switch
                checked={notifPrefs.system_enabled}
                onCheckedChange={(v) => updateNotifPref('system_enabled', v)}
                disabled={loadingPrefs}
              />
            </SettingRow>
            <SettingRow
              label="Notificações Push"
              description="Alertas no navegador mesmo com a aba fechada"
            >
              <Switch
                checked={notifPrefs.push_enabled}
                onCheckedChange={(v) => updateNotifPref('push_enabled', v)}
                disabled={loadingPrefs}
              />
            </SettingRow>
          </Section>

          {/* ─── Histórico e Conta ─── */}
          <Section title="Conta e Segurança" icon={UserCog}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => navigateTo('/history')}>
                <History className="h-3.5 w-3.5 mr-1.5" />
                Histórico de Atividade
                <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
              </Button>
            </div>
          </Section>

          {/* ─── Atalhos de administração ─── */}
          {canManageUsers && (
            <Section title="Administração" icon={Users}>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => navigateTo('/user-management')}>
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Gerenciar Usuários
                  <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
                </Button>
                {canManageAI && (
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => navigateTo('/model-control')}>
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Model Control
                    <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Helper Components ──────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-3 pl-0.5">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function PermItem({ icon: Icon, label, enabled }: { icon: React.ElementType; label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${enabled ? 'text-brand' : 'text-muted-foreground/40'}`} />
      <span className={`text-xs ${enabled ? 'text-foreground' : 'text-muted-foreground/60 line-through'}`}>{label}</span>
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
