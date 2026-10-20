import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AutoBadge() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex items-center rounded px-1 py-0 text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary"
          >
            Auto
          </span>
        </TooltipTrigger>
        <TooltipContent>Added automatically from keywords. Edit to override.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
