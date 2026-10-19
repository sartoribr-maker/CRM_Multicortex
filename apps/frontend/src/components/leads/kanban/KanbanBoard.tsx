import { type DragEvent, useRef, useState } from 'react';
import { FixedHorizontalScrollbar } from '../../FixedHorizontalScrollbar';
import { Icon } from '../../Icon';
import type { LeadListItem } from '../../../types/leads';
import type { Stage } from '../../../types/settings';
import { LeadKanbanCard, money } from './LeadKanbanCard';

interface KanbanBoardProps {
  stages: Stage[];
  leadsByStage: Map<string, LeadListItem[]>;
  canDrag: boolean;
  isMoving: boolean;
  /** Oculta valores por coluna e por card (Portal SDR). */
  hideFinancial?: boolean;
  staleDays?: number;
  /** Etapas que aceitam receber cards; as demais mostram o bloqueio ao soltar. */
  canDropOn?: (stage: Stage) => boolean;
  onBlockedDrop?: (stage: Stage) => void;
  onMove: (leadId: string, stage: Stage) => void;
  onOpen: (leadId: string) => void;
  onAdd?: (stage: Stage) => void;
}

export function KanbanBoard({
  stages,
  leadsByStage,
  canDrag,
  isMoving,
  hideFinancial = false,
  staleDays,
  canDropOn = () => true,
  onBlockedDrop,
  onMove,
  onOpen,
  onAdd,
}: KanbanBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  function onDrop(event: DragEvent, stage: Stage) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData('text/lead-id') || draggedId;
    setDragOverStageId(null);
    if (!leadId) return;
    if (canDropOn(stage)) onMove(leadId, stage);
    else onBlockedDrop?.(stage);
  }

  function columnHighlight(stage: Stage) {
    if (dragOverStageId !== stage.id) return 'border-slate-200/80';
    return canDropOn(stage)
      ? 'border-brand-purple bg-purple-50 ring-4 ring-purple-100'
      : 'border-rose-300 bg-rose-50 ring-4 ring-rose-100';
  }

  return (
    <>
      <div ref={scrollRef} className="-mx-4 overflow-x-auto px-4 pb-5 md:-mx-8 md:px-8">
        <div className="flex min-w-max items-start gap-4">
          {stages.map((stage) => {
            const columnLeads = leadsByStage.get(stage.id) ?? [];
            const columnValue = columnLeads.reduce(
              (sum, lead) => sum + Number(lead.estimatedValue ?? 0),
              0,
            );
            return (
              <section
                key={stage.id}
                className={`w-[calc(100vw-3rem)] rounded-2xl border bg-slate-100/70 p-3 transition sm:w-[310px] ${columnHighlight(stage)}`}
                onDragOver={(event) => {
                  if (canDrag) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = canDropOn(stage) ? 'move' : 'none';
                    setDragOverStageId(stage.id);
                  }
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node))
                    setDragOverStageId(null);
                }}
                onDrop={(event) => onDrop(event, stage)}
              >
                <header className="mb-3 px-1 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shadow-sm"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h2 className="text-sm font-bold text-slate-800">{stage.name}</h2>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                        {columnLeads.length}
                      </span>
                    </div>
                    {onAdd && (
                      <button
                        className="icon-button !h-7 !w-7"
                        onClick={() => onAdd(stage)}
                        title="Adicionar"
                      >
                        <Icon name="plus" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {!hideFinancial && (
                    <p className="mt-2 text-xs font-semibold text-slate-400">{money(columnValue)}</p>
                  )}
                </header>
                <div className="flex min-h-[120px] flex-col gap-3">
                  {columnLeads.map((lead) => (
                    <LeadKanbanCard
                      key={lead.id}
                      lead={lead}
                      draggable={canDrag && !isMoving}
                      isDragging={draggedId === lead.id}
                      hideFinancial={hideFinancial}
                      staleDays={staleDays}
                      onDragStart={(event) => {
                        setDraggedId(lead.id);
                        event.dataTransfer.setData('text/lead-id', lead.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverStageId(null);
                      }}
                      onClick={() => onOpen(lead.id)}
                    />
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="flex min-h-[110px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 px-5 text-center text-xs leading-5 text-slate-400">
                      Arraste uma oportunidade para esta etapa
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <FixedHorizontalScrollbar targetRef={scrollRef} />
    </>
  );
}
