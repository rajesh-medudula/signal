import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";

export type OpportunityPreviewData = {
  customerName: string;
  score: number;
  category: string;
  status: string;
};

type OpportunityPreviewProps = {
  data: OpportunityPreviewData;
  isLast?: boolean;
};

/**
 * Row layout for a single prioritized conversation. Shared shape between
 * the marketing product preview and the future real dashboard list, so
 * both can render the same visual language once real data exists.
 */
export function OpportunityPreview({ data, isLast }: OpportunityPreviewProps) {
  const isHighPriority = data.score >= 85;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text">
            {data.customerName}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="neutral">{data.category}</Badge>
            <span className="truncate text-[13px] text-text-secondary">
              {data.status}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`font-mono text-lg font-medium tabular-nums ${
              isHighPriority ? "text-accent" : "text-text"
            }`}
          >
            {data.score}
          </span>
          <span className="ml-1 font-mono text-[13px] text-text-tertiary">
            / 100
          </span>
        </div>
      </div>
      {!isLast ? <Divider /> : null}
    </div>
  );
}
