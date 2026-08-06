import type { PropsWithChildren } from 'react';
import logo from '../assets/logo.png';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
}

export function AuthLayout({ title, subtitle, children }: PropsWithChildren<AuthLayoutProps>) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-purple-dark via-brand-purple to-brand-blue p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 bottom-16 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div />
        <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <div className="mb-10 rounded-3xl bg-white px-8 py-6 shadow-2xl shadow-slate-950/20">
            <img src={logo} alt="Multicortex" className="w-80 max-w-full" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-white/50">
            Inteligência comercial
          </p>
          <h2 className="mt-5 font-heading text-5xl font-bold leading-[1.12]">
            Relacionamentos fortes. Negócios melhores.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
            Organize sua operação, acompanhe oportunidades e transforme dados em decisões
            comerciais.
          </p>
        </div>
        <p className="relative text-xs text-white/35">© Multicortex · Plataforma CRM</p>
      </section>
      <section className="flex items-center justify-center bg-app-bg px-5 py-10">
        <div className="w-full max-w-md">
          <img src={logo} alt="Multicortex" className="mb-10 h-12 lg:hidden" />
          <div className="card p-7 shadow-xl shadow-slate-200/60 md:p-9">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-brand-purple">
              Bem-vindo
            </p>
            <h1 className="font-heading text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
