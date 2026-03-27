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
    FRONTLINE_HAPPINESS_DRAIN: 1,         // per day

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
    MARRIAGE_MIN_AGE: 16,
    CHILD_PROBABILITY: 0.03,    // ~3%/day → avg ~33 days to conceive (user wants 30-100 day range)
    PREGNANCY_DURATION: 270,    // ~9 months in game days (360 days/year)
    MAX_CHILDREN: 8,            // Cap on total children per lifetime
    DEATH_AGE_MIN: 55,
    DEATH_AGE_MAX: 80,
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
    DISASTER_PLAGUE_CHANCE: 0.01,
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
    CARAVAN_BASE_SPEED: 30,
    CARAVAN_ROAD_MULTIPLIER: [0, 1.0, 1.5, 2.0],
    BANDIT_ATTACK_CHANCE: 0.03,
    GUARD_EFFECTIVENESS: 0.2,
    CARAVAN_RECURRING_MAINTENANCE_PER_TRIP: 15, // gold per recurring trip (guard re-hire, feed, repairs)
    CARAVAN_FORTIFIED_WAGON_COST: 150,          // one-time cost for +30% defense
    CARAVAN_DECOY_COST: 50,                     // per-trip cost, -40% attack chance
    CARAVAN_ARMED_ESCORT_COST: 80,              // per-trip cost, +50% guard effectiveness
    CARAVAN_BLOCKED_RESCUE_COST: 100,           // gold to rescue a blocked caravan
    CARAVAN_MAX_BUY_BUDGET_PER_GOOD: 500,       // default max gold for auto-buy per good
    BACKGROUND_TRADE_RATE: 0.005,               // 0.5% price convergence per tick between connected towns

    // Notoriety
    NOTORIETY_WEAPON_SALE: 5,
    NOTORIETY_ARMOR_SALE: 3,
    NOTORIETY_DECAY_PER_DAY: 0.1,
    NOTORIETY_DANGER_THRESHOLD: 50,
    ASSASSINATION_CHANCE_BASE: 0.001,

    // Naval / Sea travel
    SEA_ROUTE_MAX_DISTANCE: 3000,
    SEA_ROUTE_MIN_WATER_FRACTION: 0.95,    // Sea routes must be >=95% water
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
        rowboat:       { name: 'Rowboat',           laborCost: 20,   capacity: 10,   speed: 0.8,  passengers: 2,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 0,  durabilityYears: 2,
                         materials: { wood: 5, rope: 2 },                                                          icon: '🚣', description: 'A simple rowboat. Slow but cheap. Coastal travel only.' },
        fishing_boat:  { name: 'Fishing Boat',      laborCost: 40,   capacity: 25,   speed: 1.0,  passengers: 3,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 1,  durabilityYears: 3, canFish: true,
                         materials: { wood: 10, rope: 4, iron: 1 },                                                icon: '🎣', description: 'A sturdy fishing vessel. Can catch fish while docked.' },
        sloop:         { name: 'Sloop',             laborCost: 80,   capacity: 40,   speed: 1.8,  passengers: 5,  restBonus: 0,   maxAddons: 0, cannons: 0, defense: 2,  durabilityYears: 3,
                         materials: { planks: 12, rope: 6, cloth: 4, iron: 2 },                                    icon: '⛵', description: 'Fast and nimble. Excellent for quick trade runs.' },
        cog:           { name: 'Trading Cog',       laborCost: 120,  capacity: 80,   speed: 1.3,  passengers: 8,  restBonus: 0.3, maxAddons: 1, cannons: 0, defense: 4,  durabilityYears: 4,
                         materials: { planks: 20, rope: 8, cloth: 6, iron: 4 },                                    icon: '🚢', description: 'The workhorse merchant vessel. Reliable and spacious.' },
        caravel:       { name: 'Caravel',           laborCost: 200,  capacity: 120,  speed: 1.6,  passengers: 12, restBonus: 0.4, maxAddons: 2, cannons: 0, defense: 5,  durabilityYears: 4,
                         materials: { planks: 30, rope: 12, cloth: 10, iron: 6 },                                  icon: '🚢', description: 'Versatile explorer vessel. Fast with good cargo space.' },
        brigantine:    { name: 'Brigantine',        laborCost: 250,  capacity: 100,  speed: 1.7,  passengers: 15, restBonus: 0.4, maxAddons: 2, cannons: 1, defense: 8,  durabilityYears: 4,
                         materials: { planks: 35, rope: 15, cloth: 12, iron: 8 },                                  icon: '⛵', description: 'Fast and armed. One cannon for defense. A smuggler\'s favorite.' },
        carrack:       { name: 'Carrack',           laborCost: 400,  capacity: 200,  speed: 1.2,  passengers: 20, restBonus: 0.5, maxAddons: 3, cannons: 2, defense: 12, durabilityYears: 5,
                         materials: { planks: 50, rope: 18, cloth: 14, iron: 10 },                                 icon: '🚢', description: 'Heavy merchant ship. Two cannons and room for crew quarters.' },
        fluyt:         { name: 'Merchant Fluyt',    laborCost: 500,  capacity: 280,  speed: 1.1,  passengers: 25, restBonus: 0.5, maxAddons: 3, cannons: 1, defense: 8,  durabilityYears: 5,
                         materials: { planks: 60, rope: 20, cloth: 16, iron: 12 },                                 icon: '🚢', description: 'Maximum cargo efficiency. The merchant\'s dream ship.' },
        galleon:       { name: 'Merchant Galleon',  laborCost: 800,  capacity: 350,  speed: 1.0,  passengers: 30, restBonus: 0.6, maxAddons: 4, cannons: 4, defense: 18, durabilityYears: 6,
                         materials: { planks: 80, rope: 25, cloth: 20, iron: 15 },                                 icon: '🚢', description: 'Massive trader. Four cannons, crew quarters, workshop potential.' },
        man_o_war:     { name: 'Man-o\'-War',      laborCost: 1500, capacity: 250,  speed: 0.9,  passengers: 40, restBonus: 0.7, maxAddons: 5, cannons: 8, defense: 30, durabilityYears: 7,
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
          maxWorkers: 4, maxBuildings: 2, maxLand: 1,
          goldReq: 1000, repReq: 40, extraReq: 'Lived 90+ days, no criminal record',
          fee: 500, residencyDays: 90,
          taxDiscount: 0.05,
          abilities: ['own_basic_buildings', 'petition', 'trade_licenses', 'vote_town'],
          description: 'A recognized citizen. Can own farms and workshops, petition the king, and get trade licenses.' },
        { id: 'burgher', name: 'Burgher', index: 2, icon: '⚖️',
          maxWorkers: 15, maxBuildings: 8, maxLand: 3,
          goldReq: 5000, repReq: 55, extraReq: '1 year trading, 1+ building, 50+ trades',
          fee: 1000, minTrades: 50, minBuildings: 1, tradingDays: 360,
          taxDiscount: 0.10,
          abilities: ['own_processing_buildings', 'buy_luxury', 'hire_caravan_guards', 'supply_chains'],
          description: 'An established merchant. Can own processing buildings, buy luxury goods, and run supply chains.' },
        { id: 'guildmaster', name: 'Guildmaster', index: 3, icon: '🔨',
          maxWorkers: 35, maxBuildings: 25, maxLand: 10,
          goldReq: 20000, repReq: 75, extraReq: '3 production buildings, 8+ workers, buildings in 2+ towns',
          fee: 5000, minProductionBuildings: 3, minWorkers: 8, minTownsWithBuildings: 2,
          taxDiscount: 0.15,
          productionBonus: 0.10,
          abilities: ['build_toll_roads', 'trade_weapons', 'hire_petitioners', 'production_bonus'],
          description: 'Master of commerce. Can build toll roads, trade weapons, and hire petitioners. +10% production output.' },
        { id: 'minor_noble', name: 'Minor Noble', index: 4, icon: '👑',
          maxWorkers: 70, maxBuildings: 50, maxLand: 20,
          goldReq: 75000, repReq: 88, extraReq: 'Noble marriage OR king decree OR 3 petitions, 5 NPC endorsements, property in 3+ towns',
          fee: 15000, minPetitionsCompleted: 3, minEndorsements: 5, minEndorsementLevel: 60, minTownsWithProperty: 3,
          taxDiscount: 0.20,
          signatureBonus: 0.15,
          abilities: ['influence_king', 'production_permits', 'attend_court', 'noble_marriage', 'signature_bonus'],
          description: 'Entered the aristocracy. Can influence the king directly, get production permits, and attend court. +15% signature success.' },
        { id: 'lord', name: 'Lord', index: 5, icon: '🏰',
          maxWorkers: 200, maxBuildings: 9999, maxLand: 9999,
          goldReq: 250000, repReq: 95, extraReq: 'Property in 4+ towns, 40+ workers, 2+ infrastructure projects, 2+ years as Minor Noble',
          fee: 50000, minTownsWithProperty: 4, minTotalWorkers: 40, minInfrastructure: 2, minYearsAtPrevRank: 2,
          taxDiscount: 0.25,
          abilities: ['build_anywhere', 'revitalize_towns', 'raise_militia', 'local_trade_policies', 'crime_immunity'],
          description: 'Landed elite. Can build freely, revitalize towns, and raise private militia. Near-immune to petty crime accusations.' },
        { id: 'royal_advisor', name: 'Royal Advisor', index: 6, icon: '📜',
          maxWorkers: 9999, maxBuildings: 9999, maxLand: 9999,
          goldReq: 600000, repReq: 100, extraReq: 'Lord 3+ years, war supply, 5+ petitions, 3+ noble friends',
          fee: 100000, minYearsAtPrevRank: 3, minPetitionsCompleted: 5, minNobleFriends: 3, minNobleFriendLevel: 80,
          taxDiscount: 0.30,
          petitionBonus: 0.25,
          abilities: ['propose_laws', 'declare_emergencies', 'override_officials', 'petition_bonus', 'king_consults'],
          description: 'The king\'s right hand. Can propose laws, petition success +25%. The king consults you on decisions.' },
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
    SMUGGLING_REP_PENALTY: 15,
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
    LICENSE_FEE: 500,
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
    BRIDGE_DESTROY_COST: 500,              // Gold cost for player to destroy a bridge
    BRIDGE_REBUILD_COST: 1000,             // Gold cost to rebuild a destroyed bridge
    BRIDGE_REBUILD_DAYS: 30,               // Days to rebuild a bridge

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
    TRANSFER_WORKER_DELIVERY_DAYS: 2,      // Days workers spend delivering goods (no production)
    TRANSFER_STORAGE_THRESHOLD: 30,        // Storage amount that triggers worker delivery
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
    PETITION_BASE_CHANCE: 0.15,         // Base 15% chance (much lower than direct influence)
    PETITION_PER_PCT_BONUS: 0.025,     // +2.5% chance per 1% of population signed
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
        outpost:      { label: 'Outpost',      minPop: 0,   maxBuildingSlots: 4,  guardMultiplier: 0.0, relationshipGainMod: 3.0, icon: '⛺' },
        village:      { label: 'Village',      minPop: 0,   maxBuildingSlots: 6,  guardMultiplier: 0.5, relationshipGainMod: 2.0, icon: '🏘️' },
        town:         { label: 'Town',         minPop: 60,  maxBuildingSlots: 14, guardMultiplier: 1.0, relationshipGainMod: 1.0, icon: '🏠' },
        city:         { label: 'City',         minPop: 150, maxBuildingSlots: 24, guardMultiplier: 1.5, relationshipGainMod: 0.5, icon: '🏙️' },
        capital_city: { label: 'Capital City', minPop: 300, maxBuildingSlots: 35, guardMultiplier: 2.0, relationshipGainMod: 0.3, icon: '👑' },
    },
    TOWN_CATEGORY_CHECK_INTERVAL: 30,
    TOWN_CATEGORY_UPGRADE_HOLD_DAYS: 30,

    // Wilderness Outpost System
    OUTPOST_CONFIG: {
        foundingCost: 500,              // gold to establish an outpost
        foundingMaterials: { wood: 30, stone: 10 },  // materials needed
        dailyMaintenanceCost: 3,        // gold per day (no shared infrastructure)
        workerWagePerDay: 2,            // gold per hired worker per day
        maxHiredWorkers: 8,             // max workers at an outpost
        theftChancePerDay: 0.06,        // 6% daily chance of theft without security
        damageChancePerDay: 0.03,       // 3% daily chance of building damage (weather, animals)
        securityPerGuard: 0.015,        // each guard reduces theft by 1.5%
        maxGuards: 4,                   // max hired guards
        guardCostPerDay: 5,             // gold per guard per day
        wallTheftReduction: { 0: 0, 1: 0.02, 2: 0.035, 3: 0.05 },
        annexationMinPop: 15,           // kingdom annexation requires 15+ people nearby/attracted
        annexationCheckInterval: 90,    // kingdoms check for annexation every 90 days
        eliteMerchantFoundChance: 0.003, // 0.3% chance per tick for rich elite merchants
        npcFoundChanceRefugee: 0.01,    // 1% during refugee crises
        maxDistanceFromRoad: 3,         // outpost must be within 3 tiles of a road
        abandonDaysNoMaintenance: 30,   // outpost abandoned after 30 days of no upkeep
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
        'used':      { name: 'Used',      icon: '🔧', efficiency: 0.90, minAge: 365 },
        'breaking':  { name: 'Breaking',  icon: '⚠️', efficiency: 0.50, minAge: 730 },
        'destroyed': { name: 'Destroyed', icon: '🚫', efficiency: 0.0,  minAge: 1095 },
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

    // Player-as-King
    ADVISE_KING_POLITICAL_CAPITAL_MAX: 3,
    ADVISE_KING_CAPITAL_REGEN_DAYS: 90,

    // ── Housing System ──
    HOUSING_TYPES: [
        // Bedroll / Inn — no construction, purchased or rented
        { id: 'bedroll', name: 'Bedroll (Outdoors)', icon: '🛏️', cost: 5, storage: 0, security: 0, restBonus: 0, maxOccupants: 1, comfort: 0, diseaseReduction: 0, description: 'Sleep under the stars. No protection.' },
        { id: 'inn_room', name: 'Inn Room', icon: '🏨', cost: 0, dailyRent: 3, storage: 0, security: 0.2, restBonus: 0.3, maxOccupants: 2, comfort: 20, diseaseReduction: 0.1, description: 'A warm bed and a roof. Pay per night.' },
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
        { id: 'apartment', name: 'Apartment', icon: '🏢', laborCost: 80, storage: 30, security: 0.4, restBonus: 0.5, maxOccupants: 3, comfort: 35, diseaseReduction: 0.30, minTownCategory: 'city',
          materials: { planks: 8, bricks: 8, stone: 6, iron: 1 },
          description: 'Compact city living. No land needed.' },
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
        { id: 'castle', name: 'Castle', icon: '🏰', laborCost: 5000, storage: 800, security: 1.0, restBonus: 1.0, maxOccupants: 40, comfort: 100, diseaseReduction: 0.80, minTownCategory: 'capital_city', repBonus: 50, hasWorkshop: true, hasStables: true, hasGarden: true, defenseBonus: true, minRank: 5, politicalInfluence: 5,
          materials: { stone: 200, bricks: 80, iron: 50, planks: 60, cloth: 15 },
          description: 'The ultimate residence. All features. Grants political influence. Capital only. Requires Lord rank.' },
        { id: 'caravan_wagon', name: 'Caravan Wagon', icon: '🛒', laborCost: 40, storage: 60, security: 0.15, restBonus: 0.3, maxOccupants: 2, comfort: 15, diseaseReduction: 0.05, portable: true, requiresHorse: true,
          materials: { planks: 8, wood: 6, cloth: 3, rope: 2, iron: 1 },
          description: 'Mobile housing! Rest while traveling. Requires horse. Storage 60.' },
    ],
    HOUSING_LABOR_MULTIPLIER: { village: 0.7, town: 1.0, city: 1.3, capital_city: 1.8 },
    HOUSING_SELL_RATIO: 0.70,
    HOUSING_UPGRADE_DISCOUNT: 0.60, // when upgrading in-place, recover 60% of old materials value

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
    LAND_COST_BASE: 500,
    LAND_COST_MULTIPLIER: { village: 0.5, town: 1.0, city: 2.0, capital_city: 4.0 },
    LAND_SELL_RATIO: 0.80,

    // ── Wartime Travel Danger ──
    WARTIME_AMBUSH_BASE_CHANCE: 0.25,
    WARTIME_AMBUSH_MILITARY_GOODS_BONUS: 0.15,
    WARTIME_AMBUSH_ENEMY_CITIZEN_BONUS: 0.10,
    WARTIME_ESCORT_COST_PER_DAY: 20,
    WARTIME_ESCORT_REDUCTION: 0.15,
    WARTIME_FRONTLINE_DISTANCE: 500,

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

    // --- Camping & Travel Supplies ---
    BEDROLL:          { id: 'bedroll',          name: 'Bedroll',         category: 'supplies',  basePrice: 8,   icon: '🛏️', weight: 3 },
    TENT:             { id: 'tent',             name: 'Tent',            category: 'supplies',  basePrice: 25,  icon: '⛺', weight: 8 },
    CAMPING_KIT:      { id: 'camping_kit',      name: 'Camping Kit',     category: 'supplies',  basePrice: 45,  icon: '🏕️', weight: 12 },
    WATERSKIN:        { id: 'waterskin',        name: 'Waterskin',       category: 'supplies',  basePrice: 5,   icon: '🫗', weight: 1 },
};

