import { ArrowUpRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];

function EvidenceLink({
  href,
  children,
  onEvidence,
}: {
  href: string;
  children: ReactNode;
  onEvidence: (id: string) => void;
}) {
  const handleOpen = () => onEvidence(href.slice('/evidence/'.length));

  return (
    <button className="evidence-link" onClick={handleOpen}>
      {children}
      <ArrowUpRight size={11} />
    </button>
  );
}

function MarkdownTable({ children }: ComponentProps<'table'>) {
  return (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  );
}

function MarkdownPre({ children }: ComponentProps<'pre'>) {
  return <pre tabIndex={0}>{children}</pre>;
}

export function Markdown({
  content,
  onEvidence,
}: {
  content: string;
  onEvidence: (id: string) => void;
}) {
  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith('/evidence/'))
        return (
          <EvidenceLink href={href} onEvidence={onEvidence}>
            {children}
          </EvidenceLink>
        );

      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    table: MarkdownTable,
    pre: MarkdownPre,
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
