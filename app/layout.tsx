import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ExtensionSync } from "@/components/extension-sync";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnimatedBackground } from "@/components/animated-background";

const rawSiteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://workstack.app";
const siteUrl = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;
const siteDescription =
  "WorkStack helps you save bookmarks, organize collections, track browsing activity, and rediscover content with AI-powered search.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "WorkStack",
  title: {
    default: "WorkStack",
    template: "%s | WorkStack",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "WorkStack",
    description: siteDescription,
    url: siteUrl,
    siteName: "WorkStack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkStack",
    description: siteDescription,
  },
  icons: {
    icon: [
      { url: "/icon.png?v=2", sizes: "128x128", type: "image/png" },
    ],
    shortcut: "/icon.png?v=2",
    apple: [
      { url: "/icon.png?v=2", sizes: "128x128", type: "image/png" },
    ],
  },
  other: {
    "msapplication-TileImage": "/icon.png?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <AnimatedBackground />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "WorkStack",
                  url: siteUrl,
                  description: siteDescription,
                }),
              }}
            />
            <ExtensionSync />
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
