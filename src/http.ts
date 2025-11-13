/**
 * Gemstone Profit Calculator
 * Copyright (C) 2025 averithefox
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export function GET(url: string): string | null {
  const URL = Java.type('java.net.URL');
  const BufferedReader = Java.type('java.io.BufferedReader');
  const InputStreamReader = Java.type('java.io.InputStreamReader');
  const StringBuilder = Java.type('java.lang.StringBuilder');

  const javaUrl = new URL(url);
  const conn = javaUrl.openConnection();
  conn.setRequestMethod('GET');
  if (conn.getResponseCode() !== 200) {
    return null;
  }

  const reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));

  let line;
  const res = new StringBuilder();
  while ((line = reader.readLine()) !== null) {
    res.append(line);
  }
  reader.close();

  return res.toString();
}
