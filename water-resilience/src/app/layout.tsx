import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SewerSim — Sewer Network Simulation & Failure Detection",
  description: "Transform your infrastructure data into an intelligent digital twin. Analyze, simulate, and identify vulnerabilities before they become real-world failures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
