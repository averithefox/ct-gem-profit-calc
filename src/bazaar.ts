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

import { GET } from './http';

export type Order = {
  amount: number;
  pricePerUnit: number;
  orders: number;
};

export type QuickStatus = {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  sellMovingWeek: number;
  sellOrders: number;
  buyPrice: number;
  buyVolume: number;
  buyMovingWeek: number;
  buyOrders: number;
};

export type Product = {
  product_id: string;
  buy_summary: Order[];
  sell_summary: Order[];
  quick_status: QuickStatus;
};

export type BazaarResponse = {
  products: Record<string, Product>;
};

export let bazaarData: BazaarResponse | null = null;

export function fetchBazaarData(): BazaarResponse | null {
  bazaarData = JSON.parse(GET('https://api.hypixel.net/v2/skyblock/bazaar') ?? 'null');
  return bazaarData;
}
