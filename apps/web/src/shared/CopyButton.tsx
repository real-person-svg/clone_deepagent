import { Check, Copy } from 'lucide-react';
import { useCopyButton } from './useCopyButton';

export function CopyButton({ text }: { text: string }) {
  const { copied, handleCopy } = useCopyButton(text);

  return (
    <button className="icon-button" aria-label="复制回答" title="复制回答" onClick={handleCopy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
