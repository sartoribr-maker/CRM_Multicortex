import type { PropsWithChildren } from 'react';
import logo from '../assets/logo.png';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
}

export function AuthLayout({ title, subtitle, children }: PropsWithChildren<AuthLayoutProps>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <img src={logo} alt="Multicortex" className="h-16" />

      <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-md">
        <h1 className="font-heading text-xl font-bold text-brand-purple-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/70">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
