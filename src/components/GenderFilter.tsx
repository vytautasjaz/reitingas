import Link from "next/link";
import type { SexFilter } from "@/lib/ranking";

export function GenderFilter({
  active,
  counts,
  basePath = "/standings",
}: {
  active: SexFilter;
  counts: { all: number; M: number; F: number };
  basePath?: string;
}) {
  const items: Array<{ key: SexFilter; label: string; count: number }> = [
    { key: "all", label: "Visi", count: counts.all },
    { key: "M", label: "Vyrai", count: counts.M },
    { key: "F", label: "Moterys", count: counts.F },
  ];

  return (
    <div className="gender-filter" role="tablist" aria-label="Lyties filtras">
      {items.map((item) => {
        const href =
          item.key === "all" ? basePath : `${basePath}?sex=${item.key}`;
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={`gender-chip${isActive ? " active" : ""}${
              item.key === "M" ? " chip-m" : item.key === "F" ? " chip-f" : ""
            }`}
          >
            <span>{item.label}</span>
            <span className="gender-count">{item.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
