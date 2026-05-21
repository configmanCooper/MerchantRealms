# Unsolicited Random Events — Full Implementation Plan

## Overview

A system of ~200 random mini-story events that happen to the player unprompted.
Some are one-time dialogs, some are 2-5 step mini-quests tracked in the quest tab.
Events range from funny to dark to romantic to political, and are contextually
aware of the player's situation, location, skills, wealth, rank, and world state.

## Architecture

### New file: `js/modules/player_unsolicited_events.js`
- IIFE on `window.Player`, same pattern as `player_unsolicited_quests.js`
- All event definitions live in this file as a `EVENTS` array/object
- Context builder gathers world state into a `ctx` object for condition checks
- Roll functions for daily tick (2%) and location entry (5%, throttled 1/day)

### Trigger Points
- **Daily tick**: 2% chance, called from `engine.js` daily tick (~line 32168)
- **Location entry**: 5% chance, called from travel arrival handler
- **Throttle**: 3-day global cooldown between any event firing
- **Per-event cooldown**: 60 days before same event can fire again

### Data Model
Each event definition:
```js
{
    id: 'street_brawl',
    name: 'Street Brawl',
    category: 'common',        // common|trade|social|crime|war|political|supernatural|skill|rank|context
    rarity: 'common',          // common|uncommon|rare|legendary
    steps: 1,                  // 1 = one-shot dialog, 2-5 = multi-step quest
    condition: function(ctx) { return true; },  // eligibility check
    generate: function(ctx) { return { title, text, choices, params }; },
    onChoice: function(choiceIndex, params, ctx) { return { text, effects }; },
    // For multi-step:
    getStep: function(stepIndex, params, ctx) { return { text, choices }; },
    onStepChoice: function(stepIndex, choiceIndex, params, ctx) { return { text, effects, nextStep }; }
}
```

Active instance (serializable):
```js
{
    id: 'ue_42',           // unique instance id
    defId: 'street_brawl', // event definition id
    stepIndex: 0,
    params: {},            // generated context (NPC name, amounts, etc.)
    generatedDay: 150,
    dueDay: 155,           // deadline for multi-step
    status: 'active'       // active|completed|failed|expired
}
```

### Player State Fields
```js
player._unsolicitedEvents = [];              // active multi-step events
player._unsolicitedEventCooldowns = {};      // { defId: lastFiredDay }
player._lastUnsolicitedEventDay = 0;         // global cooldown tracker
player._nextUnsolicitedEventId = 1;          // auto-increment
player._pendingUnsolicitedEvent = null;      // popup waiting to show
player._unsolicitedEventHistory = [];        // completed event ids (for one-shots tracking)
```

### Category Cooldowns (days)
| Category | Cooldown |
|----------|----------|
| common | 2 |
| trade | 3 |
| social | 5 |
| crime | 4 |
| war | 3 |
| political | 5 |
| supernatural | 14 |
| skill | 7 |
| rank | 7 |
| context | 3 |

### Effect System
Effects applied via typed handlers:
- `gold`: add/subtract gold
- `relationship`: modify relationship with NPC
- `reputation`: modify reputation in kingdom
- `health`: modify health
- `energy`: modify energy
- `xp`: grant XP
- `item`: add/remove inventory items
- `skill_progress`: advance a skill
- `fame`: modify musician fame
- `arrest`: trigger arrest
- `injury`: inflict injury
- `illness`: inflict illness
- `toast`: show UI toast

### Context Builder (`_buildContext()`)
Gathers into a single `ctx` object:
- `player`: player state ref
- `day`, `season`
- `town`: current town object
- `kingdom`: current kingdom object
- `kingPersonality`: king's personality traits
- `townPeople`: people in current town
- `nobles`, `eliteMerchants`: filtered from townPeople
- `atWar`: boolean — is player's kingdom at war?
- `warTarget`: kingdom they're fighting
- `quarantined`: is current town quarantined?
- `recentLaws`: laws passed in last 7 days
- `prosperity`, `security`: town levels
- `population`: town pop
- `playerWealth`: player gold
- `playerRank`: social rank in current kingdom
- `playerSkills`: player.skills object
- `playerAchievements`: player.achievements
- `hasCriminalRecord`: boolean
- `isMarried`, `hasChildren`
- `playerHealth`, `playerEnergy`
- `isSick`: boolean
- `foodPrices`, `luxuryPrices`: avg prices of food/luxury in town market

---

## Event Categories & Definitions (~200 events)

### 1. COMMON (30 events) — Everyday encounters
These happen anywhere, anytime. Light flavor.

