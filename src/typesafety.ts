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

export type Split<S extends string, D extends string> = string extends S
  ? string[]
  : S extends `${infer P}${D}${infer R}`
  ? [P, ...Split<R, D>]
  : [S];

type Entry<T> = NonNullable<{ [K in keyof T]: [K, T[K]] }[keyof T]>;

export const split = <S extends string, D extends string>(str: S, delimiter: D) => str.split(delimiter) as Split<S, D>;

export const objectEntries = <T extends Record<string, unknown>>(obj: T) =>
  Object.keys(obj).map(key => [key, obj[key] as T[keyof T]]) as Entry<T>[];

export const toUpperCase = <T extends string>(str: T) => str.toUpperCase() as Uppercase<T>;
