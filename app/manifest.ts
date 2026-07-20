import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LT Slide Editor",
    short_name: "LT Slides",
    description: "Markdown-based slide editor for lightning talks",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#161616",
    theme_color: "#161616",
    icons: [
      {
        src: "/lt-slide-editor-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/lt-slide-editor-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
