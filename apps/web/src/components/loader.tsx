// Router-level pending component (defaultPendingComponent in src/main.tsx).
// TODO(PLAKY-WEB): PLAKY-WEB-004 - keep the spinner non-blocking; it replaces the screen
// body during a route transition.
import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}