| # | ID | Name | Steps | Rarity | Description |
|---|-----|------|-------|--------|-------------|
| 1 | street_brawl | Street Brawl | 1 | common | Two NPCs fighting in the street. Join in, break it up, or walk away. |
| 2 | lost_child | Lost Child | 2 | common | A crying child has lost their parent. Help find them or ignore. |
| 3 | dropped_purse | Dropped Purse | 1 | common | Someone drops a coin purse. Return it (+rep, +relationship) or keep it (+gold). |
| 4 | street_preacher | Street Preacher | 1 | common | A zealot preaches doom. Heckle, listen, or donate. |
| 5 | runaway_cart | Runaway Cart | 1 | common | A cart breaks loose downhill. Dodge, try to stop it (+injury risk), or watch. |
| 6 | old_friend | Old Friend | 1 | uncommon | An NPC from your starting town recognizes you. Catch up (+relationship). |
| 7 | stray_dog | Stray Dog | 2 | common | A mangy dog follows you. Feed it, shoo it, or adopt it (cosmetic pet). |
| 8 | broken_wheel | Broken Wheel | 1 | common | A merchant's cart has a broken wheel. Help (+relationship, +rep) or pass. |
| 9 | town_crier | Town Crier News | 1 | common | The town crier announces something — reflects actual recent events. |
| 10 | drunk_confession | Drunk's Confession | 1 | common | A drunk NPC spills a secret about local politics or trade. |
| 11 | beautiful_sunset | Beautiful Sunset | 1 | common | A quiet moment. Contemplate (+energy recovery) or sketch it. |
| 12 | bird_droppings | Bird Droppings | 1 | common | A bird poops on you. Comedic. Locals laugh. Minor embarrassment. |
| 13 | market_argument | Market Argument | 1 | common | Two merchants argue over a stall. Mediate or take sides. |
| 14 | wedding_procession | Wedding Procession | 1 | common | A wedding passes through town. Toss coins, cheer, or grumble. |
| 15 | funeral_procession | Funeral Procession | 1 | common | A funeral. Pay respects (+rep) or hurry past. |
| 16 | strange_smell | Strange Smell | 1 | common | Something smells terrible near the market. Investigate or leave. |
| 17 | slippery_road | Slippery Road | 1 | common | You slip and fall. Minor injury or caught by a stranger (+relationship). |
| 18 | traveling_entertainer | Traveling Entertainer | 1 | common | A juggler/acrobat performs. Tip, challenge, or heckle. |
| 19 | nosy_neighbor | Nosy Neighbor | 1 | common | Someone asks too many questions about your business. Deflect or share. |
| 20 | free_sample | Free Sample | 1 | common | A baker/brewer offers a free sample. Accept (+energy) or decline. |
| 21 | loose_livestock | Loose Livestock | 1 | common | Chickens/pigs loose in the street. Help round them up or step in poop. |
| 22 | rain_shelter | Rain Shelter | 2 | common | Sudden rain forces you into a tavern with a stranger. Conversation ensues. |
| 23 | arm_wrestling | Arm Wrestling Challenge | 1 | common | A burly local challenges you. Win = +fame, lose = minor embarrassment. |
| 24 | fortune_teller | Fortune Teller | 1 | uncommon | A mysterious fortune teller reads your palm. Cryptic hint about future. |
| 25 | dropped_letter | Dropped Letter | 2 | common | You find a sealed letter. Deliver it, read it (gossip), or discard. |
| 26 | roof_tile | Falling Roof Tile | 1 | common | A tile falls near you. Close call. |
| 27 | child_pickpocket | Child Pickpocket | 1 | common | A kid tries to pickpocket you. Catch them, let them go, or teach them. |
| 28 | flower_vendor | Flower Vendor | 1 | common | A flower seller offers you a bloom. Buy for spouse/interest (+courtship). |
| 29 | town_gossip | Town Gossip | 1 | common | An NPC pulls you aside with juicy gossip about a local noble/EM. |
| 30 | mysterious_note | Mysterious Note | 2 | uncommon | A note is slipped under your door. Follow the instructions or ignore. |

