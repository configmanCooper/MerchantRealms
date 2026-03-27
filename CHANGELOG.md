# Changelog

All notable changes to Merchant Realms will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.29.0] - 2026-03-27

### Added — Bridge Destruction Overhaul
- **Time-based bridge destruction** — Destroying a bridge now takes multiple days (7 base, 3 with skills) instead of being instant
- **Three destruction methods** — Manual Labor (rope + iron bars), Blasting Powder (fast but loud), Demolition Tools (balanced)
- **Detection system** — Daily chance of being caught (10%/day base, 2% skilled) by passing guards, soldiers, and NPCs
- **Consequences** — Getting caught: 2,000g fine (paid to kingdom coffers), 30 days jail, -30 reputation in ALL kingdoms
- **New goods: Blasting Powder** — Crafted at Apothecary from Salt × 4 + Hemp × 2
- **New goods: Demolition Tools** — Crafted at Blacksmith from Iron Bars × 3 + Rope × 2 + Wood × 3
- **New goods are bannable** — Blasting Powder and Demolition Tools can be banned by kingdoms like weapons/armor
- **Bridge destruction UI modal** — Shows method selection with material requirements, time estimates, detection rates, and progress tracking

### Fixed — Tutorial Interactive Steps
- **"Meeting the Townsfolk"** now accepts clicking an NPC OR the Talk button
- **"Kingdom Orders"** removed misleading highlight, clearer instructions
- **"Royal Commissions"** updated text for clarity
- **"Outposts & Expansion"** made non-interactive (section doesn't exist in Buildings panel)
- **"Dark Deeds & Schemes"** forces Schemes button visible during tutorial
- **"The Leaderboard"** closes previous modal before opening Rankings

### Fixed — UI Improvements
- **Button colors** — Fixed all hard-to-read dark red buttons across entire UI
- **Town detail layout** — Moved "View Townspeople" above "Land & Housing", moved "Actions" above "Sell to Kingdom"
- **Kingdom orders display** — Added defensive fallbacks for undefined qty/maxPricePerUnit values
- **Sabotage crime penalties** — Updated to 2,000g fine and 30 days jail

### Changed — NPC Movement
- **Organic NPC movement** — Each NPC has unique movement patterns using hash-based random walks
- **Performance optimization** — NPCs only render when zoomed in past 1.5x
- **Stable NPC selection** — Sorted by numeric ID to prevent visual popping
- **Shift-key tooltip fix** — Increased hit radius when shift held, added sticky hover for stability

## [0.28.0] - 2026-03-27

### Fixed — Comprehensive Bug Hunting Pass (43 bugs fixed)

#### Critical — Input Validation (State Corruption Prevention)
- **buy() string/NaN/Infinity exploit** — buy('wheat', 'abc') no longer corrupts gold to NaN
- **sell() string/NaN exploit** — sell() now validates quantity with Number() + isFinite()
- **bribeRequisitionGuard() string exploit** — bribe('abc') no longer corrupts player gold
- **bribeGuards() string exploit** — Town guard bribe now validates amount before processing
- **giveSpouseGold() string exploit** — Spouse gold transfer now validates amount
- **askSpouseForMoney() string exploit** — Spouse money request now validates amount
- **makeDebtPayment() string exploit** — Indentured debt payment now validates amount
- **buyHorseForTravel() string cost** — Horse purchase cost now validated before gold deduction
- **hireArmedEscort() string days** — Escort hire duration now validated
- **depositToStorage() string qty** — Warehouse deposit now validates quantity
- **withdrawFromStorage() string qty** — Warehouse withdrawal now validates quantity
- **sellToKingdom() string qty** — Kingdom sell now validates and floors quantity
- **giveGift() string qty** — Gift giving now validates quantity
- **sellCounterfeit() string qty** — Counterfeit sales now validates quantity
- **attemptSmuggle() string qty** — Smuggling now validates quantity
- **deliverOrder() string qty** — Kingdom order delivery now validates quantity
- **deliverSupplyDeal() string qty** — Supply deal delivery now validates quantity
- **stealGoods() string qty** — Theft now validates quantity

#### Critical — Caravan System
- **sendCaravan() goods NaN** — Caravan goods quantities now validated with Number() + isFinite() + floor()
- **sendCaravan() guards NaN** — Guard count now properly validated
- **sendSeaCaravan() goods NaN** — Sea caravan goods quantities now validated
- **sendSeaCaravan() guards NaN** — Sea caravan guard count now validated
- **Sea caravan missing active flag** — Sea caravans now set `active: true` so they appear in Routes panel
- **Naval blockade goods duplication** — Blocked caravans now clear goods after returning to player, preventing item duplication
- **Naval blockade processing leak** — Blocked caravans now skip storm/arrival processing in the same tick

#### High — Inheritance System
- **dynasty_founder skill never applied (3 paths)** — The `hasSkill('dynasty_founder')` check was running AFTER skills were wiped to `{keen_eye: true}`, so the +1 bonus skill point was never granted. Fixed in inheritAsChild(), inheritAsSpouse(), and regency inheritance.

#### High — God Mode
- **Set Gold NaN** — God mode gold setter now validates input with parseInt + isNaN check
- **Set Rank NaN** — God mode rank setter now validates input range (0-6)
- **Advance Days no cap** — God mode day advance now capped at 365 and validates input

#### Medium — Config Safety
- **XP_REWARDS.HEIR_TRANSFER_RATIO fallback** — Added `|| 10` fallback to prevent Infinity on inheritance
- **XP_REWARDS.DAILY_PASSIVE fallback** — Added `|| 0.1` fallback to prevent NaN XP accumulation
- **CONFIG.BUILDING_GUARD_COST_PER_SEASON fallback** — Added `|| 50` fallback in 3 locations
- **CONFIG.BUILDING_LOCKED_STORAGE_COST fallback** — Added `|| 100` fallback

#### Low — UI Polish
- **Trade preview decimal display** — Changed `.toFixed(1)` to `Math.round()` so gold shows as integers (not "10.0g")

#### Fixed — Music System
- **Title music not playing on New Game click** — AudioContext resume was blocked by a flag that was incorrectly set during the failed autoplay attempt on page load, preventing the real user-gesture resume from firing
- **Tutorial double-play overlap** — Switching from title music to game music now properly stops the previous track before starting the new one (was playing both simultaneously for ~4 seconds)
- **AudioContext resume race condition** — Resume callback now verifies context is actually running before scheduling audio, preventing phantom schedule attempts from failed autoplay
- **Removed non-functional mousemove listener** — mousemove is not a qualifying user gesture for AudioContext; removed to avoid confusion

#### Previously Fixed (from v0.27.0 checkpoint)
- **Tutorial "Buy a Home" text** — Changed from "Tent" to "Shack" (tent doesn't exist)
- **Tutorial "Arm Yourself"** — Now directly equips weapon/armor instead of adding to inventory
- **Tutorial save button ID** — Changed `#btnSaveGame` to `#btnSave`
- **Corruption Expert bribe formula** — Lowered floor from 20 to 10, changed divisor from /60 to /30

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
