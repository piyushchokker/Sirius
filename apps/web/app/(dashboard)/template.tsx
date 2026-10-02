"use client";

import { usePathname } from "next/navigation";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-enter w-full h-full flex flex-col flex-1 overflow-x-hidden">
      {children}
    </div>
  );
}
