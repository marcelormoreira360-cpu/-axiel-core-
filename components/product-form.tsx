"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { productCategories } from "@/modules/products/product-defaults";
import { validateProductLanguage } from "@/modules/products/product-language";

export function ProductForm() {
  const [approvedLanguage, setApprovedLanguage] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const languageCheck = useMemo(() => validateProductLanguage(approvedLanguage), [approvedLanguage]);

  return (
    <Card>
      <form className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-axiel-text-primary">Add Product</h2>
          <p className="mt-1 text-sm text-axiel-text-secondary">Keep product support clear, safe, and easy to review.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Product name
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3" placeholder="Magnesium Support" />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Category
            <select className="w-full rounded-xl border border-gray-200 px-4 py-3">
              {productCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            Price
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3" placeholder="39.00" type="number" min="0" />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Inventory quantity
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3" placeholder="24" type="number" min="0" />
          </label>
        </div>

        <label className="space-y-2 text-sm font-medium">
          Description
          <textarea className="min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3" placeholder="Short product description." />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Approved product language
          <textarea
            className="min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3"
            placeholder="Supports relaxation and normal nervous system function."
            value={approvedLanguage}
            onChange={(event) => setApprovedLanguage(event.target.value)}
          />
        </label>

        {!languageCheck.isSafe && (
          <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800">
            {languageCheck.warnings.slice(0, 3).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        <button
          type="button"
          className="text-sm font-medium text-axiel-secondary"
          onClick={() => setShowDetails((value) => !value)}
        >
          View details
        </button>

        {showDetails && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              SKU
              <input className="w-full rounded-xl border border-gray-200 px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Cost
              <input className="w-full rounded-xl border border-gray-200 px-4 py-3" type="number" min="0" />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Safety notes
              <textarea className="min-h-20 w-full rounded-xl border border-gray-200 px-4 py-3" />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonPrimary type="button">Create Product</ButtonPrimary>
          <ButtonSecondary type="button">Save draft</ButtonSecondary>
        </div>
      </form>
    </Card>
  );
}
