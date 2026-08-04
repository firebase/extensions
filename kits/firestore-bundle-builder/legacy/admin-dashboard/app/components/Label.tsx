export function Label(props: {
  label: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <label className="block mt-6">
      <div className="flex items-center">
        <div className="font-bold mb-2 flex-grow">{props.label}</div>
        <div>{props.action}</div>
      </div>
      {!!props.description && (
        <p className="text-gray-600 mb-2">
          <small>{props.description}</small>
        </p>
      )}
      <div
        className="[&_input]:w-full [&_input]:border [&_input]:p-2
        [&_textarea]:w-full [&_textarea]:border [&_textarea]:p-2
        [&_select]:w-full [&_select]:border [&_select]:p-2
        "
      >
        {props.children}
      </div>
    </label>
  );
}