import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Evidence } from '../../../../../packages/contracts/index';
import { api } from '../../shared/api';
import { localTime } from '../../shared/format';

export function useEvidenceDrawer(id: string | null, onClose: () => void) {
  const [evidence, setEvidence] = useState<Evidence | null>(null),
    [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    setEvidence(null);
    setError('');
    let alive = true;
    const previous = document.activeElement as HTMLElement | null;
    api<Evidence>(`/evidence/${id}`)
      .then((e) => {
        if (alive) setEvidence(e);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    closeRef.current?.focus();

    return () => {
      alive = false;
      previous?.focus();
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);

    return () => window.removeEventListener('keydown', listener);
  }, [id, onClose]);

  useEffect(() => {
    if (!id) return;

    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.evidence-drawer button:not([disabled]),.evidence-drawer a[href]'
        )
      );
      if (!elements.length) return;
      const first = elements[0],
        last = elements.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap);

    return () => {
      window.removeEventListener('keydown', trap);
    };
  }, [id]);

  const handleDrawerClick = (event: MouseEvent<HTMLElement>) => event.stopPropagation();
  let kindLabel = '网页快照';
  if (evidence?.kind === 'upload') kindLabel = '用户上传资料';
  const observedAt = evidence ? localTime(evidence.observedAt, true) : '';
  const hashPreview = evidence?.hash.slice(0, 20);
  const hasSourceUrl = Boolean(evidence?.url);

  return {
    hasSourceUrl,
    evidence,
    error,
    closeRef,
    handleDrawerClick,
    kindLabel,
    observedAt,
    hashPreview,
  };
}
