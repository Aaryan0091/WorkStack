import type { MetadataRoute } from "next";

const rawSiteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://workstack.app";
const siteUrl = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;

const publicRoutes = ["/", "/extension", "/login"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
