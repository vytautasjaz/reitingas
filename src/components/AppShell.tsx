"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMarks } from "./BrandMarks";
import { SeasonSwitcher } from "./SeasonSwitcher";

const links = [
  {
    href: "/",
    label: "Reitingas",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16M7 16V9m5 7V5m5 11v-6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/standings",
    label: "Lentelė",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 5h16M4 12h16M4 19h16" strokeLinecap="round" />
        <path d="M9 5v14M15 5v14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/races",
    label: "Varžybos",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/members",
    label: "Nariai",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M3 19c1.5-3 4-4.5 6-4.5S13.5 16 15 19" strokeLinecap="round" />
        <path d="M14 14.5c1.2 0 2.8.7 4 2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function AppShell({
  children,
  seasonYear,
  seasonYears,
}: {
  children: React.ReactNode;
  seasonYear: number;
  seasonYears: number[];
}) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar-brand" aria-label="TRItonas reitingas">
          <Image
            src="/brand/logo-negative.png"
            alt="TRItonas"
            width={168}
            height={168}
            className="sidebar-logo"
            priority
          />
          <span className="sidebar-brand-caption">Reitingas {seasonYear}</span>
        </Link>

        <SeasonSwitcher year={seasonYear} years={seasonYears} />

        <nav className="sidebar-nav">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${active ? " active" : ""}`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <BrandMarks className="footer-marks" color="var(--accent)" />
          <span>Taškai nuo lyderio · best of 3</span>
        </div>
      </aside>

      <div className="main-area">
        <div
          className={`content${
            pathname.startsWith("/standings") ? " content-wide" : ""
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
