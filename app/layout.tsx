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
      <head>
        {/* Inline script to set theme immediately - blocking and synchronous */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  console.error('Failed to set theme:', e);
                }
              })();
            `,
          }}
        />
        {/* Inline style to ensure CSS variables are set correctly even before JS executes */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --bg-primary: #ffffff;
                --bg-primary-rgb: 255, 255, 255;
                --bg-secondary: #f9fafb;
                --bg-secondary-rgb: 249, 250, 251;
                --bg-warm: #fef9f5;
                --text-primary: #111827;
                --text-secondary: #6b7280;
                --border-color: #e5e7eb;
                --border-color-rgb: 229, 231, 235;
              }
              .dark {
                --bg-primary: #111827;
                --bg-primary-rgb: 17, 24, 39;
                --bg-secondary: #1f2937;
                --bg-secondary-rgb: 31, 41, 55;
                --bg-warm: #1f2937;
                --text-primary: #f9fafb;
                --text-secondary: #9ca3af;
                --border-color: #374151;
                --border-color-rgb: 55, 65, 81;
              }
              body {
                color: var(--text-primary);
                background: var(--bg-primary);
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
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
