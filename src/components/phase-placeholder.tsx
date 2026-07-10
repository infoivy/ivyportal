import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function PhasePlaceholder({ title, phase, description, features }: { title: string; phase: string; description: string; features: string[] }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
      <Card className="mt-6 border-dashed">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">Coming in {phase}</div>
            <p className="text-sm text-muted-foreground mt-2">This module is scaffolded — the build is next.</p>
          </div>
          <ul className="text-sm text-left inline-block space-y-1 text-muted-foreground">
            {features.map(f => <li key={f}>• {f}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
