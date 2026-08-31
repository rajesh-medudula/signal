import { EmptyState } from "@/components/dashboard/EmptyState";

type PlaceholderPageProps = {
  title: string;
  body: string;
};

export function PlaceholderPage({ title, body }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      <div className="mt-8">
        <EmptyState title="Coming in a future module" body={body} />
      </div>
    </div>
  );
}
