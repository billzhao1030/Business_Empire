<p align="center">
  <img src="build/banner.png" alt="Business Empire" width="100%">
</p>

<h1 align="center">Business Empire</h1>

<p align="center">
  <b>Start with $0. End owning the companies on the world rich list.</b><br>
  A deep, offline-first business tycoon simulation that runs entirely in your browser — with zero dependencies.
</p>

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-3c873a">
  <img alt="Dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Languages" src="https://img.shields.io/badge/UI-English%20%2F%20%E4%B8%AD%E6%96%87-orange">
  <img alt="Ads" src="https://img.shields.io/badge/ads-none-lightgrey">
</p>

<p align="center"><a href="README.zh-CN.md">🇨🇳 中文说明</a></p>

---

## The pitch

You wake up with **nothing**. no savings, no company, no car — just a job handing out flyers for $18 an hour.

Eight in-game hours a day you work your shift. After 17:00 you can pick up overtime — but each
overtime hour genuinely *takes an hour*: the money only lands once it has elapsed, you cannot start
a second one until the first is done, and it burns stamina you only get back by sleeping. A day is
still 24 hours and you are still a person.

Your last paycheck buys a $120 street stall, and the stall keeps earning while you're asleep. The
stall buys a pancake cart. The cart buys a bubble tea shop.

Somewhere around your fourth store you stop caring about your salary. You start caring about
**where the money is parked** — 200 listed companies whose prices move on a six-factor stochastic
model, twelve commercial districts whose prosperity literally multiplies your stores' revenue,
ten regional housing markets you can mortgage into, and 23 cryptocurrencies that will happily
ruin your week.

And then, one day, you own enough of a company to make a **tender offer** for the rest of it —
and the billionaire who founded it drops down the rich list, because his fortune was never
abstract: it was that share price, and you just bought it.

---

## What makes it interesting

|  | |
|---|---|
| **📈 A market that behaves like a market** | Prices are not random walks with a cap. Each hourly log-return is the sum of a market factor scaled by β, a slow-rotating sector momentum, idiosyncratic noise, mean reversion toward a growing intrinsic value, GARCH-style volatility clustering, and Poisson jumps with news shocks. Bubbles inflate and deflate. Sectors rotate. Calm periods and panics both emerge on their own. |
| **🌍 A macro economy that moves everything** | Seven regimes — Boom, Expansion, Steady, Inflation, Slowdown, Recession, Crisis — re-rolled every in-game month. The regime moves equity drift, volatility, the **central bank policy rate** (which sets your savings, loan and mortgage rates), and the footfall at every store you own. Ten world events can rewrite the board outright. |
| **⏳ Labour that respects the clock and your body** | The day splits into sleep (23:00–07:00), an eight-hour shift (09:00–17:00) and free hours. Overtime occupies a real in-game hour and pays on completion — no click-spamming. Stamina drains as you work and recovers only in sleep; below 60 your output degrades, below 15 you cannot work overtime at all. Four overtime hours a day is sustainable, six burns you out. Wage income is capped by both time and biology; businesses are the only thing that scales. |
| **🏬 Businesses with real operating decisions** | Six levers per store: location, **pricing strategy** (discount builds long-run traffic, premium harvests and churns customers), **staffing** (understaffing loses orders *and* customers), expansion, marketing and refurbishment. Get it wrong and you watch demand bleed out over the next in-game month. |
| **🏛️ Ownership that has consequences** | Every company has a tradable-stake cap. Max it out and you can tender for the rest at a 20–65% premium. A wholly-owned subsidiary remits its profit to you monthly — and if it's loss-making, you cover the losses. |
| **👋 Offline earnings, properly accounted** | Close the tab for three days and come back to a **Welcome Back** report: how long you were gone in real *and* in-game time, what your net worth did, exactly which sources the money came from, where it went, and how much of the change was valuation rather than cash. The numbers reconcile to the cent. |
| **🔒 Yours, entirely** | One `node server.js`. No npm install, no CDN, no telemetry, no ads, no account on anyone's server. The whole save is a single SQLite file you can copy. |

---

## Quick start

**Requirements:** Node.js **v22.5+** (v24 LTS or newer recommended). Nothing else.

```bash
git clone https://github.com/billzhao1030/Business_Empire.git
cd Business_Empire
node server.js
```

Open **http://localhost:8020** and register an account. That's it.

<details>
<summary><b>macOS — one-click desktop app</b></summary>

```bash
./tools/make-desktop-icon.sh
```

Builds a signed `.app` on your Desktop with a generated icon. Double-clicking it starts the server
if it isn't running (~0.7 s) and opens the browser; if it's already running it just opens the page
(~0.07 s). Logs go to `~/Library/Logs/BusinessEmpire.log`.
</details>

<details>
<summary><b>Windows</b></summary>

