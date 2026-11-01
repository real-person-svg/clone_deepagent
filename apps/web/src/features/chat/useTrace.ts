import { useEffect, useRef, useState } from 'react';
import type { RunEvent } from '../../../../../packages/contracts/index';
import { describeTrace } from './trace-view';

export function useTrace({
  events,
  active,
  failed,
}: {
  events: RunEvent[];
  active: boolean;
  failed: boolean;
}) {
  const [open, setOpen] = useState(active || failed);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active || failed) setOpen(true);
    else if (wasActive.current) setOpen(false);
    wasActive.current = active;
  }, [active, failed]);

  const { summary, rows } = describeTrace(events, active);
  const className = `trace ${failed ? 'trace-error' : ''}`;
  const chevronClassName = open ? 'rotated' : '';

  const handleToggle = () => setOpen(!open);

  return { open, summary, rows, className, chevronClassName, handleToggle };
}
