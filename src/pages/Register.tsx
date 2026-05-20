import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import KrigzisLogo from '@/components/branding/KrigzisLogo';
import { Eye, EyeOff, ArrowRight, User, Mail, Lock } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const { error } = await signUp(email, password, name);
      
      if (error) {
        setError(error.message || 'Erro ao criar conta.');
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/'), 1500);
      }
    } catch {
      setError('Erro inesperado ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--brand)/0.08),transparent)]" />

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <KrigzisLogo size={28} className="h-7 w-7" />
            <span className="text-xl font-semibold tracking-tight text-foreground">Nexus Testing</span>
          </div>
          <p className="text-sm text-muted-foreground">Crie sua conta para começar</p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 shadow-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <label htmlFor="register-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  className="pl-10 h-10 bg-background/50 border-border/50 focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="pl-10 h-10 bg-background/50 border-border/50 focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label htmlFor="register-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="text-destructive text-xs text-center bg-destructive/5 border border-destructive/10 rounded-lg py-2 px-3">
                {error}
              </div>
            )}
            {success && (
              <div className="text-emerald-500 text-xs text-center bg-emerald-500/5 border border-emerald-500/10 rounded-lg py-2 px-3">
                Conta criada! Redirecionando...
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full h-10 font-medium transition-all duration-200"
              variant="brand"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Criando conta...' : (
                <>
                  Criar conta
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Login link */}
          <div className="mt-5 pt-4 border-t border-border/40 text-center">
            <span className="text-xs text-muted-foreground">Já tem uma conta? </span>
            <a href="/login" className="text-xs text-brand hover:text-brand/80 font-medium transition-colors">
              Entrar
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
          © {new Date().getFullYear()} Nexus Testing — v1.0.0
        </p>
      </div>
    </div>
  );
}