// ============================================================
// Building Types & Production Recipes
// ============================================================

const BUILDING_TYPES = {
    WHEAT_FARM:    { id: 'wheat_farm',    name: 'Wheat Farm',    cost: 200,  workers: 3, produces: 'wheat',    consumes: {},                       rate: 8, category: 'farm',       materials: { wood: 10, stone: 5 } },
    CATTLE_RANCH:  { id: 'cattle_ranch',  name: 'Cattle Ranch',  cost: 350,  workers: 3, produces: 'meat',     consumes: { wheat: 2 },             rate: 4, category: 'farm',       materials: { wood: 15, planks: 5 } },
    SHEEP_FARM:    { id: 'sheep_farm',    name: 'Sheep Farm',    cost: 250,  workers: 2, produces: 'wool',     consumes: { wheat: 1 },             rate: 5, category: 'farm',       materials: { wood: 10, stone: 3 } },
    CHICKEN_FARM:  { id: 'chicken_farm',  name: 'Chicken Farm',  cost: 150,  workers: 2, produces: 'eggs',     consumes: { wheat: 1 },             rate: 10, category: 'farm',      materials: { wood: 8 } },
    IRON_MINE:     { id: 'iron_mine',     name: 'Iron Mine',     cost: 500,  workers: 5, produces: 'iron_ore', consumes: {},                       rate: 5, category: 'mine',       materials: { wood: 20, stone: 15, tools: 3 } },
    GOLD_MINE:     { id: 'gold_mine',     name: 'Gold Mine',     cost: 800,  workers: 5, produces: 'gold_ore', consumes: {},                       rate: 2, category: 'mine',       materials: { wood: 25, stone: 20, tools: 5, iron: 3 } },
    LUMBER_CAMP:   { id: 'lumber_camp',   name: 'Lumber Camp',   cost: 200,  workers: 4, produces: 'wood',     consumes: {},                       rate: 7, category: 'harvest',    materials: { stone: 5, tools: 2 } },
    QUARRY:        { id: 'quarry',        name: 'Quarry',        cost: 400,  workers: 4, produces: 'stone',    consumes: {},                       rate: 4, category: 'mine',       materials: { wood: 15, tools: 3 } },
    VINEYARD:      { id: 'vineyard',      name: 'Vineyard',      cost: 400,  workers: 3, produces: 'grapes',   consumes: {},                       rate: 4, category: 'farm',       materials: { wood: 12, stone: 5 } },
    HORSE_RANCH:   { id: 'horse_ranch',   name: 'Horse Ranch',   cost: 600,  workers: 3, produces: 'horses',   consumes: { wheat: 3 },             rate: 2, category: 'farm',       materials: { wood: 20, planks: 8, stone: 5 } },
    FLOUR_MILL:    { id: 'flour_mill',    name: 'Flour Mill',    cost: 300,  workers: 2, produces: 'flour',    consumes: { wheat: 3 },             rate: 6, category: 'processing', materials: { wood: 12, stone: 10 } },
    SMELTER:       { id: 'smelter',       name: 'Smelter',       cost: 400,  workers: 3, produces: 'iron',     consumes: { iron_ore: 2, wood: 1 }, rate: 4, category: 'processing', materials: { stone: 20, bricks: 5, iron: 2 } },
    SAWMILL:       { id: 'sawmill',       name: 'Sawmill',       cost: 250,  workers: 2, produces: 'planks',   consumes: { wood: 2 },              rate: 5, category: 'processing', materials: { wood: 10, stone: 5, iron: 1 } },
    WEAVER:        { id: 'weaver',        name: 'Weaver',        cost: 300,  workers: 2, produces: 'cloth',    consumes: { wool: 2 },              rate: 5, category: 'processing', materials: { wood: 10, planks: 5 }, canProduce: ['cloth', 'rope'],
        availableProducts: {
            cloth: { produces: 'cloth', consumes: { wool: 2 },  rate: 5 },
            rope:  { produces: 'rope',  consumes: { hemp: 3 },  rate: 5 },
        },
    },
    TANNER:        { id: 'tanner',        name: 'Tanner',        cost: 300,  workers: 2, produces: 'leather',  consumes: { hide: 2 },              rate: 4, category: 'processing', materials: { wood: 10, stone: 5 } },
    BAKERY:        { id: 'bakery',        name: 'Bakery',        cost: 350,  workers: 2, produces: 'bread',    consumes: { flour: 4 },             rate: 24, category: 'finished',  materials: { wood: 8, stone: 10, bricks: 3 } },
    BUTCHER:       { id: 'butcher',       name: 'Butcher',       cost: 200,  workers: 1, produces: 'poultry',  consumes: { livestock_chicken: 2 }, rate: 4, category: 'finished',   materials: { wood: 8, stone: 5 } },
    TAILOR:        { id: 'tailor',        name: 'Tailor',        cost: 400,  workers: 2, produces: 'clothes',  consumes: { cloth: 2, leather: 1 }, rate: 3, category: 'finished',   materials: { wood: 10, planks: 5 }, canProduce: ['clothes', 'saddles'],
        availableProducts: {
            clothes: { produces: 'clothes', consumes: { cloth: 2, leather: 1 }, rate: 3 },
            saddles: { produces: 'saddles', consumes: { leather: 2, wood: 1 },  rate: 3 },
        },
    },
    TOOLSMITH:     { id: 'toolsmith',     name: 'Toolsmith',     cost: 400,  workers: 2, produces: 'tools',    consumes: { iron: 1, wood: 1 },     rate: 3, category: 'finished',   materials: { stone: 10, iron: 3 } },
    WINERY:        { id: 'winery',        name: 'Winery',        cost: 500,  workers: 2, produces: 'wine',     consumes: { grapes: 3 },            rate: 3, category: 'finished',   materials: { wood: 15, stone: 10, planks: 5 } },
    JEWELER:       { id: 'jeweler',       name: 'Jeweler',       cost: 600,  workers: 1, produces: 'jewelry',  consumes: { gold_ore: 1 },          rate: 2, category: 'finished',   materials: { stone: 10, planks: 5, iron: 2 }, canProduce: ['jewelry', 'pearl_jewelry'],
        availableProducts: {
            jewelry:       { produces: 'jewelry',       consumes: { gold_ore: 1 },          rate: 2 },
            pearl_jewelry: { produces: 'pearl_jewelry', consumes: { gold_ore: 1, pearls: 1 }, rate: 2 },
        },
    },
    BLACKSMITH:    { id: 'blacksmith',    name: 'Blacksmith',    cost: 600,  workers: 3, produces: 'swords',   consumes: { iron: 2, wood: 1 },     rate: 3, category: 'military',   materials: { stone: 20, iron: 5, bricks: 10 }, canProduce: ['swords', 'tools', 'iron', 'demolition_tools'],
        availableProducts: {
            swords:           { produces: 'swords',           consumes: { iron: 2, wood: 1 },              rate: 3 },
            tools:            { produces: 'tools',            consumes: { iron: 1, wood: 1 },              rate: 3 },
            iron:             { produces: 'iron',             consumes: { iron_ore: 2, wood: 1 },          rate: 4 },
            demolition_tools: { produces: 'demolition_tools', consumes: { iron: 3, rope: 2, wood: 3 },    rate: 1 },
        },
    },
    ARMORER:       { id: 'armorer',       name: 'Armorer',       cost: 700,  workers: 3, produces: 'armor',    consumes: { iron: 3, leather: 2 },  rate: 2, category: 'military',   materials: { stone: 20, iron: 8, bricks: 10 } },
    WAREHOUSE:     { id: 'warehouse',     name: 'Warehouse',     cost: 500,  workers: 1, produces: null,       consumes: {},                       rate: 0, category: 'storage',    storage: 800, materials: { wood: 20, stone: 10, planks: 10, bricks: 5 } },
    MARKET_STALL:  { id: 'market_stall',  name: 'Market Stall',  cost: 150,  workers: 1, produces: null,       consumes: {},                       rate: 0, category: 'trade',      salesBonus: 0.1, materials: { wood: 8, planks: 3 } },
    DOCK:          { id: 'dock',          name: 'Dock',          cost: 400,  workers: 2, produces: null,       consumes: {},                       rate: 0, category: 'port',       portBonus: true, materials: { wood: 25, planks: 10, rope: 5 } },
    FISHERY:       { id: 'fishery',       name: 'Fishery',       cost: 250,  workers: 3, produces: 'fish',     consumes: {},                       rate: 8, category: 'port',       materials: { wood: 12, rope: 3 } },
    SALT_WORKS:    { id: 'salt_works',    name: 'Salt Works',    cost: 300,  workers: 2, produces: 'salt',     consumes: {},                       rate: 5, category: 'port',       materials: { wood: 10, stone: 10, bricks: 3 } },
    // --- New buildings ---
    FLETCHER:      { id: 'fletcher',      name: 'Fletcher',      cost: 400,  workers: 2, produces: 'bows',           consumes: { wood: 2, hemp: 1 },        rate: 3, category: 'military',   materials: { wood: 12, stone: 8 } },
    ARROW_MAKER:   { id: 'arrow_maker',   name: 'Arrow Maker',   cost: 250,  workers: 2, produces: 'arrows',         consumes: { wood: 1, iron: 1 },        rate: 8, category: 'military',   materials: { wood: 10, stone: 5 } },
    CARPENTER:     { id: 'carpenter',     name: 'Carpenter',     cost: 450,  workers: 2, produces: 'furniture',       consumes: { planks: 3 },               rate: 2, category: 'finished',   materials: { wood: 15, planks: 8, stone: 5 }, canProduce: ['furniture', 'planks'],
        availableProducts: {
            furniture: { produces: 'furniture', consumes: { planks: 3 },  rate: 2 },
            planks:    { produces: 'planks',    consumes: { wood: 2 },    rate: 5 },
        },
    },
    BRICK_KILN:    { id: 'brick_kiln',    name: 'Brick Kiln',    cost: 300,  workers: 2, produces: 'bricks',         consumes: { clay: 3, wood: 1 },        rate: 5, category: 'processing', materials: { stone: 15, wood: 10 } },
    SADDLER:       { id: 'saddler',       name: 'Saddler',       cost: 400,  workers: 2, produces: 'saddles',        consumes: { leather: 2, wood: 1 },     rate: 3, category: 'finished',   materials: { wood: 10, planks: 5, stone: 5 } },
    ROPE_MAKER:    { id: 'rope_maker',    name: 'Rope Maker',    cost: 200,  workers: 1, produces: 'rope',           consumes: { hemp: 3 },                 rate: 5, category: 'processing', materials: { wood: 8 } },
    HEMP_FARM:     { id: 'hemp_farm',     name: 'Hemp Farm',     cost: 180,  workers: 2, produces: 'hemp',           consumes: {},                          rate: 7, category: 'farm',       materials: { wood: 8, stone: 3 } },
    CLAY_PIT:      { id: 'clay_pit',      name: 'Clay Pit',      cost: 200,  workers: 3, produces: 'clay',           consumes: {},                          rate: 6, category: 'mine',       materials: { wood: 8, tools: 2 } },
    SMOKEHOUSE:    { id: 'smokehouse',    name: 'Smokehouse',    cost: 300,  workers: 2, produces: 'preserved_food', consumes: { meat: 2, salt: 1 },        rate: 4, category: 'processing', materials: { wood: 12, stone: 8, bricks: 3 } },
    PIG_FARM:      { id: 'pig_farm',      name: 'Pig Farm',      cost: 200,  workers: 2, produces: 'meat',           consumes: { wheat: 2 },                rate: 5, category: 'farm',       materials: { wood: 10, stone: 3 } },
    PASTURE:       { id: 'pasture',       name: 'Pasture',       cost: 100,  workers: 1, produces: null,             consumes: { wheat: 1 },                rate: 0, category: 'farm',       livestockCapacity: 10, materials: { wood: 5 } },
    WATCHTOWER:    { id: 'watchtower',    name: 'Watchtower',    cost: 500,  workers: 2, produces: null,             consumes: {},                          rate: 0, category: 'military',   archerBonus: 0.5, materials: { stone: 30, wood: 15, bricks: 15 } },
    BARRACKS:      { id: 'barracks',      name: 'Barracks',      cost: 600,  workers: 3, produces: null,             consumes: {},                          rate: 0, category: 'military',   recruitBonus: 2,  materials: { stone: 40, wood: 30, bricks: 10 } },
    ARMORY:        { id: 'armory',        name: 'Armory',        cost: 700,  workers: 2, produces: null,             consumes: {},                          rate: 0, category: 'military',   storageBonus: 50, materials: { stone: 50, iron: 20, bricks: 15 } },
    // --- Kingdom military buildings ---
    CASTLE:           { id: 'castle',           name: 'Castle',           cost: 3000, workers: 10, produces: null, consumes: {}, rate: 0, category: 'military',  defenseBonus: 0.50, capitalOnly: true, materials: { stone: 200, iron: 50 } },
    TRAINING_GROUNDS: { id: 'training_grounds', name: 'Training Grounds', cost: 800,  workers: 4,  produces: null, consumes: {}, rate: 0, category: 'military',  combatBonus: 0.30, materials: { wood: 100, iron: 20 } },
    SIEGE_WORKSHOP:   { id: 'siege_workshop',   name: 'Siege Workshop',   cost: 1000, workers: 5,  produces: null, consumes: {}, rate: 0, category: 'military',  siegeBonus: 1.0, materials: { wood: 150, iron: 80 } },
    STABLES:          { id: 'stables',          name: 'Stables',          cost: 600,  workers: 3,  produces: null, consumes: {}, rate: 0, category: 'military',  cavalryCapacity: 20, materials: { wood: 120, leather: 30 } },
    // --- Kingdom civic/economic buildings ---
    HOSPITAL:         { id: 'hospital',         name: 'Hospital',         cost: 1200, workers: 5,  produces: null, consumes: {}, rate: 0, category: 'civic',     plagueReduction: 0.50, happinessBonus: 5, materials: { wood: 80, cloth: 30 } },
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
    STRING_MAKER:  { id: 'string_maker',  name: 'String Maker',  cost: 150,  workers: 1, produces: 'gut_string',    consumes: { hide: 2 },                 rate: 3, category: 'processing', materials: { wood: 5, stone: 3 } },
    DRUM_MAKER:    { id: 'drum_maker',    name: 'Drum Maker',    cost: 200,  workers: 2, produces: 'drum',          consumes: { wood: 1, leather: 1 },     rate: 3, category: 'finished',   materials: { wood: 8, stone: 3 } },
    INSTRUMENT_WORKSHOP: { id: 'instrument_workshop', name: 'Instrument Workshop', cost: 500, workers: 2,
        produces: 'lute',
        consumes: { wood: 2, gut_string: 1 },
        rate: 2, category: 'finished',
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
    SILK_WEAVER:      { id: 'silk_weaver',      name: 'Silk Weaver',     cost: 600,  workers: 2, produces: 'silk',         consumes: { wool: 2 },                  rate: 2, category: 'luxury',     materials: { planks: 10, cloth: 5 }, icon: '🧣' },
    PERFUMERY:        { id: 'perfumery',        name: 'Perfumery',       cost: 500,  workers: 1, produces: 'perfume',      consumes: { grapes: 2, hemp: 1 },       rate: 1, category: 'luxury',     materials: { planks: 8, bricks: 3 }, icon: '🌸' },
    FINE_TAILOR:      { id: 'fine_tailor',      name: 'Fine Tailor',     cost: 700,  workers: 2, produces: 'fine_clothes', consumes: { silk: 1, cloth: 2 },        rate: 1, category: 'luxury',     materials: { planks: 12, cloth: 5 }, icon: '👗' },
    TAPESTRY_LOOM:    { id: 'tapestry_loom',    name: 'Tapestry Loom',   cost: 800,  workers: 3, produces: 'tapestry',    consumes: { silk: 2, cloth: 3 },        rate: 1, category: 'luxury',     materials: { planks: 15, iron: 3 }, icon: '🖼️' },
    GOLDSMITH:        { id: 'goldsmith',        name: 'Goldsmith',       cost: 900,  workers: 2, produces: 'gold_goblet', consumes: { gold_ore: 2 },              rate: 1, category: 'luxury',     materials: { planks: 10, stone: 5, iron: 3 }, icon: '🏆' },
    // --- Tree Plantation ---
    TREE_PLANTATION:  { id: 'tree_plantation',  name: 'Tree Plantation', cost: 200,  workers: 2, produces: null,           consumes: {},                           rate: 0, category: 'harvest',    materials: { planks: 5 }, icon: '🌲', description: 'Replants trees, regenerating wood deposits (+5/day)' },
    // --- Warehouse tiers ---
    WAREHOUSE_SMALL:  { id: 'warehouse_small',  name: 'Small Warehouse',  cost: 200,  workers: 1, produces: null,          consumes: {},                           rate: 0, category: 'storage',    storage: 400, materials: { planks: 8, bricks: 3 }, icon: '📦', description: 'Storage for 400 weight units' },
    WAREHOUSE_LARGE:  { id: 'warehouse_large',  name: 'Large Warehouse',  cost: 1200, workers: 3, produces: null,          consumes: {},                           rate: 0, category: 'storage',    storage: 1200, materials: { planks: 30, bricks: 15, iron: 5, stone: 8 }, icon: '🏭', description: 'Massive storage for 1200 weight units' },
    TRANSPORT_GUILD:  { id: 'transport_guild',  name: 'Transport Guild Hall', cost: 800, workers: 4, produces: null,       consumes: {},                           rate: 0, category: 'trade',      materials: { wood: 25, stone: 15, planks: 10 }, icon: '🚚', description: 'Transporters handle goods delivery between your buildings automatically.' },
    // --- Goods audit buildings ---
    PEARL_DIVER:      { id: 'pearl_diver',      name: 'Pearl Diver',     cost: 350,  workers: 2, produces: 'pearls',         consumes: {},                          rate: 2, category: 'harvest',    portOnly: true, materials: { wood: 12, rope: 3 } },
    APOTHECARY:       { id: 'apothecary',       name: 'Apothecary',      cost: 400,  workers: 1, produces: 'poison',         consumes: { hemp: 2 },                 rate: 1, category: 'finished',   materials: { wood: 8, stone: 5 }, canProduce: ['poison', 'blasting_powder'],
        availableProducts: {
            poison:          { produces: 'poison',          consumes: { hemp: 2 },              rate: 1 },
            blasting_powder: { produces: 'blasting_powder', consumes: { salt: 4, hemp: 2 },     rate: 2 },
        },
    },
    HUNTING_LODGE:    { id: 'hunting_lodge',    name: 'Hunting Lodge',   cost: 250,  workers: 2, produces: 'hide',           consumes: {},                          rate: 4, category: 'harvest',    villageOnly: true, materials: { wood: 15 } },
    // --- Water & Beverage Buildings ---
    WELL:             { id: 'well',             name: 'Well',            cost: 80,   workers: 0, produces: 'water',          consumes: {},                          rate: 15, category: 'civic',     materials: { stone: 10, wood: 5 }, icon: '🪣', description: 'Draws fresh water. Free water for townsfolk.' },
    CISTERN:          { id: 'cistern',          name: 'Cistern',         cost: 200,  workers: 0, produces: 'water',          consumes: {},                          rate: 8,  category: 'civic',     materials: { stone: 15, bricks: 10, clay: 5 }, icon: '🏛️', description: 'Stores rainwater. Supplements well output.' },
    BREWERY:          { id: 'brewery',          name: 'Brewery',         cost: 400,  workers: 3, produces: 'ale',            consumes: { wheat: 3, water: 2 },      rate: 6,  category: 'finished',  materials: { wood: 15, stone: 10, bricks: 5 }, icon: '🍺', description: 'Brews ale from wheat and water.',
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
    APIARY:           { id: 'apiary',           name: 'Apiary',          cost: 150,  workers: 1, produces: 'honey',          consumes: {},                          rate: 4,  category: 'farm',      materials: { wood: 8, planks: 3 }, icon: '🐝', description: 'Keeps bees for honey production.' },
    HERBALIST_HUT:    { id: 'herbalist_hut',    name: 'Herbalist Hut',   cost: 200,  workers: 1, produces: 'herbal_tea',     consumes: { hemp: 1, water: 1 },       rate: 3,  category: 'finished',  materials: { wood: 10, clay: 3 }, icon: '🌿', description: 'Brews herbal teas and medicinal infusions.' },
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
    CLINIC:           { id: 'clinic',           name: 'Clinic',          cost: 500,  workers: 2, produces: null,             consumes: {},                          rate: 0,  category: 'service',   plagueReduction: 0.20, happinessBonus: 2, materials: { planks: 10, stone: 10, bricks: 5 }, icon: '🏥', description: 'Treats sick and injured NPCs. Stock with medicine. Earns gold per patient.',
        retailConfig: {
            acceptsGoods: ['herbal_tea', 'water', 'honey'],
            baseMarkup: 2.0,
            maxMarkup: 4.0,
            maxCustomersPerDay: 4,
            maxStock: 30,
            npcMotivation: 'health',
            repPerSale: 0.5,
            upgradeMarkupBonus: 0.25,
            consumesPerService: { herbal_tea: 1, water: 1 },
            serviceFee: 8,
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
           'Stefan','Tormund','Valentin','Werner','Baldric','Cormac','Dietrich','Emeric','Florian','Gunther'],
    female: ['Alara','Brenna','Celeste','Diana','Elara','Freya','Gwen','Helena','Iris','Juliana',
             'Katarina','Lysara','Mira','Nadia','Ophelia','Petra','Rosalind','Sera','Thea','Una',
             'Vivian','Wren','Yara','Adeline','Beatrix','Cordelia','Daphne','Elowen','Fiora','Giselle',
             'Helga','Ingrid','Joanna','Keira','Liora','Margot','Nessa','Ottilia','Rowena','Sigrid',
             'Tamsin','Ursula','Verity','Willa','Astrid','Brigid','Clara','Edith','Faye','Greta'],
    surnames: ['Ashford','Blackwood','Crowley','Dunmore','Everhart','Fairfax','Greystone','Hawthorne',
               'Ironwood','Justwell','Kingsford','Langley','Moorfield','Northcott','Oakridge','Pemberton',
               'Redcliffe','Stonewall','Thornbury','Underhill','Valemont','Whitfield','Yarrow','Alderton',
               'Blackthorn','Coldwell','Davenport','Eastmere','Foxley','Goldwyn','Hartwell','Ivywood',
               'Kensley','Lockhart','Millbrook','Norwood','Oldcastle','Prescott','Ravenscroft','Silverdale',
               'Tanfield','Westbrook','Ashworth','Bramwell','Clayborne','Durnham','Edgeworth','Fernsby'],
    kingdoms: ['Valdoria','Aethermoor','Ironhaven','Brighthollow','Stormcrest','Thornwall','Eldermark',
               'Duskhollow','Ravencrown','Goldspire','Ashenvale','Frostmere','Sunweald','Shadowpeak'],
    towns: ['Millhaven','Oakbridge','Stonecross','Riverford','Highwall','Irongate','Greendale','Foxhollow',
            'Thornfield','Bridgewater','Ashwick','Goldleaf','Pinecrest','Ravensbrook','Silverstream',
            'Copperhill','Willowmere','Hawksrest','Deepwell','Marshton','Windhill','Redwater','Longbarrow',
            'Briarwood','Coldspring','Deerfield','Elmcrest','Fairhaven','Grassmere','Heatherwick',
            'Ivybridge','Junipervale','Kingsbury','Lindenford','Moorgate','Netherby','Orchard End',
            'Plumstead','Queensbury','Rosemead','Sunnydale','Thistlewood','Uppermill','Vinehill','Wayford'],
    islands: ['Isle of Storms', "Serpent's Rock", 'Tidewatch', 'Coral Haven', 'Windbreaker Isle',
              'The Shattered Reef', 'Saltspray Atoll', 'Dragonmaw Isle'],
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
    market_scout:        { name: 'Market Scout',        branch: 'commerce',   cost: 2, requires: ['keen_eye'],                    desc: 'See prices in towns where you have workers/buildings (updated every 30 days).', icon: '🔭' },
    trade_network:       { name: 'Trade Network',       branch: 'commerce',   cost: 3, requires: ['market_scout'],                desc: 'See prices in all towns of your home kingdom.',                            icon: '🗺️' },
    regional_survey:     { name: 'Regional Survey',     branch: 'commerce',   cost: 1, requires: ['trade_network'],               desc: 'See resource deposits and production info for all towns in your kingdom on hover.', icon: '📋' },
    foreign_intelligence: { name: 'Foreign Intelligence', branch: 'commerce', cost: 3, requires: ['regional_survey'], desc: 'Your trade contacts keep you informed of foreign kingdom events — wars, laws, embargoes, plagues.', icon: '🌐' },
    global_trade_intel:  { name: 'Global Trade Intel',  branch: 'commerce',   cost: 5, requires: ['trade_network'],               desc: 'See prices in ALL towns across all kingdoms.',                             icon: '🌍' },
    haggler:             { name: 'Haggler',             branch: 'commerce',   cost: 2, requires: [],                              desc: '5% discount when buying goods.',                                           icon: '🤝' },
    master_haggler:      { name: 'Master Haggler',      branch: 'commerce',   cost: 3, requires: ['haggler'],                     desc: '10% discount when buying goods (replaces Haggler).',                       icon: '💰' },
    silver_tongue:       { name: 'Silver Tongue',       branch: 'commerce',   cost: 2, requires: [],                              desc: '5% bonus when selling goods.',                                             icon: '🗣️' },
    golden_tongue:       { name: 'Golden Tongue',       branch: 'commerce',   cost: 3, requires: ['silver_tongue'],               desc: '10% bonus when selling goods (replaces Silver Tongue).',                   icon: '👅' },
    bulk_trader:         { name: 'Bulk Trader',         branch: 'commerce',   cost: 5, requires: ['master_haggler'],              desc: '25% discount on buy transactions over 5,000 gold.',                        icon: '📦' },
    trade_network_intelligence: { name: 'Trade Network Intel', branch: 'commerce', cost: 3, requires: ['bulk_trader'], desc: 'Your trade network reports on elite merchant activities — major trades, expansion, financial struggles.', icon: '📊' },
    market_manipulator:  { name: 'Market Manipulator',  branch: 'commerce',   cost: 5, requires: ['golden_tongue','master_haggler'], desc: 'Your trades have 2x effect on market prices.',                          icon: '📈' },
    merchant_intelligence: { name: 'Merchant Intelligence', branch: 'commerce', cost: 3, requires: ['trade_network'], desc: 'Reveals elite merchant locations in the leaderboard and on the map.', icon: '🔍' },
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

    // ── Property/Business Branch (2) ──
    property_magnate:    { name: 'Property Magnate',    branch: 'industry',   cost: 3, requires: ['master_builder'],              desc: '+1 max buildings per rank tier. -10% property tax.',                        icon: '🏘️' },
    town_benefactor:     { name: 'Town Benefactor',    branch: 'industry',   cost: 4, requires: ['property_magnate'],       desc: 'Your buildings give 2× prosperity boost to town. +5% reputation in towns where you own buildings.', icon: '🏛️' },
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

    // ── Exploration/Travel Branch (3) ──
    wilderness_survival: { name: 'Wilderness Survival', branch: 'transport', cost: 2, requires: [],                               desc: 'Better rest while traveling (+50%). Foraging gives 50% more food.',         icon: '🏕️' },
    horse_mastery:       { name: 'Horse Mastery',       branch: 'transport',  cost: 3, requires: [],                              desc: '+2 max horses, horses give 25% more carry bonus.',                         icon: '🐎' },
    cartographer:        { name: 'Cartographer',        branch: 'transport',  cost: 3, requires: ['road_knowledge'],              desc: '5% faster on roads, 50% faster off-road. 25% cheaper to build roads and outposts.', icon: '🗺️' },
    animal_husbandry:    { name: 'Animal Husbandry',    branch: 'survival',   cost: 2, requires: [],                              desc: 'Learned from shepherding. Livestock buildings produce 10% more.',           icon: '🐑' },

    // ── Social Branch (9) ──
    charming:            { name: 'Charming',            branch: 'social',     cost: 2, requires: [],                              desc: 'Relationships build 25% faster.',                                          icon: '😊' },
    charismatic:         { name: 'Charismatic',         branch: 'social',     cost: 3, requires: ['charming'],                    desc: 'Relationships build 50% faster (replaces Charming).',                      icon: '✨' },
    smooth_talker:       { name: 'Smooth Talker',       branch: 'social',     cost: 2, requires: [],                              desc: 'Relationship decay reduced 50%.',                                          icon: '🎭' },
    romantic:            { name: 'Romantic',            branch: 'social',     cost: 2, requires: ['charming'],                    desc: 'Courtship relationship requirement reduced to 50 (from 60).',               icon: '💕' },
    noble_bearing:       { name: 'Noble Bearing',       branch: 'social',     cost: 3, requires: ['romantic'],                    desc: 'Easier to marry above your social rank.',                                   icon: '👑' },
    good_parent:         { name: 'Good Parent',         branch: 'social',     cost: 2, requires: [],                              desc: 'Children inherit +10% more gold and reputation.',                           icon: '👨‍👧' },
    dynasty_founder:     { name: 'Dynasty Founder',     branch: 'social',     cost: 4, requires: ['good_parent'],                 desc: 'Heir starts with 1 bonus skill point.',                                     icon: '🏰' },
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
    guild_negotiator:    { name: 'Guild Negotiator',    branch: 'social',     cost: 3, requires: [],                              desc: 'Reduced guild dues, faster reputation within guilds.',                      icon: '🤝' },
    tax_attorney:        { name: 'Tax Attorney',        branch: 'social',     cost: 4, requires: ['literacy'],                    desc: 'Reduce all tax burden by 10%. Find loopholes in kingdom law.',              icon: '📋' },
    shrewd_negotiator:   { name: 'Shrewd Negotiator',   branch: 'commerce',   cost: 2, requires: [],                              desc: 'Unlocks traveling merchant auto-travel jobs. Better deal-making.',          icon: '🧠' },

    // ── Survival Branch (8) ──
    street_smart:        { name: 'Street Smart',        branch: 'survival',   cost: 2, requires: [],                              desc: '10% less chance of bandit encounters.',                                     icon: '🏙️' },
    combat_trained:      { name: 'Combat Trained',      branch: 'survival',   cost: 2, requires: [],                              desc: '+15% survival in combat encounters.',                                       icon: '🗡️' },
    battle_hardened:     { name: 'Battle Hardened',     branch: 'survival',   cost: 4, requires: ['combat_trained'],              desc: '+30% survival (replaces Combat Trained).',                                  icon: '💪' },
    escape_artist:       { name: 'Escape Artist',       branch: 'survival',   cost: 3, requires: ['street_smart'],                desc: '30% chance to flee combat without losses.',                                 icon: '🏃' },
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

    // ── Underworld Branch (7) ──
    discrete:            { name: 'Discrete',            branch: 'underworld', cost: 2, requires: [],                              desc: 'Smuggling detection reduced by 10%.',                                       icon: '🤫' },
    master_smuggler:     { name: 'Master Smuggler',     branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: 'Smuggling detection reduced by 20% (replaces Discrete).',                   icon: '🥷' },
    bribe_expert:        { name: 'Bribe Expert',        branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: 'Can bribe guards to avoid detection (cost: 50g).',                          icon: '💸' },
    corruption_expert:   { name: 'Corruption Expert',   branch: 'underworld', cost: 4, requires: ['bribe_expert'],                  desc: 'Halves forced requisition bribe cost. Bribe success formula improved.',      icon: '🤑' },
    black_market_contacts: { name: 'Black Market Contacts', branch: 'underworld', cost: 4, requires: ['master_smuggler'],         desc: 'Black market premium increased to 2x (from 1.5x).',                        icon: '🕶️' },
    contraband_network:  { name: 'Contraband Network',  branch: 'underworld', cost: 5, requires: ['master_smuggler','bribe_expert'], desc: 'Automatically smuggle via caravans.',                                   icon: '🕸️' },
    jail_break:          { name: 'Jail Break',          branch: 'underworld', cost: 2, requires: [],                              desc: 'Jail time reduced 50%.',                                                    icon: '🔓' },
    untouchable:         { name: 'Untouchable',         branch: 'underworld', cost: 5, requires: ['bribe_expert','jail_break'],   desc: 'If caught smuggling, 25% chance charges are dropped.',                       icon: '🎩' },

    // ── Underworld Branch — Dark Deeds Expansion ──
    shadow_dealings:     { name: 'Shadow Dealings',     branch: 'underworld', cost: 2, requires: ['discrete'],                    desc: 'All corrupt action detection reduced by 15%.',                              icon: '🕶️' },
    master_forger:       { name: 'Master Forger',       branch: 'underworld', cost: 3, requires: ['shadow_dealings'],             desc: 'Can create and sell counterfeit goods.',                                    icon: '📝' },
    assassin:            { name: 'Assassin',             branch: 'underworld', cost: 4, requires: ['black_market_contacts'],       desc: 'Can personally assassinate targets. Detection greatly reduced.',             icon: '🗡️' },
    poisoner:            { name: 'Poisoner',            branch: 'underworld', cost: 3, requires: ['black_market_contacts'],       desc: 'Can use poison for assassination. Access to poison goods.',                 icon: '☠️' },
    silver_tongue_dark:  { name: 'Silver Tongue',       branch: 'underworld', cost: 2, requires: ['bribe_expert'],                desc: 'Bribery success rates increased by 25%.',                                  icon: '😈' },
    tunnel_rat:          { name: 'Tunnel Rat',          branch: 'underworld', cost: 4, requires: ['master_smuggler'],             desc: 'Can build smuggling tunnels. Permanent detection reduction.',               icon: '🕳️' },
    arsonist_skill:      { name: 'Arsonist',            branch: 'underworld', cost: 3, requires: ['shadow_dealings'],             desc: 'Arson has 50% less detection chance and destroys more evidence.',           icon: '🔥' },
    kingmaker_skill:     { name: 'Kingmaker',           branch: 'underworld', cost: 5, requires: ['silver_tongue_dark','black_market_contacts'], desc: 'Can attempt to assassinate kings. Political corruption more effective.', icon: '👑' },
    dark_connections:    { name: 'Dark Connections',    branch: 'underworld', cost: 4, requires: ['black_market_contacts'],        desc: 'Access assassination contracts and dark deeds without high notoriety.',     icon: '🌑' },
    master_disguise:     { name: 'Master Disguise',     branch: 'underworld', cost: 3, requires: ['shadow_dealings'],              desc: '+5% stealth on all covert operations. Harder to identify.',                 icon: '🎭' },
    shadow_step:         { name: 'Shadow Step',         branch: 'underworld', cost: 3, requires: ['discrete'],                    desc: '+5% stealth bonus. Move unseen through crowds.',                            icon: '👤' },
    smugglers_run:       { name: 'Smuggler\'s Run',     branch: 'underworld', cost: 3, requires: ['master_smuggler'],             desc: 'Attempt to cross closed borders on land. 40% detection chance.',            icon: '🏃' },
    blockade_runner:     { name: 'Blockade Runner',     branch: 'underworld', cost: 4, requires: ['smugglers_run','discrete'], desc: 'Sail through naval blockades. 35% detection chance. Ship seized if caught.', icon: '🚢' },
    ghost:               { name: 'Ghost',               branch: 'underworld', cost: 5, requires: ['shadow_dealings','tunnel_rat'],               desc: 'Nearly invisible to guards at night. Detection halved.',                 icon: '👻' },
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
// Achievements — 100 Achievements
// ============================================================

const ACHIEVEMENTS = {
    // ── Trading (20) ──
    first_sale:          { name: 'First Sale',          desc: 'Sell your first item.',                          xp: 5,   icon: '🏪', category: 'trading' },
    first_purchase:      { name: 'First Purchase',      desc: 'Buy your first item.',                           xp: 5,   icon: '🛒', category: 'trading' },
    profit_maker:        { name: 'Profit Maker',        desc: 'Make your first profitable trade.',              xp: 10,  icon: '💹', category: 'trading' },
    trades_100:          { name: '100 Trades',          desc: 'Complete 100 trades.',                           xp: 20,  icon: '📊', category: 'trading' },
    trades_500:          { name: '500 Trades',          desc: 'Complete 500 trades.',                           xp: 50,  icon: '📈', category: 'trading' },
    trades_1000:         { name: '1000 Trades',         desc: 'Complete 1000 trades.',                          xp: 100, icon: '🏆', category: 'trading' },
    bread_winner:        { name: 'Bread Winner',        desc: 'Sell 100 bread.',                                xp: 15,  icon: '🍞', category: 'trading' },
    arms_dealer:         { name: 'Arms Dealer',         desc: 'Sell 50 swords.',                                xp: 20,  icon: '⚔️', category: 'trading' },
    armor_merchant:      { name: 'Armor Merchant',      desc: 'Sell 50 armor.',                                 xp: 20,  icon: '🛡️', category: 'trading' },
    horse_trader:        { name: 'Horse Trader',        desc: 'Sell 20 horses.',                                xp: 15,  icon: '🐴', category: 'trading' },
    wine_connoisseur:    { name: 'Wine Connoisseur',    desc: 'Sell 100 wine.',                                 xp: 15,  icon: '🍷', category: 'trading' },
    fisher_king:         { name: 'Fisher King',         desc: 'Sell 100 fish.',                                 xp: 15,  icon: '🐟', category: 'trading' },
    pearl_diver:         { name: 'Pearl Diver',         desc: 'Sell 10 pearls.',                                xp: 25,  icon: '🦪', category: 'trading' },
    gold_rush:           { name: 'Gold Rush',           desc: 'Sell 10 gold.',                                  xp: 25,  icon: '🥇', category: 'trading' },
    market_crash:        { name: 'Market Crash',        desc: 'Crash a market: sell until price drops below 50% of base.', xp: 30, icon: '📉', category: 'trading' },
    price_gouger:        { name: 'Price Gouger',        desc: 'Sell a good at 300%+ of base price.',            xp: 20,  icon: '🤑', category: 'trading' },
    diversified_portfolio: { name: 'Diversified Portfolio', desc: 'Trade all resource types at least once.',    xp: 50,  icon: '🌈', category: 'trading' },
    war_profiteer_ach:   { name: 'War Profiteer',       desc: 'Sell military goods during a war.',              xp: 15,  icon: '⚔️', category: 'trading' },
    famine_merchant:     { name: 'Famine Merchant',     desc: 'Sell food to a starving town.',                  xp: 10,  icon: '🥖', category: 'trading' },
    cross_kingdom_trader: { name: 'Cross-Kingdom Trader', desc: 'Trade in all 4 kingdoms.',                     xp: 30,  icon: '🌐', category: 'trading' },

    // ── Building (15) ──
    first_foundation:    { name: 'First Foundation',    desc: 'Build your first building.',                     xp: 10,  icon: '🏠', category: 'building' },
    property_owner:      { name: 'Property Owner',      desc: 'Own 5 buildings.',                               xp: 20,  icon: '🏘️', category: 'building' },
    real_estate_baron:   { name: 'Real Estate Baron',   desc: 'Own 20 buildings.',                              xp: 50,  icon: '🏗️', category: 'building' },
    industrial_empire:   { name: 'Industrial Empire',   desc: 'Own 50 buildings.',                              xp: 100, icon: '🏭', category: 'building' },
    vertical_integration: { name: 'Vertical Integration', desc: 'Complete your first supply chain.',            xp: 50,  icon: '🔗', category: 'building' },
    chain_master:        { name: 'Chain Master',        desc: 'Complete 3 supply chains.',                      xp: 100, icon: '⛓️', category: 'building' },
    bread_factory:       { name: 'Bread Factory',       desc: 'Own wheat farm + flour mill + bakery in same town.', xp: 30, icon: '🍞', category: 'building' },
    weapons_factory:     { name: 'Weapons Factory',     desc: 'Own iron mine + smelter + blacksmith in same town.', xp: 30, icon: '⚒️', category: 'building' },
    textile_empire:      { name: 'Textile Empire',      desc: 'Own sheep farm + weaver + tailor in same town.', xp: 30,  icon: '🧵', category: 'building' },
    upgrade_master:      { name: 'Upgrade Master',      desc: 'Upgrade a building to level 3.',                 xp: 25,  icon: '⬆️', category: 'building' },
    builder_across_borders: { name: 'Builder Across Borders', desc: 'Own buildings in 3+ different kingdoms.',  xp: 40,  icon: '🌍', category: 'building' },
    multi_town_mogul:    { name: 'Multi-Town Mogul',    desc: 'Own buildings in 5+ different towns.',           xp: 35,  icon: '🗺️', category: 'building' },
    port_developer:      { name: 'Port Developer',      desc: 'Build a dock in a port town.',                  xp: 15,  icon: '⚓', category: 'building' },
    island_investor:     { name: 'Island Investor',     desc: 'Own a building on an island town.',              xp: 25,  icon: '🏝️', category: 'building' },
    full_employment:     { name: 'Full Employment',     desc: 'Have 20+ workers employed.',                     xp: 30,  icon: '👷', category: 'building' },

    // ── Transport (10) ──
    first_caravan:       { name: 'First Caravan',       desc: 'Send your first caravan.',                       xp: 10,  icon: '🐴', category: 'transport' },
    caravan_king:        { name: 'Caravan King',        desc: 'Complete 50 caravan routes.',                    xp: 30,  icon: '🐪', category: 'transport' },
    shipping_magnate:    { name: 'Shipping Magnate',    desc: 'Complete 100 caravan routes.',                   xp: 50,  icon: '🚢', category: 'transport' },
    ship_owner:          { name: 'Ship Owner',          desc: 'Buy your first ship.',                           xp: 15,  icon: '⛵', category: 'transport' },
    fleet_commander:     { name: 'Fleet Commander',     desc: 'Own 3+ ships.',                                  xp: 30,  icon: '🚢', category: 'transport' },
    island_trader:       { name: 'Island Trader',       desc: 'Trade with an island town.',                     xp: 20,  icon: '🏝️', category: 'transport' },
    across_the_sea:      { name: 'Across the Sea',      desc: 'Complete 10 sea voyages.',                       xp: 25,  icon: '🌊', category: 'transport' },
    storm_survivor:      { name: 'Storm Survivor',      desc: 'Survive a storm at sea.',                        xp: 15,  icon: '⛈️', category: 'transport' },
    pirate_fighter:      { name: 'Pirate Fighter',      desc: 'Survive a pirate attack.',                       xp: 15,  icon: '🏴‍☠️', category: 'transport' },
    trade_route_pioneer: { name: 'Trade Route Pioneer', desc: 'Establish trade routes to 8+ different towns.',  xp: 40,  icon: '🗺️', category: 'transport' },

    // ── Social (15) ──
    first_employee:      { name: 'First Employee',      desc: 'Hire your first worker.',                        xp: 5,   icon: '🤝', category: 'social' },
    employer_of_10:      { name: 'Employer of 10',      desc: 'Have 10 employees.',                             xp: 15,  icon: '👥', category: 'social' },
    employer_of_50:      { name: 'Employer of 50',      desc: 'Have 50 employees.',                             xp: 40,  icon: '🏢', category: 'social' },
    making_friends:      { name: 'Making Friends',      desc: 'Reach "Friend" level with an NPC.',              xp: 10,  icon: '😊', category: 'social' },
    best_friends:        { name: 'Best Friends',        desc: 'Reach 80+ relationship with an NPC.',            xp: 20,  icon: '💕', category: 'social' },
    gift_giver:          { name: 'Gift Giver',          desc: 'Give 10 gifts to NPCs.',                         xp: 10,  icon: '🎁', category: 'social' },
    generous_merchant:   { name: 'Generous Merchant',   desc: 'Give 50 gifts to NPCs.',                         xp: 25,  icon: '🎀', category: 'social' },
    wedding_bells:       { name: 'Wedding Bells',       desc: 'Get married.',                                   xp: 20,  icon: '💒', category: 'social' },
    family_person:       { name: 'Family Man/Woman',    desc: 'Have your first child.',                         xp: 15,  icon: '👶', category: 'social' },
    big_family:          { name: 'Big Family',          desc: 'Have 3+ children.',                              xp: 25,  icon: '👨‍👩‍👧‍👦', category: 'social' },
    social_climber:      { name: 'Social Climber',      desc: 'Reach Freeman rank.',                            xp: 15,  icon: '🧑‍💼', category: 'social' },
    guild_elite:         { name: 'Guild Elite',         desc: 'Reach Guildmaster rank.',                        xp: 30,  icon: '🏅', category: 'social' },
    noble_blood:         { name: 'Noble Blood',         desc: 'Reach Minor Noble rank.',                        xp: 50,  icon: '👑', category: 'social' },
    lord_of_the_land:    { name: 'Lord of the Land',    desc: 'Reach Lord rank.',                                xp: 75,  icon: '🏰', category: 'social' },
    royal_advisor_ach:   { name: 'Royal Advisor',       desc: 'Reach Royal Advisor rank.',                      xp: 100, icon: '🤴', category: 'social' },

    // ── Wealth (15) ──
    first_hundred:       { name: 'First Hundred',       desc: 'Accumulate 100 gold.',                           xp: 5,   icon: '🪙', category: 'wealth' },
    thousand_gold:       { name: 'Thousand Gold',       desc: 'Accumulate 1,000 gold.',                         xp: 10,  icon: '💰', category: 'wealth' },
    five_thousand:       { name: 'Five Thousand',       desc: 'Accumulate 5,000 gold.',                         xp: 15,  icon: '💰', category: 'wealth' },
    ten_thousand:        { name: 'Ten Thousand',        desc: 'Accumulate 10,000 gold.',                        xp: 25,  icon: '💎', category: 'wealth' },
    fifty_thousand:      { name: 'Fifty Thousand',      desc: 'Accumulate 50,000 gold.',                        xp: 40,  icon: '💎', category: 'wealth' },
    hundred_thousand:    { name: 'Hundred Thousand',    desc: 'Accumulate 100,000 gold.',                       xp: 60,  icon: '🏦', category: 'wealth' },
    quarter_million:     { name: 'Quarter Million',     desc: 'Accumulate 250,000 gold.',                       xp: 80,  icon: '🏦', category: 'wealth' },
    half_million:        { name: 'Half Million',        desc: 'Accumulate 500,000 gold.',                       xp: 100, icon: '🏛️', category: 'wealth' },
    millionaire:         { name: 'Millionaire',         desc: 'Accumulate 1,000,000 gold.',                     xp: 150, icon: '👸', category: 'wealth' },
    day_trader:          { name: 'Day Trader',          desc: 'Earn 100 gold profit in a single day.',          xp: 15,  icon: '📅', category: 'wealth' },
    big_earner:          { name: 'Big Earner',          desc: 'Earn 1,000 gold profit in a single day.',        xp: 30,  icon: '🤑', category: 'wealth' },
    tycoon:              { name: 'Tycoon',              desc: 'Earn 10,000 gold profit in a single day.',       xp: 50,  icon: '🎩', category: 'wealth' },
    self_made:           { name: 'Self Made',           desc: 'Reach 10,000 gold without inheriting.',          xp: 30,  icon: '💪', category: 'wealth' },
    penny_pincher:       { name: 'Penny Pincher',       desc: 'Have more gold than all AI merchants combined.', xp: 40,  icon: '🐷', category: 'wealth' },
    economic_dominance:  { name: 'Economic Dominance',  desc: 'Own 50%+ of buildings in any single town.',      xp: 50,  icon: '🏰', category: 'wealth' },

    // ── Kingdom & Politics (10) ──
    citizen:             { name: 'Citizen',             desc: 'Become a citizen of a different kingdom.',       xp: 15,  icon: '🏠', category: 'kingdom' },
    dual_citizen:        { name: 'Dual Citizen',        desc: 'Change citizenship to another kingdom.',          xp: 20,  icon: '🌍', category: 'kingdom' },
    diplomat:            { name: 'Diplomat',            desc: 'Have 70+ reputation in 2 kingdoms.',              xp: 25,  icon: '🤝', category: 'kingdom' },
    beloved:             { name: 'Beloved',             desc: 'Have 90+ reputation in any kingdom.',             xp: 30,  icon: '❤️', category: 'kingdom' },
    universal_respect:   { name: 'Universal Respect',   desc: 'Have 70+ reputation in all kingdoms.',            xp: 50,  icon: '🌟', category: 'kingdom' },
    exiled:              { name: 'Exiled',              desc: 'Get exiled from a kingdom.',                      xp: 10,  icon: '🚪', category: 'kingdom' },
    comeback_kid:        { name: 'Comeback Kid',        desc: 'Regain citizenship after being exiled.',          xp: 30,  icon: '🔄', category: 'kingdom' },
    kings_friend:        { name: "King's Friend",       desc: 'Reach Royal Advisor rank.',                       xp: 50,  icon: '🤴', category: 'kingdom' },
    wartime_supplier:    { name: 'Wartime Supplier',    desc: 'Supply goods to a kingdom at war for 30+ days.',  xp: 25,  icon: '🛡️', category: 'kingdom' },
    peacemaker:          { name: 'Peacemaker',          desc: 'Trade with all sides during a war.',              xp: 20,  icon: '🕊️', category: 'kingdom' },

    // ── Underworld (10) ──
    first_smuggle:       { name: 'First Smuggle',       desc: 'Successfully smuggle banned goods.',              xp: 10,  icon: '🤫', category: 'underworld' },
    experienced_smuggler: { name: 'Experienced Smuggler', desc: 'Successfully smuggle 20 times.',               xp: 25,  icon: '🥷', category: 'underworld' },
    master_smuggler_ach: { name: 'Master Smuggler',     desc: 'Successfully smuggle 50 times.',                 xp: 50,  icon: '🎭', category: 'underworld' },
    caught_ach:          { name: 'Caught!',             desc: 'Get caught smuggling for the first time.',        xp: 5,   icon: '🚨', category: 'underworld' },
    jailbird:            { name: 'Jailbird',            desc: 'Spend time in jail.',                             xp: 5,   icon: '⛓️', category: 'underworld' },
    untouchable_ach:     { name: 'Untouchable',         desc: 'Smuggle 10 times in a row without getting caught.', xp: 30, icon: '🎩', category: 'underworld' },
    bribe_master:        { name: 'Bribe Master',        desc: 'Successfully bribe 10 guards.',                   xp: 20,  icon: '💸', category: 'underworld' },
    black_market_king:   { name: 'Black Market King',   desc: 'Earn 10,000+ gold from smuggling.',               xp: 40,  icon: '🕶️', category: 'underworld' },
    double_agent:        { name: 'Double Agent',        desc: 'Smuggle goods banned in your HOME kingdom.',      xp: 20,  icon: '🎭', category: 'underworld' },
    crime_pays:          { name: 'Crime Pays',          desc: 'Have smuggling skill of 20.',                     xp: 25,  icon: '🤑', category: 'underworld' },

    // ── Legacy & Survival (5) ──
    survivor:            { name: 'Survivor',            desc: 'Survive a combat encounter.',                     xp: 10,  icon: '🛡️', category: 'legacy' },
    old_age:             { name: 'Old Age',             desc: 'Reach age 60.',                                   xp: 20,  icon: '👴', category: 'legacy' },
    ripe_old_age:        { name: 'Ripe Old Age',        desc: 'Reach age 75.',                                   xp: 30,  icon: '🧓', category: 'legacy' },
    second_generation:   { name: 'Second Generation',   desc: 'Play as your heir.',                              xp: 25,  icon: '👶', category: 'legacy' },
    dynasty:             { name: 'Dynasty',             desc: 'Play as a third-generation heir.',                xp: 50,  icon: '🏰', category: 'legacy' },

    // ── Kingdom Tax & Security ──
    license_holder:      { name: 'License Holder',      desc: 'Obtain your first royal trade license.',          xp: 15,  icon: '📜', category: 'kingdom' },
    licensed_dealer:     { name: 'Licensed Dealer',     desc: 'Hold licenses in 3 different kingdoms.',          xp: 30,  icon: '📋', category: 'kingdom' },
    security_conscious:  { name: 'Security Conscious',  desc: 'Hire guards for 5 buildings.',                    xp: 15,  icon: '🛡️', category: 'building' },
    fort_knox:           { name: 'Fort Knox',            desc: 'Have locked storage on 10 buildings.',            xp: 20,  icon: '🔒', category: 'building' },
    protection_paid:     { name: 'Protection Paid',      desc: 'Pay protection money for a full year.',           xp: 10,  icon: '💀', category: 'underworld' },
    racket_breaker:      { name: 'Racket Breaker',       desc: 'Intimidate the protection racket away.',          xp: 25,  icon: '💪', category: 'underworld' },
    repeat_offender:     { name: 'Repeat Offender',      desc: 'Accumulate 5+ offenses in a single kingdom.',     xp: 15,  icon: '⛓️', category: 'underworld' },
    tax_evader:          { name: 'Tax Evader',           desc: 'Trade restricted goods without a license 10 times.', xp: 20, icon: '🏴‍☠️', category: 'underworld' },

    // ── New Achievements ──
    citizen_of_world:    { name: 'Citizen of the World',  desc: 'Become a citizen of every kingdom.',           xp: 80,  icon: '🌍', category: 'kingdom' },
    against_all_odds:    { name: 'Against All Odds',      desc: 'Side with the military underdog in a war and they win.', xp: 50, icon: '💪', category: 'kingdom' },
    war_hero:            { name: 'War Hero',              desc: 'Side with a kingdom in war and they win.',     xp: 25,  icon: '🎖️', category: 'kingdom' },
    plague_doctor_ach:   { name: 'Plague Doctor',         desc: 'Sell 100+ medicine to a town during an outbreak.', xp: 30, icon: '🏥', category: 'trading' },
    war_profiteer_supreme: { name: 'War Profiteer Supreme', desc: 'Sell war goods to both sides of a conflict.', xp: 20, icon: '💰', category: 'underworld' },
    philanthropist:      { name: 'Philanthropist',        desc: 'Sell goods below market price 50 times.',     xp: 25,  icon: '❤️', category: 'social' },
    rags_to_riches:      { name: 'Rags to Riches',        desc: 'Start on an island and reach 50,000 gold.',   xp: 60,  icon: '🏝️', category: 'wealth' },
    tax_dodger:          { name: 'Tax Dodger',            desc: 'Avoid 1,000+ gold in taxes through smuggling.', xp: 20, icon: '🏴', category: 'underworld' },
    kingslayer_ach:      { name: 'Kingslayer',            desc: 'Your actions contribute to a king being overthrown.', xp: 40, icon: '⚰️', category: 'kingdom' },
    top_merchant_victory: { name: 'Top Merchant',         desc: 'Hold #1 merchant rank for a full year.',      xp: 100, icon: '👑', category: 'wealth' },
    devoted_spouse:      { name: 'Devoted Spouse',        desc: 'Maintain 90+ spouse relationship for 1 year.',xp: 30,  icon: '💑', category: 'social' },
    orphan_rise:         { name: 'Orphan Rise',           desc: 'Win Top Merchant after being abandoned as orphan.', xp: 80, icon: '🌟', category: 'legacy' },
    // Victory achievements (unlocked when corresponding win condition is met)
    victory_kingmaker:   { name: 'Kingmaker Victory',     desc: 'Won by helping a kingdom conquer half the world.', xp: 50, icon: '🏆', category: 'kingdom' },
    victory_monopolist:  { name: 'Monopolist Victory',    desc: 'Won by monopolizing 3+ resources.',           xp: 50,  icon: '🏆', category: 'wealth' },
    victory_emperor:     { name: "Emperor's Merchant Victory", desc: 'Won by earning 90+ reputation in 3+ kingdoms.', xp: 50, icon: '🏆', category: 'kingdom' },

    // ── Dark Deeds / Corruption Expansion ──
    first_crime:         { name: 'First Crime',          desc: 'Commit your first corrupt action.',                          xp: 5,   icon: '🗡️', category: 'underworld' },
    untouchable_crimes:  { name: 'Untouchable',          desc: 'Commit 20 crimes without getting caught.',                   xp: 30,  icon: '🎩', category: 'underworld' },
    shadow_emperor:      { name: 'Shadow Emperor',       desc: "Control a kingdom's politics through bribes.",               xp: 50,  icon: '🕴️', category: 'underworld' },
    arsonist_ach:        { name: 'Pyromaniac',           desc: 'Burn down 5 buildings.',                                     xp: 25,  icon: '🔥', category: 'underworld' },
    crime_lord:          { name: 'Crime Lord',           desc: 'Commit 50 corrupt actions.',                                 xp: 40,  icon: '🦹', category: 'underworld' },
    master_puppeteer:    { name: 'Master Puppeteer',     desc: "Have the king's heir deeply indebted to you.",               xp: 50,  icon: '🎭', category: 'underworld' },
    market_manipulator:  { name: 'Market Manipulator',   desc: 'Own 75%+ of a resource in any town.',                        xp: 25,  icon: '📈', category: 'underworld' },
    clean_hands:         { name: 'Clean Hands',          desc: 'Reach Royal Advisor rank without any crimes.',               xp: 80,  icon: '🕊️', category: 'social' },
    robin_hood:          { name: 'Robin Hood',           desc: 'Steal from wealthy merchants and sell cheap to poor towns.',  xp: 30,  icon: '🏹', category: 'underworld' },
    poisoner_ach:        { name: 'Poisoner',             desc: 'Successfully poison 3 targets.',                             xp: 25,  icon: '☠️', category: 'underworld' },

    // ── Crown & Military ──
    crowned_king:        { name: 'Crowned Ruler',        desc: '👑 You have ascended to the throne!',                          xp: 150, icon: '👑', category: 'kingdom' },
    naval_commander:     { name: 'Naval Commander',      desc: 'Own a kingdom with 3+ warships.',                              xp: 40,  icon: '⚓', category: 'kingdom' },
    wall_builder:        { name: 'Wall Builder',         desc: 'Build fortified walls (level 3) in a town.',                   xp: 30,  icon: '🧱', category: 'building' },
    wartime_profiteer:   { name: 'Wartime Profiteer',    desc: 'Earn 5,000+ gold selling weapons/food during war.',            xp: 35,  icon: '💰', category: 'trading' },
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
    military:   { name: 'Military',   icon: '⚔️' },
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
    FOOD_TYPES: ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'],
    RAW_FOOD_TYPES: ['wheat', 'flour'], // flour can make flatbread
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
        bedroll: 2.5,
        bedroll_travel: 3.0,     // bedroll while traveling
        tent_travel: 4.0,        // tent while traveling
        camping_kit_travel: 5.0, // full camping kit while traveling
        caravan_wagon: 4.5,      // caravan wagon while traveling (portable housing)
        shack: 3.0,
        master_quarters: 3.5,
        barracks: 3.5,
        inn_room: 4.0,
        cottage: 4.5,
        apartment: 4.5,
        tavern: 4.0,
        townhouse: 5.0,
        harbor_house: 5.0,
        merchant_house: 5.5,
        manor: 6.0,
        fortress: 6.0,
        estate: 7.0,
        castle: 8.0,
        farmstead: 4.0,
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
CONFIG.INFO_BROKER_COST = 25;
CONFIG.LOCAL_WORK_COOLDOWN_TICKS = 2;
CONFIG.STREET_TRADE_REFRESH_DAYS = 5;
CONFIG.STREET_TRADE_PREMIUM_MIN = 1.2;
CONFIG.STREET_TRADE_PREMIUM_MAX = 1.5;
CONFIG.STREET_TRADE_MAX_QTY = 5;
CONFIG.ODD_JOB_XP = 2;

// ============================================================
// Resource Depletion
// ============================================================
CONFIG.NATURAL_DEPOSITS = {
    iron_ore:  { min: 3000, max: 8000, terrain: 'mountain', renewable: false },
    gold_ore:  { min: 1000, max: 3000, terrain: 'mountain', renewable: false },
    stone:     { min: 5000, max: 15000, terrain: 'mountain', renewable: false },
    clay:      { min: 4000, max: 10000, terrain: 'any', renewable: false },
    salt:      { min: 2000, max: 6000, terrain: 'coastal', renewable: false },
    wood:      { min: 3000, max: 8000, terrain: 'forest', renewable: true, regenPerDay: 1, canPlant: true },
    fish:      { min: 1000, max: 3000, terrain: 'coastal', renewable: true, regenPerDay: 2, overfishRecoveryDays: 30 },
};
CONFIG.SOIL_FERTILITY = {
    degradePerSeason: 0.01,
    fallowRestorePerSeason: 0.25,
    cropRotationRestore: 0.10,
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
    Spring: { wheat: 1.3, wood: 1.2, stone: 1.2, tools: 1.2, bread: 1.0, meat: 1.0 },
    Summer: { wheat: 0.8, bread: 0.9, wine: 1.3, fish: 1.2, meat: 0.9, preserved_food: 0.7 },
    Autumn: { wheat: 0.7, bread: 0.8, preserved_food: 1.5, salt: 1.3, wool: 1.2, wine: 1.1 },
    Winter: { bread: 1.4, meat: 1.3, preserved_food: 1.5, wood: 1.3, wool: 1.3, clothes: 1.3, wheat: 1.2, fish: 0.7 },
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
    { id: 'market_day',        name: 'Market Day',           desc: 'Every 7th day, all prices drop 15%', icon: '📅', effect: 'market_day_discount' },
    { id: 'harvest_tithe',     name: 'Harvest Tithe',        desc: '10% of farm production goes to the crown', icon: '🌾', effect: 'farm_tithe' },
    { id: 'sanctuary_law',     name: 'Right of Sanctuary',   desc: 'Criminal penalties from other kingdoms don\'t apply here', icon: '🏛️', effect: 'clear_foreign_offenses' },
    { id: 'apprentice_law',    name: 'Apprentice Law',       desc: 'Must work for a business 30 days before owning one', icon: '📜', effect: 'build_delay' },
    { id: 'foreign_ban',       name: 'Isolationist Policy',  desc: 'Non-citizens pay 25% extra tax on all trades', icon: '🚫', effect: 'foreign_tax_25' },
    { id: 'free_trade',        name: 'Free Trade Zone',      desc: 'No goods-specific taxes, flat low rate', icon: '🕊️', effect: 'no_goods_tax' },
    { id: 'trial_combat',      name: 'Trial by Combat',      desc: 'When caught, 30% chance to fight your way out (combat skill matters)', icon: '⚔️', effect: 'trial_combat' },
    { id: 'maritime_privilege', name: 'Maritime Privilege',   desc: 'Port towns have 10% lower prices on all sea goods', icon: '⚓', effect: 'port_discount' },
    { id: 'price_controls',     name: 'Price Controls',       desc: 'Maximum prices set on essential goods (bread, wheat, water). Protects citizens but may cause shortages.', icon: '📊', effect: 'price_cap' },
    { id: 'immigration_policy', name: 'Closed Borders',       desc: 'Foreigners must earn citizenship through service before settling. Building restricted for non-citizens.', icon: '🚧', effect: 'closed_borders' },
    { id: 'inheritance_tax',    name: 'Inheritance Tax',       desc: 'The crown takes a percentage of inherited wealth during dynasty succession.', icon: '💀', effect: 'inheritance_tax' },
    { id: 'draft_animal_law',   name: 'Draft Animal Permits',  desc: 'Commoners (below Burgher) require a royal permit to own horses.', icon: '🐴', effect: 'horse_permit' },
    { id: 'female_heir_law',    name: 'Female Succession',     desc: 'Women may inherit the throne and titles. Without this law, only males can be heirs.', icon: '👑', effect: 'female_heirs' },
    { id: 'no_dual_citizenship', name: 'Exclusive Citizenship', desc: 'Citizens may not hold citizenship in other kingdoms. Dual citizenship is forbidden.', icon: '🛡️', effect: 'no_dual_citizenship' },
];

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
    repReward: 15,             // reputation reward per commission filled
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
        id: 'small_talk', name: '💬 Small Talk', icon: '💬',
        description: 'Safe, light conversation about the weather and town gossip',
        baseGain: 2, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.02, honesty: 0.01 },
        quirkBonuses: ['charming_smile', 'diplomatic', 'generous_spirit'],
        quirkPenalties: ['paranoid'],
        dateProgress: 8
    },
    {
        id: 'tell_joke', name: '😂 Tell a Joke', icon: '😂',
        description: 'Try to make them laugh — works great with warm people, risky with serious ones',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.06, honesty: -0.01, ambition: -0.02 },
        quirkBonuses: ['musical', 'adventurous', 'charming_smile'],
        quirkPenalties: ['prideful', 'violent_temper', 'pessimist'],
        dateProgress: 10
    },
    {
        id: 'discuss_business', name: '📊 Discuss Business', icon: '📊',
        description: 'Talk shop — ambitious and intelligent people love this, others find it dull',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { ambition: 0.05, intelligence: 0.03, warmth: -0.02 },
        quirkBonuses: ['merchant_family', 'silver_tongue', 'keen_eye_quirk', 'well_connected'],
        quirkPenalties: ['lazy', 'superstitious'],
        dateProgress: 12
    },
    {
        id: 'compliment', name: '🌹 Compliment', icon: '🌹',
        description: 'Pay them a genuine compliment — usually positive, but some see through flattery',
        baseGain: 2, cost: 0, timeHours: 1,
        personalityWeights: { warmth: 0.03, honesty: -0.03, loyalty: 0.01 },
        quirkBonuses: ['vain', 'charming_smile', 'generous_spirit'],
        quirkPenalties: ['paranoid', 'stubborn', 'manipulative'],
        dateProgress: 6
    },
    {
        id: 'ask_advice', name: '🧠 Ask for Advice', icon: '🧠',
        description: 'Seek their wisdom — intelligent and loyal people appreciate being consulted',
        baseGain: 1, cost: 0, timeHours: 1,
        personalityWeights: { intelligence: 0.05, loyalty: 0.02, ambition: 0.01 },
        quirkBonuses: ['bookworm', 'natural_leader', 'patient', 'quick_learner'],
        quirkPenalties: ['lazy', 'hot_headed', 'drunkard'],
        dateProgress: 14
    },
    {
        id: 'share_drink', name: '🍺 Share a Drink', icon: '🍺',
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
};
CONFIG.GUILDS = GUILDS;
CONFIG.GUILD_BASE_MONTHLY = 25;
CONFIG.GUILD_BASE_YEARLY = 200;
CONFIG.GUILD_BUILDING_ENTRY_FEE_MIN = 5;
CONFIG.GUILD_BUILDING_ENTRY_FEE_MAX = 10;

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
    { id: 'build_bridge', name: 'Build a Bridge', icon: '🌉', desc: 'Request the kingdom build a bridge on a road', requiresTarget: true, targetType: 'road', costFactor: 0.04 },
    { id: 'declare_war', name: 'Declare War', icon: '⚔️', desc: 'Urge the kingdom to declare war on another kingdom', requiresTarget: true, targetType: 'kingdom', costFactor: 0 },
    { id: 'seek_peace', name: 'Seek Peace', icon: '🕊️', desc: 'Urge the kingdom to seek peace in an active war', requiresTarget: true, targetType: 'kingdom', costFactor: 0 },
    { id: 'fund_festival', name: 'Fund a Festival', icon: '🎉', desc: 'Request the kingdom fund a festival in a town', requiresTarget: true, targetType: 'town', costFactor: 0.01 },
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
    { id: 'tax_evasion', name: 'Tax Evasion', icon: '💸', defaultPunishment: 'fine', defaultJailDays: 3, defaultFine: 0, description: 'Evading kingdom taxes' },
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
    'hospital', 'clinic', 'granary', 'treasury_vault', 'courthouse',
    'guild_hall', 'marketplace_royal', 'cathedral', 'university',
    'port_fortress', 'wall_upgrade'
];
CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS = [
    'barracks', 'armory', 'watchtower',
    'castle', 'training_grounds', 'siege_workshop', 'stables',
    'courthouse', 'cathedral', 'university', 'port_fortress', 'wall_upgrade'
];

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
        { id: 'steel_sword', name: 'Steel Sword', resource: 'swords', quality: 'fine', combatBonus: 0.30, priceMultiplier: 2.0 },
        { id: 'masterwork_sword', name: 'Masterwork Sword', resource: 'swords', quality: 'masterwork', combatBonus: 0.40, priceMultiplier: 4.0 },
    ],
    armor: [
        { id: 'padded_armor', name: 'Padded Armor', resource: 'armor', quality: 'poor', combatBonus: 0.15, priceMultiplier: 0.5 },
        { id: 'chain_mail', name: 'Chain Mail', resource: 'armor', quality: 'standard', combatBonus: 0.30, priceMultiplier: 1.0 },
        { id: 'plate_armor', name: 'Plate Armor', resource: 'armor', quality: 'fine', combatBonus: 0.40, priceMultiplier: 2.0 },
        { id: 'royal_plate', name: 'Royal Plate Armor', resource: 'armor', quality: 'masterwork', combatBonus: 0.50, priceMultiplier: 5.0 },
    ]
};

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
