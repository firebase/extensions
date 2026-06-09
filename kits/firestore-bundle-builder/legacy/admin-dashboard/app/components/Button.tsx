interface ButtonProps extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {}

export function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className="px-3 py-2 rounded border border-slate-800 hover:border-slate-400"
    >
      {children}
    </button>
  );
}

interface AnchorButtonProps extends React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {}

export function AnchorButton({ children, ...props }: AnchorButtonProps) {
  return (
    <a
      {...props}
      className="px-3 py-2 rounded border border-slate-800 hover:border-slate-400"
    >
      {children}
    </a>
  );
}