### 2. TRADE (25 events) — Market/merchant encounters
Require: player has done some trading or owns buildings.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 31 | price_tip | Hot Price Tip | 1 | common | Any trader | A merchant whispers about a price surge in a nearby town. |
| 32 | bulk_deal | Bulk Deal Offer | 2 | uncommon | Gold > 100 | A supplier offers a huge discount on bulk goods — but only today. |
| 33 | counterfeit_goods | Counterfeit Goods | 2 | uncommon | Has traded | You bought something that turns out to be counterfeit. Confront seller or eat the loss. |
| 34 | trade_caravan_stranded | Stranded Caravan | 3 | uncommon | Has caravan skill | A foreign caravan is stranded. Help them and get trade goods, or loot them. |
| 35 | merchant_duel | Merchant's Duel | 2 | rare | Gold > 500 | An elite merchant challenges you to a trading contest. |
| 36 | stolen_shipment | Stolen Shipment | 3 | uncommon | Owns building | Someone stole from your warehouse. Track them down or report to guards. |
| 37 | exotic_trader | Exotic Trader | 1 | rare | Gold > 200 | A rare goods trader appears with unique items at high prices. |
| 38 | tax_collector | Tax Collector Shakedown | 1 | common | Gold > 50 | A zealous tax collector demands extra payment. Pay, argue, or bribe. |
| 39 | price_crash_panic | Price Crash Panic | 1 | uncommon | Has inventory | Market prices tank suddenly. Panic sell or hold. |
| 40 | warehouse_rat | Warehouse Rats | 1 | common | Owns building | Rats ate some of your stored goods. -small qty of a resource. |
| 41 | business_proposal | Business Proposal | 3 | uncommon | Gold > 300 | An NPC proposes a joint venture. Invest or decline. |
| 42 | trade_route_rumor | Trade Route Rumor | 1 | common | Any | Someone mentions an unofficial shortcut between towns. |
| 43 | haggling_master | Haggling Masterclass | 1 | rare | Has haggler | An old trader teaches you a trick. Temporary price bonus. |
| 44 | debt_collector | Debt Collector | 2 | uncommon | Gold > 0 | Someone claims you owe them money. Legit or scam? |
| 45 | surplus_dumping | Surplus Dumping | 1 | common | Any | A farmer dumps surplus goods cheap. Quick buy opportunity. |
| 46 | trade_embargo_leak | Embargo Leak | 1 | rare | Has foreign_intelligence | Someone leaks that an embargo is coming. Stockpile time. |
| 47 | market_festival | Market Festival | 1 | common | Any | Special market day — all prices discounted slightly. |
| 48 | investment_scam | Investment Scam | 2 | uncommon | Gold > 200 | A smooth talker offers amazing returns. Scam or legit? |
| 49 | guild_invite | Guild Invitation | 2 | rare | Rep > 30 | A merchant guild wants you to join. Benefits and obligations. |
| 50 | supply_shortage | Supply Shortage Crisis | 1 | common | Ctx: low food | Town is running low on food. Prices spike. Opportunity or crisis? |
| 51 | trade_war | Trade War Begins | 1 | uncommon | Ctx: two kingdoms | Two kingdoms start a trade war. Embargo incoming. |
| 52 | lost_cargo | Lost Cargo Found | 1 | uncommon | Near coast | Washed-up cargo on the shore. Salvage it. |
| 53 | competitor_sabotage | Competitor Sabotage | 2 | rare | Owns 3+ buildings | A competitor is sabotaging your business. Investigate. |
| 54 | black_market_invite | Black Market Invite | 2 | rare | Has discrete skill | Invited to an underground market. Risky but profitable. |
| 55 | insurance_offer | Insurance Offer | 1 | uncommon | Has caravan | Someone offers caravan insurance. Worth it? |

### 3. SOCIAL (25 events) — Romance, friendship, drama
Focus on NPC relationships and personal life.

