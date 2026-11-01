import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AgentMode } from '../../../../../packages/contracts/index';
import { options } from './selector.config';

export function useAgentSelector({
  mode,
  disabled,
  compact,
  onChange,
}: {
  mode: AgentMode;
  disabled: boolean;
  compact: boolean;
  onChange: (mode: AgentMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();

    return () => triggerRef.current?.focus();
  }, [open]);

  const selected = options.find((option) => option.mode === mode)!;
  const selectorClassName = `agent-selector ${compact ? 'is-compact' : ''}`;
  const triggerClassName = `agent-switcher ${compact ? 'compact' : 'hero'}`;

  const handleToggle = () => setOpen(!open);

  const avatarSize = compact ? 17 : 21;
  const catcherTabIndex = -1;

  const handleClose = () => setOpen(false);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || []
      );
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      let next: number;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        next = (current + direction + items.length) % items.length;
      }
      items[next]?.focus();
    }
  };

  const optionViews = options.map((option) => {
    const checked = mode === option.mode;

    const handleSelect = () => {
      onChange(option.mode);
      setOpen(false);
    };

    return { option, checked, handleSelect };
  });

  return {
    open,
    triggerRef,
    menuRef,
    selected,
    selectorClassName,
    triggerClassName,
    handleToggle,
    avatarSize,
    catcherTabIndex,
    handleClose,
    handleMenuKeyDown,
    optionViews,
  };
}
