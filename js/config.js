// ============================================================
// Merchant Realms - Shared Configuration & Constants
// ============================================================

const CONFIG = {
    // World
    WORLD_WIDTH: 10000,
    WORLD_HEIGHT: 10000,
    TILE_SIZE: 16,
    NUM_KINGDOMS: 4,
    TOWNS_PER_KINGDOM: 4,
    PEOPLE_PER_TOWN: 120, // legacy reference — variable pop now used

    // Variable Population — settlement hierarchy
    TOWN_POP_MIN: 20,
    TOWN_POP_MAX: 400,
    CAPITAL_POP_MIN: 300,
    CAPITAL_POP_MAX: 450,
    CITY_POP_MIN: 160,
    CITY_POP_MAX: 250,
    REGULAR_POP_MIN: 80,
    REGULAR_POP_MAX: 140,
    VILLAGE_POP_MIN: 35,
    VILLAGE_POP_MAX: 55,
    ISLAND_POP_MIN: 20,
    ISLAND_POP_MAX: 60,
    WORLD_POP_CAP: 10000,
    NUM_AI_MERCHANTS: 20,
    NUM_ROADS_EXTRA: 5,

    // Viewport (local viewer resolution)
    VIEWPORT_WIDTH: 1280,
    VIEWPORT_HEIGHT: 720,

    // ── Camera & Rendering ──
    CAMERA_ZOOM_DEFAULT: 1.2,
    CAMERA_ZOOM_MIN: 0.5,
    CAMERA_ZOOM_MAX: 3.0,
    CAMERA_PAN_LERP: 0.3,               // pan interpolation per frame
    CAMERA_PAN_SNAP: 0.5,               // snap pan when within this many world units
    CAMERA_ZOOM_LERP_LOW: 0.5625,       // zoom lerp at zoom < 1.0 (faster)
    CAMERA_ZOOM_LERP_NORMAL: 0.375,     // zoom lerp at zoom >= 1.0
    CAMERA_ZOOM_SNAP: 0.002,            // snap zoom when within this factor

    // Terrain margin tiles by zoom level (buffer around viewport)
    TERRAIN_MARGIN_EXTREME: 40,   // zoom < 0.5
    TERRAIN_MARGIN_LOW: 28,       // 0.5 <= zoom < 0.7
    TERRAIN_MARGIN_MEDIUM: 16,    // 0.7 <= zoom < 1.0
    TERRAIN_MARGIN_NORMAL: 6,     // 1.0 <= zoom < 1.5
    TERRAIN_MARGIN_HIGH: 3,       // zoom >= 1.5

    // Pan thresholds in px (how far camera moves before terrain redraws)
    PAN_THRESHOLD_EXTREME: 200,   // zoom < 0.5
    PAN_THRESHOLD_LOW: 140,       // 0.5 <= zoom < 0.7
    PAN_THRESHOLD_MEDIUM: 80,     // 0.7 <= zoom < 1.0
    PAN_THRESHOLD_NORMAL: 12,     // 1.0 <= zoom < 1.5
    PAN_THRESHOLD_HIGH: 4,        // zoom >= 1.5

    // Scene cache (overlay-only offscreen canvas at low zoom)
    SCENE_CACHE_MARGIN: 1.1,      // 110% of viewport
    SCENE_CACHE_STABLE_FRAMES: 12, // frames zoom must be stable before engaging
    SCENE_CACHE_REFRESH: 300,     // rebuild every N frames (~5s)
    DECORATION_SKIP_ZOOM: 0.65,   // skip trees/mountains below this zoom

    // Time — real-time: ~1 real minute ≈ 1 in-game day
    DAYS_PER_SEASON: 90,
    SEASONS: ['Spring', 'Summer', 'Autumn', 'Winter'],
    MS_PER_DAY: 60000,          // 60 seconds real time = 1 in-game day
    SIM_TICK_INTERVAL: 1000,    // simulation ticks every 1 second (1/60th of a day per tick)
    TICKS_PER_DAY: 60,          // 60 ticks per in-game day

    // Off-screen simulation optimization
    OFFSCREEN_SIM_RADIUS: 2000, // full simulation within this px of player
    OFFSCREEN_APPROX_FACTOR: 4, // off-screen towns simulate every Nth tick (approximation)

    // Player starting values
    PLAYER_START_GOLD: 500,
    PLAYER_BASE_CARRY: 20,
    HORSE_CARRY_BONUS: 40,
    MAX_HORSES: 2,
    STORAGE_CONTAINERS: {
        backpack:     { name: 'Backpack',      cost: 10,   capacityMult: 2,  theftRisk: 0,      icon: '🎒', horsesRequired: 0, materials: { leather: 2, cloth: 1 } },
        cart:         { name: 'Cart',          cost: 30,   capacityMult: 4,  theftRisk: 0.008,  icon: '🛒', horsesRequired: 0, materials: { wood: 5, planks: 3, iron: 1 } },
        small_wagon:  { name: 'Small Wagon',   cost: 75,   capacityMult: 8,  theftRisk: 0.005,  icon: '🛞', horsesRequired: 1, materials: { wood: 8, planks: 5, iron: 2, rope: 1 } },
        wagon:        { name: 'Wagon',         cost: 120,  capacityMult: 10, theftRisk: 0.004,  icon: '🚛', horsesRequired: 2, materials: { planks: 8, iron: 3, rope: 2, leather: 2 } },
        large_wagon:  { name: 'Large Wagon',   cost: 180,  capacityMult: 12, theftRisk: 0.003,  icon: '🚚', horsesRequired: 2, materials: { planks: 12, iron: 5, rope: 3, leather: 3, cloth: 2 } },
    },

    // Economy
    BASE_WAGE: 4,               // Was 2; workers cost more
    SKILLED_WAGE: 10,           // Was 5; skilled workers cost more
    GUARD_WAGE: 6,              // Was 4; guards cost more
    TAX_RATE_DEFAULT: 0.10,
    PRICE_VOLATILITY: 0.15,
    SUPPLY_DEMAND_FACTOR: 0.005,
    BUILDING_WEEKLY_MAINTENANCE: 0.03, // 3% of building cost per week as maintenance

    // Elite Merchant scaling
    ELITE_MERCHANT_MIN: 20,
    ELITE_MERCHANT_MAX: 100,
    ELITE_MERCHANT_PER_TOWNS: 3,  // 1 EM per 3 towns (base)
    ELITE_MERCHANT_GROWTH_INTERVAL: 60, // days between growth checks
    ELITE_MERCHANT_BANKRUPTCY_DAYS: 30, // days below 50g before demotion
    ELITE_MERCHANT_BANKRUPTCY_GOLD: 50,

    // NPC Merchant Travel
    NPC_MERCHANT_TRAVEL_INTERVAL: 30, // days between NPC merchant travel checks
    NPC_MERCHANT_TRAVEL_GOLD_MIN: 500, // minimum gold for NPC travel
    NPC_MERCHANT_TRAVEL_PRICE_SELL_THRESHOLD: 1.5, // sell if dest price > local * 1.5
    NPC_MERCHANT_TRAVEL_PRICE_BUY_THRESHOLD: 0.6, // buy if dest price < local * 0.6

    // EM & Kingdom Caravans
    EM_CARAVAN_MAX_PER_EM: 4,       // max ongoing caravans per elite merchant
    EM_CARAVAN_HIRE_COST: 200,       // gold to hire a caravan
    EM_CARAVAN_CAPACITY_MIN: 50,     // min goods capacity
    EM_CARAVAN_CAPACITY_MAX: 200,    // max goods capacity
    EM_CARAVAN_SPEED: 0.08,          // progress per tick (about 12 days)
    EM_CARAVAN_DECISION_INTERVAL: 7, // days between caravan hiring decisions
    KINGDOM_CARAVAN_TREASURY_MIN: 5000,  // kingdom needs this much gold for royal caravans
    KINGDOM_CARAVAN_MAX: 2,          // max royal caravans per kingdom
    KINGDOM_CARAVAN_COST: 150,       // per-caravan hire cost per trip
    KINGDOM_CARAVAN_CAPACITY: 100,   // goods per royal caravan
    KINGDOM_CARAVAN_SPEED: 0.10,     // faster (military roads)
    KINGDOM_CARAVAN_INTERVAL: 14,    // days between kingdom caravan decisions

    // Diplomacy
    RELATION_WAR_THRESHOLD: -35,        // Was -60; lowered so wars actually trigger
    RELATION_ALLIANCE_THRESHOLD: 70,
    RELATION_DECAY_RATE: 0.1,           // Was 0.5; much slower decay lets grudges accumulate
    WAR_CHANCE_PER_DAY: 0.01,           // Was 0.002; 5x more likely once threshold met
    PEACE_CHANCE_PER_DAY: 0.008,        // Was 0.005; slightly faster peace for balance
    WARTIME_SUPPLY_COST_PER_SOLDIER: 2, // Gold per soldier per day during wartime (was hardcoded 5)
    DISPUTE_CHANCE: 0.04,               // Was 0.01 (hardcoded); 4x more border disputes
    DISPUTE_MIN: 5,                     // Border dispute minimum relation penalty
    DISPUTE_MAX: 18,                    // Border dispute maximum relation penalty
    AGREEMENT_MIN: 5,                   // Trade agreement bonus min
    AGREEMENT_MAX: 15,                  // Trade agreement bonus max(weaker than disputes)

    // Military
    SOLDIER_UPKEEP: 3,
    GARRISON_MIN: 10,
    BATTLE_RANDOMNESS: 0.2,

    // Territory Transfer & Conquest
    SERVITUDE_DURATION_DAYS: 2520,        // 7 years × 360 days
    SERVITUDE_FREEDOM_COST: 15000,         // gold to buy freedom
    RAID_KILL_RATE_MIN: 0.30,             // 30% min killed in raid
    RAID_KILL_RATE_MAX: 0.50,             // 50% max killed in raid
    RAID_INJURY_RATE: 0.20,              // 20% of survivors injured
    RAID_GOLD_PER_PERSON_MIN: 15,        // gold looted per person (min)
    RAID_GOLD_PER_PERSON_MAX: 25,        // gold looted per person (max)
    RAID_BUILDING_DAMAGE_RATE_MIN: 0.20, // 20% buildings damaged
    RAID_BUILDING_DAMAGE_RATE_MAX: 0.40, // 40% buildings damaged
    CONQUEST_CITIZENSHIP_HAPPINESS: 10,   // happiness boost from citizenship
    CONQUEST_SERVITUDE_HAPPINESS: -15,    // happiness penalty from servitude
    CONQUEST_RAID_HAPPINESS: -30,         // happiness penalty from raid (in conquered town)
    CONQUEST_RAID_KINGDOM_HAPPINESS: -5,  // happiness penalty from raid (in rest of kingdom)

    // Migration
    MIGRATION_CHECK_INTERVAL: 30,         // days between migration checks
    MIGRATION_BASE_COST: 30,              // gold to migrate
    MIGRATION_MAX_PERCENT: 0.05,          // max 5% can leave per cycle
    MIGRATION_WAR_MAX_PERCENT: 0.20,      // 20% during war/famine/conquest
    MIGRATION_SCORE_THRESHOLD: 50,        // score needed to trigger migration

    // Frontline
    FRONTLINE_TRADE_PENALTY: 0.5,         // 50% trade reduction
    FRONTLINE_HAPPINESS_DRAIN: 0.4,         // per day (softened from 1.0)

    // Peace Negotiation
    PEACE_TRIBUTE_PERCENT: [0.10, 0.15, 0.20, 0.25, 0.30], // escalating tribute %
    PEACE_TREATY_DURATION: 720,           // days of enforced peace after treaty

    // Horse utility
    HORSE_TRAVEL_SPEED_BONUS: 0.3,
    HORSE_CARAVAN_SPEED_BONUS: 0.25,
    HORSE_FARM_BONUS: 0.2,
    SADDLE_BONUS_MULTIPLIER: 2,

    // People simulation
    FOOD_CONSUMPTION_PER_DAY: 1,
    CHILD_FOOD_MULTIPLIER: 0.25,    // Children (age < COMING_OF_AGE) eat 1/4 of adult food
    NEED_DECAY_RATE: 2,
    MARRIAGE_MIN_AGE: 18,
    CHILD_PROBABILITY: 0.03,    // ~3%/day → avg ~33 days to conceive (user wants 30-100 day range)
    PREGNANCY_DURATION: 60,    // ~2 months in game days (1 year = 1 season = 90 days)
    MAX_CHILDREN: 8,            // Cap on total children per lifetime
    DEATH_AGE_MIN: 40,
    DEATH_AGE_MAX: 100,
    COMING_OF_AGE: 18,
    STARTING_CHILD_RATIO: 0.50, // Children at game start = 50% of adults per town

    // NPC Individual Purchasing (batched round-robin)
    NPC_PURCHASE_FOOD_RESTORE: 20,
    NPC_DAILY_INCOME: { farmer: 2, craftsman: 4, merchant: 6, soldier: 5, laborer: 1, noble: 10, guard: 4, miner: 3, woodcutter: 2, none: 0 },
    NPC_CLOTHES_CHANCE: 0.033,    // ~once per 30 days
    NPC_TOOLS_CHANCE: 0.02,       // workers buy tools occasionally
    NPC_LUXURY_UPPER_CHANCE: 0.02,
    NPC_LUXURY_MIDDLE_CHANCE: 0.01,
    NPC_UPPER_GOLD: 500,
    NPC_MIDDLE_GOLD: 100,

    // Disasters
    DISASTER_CHECK_INTERVAL: 30,  // check every 30 days
    DISASTER_FLOOD_CHANCE: 0.02,
    DISASTER_FIRE_CHANCE: 0.015,
    DISASTER_PLAGUE_CHANCE: 0.0003,
    DISASTER_BLIGHT_CHANCE: 0.03,
    DISASTER_MINE_COLLAPSE_CHANCE: 0.01,
    DISASTER_RESOURCE_DISCOVERY_CHANCE: 0.005,
    DISASTER_FIRE_POP_SCALE: 100,         // fire more likely in towns > 100 pop
    DISASTER_PLAGUE_CAPITAL_MULT: 2,
    DISASTER_PLAGUE_CITY_MULT: 1.5,

    // Kingdom Finances & Bankruptcy
    KINGDOM_SOLDIER_DAILY_COST: 2,       // 2g per soldier per day (paid monthly)
    KINGDOM_BUILDING_DAILY_COST: 1,      // 1g per building per day (paid monthly)
    KINGDOM_BANKRUPTCY_DESERTION_RATE: 0.003, // ~10% soldiers desert per month
    KINGDOM_BANKRUPTCY_COLLAPSE_DAYS: 90,
    KINGDOM_COLLAPSE_HAPPINESS_THRESHOLD: 15,
    KINGDOM_COLLAPSE_CHANCE: 0.1,
    KINGDOM_BANKRUPTCY_WARNING_GOLD: 200, // warn below this

    // Kingdom Starting Treasury
    KINGDOM_STARTING_TREASURY_MIN: 8000,
    KINGDOM_STARTING_TREASURY_MAX: 25000,

    // Kingdom Tax System
    KINGDOM_DEFAULT_PROPERTY_TAX_RATE: 0.02,  // 2% monthly property tax
    KINGDOM_PROPERTY_TAX_MIN: 0.01,
    KINGDOM_PROPERTY_TAX_MAX: 0.08,
    KINGDOM_DEFAULT_INCOME_TAX_RATE: 0.05,    // 5% seasonal income tax
    KINGDOM_INCOME_TAX_MIN: 0.01,
    KINGDOM_INCOME_TAX_MAX: 0.15,
    KINGDOM_PROPERTY_TAX_INTERVAL: 30,        // every 30 days
    KINGDOM_INCOME_TAX_INTERVAL: 90,          // every 90 days (seasonal)

    // Healthcare Tax
    KINGDOM_DEFAULT_HEALTHCARE_TAX_RATE: 0.10,  // 10% default tax on healthcare revenue
    KINGDOM_HEALTHCARE_TAX_MIN: 0.0,
    KINGDOM_HEALTHCARE_TAX_MAX: 0.30,

    // Kingdom Financial Strategy Thresholds
    KINGDOM_FINANCIAL_STRATEGY_INTERVAL: 30,  // check every 30 days
    KINGDOM_MILD_THRESHOLD: 2000,             // Level 1 measures below this
    KINGDOM_MODERATE_THRESHOLD: 500,          // Level 2 measures below this
    KINGDOM_DESPERATE_DAYS: 15,               // Level 3 after this many bankrupt days
    KINGDOM_COLLAPSE_TRIGGER_DAYS: 60,        // economic collapse after 60 days bankrupt

    // King Proactive Economic Strategy
    KING_ECONOMY_STRATEGY_INTERVAL: 10,       // days between strategy reviews
    KING_LAND_SUBSIDY_DISCOUNT: 0.4,          // 40% discount on subsidized land
    KING_BOUNTY_DEFAULT_REWARD: 50,           // gold per bounty fulfillment
    KING_TRADE_SUBSIDY_PER_UNIT: 2,           // gold bonus per subsidized unit traded
    KING_TAX_HOLIDAY_DURATION: 180,           // days of tax exemption for new businesses
    KING_IMMIGRATION_BONUS: 50,               // gold per immigrating family
    KING_QUOTA_HAPPINESS_PENALTY: -5,         // happiness hit for missed quotas
    KING_FORCED_LABOR_HAPPINESS: -10,         // happiness hit for forced labor
    KING_MAX_STRATEGIES_PER_CYCLE: 5,         // max actions per 30-day review
    KING_SUBSIDY_DURATION: 180,               // days land/trade subsidies last
    KING_MAX_BOUNTIES: 5,                     // max active bounties per kingdom
    KING_MAX_TRADE_SUBSIDIES: 3,              // max active trade subsidies
    KING_MAX_EXPORT_RESTRICTIONS: 3,          // max goods that can be export-restricted
    KING_STOCKPILE_BUY_THRESHOLD: 0.7,        // buy when price < 70% of base
    KING_STOCKPILE_SELL_THRESHOLD: 1.5,        // sell when price > 150% of base
    KING_MIN_TREASURY_FOR_STRATEGY: 500,      // don't spend on strategy if treasury below this

    // Kingdom Festival/Event Costs
    KINGDOM_FESTIVAL_COST: 300,
    KINGDOM_FESTIVAL_HAPPINESS: 8,
    KINGDOM_PUBLIC_WORKS_COST: 200,
    KINGDOM_PUBLIC_WORKS_HAPPINESS: 3,
    KINGDOM_WELFARE_COST: 150,
    KINGDOM_WELFARE_HAPPINESS: 5,
    KINGDOM_GIFT_DIPLOMACY_COST: 500,
    KINGDOM_GIFT_DIPLOMACY_RELATION: 15,
    KINGDOM_MARRIAGE_DIPLOMACY_RELATION: 25,
    KINGDOM_TRIBUTE_DEMAND_THRESHOLD: 0.5,    // must be 50%+ stronger

    // Trade Embargoes
    EMBARGO_SMUGGLE_PREMIUM: 2.0,        // 2x price for smuggling embargoed goods
    EMBARGO_DETECTION_CHANCE: 0.35,
    EMBARGO_FINE_MULTIPLIER: 3,
    EMBARGO_REP_PENALTY: 20,

    // Migration Waves
    MIGRATION_PLAGUE_CHANCE: 0.015,       // per person per day during plague
    MIGRATION_WAR_CHANCE: 0.01,
    MIGRATION_HUNGER_CHANCE: 0.008,
    MIGRATION_LOW_HAPPINESS_CHANCE: 0.003,
    MIGRATION_WAVE_THRESHOLD: 5,          // log migration event when 5+ people flee at once

    // ── Town Happiness Consequence Thresholds ──
    // Consequences use SCALING percentages: chance = baseRate * ((threshold - happiness) / threshold)
    // So consequences are mild near the threshold and severe at extremes
    TOWN_HAPPINESS_THRIVING: 75,          // above = thriving (bonuses kick in)
    TOWN_HAPPINESS_CONTENT: 55,           // above = content (slight bonuses)
    TOWN_HAPPINESS_UNREST: 35,            // below = unrest (penalties scale up)
    TOWN_HAPPINESS_CRISIS: 18,            // below = crisis (severe penalties scale up)

    // Thriving bonuses (scale from threshold to 100)
    TOWN_THRIVING_IMMIGRATION_CHANCE: 0.008,  // max daily chance of attracting immigrant
    TOWN_THRIVING_BIRTH_MULT: 1.4,            // birth probability multiplier at max
    TOWN_THRIVING_PRODUCTIVITY_BONUS: 0.20,   // max +20% building output
    TOWN_THRIVING_CRIME_DECAY: 0.8,           // max crime decay per day

    // Content bonuses (55-75)
    TOWN_CONTENT_PRODUCTIVITY_BONUS: 0.08,    // max +8% building output
    TOWN_CONTENT_IMMIGRATION_CHANCE: 0.003,   // mild immigration pull

    // Unrest consequences (scale from threshold down to crisis)
    TOWN_UNREST_EMIGRATION_CHANCE: 0.005,     // max per-person daily emigration chance
    TOWN_UNREST_PRODUCTIVITY_PENALTY: 0.20,   // max -20% building output
    TOWN_UNREST_CRIME_GROWTH: 0.4,            // max crime increase per day
    TOWN_UNREST_PROTEST_CHANCE: 0.03,         // max daily chance of protest event
    TOWN_UNREST_STRIKE_CHANCE: 0.008,         // max daily chance a building stops for 7 days

    // Crisis consequences (scale from crisis threshold to 0)
    TOWN_CRISIS_EXODUS_CHANCE: 0.015,         // max per-person daily exodus chance
    TOWN_CRISIS_PRODUCTIVITY_PENALTY: 0.45,   // max -45% building output
    TOWN_CRISIS_CRIME_SPIKE: 1.2,             // max crime increase per day
    TOWN_CRISIS_RIOT_CHANCE: 0.04,            // max daily chance of riot (building damage)
    TOWN_CRISIS_BUILDING_ABANDON_CHANCE: 0.006, // max daily chance per building of shutdown
    TOWN_CRISIS_DISEASE_CHANCE: 0.003,        // max daily disease outbreak chance

    // ── Kingdom Happiness Consequence Thresholds ──
    KINGDOM_HAPPINESS_GOLDEN: 75,             // above = golden age
    KINGDOM_HAPPINESS_STABLE: 55,             // above = stable
    KINGDOM_HAPPINESS_DISCONTENT: 35,         // below = discontent
    KINGDOM_HAPPINESS_REBELLION: 18,          // below = rebellion risk

    // Golden age bonuses (scale from threshold to 100)
    KINGDOM_GOLDEN_DIPLOMACY_BONUS: 5,        // max +relations per season
    KINGDOM_GOLDEN_TAX_EFFICIENCY: 0.12,      // max +12% tax collection
    KINGDOM_GOLDEN_RECRUIT_CHANCE: 0.04,      // max daily volunteer soldier chance

    // Discontent consequences (scale from threshold to rebellion)
    KINGDOM_DISCONTENT_TAX_EVASION: 0.15,     // max -15% tax collection
    KINGDOM_DISCONTENT_DESERTION_RATE: 0.004, // max per-soldier daily desertion
    KINGDOM_DISCONTENT_REVOLT_CHANCE: 0.06,   // max monthly revolt chance
    KINGDOM_DISCONTENT_COUP_CHANCE: 0.04,     // max seasonal coup chance

    // Rebellion consequences (scale from rebellion threshold to 0)
    KINGDOM_REBELLION_TAX_EVASION: 0.45,      // max -45% tax collection
    KINGDOM_REBELLION_DESERTION_RATE: 0.015,  // max per-soldier daily desertion
    KINGDOM_REBELLION_COUP_CHANCE: 0.15,      // max seasonal coup chance
    KINGDOM_REBELLION_SECESSION_CHANCE: 0.03, // max per-town seasonal secession chance
    KINGDOM_REBELLION_COLLAPSE_CHANCE: 0.12,  // max seasonal collapse chance (if also bankrupt)

    // Kingdom happiness modifiers (applied when calculating kingdom happiness from town avg)
    KINGDOM_HAPPINESS_WAR_PENALTY: 3,         // per active war
    KINGDOM_HAPPINESS_BANKRUPT_PENALTY: 8,    // if kingdom is bankrupt
    KINGDOM_HAPPINESS_PEACE_BONUS: 4,         // if at peace for 360+ days
    KINGDOM_HAPPINESS_KIND_KING_BONUS: 3,     // kind/generous king
    KINGDOM_HAPPINESS_CRUEL_KING_PENALTY: 4,  // cruel/corrupt king
    KINGDOM_HAPPINESS_WEALTHY_BONUS: 2,       // treasury > 10000g

    // Expanded Jobs
    JOB_PAY_SCALE: { village: 0.5, town: 1.0, city: 1.3, capital_city: 1.5 },

    // NPC Business Management
    NPC_BUSINESS_EVAL_INTERVAL: 60,       // evaluate every 60 days
    NPC_BUSINESS_CLOSE_SALE_FACTOR: 0.7,  // sell at 70% of build cost
    NPC_BUSINESS_OPEN_PRICE_THRESHOLD: 2, // open if price > 2x base

    // Caravans
    CARAVAN_BASE_SPEED: 120,
    CARAVAN_ROAD_MULTIPLIER: [0, 1.0, 1.5, 2.0],
    BANDIT_ATTACK_CHANCE: 0.03,                 // legacy — kept for backward compat
    GUARD_EFFECTIVENESS: 0.2,                   // legacy
    CARAVAN_RECURRING_MAINTENANCE_PER_TRIP: 15,
    CARAVAN_FORTIFIED_WAGON_COST: 150,
    CARAVAN_DECOY_COST: 50,
    CARAVAN_ARMED_ESCORT_COST: 80,
    CARAVAN_BLOCKED_RESCUE_COST: 100,
    CARAVAN_MAX_BUY_BUDGET_PER_GOOD: 500,
    BACKGROUND_TRADE_RATE: 0.005,

    // Caravan crew & equipment
    CARAVAN_CARRIER_BASE_CAPACITY: 30,          // weight capacity per carrier
    CARAVAN_CARRIER_HIRE_COST: 20,              // one-time hire cost per carrier
    CARAVAN_CARRIER_WAGE: 4,                    // gold per day per carrier
    CARAVAN_SEA_CARRIER_WAGE: 2,                // gold per day per sea crew member (half land wage)
    CARAVAN_SEA_CARRIER_HIRE_COST: 10,          // one-time hire cost per sea crew member
    CARAVAN_GUARD_HIRE_COST: 30,                // one-time hire cost per guard
    CARAVAN_GUARD_WAGE: 6,                      // gold per day per guard
    CARAVAN_HORSE_SPEED_BONUS: 0.10,            // 10% speed per horse on caravan
    CARAVAN_HORSE_EXTRA_CAPACITY: 30,           // extra weight per horse
    CARAVAN_HORSES_PER_CARRIER: 4,              // road caravans: each carrier can walk 4 horses (0 weight)
    CARAVAN_HORSE_SEA_WEIGHT: 15,               // sea caravans: horses take up deck space (15 wt each)
    MARKET_HORSE_CAP: { village: 50, town: 100, city: 150, capital_city: 200 },
    CARAVAN_CART_CAPACITY: 80,                  // weight per cart
    CARAVAN_CART_COST: 30,                      // gold to buy a cart for the caravan
    CARAVAN_WAGON_CAPACITY: 200,                // weight per wagon
    CARAVAN_WAGON_COST: 120,                    // gold to buy a wagon for the caravan
    // Daily theft/kill chances (calibrated: worst=80%/50% yearly, best=2%/0.5% yearly)
    CARAVAN_BASE_DAILY_THEFT: 0.0012,
    CARAVAN_BASE_DAILY_KILL: 0.0005,
    CARAVAN_ROAD_UNSAFE_MULT: 2.0,
    CARAVAN_WAR_MULT: 1.5,
    CARAVAN_UNSAFE_CONN_MULT: 1.2,
    CARAVAN_PER_GUARD_MULT: 0.55,               // multiplicative per guard
    CARAVAN_PER_WEAPON_MULT: 0.85,              // per equipped weapon on guard
    CARAVAN_PER_ARMOR_MULT: 0.90,               // per equipped armor on guard
    CARAVAN_PER_CARRIER_RISK: 0.08,             // each extra carrier adds ~8% risk

    // Notoriety
    NOTORIETY_WEAPON_SALE: 5,
    NOTORIETY_ARMOR_SALE: 3,
    NOTORIETY_DECAY_PER_DAY: 0.1,
    NOTORIETY_DANGER_THRESHOLD: 50,
    ASSASSINATION_CHANCE_BASE: 0.001,

    // Naval / Sea travel
    SEA_ROUTE_MAX_DISTANCE: 3000,
    SEA_ROUTE_MIN_WATER_FRACTION: 0.95,    // Open-water portion must be >=95% water (coastal approach excluded)
    SEA_SPEED_MULTIPLIER: 1.5,
    STORM_RISK_PER_TRIP: 0.05,
    STORM_LOSS_MIN: 0.10,
    STORM_LOSS_MAX: 0.30,
    SEA_PASSAGE_COST: 50,
    KINGDOM_TRANSPORT: {
        baseCostPerTown: 50,     // Kingdom pays 50g/season per town for transport infrastructure
        defaultRate: 15,         // Default charge to travelers
        speedMultiplier: 1.7,    // 70% faster than walking
    },
    PORT_WATER_PROXIMITY: 3,
    SHIP_TYPES: {
        rowboat:       { name: 'Rowboat',           laborCost: 20,   capacity: 10,   speed: 0.8,  passengers: 2,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 0,  durabilityYears: 2, minCrew: 1, sizeCategory: 'small',
                         materials: { wood: 5, rope: 2 },                                                          icon: '🚣', description: 'A simple rowboat. Slow but cheap. Coastal travel only.' },
        fishing_boat:  { name: 'Fishing Boat',      laborCost: 40,   capacity: 25,   speed: 1.0,  passengers: 3,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 1,  durabilityYears: 3, minCrew: 2, sizeCategory: 'small', canFish: true,
                         materials: { wood: 10, rope: 4, iron: 1 },                                                icon: '🎣', description: 'A sturdy fishing vessel. Can catch fish while docked.' },
        sloop:         { name: 'Sloop',             laborCost: 80,   capacity: 40,   speed: 1.8,  passengers: 5,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 2,  durabilityYears: 3, minCrew: 3, sizeCategory: 'medium',
                         materials: { planks: 12, rope: 6, cloth: 4, iron: 2 },                                    icon: '⛵', description: 'Fast and nimble. Excellent for quick trade runs.' },
        cog:           { name: 'Trading Cog',       laborCost: 120,  capacity: 80,   speed: 1.3,  passengers: 8,  restBonus: 0.3, maxAddons: 1, cannons: 0, defense: 4,  durabilityYears: 4, minCrew: 4, sizeCategory: 'medium',
                         materials: { planks: 20, rope: 8, cloth: 6, iron: 4 },                                    icon: '🚢', description: 'The workhorse merchant vessel. Reliable and spacious.' },
        caravel:       { name: 'Caravel',           laborCost: 200,  capacity: 120,  speed: 1.6,  passengers: 12, restBonus: 0.4, maxAddons: 2, cannons: 0, defense: 5,  durabilityYears: 4, minCrew: 5, sizeCategory: 'medium',
                         materials: { planks: 30, rope: 12, cloth: 10, iron: 6 },                                  icon: '🚢', description: 'Versatile explorer vessel. Fast with good cargo space.' },
        brigantine:    { name: 'Brigantine',        laborCost: 250,  capacity: 100,  speed: 1.7,  passengers: 15, restBonus: 0.4, maxAddons: 2, cannons: 1, defense: 8,  durabilityYears: 4, minCrew: 5, sizeCategory: 'medium',
                         materials: { planks: 35, rope: 15, cloth: 12, iron: 8 },                                  icon: '⛵', description: 'Fast and armed. One cannon for defense. A smuggler\'s favorite.' },
        carrack:       { name: 'Carrack',           laborCost: 400,  capacity: 200,  speed: 1.2,  passengers: 20, restBonus: 0.5, maxAddons: 3, cannons: 2, defense: 12, durabilityYears: 5, minCrew: 8, sizeCategory: 'large',
                         materials: { planks: 50, rope: 18, cloth: 14, iron: 10 },                                 icon: '🚢', description: 'Heavy merchant ship. Two cannons and room for crew quarters.' },
        fluyt:         { name: 'Merchant Fluyt',    laborCost: 500,  capacity: 280,  speed: 1.1,  passengers: 25, restBonus: 0.5, maxAddons: 3, cannons: 1, defense: 8,  durabilityYears: 5, minCrew: 6, sizeCategory: 'large',
                         materials: { planks: 60, rope: 20, cloth: 16, iron: 12 },                                 icon: '🚢', description: 'Maximum cargo efficiency. The merchant\'s dream ship.' },
        galleon:       { name: 'Merchant Galleon',  laborCost: 800,  capacity: 350,  speed: 1.0,  passengers: 30, restBonus: 0.6, maxAddons: 4, cannons: 4, defense: 18, durabilityYears: 6, minCrew: 10, sizeCategory: 'large',
                         materials: { planks: 80, rope: 25, cloth: 20, iron: 15 },                                 icon: '🚢', description: 'Massive trader. Four cannons, crew quarters, workshop potential.' },
        man_o_war:     { name: 'Man-o\'-War',      laborCost: 1500, capacity: 250,  speed: 0.9,  passengers: 40, restBonus: 0.7, maxAddons: 5, cannons: 8, defense: 30, durabilityYears: 7, minCrew: 15, sizeCategory: 'massive',
                         materials: { planks: 120, rope: 40, cloth: 30, iron: 30 },                                icon: '⚓', description: 'A floating fortress. Eight cannons, supreme defense. The ultimate vessel.' },
    },

    // Ship addons — installed on ships with available addon slots
    SHIP_ADDONS: {
        cabin:          { name: 'Captain\'s Cabin',    materials: { planks: 5, cloth: 3 },           effect: 'restBonus', value: 0.2, description: 'Private quarters. Improves rest quality aboard.' },
        cargo_hold:     { name: 'Extended Hold',       materials: { planks: 8, iron: 3 },            effect: 'capacity',  value: 0.30, description: '+30% cargo capacity.' },
        armory:         { name: 'Ship Armory',         materials: { iron: 8, wood: 5 },              effect: 'defense',   value: 3,   description: '+3 defense. Crew fights more effectively.' },
        medical_bay:    { name: 'Medical Bay',         materials: { cloth: 5, wood: 3 },             effect: 'medical',   value: 0.50, description: 'Treat injuries at sea. -50% illness risk.' },
        navigation:     { name: 'Navigation Room',    materials: { iron: 2, cloth: 2 },             effect: 'speed',     value: 0.10, description: '+10% speed, -30% storm risk.' },
        smuggling_hold: { name: 'Hidden Compartment',  materials: { planks: 6, iron: 4 },            effect: 'smuggle',   value: 0.50, description: '-50% smuggling detection at sea.' },
        fishing_nets:   { name: 'Fishing Nets',        materials: { rope: 8, cloth: 4 },             effect: 'fishing',   value: 2,   description: 'Catch fish while traveling (2/day).' },
    },

    // Ship docking fees (monthly, per ship) — scaled by town prosperity
    DOCKING_FEE_BASE: { small: 10, medium: 30, large: 60, massive: 100 },
    DOCKING_FEE_INTERVAL: 30,           // days between fee charges
    DOCKING_FEE_UNPAID_GRACE: 30,       // days before unpaid ship is seized
    MAX_SHIPS_PER_PORT: 5,              // max player ships docked at one port

    // Ship rental for caravans (daily cost multiplier over amortized build cost)
    SHIP_RENTAL_MARKUP: 1.5,            // 50% markup over base amortized daily cost

    // Win conditions
    WIN_GOLD: 100000,
    WIN_MONOPOLY_PERCENT: 0.75,
    WIN_MONOPOLY_RESOURCES: 3,
    WIN_REPUTATION_KINGDOMS: 3,
    WIN_REPUTATION_VALUE: 90,
    WIN_SUPPLY_CHAIN_TYPES: 3,

    // Visual
    KINGDOM_COLORS: ['#c44e52', '#4c72b0', '#55a868', '#ccb974', '#8172b2'],

    // Social Ranks
    SOCIAL_RANKS: [
        { id: 'peasant', name: 'Peasant', index: 0, icon: '🌾',
          maxWorkers: 1, maxBuildings: 0, maxLand: 0,
          goldReq: 0, repReq: 0, extraReq: null,
          taxDiscount: 0,
          abilities: ['work_jobs', 'forage', 'basic_trading'],
          description: 'A common laborer. Cannot own buildings or petition.' },
        { id: 'citizen', name: 'Citizen', index: 1, icon: '🏠',
          maxWorkers: 4, maxBuildings: 2, maxLand: 3,
          goldReq: 1000, repReq: 40, extraReq: 'Lived 90+ days, no criminal record',
          fee: 500, residencyDays: 90,
          taxDiscount: 0.05,
          abilities: ['own_basic_buildings', 'petition', 'trade_licenses', 'vote_town'],
          description: 'A recognized citizen. Can own farms and workshops, petition the king, and get trade licenses.' },
        { id: 'burgher', name: 'Burgher', index: 2, icon: '⚖️',
          maxWorkers: 15, maxBuildings: 8, maxLand: 6,
          goldReq: 5000, repReq: 55, extraReq: '90 days trading, 1+ building, 50+ trades',
          fee: 1000, minTrades: 50, minBuildings: 1, tradingDays: 90,
          taxDiscount: 0.05,
          abilities: ['own_processing_buildings', 'buy_luxury', 'hire_caravan_guards', 'supply_chains'],
          description: 'An established merchant. Can own processing buildings, buy luxury goods, and run supply chains.' },
        { id: 'guildmaster', name: 'Guildmaster', index: 3, icon: '🔨',
          maxWorkers: 40, maxBuildings: 25, maxLand: 15,
          goldReq: 20000, repReq: 70, extraReq: '3 production buildings, 8+ workers, buildings in 2+ towns, 180 days trading, 250+ goods moved by caravan',
          fee: 5000, minProductionBuildings: 3, minWorkers: 8, minTownsWithBuildings: 2, tradingDays: 180, minCaravanGoodsMoved: 250,
          taxDiscount: 0.05,
          productionBonus: 0.10,
          abilities: ['build_toll_roads', 'trade_weapons', 'hire_petitioners', 'production_bonus'],
          description: 'Master of commerce. Can build toll roads, trade weapons, and hire petitioners. +10% production output.' },
        { id: 'minor_noble', name: 'Minor Noble', index: 4, icon: '👑',
          maxWorkers: 80, maxBuildings: 50, maxLand: 30,
          goldReq: 50000, repReq: 80, extraReq: 'Marry a Minor Noble (waives petitions & endorsements) OR 3 petitions + 5 noble endorsements, property in 3+ towns',
          fee: 15000, minPetitionsCompleted: 3, minEndorsements: 5, minEndorsementLevel: 60, minTownsWithProperty: 3,
          taxDiscount: 0.10,
          signatureBonus: 0.15,
          abilities: ['influence_king', 'production_permits', 'attend_court', 'noble_marriage', 'signature_bonus'],
          description: 'Entered the aristocracy. Can influence the king directly, get production permits, and attend court. +15% signature success.' },
        { id: 'lord', name: 'Lord', index: 5, icon: '🏰',
          maxWorkers: 200, maxBuildings: 9999, maxLand: 9999,
          goldReq: 100000, repReq: 90, extraReq: 'Property in 4+ towns, 40+ workers, 2+ infrastructure projects, 2+ years as Minor Noble',
          fee: 50000, minTownsWithProperty: 4, minTotalWorkers: 40, minInfrastructure: 2, minYearsAtPrevRank: 2,
          taxDiscount: 0.10, lordTaxFree: true,
          abilities: ['build_anywhere', 'revitalize_towns', 'raise_militia', 'local_trade_policies', 'crime_immunity'],
          description: 'Landed elite. Can build freely, revitalize towns, and raise private militia. Tax-free in your lord town. Near-immune to petty crime accusations.' },
        { id: 'royal_advisor', name: 'Royal Advisor', index: 6, icon: '📜',
          maxWorkers: 9999, maxBuildings: 9999, maxLand: 9999,
          goldReq: 200000, repReq: 99, extraReq: 'Lord 3+ years, war supply, 5+ petitions, 3+ noble friends',
          fee: 100000, minYearsAtPrevRank: 3, minPetitionsCompleted: 5, minNobleFriends: 3, minNobleFriendLevel: 80,
          taxDiscount: 1.0, taxExempt: true,
          petitionBonus: 0.25,
          abilities: ['propose_laws', 'declare_emergencies', 'override_officials', 'petition_bonus', 'king_consults'],
          description: 'The king\'s right hand. Can propose laws, petition success +25%. Exempt from all kingdom taxes. The king consults you on decisions.' },
        { id: 'king', name: 'King', index: 7, icon: '👑',
          maxWorkers: 9999, maxBuildings: 9999, maxLand: 9999,
          goldReq: 0, repReq: 0, extraReq: 'Only assigned by succession — not achievable through promotion',
          fee: 0, taxDiscount: 1.0,
          abilities: ['all'],
          description: 'The sovereign ruler of a kingdom. Commands all subjects and sets the laws of the land.' },
    ],

    // Citizenship
    CITIZENSHIP_FEE_MULTIPLIER: 500,
    CITIZENSHIP_MIN_REPUTATION: 40,
    CITIZEN_TAX_DISCOUNT: 0.10,
    FOREIGN_TAX_SURCHARGE: 0.10,
    MARKET_SPREAD: 0.20, // 20% spread — sell price is 20% less than buy price in same town (medieval realism)
    EXILE_REPUTATION_THRESHOLD: -20,

    // Kingdom Laws
    MAX_BANNED_GOODS: 2,
    TRADE_TARIFF_MIN: 0,
    TRADE_TARIFF_MAX: 0.15,
    SMUGGLING_BASE_DETECTION: 0.30,
    SMUGGLING_RANK_REDUCTION: 0.05,
    SMUGGLING_GUARD_RELATION_REDUCTION: 0.10,
    SMUGGLING_SKILL_REDUCTION: 0.01,
    SMUGGLING_SKILL_MAX_REDUCTION: 0.20,
    SMUGGLING_BLACK_MARKET_PREMIUM: 1.5,
    SMUGGLING_FINE_MULTIPLIER: 2,
    SMUGGLING_REP_PENALTY: 1,
    SMUGGLING_REP_PENALTY_WAR_GOODS: 5,
    SMUGGLING_JAIL_DAYS_MIN: 3,
    SMUGGLING_JAIL_DAYS_MAX: 7,
    CONSCRIPTION_CHANCE: 0.10,

    // Conscription System
    CONSCRIPTION_CONFIG: {
        minRate: 0.02,               // King conscripts at least 2% of males
        maxRate: 0.20,               // Up to 20% of males
        serviceDays: 360,            // 1 year mandatory service
        exemptionFee: 5000,          // Gold to buy out of conscription (rank 4+)
        exemptionMinRank: 4,         // Minor Noble (index 4) can pay exemption
        dodgeCaughtBaseChance: 0.40, // 40% base chance of getting caught if dodging
        dodgeOutOfKingdomMod: 0.15,  // Reduced to 15% if not in the kingdom
        dodgeStealthSkillMod: 0.10,  // Stealth/smuggling skill reduces by up to 10%
        dodgeJailDays: 720,          // 2 year jail sentence if caught dodging
        checkInterval: 30,           // Check for conscription events every 30 days
        announcementDuration: 7,     // Player has 7 days to respond after announcement
    },

    // Goods-Specific Taxes
    GOODS_TAX_MIN: 0.05,
    GOODS_TAX_MAX: 0.25,
    GOODS_TAX_COUNT_MIN: 1,
    GOODS_TAX_COUNT_MAX: 3,

    // Restricted Goods / License System
    RESTRICTED_GOODS_COUNT_MIN: 1,
    RESTRICTED_GOODS_COUNT_MAX: 3,
    LICENSE_FEE: 500,              // Base fee for non-war goods
    LICENSE_FEE_WAR: 1000,         // Base fee for war-related goods (swords, armor, blasting_powder, demolition_tools)
    LICENSE_DURATION: 360,         // License expires after ~1 year (360 days)
    LICENSE_FEE_MIN: 300,          // Minimum a king can set license fees
    LICENSE_FEE_MAX: 3000,         // Maximum a king can set license fees
    LICENSE_FEE_WAR_MIN: 500,      // Minimum for war goods
    LICENSE_FEE_WAR_MAX: 5000,     // Maximum for war goods
    WAR_GOODS: ['swords', 'armor', 'blasting_powder', 'demolition_tools'],
    LICENSE_MIN_REPUTATION: 40,
    LICENSE_MIN_RANK: 1,           // Freeman (index 1)
    LICENSE_WEAPON_MIN_RANK: 3,    // Guildmaster (index 3) for weapons
    LICENSE_REVOKE_CHANCE_ON_SMUGGLE: 0.50,
    PRODUCTION_PERMIT_FEE: 2000,           // Cost for permit to produce banned goods
    PRODUCTION_PERMIT_MIN_REPUTATION: 70,  // High reputation required
    PRODUCTION_PERMIT_MIN_RANK: 4,         // Magnate (index 4) for production permits

    // Alliance System
    ALLIANCE_BREAK_THRESHOLD: 40,          // Alliance breaks if relations drop below this
    ALLIANCE_WAR_JOIN_DELAY: 30,           // Days delay before ally joins war

    // Bridges & Off-Road Travel
    BRIDGE_MAX_WATER_TILES: 8,             // Max water tiles a road can cross to have a bridge
    ROAD_MAX_WATER_FRACTION: 0.30,         // Roads with >30% water tiles are rejected (no road possible)
    OFFROAD_SPEED_MULTIPLIER: 0.25,        // Off-road travel is 1/4 road speed
    OFFSEA_SPEED_MULTIPLIER: 0.5,          // Off-sea travel is 1/2 sea route speed
    OFFSEA_PIRATE_MODIFIER: 1.10,          // +10% pirate risk vs route average
    OFFSEA_LANDING_DAMAGE_MIN: 10,         // Min hull damage on failed landing
    OFFSEA_LANDING_DAMAGE_MAX: 30,         // Max hull damage on failed landing
    OFFSEA_DEATH_BASE_CHANCE: 0.60,        // 60% death on shipwreck
    OFFSEA_DEATH_MIN_CHANCE: 0.15,         // Can't go below 15%
    OFFSEA_SHIPWRECK_GOLD_LOSS: 0.90,      // Lose 90% of gold
    OFFSEA_SHIPWRECK_ITEM_KEEP: 3,         // Keep up to 3 random items
    OFFSEA_SHIPWRECK_ILLNESS_DAYS_MIN: 14, // Min illness duration
    OFFSEA_SHIPWRECK_ILLNESS_DAYS_MAX: 30, // Max illness duration
    OFFSEA_LANDING_RISKS: {                // Risk by terrain type when landing
        0: 0.00,   // GRASS — safe
        5: 0.00,   // SAND — safe
        1: 0.10,   // FOREST — 10% risk
        4: 0.30,   // HILLS — 30% risk
        3: 0.60,   // MOUNTAIN — 60% risk
    },
    BRIDGE_DESTROY_COST: 500,              // Gold cost for player to destroy a bridge
    BRIDGE_REBUILD_COST: 1000,             // Gold cost to rebuild a destroyed bridge
    BRIDGE_REBUILD_DAYS: 30,               // Days to rebuild a bridge
    BRIDGE_REPAIR_MATERIALS: { wood: 20, stone: 10 }, // Materials needed per bridge repair
    BRIDGE_ARMY_DESTROYED_SPEED_MULT: 0.3, // Armies cross destroyed bridges at 30% speed

    // Bridge Destruction Methods
    BRIDGE_DESTROY_METHODS: {
        manual: {
            name: 'Manual Labor',
            icon: '🪢',
            description: 'Dismantle the bridge with rope and iron tools. Slow but no special materials needed.',
            requires: { rope: 5, iron: 3 },
            baseDays: 7,
            skilledDays: 3,
            detectionPerDay: 0.10,
            skilledDetectionPerDay: 0.02,
        },
        blasting: {
            name: 'Blasting Powder',
            icon: '💥',
            description: 'Blow the bridge with explosives. Fast but extremely loud — higher chance of being caught.',
            requires: { blasting_powder: 3 },
            baseDays: 4,
            skilledDays: 2,
            detectionPerDay: 0.15,
            skilledDetectionPerDay: 0.05,
        },
        demolition: {
            name: 'Demolition Tools',
            icon: '⛏️',
            description: 'Precision demolition with specialized tools. Balanced speed and stealth.',
            requires: { demolition_tools: 1 },
            baseDays: 5,
            skilledDays: 2,
            detectionPerDay: 0.07,
            skilledDetectionPerDay: 0.015,
        },
    },
    BRIDGE_DESTROY_SKILLS: ['arsonist_skill', 'shadow_dealings', 'discrete'],
    BRIDGE_DESTROY_CAUGHT_FINE: 2000,
    BRIDGE_DESTROY_CAUGHT_JAIL_DAYS: 30,
    BRIDGE_DESTROY_CAUGHT_REP_PENALTY: -30,

    // Route Limits (max total routes per settlement tier)
    MAX_ROUTES_VILLAGE: 4,
    MAX_ROUTES_TOWN: 6,
    MAX_ROUTES_CITY: 8,
    MAX_ROUTES_CAPITAL: 10,
    MAX_ROUTES_PORT_BONUS: 2,              // Ports get +2 to their tier limit

    // A* Pathfinding
    PATHFIND_MAX_NODES: 50000,             // Max nodes explored before giving up
    PATHFIND_STEP: 2,                      // Tile step size for A* (reduces search space)

    // Toll Routes
    TOLL_ROAD_BASE_COST: 5000,             // Base gold cost for player to build a toll road
    TOLL_ROAD_DIST_COST: 10,               // Gold per unit distance
    TOLL_ROAD_WATER_MULTIPLIER: 3,         // Cost multiplier for water crossings
    TOLL_ROAD_MAX_WATER_FRACTION: 0.15,    // Can't build if >15% water
    TOLL_ROAD_TIMBER_PER_100: 5,           // Timber per 100 distance
    TOLL_ROAD_STONE_PER_100: 3,            // Stone per 100 distance
    TOLL_ROAD_IRON_PER_100: 1,             // Iron per 100 distance
    TOLL_SEA_BASE_COST: 15000,             // Base gold for sea route
    TOLL_SEA_DOCK_COST: 5000,              // Cost per dock (need 2)
    TOLL_SEA_SHIP_REQUIRED: true,          // Must own at least 1 ship
    TOLL_SEA_TIMBER_NEEDED: 50,            // Timber for docks
    TOLL_SEA_STONE_NEEDED: 30,             // Stone for docks
    TOLL_SEA_IRON_NEEDED: 15,              // Iron for docks/anchors
    TOLL_DEFAULT_RATE: 5,                  // Default toll rate in gold per use
    TOLL_MAX_RATE: 50,                     // Max toll rate
    TOLL_MIN_RATE: 1,                      // Min toll rate
    TOLL_COLLECTION_INTERVAL: 1,           // Days between toll collection
    TRANSFER_WORKER_DELIVERY_DAYS: 1,      // Days workers spend delivering goods (no production)
    TRANSFER_STORAGE_THRESHOLD: 1,         // Transfer after any production (daily)
    KING_INFLUENCE_COST_FRACTION: 0.10,    // Player pays 10% of road cost
    KING_INFLUENCE_MIN_REP: 70,            // Min kingdom reputation needed
    KING_INFLUENCE_MIN_RANK: 4,            // Min social rank index (Minor Noble)
    KING_INFLUENCE_BASE_CHANCE: 0.40,      // Base chance king agrees
    ELITE_MERCHANT_ROUTE_BUILD_CHANCE: 0.001, // Daily chance elite merchant builds toll route

    // ── Petition System ──
    PETITION_MIN_RANK: 0,              // Peasant can petition (citizen required though)
    PETITION_MAX_DURATION_DAYS: 30,     // Auto-submit after 30 days
    PETITION_MIN_SIGNATURES_PCT: 5,     // Need 5% of kingdom pop to even have a chance
    PETITION_GOOD_CHANCE_PCT: 15,       // 15% gives good chance
    PETITION_GREAT_CHANCE_PCT: 25,      // 25%+ gives great chance
    PETITION_BASE_CHANCE: 0.05,         // Base 5% chance — signatures are essential
    PETITION_PER_PCT_BONUS: 0.035,     // +3.5% chance per 1% of population signed
    PETITION_ELITE_SIGNATURE_WEIGHT: 5, // Elite merchant signature = 5 normal
    PETITION_NOBLE_SIGNATURE_WEIGHT: 10,// Noble signature = 10 normal
    PETITION_MAX_ACTIVE: 3,            // Max 3 active petitions at once
    PETITION_COOLDOWN_DAYS: 30,        // 30 days between petitions of same type
    PETITIONER_BASIC_COST: 50,         // 50g/day for basic petitioner (on foot)
    PETITIONER_MOUNTED_COST: 100,      // 100g/day for mounted petitioner (horse)
    PETITIONER_BASE_SIGN_CHANCE: 0.20, // 20% base chance petitioner gets NPC to sign
    PETITIONER_RELATIONSHIP_BONUS: 0.003, // Per point of player relationship
    PETITIONER_TOWN_REP_BONUS: 0.005,  // Per point of town reputation
    PETITIONER_KINGDOM_REP_BONUS: 0.003, // Per point of kingdom reputation
    PETITION_PLAYER_SIGN_CHANCE_BASE: 0.30, // 30% base when player asks directly
    PETITION_PLAYER_REL_BONUS: 0.006,  // Per point of relationship (player asking)
    PETITION_PLAYER_TOWN_REP_BONUS: 0.008, // Per point town rep (player asking)
    PETITION_PLAYER_KINGDOM_REP_BONUS: 0.005, // Per point kingdom rep (player asking)

    // Town Security
    SECURITY_GUARD_WEIGHT: 300,
    SECURITY_PROSPERITY_WEIGHT: 0.3,
    SECURITY_WALLS_BONUS: 15,

    // Enforcement / Detection
    ENFORCEMENT_BASE_DETECTION: 0.30,
    ENFORCEMENT_SECURITY_DIVISOR: 50,
    ENFORCEMENT_RANK_REDUCTION: 0.03,
    ENFORCEMENT_SMUGGLING_SKILL_REDUCTION: 0.01,
    ENFORCEMENT_GUARD_RELATION_REDUCTION: 0.002,
    ENFORCEMENT_MIN_DETECTION: 0.02,
    ENFORCEMENT_MAX_DETECTION: 0.95,

    // Escalating Penalties
    PENALTY_FINE_MULTIPLIERS: [1, 2, 3, 5, 5],
    PENALTY_REP_LOSSES: [0, 10, 20, 30, 30],
    PENALTY_CONFISCATE_AT: 3,      // 3rd offense: confiscate goods
    PENALTY_JAIL_AT: 4,            // 4th offense: jail time
    PENALTY_JAIL_DAYS_MIN: 3,
    PENALTY_JAIL_DAYS_MAX: 7,

    // Foreign Nobility
    FOREIGN_NOBLE_JAIL_FINE_PER_DAY: 50,    // 50g per jail day as fine instead
    FOREIGN_NOBLE_EXECUTION_FINE: 10000,     // 10000g instead of execution

    // Building Security
    BUILDING_GUARD_COST_PER_SEASON: 10,
    BUILDING_LOCKED_STORAGE_COST: 50,
    BUILDING_THEFT_CHANCE: 0.05,
    BUILDING_THEFT_CHANCE_GUARDED: 0.005,
    BUILDING_LOCKED_STORAGE_REDUCTION: 0.50,
    BUILDING_WAR_RAID_CHANCE: 0.10,
    BUILDING_RAID_DISABLE_DAYS_MIN: 5,
    BUILDING_RAID_DISABLE_DAYS_MAX: 15,

    // Bandit Hotspots
    BANDIT_WAR_ZONE_BONUS: 20,
    BANDIT_LOW_SECURITY_BONUS: 15,
    BANDIT_REMOTE_BONUS: 10,
    BANDIT_PATROL_REDUCTION: 5,
    BANDIT_HIGH_SECURITY_REDUCTION: 10,
    BANDIT_ATTACK_CHANCE_FACTOR: 0.005,
    BANDIT_THREAT_DANGER_THRESHOLD: 50,

    // Protection Racket
    PROTECTION_RACKET_NOTORIETY_THRESHOLD: 30,
    PROTECTION_RACKET_GOLD_THRESHOLD: 10000,
    PROTECTION_RACKET_FEE: 100,
    PROTECTION_RACKET_REP_PENALTY: 2,
    PROTECTION_RACKET_ATTACK_BONUS: 0.15,
    PROTECTION_RACKET_THEFT_BONUS: 0.03,
    PROTECTION_RACKET_INTIMIDATE_CHANCE: 0.50,
    PROTECTION_RACKET_CHECK_INTERVAL: 30,

    // Kingdom Tax Spending
    KINGDOM_GUARD_HIRE_THRESHOLD: 3000,
    KINGDOM_GUARD_COST: 100,

    // Relationships
    RELATIONSHIP_TRADE_GAIN: 1,
    RELATIONSHIP_EMPLOY_GAIN: 2,
    RELATIONSHIP_GIFT_MIN_GAIN: 5,
    RELATIONSHIP_GIFT_MAX_GAIN: 15,
    RELATIONSHIP_TOWN_GAIN: 0.5,
    RELATIONSHIP_DECAY: 0.2,
    RELATIONSHIP_TRADE_DISCOUNT_PER_10: 0.01,
    RELATIONSHIP_LEVELS: [
        { min: 0,  max: 20,  name: 'Acquaintance',  icon: '🤝' },
        { min: 20, max: 40,  name: 'Friendly',      icon: '😊' },
        { min: 40, max: 60,  name: 'Friend',         icon: '🤗' },
        { min: 60, max: 80,  name: 'Close Friend',   icon: '💛' },
        { min: 80, max: 100, name: 'Trusted/Beloved', icon: '❤️' },
    ],

    // Courtship & Marriage
    COURTSHIP_MIN_RELATIONSHIP: 60,
    COURTSHIP_NOBLE_MIN_RELATIONSHIP: 80,
    WEDDING_COST_BASE: 50,
    WEDDING_COST_PER_RANK: 100,
    SPOUSE_DAILY_INCOME_MIN: 5,
    SPOUSE_DAILY_INCOME_MAX: 20,

    // Wedding Planning
    WEDDING_PLANNING_DAYS: 5,            // Days between proposal and wedding
    WEDDING_VENUES: [
        { id: 'town_square', name: 'Town Square',     icon: '🏘️', cost: 0,    repBonus: 0,  relBonus: 5,   description: 'A humble ceremony in the town square. Free but modest.' },
        { id: 'church',      name: 'Church / Temple',  icon: '⛪', cost: 100,  repBonus: 3,  relBonus: 10,  description: 'A blessed ceremony. Earns kingdom reputation.' },
        { id: 'manor_hall',  name: 'Manor Hall',       icon: '🏰', cost: 500,  repBonus: 5,  relBonus: 15,  description: 'A prestigious venue. Requires rank of Established Trader or higher.', minRank: 2 },
        { id: 'countryside', name: 'Countryside',      icon: '🌿', cost: 25,   repBonus: 0,  relBonus: 20,  description: 'A romantic private ceremony among the wildflowers.' },
    ],
    WEDDING_FEASTS: [
        { id: 'simple',   name: 'Simple Meal',      icon: '🍞', cost: 20,   guests: 5,   relBonus: 3,  loyaltyBonus: 0,  description: 'Bread, cheese, and ale. Humble but heartfelt.' },
        { id: 'moderate', name: 'Moderate Banquet',  icon: '🍖', cost: 150,  guests: 20,  relBonus: 8,  loyaltyBonus: 5,  description: 'Roasted meats, wine, and pastries. A proper celebration.' },
        { id: 'grand',    name: 'Grand Feast',       icon: '👑', cost: 500,  guests: 50,  relBonus: 15, loyaltyBonus: 10, description: 'A lavish banquet with imported delicacies. The whole town talks about it.' },
    ],
    WEDDING_VOWS: [
        { id: 'practical',  name: 'Practical Vows',   icon: '🤝', loyaltyBonus: 10, relBonus: 5,  traitBonus: 'frugality',   description: '"I vow to build a prosperous life together, through wise decisions and shared labor."' },
        { id: 'romantic',   name: 'Romantic Vows',     icon: '💕', loyaltyBonus: 5,  relBonus: 15, traitBonus: 'warmth',      description: '"My heart is yours — in every sunrise and every storm, I choose you."' },
        { id: 'ambitious',  name: 'Ambitious Vows',    icon: '⚔️', loyaltyBonus: 3,  relBonus: 8,  traitBonus: 'ambition',    description: '"Together we will rise above our station, claim fortune, and leave a legacy."' },
    ],

    // Spouse AI System
    SPOUSE_AI: {
        TICK_INTERVAL: 1,                  // Days between AI ticks
        HEALTH_MAX: 100,
        SICKNESS_DAILY_CHANCE: 0.003,      // 0.3% daily base sickness chance
        INJURY_DAILY_CHANCE: 0.001,        // 0.1% daily injury chance (activities may increase)
        RECOVERY_RATE_HOME: 5,             // Health/day recovering at home
        RECOVERY_RATE_INN: 3,              // Health/day at inn
        RECOVERY_RATE_OUTSIDE: 1,          // Health/day sleeping rough
        SICK_MIN_DAYS: 3,                  // Minimum days sick
        SICK_MAX_DAYS: 14,                 // Maximum days sick
        SEVERE_ILLNESS_CHANCE: 0.08,       // 8% chance sickness becomes severe
        SEVERE_ILLNESS_DEATH_DAILY: 0.02,  // 2% daily death chance if gravely ill
        TRADE_MIN_INTELLIGENCE: 40,        // Min intelligence to attempt trading
        MANAGE_MIN_INTELLIGENCE: 30,       // Min intelligence to manage buildings
        JOB_PAY_MIN: 5,                    // Min gold from spouse working
        JOB_PAY_MAX: 25,                   // Max gold from spouse working
        TRADE_PROFIT_MIN: -10,             // Min trade profit (can lose money)
        TRADE_PROFIT_MAX: 35,              // Max trade profit
        MANAGE_BONUS: 0.15,               // 15% productivity bonus to managed building
        REQUEST_BASE_ACCEPT: 50,           // Base % chance to accept player request
        LOYALTY_ACCEPT_WEIGHT: 0.3,        // How much loyalty affects acceptance
        RELATIONSHIP_ACCEPT_WEIGHT: 0.5,   // How much relationship affects acceptance
        WARMTH_ACCEPT_WEIGHT: 0.2,         // How much warmth affects acceptance
        AGE_SICKNESS_THRESHOLD: 45,        // Age at which sickness chance increases
        AGE_SICKNESS_MULTIPLIER: 0.0002,   // Extra sickness chance per year over threshold
    },

    // Spouse Conversation System
    SPOUSE_CONVERSATIONS: {
        askDay: [
            { mood: 'happy',   lines: [
                'It was a good day! I visited the market and found some interesting goods.',
                'I had a lovely walk through town. The flowers near the square are blooming.',
                'I helped a neighbor with their garden. It felt good to be useful.',
                'I spent the morning reading and the afternoon cooking. A peaceful day.',
            ]},
            { mood: 'neutral', lines: [
                'Just an ordinary day, really. Nothing much happened.',
                'I tidied up the house and ran some errands. The usual.',
                'I spoke with some of the townspeople. The gossip never changes much.',
            ]},
            { mood: 'worried', lines: [
                'I am worried about the prices at market. Everything seems more expensive.',
                'I heard rumors of bandits on the roads. Please be careful when you travel.',
                'Some of the neighbors are talking about leaving town. Times feel uncertain.',
                'The guards seem more on edge lately. I hope nothing bad is coming.',
            ]},
            { mood: 'sad',     lines: [
                'I missed you today. The house feels empty when you are away.',
                'I have not been feeling well. Maybe I need some rest.',
                'I heard about a family losing their home. It made me think about how fragile things are.',
            ]},
        ],
        discussPlans: {
            saving: [
                'Maybe we should save more before your next big venture.',
                'I think we have enough gold to be comfortable for now. But a little more would not hurt.',
                'Have you thought about putting some gold aside for the children?',
            ],
            trading: [
                'I have heard good things about the market in {nearbyTown}. Might be worth a visit.',
                'Some merchants were talking about a shortage of {scarceGood} nearby. Could be profitable.',
                'Perhaps we should focus on one trade route and master it, rather than spreading thin.',
            ],
            building: [
                'Another building? Make sure we can afford the workers first.',
                'I think expanding our business is wise — but only if we have the gold for it.',
                'Have you considered what the town actually needs? That is where the real profit is.',
            ],
            war: [
                'With the war going on, maybe we should stock up on essentials.',
                'I worry about you getting caught up in the fighting. Please stay safe.',
                'War means opportunity for merchants, but also great risk. Be careful.',
            ],
        },
        shareMemory: {
            wedding:  'Do you remember our wedding day? {venueMemory} It feels like yesterday.',
            child:    'I was thinking about when {childName} was born. What a day that was.',
            trade:    'Remember that time you made {profit}g in a single trade? I could not believe it.',
            travel:   'I still think about our journey to {townName}. The road was long but the sights were beautiful.',
            early:    'Remember when we first met? You were just a struggling merchant with big dreams.',
            hardship: 'We have been through hard times, but we always pulled through together.',
        },
    },

    // Inheritance
    HEIR_REPUTATION_MULTIPLIER: 0.7,
    HEIR_FAMILY_RELATIONSHIP_START: 80,
    SIBLING_TRADE_BONUS: 0.10,

    // Town Founding
    TOWN_FOUNDING_MIN_TREASURY: 2000,
    TOWN_FOUNDING_MIN_POP: 500,
    TOWN_FOUNDING_COST: 1500,
    TOWN_FOUNDING_COOLDOWN: 180,
    TOWN_FOUNDING_STARTING_POP: 30,
    MAX_TOWNS_PER_KINGDOM: 8,

    // Town Categories
    TOWN_CATEGORIES: {
        outpost:      { label: 'Outpost',      minPop: 0,   maxBuildingSlots: 10, guardMultiplier: 0.0, relationshipGainMod: 3.0, icon: '⛺' },
        village:      { label: 'Village',      minPop: 0,   maxBuildingSlots: 6,  guardMultiplier: 0.5, relationshipGainMod: 2.0, icon: '🏘️' },
        town:         { label: 'Town',         minPop: 60,  maxBuildingSlots: 14, guardMultiplier: 1.0, relationshipGainMod: 1.0, icon: '🏠' },
        city:         { label: 'City',         minPop: 150, maxBuildingSlots: 24, guardMultiplier: 1.5, relationshipGainMod: 0.5, icon: '🏙️' },
        capital_city: { label: 'Capital City', minPop: 300, maxBuildingSlots: 35, guardMultiplier: 2.0, relationshipGainMod: 0.3, icon: '👑' },
    },
    TOWN_CATEGORY_CHECK_INTERVAL: 30,
    TOWN_CATEGORY_UPGRADE_HOLD_DAYS: 30,

    // Per-town population caps by category
    TOWN_POP_CAP: {
        village: 80,
        town: 250,
        city: 600,
        capital_city: 1200,
        island: 150,
    },

    // Wilderness Outpost System
    OUTPOST_CONFIG: {
        foundingCost: 800,              // gold to establish an outpost
        foundingMaterials: { wood: 30, stone: 10, planks: 10 },  // materials needed
        dailyMaintenanceCost: 10,       // gold per day (no shared infrastructure)
        theftChancePerDay: 0.06,        // 6% daily chance of theft without security
        damageChancePerDay: 0.03,       // 3% daily chance of building damage (weather, animals)
        securityPerGuard: 0.02,         // each guard reduces theft by 2%
        wallTheftReduction: { 0: 0, 1: 0.02, 2: 0.035, 3: 0.05 },
        annexationMinPop: 15,           // kingdom annexation requires 15+ people nearby/attracted
        annexationCheckInterval: 90,    // kingdoms check for annexation every 90 days
        eliteMerchantFoundChance: 0.003, // 0.3% chance per tick for rich elite merchants
        npcFoundChanceRefugee: 0.01,    // 1% during refugee crises
        maxDistanceFromRoad: 3,         // outpost must be within 3 tiles of a road
        abandonDaysNoMaintenance: 30,   // outpost abandoned after 30 days of no upkeep
        minDistanceTiles: 5,            // must be at least 5 tiles from any existing location

        // Land plots
        startingLandPlots: 4,           // outpost starts with 4 land plots
        maxLandPlots: 10,               // can expand to 10 total
        landPlotCost: 150,              // gold per additional land plot
        landPlotMaterials: { wood: 10, stone: 5 }, // materials per additional plot

        // Workers & Guards (hired from NPCs living in outpost)
        maxOutpostWorkers: 15,          // max workers at an outpost
        maxOutpostGuards: 4,            // max hired guards
        workerWagePerWeek: 10,          // gold per worker per week
        guardWagePerWeek: 15,           // gold per guard per week

        // Built-in storage
        baseStorageCapacity: 200,       // weight units of built-in outpost storage

        // NPC Recruitment
        recruitBaseChance: 0.10,        // 10% base chance to convince NPC
        recruitCooldownDays: 7,         // cooldown per NPC before asking again
        recruitRoadBonus: 0.15,         // +15% if outpost has road connection
        recruitRelationshipScale: 0.002, // per relationship point above 0
        recruitGoldPerPercent: 50,       // gold per 1% chance increase
        recruitMaxGoldBonus: 0.20,      // max +20% from gold incentive
        recruitStatusScale: 0.02,       // per social rank difference (player higher = bonus)
        recruitMinChance: 0.03,         // minimum 3% chance
        recruitMaxChance: 0.85,         // maximum 85% chance

        // Village Conversion
        villageConversionMinPop: 20,    // minimum NPCs to petition for village
        villageConversionBaseRep: 80,   // player starts with 80 rep in new village
        villageConversionMinRelationship: 20, // NPCs below this get bumped up
        villageConversionKingPayMin: 500,
        villageConversionKingPayMax: 2000,

        // Population cap
        maxPopulation: 30,              // outpost cannot exceed 30 NPCs

        // AI Immigration
        aiImmigrationCheckInterval: 7,  // days between AI checks
        aiImmigrationBaseChance: 0.03,  // 3% base chance per eligible NPC per check

        // Building maintenance (workers assigned to maintenance determine max player buildings)
        maxMaintainedBuildings: 10,     // max buildings maintained by workers
        buildingDegradeDays: 30,        // days until unmaintained building is destroyed

        // NPC needs satisfaction thresholds
        npcNeedDecayPerDay: 2,          // needs decay per day without satisfaction
        npcDissatisfactionLeaveThreshold: 60, // dissatisfaction score at which NPC leaves
        npcDissatisfactionPerDay: 1,    // dissatisfaction gained when any need < 30
    },

    // Outpost Risk Events — dangers that threaten unprotected outposts
    OUTPOST_RISKS: {
        // ── Bandit Raids ──
        banditRaid: {
            baseChance: 0.03,           // 3% per day (~once per month)
            stolenPctNoWalls: [0.10, 0.30],   // steal 10-30% of stored goods
            stolenPctPalisade: [0.05, 0.20],  // 5-20% with wooden palisade
            stolenPctStone: [0.03, 0.10],     // 3-10% with stone walls
            stolenPctFortified: [0.01, 0.05], // 1-5% with fortified walls
            wallReduction: { 0: 0, 1: 0.40, 2: 0.70, 3: 0.90 }, // chance reduction per wall level
            guardReduction: 0.10,       // each guard reduces raid chance by 10%
            watchtowerReduction: 0.15,  // watchtower reduces raid chance by 15%
            maxInjuredWorkers: 2,       // 1-2 workers injured per raid
            injuryHealDays: [5, 15],    // workers disabled for 5-15 days
            raiderCount: [3, 8],        // number of raiders (guards must outnumber to repel fully)
        },
        // ── Building Fires ──
        buildingFire: {
            baseChance: 0.02,           // 2% per day per building without well (~every 50 days)
            wellReduction: 0.80,        // well reduces fire chance by 80%
            watchtowerReduction: 0.30,  // watchtower watchman spots fires early
            stoneWallReduction: 0.10,   // stone doesn't burn
            cottageReduction: 0.10,     // stone cottages reduce spread
            guardReduction: 0.05,       // each guard helps firefighting
            conditionDamage: [0.15, 0.30],    // building loses 15-30% condition
            inventoryLoss: [0.10, 0.40],      // loses 10-40% of current inventory
            repairPauseDays: [3, 7],    // building pauses production for 3-7 days
        },
        // ── Worker Desertion (enhanced) ──
        workerDesertion: {
            baseChanceNoTavern: 0.02,     // 2% daily if no tavern AND no chapel
            baseChanceHungry: 0.04,       // 4% daily if no food hall and hungry
            tavernReduction: 0.50,        // tavern halves desertion
            chapelReduction: 0.50,        // chapel halves desertion (stacks multiplicatively)
            housingReduction: { tent_camp: 0, cabins: 0.25, cottages: 0.50 }, // housing reduces desertion
            foodHallEliminatesHunger: true, // food hall eliminates hunger-based desertion
        },
        // ── Disease Outbreaks ──
        diseaseOutbreak: {
            baseChance: 0.01,           // 1% per day (~once every 100 days)
            clinicReduction: 0.70,      // clinic reduces outbreak chance by 70%
            wellReduction: 0.20,        // well reduces chance (clean water)
            cottageReduction: 0.10,     // cottages reduce chance (better sanitation)
            tentCampIncrease: 0.005,    // tent camps INCREASE disease risk
            infectedCount: [2, 5],      // 2-5 workers infected per outbreak
            illnesses: ['cold', 'flu', 'dysentery', 'fever'], // possible diseases
        },
    },

    // Outpost Housing Types (each takes 1 land slot)
    OUTPOST_HOUSING: {
        tent_camp: {
            id: 'tent_camp', name: 'Tent Camp', icon: '⛺',
            capacity: 20, landSlots: 1, comfort: 5,
            cost: 50, materials: { wood: 5, cloth: 8, rope: 4 },
            description: 'Basic canvas tents. Holds 20 people but barely better than sleeping on the ground.',
            recruitBonus: 0.02, restBonus: 0.1,
        },
        cabins: {
            id: 'cabins', name: 'Log Cabins', icon: '🏠',
            capacity: 15, landSlots: 1, comfort: 35,
            cost: 200, materials: { wood: 25, planks: 10, stone: 5 },
            description: 'Sturdy log cabins. Holds 15 people with decent living conditions.',
            recruitBonus: 0.05, restBonus: 0.4,
        },
        cottages: {
            id: 'cottages', name: 'Stone Cottages', icon: '🏡',
            capacity: 10, landSlots: 1, comfort: 60,
            cost: 400, materials: { stone: 20, planks: 15, bricks: 8, wood: 10 },
            description: 'Charming stone cottages. Holds 10 people in comfortable, nice homes.',
            recruitBonus: 0.08, restBonus: 0.7,
        },
    },

    // Outpost Upgrades (improve recruitment chance, NPC quality of life)
    OUTPOST_UPGRADES: {
        well: {
            id: 'well', name: 'Well', icon: '🪣',
            cost: 100, materials: { stone: 15, rope: 3 },
            recruitBonus: 0.05, description: 'Fresh water source. +5% NPC recruitment.',
            autoAttract: false, landSlots: 0,
        },
        clinic: {
            id: 'clinic', name: 'Clinic', icon: '🏥',
            cost: 300, materials: { wood: 15, planks: 10, stone: 8, herbs: 10 },
            recruitBonus: 0.08, description: 'Heals 2 sick residents per day. Requires a worker.',
            autoAttract: false, landSlots: 0, requires: ['well'], needsWorker: true,
        },
        tavern: {
            id: 'tavern', name: 'Tavern', icon: '🍺',
            cost: 250, materials: { wood: 20, planks: 12, iron: 3 },
            recruitBonus: 0.06, description: 'Boosts happiness and slightly meets food need. Attracts travelers. Requires a worker.',
            autoAttract: true, autoAttractChance: 0.02, landSlots: 0, needsWorker: true,
        },
        market_stall: {
            id: 'market_stall', name: 'Market Stalls', icon: '🏪',
            cost: 150, materials: { wood: 12, cloth: 5, rope: 3 },
            recruitBonus: 0.04, description: 'Enables street trading. Slight food and wealth boost. Requires a worker.',
            autoAttract: false, landSlots: 0, needsWorker: true,
        },
        watchtower: {
            id: 'watchtower', name: 'Watchtower', icon: '🗼',
            cost: 350, materials: { stone: 20, wood: 15, iron: 5 },
            recruitBonus: 0.03, description: 'Greatly increases security and safety. Reduces theft. Requires a worker.',
            autoAttract: false, landSlots: 0, theftReduction: 0.02, needsWorker: true,
        },
        chapel: {
            id: 'chapel', name: 'Chapel', icon: '⛪',
            cost: 400, materials: { stone: 25, wood: 10, planks: 8 },
            recruitBonus: 0.06, description: 'Boosts happiness. Attracts settlers. Requires a worker.',
            autoAttract: true, autoAttractChance: 0.01, landSlots: 0, needsWorker: true,
        },
        food_hall: {
            id: 'food_hall', name: 'Food Hall', icon: '🍲',
            cost: 300, materials: { stone: 15, iron: 5, wood: 12, planks: 8 },
            recruitBonus: 0.05, description: 'Greatly helps NPC food need. Requires a worker.',
            autoAttract: false, landSlots: 0, requires: ['well'], needsWorker: true,
        },
        granary: {
            id: 'granary', name: 'Granary', icon: '🌾',
            cost: 200, materials: { wood: 20, planks: 8 },
            recruitBonus: 0.03, description: 'Food storage. +3% NPC recruitment. Reduces spoilage.',
            autoAttract: false, landSlots: 0, storageBonus: 100,
        },
    },

    // Wall / Fortification Levels
    WALL_LEVELS: {
        0: { name: 'No Walls',         defenseBonus: 0,    cost: 0,    materials: {} },
        1: { name: 'Wooden Palisade',   defenseBonus: 0.10, cost: 200,  materials: { wood: 50 } },
        2: { name: 'Stone Walls',       defenseBonus: 0.25, cost: 500,  materials: { stone: 100 } },
        3: { name: 'Fortified Walls',   defenseBonus: 0.40, cost: 1000, materials: { bricks: 50, stone: 100 } },
    },

    // Condition / Degradation System
    CONDITION_LEVELS: {
        'new':       { name: 'New',       icon: '✨', efficiency: 1.0,  minAge: 0 },
        'used':      { name: 'Used',      icon: '🔧', efficiency: 0.90, minAge: 90 },
        'breaking':  { name: 'Breaking',  icon: '⚠️', efficiency: 0.50, minAge: 180 },
        'destroyed': { name: 'Destroyed', icon: '🚫', efficiency: 0.0,  minAge: 270 },
    },
    DEGRADATION_TICK_INTERVAL: 30,

    // Warship Types (kingdom military ships)
    WARSHIP_TYPES: {
        patrol_boat: { name: 'Patrol Boat', cost: 500,  soldiers: 10, attack: 5,  defense: 8,  speed: 1.5, cannons: 1,  materials: { wood: 30, rope: 10, iron: 5 } },
        war_galley:  { name: 'War Galley',  cost: 1500, soldiers: 40, attack: 15, defense: 12, speed: 1.0, cannons: 4,  materials: { wood: 80, rope: 30, iron: 20 } },
        frigate:     { name: 'Frigate',     cost: 2500, soldiers: 60, attack: 25, defense: 20, speed: 1.3, cannons: 8,  materials: { wood: 100, rope: 40, iron: 30 } },
        flagship:    { name: 'Flagship',    cost: 4000, soldiers: 80, attack: 30, defense: 25, speed: 0.8, cannons: 12, materials: { wood: 150, rope: 50, iron: 40 } },
        siege_ship:  { name: 'Siege Ship',  cost: 3500, soldiers: 50, attack: 40, defense: 15, speed: 0.6, cannons: 16, materials: { wood: 120, rope: 45, iron: 50 }, canBombard: true },
    },

    // Warship mission types
    WARSHIP_MISSIONS: ['blockade', 'patrol', 'attack_ship', 'bombard_town', 'troop_transport', 'escort'],

    // Ship combat constants
    SHIP_PIRATE_BASE_CHANCE: 0.08,      // 8% base pirate encounter per sea trip
    SHIP_CANNON_DEFENSE_BONUS: 0.05,    // Each cannon reduces pirate success by 5%
    SHIP_SINK_HULL_THRESHOLD: 0,        // Ship sinks at 0 hull
    SHIP_FIRE_SPREAD_CHANCE: 0.15,      // 15% chance fire spreads per tick
    SHIP_STORM_HULL_DAMAGE: 10,         // Storm deals 10 hull damage
    SHIP_BLOCKADE_DETECTION_BASE: 0.60, // 60% chance caught running a blockade
    SHIP_BORDER_DETECTION_BASE: 0.70,   // 70% chance caught crossing closed border

    // Naval Battle Constants
    NAVAL_BATTLE_MAX_ROUNDS: 12,          // Max rounds in a fleet battle
    NAVAL_CANNON_DAMAGE_MIN: 0.5,        // Min multiplier on cannon damage roll
    NAVAL_CANNON_DAMAGE_MAX: 1.5,        // Max multiplier on cannon damage roll
    NAVAL_MORALE_BREAK_THRESHOLD: 0.50,  // Fleet flees if 50%+ ships lost
    NAVAL_MORALE_FLEE_CHANCE: 0.60,      // 60% chance to flee once morale breaks
    NAVAL_SHIP_HP_SOLDIER_MULT: 4,       // HP from soldiers (lower = ships sink faster)
    NAVAL_SHIP_HP_DEFENSE_MULT: 5,       // HP from defense stat
    NAVAL_DAMAGE_REDUCTION_RATIO: 0.5,   // Damaged ships lose stats proportional to HP lost

    // Amphibious Assault Constants
    AMPHIBIOUS_LANDING_PENALTY: 0.70,    // Troops fight at 70% effectiveness when landing
    AMPHIBIOUS_BOMBARDMENT_ROUNDS_MIN: 1,
    AMPHIBIOUS_BOMBARDMENT_ROUNDS_MAX: 3,
    AMPHIBIOUS_COVERING_FIRE_PER_CANNON: 0.10, // +10% damage per operational cannon
    AMPHIBIOUS_FORTRESS_DAMAGE_PER_CANNON: 10, // Fortress cannons deal this damage to ships per round

    // Fortress Walls (naval port defense)
    FORTRESS_WALLS: {
        cost: 3500,                       // Gold to build
        materials: { stone: 120, iron: 30 }, // Construction materials
        maxHP: 600,                       // Full wall health
        bombardmentAbsorb: 0.75,          // Absorbs 75% of bombardment kills as wall damage
        damagePerAbsorbedKill: 8,         // Each absorbed kill deals 8 HP damage to walls
        repairCostPerHP: 3,               // Gold per HP to repair
        repairMaterials: { stone: 0.15 }, // Stone per HP to repair
        breachedEfficiency: 0.25,         // When HP=0, walls still reduce kills by 25% (rubble cover)
        degradePerTick: 0.05,             // Passive HP loss per tick (weather/age) — very slow
        buildDays: 60,                    // Days to construct
    },

    // Army Embarkation
    ARMY_EMBARK_SOLDIERS_PER_SHIP: 50,   // Each transport ship carries up to 50 soldiers

    // Sea Route Interception
    NAVAL_PATROL_INTERCEPT_CHANCE: 0.20, // 20% chance patrol ships intercept per tick
    NAVAL_PATROL_RANGE: 2000,            // Range within which patrol ships can intercept

    // Royal Advisor System
    ROYAL_ADVISOR_COUNT_MIN: 3,
    ROYAL_ADVISOR_COUNT_MAX: 5,
    ROYAL_ADVISOR_UPDATE_INTERVAL: 90,
    SUCCESSION_ELECTION_ROUNDS_MAX: 10,

    // Army Supply System
    ARMY_SUPPLY_CONSUMPTION_PER_10: 1,
    ARMY_LOW_SUPPLY_MORALE_LOSS: 5,
    ARMY_LOW_MORALE_COMBAT_PENALTY: 0.5,
    ARMY_DEFAULT_MORALE: 100,
    ARMY_DEFAULT_SUPPLIES: 100,
    ARMY_OFFROAD_SPEED_MULT: 0.3,       // Armies move at 30% speed offroad (big penalty)
    ARMY_SEA_SPEED_MULT: 0.6,           // Armies at 60% speed on sea transports
    ARMY_ROAD_SPEED_MULT: 1.0,          // Normal speed on roads
    ARMY_MAX_OFFROAD_RANGE: 4000,       // Max offroad distance between towns for army routing
    ARMY_MIN_GARRISON_RATIO: 0.4,       // Keep at least 40% of garrison when dispatching

    // Siege System (H-3)
    SIEGE_BASE_DAYS: 14,                 // Base siege duration before modifiers
    SIEGE_WALL_MULT: 0.5,               // Each wall level adds 50% to siege duration
    SIEGE_WORKSHOP_SPEED: 0.20,         // Each siege workshop reduces siege time by 20% (capped)
    SIEGE_DAILY_ATTACKER_ATTRITION: 0.005, // 0.5% daily attacker losses
    SIEGE_DAILY_DEFENDER_ATTRITION: 0.002, // 0.2% daily defender losses
    SIEGE_SORTIE_CHANCE: 0.05,           // 5% daily chance defenders sortie
    SIEGE_SORTIE_ATTACKER_LOSS: 0.03,    // Attackers lose 3% in sortie
    SIEGE_SORTIE_DEFENDER_LOSS: 0.05,    // Defenders lose 5% in sortie
    SIEGE_STARVATION_START_DAY: 21,      // Days before starvation kicks in
    SIEGE_STARVATION_MORALE_LOSS: 3,     // Daily morale loss from starvation
    SIEGE_RELIEF_ARMY_CHECK_DAYS: 7,     // How often to check for relief armies
    SIEGE_BREACH_THRESHOLD: 0.6,         // Attacker strength ratio needed to breach

    // Retreat Mechanics (H-4)
    RETREAT_HIGH_MORALE_THRESHOLD: 30,   // Above this = orderly retreat
    RETREAT_HIGH_MORALE_SURVIVAL_MIN: 0.30, // 30-60% survive orderly retreat
    RETREAT_HIGH_MORALE_SURVIVAL_MAX: 0.60,
    RETREAT_LOW_MORALE_SURVIVAL_MIN: 0.00, // 0-20% survive rout
    RETREAT_LOW_MORALE_SURVIVAL_MAX: 0.20,
    RETREAT_CAVALRY_BONUS: 0.10,         // +10% survival per 10% cavalry ratio

    // Morale System (M-3)
    MORALE_VICTORY_BOOST: 5,            // +5 morale per won battle
    MORALE_DEFEAT_LOSS: 10,             // -10 morale per lost battle
    MORALE_WAR_WEARINESS_DAYS: 90,      // Days of war before weariness kicks in
    MORALE_WAR_WEARINESS_RATE: 0.5,     // Daily morale loss from war weariness
    MORALE_GARRISON_DEFAULT: 70,         // Default garrison morale
    MORALE_GARRISON_MIN: 10,            // Minimum garrison morale
    MORALE_GARRISON_MAX: 100,

    // Soldier Equipment & Experience
    SOLDIER_BASE_COMBAT_SKILL: 20,       // Minimum combat skill for new recruits
    SOLDIER_TRAINING_DAILY_GAIN: 0.15,   // Combat skill gain per day of training
    SOLDIER_BATTLE_XP_GAIN: 5,           // Combat skill boost for surviving a battle
    SOLDIER_MAX_COMBAT_SKILL: 100,
    SOLDIER_EQUIPMENT_QUALITY_MULT: { none: 0.4, basic: 1.0, good: 1.3, excellent: 1.6 },
    EQUIPMENT_DEGRADE_DAYS: 90,          // Equipment degrades one tier every 90 days

    // Recruitment & Pay
    SOLDIER_BASE_PAY: 2,                 // Base daily pay per soldier
    SOLDIER_WARTIME_PAY_MULT: 2.0,       // Pay multiplier during war
    SOLDIER_MAX_PAY_MULT: 5.0,           // Maximum pay multiplier when desperate
    SOLDIER_PAY_INCREASE_THRESHOLD: 0.5, // If recruitment < 50% target, increase pay
    CONSCRIPTION_MORALE_PENALTY: 15,     // Town happiness loss from conscription
    CONSCRIPTION_LOYALTY_THRESHOLD: 30,  // NPC loyalty below this = desertion risk

    // Supply Lines (M-2)
    SUPPLY_LINE_CHECK_INTERVAL: 3,       // Check supply lines every 3 days
    SUPPLY_LINE_CUT_MORALE_LOSS: 3,      // Extra daily morale loss when supply line cut
    SUPPLY_LINE_CUT_SUPPLY_LOSS: 2,      // Extra daily supply loss when supply line cut

    // Scouting & Intelligence (M-4)
    SCOUT_BRILLIANT_ACCURACY: 0.95,      // ±5% error
    SCOUT_CLEVER_ACCURACY: 0.85,         // ±15% error
    SCOUT_AVERAGE_ACCURACY: 0.70,        // ±30% error
    SCOUT_FOOLISH_ACCURACY: 0.40,        // ±60% error

    // Peacetime Soldier Activities (M-1)
    PEACETIME_PATROL_SECURITY_PER_10: 5, // +5% security per 10 patrolling soldiers
    PEACETIME_TRAINING_SKILL_GAIN: 0.15, // Combat skill per training day
    PEACETIME_TRAINING_GROUNDS_MULT: 2.0, // Training grounds doubles XP gain for soldiers training there
    PEACETIME_CONSTRUCTION_WALL_REPAIR_DAYS: 30, // Days to repair 1 wall level
    PEACETIME_SOLDIER_ALLOCATION: { patrol: 0.40, training: 0.30, construction: 0.30 },

    // Building Conversion System
    FARM_CROP_TYPES: ['wheat_farm', 'hemp_farm', 'vineyard', 'herb_garden', 'apiary'],
    FARM_LIVESTOCK_TYPES: ['cattle_ranch', 'sheep_farm', 'chicken_farm', 'horse_ranch', 'pig_farm'],
    FARM_FREE_CONVERSIONS_PER_YEAR: 1,       // Free crop farm conversion per year
    FARM_PAID_CONVERSION_COST_MULT: 0.25,    // 1/4 cost after free conversion used
    LIVESTOCK_CONVERSIONS_PER_YEAR: 2,        // Livestock conversions allowed per year
    LIVESTOCK_CONVERSION_COST_MULT: 0.50,     // Half cost for livestock conversion

    // Player-as-King
    ADVISE_KING_POLITICAL_CAPITAL_MAX: 3,
    ADVISE_KING_CAPITAL_REGEN_DAYS: 90,

    // ── Housing System ──
    HOUSING_TYPES: [
        // Bedroll / Inn — no construction, purchased or rented
        { id: 'bedroll', name: 'Bedroll (Outdoors)', icon: '🛏️', cost: 5, storage: 0, security: 0, restBonus: 0, maxOccupants: 1, comfort: 0, diseaseReduction: 0, description: 'Sleep under the stars. No protection.' },
        { id: 'inn_room', name: 'Inn Room', icon: '🏨', cost: 0, dailyRent: 3, storage: 0, security: 0.2, restBonus: 0.3, maxOccupants: 2, comfort: 20, diseaseReduction: 0.1, description: 'A warm bed and a roof. Pay per night.' },
        { id: 'tent', name: 'Tent', icon: '⛺', cost: 0, storage: 5, security: 0.02, restBonus: 0.1, maxOccupants: 2, comfort: 5, diseaseReduction: 0.02,
          notBuildable: true, fromTentCamp: true, productivityMod: 0.85,
          description: 'A basic canvas tent in a camp. Minimal shelter. High disease risk. Better than nothing.' },
        // Constructed housing — requires materials + labor
        { id: 'shack', name: 'Shack', icon: '🛖', laborCost: 15, storage: 20, security: 0.1, restBonus: 0.2, maxOccupants: 2, comfort: 10, diseaseReduction: 0.15, minTownCategory: 'village',
          materials: { wood: 6, rope: 1 },
          description: 'A humble shelter. Better than nothing.' },
        { id: 'cottage', name: 'Cottage', icon: '🏡', laborCost: 50, storage: 40, security: 0.3, restBonus: 0.5, maxOccupants: 4, comfort: 30, diseaseReduction: 0.25, minTownCategory: 'village', canGrow: ['herbs'],
          materials: { wood: 12, planks: 5, stone: 4 },
          description: 'A cozy home with a small garden. Grow herbs passively.' },
        { id: 'farmstead', name: 'Farmstead', icon: '🌾', laborCost: 65, storage: 60, security: 0.25, restBonus: 0.4, maxOccupants: 5, comfort: 25, diseaseReduction: 0.20, minTownCategory: 'village', canGrow: ['herbs', 'wheat', 'vegetables'],
          materials: { wood: 18, planks: 6, stone: 5 },
          description: 'A working homestead with crop plots. Grow food & herbs at home.' },
        { id: 'townhouse', name: 'Townhouse', icon: '🏠', laborCost: 100, storage: 80, security: 0.5, restBonus: 0.7, maxOccupants: 6, comfort: 50, diseaseReduction: 0.35, minTownCategory: 'town', repBonus: 5,
          materials: { planks: 12, stone: 8, bricks: 5, iron: 1 },
          description: 'A respectable home in town. +5 town reputation.' },
        { id: 'apartment', name: 'Apartment', icon: '🏢', laborCost: 0, storage: 30, security: 0.4, restBonus: 0.5, maxOccupants: 4, comfort: 35, diseaseReduction: 0.30, minTownCategory: 'city',
          notBuildable: true, fromApartmentBuilding: true,
          description: 'Compact city living. Purchased from an apartment building. No land needed.' },
        { id: 'merchant_house', name: 'Merchant House', icon: '🏘️', laborCost: 200, storage: 150, security: 0.6, restBonus: 0.8, maxOccupants: 8, comfort: 65, diseaseReduction: 0.45, minTownCategory: 'town', repBonus: 10, hasWorkshop: true,
          materials: { planks: 25, stone: 15, bricks: 10, iron: 4, cloth: 3 },
          description: 'A fine house with workshop space. +10 rep. Can craft at home.' },
        { id: 'harbor_house', name: 'Harbor House', icon: '⚓', laborCost: 120, storage: 120, security: 0.5, restBonus: 0.6, maxOccupants: 6, comfort: 45, diseaseReduction: 0.35, requiresPort: true, shipDiscount: 0.10,
          materials: { planks: 15, wood: 10, stone: 6, rope: 5, iron: 2 },
          description: 'Waterfront home. 10% ship repair/purchase discount.' },
        { id: 'manor', name: 'Manor House', icon: '🏛️', laborCost: 500, storage: 300, security: 0.8, restBonus: 0.9, maxOccupants: 12, comfort: 80, diseaseReduction: 0.55, minTownCategory: 'city', repBonus: 20, hasWorkshop: true, hasStables: true,
          materials: { planks: 40, stone: 30, bricks: 20, iron: 8, cloth: 5 },
          description: 'A grand manor with stables and workshop. +20 rep.' },
        { id: 'estate', name: 'Noble Estate', icon: '🏰', laborCost: 1200, storage: 500, security: 0.95, restBonus: 1.0, maxOccupants: 20, comfort: 95, diseaseReduction: 0.70, minTownCategory: 'city', repBonus: 35, hasWorkshop: true, hasStables: true, hasGarden: true, minRank: 4,
          materials: { planks: 60, stone: 50, bricks: 35, iron: 15, cloth: 10 },
          description: 'A noble estate with gardens, stables, guest quarters. +35 rep. Requires Minor Noble.' },
        { id: 'fortress', name: 'Fortified Manor', icon: '🏯', laborCost: 2000, storage: 400, security: 1.0, restBonus: 0.85, maxOccupants: 25, comfort: 65, diseaseReduction: 0.60, minTownCategory: 'city', repBonus: 30, hasWorkshop: true, hasStables: true, defenseBonus: true, minRank: 5,
          materials: { stone: 80, bricks: 40, iron: 25, planks: 20 },
          description: 'A fortress-like home. Impervious to theft. Defensive bonus. Requires Lord rank.' },
        { id: 'castle', name: 'Castle', icon: '🏰', laborCost: 5000, storage: 800, security: 1.0, restBonus: 1.0, maxOccupants: 40, comfort: 100, diseaseReduction: 0.80, minTownCategory: 'capital_city', repBonus: 50, hasWorkshop: true, hasStables: true, hasGarden: true, defenseBonus: true, minRank: 5, politicalInfluence: 5, landSlots: 2,
          materials: { stone: 200, bricks: 80, iron: 50, planks: 60, cloth: 15 },
          description: 'The ultimate residence. All features. Grants political influence. Capital only. Requires Lord rank.' },
        { id: 'caravan_wagon', name: 'Caravan Wagon', icon: '🛒', laborCost: 40, storage: 60, security: 0.15, restBonus: 0.3, maxOccupants: 2, comfort: 15, diseaseReduction: 0.05, portable: true, requiresHorse: true,
          materials: { planks: 8, wood: 6, cloth: 3, rope: 2, iron: 1 },
          description: 'Mobile housing! Rest while traveling. Requires horse. Storage 60.' },
    ],
    HOUSING_LABOR_MULTIPLIER: { village: 0.7, town: 1.0, city: 1.3, capital_city: 1.8 },
    HOUSING_SELL_RATIO: 0.70,
    HOUSING_UPGRADE_DISCOUNT: 0.60, // when upgrading in-place, recover 60% of old materials value

    // ── House Addons ──
    HOUSE_ADDONS: {
        workshop: {
            id: 'workshop', name: 'Workshop', icon: '🔨',
            description: 'Craft items at home. Enables home crafting recipes.',
            goldCost: 150, materials: { planks: 8, iron: 3, stone: 2 },
            minHouseId: ['cottage', 'farmstead', 'townhouse', 'harbor_house'],
            grants: 'hasWorkshop'
        },
        storage_expansion: {
            id: 'storage_expansion', name: 'Storage Expansion', icon: '📦',
            description: 'Expand home storage by 50%.',
            goldCost: 100, materials: { planks: 6, iron: 2 },
            minHouseId: null, // any house
            grants: 'storageBonus', grantValue: 0.5
        },
        stables: {
            id: 'stables', name: 'Stables', icon: '🐴',
            description: 'Stable up to 4 horses at home (8 with Horse Mastery).',
            goldCost: 200, materials: { wood: 10, planks: 6, rope: 3 },
            minHouseId: ['cottage', 'farmstead', 'townhouse', 'harbor_house'],
            grants: 'hasStables'
        },
        garden: {
            id: 'garden', name: 'Garden', icon: '🌿',
            description: 'Grow herbs and vegetables at home.',
            goldCost: 80, materials: { wood: 4 },
            minHouseId: ['shack', 'townhouse', 'harbor_house'],
            grants: 'hasGarden'
        },
        guest_quarters: {
            id: 'guest_quarters', name: 'Guest Quarters', icon: '🛏️',
            description: 'Add +4 max occupants to the home.',
            goldCost: 250, materials: { planks: 10, stone: 5, cloth: 3 },
            minHouseId: ['townhouse', 'harbor_house'],
            grants: 'occupantBonus', grantValue: 4
        }
    },
    // Worker productivity modifiers based on housing quality
    HOUSING_PRODUCTIVITY: { none: 0.70, tent: 0.85, shack: 0.92, cottage: 1.0, farmstead: 1.0, townhouse: 1.0, apartment: 1.0, merchant_house: 1.0, harbor_house: 1.0, manor: 1.0, estate: 1.0, fortress: 1.0, castle: 1.0, caravan_wagon: 0.95, bedroll: 0.75, inn_room: 0.90 },

    // ── Energy System (replaces old Fatigue) ──
    // Legacy fatigue constants kept for backward compat; new code uses ENERGY_CONFIG
    FATIGUE_PER_TICK_COST: 0.5,
    FATIGUE_WARNING: 60,
    FATIGUE_CRITICAL: 85,
    FATIGUE_MAX: 100,
    FATIGUE_PENALTY_TRADE: 0.10,
    FATIGUE_PENALTY_COMBAT: 0.20,
    FATIGUE_PENALTY_SOCIAL: 0.15,
    REST_HOME_TICKS: 20,
    REST_INN_TICKS: 20,
    REST_OUTSIDE_TICKS: 25,
    FATIGUE_HOME_OVERNIGHT_RECOVERY: 20,
    FATIGUE_HOMELESS_OVERNIGHT_RECOVERY: 10,

    // ── Land Ownership ──
    LAND_PLOTS_BASE: { village: 30, town: 20, city: 10, capital_city: 5 },
    LAND_COST_BASE: 250,
    LAND_COST_MULTIPLIER: { village: 0.5, town: 1.0, city: 2.0, capital_city: 4.0 },
    LAND_SELL_RATIO: 0.80,

    // ── Wartime Travel Danger ──
    WARTIME_AMBUSH_BASE_CHANCE: 0.25,
    WARTIME_AMBUSH_MILITARY_GOODS_BONUS: 0.15,
    WARTIME_AMBUSH_ENEMY_CITIZEN_BONUS: 0.10,
    WARTIME_ESCORT_COST_PER_DAY: 20,
    WARTIME_ESCORT_REDUCTION: 0.15,
    WARTIME_FRONTLINE_DISTANCE: 500,

    // ── Player Encounter System (Bandits / Pirates / Wartime Ambush) ──
    // Land encounters
    ENCOUNTER_LAND_BASE_CHANCE: 0.05,       // 5% per day base
    ENCOUNTER_LAND_MIN_CHANCE: 0.001,       // 0.1% per day floor
    ENCOUNTER_LAND_MAX_CHANCE: 0.15,        // 15% per day ceiling
    ENCOUNTER_ROAD_DANGER_MULT: 1.5,        // dangerous roads multiplier
    ENCOUNTER_POOR_SECURITY_MULT: 1.3,      // poor town security on connected locations
    ENCOUNTER_GUARD_REDUCTION: 0.40,        // each guard reduces chance by this mult (stacks multiplicatively)
    ENCOUNTER_HORSE_REDUCTION: 0.85,        // riding a horse slightly reduces chance
    ENCOUNTER_PAID_TRANSIT_REDUCTION: 0.25, // paid transit greatly reduces chance (mult)
    ENCOUNTER_WEAPON_REDUCTION: 0.90,       // having a weapon slightly reduces encounter chance
    ENCOUNTER_ARMOR_REDUCTION: 0.93,        // having armor slightly reduces encounter chance
    ENCOUNTER_SKILL_STREET_SMART: 0.90,     // street_smart skill 10% reduction
    ENCOUNTER_SKILL_INTIMIDATING: 0.85,     // intimidating_presence 15% reduction

    // Sea encounters
    ENCOUNTER_SEA_BASE_CHANCE: 0.04,        // 4% per day base (slightly lower than land)
    ENCOUNTER_SEA_MIN_CHANCE: 0.0001,       // 0.01% per day floor (best ship + all buffs)
    ENCOUNTER_SEA_MAX_CHANCE: 0.10,         // 10% per day ceiling (worst ship)
    // Ship defense factor: defense 0=no reduction, 30=~85% reduction
    ENCOUNTER_SEA_SHIP_DEFENSE_FACTOR: 0.06, // each defense point reduces chance by this mult (1 - def*factor)
    ENCOUNTER_SEA_GUARD_REDUCTION: 0.70,    // guards give moderate help at sea (per guard)
    ENCOUNTER_SEA_WEAPON_REDUCTION: 0.97,   // weapons/armor only tiny help at sea
    ENCOUNTER_SEA_ARMOR_REDUCTION: 0.98,

    // Wartime encounter modifiers
    ENCOUNTER_WARTIME_CHANCE_MULT: 1.8,     // wartime encounters are more frequent
    ENCOUNTER_WARTIME_FIGHT_DIFFICULTY: 1.4, // wartime fights are harder
    ENCOUNTER_WARTIME_INJURY_MULT: 1.5,     // higher injury risk in wartime

    // Fight resolution
    ENCOUNTER_FIGHT_MIN_WIN: 0.05,          // 5% minimum win chance
    ENCOUNTER_FIGHT_MAX_WIN: 0.95,          // 95% maximum win chance
    ENCOUNTER_FIGHT_BASE_WIN: 0.35,         // 35% base fight win chance
    ENCOUNTER_FIGHT_GUARD_BONUS: 0.12,      // each guard adds 12% win chance
    ENCOUNTER_FIGHT_WEAPON_BONUS: 0.10,     // weapon adds up to 10% (scaled by combatBonus)
    ENCOUNTER_FIGHT_ARMOR_BONUS: 0.05,      // armor adds up to 5% (reduces injury chance instead)
    ENCOUNTER_FIGHT_SKILL_COMBAT_TRAINED: 0.10, // combat_trained adds 10%
    ENCOUNTER_FIGHT_SKILL_BATTLE_HARDENED: 0.20, // battle_hardened replaces combat_trained
    ENCOUNTER_FIGHT_SKILL_COMBAT_PROFICIENCY: 0.10, // stacks
    ENCOUNTER_FIGHT_LOW_NEEDS_PENALTY: 0.08, // low hunger/thirst/energy each reduce by 8%
    ENCOUNTER_FIGHT_BANDIT_STRENGTH_MIN: 0.10, // RNG: weakest bandits remove 10% from win
    ENCOUNTER_FIGHT_BANDIT_STRENGTH_MAX: 0.30, // RNG: strongest bandits remove 30% from win

    // Sea fight specifics
    ENCOUNTER_SEA_FIGHT_SHIP_DEFENSE_BONUS: 0.02, // each ship defense point adds 2% win
    ENCOUNTER_SEA_FIGHT_CANNON_BONUS: 0.06,  // each cannon adds 6% win chance
    ENCOUNTER_SEA_FIGHT_GUARD_BONUS: 0.08,   // guards moderate help at sea (per guard)
    ENCOUNTER_SEA_FIGHT_WEAPON_BONUS: 0.02,  // weapons tiny help at sea

    // Surrender: lose all goods + 50% gold (cap 500g)
    ENCOUNTER_SURRENDER_GOLD_PCT: 0.50,
    ENCOUNTER_SURRENDER_GOLD_CAP: 500,

    // Negotiate: lose 50% goods + 10% gold (cap 250g)
    ENCOUNTER_NEGOTIATE_GOODS_PCT: 0.50,
    ENCOUNTER_NEGOTIATE_GOLD_PCT: 0.10,
    ENCOUNTER_NEGOTIATE_GOLD_CAP: 250,
    ENCOUNTER_NEGOTIATE_BASE_SUCCESS: 0.40,  // 40% base negotiation success
    ENCOUNTER_NEGOTIATE_SKILL_BONUS: 0.15,   // silver_tongue/haggling each add 15%

    // Fight loss penalties
    ENCOUNTER_FIGHT_LOSS_INJURY_MODERATE_CHANCE: 0.50, // 50% moderate, 50% severe on loss
    ENCOUNTER_FIGHT_WIN_SHIP_DAMAGE_CHANCE: 0.40,      // 40% chance ship takes damage on sea fight win

    // Guard hiring (player personal guards)
    PLAYER_GUARD_HIRE_COST: 30,             // same as caravan guards
    PLAYER_GUARD_DAILY_WAGE: 6,             // same as caravan guards
    PLAYER_GUARD_MAX: 4,                    // base max guards (pre-noble)
    PLAYER_GUARD_MAX_BY_RANK: { 0: 4, 1: 4, 2: 4, 3: 4, 4: 8, 5: 8, 6: 8, 7: 8 }, // rank-based max guards
    NOBLE_KINGDOM_GUARD_SLOTS: 4,           // kingdom provides 4 guards to Minor Noble+

    // ── Kingdom Ban Policy ──
    KINGDOM_BAN_POLICY_INTERVAL: 30,
};

// ============================================================
// Terrain-Based Price Modifiers
// ============================================================
// Multipliers on base price for goods in towns of each terrain type.
// < 1.0 = cheaper (locally abundant), > 1.0 = more expensive (scarce).

CONFIG.TERRAIN_PRICE_MODIFIERS = {
    coastal: {
        fish: 0.70, salt: 0.80, rope: 0.85,
        iron_ore: 1.20, wood: 1.15, stone: 1.10
    },
    mountain: {
        iron_ore: 0.70, stone: 0.80, iron: 0.85,
        fish: 1.40, wheat: 1.15, meat: 1.10
    },
    forest: {
        wood: 0.70, herbs: 0.85, honey: 0.85, planks: 0.90,
        stone: 1.20, fish: 1.30, salt: 1.15
    },
    plains: {
        wheat: 0.75, meat: 0.85, flour: 0.85, eggs: 0.90, wool: 0.90,
        wood: 1.15, iron_ore: 1.20, stone: 1.10
    },
    island: {
        fish: 0.60, salt: 0.70, pearls: 0.70, rope: 0.80,
        wood: 1.30, iron_ore: 1.40, stone: 1.35, wheat: 1.20
    }
};

// ============================================================
// Weapon/Armor Quality Tiers
// ============================================================

CONFIG.QUALITY_TIERS = {
    basic:     { name: 'Basic',     priceMultiplier: 1, effectivenessBonus: 0.00, icon: '⚪' },
    good:      { name: 'Good',      priceMultiplier: 3, effectivenessBonus: 0.10, icon: '🔵' },
    excellent: { name: 'Excellent', priceMultiplier: 9, effectivenessBonus: 0.20, icon: '🟣' },
};

// Quality Crafting RNG Chances
CONFIG.QUALITY_CRAFTING = {
    good:      { baseChance: 0.30, maxChance: 0.90, workerSkillFactor: 0.004, playerSkillBonus: 0.20 },
    excellent: { baseChance: 0.10, maxChance: 0.60, workerSkillFactor: 0.003, playerSkillBonus: 0.20 },
    WEAPON_BASE_ITEMS: ['swords', 'bows', 'arrows'],
    ARMOR_BASE_ITEMS:  ['armor'],
};

// ============================================================
// Worker Economy Constants
// ============================================================

CONFIG.WORKER_HIRE_COSTS = {
    unskilled: 10,   // 0-30 skill
    skilled:   50,    // 31-60 skill
    expert:    200,   // 61-80 skill
    master:    800,   // 81-100 skill
};

CONFIG.WORKER_WEEKLY_WAGES = {
    unskilled: 5,       // Was 2; still cheap but meaningful
    skilled:   18,      // Was 8; skilled labor costs more
    expert:    50,      // Was 25; experts are expensive
    master:    120,     // Was 80; masters demand premium
};

CONFIG.WORKER_TRAINING_COST = 500;
CONFIG.WORKER_TRAINING_DAYS = 7;
CONFIG.WORKER_TRAINING_SKILL_GAIN = 20;
CONFIG.WORKER_POACH_INTERVAL = 30;
CONFIG.WORKER_POACH_CHANCE = 0.05;
CONFIG.WORKER_POACH_MIN_SKILL = 50;
CONFIG.WORKER_RETIRE_AGE_MIN = 55;
CONFIG.WORKER_RETIRE_AGE_MAX = 65;
CONFIG.WORKER_WAGE_DEMAND_MIN_INTERVAL = 30;
CONFIG.WORKER_WAGE_DEMAND_MAX_INTERVAL = 90;
CONFIG.WORKER_WAGE_DEMAND_MIN_SKILL = 30;

// Worker Satisfaction
CONFIG.WORKER_SATISFACTION_BASE = 60;          // Starting satisfaction when hired
CONFIG.WORKER_SATISFACTION_DAILY_DECAY = 0.15; // Natural daily decay
CONFIG.WORKER_SATISFACTION_PAID_BOOST = 3;     // Boost when paid on time
CONFIG.WORKER_SATISFACTION_UNPAID_PENALTY = 8; // Penalty when unpaid
CONFIG.WORKER_SATISFACTION_RAISE_BOOST = 10;   // Boost from a raise
CONFIG.WORKER_SATISFACTION_BONUS_BOOST = 15;   // Boost from a bonus
CONFIG.WORKER_SATISFACTION_DAYOFF_BOOST = 8;   // Boost from a paid day off
CONFIG.WORKER_SATISFACTION_PRAISE_BOOST = 3;   // Boost from praise (free)
CONFIG.WORKER_SATISFACTION_QUIT_THRESHOLD = 15; // Below this, chance to quit daily
CONFIG.WORKER_SATISFACTION_QUIT_CHANCE = 0.03; // 3% daily quit chance when below threshold
CONFIG.WORKER_SATISFACTION_POACH_BONUS = 0.02; // Extra poach chance per point below 50

// ============================================================
// Workshop Upgrades
// ============================================================

CONFIG.WORKSHOP_UPGRADES = {
    training_forge:  { name: 'Training Forge',    cost: 300, materials: { iron: 10, stone: 5 },  learningBonus: 0.25, icon: '🔥' },
    masters_library: { name: "Master's Library",  cost: 500, materials: { planks: 10 },          learningBonus: 0.15, icon: '📚' },
    practice_yard:   { name: 'Practice Yard',     cost: 400, materials: { wood: 15, stone: 5 },  learningBonus: 0.20, icon: '🎯' },
};

// ============================================================
// Resource Types & Production Chains
// ============================================================

const RESOURCE_TYPES = {
    WHEAT:    { id: 'wheat',    name: 'Wheat',     category: 'raw',       basePrice: 2,  icon: '🌾', weight: 1 },
    IRON_ORE: { id: 'iron_ore', name: 'Iron Ore',  category: 'raw',       basePrice: 12, icon: '⛏', weight: 3 },
    WOOD:     { id: 'wood',     name: 'Wood',      category: 'raw',       basePrice: 5,  icon: '🪵', weight: 2 },
    STONE:    { id: 'stone',    name: 'Stone',     category: 'raw',       basePrice: 6,  icon: '🪨', weight: 4 },
    WOOL:     { id: 'wool',     name: 'Wool',      category: 'raw',       basePrice: 4,  icon: '🐑', weight: 1 },
    HIDE:     { id: 'hide',     name: 'Hide',      category: 'raw',       basePrice: 5,  icon: '🐄', weight: 2 },
    GRAPES:   { id: 'grapes',   name: 'Grapes',    category: 'raw',       basePrice: 4,  icon: '🍇', weight: 1 },
    GOLD_ORE: { id: 'gold_ore', name: 'Gold Ore',  category: 'raw',       basePrice: 20, icon: '✨', weight: 3 },
    FLOUR:    { id: 'flour',    name: 'Flour',     category: 'processed', basePrice: 8,  icon: '🫘', weight: 1 },
    IRON:     { id: 'iron',     name: 'Iron Bars', category: 'processed', basePrice: 22, icon: '🔩', weight: 2 },
    PLANKS:   { id: 'planks',   name: 'Planks',    category: 'processed', basePrice: 10, icon: '📏', weight: 2 },
    CLOTH:    { id: 'cloth',    name: 'Cloth',     category: 'processed', basePrice: 8,  icon: '🧶', weight: 1 },
    LEATHER:  { id: 'leather',  name: 'Leather',   category: 'processed', basePrice: 10, icon: '🟫', weight: 1 },
    BREAD:    { id: 'bread',    name: 'Bread',     category: 'food',      basePrice: 5,  icon: '🍞', weight: 1 },
    MEAT:     { id: 'meat',     name: 'Meat',      category: 'food',      basePrice: 10, icon: '🥩', weight: 1 },
    CLOTHES:  { id: 'clothes',  name: 'Clothes',   category: 'finished',  basePrice: 18, icon: '👕', weight: 1 },
    TOOLS:    { id: 'tools',    name: 'Tools',     category: 'finished',  basePrice: 30, icon: '⚒️', weight: 2 },
    WINE:     { id: 'wine',     name: 'Wine',      category: 'luxury',    basePrice: 25, icon: '🍷', weight: 2 },
    JEWELRY:  { id: 'jewelry',  name: 'Jewelry',   category: 'luxury',    basePrice: 50, icon: '💍', weight: 0.5 },
    SWORDS:   { id: 'swords',   name: 'Swords',    category: 'military',  basePrice: 55, icon: '⚔️', weight: 3, tier: 'basic' },
    ARMOR:    { id: 'armor',    name: 'Armor',     category: 'military',  basePrice: 90, icon: '🛡️', weight: 5, tier: 'basic' },
    HORSES:   { id: 'horses',   name: 'Horses',    category: 'military',  basePrice: 60, icon: '🐴', weight: 10 },
    CART:     { id: 'cart',     name: 'Cart',      category: 'finished',  basePrice: 35, icon: '🛒', weight: 8 },
    SMALL_WAGON: { id: 'small_wagon', name: 'Small Wagon', category: 'finished', basePrice: 80, icon: '🛞', weight: 15 },
    WAGON:    { id: 'wagon',    name: 'Wagon',     category: 'finished',  basePrice: 130, icon: '🚛', weight: 20 },
    LARGE_WAGON: { id: 'large_wagon', name: 'Large Wagon', category: 'finished', basePrice: 200, icon: '🚚', weight: 25 },
    EGGS:     { id: 'eggs',     name: 'Eggs',      category: 'food',      basePrice: 2,  icon: '🥚', weight: 0.5 },
    POULTRY:  { id: 'poultry',  name: 'Poultry',   category: 'food',      basePrice: 10, icon: '🍗', weight: 1 },
    FISH:     { id: 'fish',     name: 'Fish',      category: 'food',      basePrice: 5,  icon: '🐟', weight: 1 },
    SALT:     { id: 'salt',     name: 'Salt',      category: 'raw',       basePrice: 7,  icon: '🧂', weight: 1 },
    PEARLS:   { id: 'pearls',   name: 'Pearls',    category: 'luxury',    basePrice: 40, icon: '🫧', weight: 0.5 },
    // --- New goods ---
    BOWS:             { id: 'bows',             name: 'Bows',           category: 'military',  basePrice: 25, icon: '🏹', weight: 2, tier: 'basic' },
    ARROWS:           { id: 'arrows',           name: 'Arrows',         category: 'military',  basePrice: 5,  icon: '➳',  weight: 1, tier: 'basic' },
    FURNITURE:        { id: 'furniture',        name: 'Furniture',      category: 'finished',  basePrice: 30, icon: '🪑', weight: 5 },
    BRICKS:           { id: 'bricks',           name: 'Bricks',         category: 'processed', basePrice: 12, icon: '🧱', weight: 4 },
    SADDLES:          { id: 'saddles',           name: 'Saddles',        category: 'finished',  basePrice: 35, icon: '🐎', weight: 3 },
    ROPE:             { id: 'rope',             name: 'Rope',           category: 'processed', basePrice: 10, icon: '🪢', weight: 1 },
    HEMP:             { id: 'hemp',             name: 'Hemp',           category: 'raw',       basePrice: 3,  icon: '🌿', weight: 1 },
    CLAY:             { id: 'clay',             name: 'Clay',           category: 'raw',       basePrice: 4,  icon: '🏺', weight: 3 },
    PRESERVED_FOOD:   { id: 'preserved_food',   name: 'Preserved Food', category: 'food',      basePrice: 30, icon: '🥫', weight: 2 },
    LIVESTOCK_COW:    { id: 'livestock_cow',    name: 'Cow',            category: 'livestock', basePrice: 40, icon: '🐄', weight: 8 },
    LIVESTOCK_PIG:    { id: 'livestock_pig',    name: 'Pig',            category: 'livestock', basePrice: 25, icon: '🐷', weight: 4 },
    LIVESTOCK_CHICKEN:{ id: 'livestock_chicken', name: 'Chicken',       category: 'livestock', basePrice: 15, icon: '🐔', weight: 1 },
    POISON:           { id: 'poison',            name: 'Poison',         category: 'contraband', basePrice: 50, icon: '☠️', weight: 0.5 },

    // --- Musical instruments & components ---
    GUT_STRING:       { id: 'gut_string',       name: 'Gut String',     category: 'processed', basePrice: 12,  icon: '🧵', weight: 1 },
    DRUM:             { id: 'drum',             name: 'Drum',           category: 'luxury',    basePrice: 20,  icon: '🥁', weight: 3 },
    FLUTE:            { id: 'flute',            name: 'Flute',          category: 'luxury',    basePrice: 12,  icon: '🪈', weight: 1 },
    LUTE:             { id: 'lute',             name: 'Lute',           category: 'luxury',    basePrice: 25,  icon: '🪕', weight: 2 },
    HARP:             { id: 'harp',             name: 'Harp',           category: 'luxury',    basePrice: 60,  icon: '🎵', weight: 8 },
    HURDY_GURDY:      { id: 'hurdy_gurdy',     name: 'Hurdy-Gurdy',    category: 'luxury',    basePrice: 90,  icon: '🎶', weight: 5 },

    // --- Quality-tiered military goods ---
    SWORDS_GOOD:      { id: 'swords_good',      name: 'Good Swords',      category: 'military', basePrice: 165, icon: '⚔️🔵', weight: 3, tier: 'good',      baseItem: 'swords' },
    SWORDS_EXCELLENT: { id: 'swords_excellent',  name: 'Excellent Swords', category: 'military', basePrice: 495, icon: '⚔️🟣', weight: 3, tier: 'excellent', baseItem: 'swords' },
    ARMOR_GOOD:       { id: 'armor_good',        name: 'Good Armor',       category: 'military', basePrice: 270, icon: '🛡️🔵', weight: 5, tier: 'good',      baseItem: 'armor' },
    ARMOR_EXCELLENT:  { id: 'armor_excellent',    name: 'Excellent Armor',  category: 'military', basePrice: 810, icon: '🛡️🟣', weight: 5, tier: 'excellent', baseItem: 'armor' },
    BOWS_GOOD:        { id: 'bows_good',          name: 'Good Bows',        category: 'military', basePrice: 75,  icon: '🏹🔵', weight: 2, tier: 'good',      baseItem: 'bows' },
    BOWS_EXCELLENT:   { id: 'bows_excellent',     name: 'Excellent Bows',   category: 'military', basePrice: 225, icon: '🏹🟣', weight: 2, tier: 'excellent', baseItem: 'bows' },
    ARROWS_GOOD:      { id: 'arrows_good',        name: 'Good Arrows',      category: 'military', basePrice: 15,  icon: '➳🔵',  weight: 1, tier: 'good',      baseItem: 'arrows' },

    // --- Demolition & Sabotage goods ---
    BLASTING_POWDER:  { id: 'blasting_powder',  name: 'Blasting Powder',  category: 'contraband', basePrice: 40, icon: '💥', weight: 2 },
    DEMOLITION_TOOLS: { id: 'demolition_tools', name: 'Demolition Tools', category: 'military',   basePrice: 55, icon: '⛏️', weight: 4 },

    // --- Fashion & Luxury goods ---
    SILK:             { id: 'silk',             name: 'Silk',            category: 'luxury',    basePrice: 35,  icon: '🧣', weight: 1 },
    PERFUME:          { id: 'perfume',          name: 'Perfume',         category: 'luxury',    basePrice: 45,  icon: '🌸', weight: 1 },
    FINE_CLOTHES:     { id: 'fine_clothes',     name: 'Fine Clothes',    category: 'luxury',    basePrice: 60,  icon: '👗', weight: 3 },
    TAPESTRY:         { id: 'tapestry',         name: 'Tapestry',        category: 'luxury',    basePrice: 80,  icon: '🖼️', weight: 10 },
    GOLD_GOBLET:      { id: 'gold_goblet',      name: 'Gold Goblet',     category: 'luxury',    basePrice: 70,  icon: '🏆', weight: 2 },
    PEARL_JEWELRY:    { id: 'pearl_jewelry',    name: 'Pearl Jewelry',   category: 'luxury',    basePrice: 55,  icon: '📿', weight: 1 },

    // --- Water & Beverages ---
    WATER:            { id: 'water',            name: 'Water',           category: 'beverage',  basePrice: 1,   icon: '💧', weight: 1 },
    ALE:              { id: 'ale',              name: 'Ale',             category: 'beverage',  basePrice: 4,   icon: '🍺', weight: 1 },
    MEAD:             { id: 'mead',             name: 'Mead',            category: 'beverage',  basePrice: 8,   icon: '🍯', weight: 1 },
    CIDER:            { id: 'cider',            name: 'Cider',           category: 'beverage',  basePrice: 5,   icon: '🍎', weight: 1 },
    HERBAL_TEA:       { id: 'herbal_tea',       name: 'Herbal Tea',      category: 'beverage',  basePrice: 6,   icon: '🍵', weight: 1 },
    HONEY:            { id: 'honey',            name: 'Honey',           category: 'raw',       basePrice: 8,   icon: '🍯', weight: 1 },

    // --- Garden / Forage goods ---
    HERBS:            { id: 'herbs',            name: 'Herbs',           category: 'raw',       basePrice: 3,   icon: '🌿', weight: 0.5 },
    VEGETABLES:       { id: 'vegetables',       name: 'Vegetables',      category: 'food',      basePrice: 3,   icon: '🥬', weight: 1 },

    // --- Medical Supplies ---
    BANDAGES:         { id: 'bandages',         name: 'Bandages',        category: 'medical',   basePrice: 5,   icon: '🩹', weight: 0.5 },
    HERBAL_REMEDY:    { id: 'herbal_remedy',    name: 'Herbal Remedy',   category: 'medical',   basePrice: 10,  icon: '🧪', weight: 0.5 },
    HEALING_TONIC:    { id: 'healing_tonic',    name: 'Healing Tonic',   category: 'medical',   basePrice: 18,  icon: '⚗️', weight: 0.5 },
    SPLINT:           { id: 'splint',           name: 'Splint',          category: 'medical',   basePrice: 4,   icon: '🪵', weight: 1 },
    FEVER_TONIC:      { id: 'fever_tonic',      name: 'Fever Tonic',     category: 'medical',   basePrice: 15,  icon: '🌡️', weight: 0.5 },
    ANTIDOTE:         { id: 'antidote',         name: 'Antidote',        category: 'medical',   basePrice: 25,  icon: '💊', weight: 0.5 },
    HERBAL_POULTICE:  { id: 'herbal_poultice',  name: 'Herbal Poultice', category: 'medical',   basePrice: 8,   icon: '🌱', weight: 0.5 },

    // --- Camping & Travel Supplies ---
    BEDROLL:          { id: 'bedroll',          name: 'Bedroll',         category: 'supplies',  basePrice: 8,   icon: '🛏️', weight: 3 },
    TENT:             { id: 'tent',             name: 'Tent',            category: 'supplies',  basePrice: 25,  icon: '⛺', weight: 8 },
    CAMPING_KIT:      { id: 'camping_kit',      name: 'Camping Kit',     category: 'supplies',  basePrice: 45,  icon: '🏕️', weight: 12 },
    WATERSKIN:        { id: 'waterskin',        name: 'Waterskin',       category: 'supplies',  basePrice: 5,   icon: '🫗', weight: 1 },

    // --- Unique Start / Quest Items ---
    EXOTIC_ARTIFACT:  { id: 'exotic_artifact',  name: 'Exotic Artifact', category: 'quest',     basePrice: 800, icon: '🔮', weight: 1 },
};

// ============================================================
// Building Types & Production Recipes
// ============================================================

const BUILDING_TYPES = {
    WHEAT_FARM:    { id: 'wheat_farm',    name: 'Wheat Farm',    cost: 200,  workers: 3, produces: 'wheat',    consumes: {},                       rate: 8, category: 'farm',       storage: 80, materials: { wood: 10, stone: 5 } },
    CATTLE_RANCH:  { id: 'cattle_ranch',  name: 'Cattle Ranch',  cost: 350,  workers: 3, produces: 'meat',     consumes: { wheat: 2 },             rate: 4, category: 'farm',       storage: 60, canProduce: ['meat', 'hide'], materials: { wood: 15, planks: 5 } },
    SHEEP_FARM:    { id: 'sheep_farm',    name: 'Sheep Farm',    cost: 250,  workers: 2, produces: 'wool',     consumes: { wheat: 1 },             rate: 5, category: 'farm',       storage: 60, materials: { wood: 10, stone: 3 } },
    CHICKEN_FARM:  { id: 'chicken_farm',  name: 'Chicken Farm',  cost: 150,  workers: 2, produces: 'eggs',     consumes: { wheat: 1 },             rate: 10, category: 'farm',      storage: 60, materials: { wood: 8 } },
    IRON_MINE:     { id: 'iron_mine',     name: 'Iron Mine',     cost: 500,  workers: 5, produces: 'iron_ore', consumes: {},                       rate: 5, category: 'mine',       storage: 80, materials: { wood: 20, stone: 15, tools: 3 } },
    GOLD_MINE:     { id: 'gold_mine',     name: 'Gold Mine',     cost: 800,  workers: 5, produces: 'gold_ore', consumes: {},                       rate: 2, category: 'mine',       storage: 40, materials: { wood: 25, stone: 20, tools: 5, iron: 3 } },
    LUMBER_CAMP:   { id: 'lumber_camp',   name: 'Lumber Camp',   cost: 200,  workers: 4, produces: 'wood',     consumes: {},                       rate: 7, category: 'harvest',    storage: 100, materials: { stone: 5, tools: 2 } },
    QUARRY:        { id: 'quarry',        name: 'Quarry',        cost: 400,  workers: 4, produces: 'stone',    consumes: {},                       rate: 4, category: 'mine',       storage: 80, materials: { wood: 15, tools: 3 } },
    VINEYARD:      { id: 'vineyard',      name: 'Vineyard',      cost: 400,  workers: 3, produces: 'grapes',   consumes: {},                       rate: 4, category: 'farm',       storage: 60, materials: { wood: 12, stone: 5 } },
    HORSE_RANCH:   { id: 'horse_ranch',   name: 'Horse Ranch',   cost: 600,  workers: 3, produces: 'horses',   consumes: { wheat: 3 },             rate: 2, category: 'farm',       storage: 30, materials: { wood: 20, planks: 8, stone: 5 } },
    FLOUR_MILL:    { id: 'flour_mill',    name: 'Flour Mill',    cost: 300,  workers: 2, produces: 'flour',    consumes: { wheat: 3 },             rate: 6, category: 'processing', storage: 60, materials: { wood: 12, stone: 10 } },
    SMELTER:       { id: 'smelter',       name: 'Smelter',       cost: 400,  workers: 3, produces: 'iron',     consumes: { iron_ore: 2, wood: 1 }, rate: 4, category: 'processing', storage: 60, materials: { stone: 20, bricks: 5, iron: 2 } },
    SAWMILL:       { id: 'sawmill',       name: 'Sawmill',       cost: 250,  workers: 2, produces: 'planks',   consumes: { wood: 2 },              rate: 5, category: 'processing', storage: 60, materials: { wood: 10, stone: 5, iron: 1 } },
    WEAVER:        { id: 'weaver',        name: 'Weaver',        cost: 300,  workers: 2, produces: 'cloth',    consumes: { wool: 2 },              rate: 5, category: 'processing', storage: 50, materials: { wood: 10, planks: 5 }, canProduce: ['cloth', 'rope', 'rope_from_cloth'],
        availableProducts: {
            cloth: { produces: 'cloth', consumes: { wool: 2 },  rate: 5 },
            rope:  { produces: 'rope',  consumes: { hemp: 3 },  rate: 5 },
            rope_from_cloth: { produces: 'rope', consumes: { cloth: 4 }, rate: 4, name: 'Rope (from Cloth)' },
        },
    },
    TANNER:        { id: 'tanner',        name: 'Tanner',        cost: 300,  workers: 2, produces: 'leather',  consumes: { hide: 2 },              rate: 4, category: 'processing', storage: 50, materials: { wood: 10, stone: 5 } },
    BAKERY:        { id: 'bakery',        name: 'Bakery',        cost: 350,  workers: 2, produces: 'bread',    consumes: { flour: 4 },             rate: 24, category: 'finished',  storage: 80, materials: { wood: 8, stone: 10, bricks: 3 } },
    BUTCHER:       { id: 'butcher',       name: 'Butcher',       cost: 200,  workers: 1, produces: 'poultry',  consumes: { livestock_chicken: 2 }, rate: 4, category: 'finished',   storage: 40, materials: { wood: 8, stone: 5 } },
    TAILOR:        { id: 'tailor',        name: 'Tailor',        cost: 400,  workers: 2, produces: 'clothes',  consumes: { cloth: 2, leather: 1 }, rate: 3, category: 'finished',   storage: 40, materials: { wood: 10, planks: 5 }, canProduce: ['clothes', 'saddles'],
        availableProducts: {
            clothes: { produces: 'clothes', consumes: { cloth: 2, leather: 1 }, rate: 3 },
            saddles: { produces: 'saddles', consumes: { leather: 2, wood: 1 },  rate: 3 },
        },
    },
    TOOLSMITH:     { id: 'toolsmith',     name: 'Toolsmith',     cost: 400,  workers: 2, produces: 'tools',    consumes: { iron: 1, wood: 1 },     rate: 3, category: 'finished',   storage: 40, materials: { stone: 10, iron: 3 } },
    WINERY:        { id: 'winery',        name: 'Winery',        cost: 500,  workers: 2, produces: 'wine',     consumes: { grapes: 3 },            rate: 3, category: 'finished',   storage: 50, materials: { wood: 15, stone: 10, planks: 5 } },
    JEWELER:       { id: 'jeweler',       name: 'Jeweler',       cost: 600,  workers: 1, produces: 'jewelry',  consumes: { gold_ore: 1 },          rate: 2, category: 'finished',   storage: 30, materials: { stone: 10, planks: 5, iron: 2 }, canProduce: ['jewelry', 'pearl_jewelry'],
        availableProducts: {
            jewelry:       { produces: 'jewelry',       consumes: { gold_ore: 1 },          rate: 2 },
            pearl_jewelry: { produces: 'pearl_jewelry', consumes: { gold_ore: 1, pearls: 1 }, rate: 2 },
        },
    },
    BLACKSMITH:    { id: 'blacksmith',    name: 'Blacksmith',    cost: 600,  workers: 3, produces: 'swords',   consumes: { iron: 2, wood: 1 },     rate: 3, category: 'military',   storage: 50, materials: { stone: 20, iron: 5, bricks: 10 }, canProduce: ['swords', 'swords_good', 'swords_excellent', 'tools', 'iron', 'demolition_tools'],
        availableProducts: {
            swords:           { produces: 'swords',           consumes: { iron: 2, wood: 1 },              rate: 3 },
            swords_good:      { produces: 'swords_good',      consumes: { iron: 3, wood: 2 },              rate: 2 },
            swords_excellent: { produces: 'swords_excellent',  consumes: { iron: 5, wood: 3 },              rate: 1 },
            tools:            { produces: 'tools',            consumes: { iron: 1, wood: 1 },              rate: 3 },
            iron:             { produces: 'iron',             consumes: { iron_ore: 2, wood: 1 },          rate: 4 },
            demolition_tools: { produces: 'demolition_tools', consumes: { iron: 3, rope: 2, wood: 3 },    rate: 1 },
        },
    },
    ARMORER:       { id: 'armorer',       name: 'Armorer',       cost: 700,  workers: 3, produces: 'armor',    consumes: { iron: 3, leather: 2 },  rate: 2, category: 'military',   storage: 40, materials: { stone: 20, iron: 8, bricks: 10 }, canProduce: ['armor', 'armor_good', 'armor_excellent'],
        availableProducts: {
            armor:            { produces: 'armor',            consumes: { iron: 3, leather: 2 },           rate: 2 },
            armor_good:       { produces: 'armor_good',       consumes: { iron: 5, leather: 3 },           rate: 1 },
            armor_excellent:  { produces: 'armor_excellent',   consumes: { iron: 8, leather: 5 },           rate: 1 },
        },
    },
    WAREHOUSE:     { id: 'warehouse',     name: 'Warehouse',     cost: 500,  workers: 1, produces: null,       consumes: {},                       rate: 0, category: 'storage',    storage: 800, materials: { wood: 20, stone: 10, planks: 10, bricks: 5 } },
    MARKET_STALL:  { id: 'market_stall',  name: 'Market Stall',  cost: 150,  workers: 1, produces: null,       consumes: {},                       rate: 0, category: 'trade',      salesBonus: 0.1, materials: { wood: 8, planks: 3 } },
    DOCK:          { id: 'dock',          name: 'Dock',          cost: 400,  workers: 2, produces: null,       consumes: {},                       rate: 0, category: 'port',       portBonus: true, materials: { wood: 25, planks: 10, rope: 5 } },
    FISHERY:       { id: 'fishery',       name: 'Fishery',       cost: 250,  workers: 3, produces: 'fish',     consumes: {},                       rate: 8, category: 'port',       storage: 80, materials: { wood: 12, rope: 3 } },
    SALT_WORKS:    { id: 'salt_works',    name: 'Salt Works',    cost: 300,  workers: 2, produces: 'salt',     consumes: {},                       rate: 5, category: 'port',       storage: 60, materials: { wood: 10, stone: 10, bricks: 3 } },
    // --- New buildings ---
    FLETCHER:      { id: 'fletcher',      name: 'Fletcher',      cost: 400,  workers: 2, produces: 'bows',           consumes: { wood: 2, hemp: 1 },        rate: 3, category: 'military',   storage: 40, materials: { wood: 12, stone: 8 }, canProduce: ['bows', 'bows_good', 'bows_excellent'],
        availableProducts: {
            bows:             { produces: 'bows',             consumes: { wood: 2, hemp: 1 },              rate: 3 },
            bows_good:        { produces: 'bows_good',        consumes: { wood: 3, hemp: 2 },              rate: 2 },
            bows_excellent:   { produces: 'bows_excellent',   consumes: { wood: 5, hemp: 3 },              rate: 1 },
        },
    },
    ARROW_MAKER:   { id: 'arrow_maker',   name: 'Arrow Maker',   cost: 250,  workers: 2, produces: 'arrows',         consumes: { wood: 1, iron: 1 },        rate: 8, category: 'military',   storage: 60, materials: { wood: 10, stone: 5 }, canProduce: ['arrows', 'arrows_good'],
        availableProducts: {
            arrows:           { produces: 'arrows',           consumes: { wood: 1, iron: 1 },              rate: 8 },
            arrows_good:      { produces: 'arrows_good',      consumes: { wood: 2, iron: 2 },              rate: 5 },
        },
    },
    CARPENTER:     { id: 'carpenter',     name: 'Carpenter',     cost: 450,  workers: 2, produces: 'furniture',       consumes: { planks: 3 },               rate: 2, category: 'finished',   storage: 40, materials: { wood: 15, planks: 8, stone: 5 }, canProduce: ['furniture', 'planks'],
        availableProducts: {
            furniture: { produces: 'furniture', consumes: { planks: 3 },  rate: 2 },
            planks:    { produces: 'planks',    consumes: { wood: 2 },    rate: 5 },
        },
    },
    BRICK_KILN:    { id: 'brick_kiln',    name: 'Brick Kiln',    cost: 300,  workers: 2, produces: 'bricks',         consumes: { clay: 3, wood: 1 },        rate: 5, category: 'processing', storage: 60, materials: { stone: 15, wood: 10 } },
    SADDLER:       { id: 'saddler',       name: 'Saddler',       cost: 400,  workers: 2, produces: 'saddles',        consumes: { leather: 2, wood: 1 },     rate: 3, category: 'finished',   storage: 40, materials: { wood: 10, planks: 5, stone: 5 } },
    WHEELWRIGHT:   { id: 'wheelwright',   name: 'Wheelwright',   cost: 500,  workers: 3, produces: 'cart',           consumes: { planks: 3, iron: 1 },      rate: 2, category: 'finished',   storage: 30, materials: { wood: 15, planks: 8, iron: 5, stone: 5 },
        canProduce: ['cart', 'small_wagon', 'wagon', 'large_wagon'],
        availableProducts: {
            cart:         { produces: 'cart',         consumes: { planks: 3, iron: 1 },                     rate: 2 },
            small_wagon:  { produces: 'small_wagon',  consumes: { planks: 5, iron: 2, rope: 1 },            rate: 1 },
            wagon:        { produces: 'wagon',        consumes: { planks: 8, iron: 3, rope: 2, leather: 2 }, rate: 1 },
            large_wagon:  { produces: 'large_wagon',  consumes: { planks: 12, iron: 5, rope: 3, leather: 3 }, rate: 1 },
        },
    },
    ROPE_MAKER:    { id: 'rope_maker',    name: 'Rope Maker',    cost: 200,  workers: 1, produces: 'rope',           consumes: { hemp: 3 },                 rate: 5, category: 'processing', storage: 50, materials: { wood: 8 }, canProduce: ['rope', 'rope_from_cloth'],
        availableProducts: {
            rope:  { produces: 'rope',  consumes: { hemp: 3 },  rate: 5 },
            rope_from_cloth: { produces: 'rope', consumes: { cloth: 4 }, rate: 4, name: 'Rope (from Cloth)' },
        },
    },
    HEMP_FARM:     { id: 'hemp_farm',     name: 'Hemp Farm',     cost: 180,  workers: 2, produces: 'hemp',           consumes: {},                          rate: 7, category: 'farm',       storage: 80, materials: { wood: 8, stone: 3 } },
    HERB_GARDEN:   { id: 'herb_garden',   name: 'Herb Garden',   cost: 150,  workers: 1, produces: 'herbs',          consumes: {},                          rate: 5, category: 'farm',       storage: 50, materials: { wood: 6, clay: 2 }, icon: '🌿', description: 'Cultivates medicinal herbs. Output affected by soil fertility and season.' },
    BANDAGE_WORKSHOP: { id: 'bandage_workshop', name: 'Bandage Workshop', cost: 250, workers: 1, produces: 'bandages', consumes: { cloth: 2 },              rate: 4, category: 'medical',   storage: 40, materials: { wood: 8, cloth: 5 }, icon: '🩹', description: 'Produces bandages from cloth.',
        canProduce: ['bandages', 'splint', 'herbal_poultice'],
        availableProducts: {
            bandages:        { produces: 'bandages',        consumes: { cloth: 2 },                 rate: 4 },
            splint:          { produces: 'splint',          consumes: { wood: 1 },                  rate: 5 },
            herbal_poultice: { produces: 'herbal_poultice', consumes: { herbs: 2, cloth: 1 },       rate: 3 },
        },
    },
    CLAY_PIT:      { id: 'clay_pit',      name: 'Clay Pit',      cost: 200,  workers: 3, produces: 'clay',           consumes: {},                          rate: 6, category: 'mine',       storage: 80, materials: { wood: 8, tools: 2 } },
    SMOKEHOUSE:    { id: 'smokehouse',    name: 'Smokehouse',    cost: 300,  workers: 2, produces: 'preserved_food', consumes: { meat: 2, salt: 1 },        rate: 4, category: 'processing', storage: 50, materials: { wood: 12, stone: 8, bricks: 3 } },
    PIG_FARM:      { id: 'pig_farm',      name: 'Pig Farm',      cost: 200,  workers: 2, produces: 'meat',           consumes: { wheat: 2 },                rate: 5, category: 'farm',       storage: 60, materials: { wood: 10, stone: 3 } },
    PASTURE:       { id: 'pasture',       name: 'Pasture',       cost: 100,  workers: 1, produces: null,             consumes: { wheat: 1 },                rate: 0, category: 'farm',       livestockCapacity: 10, materials: { wood: 5 } },
    WATCHTOWER:    { id: 'watchtower',    name: 'Watchtower',    cost: 500,  workers: 2, produces: null,             consumes: {},                          rate: 0, category: 'military',   archerBonus: 0.5, materials: { stone: 30, wood: 15, bricks: 15 } },
    BARRACKS:      { id: 'barracks',      name: 'Barracks',      cost: 600,  workers: 3, produces: null,             consumes: {},                          rate: 0, category: 'military',   recruitBonus: 2,  materials: { stone: 40, wood: 30, bricks: 10 } },
    ARMORY:        { id: 'armory',        name: 'Armory',        cost: 700,  workers: 2, produces: null,             consumes: {},                          rate: 0, category: 'military',   storageBonus: 50, materials: { stone: 50, iron: 20, bricks: 15 } },
    // --- Kingdom military buildings ---
    CASTLE:           { id: 'castle',           name: 'Castle',           cost: 3000, workers: 10, produces: null, consumes: {}, rate: 0, category: 'military',  defenseBonus: 0.50, capitalOnly: true, materials: { stone: 200, iron: 50 } },
    TRAINING_GROUNDS: { id: 'training_grounds', name: 'Training Grounds', cost: 800,  workers: 4,  produces: null, consumes: {}, rate: 0, category: 'military',  combatBonus: 0.30, materials: { wood: 100, iron: 20 } },
    SIEGE_WORKSHOP:   { id: 'siege_workshop',   name: 'Siege Workshop',   cost: 1000, workers: 5,  produces: null, consumes: {}, rate: 0, category: 'military',  siegeBonus: 1.0, materials: { wood: 150, iron: 80 } },
    STABLES:          { id: 'stables',          name: 'Stables',          cost: 600,  workers: 3,  produces: null, consumes: { wheat: 2 }, rate: 0, category: 'military',  cavalryCapacity: 20, materials: { wood: 120, leather: 30 } },
    // --- Kingdom civic/economic buildings ---
    HOSPITAL:         { id: 'hospital',         name: 'Hospital',         cost: 1200, workers: 10, produces: null, consumes: {}, rate: 0, category: 'medical',   plagueReduction: 0.50, happinessBonus: 5, materials: { wood: 80, cloth: 30, stone: 40 }, icon: '🏥',
        landSlots: 3, maxHealers: 10, medicalStorage: 200, storage: 200, description: 'Large medical facility. Treats injuries and illnesses. Consumes medical supplies.',
        healingConfig: {
            minor:    { ticks: 30,  supplies: { bandages: 1 } },
            moderate: { ticks: 60,  supplies: { bandages: 1, herbal_remedy: 1 } },
            serious:  { ticks: 120, supplies: { healing_tonic: 1, bandages: 2 } },
            severe:   { ticks: 240, supplies: { healing_tonic: 1, antidote: 1, bandages: 2 } },
        },
    },
    // CLINIC moved to service section below (merged civic + service properties)
    GRANARY:          { id: 'granary',          name: 'Granary',          cost: 500,  workers: 2,  produces: null, consumes: {}, rate: 0, category: 'civic',     foodStorage: 500, materials: { wood: 100 } },
    TREASURY_VAULT:   { id: 'treasury_vault',   name: 'Treasury Vault',   cost: 1500, workers: 3,  produces: null, consumes: {}, rate: 0, category: 'civic',     taxEfficiency: 0.10, materials: { stone: 100, iron: 50 } },
    COURTHOUSE:       { id: 'courthouse',       name: 'Courthouse',       cost: 800,  workers: 3,  produces: null, consumes: {}, rate: 0, category: 'civic',     crimeReduction: 0.30, happinessBonus: 3, materials: { stone: 80, wood: 20 } },
    GUILD_HALL:       { id: 'guild_hall',       name: 'Guild Hall',       cost: 700,  workers: 3,  produces: null, consumes: {}, rate: 0, category: 'civic',     tradeBonus: 0.15, materials: { wood: 60, stone: 30 } },
    MARKETPLACE_ROYAL:{ id: 'marketplace_royal',name: 'Royal Marketplace',cost: 600,  workers: 3,  produces: null, consumes: {}, rate: 0, category: 'civic',     tradeVolumeBonus: 0.20, materials: { wood: 50, stone: 20 } },
    CATHEDRAL:        { id: 'cathedral',        name: 'Cathedral',        cost: 2000, workers: 5,  produces: null, consumes: {}, rate: 0, category: 'civic',     happinessBonus: 10, unrestReduction: 0.30, materials: { stone: 200, wood: 50 } },
    UNIVERSITY:       { id: 'university',       name: 'University',       cost: 1500, workers: 6,  produces: null, consumes: {}, rate: 0, category: 'civic',     knowledgeBonus: 1, happinessBonus: 3, materials: { stone: 100, wood: 60 } },
    PORT_FORTRESS:    { id: 'port_fortress',    name: 'Port Fortress',    cost: 1200, workers: 5,  produces: null, consumes: {}, rate: 0, category: 'military',  navalDefense: 0.50, portOnly: true, materials: { stone: 150, iron: 40 } },
    WALL_UPGRADE:     { id: 'wall_upgrade',     name: 'Wall Upgrade',     cost: 800,  workers: 4,  produces: null, consumes: {}, rate: 0, category: 'military',  siegeDefense: 0.40, materials: { stone: 150, iron: 30 } },
    // --- Musical instrument production ---
    STRING_MAKER:  { id: 'string_maker',  name: 'String Maker',  cost: 150,  workers: 1, produces: 'gut_string',    consumes: { hide: 2 },                 rate: 3, category: 'processing', storage: 30, materials: { wood: 5, stone: 3 } },
    DRUM_MAKER:    { id: 'drum_maker',    name: 'Drum Maker',    cost: 200,  workers: 2, produces: 'drum',          consumes: { wood: 1, leather: 1 },     rate: 3, category: 'finished',   storage: 30, materials: { wood: 8, stone: 3 } },
    INSTRUMENT_WORKSHOP: { id: 'instrument_workshop', name: 'Instrument Workshop', cost: 500, workers: 2,
        produces: 'lute',
        consumes: { wood: 2, gut_string: 1 },
        rate: 2, category: 'finished',
        storage: 30,
        materials: { planks: 15, iron: 3 },
        icon: '🎵',
        canProduce: ['lute', 'flute', 'drum', 'harp', 'hurdy_gurdy'],
        availableProducts: {
            flute:       { produces: 'flute',       consumes: { wood: 1 },                         rate: 4 },
            lute:        { produces: 'lute',        consumes: { wood: 2, gut_string: 1 },          rate: 2 },
            drum:        { produces: 'drum',        consumes: { wood: 1, leather: 1 },             rate: 3 },
            harp:        { produces: 'harp',        consumes: { wood: 2, gut_string: 2, iron: 1 }, rate: 1 },
            hurdy_gurdy: { produces: 'hurdy_gurdy', consumes: { wood: 3, iron: 2, gut_string: 2 }, rate: 1 },
        },
    },
    // --- Luxury production buildings ---
    SILK_WEAVER:      { id: 'silk_weaver',      name: 'Silk Weaver',     cost: 600,  workers: 2, produces: 'silk',         consumes: { wool: 2 },                  rate: 2, category: 'luxury',     storage: 30, materials: { planks: 10, cloth: 5 }, icon: '🧣' },
    PERFUMERY:        { id: 'perfumery',        name: 'Perfumery',       cost: 500,  workers: 1, produces: 'perfume',      consumes: { grapes: 2, hemp: 1 },       rate: 1, category: 'luxury',     storage: 20, materials: { planks: 8, bricks: 3 }, icon: '🌸' },
    FINE_TAILOR:      { id: 'fine_tailor',      name: 'Fine Tailor',     cost: 700,  workers: 2, produces: 'fine_clothes', consumes: { silk: 1, cloth: 2 },        rate: 1, category: 'luxury',     storage: 20, materials: { planks: 12, cloth: 5 }, icon: '👗' },
    TAPESTRY_LOOM:    { id: 'tapestry_loom',    name: 'Tapestry Loom',   cost: 800,  workers: 3, produces: 'tapestry',    consumes: { silk: 2, cloth: 3 },        rate: 1, category: 'luxury',     storage: 20, materials: { planks: 15, iron: 3 }, icon: '🖼️' },
    GOLDSMITH:        { id: 'goldsmith',        name: 'Goldsmith',       cost: 900,  workers: 2, produces: 'gold_goblet', consumes: { gold_ore: 2 },              rate: 1, category: 'luxury',     storage: 20, materials: { planks: 10, stone: 5, iron: 3 }, icon: '🏆' },
    // --- Tree Plantation ---
    TREE_PLANTATION:  { id: 'tree_plantation',  name: 'Tree Plantation', cost: 200,  workers: 2, produces: null,           consumes: {},                           rate: 0, category: 'harvest',    materials: { planks: 5 }, icon: '🌲', description: 'Replants trees, regenerating wood deposits (+10/day per worker). Can create new forests.' },
    // --- Warehouse tiers ---
    WAREHOUSE_SMALL:  { id: 'warehouse_small',  name: 'Small Warehouse',  cost: 200,  workers: 1, produces: null,          consumes: {},                           rate: 0, category: 'storage',    storage: 400, materials: { planks: 8, bricks: 3 }, icon: '📦', description: 'Storage for 400 weight units' },
    WAREHOUSE_LARGE:  { id: 'warehouse_large',  name: 'Large Warehouse',  cost: 1200, workers: 3, produces: null,          consumes: {},                           rate: 0, category: 'storage',    storage: 1200, materials: { planks: 30, bricks: 15, iron: 5, stone: 8 }, icon: '🏭', description: 'Massive storage for 1200 weight units' },
    TRANSPORT_GUILD:  { id: 'transport_guild',  name: 'Transport Guild Hall', cost: 800, workers: 4, produces: null,       consumes: {},                           rate: 0, category: 'trade',      materials: { wood: 25, stone: 15, planks: 10 }, icon: '🚚', description: 'Transporters handle goods delivery between your buildings automatically.' },
    // --- Goods audit buildings ---
    PEARL_DIVER:      { id: 'pearl_diver',      name: 'Pearl Diver',     cost: 350,  workers: 2, produces: 'pearls',         consumes: {},                          rate: 2, category: 'harvest',    storage: 20, portOnly: true, materials: { wood: 12, rope: 3 } },
    APOTHECARY:       { id: 'apothecary',       name: 'Apothecary',      cost: 400,  workers: 1, produces: 'herbal_remedy',  consumes: { herbs: 3 },                rate: 2, category: 'medical',   storage: 30, materials: { wood: 8, stone: 5 }, icon: '⚗️', description: 'Produces medicines and remedies from herbs. Healing Tonic requires level 3+. Antidotes require an Advanced Apothecary.',
        canProduce: ['herbal_remedy', 'herbal_poultice', 'healing_tonic', 'fever_tonic', 'poison', 'blasting_powder'],
        availableProducts: {
            herbal_remedy:   { produces: 'herbal_remedy',   consumes: { herbs: 3 },                 rate: 2 },
            herbal_poultice: { produces: 'herbal_poultice', consumes: { herbs: 2, cloth: 1 },       rate: 2 },
            healing_tonic:   { produces: 'healing_tonic',   consumes: { herbs: 4, honey: 1 },       rate: 1, minLevel: 3 },
            fever_tonic:     { produces: 'fever_tonic',     consumes: { herbs: 3, water: 2 },       rate: 1 },
            poison:          { produces: 'poison',          consumes: { hemp: 2 },                  rate: 1 },
            blasting_powder: { produces: 'blasting_powder', consumes: { salt: 4, hemp: 2 },         rate: 2 },
        },
    },
    ADVANCED_APOTHECARY: { id: 'advanced_apothecary', name: 'Advanced Apothecary', cost: 800, workers: 3, produces: 'healing_tonic', consumes: { herbs: 4, honey: 1 }, rate: 2, category: 'medical', storage: 60, materials: { stone: 15, wood: 12, planks: 8, iron: 3 }, icon: '🧬', description: 'A full-service medical laboratory. Produces all medicines including antidotes and tonics at higher rates.', minTownCategory: 'town',
        canProduce: ['herbal_remedy', 'herbal_poultice', 'healing_tonic', 'fever_tonic', 'splint', 'antidote', 'poison', 'blasting_powder'],
        availableProducts: {
            herbal_remedy:   { produces: 'herbal_remedy',   consumes: { herbs: 3 },                 rate: 3 },
            herbal_poultice: { produces: 'herbal_poultice', consumes: { herbs: 2, cloth: 1 },       rate: 3 },
            healing_tonic:   { produces: 'healing_tonic',   consumes: { herbs: 4, honey: 1 },       rate: 2 },
            fever_tonic:     { produces: 'fever_tonic',     consumes: { herbs: 3, water: 2 },       rate: 2 },
            splint:          { produces: 'splint',          consumes: { wood: 2, cloth: 1 },        rate: 3 },
            antidote:        { produces: 'antidote',        consumes: { herbs: 5, honey: 2 },       rate: 2 },
            poison:          { produces: 'poison',          consumes: { hemp: 2 },                  rate: 2 },
            blasting_powder: { produces: 'blasting_powder', consumes: { salt: 4, hemp: 2 },         rate: 3 },
        },
    },
    HUNTING_LODGE:    { id: 'hunting_lodge',    name: 'Hunting Lodge',   cost: 250,  workers: 2, produces: 'hide',           consumes: {},                          rate: 4, category: 'harvest',    storage: 50, materials: { wood: 15 } },
    // --- Water & Beverage Buildings ---
    WELL:             { id: 'well',             name: 'Well',            cost: 2000, workers: 0, produces: 'water',          consumes: {},                          rate: 15, category: 'civic',     storage: 50, materials: { stone: 10, wood: 5 }, icon: '🪣', description: 'Draws fresh water. Free water for townsfolk. Water supply depends on local soil fertility.', noLandRequired: true },
    CISTERN:          { id: 'cistern',          name: 'Cistern',         cost: 200,  workers: 0, produces: 'water',          consumes: {},                          rate: 8,  category: 'civic',     storage: 40, materials: { stone: 15, bricks: 10, clay: 5 }, icon: '🏛️', description: 'Stores rainwater. Supplements well output.' },
    BREWERY:          { id: 'brewery',          name: 'Brewery',         cost: 400,  workers: 3, produces: 'ale',            consumes: { wheat: 3, water: 2 },      rate: 6,  category: 'finished',  storage: 60, materials: { wood: 15, stone: 10, bricks: 5 }, icon: '🍺', description: 'Brews ale from wheat and water.',
        canProduce: ['ale', 'mead', 'cider'],
        availableProducts: {
            ale:   { produces: 'ale',   consumes: { wheat: 3, water: 2 },  rate: 6 },
            mead:  { produces: 'mead',  consumes: { honey: 2, water: 1 },  rate: 3 },
            cider: { produces: 'cider', consumes: { grapes: 2, water: 1 }, rate: 4 },
        },
    },
    TAVERN:           { id: 'tavern',           name: 'Tavern',          cost: 350,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'retail',    materials: { wood: 12, stone: 8, planks: 5 }, icon: '🍻', description: 'Serves drinks at premium prices. NPCs visit for fun. +3 town happiness.', happinessBonus: 3, restAvailable: true,
        retailConfig: {
            acceptsGoods: ['ale', 'mead', 'wine', 'cider', 'water'],
            baseMarkup: 1.5,
            maxMarkup: 2.5,
            maxCustomersPerDay: 5,
            maxStock: 50,
            npcMotivation: 'happiness',
            repPerSale: 0.2,
            upgradeMarkupBonus: 0.15,
        },
    },
    APIARY:           { id: 'apiary',           name: 'Apiary',          cost: 150,  workers: 1, produces: 'honey',          consumes: {},                          rate: 4,  category: 'farm',      storage: 40, materials: { wood: 8, planks: 3 }, icon: '🐝', description: 'Keeps bees for honey production.' },
    HERBALIST_HUT:    { id: 'herbalist_hut',    name: 'Herbalist Hut',   cost: 200,  workers: 1, produces: 'herbal_tea',     consumes: { hemp: 1, water: 1 },       rate: 3,  category: 'finished',  storage: 30, materials: { wood: 10, clay: 3 }, icon: '🌿', description: 'Brews herbal teas and medicinal infusions.' },
    // --- Retail & Service Buildings (player stocks, NPCs buy at markup) ---
    RESTAURANT:       { id: 'restaurant',       name: 'Restaurant',      cost: 450,  workers: 3, produces: null,             consumes: {},                          rate: 0,  category: 'retail',    materials: { wood: 15, stone: 10, planks: 8, bricks: 5 }, icon: '🍽️', description: 'Serves prepared meals at premium prices. Hungry NPCs prefer dining here.',
        retailConfig: {
            acceptsGoods: ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'],
            baseMarkup: 1.3,
            maxMarkup: 2.0,
            maxCustomersPerDay: 8,
            maxStock: 60,
            npcMotivation: 'hunger',
            repPerSale: 0.1,
            upgradeMarkupBonus: 0.12,
        },
    },
    CLOTHING_SHOP:    { id: 'clothing_shop',    name: 'Clothing Shop',   cost: 500,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'retail',    materials: { planks: 12, stone: 8, cloth: 5 }, icon: '👕', description: 'Sells clothing and fashion to townsfolk. Wealthier NPCs pay more.',
        retailConfig: {
            acceptsGoods: ['clothes', 'fine_clothes', 'silk', 'leather'],
            baseMarkup: 1.4,
            maxMarkup: 2.0,
            maxCustomersPerDay: 4,
            maxStock: 40,
            npcMotivation: 'need',
            repPerSale: 0.15,
            upgradeMarkupBonus: 0.10,
        },
    },
    ARMORY_SHOP:      { id: 'armory_shop',      name: 'Armory',          cost: 700,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'retail',    materials: { stone: 15, iron: 5, planks: 10 }, icon: '🗡️', description: 'Sells weapons and armor. Soldiers, guards, and adventurers pay premium prices.',
        retailConfig: {
            acceptsGoods: ['swords', 'swords_good', 'swords_excellent', 'armor', 'armor_good', 'armor_excellent', 'bows', 'bows_good', 'bows_excellent', 'arrows', 'arrows_good'],
            baseMarkup: 1.3,
            maxMarkup: 1.8,
            maxCustomersPerDay: 3,
            maxStock: 30,
            npcMotivation: 'need',
            repPerSale: 0.2,
            upgradeMarkupBonus: 0.08,
        },
    },
    JEWELERS_BOUTIQUE: { id: 'jewelers_boutique', name: 'Jeweler\'s Boutique', cost: 900, workers: 2, produces: null,      consumes: {},                          rate: 0,  category: 'retail',    materials: { stone: 12, planks: 10, iron: 3 }, icon: '💍', description: 'Sells fine jewelry and luxury items. Wealthy NPCs pay handsomely.', minTownCategory: 'city',
        retailConfig: {
            acceptsGoods: ['jewelry', 'pearl_jewelry', 'gold_goblet', 'perfume'],
            baseMarkup: 1.5,
            maxMarkup: 3.0,
            maxCustomersPerDay: 2,
            maxStock: 20,
            npcMotivation: 'luxury',
            repPerSale: 0.3,
            upgradeMarkupBonus: 0.20,
        },
    },
    GENERAL_STORE:    { id: 'general_store',    name: 'General Store',   cost: 300,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'retail',    materials: { wood: 12, planks: 8, stone: 5 }, icon: '📦', description: 'Sells everyday goods. Steady business, modest markup.',
        retailConfig: {
            acceptsGoods: ['tools', 'furniture', 'saddles', 'rope', 'salt', 'bricks', 'cloth'],
            baseMarkup: 1.2,
            maxMarkup: 1.5,
            maxCustomersPerDay: 6,
            maxStock: 80,
            npcMotivation: 'need',
            repPerSale: 0.1,
            upgradeMarkupBonus: 0.05,
        },
    },
    CLINIC:           { id: 'clinic',           name: 'Clinic',          cost: 500,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'medical',   plagueReduction: 0.20, happinessBonus: 2, materials: { planks: 10, stone: 10, bricks: 5 }, icon: '🏥', description: 'Small medical facility. Treats sick and injured. Stock with medical supplies.',
        landSlots: 1, maxHealers: 2, medicalStorage: 40, storage: 40,
        healingConfig: {
            minor:    { ticks: 30,  supplies: { bandages: 1 } },
            moderate: { ticks: 60,  supplies: { bandages: 1, herbal_remedy: 1 } },
            serious:  { ticks: 120, supplies: { healing_tonic: 1, bandages: 2 } },
            severe:   { ticks: 240, supplies: { healing_tonic: 1, antidote: 1, bandages: 2 } },
        },
        retailConfig: {
            acceptsGoods: ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'fever_tonic', 'antidote', 'splint', 'herbal_tea', 'water'],
            baseMarkup: 2.0,
            maxMarkup: 4.0,
            maxCustomersPerDay: 6,
            maxStock: 40,
            npcMotivation: 'health',
            repPerSale: 0.5,
            upgradeMarkupBonus: 0.25,
            consumesPerService: { bandages: 1, water: 1 },
            serviceFee: 12,
        },
    },
    BATHHOUSE:        { id: 'bathhouse',        name: 'Bathhouse',       cost: 400,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'service',   materials: { stone: 15, bricks: 10, clay: 5 }, icon: '🛁', description: 'NPCs wash here for hygiene. Reduces plague risk in town. Uses water.',
        retailConfig: {
            acceptsGoods: ['water', 'hemp'],
            baseMarkup: 1.0,
            maxMarkup: 1.0,
            maxCustomersPerDay: 10,
            maxStock: 40,
            npcMotivation: 'hygiene',
            repPerSale: 0.15,
            upgradeMarkupBonus: 0.0,
            consumesPerService: { water: 2 },
            serviceFee: 3,
            plagueReduction: 0.15,
        },
    },
    // --- Camping & Travel Supply Production ---
    CANVAS_WORKSHOP:  { id: 'canvas_workshop',  name: 'Canvas Workshop', cost: 250,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'finished',  materials: { wood: 10, planks: 6 }, icon: '🧵', description: 'Produces bedrolls, tents, waterskins, and camping kits from raw materials.',
        availableProducts: {
            bedroll:     { produces: 'bedroll',     consumes: { leather: 1, cloth: 1 },     rate: 4 },
            tent:        { produces: 'tent',        consumes: { hemp: 2, cloth: 2, wood: 1 }, rate: 2 },
            camping_kit: { produces: 'camping_kit', consumes: { tent: 1, bedroll: 1, waterskin: 1 }, rate: 1 },
            waterskin:   { produces: 'waterskin',   consumes: { leather: 1 },               rate: 6 },
        },
    },
    // --- Apartment Building (multi-unit residential) ---
    APARTMENT_BUILDING: { id: 'apartment_building', name: 'Apartment Building', cost: 2500, workers: 2, produces: null, consumes: {}, rate: 0, category: 'housing',
        landSlots: 2, minTownCategory: 'city', units: 10, unitMaxOccupants: 4,
        materials: { stone: 80, bricks: 60, planks: 40, iron: 15, cloth: 5 },
        icon: '🏢', description: 'A large building with 10 apartment units for rent. Owner collects purchase fees and monthly maintenance from tenants.' },
    // --- Tent Camp (poor NPC housing, auto-built by kingdoms) ---
    TENT_CAMP: { id: 'tent_camp', name: 'Tent Camp', cost: 50, workers: 0, produces: null, consumes: {}, rate: 0, category: 'housing',
        landSlots: 1, tents: 10, tentMaxOccupants: 2, tentUpfrontCost: 20, tentMonthlyCost: 5,
        notBuildable: true, notPlayerBuildable: true, diseaseMultiplier: 3.0,
        icon: '⛺', description: 'A collection of basic tents for the poorest citizens. Cheap but unsanitary. Spreads disease.' },
};

// ============================================================
// Kingdom Quest Pool
// ============================================================

const KINGDOM_QUEST_POOL = {
    // 🗡️ MILITARY
    supply_warfront: { title: 'Supply the War Effort', cat: 'military', diff: 'hard', rank: 4,
        desc: 'Deliver military goods for the war effort.',
        req: { deliver: { swords: [20,50], armor: [15,30] } },
        reward: { gold: [1500,3000], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['war_active'], personality: ['militarism_high'], urgency: 'high' },
    recruit_soldiers: { title: 'Recruit Fighting Men', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Recruit able-bodied men for the royal army.',
        req: { action: 'recruit_npcs', count: [5,10] },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['war_active'], personality: ['militarism_high'], urgency: 'high' },
    produce_weapons: { title: 'Arms Production', cat: 'military', diff: 'hard', rank: 4,
        desc: 'Produce weapons and ammunition for the military.',
        req: { deliver: { swords: [30,30], bows: [20,40], arrows: [50,100] } },
        reward: { gold: [1000,2500], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['war_active'], personality: ['militarism_high'], urgency: 'high' },
    fortify_town: { title: 'Fortify a Border Town', cat: 'military', diff: 'hard', rank: 5,
        desc: 'Deliver materials and fund fortification of a border town.',
        req: { deliver: { stone: [30,50], wood: [20,30], iron: [10,20] }, gold: [500,1000] },
        reward: { gold: [1500,3000], rep: 5, kingRel: 8, xp: 55 },
        triggers: ['war_active'], personality: ['militarism_high','courage_high'], urgency: 'high' },
    patrol_borders: { title: 'Border Patrol', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Visit border towns to patrol and report on enemy movements.',
        req: { action: 'visit_towns', count: [3,3], border: true },
        reward: { gold: [400,800], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['war_active','hostile_neighbor'], personality: ['militarism_high','courage_high'], urgency: 'normal' },
    escort_supplies: { title: 'Escort Military Convoy', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Escort a military supply convoy to the front lines.',
        req: { deliver: 'variable' },
        reward: { gold: [600,1200], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['war_active'], personality: ['militarism_high'], urgency: 'high' },
    hire_mercenaries: { title: 'Hire Mercenaries', cat: 'military', diff: 'hard', rank: 5,
        desc: 'Spend gold to hire mercenary companies for the war effort.',
        req: { gold: [2000,5000] },
        reward: { gold: [500,1000], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['war_losing'], personality: ['militarism_high'], urgency: 'critical' },
    build_watchtower: { title: 'Build Border Watchtower', cat: 'military', diff: 'hard', rank: 5,
        desc: 'Construct a watchtower on the border to monitor enemy activity.',
        req: { deliver: { wood: [30,40], stone: [20,30] }, gold: [500,800] },
        reward: { gold: [1000,2000], rep: 4, kingRel: 6, xp: 45 },
        triggers: ['war_active','hostile_neighbor'], personality: ['militarism_high'], urgency: 'normal' },
    horse_levy: { title: 'Horse Levy', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Collect horses for the cavalry.',
        req: { deliver: { horses: [10,20] } },
        reward: { gold: [800,1500], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['war_active'], personality: ['militarism_high'], urgency: 'high' },
    treat_wounded: { title: 'Tend the Wounded', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Deliver medical supplies to treat wounded soldiers.',
        req: { deliver: { bandages: [15,25], herbal_remedy: [10,20] } },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['war_active'], personality: ['temperament_kind'], urgency: 'high' },
    naval_preparation: { title: 'Prepare the Fleet', cat: 'military', diff: 'hard', rank: 5,
        desc: 'Supply materials for naval preparations.',
        req: { deliver: { wood: [40,60], rope: [15,25], cloth: [10,20] } },
        reward: { gold: [1500,2500], rep: 4, kingRel: 7, xp: 50 },
        triggers: ['war_active'], personality: ['militarism_high','ambition_high'], urgency: 'high' },
    arms_race: { title: 'Outpace Enemy Arms', cat: 'military', diff: 'elite', rank: 5,
        desc: 'Deliver large quantities of arms to outpace enemy production.',
        req: { deliver: { swords: [30,50], armor: [15,25], bows: [15,25] } },
        reward: { gold: [2500,5000], rep: 6, kingRel: 10, xp: 80 },
        triggers: ['war_active'], personality: ['ambition_high','militarism_high'], urgency: 'high' },
    conscript_aide: { title: 'Assist Conscription', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Visit towns to assist with conscription efforts.',
        req: { action: 'visit_towns', count: [3,3] },
        reward: { gold: [400,700], rep: 2, kingRel: 4, xp: 25 },
        triggers: ['war_desperate'], personality: ['militarism_high'], urgency: 'critical' },
    ransom_prisoners: { title: 'Ransom War Prisoners', cat: 'military', diff: 'hard', rank: 5,
        desc: 'Pay ransom to free captured soldiers.',
        req: { gold: [1000,3000] },
        reward: { gold: [200,500], rep: 5, kingRel: 8, xp: 45 },
        triggers: ['war_active'], personality: ['temperament_kind','justice_just'], urgency: 'normal' },
    defend_outpost: { title: 'Defend the Outpost', cat: 'military', diff: 'hard', rank: 4,
        desc: 'Hold a military outpost for an extended period.',
        req: { action: 'stay_location', days: [10,10] },
        reward: { gold: [1000,2000], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['war_active'], personality: ['courage_high','militarism_high'], urgency: 'high' },
    sabotage_enemy_supply: { title: 'Sabotage Enemy Supply Lines', cat: 'military', diff: 'elite', rank: 5,
        desc: 'Infiltrate and sabotage enemy supply lines.',
        req: { action: 'sabotage_enemy' },
        reward: { gold: [2000,4000], rep: 6, kingRel: 10, xp: 70 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'high' },
    scout_enemy_forces: { title: 'Scout Enemy Territory', cat: 'military', diff: 'hard', rank: 4,
        desc: 'Scout enemy towns and report on troop movements.',
        req: { action: 'visit_enemy_towns', count: [2,2] },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['war_active'], personality: ['intelligence_high','courage_high'], urgency: 'high' },
    war_bonds: { title: 'Sell War Bonds', cat: 'military', diff: 'medium', rank: 4,
        desc: 'Invest gold to sell war bonds and fund the military.',
        req: { gold: [1000,2000] },
        reward: { gold: [200,400], rep: 4, kingRel: 6, xp: 35 },
        triggers: ['war_active','low_treasury'], personality: ['militarism_high'], urgency: 'high' },
    victory_celebration: { title: 'Organize Victory Feast', cat: 'military', diff: 'medium', rank: 5,
        desc: 'Supply food and drink for a grand victory celebration.',
        req: { deliver: { wine: [15,25], meat: [20,35], bread: [25,45] }, gold: [300,600] },
        reward: { gold: [500,1000], rep: 4, kingRel: 6, xp: 35 },
        triggers: ['war_won'], personality: ['ambition_high'], urgency: 'low' },
    demobilize_troops: { title: 'Oversee Demobilization', cat: 'military', diff: 'medium', rank: 5,
        desc: 'Visit towns to oversee the orderly demobilization of troops.',
        req: { action: 'visit_towns', count: [3,4] },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['war_ended'], personality: [], urgency: 'normal' },

    // 💰 ECONOMIC
    raise_tax_revenue: { title: 'Raise Tax Revenue', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Contribute gold to bolster the royal treasury through taxation.',
        req: { gold: [1000,2000] },
        reward: { gold: [200,400], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['low_treasury'], personality: ['greed_high'], urgency: 'high' },
    establish_trade_route: { title: 'Establish Trade Route', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Create a new caravan trade route to boost commerce.',
        req: { action: 'create_caravan' },
        reward: { gold: [600,1200], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['low_prosperity'], personality: ['intelligence_high'], urgency: 'normal' },
    import_essential_goods: { title: 'Import Essential Goods', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Import goods that are in short supply.',
        req: { deliver: 'variable' },
        reward: { gold: [500,1200], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['goods_shortage'], personality: [], urgency: 'high' },
    economic_stimulus: { title: 'Fund Economic Recovery', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Invest heavily to stimulate the struggling economy.',
        req: { gold: [1500,3000] },
        reward: { gold: [300,500], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['low_prosperity'], personality: ['greed_low','ambition_high'], urgency: 'high' },
    attract_merchants: { title: 'Attract Foreign Merchants', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Spend gold to attract foreign merchants to the kingdom.',
        req: { gold: [500,1000] },
        reward: { gold: [300,600], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['low_prosperity'], personality: ['intelligence_high'], urgency: 'normal' },
    collect_debts: { title: 'Collect Crown Debts', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Track down and collect outstanding debts owed to the crown.',
        req: { gold: [800,2000] },
        reward: { gold: [400,800], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['low_treasury'], personality: ['greed_high'], urgency: 'high' },
    luxury_imports: { title: 'Procure Luxury Goods', cat: 'economic', diff: 'hard', rank: 4,
        desc: 'Procure luxury goods for the royal court.',
        req: { deliver: { silk: [5,15], wine: [10,20], jewelry: [3,8], herbs: [5,15] } },
        reward: { gold: [1500,3000], rep: 3, kingRel: 5, xp: 40 },
        triggers: ['high_prosperity'], personality: ['greed_high','ambition_high'], urgency: 'low' },
    food_supply: { title: 'Emergency Food Supply', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Deliver emergency food to a starving population.',
        req: { deliver: { wheat: [20,40], bread: [15,25], meat: [10,20] } },
        reward: { gold: [500,1200], rep: 4, kingRel: 6, xp: 35 },
        triggers: ['food_shortage'], personality: ['temperament_kind'], urgency: 'critical' },
    fund_construction: { title: 'Fund Royal Construction', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Fund a major royal construction project.',
        req: { gold: [2000,4000] },
        reward: { gold: [400,800], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['high_prosperity'], personality: ['ambition_high'], urgency: 'normal' },
    price_stabilization: { title: 'Stabilize Market Prices', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Deliver goods to stabilize volatile market prices.',
        req: { deliver: 'variable' },
        reward: { gold: [400,900], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['price_spike'], personality: ['justice_just'], urgency: 'normal' },
    guild_reform: { title: 'Reform Trade Guild', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Visit towns to implement trade guild reforms.',
        req: { action: 'visit_towns', count: [3,3] },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['low_prosperity'], personality: ['tradition_progressive'], urgency: 'normal' },
    monopoly_break: { title: 'Break a Monopoly', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Spend resources to break up an unfair trade monopoly.',
        req: { gold: [1000,2000] },
        reward: { gold: [500,1000], rep: 4, kingRel: 6, xp: 45 },
        triggers: ['normal'], personality: ['justice_just'], urgency: 'normal' },
    export_goods: { title: 'Royal Export Mission', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Sell goods to foreign markets to generate revenue.',
        req: { action: 'sell_foreign', gold_target: [1000,3000] },
        reward: { gold: [500,1200], rep: 3, kingRel: 4, xp: 30 },
        triggers: ['normal'], personality: ['greed_high'], urgency: 'low' },
    resource_survey: { title: 'Survey Natural Resources', cat: 'economic', diff: 'easy', rank: 4,
        desc: 'Visit towns to survey and catalog natural resources.',
        req: { action: 'visit_towns', count: [2,3] },
        reward: { gold: [200,500], rep: 2, kingRel: 3, xp: 20 },
        triggers: ['normal'], personality: ['ambition_high'], urgency: 'low' },
    rebuild_after_disaster: { title: 'Disaster Reconstruction', cat: 'economic', diff: 'hard', rank: 4,
        desc: 'Deliver building materials to reconstruct after a disaster.',
        req: { deliver: { wood: [30,50], stone: [20,35], bricks: [15,25] } },
        reward: { gold: [1000,2000], rep: 5, kingRel: 7, xp: 45 },
        triggers: ['disaster_recent'], personality: ['temperament_kind'], urgency: 'high' },
    royal_treasury_deposit: { title: 'Treasury Contribution', cat: 'economic', diff: 'easy', rank: 4,
        desc: 'Donate gold directly to the royal treasury.',
        req: { gold: [500,2000] },
        reward: { gold: [0,0], rep: 3, kingRel: 5, xp: 20 },
        triggers: ['low_treasury'], personality: [], urgency: 'normal' },
    establish_industry: { title: 'Establish New Industry', cat: 'economic', diff: 'hard', rank: 5,
        desc: 'Build a new production building to establish industry.',
        req: { action: 'build_building' },
        reward: { gold: [1000,2000], rep: 4, kingRel: 6, xp: 45 },
        triggers: ['low_prosperity'], personality: ['ambition_high','tradition_progressive'], urgency: 'normal' },
    trade_agreement_goods: { title: 'Trade Agreement Fulfillment', cat: 'economic', diff: 'medium', rank: 4,
        desc: 'Deliver goods to fulfill a diplomatic trade agreement.',
        req: { deliver: 'variable' },
        reward: { gold: [600,1200], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['diplomatic_trade'], personality: [], urgency: 'normal' },

    // 🕊️ DIPLOMATIC
    negotiate_peace: { title: 'Negotiate Peace Treaty', cat: 'diplomatic', diff: 'elite', rank: 6,
        desc: 'Undertake a dangerous diplomatic mission to negotiate peace.',
        req: { action: 'diplomatic_mission' },
        reward: { gold: [3000,6000], rep: 8, kingRel: 12, xp: 100 },
        triggers: ['war_exhausted'], personality: ['temperament_kind','intelligence_high'], urgency: 'high' },
    diplomatic_gift: { title: 'Deliver Diplomatic Gift', cat: 'diplomatic', diff: 'medium', rank: 4,
        desc: 'Deliver luxury goods as a diplomatic gift to improve relations.',
        req: { deliver: { silk: [5,10], wine: [10,15], jewelry: [3,5] } },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['poor_relations'], personality: ['temperament_kind'], urgency: 'normal' },
    cultural_exchange: { title: 'Cultural Exchange Mission', cat: 'diplomatic', diff: 'easy', rank: 4,
        desc: 'Visit foreign kingdoms on a cultural exchange mission.',
        req: { action: 'visit_foreign', count: [2,2] },
        reward: { gold: [300,600], rep: 2, kingRel: 3, xp: 20 },
        triggers: ['neutral_relations'], personality: ['tradition_progressive'], urgency: 'low' },
    negotiate_alliance: { title: 'Negotiate Military Alliance', cat: 'diplomatic', diff: 'elite', rank: 6,
        desc: 'Negotiate a military alliance with a neighboring kingdom.',
        req: { action: 'diplomatic_mission' },
        reward: { gold: [2500,5000], rep: 7, kingRel: 12, xp: 90 },
        triggers: ['war_threat'], personality: ['intelligence_high'], urgency: 'high' },
    spy_on_kingdom: { title: 'Intelligence Gathering', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Visit foreign kingdoms to gather intelligence.',
        req: { action: 'visit_foreign', count: [2,3] },
        reward: { gold: [1000,2000], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['hostile_neighbor'], personality: ['intelligence_high'], urgency: 'normal' },
    trade_negotiation: { title: 'Negotiate Trade Agreement', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Negotiate favorable trade terms with a foreign kingdom.',
        req: { gold: [500,1500] },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['poor_trade'], personality: ['intelligence_high'], urgency: 'normal' },
    royal_marriage_proposal: { title: 'Arrange Royal Marriage', cat: 'diplomatic', diff: 'elite', rank: 6,
        desc: 'Arrange a marriage between royal families to strengthen alliances.',
        req: { action: 'diplomatic_mission' },
        reward: { gold: [3000,5000], rep: 6, kingRel: 10, xp: 80 },
        triggers: ['alliance_opportunity'], personality: ['tradition_traditional'], urgency: 'low' },
    hostage_exchange: { title: 'Hostage Exchange', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Negotiate and fund a hostage exchange between kingdoms.',
        req: { gold: [1000,2000] },
        reward: { gold: [500,1000], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['war_ending'], personality: ['temperament_kind'], urgency: 'high' },
    deliver_ultimatum: { title: 'Deliver Royal Ultimatum', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Deliver the king\'s ultimatum to a foreign power.',
        req: { action: 'visit_foreign', count: [1,1] },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['hostile_neighbor'], personality: ['militarism_high','temperament_stern'], urgency: 'normal' },
    border_dispute_resolution: { title: 'Resolve Border Dispute', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Undertake a diplomatic mission to resolve a border dispute.',
        req: { action: 'diplomatic_mission' },
        reward: { gold: [1000,2000], rep: 5, kingRel: 7, xp: 45 },
        triggers: ['border_dispute'], personality: ['justice_just'], urgency: 'normal' },
    refugee_resettlement: { title: 'Resettle War Refugees', cat: 'diplomatic', diff: 'medium', rank: 4,
        desc: 'Spend gold to resettle refugees displaced by war.',
        req: { gold: [500,1500] },
        reward: { gold: [200,400], rep: 4, kingRel: 6, xp: 30 },
        triggers: ['war_ended'], personality: ['temperament_kind'], urgency: 'normal' },
    embargo_negotiation: { title: 'Break Foreign Embargo', cat: 'diplomatic', diff: 'hard', rank: 5,
        desc: 'Negotiate to break an embargo restricting trade.',
        req: { action: 'diplomatic_mission' },
        reward: { gold: [1500,3000], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['embargo_active'], personality: ['intelligence_high'], urgency: 'high' },

    // ⚖️ JUSTICE
    investigate_corruption: { title: 'Investigate Corrupt Official', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Investigate a government official suspected of corruption.',
        req: { action: 'investigate' },
        reward: { gold: [1000,2000], rep: 5, kingRel: 7, xp: 50 },
        triggers: ['corruption_detected'], personality: ['justice_just'], urgency: 'normal' },
    capture_criminal: { title: 'Capture Wanted Criminal', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Track down and capture a wanted criminal.',
        req: { action: 'capture_criminal' },
        reward: { gold: [500,1200], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['criminal_at_large'], personality: ['justice_just','courage_high'], urgency: 'normal' },
    enforce_ban: { title: 'Enforce Goods Ban', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Enforce a royal ban on certain goods.',
        req: { action: 'enforce_ban' },
        reward: { gold: [400,900], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['banned_goods_detected'], personality: ['justice_just'], urgency: 'normal' },
    audit_noble: { title: 'Audit Noble Finances', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Investigate a noble\'s finances for corruption.',
        req: { action: 'investigate' },
        reward: { gold: [1200,2500], rep: 5, kingRel: 7, xp: 50 },
        triggers: ['corruption_suspected'], personality: ['justice_just','intelligence_high'], urgency: 'normal' },
    manhunt: { title: 'Lead a Manhunt', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Lead a manhunt for a dangerous fugitive.',
        req: { action: 'manhunt' },
        reward: { gold: [1000,2000], rep: 5, kingRel: 7, xp: 50 },
        triggers: ['serious_criminal'], personality: ['justice_just','courage_high'], urgency: 'high' },
    increase_patrols: { title: 'Organize Town Watch', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Fund and organize increased town patrols.',
        req: { gold: [300,800] },
        reward: { gold: [200,400], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['crime_wave'], personality: ['justice_just'], urgency: 'normal' },
    settle_land_claim: { title: 'Arbitrate Land Dispute', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Arbitrate a land ownership dispute between nobles.',
        req: { action: 'arbitrate' },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['noble_dispute'], personality: ['justice_just','intelligence_high'], urgency: 'normal' },
    prison_reform: { title: 'Reform Kingdom Prisons', cat: 'justice', diff: 'elite', rank: 6,
        desc: 'Fund and oversee reform of the kingdom\'s prison system.',
        req: { gold: [2000,4000] },
        reward: { gold: [500,1000], rep: 6, kingRel: 10, xp: 70 },
        triggers: ['high_crime'], personality: ['justice_just','temperament_kind'], urgency: 'normal' },
    root_out_spyring: { title: 'Root Out Enemy Spies', cat: 'justice', diff: 'elite', rank: 5,
        desc: 'Investigate and dismantle an enemy spy network.',
        req: { action: 'investigate' },
        reward: { gold: [2000,4000], rep: 6, kingRel: 10, xp: 70 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'high' },
    suppress_smuggling: { title: 'Suppress Smuggling Ring', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Investigate and suppress a smuggling operation.',
        req: { action: 'investigate' },
        reward: { gold: [500,1200], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['smuggling_detected'], personality: ['justice_just'], urgency: 'normal' },
    noble_trial_arbiter: { title: 'Serve as Trial Arbiter', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Serve as arbiter in a noble\'s trial.',
        req: { action: 'arbitrate' },
        reward: { gold: [1000,2000], rep: 5, kingRel: 7, xp: 45 },
        triggers: ['noble_charged'], personality: ['justice_just'], urgency: 'normal' },
    tax_fraud_investigation: { title: 'Investigate Tax Fraud', cat: 'justice', diff: 'hard', rank: 5,
        desc: 'Investigate reports of widespread tax evasion.',
        req: { action: 'investigate' },
        reward: { gold: [1000,2000], rep: 4, kingRel: 6, xp: 45 },
        triggers: ['low_treasury'], personality: ['justice_just','greed_high'], urgency: 'normal' },
    bandit_suppression: { title: 'Suppress Bandits on Roads', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Patrol roads to suppress bandit activity.',
        req: { action: 'patrol_roads' },
        reward: { gold: [500,1200], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['bandit_activity'], personality: ['courage_high','justice_just'], urgency: 'normal' },
    witness_protection: { title: 'Protect Key Witness', cat: 'justice', diff: 'medium', rank: 4,
        desc: 'Escort and protect a key witness for an upcoming trial.',
        req: { action: 'escort_npc' },
        reward: { gold: [400,800], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['trial_pending'], personality: ['justice_just'], urgency: 'normal' },
    confiscate_contraband: { title: 'Confiscate Contraband', cat: 'justice', diff: 'easy', rank: 4,
        desc: 'Confiscate banned goods from traders.',
        req: { action: 'confiscate' },
        reward: { gold: [300,600], rep: 2, kingRel: 3, xp: 20 },
        triggers: ['banned_goods_detected'], personality: ['justice_just'], urgency: 'low' },

    // 🏗️ INFRASTRUCTURE
    road_construction: { title: 'Build New Road', cat: 'infrastructure', diff: 'hard', rank: 5,
        desc: 'Deliver materials and fund construction of a new road.',
        req: { deliver: { stone: [30,50], wood: [20,40] }, gold: [500,1500] },
        reward: { gold: [1000,2500], rep: 5, kingRel: 7, xp: 50 },
        triggers: ['towns_unconnected'], personality: ['ambition_high'], urgency: 'normal' },
    bridge_repair: { title: 'Repair Damaged Bridge', cat: 'infrastructure', diff: 'medium', rank: 4,
        desc: 'Deliver materials to repair a damaged bridge.',
        req: { deliver: { wood: [20,35], stone: [15,25] } },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['infrastructure_damaged'], personality: [], urgency: 'normal' },
    build_hospital: { title: 'Build Town Hospital', cat: 'infrastructure', diff: 'hard', rank: 5,
        desc: 'Deliver materials and fund the construction of a hospital.',
        req: { deliver: { wood: [30,40], stone: [20,30] }, gold: [800,1500] },
        reward: { gold: [1500,2500], rep: 5, kingRel: 8, xp: 55 },
        triggers: ['plague_active'], personality: ['temperament_kind'], urgency: 'critical' },
    build_market: { title: 'Establish Town Market', cat: 'infrastructure', diff: 'medium', rank: 4,
        desc: 'Fund the establishment of a new town market.',
        req: { gold: [500,1000] },
        reward: { gold: [400,800], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['low_prosperity'], personality: ['ambition_high'], urgency: 'normal' },
    fortify_walls: { title: 'Upgrade Town Walls', cat: 'infrastructure', diff: 'hard', rank: 5,
        desc: 'Deliver materials and fund upgrading town fortifications.',
        req: { deliver: { stone: [40,60], iron: [15,25] }, gold: [1000,2000] },
        reward: { gold: [1500,3000], rep: 5, kingRel: 8, xp: 55 },
        triggers: ['war_threat'], personality: ['militarism_high'], urgency: 'high' },
    build_granary: { title: 'Build Emergency Granary', cat: 'infrastructure', diff: 'medium', rank: 4,
        desc: 'Deliver materials to build an emergency food storage granary.',
        req: { deliver: { wood: [25,40], stone: [15,25] } },
        reward: { gold: [500,1000], rep: 4, kingRel: 5, xp: 30 },
        triggers: ['food_shortage'], personality: ['temperament_kind'], urgency: 'high' },
    dock_expansion: { title: 'Expand Port Facilities', cat: 'infrastructure', diff: 'hard', rank: 5,
        desc: 'Deliver materials and fund expansion of port facilities.',
        req: { deliver: { wood: [40,60], rope: [10,20] }, gold: [800,1500] },
        reward: { gold: [1200,2500], rep: 4, kingRel: 6, xp: 45 },
        triggers: ['coastal_town'], personality: ['ambition_high'], urgency: 'low' },
    well_construction: { title: 'Dig Public Wells', cat: 'infrastructure', diff: 'easy', rank: 4,
        desc: 'Fund the digging of public wells during drought.',
        req: { gold: [200,500] },
        reward: { gold: [100,200], rep: 2, kingRel: 3, xp: 15 },
        triggers: ['drought'], personality: ['temperament_kind'], urgency: 'normal' },
    rebuild_burned_building: { title: 'Rebuild After Fire', cat: 'infrastructure', diff: 'hard', rank: 4,
        desc: 'Deliver materials to rebuild structures destroyed by fire.',
        req: { deliver: { wood: [30,50], stone: [15,25], bricks: [10,20] } },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['fire_recent'], personality: ['temperament_kind'], urgency: 'high' },
    monument_construction: { title: 'Build Royal Monument', cat: 'infrastructure', diff: 'elite', rank: 5,
        desc: 'Deliver materials and fund construction of a royal monument.',
        req: { deliver: { stone: [50,80], iron: [20,30], gold_ore: [5,10] }, gold: [2000,4000] },
        reward: { gold: [3000,6000], rep: 6, kingRel: 10, xp: 80 },
        triggers: ['high_prosperity'], personality: ['ambition_high','tradition_traditional'], urgency: 'low' },

    // 👑 SOCIAL/NOBLE
    mediate_noble_dispute: { title: 'Mediate Noble Dispute', cat: 'social', diff: 'hard', rank: 5,
        desc: 'Mediate a dispute between feuding noble houses.',
        req: { action: 'mediate' },
        reward: { gold: [800,1500], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['noble_conflict'], personality: ['intelligence_high','temperament_kind'], urgency: 'normal' },
    organize_royal_feast: { title: 'Organize Royal Feast', cat: 'social', diff: 'medium', rank: 5,
        desc: 'Supply food, drink, and gold for a royal feast.',
        req: { deliver: { wine: [10,20], meat: [15,30], bread: [20,35] }, gold: [300,600] },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['normal'], personality: ['temperament_kind'], urgency: 'low' },
    charity_drive: { title: 'Organize Charity Drive', cat: 'social', diff: 'medium', rank: 4,
        desc: 'Donate gold to organize charitable relief for the poor.',
        req: { gold: [300,800] },
        reward: { gold: [100,200], rep: 4, kingRel: 5, xp: 25 },
        triggers: ['low_happiness'], personality: ['temperament_kind','greed_low'], urgency: 'normal' },
    feed_the_poor: { title: 'Feed the Poor', cat: 'social', diff: 'easy', rank: 4,
        desc: 'Deliver food to feed the kingdom\'s poorest citizens.',
        req: { deliver: { bread: [15,30], meat: [10,20] } },
        reward: { gold: [200,400], rep: 3, kingRel: 4, xp: 20 },
        triggers: ['food_shortage','low_happiness'], personality: ['temperament_kind'], urgency: 'normal' },
    noble_marriage_broker: { title: 'Broker Noble Marriage', cat: 'social', diff: 'hard', rank: 5,
        desc: 'Arrange a politically advantageous marriage between nobles.',
        req: { action: 'arrange_marriage' },
        reward: { gold: [1000,2000], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['unmarried_nobles'], personality: ['tradition_traditional'], urgency: 'low' },
    heir_education: { title: 'Tutor the Royal Heir', cat: 'social', diff: 'elite', rank: 6,
        desc: 'Serve as tutor to the royal heir.',
        req: { action: 'tutor_heir' },
        reward: { gold: [2000,4000], rep: 6, kingRel: 12, xp: 80 },
        triggers: ['heir_exists'], personality: ['intelligence_high'], urgency: 'low' },
    restore_temple: { title: 'Restore Sacred Temple', cat: 'social', diff: 'medium', rank: 4,
        desc: 'Deliver materials and fund restoration of a sacred temple.',
        req: { deliver: { stone: [20,35], wood: [15,25] }, gold: [300,600] },
        reward: { gold: [400,800], rep: 3, kingRel: 5, xp: 25 },
        triggers: ['normal'], personality: ['tradition_traditional'], urgency: 'low' },
    royal_ceremony: { title: 'Organize Royal Ceremony', cat: 'social', diff: 'hard', rank: 5,
        desc: 'Provide luxury goods and gold for a royal ceremony.',
        req: { deliver: { silk: [5,10], wine: [10,15] }, gold: [500,1000] },
        reward: { gold: [800,1500], rep: 4, kingRel: 7, xp: 40 },
        triggers: ['normal'], personality: ['tradition_traditional','ambition_high'], urgency: 'low' },
    propaganda_campaign: { title: 'Propaganda Campaign', cat: 'social', diff: 'medium', rank: 4,
        desc: 'Fund a propaganda campaign to improve public opinion.',
        req: { gold: [400,1000] },
        reward: { gold: [200,400], rep: 4, kingRel: 5, xp: 30 },
        triggers: ['low_stability'], personality: [], urgency: 'normal' },
    noble_council_vote: { title: 'Sway Noble Council Vote', cat: 'social', diff: 'hard', rank: 5,
        desc: 'Use influence to sway a noble council vote.',
        req: { action: 'sway_vote' },
        reward: { gold: [1000,2000], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['vote_pending'], personality: ['intelligence_high'], urgency: 'normal' },
    succession_planning: { title: 'Advise on Succession', cat: 'social', diff: 'elite', rank: 6,
        desc: 'Advise the king on succession planning.',
        req: { action: 'advise_succession' },
        reward: { gold: [2500,5000], rep: 7, kingRel: 12, xp: 80 },
        triggers: ['king_old'], personality: ['intelligence_high'], urgency: 'low' },
    public_works: { title: 'Organize Public Works', cat: 'social', diff: 'medium', rank: 4,
        desc: 'Fund public works projects to improve happiness.',
        req: { gold: [400,1000] },
        reward: { gold: [200,400], rep: 3, kingRel: 4, xp: 25 },
        triggers: ['low_happiness'], personality: ['temperament_kind'], urgency: 'normal' },
    inspire_loyalty: { title: 'Tour Kingdom to Inspire Loyalty', cat: 'social', diff: 'hard', rank: 5,
        desc: 'Tour towns across the kingdom to inspire loyalty and stability.',
        req: { action: 'visit_towns', count: [4,5] },
        reward: { gold: [800,1500], rep: 5, kingRel: 7, xp: 45 },
        triggers: ['low_stability','low_happiness'], personality: ['courage_high','temperament_kind'], urgency: 'normal' },

    // 🕵️ ESPIONAGE
    spy_mission: { title: 'Spy on Foreign Kingdom', cat: 'espionage', diff: 'hard', rank: 5,
        desc: 'Visit foreign kingdoms to gather intelligence.',
        req: { action: 'visit_foreign', count: [2,3] },
        reward: { gold: [1500,3000], rep: 5, kingRel: 8, xp: 50 },
        triggers: ['hostile_neighbor'], personality: ['intelligence_high'], urgency: 'normal' },
    counter_espionage: { title: 'Counter Enemy Spies', cat: 'espionage', diff: 'hard', rank: 5,
        desc: 'Investigate and counter enemy espionage activities.',
        req: { action: 'investigate' },
        reward: { gold: [1200,2500], rep: 5, kingRel: 7, xp: 50 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'high' },
    intercept_courier: { title: 'Intercept Enemy Courier', cat: 'espionage', diff: 'medium', rank: 4,
        desc: 'Intercept an enemy courier carrying sensitive information.',
        req: { action: 'intercept' },
        reward: { gold: [600,1200], rep: 3, kingRel: 5, xp: 35 },
        triggers: ['war_active'], personality: ['intelligence_high','courage_high'], urgency: 'normal' },
    plant_disinformation: { title: 'Spread Disinformation', cat: 'espionage', diff: 'hard', rank: 5,
        desc: 'Plant false information to mislead the enemy.',
        req: { action: 'disinformation' },
        reward: { gold: [1000,2000], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'normal' },
    recruit_informant: { title: 'Recruit Foreign Informant', cat: 'espionage', diff: 'hard', rank: 5,
        desc: 'Spend gold to recruit an informant in a foreign kingdom.',
        req: { gold: [800,2000] },
        reward: { gold: [500,1000], rep: 4, kingRel: 6, xp: 40 },
        triggers: ['hostile_neighbor'], personality: ['intelligence_high'], urgency: 'normal' },
    decode_intelligence: { title: 'Decode Intercepted Messages', cat: 'espionage', diff: 'medium', rank: 4,
        desc: 'Decode intercepted enemy communications.',
        req: { action: 'decode' },
        reward: { gold: [500,1000], rep: 3, kingRel: 5, xp: 30 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'normal' },
    sabotage_enemy_economy: { title: 'Economic Sabotage Mission', cat: 'espionage', diff: 'elite', rank: 6,
        desc: 'Undertake a dangerous mission to sabotage the enemy economy.',
        req: { action: 'sabotage_economy' },
        reward: { gold: [3000,5000], rep: 7, kingRel: 10, xp: 80 },
        triggers: ['war_active'], personality: ['intelligence_high'], urgency: 'high' },

    // 💀 CORRUPT KING QUESTS
    shake_down_merchants: { title: '"Tax" the Merchants', cat: 'corrupt', diff: 'medium', rank: 4,
        desc: 'Shake down merchants for "taxes" on behalf of the crown.',
        req: { action: 'shake_down', gold_target: [500,1500] },
        reward: { gold: [300,600], rep: 2, kingRel: 5, xp: 25 },
        triggers: ['corrupt_king'], personality: ['justice_corrupt','greed_high'], urgency: 'normal' },
    eliminate_political_rival: { title: 'Remove a Political Threat', cat: 'corrupt', diff: 'elite', rank: 5,
        desc: 'Eliminate a political rival of the king.',
        req: { action: 'eliminate_rival' },
        reward: { gold: [2000,4000], rep: 5, kingRel: 10, xp: 70 },
        triggers: ['corrupt_king'], personality: ['justice_corrupt','temperament_cruel'], urgency: 'normal' },
    silence_witness: { title: 'Silence a Troublesome Witness', cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Silence a witness who threatens to expose corruption.',
        req: { action: 'silence_witness' },
        reward: { gold: [1000,2000], rep: 3, kingRel: 7, xp: 45 },
        triggers: ['corruption_exposed'], personality: ['justice_corrupt'], urgency: 'high' },
    forge_evidence_against_noble: { title: 'Forge Evidence Against Noble', cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Forge evidence to frame an innocent noble.',
        req: { action: 'forge_evidence' },
        reward: { gold: [1500,3000], rep: 4, kingRel: 8, xp: 50 },
        triggers: ['corrupt_king','noble_rivalry'], personality: ['justice_corrupt','temperament_cruel'], urgency: 'normal' },
    bribe_foreign_official: { title: 'Bribe Foreign Official', cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Bribe a foreign official to gain an advantage.',
        req: { gold: [1000,3000] },
        reward: { gold: [500,1000], rep: 4, kingRel: 7, xp: 45 },
        triggers: ['corrupt_king'], personality: ['justice_corrupt','intelligence_high'], urgency: 'normal' },
    seize_merchant_assets: { title: "Seize Merchant's Assets", cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Seize the assets of a wealthy merchant on false pretenses.',
        req: { action: 'seize_assets' },
        reward: { gold: [2000,4000], rep: 3, kingRel: 8, xp: 50 },
        triggers: ['corrupt_king'], personality: ['greed_high','justice_corrupt'], urgency: 'normal' },
    intimidate_opposition: { title: 'Intimidate the Opposition', cat: 'corrupt', diff: 'medium', rank: 4,
        desc: 'Intimidate political opponents into silence.',
        req: { action: 'intimidate' },
        reward: { gold: [500,1000], rep: 2, kingRel: 5, xp: 30 },
        triggers: ['corrupt_king','unrest'], personality: ['justice_corrupt','temperament_cruel'], urgency: 'normal' },
    launder_gold: { title: 'Launder Royal Funds', cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Launder stolen royal funds through legitimate businesses.',
        req: { gold: [1500,3000] },
        reward: { gold: [500,1000], rep: 3, kingRel: 7, xp: 45 },
        triggers: ['corrupt_king'], personality: ['greed_high','justice_corrupt'], urgency: 'normal' },
    scapegoat_merchant: { title: 'Frame an Elite Merchant', cat: 'corrupt', diff: 'elite', rank: 5,
        desc: 'Frame a successful merchant to seize their wealth.',
        req: { action: 'frame_merchant' },
        reward: { gold: [2000,4000], rep: 4, kingRel: 8, xp: 60 },
        triggers: ['corrupt_king'], personality: ['justice_corrupt','temperament_cruel','intelligence_low'], urgency: 'normal' },
    paranoid_investigation: { title: 'Investigate "Treasonous" Noble', cat: 'corrupt', diff: 'hard', rank: 5,
        desc: 'Investigate a noble the paranoid king suspects of treason.',
        req: { action: 'investigate' },
        reward: { gold: [1000,2000], rep: 3, kingRel: 7, xp: 45 },
        triggers: ['corrupt_king'], personality: ['justice_corrupt','intelligence_low'], urgency: 'normal' },
    rig_noble_election: { title: 'Rig Noble Council Election', cat: 'corrupt', diff: 'elite', rank: 6,
        desc: 'Rig a noble council election in the king\'s favor.',
        req: { action: 'rig_election' },
        reward: { gold: [2500,5000], rep: 5, kingRel: 10, xp: 70 },
        triggers: ['corrupt_king','vote_pending'], personality: ['justice_corrupt'], urgency: 'normal' },
    extort_foreign_traders: { title: 'Extort Foreign Traders', cat: 'corrupt', diff: 'medium', rank: 4,
        desc: 'Extort foreign traders passing through the kingdom.',
        req: { action: 'extort', gold_target: [500,1500] },
        reward: { gold: [400,800], rep: 2, kingRel: 4, xp: 25 },
        triggers: ['corrupt_king'], personality: ['greed_high','justice_corrupt'], urgency: 'normal' },
};

const KINGDOM_QUEST_REWARD_SCALE = {
    easy:   { gold: [200,500],   rep: [1,2], kingRel: [2,3],  xp: [15,25] },
    medium: { gold: [500,1500],  rep: [2,4], kingRel: [4,6],  xp: [30,50] },
    hard:   { gold: [1500,3000], rep: [4,6], kingRel: [6,10], xp: [50,80] },
    elite:  { gold: [3000,8000], rep: [6,10],kingRel: [10,15],xp: [80,150] }
};

const KINGDOM_QUEST_SPECIAL_REWARDS = [
    'production_permit', 'tax_exemption_30d', 'title_boost', 'royal_decree',
    'land_grant', 'kings_favor', 'military_equipment', 'trade_monopoly',
    'noble_endorsement', 'crown_estate'
];

// ── Action Quest Mechanics ──
// Defines what the player must actually DO for one-off action quests
// (instead of just clicking "Report Complete")
const ACTION_QUEST_MECHANICS = {
    // ESPIONAGE
    decode: {
        label: 'Decode Messages',
        actionLabel: '🔓 Begin Decoding',
        tickCost: 8,          // time investment (days)
        goldCost: 50,         // supplies (ink, candles, reference texts)
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'underworld',
        narrative: 'You spread the intercepted documents across your desk and begin studying the cipher patterns by candlelight.',
        successText: 'After careful analysis, the cipher breaks open — revealing enemy troop movements and supply routes!',
        failText: 'The cipher is more complex than expected. Your work yields nothing useful — you\'ll need to start fresh.',
    },
    intercept: {
        label: 'Intercept Courier',
        actionLabel: '🏇 Set an Ambush',
        tickCost: 5,
        goldCost: 100,       // hire lookouts, supplies
        locationReq: 'any',
        successBase: 0.60,
        skillKey: 'survival',
        narrative: 'You set up along the known courier route with lookouts posted at every crossroads, watching for enemy riders.',
        successText: 'Your ambush succeeds! The courier is captured and the dispatches seized.',
        failText: 'The courier took an unexpected route and slipped past your net. The gold spent on lookouts is lost.',
    },
    investigate: {
        label: 'Investigate',
        actionLabel: '🔍 Begin Investigation',
        tickCost: 7,
        goldCost: 75,        // informant payments
        locationReq: 'any',
        successBase: 0.65,
        skillKey: 'social',
        narrative: 'You begin quietly interviewing servants, merchants, and soldiers, piecing together a web of contacts and rumors.',
        successText: 'Your investigation uncovers the truth — names, dates, and evidence compiled into a damning report.',
        failText: 'Your investigation leads to dead ends. The trail has gone cold and you\'ll need to start over with new leads.',
    },
    disinformation: {
        label: 'Spread Disinformation',
        actionLabel: '📜 Plant False Reports',
        tickCost: 6,
        goldCost: 200,       // bribe messengers, forge documents
        locationReq: 'any',
        successBase: 0.60,
        skillKey: 'underworld',
        narrative: 'You craft believable but false intelligence reports and begin distributing them through compromised channels.',
        successText: 'The false information spreads like wildfire — enemy commanders are already reacting to phantom threats!',
        failText: 'Your forgery is detected by a sharp-eyed official. The disinformation campaign falls apart.',
    },
    sabotage_economy: {
        label: 'Sabotage Enemy Economy',
        actionLabel: '💣 Launch Sabotage Operation',
        tickCost: 12,
        goldCost: 500,       // hire agents, smuggle materials
        locationReq: 'any',
        successBase: 0.45,
        skillKey: 'underworld',
        narrative: 'You assemble a network of agents and begin coordinating a complex operation to undermine the enemy\'s trade routes.',
        successText: 'Warehouses burn, shipments vanish, and markets collapse — the enemy economy is reeling!',
        failText: 'Your agents are captured before they can act. The operation is compromised and the gold is lost.',
    },
    // SOCIAL
    arrange_marriage: {
        label: 'Broker Marriage',
        actionLabel: '💍 Begin Negotiations',
        tickCost: 10,
        goldCost: 150,       // hosting meetings, gifts
        locationReq: 'any',
        successBase: 0.65,
        skillKey: 'social',
        narrative: 'You arrange private meetings between the families, navigating the delicate politics of noble alliances.',
        successText: 'Both families agree! The betrothal is announced to great celebration.',
        failText: 'Negotiations break down over a dispute about dowry and lands. You\'ll need to try a different approach.',
    },
    tutor_heir: {
        label: 'Tutor Royal Heir',
        actionLabel: '📚 Begin Tutoring',
        tickCost: 15,
        goldCost: 100,       // books, materials
        locationReq: 'capital',
        successBase: 0.75,
        skillKey: 'social',
        narrative: 'You arrive at the royal palace and begin daily lessons with the young heir — history, economics, and statecraft.',
        successText: 'The heir shows remarkable progress! The king is deeply impressed with your teaching.',
        failText: 'The heir proves an unwilling student. After weeks of frustration, the king relieves you of the duty.',
    },
    sway_vote: {
        label: 'Sway Council Vote',
        actionLabel: '🗳️ Begin Lobbying',
        tickCost: 6,
        goldCost: 300,       // dinners, favors, bribes
        locationReq: 'any',
        successBase: 0.55,
        skillKey: 'social',
        narrative: 'You host private dinners and make quiet promises, working to turn council members to your side.',
        successText: 'The council votes as you wished — your influence over the nobility grows stronger.',
        failText: 'A rival noble outmaneuvered you at the last moment. The vote goes against your efforts.',
    },
    advise_succession: {
        label: 'Advise on Succession',
        actionLabel: '👑 Begin Consultation',
        tickCost: 12,
        goldCost: 200,
        locationReq: 'capital',
        successBase: 0.65,
        skillKey: 'social',
        narrative: 'You spend weeks in private audience with the aging king, reviewing the claims and qualifications of potential heirs.',
        successText: 'The king accepts your counsel. Your advice will shape the kingdom\'s future for generations.',
        failText: 'The king dismisses your recommendations, finding them too self-serving. Trust is damaged.',
    },
    // CORRUPT
    eliminate_rival: {
        label: 'Remove Political Threat',
        actionLabel: '🗡️ Set Plan in Motion',
        tickCost: 10,
        goldCost: 400,       // hire assassins, bribes
        locationReq: 'any',
        successBase: 0.50,
        skillKey: 'underworld',
        narrative: 'You hire discreet agents and begin orchestrating the removal of the king\'s rival from the political stage.',
        successText: 'The rival suffers a convenient "accident." No one asks questions — the king is pleased.',
        failText: 'Your agents bungle the job. Suspicion rises but nothing can be traced back to you... yet.',
    },
    silence_witness: {
        label: 'Silence Witness',
        actionLabel: '🤫 Track Down Witness',
        tickCost: 5,
        goldCost: 200,
        locationReq: 'any',
        successBase: 0.60,
        skillKey: 'underworld',
        narrative: 'You track down the troublesome witness and arrange a meeting at a secluded location.',
        successText: 'The witness agrees to keep quiet — whether through gold or fear, the threat is neutralized.',
        failText: 'The witness has already fled the town. You\'ll need to find them again.',
    },
    forge_evidence: {
        label: 'Forge Evidence',
        actionLabel: '📝 Begin Forgery',
        tickCost: 8,
        goldCost: 250,       // supplies, seals, accomplices
        locationReq: 'any',
        successBase: 0.55,
        skillKey: 'underworld',
        narrative: 'You acquire blank parchment with the target\'s seal and begin carefully crafting false documents.',
        successText: 'The forged documents are indistinguishable from genuine correspondence. A perfect frame.',
        failText: 'Your forgery contains subtle errors that an expert would spot. You must destroy the evidence and try again.',
    },
    seize_assets: {
        label: 'Seize Merchant Assets',
        actionLabel: '⚖️ File Writ of Seizure',
        tickCost: 5,
        goldCost: 100,
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'social',
        narrative: 'You present forged royal authority to the local magistrate and order the seizure of the merchant\'s warehouses.',
        successText: 'The merchant\'s goods are confiscated. They protest, but no one dares challenge the king\'s will.',
        failText: 'The merchant has powerful friends who intervene. The seizure is blocked.',
    },
    intimidate: {
        label: 'Intimidate Opposition',
        actionLabel: '💀 Send a Warning',
        tickCost: 3,
        goldCost: 50,
        locationReq: 'any',
        successBase: 0.75,
        skillKey: 'survival',
        narrative: 'You arrange for threatening messages and displays of force to silence political opponents.',
        successText: 'The opposition falls silent. Fear is a powerful motivator.',
        failText: 'Your threats backfire — the opposition rallies support against you. You need a different approach.',
    },
    frame_merchant: {
        label: 'Frame Elite Merchant',
        actionLabel: '🕵️ Plant Evidence',
        tickCost: 8,
        goldCost: 300,
        locationReq: 'any',
        successBase: 0.50,
        skillKey: 'underworld',
        narrative: 'You identify a wealthy merchant and begin planting false evidence of treason in their warehouse and correspondence.',
        successText: 'The merchant is arrested! Their wealth is seized by the crown — with a generous finder\'s fee for you.',
        failText: 'The evidence is discovered too early and linked to a planted source. You flee before suspicion falls on you.',
    },
    rig_election: {
        label: 'Rig Council Election',
        actionLabel: '🏴 Begin Rigging',
        tickCost: 10,
        goldCost: 500,
        locationReq: 'capital',
        successBase: 0.45,
        skillKey: 'underworld',
        narrative: 'You bribe vote counters, intimidate neutral council members, and forge proxy ballots.',
        successText: 'The election results are exactly what the king wanted. No one suspects a thing.',
        failText: 'An honest council member discovers the ballot forgeries. The election is declared void.',
    },
    // MILITARY
    recruit_npcs: {
        label: 'Recruit Soldiers',
        actionLabel: '📢 Begin Recruitment Drive',
        tickCost: 8,
        goldCost: 150,
        locationReq: 'any',
        successBase: 0.75,
        skillKey: 'social',
        narrative: 'You set up a recruitment post in the town square, offering the king\'s coin to able-bodied men willing to fight.',
        successText: 'Volunteers line up eagerly. You meet your recruitment quota and deliver the new recruits to the barracks.',
        failText: 'The townspeople are reluctant — fear of war outweighs the king\'s coin. You\'ll need to try again with better incentives.',
    },
    stay_location: {
        label: 'Defend Position',
        actionLabel: '🛡️ Hold the Position',
        tickCost: 12,
        goldCost: 100,
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'survival',
        narrative: 'You organize defenses and prepare to hold the position against potential enemy action for an extended period.',
        successText: 'The watch passes without incident — or perhaps your vigilance deterred the enemy. The position is secure.',
        failText: 'A surprise raid catches your defenders off-guard. You hold the position but fail to meet the tactical objectives.',
    },
    sabotage_enemy: {
        label: 'Sabotage Enemy Supply Lines',
        actionLabel: '🔥 Launch Raid',
        tickCost: 10,
        goldCost: 300,
        locationReq: 'any',
        successBase: 0.50,
        skillKey: 'survival',
        narrative: 'You lead a small team behind enemy lines, targeting supply wagons, bridges, and storage depots.',
        successText: 'The raid is a resounding success! Enemy supply wagons burn and their advance stalls for weeks.',
        failText: 'Enemy patrols detect your team before you reach the supply lines. You barely escape with your lives.',
    },
    // ECONOMIC
    create_caravan: {
        label: 'Establish Trade Route',
        actionLabel: '🛤️ Organize the Route',
        tickCost: 8,
        goldCost: 200,
        locationReq: 'any',
        successBase: 0.75,
        skillKey: 'commerce',
        narrative: 'You negotiate with merchants and town officials along the proposed route, securing waypoints and supply agreements.',
        successText: 'The new trade route is established! Merchants begin regular shipments along the path you blazed.',
        failText: 'Bandits along the route prove too dangerous, and local officials demand excessive tolls. The route is not viable yet.',
    },
    build_building: {
        label: 'Establish Industry',
        actionLabel: '🏗️ Begin Construction',
        tickCost: 12,
        goldCost: 300,
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'commerce',
        narrative: 'You hire builders and source materials, overseeing the construction of a new industrial facility for the kingdom.',
        successText: 'Construction is complete! The new facility begins production, boosting the local economy.',
        failText: 'Supply shortages and labor disputes delay construction beyond the deadline. The project stalls.',
    },
    // DIPLOMATIC
    diplomatic_mission: {
        label: 'Diplomatic Mission',
        actionLabel: '🤝 Conduct Diplomacy',
        tickCost: 10,
        goldCost: 200,
        locationReq: 'any',
        successBase: 0.55,
        skillKey: 'social',
        narrative: 'You travel as an envoy of the crown, bearing sealed letters and gifts for foreign dignitaries.',
        successText: 'The negotiations conclude favorably. Both sides sign the agreement — a diplomatic triumph for your kingdom!',
        failText: 'The foreign court proves hostile to your proposals. You return empty-handed, but at least unharmed.',
    },
    // JUSTICE
    capture_criminal: {
        label: 'Capture Criminal',
        actionLabel: '⚔️ Hunt Them Down',
        tickCost: 6,
        goldCost: 75,
        locationReq: 'any',
        successBase: 0.65,
        skillKey: 'survival',
        narrative: 'You study the criminal\'s habits, question witnesses, and set a trap near their known hideout.',
        successText: 'The criminal is captured! You drag them before the magistrate in chains to face justice.',
        failText: 'The criminal spotted your trap and fled into the wilderness. They remain at large.',
    },
    enforce_ban: {
        label: 'Enforce Goods Ban',
        actionLabel: '🚫 Conduct Inspections',
        tickCost: 5,
        goldCost: 50,
        locationReq: 'any',
        successBase: 0.75,
        skillKey: 'social',
        narrative: 'You inspect market stalls, warehouses, and incoming caravans, searching for banned goods hidden among legitimate cargo.',
        successText: 'Multiple caches of banned goods discovered and confiscated! The king is impressed by your thoroughness.',
        failText: 'The smugglers were tipped off before your inspections. You find nothing — they moved their stock overnight.',
    },
    manhunt: {
        label: 'Lead Manhunt',
        actionLabel: '🔍 Organize the Search',
        tickCost: 8,
        goldCost: 150,
        locationReq: 'any',
        successBase: 0.55,
        skillKey: 'survival',
        narrative: 'You organize search parties, post rewards, and personally track the fugitive across the countryside.',
        successText: 'After days of relentless pursuit, you corner the fugitive in an abandoned farmhouse. Justice is served.',
        failText: 'The fugitive\'s trail goes cold at the river. They may have crossed into another kingdom.',
    },
    arbitrate: {
        label: 'Arbitrate Dispute',
        actionLabel: '⚖️ Hear Both Sides',
        tickCost: 6,
        goldCost: 50,
        locationReq: 'any',
        successBase: 0.65,
        skillKey: 'social',
        narrative: 'You sit in judgment as both parties present their cases, examining evidence and testimony with careful deliberation.',
        successText: 'Your ruling is accepted by both parties. The dispute is settled and order is restored.',
        failText: 'Both parties reject your ruling and the dispute escalates. You\'ll need to try a different approach.',
    },
    patrol_roads: {
        label: 'Patrol Roads',
        actionLabel: '🛡️ Begin Patrol',
        tickCost: 6,
        goldCost: 100,
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'survival',
        narrative: 'You ride the kingdom\'s roads with a small guard force, watching for bandits and protecting travelers.',
        successText: 'Your patrol deters bandit activity and you intercept a group of highwaymen preying on merchants.',
        failText: 'The bandits avoided your patrol routes. Reports of attacks continue from roads you didn\'t cover.',
    },
    escort_npc: {
        label: 'Escort VIP',
        actionLabel: '🛡️ Begin Escort',
        tickCost: 7,
        goldCost: 100,
        locationReq: 'any',
        successBase: 0.70,
        skillKey: 'survival',
        narrative: 'You assemble a guard detail and plan a safe route, watching for ambush points and preparing contingencies.',
        successText: 'The journey passes without incident. Your charge arrives safely and commends your professionalism.',
        failText: 'Bandits attack the convoy on a narrow forest road. You repel them, but your charge is shaken and dissatisfied.',
    },
    confiscate: {
        label: 'Confiscate Contraband',
        actionLabel: '🔍 Raid Suspected Locations',
        tickCost: 4,
        goldCost: 30,
        locationReq: 'any',
        successBase: 0.80,
        skillKey: 'social',
        narrative: 'Armed with royal authority, you raid warehouses and market stalls suspected of holding illegal goods.',
        successText: 'You uncover a significant contraband cache hidden beneath a merchant\'s shop. The goods are seized for the crown.',
        failText: 'The suspects cleaned out their storerooms before you arrived. Someone must have warned them.',
    },
    visit_towns: {
        label: 'Visit Kingdom Towns',
        actionLabel: '🏘️ Visit Town',
        tickCost: 3,
        goldCost: 15,
        locationReq: false,
        successBase: 0.80,
        skillKey: 'social',
        narrative: 'You travel to a town in the kingdom, speaking with locals and performing the duties assigned by the crown.',
        successText: 'Your visit was well received. The townspeople take note of the crown\'s presence through you.',
        failText: 'The visit was uneventful. Local officials were uncooperative and you accomplished little.',
    },
    visit_enemy_towns: {
        label: 'Scout Enemy Territory',
        actionLabel: '🕵️ Infiltrate Enemy Town',
        tickCost: 5,
        goldCost: 30,
        locationReq: false,
        successBase: 0.55,
        skillKey: 'survival',
        narrative: 'Disguised as a common traveller, you slip into enemy territory to gather intelligence on troop movements and fortifications.',
        successText: 'You successfully scouted the enemy town and gathered valuable intelligence without being detected.',
        failText: 'Guards became suspicious and you were forced to flee before gathering useful information.',
    },
    visit_foreign: {
        label: 'Diplomatic Visit Abroad',
        actionLabel: '🌍 Travel to Foreign Land',
        tickCost: 4,
        goldCost: 25,
        locationReq: false,
        successBase: 0.70,
        skillKey: 'social',
        narrative: 'You journey to a foreign kingdom as a representative of the crown, forging bonds and gathering knowledge.',
        successText: 'Your diplomatic visit was a success. Foreign officials welcomed you warmly and valuable connections were made.',
        failText: 'The foreign court was cold and dismissive. Your visit accomplished little of note.',
    },
    sell_foreign: {
        label: 'Sell Goods Abroad',
        actionLabel: '💰 Trade in Foreign Markets',
        tickCost: 4,
        goldCost: 20,
        locationReq: false,
        successBase: 0.65,
        skillKey: 'commerce',
        narrative: 'You set up a trading stall in a foreign market, selling your kingdom\'s finest goods to expand trade influence.',
        successText: 'Foreign buyers were eager for your goods. Trade connections have been established and gold flows back to the kingdom.',
        failText: 'Local merchants undercut your prices and foreign tariffs ate into your profits. The venture was a loss.',
    },
    shake_down: {
        label: 'Shake Down Merchants',
        actionLabel: '💀 Intimidate Merchant',
        tickCost: 3,
        goldCost: 0,
        locationReq: false,
        successBase: 0.60,
        skillKey: 'social',
        narrative: 'Using your noble authority, you pressure local merchants into paying unofficial "taxes" directly to you.',
        successText: 'The merchant, fearful of your influence, hands over a purse of gold without further protest.',
        failText: 'The merchant refuses and threatens to report your extortion to the king. You back off quickly.',
    },
    extort: {
        label: 'Extort Foreign Traders',
        actionLabel: '🗡️ Threaten Trader',
        tickCost: 4,
        goldCost: 0,
        locationReq: false,
        successBase: 0.55,
        skillKey: 'social',
        narrative: 'You target vulnerable foreign traders, demanding "protection fees" in exchange for safe passage through the kingdom.',
        successText: 'The terrified trader pays up without resistance. You pocket the gold and disappear into the crowd.',
        failText: 'The trader had hired guards and your threats fell flat. You retreat empty-handed and hope no one reports the incident.',
    },
    mediate: {
        label: 'Mediate Noble Dispute',
        actionLabel: '🕊️ Begin Mediation',
        tickCost: 8,
        goldCost: 100,
        locationReq: 'any',
        successBase: 0.60,
        skillKey: 'social',
        narrative: 'You invite both noble houses to a neutral meeting ground and listen to their grievances with studied patience.',
        successText: 'After tense negotiations, both houses agree to a compromise. You have prevented a feud that could have torn the court apart.',
        failText: 'One party storms out of negotiations. The dispute deepens and you are blamed for the failure.',
    },
};

// M5: Multi-step action quest definitions
const MULTISTEP_ACTIONS = {
    decode: {
        totalSteps: 3,
        steps: [
            { label: 'Acquire Cipher Tools', narrative: 'Purchase decryption tools and reference materials from a scholar.', tickCost: 1, goldCost: 20, successBase: 0.90, skillKey: 'underworld' },
            { label: 'Study Documents', narrative: 'Spend time analyzing the encrypted messages and identifying patterns.', tickCost: 3, goldCost: 0, successBase: 0.80, skillKey: 'underworld' },
            { label: 'Attempt Decode', narrative: 'Apply your analysis to crack the cipher and extract the intelligence.', tickCost: 4, goldCost: 30, successBase: 0.65, skillKey: 'underworld' }
        ]
    },
    investigate: {
        totalSteps: 3,
        steps: [
            { label: 'Gather Evidence', narrative: 'Search specific buildings across the kingdom for clues and physical evidence.', tickCost: 2, goldCost: 15, successBase: 0.90, skillKey: 'underworld', interactive: 'search_buildings' },
            { label: 'Interview Witnesses', narrative: 'Track down and interview key people who may have witnessed suspicious activity.', tickCost: 3, goldCost: 10, successBase: 0.80, skillKey: 'social', interactive: 'interview_npcs' },
            { label: 'Report Findings', narrative: 'Compile your evidence and deliver a comprehensive report.', tickCost: 2, goldCost: 0, successBase: 0.85, skillKey: 'social' }
        ]
    },
    capture_criminal: {
        totalSteps: 3,
        steps: [
            { label: 'Get Bounty Details', narrative: 'Review the bounty notice and gather information about the target\'s habits.', tickCost: 1, goldCost: 10, successBase: 0.95, skillKey: 'survival', interactive: 'skip' },
            { label: 'Track Target', narrative: 'Ask around in towns where the criminal was last seen to discover their whereabouts.', tickCost: 3, goldCost: 25, successBase: 0.70, skillKey: 'survival', interactive: 'ask_npcs' },
            { label: 'Attempt Capture', narrative: 'Find the criminal and apprehend them. Be prepared for a fight.', tickCost: 2, goldCost: 0, successBase: 0.60, skillKey: 'survival', interactive: 'capture' }
        ]
    },
    intercept: {
        totalSteps: 2,
        steps: [
            { label: 'Stake Out Route', narrative: 'Position yourself along the courier\'s expected route and wait.', tickCost: 3, goldCost: 20, successBase: 0.85, skillKey: 'underworld' },
            { label: 'Intercept Courier', narrative: 'Move to intercept the courier and seize the documents.', tickCost: 2, goldCost: 15, successBase: 0.65, skillKey: 'underworld' }
        ]
    },
    manhunt: {
        totalSteps: 3,
        steps: [
            { label: 'Organize Search Parties', narrative: 'Rally guards and volunteers to form search teams.', tickCost: 2, goldCost: 30, successBase: 0.90, skillKey: 'social' },
            { label: 'Sweep the Area', narrative: 'Lead coordinated sweeps through suspected hideouts and safe houses.', tickCost: 4, goldCost: 20, successBase: 0.75, skillKey: 'survival', interactive: 'search_buildings' },
            { label: 'Close the Net', narrative: 'Corner the fugitive and bring them to justice.', tickCost: 2, goldCost: 0, successBase: 0.60, skillKey: 'survival', interactive: 'capture' }
        ]
    }
};

// ============================================================
// Military Unit Types
// ============================================================

const MILITARY_UNITS = {
    infantry: { name: 'Infantry', equipGoods: ['swords', 'armor'],            attackMult: 1.0, defenseMult: 1.2, icon: '⚔️' },
    archer:   { name: 'Archer',   equipGoods: ['bows', 'arrows'],             attackMult: 0.7, defenseMult: 1.5, icon: '🏹' },
    cavalry:  { name: 'Cavalry',  equipGoods: ['horses', 'swords', 'saddles'], attackMult: 1.8, defenseMult: 0.6, icon: '🐴' },
};

// ============================================================
// Kingdom Cultures
// ============================================================

const KINGDOM_CULTURES = ['agricultural', 'military', 'mercantile', 'industrial'];

// ============================================================
// Name Generation Data
// ============================================================

const NAMES = {
    male: ['Aldric','Bram','Cedric','Dorian','Edmund','Falric','Gareth','Hugo','Ivan','Jareth',
           'Kaelen','Leoric','Magnus','Nolan','Osric','Percival','Quinn','Roland','Soren','Theron',
           'Ulric','Victor','Willem','Yorick','Alaric','Bertram','Conrad','Darius','Elric','Fenris',
           'Godwin','Harald','Ingmar','Jasper','Kendric','Lothar','Merric','Norbert','Oswald','Reynard',
           'Stefan','Tormund','Valentin','Werner','Baldric','Cormac','Dietrich','Emeric','Florian','Gunther',
           'Ansel','Bartholomew','Callum','Desmond','Egan','Finnian','Gideon','Hadrian','Ivar','Joachim',
           'Kellan','Lucian','Marius','Niklas','Orion','Phelan','Randolph','Silas','Tobias','Ulrich',
           'Varen','Wendell','Aldous','Brennan','Cassius','Declan','Everett','Frederick','Griffin','Henric'],
    female: ['Alara','Brenna','Celeste','Diana','Elara','Freya','Gwen','Helena','Iris','Juliana',
             'Katarina','Lysara','Mira','Nadia','Ophelia','Petra','Rosalind','Sera','Thea','Una',
             'Vivian','Wren','Yara','Adeline','Beatrix','Cordelia','Daphne','Elowen','Fiora','Giselle',
             'Helga','Ingrid','Joanna','Keira','Liora','Margot','Nessa','Ottilia','Rowena','Sigrid',
             'Tamsin','Ursula','Verity','Willa','Astrid','Brigid','Clara','Edith','Faye','Greta',
             'Anwen','Bianca','Calista','Delphine','Eloise','Felicity','Genevieve','Hadria','Ilse','Jessamine',
             'Kalista','Lenora','Marigold','Nerissa','Odette','Primrose','Rhiannon','Sabine','Tabitha','Undine',
             'Valencia','Winona','Adelheid','Brunhild','Cosette','Dorothea','Evelina','Francesca','Guinevere','Honoria'],
    surnames: ['Ashford','Blackwood','Crowley','Dunmore','Everhart','Fairfax','Greystone','Hawthorne',
               'Ironwood','Justwell','Kingsford','Langley','Moorfield','Northcott','Oakridge','Pemberton',
               'Redcliffe','Stonewall','Thornbury','Underhill','Valemont','Whitfield','Yarrow','Alderton',
               'Blackthorn','Coldwell','Davenport','Eastmere','Foxley','Goldwyn','Hartwell','Ivywood',
               'Kensley','Lockhart','Millbrook','Norwood','Oldcastle','Prescott','Ravenscroft','Silverdale',
               'Tanfield','Westbrook','Ashworth','Bramwell','Clayborne','Durnham','Edgeworth','Fernsby',
               'Brightmoor','Castellan','Deepforge','Eldershaw','Farthington','Galloway','Holloway','Inkwell',
               'Kettleworth','Longmire','Marshwood','Nightingale','Oakheart','Pennington','Queensworth','Rowanfield',
               'Sedgewick','Thistledown','Underwood','Valenwright','Windhaven','Ashborne','Bellingham','Carrowmore',
               'Duncastle','Elmsworth','Fairweather','Greenvale','Heatherstone','Ironside','Jasperwell'],
    kingdoms: ['Valdoria','Aethermoor','Ironhaven','Brighthollow','Stormcrest','Thornwall','Eldermark',
               'Duskhollow','Ravencrown','Goldspire','Ashenvale','Frostmere','Sunweald','Shadowpeak',
               'Kingsholme','Wyvernreach','Dragonmere','Silverthorne','Blackmoor','Stonehearth',
               'Gallowick','Embervale','Northmarch','Whitecliff','Greywatch','Lionspire',
               'Dawnkeep','Mistral','Oakenhold','Winterfell','Crimsonhold','Highcrest',
               'Ravenmark','Dreadmount','Tidewall','Sablewood'],
    towns: ['Millhaven','Oakbridge','Stonecross','Riverford','Highwall','Irongate','Greendale','Foxhollow',
            'Thornfield','Bridgewater','Ashwick','Goldleaf','Pinecrest','Ravensbrook','Silverstream',
            'Copperhill','Willowmere','Hawksrest','Deepwell','Marshton','Windhill','Redwater','Longbarrow',
            'Briarwood','Coldspring','Deerfield','Elmcrest','Fairhaven','Grassmere','Heatherwick',
            'Ivybridge','Junipervale','Kingsbury','Lindenford','Moorgate','Netherby','Orchard End',
            'Plumstead','Queensbury','Rosemead','Sunnydale','Thistlewood','Uppermill','Vinehill','Wayford',
            'Aldermead','Barrowton','Candlewick','Dunhaven','Eastmoor','Fallowfield','Greybridge','Harrowdale',
            'Inkwell Cross','Jasperford','Kettlebrook','Larkspur','Merrowvale','Northgate','Oxenford',
            'Pellham','Quarrystone','Ramsgate','Sweetwater','Tanglewood','Underhill','Veritas','Whitcombe',
            'Yewdale','Ambervale','Blackfen','Coalhurst','Dovecot','Eaglecrest','Fernwick','Galepoint',
            'Hollowmere','Ironmoor','Jackdaw Rise','Knotwood','Lambeth','Millstone','Nettleford',
            'Oldwick','Pebblecreek','Rustbridge','Saltmarsh','Twinbrook','Umberford','Westhollow'],
    islands: ['Isle of Storms', "Serpent's Rock", 'Tidewatch', 'Coral Haven', 'Windbreaker Isle',
              'The Shattered Reef', 'Saltspray Atoll', 'Dragonmaw Isle',
              'Thornback Isle', 'The Widow', 'Driftwood Cay', 'Ember Atoll', 'Fogwatch Island',
              'Gullstone', 'Harborless Rock', 'Icebreak Isle', 'Jade Shoals', 'Kelpwrack',
              'Longshore', 'Mermaid Rock', 'Nighttide Isle', 'Oyster Banks'],
};

// ============================================================
// Terrain Types
// ============================================================

const TERRAIN = {
    GRASS:    { id: 0, name: 'Grassland', color: '#4a7c3f', moveCost: 1.0, buildable: true },
    FOREST:   { id: 1, name: 'Forest',    color: '#2d5a27', moveCost: 1.5, buildable: false },
    WATER:    { id: 2, name: 'Water',     color: '#2a6496', moveCost: 99,  buildable: false },
    MOUNTAIN: { id: 3, name: 'Mountain',  color: '#8b7355', moveCost: 3.0, buildable: false },
    HILLS:    { id: 4, name: 'Hills',     color: '#6b8e4e', moveCost: 1.5, buildable: true },
    SAND:     { id: 5, name: 'Desert',    color: '#c2b280', moveCost: 1.3, buildable: true },
};

// ============================================================
// Occupation Types
// ============================================================

const OCCUPATIONS = {
    NONE:       { id: 'none',       name: 'Unemployed', wage: 0 },
    FARMER:     { id: 'farmer',     name: 'Farmer',     wage: 2 },
    MINER:      { id: 'miner',      name: 'Miner',      wage: 3 },
    WOODCUTTER: { id: 'woodcutter', name: 'Woodcutter', wage: 2 },
    CRAFTSMAN:  { id: 'craftsman',  name: 'Craftsman',  wage: 4 },
    MERCHANT:   { id: 'merchant',   name: 'Merchant',   wage: 0 },
    SOLDIER:    { id: 'soldier',    name: 'Soldier',    wage: 3 },
    GUARD:      { id: 'guard',      name: 'Guard',      wage: 4 },
    NOBLE:      { id: 'noble',      name: 'Noble',      wage: 0 },
    KING:       { id: 'king',       name: 'King',       wage: 0 },
    QUEEN:      { id: 'queen',      name: 'Queen',      wage: 0 },
    REIGNING_QUEEN: { id: 'reigning_queen', name: 'Reigning Queen', wage: 0 },
    QUEENS_LORD: { id: 'queens_lord', name: "The Queen's Lord", wage: 0 },
    LABORER:    { id: 'laborer',    name: 'Laborer',    wage: 2 },
};

// ============================================================
// Event Types
// ============================================================

const EVENT_TYPES = {
    PLAGUE:           { id: 'plague',          name: 'Plague',               severity: 'high',   chance: 0.001 },
    DROUGHT:          { id: 'drought',         name: 'Drought',              severity: 'medium', chance: 0.002 },
    BANDIT_SURGE:     { id: 'bandit_surge',    name: 'Bandit Uprising',      severity: 'medium', chance: 0.003 },
    BOUNTIFUL_HARVEST:{ id: 'bountiful',       name: 'Bountiful Harvest',    severity: 'good',   chance: 0.004 },
    MINE_DISCOVERY:   { id: 'mine_discovery',  name: 'New Mineral Vein',     severity: 'good',   chance: 0.001 },
    ROYAL_WEDDING:    { id: 'royal_wedding',   name: 'Royal Wedding',        severity: 'good',   chance: 0.001 },
    ASSASSINATION:    { id: 'assassination',   name: 'Assassination Attempt',severity: 'high',   chance: 0.0005 },
    TRADE_FESTIVAL:   { id: 'trade_festival',  name: 'Trade Festival',       severity: 'good',   chance: 0.003 },
    FLOOD:            { id: 'flood',           name: 'Flood',                severity: 'medium', chance: 0.002 },
    RELIGIOUS_FERVOR: { id: 'religious',       name: 'Religious Movement',   severity: 'low',    chance: 0.002 },
    PIRATES:          { id: 'pirates',         name: 'Pirates Spotted',      severity: 'medium', chance: 0.002 },
    STORM_SEASON:     { id: 'storm_season',    name: 'Storm Season',         severity: 'medium', chance: 0.001 },
    NAVAL_RAID:       { id: 'naval_raid',      name: 'Naval Raid',           severity: 'high',   chance: 0.001 },
    NAVAL_BLOCKADE:   { id: 'naval_blockade',  name: 'Naval Blockade',       severity: 'high',   chance: 0.0005 },
};

// ============================================================
// Merchant XP & Level System
// ============================================================

const MERCHANT_LEVELS = [
    { level: 1,  xp: 0,     title: 'Novice Trader' },
    { level: 2,  xp: 50,    title: 'Apprentice' },
    { level: 3,  xp: 150,   title: 'Journeyman' },
    { level: 4,  xp: 350,   title: 'Merchant' },
    { level: 5,  xp: 700,   title: 'Experienced Merchant' },
    { level: 6,  xp: 1200,  title: 'Master Merchant' },
    { level: 7,  xp: 2000,  title: 'Grand Merchant' },
    { level: 8,  xp: 3500,  title: 'Merchant Prince' },
    { level: 9,  xp: 6000,  title: 'Trade Baron' },
    { level: 10, xp: 10000, title: 'Legendary Merchant' },
    { level: 11, xp: 15000, title: 'Trade Magnate' },
    { level: 12, xp: 22000, title: 'Commerce King' },
    { level: 13, xp: 32000, title: 'Empire Builder' },
    { level: 14, xp: 45000, title: 'Merchant Emperor' },
    { level: 15, xp: 65000, title: 'Eternal Tycoon', bonusSP: 6 },
];

const XP_REWARDS = {
    BUY_TRADE: 1,        // minimum XP per buy; actual XP scales with trade value
    SELL_TRADE: 1,       // minimum XP per sell; actual XP scales with trade value
    TRADE_XP_PER_GOLD: 50, // 1 XP per this many gold in trade value
    PROFIT_BONUS: 2,
    CARAVAN_COMPLETE: 5,
    SEA_VOYAGE: 8,
    BUILD: 10,
    HIRE: 3,
    NEW_RANK: 50,
    MARRY: 20,
    CHILD: 15,
    COMBAT_SURVIVE: 10,
    SMUGGLE_SUCCESS: 5,
    GIFT: 1,
    SUPPLY_CHAIN: 100,
    DAILY_PASSIVE: 0.5,
    HEIR_TRANSFER_RATIO: 10, // for every 10 unspent XP, 1 transfers to heir
};

const SKILL_POINTS_PER_LEVEL = 4;

// ============================================================
// Skill Tree — 50 Skills in 6 Branches
// ============================================================

const SKILLS = {
    // ── Commerce Branch (10) ──
    keen_eye:            { name: 'Keen Eye',            branch: 'commerce',   cost: 0, requires: [],                              desc: 'See buy/sell prices in your current town at a glance.',                    icon: '👁️' },
    price_memory:        { name: 'Price Memory',        branch: 'commerce',   cost: 1, requires: ['keen_eye'],                    desc: 'Remember town prices for 60 days instead of 30 after visiting.',            icon: '🧠' },
    market_scout:        { name: 'Market Scout',        branch: 'commerce',   cost: 2, requires: ['keen_eye'],                    desc: 'See prices in towns where you have workers/buildings (updated every 30 days).', icon: '🔭' },
    trade_network:       { name: 'Trade Network',       branch: 'commerce',   cost: 5, requires: ['market_scout', 'silver_tongue'],   desc: 'See current prices in all towns of your home kingdom.',                    icon: '🗺️' },
    regional_survey:     { name: 'Regional Survey',     branch: 'commerce',   cost: 2, requires: ['trade_network'],               desc: 'See resource deposits for towns in your kingdom. Toggle in the ⚡ Abilities tab of Skills.', icon: '📋' },
    world_survey:        { name: 'World Survey',        branch: 'commerce',   cost: 2, requires: ['regional_survey'],             desc: 'See resource deposits for ALL towns across the entire map. Toggle in the ⚡ Abilities tab of Skills. Right-click the map to survey an area.', icon: '🗺️' },
    foreign_intelligence: { name: 'Foreign Intelligence', branch: 'commerce', cost: 4, requires: ['regional_survey', 'haggler'], desc: 'Your trade contacts keep you informed of foreign kingdom events — wars, laws, embargoes, plagues.', icon: '🌐' },
    global_trade_intel:  { name: 'Global Trade Intel',  branch: 'commerce',   cost: 8, requires: ['trade_network', 'foreign_intelligence'], desc: 'See current prices in ALL towns across all kingdoms.',                     icon: '🌍' },
    haggler:             { name: 'Haggler',             branch: 'commerce',   cost: 2, requires: [],                              desc: '5% discount when buying goods. -10% street buy prices.',                                           icon: '🤝' },
    master_haggler:      { name: 'Master Haggler',      branch: 'commerce',   cost: 3, requires: ['haggler'],                     desc: '10% discount when buying goods (replaces Haggler). -10% street buy prices.',                       icon: '💰' },
    silver_tongue:       { name: 'Silver Tongue',       branch: 'commerce',   cost: 2, requires: [],                              desc: '5% bonus when selling goods. +5% quarantine bribe chance. -5% street buy prices.',                icon: '🗣️' },
    golden_tongue:       { name: 'Golden Tongue',       branch: 'commerce',   cost: 3, requires: ['silver_tongue'],               desc: '10% bonus when selling goods (replaces Silver Tongue). +5% quarantine bribe chance. -5% street buy prices.', icon: '👅' },
    bulk_trader:         { name: 'Bulk Trader',         branch: 'commerce',   cost: 5, requires: ['master_haggler'],              desc: '25% discount on buy transactions over 5,000 gold.',                        icon: '📦' },
    trade_network_intelligence: { name: 'Trade Network Intel', branch: 'commerce', cost: 3, requires: ['bulk_trader'], desc: 'Your trade network reports on elite merchant activities — major trades, expansion, financial struggles.', icon: '📊' },
    market_manipulator:  { name: 'Market Manipulator',  branch: 'commerce',   cost: 5, requires: ['golden_tongue','master_haggler'], desc: 'Your trades have 2x effect on market prices.',                          icon: '📈' },
    merchant_intelligence: { name: 'Merchant Intelligence', branch: 'commerce', cost: 3, requires: ['trade_network'], desc: 'Reveals elite merchant locations and activity notifications. Without this skill, EM activities are hidden.', icon: '🔍' },
    merchant_tracker: { name: 'Merchant Tracker', cost: 1, branch: 'commerce', requires: [], desc: 'Track elite merchants on the map. Click any elite merchant and select "Track" to see their location with a ⭐ marker.', icon: '⭐' },
    elite_tracker: { name: 'Elite Tracker', cost: 5, branch: 'commerce', requires: ['merchant_tracker'], desc: 'Receive detailed notifications about your tracked elite merchants\' activities — their trades, travels, and business decisions.', icon: '📡' },

    // ── Industry Branch (8) ──
    efficient_builder:   { name: 'Efficient Builder',   branch: 'industry',   cost: 2, requires: [],                              desc: 'Buildings cost 10% less to construct.',                                    icon: '🔨' },
    master_builder:      { name: 'Master Builder',      branch: 'industry',   cost: 3, requires: ['efficient_builder'],            desc: 'Buildings cost 20% less (replaces Efficient Builder).',                    icon: '🏛️' },
    foreman:             { name: 'Foreman',             branch: 'industry',   cost: 3, requires: [],                              desc: 'Workers produce 10% more in your buildings.',                              icon: '👷' },
    master_foreman:      { name: 'Master Foreman',      branch: 'industry',   cost: 4, requires: ['foreman'],                     desc: 'Workers produce 20% more (replaces Foreman).',                             icon: '🏭' },
    cheap_labor:         { name: 'Cheap Labor',         branch: 'industry',   cost: 2, requires: [],                              desc: 'Hiring workers costs 15% less.',                                           icon: '💵' },
    loyalty_bonus:       { name: 'Loyalty Bonus',       branch: 'industry',   cost: 2, requires: [],                              desc: 'Workers tolerate 50% longer without pay before quitting, and are 30% harder to poach.', icon: '🤞' },
    building_upgrade_discount: { name: 'Upgrade Discount', branch: 'industry', cost: 3, requires: ['master_builder'],             desc: 'Building upgrades cost 25% less.',                                         icon: '⬆️' },
    supply_chain_expert: { name: 'Supply Chain Expert', branch: 'industry',   cost: 5, requires: ['master_foreman'],              desc: 'Production chains in same town get +15% output bonus.',                    icon: '🔗' },
    haggler_hire:        { name: 'Hiring Haggler',      branch: 'industry',   cost: 2, requires: ['cheap_labor'],                 desc: '30% discount on hiring costs (replaces Cheap Labor).',                     icon: '💼' },

    // ── Crafting Quality Branch (4) ──
    good_weaponcraft:      { name: 'Good Weaponcraft',      branch: 'industry', cost: 2, requires: [],                     desc: '+20% chance to craft good quality weapons (swords, bows, arrows).',         icon: '⚔️' },
    good_armorcraft:       { name: 'Good Armorcraft',       branch: 'industry', cost: 2, requires: [],                     desc: '+20% chance to craft good quality armor.',                                  icon: '🛡️' },
    excellent_weaponcraft: { name: 'Excellent Weaponcraft', branch: 'industry', cost: 2, requires: ['good_weaponcraft'],   desc: '+20% chance to craft excellent quality weapons (swords, bows, arrows).',    icon: '⚔️' },
    excellent_armorcraft:  { name: 'Excellent Armorcraft',  branch: 'industry', cost: 2, requires: ['good_armorcraft'],    desc: '+20% chance to craft excellent quality armor.',                              icon: '🛡️' },

    // ── Property/Business Branch (2) ──
    property_magnate:    { name: 'Property Magnate',    branch: 'industry',   cost: 3, requires: ['master_builder'],              desc: '+1 max buildings per rank tier. -10% property tax.',                        icon: '🏘️' },
    town_benefactor:     { name: 'Town Benefactor',    branch: 'industry',   cost: 4, requires: ['property_magnate'],       desc: 'Your buildings give 2× prosperity boost to town. +5% reputation in towns where you own buildings.', icon: '🏛️' },
    property_appraiser:  { name: 'Property Appraiser', branch: 'industry',   cost: 1, requires: [],                              desc: 'Know the exact highest price anyone would pay for your property.',          icon: '🔎' },
    rental_appraiser:    { name: 'Rental Appraiser',   branch: 'industry',   cost: 2, requires: [],                              desc: 'Know the exact highest rent anyone would pay for your rental property.',    icon: '🏷️' },
    local_market_analysis: { name: 'Local Market Analysis', branch: 'industry', cost: 1, requires: [], desc: 'View a real estate report for your current town: building costs, material prices, 90/360-day trends and projections.', icon: '📊' },
    kingdom_market_analysis: { name: 'Kingdom Market Analysis', branch: 'industry', cost: 2, requires: ['local_market_analysis'], desc: 'Extends your real estate report to all locations in your kingdom.', icon: '👑' },
    global_market_analysis: { name: 'Global Market Analysis', branch: 'industry', cost: 3, requires: ['kingdom_market_analysis'], desc: 'Extends your real estate report to all locations in the world.', icon: '🌍' },
    efficient_logistics: { name: 'Efficient Logistics', branch: 'industry',   cost: 3, requires: ['foreman'],                     desc: 'Buildings consume 10% fewer raw materials in production.',                  icon: '📊' },

    // ── Transport Branch (8) ──
    road_knowledge:      { name: 'Road Knowledge',      branch: 'transport',  cost: 2, requires: [],                              desc: 'Caravans travel 15% faster.',                                              icon: '🛤️' },
    expert_navigator:    { name: 'Expert Navigator',    branch: 'transport',  cost: 3, requires: [],                              desc: 'Ships travel 20% faster, -10% storm risk.',                                icon: '🧭' },
    caravan_master:      { name: 'Caravan Master',      branch: 'transport',  cost: 3, requires: ['road_knowledge'],              desc: 'Caravan capacity +25%.',                                                   icon: '🐪' },
    fleet_admiral:       { name: 'Fleet Admiral',       branch: 'transport',  cost: 3, requires: ['expert_navigator'],            desc: 'Ship capacity +25%.',                                                      icon: '⚓' },
    cheap_security:      { name: 'Cheap Security',      branch: 'transport',  cost: 2, requires: [],                              desc: 'Hiring security for caravans costs 20% less.',                              icon: '🛡️' },
    veteran_guards:      { name: 'Veteran Guards',      branch: 'transport',  cost: 3, requires: ['cheap_security'],              desc: 'Security is 30% more effective in combat.',                                 icon: '⚔️' },
    efficient_provisioning: { name: 'Efficient Provisioning', branch: 'transport', cost: 2, requires: [],                         desc: 'Food consumption for travel reduced 25%.',                                 icon: '🍞' },
    trade_route_mastery: { name: 'Trade Route Mastery', branch: 'transport',  cost: 2, requires: ['caravan_master','fleet_admiral'], desc: 'Automated caravans earn 10% more profit.',                              icon: '🏆' },
    extended_routes:     { name: 'Extended Routes',     branch: 'transport',  cost: 2, requires: ['road_knowledge'],              desc: 'Caravans can reach towns up to 3 hops away.',                              icon: '🗺️' },
    caravan_network:     { name: 'Caravan Network',     branch: 'transport',  cost: 3, requires: ['extended_routes'],             desc: 'Caravans reach 5 hops away and can trade at waypoint towns en route.',      icon: '🌐' },
    thrifty_caravanner:  { name: 'Thrifty Caravanner',  branch: 'transport',  cost: 2, requires: ['road_knowledge'],              desc: 'Caravan crew wages reduced by 25%.',                                       icon: '💰' },
    pack_mule:           { name: 'Pack Mule',           branch: 'transport',  cost: 1, requires: [],                              desc: '+20 carrying capacity.',                                                   icon: '🎒' },
    beast_of_burden:     { name: 'Beast of Burden',     branch: 'transport',  cost: 2, requires: ['pack_mule'],                   desc: '+20 additional carrying capacity.',                                         icon: '🐂' },
    iron_back:           { name: 'Iron Back',           branch: 'transport',  cost: 3, requires: ['beast_of_burden'],             desc: '+30 additional carrying capacity.',                                         icon: '💪' },

    // ── Exploration/Travel Branch (3) ──
    wilderness_survival: { name: 'Wilderness Survival', branch: 'transport', cost: 2, requires: [],                               desc: 'Better rest while traveling (+50%). Foraging gives 50% more food.',         icon: '🏕️' },
    horse_mastery:       { name: 'Horse Mastery',       branch: 'transport',  cost: 3, requires: [],                              desc: '+2 max horses, horses give 25% more carry bonus.',                         icon: '🐎' },
    cartographer:        { name: 'Cartographer',        branch: 'transport',  cost: 3, requires: ['road_knowledge'],              desc: '5% faster on roads, 50% faster off-road. 25% cheaper to build roads and outposts. +10% quarantine sneak chance.', icon: '🗺️' },
    animal_husbandry:    { name: 'Animal Husbandry',    branch: 'survival',   cost: 2, requires: [],                              desc: 'Learned from shepherding. Livestock buildings produce 10% more.',           icon: '🐑' },

    // ── Social Branch (9) ──
    charming:            { name: 'Charming',            branch: 'social',     cost: 2, requires: [],                              desc: 'Relationships build 25% faster. +5% quarantine bribe chance. -5% street buy prices.',              icon: '😊' },
    charismatic:         { name: 'Charismatic',         branch: 'social',     cost: 3, requires: ['charming'],                    desc: 'Relationships build 50% faster (replaces Charming). +5% quarantine bribe chance. -5% street buy prices.', icon: '✨' },
    smooth_talker:       { name: 'Smooth Talker',       branch: 'social',     cost: 2, requires: [],                              desc: 'Relationship decay reduced 50%.',                                          icon: '🎭' },
    romantic:            { name: 'Romantic',            branch: 'social',     cost: 2, requires: ['charming'],                    desc: 'Courtship relationship requirement reduced to 50 (from 60).',               icon: '💕' },
    noble_bearing:       { name: 'Noble Bearing',       branch: 'social',     cost: 3, requires: ['romantic'],                    desc: 'Easier to marry above your social rank.',                                   icon: '👑' },
    good_parent:         { name: 'Good Parent',         branch: 'social',     cost: 2, requires: [],                              desc: 'Children inherit +10% more gold and reputation.',                           icon: '👨‍👧' },
    dynasty_founder:     { name: 'Dynasty Founder',     branch: 'social',     cost: 3, requires: ['good_parent'], repeatable: true, desc: 'Each purchase adds 1 SP to your dynasty bank. Heirs withdraw on succession (1:1).', icon: '🏰' },
    political_connections: { name: 'Political Connections', branch: 'social', cost: 3, requires: [],                              desc: 'Reputation gains +25%.',                                                   icon: '🤵' },
    royal_favor:         { name: 'Royal Favor',         branch: 'social',     cost: 4, requires: ['political_connections'],        desc: 'Petition for social rank costs 25% less reputation requirement.',            icon: '👸' },
    diplomatic_immunity: { name: 'Diplomatic Immunity', branch: 'social',     cost: 4, requires: ['political_connections'],        desc: '40% chance to talk guards out of forced requisition without losing goods.',  icon: '🕊️' },
    musician:            { name: 'Musician',            branch: 'social',     cost: 2, requires: [],                              desc: 'Learn instruments 50% faster. Performance pay +50%. Gifts build +2 extra relationship. Fame spreads 25% faster.', icon: '🎵' },
    social_insight:      { name: 'Social Insight',      branch: 'social',     cost: 2, requires: ['charming'],                    desc: 'Read people better: see which social interactions will resonate and which will fall flat.', icon: '🔮' },
    legacy_of_trust:     { name: 'Legacy of Trust',     branch: 'social',     cost: 4, requires: ['charismatic', 'political_connections'], desc: 'Your heir inherits 50% of your relationships and reputation instead of 15%. A lifetime of connections passed down through family bonds.', icon: '🏛️' },
    literacy:            { name: 'Literacy',            branch: 'social',     cost: 2, requires: [],                              desc: 'Can read and write. Required for scholarly and administrative positions.',  icon: '📖' },

    // ── Guild/Political Branch (3) ──
    court_etiquette:     { name: 'Court Etiquette',     branch: 'social',     cost: 2, requires: [],                              desc: 'Petition success +10%. King audience more likely.',                         icon: '🎩' },
    economic_advisor:    { name: 'Economic Advisor',   branch: 'social',     cost: 3, requires: ['court_etiquette'],         desc: 'View prosperity breakdown panel. Petition costs -25%.', icon: '📈' },
    court_informant:     { name: 'Court Informant',     branch: 'social',     cost: 4, requires: ['court_etiquette'], desc: 'Royal court connections feed you sensitive political intel — succession crises, coups, alliances, king moods.', icon: '🕵️' },
    street_ears:         { name: 'Street Ears',         branch: 'social',     cost: 2, requires: [],              desc: 'Toggle on/off. When active, 25% chance to overhear NPC gossip — merchant asset moves, kingdom finances, local happenings. Talk to townsfolk for full gossip.', icon: '👂' },
    noble_assets:        { name: 'Noble Assets',        branch: 'social',     cost: 2, requires: ['court_etiquette'],              desc: 'Reveals which buildings nobles and elite merchants own in their NPC panel. Shows income and financial health.',  icon: '🏗️' },
    guild_negotiator:{ name: 'Guild Negotiator',    branch: 'social',     cost: 3, requires: [],                              desc: 'Reduced guild dues, faster reputation within guilds.',                      icon: '🤝' },
    tax_attorney:        { name: 'Tax Attorney',        branch: 'social',     cost: 4, requires: ['literacy'],                    desc: 'Reduce all tax burden by 10%. Find loopholes in kingdom law.',              icon: '📋' },
    shrewd_negotiator:   { name: 'Shrewd Negotiator',   branch: 'commerce',   cost: 2, requires: [],                              desc: 'Unlocks traveling merchant auto-travel jobs. Better deal-making.',          icon: '🧠' },

    // ── Survival Branch (8) ──
    street_smart:        { name: 'Street Smart',        branch: 'survival',   cost: 2, requires: [],                              desc: '10% less chance of bandit encounters.',                                     icon: '🏙️' },
    combat_trained:      { name: 'Combat Trained',      branch: 'survival',   cost: 2, requires: [],                              desc: '+15% survival in combat encounters.',                                       icon: '🗡️' },
    battle_hardened:     { name: 'Battle Hardened',     branch: 'survival',   cost: 4, requires: ['combat_trained'],              desc: '+30% survival (replaces Combat Trained).',                                  icon: '💪' },
    escape_artist:       { name: 'Escape Artist',       branch: 'survival',   cost: 3, requires: ['street_smart'],                desc: 'Variable chance (5-30%) to flee combat without losses.',                    icon: '🏃' },
    bandit_evasion:      { name: 'Bandit Evasion',      branch: 'survival',   cost: 2, requires: ['street_smart'],                desc: '25% less chance of bandit encounters (non-wartime).',                        icon: '👁️' },
    bandit_mastery:      { name: 'Bandit Mastery',       branch: 'survival',   cost: 3, requires: ['bandit_evasion'],              desc: '50% less bandit encounters (non-wartime) + 25% less during wartime.',        icon: '🥷' },
    fighting_retreat:    { name: 'Fighting Retreat',    branch: 'survival',   cost: 3, requires: ['combat_trained'],              desc: 'Fight guards and flee during forced requisition. Success scales with combat level.', icon: '🛡️' },
    fortified_caravans:  { name: 'Fortified Caravans',  branch: 'survival',   cost: 3, requires: [],                              desc: 'Caravans have +20% defense against bandits.',                               icon: '🏰' },
    endurance_1:         { name: 'Endurance I',         branch: 'survival',   cost: 2, requires: [],                              desc: 'Max energy +15 (115 total). Hardened body.',                                icon: '🫀' },
    endurance_2:         { name: 'Endurance II',        branch: 'survival',   cost: 3, requires: ['endurance_1'],                 desc: 'Max energy +35 (135 total). Iron constitution.',                            icon: '💪' },
    endurance_3:         { name: 'Endurance III',       branch: 'survival',   cost: 4, requires: ['endurance_2'],                 desc: 'Max energy +60 (160 total). Tireless.',                                     icon: '⚡' },
    intimidating_presence: { name: 'Intimidating Presence', branch: 'survival', cost: 3, requires: ['battle_hardened'],            desc: 'Bandits less likely to attack (-15%).',                                     icon: '😤' },
    combat_proficiency:  { name: 'Combat Proficiency',  branch: 'survival',   cost: 3, requires: ['combat_trained'],              desc: '+10% combat success in encounters.',                                        icon: '⚔️' },
    war_profiteer:       { name: 'War Profiteer',       branch: 'survival',   cost: 3, requires: [],                              desc: '+25% profit selling military goods during wars.',                            icon: '💣' },
    siege_supplier:      { name: 'Siege Supplier',      branch: 'survival',   cost: 5, requires: ['war_profiteer'],               desc: 'Can sell directly to besieging armies at premium prices.',                   icon: '🏴' },

    // ── Medicine Branch (4) ──
    first_aid:           { name: 'First Aid',           branch: 'survival',   cost: 2, requires: [],                              desc: 'Self-treat minor injuries without a hospital. Recovery 25% faster.',        icon: '🩹' },
    herbalist:           { name: 'Herbalist',           branch: 'survival',   cost: 3, requires: ['first_aid'],                   desc: 'Craft healing potions from herbs. Foraged herbs yield doubled.',             icon: '🌿' },
    field_medic:         { name: 'Field Medic',         branch: 'survival',   cost: 3, requires: ['first_aid'],                   desc: 'Treat others for gold as a job. Self-treat moderate injuries too.',          icon: '⛑️' },
    doctor:              { name: 'Doctor',              branch: 'survival',   cost: 4, requires: ['field_medic'],                 desc: 'Treat ALL injury severities. 2x nurse pay. Unlocks itinerant healer job.',  icon: '⚕️' },
    disease_awareness:   { name: 'Disease Awareness',   branch: 'survival',   cost: 1, requires: [],                              desc: 'See illness breakdown in towns: minor, moderate, and severe sick counts.',   icon: '🔬' },
    epidemiologist:      { name: 'Epidemiologist',      branch: 'survival',   cost: 2, requires: ['disease_awareness'],            desc: 'See contagion risk level in towns — know your chances of getting sick.',     icon: '🦠' },
    healthy_living:      { name: 'Healthy Living',      branch: 'survival',   cost: 2, requires: [],                              desc: 'Reduces old-age death chance by 10%. A disciplined lifestyle keeps you sharp.', icon: '🧘' },
    longevity:           { name: 'Longevity',           branch: 'survival',   cost: 4, requires: ['healthy_living'],              desc: 'Reduces old-age death chance by 25%. Your body endures far longer than most.', icon: '🕰️' },
    soil_knowledge:{ name: 'Soil Knowledge',      branch: 'survival',   cost: 2, requires: ['herbalist'],                   desc: 'See soil fertility ratings on the map. Toggle in the ⚡ Abilities tab of Skills. Right-click the map to check an area.', icon: '🌾' },

    // ── Underworld Branch (7) ──
    discrete:            { name: 'Discrete',            branch: 'underworld', cost: 2, requires: [],                              desc: 'Smuggling detection -10%. Unlocks: Steal goods, Pickpocket, Plant evidence (with Master Forger). Reduces scheme detection by 10%.', icon: '🤫' },
    master_smuggler:     { name: 'Master Smuggler',     branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: 'Smuggling detection -20%. +5% quarantine sneak. Unlocks smuggling routes (with Contraband Network).', icon: '🥷' },
    bribe_expert:        { name: 'Bribe Expert',        branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: 'Can bribe guards. +15% quarantine bribe chance. Unlocks Bribe Guards scheme.', icon: '💸' },
    corruption_expert:   { name: 'Corruption Expert',   branch: 'underworld', cost: 4, requires: ['bribe_expert'],                  desc: 'Halves forced requisition bribe cost. +15% quarantine bribe chance. -5% street buy prices.',         icon: '🤑' },
    black_market_contacts: { name: 'Black Market Contacts', branch: 'underworld', cost: 4, requires: ['master_smuggler'],         desc: 'Black market premium 2x. -10% street buy prices. Street requests every 1 day.',                        icon: '🕶️' },
    contraband_network:  { name: 'Contraband Network',  branch: 'underworld', cost: 5, requires: ['master_smuggler','bribe_expert'], desc: 'Embargo detection -60%. Smuggling route income +50%. Unlocks permanent smuggling routes (with Master Smuggler).', icon: '🕸️' },
    jail_break:          { name: 'Jail Break',          branch: 'underworld', cost: 2, requires: [],                              desc: 'Jail time -50%. +10% jail escape chance.',                                  icon: '🔓' },
    untouchable:         { name: 'Untouchable',         branch: 'underworld', cost: 5, requires: ['bribe_expert','jail_break'],   desc: 'If caught smuggling, 25% chance charges are dropped. +5% jail escape.',     icon: '🎩' },

    // ── Underworld Branch — Dark Deeds Expansion ──
    shadow_dealings:     { name: 'Shadow Dealings',     branch: 'underworld', cost: 2, requires: ['discrete'],                    desc: 'All corrupt detection -15%. Unlocks: Sabotage, Blackmail, Insider trading, Protection racket (with Intimidating Presence), Double agent.', icon: '🕶️' },
    master_forger:       { name: 'Master Forger',       branch: 'underworld', cost: 3, requires: ['shadow_dealings'],             desc: 'Sell counterfeit goods. Unlocks: Forge documents (permits, titles, papers), Plant evidence (with Discrete), Frame competitor, Cook books.', icon: '📝' },
    assassin:            { name: 'Assassin',             branch: 'underworld', cost: 4, requires: ['black_market_contacts'],       desc: 'Personally assassinate targets. Detection greatly reduced. Unlocks assassination contracts.', icon: '🗡️' },
    poisoner:            { name: 'Poisoner',            branch: 'underworld', cost: 3, requires: ['black_market_contacts'],       desc: 'Use poison for slow-kill assassination (5-15 days). Access to poison goods.',                 icon: '☠️' },
    silver_tongue_dark:  { name: 'Silver Tongue',       branch: 'underworld', cost: 2, requires: ['bribe_expert'],                desc: '+10% quarantine bribe. +25% bribery success. Unlocks: Spread rumors, Blackmail, Bribe advisor, Cultivate heir.', icon: '😈' },
    tunnel_rat:          { name: 'Tunnel Rat',          branch: 'underworld', cost: 4, requires: ['master_smuggler'],             desc: '-30% detection in towns with your hidden warehouses. Synergizes with Ghost skill.', icon: '🕳️' },
    arsonist_skill:      { name: 'Arsonist',            branch: 'underworld', cost: 3, requires: ['shadow_dealings'],             desc: 'Arson detection -50%. Unlocks: Arson, Sabotage buildings and roads.',       icon: '🔥' },
    kingmaker_skill:     { name: 'Kingmaker',           branch: 'underworld', cost: 5, requires: ['silver_tongue_dark','black_market_contacts'], desc: 'Assassinate kings. Unlocks: Incite revolt, Cultivate heir. Political corruption more effective.', icon: '👑' },
    dark_connections:    { name: 'Dark Connections',    branch: 'underworld', cost: 4, requires: ['black_market_contacts'],        desc: 'Assassination contracts. Unlocks: Spy network (with Discrete), Sabotage rival caravans, Hire assassin.', icon: '🌑' },
    master_disguise:     { name: 'Master Disguise',     branch: 'underworld', cost: 3, requires: ['shadow_dealings'],              desc: '-10% scheme detection. +5% quarantine sneak. Harder to identify.', icon: '🎭' },
    shadow_step:         { name: 'Shadow Step',         branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: '-10% scheme detection. +5% quarantine sneak. Move unseen through crowds.', icon: '👤' },
    smugglers_run:       { name: 'Smuggler\'s Run',     branch: 'underworld', cost: 3, requires: ['master_smuggler'],             desc: 'Cross closed borders on land. 40% detection chance.',            icon: '🏃' },
    blockade_runner:     { name: 'Blockade Runner',     branch: 'underworld', cost: 4, requires: ['smugglers_run','discrete'], desc: 'Sail through naval blockades. 35% detection chance. Ship seized if caught.', icon: '🚢' },
    ghost:               { name: 'Ghost',               branch: 'underworld', cost: 5, requires: ['shadow_dealings','tunnel_rat'],               desc: 'Detection halved at night. +10% quarantine sneak. Near invisible to guards.', icon: '👻' },

    // Defensive / Security skills
    vigilant_merchant:   { name: 'Vigilant Merchant',   branch: 'commerce',  cost: 2, requires: [],                  desc: '-25% chance of NPC theft/sabotage against you. Reduces stolen amounts by 50%.', icon: '👁️' },
    fortified_reputation:{ name: 'Fortified Reputation', branch: 'social',   cost: 3, requires: ['charming'],         desc: 'Rumors against you -40% effective. NPC schemes targeting you -20%.', icon: '🛡️' },
    counter_intelligence:{ name: 'Counter-Intelligence', branch: 'underworld', cost: 3, requires: ['discrete'],       desc: 'Detect NPC frame attempts. Assassination attempts against you -50%.', icon: '🕵️' },
    inner_circle:        { name: 'Inner Circle',        branch: 'social',    cost: 4, requires: ['charismatic'],      desc: 'Loyal network warns of plots. All NPC schemes against you -30%.', icon: '🤝' },
};

const SKILL_BRANCHES = {
    commerce:   { name: 'Commerce',   icon: '🏪', color: '#d4af37' },
    industry:   { name: 'Industry',   icon: '🏗️', color: '#8b7355' },
    transport:  { name: 'Transport',  icon: '🚚', color: '#6b8e23' },
    social:     { name: 'Social',     icon: '👥', color: '#cd5c5c' },
    survival:   { name: 'Survival',   icon: '🗡️', color: '#4682b4' },
    underworld: { name: 'Underworld', icon: '🎭', color: '#696969' },
};

// ============================================================
// Achievements — Tiered Achievements (Bronze/Silver/Gold/Platinum)
// ============================================================

const ACHIEVEMENTS = {
    // ── Trading (20) ──
    first_purchase:      { name: 'First Purchase',      desc: 'Buy your first goods from a market.',            xp: 10 , tier: 'bronze', icon: '🛒', category: 'trading' },
    first_sale:          { name: 'First Sale',          desc: 'Sell goods at a market for the first time.',     xp: 10 , tier: 'bronze', icon: '💰', category: 'trading' },
    profit_maker:        { name: 'Profit Maker',        desc: 'Make your first profitable trade.',              xp: 30 , tier: 'bronze', icon: '💹', category: 'trading' },
    trades_100:          { name: '100 Trades',          desc: 'Complete 100 trades.',                           xp: 75 , tier: 'silver', icon: '📊', category: 'trading' },
    trades_500:          { name: '500 Trades',          desc: 'Complete 500 trades.',                           xp: 85 , tier: 'silver', icon: '📈', category: 'trading' },
    trades_1000:         { name: '1000 Trades',         desc: 'Complete 1000 trades.',                          xp: 150, tier: 'gold', icon: '🏆', category: 'trading' },
    bread_winner:        { name: 'Bread Winner',        desc: 'Sell 100 bread.',                                xp: 35 , tier: 'bronze', icon: '🍞', category: 'trading' },
    arms_dealer:         { name: 'Arms Dealer',         desc: 'Sell 50 swords.',                                xp: 85 , tier: 'silver', icon: '⚔️', category: 'trading' },
    armor_merchant:      { name: 'Armor Merchant',      desc: 'Sell 50 armor.',                                 xp: 85 , tier: 'silver', icon: '🛡️', category: 'trading' },
    horse_trader:        { name: 'Horse Trader',        desc: 'Sell 20 horses.',                                xp: 80 , tier: 'silver', icon: '🐴', category: 'trading' },
    wine_connoisseur:    { name: 'Wine Connoisseur',    desc: 'Sell 100 wine.',                                 xp: 80 , tier: 'silver', icon: '🍷', category: 'trading' },
    fisher_king:         { name: 'Fisher King',         desc: 'Sell 100 fish.',                                 xp: 80 , tier: 'silver', icon: '🐟', category: 'trading' },
    pearl_diver:         { name: 'Pearl Diver',         desc: 'Sell 10 pearls.',                                xp: 85 , tier: 'silver', icon: '🦪', category: 'trading' },
    gold_rush:           { name: 'Gold Rush',           desc: 'Sell 10 gold.',                                  xp: 90 , tier: 'silver', icon: '🥇', category: 'trading' },
    market_crash:        { name: 'Market Crash',        desc: 'Crash a market: sell until price drops below 50% of base.', xp: 90 , tier: 'silver', icon: '📉', category: 'trading' },
    price_gouger:        { name: 'Price Gouger',        desc: 'Sell a good at 300%+ of base price.',            xp: 85 , tier: 'silver', icon: '🤑', category: 'trading' },
    diversified_portfolio: { name: 'Diversified Portfolio', desc: 'Trade all resource types at least once.',    xp: 165, tier: 'gold', icon: '🌈', category: 'trading' },
    war_profiteer_ach:   { name: 'War Profiteer',       desc: 'Sell military goods during a war.',              xp: 90 , tier: 'silver', icon: '⚔️', category: 'trading' },
    famine_merchant:     { name: 'Famine Merchant',     desc: 'Sell food to a starving town.',                  xp: 45 , tier: 'bronze', icon: '🥖', category: 'trading' },
    cross_kingdom_trader: { name: 'Cross-Kingdom Trader', desc: 'Trade in all 4 kingdoms.',                     xp: 160, tier: 'gold', icon: '🌐', category: 'trading' },

    // ── Building (15) ──
    first_foundation:    { name: 'First Foundation',    desc: 'Build your first building.',                     xp: 40 , tier: 'bronze', icon: '🏠', category: 'building' },
    property_owner:      { name: 'Property Owner',      desc: 'Own 5 buildings.',                               xp: 75 , tier: 'silver', icon: '🏘️', category: 'building' },
    real_estate_baron:   { name: 'Real Estate Baron',   desc: 'Own 20 buildings.',                              xp: 175, tier: 'gold', icon: '🏗️', category: 'building' },
    industrial_empire:   { name: 'Industrial Empire',   desc: 'Own 50 buildings.',                              xp: 185, tier: 'gold', icon: '🏭', category: 'building' },
    vertical_integration: { name: 'Vertical Integration', desc: 'Complete your first supply chain.',            xp: 95 , tier: 'silver', icon: '🔗', category: 'building' },
    chain_master:        { name: 'Chain Master',        desc: 'Complete 3 supply chains.',                      xp: 175, tier: 'gold', icon: '⛓️', category: 'building' },
    bread_factory:       { name: 'Bread Factory',       desc: 'Own wheat farm + flour mill + bakery in same town.', xp: 85 , tier: 'silver', icon: '🍞', category: 'building' },
    weapons_factory:     { name: 'Weapons Factory',     desc: 'Own iron mine + smelter + blacksmith in same town.', xp: 90 , tier: 'silver', icon: '⚒️', category: 'building' },
    textile_empire:      { name: 'Textile Empire',      desc: 'Own sheep farm + weaver + tailor in same town.', xp: 90 , tier: 'silver', icon: '🧵', category: 'building' },
    upgrade_master:      { name: 'Upgrade Master',      desc: 'Upgrade a building to level 3.',                 xp: 80 , tier: 'silver', icon: '⬆️', category: 'building' },
    builder_across_borders: { name: 'Builder Across Borders', desc: 'Own buildings in 3+ different kingdoms.',  xp: 180, tier: 'gold', icon: '🌍', category: 'building' },
    multi_town_mogul:    { name: 'Multi-Town Mogul',    desc: 'Own buildings in 5+ different towns.',           xp: 95 , tier: 'silver', icon: '🗺️', category: 'building' },
    port_developer:      { name: 'Port Developer',      desc: 'Build a dock in a port town.',                  xp: 90 , tier: 'silver', icon: '⚓', category: 'building' },
    island_investor:     { name: 'Island Investor',     desc: 'Own a building on an island town.',              xp: 95 , tier: 'silver', icon: '🏝️', category: 'building' },
    full_employment:     { name: 'Full Employment',     desc: 'Have 20+ workers employed.',                     xp: 80 , tier: 'silver', icon: '👷', category: 'building' },
    frontier_founder:    { name: 'Frontier Founder',    desc: 'Found your first outpost in the wilderness.',     xp: 80 , tier: 'silver', icon: '⛺', category: 'building' },
    village_maker:       { name: 'Village Maker',       desc: 'Get an outpost converted to an official village.', xp: 175, tier: 'gold', icon: '🏘️', category: 'building' },

    // ── Transport (10) ──
    first_caravan:       { name: 'First Caravan',       desc: 'Send your first caravan.',                       xp: 35 , tier: 'bronze', icon: '🐴', category: 'transport' },
    caravan_king:        { name: 'Caravan King',        desc: 'Complete 50 caravan routes.',                    xp: 85 , tier: 'silver', icon: '🐪', category: 'transport' },
    shipping_magnate:    { name: 'Shipping Magnate',    desc: 'Complete 100 caravan routes.',                   xp: 175, tier: 'gold', icon: '🚢', category: 'transport' },
    ship_owner:          { name: 'Ship Owner',          desc: 'Buy your first ship.',                           xp: 45 , tier: 'bronze', icon: '⛵', category: 'transport' },
    fleet_commander:     { name: 'Fleet Commander',     desc: 'Own 3+ ships.',                                  xp: 185, tier: 'gold', icon: '🚢', category: 'transport' },
    island_trader:       { name: 'Island Trader',       desc: 'Trade with an island town.',                     xp: 85 , tier: 'silver', icon: '🏝️', category: 'transport' },
    across_the_sea:      { name: 'Across the Sea',      desc: 'Complete 10 sea voyages.',                       xp: 80 , tier: 'silver', icon: '🌊', category: 'transport' },
    storm_survivor:      { name: 'Storm Survivor',      desc: 'Survive a storm at sea.',                        xp: 40 , tier: 'bronze', icon: '⛈️', category: 'transport' },
    pirate_fighter:      { name: 'Pirate Fighter',      desc: 'Survive a pirate attack.',                       xp: 45 , tier: 'bronze', icon: '🏴‍☠️', category: 'transport' },
    trade_route_pioneer: { name: 'Trade Route Pioneer', desc: 'Establish trade routes to 8+ different towns.',  xp: 180, tier: 'gold', icon: '🗺️', category: 'transport' },

    // ── Social (15) ──
    first_employee:      { name: 'First Employee',      desc: 'Hire your first worker.',                        xp: 35 , tier: 'bronze', icon: '🤝', category: 'social' },
    employer_of_10:      { name: 'Employer of 10',      desc: 'Have 10 employees.',                             xp: 80 , tier: 'silver', icon: '👥', category: 'social' },
    employer_of_50:      { name: 'Employer of 50',      desc: 'Have 50 employees.',                             xp: 170, tier: 'gold', icon: '🏢', category: 'social' },
    making_friends:      { name: 'Making Friends',      desc: 'Reach "Friend" level with an NPC.',              xp: 30 , tier: 'bronze', icon: '😊', category: 'social' },
    best_friends:        { name: 'Best Friends',        desc: 'Reach 80+ relationship with an NPC.',            xp: 75 , tier: 'silver', icon: '💕', category: 'social' },
    gift_giver:          { name: 'Gift Giver',          desc: 'Give 10 gifts to NPCs.',                         xp: 25 , tier: 'bronze', icon: '🎁', category: 'social' },
    generous_merchant:   { name: 'Generous Merchant',   desc: 'Give 50 gifts to NPCs.',                         xp: 80 , tier: 'silver', icon: '🎀', category: 'social' },
    wedding_bells:       { name: 'Wedding Bells',       desc: 'Get married.',                                   xp: 75 , tier: 'silver', icon: '💒', category: 'social' },
    family_person:       { name: 'Family Man/Woman',    desc: 'Have your first child.',                         xp: 80 , tier: 'silver', icon: '👶', category: 'social' },
    big_family:          { name: 'Big Family',          desc: 'Have 3+ children.',                              xp: 85 , tier: 'silver', icon: '👨‍👩‍👧‍👦', category: 'social' },
    social_climber:      { name: 'Social Climber',      desc: 'Escape indentured servitude.',                            xp: 90 , tier: 'silver', icon: '🧑‍💼', category: 'social' },
    guild_elite:         { name: 'Guild Elite',         desc: 'Reach Guildmaster rank.',                        xp: 90 , tier: 'silver', icon: '🏅', category: 'social' },
    noble_blood:         { name: 'Noble Blood',         desc: 'Reach Minor Noble rank.',                        xp: 175, tier: 'gold', icon: '👑', category: 'social' },
    lord_of_the_land:    { name: 'Lord of the Land',    desc: 'Reach Lord rank.',                                xp: 185, tier: 'gold', icon: '🏰', category: 'social' },
    royal_advisor_ach:   { name: 'Royal Advisor',       desc: 'Reach Royal Advisor rank.',                      xp: 190, tier: 'gold', icon: '🤴', category: 'social' },

    // ── Wealth (15) ──
    first_hundred:       { name: 'First Hundred',       desc: 'Accumulate 100 gold.',                           xp: 25 , tier: 'bronze', icon: '🪙', category: 'wealth' },
    thousand_gold:       { name: 'Thousand Gold',       desc: 'Accumulate 1,000 gold.',                         xp: 35 , tier: 'bronze', icon: '💰', category: 'wealth' },
    five_thousand:       { name: 'Five Thousand',       desc: 'Accumulate 5,000 gold.',                         xp: 75 , tier: 'silver', icon: '💰', category: 'wealth' },
    ten_thousand:        { name: 'Ten Thousand',        desc: 'Accumulate 10,000 gold.',                        xp: 80 , tier: 'silver', icon: '💎', category: 'wealth' },
    fifty_thousand:      { name: 'Fifty Thousand',      desc: 'Accumulate 50,000 gold.',                        xp: 150, tier: 'gold', icon: '💎', category: 'wealth' },
    hundred_thousand:    { name: 'Hundred Thousand',    desc: 'Accumulate 100,000 gold.',                       xp: 160, tier: 'gold', icon: '🏦', category: 'wealth' },
    quarter_million:     { name: 'Quarter Million',     desc: 'Accumulate 250,000 gold.',                       xp: 175, tier: 'gold', icon: '🏦', category: 'wealth' },
    half_million:        { name: 'Half Million',        desc: 'Accumulate 500,000 gold.',                       xp: 185, tier: 'gold', icon: '🏛️', category: 'wealth' },
    millionaire:         { name: 'Millionaire',         desc: 'Accumulate 1,000,000 gold.',                     xp: 200, tier: 'gold', icon: '👸', category: 'wealth' },
    day_trader:          { name: 'Day Trader',          desc: 'Earn 100 gold profit in a single day.',          xp: 80 , tier: 'silver', icon: '📅', category: 'wealth' },
    big_earner:          { name: 'Big Earner',          desc: 'Earn 1,000 gold profit in a single day.',        xp: 85 , tier: 'silver', icon: '🤑', category: 'wealth' },
    tycoon:              { name: 'Tycoon',              desc: 'Earn 10,000 gold profit in a single day.',       xp: 200, tier: 'gold', icon: '🎩', category: 'wealth' },
    self_made:           { name: 'Self Made',           desc: 'Reach 10,000 gold without inheriting.',          xp: 95 , tier: 'silver', icon: '💪', category: 'wealth' },
    penny_pincher:       { name: 'Penny Pincher',       desc: 'Have more gold than all AI merchants combined.', xp: 160, tier: 'gold', icon: '🐷', category: 'wealth' },
    economic_dominance:  { name: 'Economic Dominance',  desc: 'Own 50%+ of buildings in any single town.',      xp: 200, tier: 'gold', icon: '🏰', category: 'wealth' },

    // ── Kingdom & Politics (10) ──
    citizen:             { name: 'Citizen',             desc: 'Become a citizen of a different kingdom.',       xp: 40 , tier: 'bronze', icon: '🏠', category: 'kingdom' },
    dual_citizen:        { name: 'Dual Citizen',        desc: 'Change citizenship to another kingdom.',          xp: 80 , tier: 'silver', icon: '🌍', category: 'kingdom' },
    diplomat:            { name: 'Diplomat',            desc: 'Have 70+ reputation in 2 kingdoms.',              xp: 90 , tier: 'silver', icon: '🤝', category: 'kingdom' },
    beloved:             { name: 'Beloved',             desc: 'Have 90+ reputation in any kingdom.',             xp: 170, tier: 'gold', icon: '❤️', category: 'kingdom' },
    universal_respect:   { name: 'Universal Respect',   desc: 'Have 70+ reputation in all kingdoms.',            xp: 185, tier: 'gold', icon: '🌟', category: 'kingdom' },
    exiled:              { name: 'Exiled',              desc: 'Get exiled from a kingdom.',                      xp: 30 , tier: 'bronze', icon: '🚪', category: 'kingdom' },
    comeback_kid:        { name: 'Comeback Kid',        desc: 'Regain citizenship after being exiled.',          xp: 100, tier: 'silver', icon: '🔄', category: 'kingdom' },
    kings_friend:        { name: "King's Friend",       desc: 'Reach Royal Advisor rank.',                       xp: 175, tier: 'gold', icon: '🤴', category: 'kingdom' },
    wartime_supplier:    { name: 'Wartime Supplier',    desc: 'Supply goods to a kingdom at war for 30+ days.',  xp: 180, tier: 'gold', icon: '🛡️', category: 'kingdom' },
    peacemaker:          { name: 'Peacemaker',          desc: 'Trade with all sides during a war.',              xp: 95 , tier: 'silver', icon: '🕊️', category: 'kingdom' },

    // ── Underworld (10) ──
    first_smuggle:       { name: 'First Smuggle',       desc: 'Successfully smuggle banned goods.',              xp: 35 , tier: 'bronze', icon: '🤫', category: 'underworld' },
    experienced_smuggler: { name: 'Experienced Smuggler', desc: 'Successfully smuggle 20 times.',               xp: 85 , tier: 'silver', icon: '🥷', category: 'underworld' },
    master_smuggler_ach: { name: 'Master Smuggler',     desc: 'Successfully smuggle 50 times.',                 xp: 175, tier: 'gold', icon: '🎭', category: 'underworld' },
    caught_ach:          { name: 'Caught!',             desc: 'Get caught smuggling for the first time.',        xp: 25 , tier: 'bronze', icon: '🚨', category: 'underworld' },
    jailbird:            { name: 'Jailbird',            desc: 'Spend time in jail.',                             xp: 25 , tier: 'bronze', icon: '⛓️', category: 'underworld' },
    untouchable_ach:     { name: 'Untouchable',         desc: 'Smuggle 10 times in a row without getting caught.', xp: 90 , tier: 'silver', icon: '🎩', category: 'underworld' },
    bribe_master:        { name: 'Bribe Master',        desc: 'Successfully bribe 10 guards.',                   xp: 80 , tier: 'silver', icon: '💸', category: 'underworld' },
    black_market_king:   { name: 'Black Market King',   desc: 'Earn 10,000+ gold from smuggling.',               xp: 185, tier: 'gold', icon: '🕶️', category: 'underworld' },
    double_agent:        { name: 'Double Agent',        desc: 'Smuggle goods banned in your HOME kingdom.',      xp: 95 , tier: 'silver', icon: '🎭', category: 'underworld' },
    crime_pays:          { name: 'Crime Pays',          desc: 'Have smuggling skill of 20.',                     xp: 165, tier: 'gold', icon: '🤑', category: 'underworld' },

    // ── Legacy & Survival (5) ──
    survivor:            { name: 'Survivor',            desc: 'Survive a combat encounter.',                     xp: 30 , tier: 'bronze', icon: '🛡️', category: 'legacy' },
    prime_of_life:       { name: 'Prime of Life',       desc: 'Reach age 30.',                                   xp: 30 , tier: 'bronze', icon: '🎂', category: 'legacy' },
    seasoned_merchant:   { name: 'Seasoned Merchant',   desc: 'Reach age 40.',                                   xp: 80 , tier: 'silver', icon: '👴', category: 'legacy' },
    ripe_old_age:        { name: 'Ripe Old Age',        desc: 'Reach age 60.',                                   xp: 165, tier: 'gold', icon: '🧓', category: 'legacy' },
    second_generation:   { name: 'Second Generation',   desc: 'Play as your heir.',                              xp: 100, tier: 'silver', icon: '👶', category: 'legacy' },
    dynasty:             { name: 'Dynasty',             desc: 'Play as a third-generation heir.',                xp: 185, tier: 'gold', icon: '🏰', category: 'legacy' },

    // ── Kingdom Tax & Security ──
    license_holder:      { name: 'License Holder',      desc: 'Obtain your first royal trade license.',          xp: 80 , tier: 'silver', icon: '📜', category: 'kingdom' },
    licensed_dealer:     { name: 'Licensed Dealer',     desc: 'Hold licenses in 3 different kingdoms.',          xp: 160, tier: 'gold', icon: '📋', category: 'kingdom' },
    security_conscious:  { name: 'Security Conscious',  desc: 'Hire guards for 5 buildings.',                    xp: 80 , tier: 'silver', icon: '🛡️', category: 'building' },
    fort_knox:           { name: 'Fort Knox',            desc: 'Have locked storage on 10 buildings.',            xp: 175, tier: 'gold', icon: '🔒', category: 'building' },
    protection_paid:     { name: 'Protection Paid',      desc: 'Pay protection money for a full year.',           xp: 75 , tier: 'silver', icon: '💀', category: 'underworld' },
    racket_breaker:      { name: 'Racket Breaker',       desc: 'Intimidate the protection racket away.',          xp: 170, tier: 'gold', icon: '💪', category: 'underworld' },
    repeat_offender:     { name: 'Repeat Offender',      desc: 'Accumulate 5+ offenses in a single kingdom.',     xp: 75 , tier: 'silver', icon: '⛓️', category: 'underworld' },
    tax_evader:          { name: 'Tax Evader',           desc: 'Trade restricted goods without a license 10 times.', xp: 80 , tier: 'silver', icon: '🏴‍☠️', category: 'underworld' },

    // ── New Achievements ──
    citizen_of_world:    { name: 'Citizen of the World',  desc: 'Become a citizen of every kingdom.',           xp: 170, tier: 'gold', icon: '🌍', category: 'kingdom' },
    against_all_odds:    { name: 'Against All Odds',      desc: 'Side with the military underdog in a war and they win.', xp: 200, tier: 'gold', icon: '💪', category: 'kingdom' },
    war_hero:            { name: 'War Hero',              desc: 'Side with a kingdom in war and they win.',     xp: 190, tier: 'gold', icon: '🎖️', category: 'kingdom' },
    plague_doctor_ach:   { name: 'Plague Doctor',         desc: 'Sell 100+ medicine to a town during an outbreak.', xp: 175, tier: 'gold', icon: '🏥', category: 'trading' },
    war_profiteer_supreme: { name: 'War Profiteer Supreme', desc: 'Sell war goods to both sides of a conflict.', xp: 85 , tier: 'silver', icon: '💰', category: 'underworld' },
    philanthropist:      { name: 'Philanthropist',        desc: 'Sell goods below market price 50 times.',     xp: 165, tier: 'gold', icon: '❤️', category: 'social' },
    rags_to_riches:      { name: 'Rags to Riches',        desc: 'Start on an island and reach 50,000 gold.',   xp: 190, tier: 'gold', icon: '🏝️', category: 'wealth' },
    tax_dodger:          { name: 'Tax Dodger',            desc: 'Avoid 1,000+ gold in taxes through smuggling.', xp: 160, tier: 'gold', icon: '🏴', category: 'underworld' },
    kingslayer_ach:      { name: 'Kingslayer',            desc: 'Your actions contribute to a king being overthrown.', xp: 200, tier: 'gold', icon: '⚰️', category: 'kingdom' },
    double_noble_agent:  { name: 'Shadow Diplomat',       desc: 'Complete a double noble agent mission, defecting to another kingdom.', xp: 200, tier: 'gold', icon: '🎭', category: 'underworld' },
    top_merchant_victory: { name: 'Top Merchant',         desc: 'Reach #1 on the merchant leaderboard.',       xp: 200, tier: 'gold', icon: '👑', category: 'wealth' },
    top_10_merchant:     { name: 'Rising Star',           desc: 'Break into the top 10 merchant rankings.',    xp: 75,  tier: 'silver', icon: '⭐', category: 'wealth' },
    devoted_spouse:      { name: 'Devoted Spouse',        desc: 'Maintain 90+ spouse relationship for 1 year.',xp: 85 , tier: 'silver', icon: '💑', category: 'social' },
    orphan_rise:         { name: 'Orphan Rise',           desc: 'Win Top Merchant after being abandoned as orphan.', xp: 190, tier: 'gold', icon: '🌟', category: 'legacy' },
    // Victory achievements (unlocked when corresponding win condition is met)
    victory_kingmaker:   { name: 'Kingmaker Victory',     desc: 'Won by helping a kingdom conquer half the world.', xp: 200, tier: 'gold', icon: '🏆', category: 'kingdom' },
    victory_monopolist:  { name: 'Monopolist Victory',    desc: 'Won by monopolizing 3+ resources.',           xp: 200, tier: 'gold', icon: '🏆', category: 'wealth' },
    victory_emperor:     { name: "Emperor's Merchant Victory", desc: 'Won by earning 90+ reputation in 3+ kingdoms.', xp: 200, tier: 'gold', icon: '🏆', category: 'kingdom' },

    // ── Dark Deeds / Corruption Expansion ──
    first_crime:         { name: 'First Crime',          desc: 'Commit your first corrupt action.',                          xp: 30 , tier: 'bronze', icon: '🗡️', category: 'underworld' },
    untouchable_crimes:  { name: 'Untouchable',          desc: 'Commit 20 crimes without getting caught.',                   xp: 90 , tier: 'silver', icon: '🎩', category: 'underworld' },
    shadow_emperor:      { name: 'Shadow Emperor',       desc: "Control a kingdom's politics through bribes.",               xp: 200, tier: 'gold', icon: '🕴️', category: 'underworld' },
    arsonist_ach:        { name: 'Pyromaniac',           desc: 'Burn down 5 buildings.',                                     xp: 160, tier: 'gold', icon: '🔥', category: 'underworld' },
    crime_lord:          { name: 'Crime Lord',           desc: 'Commit 50 corrupt actions.',                                 xp: 190, tier: 'gold', icon: '🦹', category: 'underworld' },
    master_puppeteer:    { name: 'Master Puppeteer',     desc: "Have the king's heir deeply indebted to you.",               xp: 195, tier: 'gold', icon: '🎭', category: 'underworld' },
    market_manipulator:  { name: 'Market Manipulator',   desc: 'Own 75%+ of a resource in any town.',                        xp: 180, tier: 'gold', icon: '📈', category: 'underworld' },
    clean_hands:         { name: 'Clean Hands',          desc: 'Reach Royal Advisor rank without any crimes.',               xp: 170, tier: 'gold', icon: '🕊️', category: 'social' },
    robin_hood:          { name: 'Robin Hood',           desc: 'Steal from wealthy merchants and sell cheap to poor towns.',  xp: 175, tier: 'gold', icon: '🏹', category: 'underworld' },
    poisoner_ach:        { name: 'Poisoner',             desc: 'Successfully poison 3 targets.',                             xp: 165, tier: 'gold', icon: '☠️', category: 'underworld' },

    // ── Crown & Military ──
    crowned_king:        { name: 'Crowned Ruler',        desc: '👑 You have ascended to the throne!',                          xp: 500, tier: 'platinum', icon: '👑', category: 'kingdom' },
    naval_commander:     { name: 'Naval Commander',      desc: 'Own a kingdom with 3+ warships.',                              xp: 180, tier: 'gold', icon: '⚓', category: 'kingdom' },
    wall_builder:        { name: 'Wall Builder',         desc: 'Build fortified walls (level 3) in a town.',                   xp: 165, tier: 'gold', icon: '🧱', category: 'building' },
    wartime_profiteer:   { name: 'Wartime Profiteer',    desc: 'Earn 5,000+ gold selling weapons/food during war.',            xp: 175, tier: 'gold', icon: '💰', category: 'trading' },

    // ── New Bronze Achievements ──
    burger_rank:         { name: 'Burger',              desc: 'Reach Burgher rank.',                                            xp: 35,  tier: 'bronze', icon: '⚖️', category: 'social' },
    bandit_survivor:     { name: 'Bandit Survivor',     desc: 'Survive a bandit attack.',                                       xp: 40,  tier: 'bronze', icon: '🗡️', category: 'legacy' },
    exhaustion_collapse: { name: 'Worked to Exhaustion', desc: 'Collapse from exhaustion.',                                     xp: 25,  tier: 'bronze', icon: '😴', category: 'legacy' },
    first_rest:          { name: 'First Rest',          desc: 'Rest at an inn for the first time.',                             xp: 25,  tier: 'bronze', icon: '🛏️', category: 'social' },
    first_horse:         { name: 'First Horse',         desc: 'Buy your first horse.',                                          xp: 30,  tier: 'bronze', icon: '🐴', category: 'transport' },
    first_wound:         { name: 'First Wound',         desc: 'Survive your first injury.',                                     xp: 25,  tier: 'bronze', icon: '🩹', category: 'legacy' },
    family_provider:     { name: 'Family Provider',     desc: 'Give gold to a family member.',                                  xp: 30,  tier: 'bronze', icon: '👨‍👩‍👧', category: 'social' },
    first_feast:         { name: 'First Feast',         desc: 'Attend your first Royal Feast.',                                 xp: 40,  tier: 'bronze', icon: '🍷', category: 'social' },

    // ── New Silver Achievements ──
    supply_chain_3:      { name: 'Supply Network',      desc: 'Own buildings in 3 different supply chains.',                    xp: 90,  tier: 'silver', icon: '🔗', category: 'building' },
    noble_friend:        { name: 'Noble Friend',        desc: 'Reach 70+ relationship with a noble.',                          xp: 80,  tier: 'silver', icon: '🤝', category: 'social' },
    wartime_merchant:    { name: 'Wartime Merchant',    desc: 'Trade in 3+ towns during wartime.',                             xp: 85,  tier: 'silver', icon: '⚔️', category: 'trading' },
    healer:              { name: 'Healer',              desc: 'Self-treat 10 injuries or illnesses.',                          xp: 80,  tier: 'silver', icon: '💊', category: 'legacy' },
    travel_companion:    { name: 'Travel Companion',    desc: 'Travel with family members 5 times.',                           xp: 75,  tier: 'silver', icon: '👨‍👩‍👧', category: 'social' },
    feast_socialite:     { name: 'Feast Socialite',     desc: 'Use all 9 actions in a single feast.',                          xp: 85,  tier: 'silver', icon: '🥂', category: 'social' },
    feast_schemer:       { name: 'Feast Schemer',       desc: 'Successfully spread rumors at a feast without getting caught.',  xp: 95,  tier: 'silver', icon: '🗡️', category: 'underworld' },
    witness_revolt:      { name: 'Witness to History',  desc: 'Be in a town when a revolt breaks out.',                        xp: 85,  tier: 'silver', icon: '🔥', category: 'kingdom' },
    revolt_survivor:     { name: 'Revolt Survivor',     desc: 'Survive a revolt without losing any buildings.',                xp: 90,  tier: 'silver', icon: '🛡️', category: 'kingdom' },

    // ── New Gold Achievements ──
    noble_lender:        { name: 'Noble Lender',        desc: 'Have 3+ active loans to nobles.',                               xp: 175, tier: 'gold', icon: '💰', category: 'kingdom' },
    noble_council_voter: { name: 'Council Voter',       desc: 'Cast your vote in a Noble Council.',                            xp: 160, tier: 'gold', icon: '⚖️', category: 'kingdom' },
    kingdom_builder:     { name: 'Kingdom Builder',     desc: 'Own 10+ buildings in a single kingdom.',                        xp: 180, tier: 'gold', icon: '🏗️', category: 'building' },
    medical_mogul:       { name: 'Medical Mogul',       desc: 'Own hospitals or clinics in 3+ towns.',                         xp: 170, tier: 'gold', icon: '🏥', category: 'building' },
    food_empire:         { name: 'Food Empire',         desc: 'Own food-producing buildings in 5+ towns.',                     xp: 175, tier: 'gold', icon: '🌾', category: 'building' },
    infrastructure_lobbyist: { name: 'Infrastructure Lobbyist', desc: 'Successfully petition a kingdom 3 times to build sea routes or roads.', xp: 180, tier: 'gold', icon: '🛤️', category: 'kingdom' },
    road_builder:        { name: 'Road Builder',        desc: 'Build a sea route or road yourself.',                           xp: 165, tier: 'gold', icon: '🛤️', category: 'transport' },
    feast_mediator:      { name: 'Feast Mediator',      desc: 'Successfully mediate 5 noble arguments at feasts.',             xp: 170, tier: 'gold', icon: '🕊️', category: 'social' },
    feast_puppetmaster:  { name: 'Feast Puppetmaster',  desc: 'Start 3 feuds between nobles at feasts.',                       xp: 185, tier: 'gold', icon: '🎭', category: 'underworld' },
    feast_confidant:     { name: 'Feast Confidant',     desc: 'Have 3 private audiences with the king at feasts.',             xp: 175, tier: 'gold', icon: '👑', category: 'kingdom' },
    king_savior:         { name: "King's Savior",       desc: 'Report a conspiracy to the king, preventing an assassination.', xp: 185, tier: 'gold', icon: '🛡️', category: 'kingdom' },
    revolution_backer:   { name: 'Revolution Backer',   desc: 'Secretly fund a revolt that succeeds in changing leadership.',  xp: 195, tier: 'gold', icon: '🔥', category: 'kingdom' },
    stabilizer:          { name: 'The Stabilizer',      desc: "Raise a town's happiness from below 25 to above 75.",          xp: 180, tier: 'gold', icon: '😊', category: 'kingdom' },

    // ── Platinum Achievements ──
    plat_arms_embargo:        { name: 'Arms Embargo',               desc: 'Withhold weapons from a kingdom, causing them to lose a war.',            xp: 350, tier: 'platinum', icon: '⚔️', category: 'kingdom' },
    plat_war_profiteer:       { name: 'War Profiteer Extraordinaire', desc: 'Earn 20,000+ gold selling military goods to both sides of a war.',     xp: 350, tier: 'platinum', icon: '💰', category: 'trading' },
    plat_kingmaker_arsenal:   { name: 'Kingmaker Arsenal',          desc: 'Supply 40%+ of a winning kingdom\'s military goods.',                    xp: 375, tier: 'platinum', icon: '🛡️', category: 'kingdom' },
    plat_plague_savior:       { name: 'Plague Savior',              desc: 'Your clinics treated 50%+ of plague patients during a 30+ day outbreak.', xp: 350, tier: 'platinum', icon: '🏥', category: 'kingdom' },
    plat_fed_the_people:      { name: 'Fed the People',             desc: 'Your food buildings prevented famine in a town.',                        xp: 325, tier: 'platinum', icon: '🌾', category: 'kingdom' },
    plat_royal_commission:    { name: 'Royal Commission Hero',      desc: 'Deliver 500+ goods on a wartime commission; kingdom wins.',               xp: 300, tier: 'platinum', icon: '📜', category: 'kingdom' },
    plat_economic_saboteur:   { name: 'Economic Saboteur',          desc: 'Crash a kingdom\'s economy by 30%+, causing revolt or war loss.',        xp: 375, tier: 'platinum', icon: '💸', category: 'underworld' },
    plat_shadow_politician:   { name: 'Shadow Politician',          desc: 'Flip 3+ council seats and/or change a vote outcome, voting on the winning side.', xp: 400, tier: 'platinum', icon: '🗳️', category: 'kingdom' },
    plat_kingmaker:           { name: 'Kingmaker',                  desc: 'Overthrow a king and install a new ruler with 80+ relationship.',        xp: 400, tier: 'platinum', icon: '👑', category: 'kingdom' },
    plat_economic_miracle:    { name: 'Economic Miracle',           desc: 'Elevate the poorest kingdom to become the wealthiest.',                  xp: 400, tier: 'platinum', icon: '📈', category: 'kingdom' },
    plat_kingdom_crusher:     { name: 'Kingdom Crusher',            desc: 'Help a kingdom fully conquer and eliminate another kingdom.',             xp: 400, tier: 'platinum', icon: '☠️', category: 'kingdom' },
    plat_world_at_war:        { name: 'World at War',               desc: 'All kingdoms are simultaneously at war; you provoked 2+ conflicts.',    xp: 400, tier: 'platinum', icon: '🔥', category: 'kingdom' },
    plat_pax_mercatoria:      { name: 'Pax Mercatoria',             desc: 'All kingdoms allied; you brokered 2+ alliances with 60+ ruler relations.', xp: 400, tier: 'platinum', icon: '🕊️', category: 'kingdom' },
    plat_debt_collector:      { name: 'The Debt Collector',         desc: '5+ nobles indebted controlling 40%+ of council vote weight.',            xp: 350, tier: 'platinum', icon: '💸', category: 'kingdom' },
    plat_monopoly_baron:      { name: 'Monopoly Baron',             desc: 'Own 100% of 3 resources\' production in a kingdom for 60+ days.',       xp: 375, tier: 'platinum', icon: '🏴', category: 'wealth' },
    plat_fortress_builder:    { name: 'Fortress Builder',           desc: 'Successfully petition a kingdom to build 5+ defensive structures.',     xp: 325, tier: 'platinum', icon: '🏰', category: 'kingdom' },
    plat_trade_route_empire:  { name: 'Trade Route Empire',         desc: 'Caravans covering 80%+ of town pairs, 30%+ world trade for 90 days.',   xp: 350, tier: 'platinum', icon: '🌐', category: 'transport' },
    plat_puppeteer_court:     { name: "The Puppeteer's Court",      desc: 'As RA, control king + council + economy + nobles for 180 consecutive days.', xp: 400, tier: 'platinum', icon: '🎭', category: 'kingdom' },
    plat_sea_and_land:        { name: 'Master of Sea and Land',     desc: '#1 trader by volume on both land and sea for 30+ consecutive days.',    xp: 375, tier: 'platinum', icon: '⚓', category: 'transport' },
    plat_architect:           { name: 'Architect of Civilization',  desc: 'Get 3 outposts promoted to village status through your efforts.',        xp: 400, tier: 'platinum', icon: '🏛️', category: 'kingdom' },
    kingdom_shaper:           { name: 'Kingdom Shaper',             desc: 'Achieve 15%+ kingdom impact as measured by Player Impact.',              xp: 120, tier: 'silver', icon: '🏆', category: 'kingdom' },
    world_influencer:         { name: 'World Influencer',           desc: 'Achieve 15%+ world impact as measured by Player Impact.',                xp: 200, tier: 'gold', icon: '🌍', category: 'kingdom' },
    plat_world_shaper:        { name: 'World Shaper',               desc: 'Achieve 30%+ world impact as measured by Player Impact.',                xp: 400, tier: 'platinum', icon: '🌐', category: 'kingdom' },
};

// Achievements that are EXCLUDED per start — these are trivially granted by starting conditions
// and should not count as real achievements for that difficulty tier.
const ACHIEVEMENT_START_EXCLUSIONS = {
    // Noble Birth: starts with 10000g, rank 4, 3 buildings, 5 workers, family
    very_easy: [
        'first_hundred', 'thousand_gold', 'five_thousand', 'ten_thousand',
        'self_made', 'first_foundation', 'property_owner', 'first_employee',
        'social_climber', 'guild_elite', 'noble_blood',
        'making_friends', 'best_friends', 'wedding_bells', 'family_person'
    ],
    // Merchant's Heir: starts with 2000g, rank 2, 1 building, family
    easy: [
        'first_hundred', 'thousand_gold',
        'first_foundation', 'social_climber',
        'making_friends', 'best_friends', 'wedding_bells'
    ],
    // Aspiring Merchant: starts with 500g, rank 1, citizen, family
    normal: [
        'first_hundred',
        'social_climber',
        'making_friends', 'best_friends'
    ],
    // Penniless Peasant: starts with nothing — no exclusions
    hard: [],
    // Indentured Servant: starts with nothing — no exclusions
    very_hard: [],
};

const ACHIEVEMENT_CATEGORIES = {
    trading:    { name: 'Trading',    icon: '📊' },
    building:   { name: 'Building',   icon: '🏗️' },
    transport:  { name: 'Transport',  icon: '🐴' },
    social:     { name: 'Social',     icon: '👥' },
    wealth:     { name: 'Wealth',     icon: '💰' },
    kingdom:    { name: 'Kingdom',    icon: '👑' },
    underworld: { name: 'Underworld', icon: '🎭' },
    legacy:     { name: 'Legacy',     icon: '🏰' },
};

// ============================================================
// Food & Hunger System
// ============================================================

const HUNGER_CONFIG = {
    MAX: 100,
    START: 80,
    DECAY_PER_DAY: 5,  // Was 10 — 20 days to starve instead of 10
    FOOD_RESTORE: 30,
    STARVING_HEALTH_LOSS: 1,
    FOOD_TYPES: ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food', 'vegetables', 'grapes', 'honey'],
    RAW_FOOD_TYPES: [],
    RAW_FOOD_RESTORE: 15,
    GUARD_FOOD_PER_DAY: 1,
};

const THIRST_CONFIG = {
    MAX: 100,
    START: 80,
    DECAY_PER_DAY: 8,  // Thirst depletes faster than hunger (12.5 days to dehydrate)
    BEVERAGE_TYPES: ['water', 'ale', 'mead', 'cider', 'herbal_tea', 'wine'],
    BEVERAGE_RESTORE: {
        water: 25,
        ale: 20,
        mead: 20,
        cider: 20,
        herbal_tea: 22,
        wine: 15,
    },
    BEVERAGE_EFFECTS: {
        ale:        { happiness: 2 },
        mead:       { happiness: 3 },
        wine:       { happiness: 4 },
        cider:      { happiness: 1 },
        herbal_tea: { healBonus: 1 },  // accelerates injury recovery
    },
    DEHYDRATED_THRESHOLD: 20,   // below 20 = debuffs
    DEHYDRATED_SPEED_PENALTY: 0.20,  // -20% travel speed
    DEHYDRATED_WORK_PENALTY: 0.15,   // -15% work pay
    WELL_DRAW_TICKS: 3,         // time cost to draw water from well
    WELL_DRAW_AMOUNT: 2,        // units of water per draw
};

// ========================================================
// WELL WATER CAPACITY SYSTEM
// ========================================================
const WELL_CAPACITY_CONFIG = {
    // Base water capacity range (sliding scale by fertility)
    MIN_FERTILITY_CAPACITY: 10000,    // low fertility (rating ~5)
    MAX_FERTILITY_CAPACITY: 40000,    // high fertility (rating ~100)
    RANDOM_VARIANCE: 0.25,            // +/- 25% random per well
    // How much water is consumed per unit produced (rate 15 = 15 water/day)
    DAILY_DRAW_RATE: 15,              // water units consumed from well per day per production cycle
    PLAYER_DRAW_COST: 2,              // water units consumed per player draw
    LOW_WATER_THRESHOLD: 0.15,        // below 15% capacity = "running low" for king AI
    REPLACEMENT_COST: 2000,           // gold for kingdom to dig a new well
};
const NPC_HEALTH_CONFIG = {
    // --- Base illness chance (per NPC per day) ---
    BASE_ILLNESS_CHANCE: 0.001,        // 0.1% daily baseline

    // --- Seasonal multipliers ---
    SEASON_MULT: {
        spring: 1.0,
        summer: 1.0,
        autumn: 1.5,                   // +50%
        winter: 3.0,                   // +200%
    },

    // --- Population density modifier (sliding scale) ---
    POP_DENSITY_MIN: 300,              // no bonus below this
    POP_DENSITY_MAX: 1000,             // +100% at this pop
    POP_DENSITY_MAX_MULT: 1.0,        // max additional multiplier from density

    // --- Building modifiers (reduce illness chance in town) ---
    HOSPITAL_REDUCTION: 0.50,          // -50% per hospital
    CLINIC_REDUCTION: 0.25,            // -25% per clinic
    WELL_REDUCTION: 0.15,              // -15% per well (clean water)
    AQUEDUCT_REDUCTION: 0.30,          // -30% for aqueduct

    // --- Severity weights (must sum to 1.0) ---
    SEVERITY_WEIGHTS: {
        minor: 0.70,                   // 70% of illnesses are minor
        moderate: 0.25,                // 25% moderate
        serious: 0.04,                 // 4% serious
        severe: 0.01,                  // 1% severe
    },

    // --- Illness types ---
    ILLNESSES: {
        cold:           { name: 'Common Cold',       severity: 'minor',    healthDrain: 0.3, daysToRecover: 10,  seasons: ['autumn', 'winter'] },
        flu:            { name: 'Flu',                severity: 'minor',    healthDrain: 0.5, daysToRecover: 12,  seasons: ['autumn', 'winter'] },
        food_poisoning: { name: 'Food Poisoning',     severity: 'minor',    healthDrain: 0.8, daysToRecover: 5,   seasons: ['spring', 'summer', 'autumn', 'winter'] },
        headaches:      { name: 'Chronic Headaches',   severity: 'minor',    healthDrain: 0.2, daysToRecover: 14,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        stomach_bug:    { name: 'Stomach Bug',         severity: 'minor',    healthDrain: 0.4, daysToRecover: 8,   seasons: ['spring', 'summer', 'autumn', 'winter'] },
        cough:          { name: 'Persistent Cough',    severity: 'minor',    healthDrain: 0.3, daysToRecover: 14,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        fever:          { name: 'Fever',               severity: 'moderate', healthDrain: 1.0, daysToRecover: 18,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        dysentery:      { name: 'Dysentery',           severity: 'moderate', healthDrain: 1.5, daysToRecover: 22,  seasons: ['summer', 'autumn'] },
        infection:      { name: 'Infection',           severity: 'moderate', healthDrain: 1.2, daysToRecover: 20,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        rash:           { name: 'Severe Rash',         severity: 'moderate', healthDrain: 0.8, daysToRecover: 16,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        pneumonia:      { name: 'Pneumonia',           severity: 'serious',  healthDrain: 2.0, daysToRecover: 30,  seasons: ['winter'] },
        typhus:         { name: 'Typhus',              severity: 'serious',  healthDrain: 2.5, daysToRecover: 30,  seasons: ['spring', 'summer', 'autumn', 'winter'] },
        plague:         { name: 'Plague',              severity: 'severe',   healthDrain: 3.5, daysToRecover: 35,  seasons: ['spring', 'summer', 'autumn', 'winter'], contagious: true, spreadChance: 0.04, naturalRecoveryDay: 14, naturalRecoveryChance: 0.025, recoveryChance: 0.10 },
    },

    // --- Health thresholds ---
    DEATH_HEALTH: 0,                   // die at 0 health
    NATURAL_RECOVERY_PER_DAY: 0.5,     // slow natural healing
    DOCTOR_HEAL_PER_DAY: 3.0,          // health restored per doctor per patient per day
    DOCTOR_PATIENTS_PER_DAY: 3,        // max patients a doctor can treat per day
    DOCTOR_SKILL_BONUS: 0.02,          // per workerSkill point, extra heal rate

    // --- Contagion / spread ---
    TOWN_SPREAD_BASE: 0.003,            // base daily chance of spreading to adjacent town
    TOWN_SPREAD_SICK_RATIO_MULT: 2.0,  // multiplied by (sickNPCs / totalPop) in source town
    TRADE_ROUTE_SPREAD_MULT: 1.5,      // towns connected by active trade routes spread faster

    // --- Treatment supplies consumed per severity ---
    // Injuries use bandages + physical supplies; illnesses use medicines
    TREATMENT_SUPPLIES_INJURY: {
        minor:    { bandages: 1 },
        moderate: { bandages: 1, splint: 1 },
        serious:  { bandages: 2, splint: 1, herbal_poultice: 1 },
        severe:   { bandages: 2, splint: 1, herbal_poultice: 1, healing_tonic: 1 },
    },
    TREATMENT_SUPPLIES_ILLNESS: {
        minor:    { herbal_remedy: 1 },
        moderate: { fever_tonic: 1 },
        serious:  { healing_tonic: 1 },
        severe:   { antidote: 1 },
    },
    // Medicine substitution: higher-tier can replace lower-tier
    // antidote > healing_tonic > fever_tonic > herbal_remedy
    MEDICINE_RANK: ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'antidote'],

    // Legacy combined (kept for backwards compat, but engine should use _INJURY/_ILLNESS)
    TREATMENT_SUPPLIES: {
        minor:    { bandages: 1 },
        moderate: { bandages: 1, herbal_remedy: 1 },
        serious:  { bandages: 2, healing_tonic: 1 },
        severe:   { bandages: 2, healing_tonic: 1, antidote: 1 },
    },

    // --- Treatment processing time (in game ticks, 60 ticks = 1 day) ---
    TREATMENT_TICKS: {
        minor:    5,     // ~2 hours
        moderate: 15,    // ~6 hours
        serious:  30,    // half a day
        severe:   120,   // 2 days (hospital)
    },

    // --- Plague event specific ---
    PLAGUE_INFECTION_RATE: { min: 0.08, max: 0.20 }, // 8-20% of town gets sick initially
    PLAGUE_DAILY_DEATH_UNTREATED: 0.05,               // 5% daily death if untreated
    PLAGUE_SPREAD_MULT: 2.0,                           // plague spreads 2x faster than normal

    // --- Moderate plague (5-year event) ---
    MODERATE_PLAGUE_INFECTION_RATE: { min: 0.04, max: 0.10 },
    MODERATE_PLAGUE_SPREAD_MULT: 1.0,
};

// Kingdom health policies the king AI can enact
const HEALTH_POLICIES = {
    quarantine_town: {
        id: 'quarantine_town',
        name: 'Town Quarantine',
        icon: '🔒',
        desc: 'Seal off a sick town. Eliminates outbound spread but -40% trade in that town.',
        scope: 'town',
        effects: { spreadMult: 0.0, tradePenalty: 0.40 },
        goldCostPerDay: 5,
        enactThreshold: 0.05,          // >5% of town population sick
    },
    curfew: {
        id: 'curfew',
        name: 'Curfew',
        icon: '🌙',
        desc: 'Restrict movement at night. -30% spread, -10% happiness, -15% trade.',
        scope: 'town',
        effects: { spreadMult: 0.70, happinessPenalty: 10, tradePenalty: 0.15 },
        goldCostPerDay: 2,
        enactThreshold: 0.03,          // >3% sick
    },
    medical_funding: {
        id: 'medical_funding',
        name: 'Medical Funding',
        icon: '💰',
        desc: 'Fund doctors and supplies. +50% treatment speed, costs 10g/day per town.',
        scope: 'kingdom',
        effects: { treatmentSpeedMult: 1.5 },
        goldCostPerDay: 10,
        enactThreshold: 0.02,          // >2% kingdom-wide sick
    },
    herbal_distribution: {
        id: 'herbal_distribution',
        name: 'Herbal Distribution',
        icon: '🌿',
        desc: 'Distribute free remedies. -20% illness chance, consumes herbal_remedy from stockpile.',
        scope: 'kingdom',
        effects: { illnessChanceMult: 0.80 },
        goldCostPerDay: 3,
        supplyCostPerDay: { herbal_remedy: 2 },
        enactThreshold: 0.02,
    },
    burn_the_dead: {
        id: 'burn_the_dead',
        name: 'Burn the Dead',
        icon: '🔥',
        desc: 'Cremate plague victims. -50% spread from deaths, -15% happiness.',
        scope: 'town',
        effects: { deathSpreadMult: 0.50, happinessPenalty: 15 },
        goldCostPerDay: 1,
        enactThreshold: 0.08,          // only when things are dire
    },
    close_borders: {
        id: 'close_borders_health',
        name: 'Health Border Closure',
        icon: '🚧',
        desc: 'Close kingdom borders to prevent import of disease. Eliminates cross-kingdom spread but -30% trade kingdom-wide.',
        scope: 'kingdom',
        effects: { crossKingdomSpread: 0.0, tradePenalty: 0.30 },
        goldCostPerDay: 8,
        enactThreshold: 0.10,          // >10% kingdom sick
    },
};

const ENERGY_CONFIG = {
    BASE_MAX: 100,
    START: 100,
    LOW_WARNING: 0.30,
    LOW_DEBUFF_THRESHOLD: 0.20,
    ACTION_BLOCK: 5,
    COLLAPSE_THRESHOLD: 0,
    COLLAPSE_CHANCE: 0.40,
    PASSIVE_RECOVERY_HOUSED: 5,
    PASSIVE_RECOVERY_HOMELESS: 2,
    TRAVEL_COST_PER_TICK: 1,
    TRADE_COST: 2,
    PETITION_COST: 5,
    BUILD_COST: 5,
    ENLIST_COST: 5,
    ESCAPE_COST: 15,
    CRAFT_COST: 2,
    MARKET_BROWSE_COST: 1,
    DEBUFFS: {
        workPay: -0.25,
        tradeEfficiency: -0.20,
        combat: -0.30,
        travelSpeed: -0.15,
        repGains: -0.20,
        xpGains: -0.15,
    },
    REST_ENERGY_PER_TICK: {
        outside: 2.0,
        wagon_sleep_travel: 2.5, // sleeping in wagon with 30+ capacity space
        bedroll: 2.5,
        bedroll_travel: 3.0,     // bedroll while traveling
        tent: 3.0,
        tent_travel: 4.0,        // tent while traveling
        bedroll_tent_travel: 4.5, // bedroll + tent combo while traveling
        camping_kit_travel: 5.0, // full camping kit while traveling
        caravan_wagon: 5.5,      // caravan wagon while traveling (mobile home — best travel option)
        shack: 3.0,
        master_quarters: 3.5,
        barracks: 3.5,
        inn_room: 4.0,
        cottage: 4.5,
        apartment: 4.5,
        tavern: 3.5,
        townhouse: 5.0,
        harbor_house: 5.0,
        merchant_house: 5.5,
        manor: 6.0,
        fortress: 6.0,
        estate: 7.0,
        castle: 8.0,
        farmstead: 4.0,
        outpost_housing: 4.5,
    },
    // Horse travel energy savings (multiplier on travel energy cost — lower = less energy used)
    HORSE_ENERGY_MULTIPLIER: 0.4,         // Horse reduces travel energy to 40% (60% reduction)
    HORSE_SADDLE_ENERGY_MULTIPLIER: 0.25,  // Horse + saddle reduces to 25% (75% reduction)
    ENDURANCE_TIERS: [
        { id: 'endurance_1', maxEnergy: 115 },
        { id: 'endurance_2', maxEnergy: 135 },
        { id: 'endurance_3', maxEnergy: 160 },
    ],
    JOB_ENERGY_DEFAULTS: {
        very_light: 0.5,   // scribe, clerk, diplomat
        light: 1.0,        // entertainer, tax collector, spy
        light_medium: 1.5, // castle servant, messenger, shepherd
        medium: 2.0,       // guard, stablehand, farm hand
        medium_heavy: 2.5, // soldier, smithy, construction
        heavy: 3.0,        // miner, dockworker, lumberjack
        very_heavy: 4.0,   // arena fighter, tournament
    },
};

// These belong in CONFIG, not HUNGER_CONFIG
CONFIG.MARKET_INTEL_UPDATE_INTERVAL = 30;
CONFIG.INFO_BROKER_COST = 10;
CONFIG.LOCAL_WORK_COOLDOWN_TICKS = 2;
CONFIG.STREET_TRADE_REFRESH_DAYS = 5;
CONFIG.STREET_TRADE_PREMIUM_MIN = 0.80;
CONFIG.STREET_TRADE_PREMIUM_MAX = 1.60;
CONFIG.STREET_TRADE_MAX_QTY = 5;
CONFIG.ODD_JOB_XP = 2;

// ============================================================
// Resource Depletion
// ============================================================
CONFIG.NATURAL_DEPOSITS = {
    iron_ore:  { min: 6000, max: 16000, terrain: 'mountain', renewable: false },
    gold_ore:  { min: 2000, max: 6000, terrain: 'mountain', renewable: false },
    stone:     { min: 10000, max: 30000, terrain: 'mountain', renewable: false },
    clay:      { min: 8000, max: 20000, terrain: 'any', renewable: false },
    salt:      { min: 4000, max: 12000, terrain: 'coastal', renewable: false },
    wood:      { min: 6000, max: 16000, terrain: 'forest', renewable: true, regenPerDay: 1, canPlant: true },
    fish:      { min: 2000, max: 6000, terrain: 'coastal', renewable: true, regenPerDay: 2, overfishRecoveryDays: 30 },
};
// Building-to-deposit requirements: buildings that extract from natural deposits
CONFIG.DEPOSIT_REQUIREMENTS = {
    iron_mine:    { deposit: 'iron_ore', label: 'Iron Deposit' },
    gold_mine:    { deposit: 'gold_ore', label: 'Gold Deposit' },
    lumber_camp:  { deposit: 'wood',     label: 'Forest (Wood Deposit)' },
    quarry:       { deposit: 'stone',    label: 'Stone Deposit' },
    fishery:      { deposit: 'fish',     label: 'Fish Stocks' },
    salt_works:   { deposit: 'salt',     label: 'Salt Deposit' },
    clay_pit:     { deposit: 'clay',     label: 'Clay Deposit' },
};
CONFIG.SOIL_FERTILITY = {
    degradePerSeason: 0.01,
    fallowRestorePerSeason: 0.25,
    cropRotationRestore: 0.10,
    // Regional fertility generation (0-100 scale, affects farm/herb production)
    mapAverageFertility: 60,       // Average across all towns
    mapFertilityVariance: 25,      // Standard deviation for random spread
    coastalPenalty: 10,            // Towns near coast lose this much fertility
    mountainPenalty: 15,           // Towns near mountains/mines lose this much
    minFertility: 5,               // No area is completely barren
    maxFertility: 100,             // Maximum possible
    // Production modifier: fertility 50 = baseline (1.0x), 100 = 2.0x, 0 = 0.25x
    baselineFertility: 50,
    maxProductionBonus: 2.0,       // At fertility 100
    minProductionPenalty: 0.25,    // At fertility 0
    // Season modifiers on growing production
    seasonModifiers: {
        Spring: 1.2,   // Good growing season
        Summer: 1.3,   // Best growing season
        Autumn: 0.8,   // Harvest winding down
        Winter: 0.4,   // Very poor growing
    },
    // Guild crafting bonus from fertility
    highFertilityBonusThreshold: 75,   // Fertility above this gives bonus items
    highFertilityBonusChance: 0.7,     // 70% chance of bonus at high fertility + good season
    lowFertilityPenaltyThreshold: 30,  // Fertility below this can fail harvests
    lowFertilityFailChance: 0.2,       // 20% chance of no output at low fertility + bad season
};
CONFIG.LIVESTOCK_BREEDING = {
    livestock_cow:     { breedDays: 90, offspring: 1, feedPerDay: 'wheat', feedQty: 1 },
    livestock_pig:     { breedDays: 60, offspring: 2, feedPerDay: 'wheat', feedQty: 1 },
    livestock_chicken: { breedDays: 30, offspring: 3, feedPerDay: 'wheat', feedQty: 0.5 },
    horses:            { breedDays: 120, offspring: 1, feedPerDay: 'wheat', feedQty: 2 },
};

// ============================================================
// Seasonal Demand Cycles
// ============================================================
CONFIG.SEASONAL_DEMAND = {
    Spring: { wheat: 1.3, wood: 1.2, stone: 1.2, tools: 1.2, bread: 1.0, meat: 1.0, herbs: 1.1 },
    Summer: { wheat: 0.8, bread: 0.9, wine: 1.3, fish: 1.2, meat: 0.9, preserved_food: 0.7, herbs: 1.2 },
    Autumn: { wheat: 0.7, bread: 0.8, preserved_food: 1.5, salt: 1.3, wool: 1.2, wine: 1.1, herbal_remedy: 1.2, bandages: 1.1 },
    Winter: { bread: 1.4, meat: 1.3, preserved_food: 1.5, wood: 1.3, wool: 1.3, clothes: 1.3, wheat: 1.2, fish: 0.7, herbal_remedy: 1.4, healing_tonic: 1.3, fever_tonic: 1.5, bandages: 1.2 },
};

// ============================================================
// Warehouse Security
// ============================================================
CONFIG.WAREHOUSE_SECURITY = {
    iron_door:      { name: 'Iron Door',       cost: 100, materials: { iron: 5 },              theftReduction: 0.20, icon: '🚪' },
    guard_post:     { name: 'Guard Post',      cost: 200, materials: { planks: 5, stone: 3 },  theftReduction: 0.30, icon: '💂', wageCost: 3 },
    vault_room:     { name: 'Vault Room',      cost: 500, materials: { iron: 10, stone: 10 },  theftReduction: 0.50, icon: '🔐' },
    trapped_locks:  { name: 'Trapped Locks',   cost: 300, materials: { iron: 5 },              theftReduction: 0.25, catchChance: 0.15, icon: '🪤' },
};
CONFIG.WAREHOUSE_BASE_THEFT = {
    village: 0.08,
    town: 0.05,
    city: 0.03,
    capital_city: 0.01,
};

// ============================================================
// Special Laws (for kingdom variety)
// ============================================================

const SPECIAL_LAWS = [
    { id: 'guild_monopoly',    name: 'Guild Monopoly',       desc: 'Only guild members (Guildmaster+) can own production buildings', icon: '🔨', effect: 'build_rank_3' },
    { id: 'open_market',       name: 'Open Market',          desc: 'No tariffs on foreign traders', icon: '🏪', effect: 'no_tariff' },
    { id: 'blood_price',       name: 'Blood Price',          desc: 'Pay 2x fines instead of jail time', icon: '💰', effect: 'fine_not_jail' },
    { id: 'night_market',      name: 'Night Market',         desc: 'Illegal goods detection reduced by 50% at night', icon: '🌙', effect: 'night_smuggle_bonus' },
    { id: 'sumptuary_laws',    name: 'Sumptuary Laws',       desc: 'Commoners (below Burgher) cannot buy luxury goods', icon: '👑', effect: 'luxury_rank_req' },
    { id: 'conscription_law',  name: 'Mandatory Conscription', desc: 'During wartime, the king conscripts 2-20% of males for 1 year of military service', icon: '⚔️', effect: 'conscription' },
    { id: 'market_day',        name: 'Market Day',           desc: 'Every 7th day is Market Day — citizens trade tax-free!', icon: '📅', effect: 'market_day_discount' },
    { id: 'harvest_tithe',     name: 'Harvest Tithe',        desc: '10% of farm production is collected by the crown as goods', icon: '🌾', effect: 'farm_tithe' },
    { id: 'sanctuary_law',     name: 'Right of Sanctuary',   desc: 'Criminal penalties from other kingdoms don\'t apply here', icon: '🏛️', effect: 'clear_foreign_offenses' },
    { id: 'apprentice_law',    name: 'Apprentice Law',       desc: 'Must work for a business 30 days before owning one', icon: '📜', effect: 'build_delay' },
    { id: 'foreign_ban',       name: 'Isolationist Policy',  desc: 'Non-citizens pay 25% extra tax on all trades', icon: '🚫', effect: 'foreign_tax_25' },
    { id: 'free_trade',        name: 'Free Trade Zone',      desc: 'No goods-specific taxes, flat low rate', icon: '🕊️', effect: 'no_goods_tax' },
    { id: 'trial_combat',      name: 'Trial by Combat',      desc: 'When caught, 30% chance to fight your way out (combat skill matters)', icon: '⚔️', effect: 'trial_combat' },
    { id: 'maritime_privilege', name: 'Maritime Privilege',   desc: 'Port towns enjoy a 50% tax break on sea goods (fish, salt, pearls, rope, hemp, pearl jewelry)', icon: '⚓', effect: 'port_discount' },
    { id: 'price_controls',     name: 'Price Controls',       desc: 'Maximum prices set on essential goods (bread, wheat, water). Protects citizens but may cause shortages.', icon: '📊', effect: 'price_cap' },
    { id: 'immigration_policy', name: 'Closed Borders',       desc: 'Foreigners must earn citizenship through service before settling. Building restricted for non-citizens.', icon: '🚧', effect: 'closed_borders' },
    { id: 'inheritance_tax',    name: 'Inheritance Tax',       desc: 'The crown takes a percentage of inherited wealth during dynasty succession.', icon: '💀', effect: 'inheritance_tax' },
    { id: 'draft_animal_law',   name: 'Draft Animal Permits',  desc: 'Commoners (below Burgher) require a royal permit to own horses.', icon: '🐴', effect: 'horse_permit' },
    { id: 'female_heir_law',    name: 'Female Succession',     desc: 'Women may inherit the throne and titles. Without this law, only males can be heirs.', icon: '👑', effect: 'female_heirs' },
    { id: 'no_dual_citizenship', name: 'Exclusive Citizenship', desc: 'Citizens may not hold citizenship in other kingdoms. Dual citizenship is forbidden.', icon: '🛡️', effect: 'no_dual_citizenship' },
    { id: 'no_tent_camps',       name: 'No Tent Camps',         desc: 'Tent camps are forbidden. Existing camps will be demolished by soldiers.', icon: '🚫', effect: 'no_tent_camps' },
    { id: 'right_to_camps',      name: 'Right to Camps',        desc: 'Homeless citizens may pool resources to build tent camps in any town.', icon: '⛺', effect: 'right_to_camps' },
    { id: 'noble_council',     name: 'Noble Council',        desc: 'Major decisions require a vote among nobles. King vote=5, RA=3, Lord=2, Minor Noble=1. Increases stability.', icon: '⚖️', effect: 'noble_council' },
    { id: 'random_inspections', name: 'Random Inspections', desc: 'Guards randomly inspect warehouses, inventories, and merchants for banned or restricted goods without permits. Costs 1g per kingdom guard per day.', icon: '🔍', effect: 'random_inspections' },
];
CONFIG.SPECIAL_LAWS = SPECIAL_LAWS;

// ============================================================
// King Mood System
// ============================================================
CONFIG.KING_MOOD = {
    // Mood states and their modifiers to decision probabilities
    moods: {
        jubilant:   { taxMod: -0.04, festivalMod: 2.0, petitionMod: 1.5, warMod: 0.3, conscriptMod: 0.5, icon: '😄', desc: 'The king is jubilant' },
        content:    { taxMod: 0,     festivalMod: 1.0, petitionMod: 1.0, warMod: 1.0, conscriptMod: 1.0, icon: '😊', desc: 'The king is content' },
        worried:    { taxMod: 0.02,  festivalMod: 0.5, petitionMod: 0.7, warMod: 1.2, conscriptMod: 1.3, icon: '😟', desc: 'The king is worried' },
        paranoid:   { taxMod: 0.04,  festivalMod: 0.1, petitionMod: 0.3, warMod: 1.5, conscriptMod: 1.8, icon: '😰', desc: 'The king is paranoid' },
        fearful:    { taxMod: 0.03,  festivalMod: 0.2, petitionMod: 0.4, warMod: 0.5, conscriptMod: 2.0, icon: '😨', desc: 'The king is fearful' },
        wrathful:   { taxMod: 0.05,  festivalMod: 0.0, petitionMod: 0.1, warMod: 2.0, conscriptMod: 1.5, icon: '😡', desc: 'The king is wrathful' },
        grieving:   { taxMod: 0,     festivalMod: 0.0, petitionMod: 0.5, warMod: 0.7, conscriptMod: 0.8, icon: '😢', desc: 'The king is grieving' },
        ambitious:  { taxMod: 0.01,  festivalMod: 0.8, petitionMod: 0.6, warMod: 1.8, conscriptMod: 1.4, icon: '🔥', desc: 'The king is ambitious' },
    },
    // How long moods last (in days) before decaying toward 'content'
    moodDuration: {
        jubilant: 90, content: 9999, worried: 60, paranoid: 45,
        fearful: 30, wrathful: 30, grieving: 120, ambitious: 60,
    },
    // Events that trigger mood changes
    triggers: {
        war_won: 'jubilant', war_lost: 'wrathful', war_declared_on: 'fearful',
        assassination_attempt: 'paranoid', treasury_low: 'worried', treasury_crisis: 'paranoid',
        plague: 'fearful', rebellion: 'wrathful', high_happiness: 'jubilant',
        heir_born: 'jubilant', heir_died: 'grieving', spouse_died: 'grieving',
        conquest: 'ambitious', festival_success: 'content', tournament_success: 'jubilant',
    },
    // Quest category weights by mood — multiplied into quest selection weight
    questCatWeights: {
        //                   military  espionage  economic  diplomatic  justice  social  corrupt
        jubilant:   { military: 0.4, espionage: 0.3, economic: 1.8, diplomatic: 1.5, justice: 0.8, social: 1.8, corrupt: 0.3 },
        content:    { military: 1.0, espionage: 1.0, economic: 1.0, diplomatic: 1.0, justice: 1.0, social: 1.0, corrupt: 1.0 },
        worried:    { military: 1.4, espionage: 1.5, economic: 1.2, diplomatic: 1.0, justice: 1.3, social: 0.6, corrupt: 1.2 },
        paranoid:   { military: 1.6, espionage: 2.0, economic: 0.8, diplomatic: 0.5, justice: 1.8, social: 0.3, corrupt: 1.8 },
        fearful:    { military: 1.8, espionage: 1.2, economic: 0.5, diplomatic: 1.5, justice: 0.8, social: 0.4, corrupt: 0.5 },
        wrathful:   { military: 2.0, espionage: 1.5, economic: 0.4, diplomatic: 0.3, justice: 2.0, social: 0.2, corrupt: 1.5 },
        grieving:   { military: 0.5, espionage: 0.6, economic: 0.8, diplomatic: 0.8, justice: 1.0, social: 1.5, corrupt: 0.4 },
        ambitious:  { military: 1.5, espionage: 1.3, economic: 1.5, diplomatic: 1.2, justice: 1.0, social: 0.8, corrupt: 1.3 },
    },
    // Reward generosity by mood — multiplied into quest gold reward
    rewardMod: {
        jubilant: 1.3, content: 1.0, worried: 0.9, paranoid: 0.8,
        fearful: 1.1, wrathful: 0.7, grieving: 1.0, ambitious: 1.1,
    },
    // Urgency bias by mood — chance to upgrade urgency one level
    urgencyBias: {
        jubilant: 0.0, content: 0.0, worried: 0.15, paranoid: 0.30,
        fearful: 0.25, wrathful: 0.35, grieving: 0.0, ambitious: 0.20,
    },
};

// ============================================================
// Succession Crisis Config
// ============================================================
CONFIG.SUCCESSION_CRISIS = {
    // Duration of instability period (days)
    minorCrisisDays: 30,    // heir exists, smooth transition
    majorCrisisDays: 90,    // no male heir, contested
    extremeCrisisDays: 180, // no heir at all, civil war risk
    // Effects during crisis
    taxSpikeChance: 0.4,           // chance taxes spike during crisis
    taxSpikeAmount: 0.05,          // +5% tax spike
    lawChangeChance: 0.3,          // chance laws change
    happinessDrop: 15,             // immediate happiness penalty
    majorHappinessDrop: 30,        // extreme crisis penalty
    tradeDisruptionMult: 0.7,      // trade volume reduced to 70%
    // Pretender system
    maxPretenders: 4,              // max claimants to the throne
    pretenderWarChance: 0.15,      // daily chance pretenders fight (extreme)
    // Player influence requirements
    minRankToInfluence: 5,         // Lord rank required to influence
    minGoldToInfluence: 10000,     // gold needed to back a claimant
    minRepToInfluence: 70,         // reputation needed
    // Rewards for backing winning claimant
    winnerRepBoost: 30,
    winnerRankBoost: 1,
    winnerGoldReward: 5000,
    // Penalties for backing loser
    loserRepPenalty: 40,
    loserGoldLoss: 0.2,            // lose 20% of invested gold
};

// ============================================================
// King Travel Config
// ============================================================
CONFIG.KING_TRAVEL = {
    // Royal progress — king tours own towns
    progressChancePerSeason: 0.12,       // ~12% chance per season to start a tour
    progressDaysPerTown: 8,              // days spent in each visited town
    progressTravelDays: 3,               // travel days between towns
    progressMaxTowns: 3,                 // max towns per tour
    progressHappinessBoost: 3,           // happiness boost to visited town
    progressProsperityBoost: 2,          // prosperity boost to visited town
    progressCostPerDay: 5,               // gold cost per day of travel
    // Diplomatic travel — king visits foreign capital
    diplomaticChancePerSeason: 0.06,     // ~6% chance per season
    diplomaticDays: 12,                  // days spent at foreign capital
    diplomaticRelationBoost: 5,          // relation boost on visit
    diplomaticMinRelation: -10,          // won't visit hostile kingdoms
    diplomaticCostPerDay: 10,            // gold cost per day
    // Personality modifiers
    personalityMods: {
        ambitious:  { progressMod: 1.5, diplomaticMod: 1.8 },
        content:    { progressMod: 0.5, diplomaticMod: 0.5 },
        lazy:       { progressMod: 0.2, diplomaticMod: 0.3 },
        brave:      { progressMod: 1.3, diplomaticMod: 1.5 },
        cowardly:   { progressMod: 0.4, diplomaticMod: 0.3 },
        kind:       { progressMod: 1.4, diplomaticMod: 1.0 },
        cruel:      { progressMod: 0.6, diplomaticMod: 0.8 },
    },
    // Mood modifiers — stressed/fearful kings stay home
    moodMods: {
        jubilant:  { progressMod: 1.5, diplomaticMod: 1.3 },
        content:   { progressMod: 1.0, diplomaticMod: 1.0 },
        worried:   { progressMod: 0.3, diplomaticMod: 0.5 },
        paranoid:  { progressMod: 0.0, diplomaticMod: 0.0 },
        fearful:   { progressMod: 0.0, diplomaticMod: 0.0 },
        wrathful:  { progressMod: 0.3, diplomaticMod: 0.2 },
        grieving:  { progressMod: 0.1, diplomaticMod: 0.1 },
        ambitious: { progressMod: 1.2, diplomaticMod: 1.6 },
    },
};

// ============================================================
// Price Controls Config
// ============================================================
CONFIG.PRICE_CONTROLS = {
    essentialGoods: ['bread', 'wheat', 'water', 'meat', 'fish'],
    maxPriceMultiplier: 1.5,   // cap at 1.5x base price
    shortageThreshold: 0.3,    // below 30% normal supply = shortage
    producerPenalty: 0.15,     // 15% less profit for producers under controls
};

// ============================================================
// Immigration Policy Config
// ============================================================
CONFIG.IMMIGRATION_POLICY = {
    // Requirements for non-citizens in closed-border kingdoms
    militaryServiceDays: 360,  // 1 year military service earns citizenship
    tradeVolumeReq: 5000,     // 5000g trade volume earns citizenship right
    buildingRestricted: true,  // non-citizens can't build
    settlementRestricted: true, // non-citizens pay 2x property costs
    foreignSurcharge: 0.25,    // 25% surcharge on all transactions
};

// ============================================================
// Inheritance Tax Config
// ============================================================
CONFIG.INHERITANCE_TAX = {
    minRate: 0.05,     // 5% minimum inheritance tax
    maxRate: 0.20,     // 20% maximum inheritance tax
    nobleExemption: 4, // Minor Noble+ can negotiate reduction
    exemptionDiscount: 0.5, // nobles pay 50% of the tax rate
};

// ============================================================
// Draft Animal Law Config
// ============================================================
CONFIG.DRAFT_ANIMAL_LAW = {
    permitCostMonthly: 100,    // 100g for 30 days
    permitCostAnnual: 1000,    // 1000g for 1 year
    permitDurationMonthly: 30, // 30 days
    permitDurationAnnual: 360, // 1 year
    minRankExempt: 2,          // Burgher+ exempt from permits
    baseCheckChance: 0.05,     // 5% daily chance guards check (high security, no skills)
    confiscationFine: 500,     // fine if caught without permit
    jailDays: 30,              // jail time if can't/won't pay fine
    // Skills that reduce check chance (each reduces by a fraction)
    evasionSkills: ['discrete', 'shadow_dealings', 'master_disguise', 'shadow_step'],
    evasionReductionPerSkill: 0.25, // each relevant skill reduces chance by 25%
};

// ============================================================
// Royal Commissions Config
// ============================================================
CONFIG.ROYAL_COMMISSIONS = {
    maxActivePerKingdom: 3,
    checkInterval: 30,         // king reviews commissions every 30 days
    baseReward: 1.5,           // 150% of goods value as reward
    repReward: 1,              // reputation reward per commission filled
    expirationDays: 90,        // commissions expire after 90 days
    types: {
        goods_delivery: { name: 'Goods Delivery', desc: 'Deliver goods to the crown', icon: '📦' },
        building_request: { name: 'Building Request', desc: 'Build a specific workshop', icon: '🏗️' },
        military_supply: { name: 'Military Supply', desc: 'Supply weapons/armor to the army', icon: '⚔️' },
    },
};

// ============================================================
// Spouse Personality Quirks
// ============================================================

const SPOUSE_QUIRKS = [
    // ---- POSITIVE QUIRKS (27) ----
    { id: 'animal_lover', name: 'Animal Lover', icon: '🐾', positive: true, effect: 'Livestock businesses +15% productivity', heirEffect: '+1 Trading SP', workerMod: 0.15, workerDesc: '+15% output at livestock buildings' },
    { id: 'green_thumb', name: 'Green Thumb', icon: '🌿', positive: true, effect: 'Farm buildings +20% output', heirEffect: 'Farming knowledge', workerMod: 0.12, workerDesc: '+12% output at farm buildings' },
    { id: 'merchant_family', name: 'Merchant Family', icon: '💰', positive: true, effect: '5% better trade prices', heirEffect: '+2 starting SP', workerMod: 0.05, workerDesc: '+5% output (business savvy)' },
    { id: 'noble_blood', name: 'Hidden Noble Blood', icon: '👑', positive: true, effect: 'Easier rank advancement', heirEffect: 'Starts one rank higher', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'healer', name: 'Healer', icon: '🌡️', positive: true, effect: 'Reduces illness risk for family', heirEffect: 'Herbalism knowledge', workerMod: 0.05, workerDesc: 'Fewer sick days, +5% reliability' },
    { id: 'bookworm', name: 'Bookworm', icon: '📚', positive: true, effect: 'Player XP gain +10%', heirEffect: '+3 bonus SP', workerMod: 0.08, workerDesc: '+8% output (meticulous records)' },
    { id: 'adventurous', name: 'Adventurous Spirit', icon: '🧭', positive: true, effect: 'Travel time -10%', heirEffect: 'Navigation knowledge', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'forgiving', name: 'Forgiving Nature', icon: '🕊️', positive: true, effect: 'Relationship recovers +0.3/day faster after drops', heirEffect: 'Better starting relationships', workerMod: 0.03, workerDesc: '+3% output (good team player)' },
    { id: 'natural_leader', name: 'Natural Leader', icon: '⭐', positive: true, effect: 'Workers +10% productivity', heirEffect: '+2 Leadership SP', workerMod: 0.10, workerDesc: '+10% output (inspires others)' },
    { id: 'good_cook', name: 'Good Cook', icon: '🍲', positive: true, effect: 'Hunger drains 15% slower', heirEffect: 'No hunger penalty first 30 days', workerMod: 0.06, workerDesc: '+6% output at food buildings' },
    { id: 'charming_smile', name: 'Charming Smile', icon: '😊', positive: true, effect: 'NPC relationship gains +10%', heirEffect: '+1 Social SP', workerMod: 0.03, workerDesc: '+3% output (keeps morale up)' },
    { id: 'sailors_daughter', name: "Sailor's Daughter", icon: '⛵', positive: true, effect: 'Ship travel 15% faster/safer', heirEffect: 'Seafaring knowledge', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'blacksmiths_kin', name: "Blacksmith's Kin", icon: '🔨', positive: true, effect: 'Weapon/armor buildings +15%', heirEffect: 'Crafting knowledge', workerMod: 0.15, workerDesc: '+15% output at smithing buildings' },
    { id: 'silver_tongue', name: 'Silver Tongue', icon: '🪙', positive: true, effect: '2% better negotiation prices', heirEffect: '+1 Trading SP', workerMod: 0.04, workerDesc: '+4% output (negotiates better supplies)' },
    { id: 'thrifty', name: 'Thrifty', icon: '🧵', positive: true, effect: 'Building maintenance costs -10%', heirEffect: 'Starts with 10% more gold', workerMod: 0.07, workerDesc: '+7% output (wastes nothing)' },
    { id: 'lucky', name: 'Lucky', icon: '🍀', positive: true, effect: '5% chance to avoid bad random events', heirEffect: 'Inherits luck trait', workerMod: 0.03, workerDesc: '+3% output (fewer mishaps)' },
    { id: 'musical', name: 'Musical', icon: '🎵', positive: true, effect: 'Festival bonuses +20%, worker morale +5%', heirEffect: '+1 Social SP', workerMod: 0.05, workerDesc: '+5% output (boosts morale)' },
    { id: 'keen_eye_quirk', name: 'Keen Eye', icon: '👁️', positive: true, effect: 'Spots counterfeit goods, market insight', heirEffect: 'Appraisal knowledge', workerMod: 0.06, workerDesc: '+6% output (quality control)' },
    { id: 'patient', name: 'Patient', icon: '🧘', positive: true, effect: 'Production quality +5%', heirEffect: '+1 Crafting SP', workerMod: 0.08, workerDesc: '+8% output (careful craftsmanship)' },
    { id: 'diplomatic', name: 'Diplomatic', icon: '🤝', positive: true, effect: 'Kingdom reputation gains +10%', heirEffect: 'Starts with +10 reputation', workerMod: 0.03, workerDesc: '+3% output (resolves disputes)' },
    { id: 'strong_constitution', name: 'Strong Constitution', icon: '💪', positive: true, effect: '30% less likely to get sick', heirEffect: 'Strong health', workerMod: 0.06, workerDesc: '+6% output (never misses work)' },
    { id: 'early_riser', name: 'Early Riser', icon: '🌅', positive: true, effect: 'Morning productivity bonus (first 6 hours)', heirEffect: 'Discipline trait', workerMod: 0.10, workerDesc: '+10% output (extra productive hours)' },
    { id: 'protective', name: 'Protective', icon: '🛡️', positive: true, effect: 'Family 25% less likely to be attacked/robbed', heirEffect: 'Combat awareness', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'generous_spirit', name: 'Generous Spirit', icon: '💝', positive: true, effect: '+5% reputation gains, NPCs more helpful', heirEffect: 'Goodwill from NPCs', workerMod: 0.03, workerDesc: '+3% output (popular with coworkers)' },
    { id: 'quick_learner', name: 'Quick Learner', icon: '🎓', positive: true, effect: 'Heir gets +2 SP on inheritance', heirEffect: '+2 SP on regency', workerMod: 0.08, workerDesc: '+8% output (learns tasks fast)' },
    { id: 'well_connected', name: 'Well Connected', icon: '🔗', positive: true, effect: 'Market intel from other towns', heirEffect: 'Trade connections', workerMod: 0.05, workerDesc: '+5% output (sourcing connections)' },
    { id: 'loyal_heart', name: 'Loyal Heart', icon: '❤️', positive: true, effect: '+20 regency score bonus. Never abandons', heirEffect: 'Loyalty trait', workerMod: 0.04, workerDesc: '+4% output (dedicated and reliable)' },
    { id: 'fertile', name: 'Fertile', icon: '🌸', positive: true, effect: '50% higher chance of children', heirEffect: 'May inherit fertility', workerMod: 0, workerDesc: 'No worker effect' },
    // ---- NEGATIVE QUIRKS (28) ----
    { id: 'jealous', name: 'Jealous', icon: '😤', positive: false, effect: 'Relationship decays 2x when away from spouse', heirEffect: 'No effect', workerMod: -0.05, workerDesc: '-5% output (distracted by grudges)' },
    { id: 'secret_gambler', name: 'Secret Gambler', icon: '🎲', positive: false, effect: 'Loses 10-100g randomly every 30-60 days', heirEffect: 'May inherit habit (-1 SP)', workerMod: -0.08, workerDesc: '-8% output (mind elsewhere)' },
    { id: 'violent_temper', name: 'Violent Temper', icon: '💢', positive: false, effect: 'Random arguments drop relationship -5 to -15 every 30-60 days', heirEffect: 'May be fearful (-1 Social SP)', workerMod: -0.10, workerDesc: '-10% output (scares coworkers)' },
    { id: 'frail_health', name: 'Frail Health', icon: '🤒', positive: false, effect: '2x chance of spouse death', heirEffect: 'May inherit weak health', workerMod: -0.12, workerDesc: '-12% output (frequently absent)' },
    { id: 'gossip', name: 'Gossip', icon: '🗣️', positive: false, effect: 'May reveal your crimes to authorities (+10% detection)', heirEffect: 'No effect', workerMod: -0.04, workerDesc: '-4% output (too much chatting)' },
    { id: 'stubborn', name: 'Stubborn', icon: '🪨', positive: false, effect: 'Relationship gains -25%', heirEffect: 'Willpower (+1 SP, mixed)', workerMod: -0.03, workerDesc: '-3% output (resists new methods)' },
    { id: 'spendthrift', name: 'Spendthrift', icon: '💸', positive: false, effect: 'Wastes 10% of monthly income on luxuries', heirEffect: 'Expensive tastes', workerMod: -0.05, workerDesc: '-5% output (careless with materials)' },
    { id: 'paranoid', name: 'Paranoid', icon: '😰', positive: false, effect: 'Harder to maintain relationship, suspicious of gifts', heirEffect: 'Trust issues (-1 Social SP)', workerMod: -0.06, workerDesc: '-6% output (distrustful of others)' },
    { id: 'lazy', name: 'Lazy', icon: '😴', positive: false, effect: 'Building productivity -10% for spouse-managed buildings', heirEffect: 'May be lazy (-1 SP)', workerMod: -0.15, workerDesc: '-15% output (avoids work)' },
    { id: 'vain', name: 'Vain', icon: '💅', positive: false, effect: 'Demands gifts worth 50g+ every 30 days or relationship -10', heirEffect: 'Vanity trait', workerMod: -0.04, workerDesc: '-4% output (won\'t do dirty work)' },
    { id: 'superstitious', name: 'Superstitious', icon: '🌙', positive: false, effect: 'Refuses certain goods, seasonal mood swings', heirEffect: 'No effect', workerMod: -0.03, workerDesc: '-3% output (refuses some tasks)' },
    { id: 'clumsy', name: 'Clumsy', icon: '🫗', positive: false, effect: '3% chance per month to damage stored inventory', heirEffect: 'No effect', workerMod: -0.08, workerDesc: '-8% output (breaks things)' },
    { id: 'hot_headed', name: 'Hot Headed', icon: '🔥', positive: false, effect: 'May start fights with NPCs, drawing guard attention', heirEffect: 'Temper (-1 Social SP)', workerMod: -0.07, workerDesc: '-7% output (causes conflicts)' },
    { id: 'pessimist', name: 'Pessimist', icon: '😔', positive: false, effect: 'Worker morale -5%, occasional negative commentary', heirEffect: 'Cautious nature (mixed)', workerMod: -0.05, workerDesc: '-5% output (drags morale down)' },
    { id: 'fearful', name: 'Fearful', icon: '😨', positive: false, effect: "Won't travel with you, panics during war", heirEffect: 'Anxiety trait', workerMod: -0.06, workerDesc: '-6% output (hesitant and anxious)' },
    { id: 'vengeful', name: 'Vengeful', icon: '⚡', positive: false, effect: 'If relationship drops below 30, actively sabotages business', heirEffect: 'No effect', workerMod: -0.05, workerDesc: '-5% output (holds grudges)' },
    { id: 'kleptomaniac', name: 'Kleptomaniac', icon: '🫳', positive: false, effect: 'Steals 5-20g per month from your businesses', heirEffect: 'May inherit (-1 Honesty)', workerMod: -0.10, workerDesc: '-10% output (steals materials)' },
    { id: 'sickly', name: 'Sickly', icon: '🤢', positive: false, effect: "Frequently ill, can't contribute, may need medicine", heirEffect: 'Weak constitution', workerMod: -0.15, workerDesc: '-15% output (always sick)' },
    { id: 'night_terrors', name: 'Night Terrors', icon: '😱', positive: false, effect: '-5% town reputation from disturbing neighbors', heirEffect: 'No effect', workerMod: -0.04, workerDesc: '-4% output (exhausted from poor sleep)' },
    { id: 'drunkard', name: 'Drunkard', icon: '🍺', positive: false, effect: 'Spends 20-50g/month on drink, erratic behavior', heirEffect: 'May inherit habit', workerMod: -0.12, workerDesc: '-12% output (unreliable)' },
    { id: 'prideful', name: 'Prideful', icon: '👃', positive: false, effect: "Won't do menial work, demands higher social rank", heirEffect: 'Ambitious (mixed)', workerMod: -0.06, workerDesc: '-6% output (refuses certain tasks)' },
    { id: 'secretive', name: 'Secretive', icon: '🤫', positive: false, effect: 'Trait reveal takes 2x as many dates', heirEffect: 'Secretive nature', workerMod: -0.02, workerDesc: '-2% output (uncommunicative)' },
    { id: 'clingy', name: 'Clingy', icon: '🫂', positive: false, effect: 'Must be in same town or -0.5/day relationship decay', heirEffect: 'Dependent nature', workerMod: -0.03, workerDesc: '-3% output (needs constant attention)' },
    { id: 'manipulative', name: 'Manipulative', icon: '🎭', positive: false, effect: 'May turn children against you (-relationship with heir)', heirEffect: '-10 starting relationship with NPCs', workerMod: -0.07, workerDesc: '-7% output (causes infighting)' },
    { id: 'cursed_lineage', name: 'Cursed Lineage', icon: '💀', positive: false, effect: 'Children have 2x illness/death risk', heirEffect: 'Weak constitution', workerMod: -0.03, workerDesc: '-3% output (gloomy aura)' },
    { id: 'criminal_past', name: 'Criminal Past', icon: '🔪', positive: false, effect: 'Knows underworld (-5% detection) BUT may attract criminal attention', heirEffect: '+1 Underworld SP', workerMod: -0.05, workerDesc: '-5% output (untrustworthy with goods)' },
    { id: 'hoarder', name: 'Hoarder', icon: '📦', positive: false, effect: 'Stockpiles 10% of produced goods, reducing sellable inventory', heirEffect: 'No effect', workerMod: -0.10, workerDesc: '-10% output (hoards materials)' },
    { id: 'low_fertility', name: 'Low Fertility', icon: '🥀', positive: false, effect: 'Conception takes much longer (~100 days avg)', heirEffect: 'May inherit low fertility', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'infertile', name: 'Infertile', icon: '🚫', positive: false, effect: 'Cannot have children', heirEffect: 'No children possible', rare: true, workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'names_children', name: 'Names the Children', icon: '✍️', positive: false, effect: 'Insists on naming children — you get no say', heirEffect: 'No effect', workerMod: 0, workerDesc: 'No worker effect' },
    { id: 'keeps_maiden_name', name: 'Keeps Maiden Name', icon: '💁', positive: false, effect: 'Refuses to take your last name on marriage', heirEffect: 'No effect', workerMod: 0, workerDesc: 'No worker effect' },
];

// ============================================================
// Social Interactions (NPC relationship building)
// ============================================================
// Each interaction is weighted by NPC personality traits (0-100 scale).
// personalityWeights: positive means that trait helps, negative means it hurts.
// quirkBonuses/quirkPenalties: specific quirks that modify the outcome.
// baseGain: relationship gain before personality modifiers.
// The final gain is clamped to [-5, +8] range.

const SOCIAL_INTERACTIONS = [
    {
        id: 'small_talk', name: 'Small Talk', icon: '💬',
        description: 'Safe, light conversation about the weather and town gossip',
        baseGain: 2, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.02, honesty: 0.01 },
        quirkBonuses: ['charming_smile', 'diplomatic', 'generous_spirit'],
        quirkPenalties: ['paranoid'],
        dateProgress: 8
    },
    {
        id: 'tell_joke', name: 'Tell a Joke', icon: '😂',
        description: 'Try to make them laugh — works great with warm people, risky with serious ones',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.06, honesty: -0.01, ambition: -0.02 },
        quirkBonuses: ['musical', 'adventurous', 'charming_smile'],
        quirkPenalties: ['prideful', 'violent_temper', 'pessimist'],
        dateProgress: 10
    },
    {
        id: 'discuss_business', name: 'Discuss Business', icon: '📊',
        description: 'Talk shop — ambitious and intelligent people love this, others find it dull',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { ambition: 0.05, intelligence: 0.03, warmth: -0.02 },
        quirkBonuses: ['merchant_family', 'silver_tongue', 'keen_eye_quirk', 'well_connected'],
        quirkPenalties: ['lazy', 'superstitious'],
        dateProgress: 12
    },
    {
        id: 'compliment', name: 'Compliment', icon: '🌹',
        description: 'Pay them a genuine compliment — usually positive, but some see through flattery',
        baseGain: 2, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.03, honesty: -0.03, loyalty: 0.01 },
        quirkBonuses: ['vain', 'charming_smile', 'generous_spirit'],
        quirkPenalties: ['paranoid', 'stubborn', 'manipulative'],
        dateProgress: 6
    },
    {
        id: 'ask_advice', name: 'Ask for Advice', icon: '🧠',
        description: 'Seek their wisdom — intelligent and loyal people appreciate being consulted',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { intelligence: 0.05, loyalty: 0.02, ambition: 0.01 },
        quirkBonuses: ['bookworm', 'natural_leader', 'patient', 'quick_learner'],
        quirkPenalties: ['lazy', 'hot_headed', 'drunkard'],
        dateProgress: 14
    },
    {
        id: 'share_drink', name: 'Share a Drink', icon: '🍺',
        description: 'Buy them a drink at the tavern — great for bonding, but costs a few gold',
        baseGain: 3, cost: 5, timeHours: 2,
        personalityWeights: { warmth: 0.02, frugality: -0.03, honesty: 0.01 },
        quirkBonuses: ['drunkard', 'adventurous', 'generous_spirit', 'musical'],
        quirkPenalties: ['superstitious', 'patient', 'paranoid'],
        dateProgress: 15
    },
];

// Max interactions with same NPC per day before cooldown
CONFIG.NPC_INTERACTION_DAILY_LIMIT = 3;

// ============================================================
// Guild Membership System
// ============================================================
const GUILDS = {
    farmers:     { id: 'farmers',     name: "Farmers' Guild",         icon: '🌾', categories: ['farm'] },
    miners:      { id: 'miners',      name: "Miners' Guild",          icon: '⛏️', categories: ['mine'] },
    harvesters:  { id: 'harvesters',  name: "Harvesters' Guild",      icon: '🪓', categories: ['harvest'] },
    artisans:    { id: 'artisans',    name: "Artisans' Guild",        icon: '⚙️', categories: ['processing'] },
    craftsmen:   { id: 'craftsmen',   name: "Craftsmen's Guild",      icon: '🔨', categories: ['finished'] },
    armorsmiths: { id: 'armorsmiths', name: "Armorsmiths' Guild",     icon: '⚔️', categories: ['military'] },
    luxury:      { id: 'luxury',      name: "Luxury Artisans' Guild", icon: '💎', categories: ['luxury'] },
    maritime:    { id: 'maritime',    name: "Maritime Guild",         icon: '⚓', categories: ['port'] },
    merchants:   { id: 'merchants',   name: "Merchants' Guild",       icon: '💰', categories: ['trade'] },
    healers:     { id: 'healers',     name: "Healers' Guild",         icon: '⚕️', categories: ['medical'] },
};
CONFIG.GUILDS = GUILDS;
CONFIG.GUILD_BASE_MONTHLY = 100;
CONFIG.GUILD_BASE_YEARLY = 800;
// Merchants Guild uses 4x base prices (400 monthly / 3200 yearly)
CONFIG.MERCHANTS_GUILD_BASE_MONTHLY = 400;
CONFIG.MERCHANTS_GUILD_BASE_YEARLY = 3200;
CONFIG.MERCHANTS_GUILD_REPORT_FEE = 25;
CONFIG.MERCHANTS_GUILD_PROSPERITY_CAP = 3.0; // max multiplier on membership price
CONFIG.GUILD_BUILDING_ENTRY_FEE_MIN = 5;
CONFIG.GUILD_BUILDING_ENTRY_FEE_MAX = 10;

// ── Guild Loan (Bankruptcy Option) ──
CONFIG.GUILD_LOAN = {
    MIN_AMOUNT: 1000,
    MAX_AMOUNT: 5000,
    ANNUAL_INTEREST: 0.10,
    TERM_DAYS: 720,           // 2 in-game years
    PAYMENT_INTERVAL: 30,     // auto-payment every 30 days
    MIN_GUILD_BUFFER: 1000    // guild must retain at least this much after lending
};

// ============================================================
// Dating Activities
// ============================================================

const DATING_ACTIVITIES = [
    { id: 'walk', name: '🚶 Walk Through Town', cost: 0, timeHours: 2, relationshipGain: 3, revealsTraitLevel: 'vague', dateProgress: 18, description: 'A leisurely stroll together' },
    { id: 'meal', name: '🍽️ Share a Meal', cost: 10, timeHours: 3, relationshipGain: 5, revealsTraitLevel: 'vague', dateProgress: 20, description: 'Enjoy food and conversation' },
    { id: 'gift', name: '🎁 Give a Thoughtful Gift', cost: 25, timeHours: 1, relationshipGain: 8, revealsTraitLevel: 'none', dateProgress: 0, description: 'Show you care with a meaningful gift' },
    { id: 'deep_talk', name: '💬 Deep Conversation', cost: 0, timeHours: 4, relationshipGain: 4, revealsTraitLevel: 'specific', dateProgress: 30, minRelationship: 30, description: 'Share thoughts and learn about each other' },
    { id: 'adventure', name: '⚔️ Adventure Together', cost: 50, timeHours: 8, relationshipGain: 12, revealsTraitLevel: 'specific', dateProgress: 35, minRelationship: 40, description: 'Face danger together and see their true nature' },
    { id: 'lavish_date', name: '👑 Lavish Evening', cost: 100, timeHours: 6, relationshipGain: 15, revealsTraitLevel: 'exact', dateProgress: 45, minRelationship: 50, description: 'Spare no expense for a memorable night' },
];

// ============================================================
// Regency Thresholds
// ============================================================

// ============================================================
// Petition Types
// ============================================================
const PETITION_TYPES = [
    { id: 'build_road', name: 'Build a Road', icon: '🛤️', desc: 'Request the kingdom to build a road between two towns', requiresTarget: true, targetType: 'town_pair', costFactor: 0.05 },
    { id: 'increase_security', name: 'Increase Town Security', icon: '🛡️', desc: 'Request more guards for a specific town', requiresTarget: true, targetType: 'town', costFactor: 0 },
    { id: 'clear_bandits', name: 'Clear Bandits from Road', icon: '⚔️', desc: 'Send soldiers to clear bandits from a dangerous road', requiresTarget: true, targetType: 'road', costFactor: 0 },
    { id: 'lower_taxes', name: 'Lower Tax Rate', icon: '💰', desc: 'Request the king to lower the kingdom tax rate', requiresTarget: false, costFactor: 0 },
    { id: 'raise_taxes', name: 'Raise Tax Rate', icon: '📈', desc: 'Request the king to raise taxes (some NPCs want this for services)', requiresTarget: false, costFactor: 0 },
    { id: 'build_market', name: 'Build Town Market', icon: '🏪', desc: 'Request a new market building in a town', requiresTarget: true, targetType: 'town', costFactor: 0.03 },
    { id: 'repair_infrastructure', name: 'Repair Infrastructure', icon: '🔧', desc: 'Fix damaged roads and buildings in a town', requiresTarget: true, targetType: 'town', costFactor: 0.02 },
    { id: 'establish_trade_agreement', name: 'Establish Trade Agreement', icon: '🤝', desc: 'Push for a trade agreement with another kingdom', requiresTarget: true, targetType: 'kingdom', costFactor: 0 },
    { id: 'ban_goods', name: 'Ban a Good', icon: '🚫', desc: 'Request the kingdom to ban a specific trade good', requiresTarget: true, targetType: 'resource', costFactor: 0 },
    { id: 'unban_goods', name: 'Unban a Good', icon: '✅', desc: 'Request the kingdom to unban a specific trade good', requiresTarget: true, targetType: 'resource', costFactor: 0 },
    { id: 'repair_bridge', name: 'Repair a Bridge', icon: '🌉', desc: 'Request the kingdom repair destroyed bridges on a road', requiresTarget: true, targetType: 'road', costFactor: 0.04 },
    { id: 'declare_war', name: 'Declare War', icon: '⚔️', desc: 'Urge the kingdom to declare war on another kingdom', requiresTarget: true, targetType: 'kingdom', costFactor: 0 },
    { id: 'seek_peace', name: 'Seek Peace', icon: '🕊️', desc: 'Urge the kingdom to seek peace in an active war', requiresTarget: true, targetType: 'kingdom', costFactor: 0 },
    { id: 'fund_festival', name: 'Fund a Festival', icon: '🎉', desc: 'Request the kingdom fund a festival in a town', requiresTarget: true, targetType: 'town', costFactor: 0.01 },
    { id: 'demolish_tent_camps', name: 'Demolish Tent Camps', icon: '🔥', desc: 'Request the king to demolish all tent camps in a specific town', requiresTarget: true, targetType: 'town', costFactor: 0 },
    { id: 'build_sea_route', name: 'Establish Sea Route', icon: '⚓', desc: 'Request the kingdom to establish a sea trade route between two port towns', requiresTarget: true, targetType: 'port_pair', costFactor: 0.08 },
    { id: 'promote_outpost', name: 'Promote Outpost to Village', icon: '🏘️', desc: 'Request the king to officially promote an outpost with 20+ residents to village status', requiresTarget: true, targetType: 'town', costFactor: 0.02 },
    { id: 'build_defense', name: 'Build Defensive Structure', icon: '🏰', desc: 'Request the kingdom to build a defensive structure (watchtower, walls, fortress) in a town', requiresTarget: true, targetType: 'town', costFactor: 0.04 },
];

// ============================================================
// Crime Types & Kingdom Law System
// ============================================================
CONFIG.CRIME_TYPES = [
    { id: 'smuggling', name: 'Smuggling', icon: '📦', defaultPunishment: 'jail', defaultJailDays: 5, defaultFine: 200, description: 'Trading in banned goods without a permit' },
    { id: 'theft', name: 'Theft', icon: '🤚', defaultPunishment: 'jail', defaultJailDays: 7, defaultFine: 150, description: 'Stealing goods or gold from others' },
    { id: 'assault', name: 'Assault', icon: '👊', defaultPunishment: 'jail', defaultJailDays: 14, defaultFine: 300, description: 'Attacking another person' },
    { id: 'murder', name: 'Murder', icon: '💀', defaultPunishment: 'execution', defaultJailDays: 360, defaultFine: 5000, description: 'Killing another person' },
    { id: 'arson', name: 'Arson', icon: '🔥', defaultPunishment: 'jail', defaultJailDays: 30, defaultFine: 500, description: 'Setting fire to buildings or property' },
    { id: 'sabotage', name: 'Sabotage', icon: '💣', defaultPunishment: 'jail', defaultJailDays: 30, defaultFine: 2000, description: 'Deliberately damaging infrastructure such as bridges or roads' },
    { id: 'tax_evasion', name: 'Tax Evasion', icon: '💸', defaultPunishment: 'fine', defaultJailDays: 3, defaultFine: 200, description: 'Evading kingdom taxes' },
    { id: 'bribery', name: 'Bribery', icon: '🤫', defaultPunishment: 'fine', defaultJailDays: 5, defaultFine: 300, description: 'Bribing officials or guards' },
    { id: 'treason', name: 'Treason', icon: '⚔️', defaultPunishment: 'execution', defaultJailDays: 360, defaultFine: 10000, description: 'Acting against the kingdom\'s interests' },
    { id: 'war_profiteering', name: 'War Profiteering', icon: '💰', defaultPunishment: 'jail', defaultJailDays: 30, defaultFine: 1000, description: 'Selling war materials to enemy kingdoms' },
    { id: 'forgery', name: 'Forgery', icon: '📝', defaultPunishment: 'jail', defaultJailDays: 10, defaultFine: 250, description: 'Forging documents or licenses' },
    { id: 'trespassing', name: 'Trespassing', icon: '🚷', defaultPunishment: 'fine', defaultJailDays: 1, defaultFine: 50, description: 'Entering restricted areas' },
    { id: 'poaching', name: 'Poaching', icon: '🦌', defaultPunishment: 'fine', defaultJailDays: 3, defaultFine: 100, description: 'Hunting on royal lands' },
    { id: 'counterfeiting', name: 'Counterfeiting', icon: '🪙', defaultPunishment: 'jail', defaultJailDays: 60, defaultFine: 2000, description: 'Creating counterfeit coins' },
    { id: 'poison', name: 'Poisoning', icon: '☠️', defaultPunishment: 'execution', defaultJailDays: 180, defaultFine: 3000, description: 'Poisoning food, water, or people' },
    { id: 'blackmail', name: 'Blackmail', icon: '📬', defaultPunishment: 'jail', defaultJailDays: 15, defaultFine: 500, description: 'Extorting others through threats' },
];

// ============================================================
// Action Tick Costs
// ============================================================
CONFIG.ACTION_TICK_COSTS = {
    // Trading
    buy: 2, sell: 2, smuggle: 4, street_trade: 3,
    // Building
    supply_building: 2, collect_output: 2, toggle_auto_buy: 1, set_transfer: 1, toggle_guard: 1,
    // Employment
    hire_worker: 3, fire_worker: 2, assign_worker: 1, remove_worker: 1,
    // Transport
    send_caravan: 3, buy_horse: 2, sell_horse: 2, buy_ship: 2, repair_ship: 2, buy_container: 2,
    // Storage
    deposit: 2, withdraw: 2,
    // Social
    give_gift: 2, ask_tavern: 3, ask_tavern_trends: 3, ask_friend: 3, observe_person: 30, hire_investigator: 2,
    go_on_date: 15, spend_time_spouse: 15, use_perk: 1,
    // Petition
    create_petition: 3, request_signature: 3, hire_petitioner: 2, fire_petitioner: 1, submit_petition: 5,
    // Governance
    petition_promotion: 10, petition_citizenship: 5, petition_license: 3, petition_permit: 5,
    influence_king: 10, renounce_kingdom: 3,
    // Combat
    equip: 1, enlist: 3, quit_military: 2,
    // Infrastructure
    destroy_bridge: 5, set_toll: 1, collect_tolls: 2,
    // Health
    visit_hospital: 5, self_treat: 3,
    // Misc
    forage: 30, unlock_skill: 1,
    // Kingdom trade
    sell_to_kingdom: 3,
    // Family actions
    ask_family_money: 2, ask_family_work: 2, family_dinner: 10, teach_family_trade: 5,
    ask_family_advice: 2, borrow_family_connections: 3, family_celebration: 15,
    give_family_gift: 2, invite_family_live: 2, family_business: 5, confide_family: 3,
    ask_family_caretake: 2,
    // Special start actions
    give_sermon: 5, visit_holy_site: 10, convert_npc: 3, bless_npc: 2,
    tell_exotic_story: 3, teach_foreign_craft: 10, establish_trading_post: 15,
    perform_tavern: 8, street_performance: 5, host_concert: 30, compose_song: 10,
    perform_court: 15, private_performance: 5,
    train_troops: 10, plan_battle: 5, inspire_army: 3, fortify_position: 15, scout_enemy: 8,
    study_town: 20, learn_from_npc: 5, study_library: 15, write_notes: 5, write_great_book: 60,
    setBuildingProduct: 5,
};

// ============================================================
// Kingdom-Owned Building Types
// ============================================================
CONFIG.KINGDOM_BUILDING_TYPES = [
    'barracks', 'armory', 'watchtower', 'blacksmith', 'armorer', 'bakery', 'flour_mill',
    'castle', 'training_grounds', 'siege_workshop', 'stables',
    'hospital', 'clinic', 'herb_garden', 'apothecary', 'advanced_apothecary', 'bandage_workshop',
    'granary', 'treasury_vault', 'courthouse',
    'guild_hall', 'marketplace_royal', 'cathedral', 'university',
    'port_fortress', 'wall_upgrade', 'fortress_walls'
];
CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS = [
    'barracks', 'armory', 'watchtower',
    'castle', 'training_grounds', 'siege_workshop', 'stables',
    'courthouse', 'cathedral', 'university', 'port_fortress', 'wall_upgrade', 'fortress_walls'
];

// ============================================================
// Kingdom Building Construction & Repair Times (days)
// ============================================================
CONFIG.KINGDOM_BUILD_TIMES = {
    // Small structures (5-12 days build, 2-5 days repair)
    watchtower:        { build: 8,  repair: 3  },
    clinic:            { build: 10, repair: 4  },
    herb_garden:       { build: 5,  repair: 2  },
    apothecary:        { build: 10, repair: 4  },
    advanced_apothecary: { build: 18, repair: 7 },
    bandage_workshop:  { build: 8,  repair: 3  },
    bakery:            { build: 8,  repair: 3  },
    flour_mill:        { build: 10, repair: 4  },
    blacksmith:        { build: 10, repair: 4  },
    armorer:           { build: 12, repair: 5  },
    granary:           { build: 10, repair: 4  },
    marketplace_royal: { build: 12, repair: 5  },
    // Medium structures (15-25 days build, 5-10 days repair)
    barracks:          { build: 20, repair: 8  },
    armory:            { build: 15, repair: 6  },
    training_grounds:  { build: 15, repair: 5  },
    stables:           { build: 12, repair: 5  },
    hospital:          { build: 20, repair: 8  },
    guild_hall:        { build: 20, repair: 8  },
    courthouse:        { build: 20, repair: 8  },
    treasury_vault:    { build: 25, repair: 10 },
    siege_workshop:    { build: 25, repair: 10 },
    // Large structures (30-60 days build, 15-30 days repair)
    wall_upgrade:      { build: 30, repair: 15 },
    university:        { build: 40, repair: 15 },
    port_fortress:     { build: 45, repair: 20 },
    cathedral:         { build: 50, repair: 20 },
    castle:            { build: 60, repair: 25 },
    fortress_walls:    { build: 60, repair: 20 },
};

// ============================================================
// Game Start Scenarios
// ============================================================
CONFIG.GAME_STARTS = [
    { id: 'very_hard', name: 'Indentured Servant', icon: '⛓️', difficulty: 'Very Hard', color: '#ff3333',
      description: 'Bound to a traveling merchant for 7 years. Find a way out — or serve your time.',
      startGold: 0, startRank: 0, startCitizen: false, special: 'indentured' },
    { id: 'hard', name: 'Penniless Peasant', icon: '🥔', difficulty: 'Hard', color: '#ff8833',
      description: 'No family, no money, no connections. Just you and the clothes on your back.',
      startGold: 0, startRank: 0, startCitizen: false, special: null },
    { id: 'normal', name: 'Aspiring Merchant', icon: '⚖️', difficulty: 'Normal', color: '#ffdd33',
      description: 'A citizen with a small inheritance, a loving but poor family, and big dreams.',
      startGold: 500, startRank: 1, startCitizen: true, hasFamily: true, special: null },
    { id: 'easy', name: "Merchant's Heir", icon: '🏪', difficulty: 'Easy', color: '#33dd55',
      description: 'Born into a merchant family. Start with a house, a business, and some workers.',
      startGold: 2000, startRank: 2, startCitizen: true, hasFamily: true, startHouse: 'townhouse', startBuilding: true, special: null },
    { id: 'very_easy', name: 'Noble Birth', icon: '👑', difficulty: 'Very Easy', color: '#3388ff',
      description: 'Born to nobility. A manor, wealth, connections, and a reputation to uphold.',
      startGold: 10000, startRank: 4, startCitizen: true, hasFamily: true, startHouse: 'manor', startBuildings: 3, startWorkers: 5, special: null },
    { id: 'pilgrim', name: 'Religious Pilgrim', icon: '🙏', difficulty: 'Unique', color: '#dd88ff',
      description: 'Sworn to a holy pilgrimage. Visit sacred sites, spread the faith, and find enlightenment. No business until your quest is complete.',
      startGold: 30, startRank: 0, startCitizen: false, special: 'pilgrim' },
    { id: 'shipwrecked', name: 'Shipwrecked Foreigner', icon: '🌊', difficulty: 'Unique', color: '#33dddd',
      description: 'Washed ashore with nothing but a mysterious artifact. A stranger in a strange land.',
      startGold: 0, startRank: 0, startCitizen: false, special: 'shipwrecked' },
    { id: 'musician', name: 'Traveling Musician', icon: '🎵', difficulty: 'Unique', color: '#ffaa55',
      description: 'Your instrument is your fortune. Build fame, gather fans, and become a legend.',
      startGold: 50, startRank: 0, startCitizen: false, special: 'musician' },
    { id: 'military', name: 'Military Leader', icon: '⚔️', difficulty: 'Unique', color: '#cc3333',
      description: 'Born for battle. Rise through the ranks to become the Hero of Ages. Choose a kingdom at war.',
      startGold: 100, startRank: 0, startCitizen: true, special: 'military_leader' },
    { id: 'scholar', name: 'Scholar of the Ages', icon: '📚', difficulty: 'Unique', color: '#8888ff',
      description: 'Seek knowledge in every corner of the world. Write the Great Book. Pass wisdom to your heir.',
      startGold: 80, startRank: 0, startCitizen: false, special: 'scholar' },
];

// ============================================================
// Indentured Servant Escape Methods Pool
// ============================================================
CONFIG.INDENTURED_ESCAPE_POOL = [
    { id: 'pay_debt', hint: 'Your contract states the terms of your debt...' },
    { id: 'impress_noble', hint: 'The nobles sometimes watch the market square...' },
    { id: 'military_enlist', hint: 'Soldiers answer to no merchant...' },
    { id: 'blackmail_master', hint: 'Your master disappears late at night sometimes...' },
    { id: 'frame_master', hint: 'The guards are always watching for smugglers...' },
    { id: 'master_dies', hint: 'All contracts end eventually...' },
    { id: 'legal_challenge', hint: 'The scholars in the capital know the old laws...' },
    { id: 'earn_freedom', hint: 'A servant who makes their master rich earns gratitude...' },
    { id: 'steal_contract', hint: 'Your master keeps important papers in their belongings...' },
    { id: 'religious_sanctuary', hint: 'The temples offer refuge to the desperate...' },
    { id: 'poison_master', hint: 'Some herbs have... other uses...' },
    { id: 'bribe_officials', hint: 'Officials can be... flexible... for the right price.' },
    { id: 'run_away', hint: 'The roads are long and your master can\'t watch you always...' },
    { id: 'win_tournament', hint: 'The arena sometimes offers unusual prizes...' },
    { id: 'marry_up', hint: 'Love knows no station...' },
];

// ============================================================
// Military Leader Extended Ranks
// ============================================================
CONFIG.MILITARY_LEADER_RANKS = [
    { id: 'recruit', name: 'Recruit', index: 0 },
    { id: 'footman', name: 'Footman', index: 1 },
    { id: 'sergeant', name: 'Sergeant', index: 2 },
    { id: 'knight', name: 'Knight', index: 3 },
    { id: 'captain', name: 'Captain', index: 4 },
    { id: 'commander', name: 'Commander', index: 5 },
    { id: 'general', name: 'General', index: 6 },
];

// ============================================================
// Military Service Tasks & Approach System
// ============================================================
CONFIG.MILITARY_TASKS = [
    { id: 'training_drill',    name: '🗡️ Training Drill',      desc: 'Spar with fellow soldiers to sharpen combat skills.',
      injuryChance: 0.05, injurySeverity: 'minor', xp: 3, rankProgress: 1, pay: 0, ticks: 2 },
    { id: 'fortification',     name: '🏰 Fortification Work',  desc: 'Reinforce walls, dig trenches, and build palisades.',
      injuryChance: 0.08, injurySeverity: 'minor', xp: 2, rankProgress: 1, pay: 0, ticks: 3 },
    { id: 'patrol_duty',       name: '🛡️ Patrol Duty',         desc: 'Walk the perimeter and watch for enemy movements.',
      injuryChance: 0.03, injurySeverity: 'moderate', xp: 2, rankProgress: 1, pay: 1, ticks: 2 },
    { id: 'guard_duty',        name: '💂 Guard Duty',           desc: 'Stand watch at the gates. Boring but safe.',
      injuryChance: 0.01, injurySeverity: 'minor', xp: 1, rankProgress: 0, pay: 2, ticks: 2 },
    { id: 'weapons_training',  name: '⚔️ Weapons Training',    desc: 'Intensive combat drills under a veteran instructor.',
      injuryChance: 0.10, injurySeverity: 'minor', xp: 5, rankProgress: 2, pay: 0, ticks: 3 },
    { id: 'scouting_mission',  name: '🔍 Scouting Mission',    desc: 'Venture into enemy territory to gather intelligence.',
      injuryChance: 0.06, injurySeverity: 'moderate', xp: 4, rankProgress: 2, pay: 3, ticks: 4 },
    { id: 'supply_escort',     name: '📦 Supply Escort',        desc: 'Guard a supply convoy between camps.',
      injuryChance: 0.04, injurySeverity: 'minor', xp: 2, rankProgress: 1, pay: 2, ticks: 3 },
    { id: 'logistics_duty',    name: '📋 Logistics Duty',       desc: 'Manage inventory, rations, and equipment distribution.',
      injuryChance: 0.00, injurySeverity: 'minor', xp: 2, rankProgress: 1, pay: 1, ticks: 2 },
    { id: 'siege_work',        name: '🪨 Siege Engineering',    desc: 'Build and operate siege weapons. Dangerous but prestigious.',
      injuryChance: 0.12, injurySeverity: 'moderate', xp: 5, rankProgress: 3, pay: 2, ticks: 4 },
    { id: 'prisoner_escort',   name: '⛓️ Prisoner Escort',     desc: 'Transport captured enemies to a holding camp.',
      injuryChance: 0.04, injurySeverity: 'minor', xp: 2, rankProgress: 1, pay: 2, ticks: 3 },
];

CONFIG.MILITARY_NURSE_TASKS = [
    { id: 'ward_rounds',      name: '🏥 Ward Rounds',          desc: 'Check on patients, change bandages, administer medicine.',
      injuryChance: 0.02, injurySeverity: 'minor', xp: 3, rankProgress: 1, pay: 0, ticks: 2 },
    { id: 'herb_gathering',   name: '🌿 Herb Gathering',       desc: 'Forage for medicinal plants near camp.',
      injuryChance: 0.03, injurySeverity: 'minor', xp: 2, rankProgress: 1, pay: 0, ticks: 2 },
    { id: 'surgery_assist',   name: '🩺 Surgery Assist',       desc: 'Assist the chief surgeon with field operations.',
      injuryChance: 0.01, injurySeverity: 'minor', xp: 5, rankProgress: 2, pay: 0, ticks: 3 },
    { id: 'sanitation_duty',  name: '🧹 Sanitation Duty',      desc: 'Clean the field hospital to prevent disease.',
      injuryChance: 0.04, injurySeverity: 'minor', xp: 1, rankProgress: 0, pay: 0, ticks: 2 },
    { id: 'triage_duty',      name: '🚑 Triage Duty',          desc: 'Prioritize incoming wounded based on severity.',
      injuryChance: 0.00, injurySeverity: 'minor', xp: 4, rankProgress: 2, pay: 1, ticks: 2 },
];

CONFIG.MILITARY_APPROACH = {
    aggressive: {
        label: '⚔️ Aggressive',
        desc: 'Fight recklessly for glory. Higher risk, but guaranteed promotion if you survive a battle.',
        deathMult: 1.5,    // +50% death chance
        injuryMult: 1.5,   // +50% injury chance
        xpMult: 2.0,       // double XP
        repMult: 2.0,      // double reputation
        rankMult: 2.0,     // double rank progress
        promotionGuarantee: true  // guaranteed promotion after surviving battle
    },
    normal: {
        label: '🛡️ Normal',
        desc: 'Standard approach. Balance risk and reward.',
        deathMult: 1.0,
        injuryMult: 1.0,
        xpMult: 1.0,
        repMult: 1.0,
        rankMult: 1.0,
        promotionGuarantee: false
    },
    cautious: {
        label: '🐢 Cautious',
        desc: 'Stay in the rear. Much safer, but slower advancement and less glory.',
        deathMult: 0.4,    // -60% death chance
        injuryMult: 0.5,   // -50% injury chance
        xpMult: 0.5,       // half XP
        repMult: 0.5,      // half reputation
        rankMult: 0.5,     // half rank progress
        promotionGuarantee: false
    }
};

CONFIG.MILITARY_RANK_PROGRESS_THRESHOLDS = {
    militiaman: 10,   // progress needed to promote to footman
    footman: 25,      // to sergeant
    sergeant: 50,     // to knight
    knight: 100,      // max rank for enlisted
    field_nurse: 10,
    ward_nurse: 25,
    head_nurse: 50,
    chief_healer: 100
};

const REGENCY_THRESHOLDS = [
    { min: 80, max: 100, label: 'Devoted Steward',    goldPct: 1.00, buildingPct: 1.00, bonusSkillPoints: 2,  repMult: 1.0 },
    { min: 60, max: 79,  label: 'Adequate Guardian',   goldPct: 0.75, buildingPct: 1.00, bonusSkillPoints: 1,  repMult: 0.8 },
    { min: 40, max: 59,  label: 'Reluctant Caretaker', goldPct: 0.50, buildingPct: 0.50, bonusSkillPoints: 0,  repMult: 0.5 },
    { min: 20, max: 39,  label: 'Negligent Parent',    goldPct: 0.25, buildingPct: 0.00, bonusSkillPoints: -1, repMult: 0.3 },
    { min: 0,  max: 19,  label: 'Abandoned',            goldPct: 0.00, buildingPct: 0.00, bonusSkillPoints: -2, repMult: 0.0 },
];

// ============================================================
// Elite Merchant Heraldry
// ============================================================
const ELITE_MERCHANT_HERALDRY = [
    { id: 'lion', symbol: '🦁', name: 'House of the Lion', colors: ['#c4a000', '#8b0000'] },
    { id: 'eagle', symbol: '🦅', name: 'House of the Eagle', colors: ['#1a5276', '#f4d03f'] },
    { id: 'wolf', symbol: '🐺', name: 'House of the Wolf', colors: ['#555555', '#c0c0c0'] },
    { id: 'stag', symbol: '🦌', name: 'House of the Stag', colors: ['#196f3d', '#f5b041'] },
    { id: 'bear', symbol: '🐻', name: 'House of the Bear', colors: ['#6e2c00', '#d4ac0d'] },
    { id: 'serpent', symbol: '🐍', name: 'House of the Serpent', colors: ['#1b4f72', '#2ecc71'] },
    { id: 'hawk', symbol: '🦅', name: 'House of the Hawk', colors: ['#7d3c98', '#f1c40f'] },
    { id: 'dragon', symbol: '🐉', name: 'House of the Dragon', colors: ['#922b21', '#f39c12'] },
    { id: 'phoenix', symbol: '🔥', name: 'House of the Phoenix', colors: ['#e74c3c', '#f9e79f'] },
    { id: 'rose', symbol: '🌹', name: 'House of the Rose', colors: ['#c0392b', '#f5cba7'] },
    { id: 'anchor', symbol: '⚓', name: 'House of the Anchor', colors: ['#2e4053', '#5dade2'] },
    { id: 'crown', symbol: '👑', name: 'House of the Crown', colors: ['#d4ac0d', '#7d6608'] },
    { id: 'sword', symbol: '⚔️', name: 'House of the Sword', colors: ['#566573', '#e5e7e9'] },
    { id: 'oak', symbol: '🌳', name: 'House of the Oak', colors: ['#1e8449', '#784212'] },
    { id: 'star', symbol: '⭐', name: 'House of the Star', colors: ['#1a5276', '#f4d03f'] },
    { id: 'raven', symbol: '🐦‍⬛', name: 'House of the Raven', colors: ['#17202a', '#7f8c8d'] },
    { id: 'horse', symbol: '🐴', name: 'House of the Horse', colors: ['#784212', '#f0b27a'] },
    { id: 'tower', symbol: '🏰', name: 'House of the Tower', colors: ['#5d6d7e', '#f2f3f4'] },
    { id: 'compass', symbol: '🧭', name: 'House of the Compass', colors: ['#1a5276', '#d5f5e3'] },
    { id: 'chalice', symbol: '🏆', name: 'House of the Chalice', colors: ['#7d6608', '#fdebd0'] },
    { id: 'hammer', symbol: '🔨', name: 'House of the Hammer', colors: ['#5d4e37', '#c0c0c0'] },
    { id: 'scroll', symbol: '📜', name: 'House of the Scroll', colors: ['#8b4513', '#f5f5dc'] },
    { id: 'crescent', symbol: '🌙', name: 'House of the Crescent', colors: ['#1a1a2e', '#f1c40f'] },
    { id: 'greatoak', symbol: '🌳', name: 'House of the Great Oak', colors: ['#2d572c', '#8b6914'] },
    { id: 'flame', symbol: '🔥', name: 'House of the Flame', colors: ['#8b0000', '#ff8c00'] },
    { id: 'shield', symbol: '🛡️', name: 'House of the Shield', colors: ['#4a4a4a', '#daa520'] },
    { id: 'bell', symbol: '🔔', name: 'House of the Bell', colors: ['#654321', '#ffd700'] },
    { id: 'feather', symbol: '🪶', name: 'House of the Feather', colors: ['#e6e6fa', '#4b0082'] },
    { id: 'lantern', symbol: '🏮', name: 'House of the Lantern', colors: ['#cc0000', '#ffcc00'] },
];

// ============================================================
// Equipment Quality Tiers
// ============================================================
const EQUIPMENT_TYPES = {
    weapons: [
        { id: 'rusty_sword', name: 'Rusty Sword', resource: 'swords', quality: 'poor', combatBonus: 0.10, priceMultiplier: 0.5 },
        { id: 'iron_sword', name: 'Iron Sword', resource: 'swords', quality: 'standard', combatBonus: 0.20, priceMultiplier: 1.0 },
        { id: 'steel_sword', name: 'Steel Sword', resource: 'swords_good', quality: 'fine', combatBonus: 0.30, priceMultiplier: 1.0 },
        { id: 'masterwork_sword', name: 'Masterwork Sword', resource: 'swords_excellent', quality: 'masterwork', combatBonus: 0.40, priceMultiplier: 1.0 },
        { id: 'short_bow', name: 'Short Bow', resource: 'bows', quality: 'poor', combatBonus: 0.08, priceMultiplier: 0.5 },
        { id: 'hunting_bow', name: 'Hunting Bow', resource: 'bows', quality: 'standard', combatBonus: 0.15, priceMultiplier: 1.0 },
        { id: 'longbow', name: 'Longbow', resource: 'bows_good', quality: 'fine', combatBonus: 0.25, priceMultiplier: 1.0 },
        { id: 'war_bow', name: 'War Bow', resource: 'bows_excellent', quality: 'masterwork', combatBonus: 0.35, priceMultiplier: 1.0 },
    ],
    armor: [
        { id: 'padded_armor', name: 'Padded Armor', resource: 'armor', quality: 'poor', combatBonus: 0.15, priceMultiplier: 0.5 },
        { id: 'chain_mail', name: 'Chain Mail', resource: 'armor', quality: 'standard', combatBonus: 0.30, priceMultiplier: 1.0 },
        { id: 'plate_armor', name: 'Plate Armor', resource: 'armor_good', quality: 'fine', combatBonus: 0.40, priceMultiplier: 1.0 },
        { id: 'royal_plate', name: 'Royal Plate Armor', resource: 'armor_excellent', quality: 'masterwork', combatBonus: 0.50, priceMultiplier: 1.0 },
    ]
};
CONFIG.EQUIPMENT_TYPES = EQUIPMENT_TYPES;

// ── Musical Instrument Performance Config ──
const INSTRUMENTS = {
    drum:        { id: 'drum',        name: 'Drum',        baseBonus: 0.10, icon: '🥁', preference: 'military'  },
    flute:       { id: 'flute',       name: 'Flute',       baseBonus: 0.15, icon: '🪈', preference: 'rural'     },
    lute:        { id: 'lute',        name: 'Lute',        baseBonus: 0.20, icon: '🪕', preference: 'common'    },
    hurdy_gurdy: { id: 'hurdy_gurdy', name: 'Hurdy-Gurdy', baseBonus: 0.25, icon: '🎶', preference: 'port'      },
    harp:        { id: 'harp',        name: 'Harp',        baseBonus: 0.30, icon: '🎵', preference: 'royal'     },
};
const INSTRUMENT_IDS = ['drum', 'flute', 'lute', 'hurdy_gurdy', 'harp'];
const INSTRUMENT_SKILL_TIERS = [
    { name: 'Novice',    min: 0,  multiplier: 1.0 },
    { name: 'Competent', min: 26, multiplier: 1.5 },
    { name: 'Expert',    min: 51, multiplier: 2.0 },
    { name: 'Master',    min: 76, multiplier: 3.0 },
];
const INSTRUMENT_PREFERENCE_BONUS = 0.50;
const INSTRUMENT_FATIGUE_THRESHOLD = 50;

// Attach standalone constants to CONFIG for uniform access
CONFIG.SKILLS = SKILLS;
CONFIG.ACHIEVEMENTS = ACHIEVEMENTS;
CONFIG.NOTIFICATION_CATEGORIES = {
    my_actions: 'My Actions',
    my_business: 'My Business',
    my_kingdom: 'My Kingdom',
    local_town: 'Local Town',
    foreign_kingdoms: 'Foreign Kingdoms',
    world_economy: 'World Economy',
    military: 'Military',
    npc_activity: 'NPC Activity',
    illness: 'Illness',
    travel_events: 'Travel Events',
    combat: 'Combat',
    tracked: 'Tracked Merchants',
};
