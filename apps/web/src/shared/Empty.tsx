import { FileText } from 'lucide-react';
export function Empty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="panel-empty">
      <div>
        <Icon size={28} strokeWidth={1.3} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
