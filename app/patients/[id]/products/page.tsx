import Link from "next/link";
import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { PatientProductCard } from "@/components/patient-product-card";
import { ProductRefillCard } from "@/components/product-refill-card";

const patientProducts = [
  {
    id: "pp-1",
    productName: "Magnesium Support",
    reason: "Sleep support",
    nextStep: "Review product support in 14 days.",
    status: "active" as const,
    reviewDate: "In 14 days",
  },
];

export default function PatientProductsPage({ params }: { params: { id: string } }) {
  return (
    <div className="bg-axiel-background min-h-screen p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-axiel-text-primary">Product Support</h1>
          <p className="mt-2 text-axiel-text-secondary">Support items connected to this patient journey.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/patients/${params.id}`}>
            <ButtonSecondary type="button">Back</ButtonSecondary>
          </Link>
          <ButtonPrimary type="button">Add Product</ButtonPrimary>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-axiel-text-secondary">Active support</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">{patientProducts.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-axiel-text-secondary">Next review</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">14d</p>
        </Card>
        <Card>
          <p className="text-sm text-axiel-text-secondary">Pending refill</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">1</p>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-axiel-text-primary">Current Product Support</h2>
            <p className="text-sm text-axiel-text-secondary">Only show what helps the next Session.</p>
          </div>
          <ButtonSecondary type="button">Create Payment Link</ButtonSecondary>
        </div>

        {patientProducts.slice(0, 5).map((item) => (
          <PatientProductCard key={item.id} item={item} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-axiel-text-primary">Follow-up / Refill</h2>
        <ProductRefillCard
          productName="Magnesium Support"
          dueAt="In 14 days"
          message="Hi, just checking in to see how you are doing with your product support."
        />
      </section>
    </div>
  );
}