```powershell
winget install OpenJS.NodeJS.LTS   # once
node server.js
```

Or double-click **`start.bat`** (keeps a console window) or **`Business Empire.vbs`**
(silent background start — right-click → *Send to* → *Desktop shortcut* for an icon that behaves
exactly like the macOS app).

On Node v22/v23 use `node --experimental-sqlite server.js`.
</details>

<details>
<summary><b>Configuration</b></summary>

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8020` | HTTP port |
| `GAME_HOUR_MS` | `120000` | Real milliseconds per in-game hour. Changing it never corrupts a save — the clock re-anchors. |

Save file: `data/game.db`. Delete `data/game.db*` to wipe everything, or use the in-game
**About → Reset save / Delete account**.
</details>

---

## How it plays

**Time:** 2 real minutes = 1 in-game hour. A game day is 48 minutes, a game month 24 real hours,
a game year 12 days. **Everything accrues while you're away** — stores trade, interest compounds,
loan payments are debited, prices move, property indices drift.

**New saves are pre-seeded with 30 in-game days of price history**, so every chart, candle and
sparkline is meaningful from the first second.

### The ladder

```
$144 last paycheck  →  $120 street stall  →  $900 scooter (unlocks driving jobs, $18→$130/hr)
    →  a portfolio of stores  →  equities & district units  →  leverage & mortgaged property
    →  50% of a company  →  100% of a company  →  the top of the rich list
```

### Systems at a glance

- **12 jobs** ($18 → $3,200 per work-hour). Regular shift 09:00–17:00, up to 6 overtime hours at 1.6× pay, gated by a stamina system. The in-game clock and your current day-phase are pinned to the top of the interface at all times.
- **36 business formats** from a $120 street stall to a $5 B commercial spaceport, across 6 cities.
- **243 tradable instruments**: 200 stocks in 54 sectors, 12 commercial districts, 8 commodities, 23 cryptocurrencies — plus 14 non-tradable indices (broad market, 10 regional housing markets, watches, fine art, classic cars).
- **94 purchasable assets**: 21 cars (a car unlocks the driving jobs), 53 properties across 10 regions with independent live housing indices, yachts, jets, watches, fine art. Prestige from luxury lifts revenue at *every* store, up to +60%.
- **A bank** whose rates float off the policy rate, with a 300–850 credit score, term deposits, unsecured credit, mortgages (20–100% down, 5/10/20/30 years) and punitive overdraft.
- **Taxes**: 25% corporate (monthly), 20% capital gains, 10% dividend withholding, 0.08% monthly property tax, 0.1% commission and a 0.04% spread on every trade.
- **A 40-strong rich list** of fictionalised tycoons whose fortunes are computed live from in-game share prices — dilute them by buying their companies.

---

## Under the hood

Zero third-party packages. Node's built-ins do everything:

```
node:http     →  the server              node:sqlite  →  the entire persistence layer
node:crypto   →  scrypt password hashing node:zlib    →  the PNG encoder that draws the app icon
```

The front end is plain ES modules with no build step; every chart — line, candlestick, moving
averages, sparklines, donuts — is drawn by hand into a `<canvas>` in ~250 lines.

```
src/
  market.js          price engine, macro regimes, game clock, news generation
  sim.js             player economy: work, operations, interest, tax, events
  api.js             business logic
  catalog-assets.js  200 stocks · commodities · crypto · districts · indices
  catalog-content.js businesses · cities · regions · property · vehicles · jobs · rivals
public/js/
  chart.js           canvas charting            i18n.js   284 bilingual strings
  views/             10 screens
```

Simulation cost: ~437 ms to generate a fresh world with 30 days of history for 257 instruments;
a live tick for all of them takes well under a millisecond.

---

## Roadmap

- [ ] Native Android client reusing the same REST API and accounts
- [ ] Optional rewarded-ad boosts with a one-time permanent ad-free unlock
- [ ] Short selling and margin
- [ ] Limit and stop orders
- [ ] Competitor AI that opens stores against you in the same districts

---

## Legal

**Copyright © 2026 Xunyi Zhao ([@billzhao1030](https://github.com/billzhao1030)).**
Released under the [MIT License](LICENSE).

> **Parody disclaimer.** Every company, brand, product and person in this game is **fictional**.
> Names such as *Appel*, *MicroHard*, *Envidia*, *Teslo*, *Elon Tusk* or *Jeff Bezoz* are
> deliberate parodies created for satirical and entertainment purposes. They are **not**
> affiliated with, endorsed by, sponsored by or connected to any real company or individual, and
> any resemblance is intentional commentary rather than a claim of association. All financial
> figures, price series and events are synthetic.
>
> **Not financial advice.** This is a game. Nothing in it constitutes investment advice, and its
> market model — deliberately entertaining rather than accurate — should not be used to reason
> about real markets.
