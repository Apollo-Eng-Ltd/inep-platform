"use client";

// Catches any runtime error inside the authenticated app so one broken component
// shows a recoverable message instead of blanking the whole page.
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="size-11 rounded-xl bg-danger-soft text-danger grid place-items-center mb-4">
        <TriangleAlert className="size-5" />
      </div>
      <h2 className="text-lg font-medium">Something went wrong on this screen</h2>
      <p className="text-sm text-muted-foreground max-w-md mt-1.5">
        The rest of the app is fine. Try again, and if it keeps happening, let us know what you were
        doing.
      </p>
      <div className="flex gap-2 mt-5">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<a href="/">Back to home</a>} />
      </div>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground mt-4">Reference: {error.digest}</p>
      )}
    </div>
  );
}
