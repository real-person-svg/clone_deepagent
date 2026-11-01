import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentSummary } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';

export function useAgentSelector({
  agentId,
  disabled,
  compact,
  onChange,
}: {
  agentId: string;
  disabled: boolean;
  compact: boolean;
  onChange: (agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [error, setError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const items = await api<AgentSummary[]>('/agents');
      if (current === request.current) {
        setAgents((previous) =>
          JSON.stringify(previous) === JSON.stringify(items) ? previous : items
        );
        setError('');
      }
    } catch (e) {
      if (current === request.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    (
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ||
      menuRef.current?.querySelector<HTMLButtonElement>('button')
    )?.focus();
  }, [open, agents, error]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const selected = agents.find((agent) => agent.id === agentId);
  const selectorClassName = `agent-selector ${compact ? 'is-compact' : ''}`;
  const triggerClassName = `agent-switcher ${compact ? 'compact' : 'hero'}`;
  const handleToggle = () => {
    if (!open) void load();
    setOpen(!open);
  };
  const handleClose = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
    if (event.key === 'Tab') setOpen(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || []
      );
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };
  const optionViews = agents.map((option) => ({
    option,
    checked: agentId === option.id,
    handleSelect: () => {
      onChange(option.id);
      handleClose();
    },
  }));
  return {
    open,
    triggerRef,
    menuRef,
    selected,
    selectorClassName,
    triggerClassName,
    handleToggle,
    avatarSize: compact ? 17 : 21,
    catcherTabIndex: -1,
    handleClose,
    handleMenuKeyDown,
    optionViews,
    error,
    reload: load,
  };
}