| # | ID | Name | Steps | Rarity | Description |
|---|-----|------|-------|--------|-------------|
| 56 | love_confession | Love Confession | 2 | uncommon | An NPC confesses romantic feelings. Accept, reject gently, or reject harshly. |
| 57 | jealous_spouse | Jealous Spouse | 1 | uncommon | Married | Your spouse is jealous of time spent with another NPC. Reassure or dismiss. |
| 58 | matchmaker | The Matchmaker | 2 | common | Single | An old woman insists she knows the perfect partner for you. |
| 59 | rival_suitor | Rival Suitor | 3 | uncommon | Courting someone | A rival appears courting the same person. Competition ensues. |
| 60 | family_feud | Family Feud | 3 | uncommon | Has family | Two family members are feuding. Mediate or take sides. |
| 61 | surprise_gift | Surprise Gift | 1 | common | Has relationships > 50 | An NPC friend gives you an unexpected gift. |
| 62 | betrayal_revealed | Betrayal Revealed | 2 | rare | Has relationships > 70 | You discover a trusted NPC was working against you. |
| 63 | crying_friend | Crying Friend | 2 | common | Has relationships > 40 | A friend is upset. Console them, give advice, or leave. |
| 64 | tavern_dare | Tavern Dare | 1 | common | Any | Someone dares you to do something embarrassing. Accept for +fame. |
| 65 | old_flame | Old Flame | 2 | rare | Has ever courted | An old romantic interest reappears. Awkward reunion. |
| 66 | anonymous_admirer | Anonymous Admirer | 3 | uncommon | Rep > 20 | Mysterious gifts appear. Find out who's sending them. |
| 67 | neighborhood_feast | Neighborhood Feast | 1 | common | Any | Invited to a communal dinner. +relationships with multiple NPCs. |
| 68 | gossip_about_you | Gossip About You | 1 | common | Rep > 15 | Someone is spreading rumors about you. Confront or ignore. |
| 69 | mentor_offer | Mentor Offers Wisdom | 2 | uncommon | Young (<30) | An older NPC offers to mentor you. Accept for skill bonus. |
| 70 | prank_war | Prank War | 3 | common | Has relationships | An NPC pranks you. Retaliate or laugh it off. |
| 71 | secret_keeper | Secret Keeper | 2 | uncommon | Has relationships > 60 | An NPC confides a dangerous secret. Keep it or use it. |
| 72 | arranged_marriage | Arranged Marriage Pressure | 2 | uncommon | Single, rank > 3 | A noble family pressures you into an arranged marriage. |
| 73 | farewell_party | Farewell Party | 1 | common | An NPC friend is leaving town forever. Say goodbye. |
| 74 | baby_naming | Baby Naming Ceremony | 1 | common | Has children | Someone asks you to name their baby. Choose a name. |
| 75 | dance_invitation | Dance Invitation | 1 | common | Any | Invited to dance at a festival. Impress or embarrass yourself. |
| 76 | friendship_test | Friendship Test | 2 | uncommon | Has relationships > 50 | A friend asks you for a big favor. How far will you go? |
| 77 | romantic_walk | Romantic Walk | 1 | common | Courting/married | A peaceful walk with your partner. Conversation choices. |
| 78 | unwanted_suitor | Unwanted Suitor | 2 | common | Any | Someone won't stop flirting with you. Firm rejection or diplomatic exit. |
| 79 | reunion | Town Reunion | 1 | uncommon | Has lived in 3+ towns | People from different chapters of your life meet. Awkward. |
| 80 | inheritance_dispute | Inheritance Dispute | 3 | rare | Family member died | A distant relative's will names you. Others contest it. |

### 4. CRIME (20 events) — Underworld encounters
Many require criminal background or underworld skills.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 81 | mugging_attempt | Mugging Attempt | 1 | common | Low security town | Someone tries to rob you. Fight, flee, or surrender. |
| 82 | witness_crime | Witness a Crime | 2 | common | Any | You see a theft. Report to guards, intervene, or look away. |
| 83 | framed | Framed! | 3 | rare | Has enemies | Someone plants evidence on you. Prove innocence. |
| 84 | thieves_guild | Thieves Guild Contact | 2 | rare | Has discrete | A shadowy figure offers underworld work. |
| 85 | corrupt_guard | Corrupt Guard | 2 | uncommon | Gold > 100 | A guard offers to look the other way... for a price. |
| 86 | contraband_found | Contraband Found | 1 | uncommon | Has discrete | You stumble on a hidden stash. Take it or leave it. |
| 87 | blackmail | Blackmail Attempt | 3 | rare | Has secrets/crimes | Someone knows what you did. Pay up or call their bluff. |
| 88 | jail_break | Jailbreak Opportunity | 2 | rare | In prison | A fellow prisoner has a plan. Join or snitch. |
| 89 | fence_offer | Fence Offer | 1 | uncommon | Has stolen goods | A fence appears offering to buy your hot merchandise. |
| 90 | vigilante | Vigilante Justice | 2 | uncommon | High security | A vigilante asks for help catching a criminal. |
| 91 | protection_racket | Protection Racket | 2 | uncommon | Owns building | Thugs demand protection money for your business. |
| 92 | snitch | The Snitch | 2 | uncommon | Has criminal record | Someone offers to clear your record... for a favor. |
| 93 | poisoned_drink | Poisoned Drink | 1 | rare | Has enemies | Someone slips something in your drink at the tavern. |
| 94 | smuggling_opportunity | Smuggling Run | 3 | uncommon | Has master_smuggler | A one-time high-risk, high-reward smuggling job. |
| 95 | identity_theft | Identity Theft | 3 | rare | Gold > 500 | Someone is impersonating you and running up debts. |
| 96 | bribe_guard | Guard Wants a Bribe | 1 | common | Carrying contraband | A guard notices your goods. Pay or face arrest. |
| 97 | crime_boss_favor | Crime Boss Favor | 3 | rare | Has black_market_contacts | A crime boss needs a favor. Refusing has consequences. |
| 98 | pickpocket_caught | Caught Pickpocketing | 1 | common | Has discrete, luck fail | Your attempt goes wrong. Talk your way out or run. |
| 99 | underground_fight | Underground Fight Ring | 2 | uncommon | Has combat_trained | Invited to an underground fight. Big gold prizes. |
| 100 | mysterious_package | Mysterious Package | 2 | uncommon | Any | Someone asks you to deliver a package. Don't open it. (Will you?) |

