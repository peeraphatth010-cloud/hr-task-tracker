import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR Tracker — Thailand Edition | Luminescent Bento HR",
  description:
    "ระบบติดตามงาน HR ครบวงจร พร้อม Kanban, List, Timeline, Gantt, Preset งานซ้ำ, Present Flag และส่งออกรายงาน Excel ประจำเดือน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
