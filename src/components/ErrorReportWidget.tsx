import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bug, Camera, Send, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { getCapturedLogs, captureDomScreenshot, LogEntry } from '@/utils/errorLogger';
import { useAuth } from '@/hooks/useAuth';
import { useProject } from '@/contexts/ProjectContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { StandardButton } from '@/components/StandardButton';
import { useModules } from '@/contexts/ModuleContext';

export const ErrorReportWidget: React.FC = () => {
  const { isModuleEnabled } = useModules();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // If the module is explicitly turned off in the feature flags, don't render the widget
  if (!isModuleEnabled('error_reporting')) {
    return null;
  }

  const handleOpen = async () => {
    setIsOpen(true);
    setCapturing(true);
    const capturedLogs = getCapturedLogs();
    setLogs(capturedLogs);

    const shot = await captureDomScreenshot();
    setScreenshot(shot);
    setCapturing(false);
  };

  const handleSubmit = async () => {
    if (!description.trim() && logs.length === 0) {
      toast({
        title: 'Informe uma descrição',
        description: 'Por favor, descreva brevemente o que aconteceu.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const errorId = `ERR-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        id: errorId,
        error_message: description.trim() || 'Reporte de falha disparado pelo usuário',
        stack_trace: logs.filter(l => l.level === 'error').map(l => l.message).join('\n---\n') || 'Nenhum stack trace registrado',
        current_url: window.location.href,
        console_logs: JSON.stringify(logs.slice(-20)),
        screenshot_data: screenshot || null,
        user_id: user?.id || null,
        project_id: currentProject?.id || null,
        user_agent: navigator.userAgent,
        status: 'open',
      };

      const { error } = await apiClient.from('error_reports').insert(payload);
      if (error) throw error;

      toast({
        title: 'Reporte Enviado com Sucesso!',
        description: `Protocolo registrado: ${errorId}. Nossa equipe de QA analisará os logs anexados.`,
      });

      setIsOpen(false);
      setDescription('');
    } catch (err: any) {
      console.error('Falha ao enviar reporte de erro:', err);
      toast({
        title: 'Falha no envio',
        description: err?.message || 'Não foi possível registrar o reporte no momento.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante sutil no canto inferior direito */}
      <div className="fixed bottom-5 right-5 z-40 animate-fade-in group">
        <Button
          onClick={handleOpen}
          size="sm"
          className="h-9 px-3 rounded-xl bg-card/90 hover:bg-card border border-border/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:border-brand/50 hover:shadow-brand/10 flex items-center gap-2 group-hover:scale-105"
          aria-label="Reportar Erro ou Problema"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <Bug className="h-4 w-4 text-brand" />
          <span className="text-xs font-semibold text-foreground hidden sm:inline">
            Reportar Falha
          </span>
        </Button>
      </div>

      {/* Modal de envio de reporte */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Reportar Erro ou Inconsistência
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O sistema capturou automaticamente o estado da tela e os logs do console para agilizar a resolução.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="err-desc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                O que aconteceu? (Opcional)
              </Label>
              <Textarea
                id="err-desc"
                rows={3}
                placeholder="Ex: Clicar no botão 'Exportar' gerou um erro ou travou a página..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-muted/20 border-border/70 text-xs resize-none"
              />
            </div>

            {/* Contexto capturado */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-semibold text-[11px] flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-brand" />
                  Telemetria Coletada
                </span>
                <Badge variant="outline" className="text-[10px] bg-brand/10 text-brand border-brand/20">
                  {logs.length} eventos no buffer
                </Badge>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1 font-mono">
                <div className="truncate"><strong>Rota:</strong> {window.location.pathname}</div>
                {currentProject && (
                  <div className="truncate"><strong>Projeto:</strong> {currentProject.name} ({currentProject.id})</div>
                )}
                {user && (
                  <div className="truncate"><strong>Usuário:</strong> {user.email}</div>
                )}
              </div>

              {screenshot && (
                <div className="pt-2 border-t border-border/40">
                  <div className="text-[10px] text-muted-foreground mb-1 font-sans">Preview do Snapshot:</div>
                  <img
                    src={screenshot}
                    alt="DOM Snapshot Preview"
                    className="w-full h-24 object-cover rounded border border-border/60 opacity-80 hover:opacity-100 transition-opacity"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/40">
            <StandardButton variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Cancelar
            </StandardButton>
            <StandardButton variant="brand" onClick={handleSubmit} disabled={loading || capturing}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Enviar Reporte
                </>
              )}
            </StandardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ErrorReportWidget;
