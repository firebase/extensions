/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
