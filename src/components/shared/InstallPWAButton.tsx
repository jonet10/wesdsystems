import { useInstallPWA } from "@/hooks/useInstallPWA";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function InstallPWAButton() {
  const { isInstallable, promptInstall } = useInstallPWA();

  if (!isInstallable) return null;

  return (
    <Button 
      onClick={promptInstall} 
      variant="hero" 
      className="gap-2 shadow-lg hover:shadow-xl transition-all"
    >
      <Download className="h-5 w-5" />
      Installer l'application
    </Button>
  );
}