### 5. WAR (20 events) — Wartime encounters
Require: player's kingdom is at war or near a war zone.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 101 | deserter | The Deserter | 2 | common | At war | A soldier deserts and asks for help hiding. |
| 102 | war_refugee | War Refugees | 2 | common | At war | Refugees flood town. Help, exploit, or ignore. |
| 103 | spy_accusation | Spy Accusation | 3 | uncommon | At war, foreigner | Someone accuses you of being a spy. |
| 104 | war_profiteering | War Profiteering Opportunity | 2 | uncommon | At war, gold > 200 | Chance to sell weapons at massive markup. |
| 105 | wounded_soldier | Wounded Soldier | 2 | common | At war | A soldier needs medical help. Requires first_aid or gold. |
| 106 | conscription_notice | Conscription Notice | 2 | uncommon | At war, young | The kingdom wants to draft you. Serve, dodge, or buy out. |
| 107 | enemy_merchant | Enemy Merchant | 2 | uncommon | At war | A merchant from the enemy kingdom is trapped. Help or turn in. |
| 108 | supply_run | Frontline Supply Run | 3 | uncommon | At war, has caravan | Army needs supplies delivered to the front. Dangerous but rewarding. |
| 109 | war_trophy | War Trophy | 1 | rare | At war, after battle | You find a valuable item on an old battlefield. |
| 110 | peace_petition | Peace Petition | 2 | uncommon | At war, rank > 3 | Citizens want you to petition for peace. |
| 111 | siege_escape | Siege Escape | 3 | rare | Town besieged | The town is under siege. Find a way out or hunker down. |
| 112 | false_flag | False Flag Operation | 3 | rare | At war, has court_informant | Intelligence about a false flag. Expose or use it. |
| 113 | war_orphan | War Orphan | 2 | common | At war | A child lost both parents. Adopt, find shelter, or walk away. |
| 114 | captured_soldier | Captured Enemy | 2 | uncommon | At war, near front | You capture an enemy soldier. Mercy, ransom, or turn in. |
| 115 | arms_dealer | Arms Dealer | 1 | uncommon | At war | A shady dealer offers military goods cheap. Stolen? |
| 116 | battlefield_loot | Battlefield Loot | 1 | uncommon | At war, near front | Scavenge a recent battlefield. Risk vs reward. |
| 117 | treason_suspicion | Treason Suspicion | 2 | rare | At war, trades with enemy | Your cross-border trades look suspicious. |
| 118 | military_intel | Military Intelligence | 2 | rare | At war, has court_informant | You intercept military intel. Sell it, use it, or report it. |
| 119 | ceasefire_rumor | Ceasefire Rumor | 1 | common | At war | Rumors of a ceasefire. Markets shift. |
| 120 | veteran_beggar | Veteran Beggar | 1 | common | At war or post-war | A maimed veteran begs for coins. His story is heartbreaking. |

### 6. POLITICAL (20 events) — Court, law, governance
Require: Some social rank or political involvement.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 121 | petition_help | Petition for Help | 2 | common | Rank > 2 | A commoner begs you to intervene with the king. |
| 122 | noble_rivalry | Noble Rivalry | 3 | uncommon | Rank > 4 | Another noble is undermining you at court. |
| 123 | king_summons | King's Summons | 2 | rare | Rank > 3 | The king wants a private audience with you. |
| 124 | tax_revolt | Tax Revolt | 3 | uncommon | Rank > 3, high taxes | Townspeople threaten revolt. Mediate or crush. |
| 125 | succession_crisis | Succession Whispers | 2 | rare | Rank > 4 | Rumors the king is ill. Factions form. Pick a side. |
| 126 | law_debate | Law Debate | 1 | common | Rank > 2 | A new law is being debated. Your opinion matters. |
| 127 | bribery_offer | Bribery Offer | 2 | uncommon | Rank > 3 | Someone offers gold for your political support. |
| 128 | scandal | Political Scandal | 2 | uncommon | Rank > 3 | A noble's scandal breaks. Cover it up or expose it. |
| 129 | election | Guild Election | 2 | common | In guild | Your guild is electing new leadership. Run or support. |
| 130 | ambassador | Foreign Ambassador | 2 | rare | Rank > 4 | A foreign diplomat seeks your counsel. Delicate. |
| 131 | new_law_impact | New Law Impact | 1 | common | Ctx: recent law | A recent law directly affects your business. React. |
| 132 | court_intrigue | Court Intrigue | 3 | rare | Rank > 4 | Overhear a plot against the king. Report or stay silent. |
| 133 | land_dispute | Land Dispute | 2 | uncommon | Owns building | A neighbor claims your land. Legal battle. |
| 134 | noble_favor | Noble Asks a Favor | 2 | uncommon | Rank > 2 | A noble needs something done discreetly. |
| 135 | popular_support | Popular Support | 1 | uncommon | Rank > 3, rep > 50 | The people love you. Political opportunity. |
| 136 | royal_decree | Royal Decree | 1 | common | Any | A new decree affects all merchants. Adapt or protest. |
| 137 | corruption_witness | Witness Corruption | 2 | uncommon | Rank > 2 | You witness a government official taking a bribe. |
| 138 | political_marriage | Political Marriage Offer | 3 | rare | Single, rank > 4 | A political alliance through marriage is proposed. |
| 139 | census | Census Trouble | 1 | common | Any | The census taker asks suspicious questions. Honest or evasive? |
| 140 | rebel_contact | Rebel Contact | 3 | rare | Low rep with kingdom | Rebels seek your support. Dangerous alliance. |

