import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AutoPartsPageHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function AutoPartsPageHeader({ title, description, action }: AutoPartsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold font-display">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
