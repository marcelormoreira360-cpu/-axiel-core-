import { demoProducts } from "@/modules/products/product-defaults";
import type { Product } from "@/modules/products/product-types";

export async function listProducts(): Promise<Product[]> {
  return demoProducts;
}

export async function createProduct(input: Partial<Product>) {
  return {
    id: crypto.randomUUID(),
    currency: "USD",
    inventoryQuantity: 0,
    isActive: true,
    ...input,
  };
}

export async function getProduct(productId: string) {
  return demoProducts.find((product) => product.id === productId) ?? null;
}
