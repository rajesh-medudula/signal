import { ProductPreviewMockup } from "@/components/marketing/ProductPreviewMockup";

export function ProductPreviewSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-20">
      <ProductPreviewMockup />
      <p className="mt-4 text-center text-[13px] text-text-tertiary">
        A preview of the Signal dashboard, shown with illustrative data.
      </p>
    </section>
  );
}
