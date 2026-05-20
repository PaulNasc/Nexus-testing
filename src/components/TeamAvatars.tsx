
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UserInfo {
  id: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
}

interface TeamAvatarsProps {
  users: UserInfo[];
  maxDisplay?: number;
  className?: string;
  onUserClick?: (userId: string) => void;
}

export const TeamAvatars = ({ users, maxDisplay = 5, className, onUserClick }: TeamAvatarsProps) => {
  const displayUsers = users.slice(0, maxDisplay);
  const remaining = Math.max(0, users.length - maxDisplay);

  return (
    <div className={cn("flex -space-x-2 overflow-hidden", className)}>
      <TooltipProvider>
        {displayUsers.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div 
                className="inline-block cursor-pointer ring-2 ring-background rounded-full hover:z-10 transition-transform hover:scale-110"
                onClick={() => onUserClick?.(user.id)}
              >
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={user.avatar_url || ''} alt={user.display_name || user.email || 'Usuário'} />
                  <AvatarFallback className="text-[10px] bg-brand/10 text-brand font-bold">
                    {(user.display_name || user.email || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-bold">{user.display_name || user.email}</div>
                {user.role && <div className="opacity-70 text-[10px] uppercase">{user.role}</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium ring-2 ring-background cursor-pointer hover:bg-muted/80 transition-colors">
                +{remaining}
              </div>
            </TooltipTrigger>
            <TooltipContent className="p-2">
              <div className="text-xs flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-auto-hide">
                <span className="font-semibold text-muted-foreground mb-0.5 border-b border-border/50 pb-1">Outros ({remaining})</span>
                {users.slice(maxDisplay).map(u => (
                  <div key={u.id} className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 border border-border">
                      <AvatarImage src={u.avatar_url || ''} />
                      <AvatarFallback className="text-[8px] bg-brand/10 text-brand font-bold">
                        {(u.display_name || u.email || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col leading-none">
                      <span className="font-medium">{u.display_name || u.email}</span>
                      {u.role && <span className="text-[9px] opacity-70 uppercase">{u.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};
