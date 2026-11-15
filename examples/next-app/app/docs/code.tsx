import { codeToHtml } from 'shiki';
import { CopyCode } from './copy-code';

export async function Code({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  const html = await codeToHtml(children, {
    lang: label === 'Terminal' ? 'bash' : 'tsx',
    theme: 'github-light',
  });
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{label}</span>
        <CopyCode text={children} label={label ?? 'code'} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
