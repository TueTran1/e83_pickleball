import type { Metadata, Viewport } from "next";
import "./globals.css";
import CustomerBanners from "@/components/CustomerBanners";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: { default: "E83 - Câu lạc bộ Pickleball", template: "%s | E83 Pickleball" },
  description: "Đặt sân Pickleball tại 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng. Đặt lịch nhanh chóng, thanh toán tiện lợi.",
  applicationName: "E83 Pickleball",
  keywords: ["pickleball", "đặt sân", "Đà Nẵng", "E83", "câu lạc bộ"],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "E83 - Câu lạc bộ Pickleball",
    description: "Đặt sân Pickleball tại 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng",
    url: APP_URL,
    siteName: "E83 Pickleball",
    images: [{ url: `${APP_URL}/logo.png`, width: 1254, height: 1254, alt: "E83 Pickleball Logo" }],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "E83 - Câu lạc bộ Pickleball",
    description: "Đặt sân Pickleball tại Đà Nẵng",
    images: [`${APP_URL}/logo.png`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0E2A21",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap&subset=latin,vietnamese"
          rel="stylesheet"
        />
      </head>
      <body>
        <CustomerBanners />
        {children}
      </body>
    </html>
  );
}
