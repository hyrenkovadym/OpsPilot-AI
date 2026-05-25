import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageSection({ title, subtitle, children }: SectionProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

