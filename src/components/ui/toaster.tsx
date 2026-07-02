import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, ...props }) {
        const toastDuration = typeof duration === 'number' ? duration : 5000;
        const showProgress = toastDuration > 0 && toastDuration <= 15000;

        return (
          <Toast key={id} duration={toastDuration} {...props} className="relative overflow-hidden">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            {showProgress && (
              <div 
                className="absolute bottom-0 left-0 h-1 bg-brand/60 animate-toast-progress" 
                style={{ animationDuration: `${toastDuration}ms` }} 
              />
            )}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
