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

