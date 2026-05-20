"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { saveBrandingAction } from "./actions";

const PRESET_COLORS = [
  { label: "Azul noite", value: "#0B1F3A" },
  { label: "Verde clínico", value: "#0F6E56" },
  { label: "Roxo", value: "#5B21B6" },
  { label: "Terracota", value: "#B45309" },
  { label: "Cinza ardósia", value: "#334155" },
  { label: "Rosa antigo", value: "#9D4B6B" },
];

interface Props {
  currentLogoUrl: string | null;
  currentPrimaryColor: string | null;
}

export function BrandingForm({ currentLogoUrl, currentPrimaryColor }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(currentPrimaryColor ?? "#0B1F3A");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("primary_color", color);
    startTransition(async () => {
      const result = await saveBrandingAction(formData);
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Logo */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Logo da clínica</h2>
        <p className="mb-4 text-sm text-black/50">
          Cole a URL pública da sua logo (PNG ou SVG, fundo transparente recomendado).
          Aparece no portal do paciente e na página de agendamento.
        </p>
        <input
          name="logo_url"
          type="url"
          defaultValue={currentLogoUrl ?? ""}
          placeholder="https://exemplo.com/logo.png"
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20"
        />
        {currentLogoUrl && (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={currentLogoUrl}
              alt="Logo atual"
              className="h-10 max-w-[160px] object-contain rounded border border-black/10 p-1"
            />
            <span className="text-xs text-black/40">Logo atual</span>
          </div>
        )}
      </Card>

      {/* Cor primária */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Cor primária</h2>
        <p className="mb-4 text-sm text-black/50">
          Usada no cabeçalho do portal do paciente e na página de agendamento.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setColor(preset.value)}
              title={preset.label}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition"
              style={{
                borderColor: color === preset.value ? preset.value : "transparent",
                backgroundColor: color === preset.value ? `${preset.value}18` : "#F4F3EF",
                color: color === preset.value ? preset.value : "#6B6A66",
              }}
            >
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: preset.value }}
              />
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded border border-black/15 p-0.5"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#0B1F3A"
            className="w-28 rounded-lg border border-black/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-axiel-ink/20"
          />
          <div
            className="flex h-9 w-24 items-center justify-center rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            Preview
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar identidade visual"}
        </Button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso.</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
