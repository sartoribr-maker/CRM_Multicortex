import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from '../../types/tasks';

interface TaskStatusContextMenuProps {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (status: TaskStatus) => void;
}

/**
 * Menu aberto com o botão direito sobre uma tarefa da lista. Lista os status
 * diferentes do atual; clicar (direito ou esquerdo) numa opção aplica o status.
 */
export function TaskStatusContextMenu({
  task,
  x,
  y,
  onClose,
  onSelect,
}: TaskStatusContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const options = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).filter(
    (status) => status !== task.status,
  );

  // Mantém o menu dentro da janela quando o clique é perto da borda.
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const choose = (event: React.MouseEvent, status: TaskStatus) => {
    event.preventDefault();
    onSelect(status);
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Alterar status de ${task.title}`}
      className="fixed z-[90] min-w-[200px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl"
      style={position}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="px-4 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Alterar status
      </p>
      {options.map((status) => (
        <button
          key={status}
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-purple-50 hover:text-brand-purple"
          onClick={(event) => choose(event, status)}
          onContextMenu={(event) => choose(event, status)}
        >
          {TASK_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
