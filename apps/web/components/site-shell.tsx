import Link from 'next/link';
import type { ReactNode } from 'react';
import { authNavigation, primaryNavigation } from '@/lib/navigation';

interface SiteShellProps {
  children: ReactNode;
}

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-block">
            <p className="brand-eyebrow">OpsPilot AI</p>
            <p className="brand-subtitle">Internal support and operations automation</p>
          </div>
          <nav className="nav-group" aria-label="Primary">
            {primaryNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
          <nav className="nav-group auth-links" aria-label="Authentication">
            {authNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link secondary-link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="page-main">{children}</main>
    </div>
  );
}

