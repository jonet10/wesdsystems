import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const Logo = ({ className, size = "md", showText = true }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("rounded-xl flex items-center justify-center overflow-hidden bg-card border border-border", sizeClasses[size])}>
        <img
          src="/logo.png"
          alt="Wesd Systems"
          className="w-full h-full object-contain p-1"
        />
      </div>
      {showText && (
        <span className={cn("font-sans font-bold text-foreground tracking-tight", textSizes[size])}>
          Wesd Systems
        </span>
      )}
    </div>
  );
};
