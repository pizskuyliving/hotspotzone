import type { MetadataRoute } from "next";
import { URL_SITUS } from "@/lib/situs";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: URL_SITUS, changeFrequency: "hourly", priority: 1 }];
}
