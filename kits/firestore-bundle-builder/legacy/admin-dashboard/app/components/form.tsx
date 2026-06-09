import cx from 'classnames';

interface InputProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
  error?: string;
}

export function Input({ error, children, ...props }: InputProps) {
  return (
    <div>
      <input
        {...props}
        className={cx(
          "px-3 py-2 rounded border",
          {
            "border-slate-200": !error,
            "border-red-500": error,
          }
        )}
      >
        {children}
      </input>
      {!!error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
