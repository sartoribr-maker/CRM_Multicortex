import { Icon } from '../../Icon';
import type { LeadListItem } from '../../../types/leads';
import type { Stage } from '../../../types/settings';

interface ClaimLeadModalProps {
  lead: LeadListItem;
  stage: Stage;
  onDecline: () => void;
  onClaim: () => void;
}

/**
 * Lead do site/WhatsApp ainda sem responsável: só é movido de etapa por
 * quem assumir o controle dele.
 */
export function ClaimLeadModal({ lead, stage, onDecline, onClaim }: ClaimLeadModalProps) {
  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="mobile-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-brand-purple">
          <Icon name="user" className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold text-slate-900">
          Assumir esta oportunidade?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          <strong className="text-slate-700">{lead.name}</strong> chegou pelo site e ainda não tem
          responsável. Para movê-la para {stage.name}, você passará a ser o responsável por ela.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onDecline}>
            Não
          </button>
          <button type="button" className="btn-primary" autoFocus onClick={onClaim}>
            Sim, assumir
          </button>
        </div>
      </div>
    </div>
  );
}
