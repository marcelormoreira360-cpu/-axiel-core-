import Link from "next/link";
import { ButtonSecondary } from "@/components/button";
import { ProductOrderCard } from "@/components/product-order-card";

const demoOrders = [
  {
    id: "1001",
    patientName: "John Doe",
    status: "paid" as const,
    paymentStatus: "paid" as const,
    totalCents: 3900,
    currency: "USD",
    createdAt: "Today",
  },
  {
    id: "1002",
    status: "pending" as const,
    paymentStatus: "unpaid" as const,
    totalCents: 5900,
    currency: "USD",
    createdAt: "Today",
  },
];

export default function ProductOrdersPage() {
  return (
    <div className="bg-axiel-background min-h-screen p-4 md:p-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-axiel-text-primary">Product Orders</h1>
          <p className="mt-2 text-axiel-text-secondary">Track simple product sales and payment status.</p>
        </div>
        <Link href="/products">
          <ButtonSecondary type="button">Back to Products</ButtonSecondary>
        </Link>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        {demoOrders.slice(0, 5).map((order) => (
          <ProductOrderCard key={order.id} order={order} />
        ))}
      </section>
    </div>
  );
}
