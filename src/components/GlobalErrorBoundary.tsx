import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getCapturedLogs } from '@/utils/errorLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reported: boolean;
  reporting: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    reported: false,
    reporting: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[GlobalErrorBoundary caught]', error, errorInfo);
  }

  private handleReportError = async () => {
    this.setState({ reporting: true });
    try {
      const logs = getCapturedLogs();
      const payload = {
        id: `ERR-CRASH-${Math.floor(1000 + Math.random() * 9000)}`,
        error_message: this.state.error?.message || 'React Uncaught Crash',
        stack_trace: this.state.error?.stack || this.state.errorInfo?.componentStack || '',
        current_url: window.location.href,
        console_logs: JSON.stringify(logs.slice(-20)),
        status: 'open',
      };
      await apiClient.from('error_reports').insert(payload);
      this.setState({ reported: true });
    } catch (e) {
      console.error('Falha ao enviar relatório automático de erro:', e);
    } finally {
      this.setState({ reporting: false });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground animate-fade-in">
          <div className="max-w-md w-full p-6 rounded-2xl border border-destructive/30 bg-card shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Ops! Algo inesperado aconteceu.
              </h2>
              <p className="text-xs text-muted-foreground">
                O Nexus TCMS detectou uma inconsistência nesta tela. O erro foi registrado no nosso buffer de telemetria.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-left font-mono text-[11px] text-destructive overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="w-full sm:w-auto h-9 text-xs border-border/80"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recarregar Página
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={this.handleReportError}
                disabled={this.state.reporting || this.state.reported}
                className="w-full sm:w-auto h-9 text-xs bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {this.state.reported ? 'Enviado ✓' : this.state.reporting ? 'Enviando...' : 'Reportar à Engenharia'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
