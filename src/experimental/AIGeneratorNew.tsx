import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Brain, Zap, Layers } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AIGeneratorForm } from '@/components/forms/AIGeneratorForm';
import { AIBatchGeneratorForm } from '@/components/forms/AIBatchGeneratorForm';
import { useNavigate } from 'react-router-dom';
import { useAISettings } from '@/hooks/useAISettings';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

type GenerationType = 'plan' | 'case' | 'execution';

interface GenerationOption {
  type: GenerationType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  permission: string;
}

export const AIGenerator = () => {
  const [showModal, setShowModal] = useState(false);
  const [generationType, setGenerationType] = useState<GenerationType>('plan');
  const navigate = useNavigate();
  const { settings } = useAISettings();
  const { permissions } = usePermissions();

  const generationOptions: GenerationOption[] = [
    {
      type: 'plan',
      title: 'Plano de Teste',
      description: 'Gere planos de teste detalhados com objetivos e estratégias',
      icon: Layers,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      permission: 'can_create_test_plans'
    },
    {
      type: 'case',
      title: 'Caso de Teste',
      description: 'Crie casos de teste com passos e resultados esperados',
      icon: Zap,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      permission: 'can_create_test_cases'
    },
    {
      type: 'execution',
      title: 'Execução de Teste',
      description: 'Simule execuções baseadas em casos existentes',
      icon: Brain,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      borderColor: 'border-purple-200 dark:border-purple-800',
      permission: 'can_create_test_executions'
    }
  ];

  const handleOpenGenerator = (type: GenerationType) => {
    setGenerationType(type);
    setShowModal(true);
  };

  const handleGenerationSuccess = () => {
    setShowModal(false);
    if (generationType === 'plan') {
      navigate('/plans');
    } else if (generationType === 'case') {
      navigate('/cases');
    } else {
      navigate('/executions');
    }
  };

  const isBatchMode = (type: GenerationType) => {
    return (settings.batchGenerationEnabled && type === 'plan') || 
           (settings.batchCaseGenerationEnabled && type === 'case');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6">
      {/* Header Minimalista */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Gerador com IA
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Escolha o que deseja gerar com inteligência artificial
        </p>
      </div>

      {/* Opções de Geração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mb-12">
        {generationOptions.map((option) => {
          const Icon = option.icon;
          const hasPermission = permissions[option.permission as keyof typeof permissions];
          
          return (
            <button
              key={option.type}
              onClick={() => handleOpenGenerator(option.type)}
              disabled={!hasPermission}
              className={cn(
                "group relative p-8 rounded-2xl border-2 transition-all duration-300",
                "hover:shadow-xl hover:scale-105 hover:-translate-y-1",
                "focus:outline-none focus:ring-4 focus:ring-offset-2",
                option.bgColor,
                option.borderColor,
                hasPermission 
                  ? "cursor-pointer hover:border-opacity-100" 
                  : "cursor-not-allowed opacity-50"
              )}
            >
              {/* Ícone */}
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto",
                "bg-white dark:bg-gray-900 shadow-sm"
              )}>
                <Icon className={cn("h-8 w-8", option.color)} />
              </div>

              {/* Conteúdo */}
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                {option.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {option.description}
              </p>

              {/* Badge de Batch */}
              {isBatchMode(option.type) && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                    Lote
                  </span>
                </div>
              )}

              {/* Botão de Ação */}
              <div className={cn(
                "inline-flex items-center text-sm font-medium mt-2",
                option.color
              )}>
                Gerar agora
                <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Tooltip de Permissão */}
              {!hasPermission && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-900/80 dark:bg-gray-950/80">
                  <span className="text-white text-sm font-medium px-4 py-2 bg-red-500 rounded-lg">
                    Sem permissão
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Rodapé com Dicas */}
      <div className="text-center max-w-2xl">
        <p className="text-sm text-gray-500 dark:text-gray-500">
          💡 <span className="font-medium">Dica:</span> Para melhores resultados, forneça descrições detalhadas e contexto completo sobre o que deseja testar.
        </p>
      </div>

      {/* Modal de Geração */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold">
                {isBatchMode(generationType) 
                  ? `Gerar ${generationType === 'plan' ? 'Planos' : 'Casos'} em Lote`
                  : `Gerar ${
                      generationType === 'plan' ? 'Plano' : 
                      generationType === 'case' ? 'Caso' : 
                      'Execução'
                    } de Teste`
                }
              </h2>
            </div>

            {isBatchMode(generationType) ? (
              <AIBatchGeneratorForm 
                onSuccess={handleGenerationSuccess} 
                type={generationType as 'plan' | 'case'} 
              />
            ) : (
              <AIGeneratorForm 
                onSuccess={handleGenerationSuccess} 
                initialType={generationType} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