### 7. SUPERNATURAL (10 events) — Eerie, mysterious
Rare events with supernatural flavor.

| # | ID | Name | Steps | Rarity | Description |
|---|-----|------|-------|--------|-------------|
| 141 | ghost_sighting | Ghost Sighting | 1 | rare | You see a ghostly figure at night. Investigate or flee. |
| 142 | prophetic_dream | Prophetic Dream | 1 | rare | A vivid dream hints at future events. |
| 143 | cursed_object | Cursed Object | 3 | rare | You find an object that brings bad luck. Break the curse. |
| 144 | miracle_cure | Miracle Cure | 1 | legendary | Sick | A stranger offers a miraculous cure. Too good to be true? |
| 145 | witch_rumor | Witch Rumor | 2 | rare | Someone is accused of witchcraft. Defend or condemn. |
| 146 | omen | Dark Omen | 1 | uncommon | Animals behave strangely. Bad harvest or just weather? |
| 147 | ancient_map | Ancient Map | 3 | legendary | A tattered map hints at buried treasure. Multi-step hunt. |
| 148 | blessing | Wandering Monk's Blessing | 1 | uncommon | A monk blesses you. Temporary luck boost. |
| 149 | eclipse | Solar Eclipse | 1 | rare | The sun goes dark. Superstitious townsfolk panic. |
| 150 | talking_animal | "Talking" Animal | 1 | rare | A parrot repeats suspicious phrases. Follow the clues? |

### 8. SKILL-BASED (20 events) — Triggered by specific skills
Require: player has certain skills.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 151 | herbalist_discovery | Rare Herb Discovery | 1 | uncommon | Has herbalist | You find a rare medicinal herb while foraging. |
| 152 | combat_challenge | Combat Challenge | 2 | uncommon | Has combat_trained | A traveling warrior challenges you to a duel. |
| 153 | musical_inspiration | Musical Inspiration | 1 | uncommon | Has musician | A melody comes to you. Compose it for fame. |
| 154 | navigation_shortcut | Hidden Shortcut | 1 | uncommon | Has cartographer | You discover a hidden path between towns. |
| 155 | builder_flaw | Structural Flaw | 2 | uncommon | Has efficient_builder | You notice a building about to collapse. Warn or exploit. |
| 156 | poison_detection | Poison Detection | 1 | rare | Has herbalist | You detect poison in food at a feast. |
| 157 | medical_emergency | Medical Emergency | 2 | common | Has first_aid | Someone collapses in the street. Your skills can save them. |
| 158 | trade_insight | Trade Insight | 1 | uncommon | Has trade_network | Your network alerts you to a price anomaly. |
| 159 | forgery_request | Forgery Request | 2 | rare | Has master_forger | Someone wants you to forge a document. |
| 160 | animal_rescue | Animal Rescue | 1 | common | Has animal_husbandry | A trapped animal needs help. |
| 161 | diplomatic_crisis | Diplomatic Crisis | 3 | rare | Has diplomatic_immunity | Your diplomatic status is challenged. |
| 162 | code_breaking | Code Breaking | 2 | rare | Has literacy | You find an encoded message. Decode it. |
| 163 | teaching_opportunity | Teaching Opportunity | 2 | uncommon | Any skill > 3 | Someone wants to learn your trade. Teach for gold/rep. |
| 164 | skill_competition | Skill Competition | 2 | uncommon | Any | A competition in your strongest skill. Prize money. |
| 165 | craft_commission | Craft Commission | 2 | uncommon | Has industry skills | A wealthy patron commissions a masterwork. |
| 166 | survival_test | Survival Test | 2 | uncommon | Has wilderness_survival | Lost in the wilderness. Use your skills. |
| 167 | horse_whisperer | Horse Whisperer | 1 | uncommon | Has horse_mastery | A wild horse appears. Tame it for a mount. |
| 168 | smuggler_network | Smuggler Network Expansion | 3 | rare | Has contraband_network | Chance to expand your smuggling operation. |
| 169 | healing_reputation | Healing Reputation | 1 | uncommon | Has doctor | Your medical reputation precedes you. VIP patient. |
| 170 | scout_mission | Scout Mission | 2 | uncommon | Has cartographer | The military asks you to scout enemy territory. |

