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

import { regex } from 'arkregex';
import { objectEntries, split, toUpperCase } from './typesafety';
import { fetchBazaarData, bazaarData } from './bazaar';

type GemID<T extends string> = `${T}_${string}_GEM`;

const TIMEOUT = 48 * 1000; // 48 seconds

function updatePriceData() {
  bestTierAndItsPricePerFinePerType.clear();

  fetchBazaarData();
  if (!bazaarData) return;

  objectEntries(bazaarData.products).forEach(([id, product]) => {
    const [tier, gem, controlValue] = id.split('_');
    if (!tier || !gem || controlValue !== 'GEM') return;
    if (tier !== 'FINE' && tier !== 'FLAWLESS') return;
    const divisor = (
      {
        FINE: 1,
        FLAWLESS: 80
      } satisfies Record<typeof tier, number>
    )[tier];
    const pricePerFine = (product.quick_status.buyPrice - 0.1) / divisor;
    if (pricePerFine > (bestTierAndItsPricePerFinePerType.get(gem)?.[1] ?? 0)) {
      bestTierAndItsPricePerFinePerType.set(gem, [tier, pricePerFine]);
    }
  });
}

function add<K>(map: Map<K, number>, key: K, amount: number) {
  const prev = map.get(key) ?? 0;
  map.set(key, prev + amount);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);

  let result: string[] = [];

  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  if (seconds > 0) result.push(`${seconds}s`);

  if (result.length === 0) result.push(`${ms}ms`);

  return result.join(' ');
}

// https://github.com/mozilla/rhino/issues/535
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const bestTierAndItsPricePerFinePerType = new Map<string, ['FINE' | 'FLAWLESS', number]>();
const pristineProcsSinceLastSackUpdate = new Map<GemID<'FLAWED'>, number>();
let lastUpdate: number = -1;
let start: number = -1;
const drops = new Map<GemID<'ROUGH' | 'FLAWED'>, number>();
const overlayLines: string[] = [];

register('worldLoad', updatePriceData);

register('command', updatePriceData).setName('apt:update-price-data');

register('tick', () => {
  if (Date.now() > lastUpdate + TIMEOUT) {
    if (start !== -1) {
      drops.clear();
      start = -1;
      overlayLines.length = 0;
    }
    return;
  }

  if (!bazaarData) return;

  const finePerType = new Map<string, number>();
  Array.from(drops.entries()).forEach(([id, amount]) => {
    const [tier, gem] = split(id, '_');
    const divisor = {
      ROUGH: 6400,
      FLAWED: 80,
      FINE: 1
    }[tier];
    add(finePerType, gem, amount / divisor);
  });
  const finePerTypeEntries = Array.from(finePerType.entries());

  const uptimeMs = Date.now() - start;
  const uptime = formatDuration(uptimeMs);

  const profit = finePerTypeEntries.reduce((acc, [gem, amount]) => {
    const [, pricePerFine] = bestTierAndItsPricePerFinePerType.get(gem) ?? [];
    if (!pricePerFine) return acc;
    return acc + amount * pricePerFine;
  }, 0);
  const profitPerHour = profit * (3_600_000 / uptimeMs);

  overlayLines.length = 0;
  overlayLines.push(
    `$${formatNumber(Math.floor(profit))} / ${uptime}`,
    `$/hr: $${formatNumber(Math.floor(profitPerHour))}`
  );
});

register('renderOverlay', () => {
  const fontRendererObj = Client.getMinecraft().field_71466_p;
  const FONT_HEIGHT = /** @type {number} */ fontRendererObj.field_78288_b;
  overlayLines.forEach((line, i) => {
    // drawString(text: String!, x: Int, y: Int, color: Int): Int
    fontRendererObj.func_78276_b(line, 10, 10 + i * FONT_HEIGHT, 0xf3b9ff);
  });
});

register('chat', ((ev: ForgeTClientChatReceivedEvent) => {
  const str = ChatLib.getChatMessage(ev).replace(/§[0-9a-fklmnor]/g, '');
  if (/^\[Sacks\] \+[0-9,]+ items\. \(Last \d+s\.\)$/.test(str)) {
    const hoverText: string = ev.message
      .func_150253_a()[0] // getSiblings()[0]
      .func_150256_b() // getChatStyle()
      .func_150210_i() // getChatHoverEvent()
      .func_150702_b() // getValue()
      .func_150260_c(); // getUnformattedText()
    hoverText
      .split('\n')
      .slice(1, -2)
      .forEach(line => {
        const theRegex = regex('^\\+([0-9,]+) . (Rough|Flawed) (\\w+) Gemstone \\(Gemstones Sack\\)$');
        const parts = theRegex.exec(line.trim());
        if (!parts) return;
        const [, amountStr, tier, gem] = parts;
        const id = toUpperCase(`${tier}_${gem}_GEM` as const);
        const accountedFor = pristineProcsSinceLastSackUpdate.get(id as GemID<'FLAWED'>) ?? 0;
        let amount = parseInt(amountStr.replace(/,/g, '')) - accountedFor;
        add(drops, id, amount);
      });
    pristineProcsSinceLastSackUpdate.clear();
  } else {
    const theRegex = regex('^PRISTINE! You found . Flawed (\\w+) Gemstone x(\\d+)!$');
    const parts = theRegex.exec(str);
    if (!parts) return;
    const id = toUpperCase(`FLAWED_${parts[1]}_GEM` as const);
    const amount = parseInt(parts[2]);
    add(pristineProcsSinceLastSackUpdate, id, amount);
    add(drops, id, amount);
  }

  if (drops.size && start === -1) {
    start = Date.now();
  }
  lastUpdate = Date.now();
}) as any);
