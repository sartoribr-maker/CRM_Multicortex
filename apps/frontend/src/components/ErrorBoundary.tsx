import { Component, type ErrorInfo, type ReactNode } from 'react';
import logo from '../assets/logo.png';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface', error, info);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-bg p-5">
        <div className="card max-w-md p-8 text-center">
          <img src={logo} alt="Multicortex" className="mx-auto h-12" />
          <h1 className="mt-6 font-heading text-xl font-bold text-slate-900">
            Não foi possível exibir esta página
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ocorreu uma falha inesperada. Seus dados permanecem seguros.
          </p>
          <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
            Recarregar aplicação
          </button>
        </div>
      </main>
    );
  }
}