### 9. RANK-BASED (15 events) — Based on social standing/wealth
Triggered by player's rank, wealth, or achievements.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 171 | beggar_king | The Beggar King | 1 | common | Gold < 10 | Even beggars pity you. Rock bottom moment. |
| 172 | nouveau_riche | Nouveau Riche Problems | 1 | uncommon | Gold > 5000 | People treat you differently now that you're rich. |
| 173 | noble_obligation | Noble Obligation | 2 | uncommon | Rank > 4 | Your noble status requires attending a boring function. |
| 174 | charity_request | Charity Request | 1 | common | Gold > 200 | A worthy cause asks for your donation. |
| 175 | imposter_syndrome | Imposter Syndrome | 1 | uncommon | Rank > 3, was rank 1 | You feel out of place among nobles. Confidence choices. |
| 176 | wealth_display | Wealth Display | 1 | common | Gold > 1000 | People notice your wealth. Flaunt or be humble. |
| 177 | noble_duel | Noble Duel | 2 | rare | Rank > 4 | Insulted by another noble. Duel of honor. |
| 178 | patron_request | Patron of the Arts | 2 | uncommon | Gold > 2000 | Asked to sponsor an artist/musician. |
| 179 | king_advisor | King Seeks Advice | 2 | rare | Rank > 5 | The king personally asks your counsel. |
| 180 | estate_trouble | Estate Trouble | 2 | uncommon | Owns 5+ buildings | Managing your empire has complications. |
| 181 | peasant_uprising | Peasant Uprising | 3 | rare | Rank > 4, low prosperity | Peasants target your properties. |
| 182 | social_climber | Social Climber | 2 | uncommon | Rank 2-3 | Someone offers to help you climb socially... for a price. |
| 183 | merchant_prince | Merchant Prince Recognition | 1 | rare | Gold > 10000 | You're recognized as a merchant prince. Title + perks. |
| 184 | humble_origins | Humble Origins | 1 | common | Rank > 3 | Someone from your past reminds you where you came from. |
| 185 | dynasty_pressure | Dynasty Pressure | 2 | uncommon | Has dynasty_founder | Family expects you to produce an heir. |

### 10. CONTEXT (35 events) — Triggered by specific world state
These fire when specific conditions exist in the town/kingdom.

