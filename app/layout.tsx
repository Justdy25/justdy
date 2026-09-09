import type { Metadata } from "next";

import { JustdyThemeProvider } from "./_components/theme/JustdyThemeProvider";
import "katex/dist/katex.min.css";

import "./globals.css";

export const metadata: Metadata = {
  title: "Justdy | Learn. Grow. Succeed",
  description:
    "Justdy provides online courses, tutoring, educational resources, and learning opportunities for students and educators.",
  icons: {
    icon: "/logo.ico",
  },
  verification: {
    google: "googlef81a47f8ecddf48f.html",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JustdyThemeProvider>{children}</JustdyThemeProvider>
      </body>
    </html>
  );
}
