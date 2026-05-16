import Link from "next/link";
import { ButtonSecondary } from "@/components/button";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div className="bg-axiel-background min-h-screen p-4 md:p-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-axiel-text-primary">New Product</h1>
          <p className="mt-2 text-axiel-text-secondary">Create a support item for your clinic catalog.</p>
        </div>
        <Link href="/products">
          <ButtonSecondary type="button">Back</ButtonSecondary>
        </Link>
      </header>

      <ProductForm />
    </div>
  );
}
