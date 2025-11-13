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
import { objectEntries, parseJson, split, toUpperCase } from './typesafety';
import { fetchBazaarData, bazaarData } from './bazaar';
import { GET } from './http';
import { add, formatDuration, formatNumber } from './utils';

type GemID<T extends string> = `${T}_${string}_GEM`;

const TIMEOUT = 48 * 1000; // 48 seconds
const REPO = 'averithefox/ct-gem-profit-calc';
const PREFIX = '§0[§6APC§0]§r';

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

const bestTierAndItsPricePerFinePerType = new Map<string, ['FINE' | 'FLAWLESS', number]>();
const pristineProcsSinceLastSackUpdate = new Map<GemID<'FLAWED'>, number>();
let lastUpdate: number = -1;
let start: number = -1;
const drops = new Map<GemID<'ROUGH' | 'FLAWED'>, number>();
const overlayLines: string[] = [];
let initialized = false;

register('worldLoad', () => {
  updatePriceData();
  if (!initialized) {
    const int8 = (str: string) => parseInt(str, 10) & 0xff;
    do {
      const SEMVER_REGEX = regex('^v?(\\d+)\\.(\\d+)\\.(\\d+)$');

      const res = GET(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (!res) {
        ChatLib.chat(`${PREFIX} §cFailed to check for updates`);
        break;
      }

      const latestTag = parseJson<{ tag_name: string }>(res).tag_name;
      const latestParts = SEMVER_REGEX.exec(latestTag);
      if (!latestParts) {
        ChatLib.chat(`${PREFIX} §cFailed to parse the release tag`);
        break;
      }
      const latest = (int8(latestParts[1]) << 16) | (int8(latestParts[2]) << 8) | int8(latestParts[3]);

      const curParts = split(__version, '.');
      const current = (int8(curParts[0]) << 16) | (int8(curParts[1]) << 8) | int8(curParts[2]);

      if (current >= latest) break;

      ChatLib.chat(`${PREFIX} §cA new version of the module is available (${latestTag}, you are on v${__version})`);
    } while (false);
    initialized = true;
  }
});

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
