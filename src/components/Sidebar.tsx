import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Play,
  Repeat,
  Kanban,
  Bot,
  TrendingUp,
  ShieldCheck,
  FolderKanban,
  Users,
  Cpu,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import KrigzisLogo from '@/components/branding/KrigzisLogo';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const navigation = [
  { name: 'Dashboard',      href: '/',             icon: LayoutDashboard, color: 'text-blue-400',    requiredPermission: null },
  { name: 'Planos de Teste', href: '/plans',        icon: ClipboardList,   color: 'text-purple-400', requiredPermission: 'can_manage_plans' },
  { name: 'Casos de Teste',  href: '/cases',        icon: FlaskConical,    color: 'text-teal-400',   requiredPermission: 'can_manage_cases' },
  { name: 'Execuções',       href: '/executions',   icon: Play,            color: 'text-green-400',  requiredPermission: 'can_manage_executions' },
  { name: 'Ciclos',          href: '/runs',         icon: Repeat,          color: 'text-amber-400',  requiredPermission: 'can_manage_executions' },
  { name: 'Gestão',          href: '/management',   icon: Kanban,          color: 'text-orange-400', requiredPermission: null },
  { name: 'Relatórios',      href: '/reports',      icon: TrendingUp,      color: 'text-pink-400',   requiredPermission: 'can_view_reports' },
];

// Itens administrativos (sub-menu colapsável)
const adminNavigation = [
  { name: 'Projetos',  href: '/project-admin',   icon: FolderKanban, color: 'text-violet-400',  requiredPermission: 'can_manage_projects' },
  { name: 'Usuários',  href: '/user-management', icon: Users,        color: 'text-emerald-400', requiredPermission: 'can_manage_users' },
  { name: 'Config. IA', href: '/model-control',   icon: Cpu,          color: 'text-cyan-400',    requiredPermission: 'can_access_model_control' },
];

export const Sidebar = () => {
  const location = useLocation();
  const { hasPermission, isMaster } = usePermissions();
  const [isOpen, setIsOpen] = useState(false); // Mobile sidebar state
  const [isExpanded, setIsExpanded] = useState(true); // Desktop sidebar expansion state
  const [adminOpen, setAdminOpen] = useState(true); // Submenu Administrativo

  const toggleSidebar = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Emitir evento para informar o layout que a barra lateral foi expandida/retraída
    const event = new CustomEvent('sidebarStateChange', { 
      detail: { expanded: newExpandedState } 
    });
    window.dispatchEvent(event);
  };

  // Filter navigation items based on permissions
  const filteredNavigation = navigation.filter(item => {
    if (!item.requiredPermission) return true;
    return hasPermission(item.requiredPermission as any);
  });

  // Filter admin items based on permissions
  const filteredAdminNavigation = adminNavigation.filter(item => {
    if (!item.requiredPermission) return true;
    return hasPermission(item.requiredPermission as any);
  });

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3.5 left-3.5 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-card border border-border/70 text-foreground shadow-md hover:bg-muted transition-colors"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 bg-card/95 backdrop-blur-md text-sidebar-foreground border-r border-border/70 shadow-xs transition-all duration-300 ease-in-out lg:translate-x-0 h-full select-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isExpanded ? "lg:w-64" : "lg:w-20"
      )}>
        <div className="flex flex-col h-full">
          {/* ── Cabeçalho Integrado da Sidebar (Altura harmonizada h-[70px]) ── */}
          <div className={cn(
            "flex items-center h-[70px] border-b border-border/50 transition-all",
            isExpanded ? "px-4 justify-between" : "px-2 justify-center"
          )}>
            {isExpanded ? (
              <>
                <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
                  <div className="h-8 w-8 rounded-md bg-brand/10 border border-brand/25 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <KrigzisLogo size={18} className="h-4.5 w-4.5 text-brand" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-foreground tracking-tight truncate leading-tight group-hover:text-brand transition-colors">
                      Nexus Testing
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 font-semibold tracking-wider uppercase leading-tight">
                      TCMS Platform
                    </span>
                  </div>
                </Link>
                <button
                  onClick={toggleSidebar}
                  className="h-7 w-7 rounded-md border border-border/50 bg-muted/20 hover:bg-muted/60 hover:border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-all shadow-2xs shrink-0"
                  title="Recolher menu lateral"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 rounded-md bg-brand/10 hover:bg-brand/20 border border-brand/25 flex items-center justify-center text-brand transition-all shadow-2xs group"
                title="Expandir menu lateral"
              >
                <KrigzisLogo size={20} className="h-5 w-5 group-hover:scale-105 transition-transform" />
              </button>
            )}
          </div>
          
          {/* ── Navegação Principal ── */}
          <nav className={cn(
            "flex-1 py-4 space-y-1 overflow-y-auto scrollbar-auto-hide",
            isExpanded ? "px-3" : "px-2"
          )}>
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center py-2 text-xs font-semibold rounded-md transition-all duration-200 group relative",
                    isExpanded ? "px-2.5 justify-start" : "px-2 justify-center",
                    isActive
                      ? "bg-brand text-white font-bold shadow-xs border border-brand/40"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  )}
                  title={!isExpanded ? item.name : undefined}
                >
                  <Icon className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isExpanded ? "mr-2.5" : "",
                    isActive ? "text-white" : item.color
                  )} />
                  {isExpanded && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                </Link>
              );
            })}

            {/* ── Submenu Administrativo ── */}
            {(isMaster() || hasPermission('can_access_admin_menu') || hasPermission('can_manage_users')) && (
              <div className="pt-2 mt-2 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => {
                    if (!isExpanded) {
                      setIsExpanded(true);
                      const event = new CustomEvent('sidebarStateChange', { detail: { expanded: true } });
                      window.dispatchEvent(event);
                    } else {
                      setAdminOpen(!adminOpen);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center py-2 text-xs font-semibold rounded-md transition-all duration-200 group",
                    isExpanded ? "px-2.5 justify-between" : "px-2 justify-center",
                    "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  )}
                  title={!isExpanded ? 'Administrativo' : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-rose-400 shrink-0 group-hover:scale-110 transition-transform duration-200" />
                    {isExpanded && <span className="truncate">Administrativo</span>}
                  </div>
                  {isExpanded && (
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 shrink-0 opacity-70", adminOpen ? "rotate-90" : "rotate-0")} />
                  )}
                </button>

                {isExpanded && adminOpen && (
                  <div className="mt-1 space-y-1 pl-4 border-l border-border/40 ml-4.5">
                    {filteredAdminNavigation.map((item) => {
                      const isActive = location.pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center py-1.5 px-2 text-xs font-semibold rounded-md transition-all duration-200 group",
                            isActive
                              ? "bg-brand text-white font-bold shadow-xs border border-brand/40"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5 mr-2 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive ? "text-white" : item.color)} />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          {/* ── Rodapé Minimalista da Sidebar ── */}
          {isExpanded ? (
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/70 font-medium">
              <span className="text-[11px]">Nexus TCMS</span>
              <span className="bg-muted/40 border border-border/50 px-1.5 py-0.5 rounded-md text-[10px] text-muted-foreground font-mono">v1.0.0</span>
            </div>
          ) : (
            <div className="py-3 border-t border-border/40 flex justify-center text-[10px] text-muted-foreground/50 font-mono">
              v1.0
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 lg:hidden bg-background/80 backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
