import React, { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageUploaded: (url: string) => void;
  onImageDeleted: () => void;
  className?: string;
  bucketName?: string;
  businessId?: string;
}

export function ImageUploader({
  currentImageUrl,
  onImageUploaded,
  onImageDeleted,
  className,
  bucketName = "logos",
  businessId = "default"
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format non supporté. Veuillez utiliser PNG, JPG ou WEBP.");
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image est trop volumineuse (max 2MB).");
      return;
    }

    try {
      setIsUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      onImageUploaded(publicUrlData.publicUrl);
      toast.success("Image importée avec succès");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erreur lors de l'importation de l'image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = () => {
    onImageDeleted();
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-6">
        <div className="relative group w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
          {currentImageUrl ? (
            <>
              <img src={currentImageUrl} alt="Logo preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={handleDelete}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer un logo
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPG ou WEBP. Max 2MB. Recommandé : 500x500px.
          </p>
        </div>
      </div>
    </div>
  );
}
