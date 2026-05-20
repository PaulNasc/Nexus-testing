import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function LinkToken() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      // Aqui você faria a chamada para validar e vincular o token
      // Exemplo: const result = await validateAndUseToken(token);
      // if (!result.success) throw new Error(result.error);
      // Simulação de sucesso:
      setTimeout(() => {
        setSuccess(true);
        setTimeout(() => navigate('/'), 1200);
      }, 800);
    } catch {
      setError('Token inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8 bg-card shadow-lg">
        <CardHeader className="flex flex-col items-center">
          <CardTitle className="text-lg font-semibold mb-1">Vincular-se a uma base existente</CardTitle>
          <span className="text-sm text-muted-foreground">Cole o Token de Acesso fornecido pelo administrador</span>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLink} className="space-y-4">
            <Input
              type="text"
              placeholder="Cole o token de acesso aqui"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
              autoFocus
            />
            {error && <div className="text-destructive text-sm text-center">{error}</div>}
            {success && <div className="text-green-600 text-sm text-center">Vinculado com sucesso! Redirecionando...</div>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Vinculando...' : 'Vincular'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 
