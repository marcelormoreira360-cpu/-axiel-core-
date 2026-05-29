import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXIEL Core",
    short_name: "AXIEL",
    description: "Sistema integrativo de clínica",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#0B1F3A",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda",      short_name: "Agenda",      url: "/schedule",   icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Pacientes",   short_name: "Pacientes",   url: "/patients",   icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Financeiro",  short_name: "Financeiro",  url: "/financeiro", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Resultados",  short_name: "Resultados",  url: "/results",    icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
