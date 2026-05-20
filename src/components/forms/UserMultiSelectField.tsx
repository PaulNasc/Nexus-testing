
import React from 'react';
import { Check, User as UserIcon, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProjectUsers } from '@/hooks/useProjectUsers';
import { cn } from '@/lib/utils';

interface UserMultiSelectFieldProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const UserMultiSelectField = ({
  selectedIds = [],
  onChange,
  placeholder = "Selecionar interessados...",
  className
}: UserMultiSelectFieldProps) => {
  const [open, setOpen] = React.useState(false);
  const { users, labelFor } = useProjectUsers();

  const handleSelect = (userId: string) => {
    const newIds = selectedIds.includes(userId)
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId];
    onChange(newIds);
  };

  const removeUser = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(id => id !== userId));
  };

  const selectedUsers = users.filter(u => selectedIds.includes(u.id));

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 px-3 py-2 bg-muted/20 border-border/40 hover:bg-muted/30 transition-colors focus:ring-0"
          >
            <div className="flex flex-wrap gap-1 items-center">
              {selectedUsers.length > 0 ? (
                selectedUsers.map(user => (
                  <Badge 
                    key={user.id} 
                    variant="secondary" 
                    className="flex items-center gap-1 bg-brand/10 text-brand border-brand/20 py-0.5"
                  >
                    {labelFor(user)}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-brand-dark" 
                      onClick={(e) => removeUser(e, user.id)}
                    />
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground font-normal">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border">{selectedIds.length}</span>
              <UserIcon className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuário..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
              <CommandGroup>
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelect(user.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center w-full gap-2">
                      <div className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-colors",
                        selectedIds.includes(user.id) ? "bg-primary text-primary-foreground" : "opacity-50"
                      )}>
                        {selectedIds.includes(user.id) && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{labelFor(user)}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{user.role}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
