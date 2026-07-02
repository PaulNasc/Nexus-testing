import React, { useRef, useState, useEffect } from 'react';
import { Upload, Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Image as ImageIcon } from 'lucide-react';

interface ImageAttachment {
  name: string;
  dataUrl: string;
  slides?: number[];
}

interface ImageAttachmentZoneProps {
  images: ImageAttachment[];
  onChange: (images: ImageAttachment[]) => void;
  showWarning?: boolean;
}

export const ImageAttachmentZone = ({ images = [], onChange, showWarning = false }: ImageAttachmentZoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    const promises = validFiles.map(file => {
      return new Promise<ImageAttachment>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          resolve({ name: file.name, dataUrl });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(newImages => {
      onChange([...images, ...newImages]);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = [...images];
    updated.splice(index, 1);
    onChange(updated);
  };

  // Clipboard Paste Support (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-brand" />
          Anexar Imagens / Evidências
        </label>
        {showWarning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-[10px] text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20 cursor-help font-semibold">
                  <Info className="h-3 w-3" />
                  Temporário (1 mês)
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs p-2.5">
                Imagens anexadas sumirão depois de 1 mês sendo necessário consultar os docs enviados por e-mail das apresentações.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-brand bg-brand/5 scale-[0.99]"
            : "border-border/60 hover:border-border bg-muted/5 hover:bg-muted/10"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
        <Upload className={`h-6 w-6 text-muted-foreground transition-transform ${isDragActive ? "animate-bounce" : ""}`} />
        <div className="text-xs text-center text-muted-foreground">
          <span className="font-semibold text-brand">Clique para fazer upload</span>, arraste e solte arquivos de imagem, ou cole capturas de tela com <span className="font-semibold text-foreground">Ctrl+V</span>.
        </div>
      </div>

      {/* Preview list */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2.5 p-3 bg-muted/20 rounded-xl border border-border/40 max-h-48 overflow-y-auto">
          {images.map((img, idx) => (
            <div key={idx} className="relative group h-16 w-16 rounded-md border border-border/40 overflow-hidden shadow-sm">
              <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(idx);
                  }}
                  className="h-7 w-7 rounded-full bg-destructive text-white flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-all"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] truncate px-1 text-center font-mono">
                {img.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
