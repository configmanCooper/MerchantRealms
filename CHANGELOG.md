# Changelog

All notable changes to Merchant Realms will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.27.0] - 2026-03-27

### Fixed — Bug Hunting Pass (26 bugs)
- **Negative Quantity Exploit (buy)** — Buying negative quantities no longer adds free items to inventory
- **Negative Quantity Exploit (sell)** — Selling negative quantities no longer generates free gold
- **Negative Quantity Exploit (giveGift)** — Gift function now rejects ≤0 quantities
- **Fractional Quantity Exploit (buy/sell)** — Fractional quantities are now floored to prevent inventory drift
- **Caravan Empty Goods** — sendCaravan() now rejects empty goods objects and 0-qty entries
- **Caravan Negative Guards** — sendCaravan() now rejects negative guard counts
- **Sea Caravan Validation** — sendSeaCaravan() now validates goods and guard parameters
- **Storage Withdraw/Deposit Validation** — Both functions now reject ≤0 quantities
- **Kingdom Sell Validation** — sellToKingdom() now rejects ≤0 quantities
- **Counterfeit Sell Validation** — sellCounterfeit() now rejects ≤0 quantities
- **Bribe Validation** — bribeRequisitionGuard() now rejects ≤0 bribe amounts
- **Building Output Null Check** — collectBuildingOutput() now checks for null resourceId/quantity
- **Wrong Skill ID: combat_training** — Requisition dialog now checks correct `combat_trained` skill
- **Wrong Skill ID: veteran_fighter** — Resist function now checks correct `battle_hardened` skill
- **Promotion Fee TOCTOU** — petitionForPromotion() re-checks gold after tick advance before deducting fee
- **Energy Null Debuffs** — getEnergyDebuffs() now handles null/undefined energy (from corrupted saves)
- **Energy Null Collapse** — checkEnergyForAction() now handles null energy instead of triggering false collapse
- **Sea Travel RNG** — Pirate encounters and storm checks now use deterministic game RNG instead of Math.random()
- **Off-road Discovery RNG** — Wilderness discovery events now use deterministic game RNG for save/load reproducibility
- **Invalid Resource: gold_ingot** — Mountain discovery now correctly awards `gold_ore` instead of non-existent `gold_ingot`
- **Kingdom War Display** — Fixed parseInt() on kingdom IDs (e.g., "k_1") returning NaN, breaking war status display in relations panel

## [0.26.0] - 2026-03-26

### Added
- **NPC Idle Animation** — NPC dots on the map now gently wobble when time is ticking, giving towns a sense of life
- **Resource Deposit Map Overlay** — Press `R` or click ⛏ Deposits to see resource deposit icons above towns (requires Regional Survey skill)
- **NPC Quirks on All NPCs** — Every NPC (children, elites, royals, settlers, newborns) now gets random quirks, not just normal townspeople
- **Worker Quirk Effects System** — NPC quirks now affect building production: output bonuses/penalties, material savings, theft, breakage, quality modifiers, and loyalty effects
- **Quirk Discovery via Social Actions** — Observe (8hrs/30%), Ask Around (4hrs/25%), and Investigate (costs gold/50%) now work on all NPCs to reveal hidden quirks and traits
- **Discovered Quirks Display** — NPC detail panel now shows a "🔍 Discovered Info" section with revealed traits and quirks
- **Scheme Tooltips** — All 5 scheme category tabs (Sabotage, Political, Assassination, Tax Evasion, Market) now have descriptive hover tooltips
- **Social Action Tooltips** — Gift, Talk, Observe, Ask Around, and Investigate buttons now have hover tooltips explaining what they do
- **Disabled Scheme Explanations** — Schemes you can't use now show red italic text explaining why (missing skills, rank, or gold)
- **Tutorial: Notifications & Settings Step** — New step in Chapter 7 teaching about the 🔔 notification bell and ⚙️ Settings filters
- **Tutorial: Kingdom Orders Step (Interactive)** — Replaced text-only step with hands-on walkthrough pointing to the correct UI location
- **Tutorial: Royal Commissions Step** — New interactive step teaching the 📦 Commissions system with injected sample data
- **Tutorial: Injected Sample Data** — Tutorial now creates 3 procurement orders and 2 royal commissions so players can see real examples
- **Tutorial: Citizen Starting Rank** — Tutorial player now starts as Citizen (rank 1) instead of Peasant, so they can actually build things
- **Tutorial: Building Materials Boost** — Starting town and all adjacent towns are stocked with wood, stone, iron, planks, bricks, clay, rope, and iron ore
- **Game Guide: 8 New Entries** — Added entries for Kingdom Procurement Orders, Commissions vs Orders, Finding Kingdom Features, Schemes, NPC Quirks & Traits, Discovering Quirks, Worker Quirk Effects, and Resource Deposits
- **Tutorial Cleanup on Exit** — New `Tutorial.cleanup()` API for safely removing tutorial UI without navigation loops
- **Travel Panel Draggable** — Travel panel can now be dragged around the screen by its header

### Changed
- **Market Prices Collapsible** — Market Prices section in town detail is now collapsed by default with a ▶/▼ toggle, making the Actions section easier to reach
- **Travel Panel Position** — Travel panel moved higher on screen (bottom: 120px instead of 60px)
- **Music Reliability** — Fixed AudioContext resume race condition where music wouldn't play on title screen until after starting a full game

### Fixed
- **Notification Bell Badge** — Clear Log button now properly clears the notification count badge (was persisting due to toast() race condition)
- **Social Button Refresh** — Observe/Ask Around/Investigate no longer redirect to the courtship panel after use; they properly refresh the person detail view
- **Tutorial Panel Persistence** — Tutorial info panel no longer stays on screen when returning to title or starting a new game
- **Kingdom Orders Highlight** — Tutorial step now correctly directs players to town detail ⚒️ Actions instead of the wrong Kingdoms button
