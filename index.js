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

// @ts-check

/// <reference types="../CTAutocomplete" />
/// <reference lib="es2015" />

/**
 * @typedef {Object} Order
 * @property {number} amount
 * @property {number} pricePerUnit
 * @property {number} orders
 */

/**
 * @typedef {Object} QuickStatus
 * @property {string} productId
 * @property {number} sellPrice
 * @property {number} sellVolume
 * @property {number} sellMovingWeek
 * @property {number} sellOrders
 * @property {number} buyPrice
 * @property {number} buyVolume
 * @property {number} buyMovingWeek
 * @property {number} buyOrders
 */

/**
 * @typedef {Object} Product
 * @property {string} product_id
 * @property {Order[]} buy_summary
 * @property {Order[]} sell_summary
 * @property {QuickStatus} quick_status
 */

/**
 * @typedef {Object} BazaarResponse
 * @property {Record<string, Product>} products
 */

/**
 * @template {Record<PropertyKey, unknown>} T
 * @typedef {NonNullable<{ [K in keyof T]: [K, T[K]] }[keyof T]>} Entry
 */

const TIMEOUT = 48 * 1000; // 48 seconds

/** @returns {BazaarResponse | null} */
function fetchPrices() {
  const URL = Java.type('java.net.URL');
  const BufferedReader = Java.type('java.io.BufferedReader');
  const InputStreamReader = Java.type('java.io.InputStreamReader');
  const StringBuilder = Java.type('java.lang.StringBuilder');

  const url = new URL('https://api.hypixel.net/v2/skyblock/bazaar');
  const conn = url.openConnection();
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

  return JSON.parse(res.toString());
}

function updatePriceData() {
  bestTierAndItsPricePerFinePerType.clear();

  bazaarData = fetchPrices();
  if (!bazaarData) return;

  objectEntries(bazaarData.products).forEach(([id, product]) => {
    const [tier, gem, controlValue] = id.split('_');
    if (controlValue !== 'GEM') return;
    if (tier !== 'FINE' && tier !== 'FLAWLESS') return;
    const divisor = {
      FINE: 1,
      FLAWLESS: 80
    }[tier];
    const pricePerFine = (product.quick_status.buyPrice - 0.1) / divisor;
    if (pricePerFine > (bestTierAndItsPricePerFinePerType.get(gem)?.[1] ?? 0)) {
      bestTierAndItsPricePerFinePerType.set(gem, [tier, pricePerFine]);
    }
  });
}

/**
 * @template K
 * @param {Map<K, number>} map
 * @param {K} key
 * @param {number} amount
 */
function add(map, key, amount) {
  const prev = map.get(key) ?? 0;
  map.set(key, prev + amount);
}

/**
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);

  /** @type {string[]} */
  let result = [];

  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  if (seconds > 0) result.push(`${seconds}s`);

  if (result.length === 0) result.push(`${ms}ms`);

  return result.join(' ');
}

/**
 * @param {number} num
 * @returns {string}
 * https://github.com/mozilla/rhino/issues/535
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * @template {Record<PropertyKey, unknown>} T
 * @param {T} obj
 * @returns {Entry<T>[]}
 */
function objectEntries(obj) {
  return Object.keys(obj).map(key => [key, /** @type {T[keyof T]} */ (obj[key])]);
}

/** @type {BazaarResponse | null} */
let bazaarData = null;
/** @type {Map<string, [string, number]>} */
const bestTierAndItsPricePerFinePerType = new Map();
/** @type {Map<string, number>} */
const pristineProcsSinceLastSackUpdate = new Map();
let lastUpdate = -1;
let start = -1;
/** @type {Map<string, number>} */
const drops = new Map();
/** @type {string[]} */
const overlayLines = [];

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

  /** @type {Map<string, number>} */
  const finePerType = new Map();
  Array.from(drops.entries()).forEach(([id, amount]) => {
    const [tier, gem] = id.split('_');
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
  const FONT_HEIGHT = /** @type {number} */ (fontRendererObj.field_78288_b);
  overlayLines.forEach((line, i) => {
    // drawString(text: String!, x: Int, y: Int, color: Int): Int
    fontRendererObj.func_78276_b(line, 10, 10 + i * FONT_HEIGHT, 0xf3b9ff);
  });
});

register(
  'chat',
  /** @type {any} */ (
    /** @param {ForgeTClientChatReceivedEvent} ev */ ev => {
      const str = ChatLib.getChatMessage(ev).replace(/§[0-9a-fklmnor]/g, '');
      if (/^\[Sacks\] \+[0-9,]+ items\. \(Last \d+s\.\)$/.test(str)) {
        /**
         * @type {string}
         * getSiblings()[0].getChatStyle().getChatHoverEvent().getValue().getUnformattedText()
         */
        const hoverText = ev.message.func_150253_a()[0].func_150256_b().func_150210_i().func_150702_b().func_150260_c();
        hoverText
          .split('\n')
          .slice(1, -2)
          .forEach(line => {
            const [match, amount, tier, gem] =
              line.trim().match(/^\+([0-9,]+) . (Rough|Flawed) (\w+) Gemstone \(Gemstones Sack\)$/) ?? [];
            console.log(match);
            if (!match) return;
            const id = `${tier}_${gem}_GEM`.toUpperCase();
            console.log(id);
            const accountedFor = pristineProcsSinceLastSackUpdate.get(id) ?? 0;
            const actualAmount = parseInt(amount.replace(/,/g, '')) - accountedFor;
            add(drops, id, actualAmount);
          });
        pristineProcsSinceLastSackUpdate.clear();
      } else {
        const match = str.match(/^PRISTINE! You found . Flawed (\w+) Gemstone x(\d+)!$/);
        if (!match) return;
        const id = `FLAWED_${match[1].toUpperCase()}_GEM`;
        const count = parseInt(match[2]);
        add(pristineProcsSinceLastSackUpdate, id, count);
        add(drops, id, count);
      }

      if (start === -1) {
        start = Date.now();
      }
      lastUpdate = Date.now();
    }
  )
);
