# Changelog

All notable changes to Merchant Realms will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

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
