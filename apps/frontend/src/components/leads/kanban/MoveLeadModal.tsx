import { useState } from 'react';
import { Icon } from '../../Icon';
import { DateInput } from '../../MaskedInputs';
import type { LeadListItem } from '../../../types/leads';
import type { Stage } from '../../../types/settings';

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface MoveLeadPayload {
  stageId: string;
  lossReason?: string;
  actionDescription: string;
  ownerIds?: string[];
  /** Assume o lead do site (o backend define o usuário atual como responsável). */
  claimLead?: boolean;
  createTask: boolean;
  taskDueDate?: string;
  taskPriority?: TaskPriority;
}

interface MoveLeadModalProps {
  lead: LeadListItem;
  stage: Stage;
  isSubmitting: boolean;
  /** Quando falso (Portal SDR), os responsáveis não são alterados. */
  showOwnerSelector?: boolean;
  userOptions?: Array<{ id: string; name: string }>;
  /** Texto inicial da ação (ex.: reunião recém-agendada). */
  initialActionDescription?: string;
  onCancel: () => void;
  onConfirm: (payload: MoveLeadPayload) => void;
}

export function MoveLeadModal({
  lead,
  stage,
  isSubmitting,
  showOwnerSelector = true,
  userOptions = [],
  initialActionDescription = '',
  onCancel,
  onConfirm,
}: MoveLeadModalProps) {
  const [actionDescription, setActionDescription] = useState(initialActionDescription);
  const [lossReason, setLossReason] = useState('');
  const [ownerIds, setOwnerIds] = useState(() =>
    lead.assignees.map((assignment) => assignment.user.id),
  );
  const [createTask, setCreateTask] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  // Ao assumir o lead, o responsável passa a ser o usuário atual.
  const selectsOwners = showOwnerSelector && !lead.awaitingClaim;
  const ownerOptions = userOptions.length
    ? userOptions
    : lead.assignees.map((assignment) => assignment.user);
  const isValid =
    actionDescription.trim() &&
    (!stage.isLostStage || lossReason.trim()) &&
    (!selectsOwners || ownerIds.length > 0);

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          onConfirm({
            stageId: stage.id,
            lossReason: stage.isLostStage ? lossReason.trim() : undefined,
            actionDescription: actionDescription.trim(),
            ownerIds: selectsOwners ? ownerIds : undefined,
            claimLead: lead.awaitingClaim || undefined,
            createTask,
            taskDueDate: createTask ? new Date(`${taskDueDate}T12:00:00`).toISOString() : undefined,
            taskPriority: createTask ? taskPriority : undefined,
          });
        }}
        className="mobile-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-brand-purple">
          <Icon name="edit" className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold text-slate-900">
          Registrar movimentação
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Registre a ação para mover <strong className="text-slate-700">{lead.name}</strong> para{' '}
          {stage.name}.
        </p>
        <label className="form-label mt-5">Ação realizada *</label>
        <textarea
          autoFocus
          required
          className="form-control"
          rows={3}
          value={actionDescription}
          onChange={(event) => setActionDescription(event.target.value)}
          placeholder="Ex.: reunião realizada, proposta apresentada..."
        />
        {stage.isLostStage && (
          <>
            <label className="form-label mt-4">Motivo da perda *</label>
            <textarea
              required
              className="form-control"
              rows={2}
              value={lossReason}
              onChange={(event) => setLossReason(event.target.value)}
            />
          </>
        )}
        {lead.awaitingClaim && (
          <p className="mt-4 rounded-xl bg-purple-50 px-3 py-2 text-sm text-brand-purple">
            Você será o responsável por esta oportunidade.
          </p>
        )}
        {selectsOwners && (
          <>
            <label className="form-label mt-4">Responsáveis</label>
            <div className="grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
              {ownerOptions.map((responsible) => (
                <label
                  key={responsible.id}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50"
                >
                  <input
                    type="checkbox"
                    checked={ownerIds.includes(responsible.id)}
                    onChange={(event) =>
                      setOwnerIds((ids) =>
                        event.target.checked
                          ? [...ids, responsible.id]
                          : ids.filter((id) => id !== responsible.id),
                      )
                    }
                  />
                  {responsible.name}
                </label>
              ))}
            </div>
          </>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={createTask}
            onChange={(event) => setCreateTask(event.target.checked)}
          />
          Cadastrar tarefa para esta ação
        </label>
        {createTask && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label">Prazo *</label>
              <DateInput
                required
                className="form-control"
                value={taskDueDate}
                onValueChange={(value) => setTaskDueDate(value ?? '')}
              />
            </div>
            <div>
              <label className="form-label">Prioridade *</label>
              <select
                className="form-control"
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting || !isValid} className="btn-primary">
            Confirmar movimentação
          </button>
        </div>
      </form>
    </div>
  );
}