| # | ID | Name | Steps | Rarity | Condition |
|---|-----|------|-------|--------|-----------|
| 186 | quarantine_escape | Quarantine Escape | 2 | uncommon | Town quarantined | Someone offers to sneak you out. |
| 187 | plague_healer | Plague Healer | 2 | uncommon | Town has sick, has first_aid | You can help the sick. Major rep boost. |
| 188 | famine_relief | Famine Relief | 2 | common | Low food in market | Food is scarce. Share yours or hoard. |
| 189 | price_gouging | Price Gouging Witness | 1 | common | High prices | A merchant charging outrageous prices to desperate people. |
| 190 | boom_town | Boom Town Rush | 1 | common | High prosperity | Everyone's getting rich. Investment opportunities abound. |
| 191 | ghost_town | Ghost Town Blues | 1 | common | Low population | The town is dying. Stay or leave. |
| 192 | security_patrol | Security Patrol | 1 | common | High security | Guards are extra vigilant. Annoying searches. |
| 193 | lawless_streets | Lawless Streets | 1 | common | Low security | Crime is rampant. Dangerous but opportunity for underworld. |
| 194 | harvest_festival | Harvest Festival | 1 | common | Autumn, good prosperity | The town celebrates a good harvest. Festivities! |
| 195 | winter_hardship | Winter Hardship | 1 | common | Winter, low prosperity | A harsh winter. People struggle. Help or profit. |
| 196 | flood | Flash Flood | 2 | rare | Spring, near river | A flood damages the town. Help with recovery. |
| 197 | fire_outbreak | Fire Outbreak | 2 | uncommon | Any | A building catches fire. Help or protect your own. |
| 198 | new_king_reaction | New King Reaction | 1 | uncommon | King changed recently | People react to the new king. Opportunity for influence. |
| 199 | trade_boom | Trade Boom | 1 | uncommon | Many caravans | The market is bustling. Good deals everywhere. |
| 200 | drought | Drought | 1 | uncommon | Summer, farm town | Water is scarce. Prices for food/water spike. |
| 201 | bandit_surge | Bandit Surge | 1 | common | Low security, war | Bandits are everywhere. Travel is dangerous. |
| 202 | immigration_wave | Immigration Wave | 1 | common | High prosperity | Newcomers flood in. Cultural tension. |
| 203 | emigration | Mass Emigration | 1 | uncommon | Very low prosperity | People are leaving. Town is emptying. |
| 204 | construction_boom | Construction Boom | 1 | common | High prosperity | New buildings everywhere. Noise and opportunity. |
| 205 | market_manipulation | Market Manipulation | 2 | rare | Has trade_network | You detect market manipulation by an elite merchant. |
| 206 | religious_revival | Religious Revival | 1 | uncommon | Post-plague or post-war | A wave of religious fervor sweeps town. |
| 207 | cultural_festival | Cultural Festival | 1 | common | Any, spring/summer | A cultural event. Minigames and prizes. |
| 208 | mysterious_illness | Mysterious Illness | 2 | uncommon | Not sick, sick NPCs nearby | People falling ill. You might be next. |
| 209 | economic_collapse | Economic Collapse | 2 | rare | Very low prosperity | The local economy is in freefall. Crisis decisions. |
| 210 | foreign_invasion_rumor | Foreign Invasion Rumor | 1 | uncommon | Not at war, border town | Rumors of an impending invasion. Panic or prepare. |
| 211 | mine_collapse | Mine Collapse | 2 | uncommon | Town has mine | Miners trapped underground. Rescue effort. |
| 212 | ship_wreck | Shipwreck Sighting | 2 | uncommon | Coastal town | A ship wrecks near shore. Salvage opportunity. |
| 213 | festival_of_lights | Festival of Lights | 1 | common | Winter solstice | Beautiful lantern festival. Peaceful moment. |
| 214 | market_thief | Market Thief | 1 | common | Any | A thief is stealing from market stalls. Chase or ignore. |
| 215 | road_blocked | Road Blocked | 1 | common | After storm | A fallen tree blocks the road. Clear it or detour. |
| 216 | well_poisoned | Well Poisoned | 3 | rare | Has wells | Someone poisoned the well. Investigate and find the culprit. |
| 217 | merchant_caravan_arrival | Grand Caravan Arrival | 1 | common | Any | A massive foreign caravan arrives. Exotic goods. |
| 218 | tax_day | Tax Day | 1 | common | Any | Annual tax collection. Everyone's grumpy. |
| 219 | street_celebration | Street Celebration | 1 | common | After war ends | People celebrate peace. Dancing in streets. |
| 220 | cold_snap | Cold Snap | 1 | common | Winter | A sudden freeze. People need firewood and warm clothes. |

---

## UI Integration

### Event Popup (`openUnsolicitedEventPopup()` in ui.js)
- Modal dialog showing event title, narrative text, and choice buttons
- Same visual style as unsolicited quest offers
- For multi-step: shows current step, choices advance the story
- Effect results shown after choosing

### Quest Tracker Addition
- New section "🎲 Random Events" in the quest/journal tab
- Shows active multi-step events with current step and deadline
- Completed events show in history with outcome summary

### Engine Hooks
- `engine.js` daily tick: call `Player.tryDailyUnsolicitedEvent()`
- Travel arrival: call `Player.tryEntryUnsolicitedEvent(townId)`
- UI render loop: check `Player.getPendingUnsolicitedEvent()` and show popup

---

## Public API (on Player)
```
Player.tryDailyUnsolicitedEvent()        // 2% roll, called from engine tick
Player.tryEntryUnsolicitedEvent(townId)  // 5% roll, called on travel arrival
Player.getPendingUnsolicitedEvent()      // returns event popup data or null
Player.respondToUnsolicitedEvent(choiceIndex)  // player picks a choice
Player.getActiveUnsolicitedEvents()      // for quest tracker
Player.tickUnsolicitedEvents()           // daily expiry/fail check
Player.advanceUnsolicitedEvent(eventId, choiceIndex)  // multi-step advancement
```

---

## Implementation Order
1. Write `player_unsolicited_events.js` with all 220 events + core logic
2. Add `openUnsolicitedEventPopup()` to ui.js
3. Add "Random Events" section to quest tracker
4. Hook into engine.js daily tick + travel arrival
5. Add script tag to index.html
6. Cache bump, syntax check, backup, commit
