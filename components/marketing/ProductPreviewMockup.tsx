"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { OpportunityPreview, type OpportunityPreviewData } from "@/components/ui/OpportunityPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

const opportunities: OpportunityPreviewData[] = [
  {
    customerName: "Ravi Kumar",
    score: 94,
    category: "Website project",
    status: "Waiting for quotation",
  },
  {
    customerName: "Priya Sharma",
    score: 87,
    category: "Bulk order",
    status: "Asked about pricing",
  },
];

/**
 * A realistic, static preview of the future Signal dashboard — built from
 * the same components the real product will use, so this isn't a
 * decorative illustration but an early look at the real design language.
 * All data here is illustrative and clearly labeled as a preview.
 */
export function ProductPreviewMockup() {
  return (
    <Card padded={false} className="overflow-hidden shadow-[var(--shadow-elevated)]">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-5 py-3">
        <span className="text-[13px] font-medium text-text-secondary">
          Signal — Dashboard
        </span>
        <Badge variant="accent">Preview</Badge>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-3xl font-medium tabular-nums text-text">
              18
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              high-priority opportunities
            </div>
          </div>

          <Select defaultValue="priority">
            <SelectTrigger className="w-full sm:w-40" aria-label="Sort opportunities">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Sort: Priority</SelectItem>
              <SelectItem value="recent">Sort: Most recent</SelectItem>
              <SelectItem value="value">Sort: Deal value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Divider className="mt-4" />

        <div>
          {opportunities.map((opportunity, index) => (
            <OpportunityPreview
              key={opportunity.customerName}
              data={opportunity}
              isLast={index === opportunities.length - 1}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md bg-warning-tint px-3 py-2.5 text-[13px] text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          3 conversations going cold
        </div>
      </div>
    </Card>
  );
}
