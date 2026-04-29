"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

export function VersionLink() {
  const pathname = usePathname();

  const href =
    pathname === "/admin/changelog"
      ? "/changelog"
      : pathname === "/changelog"
        ? "/admin/changelog"
        : pathname.startsWith("/admin")
          ? "/admin/changelog"
          : "/changelog";

  return (
    <Link href={href} className="leading-none">
      <Badge variant="outline" className="text-[11px] font-medium">
        {APP_VERSION_LABEL}
      </Badge>
    </Link>
  );
}
