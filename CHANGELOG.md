# Changelog

All notable changes to Merchant Realms will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.73.0] - World Simulation & Diplomacy Overhaul

### Added — Diplomatic Systems
- 3 differentiated treaty types: Trade Agreements (tariff reduction, specific goods, timed), Mutual Defense Pacts (defensive war trigger), Border Accords (passage rights)
- `_activeTreaties` array on kingdoms tracking active treaties with duration, passive relation boosts
- Treaty expiration tick and automatic cancellation on war declaration
- Mutual Defense Pact trigger: when attacked, MDP partners evaluate joining war (personality/strength-based)
- Shared-enemy alliance bonuses: kingdoms fighting same enemy get threshold reduction + relation boost
- Diplomatic king personality bonus for alliance formation (-5 threshold)
- Alliance formation cooldowns (30-day threat eval, 3% daily roll gate) to prevent flooding

### Added — War Declaration AI (C3)
- Lowered war relation threshold to -30 (was CONFIG default)
- Added opportunity wars: attack neighbors already at war with someone else
- Aggressive king bonus: 0 exhaustion + military superiority = +0.8% daily war chance
- Lowered scouting threshold from 70% to 60% of enemy strength
- Military advantage threshold lowered to 1.2x

### Added — Revolt Systems
- Revolt survival AI (`_tickRevoltSurvivalAI`): defense recruitment, peace negotiation, alliance seeking
- Revolt EM recruitment (`_tickRevoltEMRecruitment`): guildmaster offers, personality-driven acceptance
- Revolt success bonuses: gold plunder (proportional), 5% goods transfer, happiness boost (+30/30d, +15/90d)
- Fast AI mode for revolt kingdoms (every 5 days for first 30 days)

### Added — World Chronicle
- Chronicle cap raised to 1000 (rolling delete of oldest)
- New event types: trade_agreement, mutual_defense_pact, border_accord, em_defection, solo_assassination
- Updated chronicle UI categories (politics, revolt, diplomacy groups)

### Fixed
- Naval combat casualties: `resolveNavalBattle` now tracks actual casualties (was always 0)
- `killPerson` wrapper alias added to engine_diplomacy.js
- `day` → `world.day` in tickNobleRelationships jail case
- `rng is not defined` in declareWar MDP code (uses world.rng)
- Alliance event flooding (353 → 22 per 900 days) via cooldowns and roll gates

### Verified — World Simulation
- 4 simulation runs (900×2, 1800, 2700 days) — all 0 errors
- Wars: 2-12 per sim, Assassinations: 1-6, Revolts: 0-3, Treaties: 16-56
- Alliances: 15-73 formed per sim with healthy dissolution rates
- Population growth: 70-140% over sim duration
- Happiness variance: 0-94 (genuine, not stuck at 50)

## [0.72.0] - Kingdom Management Overhaul (War, Economy, Nobility, Auto-Work)

### Added — War & Military
- Army consolidation system: soldiers must travel from garrisons to staging point before deployment
- Military AI proposals: AI suggests strategies (attacks, defenses) for player-king approval
- Accept/reject peace offers and surrender offers in King UI War Management
- Mounted cavalry: entire troop can be sent with horses+saddles for 25% faster march
- AI strategic mount decisions (resource-aware, not automatic)
- Player combat skill/equipment now affects battle outcomes when player is king
- Border town fortification: AI prepares defenses before invasion

### Added — Kingdom Economy & Employees
- Kingdom employee system: procurers, guards, royal guards as actual NPC job postings
- Procurement order system: kingdom buys from real markets at real prices via procurer NPCs
- Kingdom finances tab: income/expenses for 30/90 days with 30-day treasury forecast
- NPC asset transfer: king's personal businesses/caravans become kingdom-owned
- Stockpile commissions: king can commission goods for royal stockpile
- Goods transfer: send goods from stockpile to specific town markets
- Export bans, goods subsidies, product bounties, land subsidies as king UI economic policies

### Added — Nobility & Loyalty
- Noble perceived loyalty vs real loyalty: two separate numbers, king sees perceived
- Noble manipulation: nobles can make king think others are loyal/disloyal
- King investigation: multiple actions to uncover loyalty discrepancies
- Noble fear system (0-100): affects loyalty, perceived loyalty, relationships based on personality
- Noble punishment system: fines, jail, asset seizure, execution with cascading consequences
- Audience wave effects: promoting one noble may make others jealous (affects loyalty/relationships)
- Feast/court attendance: nobles AI decides based on relationships, loyalty, goals

### Added — Recruitment & Conscription
- Soldier recruitment via posting system (not instant): NPCs decide if they want to enlist
- Conscription law: 20% pay, male 18+, non-soldier/guard NPCs forced if law active
- Conscription happiness penalties: slight kingdom-wide, severe for conscripted individuals
- Garrison transfers: soldiers must travel between locations (organic travel time)
- Occupation-based NPC sorting in town view

### Added — Player Jobs & Auto-Work
- Kingdom procurer/guard/royal guard jobs visible in player work dialog when kingdom is hiring
- Auto-work system for ALL jobs: repeat job automatically with auto-rest/eat/drink
- Auto-rest at energy < 50, recovers to 100 (improved thresholds)
- Auto-buy food/drink from local market when inventory depleted
- Auto-build 1-2 relationship points/day with same-occupation NPCs
- Procurer/guard auto-travel: generates multi-town missions, auto-restarts on completion
- Persistent auto-work UI overlay with stop button (visible in town + during travel)
- Auto-work stops automatically if job becomes unavailable (player notified)

### Fixed
- Subsidized land button text now readable (dark green on gold background)
- Auto button readable (was broken emoji, now HTML entity with proper contrast)
- Promotion progress label: "Gold Earned" → "Gold Earned from Trading"
- Route time over-weighting in war target selection (was 2× multiplier dominating)
- Indentured servant system: conquered population gets 80% earnings tax for 7 years
- War AI: offensive strategy diversity (no longer identical constant random attacks)
- King UI population display (was showing 0)
- Town view NPC list errors
- Peace petition now routes to best available option

## [0.71.0] - Post-Refactor Audit & God Mode Enhancements

### Fixed
- 9 silent Engine API failures (getMarketPrice triple-def, getKingdomHappiness/getKingMoodModifiers/getMilitaryBreakdown id-vs-object, getRng internal call, king UI display, notification filter restore, dead duplicate exports)
- Module parameter consistency (engine_diplomacy buildNewRoad 4th param, ui_buildings getMarketPrice town.id)
- God mode Invincible and Bandits toggle crash (event delegation `this` bug)
- 3 critical empty catch blocks now log warnings

### Added
- God mode: King rank (7) in Set Rank dropdown — kills current king, grants full royal privileges
- God mode: Full NPC identity transfer on Become NPC (name, age, sex, gold, occupation, socialRank, citizenship, noble/king status, family ties)
- God mode: Old player stuffed into Elite Merchant with full data (gold, inventory, skills, personality, reputation, spouse linkage)
- NPC Browser: Social rank badges (👑King, 🏰Lord, 🎖️Noble, ⚒️Guildmaster)

### Validated
- 153/153 API wrapper tests pass (every Engine/Player/UI method with id+object inputs)
- 0/1680 methods lost from module split
- 5000-tick stability: zero NaN, zero Infinity, zero errors
- Sections 1-10 simulation audit + 28 phase comprehensive test all pass

## [0.70.0] - Code Architecture Overhaul (H1 + C3)

### Changed
- H1: 25 IIFE extension modules extracted (47,262 lines, 40.8% reduction)
- C3: ~800 inline onclick → data-action + registerAction (~500 handlers)
- Notification system overhaul with background gossip + Street Ears skill

## [0.69.0] - Become King

### Added
- **Become King Feature**: Players can now ascend to the throne through two paths:
  - **Blood Heir Path**: Marry king's daughter → have child → die → play as child heir → inherit throne when king dies (no vote needed)
  - **Election Path**: Eliminate all blood relatives of the king → be a noble (rank 4+) → king dies → nobles vote on new ruler
- **King UI Panel**: Full strategic management interface with 5 tabs:
  - **Overview**: Kingdom stats, treasury, happiness, risk meters, war status, active laws, reign statistics
  - **Decisions**: Tax rate slider (2-25%), enact/repeal special laws, declare war/sue for peace, host feasts, hold court
  - **Kingdom**: List of all towns with population, happiness, garrison, quarantine status
  - **Court**: Full list of nobles with relationship levels, loan/blackmail indicators
  - **Threats**: Assassination and revolt risk breakdown with advice, emergency "Flee the Kingdom" escape button
