"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { ProductCard } from "@/components/product-card";
import { ProductSuggestionCard } from "@/components/product-suggestion-card";
import { SellProductModal } from "@/components/sell-product-modal";
import { demoProducts, demoProductSuggestions } from "@/modules/products/product-defaults";
import type { Product } from "@/modules/products/product-types";

export default function ProductsPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const activeProducts = demoProducts.filter((product) => product.isActive).length;
  const lowInventory = demoProducts.filter((product) => product.inventoryQuantity <= 5).length;
  const pendingReview = demoProductSuggestions.filter((suggestion) => suggestion.status === "in_review").length;

  return (
    <div className="bg-axiel-background min-h-screen p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-axiel-text-primary">Products</h1>
          <p className="mt-2 text-axiel-text-secondary">Manage products, kits, and support items for your clinic.</p>
        </div>
        <Link href="/products/new">
          <ButtonPrimary type="button">Add Product</ButtonPrimary>
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-axiel-text-secondary">Active products</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">{activeProducts}</p>
        </Card>
        <Card>
          <p className="text-sm text-axiel-text-secondary">Low inventory</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">{lowInventory}</p>
        </Card>
        <Card>
          <p className="text-sm text-axiel-text-secondary">Product support pending review</p>
          <p className="mt-2 text-3xl font-semibold text-axiel-text-primary">{pendingReview}</p>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-axiel-text-primary">Product Catalog</h2>
            <p className="text-sm text-axiel-text-secondary">Keep the catalog simple and safe.</p>
          </div>
          <Link href="/products/orders">
            <ButtonSecondary type="button">View orders</ButtonSecondary>
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {demoProducts.slice(0, 5).map((product) => (
            <ProductCard key={product.id} product={product} onSell={() => setSelectedProduct(product)} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-axiel-text-primary">AI-assisted suggestions</h2>
          <p className="text-sm text-axiel-text-secondary">AI can suggest a support category. A professional must approve it.</p>
        </div>
        {demoProductSuggestions.slice(0, 5).map((suggestion) => (
          <ProductSuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </section>

      <SellProductModal product={selectedProduct} open={Boolean(selectedProduct)} onClose={() => setSelectedProduct(undefined)} />
    </div>
  );
}
