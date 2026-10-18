import type { MetadataRoute } from "next";
import { URL_SITUS } from "@/lib/situs";

export default function robots(): MetadataRoute.Robots {
  return {
    // /api/ hanya data mentah untuk peta, tidak perlu diindeks.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${URL_SITUS}/sitemap.xml`,
  };
}
