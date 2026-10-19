import type { Metadata } from "next";
import "./globals.css";
import { Instrument_Sans, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { publicEnv } from "@/lib/envPublic";
import { cn } from "@/lib/utils";

const instrumentSansHeading = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: publicEnv.siteUrl,
  title: {
    default: `Argos | ${publicEnv.siteName}`,
    template: `%s | ${publicEnv.siteName}`,
  },
  description: publicEnv.siteDescription,
  applicationName: publicEnv.siteName,
  creator: publicEnv.siteName,
  publisher: publicEnv.siteName,
  icons: {
    icon: [
      {
        url: "/favicon/e.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon/e.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/favicon/e.ico",
      },
    ],
    shortcut: "/favicon/e.ico",
    apple: "/favicon/e.png",
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        "font-sans",
        inter.variable,
        instrumentSansHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
