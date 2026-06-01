"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { saveBrandingAction } from "./actions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const PRESET_COLORS = [
  { key: "colorNight", value: "#0B1F3A" },
  { key: "colorClinical", value: "#0F6E56" },
  { key: "colorPurple", value: "#5B21B6" },
  { key: "colorTerracotta", value: "#B45309" },
  { key: "colorSlate", value: "#334155" },
  { key: "colorRose", value: "#9D4B6B" },
];

interface Props {
  currentLogoUrl: string | null;
  currentPrimaryColor: string | null;
  clinicId: string;
}

export function BrandingForm({ currentLogoUrl, currentPrimaryColor, clinicId }: Props) {
  const t = useTranslations("settings.branding");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(currentPrimaryColor ?? "#0B1F3A");
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!["image/png", "image/svg+xml", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(t("errFormat"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t("errSize"));
      return;
    }

    setError(null);
    setUploading(true);

    // Preview local imediato
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop();
      const path = `${clinicId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("clinic-assets")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("clinic-assets").getPublicUrl(path);
      // Adiciona cache-buster para forçar reload do browser
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setLogoUrl(publicUrl);
      setPreviewUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errUpload"));
      setPreviewUrl(currentLogoUrl);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;
    setError(null);
    const formData = new FormData();
    formData.set("logo_url", logoUrl);
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
        <h2 className="mb-1 text-lg font-semibold">{t("logoTitle")}</h2>
        <p className="mb-4 text-sm text-black/50">
          {t("logoDesc")}
        </p>

        {/* Preview */}
        {previewUrl && (
          <div className="mb-4 flex items-center gap-3">
            <img
              src={previewUrl}
              alt={t("logoAlt")}
              className="h-12 max-w-[180px] object-contain rounded border border-black/10 bg-white p-1.5"
            />
            <span className="text-xs text-black/40">
              {uploading ? t("uploading") : t("currentLogo")}
            </span>
          </div>
        )}

        {/* Botão de upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-black/20 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 transition"
          >
            {uploading ? t("uploadingShort") : previewUrl ? t("changeLogo") : t("selectFile")}
          </button>
          {previewUrl && !uploading && (
            <button
              type="button"
              onClick={() => { setLogoUrl(""); setPreviewUrl(null); }}
              className="text-xs text-red-500 hover:underline"
            >
              {t("remove")}
            </button>
          )}
        </div>
      </Card>

      {/* Cor primária */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("colorTitle")}</h2>
        <p className="mb-4 text-sm text-black/50">
          {t("colorDesc")}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setColor(preset.value)}
              title={t(preset.key)}
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
              {t(preset.key)}
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
            {t("preview")}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending || uploading}>
          {isPending ? t("saving") : t("save")}
        </Button>
        {saved && <span className="text-sm text-green-600">{t("savedMsg")}</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
