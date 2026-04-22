/**
 * story_mode.js - Main Story Controller for Merchant Realms
 *
 * Manages the 19-chapter story campaign: quest objectives, chapter
 * progression, branching paths, NPC scripting, world-generation
 * overrides, family protection flags, and tab-button locking.
 *
 * Loaded via <script> tag. Attaches to the global `StoryMode` object.
 */
var StoryMode = (function () {
    'use strict';

    // ───────────────────────────────────────────────
    //  Story State
    // ───────────────────────────────────────────────
    var _storyState = {
        active: false,
        chapter: 0,
        path: null,           // null | 'diplomatic' | 'military'
        complete: false,
        objectives: {},       // objectiveId -> boolean
        flags: {
            suppressEncounters: true,
            suppressDisease: true,
            protectFamily: true,
            edmundInjured: false,
            edmundImprisoned: false,
            edmundFreed: false,
            margretIll: false,
            ashfordCaptured: false,
            ashfordLiberated: false,
            metLordCalder: false,
            metSeraphine: false,
            warDeclared: false
        },
        buttonsUnlocked: ['character', 'system'],
        dialogsSeen: [],
        chapterStartDay: 0
    };

    // ───────────────────────────────────────────────
    //  Chapter Definitions (0 = prologue, 1-19)
    // ───────────────────────────────────────────────
    var CHAPTERS = [
        // ── Ch 0: Prologue / Setup ──
        {
            id: 'ch0', title: 'Prologue', act: 0,
            startDialog: 'ch0_intro',
            objectives: [],
            endDialog: null,
            unlockButtons: [],
            onStart: '_onPrologueStart',
            onComplete: null
        },

        // ── Act I ──

        // Ch 1
        {
            id: 'ch1', title: 'A Birthday Gift', act: 1,
            startDialog: 'ch1_birthday_mother',
            objectives: [
                { id: 'ch1_buy_food',  type: 'buy_item',  item: 'category:food',  qty: 2, desc: 'Buy 2 food from the market', done: false },
                { id: 'ch1_buy_drink', type: 'buy_item',  item: 'category:beverage', qty: 1, desc: 'Buy a drink',                done: false }
            ],
            endDialog: 'ch1_complete',
            unlockButtons: ['actions'],
            onStart: '_onChapter1Start',
            onComplete: null
        },

        // Ch 2
        {
            id: 'ch2', title: 'The Forge', act: 1,
            startDialog: 'ch2_forge_father',
            objectives: [
                { id: 'ch2_work_shift',   type: 'work_shift',   building: 'blacksmith|smelter|toolsmith', desc: 'Work a shift at the forge', done: false }
            ],
            endDialog: 'ch2_complete',
            unlockButtons: ['business'],
            onStart: null,
            onComplete: null
        },

        // Ch 3
        {
            id: 'ch3', title: 'The Delivery', act: 1,
            startDialog: 'ch3_delivery_father',
            objectives: [
                { id: 'ch3_rest_first',        type: 'rest',        desc: 'Rest before your journey', done: false },
                { id: 'ch3_arrive_ferrowdale', type: 'arrive_town', town: 'Ferrowdale', desc: 'Travel to Ferrowdale',                       done: false, after: 'ch3_rest_first' },
                { id: 'ch3_sell_tools',        type: 'sell_item',   item: 'tools', desc: 'Deliver the tools (sell in Ferrowdale)', done: false, after: 'ch3_arrive_ferrowdale' }
            ],
            endDialog: 'ch3_complete',
            unlockButtons: ['world'],
            onStart: '_onChapter3Start',
            onComplete: null
        },

        // Ch 3b — The Open Market
        {
            id: 'ch3b', title: 'The Open Market', act: 1,
            startDialog: 'ch3b_street_trade',
            objectives: [
                { id: 'ch3b_street_sell', type: 'open_street_trading',
                  desc: 'Look at Street Trading',
                  hint: 'Click the Street Trading (🤝) button to see what locals are looking to buy — they often pay above market price!',
                  done: false }
            ],
            endDialog: 'ch3b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 4
        {
            id: 'ch4', title: 'The Art of the Deal', act: 1,
            startDialog: 'ch4_harlan_teaches',
            objectives: [
                { id: 'ch4_buy_goods',      type: 'buy_item',    item: '*', qty: 1,  desc: 'Buy cheap goods in Ferrowdale',       done: false },
                { id: 'ch4_return_ashford', type: 'arrive_town', town: 'Ashford',     desc: 'Return to Ashford',                  done: false, after: 'ch4_buy_goods' },
                { id: 'ch4_sell_goods',     type: 'sell_item',   item: '*',           desc: 'Sell goods for profit in Ashford',    done: false, after: 'ch4_return_ashford' }
            ],
            endDialog: 'ch4_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: '_onChapter4Complete'
        },

        // Ch 4b — The Road is Dangerous
        {
            id: 'ch4b', title: 'The Road is Dangerous', act: 1,
            startDialog: 'ch4b_ambush',
            objectives: [
                { id: 'ch4b_buy_weapon', type: 'buy_item', item: 'bows|bows_good|bows_excellent|swords|swords_good|swords_excellent', qty: 1,
                  desc: 'Buy a weapon from the market',
                  hint: 'Open Trade and look for swords or bows to arm yourself. Note: bows need arrows to be effective in encounters!',
                  done: false },
                { id: 'ch4b_equip_weapon', type: 'equip_item', slot: 'weapon',
                  desc: 'Equip your weapon',
                  hint: 'Open your Character panel and find the Equipment section to equip your weapon',
                  done: false },
                { id: 'ch4b_hire_guard', type: 'hire_guard',
                  desc: 'Hire a personal guard',
                  hint: 'Open Character panel \u2192 scroll to Guards section \u2192 click Hire Guard (6g/day)',
                  done: false }
            ],
            endDialog: 'ch4b_complete',
            unlockButtons: [],
            onStart: '_onChapter4bStart',
            onComplete: null
        },

        // Ch 5
        {
            id: 'ch5', title: 'A Place to Call Home', act: 1,
            startDialog: 'ch5_mother_housing',
            note: 'Keep earning gold until you can afford land and a house.',
            objectives: [
                { id: 'ch5_buy_land',    type: 'custom',       fn: '_checkOwnsLand',   desc: 'Buy a plot of land',      done: false },
                { id: 'ch5_buy_housing', type: 'own_building', building: 'housing', desc: 'Build or acquire housing', done: false },
                { id: 'ch5_rest',        type: 'custom',       fn: '_checkRested',  desc: 'Rest at your new home',    done: false }
            ],
            endDialog: 'ch5_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 5b — Settling In
        {
            id: 'ch5b', title: 'Settling In', act: 1,
            startDialog: 'ch5b_home_upgrade',
            objectives: [
                { id: 'ch5b_install_workshop', type: 'install_addon', addon: 'workshop',
                  desc: 'Install a workshop in your home',
                  hint: 'Open Housing panel \u2192 look for available addons \u2192 install the Workshop',
                  done: false },
                { id: 'ch5b_craft_item', type: 'home_craft', qty: 1,
                  desc: 'Craft an item at your home workshop',
                  hint: 'Open Housing panel \u2192 click Craft \u2192 select a recipe like bandages or leather',
                  done: false, after: 'ch5b_install_workshop' }
            ],
            endDialog: 'ch5b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 6
        {
            id: 'ch6', title: 'The Apprentice', act: 1,
            startDialog: 'ch6_father_skills',
            objectives: [
                { id: 'ch6_buy_skill',  type: 'buy_skill',   skill: '*', desc: 'Learn a new skill',  done: false },
                { id: 'ch6_join_guild', type: 'join_guild',   guild: '*', desc: 'Join a guild',       done: false }
            ],
            endDialog: 'ch6_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 6b — The Guildsman's Craft
        {
            id: 'ch6b', title: 'The Guildsman\'s Craft', act: 1,
            startDialog: 'ch6b_guild_craft',
            objectives: [
                { id: 'ch6b_guild_craft', type: 'guild_craft', qty: 1,
                  desc: 'Craft an item at a guild building',
                  hint: 'Click your town name \u2192 Buildings tab \u2192 find a guild-affiliated building \u2192 click the Craft button',
                  done: false },
                { id: 'ch6b_open_help', type: 'open_help_guide', qty: 1,
                  desc: 'Open the Help & Guide menu',
                  hint: 'Click the \u2753 Help button to explore the game guide \u2014 it covers goods, notables, kingdoms, and more',
                  done: false }
            ],
            endDialog: 'ch6b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // ── Act II ──

        // Ch 7
        {
            id: 'ch7', title: 'Drums of War', act: 2,
            startDialog: 'ch7_war_crier',
            objectives: [
                { id: 'ch7_read_announcement', type: 'custom', fn: '_checkWarDialogSeen', desc: 'Read the war announcement', done: false }
            ],
            endDialog: 'ch7_complete',
            unlockButtons: [],
            onStart: '_onChapter7Start',
            onComplete: null
        },

        // Ch 8
        {
            id: 'ch8', title: 'Fire and Iron', act: 2,
            startDialog: 'ch8_father_plan',
            objectives: [
                { id: 'ch8_arrive_ferrowdale', type: 'arrive_town',  town: 'Ferrowdale',                          desc: 'Travel to Ferrowdale',              done: false },
                { id: 'ch8_own_iron',          type: 'own_building',  building: 'iron_mine|smelter',               desc: 'Build an iron mine or smelter',     done: false }
            ],
            endDialog: 'ch8_complete',
            unlockButtons: [],
            onStart: '_onChapter8Start',
            onComplete: null
        },

        // Ch 8b — The Mine Master (inserted between Fire and Iron and Roads of Fortune)
        {
            id: 'ch8b', title: 'The Mine Master', act: 2,
            startDialog: 'ch8b_harlan_mine',
            objectives: [
                { id: 'ch8b_work_mine',     type: 'work_shift',     building: 'iron_mine', desc: 'Work a shift in your iron mine',                     done: false },
                { id: 'ch8b_hire_worker',   type: 'hire_worker',                            desc: 'Hire a worker for your mine',                        done: false },
                { id: 'ch8b_assign_worker', type: 'assign_worker',  building: 'iron_mine',  desc: 'Assign a worker to your iron mine', hint: 'Open Business → Buildings, click your Iron Mine, then use the + Assign button under Workers', done: false, after: 'ch8b_hire_worker' },
                { id: 'ch8b_collect_ore',   type: 'collect_output', item: 'iron_ore', qty: 5, desc: 'Withdraw 5 iron ore from your mine (0/5)', hint: 'Open your Iron Mine details and use the Take buttons under Output Storage to collect ore into your inventory', done: false, after: 'ch8b_assign_worker' },
                { id: 'ch8b_sell_iron',     type: 'sell_item',      item: 'iron_ore', qty: 5, town: 'Ashford', desc: 'Sell 5 iron ore in Ashford',  done: false }
            ],
            endDialog: 'ch8b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 9
        {
            id: 'ch9', title: 'Roads of Fortune', act: 2,
            startDialog: 'ch9_father_caravan',
            objectives: [
                { id: 'ch9_send_caravan', type: 'send_caravan', desc: 'Send a trade caravan with iron ore orders', done: false,
                  requiredOrders: [
                      { action: 'pickup', item: 'iron_ore', town: 'Ferrowdale' },
                      { action: 'sell',   item: 'iron_ore', town: 'Ashford' }
                  ]
                }
            ],
            endDialog: 'ch9_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 9b — Saddle and Steel
        {
            id: 'ch9b', title: 'Saddle and Steel', act: 2,
            startDialog: 'ch9b_horse_cart',
            objectives: [
                { id: 'ch9b_buy_horse', type: 'buy_horse',
                  desc: 'Buy a horse',
                  hint: 'Open Trade \u2192 search for Horses \u2192 Buy',
                  done: false },
                { id: 'ch9b_mount_horse', type: 'mount_horse',
                  desc: 'Mount your horse',
                  hint: 'Open Character panel \u2192 scroll to Horses \u2192 click Mount Horse from Inventory',
                  done: false, after: 'ch9b_buy_horse' }
            ],
            endDialog: 'ch9b_complete',
            note: 'Tip: Carts add carry capacity without a horse. Small Wagons need 1 horse, Wagons need 2. Upgrade when you can afford it!',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 10
        {
            id: 'ch10', title: 'Bread and Butter', act: 2,
            startDialog: 'ch10_mother_bread',
            objectives: [
                { id: 'ch10_own_mill',      type: 'own_building',   building: 'flour_mill|bakery', desc: 'Build a flour mill or bakery',           done: false },
                { id: 'ch10_hire_worker',   type: 'hire_worker',                                   desc: 'Hire a worker',                          done: false },
                { id: 'ch10_assign_worker', type: 'assign_worker',  building: 'flour_mill|bakery', desc: 'Assign the worker to your building',     done: false, after: 'ch10_hire_worker' },
                { id: 'ch10_return_ashford', type: 'arrive_town',   town: 'Ashford',               desc: 'Travel back to Ashford',                 done: false, after: ['ch10_own_mill', 'ch10_hire_worker', 'ch10_assign_worker'] }
            ],
            endDialog: 'ch10_complete',
            unlockButtons: [],
            onStart: '_onChapter10Start',
            onComplete: null
        },

        // Ch 10b — Building an Empire
        {
            id: 'ch10b', title: 'Building an Empire', act: 2,
            startDialog: 'ch10b_upgrades',
            objectives: [
                { id: 'ch10b_upgrade', type: 'upgrade_building',
                  desc: 'Upgrade one of your buildings',
                  hint: 'Open Business \u2192 Buildings \u2192 click a building \u2192 scroll to Upgrade section \u2192 click Upgrade',
                  done: false },
                { id: 'ch10b_autobuy', type: 'toggle_autobuy',
                  desc: 'Enable auto-buy on a production building',
                  hint: 'In your building details, find the Auto-Buy checkbox and enable it \u2014 your building will automatically purchase raw materials from the market',
                  done: false }
            ],
            endDialog: 'ch10b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 11
        {
            id: 'ch11', title: 'Fever and Steel', act: 2,
            startDialog: 'ch11_father_injury',
            objectives: [
                { id: 'ch11_treat_father', type: 'treat_person', person: 'Edmund',  desc: 'Treat father\'s injury',
                  hint: 'Open Character \u2192 Treatment \u2192 treat Edmund under Sick Companions',
                  done: false },
                { id: 'ch11_treat_mother', type: 'treat_person', person: 'Margret', desc: 'Treat mother\'s illness',
                  hint: 'Open Character \u2192 Treatment \u2192 treat Margret under Sick Companions',
                  done: false }
            ],
            endDialog: 'ch11_complete',
            unlockButtons: [],
            onStart: '_onChapter11Start',
            onComplete: '_onChapter11Complete'
        },

        // Ch 12
        {
            id: 'ch12', title: 'The Grand Festival', act: 2,
            startDialog: 'ch12_festival_start',
            objectives: [
                { id: 'ch12_attend_festival', type: 'custom', fn: '_checkFestivalAttended', desc: 'Attend the grand festival', done: false },
                { id: 'ch12_meet_calder',     type: 'custom', fn: '_checkMetCalder',        desc: 'Speak with Lord Calder',    done: false }
            ],
            endDialog: 'ch12_complete',
            unlockButtons: [],
            onStart: '_onChapter12Start',
            onComplete: null
        },

        // ── Act III ──

        // Ch 13
        {
            id: 'ch13', title: 'The Fall of Ashford', act: 3,
            startDialog: 'ch13_invasion',
            objectives: [
                { id: 'ch13_escape', type: 'arrive_town', town: '!Ashford', kingdom: 'Valdren', desc: 'Escape to a Valdren town', done: false }
            ],
            endDialog: 'ch13_escape_complete',
            unlockButtons: [],
            onStart: '_onChapter13Start',
            onComplete: null
        },

        // Ch 14
        {
            id: 'ch14', title: 'A Petition to the Crown', act: 3,
            startDialog: 'ch14_calder_plan',
            objectives: [
                { id: 'ch14_reach_burgher', type: 'reach_rank', rank: 2,         desc: 'Reach the rank of Burgher',    done: false },
                { id: 'ch14_meet_calder',   type: 'custom',     fn: '_checkMetCalderCapital', desc: 'Meet Lord Calder at the capital', done: false }
            ],
            endDialog: 'ch14_complete',
            unlockButtons: [],
            onStart: '_onChapter14Start',
            onComplete: null
        },

        // Ch 14b — The Merchant Fleet
        {
            id: 'ch14b', title: 'The Merchant Fleet', act: 3,
            startDialog: 'ch14b_shipbuilding',
            objectives: [
                { id: 'ch14b_build_ship', type: 'build_ship',
                  desc: 'Build or buy a ship',
                  hint: 'Travel to a port town and look for shipyard services, or check if ships are available for purchase',
                  done: false }
            ],
            endDialog: 'ch14b_complete',
            note: 'Ships unlock sea routes for faster trade between distant coastal towns. Upgrade with cargo holds and armories!',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 15
        {
            id: 'ch15', title: 'Master of the Guild', act: 3,
            startDialog: 'ch15_calder_wealth',
            objectives: [
                { id: 'ch15_guildmaster', type: 'reach_rank', rank: 3,       desc: 'Attain Guildmaster standing',   done: false },
                { id: 'ch15_own_gold',    type: 'own_gold',   amount: 5000,  desc: 'Accumulate 5 000 gold',         done: false }
            ],
            endDialog: 'ch15_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 16
        {
            id: 'ch16', title: 'Halls of Power', act: 3,
            startDialog: 'ch16_calder_nobility',
            objectives: [
                { id: 'ch16_reach_noble',   type: 'reach_rank',   rank: 4,  desc: 'Become a Minor Noble',   done: false },
                { id: 'ch16_attend_feast',  type: 'attend_feast',           desc: 'Attend a noble feast',   done: false, after: 'ch16_reach_noble' },
                { id: 'ch16_attend_court',  type: 'attend_court',           desc: 'Attend the royal court', done: false, after: 'ch16_attend_feast' }
            ],
            endDialog: 'ch16_complete',
            unlockButtons: [],
            onStart: '_onChapter16Start',
            onComplete: null
        },

        // Ch 17 — BRANCHING
        {
            id: 'ch17', title: 'The War Effort', act: 3,
            startDialog: 'ch17_choice',
            objectives: [],   // populated dynamically based on path
            endDialog: null,   // branch-specific: ch17a_complete or ch17b_complete
            unlockButtons: [], // path B adds 'world' (outposts)
            onStart: '_onChapter17Start',
            onComplete: null,
            branches: {
                diplomatic: [
                    { id: 'ch17a_kingmaker', type: 'buy_skill', skill: 'kingmaker_skill', desc: 'Learn the Kingmaker skill', done: false },
                    { id: 'ch17a_hire_agent', type: 'custom', fn: '_checkHasAgent', desc: 'Hire an agent', done: false },
                    { id: 'ch17a_agent_diplo', type: 'custom', fn: '_checkAgentDiplomaticTask', desc: 'Assign an agent to a diplomatic task', done: false, after: 'ch17a_hire_agent' },
                    { id: 'ch17a_found_outpost', type: 'custom', fn: '_checkDiploOutpost', desc: 'Found a diplomatic outpost connected to Ashford', done: false },
                    { id: 'ch17a_outpost_pop', type: 'custom', fn: '_checkDiploOutpostPop', desc: 'Grow your outpost population to at least 10', done: false, after: 'ch17a_found_outpost' },
                    { id: 'ch17a_outpost_happy', type: 'custom', fn: '_checkDiploOutpostHappy', desc: 'Keep outpost happiness above 60', done: false, after: 'ch17a_found_outpost' },
                    { id: 'ch17a_trade_value', type: 'custom', fn: '_checkCrossKingdomTrade', desc: 'Trade 10,000g worth of goods via caravans between kingdoms (0/10000)', done: false },
                    { id: 'ch17a_undermine_loyalty',    type: 'custom', fn: '_checkUndermineLoyalty',    desc: 'Turn nobles against their king \u2014 reduce loyalty by 100 total (0/100)', done: false, after: 'ch17a_kingmaker' },
                    { id: 'ch17a_undermine_perceived',  type: 'custom', fn: '_checkUnderminePerceived',  desc: 'Discredit nobles \u2014 reduce perceived loyalty by 50 total (0/50)', done: false, after: 'ch17a_kingmaker' },
                    { id: 'ch17a_undermine_reputation', type: 'custom', fn: '_checkUndermineReputation', desc: 'Sow discord \u2014 damage noble reputation by 50 total (0/50)', done: false, after: 'ch17a_kingmaker' },
                    { id: 'ch17a_victory',   type: 'custom', fn: '_checkDiplomaticVictory', desc: 'The nobles depose the Korvathi king', done: false }
                ],
                military: [
                    { id: 'ch17b_hire_agent', type: 'custom', fn: '_checkHasAgent', desc: 'Hire an agent', done: false },
                    { id: 'ch17b_agent_hostile', type: 'custom', fn: '_checkAgentHostileTask', desc: 'Set an agent hostile to an enemy noble', done: false, after: 'ch17b_hire_agent' },
                    { id: 'ch17b_found_outpost', type: 'custom', fn: '_checkMilitaryOutpost', desc: 'Found a military outpost with security upgrades', done: false },
                    { id: 'ch17b_outpost_pop', type: 'custom', fn: '_checkMilitaryOutpostPop', desc: 'Grow your outpost population to at least 10', done: false, after: 'ch17b_found_outpost' },
                    { id: 'ch17b_outpost_road_ferro', type: 'custom', fn: '_checkOutpostRoadFerro', desc: 'Build a road from your outpost to Ferrowdale', done: false, after: 'ch17b_found_outpost' },
                    { id: 'ch17b_outpost_road_ash', type: 'custom', fn: '_checkOutpostRoadAshford', desc: 'Build a road from your outpost to Ashford', done: false, after: 'ch17b_found_outpost' },
                    { id: 'ch17b_sabotage', type: 'custom', fn: '_checkSabotage3', desc: 'Sabotage or burn 3 buildings in enemy territory (0/3)', done: false },
                    { id: 'ch17b_donate_treasury', type: 'custom', fn: '_checkDonatedTreasury', desc: 'Donate 10,000g to the kingdom treasury (0/10000)', done: false },
                    { id: 'ch17b_produce_weapons', type: 'produce_item', item: 'base:swords|base:bows', qty: 500, desc: 'Produce 500 weapons in your buildings (0/500)', done: false },
                    { id: 'ch17b_produce_armor',   type: 'produce_item', item: 'base:armor',            qty: 500, desc: 'Produce 500 armor in your buildings (0/500)',   done: false },
                    { id: 'ch17b_produce_horses',  type: 'produce_item', item: 'horses',                qty: 100, desc: 'Produce 100 horses in your buildings (0/100)',  done: false },
                    { id: 'ch17b_supply_weapons', type: 'supply_kingdom', item: 'base:swords|base:bows', qty: 500, desc: 'Supply 500 weapons to the kingdom (0/500)', done: false },
                    { id: 'ch17b_supply_armor',   type: 'supply_kingdom', item: 'base:armor',            qty: 500, desc: 'Supply 500 armor to the kingdom (0/500)',   done: false },
                    { id: 'ch17b_supply_horses',  type: 'supply_kingdom', item: 'horses',                qty: 100, desc: 'Supply 100 horses to the kingdom (0/100)',  done: false },
                    { id: 'ch17b_battle',         type: 'custom', fn: '_checkBattleWon', desc: 'Win the decisive battle for Ashford', done: false }
                ]
            }
        },

        // Ch 18
        {
            id: 'ch18', title: 'Reunion', act: 3,
            startDialog: 'ch18_ashford_liberated',
            objectives: [
                { id: 'ch18_arrive_ashford', type: 'arrive_town', town: 'Ashford',                        desc: 'Return to Ashford',     done: false },
                { id: 'ch18_talk_edmund',    type: 'custom',      fn: '_checkTalkedToEdmund',             desc: 'Speak with your father', done: false }
            ],
            endDialog: 'ch18_complete',
            unlockButtons: [],
            onStart: '_onChapter18Start',
            onComplete: null
        },

        // Ch 19
        {
            id: 'ch19', title: 'A New Dawn', act: 4,
            startDialog: 'ch19_ceremony_start',
            objectives: [
                { id: 'ch19_ceremony', type: 'custom', fn: '_checkCeremonyAttended', desc: 'Attend the ceremony', done: false }
            ],
            endDialog: 'ch19_sandbox_unlock',
            unlockButtons: [],
            onStart: null,
            onComplete: '_onChapter19Complete'
        },

        // Ch 19b — Legacy (final chapter)
        {
            id: 'ch19b', title: 'Legacy', act: 4,
            startDialog: 'ch19b_legacy',
            objectives: [
                { id: 'ch19b_view_log', type: 'custom', fn: '_checkViewedEventLog',
                  desc: 'Review the event log',
                  hint: 'Click the \uD83D\uDCDC Event Log button to see everything that has happened in your journey',
                  done: false },
                { id: 'ch19b_filter_notifs', type: 'custom', fn: '_checkToggledFilter',
                  desc: 'Customize your notification filters',
                  hint: 'Open Settings (\u2699\uFE0F) \u2192 Notification Filters \u2014 toggle categories on/off to control what alerts you see',
                  done: false },
                { id: 'ch19b_view_feats', type: 'custom', fn: '_checkViewedFeats',
                  desc: 'Review your feats and achievements',
                  hint: 'Click the \uD83C\uDF96\uFE0F Feats button to see what you have unlocked \u2014 and what challenges remain',
                  done: false }
            ],
            endDialog: 'ch19b_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        }
    ];

    // ───────────────────────────────────────────────
    //  Internal Helpers
    // ───────────────────────────────────────────────

    /** Deep-clone an array of objective templates so chapter restarts are clean. */
    function _cloneObjectives(arr) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var o = {};
            for (var k in arr[i]) {
                if (arr[i].hasOwnProperty(k)) { o[k] = arr[i][k]; }
            }
            o.done = false;
            out.push(o);
        }
        return out;
    }

    /** Check if an objective's 'after' dependencies are all met. Supports string or array. */
    function _afterMet(obj) {
        if (!obj.after) return true;
        if (Array.isArray(obj.after)) {
            for (var ai = 0; ai < obj.after.length; ai++) {
                if (!_storyState.objectives[obj.after[ai]]) return false;
            }
            return true;
        }
        return !!_storyState.objectives[obj.after];
    }

    /** Mark an objective done by id and persist to _storyState.objectives map. */
    function _markDone(objId) {
        _storyState.objectives[objId] = true;
        var ch = _currentChapterDef();
        if (!ch) { return; }
        for (var i = 0; i < ch.objectives.length; i++) {
            if (ch.objectives[i].id === objId) {
                ch.objectives[i].done = true;
                break;
            }
        }
        _refreshTracker();

        // Auto-trigger follow-up dialogs when certain objectives complete
        var _followUpDialogs = {
            'ch12_attend_festival': 'ch12_lord_calder_meet',
            'ch14_reach_burgher':   'ch14_calder_capital',
            'ch16_reach_noble':     'ch16_feast_announcement',
            'ch16_attend_feast':    'ch16_feast_success',
            'ch18_arrive_ashford':  'ch18_father_freed'
        };
        if (_followUpDialogs[objId]) {
            _showDialog(_followUpDialogs[objId]);
        }

        // Schedule engine events when specific objectives complete
        if (objId === 'ch16_reach_noble') {
            // Player just became Minor Noble — schedule a feast at the capital in 7 days
            // Also unlock the Nobility button
            _unlockButtons(['#btnNobility']);
            try {
                var _valdrenK = null;
                var _allKingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
                for (var _ki = 0; _ki < _allKingdoms.length; _ki++) {
                    if (_allKingdoms[_ki].name === 'Valdren') { _valdrenK = _allKingdoms[_ki]; break; }
                }
                if (_valdrenK) {
                    Engine.startRoyalFeast(_valdrenK.id, 7);
                }
            } catch (e) { /* feast scheduling failed */ }
        } else if (objId === 'ch16_attend_feast') {
            // Player just attended feast — schedule royal court in 3 days
            // Set _nextCourtDay so tickKingdomCourt creates _activeCourtSession for player
            try {
                var _valdrenK2 = null;
                var _allK2 = Engine.getKingdoms ? Engine.getKingdoms() : [];
                for (var _ki2 = 0; _ki2 < _allK2.length; _ki2++) {
                    if (_allK2[_ki2].name === 'Valdren') { _valdrenK2 = _allK2[_ki2]; break; }
                }
                if (_valdrenK2) {
                    var _w = Engine.getWorld ? Engine.getWorld() : null;
                    var _courtDay = (_w ? _w.day : 0) + 3;
                    _valdrenK2._nextCourtDay = _courtDay;
                }
            } catch (e) { /* court scheduling failed */ }
        }
    }

    /** Get the chapter definition for the current chapter index. */
    function _currentChapterDef() {
        return CHAPTERS[_storyState.chapter] || null;
    }

    /** Push unique values into buttonsUnlocked. */
    function _unlockButtons(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (_storyState.buttonsUnlocked.indexOf(arr[i]) === -1) {
                _storyState.buttonsUnlocked.push(arr[i]);
            }
        }
    }

    /** Show a story dialog by key (delegates to UI layer). */
    function _showDialog(key, onComplete) {
        if (!key) { if (typeof onComplete === 'function') onComplete(); return; }
        if (typeof STORY_DIALOGS !== 'undefined' && STORY_DIALOGS[key]) {
            if (typeof UI !== 'undefined' && UI.showStoryDialog) {
                var dialogData = STORY_DIALOGS[key];
                dialogData._dialogKey = key;
                // If this dialog has a 'next' key, chain to the next dialog on completion
                var nextKey = dialogData.next || null;
                var userCb = onComplete;
                var capturedKey = key;
                dialogData.onComplete = function () {
                    // Set story flags now that dialog is fully dismissed
                    _onDialogCompleted(capturedKey);
                    if (nextKey) {
                        _showDialog(nextKey, userCb);
                    } else if (typeof userCb === 'function') {
                        userCb();
                    }
                };
                UI.showStoryDialog(dialogData);
            }
        }
        if (_storyState.dialogsSeen.indexOf(key) === -1) {
            _storyState.dialogsSeen.push(key);
        }
    }

    /**
     * Called when a story dialog is fully dismissed (all lines read / choice made).
     * Sets story flags that depend on the player having seen a dialog.
     */
    function _onDialogCompleted(key) {
        if (!key) return;
        var _dialogFlagMap = {
            'ch12_lord_calder_meet':       'metLordCalder',
            'ch14_calder_capital':         'metLordCalderCapital',
            'ch17a_conspiracy_success':    'diplomaticVictory',
            'ch17b_battle_victory':        'battleWon',
            'ch18_father_freed':           'talkedToEdmund',
            'ch19_ceremony_start':         'ceremonyAttended'
        };
        if (_dialogFlagMap[key]) {
            _storyState.flags[_dialogFlagMap[key]] = true;
        }
        _reEvalCustomObjectives();
    }

    /** Notify the quest tracker UI. */
    function _refreshTracker() {
        var ch = _currentChapterDef();
        if (ch && typeof UI !== 'undefined' && UI.updateStoryTracker) {
            UI.updateStoryTracker(ch, ch.objectives);
        }
    }

    /** Convenience toast. */
    function _toast(msg) {
        if (typeof UI !== 'undefined' && UI.showToast) { UI.showToast(msg); }
    }

    /** Convenience log. */
    function _log(msg) {
        if (typeof Engine !== 'undefined' && Engine.addLogEntry) {
            Engine.addLogEntry(msg, 'story');
        }
    }

    /** Safely call a named hook function. */
    function _callHook(name) {
        if (name && typeof _hooks[name] === 'function') { _hooks[name](); }
    }

    // ───────────────────────────────────────────────
    //  Objective Checking
    // ───────────────────────────────────────────────

    /**
     * Check whether a single objective is satisfied right now.
     * Called by tick() and onPlayerAction().
     */
    function _checkObjective(obj) {
        if (obj.done || _storyState.objectives[obj.id]) { return true; }

        switch (obj.type) {
            case 'own_gold':
                return typeof Player !== 'undefined' && Player.gold >= (obj.amount || 0);

            case 'reach_rank':
                if (typeof Player === 'undefined') return false;
                var curRank = (Player.getEffectiveRank) ? Player.getEffectiveRank() : (Player.rank || 0);
                return curRank >= (obj.rank || 0);

            case 'own_building':
                return _playerOwnsBuilding(obj.building);

            case 'arrive_town':
                // Check if player is currently in the target town
                if (typeof Player !== 'undefined' && Player.townId && !Player.traveling) {
                    var curTown = (typeof Engine !== 'undefined' && Engine.findTown) ? Engine.findTown(Player.townId) : null;
                    var curName = curTown ? curTown.name : '';
                    var townMatch = true;
                    if (obj.town && obj.town.charAt(0) === '!') {
                        townMatch = curName !== obj.town.substring(1);
                    } else if (obj.town) {
                        townMatch = curName === obj.town;
                    }
                    // Optional kingdom filter
                    if (townMatch && obj.kingdom && curTown) {
                        var curK = (typeof Engine !== 'undefined' && Engine.getKingdom) ? Engine.getKingdom(curTown.kingdomId) : null;
                        if (!curK || curK.name !== obj.kingdom) townMatch = false;
                    }
                    return townMatch;
                }
                return false;

            case 'custom':
                if (obj.fn && typeof _hooks[obj.fn] === 'function') {
                    return !!_hooks[obj.fn]();
                }
                return false;

            case 'buy_horse':
                return typeof Player !== 'undefined' && (
                    (Player.horses && Player.horses.length > 0) ||
                    (Player.inventory && Player.inventory.horses > 0)
                );

            case 'mount_horse':
                return typeof Player !== 'undefined' && Player.horses && Player.horses.length > 0;

            // The remaining types (buy_item, sell_item, arrive_town, etc.)
            // are event-driven — they get marked done via onPlayerAction().
            default:
                return false;
        }
    }

    /** Check if the player owns a building matching a pattern (supports pipe-delimited alternatives). */
    function _playerOwnsBuilding(pattern) {
        if (typeof Player === 'undefined') { return false; }
        var types = (pattern || '').split('|');
        // Check commercial buildings
        if (Player.buildings) {
            for (var i = 0; i < Player.buildings.length; i++) {
                var b = Player.buildings[i];
                for (var t = 0; t < types.length; t++) {
                    if (b.type === types[t] || b.subtype === types[t]) { return true; }
                }
            }
        }
        // Check housing (Player.houses stores residential properties)
        if (Player.houses && Player.houses.length > 0) {
            for (var h = 0; h < types.length; h++) {
                if (types[h] === 'housing') { return true; }
            }
            // Also match specific housing types (shack, cottage, townhouse, etc.)
            for (var hi = 0; hi < Player.houses.length; hi++) {
                var house = Player.houses[hi];
                for (var ht = 0; ht < types.length; ht++) {
                    if (house.type === types[ht]) { return true; }
                }
            }
        }
        return false;
    }

    /** Evaluate all objectives; return true if every non-optional one is complete. */
    function _allObjectivesMet() {
        var ch = _currentChapterDef();
        if (!ch) { return false; }
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.optional) { continue; }
            if (!obj.done && !_storyState.objectives[obj.id]) { return false; }
        }
        return ch.objectives.length > 0;
    }

    // ───────────────────────────────────────────────
    //  Chapter Lifecycle
    // ───────────────────────────────────────────────

    function _beginChapter(index) {
        if (index < 0 || index >= CHAPTERS.length) { return; }
        _completing = false;

        _storyState.chapter = index;
        _storyState.chapterStartDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;

        var ch = CHAPTERS[index];

        // For the branching chapter, inject the right objectives
        if (ch.branches && _storyState.path) {
            ch.objectives = _cloneObjectives(ch.branches[_storyState.path] || []);
            if (_storyState.path === 'military') {
                _unlockButtons(['world']); // outposts
            }
        } else if (ch.branches && !_storyState.path) {
            // Path not yet chosen — show placeholder objective and ensure choice dialog appears
            ch.objectives = [{ id: '_awaiting_path', type: 'custom', fn: '_checkPathChosen', desc: 'Choose your path: Diplomacy or Military', done: false }];
        } else {
            ch.objectives = _cloneObjectives(ch.objectives.length ? ch.objectives : []);
        }

        // Re-apply any previously-completed objectives (for save/load)
        for (var i = 0; i < ch.objectives.length; i++) {
            if (_storyState.objectives[ch.objectives[i].id]) {
                ch.objectives[i].done = true;
            }
        }

        _unlockButtons(ch.unlockButtons || []);
        _callHook(ch.onStart);
        _showDialog(ch.startDialog);

        _log('Chapter ' + index + ': ' + ch.title);
        _toast('Chapter ' + index + ': ' + ch.title);
        _refreshTracker();
    }

    var _completing = false;
    function _completeChapter() {
        if (_completing) { return; }
        var ch = _currentChapterDef();
        if (!ch) { return; }
        _completing = true;

        _log('Chapter ' + _storyState.chapter + ' complete.');

        // Show endDialog first, then run onComplete hook or advance
        _showDialog(ch.endDialog, function() {
            // If the chapter has an onComplete hook, call it
            // The hook can set deferAdvance to handle advancement itself
            _storyState.flags.deferAdvance = false;
            _callHook(ch.onComplete);

            if (!_storyState.flags.deferAdvance) {
                _advanceToNextChapter();
            }
            // If deferAdvance, the hook is responsible for calling _advanceToNextChapter()
        });
    }

    function _advanceToNextChapter() {
        var next = _storyState.chapter + 1;
        if (next < CHAPTERS.length) {
            _beginChapter(next);
        } else {
            _storyState.complete = true;
            _toast('Story complete — sandbox mode unlocked!');
            _log('The story is complete. All protections removed. Welcome to sandbox mode.');
            // Hide the quest tracker
            if (typeof UI !== 'undefined' && UI.hideStoryTracker) {
                UI.hideStoryTracker();
            }
        }
    }

    // ───────────────────────────────────────────────
    //  Event-Driven Objective Matching
    // ───────────────────────────────────────────────

    /**
     * Check if a bought/sold item matches an objective item spec.
     * Supports: '*' (any), exact id, or 'category:food' style category match.
     */
    function _itemMatches(spec, actualItem) {
        if (spec === '*') { return true; }
        if (spec === actualItem) { return true; }
        // Multi-item: 'swords|bows' matches either
        if (spec && spec.indexOf('|') !== -1) {
            var parts = spec.split('|');
            for (var p = 0; p < parts.length; p++) {
                if (_itemMatches(parts[p].trim(), actualItem)) return true;
            }
            return false;
        }
        // Category match: 'category:food' matches any item with category 'food'
        if (spec && spec.indexOf('category:') === 0) {
            var cat = spec.substring(9);
            var rt = (typeof CONFIG !== 'undefined' && CONFIG.RESOURCE_TYPES)
                ? CONFIG.RESOURCE_TYPES : null;
            if (!rt) {
                rt = (typeof RESOURCE_TYPES !== 'undefined') ? RESOURCE_TYPES : null;
            }
            if (rt) {
                for (var k in rt) {
                    if (rt[k].id === actualItem && rt[k].category === cat) { return true; }
                }
            }
        }
        // Base item match: 'base:swords' matches swords, swords_good, swords_excellent
        if (spec && spec.indexOf('base:') === 0) {
            var baseId = spec.substring(5);
            if (actualItem === baseId) return true;
            var rt2 = (typeof CONFIG !== 'undefined' && CONFIG.RESOURCE_TYPES)
                ? CONFIG.RESOURCE_TYPES : null;
            if (!rt2) rt2 = (typeof RESOURCE_TYPES !== 'undefined') ? RESOURCE_TYPES : null;
            if (rt2) {
                for (var k2 in rt2) {
                    if (rt2[k2].id === actualItem && rt2[k2].baseItem === baseId) return true;
                }
            }
        }
        return false;
    }

    /** Re-evaluate all custom objectives in the current chapter. */
    function _reEvalCustomObjectives() {
        var ch = _currentChapterDef();
        if (!ch) return;
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done || obj.type !== 'custom' || !obj.fn) continue;
            if (!_afterMet(obj)) continue;
            if (_hooks[obj.fn] && _hooks[obj.fn]()) {
                _markDone(obj.id);
                _toast('Objective complete: ' + obj.desc);
                _log('Objective complete: ' + obj.desc);
            }
        }
    }

    /**
     * Map an action type + data to matching objective types and mark them done.
     *
     * @param {string} actionType  e.g. 'buy_item', 'sell_item', 'arrive_town' …
     * @param {object} data        action-specific payload
     */
    function _matchAction(actionType, data) {
        var ch = _currentChapterDef();
        if (!ch) { return; }

        // Noble intrigue actions: track all three metrics for diplomatic path
        if (actionType === 'noble_intrigue' && data) {
            // Check if target kingdom is the enemy (Korvath) during diplomatic path
            if (_storyState.path === 'diplomatic' && data.targetKingdomId) {
                var enemyKingdom = _storyState.flags.enemyKingdomId;
                if (data.targetKingdomId === enemyKingdom) {
                    // Track loyalty reduction (from turnNobleAgainstKing)
                    if (data.loyaltyReduced) {
                        _storyState.flags._loyaltyTotal = (_storyState.flags._loyaltyTotal || 0) + data.loyaltyReduced;
                        for (var li = 0; li < ch.objectives.length; li++) {
                            if (ch.objectives[li].id === 'ch17a_undermine_loyalty') {
                                var lt = Math.min(_storyState.flags._loyaltyTotal, 100);
                                ch.objectives[li].desc = 'Turn nobles against their king \u2014 reduce loyalty by 100 total (' + lt + '/100)';
                                break;
                            }
                        }
                    }
                    // Track perceived loyalty reduction (from discreditNoble, exposeNobleSecrets)
                    if (data.perceivedLoyaltyReduced) {
                        _storyState.flags._perceivedTotal = (_storyState.flags._perceivedTotal || 0) + data.perceivedLoyaltyReduced;
                        for (var pi = 0; pi < ch.objectives.length; pi++) {
                            if (ch.objectives[pi].id === 'ch17a_undermine_perceived') {
                                var pt = Math.min(_storyState.flags._perceivedTotal, 50);
                                ch.objectives[pi].desc = 'Discredit nobles \u2014 reduce perceived loyalty by 50 total (' + pt + '/50)';
                                break;
                            }
                        }
                    }
                    // Track reputation/relationship damage between nobles (from pitNobles, discreditNoble, exposeSecrets)
                    if (data.relationshipDamage) {
                        _storyState.flags._reputationTotal = (_storyState.flags._reputationTotal || 0) + data.relationshipDamage;
                        for (var ri = 0; ri < ch.objectives.length; ri++) {
                            if (ch.objectives[ri].id === 'ch17a_undermine_reputation') {
                                var rt = Math.min(_storyState.flags._reputationTotal, 50);
                                ch.objectives[ri].desc = 'Sow discord \u2014 damage noble reputation by 50 total (' + rt + '/50)';
                                break;
                            }
                        }
                    }
                }
            }
            _reEvalCustomObjectives();
            return;
        }

        // Track agent sabotage/arson for military path
        if (actionType === 'agent_sabotage' || actionType === 'player_sabotage') {
            if (_storyState.path === 'military') {
                _storyState.flags._sabotageCount = (_storyState.flags._sabotageCount || 0) + 1;
                var sc = _storyState.flags._sabotageCount;
                for (var si = 0; si < ch.objectives.length; si++) {
                    if (ch.objectives[si].id === 'ch17b_sabotage') {
                        ch.objectives[si].desc = 'Sabotage or burn ' + 3 + ' buildings in enemy territory (' + Math.min(sc, 3) + '/3)';
                        break;
                    }
                }
            }
            _reEvalCustomObjectives();
            return;
        }

        // Track treasury donations for military path
        if (actionType === 'donate_gold') {
            if (_storyState.path === 'military' && data.amount) {
                _storyState.flags._treasuryDonated = (_storyState.flags._treasuryDonated || 0) + data.amount;
                var td = _storyState.flags._treasuryDonated;
                for (var di = 0; di < ch.objectives.length; di++) {
                    if (ch.objectives[di].id === 'ch17b_donate_treasury') {
                        ch.objectives[di].desc = 'Donate 10,000g to the kingdom treasury (' + Math.min(td, 10000) + '/10000)';
                        break;
                    }
                }
            }
            _reEvalCustomObjectives();
            return;
        }

        // Track cross-kingdom caravan trade for diplomatic path
        if (actionType === 'caravan_trade_complete') {
            if (_storyState.path === 'diplomatic' && data.goldValue) {
                _storyState.flags._crossKingdomTrade = (_storyState.flags._crossKingdomTrade || 0) + data.goldValue;
                var ct = _storyState.flags._crossKingdomTrade;
                for (var ci2 = 0; ci2 < ch.objectives.length; ci2++) {
                    if (ch.objectives[ci2].id === 'ch17a_trade_value') {
                        ch.objectives[ci2].desc = 'Trade 10,000g worth of goods via caravans between kingdoms (' + Math.min(ct, 10000) + '/10000)';
                        break;
                    }
                }
            }
            _reEvalCustomObjectives();
            return;
        }

        // Track agent task assignments
        if (actionType === 'assign_agent_task') {
            if (data.category === 'hostile') {
                _storyState.flags._agentHostileAssigned = true;
            }
            if (data.category === 'diplomatic') {
                _storyState.flags._agentDiplomaticAssigned = true;
            }
            _reEvalCustomObjectives();
            return;
        }

        // Track agent hiring
        if (actionType === 'hire_agent') {
            _storyState.flags._hasAgent = true;
            _reEvalCustomObjectives();
            return;
        }

        // Special action types that re-evaluate custom objectives
        if (actionType === 'buy_land' || actionType === 'rest' || actionType === 'own_building' || actionType === 'attend_festival') {
            if (actionType === 'attend_festival') {
                _storyState.flags.festivalAttended = true;
            }
            _reEvalCustomObjectives();
            // buy_land and attend_festival have no typed objectives — done here
            if (actionType === 'buy_land' || actionType === 'attend_festival') return;
            // rest and own_building fall through to match typed objectives below
        }

        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) { continue; }
            // Map action types to objective types (supply_kingdom objectives match sell_to_kingdom and deliver_commission actions)
            var objTypeMatch = (obj.type === actionType) ||
                               (obj.type === 'supply_kingdom' && (actionType === 'sell_to_kingdom' || actionType === 'deliver_commission')) ||
                               (obj.type === 'produce_item' && actionType === 'produce_item') ||
                               (obj.type === 'buy_horse' && actionType === 'buy_item' && data.item === 'horses');
            if (!objTypeMatch) { continue; }
            // Sequential gating: if objective has 'after' dependency, skip until that is done
            if (!_afterMet(obj)) { continue; }

            var matched = false;
            // Handle produce_item objectives (matches produce_item actions from player buildings)
            if (obj.type === 'produce_item' && actionType === 'produce_item') {
                if (_itemMatches(obj.item, data.item)) {
                    if (!obj._progress) obj._progress = 0;
                    obj._progress += (data.qty || 1);
                    var needed = obj.qty || 1;
                    obj.desc = obj.desc.replace(/\(\d+\/\d+\)/, '(' + Math.min(obj._progress, needed) + '/' + needed + ')');
                    matched = obj._progress >= needed;
                    if (!matched) _refreshTracker();
                }
            }
            // Handle supply_kingdom objectives (matches sell_to_kingdom and deliver_commission actions)
            else if (obj.type === 'supply_kingdom' && (actionType === 'sell_to_kingdom' || actionType === 'deliver_commission')) {
                if (_itemMatches(obj.item, data.item)) {
                    if (!obj._progress) obj._progress = 0;
                    obj._progress += (data.qty || 1);
                    // Update description with progress
                    var needed = obj.qty || 1;
                    obj.desc = obj.desc.replace(/\(\d+\/\d+\)/, '(' + Math.min(obj._progress, needed) + '/' + needed + ')');
                    matched = obj._progress >= needed;
                    if (!matched) _refreshTracker();
                }
            }
            // Handle buy_horse objectives when action is buy_item with horses
            else if (obj.type === 'buy_horse' && actionType === 'buy_item' && data.item === 'horses') {
                matched = true;
            } else {
            // Standard action type matching
            switch (actionType) {
                case 'buy_item':
                    if (_itemMatches(obj.item, data.item)) {
                        var needed = obj.qty || 1;
                        var bought = data.qty || 1;
                        // Accumulate progress for multi-purchase objectives
                        if (!obj._progress) { obj._progress = 0; }
                        obj._progress += bought;
                        matched = obj._progress >= needed;
                    }
                    break;

                case 'sell_item':
                    if (_itemMatches(obj.item, data.item)) {
                        // Check town restriction if specified
                        if (obj.town) {
                            var sellTown = data.town || data.townName || '';
                            if (!sellTown && data.townId) {
                                var pt = Engine.findTown ? Engine.findTown(data.townId) : null;
                                if (pt) sellTown = pt.name;
                            }
                            if (!sellTown && typeof Player !== 'undefined' && Player.state) {
                                var pt2 = Engine.findTown ? Engine.findTown(Player.state.townId) : null;
                                if (pt2) sellTown = pt2.name;
                            }
                            if (sellTown !== obj.town) break;
                        }
                        if (obj.qty) {
                            if (!obj._progress) obj._progress = 0;
                            obj._progress += (data.qty || 1);
                            matched = obj._progress >= obj.qty;
                        } else {
                            matched = true;
                        }
                    }
                    break;

                case 'arrive_town':
                    var arrTown = data.town || data.townName || '';
                    if (obj.town && obj.town.charAt(0) === '!') {
                        matched = arrTown !== obj.town.substring(1);
                    } else {
                        matched = (arrTown === obj.town);
                    }
                    // Optional kingdom filter
                    if (matched && obj.kingdom && data.townId) {
                        var arrTownObj = (typeof Engine !== 'undefined' && Engine.findTown) ? Engine.findTown(data.townId) : null;
                        if (arrTownObj) {
                            var arrK = (typeof Engine !== 'undefined' && Engine.getKingdom) ? Engine.getKingdom(arrTownObj.kingdomId) : null;
                            if (!arrK || arrK.name !== obj.kingdom) matched = false;
                        }
                    }
                    break;

                case 'own_building':
                    matched = _playerOwnsBuilding(obj.building);
                    break;

                case 'build_building':
                    var allowed = (obj.building || '').split('|');
                    matched = allowed.indexOf(data.building) !== -1;
                    break;

                case 'work_shift':
                    var wsBldg = data.building || data.buildingType || '';
                    if (!obj.building) { matched = true; }
                    else {
                        var wsAllowed = obj.building.split('|');
                        matched = wsAllowed.indexOf(wsBldg) !== -1;
                    }
                    break;

                case 'send_caravan':
                    matched = true;
                    // Check requiredOrders if specified
                    if (obj.requiredOrders && data.orders) {
                        for (var roi = 0; roi < obj.requiredOrders.length; roi++) {
                            var req = obj.requiredOrders[roi];
                            var found = false;
                            for (var oi = 0; oi < data.orders.length; oi++) {
                                var ord = data.orders[oi];
                                var actMatch = (req.action === 'pickup' && ord.action === 'pickup') ||
                                               (req.action === 'sell' && ord.action === 'sell') ||
                                               (req.action === 'buy' && ord.action === 'buy') ||
                                               (req.action === 'store' && ord.action === 'store');
                                if (actMatch && (!req.item || ord.item === req.item)) {
                                    if (!req.town || ord.townName === req.town || ord.town === req.town) {
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if (!found) { matched = false; break; }
                        }
                    }
                    break;

                case 'hire_worker':
                    matched = true;
                    break;

                case 'assign_worker':
                    if (!obj.building) { matched = true; }
                    else {
                        var awAllowed = obj.building.split('|');
                        matched = awAllowed.indexOf(data.building) !== -1;
                    }
                    break;

                case 'street_trade':
                    matched = true;
                    break;

                case 'open_street_trading':
                    matched = true;
                    break;

                case 'equip_item':
                    if (obj.slot && data.slot !== obj.slot) break;
                    matched = true;
                    break;

                case 'hire_guard':
                    matched = true;
                    break;

                case 'install_addon':
                    if (obj.addon && data.addon !== obj.addon) break;
                    matched = true;
                    break;

                case 'home_craft':
                    matched = true;
                    break;

                case 'guild_craft':
                    matched = true;
                    break;

                case 'open_help_guide':
                    matched = true;
                    break;

                case 'buy_horse':
                    matched = true;
                    break;

                case 'mount_horse':
                    matched = true;
                    break;

                case 'upgrade_building':
                    matched = true;
                    break;

                case 'toggle_autobuy':
                    matched = true;
                    break;

                case 'build_ship':
                    matched = true;
                    break;

                case 'collect_output':
                    if (obj.item && data.item !== obj.item) break;
                    if (obj.qty) {
                        if (!obj._progress) obj._progress = 0;
                        obj._progress += (data.qty || 1);
                        var coNeeded = obj.qty || 1;
                        obj.desc = obj.desc.replace(/\(\d+\/\d+\)/, '(' + Math.min(obj._progress, coNeeded) + '/' + coNeeded + ')');
                        matched = obj._progress >= coNeeded;
                        if (!matched) _refreshTracker();
                    } else {
                        matched = true;
                    }
                    break;

                case 'treat_person':
                    if (!obj.person) { matched = true; }
                    else {
                        // Match by person name — resolve targetId to name
                        var tpName = data.person || '';
                        if (!tpName && data.targetId && typeof Engine !== 'undefined' && Engine.findPerson) {
                            var tpPerson = Engine.findPerson(data.targetId);
                            if (tpPerson) tpName = tpPerson.firstName || tpPerson.fullName || '';
                        }
                        matched = tpName === obj.person;
                    }
                    break;

                case 'buy_skill':
                    matched = !obj.skill || obj.skill === '*' || data.skill === obj.skill;
                    break;

                case 'join_guild':
                    matched = !obj.guild || obj.guild === '*' || data.guild === obj.guild;
                    break;

                case 'attend_feast':
                    matched = true;
                    break;

                case 'attend_court':
                    matched = true;
                    break;

                case 'reach_rank':
                    matched = data.rank >= (obj.rank || 0);
                    break;

                case 'own_gold':
                    matched = (typeof Player !== 'undefined') && Player.gold >= (obj.amount || 0);
                    break;

                case 'rest':
                    matched = true;
                    break;

                default:
                    break;
            }
            } // end else (standard action type matching)

            if (matched) {
                _markDone(obj.id);
                _toast('Objective complete: ' + obj.desc);
                _log('Objective complete: ' + obj.desc);

                // Special: Ch3 arrive Ferrowdale — narrator introduces Harlan, then Harlan greets
                if (obj.id === 'ch3_arrive_ferrowdale') {
                    _showDialog('ch3_harlan_intro', function() {
                        _showDialog('ch3_harlan_meet');
                    });
                }
            }
        }
    }

    // ───────────────────────────────────────────────
    //  Chapter Hook Functions
    // ───────────────────────────────────────────────

    var _hooks = {};

    // ── Prologue ──
    _hooks._onPrologueStart = function () {
        // Prologue has no objectives; auto-advance after dialog
        _storyState.chapterStartDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
    };

    // ── Ch 1 ──
    _hooks._onChapter1Start = function () {
        // Mother gives 15 gold
        if (typeof Player !== 'undefined') {
            if (Player.modifyGold) { Player.modifyGold(15, 'Birthday gift from mother'); }
            else { Player.state.gold += 15; }
            _log('Mother gives you 15 gold for your 18th birthday.');
        }
    };

    // ── Ch 3: The Delivery ──
    _hooks._onChapter3Start = function () {
        // Father gives tools to deliver to Ferrowdale
        if (typeof Player !== 'undefined' && Player.modifyInventory) {
            Player.modifyInventory(Player.state.inventory, 'tools', 5);
            _log('Father hands you 5 sets of tools to deliver to Ferrowdale.');
            // Track gold before selling so we know how much was earned
            _storyState.flags.ch3GoldBefore = Player.gold || 0;
        }
    };

    // ── Ch 4: The Art of the Deal — Father takes tool gold on completion ──
    _hooks._onChapter4Complete = function () {
        // Father takes half the gold earned from the tool delivery (ch3)
        if (typeof Player === 'undefined') { return; }
        var goldBefore = _storyState.flags.ch3GoldBefore || 0;
        var currentGold = Player.gold || 0;
        var earned = Math.max(0, currentGold - goldBefore);
        var halfEarned = Math.floor(earned / 2);

        // Defer chapter advancement until father dialog is dismissed
        _storyState.flags.deferAdvance = true;

        if (halfEarned > 0 && currentGold >= halfEarned) {
            // Father takes his half, player keeps the rest
            Player.state.gold -= halfEarned;
            _log('Father takes ' + halfEarned + 'g — his share of the tools. You keep ' + (currentGold - halfEarned) + 'g.');
            _showDialog('ch3_father_takes_gold', function() {
                _advanceToNextChapter();
            });
        } else {
            // Player doesn't have enough — father admonishes
            var took = Math.max(0, currentGold);
            if (took > 0) Player.state.gold = 0;
            _log('Father is disappointed. He takes your remaining ' + took + 'g and scolds you.');
            _showDialog('ch3_father_admonish', function() {
                _advanceToNextChapter();
            });
        }
    };

    // ── Ch 7: War ──
    _hooks._onChapter7Start = function () {
        _storyState.flags.warDeclared = true;
        if (typeof Engine !== 'undefined' && Engine.getWorld) {
            var w = Engine.getWorld();
            if (w && w.kingdoms) {
                var kA = w.kingdoms.find(function(k) { return k.name === 'Valdren'; });
                var kB = w.kingdoms.find(function(k) { return k.name === 'Korvath'; });
                if (kA && kB && Engine.declareWar) Engine.declareWar(kA, kB, true);
            }
            if (Engine.banExport) { Engine.banExport('iron_bars'); }

            // Remove iron ore from Ashford — war cuts off supply
            var ashford = (w.towns || []).find(function(t) { return t.name === 'Ashford'; });
            if (ashford) {
                if (ashford.naturalDeposits) ashford.naturalDeposits.iron_ore = 0;
                if (ashford.market && ashford.market.supply) {
                    ashford.market.supply['iron_ore'] = 0;
                }
            }
        }
        _log('War has been declared between Valdren and Korvath.');
    };

    _hooks._checkWarDialogSeen = function () {
        return _storyState.dialogsSeen.indexOf('ch7_war_crier') !== -1;
    };

    // ── Ch 8: Fire and Iron — clear iron ore from Ashford ──
    _hooks._onChapter8Start = function () {
        var w = Engine.getWorld ? Engine.getWorld() : null;
        if (!w || !w.towns) return;
        var ashford = w.towns.find(function(t) { return t.name === 'Ashford'; });
        if (ashford && ashford.market && ashford.market.supply) {
            ashford.market.supply['iron_ore'] = 0;
        }
    };

    // ── Ch 10: Bread and Butter — seed bricks in Ashford & Ferrowdale ──
    _hooks._onChapter10Start = function () {
        var w = Engine.getWorld ? Engine.getWorld() : null;
        if (!w || !w.towns) return;
        var storyTowns = ['Ashford', 'Ferrowdale'];
        for (var sti = 0; sti < storyTowns.length; sti++) {
            var t = w.towns.find(function(tt) { return tt.name === storyTowns[sti]; });
            if (t && t.market && t.market.supply) {
                t.market.supply.bricks = (t.market.supply.bricks || 0) + 20;
            }
        }
        _log('Building materials are now available in local markets.');
    };

    // ── Ch 11: Family Crisis ──

    /** Find a family NPC by role, using storyNPCs first then familyMembers fallback. */
    function _findFamilyNPC(role) {
        if (typeof Engine === 'undefined' || typeof Player === 'undefined') return null;
        var sNPCs = Player.storyMode ? Player.storyMode.storyNPCs : null;
        var key = role === 'father' ? 'fatherId' : 'motherId';
        if (sNPCs && sNPCs[key]) {
            var npc = Engine.findPerson(sNPCs[key]);
            if (npc) return npc;
        }
        if (Player.familyMembers) {
            var entry = Player.familyMembers.find(function(f) { return f.role === role && f.alive; });
            if (entry) return Engine.findPerson(entry.npcId || entry.id);
        }
        return null;
    }

    /** Ensure ch11 injury/illness conditions are applied to NPCs (idempotent). */
    function _ensureCh11Conditions() {
        var day = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        // Get the player's town so we can force family to be there
        var playerTownId = (typeof Player !== 'undefined') ? Player.townId : null;
        if (_storyState.flags.edmundInjured) {
            var edmund = _findFamilyNPC('father');
            if (edmund) {
                // Force Edmund to be in same town as player so treatment dialog shows him
                if (playerTownId && edmund.townId !== playerTownId) {
                    edmund.townId = playerTownId;
                }
                edmund.injuries = edmund.injuries || [];
                if (!edmund.injuries.some(function(inj) { return inj.type === 'burn'; })) {
                    edmund.injuries.push({ type: 'burn', severity: 'moderate', desc: 'Forge burn', dayOccurred: day });
                    _log('Applied burn injury to Edmund');
                }
                edmund.injured = true;
                edmund.injuryType = 'burn';
                edmund.injuryName = 'Forge burn';
                edmund.injurySeverity = 'moderate';
                edmund.injuryDay = day; // reset so auto-heal timer restarts
                // Block NPC auto-treatment (hospital queue system)
                edmund._illnessTreatPaid = false;
                edmund._storyBlockTreatment = true;
                if (edmund.health > 60) edmund.health = 60;
            }
        }
        if (_storyState.flags.margretIll) {
            var margret = _findFamilyNPC('mother');
            if (margret) {
                // Force Margret to be in same town as player so treatment dialog shows her
                if (playerTownId && margret.townId !== playerTownId) {
                    margret.townId = playerTownId;
                }
                margret.illnesses = margret.illnesses || [];
                if (!margret.illnesses.some(function(ill) { return ill.type === 'fever'; })) {
                    margret.illnesses.push({ type: 'fever', severity: 'moderate', desc: 'Persistent fever', dayOccurred: day });
                    _log('Applied fever illness to Margret');
                }
                margret.sick = true;
                margret.illness = 'fever';
                margret.illnessDay = day; // reset so auto-heal timer restarts
                margret.illnessSeverity = 'moderate';
                // Block NPC auto-treatment (hospital queue system)
                margret._illnessTreatPaid = false;
                margret._storyBlockTreatment = true;
                if (margret.health > 50) margret.health = 50;
            }
        }
    }

    _hooks._onChapter11Start = function () {
        _storyState.flags.edmundInjured = true;
        _storyState.flags.margretIll    = true;
        _ensureCh11Conditions();
        _log('Father has been injured at the forge. Mother has fallen ill.');
    };

    _hooks._onChapter11Complete = function () {
        _storyState.flags.edmundInjured = false;
        _storyState.flags.margretIll    = false;
        // Heal story NPCs
        if (typeof Engine !== 'undefined' && typeof Player !== 'undefined') {
            var sNPCs = Player.storyMode ? Player.storyMode.storyNPCs : null;
            if (sNPCs) {
                var edmund = sNPCs.fatherId ? Engine.findPerson(sNPCs.fatherId) : null;
                var margret = sNPCs.motherId ? Engine.findPerson(sNPCs.motherId) : null;
                if (edmund) { edmund.injuries = []; edmund.health = 100; edmund.injured = false; edmund._storyBlockTreatment = false; }
                if (margret) { margret.illnesses = []; margret.health = 100; margret.sick = false; margret._storyBlockTreatment = false; }
            }
        }
    };

    // ── Ch 12: Festival ──
    _hooks._onChapter12Start = function () {
        if (typeof Engine !== 'undefined' && Engine.triggerFestival) {
            Engine.triggerFestival('Ashford');
        }
    };

    _hooks._checkFestivalAttended = function () {
        return !!_storyState.flags.festivalAttended;
    };

    _hooks._checkMetCalder = function () {
        return _storyState.flags.metLordCalder;
    };

    // ── Ch 13: Fall of Ashford ──
    _hooks._onChapter13Start = function () {
        _storyState.flags.ashfordCaptured   = true;
        _storyState.flags.edmundImprisoned  = true;
        if (typeof Engine !== 'undefined') {
            if (Engine.captureTown)     { Engine.captureTown('Ashford', 'Korvath'); }
            if (Engine.setNPCCondition) { Engine.setNPCCondition('Edmund', 'imprisoned', true); }
        }
        _log('Korvath has invaded Ashford. Father has been imprisoned.');
    };

    // ── Ch 14 ──
    _hooks._onChapter14Start = function () {
        // Update objective description with actual capital name
        if (typeof Engine !== 'undefined' && Engine.getWorld) {
            var w = Engine.getWorld();
            if (w && w.kingdoms) {
                var valdren = w.kingdoms.find(function(k) { return k.name === 'Valdren'; });
                if (valdren && valdren.capitalTownId) {
                    var capTown = Engine.findTown(valdren.capitalTownId);
                    if (capTown) {
                        var ch = _currentChapterDef();
                        if (ch) {
                            for (var i = 0; i < ch.objectives.length; i++) {
                                if (ch.objectives[i].id === 'ch14_meet_calder') {
                                    ch.objectives[i].desc = 'Meet Lord Calder in ' + capTown.name;
                                    break;
                                }
                            }
                        }
                        _refreshTracker();
                    }
                }
            }
        }
    };

    _hooks._checkMetCalderCapital = function () {
        return !!_storyState.flags.metLordCalderCapital;
    };

    // ── Ch 16 ──
    _hooks._onChapter16Start = function () {
        // Update feast/court objective descriptions with actual capital town name
        if (typeof Engine !== 'undefined' && Engine.getWorld) {
            var w = Engine.getWorld();
            if (w && w.kingdoms) {
                var valdren = w.kingdoms.find(function(k) { return k.name === 'Valdren'; });
                if (valdren && valdren.capitalTownId) {
                    var capTown = Engine.findTown(valdren.capitalTownId);
                    if (capTown) {
                        var ch = _currentChapterDef();
                        if (ch) {
                            for (var i = 0; i < ch.objectives.length; i++) {
                                if (ch.objectives[i].id === 'ch16_attend_feast') {
                                    ch.objectives[i].desc = 'Attend a noble feast in ' + capTown.name;
                                } else if (ch.objectives[i].id === 'ch16_attend_court') {
                                    ch.objectives[i].desc = 'Attend the royal court in ' + capTown.name;
                                }
                            }
                        }
                        _refreshTracker();
                    }
                }
            }
        }
    };

    // ── Ch 5 ──
    _hooks._checkOwnsLand = function () {
        if (typeof Player === 'undefined') return false;
        var totalLand = 0;
        if (Player.state && Player.state.landOwned) {
            for (var tid in Player.state.landOwned) totalLand += (Player.state.landOwned[tid] || 0);
        } else if (Player.landOwned) {
            for (var tid2 in Player.landOwned) totalLand += (Player.landOwned[tid2] || 0);
        }
        return totalLand > 0;
    };

    _hooks._checkRested = function () {
        // Check if player has rested (energy > 80) while owning housing
        if (typeof Player !== 'undefined') {
            var houses = Player.houses || [];
            var hasHousing = houses.length > 0;
            var rested = Player.energy >= 80;
            return hasHousing && rested;
        }
        return false;
    };

    // ── Ch 17: Branching ──
    _hooks._onChapter17Start = function () {
        // The start dialog presents a choice; once the player picks,
        // UI calls StoryMode.setWarPath('diplomatic'|'military').
        // Objectives are injected at that point.
    };

    _hooks._checkConvincedRask = function () {
        return !!_storyState.flags.convincedRask;
    };

    _hooks._checkPathChosen = function () {
        return !!_storyState.path;
    };

    _hooks._checkUndermineLoyalty = function () {
        var done = (_storyState.flags._loyaltyTotal || 0) >= 100;
        if (done) _tryTriggerConspiracy();
        return done;
    };

    _hooks._checkUnderminePerceived = function () {
        var done = (_storyState.flags._perceivedTotal || 0) >= 50;
        if (done) _tryTriggerConspiracy();
        return done;
    };

    _hooks._checkUndermineReputation = function () {
        var done = (_storyState.flags._reputationTotal || 0) >= 50;
        if (done) _tryTriggerConspiracy();
        return done;
    };

    function _tryTriggerConspiracy() {
        if (_storyState.flags._conspiracyTriggered) return;
        // All intrigue objectives must be done
        if ((_storyState.flags._loyaltyTotal || 0) >= 100 &&
            (_storyState.flags._perceivedTotal || 0) >= 50 &&
            (_storyState.flags._reputationTotal || 0) >= 50 &&
            // Also require other diplomatic path objectives
            _storyState.objectives.ch17a_hire_agent &&
            _storyState.objectives.ch17a_agent_diplo &&
            _storyState.objectives.ch17a_found_outpost &&
            _storyState.objectives.ch17a_outpost_pop &&
            _storyState.objectives.ch17a_outpost_happy &&
            _storyState.objectives.ch17a_trade_value) {
            _storyState.flags._conspiracyTriggered = true;
            _showDialog('ch17a_conspiracy_success', function () {
                // Dialog completion sets diplomaticVictory via _dialogFlagMap
            });
        }
    }

    _hooks._checkDiplomaticVictory = function () {
        return !!_storyState.flags.diplomaticVictory;
    };

    _hooks._checkBattleWon = function () {
        if (_storyState.flags.battleWon) return true;
        // Auto-trigger battle once ALL military objectives are done
        if (_storyState.objectives.ch17b_produce_weapons &&
            _storyState.objectives.ch17b_produce_armor &&
            _storyState.objectives.ch17b_produce_horses &&
            _storyState.objectives.ch17b_supply_weapons &&
            _storyState.objectives.ch17b_supply_armor &&
            _storyState.objectives.ch17b_supply_horses &&
            _storyState.objectives.ch17b_hire_agent &&
            _storyState.objectives.ch17b_agent_hostile &&
            _storyState.objectives.ch17b_found_outpost &&
            _storyState.objectives.ch17b_outpost_pop &&
            _storyState.objectives.ch17b_outpost_road_ferro &&
            _storyState.objectives.ch17b_outpost_road_ash &&
            _storyState.objectives.ch17b_sabotage &&
            _storyState.objectives.ch17b_donate_treasury &&
            !_storyState.flags._battleTriggered) {
            _storyState.flags._battleTriggered = true;
            _showDialog('ch17b_battle_victory', function() {
                // Battle victory dialog sets battleWon flag via _onDialogCompleted
            });
        }
        return false;
    };

    // ── New Ch17 objective hooks ──

    // Agent hiring check (both paths)
    _hooks._checkHasAgent = function () {
        if (_storyState.flags._hasAgent) return true;
        if (typeof Player !== 'undefined' && Player.state) {
            var agents = Player.state.agents || [];
            if (agents.length > 0) {
                _storyState.flags._hasAgent = true;
                return true;
            }
        }
        return false;
    };

    // Agent assigned to hostile task (military path)
    _hooks._checkAgentHostileTask = function () {
        if (_storyState.flags._agentHostileAssigned) return true;
        if (typeof Player !== 'undefined' && Player.state) {
            var agents = Player.state.agents || [];
            for (var i = 0; i < agents.length; i++) {
                if (agents[i].task && agents[i].task.type) {
                    var tDefs = Player.getAgentData ? Player.getAgentData().taskDefs : {};
                    var tDef = tDefs[agents[i].task.type];
                    if (tDef && tDef.category === 'hostile') {
                        _storyState.flags._agentHostileAssigned = true;
                        return true;
                    }
                }
            }
        }
        return false;
    };

    // Agent assigned to diplomatic task (diplomatic path)
    _hooks._checkAgentDiplomaticTask = function () {
        if (_storyState.flags._agentDiplomaticAssigned) return true;
        if (typeof Player !== 'undefined' && Player.state) {
            var agents = Player.state.agents || [];
            for (var i = 0; i < agents.length; i++) {
                if (agents[i].task && agents[i].task.type) {
                    var tDefs = Player.getAgentData ? Player.getAgentData().taskDefs : {};
                    var tDef = tDefs[agents[i].task.type];
                    if (tDef && tDef.category === 'diplomatic') {
                        _storyState.flags._agentDiplomaticAssigned = true;
                        return true;
                    }
                }
            }
        }
        return false;
    };

    // Military outpost checks
    _hooks._checkMilitaryOutpost = function () {
        if (typeof Player !== 'undefined' && Player.state) {
            var outposts = Player.state.outposts || [];
            for (var i = 0; i < outposts.length; i++) {
                var op = outposts[i];
                // Check for security upgrades (wall level >= 1)
                if ((op.wallLevel || 0) >= 1) return true;
            }
        }
        return false;
    };

    _hooks._checkMilitaryOutpostPop = function () {
        if (typeof Player !== 'undefined' && Player.state) {
            var outposts = Player.state.outposts || [];
            for (var i = 0; i < outposts.length; i++) {
                if ((outposts[i].population || 0) >= 10) return true;
            }
        }
        return false;
    };

    // Check road from any player outpost to Ferrowdale
    _hooks._checkOutpostRoadFerro = function () {
        return _checkOutpostRoadTo('Ferrowdale');
    };

    // Check road from any player outpost to Ashford
    _hooks._checkOutpostRoadAshford = function () {
        return _checkOutpostRoadTo('Ashford');
    };

    function _checkOutpostRoadTo(townName) {
        if (typeof Player === 'undefined' || typeof Engine === 'undefined') return false;
        var outposts = (Player.state && Player.state.outposts) || [];
        if (outposts.length === 0) return false;
        var world = Engine.getWorldState ? Engine.getWorldState() : null;
        if (!world || !world.roads) return false;

        // Find the target town
        var targetTownId = null;
        var towns = world.towns || [];
        for (var ti = 0; ti < towns.length; ti++) {
            if (towns[ti].name === townName) { targetTownId = towns[ti].id; break; }
        }
        if (!targetTownId) return false;

        // Check if any outpost has a road connecting to the target town
        for (var oi = 0; oi < outposts.length; oi++) {
            var opId = outposts[oi].id || outposts[oi].townId;
            for (var ri = 0; ri < world.roads.length; ri++) {
                var road = world.roads[ri];
                if ((road.from === opId && road.to === targetTownId) ||
                    (road.to === opId && road.from === targetTownId)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Diplomatic outpost checks
    _hooks._checkDiploOutpost = function () {
        if (typeof Player === 'undefined' || typeof Engine === 'undefined') return false;
        var outposts = (Player.state && Player.state.outposts) || [];
        if (outposts.length === 0) return false;
        // Check if any outpost is connected to Ashford via road
        return _checkOutpostRoadTo('Ashford');
    };

    _hooks._checkDiploOutpostPop = function () {
        if (typeof Player !== 'undefined' && Player.state) {
            var outposts = Player.state.outposts || [];
            for (var i = 0; i < outposts.length; i++) {
                if ((outposts[i].population || 0) >= 10) return true;
            }
        }
        return false;
    };

    _hooks._checkDiploOutpostHappy = function () {
        if (typeof Player !== 'undefined' && Player.state) {
            var outposts = Player.state.outposts || [];
            for (var i = 0; i < outposts.length; i++) {
                if ((outposts[i].happiness || 0) >= 60) return true;
            }
        }
        return false;
    };

    // Sabotage 3 buildings in enemy territory
    _hooks._checkSabotage3 = function () {
        return (_storyState.flags._sabotageCount || 0) >= 3;
    };

    // Donated 10k to kingdom treasury
    _hooks._checkDonatedTreasury = function () {
        return (_storyState.flags._treasuryDonated || 0) >= 10000;
    };

    // Cross-kingdom caravan trade >= 10000
    _hooks._checkCrossKingdomTrade = function () {
        return (_storyState.flags._crossKingdomTrade || 0) >= 10000;
    };

    // ── Ch 18: Reunion ──
    _hooks._onChapter18Start = function () {
        _storyState.flags.edmundImprisoned  = false;
        _storyState.flags.edmundFreed       = true;
        if (typeof Engine !== 'undefined') {
            if (Engine.setNPCCondition) { Engine.setNPCCondition('Edmund', 'imprisoned', false); }
            // Military path: Valdren recaptures Ashford
            if (_storyState.path === 'military') {
                _storyState.flags.ashfordLiberated = true;
                _storyState.flags.ashfordCaptured  = false;
                if (Engine.captureTown) { Engine.captureTown('Ashford', 'Valdren'); }
                _log('Ashford has been liberated. Father is free.');
            } else {
                // Diplomatic path: Ashford stays under Korvath, but father is released
                _log('The Korvathi nobles have freed your father. Ashford remains under their control, but Edmund walks free.');
            }
        }
    };

    _hooks._checkTalkedToEdmund = function () {
        return !!_storyState.flags.talkedToEdmund;
    };

    // ── Ch 19: Finale ──
    _hooks._checkCeremonyAttended = function () {
        return !!_storyState.flags.ceremonyAttended;
    };

    _hooks._onChapter19Complete = function () {
        // Remove all story protections
        _storyState.flags.suppressEncounters = false;
        _storyState.flags.suppressDisease    = false;
        _storyState.flags.protectFamily      = false;
        _storyState.complete = true;

        // Unlock every tab
        var allTabs = ['actions', 'business', 'character', 'world', 'system'];
        _unlockButtons(allTabs);

        _log('All story protections removed. Sandbox mode is now active.');
        _toast('Congratulations! Sandbox mode unlocked.');
    };

    // ── Ch 4b: The Road is Dangerous ──
    _hooks._onChapter4bStart = function () {
        // Scripted bandit encounter — take some gold, don't kill player
        if (typeof Player === 'undefined' || !Player.state) return;
        var goldLost = Math.min(Math.max(5, Math.floor((Player.state.gold || 0) * 0.15)), 50);
        Player.state.gold = Math.max(0, (Player.state.gold || 0) - goldLost);
        if (!Player.state.storyMode) Player.state.storyMode = {};
        Player.state.storyMode._ch4b_robbed = true;
        Player.state.storyMode._ch4b_goldLost = goldLost;
        _toast('Bandits robbed you of ' + goldLost + 'g on the road!');
        _log('Bandits robbed you of ' + goldLost + 'g.');
    };

    // ── Custom check functions for b-chapters ──
    _hooks._checkOpenedStreetTrading = function () {
        return typeof Player !== 'undefined' && Player.state && Player.state.storyMode && Player.state.storyMode._openedStreetTrading;
    };

    _hooks._checkOpenedHelp = function () {
        return typeof Player !== 'undefined' && Player.state && Player.state.storyMode && Player.state.storyMode._openedHelp;
    };

    _hooks._checkViewedEventLog = function () {
        return typeof Player !== 'undefined' && Player.state && Player.state.storyMode && Player.state.storyMode._viewedEventLog;
    };

    _hooks._checkToggledFilter = function () {
        return typeof Player !== 'undefined' && Player.state && Player.state.storyMode && Player.state.storyMode._toggledFilter;
    };

    _hooks._checkViewedFeats = function () {
        return typeof Player !== 'undefined' && Player.state && Player.state.storyMode && Player.state.storyMode._viewedFeats;
    };

    // ───────────────────────────────────────────────
    //  Public API
    // ───────────────────────────────────────────────

    /**
     * Initialize story mode.  Called once when a new game with origin
     * "story_mode" is created.
     */
    function init(player) {
        console.log('[StoryMode] StoryMode.init called. player?', !!player, 'gameStart:', player ? player.gameStart : 'N/A', 'origin:', player ? player.origin : 'N/A');
        if (!player) { return; }
        // Accept either player.origin or player.gameStart for compatibility
        var startId = player.origin || player.gameStart || '';
        console.log('[StoryMode] startId resolved to:', startId);
        if (startId !== 'story_mode') { console.warn('[StoryMode] startId !== story_mode, ABORTING init'); return; }

        _storyState.active  = true;
        _storyState.chapter = 0;
        _storyState.path    = null;
        _storyState.complete = false;
        _storyState.objectives = {};
        _storyState.dialogsSeen = [];
        _storyState.buttonsUnlocked = ['character', 'system'];
        _storyState.chapterStartDay = 0;

        // Reset flags
        var flags = _storyState.flags;
        flags.suppressEncounters = true;
        flags.suppressDisease    = true;
        flags.protectFamily      = true;
        flags.edmundInjured      = false;
        flags.edmundImprisoned   = false;
        flags.edmundFreed        = false;
        flags.margretIll         = false;
        flags.ashfordCaptured    = false;
        flags.ashfordLiberated   = false;
        flags.metLordCalder      = false;
        flags.metSeraphine       = false;
        flags.warDeclared        = false;

        _beginChapter(0);
    }

    /**
     * Called every in-game day tick.
     * Re-evaluates polled objectives (own_gold, reach_rank, own_building, custom).
     */
    function tick(player) {
        if (!_storyState.active || _storyState.complete) { return; }

        // Story mode: strip horse permit laws from all kingdoms (for loaded saves)
        if (!_storyState.flags._horseLawStripped && typeof Engine !== 'undefined' && Engine.getWorld) {
            var _w = Engine.getWorld();
            if (_w && _w.kingdoms) {
                for (var _ki = 0; _ki < _w.kingdoms.length; _ki++) {
                    var _k = _w.kingdoms[_ki];
                    if (_k.laws && _k.laws.specialLaws) {
                        _k.laws.specialLaws = _k.laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
                    }
                }
            }
            _storyState.flags._horseLawStripped = true;
        }

        // Ch11: re-apply injuries/illness if flags are set but NPCs aren't affected yet
        if (_storyState.flags.edmundInjured || _storyState.flags.margretIll) {
            _ensureCh11Conditions();
        }

        var ch = _currentChapterDef();
        if (!ch) { return; }

        // Prologue auto-advancesafter its dialog has been seen
        if (_storyState.chapter === 0 && _storyState.dialogsSeen.indexOf('ch0_intro') !== -1) {
            _completeChapter();
            return;
        }

        // Check if all objectives are already met (e.g. after save/load)
        if (_allObjectivesMet()) {
            _completeChapter();
            return;
        }

        // Poll state-based objectives
        var changed = false;
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) { continue; }
            // Sequential gating: if objective has 'after' dependency, skip until that is done
            if (!_afterMet(obj)) { continue; }
            if (_checkObjective(obj)) {
                _markDone(obj.id);
                _toast('Objective complete: ' + obj.desc);
                _log('Objective complete: ' + obj.desc);
                changed = true;
            }
        }

        if (changed && _allObjectivesMet()) {
            _completeChapter();
        }
    }

    /**
     * Called by game systems whenever the player performs a notable action.
     *
     * @param {string} actionType  One of the objective type strings.
     * @param {object} data        Contextual payload (item, qty, town, building, etc.)
     */
    function onPlayerAction(actionType, data) {
        if (!_storyState.active || _storyState.complete) { return; }

        _matchAction(actionType, data || {});

        if (_allObjectivesMet()) {
            _completeChapter();
        }
    }

    /**
     * Called by the dialog UI when a dialog key has been shown/dismissed.
     * Useful for custom objectives that just need a dialog to have been seen.
     */
    function onDialogSeen(dialogKey) {
        if (_storyState.dialogsSeen.indexOf(dialogKey) === -1) {
            _storyState.dialogsSeen.push(dialogKey);
        }
    }

    /**
     * Called by the dialog UI when the player picks a branch in Ch 17.
     * @param {'diplomatic'|'military'} pathName
     */
    function setWarPath(pathName) {
        if (pathName !== 'diplomatic' && pathName !== 'military') { return; }
        _storyState.path = pathName;

        // Set enemy kingdom reference for diplomatic path tracking
        if (typeof Engine !== 'undefined' && Engine.getWorldState) {
            var w = Engine.getWorldState();
            if (w && w.kingdoms) {
                var korvath = w.kingdoms.find(function(k) { return k.name === 'Korvath'; });
                if (korvath) { _storyState.flags.enemyKingdomId = korvath.id; }
            }
        }

        // Find the branching chapter (should be current chapter)
        var chIdx = _storyState.chapter;
        var ch = CHAPTERS[chIdx];
        if (!ch || !ch.branches) {
            for (var i = 0; i < CHAPTERS.length; i++) {
                if (CHAPTERS[i].branches) { ch = CHAPTERS[i]; chIdx = i; break; }
            }
        }
        if (ch && ch.branches && ch.branches[pathName]) {
            ch.objectives = _cloneObjectives(ch.branches[pathName]);
            ch.endDialog = (pathName === 'diplomatic') ? 'ch17a_complete' : 'ch17b_complete';
            if (pathName === 'military') {
                _unlockButtons(['world']); // outposts
            }
            _refreshTracker();
            _log('You chose the ' + pathName + ' path.');

            // Show the ally's intro dialog confirming the choice
            var introDialog = (pathName === 'diplomatic') ? 'ch17_elowen_intro' : 'ch17_theron_intro';
            _showDialog(introDialog);
        }
    }

    /**
     * Register that the player has met a named NPC (sets story flags).
     */
    function onMetNPC(npcName) {
        if (npcName === 'Lord Calder')  { _storyState.flags.metLordCalder  = true; }
        if (npcName === 'Seraphine')    { _storyState.flags.metSeraphine   = true; }
    }

    // ── Query API ──

    function getCurrentChapter() {
        return _currentChapterDef();
    }

    function getObjectives() {
        var ch = _currentChapterDef();
        return ch ? ch.objectives : [];
    }

    function isButtonUnlocked(tabCategory) {
        if (_storyState.complete) { return true; }
        if (!_storyState.active)  { return true; }
        return _storyState.buttonsUnlocked.indexOf(tabCategory) !== -1;
    }

    function isActive() {
        return _storyState.active && !_storyState.complete;
    }

    function isComplete() {
        return _storyState.complete;
    }

    // Map objective types to the button selector(s) needed to complete them.
    // Each entry is a button ID used by the tutorial highlight system.
    var _objectiveButtonMap = {
        'buy_item':        '#btnTrade',
        'sell_item':       '#btnTrade',
        'work_shift':      '#btnWork',
        'arrive_town':     '#btnRoutes',
        'own_building':    '#btnBuild',
        'build_building':  '#btnBuild',
        'hire_worker':     '#btnHire',
        'assign_worker':   '#btnBuildings',
        'collect_output':  '#btnBuildings',
        'produce_item':    '#btnBuildings',
        'buy_skill':       '#btnSkills',
        'join_guild':      '#btnGuilds',
        'send_caravan':    '#btnCaravan',
        'treat_person':    '#btnCharacter',
        'attend_feast':    '#btnNobility',
        'attend_court':    '#btnNobility',
        'supply_kingdom':  '#btnKingdoms',
        'own_gold':        null,
        'reach_rank':      null,
        'rest':            '#btnRest',
        'street_trade':    '#btnStreet',
        'open_street_trading': '#btnStreet',
        'equip_item':      '#btnCharacter',
        'hire_guard':      '#btnCharacter',
        'install_addon':   '#btnHousing',
        'home_craft':      '#btnHousing',
        'guild_craft':     '#btnGuilds',
        'open_help_guide': '#btnHelp',
        'buy_horse':       '#btnTrade',
        'mount_horse':     '#btnCharacter',
        'upgrade_building': '#btnBuildings',
        'toggle_autobuy':  '#btnBuildings',
        'build_ship':      '#btnShips',
        'custom':          null
    };

    // Map button IDs to { tab, label } for highlighting both the tab and sub-button
    var _btnToTabLabel = {
        '#btnTrade':     { tab: 'actions',   label: 'Trade' },
        '#btnBuild':     { tab: 'actions',   label: 'Build' },
        '#btnHire':      { tab: 'actions',   label: 'Hire' },
        '#btnWork':      { tab: 'actions',   label: 'Work' },
        '#btnStreet':    { tab: 'actions',   label: 'Street' },
        '#btnRest':      { tab: 'actions',   label: 'Rest' },
        '#btnRoutes':    { tab: 'actions',   label: 'Travel' },
        '#btnTalk':      { tab: 'actions',   label: 'Talk' },
        '#btnCaravan':   { tab: 'business',  label: 'Caravan' },
        '#btnBuildings': { tab: 'business',  label: 'Buildings' },
        '#btnShips':     { tab: 'business',  label: 'Ships' },
        '#btnCharacter': { tab: 'character', label: 'Character' },
        '#btnSkills':    { tab: 'character', label: 'Skills' },
        '#btnFamily':    { tab: 'character', label: 'Family' },
        '#btnHousing':   { tab: 'character', label: 'Housing' },
        '#btnGuilds':    { tab: 'character', label: 'Guilds' },
        '#btnNobility':  { tab: 'character', label: 'Nobility' },
        '#btnKingdoms':  { tab: 'world',     label: 'Kingdoms' },
        '#btnMap':       { tab: 'world',     label: 'Map' }
    };

    // Map custom hook functions to button hints
    var _customFnButtonMap = {
        '_checkOwnsLand':         '#btnHousing',
        '_checkRested':           '#btnHousing',
        '_checkWarDialogSeen':    '#btnTalk',
        '_checkFestivalAttended': '#btnStreet',
        '_checkMetCalder':        '#btnTalk',
        '_checkMetCalderCapital': '#btnTalk',
        '_checkTalkedToEdmund':   '#btnTalk',
        '_checkCeremonyAttended': '#btnKingdoms',
        '_checkOpenedStreetTrading': '#btnStreet',
        '_checkOpenedHelp':       null,
        '_checkViewedEventLog':   null,
        '_checkToggledFilter':    null,
        '_checkViewedFeats':      null
    };

    /**
     * Returns an array of { tab, label } hints for the first incomplete objective.
     * Only highlights the next action the player should take, not all at once.
     */
    function getButtonHints() {
        if (!_storyState.active || _storyState.complete) return [];
        var ch = _currentChapterDef();
        if (!ch) return [];
        // Find the first incomplete objective that maps to a button
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) continue;
            var btnId = _objectiveButtonMap[obj.type] || null;
            // Housing objectives should point to Character → Housing, not Build
            if (obj.type === 'own_building' && obj.building === 'housing') {
                btnId = '#btnHousing';
            }
            if (obj.type === 'custom' && obj.fn && _customFnButtonMap[obj.fn]) {
                btnId = _customFnButtonMap[obj.fn];
            }
            if (!btnId) continue;
            var info = _btnToTabLabel[btnId];
            if (!info) continue;
            return [{ tab: info.tab, label: info.label }];
        }
        return [];
    }

    function getStoryFlags() {
        // Return a shallow copy
        var copy = {};
        for (var k in _storyState.flags) {
            if (_storyState.flags.hasOwnProperty(k)) { copy[k] = _storyState.flags[k]; }
        }
        return copy;
    }

    function getChapterIndex() {
        return _storyState.chapter;
    }

    function getPath() {
        return _storyState.path;
    }

    // ── Testing / Debug ──

    function advanceChapter() {
        if (_storyState.complete) { return; }
        _completeChapter();
    }

    /** God mode: skip current chapter instantly — mark all objectives done, unlock buttons, advance. */
    function skipChapter() {
        if (_storyState.complete) return;
        var ch = _currentChapterDef();
        if (!ch) return;

        // For branching chapter (ch17), auto-set path if not chosen
        if (ch.branches && !_storyState.path) {
            setWarPath('diplomatic');
        }

        // Mark all objectives as done
        for (var i = 0; i < ch.objectives.length; i++) {
            ch.objectives[i].done = true;
            _storyState.objectives[ch.objectives[i].id] = true;
        }

        // Unlock buttons for this chapter AND all prior chapters
        for (var ci = 0; ci <= _storyState.chapter; ci++) {
            if (CHAPTERS[ci] && CHAPTERS[ci].unlockButtons) {
                _unlockButtons(CHAPTERS[ci].unlockButtons);
            }
        }

        // Run onStart hook if it hasn't run (some set important flags like warDeclared)
        _callHook(ch.onStart);

        // Run onComplete hook (some set important flags)
        _storyState.flags.deferAdvance = false;
        _callHook(ch.onComplete);

        // Advance regardless of deferAdvance
        _advanceToNextChapter();
    }

    // ── Serialization ──

    function serialize() {
        // Capture active dialog state so save/load resumes mid-dialog
        var dialogState = null;
        if (typeof UI !== 'undefined' && UI.getStoryDialogState) {
            dialogState = UI.getStoryDialogState();
        }
        // Save objective progress (e.g. supply_kingdom partial counts)
        var progressMap = {};
        var ch = _currentChapterDef();
        if (ch && ch.objectives) {
            for (var pi = 0; pi < ch.objectives.length; pi++) {
                if (ch.objectives[pi]._progress) {
                    progressMap[ch.objectives[pi].id] = ch.objectives[pi]._progress;
                }
            }
        }
        return {
            active:           _storyState.active,
            chapter:          _storyState.chapter,
            path:             _storyState.path,
            complete:         _storyState.complete,
            objectives:       JSON.parse(JSON.stringify(_storyState.objectives)),
            flags:            JSON.parse(JSON.stringify(_storyState.flags)),
            buttonsUnlocked:  _storyState.buttonsUnlocked.slice(),
            dialogsSeen:      _storyState.dialogsSeen.slice(),
            chapterStartDay:  _storyState.chapterStartDay,
            activeDialog:     dialogState,
            progressMap:      progressMap
        };
    }

    function deserialize(data) {
        if (!data) { return; }

        _storyState.active          = !!data.active;
        _storyState.chapter         = data.chapter || 0;
        _storyState.path            = data.path || null;
        _storyState.complete        = !!data.complete;
        _storyState.objectives      = data.objectives || {};
        _storyState.buttonsUnlocked = data.buttonsUnlocked || ['character', 'system'];
        _storyState.dialogsSeen     = data.dialogsSeen || [];
        _storyState.chapterStartDay = data.chapterStartDay || 0;

        // Restore flags
        if (data.flags) {
            for (var k in data.flags) {
                if (data.flags.hasOwnProperty(k)) {
                    _storyState.flags[k] = data.flags[k];
                }
            }
        }

        // If story is already complete, hide the tracker
        if (_storyState.complete) {
            if (typeof UI !== 'undefined' && UI.hideStoryTracker) {
                UI.hideStoryTracker();
            }
        }

        // Rebuild live chapter objectives from definitions + saved completion
        if (_storyState.active && !_storyState.complete) {
            var ch = CHAPTERS[_storyState.chapter];
            if (ch) {
                if (ch.branches && _storyState.path) {
                    ch.objectives = _cloneObjectives(ch.branches[_storyState.path] || []);
                } else if (ch.branches && !_storyState.path) {
                    // Branching chapter but path not chosen — show placeholder and re-show choice dialog
                    ch.objectives = [{ id: '_awaiting_path', type: 'custom', fn: '_checkPathChosen', desc: 'Choose your path: Diplomacy or Military', done: false }];
                    setTimeout(function() { _showDialog(ch.startDialog); }, 500);
                } else {
                    ch.objectives = _cloneObjectives(ch.objectives.length ? ch.objectives : []);
                }
                for (var i = 0; i < ch.objectives.length; i++) {
                    if (_storyState.objectives[ch.objectives[i].id]) {
                        ch.objectives[i].done = true;
                    }
                    // Restore partial progress (e.g. supply_kingdom counts)
                    if (data.progressMap && data.progressMap[ch.objectives[i].id]) {
                        ch.objectives[i]._progress = data.progressMap[ch.objectives[i].id];
                        // Update description with restored progress
                        var needed = ch.objectives[i].qty || 0;
                        if (needed > 0) {
                            ch.objectives[i].desc = ch.objectives[i].desc.replace(/\(\d+\/\d+\)/, '(' + Math.min(ch.objectives[i]._progress, needed) + '/' + needed + ')');
                        }
                    }
                }
                // Restore undermine progress descriptions for diplomatic path
                if (_storyState.flags._loyaltyTotal) {
                    for (var uli = 0; uli < ch.objectives.length; uli++) {
                        if (ch.objectives[uli].id === 'ch17a_undermine_loyalty') {
                            var lt = Math.min(_storyState.flags._loyaltyTotal, 100);
                            ch.objectives[uli].desc = 'Turn nobles against their king \u2014 reduce loyalty by 100 total (' + lt + '/100)';
                            break;
                        }
                    }
                }
                if (_storyState.flags._perceivedTotal) {
                    for (var upi = 0; upi < ch.objectives.length; upi++) {
                        if (ch.objectives[upi].id === 'ch17a_undermine_perceived') {
                            var pt = Math.min(_storyState.flags._perceivedTotal, 50);
                            ch.objectives[upi].desc = 'Discredit nobles \u2014 reduce perceived loyalty by 50 total (' + pt + '/50)';
                            break;
                        }
                    }
                }
                if (_storyState.flags._reputationTotal) {
                    for (var uri = 0; uri < ch.objectives.length; uri++) {
                        if (ch.objectives[uri].id === 'ch17a_undermine_reputation') {
                            var rt = Math.min(_storyState.flags._reputationTotal, 50);
                            ch.objectives[uri].desc = 'Sow discord \u2014 damage noble reputation by 50 total (' + rt + '/50)';
                            break;
                        }
                    }
                }
                // Restore sabotage, treasury, and trade progress descriptions
                if (_storyState.flags._sabotageCount) {
                    for (var sbi = 0; sbi < ch.objectives.length; sbi++) {
                        if (ch.objectives[sbi].id === 'ch17b_sabotage') {
                            var sc = Math.min(_storyState.flags._sabotageCount, 3);
                            ch.objectives[sbi].desc = 'Sabotage or burn 3 buildings in enemy territory (' + sc + '/3)';
                            break;
                        }
                    }
                }
                if (_storyState.flags._treasuryDonated) {
                    for (var tdi = 0; tdi < ch.objectives.length; tdi++) {
                        if (ch.objectives[tdi].id === 'ch17b_donate_treasury') {
                            var td = Math.min(_storyState.flags._treasuryDonated, 10000);
                            ch.objectives[tdi].desc = 'Donate 10,000g to the kingdom treasury (' + td + '/10000)';
                            break;
                        }
                    }
                }
                if (_storyState.flags._crossKingdomTrade) {
                    for (var cti = 0; cti < ch.objectives.length; cti++) {
                        if (ch.objectives[cti].id === 'ch17a_trade_value') {
                            var ct = Math.min(_storyState.flags._crossKingdomTrade, 10000);
                            ch.objectives[cti].desc = 'Trade 10,000g worth of goods via caravans between kingdoms (' + ct + '/10000)';
                            break;
                        }
                    }
                }
            }
            _refreshTracker();

            // Restore active dialog if one was in progress at save time
            // Skip if branching dialog will already be shown (no path chosen)
            var _branchDialogShown = ch && ch.branches && !_storyState.path;
            if (!_branchDialogShown && data.activeDialog && data.activeDialog.dialogKey) {
                var dKey = data.activeDialog.dialogKey;
                var dLine = data.activeDialog.lineIndex || 0;
                if (typeof STORY_DIALOGS !== 'undefined' && STORY_DIALOGS[dKey]) {
                    // Slight delay so UI is ready
                    setTimeout(function() {
                        var dialogData = STORY_DIALOGS[dKey];
                        dialogData._dialogKey = dKey;
                        if (typeof UI !== 'undefined' && UI.showStoryDialog) {
                            UI.showStoryDialog(dialogData, dLine);
                        }
                    }, 500);
                }
            }
        }
    }

    // ───────────────────────────────────────────────
    //  Expose Public Interface
    // ───────────────────────────────────────────────

    return {
        init:              init,
        tick:              tick,
        onPlayerAction:    onPlayerAction,
        onDialogSeen:      onDialogSeen,
        setWarPath:        setWarPath,
        onMetNPC:          onMetNPC,

        getCurrentChapter: getCurrentChapter,
        getChapterIndex:   getChapterIndex,
        getObjectives:     getObjectives,
        isButtonUnlocked:  isButtonUnlocked,
        isActive:          isActive,
        isComplete:        isComplete,
        getButtonHints:    getButtonHints,
        getStoryFlags:     getStoryFlags,
        getPath:           getPath,

        advanceChapter:    advanceChapter,
        skipChapter:       skipChapter,
        serialize:         serialize,
        deserialize:       deserialize
    };

})();
