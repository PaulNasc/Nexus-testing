import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { NexusIcon } from '@/components/branding/NexusLogo';
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiClient.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          // Permite preencher mesmo em fluxo local
          setReady(true);
        } else {
          setReady(true);
        }
      })
      .catch(() => setReady(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await apiClient.auth.updateUser({ password });
      if (updateError) {
        setError('Não foi possível atualizar a senha. Tente novamente.');
      } else {
        setMessage('Senha redefinida com sucesso! Você será redirecionado para o login.');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch {
      setError('Ocorreu um erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative select-none">
      <div className="relative w-full max-w-[400px] z-10 animate-page-enter">
        {/* ── Topo: Branding & Título ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-card border border-border/80 p-2.5 shadow-sm mb-3.5 transition-transform hover:scale-105">
            <NexusIcon size={36} className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Nexus Testing
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Redefinição de Credenciais de Acesso
          </p>
        </div>

        {/* ── Card Principal ── */}
        <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-6 sm:p-7 shadow-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground tracking-tight">
                Criar nova senha
              </h2>
              <p className="text-xs text-muted-foreground">
                Defina sua nova chave de segurança
              </p>
            </div>
          </div>

          {!ready ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span>Validando sessão de segurança...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nova Senha */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="new-password" className="text-xs font-semibold text-foreground/90">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="pl-10 pr-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="confirm-password" className="text-xs font-semibold text-foreground/90">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="pl-10 pr-10 h-10 text-xs bg-background/60 border-border/70 focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand rounded-md font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Alertas */}
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-fadeIn">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium animate-fadeIn">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              {/* Botão de Salvar */}
              <Button
                type="submit"
                disabled={loading || Boolean(message)}
                className="w-full h-10 rounded-md bg-brand hover:bg-brand/90 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando nova senha...</span>
                  </>
                ) : (
                  <>
                    <span>Atualizar Senha</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Link para Login */}
          <div className="mt-5 pt-4 border-t border-border/40 text-center">
            <Link
              to="/login"
              className="text-xs text-brand hover:underline font-semibold transition-colors"
            >
              Voltar para o login
            </Link>
          </div>
        </div>

        {/* Rodapé institucional */}
        <p className="text-center text-[11px] text-muted-foreground/60 mt-6 font-medium">
          Nexus Testing • Gestão Segura de Autenticação
        </p>
      </div>
    </div>
  );
}
