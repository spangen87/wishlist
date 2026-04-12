import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateToast } from "@/components/UpdateToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Min önskelista",
  description: "Barnets önskelista — koordinera inköp utan att förstöra överraskningen",
  openGraph: {
    title: "Min önskelista",
    description: "Barnets önskelista — koordinera inköp utan att förstöra överraskningen",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OfflineBanner />
        <AuthProvider>{children}</AuthProvider>
        <UpdateToast />
      </body>
    </html>
  );
}