- **King Mode Gameplay**: When crowned, player stays at capital, no hunger/thirst/energy management, trade/build/hire/caravan disabled, daily king tick calculates risks
- **Assassination System**: Daily assassination chance based on noble hostility. Guards reduce risk. Failed attempts notify player. Successful attempts trigger death/heir UI
- **Revolt System**: When coup fires against player-king, shows interactive Revolt UI with Fight (risk-based survival)/Flee (guaranteed)/Surrender (game over) options
- **Flee Mechanic**: Emergency escape resets name, reputation, social rank, gold to 50, moves to random foreign town. Keeps skills, achievements, family
- **Election Overhaul**: All nobles rank 4+ can be candidates and voters (not just royal advisors). Weighted voting: RA=3 votes, Lord=2, Minor Noble=1. Player influence via relationships, loans, and blackmail
- **Blood Relative Check**: Grandchildren (via player marrying king's daughter) now recognized as valid blood heirs in succession
- **King Button**: New 👑 King button in bottom bar (visible only when ruling)
- **Crowned King Achievement**: Upgraded to platinum tier (500 XP)
- **Save Migration v6**: Adds isKing and kingState fields to player data

### Changed
- **Succession System**: handleKingDeath now checks grandchildren before falling back to election
- **Election Scoring**: Uses rank×10 + wealth + intelligence + ambition with random factor, plus player influence bonuses from loans (+10), blackmail (+15), and high relationships (+0-15)
- **Bottom Bar**: Trade, Build, Hire, Caravan buttons disabled (grayed out) while ruling as king
- **Vitals Skip**: Hunger, thirst, and energy ticks skipped when player is king (auto-maintained at 80+)

## [0.68.0] - Life Systems & Bug Fixes

### Fixed
- **Bankruptcy Modal**: X button can no longer close the bankruptcy dialog — must choose an option, go to main menu, or save/load
- **Starvation/Dehydration Death**: Deaths from starvation or dehydration now properly trigger the heir selection UI (or defeat screen if no heirs). Fixed god mode revival for all death paths. Added `!window._godInvincible` guard to all death paths. Set `player.alive = false` before calling `handlePlayerDeath()` to prevent repeated death toasts.
- **Age Achievement Mismatches**: Old age check was at 60 instead of 40, ripe old age was at 75 instead of 60 — now correctly aligned

### Changed
- **Relationship Decay Overhaul**: All relationships now decay passively (including spouse and children). Tiered system: 20-60 very slow (0.05/day), 60-80 moderate (0.15/day), 80-100 faster (0.3/day). Same-town reduces decay by 80%. Family relationships decay at half rate. `smooth_talker` skill still halves decay. Relationships below 20 are stable (no decay).
- **Age Achievements Reworked**: `adulthood` (25) → `prime_of_life` (30, bronze). `old_age` (40) → `seasoned_merchant` (40, silver). `ripe_old_age` kept at 60, gold tier. Save migration converts old achievement IDs.

### Added
- **Child Naming UI**: When a child is born, game pauses and shows a naming dialog. Spouse suggests a name — choosing it grants +10 relationship bonus. Text input with 20-char limit.
- **Spouse Last Name Change**: Female spouses take the player's last name on marriage. Maiden name stored in `_maidenName` field.
- **Spouse Quirk: Names the Children** (`names_children`): Spouse insists on naming children — player gets no choice
- **Spouse Quirk: Keeps Maiden Name** (`keeps_maiden_name`): Spouse refuses to take player's last name on marriage
- **Early-game death protection**: Now also restores hunger/thirst to 20 when reviving (prevents immediate re-death)
- **God mode death protection**: Revives player with health 30, hunger/thirst 20 when god mode is active

### Internal
- Save version bumped to 5 (migration: renames `adulthood` → `prime_of_life`, `old_age` → `seasoned_merchant` in achievements)

## [0.67.0] - 2026-04-11

### Added
- **Save Migration System (C2)**: Versioned save format with incremental migration functions — old saves auto-upgrade on load, preventing crashes when new fields are added
- **Shared Utility Helpers (H2)**: `getPeopleInTown()`, `getPeopleInKingdom()` in engine.js; `_checkCanAct()`, `_getContext()`, `_modifyInventory()` in player.js — replacing 38+ duplicated inline patterns
- **Validated Player State Setters (C1)**: `_modifyGold()`, `_modifyReputation()`, `_modifyTownRep()`, `_setTownId()`, `_modifyEnergy()` — NaN-safe, clamped, auto-logging

### Changed
- **Camera/Render Constants to CONFIG (H4)**: 20+ hardcoded magic numbers (lerp speeds, terrain margins, pan thresholds, cache parameters) moved to CONFIG object for centralized tuning
- **showBuildingDetail Decomposed (H3)**: Extracted 210-line medical preparedness section into standalone `_buildMedicalSection()` function

### Internal
- Save version bumped to 4
- Engine exposes `getPeopleInTown()` and `getPeopleInKingdom()` on public API
- Player exposes `checkCanAct`, `getContext`, `modifyInventory`, and all C1 setters on public API

## [0.66.2] - 2026-04-11

### Added
- **Event Mute/Unmute Button**: Click any event in the Event Log to see details, with a mute/unmute button to toggle that notification category or sub-type directly
- **Caravan Trades Sub-Filter**: Separate notification filter for caravan buy/sell/pickup/store messages (under My Business), distinct from caravan arrivals
- **Full-Scene Overlay Cache**: At zoom < 1.0x, territories/roads/towns/caravans are cached on an offscreen canvas with 110% margin — panning is essentially free (single drawImage blit)
- **Zoom Stability Detection**: Scene cache only engages after zoom stabilizes (~200ms), preventing expensive rebuilds during zoom transitions

### Changed
- **Snappier Camera**: Zoom lerp increased (0.12 → 0.375 normal, 0.5625 at low zoom), pan lerp increased (0.12 → 0.3), both with snap thresholds to eliminate drift
- **Terrain Cache Optimized**: Doubled margin tiles and nearly tripled pan thresholds at low zoom for fewer redraws during panning
- **Mid-Zoom Performance** (1.0x-1.5x): Increased terrain margins, skip fertility/deposits/survey overlays

### Fixed
- **Notification Filter Bypass**: Massively expanded inferEventCategory() from ~30 to 150+ patterns; added explicit categories to 90+ high-traffic logEvent calls
- **Sub-Type Detection Refactor**: Extracted _detectEventSubKey() as single source of truth, eliminating code duplication in shouldShowNotification()

## [0.66.1] - 2026-04-11

### Added
- **Longevity Skills**: Healthy Living (2 SP, -10% old-age death) and Longevity (4 SP, -25%, requires Healthy Living)
- **Daily Player Death Check**: Old-age death now checked daily from age 40+ (converts yearly chance to daily probability)
- **NPC 30-Day Death Check**: NPC old-age death checked every 30 days with scaled probability

### Fixed
- **Toast Sub-Filter Bypass**: Messages that didn't match any sub-type pattern would show even when category was OFF
- **Category OFF Cascade**: Turning a notification category OFF now turns all sub-filters OFF too
- **All Subs OFF Detection**: If every sub-filter in a category is OFF, all messages in that category are blocked
- **Improved Pattern Matching**: Added audit/warehouse/thief/criminal/manipulated keywords for my_business.agents; catch-all for any unmatched caravan message
- **Settings Panel Collapse**: Expanded notification category no longer collapses when toggling a sub-filter

## [0.66.0] - 2026-04-11

### Changed
- **Aging System Overhaul**: 1 season = 1 year (90 game days)
  - Year 1 Spring → Year 2 Summer → Year 3 Fall → Year 4 Winter, cycling
  - Player starts at age 25 (was 18)
  - All NPCs, elite merchants, and the player age 1 year per season
- **Old-Age Death System**: Tiered death chance starting at age 40
  - 40-49: 1% + 1% per year, 50-59: 11% + 2% per year, 60-69: 32% + 4% per year
  - 70+: 95%, 75+: 99%, hard cap death at 100
- **Pregnancy Duration**: Reduced to 60 days (was 270)
- **All Time References Updated**: Tax exemptions, military service, guild memberships,
  loan interest, indentured servitude, escape discovery, and all UI displays use
  CONFIG.DAYS_PER_SEASON (90) instead of 360/365

### Fixed
- **Agent Hire Crash**: `rng.intBetween()` → `rng.randInt()` (14 instances), added `player.agents` init guard

## [0.65.1] - 2026-04-11

### Fixed
- **Terrain Rendering Lag at Low Zoom**: WASM terrain render was NET slower due to copy overhead; replaced with optimized JS-only path
- **Overscroll Terrain Cache**: Added 6-10 tile overscroll margin so small pans reuse buffer without redraw
- **Pan Threshold Tuning**: Increased pan threshold at low zoom (40px at <0.6x, 20px at <1.0x)
- **Decoration Skip**: Trees/mountains/hills hidden below zoom 0.65 (barely visible)
- **Load Game Speed**: Stored save metadata separately (~100 bytes) to avoid decompressing full saves
- **Speed Zoom Enforcement**: Fixed `setSpeed()` referencing non-existent `Render.getCamera` instead of `Renderer.getCamera`
- **Free Zoom at 1x Speed**: Removed incorrect 1.0x zoom clamp at normal speed

### Added
- **Map Freeze at 60x Speed**: Renderer.render() completely skipped at 60x; banner shows "Map Frozen Until Speed Is Lowered"
- **Pan/Zoom Block at 60x**: Mouse drag, scroll wheel, and WASD panning disabled during frozen map
- **Live Stats at 60x**: Gold, XP, hunger, energy, thirst, health update every frame even with map frozen
- **Zoom Enforcement**: Auto-zoom to 1.0x at 4x speed, 1.5x minimum at 16x+
- **Expandable Notification Sub-Filters**: Each notification category is clickable to expand individual event type toggles
  - 47 sub-types across 11 categories with On/Off controls using dot-notation keys
  - Pattern-matching in shouldShowNotification() detects sub-types from message text
  - Caravan events (dispatch, arrivals, problems) grouped under My Business

### Changed
- WASM terrain rendering removed (kept for pathfinding, terrain sampling, monopoly, caravans, minimap)
- Static water tint instead of wave animation in terrain cache
- `updateDateDisplay()` expanded to update gold, XP, hunger, energy, thirst, health

## [0.65.0] - 2026-04-11

### Added
- **WebAssembly (WASM) Module**: Core computation ported to Rust/WASM for 3-12x speedup
  - Seeded RNG (xoshiro128**) — millions of calls per game session now run in native code
  - Terrain sampling (water path, offroad cost, dominant terrain) — 6-10x faster
  - Dijkstra pathfinding with binary heap — 5-12x faster route calculations
  - Monopoly win condition check — 3-8x faster daily computation
  - Caravan position interpolation — 5-10x faster 60fps updates
  - Terrain tile color computation — 2-8x faster map rendering
- **WASM Fallback**: Automatic fallback to pure JS if WASM fails to load (browser compat)
- **WebAssembly Audit Document**: Full analysis of 16 WASM candidates with implementation plan

### Changed
- Game now loads WASM module at startup for performance-critical paths
- Pathfinding, terrain sampling, and RNG delegate to WASM when available

## [0.64.0] - 2026-04-11

### Added
- **Noble Agents System**: Hire up to 6 agents (2 per nobility rank) to perform tasks
  - 14 task types across hostile, business, and intelligence categories
  - Hostile: Sabotage, arson, raid caravans, spread rumors, steal, intimidate
  - Business: Trade caravans, scout markets, buy/sell, manage properties, establish contacts, guard
  - Intelligence: Spy on targets, counter-intelligence
  - Full UI with task assignment, dropdown target selection, budget controls
- **Schemes Building Dropdown**: Arson/sabotage now use consolidated building dropdown with owner info
- **Performance Audit**: Comprehensive 48-finding audit across all game files

### Changed
- Schemes button always available from game start (was hidden until unlocked)
- Arson/sabotage skill checks now properly validate shadow dealings OR arsonist skills

### Fixed
- Spread rumors scheme no longer crashes on missing target
- Establish contacts scheme properly validates town selection
- Agent reports capped at 50 entries to prevent memory growth
- Engine production tick building type lookup fix
- Fixed 122 JSON.parse(JSON.stringify()) → structuredClone() for 2-3x clone speedup

### Performance
- Binary heap Dijkstra pathfinding with cached off-road edges (O(V²) → O((V+E)logV))
- Expanded _tickCache with eliteMerchants and merchantsByKingdom arrays
- Set membership for O(1) lookups in daily tick (was O(n) includes/indexOf)
- Financial ledger pruning: single splice instead of repeated shift()
- Incremental _militarySalesTotal counter (was daily tradeLog.filter().reduce() scan)
- UI auto-refresh reduced from ~1s to ~3s interval with dirty-flag day-change detection

## [0.63.0] - 2026-04-10

### Added
- **Quality Crafting System**: Weapons and armor now have RNG-based quality when producing good or excellent variants — always uses premium materials, but chance determines if you get the quality version or fall back to basic
- **Quality Chance Display**: Production buildings and guild crafting now show your % chance of producing good/excellent quality items based on worker skill and player skills
- **4 New Player Skills**: Good Weaponcraft, Good Armorcraft (each +20% good chance), Excellent Weaponcraft, Excellent Armorcraft (each +20% excellent chance, requires corresponding good skill)
- **Caravan Storage Priority**: Caravans now prioritize delivering goods to production buildings that use them (e.g., iron to blacksmith), then fall back to other buildings and town/outpost storage
- **Clinic & Hospital Caravan Support**: Clinics and hospitals now properly accept caravan deliveries

### Changed
- Outpost founding cost increased to 800 gold + 10 planks (was 500 gold)
- Outpost daily maintenance increased to 10 gold (was 3 gold)
- Recruit section now only appears when at a town (not at outposts)

### Fixed
- Caravans no longer sell overflow goods to market when town/outpost storage has room
- Fixed 5 dialog close buttons that weren't working due to scope issues
- Relationship values now display as whole numbers in recruit panel

## [0.62.0] - 2026-04-09

### Added
- **Kingdom Quests System**: 107 dynamic quest types across 8 categories (military, economic, diplomatic, justice, infrastructure, social, espionage, corrupt) directed by the king based on personality and kingdom state
- **Personality-Driven Quest Selection**: King personality traits (militarism, justice, greed, ambition, temperament, intelligence, tradition, courage) weight the quest pool — corrupt kings give shady tasks, kind kings want charity, warlike kings demand military support
- **Dynamic State Triggers**: Quests react to kingdom conditions — war generates military quests, plague triggers medical quests, low treasury spawns economic quests, noble squabbling creates arbitration quests
- **Personal Royal Assignments**: Higher-ranked nobles (5-30% chance scaling with rank) receive personal directives from the king with doubled rejection penalties
- **Quest Rejection System**: Players can decline quests but suffer reputation and relationship penalties scaled by rank, urgency, and king temperament
- **Royal Directives UI**: New tab in nobility panel with available/active/completed quest views, quest cards with difficulty/urgency indicators, progress tracking, and quest log
- **Quest Reward Scaling**: 4 difficulty tiers (easy/medium/hard/elite) with scaling gold, reputation, relationship, and XP rewards. Special rewards include tax exemptions, production permits, royal decrees, land grants, and noble endorsements
- **Quest Progress Tracking**: Automatic tracking for goods delivery, gold contributions, town visits, and special actions integrated into existing game systems

## [0.61.0] - 2026-04-08

### Added
- **Tiered Achievements**: All 186 achievements categorized into Bronze (28), Silver (66), Gold (72), Platinum (20) tiers with tier-appropriate XP rewards (Bronze 25-50, Silver 75-100, Gold 150-200, Platinum 300-400)
- **Achievement Unlock Popup**: Sliding popup at top-center on achievement unlock with tier-colored backgrounds, auto-dismiss after 3 seconds, click to navigate to feats menu. Platinum achievements feature shimmer animation, pulsing icon, and glowing border
- **Achievement UI Rewrite**: Tier badges, tier filter buttons (all/bronze/silver/gold/platinum), sorting by tier (platinum first), tier summary counts, platinum glow effects
- **Noble Council Voting Law**: New `noble_council` special law with weighted votes (King×5, RA×3, Lord×2, MN×1). 6 decision types: war, peace, alliance, surrender, ban/unban goods. Player can cast votes and influence nobles
- **Noble Economy System**: Building ownership assigned at worldgen by rank (King 5-10, RA 3-5, Lord 2-4, MN 1-2). Income/expense tick every 10 days, financial stress tracking
- **Noble Relationships**: Noble-to-noble relationship scores (-100 to 100) initialized at worldgen based on personality compatibility. Monthly drift. King loyalty (0-100) for all nobles
- **Noble Loans**: Player can offer 50-2000g loans at 15% interest to nobles rank 4-6. Monthly repayment based on personality, default after 360 days. Indebted nobles easier to influence in votes
- **Royal Feast System**: Feasts scheduled every 60-120 days, 3-day events with 60-80% noble attendance. 8 player actions in 3 categories (Social/Intel/Scheme): mingle, toast king, private chat, eavesdrop, observe court, spread rumor, forge alliance, pit nobles
- **Conspiracy & Assassination System**: Dissatisfied nobles (kingLoyalty < 30) form conspiracies that grow in strength, can be detected, and attempt coups or assassinations
- **King AI Unrest Response**: Personality-driven king responses to low happiness — tax cuts, festivals, martial law, prisoner releases, wealth seizure depending on king traits
- **Noble Assets Skill**: New 2 SP social skill showing noble/EM building ownership and financial status in NPC panels
- **New Petition Types**: `promote_outpost` (requires pop ≥ 20) and `build_defense` (walls/watchtowers)
- **Platinum Achievement Tracking**: War profiteering, arms supply, commission goods, vote manipulation, monopoly detection, petition tracking
- **War Allegiance Popup**: Established players prompted to choose sides when war breaks out. War advisory section in Character panel
- **World Analytics Dashboard**: God Mode tool with goods production tab, kingdom relations matrix, and king personality traits
- **Quarantine Checkpoint System**: Bribery, guard name/personality, skill-based modifiers (medicine, speech, stealth), night-time bonus, doctor persuasion option
- **Street Trading Enhancements**: Scarce goods buy offers with skill-based discounts, sell contraband option
- **Street Goods Request**: Request goods not in local market — base 20% chance (boosted by skills), RNG pricing 50-500% above market, quantity 1-10, category penalties for military/banned/horses, 3-day cooldown (1-day with skill), shows calculated chance breakdown on selection
- **Sell to Crown Tab**: New tab in Kingdom Orders showing goods the kingdom urgently needs. Crown price = market × urgency multiplier (up to 1.5×). Color-coded urgency badges, sell buttons (1/5/10/25/50/All). Disabled when kingdom treasury < 2000g
- **Smart Building Input Balancer**: All building transfers and auto-buy purchases now use weight-based ratios matching the building's recipe needs. Accounts for existing input storage to maintain balanced ratios
- **Ship Sprite for Sea Caravans**: Sea caravans now display an animated sailing ship (blue hull, mast, billowing sail, bow flag, wake lines) instead of the land wagon sprite. Zoom labels show ⚓ for sea vs 📦 for land
- **Outpost Management System**: Comprehensive outpost management UI accessible from bottom panel ⛺ button:
  - Outpost hub listing all outposts with status, buildings, staff, and cost summary
  - Click any outpost for detailed management: overview, staff, buildings, upgrades, infrastructure
  - Wall upgrades (levels 0-3) with scaling gold/stone/wood costs
  - Dock building for coastal outposts (water within 3 tiles) — makes outpost a port
  - Road building to connect outposts to towns/other outposts (cost scales with distance)
  - Sea route building from port outposts to other port towns
  - "Found New Outpost" placement mode — right-click map to place (validates offroad reachability)
  - Cartographer skill provides 25% discount on all infrastructure
  - All roads/sea routes auto-integrate into the pathfinding/travel network
- **Off-Sea-Route Travel**: Free sailing in open water without established sea routes:
  - Right-click water tiles to sail from any port town with an owned ship
  - Ship selection dialog when multiple ships available at port
  - 50% speed of normal sea routes, boosted by skills (navigator +20%, cartographer +10%, admiral +10%)
  - Ship type speed and condition affect travel speed
  - Waypoint chaining: redirect course by right-clicking more water while sailing
  - Pirate risk based on average of port's sea routes +10% modifier
  - Landing system: right-click coastal tiles with terrain-based risk (grass/sand 0%, forest 10%, hills 30%, mountains 60%)
  - Landing skill bonuses reduce risk; failed landings damage ship hull 10-30%
  - Shipwreck mechanics: death (60% base, reducible by skills) vs wash ashore with illness, gold/inventory loss
  - Player ship sprite (gold-tinted sailing ship) during off-sea travel
  - Dramatic shipwreck result screens

### Changed
- **Kingdom Reputation Overhaul**: Removed passive +0.1 per trade. Town rep spillover replaced with monthly modifier system (±25 cap, delta-only application prevents stacking). Sell-to-kingdom military war bonus reduced from +2 to +0.1
- **Kingdom Reputation Decay**: Changed from monthly to weekly (same rates per tick but ~4× more frequent). Decay tiers: 0.15 above 70, +0.10 above 80, +0.15 above 90, floors at 70
- **Building Storage UI Position**: Moved BUILDING STORAGE section above WORKERS in building detail modal for easier access to withdraw buttons
- **Sea Caravans**: Can now be dispatched without pre-loaded goods when pickup/buy orders are set (matches land caravan behavior)

### Fixed
- Feast action counter in nobility panel used wrong property name (`playerActionsToday` → `_playerActionsToday`)
- King unrest response crashed using `.map()` on territories Set (now uses `Array.from()`)
- Added HTML escaping to all dynamic text in voting, feast, loan, and nobility UIs
- Removed empty Military achievement category (0 achievements)
- People search stealing keyboard input (WASD/hotkeys) when search box was focused
- Orphan `reach_rep_40` tooltip reference (replaced by `gain_kingdom_rep`/`gain_town_rep`)
- **Multi-product buildings ignoring selected recipe**: Both `getBuildingStatus()` and `tickBuildings()` used default recipe (`bt.produces`/`bt.consumes`) instead of player-selected `currentProduct`. All 15 multi-recipe building types now correctly produce the selected product
- Input-only filter on building detail blocking deposit of consumed goods (e.g., wood to smelter)
- **Quarantine doctor persuasion double-counting**: When origin town = quarantine town, both origin and destination clinic bonuses fired for the same building. Now deduplicates
- **Personal guards stuck in old town**: Guards now sync to player location on both standard and offroad arrival via `_moveGuardsToPlayer()` helper
- **World Analytics Active Wars showing ?**: Fixed `kingdomA`/`kingdomB` vs `attackerId`/`defenderId` field mismatch
- **Ship building not working**: `buyShip()` now uses player inventory first before buying from market; build button routes through `UI.buyShip()` for toast feedback; `getShipPrice()` subtracts owned materials from cost
- **Music not resuming on unmute**: `toggleMute()` and `setVolume()` now call `.play()` when restoring paused audio
- **Ship assignedOffSea flag not cleared**: `cleanupTravelState()` now releases ship from off-sea assignment when travel is stopped/canceled
- **Sea caravan owned ship selection**: Player-owned ships now appear in caravan ship dropdown labeled "FREE" with hull condition, vs rental ships showing daily cost
- **Founded towns missing from kingdom territories**: `foundOutpost()` now adds to kingdom.territories Set; save migration ensures all towns are in their kingdom's territory
- **Outpost invisible to findTown()**: `foundOutpost()` now registers in townIndex cache so `getOutpostCosts()`, `upgradeOutpostWalls()`, etc. work immediately
- **Population explosion in small towns**: Migration destinations now check pop cap before accepting migrants; soft cap enforcement clamps population in `tickTownCategories()`
- **Achievement ID mismatches**: 7 achievement IDs in player.js didn't match config (burgher_rank→burger_rank, royal_commission_hero→plat_royal_commission, etc.)
- **Missing achievements**: Added `first_purchase` and `first_sale` to ACHIEVEMENTS config (code granted them but they weren't defined)

### Removed
- Dead `smuggler` and `streetwise` skill checks from quarantine code

## [0.60.0] - 2026-04-07

### Added
- **Family Travel Companions**: "Bring Family" checkbox in travel dialog lets family members in the same town travel with you. Lists who will join with encounter risk warning
- **Family Encounter Casualties**: Family companions can be injured or killed during bandit/pirate encounters (same odds as player). Armor halves death chance; weapons reduce it 30%. Casualties displayed in encounter results
- **Family AI System**: Family members intelligently spend gold and use items you give them:
  - Seek hospital/clinic treatment when injured or ill (checks supplies, pays fees)
  - Buy and upgrade weapons/armor based on social rank and wealth
  - Buy horses when wealthy enough; nobles buy more eagerly
  - Practice instruments and buy new ones based on rank preference
  - Buy food and beverages for sustenance
  - Noble family members (rank 3+) purchase luxury goods (wine, silk, jewelry)
  - Children ages 8-17 build worker skill and may learn basic medicine
- **Give Gold to Family**: 💰 Give Gold button on family panel with preset amounts (10/25/50/100/250/500g) and custom input. Boosts relationship
- **Give Item to Family**: 📦 Give Item button with categorized picker from player inventory. Auto-equips weapons/armor, auto-learns instruments, auto-mounts horses
- **Family Equipment Display**: Family member cards now show equipped weapon, armor, horse, and instrument skill tier
- **Family Health Status**: Family cards display injury, illness, and treatment status

### Fixed
- Family AI food list referenced non-existent `cheese` resource (replaced with poultry, eggs, vegetables)
- Family AI luxury list referenced non-existent `spices` and `fur` resources (replaced with perfume, fine_clothes, pearls)
- Missing `travelCompanions` getter on Player API
- Armor check in companion casualty code used wrong field path (`equipment.armor` → `armor`)
- **`travelTo()` dropped `bringFamily` on pure sea routes** — family companions were lost when travel delegated to `travelBySea()`
- **Stale travel companions after stopping travel** — `cleanupTravelState()` now clears `travelCompanions` array
- **Give Item dialog used wrong resource lookup** — `CONFIG.RESOURCE_TYPES` → `RESOURCE_TYPES` (standalone global)
- **Family AI null safety** — added guards for `town.market.prices`/`supply` before trading

## [0.59.0] - 2026-04-07

### Added
- **Autosave System**: Two rotating autosave slots that save every 15 minutes, alternating between slots. Autosaves appear in Load menu only; manual save slots are never touched
- **Try for Baby Button**: Active conception attempt in spouse panel with age-based chance curve, 20 subtick cost, once-per-day cooldown. Shows conception chance preview
- **Pregnancy/Fertility Indicator**: Spouse panel shows pregnant status with days remaining, can-conceive readiness, or blocked reason (too old, max children, etc.)
- **Rank Progression Tracker**: Compact progress bars in the ledger showing requirements for next social rank with color-coded bars, k-notation for large values, and tooltips for each requirement
- **Marriage Waiver Recognition**: Ledger progress bars show "Waived ✓" for petitions/endorsements when married to a Minor Noble+, and 💍 icon on discounted requirements

### Changed
- **Spouse AI Overhaul**: Occupation-aware and social-rank-aware behavior weights; elite merchant-level trading intelligence; autonomous return-home behavior
- **Kingdom Panel Reputation Display**: Status and Reputation on separate lines; reputation bar uses kingdom's color
- **Early-Game Plague Protection**: No plagues in first 90 days; 75% reduced chance days 91-180; player immune to plague exposure first 90 days
- **Marriage Bypass Text**: Burgher says "Marry a Guildmaster+"; Minor Noble says "Marry a Minor Noble" (corrected from "Marry a Lord")

### Fixed
- **Engine.currentTown TypeError**: `buyTentSlot()` called non-existent `Engine.currentTown()` — changed to `Engine.getTown(Player.townId)`
- **Tick Error Empty Object**: Enhanced error logging with separate try/catch for Engine.tick and Player.tick
- **Trade Max Quantity Validation**: Fixed effectiveCap, rounding alignment, and spouse/injury modifier accounting
- **Notification Bell Badge**: Force-clears badge immediately on click

## [0.58.0] - 2026-04-06

### Added
- **Tutorial Intro Chapters**: Two new opening chapters — "What Do I Do In This Game?" (8 open-ended goals) and "How Do I Achieve My Goals?" (early/mid/late game strategies)
- **Deposit Overlay for Towns**: Toggle-mode map overlay shows actual resource amounts per town (e.g. ⛏8k 🪨12k) from real naturalDeposits data
- **Succession Voting UI**: When king dies without heir, Royal Advisor gets candidate cards showing name, gold, age, occupation, intelligence, ambition, charisma — endorsed candidate gets +40 score boost

### Changed
- Terrain deposit survey now scales results to realistic NATURAL_DEPOSITS config ranges (thousands) instead of raw tile-hit counts (single digits)
- Survey circle renders amounts with "k" suffix for thousands
- Deposit overlay shows only resources each town actually has access to

### Fixed
- **Medical supply consumption non-atomic**: Rewrote `_consumeTreatmentSupplies()` with preflight check — all items resolved before consuming any, returns 0 if any missing
- **Autobuy overfill**: Medical autobuy now clamped to remaining storage capacity
- **Kingdom gold negative guard**: Procurement buy loop skips when kingdom can't afford
- **Embargo enforcement**: NPC merchants now skip embargoed destinations
- **Terrain load validation**: Validates terrain array length matches grid dimensions on load
- **Outpost terrain/prices init**: New outposts now get `classifyTownTerrain()` and `computeLocalBasePrices()` on creation
- **Load migration**: Added `injurySeverity` for injured people and `_noSupplyRetries` for treatment queues in old saves
- **NPC treatment admission**: Supply check now runs before gold deduction (was charging before verifying supplies)
- **Player travel at coordinate 0,0**: Fixed truthy checks for worldX/worldY that failed at origin → `!= null`
- **UI showBuildingDetails typo**: Fixed `showBuildingDetails` → `showBuildingDetail`
- **Keyboard focus during tutorial**: Canvas gets `tabindex="0"`, tutorial buttons get `tabindex="-1"`, focus restored after every click
- **Tutorial Main Menu location text**: Fixed "bottom panel" → "upper-right corner of this panel, or on the right side of the top panel"

## [0.57.0] - 2026-04-06

### Added
- **Propose Action UI for Royal Advisors**: 20+ king actions across 6 categories (Economic, Military/Diplomacy, Infrastructure, Policy, Health, Kingdom) with personality-aware success chances, king relationship and kingdom reputation modifiers
- **Encounter Modal Lock**: Bandit/pirate encounter dialog cannot be dismissed — must choose surrender/negotiate/fight. Only save, load, and home buttons work during encounters
- **Marriage to King's Children**: Requires guildmaster+ with noble introduction or minor noble+ status; grants 25% boost to king relationship and kingdom reputation gains
- **Quarantine Travel Blocking Overhaul**: Both standard and martial quarantine now block travel; nobles pass freely, guildmasters blocked by martial; sneak chances (40% standard, 20% martial) with punishment system (fines/jail based on king personality)
- **Noble Relationship Passive Drain**: -1 every 30 days if above 60, -2 every 30 days if above 80
- **Queen/Consort Occupations**: Reigning Queen, Queen, The Queen's Lord special noble statuses and occupations
- **King Succession Voting**: When king dies without heir, RA gets voting UI to pick new king from kingdom nobles
- **God Mode Bandit Boost**: Toggle for 95% daily encounter chance for testing
- **God Mode RA Benefits**: Setting rank to Royal Advisor now properly grants full RA benefits (noTaxes, immuneToLaws, swayOverKing)
- **God Mode Lord Town Choice**: Setting rank to Lord now shows 3-town choice UI instead of silent assignment
- **Kingdom Guards in Character Panel**: Guards granted by kingdom now show "(Kingdom)" label

### Changed
- King decision agree: no longer gives reputation/relationship reward
- King decision failed opposition: -2 king relationship, -0.5 kingdom reputation (was random -1 to -2 rep)
- Tax discount: 5% for citizens+, 10% for minor nobles+, lords exempt in their town, RAs exempt from all kingdom taxes
- Encounter dialog auto-pauses game
- Encounter dialog buttons use brighter text (#f0d0a0 titles, #ccc descriptions)
- Propose Action buttons use green-tinted background with cream text for readability

### Fixed
- **Travel stall at 100%**: Encounters no longer fire when travel progress >= 1.0, preventing infinite encounter loop that blocked arrival
- **Route danger "war" false positive**: UI now checks live `kingdom.atWar.has()` instead of `road.safe` flag; bandit_surge events now restore road safety on expiry
- **King decisions lost on save/load**: `_executeFn` (JS function) can't survive JSON serialization — stale decisions now cleaned up on tick
- **Player.modifyReputation silent no-op**: Function was never exposed on Player API — all kingdom reputation changes were silently failing
- **God mode Set Rank missing guards**: Now grants kingdom guards and sets isNoble when rank >= 4
- **Propose law empty menu**: Fixed law proposal system

## [0.56.0] - 2026-04-03

### Added
- **Bandit/Pirate Encounter System**: Full encounter system during land and sea travel
  - Daily encounter chance based on route danger, wartime, guards, ship type, skills
  - 3-choice resolution: surrender goods/gold, negotiate (skill-based), or fight
  - Fight outcome based on weapons, armor, guards, ship, hunger/thirst/energy, bandit RNG
  - Sea fight loss: wash ashore with "Waterlogged Fever" severe illness
  - Personal guard hire/dismiss system with daily wages and named guards
  - Risk indicator (🟢/🟡/🔴) next to travel ETA
- **Bandit Evasion Skills**: `bandit_evasion` (2 SP, requires street_smart) -25% non-wartime encounters; `bandit_mastery` (3 SP) -50% non-wartime, -25% wartime
- **Variable Escape Artist**: Flee chance now 5-30% based on horse, energy, hunger, armor, skills
- **Sea Route Petition**: Petition the king to establish sea routes between port towns
- **Route Feasibility Validation**: Petitioner's office validates road/sea route feasibility before creation
- **Sea Route Terrain Conversion**: Land tiles along sea routes converted to water on build, load, and world gen
- **Sea Route Waypoint Regeneration**: Old routes without waypoints get waypoints on load
- **Passive Energy Subtick Drain**: 0.25 energy per subtick (15/day)

### Changed
- Caravan pickup searches building inventory (output + input) in addition to town storage
- Caravan order labels show actual town names instead of "Source"/"Dest"
- Waypoint orders available for all multi-hop routes (removed caravan_network gate)
- Petition approval rebalanced: base 5% (was 15%), per-signature bonus 3.5% (was 2.5%)
- NPCs with relationship < 10 have -10% petition signing penalty
- Petition signature asks cost 0.35 energy (was 0.25)
- Signature limit: 2 asks per NPC per day (was 2 total per day)
- Sea route pathfinder: land cost 100 (was 999), water fraction skips coastal approach
- Building storage display shows weight-based values

### Fixed
- Passive energy drain negligible (0.25/day) — now 15/day via subtick
- Caravan couldn't pick up from buildings (checked non-existent `outputStorage`)
- Petition ID collision on page reload causing Manage to open wrong petition
- Building storage showed misleading items vs weight cap

## [0.55.0] - 2026-04-03

### Added
- Caravan passenger system: caravans auto-pickup travelers along their route
  - Toggle per caravan: "Auto-Pickup Travelers" in creation dialog and management panel
  - Capacity based on vehicle types: +1 per carrier, +4 per cart, +8 per wagon
  - Passengers board at stops if their destination is on the route, disembark at destination
  - Fare collected from traveler's max price, logged as `caravan_passenger` in financial ledger
  - NPCs physically relocated to destination town
  - Passenger list displayed in caravan cargo section (names → destinations)
  - Passengers safely stranded on caravan destroy/force-disband
- Illness notification filter: new 🦠 Illness toggle in Settings and Event Log filter bar
  - Controls plague outbreaks, disease spread, quarantines, health policies, notable illness deaths
  - Illness events tagged with explicit `illness` category for reliable filtering
  - Save migration: older saves get `illness: true` by default
- Illness events appear under Local tab in Event Log alongside Local Town and NPC Activity
- Tutorial map customization: permanent custom map for seed 7777
  - Starting town renamed to "Rustbridge", travel destination renamed to "Inkwell Cross" (west, ~2 days)
  - Land road added from Rustbridge to Driftwood Cay
  - Sea route removed between Rustbridge and Inkwell Cross (land-only connection)
- Phase-isolated RNG for world generation stability
  - Each generation phase (terrain, kingdoms, towns, roads, sea, people) gets its own deterministic sub-RNG
  - Adding/removing RNG calls in one phase no longer shifts results in other phases

### Changed
- Plague frequency drastically reduced to target ~1 outbreak per 5 years:
  - Base trigger chance: 0.0015 → 0.0003 (5x reduction)
  - Capital multiplier: 3x → 2x, City multiplier: 2x → 1.5x
  - World cooldown: no new random plagues for 360 days after any plague triggers
  - Concurrent plague cap: spread blocked if 3+ towns already have active plague
  - Great Plague chance: 30% → 15% of any plague being severe
- Plague spread rates reduced to prevent world-wide cascades:
  - Town spread base: 0.01 → 0.003, sick ratio multiplier: 8x → 2x
  - Trade route spread multiplier: 3x → 1.5x
  - Great Plague spread multiplier: 8x → 2x, Regular: 4x → 1x
- Illness death notifications: only notable people (family, nobles, EMs, kings, relationship >20)
  - Batch town summaries removed — non-notable deaths are now silent
  - Relationship threshold for notable deaths: 10 → 20
- Quest relationship boost increased: per-NPC 1/3 → 4/8, affected NPCs min 2→3, max 20→30
- Guildmaster rank caravan goods requirement: 500 → 250
- Quarantine bypass: nobles (rank ≥4) pass freely, guildmasters on business, others 40% sneak chance
- Guild auto-renew now runs before monopoly enforcement (fixes false warnings)
- Sea routes now require ≥95% water tiles in all code paths
  - Town founding was using 30% threshold — fixed to 95%
  - `buildNewSeaRoute()` had no water validation — now validates and returns error message
  - Post-load orphan port fixup had no water check — now validates
- Tutorial "Your Player Icon" step now pans camera to player's town before zooming to 3x

### Fixed
- Guild membership warnings appearing despite active membership with auto-renew
  - Root cause: monopoly check ran before auto-renew, briefly seeing expired membership
- Quest acceptance across towns: defensive fixes for "quest not found" errors
  - Removed overly strict status filter, added null safety and hasOwnProperty guards
  - Better error messaging and console debug logging
- Caravan store orders ignoring building input capacity (counting output items like rope against input pool)
  - Both specific-building and any-building store paths now use input-only capacity check
  - Matches pattern used in auto-buy, _executeTransfer, depositToBuilding
- Caravans exceeding capacity: pickup, buy, legacy buyOrders, and recurring reload all lacked capacity checks
  - Added `_getCaravanCapacity()` / `_caravanCanFit()` helpers for weight-aware capacity enforcement
  - All cargo-loading paths now clamp to remaining capacity; log message when caravan is full
- Building output overflow now shows visible event log notification and UI indicator when auto-selling to market
- View Location button in event details sending camera to wrong coordinates
  - Removed erroneous `* CONFIG.TILE_SIZE` multiplication in clickTown()
- Disease awareness skill: healthy towns now show "No illness detected" + nearby plague warnings
- Building input/output storage now independent pools (output no longer eats input capacity)
- Supply Inputs buttons now deposit directly to building inventory (was dumping to town market)
- Auto-buy upgraded: ratio-balanced stockpiling with input-only capacity awareness
- Tutorial text: hardcoded town names replaced with dynamic `snapshotState.startTownName`
- Tutorial "See Resource Deposits" step now pans camera to starting town (was missing)
- Ships button now properly greys out during tutorial highlights (UI tick was overriding opacity)
- Road bridge artifact on tutorial map: cleared stale bridge data after town repositioning

## [0.54.0] - 2026-04-02

### Added
- Kingdoms & Notables encyclopedia UI in Help menu (Kings tab, searchable Locations, searchable Nobles)
- Clickable town name in town detail auto-pans camera to that town
- Towns button on each kingdom card in Kingdoms of the Realm UI
- Worker skill passive growth for NPC building workers (+0.055/day in engine.js)
- Transport guild membership bypass: merchants guild members can use any town transport guild for instant transfers

### Changed
- Supply chain transfer: daily transfers (was 30-unit batch), 1-day production halt (was 2 days)
- Supply chain: no production halt if player owns a transport guild or is merchants guild member with town transport guild
- Engine.js standard production uses Math.round (was Math.floor) for fairer rounding at ≥0.5

### Fixed
- AI building buyers now properly added to elite merchant's buildings array
- Building sale now decrements player land owned count
- Building and land sales now logged to financial ledger
- Toast notifications for building and land sales (buyer name + amount)
- Travel energy drain moved to subtick: passive 0.25 base + mode modifier per subtick
- Gift limit: 1 gift per NPC per day
- Worker skill multiplier applied in engine.js tickEconomy standard production

## [0.53.0] - 2026-04-01

### Added
- Saddle mount system: equip/remove saddles on individual horses via character panel
- Luxury sea travel: premium cabins at city/capital ports (+0.5 energy/tick, 1.6x speed)
- Goods supply chain in Help menu: shows production chain (Made from → Produced at → Used to make)
- Dual building storage: separate Input Storage and Output Storage per building
- Input storage market-like transfer UI: capacity bar, deposit/withdraw with qty buttons (1/5/10/25/All)
- `inputOnly` toggle on building input storage: restricts to goods the building consumes
- Building auto-buy: purchases consumed goods from market into building inventory (pays gold)
- Caravan overflow sell toggle: per-caravan checkbox to sell overflow to market or keep on caravan
- Caravan map icons: brown diamond markers on roads with route name, goods count, pulsing glow
- Caravan click-to-manage: click caravan icons on map to open their management panel
- Caravan hover tooltips: route, direction, progress %, goods count
- Force disband button for stuck caravans

### Changed
- Building production now ONLY consumes from building input storage (not town market)
- Buildings with empty input storage show "blocked" with specific resource needs
- Caravan "store" action delivers to building inventory; overflow sells to market or stays on caravan
- Eliminated phantom `player.townStorage` writes from caravan input delivery
- Travel energy tiers: walking (0.35/tick), horse no saddle (0.30), horse+saddle (0.25 passive only), luxury (+0.25 net restore)
- Consumes display shows building storage amount, days of supply, and market availability hint
- Blocked status shows specific needs: "need: Hemp (have 0, need 3)"

### Fixed
- Caravan disband not completing (added force disband mechanism)
- Caravan icons not showing on map (complete render rewrite with road-following waypoints)
- Schemes "Dark Deeds" toast appearing every page load (removed misleading unlock toast)
- Removed orphaned "Demolish Your Buildings" section from Build panel
- Rope maker showing "producing" when input storage was empty
- Extra closing brace in building input consumption loop

## [0.52.0] - 2026-04-01

### Added
- Dynamic inn/tavern pricing based on town prosperity and category (inn 3-15g, tavern 4-20g)
- Tavern vs inn differentiation: taverns cost more, recover less energy, but boost relationship with 2-4 random NPCs
- Townspeople view: 15 filters (friends, nobles, elite merchants, etc.), 7 sorts, 100/page pagination
- Completed step tracking in tutorial (green checkmark for already-done steps)
- Skip-after-3-clicks: frustrated clicking on waiting button converts to skip
- Bottom panel button grey-out during tutorial highlights
- Per-button eat/drink glow removal in tutorial
- Draggable modal dialogs (drag by header)
- Propose Marriage button glows during marriage tutorial step
- Courtship daily limit: 2 actions per NPC per day
- Rest at Home tutorial step (moved after Buy a Home)

### Changed
- Top bar always interactive (z-index 2000, above modals)
- Right panel interactive alongside modals (z-index 1600)
- Modal overlay allows click-through to panels beneath
- Toasts render above all panels and modals (z-index 10000)
- WASD/keyboard shortcuts ignored when typing in input fields
- Tutorial "Travel by Routes" auto-pans camera to Inkwell Cross
- Off-road travel shows nearby town name instead of "Wilderness location"
- "Travel Here..." option hidden when player is already traveling
- Propose Marriage button styled consistently with other buttons
- Tutorial marriage detection: recognizes wedding plan (not just spouse)

### Fixed
- Rest button appearing different color when tutorial dims bottom panel
- Talk button glow persisting after tutorial step completed/skipped
- Trade Licenses tutorial treating licenses object as array
- Buy a Skill suggesting keen_eye (player starts with it)
- Road Travel tutorial showing "done" prematurely due to modal detection
- Marriage tutorial not finding NPCs (used town.npcs instead of Engine.getPeople)
- Marriage tutorial not setting player-side relationship
- Marriage tutorial using nonexistent candidate.name property

## [0.51.0] - 2026-04-01

### Added
- House addons system: Workshop, Storage Expansion, Stables, Garden, Guest Quarters
- Dynasty Founder skill reworked: repeatable (1 SP each), creates SP bank for heirs
- Licenses button in kingdoms panel for direct license purchasing
- Tutorial interaction flags for minimap, small talk, eat/drink, rest
- Glow effect on hunger/thirst bars during tutorial eat/drink step
- Dynasty SP bank display in skills panel header

### Changed
- Complete tutorial rewrite: 16 interactive chapters (8 basic, 8 advanced)
- Skills chapter moved from advanced to basics
- Street trading now prioritizes legal scarce goods over banned/restricted
- Schemes button always visible (removed notoriety requirement)
- Petition button glows green when all requirements met
- All tutorial steps reference "bottom panel" for button locations

### Fixed
- Health bar (and hunger/thirst/energy bars) duplicating on UI re-init
- Tutorial save detection now uses timestamps (works with slot overwrites)
- Town detail action button text color (was gray, now #e8dcc8)
- XP bar duplication guard on re-init

### Removed
- War profiteering tutorial panel
- Fleet management tutorial panel
- Trade or die tutorial panel
- Economy death spiral tutorial panel

## [0.50.0] - 2026-04-01

### Added — MP3 Music, UI Improvements

#### Music System Overhaul
- **MP3 tracks** — replaced procedural Web Audio synth with 5 real MP3 tracks (Title, Peaceful, Exploration, Tension, Prosperity)
- **2-second crossfade** between mood transitions
- **Title screen music toggle** — 🔊/🔇 button on main menu
- Fixed browser autoplay blocking issue

#### UI Improvements
- **Back to Main Menu** button on character creation screen
- **Tutorial** — Done button no longer auto-advances after 5 seconds
- **Housing build UI** — material indicators show auto-buy from market status (green/yellow/red)

#### Home & Building Storage
- **Home storage transfers** — deposit/withdraw goods via Transfer Goods button
- **Building storage transfers** — store any goods in owned buildings
- **Horse stabling** — houses hold 2 horses (4 with horse_mastery skill)

#### Bug Fixes
- **Backpack + cart stacking** — backpack persists when mounting vehicles (`_backpack` flag)
- **Container dismount** — respects pack_mule/beast_of_burden/iron_back skill bonuses

## [0.49.0] - 2026-04-01

### Added — Storage Transfers, Music Toggle, Bug Fixes

#### Home & Building Storage Transfers
- **Home storage UI** — deposit/withdraw goods to any owned home (📦 Transfer Goods button)
- **Building storage UI** — store any goods in owned buildings (not just production items)
- **Horse stabling** — houses hold 2 horses (4 with horse_mastery), stable/take buttons
- Livestock restricted to farm/livestock buildings; horses to stables/cavalry buildings

#### Music & UI
- **Music toggle on title screen** — 🔊/🔇 button on main menu for immediate mute control
- **Housing material indicators** — shows green ✓ owned, yellow 🛒 auto-buy from market, red ✗ unavailable
- **Tutorial** — Done button no longer auto-advances; player must click to continue

#### Bug Fixes
- **Backpack + cart stacking** — backpack persists when mounting vehicles (tracked via `_backpack` flag)
- **Container dismount** — now accounts for pack_mule/beast_of_burden/iron_back skill bonuses

## [0.48.0] - 2026-04-01

### Added — Caravan Crew, Equipment & Multi-Hop Routes

#### Caravan Crew & Equipment System
- **Carriers & Guards** — hire crew with dynamic wages based on town economy (carriers: 1-5g/day, guards: 2-10g/day)
- **Carrier equipment:** assign horses (+speed, +capacity), carts (+80 wt), wagons (+200 wt) from inventory
- **Guard equipment:** assign swords (-15% risk each) and armor (-10% risk each) from inventory
- **Equipment constraints:** horses ≤ carriers, carts+wagons ≤ horses, weapons/armor ≤ guards
- **Live preview panel** showing capacity, trip days, daily wage, yearly theft/kill risk, risk factors
- **Equipment edit** — add horses/weapons/armor to active caravans mid-journey
- **Crew theft & desertion** — unpaid crew steals 1-5% goods/day; after 7 days unpaid, crew deserts
- **Carrier risk scaling** — each extra carrier adds ~8% theft/kill risk (bigger target)
- **🏳️ Finish & Disband** button — caravan completes last round trip, drops all goods, disbands

#### Multi-Hop Caravan Routes (Skill-Gated)
- **Extended Routes** skill (2 SP, requires Road Knowledge) — caravans reach towns up to 3 hops away
- **Trade Network** skill (3 SP, requires Extended Routes) — reach 5 hops, trade at waypoint towns en route
- **BFS destination discovery** — UI shows all reachable towns with hop count indicators
- **Waypoint orders** — with Trade Network, add buy/sell/store/pickup orders at intermediate towns along the route
- **Dynamic order location dropdown** updates with waypoint towns when destination changes

#### Carts & Wagons as Tradeable Goods
- **New resource types:** Cart, Small Wagon, Wagon, Large Wagon — buyable/sellable at markets
- **Wheelwright building** — produces carts, small wagons, wagons, large wagons from planks/iron/rope/leather
- **Mount/dismount containers** — equip carts/wagons from inventory (like mounting horses)
- **Dismount to inventory** — unequip current container back to inventory for trading or caravan use
- **Caravan carts/wagons from inventory** — no longer purchased with gold, consumed from player inventory
- **World gen seeding:** capitals always have wheelwright + carts/wagons in market; ~1/3 of cities have carts/wagons; ~1/4 of towns have carts; 3-4 wheelwright buildings placed in cities

#### Guild-Based Worker Access
- **Skill tier gating** — no guild: unskilled workers only; guild member: +skilled workers; guildmaster rank 3+: +expert/master
- **Guild badges** on worker cards — blue for guild member, gold for guildmaster, grey locked for inaccessible tiers
- **Worker occupation → guild mapping** for accurate skill tier unlocking

#### Worker Travel & Remote Assignment
- **Send workers to remote buildings** — walk (free, slow, -5 satisfaction), horse (from inventory, fast), transport (paid)
- **Worker traveling status** — visible in hire dialog, person detail, employee tab
- **Auto-assignment** on arrival — worker joins first available building in destination town
- **Take horse back** from worker when in same town
- **Town check on assign** — workers must be in the building's town (with helpful "send there" suggestion)

### Changed
- **Street trading pricing** — NPC offers now based on market price (was base price); ~75% above market, ~25% below
- **Below-market relationship bonus** — selling below market: +5 rep; +10 for banned goods; +15 for banned war goods
- **Kingdom UI** — each kingdom card now always shows ☮️ At Peace / ⚔️ At War with names, and 🤝 Allies with defensive/offensive type
- **War status bug fix** — `kingdom.atWar` is a Set in memory (not array/boolean); fixed in caravan preview, tick, and kingdom UI

## [0.47.0] - 2026-04-01

### Added — Caravan Order System & Management

#### Caravan Order Builder
- **Full order system** replacing old buy-orders — each order specifies: Good, Action, Location, Quantity, Price Limit
- **Actions:** 🛒 Buy (from market), 💰 Sell (to market), 📥 Store (into player town storage), 📦 Pickup (from player town storage)
- **Location:** Source or Destination — orders execute at the correct town on arrival
- **Searchable goods dropdown** — type to filter ~80+ goods by name or category, click to select
- **Max quantity** option — checkbox sets qty to "max available"
- **Price limits** — max price for buy orders, min price for sell orders (caravan skips if price doesn't meet limit)
- **Order builder UI** with ➕ Add button, per-order ✕ remove, live order list
- **Backward compatible** — old caravans without orders use legacy sell-all behavior

#### Caravan Management Panel
- **📊 Manage Caravans** button opens dedicated management view
- Each caravan shows: route, status, progress bar, profit/spent/trips stats, current cargo
- **Collapsible orders view** — see all orders on each caravan
- **Collapsible log view** — per-caravan action log with timestamps
- **Edit Orders** button — modify orders on active caravans mid-route
- **Action buttons** — Rescue blocked caravans, Stop recurring routes

#### Per-Caravan Logging
- Every caravan action is logged: buys, sells, stores, pickups, failures, restarts
- Log entries auto-cleaned after 90 days
- Icons per action type (🛒 buy, 💰 sell, 📥 store, 📦 pickup, ⚠️ warnings, ⛔ stops)

#### Smart Order Execution
- Orders processed in optimal sequence: Pickup → Buy → Store → Sell
- Graceful error handling: market empty, can't afford, no storage — logged and skipped
- Remaining unordered goods auto-sold at market (backward compat)
- Recurring routes with orders: source orders reload cargo, destination orders run every trip
- Empty caravans allowed if pickup orders exist (caravan goes to collect goods)

## [0.46.0] - 2026-04-01

### Added — Kingdom Trade Redesign, Worker Satisfaction, Guild Monopoly Overhaul

#### Guild Auto-Renew
- **Auto-renew toggle** on each guild membership — pays at the previously paid rate when membership expires
- If auto-renew is on but player can't afford it, auto-renew is disabled and player is notified
- Auto-renew status shown in guild panel (🔄 Auto-renew ON) with checkbox toggle
- `lastPaidPrice` stored on membership for consistent renewal pricing

#### Kingdom Trade v2 — Per-Item Casual System
- **Redesigned kingdom trade** from fixed-quantity requests to per-item casual system
- Kingdom wants certain resource types (not fixed amounts) based on procurement needs, king personality, and kingdom culture
- Sell any quantity at the kingdom's offered price → **+0.001 rep per item sold**
- Donate any quantity for free → **+0.01 rep per item donated**
- UI shows quick qty buttons (1/5/10/All) for both Sell and Donate per resource
- Street-trade-like layout with price premium % display

#### Worker Satisfaction System
- Workers have satisfaction level (0-100), starting at 60
- Daily natural decay (-0.15/day), weekly boost when paid (+3), penalty when unpaid (-8)
- **Player actions:** Praise (+3, free, 1x/week), Day Off (+8, 1 day wage), Bonus (+15, 1 week wage), Raise (+10, permanent +10% wage)
- **Auto-raise wages** toggle: workers below 40 satisfaction get small auto-raise
- Workers below 15 satisfaction have 3% daily quit chance
- Building detail UI shows satisfaction bars per worker with emoji indicators and action buttons

#### Carry Capacity Skills
- 🎒 Pack Mule (1 SP): +20 carry capacity
- 🐂 Beast of Burden (2 SP, requires Pack Mule): +20 more
- 💪 Iron Back (3 SP, requires Beast of Burden): +30 more

#### Guild Monopoly Overhaul
- **Guild members can now build** processing/finished/military buildings in guild_monopoly kingdoms (not just Guildmaster rank 3+)
- Guildmaster rank 3+ still always exempt
- **30-day grace period** if guild membership lapses while owning production buildings
- 7-day warning reminder before deadline
- Kingdom seizes building after grace period (fires workers, puts building for sale at 50% cost)
- Grace periods persist across saves
- **Build dialog** shows guild requirement status: ✅ member, ✅ exempt (Guildmaster), or ⚠️ requires membership

#### Kingdoms UI
- 📦 Commissions button on each kingdom card (between Orders and Petition)
- 💰 Donate button on each kingdom card (after Petition)
- Kingdom gold donation dialog with 4 tiers (500g/1000g/2500g/5000g)
- Commissions and orders shown inline in kingdom detail panel

### Changed — Reputation Balance
- Military service rep: +1 per 90 days served (was +1/day)
- Smuggling rep penalty: -1 normal, -5 for war-related goods (was flat -15)
- War winner rep: +5 (was +30)
- Alliance join rep: +2 (was +10)
- Commission rep reward: +1 (was +15)
- Reputation decay above 70: -0.1/month toward 70; above 90: extra -0.1/month
- Town→Kingdom reputation spillover: each 10 town rep above/below 50 → ±1 kingdom rep monthly
- Guildmaster promotion now requires 180 trading days and 2+ caravans sent

### Changed — Smarter Street Trade
- Street trade NPCs now preferentially want banned (3x weight), restricted (2x), and scarce (1x) goods
- Above-market premiums: banned 1.3-2.0x, restricted 1.2-1.7x, scarce 1.1-1.5x
- 75% chance to pick from weighted pool, 25% random

### Fixed
- **Build dialog silently swallowing failures** — executeBuild now checks return value and shows actual error message
- **Build dialog inventory access bug** — Player.state.inventory → Player.inventory (was showing 0 for all materials)
- **Build dialog auto-buy display** — shows per-material breakdown (have/need, auto-buy qty + cost from market)
- **Buy Max ignoring carry capacity** — now uses personal carry capacity only (not warehouse storage)
- **NPC quit/retire/training notifications** — only fire for player's workers, not all NPCs

## [0.44.1] - 2026-03-31

### Fixed — Bug Fixes & Notification Category Overhaul

- **Notification filters UI**: Removed stale localStorage overrides that were overwriting save data on load; save file is now sole source of truth for filter preferences
- **Remembered prices persistence**: Added price snapshot on game load for current town, so old saves without price data get backfilled immediately
- **Real estate report**: Fixed "no towns available" error — replaced non-existent `Engine.currentTown()` with `Engine.findTown(Player.townId)`
- **Notification categories**: Complete overhaul of `inferEventCategory()` to distinguish player's kingdom vs foreign kingdoms
  - Kingdom tax/law/festival/seizure events now check `details.kingdomId` against player's citizenship and current town kingdom
  - Events about the player's kingdom → `my_kingdom`; other kingdoms → `foreign_kingdoms`
  - Refugees now properly categorized based on source kingdom instead of hardcoded `local_town`
  - Disasters check if they affect player's current town (`local_town`) vs elsewhere
  - Added `kingdomId` to 40+ kingdom event details objects that were missing it
  - Fixed 2 broken `logEvent()` calls (dual citizenship laws) with swapped arguments
  - Removed all hardcoded `'my_kingdom'` explicit categories — all are now dynamic
  - Added many new `dtype` matches: `tax_increase`, `tax_decrease`, `emergency_tax`, `festival`, `grand_festival`, `royal_pardon`, `crime_crackdown`, `public_works`, `welfare_distribution`, `forced_requisition`, `building_seizure`, `seizure_rebellion`, `seizure_overthrow`, `forced_loan`, `forced_labor`, `currency_debasement`, `elite_seizure`, `secession`, `coup_attempt`, `king_overthrown`, `coup_failed`, `conquest_citizenship`, `conquest_servitude`, `conquest_raid`, `kingdom_collapse_warning`, `kingdom_fragmentation`, `abdication`, `king_death`, `refugees`

## [0.44.0] - 2026-03-31

### Added — Equipment, Street Contraband, Journal & Save Fixes

#### Equipment System Overhaul
- **Bows added as equippable weapons** — 4 tiers: Short Bow, Hunting Bow, Longbow, War Bow (+8-35% combat survival)
- **Tiered weapons/armor use tiered resources** — Steel Sword/Plate Armor now use `swords_good`/`armor_good`, Masterwork/Royal use `excellent` tier
- **Equip from inventory** — new "🎒 Equip from Inventory" section in character panel lets you equip owned weapons/armor at no cost
- **All weapon/armor tiers tradeable on market** — swords_good, swords_excellent, bows, bows_good, bows_excellent, armor_good, armor_excellent all buy/sell like normal goods, subject to kingdom laws and permits

#### Street Trading — Contraband Selling
- **Sell banned/restricted goods on the street** — new "🚫 Sell Contraband" section shows NPCs willing to buy your illegal goods
- Banned goods sell at 1.3-2x black market premium; restricted goods at 1.0-1.3x
- **Same smuggling risk as market** — detection, fines, jail, confiscation all apply
- Sell 1 or Sell All buttons with premium % vs market display

#### Journal System Enhancements
- **New journal events**: significant trades (50g+), travel departures, job completions, guild membership, skill learning, injuries, housing construction, land purchases
- **Richer arrival entries** — describe town size, port status, first-visit excitement
- **Travel departure entries** — record origin, destination, estimated days, horse/sea/offroad details
- **Auto-pause on town arrival** — game pauses when you arrive so you can decide what to do

### Fixed
- **Remembered market prices now persist across saves** — was never being saved/loaded, causing all price memory to vanish on reload
- **Journal entries now persist across saves** — same save/load bug fixed
- **Visited towns tracking now persists** — first-visit detection survives save/load
- **Unequip returns correct resource** — no longer always returns basic `swords`/`armor`; returns actual tier (e.g., `swords_excellent` for Masterwork Sword)

## [0.43.1] - 2026-03-31

### Added — Building Storage, Trade Tips, Transfer to Player

#### Building Storage & Overflow
- **Town storage capacity** now includes housing storage (cottages, wagons, etc.) and player carry capacity when in town
- **Auto-sell overflow**: when storage is full and no transfer set, one day's production auto-sells on town market at 75% price
- **"Your Inventory" transfer target** — buildings can now send output directly to your inventory (overflow goes to town storage)

#### Trade Tip Persistence
- **Trade tips now log permanently** under Market Intel → 📝 Trade Tips section (most recent 10 shown)
- Tips update **marketIntel** for that town/resource immediately
- Tips logged to **event/notification system** for history tracking
- Tips **auto-expire after 30 days**
- Both Info Broker tips and NPC merchant tips use the same logging system

### Changed
- **Temporary soldier duty** now has medium injury risk (0.8%, matching weapons courier)
- Workers **under 18 can no longer be hired** (raised from 14 to 18 in all hiring paths)
- Trade tip message format simplified: shows one good at one location

### Fixed
- NPC trade tip perk no longer creates duplicate event log entries

## [0.43.0] - 2026-03-31

### Added — Travel Overhaul, Deposit Scanning, Auto-Travel Jobs, Cart Travel

#### Smooth Per-Tick Travel
- **Travel progress updates 60× per day** instead of once per day — player marker moves smoothly across the map
- **Instant arrival** when progress hits 100% — no more waiting at the destination
- Player world coordinates update every sub-tick for real-time marker movement

#### 4× Faster Travel
- All travel speeds increased 4× across the board (CARAVAN_BASE_SPEED: 30 → 120)
- Affects walking, horse, sea, caravans, transport services, army marches

#### Cart Travel System
- **Bring or leave cart** option when traveling — leave heavy goods behind for faster travel
- Left cart goods tracked with 15%/day theft risk while unattended
- 85% chance cart is still there on return; goods restored on arrival
- Speed penalty when traveling without horse but with cart (40% slower)

#### Auto-Travel Job Transport
- Jobs requiring travel now provide **temporary horse** (or ship for sea routes)
- Temporary transport marked with `_temporary` flag, removed on job completion or quit
- **Quit Job button** added to travel HUD during auto-travel missions

#### Terrain-Aware Resource Deposits
- Deposit assignment now **scans a 4-tile radius** around each town instead of just the tile under it
- Nearby forests grant scaled wood deposits even for grassland/coastal towns
- Nearby mountains grant iron/stone deposits proportionally
- All non-coastal inland towns get at least a small wood deposit (scattered groves)
- Fish deposits restricted to seaports only
- Applies to both worldgen and newly founded towns/outposts

#### Deposit-Based Building Generation
- ~70% chance to auto-generate extraction buildings (mines, lumber camps, quarries, etc.) for each deposit
- **Ownership mix** based on kingdom personality: militaristic kings claim war resources, greedy kings nationalize more
- Elite merchants in town get ~40% of unclaimed buildings; rest are NPC/town-owned

### Changed

#### Trade & Economy
- **Buy Max button** now accounts for carrying capacity + town storage, not just gold and shop stock
- **Trade tip cost** reduced from 25g to 10g (CONFIG.INFO_BROKER_COST)
- **Land ownership limits** increased: Citizen 1→3, Burgher 3→6, Guildmaster 10→15, Minor Noble 20→30

#### UI Improvements
- Housing dialog shows **global land count vs rank limit** (e.g., "global: 1/3 for Citizen")
- Improved land limit error message shows current count and suggests advancing rank

### Fixed
- **Toast spam on new game** — `lastProcessedEventCount` now initialized to `events.length` instead of 0, preventing all worldgen events from replaying as toasts
- **Trade tip button** — fixed `TypeError: rng is not a function` (Engine.getRng() returns object with .random() method)
- **Trade tip duplicate notifications** — removed broken `showNotification` call and duplicate `Engine.logEvent`
- **Travel stuck at 100%** — subtick now calls `tickTravel()` immediately on arrival instead of waiting for daily tick

## [0.42.0] - 2026-03-30

### Added — Budget-Aware King AI, Kingdom Panel Buttons, Tutorial Fixes

#### Budget-Aware Recruitment AI
- **Wartime AI recruitment** now costs 50g per soldier with budget sustainability checks — kings estimate daily income vs costs before recruiting
- **Personality-driven recruitment limits**: brave kings recruit more aggressively, cautious kings less; smart kings check budget surplus
- **Peacetime recruitment** gated behind `minReserve` threshold — kings won't recruit if it would drain treasury
- **Volunteer recruitment** wrapped in budget check — requires gold above minReserve
- **Wartime section 8 recruitment** reduced base limits and added budget margin checks with RNG variability

#### Budget Sustainability & Revenue Generation AI
- **9-action financial strategy system**: kings respond to unsustainable budgets with revenue generation AND expense cutting
- Revenue actions: raise trade/property/income tax, sell military stockpile, lower tariffs (smart kings), build markets
- Expense actions: reduce guard budget, discharge soldiers, cancel construction
- **Personality-driven priority**: greedy kings raise taxes first, generous kings cut expenses first, clever kings use balanced approach
- **Emergency review frequency**: every 3 days if treasury < 500g, every 10 days if < 2000g (was fixed 30-day interval)
- **Periodic budget sustainability review** in `tickKingdomFinancialStrategy` evaluates budget balance, discharges soldiers based on personality

#### Kingdom Panel Action Buttons
- Added 📜 Laws, 🏛️ Trade buttons on ALL kingdom cards in Kingdoms dialog
- Added 📋 Orders, 📝 Petition buttons on player's home kingdom card
- New `.kc-btn` CSS styling for kingdom card buttons

#### Tutorial Interactive Step Fixes
- **Find button**: Added `window._tutorialLocateUsed` flag for reliable detection (toast DOM was unreliable)
- **Save game**: Snapshot save count on step entry, detect new saves (old method triggered immediately if any save existed)
- **Kingdom Laws step**: Updated text to mention both Kingdoms panel button and town detail as ways to find laws

### Fixed
- Wartime AI recruitment was creating **free soldiers** with no gold cost and no budget check — now costs 50g each
- `_lastSeasonTaxRevenue` initialization improved: uses population-based estimate instead of flat 15% of gold
- Tutorial seed 7777 stability maintained for consistent tutorial experience

## [0.41.0] - 2026-03-30

### Added — King Succession, Bankruptcy Loans, Apartment/Rental Overhaul, Housing, Real Estate & Financial Reports

#### King Death & Succession System Fix
- **God mode kill buttons now properly call Engine.killPerson()** triggering full succession logic — fixed `pk.kingId` → `pk.king` field name bug that prevented king lookup
- God mode plague button also fixed to route through killPerson()
- Inline onclick JS no longer bypasses central handlers (killPerson, succession)

#### King Personality → AI Derivation
- **New kings' NPC personality traits (0-100 numeric)** now derive kingdom AI categorical traits (brilliant/clever/etc)
- `installNewKing()` and revolution handler updated to derive `kingdom.kingPersonality` from king NPC personality
- Worldgen stamps king NPC personality to match random kingdom traits at generation
- Fixed 2 dead `k.personality` references → `k.kingPersonality` in tickDiplomacy and tax adjustments

#### Bankruptcy Guild Loan System (10-part feature)
- CONFIG constants for guild loan parameters
- Max gold tracking (`Player.maxGoldEver`)
- Guild loan data model (`Player.activeLoan`)
- Guild loan calculation engine (virtual funds, credit score)
- Guild loan as bankruptcy choice
- Acceptance handler with free guild membership grant
- Auto-payments every 30 days with interest
- Debt forgiveness when choosing other bankruptcy options
- Full loan selection UI with terms display
- `Player.getGuildLoanOffers()` and `Player.acceptGuildLoan(guildId)` API

#### Apartment System Overhaul
- Replaced all `npc_placeholder_*` IDs with real NPCs during worldgen
- New `tickApartmentFees()` for monthly fee collection from apartment residents
- Death cleanup and missed payment eviction logic
- NPCs can now buy apartment units in `tickNPCHousingAI()`

#### EM Rental System Overhaul
- `tickEMRentalBusiness()` no longer creates phantom rental entries
- Real rent collection from tenants with proper gold tracking
- Tenant assignment for vacant properties
- Missed payment eviction system
- Profitability evaluation before building new rental properties
- Sale of underperforming properties

#### NPC Birth Housing
- Born NPCs now find parents (matching lastName in town)
- Parent↔child linking at birth
- Inherit housing type from parents (apartment/tent/house)
- Parents help with apartment costs
- Small gold gift to newborn NPCs

#### NPC Income Bug Fix
- **OCCUPATIONS wage was paying PER TICK (60x/day inflation)** — fixed with `_lastPayDay` guard
- Removed duplicate `NPC_DAILY_INCOME` system
- Building worker wages now once-per-day with skill modifiers
- Soldiers/guards paid by kingdom instead of per-tick

#### House Condition System
- Player houses now have `condition`, `builtDay`, `lastRepairDay` fields
- Houses degrade on same timeline as buildings
- New `repairHouse()` function for house maintenance

#### Real Estate Analysis Skills (3 skills)
- `local_market_analysis` (1 SP) — local town real estate data
- `kingdom_market_analysis` (2 SP) — kingdom-wide market overview
- `global_market_analysis` (3 SP) — cross-kingdom market intelligence
- Price history tracking via `tickMarketSnapshot()`
- `getRealEstateReport(townId)` with trend projections
- Full UI modal with building costs and material price trends

#### Financial Report UI
- 📊 button in character panel opens financial report
- Income streams: building revenue, rental income, apartment income, trading profits
- Expenses: wages, maintenance, taxes, loan payments, guild memberships
- Net income calculation and 30-day projection
- `UI.openFinancialReport()` API

#### EM Guild AI
- `tickEMGuildAI()`: Elite merchants join guilds relevant to their strategy
- `STRATEGY_GUILDS` mapping for strategy → guild associations
- Yearly membership management with production/trade bonuses and reputation boost
- Expired memberships lapse automatically

#### Notification Fixes
- Fixed `clickTown()` closing modal AFTER showing town detail (race condition)
- Toast clicks now open event log
- Universal location button on all notification events
- EM notifications gated behind `merchant_intelligence` skill

#### Tent Camp Enhancements
- Right to Camps law requires land purchase + kingdom ownership
- NPC self-build tent camps when homeless
- Player petition to demolish tent camps
- No Tent Camps law enforcement

### Bug Fixes
- God mode Kill King button used `pk.kingId` instead of `pk.king` — never found the king
- God mode kill/plague buttons bypassed `killPerson()`, skipping succession/cleanup
- `k.personality` references (dead code) → `k.kingPersonality` in tickDiplomacy and tax adjustments
- NPC income 60x inflation bug (OCCUPATIONS wage paying per tick instead of per day)
- Building worker wages paying per tick instead of per day
- Notification `clickTown()` closing just-opened town detail modal
- Apartment buildings using placeholder NPC IDs instead of real NPCs

## [0.40.1] - 2026-03-30

### Fixed — AI/Elite Merchant Unification
- **Unified AI merchants with elite merchants** — Removed redundant AI merchant system (player.js) that created duplicate purple dots and double market impact. All rival merchants are now elite merchants in engine.js with proper heraldry, families, deep trading AI, gold dots, and clickable flag icons.
- Removed `renderAIMerchants()` purple dot rendering — no more overlapping names/circles
- `window.AIMerchants` and `Player.getAIMerchants()` now return elite merchants for backward compat
- `tickAIMerchants()` and `initAIMerchants()` are no-ops — engine handles all merchant AI
- Serialization stubs preserved for old save backward compat
- Leaderboard, achievements, and schemes UI all use elite merchants
- Fixed double market impact from two merchant systems trading simultaneously

## [0.40.0] - 2026-03-30

### Added — Medical Config, Well Depletion, Land, Map Interaction
- **NPC health fields** on all person creation sites (health, sick, illness, injured)
- **NPC_HEALTH_CONFIG** — 8 illness types, seasonal/density/building modifiers, severity weights
- **HEALTH_POLICIES** — 6 kingdom policies (quarantine, curfew, medical_funding, etc.)
- **Well water depletion** — Finite capacity based on fertility (10k-40k), ±25% variance, daily consumption
- **Kingdom AI well management** — Replaces depleted wells, proactive building
- **Well UI** — Per-well water levels with color coding
- **Land requirement for building** — buildBuilding() enforces land ownership (wells exempt)
- **Land prices 50% cheaper** — LAND_COST_BASE 500→250
- **Player military equipment** — Issuance/return from kingdom stockpile, post-battle degradation
- **God mode warp** — Instant teleport in travel UI
- **Sea routes** — Walking/horse hidden for sea-only routes
- **Elite merchant gold dots** — Larger distinct gold dots on map
- **Elite merchant flag click** — Heraldry icons are clickable
- **Rich NPC tooltips** — Elite merchants show heraldry/strategy on hover
- **Fixed sticky tooltip** — Was broken (wrong type check), increased to 1500ms
- **Clickable family members** — Spouse/parents/children as navigable links in info panel
- **Elite merchant detail section** — Heraldry, strategy, caravans, inventory, track button
- **Hunger/thirst skills** — Ironclad Stomach, Camel's Endurance, Desert Nomad

### Bug Fixes
- Fixed sticky tooltip (checked 'none' but hitTest returns 'empty')
- Fixed family display (was count only, now individual clickable members)
- Moved GameTestingCompany test files out of game folder

## [0.35.0] - 2026-03-28

### Added — Playthrough Campaign & Documentation
- **10-start playthrough campaign** — All game starts tested with human-like AI player (1800 days each)
- **Per-start narratives** — RPG-style story documents for each playthrough
- **Per-start analysis** — Gameplay statistics, observations, and suggestions
- **Combined results document** — Summary of all 10 playthroughs with comparison table
- **LESSONS_LEARNED.md** — Comprehensive AI session knowledge base (20 sections, 26KB)
- All playthrough documents in `MerchantRealmsDevelopment/328playthroughs/`

### Changed
- Moved backup files from `js/` to `MerchantRealmsDevelopment/backups/` (game folder cleanup)
- Updated AI_SESSION_HANDOFF.md, VERSIONS.md, aiassist.md, aieditingandtestingassist.md with lessons learned

### Playthrough Results (v0.34.0 code, 1800 days each)
| Start | Result | Final Gold | Trades |
|-------|--------|-----------|--------|
| Aspiring Merchant | ✅ Survived | 12g | 61 |
| Indentured Servant | ✅ Survived | 5g | 60 |
| Religious Pilgrim | 💰 Bankrupt (Day 1085) | 0g | 18 |
| Shipwrecked Foreigner | ✅ Survived | 0g | 148 |
| Traveling Musician | ✅ Survived | 102g | 17 |
| Military Leader | ✅ Survived | 44g | 32 |
| Scholar of Ages | ✅ Survived | 18g | 19 |
| Penniless Peasant | ✅ Survived | 49g | 55 |
| Noble Birth | ✅ Survived | 7g | 29 |
| Merchant's Heir | ✅ Survived | 43g | 28 |

## [0.34.0] - 2026-03-28

### Added — Tutorial Expansion
- **Chapter 14: Guilds & Crafting** (6 steps) — What guilds are, 9 guild types, interactive Guilds panel with 500g given, membership types (monthly vs yearly), guild building restrictions, Guild Monopoly law, guild crafting access, entry fees
- **Chapter 15: Survival Economics** (5 steps) — Trade or Die lesson, economy death spiral warning, market saturation mechanics, early game survival checklist, bankruptcy recovery paths
- Updated congratulations message to mention guilds and survival economics
- Total tutorial now 16 chapters (was 14), ~105 steps

## [0.33.0] - 2026-03-28

### Fixed — 100-Bug Fixing Campaign
100 verified code bugs fixed across all game systems. Highlights:

#### Critical Fixes (10)
- **Jail system:** 5 locations used stale `player.jailed`/`player.jailDays` instead of active `player.jailedUntilDay` — jail never worked for blockade running, border crossing, crime sentencing
- **Battle crashes:** Set/Array mismatch in combat (`.includes()` on Set), wrong recruit rank value
- **Surrender peace crash:** Winner stored as ID string, `setKingMood()` expected object
- **specialLaws crash:** King politics crashed on old saves missing `specialLaws` field
- **atWar null crashes:** 7+ locations accessed `.size`/`.has()` on undefined atWar

#### High Fixes (25)
- **Serialization gaps:** 30+ fields missing from `serializePlayer()` — travel state, spouse modifiers, military, bankruptcy, tournament, spy favors, tax exemption, petition, monopoly, instrument, maxAge, and more were all lost on save/load
- **Property name typos:** `.horse` → `.horses`, `.spouse` → `.spouseId`, `currentTownId` → `townId`
- **Spy rewards:** Enemy kingdom received spy mission rewards instead of home kingdom
- **Criminal record:** `criminalRecord[kId] > 0` always false (was object, not number)
- **Caravan stuck:** Caravans stuck forever if destination town removed
- **Dynasty generation:** Regency never advanced generation counter
- **Forage/horse RNG:** Used `Math.random()` instead of seeded RNG, breaking determinism

#### Medium Fixes (35)
- **Input validation:** 8 functions accepted NaN/negative/zero values, corrupting game state (sellToKingdom, negotiateSupplyDeal, bidOnOrder, setupTransport, supplyBuilding, collectBuildingOutput, stockRetailBuilding, giveFamilyGift)
- **Dead spouse on load:** Validation allowed dead NPCs as valid spouse
- **Sea speed:** Double-applied speed bonus
- **Thirst debuff:** Used hungerRate instead of thirstRate
- **Dead skills:** guild_negotiator, good_parent, royal_favor had no runtime effect — wired up
- **Dead achievements:** bribesGiven, belowMarketSales, smugglingTaxSaved counters never incremented
- **Blackmail exploit:** NPC never debited gold — created money from nothing
- **Rental houses:** Family dinner, celebration, and invite accepted rental properties as valid homes

#### Low Fixes (14)
- Player undefined guards in 4 UI locations
- Stale field writes and duplicate serialization
- Tooltip negative coordinate positioning
- Tournament forfeit logged wrong round number

### Changed
- Musician fame rebalance — gains reduced ~10x; legendary fame requires ~6 months of dedicated play
- Passive fan fame: `0.1` → `0.01` per fan per kingdom tick
- Tavern performance fame: `1.0/1.25` → `0.12/0.15`
- Street performance fame: `0.5/0.625` → `0.06/0.08`
- Concert fame: `5` → `0.5`
- Compose song base fame: `3 + floor(skill/25)` → `0.25 + floor(skill/50)*0.1`
- Grand concert legendary fame: `15` → `2` (all kingdoms)
- Grand concert good fame: `8` → `1` (all kingdoms)
- Grand concert flop penalty: `3-8` → `1-3`
- Music duel win fame: `5` → `0.5`
- Music duel loss penalty: `3-8` → `1-3`

## [0.32.0] - 2026-03-27

### Added — Alliance Dynamics Overhaul
- **Alliance metadata** — Alliances now track type (defensive/offensive), formation day, calls honored/refused, and fatigue
- **Call to arms** — Replaces auto-join; allies evaluate whether to honor calls based on relations, personality, treasury, exhaustion, and fatigue
- **Defensive vs offensive alliances** — Defensive (75-80%) only trigger when ally is attacked; offensive (20-25%) also trigger for wars the ally starts
- **Alliance fatigue** — Repeated calls to arms increase fatigue; old alliances accumulate passive fatigue; high fatigue can dissolve alliances
- **Alliance betrayal** — Corrupt/greedy kings with low relations may betray allies, causing severe relation drops and unique events

### Added — Treaty System with Binding Terms
- **3 treaty tiers** — Surrender (720-day non-aggression, reparations, DMZ, tariffs, town cessions), Negotiated (360-day, lighter terms), Exhaustion (180-day non-aggression only)
- **Monthly reparation processing** — Losing kingdoms pay treasury reparations over 6-12 months
- **DMZ enforcement** — Military buildings and garrison buildup restricted in border towns; violations detected daily
- **Trade agreements** — Mutual or one-sided tariff reductions as treaty terms
- **Treaty violation penalties** — -30 relations with all kingdoms, ruler branded oathbreaker
- **Territorial concessions** — 1-2 border towns transferred via `transferTown` in surrender treaties

### Added — Opportunity Sensing AI
- **NPC supply gap boost** — NPCs get `demandBonus = 15` (vs 5 normal) for zero-supply/high-demand goods when switching products
- **EM trade opportunity** — EMs scan connected towns for supply gaps; willing to pay 30% more for goods with zero supply elsewhere
- **EM travel routing** — +25 destination score when carrying goods that fill a complete supply void
- **EM building incentive** — Gap score doubled when supply is completely absent
- **Kingdom gap awareness** — New `supply_gap_building` strategy (priority 120) finds and builds missing production buildings
- **Royal monopoly** — Greedy/corrupt kings ban goods after building to produce them, creating kingdom monopolies

### Added — Building Conversion System
- **Convert any building** — Buy a for-sale building + 500g + 1 blasting powder → demolish → rebuild as any type
- **Demolish buildings** — Player can demolish owned buildings to free slots (same cost)
- **Kingdom profit tracking** — Kingdom-owned buildings now track revenue/costs; unprofitable ones auto-listed for sale after 90 days
- **AI conversion** — EMs evaluate 180-day ROI before converting; NPCs 30% chance when wealthy; kingdoms convert for supply gaps
- **Blasting powder from kingdom** — Always available at 1.5-3x markup (by king greed); doubled if banned
- **Street buying** — Buy banned goods (blasting powder, etc.) from shady NPCs at 2-3.5x premium with detection risk

### Added — Zero-Demand Goods Fix
- **Intermediate goods demand** — Buildings now register demand for their input materials (smelter → iron_ore, bakery → flour, tailor → cloth/leather, etc.)
- **Multi-product building demand** — Available recipes counted at 50% weight
- **Service building demand** — Clinics and bathhouses register herbal_tea and water demand
- **Missing goods added** — livestock_chicken, water, herbal_tea, ale, mead, cider, pearls now have proper demand registration

### Added — UI & Quality of Life
- **Goods Guide** — Searchable, filterable guide in help system showing all goods with icons, prices, categories, and producer/consumer chains
- **Guild UI overhaul** — "Gives Access to Buildings:" replaces generic "Categories:" label; local availability indicator shows guild building count per town
- **Town prosperity descriptors** — 7-tier system on tooltips: Golden Age, Flourishing, Thriving, Stable, Struggling, Impoverished, Destitute
- **Expanded name pools** — Kingdom names 14→36, town names 44→86, island names 8→22, male/female first names 50→80, surnames 46→76
- **Birth/settler names use main pool** — No more repetitive hardcoded mini-pools

### Added — Developer & QA Tools
- **Export Console button** — God mode "📋 Export Console" copies last 500 console entries (with timestamps and levels) to clipboard for easy bug reporting
- **Console capture system** — Hooks console.log/warn/error/info + uncaught errors + unhandled promise rejections; stored in memory for export
- **Favicon** — ⚖️ balance scales SVG favicon added to browser tab

### Fixed
- **First war auto-neutral** — First war in each new game auto-sets player to neutral without popup; subsequent wars show full allegiance choice
- **Military enlistment bankruptcy** — Added 3 fallback layers for war detection (town kingdom, atWar sets, any-war)
- **EM flee population bookkeeping** — Added population counter updates at 2 EM relocation sites (tax-driven flight, travel)
- **Population bugs verified** — Confirmed 5 prior population bugs already fixed in previous sessions
- **Elite merchant AI crash** — `eliteCollapseAI()` threw `ReferenceError: strategy is not defined` every 5 days; added local strategy variable
- **Load Game UI overlap** — Download/Import/Delete buttons no longer overlap save slot text; restructured to flex column layout
- **Rankings button crash** — Fixed `CONFIG.SKILLS` → `SKILLS` reference error that broke the rankings panel

## [0.31.0] - 2026-03-27

### Added — Elite Merchant Skill System
- **Full skill tree for EMs** — Elite merchants now have XP, levels, skill points, and learn skills from the same tree as the player
- **Personality-driven skill selection** — Strategy and personality traits determine which skills EMs pursue (e.g., war profiteers learn war_profiteer, political climbers learn court_etiquette)
- **Starting skills seeded** — Older/wealthier EMs begin with more skills based on their background
- **XP from actions** — EMs gain XP from daily activity, trading (proportional to value), building (+10), and rank advancement (+50)
- **Skill-gated AI decisions** — EMs can only see market data their skills allow (keen_eye for local, market_scout for connected towns, trade_network for kingdom, global_trade_intel for all)
- **Trade skill bonuses** — haggler/master_haggler buy discounts, silver_tongue/golden_tongue sell bonuses applied to EM trades
- **Building cost reduction** — efficient_builder/master_builder reduce EM construction costs
- **Supply chain gap detection** — EMs with keen_eye + market_scout identify demand gaps in connected towns and build to fill them
- **Demand exploitation** — EMs with market_scout buy high-demand goods for arbitrage

### Added — Economy Demand System Overhaul
- **CRITICAL FIX: Demand ordering** — Population demand now calculated BEFORE price recalculation (was after, making demand invisible to prices)
- **Missing demand categories** — Added pearl_jewelry, demolition_tools, camping gear (tent, bedroll, waterskin, camping_kit) demand
- **Quality weapon consumption** — Elite units consume good-tier weapons; royal guard in capitals consume excellent-tier
- **Kingdom quality procurement** — Kingdoms now procure quality weapons (good/excellent) during wartime at premium prices
- **Expanded luxury modifiers** — pearl_jewelry, harp, hurdy_gurdy now scale with town prosperity

### Added — NPC Production Intelligence
- **NPC product switching AI** — NPC-owned buildings evaluate all available products every 14 days and switch to the most profitable one based on sell price, input costs, and unmet demand
- **Military quality tier upgrades** — NPC military buildings (blacksmith, armorer, fletcher, arrow_maker) now set production tier based on worker skill and wartime urgency
- **11 missing building types** — armorer, fletcher, arrow_maker, instrument_workshop, string_maker, drum_maker, perfumery, silk_weaver, fine_tailor, tapestry_loom, goldsmith, canvas_workshop added to NPC construction list

### Fixed
- **Canvas Workshop produces:null** — Buildings with `availableProducts` but no default `produces` now work correctly in production loop
- **Stable goods economy** — 15+ goods that were frozen at fixed prices now have active supply/demand dynamics

## [0.30.0] - 2026-03-27

### Added — NPC Social Interaction System
- **6 interaction types** — Small Talk, Tell a Joke, Discuss Business, Compliment, Ask for Advice, Share a Drink
- **Personality-driven outcomes** — Each interaction is weighted by NPC personality traits (warm, serious, ambitious, etc.)
- **Quirk bonuses/penalties** — NPC quirks like "bookworm" or "stubborn" affect interaction gains
- **Daily cooldown** — 3 interactions per NPC per day to prevent spam-clicking
- **Social Insight skill** — New social branch skill that reveals color-coded interaction ratings (great/good/neutral/poor)
- **Gold costs** — Share a Drink costs 5g; other interactions are free

### Added — Guild Membership System
- **9 guilds** — Farmers', Miners', Harvesters', Artisans', Craftsmen's, Armorsmiths', Luxury Artisans', Maritime, Merchants'
- **Monthly (25g) or yearly (200g) memberships** — Dynamic pricing based on world economy
- **Guild crafting** — Members can use any guild building in their town to craft goods (5-10g entry fee per visit)
- **Material consumption** — Crafting uses materials from inventory/warehouse and produces finished goods
- **Guild fee distribution** — Monthly fees collected and distributed to building owners
- **🏛️ Guilds toolbar button** — New UI panel showing all guilds, membership status, and craftable items

### Added — Notification Category Tabs
- **4 category tabs** in Event Log — 📋 All, 🧑 Personal, 🏘️ Local, 🌍 World
- **Personal** = my actions, business, travel, combat
- **Local** = local town events, NPC activity
- **World** = kingdom politics, foreign affairs, world economy, military
- **Per-category filter buttons** only visible in "All" tab

### Added — Tutorial Improvements
- **Interactive notification settings step** — Player must open Settings and enable kingdom notifications
- **Kingdom policies mention** — Added to Trading Tips tutorial step
- **War event suppression** — Military events and war allegiance popups suppressed during tutorial
- **Kingdom notification default off** — `my_kingdom` filter defaults to false for first 5 days / tutorial

### Added — Street Trading Enhancements
- **Premium percentage display** — Shows "+X% above market" (green) or "-X% below market" (red) inline
- **Below-market warning** — Red "⚠️ Below market price!" text on offers below market rate
- **Stale data fix** — Street trading panel now clears and refreshes on town arrival

### Added — Housing Material Color Indicators
- **Green ✓** for materials you have enough of
- **Red ✗** with "need X more" for materials you're short on

### Fixed — Critical Bugs
- **Day 0 off-by-one** — `world.day` now initializes to 1 (was 0)
- **Rest button disappearing** — Always visible, greyed out while traveling instead of hidden
- **Street trading stale data** — Cache cleared on town arrival to prevent wrong-town offers

### Fixed — Travel Time Estimates
- **~24x overestimate fixed** — UI was dividing by `speed * 24` but travel ticks once per day, not per hour
- **Route distance calculation** — Now accounts for road quality multipliers, off-road penalty, and sea speed
- **8 instances corrected** across walk, horse, sail, passage, and ETA displays

### Changed — Tutorial Step Split
- **Chapter 1 Step 7** split into two steps: "Town Info & People" (interactive) + "Navigation & Ledger"
- Each step now has one primary action, reducing information overload

### Fixed — UI Polish
- **NPC interaction duplicate emoji** — Removed redundant emoji from interaction name text (kept icon column only)
- **Town selection button alignment** — "Start Here" buttons now align at bottom of cards in each row via flexbox

## [0.29.0]- 2026-03-27

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
