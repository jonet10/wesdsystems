import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-card border border-border shadow-soft rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground mb-3">Oups, quelque chose s'est mal passé !</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Une erreur inattendue est survenue lors du chargement de cette page. Nous avons enregistré le problème pour le résoudre.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => window.location.reload()} variant="hero">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recharger la page
              </Button>
              <Button onClick={() => window.location.href = "/"} variant="outline">
                Accueil
              </Button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-8 text-left bg-muted p-4 rounded-lg w-full overflow-auto text-xs font-mono text-muted-foreground">
                <p className="font-bold text-destructive mb-2">{this.state.error.message}</p>
                {this.state.error.stack}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
