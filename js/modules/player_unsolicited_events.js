(function(Player) {
    'use strict';

    var player;
    var DAILY_CHANCE = 0.02;
    var ENTRY_CHANCE = 0.05;
    var GLOBAL_COOLDOWN_DAYS = 3;
    var PER_EVENT_COOLDOWN_DAYS = 60;
    var MAX_ACTIVE_MULTI_STEP = 3;
    var ACTIVE_EXPIRY_DAYS = 30;
    var CATEGORY_COOLDOWNS = {
        common: 2,
        trade: 3,
        social: 5,
        crime: 4,
        war: 3,
        political: 5,
        supernatural: 14,
        skill: 7,
        rank: 7,
        context: 3
    };
    var MULTI_TEMPLATES = {
        delayed_notice: true,
        trade_chain: true,
        romance_chain: true,
        investigation_chain: true,
        war_chain: true,
        political_chain: true,
        rank_chain: true,
        mystic_chain: true,
        skill_chain: true,
        context_chain: true,
        long_omen: true
    };
    var FOOD_IDS = ['wheat', 'bread', 'meat', 'fish', 'vegetables', 'eggs', 'honey', 'poultry', 'grapes'];
    var TRADE_IDS = ['bread', 'ale', 'wine', 'herbs', 'wood', 'planks', 'stone', 'bricks', 'iron', 'steel', 'tools', 'cloth', 'silk', 'wool', 'jewelry', 'bandages', 'rope', 'leather', 'hemp', 'hide', 'charcoal', 'perfume', 'pearls', 'furniture', 'saddles'];
    var WAR_IDS = ['swords', 'armor', 'bows', 'arrows', 'bandages', 'horses', 'iron', 'steel'];
    var LUXURY_IDS = ['wine', 'silk', 'jewelry', 'perfume', 'fine_clothes', 'tapestry', 'gold_goblet', 'pearl_jewelry', 'pearls'];
    var CRAFT_IDS = ['wood', 'planks', 'stone', 'bricks', 'clay', 'iron_ore', 'iron', 'steel', 'tools', 'leather', 'cloth', 'wool', 'rope', 'hemp', 'charcoal', 'hide'];
    var RESOURCE_NAMES = {
        wheat: 'wheat', bread: 'bread', meat: 'meat', fish: 'fish', vegetables: 'vegetables', eggs: 'eggs', honey: 'honey', salt: 'salt', ale: 'ale', wine: 'wine', herbs: 'herbs', wood: 'wood', planks: 'planks', stone: 'stone', bricks: 'bricks', clay: 'clay', iron_ore: 'iron ore', iron: 'iron', steel: 'steel', tools: 'tools', leather: 'leather', cloth: 'cloth', silk: 'silk', wool: 'wool', jewelry: 'jewelry', swords: 'swords', armor: 'armor', bows: 'bows', arrows: 'arrows', bandages: 'bandages', horses: 'horses', rope: 'rope', hemp: 'hemp', charcoal: 'charcoal', hide: 'hide', perfume: 'perfume', fine_clothes: 'fine clothes', tapestry: 'tapestry', gold_goblet: 'gold goblet', pearl_jewelry: 'pearl jewelry', pearls: 'pearls', poultry: 'poultry', grapes: 'grapes', furniture: 'furniture', saddles: 'saddles', gut_string: 'gut string'
    };
    var SPECIAL_TITLES = {
        lords_hunt: "Lord's Hunt",
        kings_midnight_walk: "King's Midnight Walk",
        merchant_prince_offer: 'Merchant-Prince Offer',
        royal_advisor_whisper: 'Royal Advisor Whisper',
        crown_burden: 'Crown Burden',
        throne_room_echo: 'Throne Room Echo',
        judge_in_disguise: 'Judge in Disguise',
        secret_admirer_letter: 'Secret Admirer Letter',
        witness_protection: 'Witness Protection'
    };

    function _sync() {
        player = Player && Player.state ? Player.state : null;
        return player;
    }
    function _getDay() { try { return Engine.getDay(); } catch (e) { return 0; } }
    function _getRng() { try { return Engine.getRng(); } catch (e) { return null; } }
    function _getWorld() { try { return Engine.getWorld(); } catch (e) { return null; } }
    function _findTown(id) { try { return id ? Engine.findTown(id) : null; } catch (e) { return null; } }
    function _findPerson(id) { try { return id ? Engine.findPerson(id) : null; } catch (e) { return null; } }
    function _findKingdom(id) { try { return id ? Engine.findKingdom(id) : null; } catch (e) { return null; } }
    function _log(msg, details, category) { try { Engine.logEvent(msg, details || null, category || 'my_actions'); } catch (e) {} }

    function _ensureState() {
        _sync();
        if (!player) return null;
        if (player._pendingUnsolicitedEvent === undefined) player._pendingUnsolicitedEvent = null;
        if (!player._activeUnsolicitedEvents) player._activeUnsolicitedEvents = [];
        if (!player._unsolicitedEventCooldowns) player._unsolicitedEventCooldowns = {};
        if (player._lastUnsolicitedEventDay == null) player._lastUnsolicitedEventDay = -9999;
        if (player._lastUnsolicitedEventEntryDay == null) player._lastUnsolicitedEventEntryDay = -9999;
        if (!player._nextUnsolicitedEventId) player._nextUnsolicitedEventId = 1;
        if (!player._unsolicitedEventCatCooldowns) player._unsolicitedEventCatCooldowns = {};
        if (!player.inventory) player.inventory = {};
        if (!player.skills) player.skills = {};
        if (!player.achievements) player.achievements = {};
        if (!player.socialRank) player.socialRank = {};
        if (!player.criminalRecord) player.criminalRecord = {};
        if (!player.childrenIds) player.childrenIds = [];
        if (!player.relationships) player.relationships = {};
        if (!player.buildings) player.buildings = [];
        if (!player.illnesses) player.illnesses = [];
        if (!player.injuries) player.injuries = [];
        return player;
    }

    function _isTutorial() {
        try { return typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive(); } catch (e) { return false; }
    }
    function _isStorySuppressed() {
        return !!(player && player.storyMode && player.storyMode.active && !player.storyMode.complete);
    }
    function _isEncounterSuppressed() {
        return !!(player && player.storyMode && player.storyMode.flags && player.storyMode.flags.suppressEncounters);
    }
    function _suppressed() {
        return _isTutorial() || _isStorySuppressed() || _isEncounterSuppressed();
    }
    function _num(value, fallback) {
        return typeof value === 'number' && !isNaN(value) ? value : fallback;
    }
    function _copy(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }
    function _countTruthy(obj) {
        var count = 0;
        var k;
        if (!obj) return 0;
        for (k in obj) if (obj[k]) count++;
        return count;
    }
    function _countInventory(ids) {
        var total = 0;
        var i;
        for (i = 0; i < ids.length; i++) total += player.inventory[ids[i]] || 0;
        return total;
    }
    function _countCrimes() {
        var total = 0;
        var kid, crimeMap, crimeId;
        for (kid in player.criminalRecord) {
            crimeMap = player.criminalRecord[kid] || {};
            for (crimeId in crimeMap) total += crimeMap[crimeId] || 0;
        }
        return total;
    }
    function _playerName() {
        return player && player.firstName ? player.firstName : 'Merchant';
    }
    function _kingdomAtWar(kingdom) {
        if (!kingdom || !kingdom.atWar) return false;
        return Array.isArray(kingdom.atWar) ? kingdom.atWar.length > 0 : !!kingdom.atWar.size;
    }
    function _currentKingdomId() {
        if (player && player.isKing && player.kingState && player.kingState.kingdomId) return player.kingState.kingdomId;
        if (player && player.townId) {
            var t = _findTown(player.townId);
            if (t && t.kingdomId) return t.kingdomId;
        }
        return null;
    }
    function _playerRankIndex(kid) {
        if (!kid) kid = _currentKingdomId();
        return kid && player.socialRank ? (player.socialRank[kid] || 0) : 0;
    }
    function _activeMultiCount() {
        var count = 0;
        var i, def, inst;
        for (i = 0; i < player._activeUnsolicitedEvents.length; i++) {
            inst = player._activeUnsolicitedEvents[i];
            def = inst ? EVENT_DEF_MAP[inst.defId] : null;
            if (def && MULTI_TEMPLATES[def.template]) count++;
        }
        return count;
    }
    function _buildContext() {
        var day = _getDay();
        var rng = _getRng();
        var world = _getWorld();
        var town = player && player.townId ? _findTown(player.townId) : null;
        var kid = town && town.kingdomId ? town.kingdomId : _currentKingdomId();
        var kingdom = kid ? _findKingdom(kid) : null;
        return {
            player: player,
            day: day,
            rng: rng,
            world: world,
            town: town,
            kingdom: kingdom,
            kingdomId: kid,
            townName: town ? town.name : 'the road',
            kingdomName: kingdom ? kingdom.name : 'the realm',
            playerName: _playerName(),
            security: _num(town && town.security, 50),
            happiness: _num(town && town.happiness, 50),
            prosperity: _num(town && town.prosperity, 50),
            atWar: _kingdomAtWar(kingdom),
            foodCount: _countInventory(FOOD_IDS),
            tradeCount: _countInventory(TRADE_IDS),
            skillCount: _countTruthy(player.skills),
            achievementCount: _countTruthy(player.achievements),
            crimeCount: _countCrimes(),
            activeMulti: _activeMultiCount()
        };
    }

    function _titleize(id) {
        var title, parts, i;
        if (SPECIAL_TITLES[id]) return SPECIAL_TITLES[id];
        parts = (id || '').split('_');
        for (i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
        }
        title = parts.join(' ');
        return title || id;
    }
    function _derivedExtra(def) {
        var extra = _copy(def.extra || {});
        var id = def.id;
        if (!extra.npcRole) {
            if (def.category === 'trade') extra.npcRole = 'merchant';
            else if (def.category === 'social') extra.npcRole = (id.indexOf('noble') >= 0 || id.indexOf('court') >= 0 || id.indexOf('widow') >= 0 || id.indexOf('wedding') >= 0 || id.indexOf('patron') >= 0) ? 'noble' : 'town';
            else if (def.category === 'crime') extra.npcRole = (id.indexOf('guard') >= 0 || id.indexOf('watch') >= 0 || id.indexOf('warrant') >= 0) ? 'guard' : 'rogue';
            else if (def.category === 'war') extra.npcRole = 'soldier';
            else if (def.category === 'political') extra.npcRole = (id.indexOf('royal') >= 0 || id.indexOf('crown') >= 0 || id.indexOf('palace') >= 0) ? 'king' : 'noble';
            else if (def.category === 'rank') extra.npcRole = (id.indexOf('king') >= 0 || id.indexOf('crown') >= 0 || id.indexOf('throne') >= 0 || id.indexOf('royal') >= 0) ? 'king' : 'noble';
            else extra.npcRole = 'town';
        }
        if (def.category === 'war') extra.war = true;
        if (def.category === 'skill' && extra.skillCountAtLeast == null) extra.skillCountAtLeast = 1;
        if (id.indexOf('quarantine') >= 0 || id.indexOf('plague') >= 0) extra.townQuarantined = true;
        if (id === 'low_security_bounty') extra.securityBelow = 45;
        if (id === 'high_security_request') extra.securityAbove = 60;
        if (id === 'prosperous_patron' || id === 'luxury_mania' || id === 'merchant_prince_offer') extra.wealthAbove = 500;
        if (id === 'famine_kitchen' || id === 'cheap_bread_riot' || id === 'empty_wells' || id === 'winter_shortage' || id === 'drought_omen') extra.foodLow = true;
        if (id === 'overflowing_granary' || id === 'harvest_blessing') extra.foodPlenty = true;
        if (id === 'tea_with_widow' || id === 'secret_admirer_letter' || id === 'balcony_serenade' || id === 'moonlit_confession' || id === 'winter_courtship' || id === 'noble_flirtation') extra.noSpouse = true;
        if (id === 'child_delivers_flower') extra.hasChildren = true;
        if (id === 'lover_quarrel') extra.hasSpouse = true;
        if (id === 'crown_burden' || id === 'kings_midnight_walk') extra.isKing = true;
        if (id === 'royal_advisor_whisper' || id === 'throne_room_echo') extra.rankAtLeast = 6;
        if (id === 'lords_hunt' || id === 'vassal_plea') extra.rankAtLeast = 5;
        if (id === 'minor_noble_request' || id === 'title_challenge' || id === 'heralds_bow') extra.rankAtLeast = 4;
        if (id === 'guildmaster_notice') extra.rankAtLeast = 3;
        if (id === 'burgher_invitation') extra.rankAtLeast = 2;
        if (id === 'citizen_dispute') extra.rankAtLeast = 1;
        if (id === 'peasant_petition') extra.rankAtMost = 1;
        if (id === 'notorious_reputation') extra.crimeHistory = true;
        if (id === 'pickpocket_brush' || id === 'tavern_brawl_bet' || id === 'bridge_collapse' || id === 'flood_salvage' || id === 'battlefield_relic' || id === 'grave_robber_tip' || id === 'collapsed_awning') extra.hazard = true;
        return extra;
    }

    function _peopleInTown(townId) {
        var world = _getWorld();
        var people = world && world.people ? world.people : [];
        var list = [];
        var i, p;
        for (i = 0; i < people.length; i++) {
            p = people[i];
            if (!p || p.alive === false || p.id === 'player') continue;
            if (townId && p.townId !== townId) continue;
            list.push(p);
        }
        return list;
    }
    function _pickNpc(ctx, role) {
        var rng = ctx.rng;
        var people = _peopleInTown(ctx.town ? ctx.town.id : null);
        var list = [];
        var i, p, rank;
        if (!rng || !people.length) return null;
        if (role === 'family') {
            if (player.spouseId) {
                p = _findPerson(player.spouseId);
                if (p && p.alive !== false && (p.age == null || p.age >= 18) && (!ctx.town || p.townId === ctx.town.id)) list.push(p);
            }
            for (i = 0; i < player.childrenIds.length; i++) {
                p = _findPerson(player.childrenIds[i]);
                if (p && p.alive !== false && (p.age == null || p.age >= 18) && (!ctx.town || p.townId === ctx.town.id)) list.push(p);
            }
            return list.length ? list[rng.randInt(0, list.length - 1)] : null;
        }
        for (i = 0; i < people.length; i++) {
            p = people[i];
            if (p.age != null && p.age < 18) continue;
            rank = ctx.kingdomId && p.socialRank ? (p.socialRank[ctx.kingdomId] || 0) : 0;
            if (role === 'noble' && rank < 4) continue;
            if (role === 'king' && !((ctx.kingdom && ctx.kingdom.king === p.id) || rank >= 6)) continue;
            list.push(p);
        }
        if (role === 'king' && ctx.kingdom && ctx.kingdom.king) {
            p = _findPerson(ctx.kingdom.king);
            if (p && p.alive !== false) list.push(p);
        }
        if (!list.length) {
            // Don't fall back to random adults for strict role requirements
            if (role === 'noble' || role === 'king') return null;
            for (i = 0; i < people.length; i++) {
                if (people[i].age == null || people[i].age >= 18) list.push(people[i]);
            }
        }
        return list.length ? list[rng.randInt(0, list.length - 1)] : null;
    }

    function _chooseFromGroup(def, ctx) {
        var rng = ctx.rng;
        var id = def.id;
        var extra = _derivedExtra(def);
        if (extra.resourceId) return extra.resourceId;
        if (id.indexOf('fish') >= 0) return 'fish';
        if (id.indexOf('grain') >= 0) return 'wheat';
        if (id.indexOf('silk') >= 0) return 'silk';
        if (id.indexOf('herb') >= 0) return 'herbs';
        if (id.indexOf('spice') >= 0) return 'perfume';
        if (id.indexOf('wine') >= 0) return 'wine';
        if (id.indexOf('candle') >= 0) return 'rope';
        if (id.indexOf('salt') >= 0) return 'salt';
        if (id.indexOf('horse') >= 0) return 'horses';
        if (id.indexOf('paper') >= 0 || id.indexOf('scribe') >= 0) return 'charcoal';
        if (id.indexOf('iron') >= 0) return 'iron';
        if (id.indexOf('tool') >= 0) return 'tools';
        if (id.indexOf('wood') >= 0 || id.indexOf('wagon') >= 0 || id.indexOf('bridge') >= 0) return 'wood';
        if (def.category === 'war') return WAR_IDS[rng.randInt(0, WAR_IDS.length - 1)];
        if (def.category === 'trade') return TRADE_IDS[rng.randInt(0, TRADE_IDS.length - 1)];
        if (def.category === 'context' && (id.indexOf('bread') >= 0 || id.indexOf('harvest') >= 0 || id.indexOf('granary') >= 0)) return FOOD_IDS[rng.randInt(0, FOOD_IDS.length - 1)];
        if (def.category === 'political' || def.category === 'rank') return LUXURY_IDS[rng.randInt(0, LUXURY_IDS.length - 1)];
        if (def.category === 'skill') return CRAFT_IDS[rng.randInt(0, CRAFT_IDS.length - 1)];
        return TRADE_IDS[rng.randInt(0, TRADE_IDS.length - 1)];
    }
    function _rarityBase(rarity) {
        if (rarity === 'legendary') return { gold: [120, 240], rep: [6, 10], rel: [5, 9], energy: [5, 10], qty: [5, 9], wait: [4, 8] };
        if (rarity === 'epic') return { gold: [80, 160], rep: [4, 8], rel: [4, 7], energy: [4, 8], qty: [4, 8], wait: [3, 6] };
        if (rarity === 'rare') return { gold: [45, 95], rep: [3, 6], rel: [3, 6], energy: [3, 6], qty: [3, 6], wait: [2, 5] };
        if (rarity === 'uncommon') return { gold: [20, 55], rep: [2, 4], rel: [2, 5], energy: [2, 5], qty: [2, 5], wait: [2, 4] };
        return { gold: [8, 28], rep: [1, 3], rel: [1, 4], energy: [1, 4], qty: [1, 4], wait: [1, 3] };
    }
    function _roll(rng, range) {
        return rng.randInt(range[0], range[1]);
    }
    function _passesCondition(ctx, def) {
        var extra = _derivedExtra(def);
        if (!ctx || !ctx.rng || !player || !ctx.town) return false;
        if (extra.war && !ctx.atWar) return false;
        if (extra.peace && ctx.atWar) return false;
        if (extra.townQuarantined && !(ctx.town && ctx.town.isQuarantined)) return false;
        if (extra.notQuarantined && ctx.town && ctx.town.isQuarantined) return false;
        if (extra.securityBelow != null && !(ctx.security < extra.securityBelow)) return false;
        if (extra.securityAbove != null && !(ctx.security > extra.securityAbove)) return false;
        if (extra.happinessBelow != null && !(ctx.happiness < extra.happinessBelow)) return false;
        if (extra.happinessAbove != null && !(ctx.happiness > extra.happinessAbove)) return false;
        if (extra.prosperityBelow != null && !(ctx.prosperity < extra.prosperityBelow)) return false;
        if (extra.prosperityAbove != null && !(ctx.prosperity > extra.prosperityAbove)) return false;
        if (extra.wealthAbove != null && !((player.gold || 0) >= extra.wealthAbove)) return false;
        if (extra.wealthBelow != null && !((player.gold || 0) <= extra.wealthBelow)) return false;
        if (extra.energyBelow != null && !((player.energy || 0) <= extra.energyBelow)) return false;
        if (extra.energyAbove != null && !((player.energy || 0) >= extra.energyAbove)) return false;
        if (extra.isKing && !(player.isKing && player.kingState && player.kingState.kingdomId)) return false;
        if (extra.notKing && player.isKing) return false;
        if (extra.hasSpouse && !player.spouseId) return false;
        if (extra.noSpouse && player.spouseId) return false;
        if (extra.hasChildren && !(player.childrenIds && player.childrenIds.length)) return false;
        if (extra.noChildren && player.childrenIds && player.childrenIds.length) return false;
        if (extra.rankAtLeast != null && !(_playerRankIndex(ctx.kingdomId) >= extra.rankAtLeast)) return false;
        if (extra.rankAtMost != null && !(_playerRankIndex(ctx.kingdomId) <= extra.rankAtMost)) return false;
        if (extra.skillCountAtLeast != null && !(ctx.skillCount >= extra.skillCountAtLeast)) return false;
        if (extra.achievementCountAtLeast != null && !(ctx.achievementCount >= extra.achievementCountAtLeast)) return false;
        if (extra.crimeHistory && !(ctx.crimeCount > 0)) return false;
        if (extra.foodLow && !(ctx.foodCount <= 6)) return false;
        if (extra.foodPlenty && !(ctx.foodCount >= 15)) return false;
        if (extra.injured && !(player.injuries && player.injuries.length)) return false;
        if (extra.ill && !(player.illnesses && player.illnesses.length)) return false;
        if (extra.buildingCountAtLeast != null && !((player.buildings || []).length >= extra.buildingCountAtLeast)) return false;
        if (extra.npcRole && !_pickNpc(ctx, extra.npcRole)) return false;
        return true;
    }
    function _fill(text, params, ctx) {
        var out = text || '';
        var k;
        var replacements = {
            townName: (params && params.townName) || (ctx && ctx.townName) || 'the town',
            kingdomName: (params && params.kingdomName) || (ctx && ctx.kingdomName) || 'the realm',
            playerName: (params && params.playerName) || (ctx && ctx.playerName) || 'Merchant',
            npcName: (params && params.npcName) || 'a stranger',
            npc2Name: (params && params.npc2Name) || 'another person'
        };
        for (k in replacements) out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), replacements[k]);
        if (params) {
            for (k in params) out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        }
        return out;
    }
    function _stepDelay(def, instance, nextStepIndex) {
        if (nextStepIndex == null) return 0;
        if (def.template === 'long_omen') {
            if (nextStepIndex === 1) return instance.params.waitDays;
            if (nextStepIndex === 2) return instance.params.waitDays2;
            if (nextStepIndex === 4) return 1;
            return 0;
        }
        if (MULTI_TEMPLATES[def.template] && nextStepIndex > 0) return instance.params.waitDays;
        return 0;
    }
    function _sceneLead(def) {
        var t = def.title || 'an unusual situation';
        if (def.category === 'trade') return '📜 ' + t + ' —';
        if (def.category === 'social') return 'In {townName}, an event unfolds: ' + t + '.';
        if (def.category === 'crime') return 'In the shadows of {townName} — ' + t + '.';
        if (def.category === 'war') return 'Word reaches you in {townName}: ' + t + '.';
        if (def.category === 'political') return 'A political matter arises in {townName}: ' + t + '.';
        if (def.category === 'supernatural') return 'Something unsettling stirs in {townName} — ' + t + '.';
        if (def.category === 'skill') return 'A challenge presents itself in {townName}: ' + t + '.';
        if (def.category === 'rank') return 'A matter of standing demands your attention in {townName}: ' + t + '.';
        if (def.category === 'context') return 'The situation in {townName} shifts — ' + t + '.';
        if (def.category === 'common') return 'Something catches your attention in {townName}: ' + t + '.';
        return 'In {townName}, something unfolds — ' + t + '.';
    }
    function _rawStep(def, instance, ctx) {
        instance.choiceHistory = instance.choiceHistory || [];

        var step = instance.stepIndex || 0;
var lead = _sceneLead(def);

// Template: windfall
if (def.template === 'windfall') {
    var wText, wPocket;
    if (def.category === 'crime') {
        wText = lead + ' Rainwater runs black along the cobbles when you spot a coin purse half-hidden beneath a shuttered stall in {townName}. It is heavy enough to matter, and the clasp is stamped with a crest you do not recognize. Somewhere nearby, someone is cursing their loss, while the watch at the end of the lane has seen nothing yet. Fortune has come to you wearing another person\'s grief.';
        wPocket = 'Close your fist over the purse and melt into the crowd (+{goldAmount}g)';
    } else if (def.category === 'trade') {
        wText = lead + ' The counting table at the {townName} exchange is crowded and loud when {npcName} discovers an error in the ledger. They have charged you twice for the same lot, and their face drains white as witnesses begin to notice. With stiff fingers, they count out {goldAmount} gold and push it across the board. You can take the money, turn the moment into goodwill, or leave the merchant to remember your restraint.';
        wPocket = 'Take the refunded coin and let the ledger close (+{goldAmount}g)';
    } else {
        wText = lead + ' A loose stone beside the well in {townName} hides a small cache wrapped in oilcloth. Inside waits a scatter of old gold worth about {goldAmount}, dry despite the morning mist and far too neatly hidden to be random. No one sees you find it, but that silence feels temporary. Luck has opened its hand to you, and now your own hand must answer.';
        wPocket = 'Keep the windfall and say nothing (+{goldAmount}g)';
    }
    return { title: def.title, icon: def.icon, text: wText, choices: [
        { id: 'pocket', label: wPocket, effectKey: 'pocket' },
        { id: 'share', label: 'Call attention to the find and let others share the blessing (+reputation, +relationship)', effectKey: 'share' },
        { id: 'leave', label: 'Leave it where fate put it and walk on (+energy)', effectKey: 'leave' }
    ] };
}

// Template: aid
if (def.template === 'aid') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} catches you by the sleeve beside the gate, mud to the knees and panic bright in the eyes. Their handcart has split open in the street, and sacks of grain are spilling into the gutter while teamsters curse and ride around it. If the grain is lost, their household will feel it before the week is done. You can stoop and help, turn the mess into a bargain, or keep walking while everyone watches.', choices: [
        { id: 'help', label: 'Set your shoulder to the cart and help save the grain (-energy, +reputation, +relationship)', effectKey: 'help' },
        { id: 'refuse', label: 'Step around the mess and keep your time for yourself (+gold, -relationship)', effectKey: 'refuse' },
        { id: 'exploit', label: 'Offer help only if the desperation can pay you (+gold, -reputation)', effectKey: 'exploit' }
    ] };
}

// Template: trade_offer
if (def.template === 'trade_offer') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} waits in the shadow of the {townName} warehouse with a tarp thrown over a handcart. When they lift it, you glimpse {itemQty} units of {resourceName}, dry and clean and ready to move, worth far more than the whispered price of {costGold} gold. Another buyer pretends not to stare from across the lane, and the dock bell has only just rung. If you want this bargain, you need to decide before the next breath finishes.', choices: [
        { id: 'buy', label: 'Strike hands and take the lot before the other buyer moves (costs {costGold}g, +goods, +relationship)', effectKey: 'buy', requires: { gold: 'costGold' } },
        { id: 'pass', label: 'Let the bargain sail past and keep your purse uncommitted (+energy)', effectKey: 'pass' },
        { id: 'report', label: 'Send word to the market authorities about the suspicious price (+reputation, -relationship)', effectKey: 'report' }
    ] };
}

// Template: social_scene
if (def.template === 'social_scene') {
    var scText;
    if (def.category === 'social') {
        scText = lead + ' Music and lamp-smoke drift through the square as {npcName} falls into step beside you with two cups of spiced wine. Their smile is easy, but their eyes keep searching your face for an answer to some unasked question. Half the town seems to be laughing nearby, which means half the town can also watch what you do next. A warm word could knit a bond tonight; a cruel one could break it in public.';
    } else if (def.category === 'political') {
        scText = lead + ' Silver plate glints beneath candlelight while {npcName} traps you in a courteous conversation no one could mistake for harmless. Every compliment lands like a probe, and every pause gives the listeners around you time to weigh your rank, your loyalties, and your nerve. Somewhere behind the minstrels, a noble coughs to hide interest. You are not merely speaking; you are choosing what story the room will tell about you by morning.';
    } else {
        scText = lead + ' {npcName} approaches at the edge of the street crowd, close enough that only you can hear the first words. There is hope in the set of their shoulders, and fear in how quickly that hope might be embarrassed. A few nearby traders glance over, pretending not to notice. Whatever tone you choose now will travel farther than the conversation itself.';
    }
    return { title: def.title, icon: def.icon, text: scText, choices: [
        { id: 'encourage', label: 'Answer with warmth and invite the moment to deepen (+relationship, +reputation)', effectKey: 'encourage' },
        { id: 'polite', label: 'Keep the exchange gracious but carefully distant (+modest relationship)', effectKey: 'polite' },
        { id: 'cruel', label: 'Cut {npcName} down where everyone can hear it (+gold, -relationship, -reputation)', effectKey: 'cruel' }
    ] };
}

// Template: crime_scene
if (def.template === 'crime_scene') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} waits under a crooked lantern where the alley bends out of sight of the main street. Their plan comes out in a whisper: a ledger to steal, a watchman to distract, a door that will stand unbarred for exactly one minute. The money, {goldAmount} gold by their reckoning, is real, but so is the knife-shaped gap in their smile when they say nothing can go wrong. The night smells of wet rope and bad choices.', choices: [
        { id: 'join', label: 'Take the scheme and trust the dark to cover you (+{goldAmount}g, risk of injury, -reputation)', effectKey: 'join' },
        { id: 'refuse', label: 'Leave {npcName} in the alley and keep your hands clean (+gold)', effectKey: 'refuse' },
        { id: 'report_crime', label: 'Go straight to the watch and sell them the whole scheme (+reputation, -relationship)', effectKey: 'report_crime' }
    ] };
}

// Template: skill_test
if (def.template === 'skill_test') {
    return { title: def.title, icon: def.icon, text: lead + ' The square in {townName} has been ringed with rope for a brutal little contest: a sprint across rolling casks, a climb up a greased pole, and a final throw at three bronze targets. The crowd roars every time someone slips, and the prize purse grows more tempting each time the herald rattles it. Win, and you walk away with coin and a story people repeat. Lose, and you may leave with bruised ribs and a bruised name.', choices: [
        { id: 'attempt', label: 'Vault the rope and trust your feet, hands, and nerve (-energy, +gold, chance of injury)', effectKey: 'attempt' },
        { id: 'bet_safe', label: 'Study every mistake from the edge of the crowd (+energy, +modest reputation)', effectKey: 'bet_safe' },
        { id: 'pass', label: 'Keep your pride untested and your bones unbroken (no immediate effect)', effectKey: 'pass' }
    ] };
}

// Template: delayed_notice
if (def.template === 'delayed_notice') {
    if (step === 0) {
        var dnText;
        if (def.category === 'social' || def.category === 'common') {
            dnText = lead + ' {npcName} asks to speak somewhere quieter and keeps wringing their hands even after you stop. A family matter in {townName} is about to come before the elders, but not until {waitDays} days have passed and the right witnesses arrive. If you commit, you tie a piece of your reputation to theirs. If you would rather profit now, there are uglier ways to use what you know.';
        } else if (def.category === 'political') {
            dnText = lead + ' {npcName} draws you behind a tapestry and speaks without ever quite moving their lips. A petition is being carried through {townName}, and in {waitDays} days it will either lift one faction or break it. Your backing could matter when the chamber doors finally open. So could a well-timed betrayal, if gold matters more than patience.';
        } else {
            dnText = lead + ' {npcName} brings you a matter that cannot be solved by sunset. A decision in {townName} is coming, but the people who matter will not gather for {waitDays} days, and until then every promise is a wager. If you lend your name, you share the risk. If you twist the moment now, the profit will come quicker than the consequences.';
        }
        return { title: def.title, icon: def.icon, text: dnText, choices: [
            { id: 'accept', label: 'Tie your name to the outcome and wait for word (+future outcome in {waitDays} days)', effectKey: 'accept', nextStepIndex: 1 },
            { id: 'decline', label: 'Keep your distance and leave the burden to someone else (+gold)', effectKey: 'decline' },
            { id: 'exploit', label: 'Use the uncertainty now while everyone else is still blind (+gold, -reputation)', effectKey: 'exploit' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'After {waitDays} days, {npcName} returns with rain on their cloak and news that the matter has broken into the open. People in {townName} know you stood near this business, and now they watch to see whether you mean to be generous, ambitious, or forgettable. There is coin on the table, gratitude in the air, and danger in both. However you finish this, your name will stick to it.', choices: [
        { id: 'claim', label: 'Take public credit and the reward that follows (+{rewardGold}g, +reputation)', effectKey: 'claim' },
        { id: 'spread', label: 'Turn the outcome into a story that lifts everyone involved (+reputation, +relationship)', effectKey: 'spread' },
        { id: 'withdraw', label: 'Step back before the matter asks anything more of you (+energy)', effectKey: 'withdraw' }
    ] };
}

// Template: trade_chain
if (def.template === 'trade_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} unrolls a grease-stained shipping note across a tavern table and taps the line for {resourceName}. A caravan delayed by floodwater will reach {townName} in {waitDays} days, and anyone who buys in now can seize the lot before the guild posts the new price. {costGold} gold is enough to claim a real share, which means enough to hurt if the rumor is false. The candles are burning low, and every trader in the room is pretending not to listen.', choices: [
            { id: 'commit', label: 'Lay down full coin now and trust the rumor to ripen (costs {costGold}g, higher reward in {waitDays} days)', effectKey: 'commit', nextStepIndex: 1, requires: { gold: 'costGold' } },
            { id: 'haggle', label: 'Bargain hard before you risk a single crown (costs {costGold}g, less risk, +relationship)', effectKey: 'haggle', nextStepIndex: 1, requires: { gold: 'costGold' } },
            { id: 'pass', label: 'Leave the speculation to hungrier merchants (no immediate effect)', effectKey: 'pass' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'At dawn on the {waitDays}th day, the caravan finally groans through the gate with {resourceName} stacked high under road dust. The market in {townName} lurches around the news, and suddenly the wager you made feels heavy in your hands. You can take an honest profit, strip every last coin from the frenzy, or let the town remember that you did not squeeze it while it was hungry. Fortune has arrived, but so has judgment.', choices: [
        { id: 'unload', label: 'Sell cleanly and take the fair profit while the market is hot (+{rewardGold}g, +{itemQty} {resourceName})', effectKey: 'unload' },
        { id: 'flip', label: 'Drive the price to its cruelest edge before the panic cools (+maximum gold, -reputation)', effectKey: 'flip' },
        { id: 'donate', label: 'Release part of the shipment where need will remember it (+reputation, lighter purse)', effectKey: 'donate' }
    ] };
}

// Template: romance_chain
if (def.template === 'romance_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} does not flirt like someone playing a game. They hold your gaze too long, then look away as though the effort cost them courage. Before parting, they ask whether you would meet them in {waitDays} days, somewhere quiet in {townName} where gossip cannot reach first. A gentle refusal will still sting; a cruel one may turn warmth into an old wound.', choices: [
            { id: 'encourage', label: 'Say yes and let the anticipation grow between now and then (+relationship)', effectKey: 'encourage', nextStepIndex: 1 },
            { id: 'polite', label: 'Refuse softly enough to leave dignity standing (+modest relationship)', effectKey: 'polite' },
            { id: 'cruel', label: 'Cut the feeling off before it can ask anything of you (+gold, -relationship, -reputation)', effectKey: 'cruel' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'When the day comes, lanternlight shivers over the water cistern behind the old shrine, and {npcName} is already waiting. They have dressed with care, but one hand still betrays nerves whenever footsteps pass nearby. If you go to them, you may deepen something real. If you arrive bearing a gift, you say even more; if you do not come at all, silence will answer for you.', choices: [
        { id: 'attend', label: 'Keep the meeting and see what might grow there (+relationship, -energy)', effectKey: 'attend' },
        { id: 'bring_gift', label: 'Arrive with a thoughtful gift and make the answer unmistakable (costs {costGold}g, +strong relationship, +reputation)', effectKey: 'bring_gift', requires: { gold: 'costGold' } },
        { id: 'stay_away', label: 'Leave {npcName} alone under the lanterns (+gold, -relationship)', effectKey: 'stay_away' }
    ] };
}

// Template: investigation_chain
if (def.template === 'investigation_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' The story begins with one bad detail that will not sit still: a locked storeroom opened from the inside, a payment made twice, a witness who lies too smoothly. {npcName}\'s name keeps surfacing in whispers around {townName}, never loudly, never by accident. If you pull on the thread for {waitDays} days, you may find gold, justice, or trouble with a knife in it. If you sell the rumor now, you gain coin and lose the right to know the truth.', choices: [
            { id: 'investigate', label: 'Work the alleys quietly until the truth shows its face (-energy, results in {waitDays} days)', effectKey: 'investigate', nextStepIndex: 1 },
            { id: 'sell_secret', label: 'Sell the lead to someone who wants coin more than clarity (+gold, -reputation)', effectKey: 'sell_secret' },
            { id: 'ignore', label: 'Let the suspicion rot where it lies (no immediate effect)', effectKey: 'ignore' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'Your quiet questions have led you to proof: a ledger page torn but not burned, a hidden key, a meeting place no honest business needs. By the time the bells ring, you know exactly how {npcName} is entangled. The evidence is enough to confront, enough to condemn, and enough to profit from if your conscience bends. What you do next will decide whether this ends as justice, leverage, or theft.', choices: [
        { id: 'confront', label: 'Put the proof in {npcName}\'s face and force an answer (+reputation, -relationship, risk of injury)', effectKey: 'confront' },
        { id: 'report_crime', label: 'Hand everything to the authorities and let the law bite (+reputation, -relationship)', effectKey: 'report_crime' },
        { id: 'pocket', label: 'Take what value the truth offers and vanish with it (+gold)', effectKey: 'pocket' }
    ] };
}

// Template: war_chain
if (def.template === 'war_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' A mud-spattered rider brings {npcName}\'s plea before the sun is properly up. The companies on the road outside {townName} are short of food, short of bandages, and burying men faster than scribes can write the names. What you send now will reach the front in {waitDays} days, when it may mean a shield held, a wound closed, or a line broken. You can give from duty, deal from advantage, or keep your wagons far from the killing.', choices: [
            { id: 'assist', label: 'Send what is needed because the line must hold (-energy, +reputation)', effectKey: 'assist', nextStepIndex: 1 },
            { id: 'profit', label: 'Supply the war, but make certain the ledger smiles too (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 1 },
            { id: 'decline', label: 'Keep your people and wagons clear of the battlefield (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The messenger who returns from the front looks older than when they left. They say your choice mattered: a company held, wounded soldiers lived through the night, and officers in {kingdomName} have spoken your name over maps stained with candle grease. Now a reward is offered, and even this peaceable moment feels sharp with memory. Take gold, give it to those who bled, or turn victory into a favor that may save lives later.', choices: [
        { id: 'accept_reward', label: 'Take the reward and let the realm see who answered the call (+{rewardGold}g, +reputation)', effectKey: 'accept_reward' },
        { id: 'donate_reward', label: 'Send the reward to the wounded and the widowed (+strong reputation)', effectKey: 'donate_reward' },
        { id: 'ask_for_favor', label: 'Ask for a debt of honor instead of coin (+relationship, +reputation)', effectKey: 'ask_for_favor' }
    ] };
}

// Template: political_chain
if (def.template === 'political_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} invites you to speak beneath music loud enough to hide treason. A vote, appointment, or accusation will turn the court of {kingdomName} within {waitDays} days, and they want your weight on the scale before anyone else knows it is moving. If the play succeeds, new doors open; if it fails, old enemies will remember your face. You can back the scheme, sell the whisper, or keep your hands clean while others gamble with crowns.', choices: [
            { id: 'support', label: 'Lend your influence and help shove the balance their way (+reputation, +relationship)', effectKey: 'support', nextStepIndex: 1 },
            { id: 'leak', label: 'Carry the secret to the other side while it still buys well (+gold, -reputation)', effectKey: 'leak' },
            { id: 'decline', label: 'Step out before intrigue fastens itself to your name (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'By the time the news is public, three powerful people are smiling too hard and one has stopped smiling entirely. {npcName}\'s maneuver has changed the balance in {kingdomName}, and your part in it is no longer invisible. Reward waits for you, but so does envy. Press forward boldly, accept a quieter payoff, or step back before success paints a target on your cloak.', choices: [
        { id: 'press_advantage', label: 'Push while the door is open and take the larger prize (+{rewardGold}g, +reputation)', effectKey: 'press_advantage' },
        { id: 'take_gift', label: 'Accept the discreet gift and leave the spotlight to others (+gold, -modest reputation)', effectKey: 'take_gift' },
        { id: 'step_back', label: 'Fade from the board before the knives come out (+energy)', effectKey: 'step_back' }
    ] };
}

// Template: rank_chain
if (def.template === 'rank_chain') {
    if (step === 0) {
        var rkText;
        if (def.category === 'social' || def.category === 'common') {
            rkText = lead + ' {npcName} bows a little too deeply when they reach you, and everyone nearby notices. They have brought a petition that would never be heard from common lips unless someone of standing chose to listen. The request is not small, and granting even your attention will spend time and face alike. In this square, mercy looks like strength, but so does reminding people that rank has a price.';
        } else {
            rkText = lead + ' {npcName} approaches with the careful posture of someone who knows one wrong word can offend power. What they bring is half petition, half test: a matter of privilege, precedence, and who may ask what of whom in {townName}. The onlookers are already measuring you by how long you make them wait. You can hear them fully, tax them for the honor, or dismiss them hard enough that everyone learns the lesson.';
        }
        return { title: def.title, icon: def.icon, text: rkText, choices: [
            { id: 'hear_them_out', label: 'Grant a serious hearing and spend the weight of your name (-energy, +reputation)', effectKey: 'hear_them_out', nextStepIndex: 1 },
            { id: 'exact_toll', label: 'Make them pay for the privilege of your attention (+gold, -reputation)', effectKey: 'exact_toll', nextStepIndex: 1 },
            { id: 'brush_aside', label: 'Dismiss the matter before it costs you another breath (+gold, -reputation)', effectKey: 'brush_aside' }
        ] };
    }
    if (def.category === 'social' || def.category === 'common') {
        return { title: def.title, icon: def.icon, text: 'By evening, the story has traveled all through {townName}. People say you gave {npcName} a hearing when you had every excuse to do otherwise, and now gratitude has begun to gather around your name. You can answer that gratitude with open generosity, let it take the shape of a proper reward, or close the matter before it grows into obligation. Standing is never only what you are called; it is what others remember you doing.', choices: [
            { id: 'grant_mercy', label: 'Answer gratitude with generosity and a steady hand (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
            { id: 'take_tribute', label: 'Accept a fitting tribute for time only you could give (+{rewardGold}g, +reputation)', effectKey: 'take_tribute' },
            { id: 'close_case', label: 'End the matter neatly before it becomes another chain (+energy)', effectKey: 'close_case' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The matter has become public, and now every tavern in {townName} has an opinion about it. Some call your handling just, others call it calculated, and all of them are watching for the final act. Mercy will earn praise, tribute will affirm your station, and silence will end the spectacle on your terms. Even restraint can look like power when enough eyes are on you.', choices: [
        { id: 'grant_mercy', label: 'Show mercy where everyone can see what kind of power you choose (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
        { id: 'take_tribute', label: 'Collect the tribute due to a person of your standing (+{rewardGold}g, +reputation)', effectKey: 'take_tribute' },
        { id: 'close_case', label: 'Shut the door on the affair and deny the crowd an ending (+energy)', effectKey: 'close_case' }
    ] };
}

// Template: mystic_chain
if (def.template === 'mystic_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' At dusk, a dog refuses to cross one particular doorway in {townName}, and the old woman sweeping nearby makes a sign against evil when she sees you notice. {npcName} swears the same three knocks came at their shutters last night, though no one stood outside. The air smells of rain and tallow, and every sound after that seems a little too clear. You can follow the omen, listen without surrendering to it, or laugh loudly enough to drown your own unease.', choices: [
            { id: 'heed', label: 'Follow the sign before courage has time to cool (-energy)', effectKey: 'heed', nextStepIndex: 1 },
            { id: 'listen', label: 'Hear the story out and keep one hand on doubt (+reputation)', effectKey: 'listen', nextStepIndex: 1 },
            { id: 'mock', label: 'Scoff at the fear and leave the town to its superstition (+gold, -reputation)', effectKey: 'mock' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'After {waitDays} days, the disturbance returns with teeth. Windows frost from the inside, strangers repeat words you spoke in private, and {npcName} refuses to sleep without a lamp burning. Whatever began as rumor now presses against the edges of ordinary life in {townName}. Follow it to the source, buy wards and smother it, or turn your back before it learns your name.', choices: [
        { id: 'follow', label: 'Track the omen to whatever is bold enough to cast it (+gold, risk of injury)', effectKey: 'follow' },
        { id: 'ward', label: 'Buy wards and nail them over every threshold (costs {costGold}g, +energy)', effectKey: 'ward', requires: { gold: 'costGold' } },
        { id: 'refuse', label: 'Refuse the call and trust distance to save you (+gold)', effectKey: 'refuse' }
    ] };
}

// Template: skill_chain
if (def.template === 'skill_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' Notices have been nailed to every post in {townName}: the guild is holding a formal contest in {waitDays} days, with judges coming from outside the walls and pride worth almost as much as the purse. Bakers boast, fencers preen, and scribes rehearse speeches in the street. If you enter now, you bind your name to the performance before the crowd ever sees it. You can commit, study from the edge, or spare yourself the spectacle.', choices: [
            { id: 'accept', label: 'Enter your name and stand before the judges when the day comes (+future contest in {waitDays} days)', effectKey: 'accept', nextStepIndex: 1 },
            { id: 'bet_safe', label: 'Watch the field and learn what the winners know (+energy, +reputation)', effectKey: 'bet_safe' },
            { id: 'decline', label: 'Keep your craft private and your pride untested (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'When the day arrives, the hall is packed shoulder to shoulder, hot with lamp smoke and expectation. Your rivals stand in their best clothes, pretending confidence while the judges whisper behind polished tablets. You have done enough to matter; now the prize can crown you, unite the room, or prove you are strong enough not to clutch at applause. In contests like this, the last gesture is often remembered longer than the winning one.', choices: [
        { id: 'collect_prize', label: 'Take the purse and let the victory be seen (+{rewardGold}g, +reputation)', effectKey: 'collect_prize' },
        { id: 'share_credit', label: 'Name the hands that helped you reach the dais (+reputation, +relationship)', effectKey: 'share_credit' },
        { id: 'walk', label: 'Leave the glory on the stage before it owns you (+energy)', effectKey: 'walk' }
    ] };
}

// Template: context_chain
if (def.template === 'context_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' Trouble has broken loose in {townName}, and it wears the kind of face merchants cannot ignore: empty stalls, frightened families, and angry voices rising faster than answers. {npcName} meets you in the street with ash on their sleeves and asks you to do more than merely witness it. If you step in, you spend yourself for people who may never repay you. If you profit instead, you may fill your purse while the town keeps score.', choices: [
            { id: 'intervene', label: 'Step into the middle of the crisis and bear some of its weight (-energy, +reputation)', effectKey: 'intervene', nextStepIndex: 1 },
            { id: 'profit', label: 'Turn confusion into leverage while everyone is desperate (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 1 },
            { id: 'observe', label: 'Stay clear of the crush and watch before you commit (+energy)', effectKey: 'observe' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The crisis has finally broken, though not cleanly. In the quieter streets of {townName}, people can point to what you did, what you took, or where you stood aside. A reward is pressed on you with tired hands, and the town itself feels like it is waiting to see whether you will keep giving. Take the money, pour coin back into the recovery, or leave before gratitude curdles into dependence.', choices: [
        { id: 'take_reward', label: 'Accept the reward and let the matter end there (+{rewardGold}g)', effectKey: 'take_reward' },
        { id: 'reinvest', label: 'Put coin back into the town while the wounds are still fresh (costs {costGold}g, +strong reputation)', effectKey: 'reinvest', requires: { gold: 'costGold' } },
        { id: 'leave', label: 'Slip away before one favor becomes ten (+energy)', effectKey: 'leave' }
    ] };
}

// Template: long_omen
if (def.template === 'long_omen') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' The first sign comes in a dream so ordinary it is worse than nightmare: your own room, your own bed, and a second set of breathing somewhere just outside sight. At dawn, the same spiral you saw in sleep is found scratched into a door near the market. {npcName} insists it was not there yesterday. You can step toward the omen or laugh it down before fear roots too deeply.', choices: [
            { id: 'heed', label: 'Step toward the omen before daylight makes you doubt it (+future omen)', effectKey: 'heed', nextStepIndex: 1 },
            { id: 'mock', label: 'Laugh at the sign and deny it room in your thoughts (-reputation)', effectKey: 'mock' }
        ] };
    }
    if (step === 1) {
        return { title: def.title, icon: def.icon, text: 'After {waitDays} days, the shape of the thing begins to repeat. A child in the square hums the melody from your dream, an old beggar wears {npcName}\'s dead mother\'s smile for half a heartbeat, and footsteps follow you through empty alleys without ever closing the distance. Sleep no longer clears the mind; it only opens another door. Listen more closely, or refuse the pattern before it tightens.', choices: [
            { id: 'listen', label: 'Listen for the pattern and let it lead you deeper (+reputation)', effectKey: 'listen', nextStepIndex: 2 },
            { id: 'refuse', label: 'Break away now before curiosity becomes a leash (no immediate effect)', effectKey: 'refuse' }
        ] };
    }
    if (step === 2) {
        return { title: def.title, icon: def.icon, text: 'After another {waitDays2} days, the omen stops borrowing shadows and starts taking room in the world. The spiral appears in flour dust, frost, and spilled wine, and strangers in {townName} turn their heads together when your name is spoken. Even the priests have begun speaking softly around you. Follow the sign to where it wants you, or buy wards and pray wood, silver, and salt can bar what has learned the threshold.', choices: [
            { id: 'follow', label: 'Go where the sign points, even if it points below the town (+gold, risk of injury)', effectKey: 'follow', nextStepIndex: 3 },
            { id: 'ward', label: 'Buy wards and try to nail shut whatever has opened (costs {costGold}g)', effectKey: 'ward', requires: { gold: 'costGold' } }
        ] };
    }
    if (step === 3) {
        return { title: def.title, icon: def.icon, text: 'The trail ends beneath {townName}, where old stone drinks the lanternlight and every sound returns a moment late. There you find the heart of the omen: not a beast, not a ghost, but a presence wrapped around something valuable and terribly patient, as if it has been waiting for someone foolish enough to call discovery a gift. It can make you richer, more famous, or simply more marked. Claim it, turn the story loose on the town, or back away while your shadow still belongs to you.', choices: [
            { id: 'claim', label: 'Take what the darkness guards and bear the cost openly (+{rewardGold}g, +reputation)', effectKey: 'claim', nextStepIndex: 4 },
            { id: 'spread', label: 'Carry the tale upward and let the whole town live with it (+reputation, +relationship)', effectKey: 'spread', nextStepIndex: 4 },
            { id: 'withdraw', label: 'Retreat while retreat is still possible (+energy)', effectKey: 'withdraw' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'By morning, the haunting has withdrawn, but it has not left things unchanged. Dogs snarl at empty corners, people in {townName} lower their voices when you pass, and sometimes you catch that spiral where no hand could have drawn it. A final reward remains, along with the choice of whether the truth dies with you or grows legs in the mouths of others. Whatever you choose, this town will carry the scar.', choices: [
        { id: 'take_reward', label: 'Take the last reward and call the horror worth surviving (+{rewardGold}g)', effectKey: 'take_reward' },
        { id: 'mark_secret', label: 'Bury the truth in your own keeping and spare the town a little fear (+relationship, +reputation)', effectKey: 'mark_secret' },
        { id: 'leave', label: 'Leave the scar covered and walk away while you still can (+energy)', effectKey: 'leave' }
    ] };
}

return { title: def.title, icon: def.icon, text: lead, choices: [{ id: 'leave', label: 'Move on', effectKey: 'leave' }] };


        // ---- Drama/Intrigue Templates ----
        if (def.template === 'poison_plot') {
            if (step === 0) return { title: def.title, icon: def.icon, text: lead + ' In a shuttered pantry beneath a feast hall in {townName}, you overhear {npc2Name} bargaining for a powder that kills slow and looks like a fever. Then you hear the name that matters: {npcName}. By the next cup poured, someone important may die smiling. You can save a life, step into the conspiracy, dig for the hidden hand, or sell the secret while it is still worth something.', choices: [
                { id: 'warn_target', label: 'Warn {npcName} before the cup is raised', effectKey: 'support', nextStepIndex: 1 },
                { id: 'join_plot', label: 'Sit down with {npc2Name} and hear the full scheme', effectKey: 'join', nextStepIndex: 1 },
                { id: 'investigate_plot', label: 'Follow the poison trail and learn who ordered it', effectKey: 'investigate', nextStepIndex: 1 },
                { id: 'sell_poison_secret', label: 'Sell the rumor to whoever pays first', effectKey: 'sell_secret' }
            ] };
            if (step === 1) return { title: def.title, icon: def.icon, text: 'What should have been a simple murder turns into a knot of vengeance. {npcName} swears the poison was meant for them, yet the ledger you uncover suggests the fatal cup might have been prepared for {npc2Name} instead, or for whichever noble lifted the ceremonial goblet first. Now both names are wrapped around the same lie, and both parties are terrified that you know where the truth begins.', choices: [
                { id: 'bring_watch', label: 'Bring the whole matter to the watch before anyone drinks', effectKey: 'report_crime', nextStepIndex: 2 },
                { id: 'private_confrontation', label: 'Confront the would-be killer in private and risk steel in the dark', effectKey: 'confront', nextStepIndex: 2 },
                { id: 'take_hush_money', label: 'Take hush money and let fear finish the poisoning for you', effectKey: 'take_gift', nextStepIndex: 2 }
            ] };
            return { title: def.title, icon: def.icon, text: 'By the time the feast ends in {townName}, goblets lie shattered across the rushes and every survivor tells a different story. {npcName} is alive. {npc2Name} is smiling too carefully. Half the hall thinks you prevented a murder, and the other half suspects you merely sold a better one. One last choice decides whether this becomes justice, leverage, or a rumor no witness can prove.', choices: [
                { id: 'claim_rescue', label: 'Claim before the hall that you saved the intended victim', effectKey: 'claim' },
                { id: 'shape_story', label: 'Spread a careful version that leaves both sides in your debt', effectKey: 'spread' },
                { id: 'bury_knife', label: 'Withdraw before the survivors remember your part in it', effectKey: 'withdraw' }
            ] };
        }

        if (def.template === 'alliance_offer') {
            if (step === 0) return { title: def.title, icon: def.icon, text: lead + ' {npcName} asks for a private word in {townName}, and the urgency in their voice strips all politeness away. Their feud with {npc2Name} has curdled from insult into sabotage, missing cargo, and friends forced to choose a banner. {npcName} wants your name beside theirs when the next blow lands. If you agree, you may gain a powerful ally and a permanent enemy in the same breath.', choices: [
                { id: 'back_npc', label: 'Stand publicly with {npcName} and let {npc2Name} see it', effectKey: 'support', nextStepIndex: 1 },
                { id: 'sell_offer', label: 'Carry the offer to {npc2Name} and sell what you know', effectKey: 'leak', nextStepIndex: 1 },
                { id: 'hear_case', label: 'Hear {npcName} out without swearing yourself yet', effectKey: 'hear_them_out', nextStepIndex: 1 },
                { id: 'decline_banner', label: 'Decline to wear either rival\'s colors tonight', effectKey: 'decline' }
            ] };
            return { title: def.title, icon: def.icon, text: 'The rivalry breaks into the open faster than anyone expected. In the square at {townName}, {npc2Name} answers with accusations sharp enough to draw blood, and suddenly everyone assumes you know which of them is lying. Both camps are watching your face for the smallest sign of weakness. Press now, and you may secure a dangerous ally. Misjudge the moment, and you become the third fool in a two-person war.', choices: [
                { id: 'press_side', label: 'Press your advantage and demand a seat at the victor\'s table', effectKey: 'press_advantage' },
                { id: 'quiet_reward', label: 'Accept a quiet gift from {npcName} and call the debt settled', effectKey: 'take_gift' },
                { id: 'step_out', label: 'Step back before pride turns both rivals against you', effectKey: 'step_back' }
            ] };
        }

        if (def.template === 'betrayal_chain') {
            if (step === 0) return { title: def.title, icon: def.icon, text: lead + ' {npcName} arrives looking like someone who has not slept and does not deserve to. They swear somebody has been forging letters in their hand, ruining your deals and steering coin toward {npc2Name}. Then they place one last message in your palm: your name, their seal, and instructions precise enough to gut your business. Either {npcName} betrayed you, or someone built a lie from truths only a friend should know.', choices: [
                { id: 'listen_friend', label: 'Hear {npcName} out and follow the story to its source', effectKey: 'hear_them_out', nextStepIndex: 1 },
                { id: 'trail_forgery', label: 'Investigate the forged letters yourself', effectKey: 'investigate', nextStepIndex: 1 },
                { id: 'accuse_now', label: 'Confront {npcName} with the letter before they can shape the tale', effectKey: 'confront', nextStepIndex: 1 },
                { id: 'sell_betrayal', label: 'Sell word of the betrayal before the market hears it for free', effectKey: 'sell_secret' }
            ] };
            if (step === 1) return { title: def.title, icon: def.icon, text: 'The second truth is uglier than the first. The forged letters are real, but so are the missing ledgers. {npc2Name} has been buying up routes that should have stayed in your hands, and {npcName} admits they met them in secret. Not to ruin you, they say, but to keep a debt collector away from their family. Maybe that is confession. Maybe it is rehearsal. Either way, trust is now a blade with two edges.', choices: [
                { id: 'back_last_time', label: 'Back {npcName} one last time and help set a trap for {npc2Name}', effectKey: 'support', nextStepIndex: 2 },
                { id: 'deliver_both', label: 'Report both names and let the authorities sort guilt from panic', effectKey: 'report_crime', nextStepIndex: 2 },
                { id: 'profit_twice', label: 'Turn the leverage into profit and let both sides bleed coin', effectKey: 'profit', nextStepIndex: 2 }
            ] };
            return { title: def.title, icon: def.icon, text: 'When the trap finally snaps shut, the room fills with evidence and none of it matches perfectly. {npc2Name} produces a witness. {npcName} produces a confession. Each account explains enough to sound true and hides enough to survive. What remains is not certainty, only the kind of choice powerful people later call justice.', choices: [
                { id: 'keep_real_secret', label: 'Mark the real secret and keep {npcName} owing you', effectKey: 'mark_secret' },
                { id: 'take_public_reward', label: 'Accept the public reward for untangling the mess', effectKey: 'accept_reward' },
                { id: 'refuse_profit', label: 'Donate the reward and let the town remember your restraint', effectKey: 'donate_reward' }
            ] };
        }

        if (def.template === 'court_intrigue') {
            if (step === 0) return { title: def.title, icon: def.icon, text: lead + ' A sealed note draws you into a candlelit gallery where the wrong whisper can topple a house. {npcName} lays out the pieces with steady hands: forged letters, stolen wax seals, and a rumor meant to ruin {npc2Name} before the court ever hears a defense. If the lie lands cleanly, one faction rises and another breaks. If it fails, everyone involved burns. You are being offered a place in the game, not a seat outside it.', choices: [
                { id: 'join_intrigue', label: 'Support {npcName}\'s quiet campaign and help move the board', effectKey: 'support', nextStepIndex: 1 },
                { id: 'sell_letters', label: 'Leak the forged letters to the rival camp for profit', effectKey: 'leak', nextStepIndex: 1 },
                { id: 'trace_seals', label: 'Investigate who forged the seals and who profits twice', effectKey: 'investigate', nextStepIndex: 1 }
            ] };
            if (step === 1) return { title: def.title, icon: def.icon, text: 'The intrigue folds back on itself. The letters were forged, yes, but not by the hand everyone expected. {npc2Name} arrives at a secret meeting with proof that {npcName} has been feeding half-truths to the court, while a third faction waits behind the tapestry for whoever survives the argument. One word from you could crown a liar, expose a greater liar, or convince the room that truth was always negotiable.', choices: [
                { id: 'blow_room_open', label: 'Confront the plotters in the open and risk the backlash', effectKey: 'confront', nextStepIndex: 2 },
                { id: 'rise_with_storm', label: 'Press your advantage while both factions still need you', effectKey: 'press_advantage', nextStepIndex: 2 },
                { id: 'accept_silence', label: 'Take a quiet gift and swear you saw nothing clearly', effectKey: 'take_gift', nextStepIndex: 2 }
            ] };
            return { title: def.title, icon: def.icon, text: 'By dawn, the whispers have become policy. A forged letter curls black in a brazier, two nobles refuse to meet each other\'s eyes, and your name passes from mouth to mouth as either savior or snake. Court remembers outcomes, not motives. This is the moment when history chooses its wording, and you can still put your thumb on the scale.', choices: [
                { id: 'claim_place', label: 'Claim your role openly before the court rewrites it', effectKey: 'claim' },
                { id: 'write_whispers', label: 'Spread a careful version that leaves every survivor owing you', effectKey: 'spread' },
                { id: 'leave_smoke', label: 'Step back before gratitude becomes another leash', effectKey: 'step_back' }
            ] };
        }

        if (def.template === 'tavern_chaos') {
            if (step === 0) return { title: def.title, icon: def.icon, text: lead + ' One harmless drink with {npcName} and {npc2Name} in a tavern at {townName} becomes several, then a song, then an argument about whether a goose can legally witness a contract. By midnight a chair has lost a duel with a minstrel, somebody is shouting tax law at a barrel, and the innkeeper slides a crumpled deed across the table because apparently you won something important in a contest involving turnips. The sensible choice would be to leave. Which is exactly why nobody has taken it yet.', choices: [
                { id: 'lean_in', label: 'Attend the chaos properly and see how much worse it can get', effectKey: 'attend', nextStepIndex: 1 },
                { id: 'buy_round', label: 'Bring a peace offering round before someone throws the goose', effectKey: 'bring_gift', nextStepIndex: 1, requires: { gold: 'costGold' } },
                { id: 'save_dignity', label: 'Stay away from the next round and keep your dignity intact', effectKey: 'stay_away' }
            ] };
            return { title: def.title, icon: def.icon, text: 'When your head finally clears, you are wearing one boot, a flower crown, and possession of a muddy deed to a property described as Half a Barn, Mostly Upright. {npcName} insists you founded a mutual-defense pact. {npc2Name} insists you accidentally married a cider barrel. The witnesses disagree on every detail except one: whatever happened, it was legendary and may now be legally binding.', choices: [
                { id: 'take_absurd_prize', label: 'Claim the ridiculous prize and own the story', effectKey: 'collect_prize' },
                { id: 'share_disaster', label: 'Share credit with {npcName} and {npc2Name} before anyone reads the contract aloud', effectKey: 'share_credit' },
                { id: 'flee_goose', label: 'Walk away before the goose finds you with tax questions', effectKey: 'walk' }
            ] };
        }


        // ---- Comedy Templates ----
        if (def.template === 'mistaken_identity') {
        if (step === 0) {
            var miText;
            if (def.category === 'political') {
                miText = lead + ' A sweating clerk in {townName} sees you arrive, turns pale, and whispers to {npcName}, "The royal auditor is here." Ledgers vanish under pastries, merchants begin apologizing to furniture, and three people bow to you before asking what tax crime looks least suspicious.';
            } else if (def.category === 'crime') {
                miText = lead + ' A market guard takes one look at you and decides the legendary outlaw everyone fears has returned to {townName}. The rumor spreads so quickly that by the time {npcName} reaches you, two thieves are offering tribute and one baker is locking his pies.';
            } else if (def.category === 'social') {
                miText = lead + ' A breathless messenger rushes up in {townName}, thrusts flowers into your hands, and announces that the mysterious admirer from the love ballad has finally appeared. Half the square expects a grand confession. {npcName} is already watching for the first swoon.';
            } else {
                miText = lead + ' A squire in {townName} drops to one knee and loudly announces that the famed champion traveling in disguise has arrived. You. Somehow. {npcName} immediately starts introducing you to people who want autographs, blessings, and advice about dramatic sword poses.';
            }
            return { title: def.title, icon: def.icon, text: miText, choices: [
                { id: 'encourage', label: 'Play along with outrageous confidence (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 1 },
                { id: 'polite', label: 'Correct them with painfully careful politeness (+modest relationship)', effectKey: 'polite', nextStepIndex: 1 },
                { id: 'exploit', label: 'See whether mistaken fame can be monetized (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 }
            ] };
        }
        if (step === 1) {
            var miFollow;
            if (lastChoiceId === 'encourage') {
                miFollow = 'Your confident performance worked far too well. By sunset, a line has formed outside the inn: petitioners, admirers, one man with a goose for inspection, and {npcName}, who keeps insisting this is still manageable in the tone of someone lying to both of you.';
            } else if (lastChoiceId === 'polite') {
                miFollow = 'Your correction has been received as noble modesty. The people of {townName} now believe only a truly important person would deny being important so firmly. {npcName} congratulates you on achieving greater status by trying not to.';
            } else {
                miFollow = 'Your little profit scheme worked beautifully until people began handing you invoices, vows of loyalty, and one deeply sincere love poem. {npcName} is laughing too hard to help and not nearly hard enough to be kind.';
            }
            return { title: def.title, icon: def.icon, text: miFollow, choices: [
                { id: 'claim', label: 'Give a magnificent speech from the nearest chair (+{rewardGold}g, +reputation)', effectKey: 'claim' },
                { id: 'spread', label: 'Turn the disaster into a story the whole town enjoys (+reputation, +relationship)', effectKey: 'spread' },
                { id: 'withdraw', label: 'Escape through the kitchen before anyone asks for proof (+energy)', effectKey: 'withdraw' }
            ] };
        }
    }

    if (def.template === 'animal_chaos') {
        var acText;
        if (def.category === 'political') {
            acText = lead + ' A goat has eaten half the tax collector\'s records in {townName} and is now chewing thoughtfully on the part that proves who owes what. The tax collector blames you because the goat seems to trust your cart more than his authority. {npcName} looks delighted by this collapse of bureaucracy.';
        } else if (def.category === 'social') {
            acText = lead + ' A parrot on a windowsill keeps repeating secrets it definitely should not know, including one thing {npcName} told you in confidence and another thing the mayor told absolutely everyone not to repeat. Each squawk makes the crowd louder and the faces redder.';
        } else if (def.category === 'trade') {
            acText = lead + ' A cat has installed itself on the counter of a shuttered shop in {townName}, and the neighbors now insist it inherited the business because the former owner once called it "my little partner" in front of witnesses. {npcName} is arguing with a cat over ownership law and losing.';
        } else {
            acText = lead + ' A pig has burst into the courthouse of {townName}, skidded across the floor, and somehow ended up sitting in the magistrate\'s chair while everyone shouts legal advice. {npcName} claims the pig is showing more dignity than the court usually manages.';
        }
        return { title: def.title, icon: def.icon, text: acText, choices: [
            { id: 'intervene', label: 'Wrestle dignity back into the situation (-energy, +reputation)', effectKey: 'intervene' },
            { id: 'observe', label: 'Stand back and let the town become wiser through suffering (+energy)', effectKey: 'observe' },
            { id: 'take_reward', label: 'Offer suspiciously expensive animal advice (+{rewardGold}g)', effectKey: 'take_reward' }
        ] };
    }

    if (def.template === 'drunken_deal') {
        if (step === 0) {
            var ddText;
            if (def.category === 'trade') {
                ddText = lead + ' Last night in {townName}, after entirely too much pear cider, you and {npcName} shook hands on a deal so enthusiastically that the tavern applauded. Nobody can now explain whether it involved {resourceName}, a handcart, or naming rights to a warehouse goat.';
            } else if (def.category === 'crime') {
                ddText = lead + ' What began as a discreet drink with {npcName} became a loud, blurry agreement involving sealed cheese, implied deniability, and a witness who may have been a lamp. This morning, someone insists the arrangement is binding.';
            } else if (def.category === 'social') {
                ddText = lead + ' At a feast in {townName}, a friendly toast with {npcName} somehow became a signed agreement on the back of a sauce-stained menu. The witnesses insist the partnership also included a poem, a goose, and everlasting mutual respect.';
            } else {
                ddText = lead + ' You wake to learn that you and {npcName} apparently made a solemn deal while drunk. The barkeep remembers every word, keeps winking, and swears the phrase "for the glory of {townName}" was used as legal language.';
            }
            return { title: def.title, icon: def.icon, text: ddText, choices: [
                { id: 'accept', label: 'Honor the absurd bargain and see where destiny limps (-energy)', effectKey: 'accept', nextStepIndex: 1 },
                { id: 'haggle', label: 'Buy the table another round and renegotiate soberly enough (-less gold, +relationship)', effectKey: 'haggle', nextStepIndex: 1, requires: { gold: 'costGold' } },
                { id: 'exploit', label: 'Add one tiny clause while everyone is sentimental (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 }
            ] };
        }
        if (step === 1) {
            var ddFollow;
            if (lastChoiceId === 'accept') {
                ddFollow = 'Morning has brought clarity and a document proving you now co-own a ceremonial wagon, two damp stools, and a venture called Honest {townName} Enterprises. {npcName} keeps reading the contract aloud as if repetition might make it respectable.';
            } else if (lastChoiceId === 'haggle') {
                ddFollow = 'Your revision succeeded. Unfortunately, the new wording says whichever partner complains first must also provide onions for a year. {npcName} is pretending this is a standard trade clause and almost convincing you.';
            } else {
                ddFollow = 'Your extra clause held. You now own the profitable half of the arrangement, while {npcName} owns the responsibilities, the goose, and most of the resentment. This is legally excellent and spiritually ugly.';
            }
            return { title: def.title, icon: def.icon, text: ddFollow, choices: [
                { id: 'unload', label: 'Sell your share of the ridiculous enterprise before noon (+{rewardGold}g, +goods)', effectKey: 'unload' },
                { id: 'share_credit', label: 'Laugh it off and present it as visionary business (+reputation, +relationship)', effectKey: 'share_credit' },
                { id: 'walk', label: 'Leave the papers behind and never speak of this again (+energy)', effectKey: 'walk' }
            ] };
        }
    }

    if (def.template === 'rumor_spiral') {
        if (step === 0) {
            var rsText;
            if (def.category === 'political' || def.category === 'crime') {
                rsText = lead + ' A tiny rumor in {townName} has already mutated into a masterpiece: by the third retelling, you supposedly stole the king\'s horse, taught it manners, and returned it so disappointed in royalty that it now bows only to merchants. {npcName} heard this version from someone who swore it was the modest account.';
            } else if (def.category === 'social') {
                rsText = lead + ' A harmless remark about you and {npcName} has become a full court romance. By noon, the town believes you secretly married a duchess, wrote her nine sonnets, and rejected three lesser nobles out of principle and excellent posture.';
            } else if (def.category === 'skill') {
                rsText = lead + ' Someone in {townName} claims you once slew a dragon with a cheese knife. By the next corner, the dragon had two heads, the knife sang hymns, and {npcName} was your faithful witness despite never having seen a dragon, a hymn-singing knife, or you behaving that impressively.';
            } else {
                rsText = lead + ' A small boast in {townName} has swollen into holy nonsense. The crowd now believes you ended a famine by glaring at a turnip until it became inspirational. {npcName} cannot decide whether to deny it or ask for lessons.';
            }
            return { title: def.title, icon: def.icon, text: rsText, choices: [
                { id: 'polite', label: 'Correct the story gently and with real facts (+modest relationship)', effectKey: 'polite', nextStepIndex: 1 },
                { id: 'encourage', label: 'Smile mysteriously and let nonsense do its work (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 1 },
                { id: 'exploit', label: 'Sell signed versions before the details improve further (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 }
            ] };
        }
        if (step === 1) {
            var rsFollow;
            if (lastChoiceId === 'polite') {
                rsFollow = 'Your correction has been received as legendary modesty. The people of {townName} now say only a true hero would deny wrestling a dragon, marrying a duchess, or reforming a royal horse. {npcName} calls this the worst possible victory.';
            } else if (lastChoiceId === 'encourage') {
                rsFollow = 'By afternoon, children are following you through {townName} with wooden swords, love poems, and stolen horse impressions. Adults are not much better. {npcName} says your face has become public property.';
            } else {
                rsFollow = 'The rumor now has merchandise. There is a pastry named after you, a ballad with three inaccurate verses, and a paid queue for anyone hoping to hear the true story from your noble mouth. {npcName} wants a share for emotional damages.';
            }
            return { title: def.title, icon: def.icon, text: rsFollow, choices: [
                { id: 'claim', label: 'Climb a barrel and reward the crowd with a performance (+{rewardGold}g, +reputation)', effectKey: 'claim' },
                { id: 'spread', label: 'Turn the rumor into cheerful local legend (+reputation, +relationship)', effectKey: 'spread' },
                { id: 'withdraw', label: 'Disappear before anyone asks for proof (+energy)', effectKey: 'withdraw' }
            ] };
        }
    }

    if (def.template === 'cooking_contest') {
        if (step === 0) {
            var ccText;
            if (def.category === 'political') {
                ccText = lead + ' The cooking contest in {townName} has become political. Every spoonful is now said to honor or insult somebody important, and the judges have the faces of people ready to start a civil war over gravy. {npcName}, your rival, is wearing an apron like battle armor.';
            } else if (def.category === 'trade') {
                ccText = lead + ' A market argument about the proper price of turnips escalates into a public cooking challenge. Suddenly you are competing, {npcName} is your rival, and the judges are measuring honesty by the shine of the stew and the firmness of the crust.';
            } else if (def.category === 'social') {
                ccText = lead + ' A feast in {townName} goes sideways when somebody volunteers you for the cooking contest. {npcName} takes this so seriously that they have already accused you of emotional sabotage, spice fraud, and suspiciously confident whisking.';
            } else {
                ccText = lead + ' You arrive in {townName} just as a cook faints, points at you with a floury spoon, and names you the replacement. The judges are three terrifying grandmothers and one man who judges crispness by sound alone. {npcName} looks thrilled to ruin you.';
            }
            return { title: def.title, icon: def.icon, text: ccText, choices: [
                { id: 'accept', label: 'Cook whatever panic and destiny place in your pot (-energy)', effectKey: 'accept', nextStepIndex: 1 },
                { id: 'bring_gift', label: 'Arrive with a scandalously expensive garnish (-{costGold}g, strong impression)', effectKey: 'bring_gift', nextStepIndex: 1, requires: { gold: 'costGold' } },
                { id: 'haggle', label: 'Negotiate for better ingredients, oven space, and mercy (+relationship)', effectKey: 'haggle', nextStepIndex: 1, requires: { gold: 'costGold' } }
            ] };
        }
        if (step === 1) {
            var ccFollow;
            if (lastChoiceId === 'accept') {
                ccFollow = 'Against reason, you have produced a dish. It smells like ambition, butter, and a minor legal dispute. {npcName} tastes the air and declares your crust technically treason.';
            } else if (lastChoiceId === 'bring_gift') {
                ccFollow = 'Your expensive garnish has the judges murmuring with interest, suspicion, and hunger. One calls the plating aristocratic. Another calls it dangerous. {npcName} looks as if they might challenge a parsley sprig to a duel.';
            } else {
                ccFollow = 'Your bargaining worked. You secured better ingredients, shared oven time, and a brief truce with {npcName}. Then somebody switched the salt and sugar for sport, so the contest remains morally compromised.';
            }
            return { title: def.title, icon: def.icon, text: ccFollow, choices: [
                { id: 'collect_prize', label: 'Serve it with terrifying confidence and demand judgment (+{rewardGold}g, +reputation)', effectKey: 'collect_prize' },
                { id: 'share_credit', label: 'Praise your rival, the oven boy, and anyone who survived tasting (+reputation, +relationship)', effectKey: 'share_credit' },
                { id: 'walk', label: 'Withdraw before the judges identify every crime in the stew (+energy)', effectKey: 'walk' }
            ] };
        }
    }

    

        // ---- Relationship Templates ----
        if (def.template === 'rival_merchant') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} has made a habit of appearing one stall over in {townName}, smiling that ledger-thin smile while somehow offering the same goods for a hair less. Today they greet you by name, then steal a customer with a compliment they must have practiced all morning. Even so, when the crowd turns, {npcName} gives you a small nod meant for no one else. They see you. Worse, they enjoy being seen by you. {npc2Name}, one of your best contacts, is watching to see whether this becomes a trade war or the beginning of something stranger.',
                choices: [
                    { id: 'fair_duel', label: 'Meet {npcName} price for price and keep it honorable (-less gold, +relationship)', effectKey: 'haggle', nextStepIndex: 1 },
                    { id: 'poach_contact', label: 'Use {npc2Name} to poach the customer outright (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 },
                    { id: 'split_sale', label: 'Offer to split the sale and test whether rivalry can bend (+gold, +reputation, +relationship)', effectKey: 'share', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var rivalStep1 = '{npcName} finds you after sunset beside the counting house in {townName}. Their coat is damp from the mist, their temper drier than old parchment. "You make this interesting, {playerName}," they say. "That is either the highest praise I have, or a warning." Then {npc2Name} arrives with word of a caravan slot large enough for only one of you unless you choose to cooperate.';
                if (firstChoice === 'poach_contact') rivalStep1 = '{npcName} does not bother hiding the hurt when they catch up with you in {townName}. "You could have beaten me clean," they say, voice low. "Instead you made {npc2Name} choose." The words should feel like victory. They do not. Even so, when news comes of a caravan slot large enough for only one merchant unless the two of you cooperate, {npcName} brings it to you instead of burying it.';
                if (firstChoice === 'split_sale') rivalStep1 = 'The shared sale should have eased things, but instead it has changed their shape. {npcName} finds you in {townName} carrying two cups of bad market wine and offers you one without smiling. "We made coin," they say. "That does not mean I trust you." When {npc2Name} brings word of a caravan slot that favors cooperation over ego, the question hanging between you is not profit. It is whether either of you can bear to owe the other.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: rivalStep1,
                    choices: [
                        { id: 'run_together', label: 'Risk a joint run with {npcName} (+reputation, +relationship)', effectKey: 'support', nextStepIndex: 2 },
                        { id: 'blacken_name', label: 'Quietly report {npcName} for their sharp practices (+reputation, -relationship)', effectKey: 'report', nextStepIndex: 2 },
                        { id: 'respect_distance', label: 'Keep the rivalry sharp but respectful (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 2 }
                    ]
                };
            }
            var rivalStep2 = '{npcName} is waiting at the gate of {townName} when the caravan finally rolls in under stormlight. One axle has shattered. Teamsters are shouting. {npc2Name} swears there is still time to save most of the cargo if the two of you work together. {npcName} looks at you the way merchants look at a ledger that does not balance: frustrated, intent, and unable to walk away. This is the moment the rivalry becomes a scar, a partnership, or something like respect.';
            if (secondChoice === 'blacken_name') rivalStep2 = 'The accusation did not ruin {npcName}; it only made them harder around the edges. Now, at the gate of {townName}, with a shattered axle and rain soaking the manifests, {npcName} could leave you to fail. Instead they hold the lead horse steady and wait for your decision. The look they give you is tired more than angry. That somehow lands deeper.';
            if (secondChoice === 'run_together') rivalStep2 = 'Working together taught you inconvenient things about {npcName}: that they count under their breath when afraid, that they hate waste more than hunger, that they only mock people who matter to them. Now the caravan is in trouble outside {townName}, and {npc2Name} says only one decisive voice will keep the crew from scattering. {npcName} turns to you first.';
            return {
                title: def.title,
                icon: def.icon,
                text: rivalStep2,
                choices: [
                    { id: 'bind_fates', label: 'Stand beside {npcName} and share the credit (+reputation, +relationship)', effectKey: 'share_credit' },
                    { id: 'take_opening', label: 'Use the chaos to seize the contract for yourself (+gold, +reputation)', effectKey: 'take_tribute' },
                    { id: 'let_it_end', label: 'Step back before this turns uglier (+energy)', effectKey: 'withdraw' }
                ]
            };
        }

        if (def.template === 'trusted_ally') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} asks for the favor quietly, as if making the request louder would make it cost more. They need help in {townName} now, before pride talks them out of asking. "I know what this will cost you," {npcName} says. "That is why I came to you and not {npc2Name}." It is a dangerous kind of compliment, the sort that lays a stone in your hands and calls it trust.',
                choices: [
                    { id: 'carry_them', label: 'Help {npcName} even though it hurts (-energy, +reputation, +relationship)', effectKey: 'help', nextStepIndex: 1 },
                    { id: 'name_price', label: 'Refuse unless there is profit in it (+gold, damages relationship)', effectKey: 'refuse', nextStepIndex: 1 },
                    { id: 'turn_advantage', label: 'Exploit the need for leverage (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var allyStep1 = 'A few days later, {npcName} returns before dawn while {townName} still smells of baking bread and wet wood. They have not forgotten. Because you answered when it cost you, they now bring a chance to repay the debt: a warehouse key, a guarded introduction through {npc2Name}, a door that would have stayed closed. {npcName} is almost awkward about it, as if gratitude sits heavier on them than any cargo.';
                if (firstChoice === 'name_price') allyStep1 = '{npcName} returns because they are honorable, not because the bond is warm. In the gray light outside {townName}, they hold out repayment with the stiffness of someone settling an account they wish had been friendship. Even so, they remembered your name when they could have remembered only the price. Through {npc2Name}, they can open a profitable door if you let this become more than a transaction.';
                if (firstChoice === 'turn_advantage') allyStep1 = 'You expected {npcName} to vanish after you used their need against them. Instead they return to {townName} with tired eyes and a favor in hand. "I told myself I was done with you," they admit, glancing away. "But you are still the one person who might make this matter count." It is not forgiveness. It is something harsher and more valuable: a second chance you have not earned.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: allyStep1,
                    choices: [
                        { id: 'trust_returned', label: 'Accept the favor and let trust deepen (+gold, +relationship)', effectKey: 'share', nextStepIndex: 2 },
                        { id: 'thank_generously', label: 'Treat their return as a gift worth honoring (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 2 },
                        { id: 'keep_score', label: 'Take the benefit and claim the credit openly (+gold, +reputation)', effectKey: 'claim', nextStepIndex: 2 }
                    ]
                };
            }
            var allyStep2 = '{npcName} comes for you at a run when crisis finally strikes. Something has gone wrong in {townName} and the easiest way out would be for {npcName} to save themselves and let your name sink with the wreckage. They do not. They stand in the open where everyone can see, asking whether you still believe this bond means something. Even {npc2Name} has fallen silent.';
            if (secondChoice === 'keep_score') allyStep2 = 'When the crisis breaks over {townName}, {npcName} arrives with the same expression people wear when they step back into a burning house for someone they are not certain would do the same. You kept score. They remembered. Yet they came anyway. That is what makes this moment hurt.';
            if (secondChoice === 'thank_generously') allyStep2 = 'People will remember this one. {npcName} stands at the gate of {townName}, breathless, refusing the safe road because your fortunes are tied together now. They are afraid. You can see it in the way their hands shake. They stay anyway. Trust has become something with weight.';
            return {
                title: def.title,
                icon: def.icon,
                text: allyStep2,
                choices: [
                    { id: 'stand_together', label: 'Spend yourself to save {npcName} and the bond (-energy, +reputation, +relationship)', effectKey: 'help' },
                    { id: 'take_blow_together', label: 'Support {npcName} publicly and weather the cost (+reputation, +relationship)', effectKey: 'support' },
                    { id: 'save_self', label: 'Let the bond break and protect your own purse (+gold, damages relationship)', effectKey: 'refuse' }
                ]
            };
        }

        if (def.template === 'old_debt') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} is waiting where the road bends into {townName}, older than your memory and somehow more recognizable for it. The last time you stood this close, one of you left with fuller hands and the other with the lesson. {npcName} does not waste words. "I have carried this long enough," they say. "Either we settle it, or we admit it has been carrying us." Even {npc2Name}, passing nearby, slows to listen.',
                choices: [
                    { id: 'make_amends', label: 'Hear {npcName} out and try to make this right (-energy, +reputation)', effectKey: 'hear_them_out', nextStepIndex: 1 },
                    { id: 'demand_balance', label: 'Demand repayment now, whatever it costs the bond (+gold, -reputation)', effectKey: 'exact_toll', nextStepIndex: 1 },
                    { id: 'walk_past_history', label: 'Let sleeping dogs lie and leave the debt buried (+gold, -reputation)', effectKey: 'brush_aside', nextStepIndex: 1 }
                ]
            };
            var debtStep1 = '{npcName} meets you in a quiet room above a busy tavern in {townName}. The air smells of dust and cloves. Between you lies a small bundle: maybe coins, maybe letters, maybe the proof that memory has sharper teeth than time. {npcName} is trying not to tremble. Whatever happened between you, it mattered. It still does.';
            if (firstChoice === 'demand_balance') debtStep1 = '{npcName} does not flinch when you name your price in {townName}; that somehow makes it worse. They set down a bundle that looks too light for what was taken and too heavy for what was lost. "If coin is enough," they say, "then you were luckier than I was." The room goes very still.';
            if (firstChoice === 'walk_past_history') debtStep1 = '{npcName} catches you once more before the matter dies. There is no anger in them now, only weariness. In a quiet corner of {townName}, they place the old burden in words you can no longer outrun. "I can live without justice," they say. "What I did not expect was how expensive silence would become."';
            return {
                title: def.title,
                icon: def.icon,
                text: debtStep1,
                choices: [
                    { id: 'forgive_and_mend', label: 'Choose mercy and let the old wound close (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
                    { id: 'take_payment', label: 'Take repayment and call the ledger balanced (+gold, +reputation)', effectKey: 'take_tribute' },
                    { id: 'end_without_peace', label: 'Close the matter without comfort (+energy)', effectKey: 'close_case' }
                ]
            };
        }

        if (def.template === 'forbidden_friendship') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: 'You were not meant to like {npcName}. That much is obvious from the way people in {townName} lower their voices when the name comes up: enemy blood, the wrong household, the wrong guild, the wrong side of a knife. And yet {npcName} laughs like someone who has forgotten how to pretend, and when they speak to you the room feels briefly honest. {npc2Name} has already noticed. So have the wrong eyes.',
                choices: [
                    { id: 'meet_in_secret', label: 'Keep seeing {npcName}, no matter what it costs (-energy)', effectKey: 'accept', nextStepIndex: 1 },
                    { id: 'protect_with_distance', label: 'Be warm, but careful enough to shield them (+relationship, +reputation)', effectKey: 'mark_secret', nextStepIndex: 1 },
                    { id: 'profit_from_risk', label: 'Sell the danger for quick coin (+gold, -reputation)', effectKey: 'sell_secret', nextStepIndex: 1 }
                ]
            };
            var forbiddenStep1 = '{npcName} sends for you when rumors finally sharpen into accusation. A whisper has reached the wrong hall, the wrong captain, the wrong spouse. Discovery will not only wound your standing in {kingdomName}; it may ruin {npcName} outright. They do not ask you to be brave for them. They ask you to decide whether what you built was real enough to defend.';
            if (firstChoice === 'protect_with_distance') forbiddenStep1 = 'Because you were careful, the rumor is still only a rumor. Even so, {npcName} meets you with fear plain on their face. "I know what this costs you," they say. "What I do not know is whether I was selfish to want it anyway." In {kingdomName}, discovery would still bite hard. But now the danger has a heartbeat.';
            if (firstChoice === 'profit_from_risk') forbiddenStep1 = 'The coin from the secret is already in your purse when you see {npcName} again. That is what makes the next moment land like a blade. They have heard the rumor, not yet the source, and they are trying so hard to trust you that it becomes painful to watch. In {kingdomName}, discovery is no longer a possibility. It is a clock.';
            return {
                title: def.title,
                icon: def.icon,
                text: forbiddenStep1,
                choices: [
                    { id: 'stand_for_them', label: 'Support {npcName} openly, whatever follows (+reputation, +relationship)', effectKey: 'support' },
                    { id: 'shield_their_name', label: 'Investigate the leak and protect them quietly (-energy)', effectKey: 'investigate' },
                    { id: 'leave_before_fall', label: 'Stay away and leave {npcName} to the consequences (+gold, -relationship)', effectKey: 'stay_away' }
                ]
            };
        }

        if (def.template === 'npc_in_trouble') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} is in real trouble this time, the kind that strips pride away and leaves only need. Maybe it is debt, maybe fever, maybe iron bars, maybe the wrong men with rope and patience. What matters is that someone brings their name to you in {townName} because they believe you might still come. {npc2Name} says the clean solution will be expensive. There may not be a clean solution at all.',
                choices: [
                    { id: 'pay_and_go', label: 'Commit your own coin and strength to save {npcName} (-gold, -energy)', effectKey: 'commit', nextStepIndex: 1, requires: { gold: 'costGold' } },
                    { id: 'search_middle_path', label: 'Investigate a clever way out before paying everything (-energy)', effectKey: 'investigate', nextStepIndex: 1 },
                    { id: 'turn_away', label: 'Walk away before their disaster becomes yours (+gold)', effectKey: 'decline', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var troubleStep1 = '{npcName} is worse than the messenger said. In the sickroom, the cell, the debtor yard, or the ruined shop in {townName}, they still try to apologize for needing you. That small attempt at dignity is almost unbearable. {npc2Name} can secure one narrow chance: a bribe, a caravan seat, a physician, a dangerous transfer. It will work only if you choose now.';
                if (firstChoice === 'search_middle_path') troubleStep1 = 'Your search for a middle path turns up one thin thread. {npc2Name} can arrange something clever in {townName}, but clever is not the same thing as safe. When you finally reach {npcName}, they are trying to sit straighter than the moment allows, as if meeting your eyes while broken counts for something. It does.';
                if (firstChoice === 'turn_away') troubleStep1 = 'You tried to leave it alone. Then word came again. {npcName} had asked for no one, but when {npc2Name} described the look on their face at hearing your name, walking away stopped feeling like neutrality. Now you stand in {townName} with one last chance to decide what kind of absence you meant to be.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: troubleStep1,
                    choices: [
                        { id: 'pull_them_out', label: 'Rescue {npcName} at full cost (-energy, +reputation, +relationship)', effectKey: 'help', nextStepIndex: 2 },
                        { id: 'buy_solution', label: 'Spend the gold and get {npcName} clear (-gold, +items, +relationship)', effectKey: 'buy', nextStepIndex: 2, requires: { gold: 'costGold' } },
                        { id: 'profit_from_fall', label: 'Take what can be salvaged for yourself (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 2 }
                    ]
                };
            }
            var troubleStep2 = '{npcName} survives the worst of it and meets you outside the walls of {townName} when the morning is still pale. They are thinner, tired, and trying not to cry in front of you. "I kept thinking you would not come," {npcName} says. "Then I kept being wrong." That is the kind of sentence a person remembers years later. What happens now decides whether the rescue becomes a bond, a bargain, or a ghost.';
            if (secondChoice === 'profit_from_fall') troubleStep2 = '{npcName} gets out, but not whole. When they find you near {townName}, there is gratitude in their face despite everything, which makes the weight of your earlier choice settle harder. They still believe you mattered in their survival. You must decide whether to deserve that belief or spend it.';
            if (secondChoice === 'buy_solution') troubleStep2 = 'Coin solved what courage could not, but {npcName} knows what you spent and what you risked in {townName}. They meet you in the pale morning carrying nothing but a bundle and a look of raw relief. The world rarely makes room for simple gratitude. This one moment does.';
            return {
                title: def.title,
                icon: def.icon,
                text: troubleStep2,
                choices: [
                    { id: 'ask_nothing', label: 'Tell {npcName} they owe you nothing (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
                    { id: 'let_them_repay', label: 'Let {npcName} repay you and share the burden (+gold, +relationship)', effectKey: 'share' },
                    { id: 'close_wound', label: 'End it here before the debt turns bitter (+energy)', effectKey: 'close_case' }
                ]
            };
        }

        

        return { title: def.title, icon: def.icon, text: lead, choices: [{ id: 'leave', label: 'Move on', effectKey: 'leave' }] };

    }

    function _requireReason(choice, params) {
        if (!choice || !choice.requires) return null;
        if (choice.requires.gold) {
            var need = params[choice.requires.gold] || choice.requires.gold;
            if ((player.gold || 0) < need) return 'Need ' + need + ' gold.';
        }
        return null;
    }
    function _applyInventory(resourceId, delta) {
        if (!resourceId || !delta) return;
        player.inventory[resourceId] = (player.inventory[resourceId] || 0) + delta;
        if (player.inventory[resourceId] <= 0) delete player.inventory[resourceId];
        if (_outcome) _outcome.push({ type: 'item', id: resourceId, name: RESOURCE_NAMES[resourceId] || resourceId, delta: delta });
    }
    function _rep(kid, delta) {
        if (delta && kid) try { Player.modifyReputation(kid, delta); if (_outcome) _outcome.push({ type: 'rep', delta: delta }); } catch (e) {}
    }
    function _rel(pid, delta) {
        if (delta && pid) try { Player.modifyRelationship(pid, delta); if (_outcome) _outcome.push({ type: 'rel', delta: delta, pid: pid }); } catch (e) {}
    }
    function _gold(delta) {
        if (delta) try { Player.modifyGold(delta, 'unsolicited_event'); if (_outcome) _outcome.push({ type: 'gold', delta: delta }); } catch (e) {}
    }
    function _energy(delta) {
        if (delta) try { Player.modifyEnergy(delta); if (_outcome) _outcome.push({ type: 'energy', delta: delta }); } catch (e) {}
    }
    function _hazard(def, ctx) {
        var extra = _derivedExtra(def);
        if (extra.hazard && ctx && ctx.rng && ctx.rng.chance(0.15)) {
            try { Player.inflictRandomInjury('unsolicited_event:' + def.id); if (_outcome) _outcome.push({ type: 'injury' }); } catch (e) {}
        }
    }
    var _outcome = null;
    function _applyUnsolicitedEffect(def, effectKey, params, ctx) {
        var kid = (params && params.kingdomId) || (ctx && ctx.kingdomId) || _currentKingdomId();
        var pid = (params && params.npcId) || (ctx && ctx.pendingNpcId) || (player._pendingUnsolicitedEvent && player._pendingUnsolicitedEvent.npcId) || null;
        switch (effectKey) {
            case 'pocket': _gold(params.goldAmount); if (def.category === 'crime') _rep(kid, -params.repAmount); break;
            case 'share': _gold(Math.max(1, Math.floor(params.goldAmount / 3))); _rep(kid, params.repAmount); _rel(pid, params.relAmount); break;
            case 'leave': _energy(Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'help': _energy(-params.energyAmount); _rep(kid, params.repAmount); _rel(pid, params.relAmount); break;
            case 'refuse': _rel(pid, -Math.max(1, Math.floor(params.relAmount / 2))); _gold(Math.max(2, Math.floor(params.goldAmount / 4))); break;
            case 'exploit': _gold(params.goldAmount); _rep(kid, -params.repAmount); break;
            case 'buy': _gold(-params.costGold); _applyInventory(params.resourceId, params.itemQty); _rel(pid, Math.max(1, Math.floor(params.relAmount / 2))); break;
            case 'pass': _energy(Math.max(1, Math.floor(params.energyAmount / 3))); break;
            case 'report': _rep(kid, params.repAmount); _rel(pid, -Math.max(1, Math.floor(params.relAmount / 2))); break;
            case 'encourage': _rel(pid, params.relAmount); _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'polite': _rel(pid, Math.max(1, Math.floor(params.relAmount / 2))); break;
            case 'cruel': _rel(pid, -params.relAmount); _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); _gold(Math.max(3, Math.floor(params.goldAmount / 3))); break;
            case 'join': _gold(params.goldAmount); _rep(kid, -params.repAmount); _hazard(def, ctx); break;
            case 'report_crime': _rep(kid, params.repAmount); _rel(pid, -Math.max(1, Math.floor(params.relAmount / 2))); break;
            case 'accept': _energy(-Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'decline': _gold(Math.max(2, Math.floor(params.goldAmount / 4))); break;
            case 'claim': _gold(params.rewardGold); _rep(kid, params.repAmount); break;
            case 'spread': _rep(kid, params.repAmount + 1); _rel(pid, params.relAmount); break;
            case 'withdraw': _energy(params.energyAmount); break;
            case 'commit': _gold(-params.costGold); _energy(-Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'haggle': _gold(-Math.max(1, Math.floor(params.costGold * 0.7))); _rel(pid, 1); break;
            case 'unload': _gold(params.rewardGold); _applyInventory(params.resourceId, Math.max(1, Math.floor(params.itemQty / 2))); break;
            case 'flip': _gold(params.rewardGold + Math.max(2, Math.floor(params.goldAmount / 2))); _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'donate': _rep(kid, params.repAmount + 1); break;
            case 'attend': _rel(pid, params.relAmount + 1); _energy(-Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'bring_gift': _gold(-params.costGold); _rel(pid, params.relAmount + 2); _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'stay_away': _rel(pid, -Math.max(1, Math.floor(params.relAmount / 2))); _gold(Math.max(2, Math.floor(params.goldAmount / 4))); break;
            case 'investigate': _energy(-params.energyAmount); break;
            case 'sell_secret': _gold(params.goldAmount); _rep(kid, -params.repAmount); break;
            case 'ignore': _energy(Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'confront': _rep(kid, params.repAmount); _rel(pid, -Math.max(1, Math.floor(params.relAmount / 2))); _hazard(def, ctx); break;
            case 'assist': _energy(-params.energyAmount); _rep(kid, params.repAmount); break;
            case 'profit': _gold(params.goldAmount); _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'accept_reward': _gold(params.rewardGold); _rep(kid, params.repAmount); break;
            case 'donate_reward': _rep(kid, params.repAmount + 2); break;
            case 'ask_for_favor': _rel(pid, params.relAmount); _rep(kid, params.repAmount + 1); break;
            case 'support': _rep(kid, params.repAmount); _rel(pid, Math.max(1, Math.floor(params.relAmount / 2))); break;
            case 'leak': _gold(params.goldAmount); _rep(kid, -params.repAmount); break;
            case 'press_advantage': _gold(params.rewardGold); _rep(kid, params.repAmount + 1); break;
            case 'take_gift': _gold(params.goldAmount); _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'step_back': _energy(params.energyAmount); break;
            case 'hear_them_out': _energy(-Math.max(1, Math.floor(params.energyAmount / 2))); _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'exact_toll': _gold(params.goldAmount); _rep(kid, -params.repAmount); break;
            case 'brush_aside': _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); _gold(Math.max(2, Math.floor(params.goldAmount / 4))); break;
            case 'grant_mercy': _rep(kid, params.repAmount + 1); _rel(pid, params.relAmount); break;
            case 'take_tribute': _gold(params.rewardGold); _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'close_case': _energy(params.energyAmount); break;
            case 'heed': _energy(-Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'listen': _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
            case 'mock': _rep(kid, -Math.max(1, Math.floor(params.repAmount / 2))); _gold(Math.max(2, Math.floor(params.goldAmount / 5))); break;
            case 'follow': _gold(Math.max(5, Math.floor(params.goldAmount / 2))); _rep(kid, params.repAmount); _hazard(def, ctx); break;
            case 'ward': _gold(-params.costGold); _energy(params.energyAmount); break;
            case 'attempt': _energy(-params.energyAmount); _gold(Math.max(4, Math.floor(params.goldAmount / 2))); _hazard(def, ctx); break;
            case 'bet_safe': _energy(Math.max(1, Math.floor(params.energyAmount / 2))); _rep(kid, 1); break;
            case 'collect_prize': _gold(params.rewardGold); _rep(kid, params.repAmount); break;
            case 'share_credit': _rep(kid, params.repAmount + 1); _rel(pid, params.relAmount); break;
            case 'walk': _energy(params.energyAmount); break;
            case 'intervene': _energy(-params.energyAmount); _rep(kid, params.repAmount); break;
            case 'observe': _energy(Math.max(1, Math.floor(params.energyAmount / 2))); break;
            case 'take_reward': _gold(params.rewardGold); break;
            case 'reinvest': _gold(-params.costGold); _rep(kid, params.repAmount + 2); break;
            case 'mark_secret': _rel(pid, Math.max(1, Math.floor(params.relAmount / 2))); _rep(kid, Math.max(1, Math.floor(params.repAmount / 2))); break;
        }
        if ((def.category === 'trade' || def.category === 'context' || def.category === 'skill') && (effectKey === 'take_reward' || effectKey === 'collect_prize')) {
            _applyInventory(params.resourceId, Math.max(1, Math.floor(params.itemQty / 2)));
        }
    }
    var RESULT_NARRATIVES = {
    pocket: {
        default: 'You close your hand over the find before anyone else sees it. By the time the shouting starts in {townName}, you and the gold are already moving in different directions, and {npcName} learns too late how quick fortune can turn.',
        crime: 'You strip the useful bits from the mess and leave {npcName} to explain the rest. A watchman at the corner studies you for a beat, then looks away with a crooked smile, which somehow feels worse than an accusation.',
        trade: 'You accept the silver and keep the market moving. {npcName} forces a merchant smile, but by sundown half of {townName} knows exactly who kept every last coin.',
        social: 'You tuck the gift away before courtesy can make demands of you. {npcName} notices, and the room in {townName} grows a little colder even while your purse grows heavier.'
    },
    share: {
        default: 'You split the windfall instead of closing your fist around it. {npcName} stares at you as if you had performed a trick, then laughs loud enough for half of {townName} to hear, and the story starts traveling before you do.',
        trade: 'You pass part of the gain across the stall and call it fair. {npcName} tells three merchants before the hour is out, and by sunset a baker throws in an extra loaf just to see if the tale is true.',
        social: 'You make a generous show of it in the square at {townName}. A child copies your grand hand gesture behind your back, making the crowd laugh, and somehow that only makes the moment warmer.'
    },
    leave: {
        default: 'You leave the matter where you found it and keep walking through {townName}. The day folds closed behind you, and whatever trouble was forming chooses someone else instead.',
        common: 'You decide that not every small wonder needs your fingerprints on it. {npcName} watches you go with puzzled respect, as if restraint were stranger than greed.',
        context: 'You step aside before the whole thing can become your burden. By evening the people of {townName} have found a new topic, and your name is not tangled in it.',
        supernatural: 'You turn your back on the sign and refuse to feed it with attention. The wind off the street feels colder for three steps, then even that passes, and {townName} returns to the ordinary noise of wagons and voices.'
    },
    help: {
        default: 'You stay and do the hard work with {npcName} until the problem finally yields. Word runs ahead of you through {townName}, and by the time you leave, strangers are nodding as though they had been there.',
        war: 'You put your shoulder to the labor and keep the line from breaking. {npcName} salutes you with shaking hands, and even the hard-eyed quartermaster in {townName} softens enough to call you by name.',
        social: 'You help {npcName} in plain sight, with no thought of what it will earn. People nearby notice the choice, and a warmth settles over the moment that feels sturdier than praise.'
    },
    refuse: {
        default: 'You let {npcName} finish, then step away before their need can become your duty. The time you save turns into coin before nightfall, but in {townName} people remember how quickly you turned your face aside.',
        crime: 'You refuse the offer and keep your hands clean, at least this time. {npcName} spits in the dust behind you, while a bored guard by the gate gives you a tiny approving nod and pretends he saw nothing.',
        supernatural: 'You refuse the call and give the dark corners of {townName} nothing more. The omen does not strike you down, but {npcName} looks at you as if you abandoned a door that should never have been left open.',
        social: 'You leave {npcName} standing in the square with their pride exposed. You gain a freer day and a heavier purse, but every greeting in {townName} feels a shade more formal after that.'
    },
    exploit: {
        default: 'You see the weakness in the moment and turn it into profit before anyone can stop you. {npcName} understands what you did a breath too late, and the people of {townName} remember the sharpness of it.',
        social: 'You turn sympathy into leverage with a smile so neat it almost passes for kindness. {npcName} gives you what you want, but the whispers that follow you through {townName} are not admiring ones.',
        political: 'You take the loose thread in {kingdomName} politics and pull until gold falls out. The move is clever enough to work and cold enough to spread, and by supper {npcName} knows exactly who profited.',
        context: 'While others argue over what is right, you quietly take what can be gained. {townName} solves the crisis without your conscience, and your ledger looks better for it.'
    },
    buy: {
        default: 'You count out the coin and close the bargain with {npcName}. The {itemQty} {resourceName} are yours, and several people in {townName} suddenly become very interested in whether you know something they do not.',
        trade: 'You buy the {resourceName} before the other bidders can elbow in. {npcName} looks relieved, the warehouse boys scramble, and one jealous merchant starts asking around {townName} about who tipped you first.',
        war: 'You secure the goods while the need is still urgent and the price still sane. By the time the carts roll out of {townName}, soldiers are blessing your timing and cursing everyone slower.'
    },
    pass: {
        default: 'You let the chance go by and keep your balance. {npcName} shrugs, {townName} keeps moving, and you walk away with your strength intact and no fresh trouble tied to your name.',
        trade: 'You leave the bargain on the table and trust another deal will come. Two merchants instantly begin circling {npcName} like gulls over fish, which is proof enough that you were right to avoid the scramble.',
        skill: 'You choose not to play to the crowd today. A few hotheads in {townName} call that caution, but the healer with the broken nose looks almost impressed.',
        common: 'You decide the moment is not worth the weight it would put on your day. {npcName} finds another answer, and you keep walking.'
    },
    report: {
        default: 'You bring the matter to the proper ears and make sure your name is attached to the truth. By sunset officials in {townName} are asking sharper questions, and {npcName} is learning how quickly a quiet problem can become public.',
        trade: 'You report the crooked deal before it can spread through the market. The scales get inspected, the shutters come down on one stall, and a fishmonger nearby mutters that you have ruined a perfectly good afternoon.',
        political: 'You carry the information upward instead of selling it sideways. {npcName} is not grateful, but the people who matter in {kingdomName} now know you chose order over profit.'
    },
    encourage: {
        default: 'You answer {npcName} with warmth instead of caution, and the whole exchange steadies into something real. By the end of the day, {townName} seems a friendlier place, mostly because people saw you make it so.',
        social: 'You give {npcName} the kind of answer that invites hope rather than guessing. A woman at the next table smiles into her cup, and before long the tavern in {townName} is treating your names like the start of a story.',
        political: 'You encourage {npcName} in measured words that still land like a promise. Courtiers remember restraint more than flattery, and in {kingdomName} that may prove the wiser gift.'
    },
    polite: {
        default: 'You keep the exchange courteous and firm, giving {npcName} no wound to carry away. The moment closes cleanly, and even in a town as talkative as {townName}, there is little cruel for anyone to repeat.',
        social: 'You answer with enough kindness to spare {npcName} embarrassment and enough distance to protect yourself. The bystanders in {townName} get no scene to feed on, which disappoints them terribly.',
        political: 'You choose formal grace over heat. {npcName} leaves with their dignity, and the hall in {kingdomName} notes that you can refuse without making an enemy of the room.'
    },
    cruel: {
        default: 'You cut {npcName} down in front of witnesses and take the small advantage that follows. The laugh you get in the moment is thin, and the silence that settles over {townName} afterward lasts longer than the coin feels heavy.',
        social: 'Your words land hard enough to make {npcName} go pale. Someone nearby coughs to hide their discomfort, and later half of {townName} repeats your line with less admiration than fear.',
        political: 'You humiliate {npcName} so cleanly that no one can pretend it was an accident. The court remembers the display, and even those who profit from it step a little more carefully around you.'
    },
    join: {
        default: 'You take {npcName} up on the risk and step into the work before doubt can catch you. The gold comes fast, but so do the eyes of people in {townName} who know a dangerous choice when they see one.',
        crime: 'You slip into the scheme with {npcName} and learn quickly why alley deals pay well. By dawn you have the coin, a racing pulse, and the strong suspicion that at least one guard in {townName} now recognizes your walk.',
        political: 'You commit to the dirty work behind the polished words. {npcName} pays well, but in {kingdomName} favors born in shadow have a habit of returning with sharper edges.'
    },
    report_crime: {
        default: 'You take what you know to the watch and let the law do the loud part. Before long {npcName} is answering difficult questions in {townName}, and your own name rises a little cleaner for it.',
        crime: 'You find the watch captain, lay out the scheme, and send the whole affair crashing down. One young guard tries to look stern and fails so badly he nearly winks, which somehow makes the arrest in {townName} feel even more final.',
        political: 'You hand the evidence upward instead of burying it. {npcName} loses room to maneuver, and the people tracking power in {kingdomName} mark you as someone who can be trusted with ugly truths.'
    },
    accept: {
        default: 'You accept and let the matter fasten itself to your future. {npcName} leaves {townName} lighter than they arrived, while you carry the weight of what comes next.',
        social: 'You give {npcName} your word, and that matters more than the details just now. The promise begins as a quiet thing in {townName}, but even quiet promises can move people.',
        political: 'You accept the arrangement knowing it will not stay private for long. Somewhere in {kingdomName}, someone just gained an ally and someone else gained a reason to watch you.',
        skill: 'You enter your name and feel the challenge become real. From that moment on, every craftsman in {townName} seems to have an opinion about your chances.'
    },
    decline: {
        default: 'You refuse without making a scene and keep your own road clear. {npcName} must look elsewhere, and the gold or effort you keep back stays safely under your control.',
        war: 'You stay out of the campaign and let other people chase glory. Some in {townName} call it caution, others call it selfishness, but none of them are spending your strength.',
        political: 'You step clear of the scheme before it can stain your sleeves. {npcName} masks disappointment behind courtesy, and {kingdomName} keeps spinning without your hand on the wheel.',
        skill: 'You decline the competition and spare yourself the theater of public judgment. A few rivals in {townName} look almost offended that you would not give them the chance to beat you.'
    },
    claim: {
        default: 'You claim what was earned and do it in the open. {npcName} cannot deny your part in the outcome, and the people of {townName} leave with a clear story and your name attached to the winning end of it.',
        social: 'You step forward when thanks are offered and accept them with steady hands. The moment lands cleanly in {townName}, and even those who envy you cannot say you did not earn it.',
        supernatural: 'You take the reward from the strange thing at the heart of it and do not flinch. The tale spreads through {townName} before sunset, half calling you brave and half wondering what else came home with you.',
        rank: 'You accept the due owed to your station and let the square watch it happen. {npcName} bows, the crowd measures the moment, and your standing in {townName} hardens into something difficult to ignore.'
    },
    spread: {
        default: 'You turn the outcome into a story and make sure it travels farther than the coin would have. {npcName} becomes part of the telling, and {townName} begins repeating the version of events that favors warmth over profit.',
        social: 'You share the tale with just enough modesty to make people believe every word. By nightfall a brewer in {townName} is already telling it louder than you did and improving the ending with each mug.',
        supernatural: 'You tell people what happened, and the telling itself changes the town. Some in {townName} laugh, some leave charms on their doors, and {npcName} discovers that fear can travel faster than truth.',
        political: 'You spread the story carefully, knowing that reputation is a blade. By the time the rumor reaches the far halls of {kingdomName}, it cuts in exactly the direction you intended.'
    },
    withdraw: {
        default: 'You step back before victory can become obligation. {npcName} is left with an ending instead of a debt, and {townName} moves on without learning how much more you might have taken.',
        supernatural: 'You leave the strange prize where it lies and walk out while the air is still thin with it. Even {npcName} seems relieved, and {townName} is spared one more story it would not know how to carry.',
        political: 'You withdraw before allies can become petitioners and rivals can become hunters. In {kingdomName}, restraint is rare enough to look almost like wisdom.'
    },
    commit: {
        default: 'You put real coin behind the promise and make the venture yours. {npcName} sees that you believe in the outcome, and suddenly half of {townName} wants to know whether they should believe too.',
        trade: 'You commit at full price and lock in the deal before the market can twitch away from you. The scribes note your name, the dockhands start betting on the shipment, and {npcName} walks straighter for having your backing.',
        war: 'You invest while everyone else is still deciding whether the risk is worth the fear. In hard times around {townName}, that kind of certainty looks either heroic or very expensive.'
    },
    haggle: {
        default: 'You slow the bargain down until the numbers make sense. {npcName} protests, then relents, and both of you leave knowing the deal survived because you demanded better terms instead of kinder words.',
        trade: 'You pick through the price one coin at a time until {npcName} finally laughs and gives in. A spice merchant nearby applauds with two fingers against his ledger, which is the market way of calling you vicious and impressive.',
        political: 'You bargain hard without ever raising your voice. By the end, {npcName} understands that in {kingdomName} you can be courteous and still take the larger share.'
    },
    unload: {
        default: 'You sell the goods cleanly and at the right moment. The coin comes in, the stock clears out, and {townName} decides you are the sort of merchant who knows exactly when to hold and when to let go.',
        trade: 'You move the {resourceName} fast while demand is still hungry. {npcName} watches the crates vanish, and a competitor across the square mutters that you have robbed the market without breaking a single law.',
        war: 'You release the goods where they will matter most and take a fair profit for it. The buyers in {townName} grumble at the price until they remember how badly they need what you brought.'
    },
    flip: {
        default: 'You waste no time and squeeze every possible coin from the moment. {npcName} cannot argue with the speed of it, but the people in {townName} remember how sharply you cut your profit from the situation.',
        trade: 'You turn the shipment almost before the dust settles on the cart wheels. The money is excellent, the goodwill is not, and one old merchant in {townName} calls it beautiful work in the same tone he might use for a knife.',
        context: 'While others are still deciding what is proper, you sell high and leave them to sort out the feelings later. It is efficient, profitable, and not at all the kind of thing {townName} forgets quickly.'
    },
    donate: {
        default: 'You part with a share of the gain and make the day better for someone besides yourself. {npcName} looks at you with startled gratitude, and the kindness echoes through {townName} farther than the goods ever would.',
        trade: 'You set aside part of the {resourceName} instead of chasing every last coin. The bakers and laborers of {townName} notice immediately, and a merchant who expected ruthlessness has to revise their story about you.',
        war: 'You send the value onward to people carrying heavier burdens than yours. When the news reaches {townName}, even hard soldiers speak of the choice with something close to tenderness.',
        context: 'You give when it would have been easier to profit, and that changes the mood of the whole street. {npcName} is not the only one who remembers it.'
    },
    attend: {
        default: 'You keep your word and show up for {npcName}. Whatever uncertainty hung between you in {townName} settles into something steadier once you arrive.',
        social: 'You meet {npcName} where the lamps burn low and the noise of {townName} cannot reach as easily. The conversation is awkward for all of three breaths, then real, and the night leaves both of you changed.',
        political: 'You attend the meeting knowing every smile may be carrying a second meaning. {npcName} notices that you came anyway, and in {kingdomName} that sort of courage can be more valuable than agreement.'
    },
    bring_gift: {
        default: 'You arrive with more than words, and the gesture lands exactly as intended. {npcName} is caught off guard in the best way, and by the end of the meeting the people of {townName} are already improving the story in your favor.',
        social: 'You place the gift in {npcName} hands before either of you can retreat into formality. A serving girl in the corner pretends not to watch and then immediately runs off to tell someone, which means half of {townName} will know by morning.',
        political: 'You bring a gift chosen with care and just enough expense to be noticed. In {kingdomName}, that kind of move reads as respect, confidence, and a warning that you understand the game.'
    },
    stay_away: {
        default: 'You do not come, and silence does the speaking for you. {npcName} waits longer than they should in {townName}, and the hurt hardens into something that will not be easily talked away.',
        social: 'The lantern burns low, the table stays empty, and {npcName} eventually walks home alone through {townName}. You gain the evening and keep your purse full, but the next meeting will begin with a wound.',
        political: 'You stay clear of the appointment and let the alliance die before it forms. {npcName} will remember the insult, and in {kingdomName} absences can be louder than shouted refusals.'
    },
    investigate: {
        default: 'You choose patience over comfort and start pulling on the thread. {npcName} may not know it yet, but in {townName} secrets are easiest to catch just before they think they are safe.',
        crime: 'You spend the days asking quiet questions in loud places and listening where thieves assume no one respectable would linger. By the time you are done, {npcName} has left a trail through {townName} even a sleepy guard could follow.',
        political: 'You investigate without announcing it, which is the only way such work survives. In {kingdomName}, truth rarely hides alone; it keeps company with favors, debts, and frightened men.'
    },
    sell_secret: {
        default: 'You trade truth for immediate coin and let someone else decide what to do with it. {npcName} may never prove your part, but the smell of betrayal hangs around the deal all the same.',
        crime: 'You sell the lead in a back room and watch it leave your hands for a heavier purse. Before night is over, three different people in {townName} know the secret and none of them learned it from you.',
        political: 'You turn privileged knowledge into profit and trust the damage to spread on its own. It is a dangerous business in {kingdomName}, because information remembers who sold it first.'
    },
    ignore: {
        default: 'You decide the trouble belongs to someone else and keep moving. {npcName} fades back into the life of {townName}, and whatever answer might have been yours never gets the chance to prove it.',
        crime: 'You see the thread and choose not to pull it. In a city street that can pass for wisdom, but if {npcName} does harm again in {townName}, you will remember this moment.',
        supernatural: 'You ignore the sign and give it no room in your thoughts. Even so, every odd noise in {townName} feels like a question you chose not to answer.',
        social: 'You leave {npcName} to manage their own entanglement and spare yourself the mess. The cost is simple: you keep your time, and lose the chance to be remembered kindly.'
    },
    confront: {
        default: 'You take the matter straight to {npcName} and force it into the open. People in {townName} notice the nerve of it, and whether the scene ends in truth or bruises, no one can call you timid.',
        crime: 'You corner {npcName} with evidence and nowhere easy to run. The alley grows very quiet, then very dangerous, and afterward even the dockhands of {townName} speak your name with a little more care.',
        political: 'You confront {npcName} directly instead of hiding behind rumor. That sort of boldness unsettles a court, and by the end of the day {kingdomName} is asking whether you are principled or merely fearless.'
    },
    assist: {
        default: 'You put your strength where it is needed and do not keep count while you are doing it. {npcName} sees the cost to you, and {townName} remembers that you answered before anyone made you.',
        war: 'You send labor, goods, and will toward the fighting until the whole effort starts moving better. When the report comes back through {townName}, it carries your name beside the kind of thanks soldiers do not waste.',
        context: 'You choose action over comfort and help steady a bad situation. That choice becomes the part of the story {townName} repeats.'
    },
    profit: {
        default: 'You help just enough to keep things moving and make sure the ledger rewards you for the trouble. {npcName} gets what they needed, but {townName} can tell the difference between service and calculation.',
        war: 'You supply the effort, take your cut, and call it practical. The realm may still benefit, but the veterans coming back through {townName} know exactly which kind of help you offered.',
        context: 'You find the angle in the chaos and take it cleanly. People are relieved the crisis ended and slightly offended by how much richer you became in the process.',
        trade: 'You turn disorder into margin with the instincts of a born merchant. A grain seller in {townName} calls it smart business, then lowers his voice before the widows can hear.'
    },
    accept_reward: {
        default: 'You accept the reward with no false modesty. {npcName} seems glad the debt is settled openly, and {townName} approves of a person who knows both service and worth.',
        war: 'You take the purse from hands that have seen too much and do it respectfully. The soldiers of {kingdomName} do not resent you for it, which may be the clearest sign that you earned every coin.',
        rank: 'You accept the offered reward as one entitled to it by deed and standing. The crowd in {townName} sees no greed in the moment, only order.'
    },
    donate_reward: {
        default: 'You push the reward away from yourself and toward people who need it sooner. {npcName} is too moved to hide it, and the mood in {townName} lifts as if generosity were a lantern someone had just lit.',
        war: 'You send the prize on to the wounded and the families waiting at home. Hardened men in {kingdomName} go quiet when they hear, because mercy from the strong always sounds louder after war.',
        context: 'You refuse to make your own victory the final point of the story. Instead, {townName} gets something useful and a better reason to say your name.'
    },
    ask_for_favor: {
        default: 'You leave the gold on the table and ask {npcName} for something harder to measure. The answer is immediate: in {townName}, you now have one more person who will move when you call.',
        war: 'You trade coin for a promise from people who matter on the frontier. That may not gleam in the hand today, but in {kingdomName} favors won under strain have a way of lasting.',
        political: 'You ask for future leverage instead of present payment. {npcName} understands the weight of that choice, and the air between you in {kingdomName} grows careful and respectful.'
    },
    support: {
        default: 'You put your weight behind {npcName} and help their move gather force. By the time the news circles {townName}, people are already sorting themselves by whether they wish they had stood with you.',
        political: 'You back the maneuver at the right moment and make it respectable by touching it. {npcName} gains ground, your name gains reach, and somewhere in {kingdomName} an enemy starts recalculating.',
        war: 'You support {npcName} because the realm needs decisions more than dithering. The choice wins allies among those who still believe strength should serve more than itself.'
    },
    leak: {
        default: 'You let the secret loose where it will earn the most and hurt the right people from a safe distance. {npcName} may never forgive it, and {townName} will wonder for some time who first opened the door.',
        political: 'You sell the whisper across faction lines and watch power shift without you needing to lift another finger. It is profitable work, but in {kingdomName} everyone eventually learns that leaked words leave stains.',
        crime: 'You pass the hidden detail to someone eager enough to pay for it. By sundown the underbelly of {townName} is buzzing, and {npcName} has one more reason to sleep lightly.'
    },
    press_advantage: {
        default: 'You move before the window can close and turn success into something larger. {npcName} recognizes the ruthlessness of it, while the people of {townName} mostly just see a winner who knew when to keep pushing.',
        political: 'You use the momentum to secure a stronger place for yourself before rivals can recover. It is not a gentle choice, but in {kingdomName} gentleness rarely survives long in rooms like these.',
        trade: 'You press while the market still leans your way and pull out extra profit before the numbers cool. Several merchants in {townName} hate the move so much they call it masterful.'
    },
    take_gift: {
        default: 'You accept the quiet gift and let everyone pretend it is merely gratitude. {npcName} looks relieved, but the people of {townName} can smell private arrangements even when the ribbon is pretty.',
        political: 'You take the discreet payment and allow the matter to stay pleasantly undefined. In {kingdomName}, that sort of courtesy is useful right until it becomes evidence.',
        social: 'You accept the present with an easy smile, though both you and {npcName} know it is buying more than thanks. By the next morning someone in {townName} is already guessing the price wrong and the intention right.'
    },
    step_back: {
        default: 'You ease away before triumph can draw too much envy. {npcName} keeps their dignity, you keep your breathing room, and {townName} is left with less reason to resent your good fortune.',
        political: 'You step back while the board still favors you, which is why it will probably favor you again later. In {kingdomName}, survival often belongs to the player who knows when not to make the final move.',
        social: 'You let the moment cool instead of feeding it. A jealous room in {townName} has nothing to bite on, and that alone is worth the restraint.'
    },
    hear_them_out: {
        default: 'You give {npcName} your time and full attention, which is rarer than most gifts in {townName}. By the end of the conversation, both of you know more than when it began, and people nearby notice the respect you paid.',
        rank: 'You allow {npcName} to speak all the way to the heart of the matter. That patience surprises the room, and in a place obsessed with standing, {townName} sees the strength in it.',
        social: 'You listen seriously instead of waving the problem away. {npcName} straightens as they speak, as if being heard were already half a remedy.',
        political: 'You hear the petition through every careful pause and hidden plea. The hall in {kingdomName} notices that you can sit with complexity without immediately reaching for profit.'
    },
    exact_toll: {
        default: 'You make it clear that your time has a price and collect it before the matter goes any farther. {npcName} pays because they must, and {townName} receives a sharp reminder that access to you is not free.',
        rank: 'You exact the toll with all the ceremony of custom and none of the softness of charity. People in {townName} bow to the rule of it even while resenting the weight.',
        trade: 'You name a fee so cleanly it sounds like market law. {npcName} grumbles, pays, and a cloth seller nearby mutters that you missed your calling as a tax collector.'
    },
    brush_aside: {
        default: 'You dismiss {npcName} before the appeal can gather force. The crowd in {townName} sees exactly who had power in that moment, and exactly how little gentleness you spent using it.',
        rank: 'You wave the petition away as though it never deserved the air it took to speak. {npcName} withdraws stiff-backed, and the lesson lands on everyone watching in {townName}.',
        social: 'You cut the conversation short and leave {npcName} holding the embarrassment alone. You gain time and coin, but the room remembers the sharpness of the gesture more than the reason for it.'
    },
    grant_mercy: {
        default: 'You choose mercy where authority might have squeezed harder. {npcName} leaves with visible relief, and the people of {townName} talk about your strength as something steady rather than cruel.',
        rank: 'You show that rank can protect as well as command. The square in {townName} softens around the moment, and even those who feared your judgment begin to hope from it.',
        war: 'You spare someone when harsher times might have excused severity. After all the hard news in {kingdomName}, the choice feels almost startling in its humanity.'
    },
    take_tribute: {
        default: 'You accept the tribute and let the exchange settle in the old shape of power repaid. {npcName} gives it over with both hands, and {townName} reads the gesture as proof that your help carries weight.',
        rank: 'You take the reward as a lord might, with calm certainty and no apology. The people watching in {townName} understand at once that gratitude to you has become a matter of form as much as feeling.',
        political: 'You collect tribute while the alliance is fresh and the debt still obvious. In {kingdomName}, such moments build memory, and memory becomes influence.'
    },
    close_case: {
        default: 'You end the matter without squeezing it for one last advantage. {npcName} goes free of further obligation, and {townName} is left with the rare satisfaction of a clean ending.',
        rank: 'You close the case with a few words and no performance. The restraint surprises {townName} more than a show of power would have, which tells you something useful about the place.',
        crime: 'You shut the book on it before vengeance, gossip, or bribes can reopen it. Even the watch in {townName} seems grateful to be spared one more complicated night.'
    },
    heed: {
        default: 'You choose not to laugh the sign away. {npcName} sees the decision and falls quiet, while {townName} seems to lean around you as if waiting to learn whether wisdom and trouble are about to become the same thing.',
        supernatural: 'You heed the omen and step after it with more courage than certainty. Dogs in {townName} start barking at nothing, a candle gutters sideways, and suddenly even sensible people stop smiling.',
        social: 'You treat {npcName} seriously when others would have scoffed. That alone changes the mood in {townName}, because respect is sometimes the first miracle people notice.'
    },
    listen: {
        default: 'You do not commit too quickly, but you do pay attention, and that proves enough for now. {npcName} relaxes a little, and small details in {townName} begin arranging themselves into a pattern you can almost trust.',
        supernatural: 'You listen to the strange thing instead of running from it. The whispers do not become clearer so much as closer, and by dusk {townName} feels full of meanings just beyond sight.',
        political: 'You keep still and let the hidden message finish itself. In {kingdomName}, people often reveal the most when they think you are merely listening.'
    },
    mock: {
        default: 'You laugh in the face of the warning and make sure others hear it. Some people in {townName} laugh with you, but the sound has an edge, as if they want your confidence more than they share it.',
        supernatural: 'You mock the omen out loud and turn fear into a cheap performance. A few bystanders grin, one old woman spits over her shoulder, and by evening {townName} has decided you are either very brave or very foolish.',
        social: 'You make {npcName} the punch line and win a quick burst of amusement from the crowd. It earns you the moment and costs you their trust.'
    },
    follow: {
        default: 'You follow the trail all the way to the place sensible people would have stopped. What you find in or beyond {townName} is worth coin and scars in equal measure, and the story of your nerve starts walking before you return.',
        supernatural: 'You go after the sign until the streets of {townName} fall away and the world turns strange around you. When you come back with reward in hand, even skeptics study your face for proof of what else you brought home.',
        crime: 'You track the lead to its source instead of waiting for it to circle back. The choice pays, but the kind of people {npcName} knows do not enjoy being found.'
    },
    ward: {
        default: 'You pay for protection and feel the tension leave your shoulders one careful breath at a time. {npcName} may smirk at the caution, but the people of {townName} have seen enough strange nights to respect a person who buys peace when they can.',
        supernatural: 'You purchase the wards, hang them where they must be hung, and sleep without dreams for the first time in days. A local wise woman in {townName} pats your arm, pockets the coin, and tells you that fear is cheaper than curses, which sounds suspiciously rehearsed.',
        social: 'You answer worry with practical steps instead of brave speeches. {npcName} seems steadier for it, and sometimes that is all the magic a town truly needs.'
    },
    attempt: {
        default: 'You step forward and take the challenge with everyone watching. Win or stumble, {townName} will remember that {npcName} called and you answered.',
        skill: 'You give the test everything you have and force the crowd to pay attention. The judges lean in, rivals stop smirking, and somewhere in {townName} a bookmaker groans because you outperformed the odds.',
        war: 'You take on the hard task because harder people will rely on its result. Even before the bruises fade, {kingdomName} has a new story about your nerve.'
    },
    bet_safe: {
        default: 'You choose the safer edge of the moment and learn without bleeding for the lesson. {npcName} may have wanted a bolder answer, but in {townName} wisdom often looks dull right until it wins.',
        skill: 'You watch every move, note every mistake, and come away smarter than half the competitors who leapt first. A boy near the rail starts copying your thoughtful nod like he expects it to help him grow a beard.',
        social: 'You stay in the circle without stepping into the fire. People in {townName} notice the restraint, and a few of them mistake it for mystery.'
    },
    collect_prize: {
        default: 'You take the prize when it is offered and do not pretend surprise. {npcName} applauds with the rest, and {townName} gives you the rare pleasure of public approval without an argument attached.',
        skill: 'You accept the judges\' reward while the crowd is still buzzing over what you did. The purse is satisfying, but the better prize is the look on your rivals when they realize they must call you the winner.',
        war: 'You receive the reward for work that mattered under pressure. In {kingdomName}, such honors are not handed out lightly, and everyone present knows it.'
    },
    share_credit: {
        default: 'You turn the spotlight wide enough to include the people who helped you reach it. {npcName} is visibly startled, and the mood in {townName} softens from admiration into something closer to affection.',
        skill: 'You name the hands, eyes, and advice that carried you here alongside your own work. The crowd in {townName} likes that almost as much as the performance itself, and your rivals find it very hard to hate you for winning.',
        social: 'You refuse to make the moment only yours. That generosity catches on quickly, and before long {townName} is telling the story as one of fellowship instead of conquest.'
    },
    walk: {
        default: 'You leave before applause can start building a throne beneath your feet. {npcName} watches you go with renewed respect, and {townName} is left wanting just a little more of you than it got.',
        skill: 'You walk away from the prize circle with steady hands and no need to milk the moment. The judges notice, the crowd notices more, and humility somehow makes the victory look even larger.',
        political: 'You exit before praise can be turned into obligation. In places like {kingdomName}, that may be the cleverest move of the day.'
    },
    intervene: {
        default: 'You step into the trouble and make it your problem until it starts behaving. {npcName} will not forget who answered, and the people of {townName} now have a solid story to tell about your kind of courage.',
        context: 'You intervene before the crisis can harden into disaster. The street of {townName} that had been full of fear is suddenly full of people breathing again.',
        war: 'You act decisively while others are still measuring risk. That sort of intervention keeps more than trade alive on a bad day in {kingdomName}.'
    },
    observe: {
        default: 'You hold back and watch, learning where the pressure is without putting your hand under it. {npcName} may wish you had done more, but in {townName} a careful witness can be useful in ways a reckless hero cannot.',
        context: 'You stay on the edge of the scene and let the crisis reveal itself. By the time it resolves, you understand far more about {townName} than the people who rushed in blind.',
        crime: 'You watch the whole thing unfold without announcing yourself. Later, when {npcName} starts lying about it, you will be one of the few in {townName} who knows exactly where the lie begins.'
    },
    take_reward: {
        default: 'You accept what is offered and let the matter close with honest payment. {npcName} seems grateful to settle the debt plainly, and {townName} approves of an ending where everyone knows what was owed.',
        context: 'You take the reward after the hard part is done and avoid the trap of false humility. The people of {townName} may ask for more tomorrow, but today they are simply glad the crisis ended with coin instead of funerals.',
        supernatural: 'You accept the last reward with careful fingers, aware that strange stories rarely end exactly where the gold is counted. Even so, when you leave {townName}, you are richer in purse and not entirely poorer in peace.'
    },
    reinvest: {
        default: 'You turn the reward back into timber, stone, labor, or whatever {townName} most needs. {npcName} looks at you as if generosity from a successful person is stranger than any magic, and the whole town stands a little taller for it.',
        context: 'You put {costGold} gold back into {townName} instead of walking away with the praise. By week end the change is visible, and a mason insists on telling everyone which wall exists because of you.',
        trade: 'You feed your winnings back into local work and materials rather than hoarding them. Merchants in {townName} notice at once, because coin spent that way ripples through ten ledgers before supper.',
        war: 'You reinvest in recovery instead of reward. For a place in {kingdomName} that has been asked to endure too much, that feels less like business and more like relief.'
    },
    mark_secret: {
        default: 'You mark the discovery as yours and keep the deeper truth off the public road. {npcName} understands the trust in that silence, and {townName} never learns how close it came to a stranger sort of story.',
        supernatural: 'You hide the secret rather than feed it to rumor. The last strange trace fades from {townName}, and only you and {npcName} know what still sleeps beneath the quiet surface.',
        political: 'You keep the knowledge sealed because not every advantage improves when exposed to sunlight. In {kingdomName}, secrets kept well can be kinder than secrets spent.'
    }
};
        var EVENT_DEFS = [
        {
            id: "found_coin_purse",
            title: "Found Coin Purse",
            icon: "💰",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "stray_dog",
            title: "Stray Dog",
            icon: "🐕",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "street_performer",
            title: "Street Performer",
            icon: "🎭",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dropped_cargo",
            title: "Dropped Cargo",
            icon: "📦",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "overheard_gossip",
            title: "Overheard Gossip",
            icon: "🫖",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "child_lost",
            title: "Child Lost",
            icon: "🧒",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "drunk_stranger",
            title: "Drunk Stranger",
            icon: "🍺",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "rain_shelter",
            title: "Rain Shelter",
            icon: "🌧️",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "merchant_argument",
            title: "Merchant Argument",
            icon: "✨",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "beggar_plea",
            title: "Beggar Plea",
            icon: "��",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "broken_wheel",
            title: "Broken Wheel",
            icon: "🛞",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "town_crier",
            title: "Town Crier",
            icon: "📯",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "old_woman_herbs",
            title: "Old Woman Herbs",
            icon: "🌿",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "festival_game",
            title: "Festival Game",
            icon: "🎪",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "mysterious_letter",
            title: "Mysterious Letter",
            icon: "✉️",
            category: "common",
            rarity: "rare",
            weight: 6,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "food_vendor",
            title: "Food Vendor",
            icon: "🛒",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "bard_tale",
            title: "Bard Tale",
            icon: "🎶",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "cat_in_tree",
            title: "Cat In Tree",
            icon: "🐈",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "neighbor_dispute",
            title: "Neighbor Dispute",
            icon: "✨",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "sunset_view",
            title: "Sunset View",
            icon: "🌇",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "market_bargain",
            title: "Market Bargain",
            icon: "✨",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "traveling_monk",
            title: "Traveling Monk",
            icon: "🙏",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dropped_wallet",
            title: "Dropped Wallet",
            icon: "👛",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "strange_smell",
            title: "Strange Smell",
            icon: "👃",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "public_speech",
            title: "Public Speech",
            icon: "🗣️",
            category: "common",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "butterfly_garden",
            title: "Butterfly Garden",
            icon: "🦋",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "old_map",
            title: "Old Map",
            icon: "🗺️",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "well_wishing",
            title: "Well Wishing",
            icon: "✨",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "friendly_guard",
            title: "Friendly Guard",
            icon: "🛡️",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "runaway_horse",
            title: "Runaway Horse",
            icon: "🐎",
            category: "common",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "shady_deal",
            title: "Shady Deal",
            icon: "🤝",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "price_crash_tip",
            title: "Price Crash Tip",
            icon: "📉",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "merchant_bankruptcy",
            title: "Merchant Bankruptcy",
            icon: "📉",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "counterfeit_coins",
            title: "Counterfeit Coins",
            icon: "💰",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "tax_collector_bribe",
            title: "Tax Collector Bribe",
            icon: "💰",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "caravan_opportunity",
            title: "Caravan Opportunity",
            icon: "🐪",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "trade_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "warehouse_fire",
            title: "Warehouse Fire",
            icon: "🔥",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "trade_embargo_rumor",
            title: "Trade Embargo Rumor",
            icon: "🚫",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "bulk_buyer",
            title: "Bulk Buyer",
            icon: "💼",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "trade_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "investment_scam",
            title: "Investment Scam",
            icon: "🎲",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "trade_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "supply_glut",
            title: "Supply Glut",
            icon: "📦",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "trade_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "rare_goods_vendor",
            title: "Rare Goods Vendor",
            icon: "🛒",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "market_theft",
            title: "Market Theft",
            icon: "📦",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "debt_collector",
            title: "Debt Collector",
            icon: "📦",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "trade_secret",
            title: "Trade Secret",
            icon: "📦",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "customs_inspection",
            title: "Customs Inspection",
            icon: "📦",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "smuggler_offer",
            title: "Smuggler Offer",
            icon: "📦",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "guild_dues",
            title: "Guild Dues",
            icon: "📦",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "price_war_tip",
            title: "Price War Tip",
            icon: "📉",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "cargo_insurance",
            title: "Cargo Insurance",
            icon: "📦",
            category: "trade",
            rarity: "uncommon",
            weight: 8,
            template: "trade_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "apprentice_offer",
            title: "Apprentice Offer",
            icon: "📦",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "foreign_currency",
            title: "Foreign Currency",
            icon: "🪙",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "raw_material_find",
            title: "Raw Material Find",
            icon: "⛏️",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "rigged_scale",
            title: "Rigged Scale",
            icon: "⚖️",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "trade_offer",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dock_worker_strike",
            title: "Dock Worker Strike",
            icon: "✊",
            category: "trade",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "love_confession",
            title: "Love Confession",
            icon: "💌",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "jealous_rival",
            title: "Jealous Rival",
            icon: "💬",
            category: "social",
            rarity: "common",
            weight: 10,
            template: "social_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "old_friend",
            title: "Old Friend",
            icon: "💬",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "wedding_invitation",
            title: "Wedding Invitation",
            icon: "💒",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "flirtatious_stranger",
            title: "Flirtatious Stranger",
            icon: "😘",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "anonymous_love_letter",
            title: "Anonymous Love Letter",
            icon: "✉️",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "matchmaker",
            title: "Matchmaker",
            icon: "💐",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "heartbreak_witness",
            title: "Heartbreak Witness",
            icon: "💔",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dance_invitation",
            title: "Dance Invitation",
            icon: "💃",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "gift_from_admirer",
            title: "Gift From Admirer",
            icon: "🎁",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "family_reunion",
            title: "Family Reunion",
            icon: "🫂",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "tavern_companion",
            title: "Tavern Companion",
            icon: "💬",
            category: "social",
            rarity: "common",
            weight: 10,
            template: "social_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "love_triangle",
            title: "Love Triangle",
            icon: "💌",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "serenade",
            title: "Serenade",
            icon: "🎵",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "poetry_reading",
            title: "Poetry Reading",
            icon: "🪶",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "childhood_sweetheart",
            title: "Childhood Sweetheart",
            icon: "🧒",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "marriage_proposal_stranger",
            title: "Marriage Proposal Stranger",
            icon: "💍",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "gossip_about_you",
            title: "Gossip About You",
            icon: "🫖",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "pet_name",
            title: "Pet Name",
            icon: "📝",
            category: "social",
            rarity: "uncommon",
            weight: 8,
            template: "romance_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "couple_fight_mediator",
            title: "Couple Fight Mediator",
            icon: "🥊",
            category: "social",
            rarity: "common",
            weight: 10,
            template: "social_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "pickpocket_attempt",
            title: "Pickpocket Attempt",
            icon: "🪙",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "mugging",
            title: "Mugging",
            icon: "🥊",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "bar_fight",
            title: "Bar Fight",
            icon: "🥊",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "arson_witness",
            title: "Arson Witness",
            icon: "🔥",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "smuggler_approach",
            title: "Smuggler Approach",
            icon: "📦",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "prison_break_witness",
            title: "Prison Break Witness",
            icon: "🔓",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "con_artist",
            title: "Con Artist",
            icon: "🎭",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "corrupt_guard",
            title: "Corrupt Guard",
            icon: "🛡️",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "threatening_note",
            title: "Threatening Note",
            icon: "✉️",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "hired_thug",
            title: "Hired Thug",
            icon: "🗡️",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "witness_crime",
            title: "Witness Crime",
            icon: "🕵️",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "fence_offer",
            title: "Fence Offer",
            icon: "🗝️",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "gang_recruitment",
            title: "Gang Recruitment",
            icon: "🩸",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "poison_in_drink",
            title: "Poison In Drink",
            icon: "☠️",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "night_ambush",
            title: "Night Ambush",
            icon: "🌃",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "bounty_posted",
            title: "Bounty Posted",
            icon: "📜",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "protection_racket",
            title: "Protection Racket",
            icon: "💸",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "stolen_goods_found",
            title: "Stolen Goods Found",
            icon: "🗡️",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "false_accusation",
            title: "False Accusation",
            icon: "🗡️",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "underground_gambling",
            title: "Underground Gambling",
            icon: "🎲",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "loan_shark",
            title: "Loan Shark",
            icon: "💸",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "mysterious_package",
            title: "Mysterious Package",
            icon: "📦",
            category: "crime",
            rarity: "rare",
            weight: 6,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "duel_challenge",
            title: "Duel Challenge",
            icon: "⚔️",
            category: "crime",
            rarity: "common",
            weight: 10,
            template: "crime_scene",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "safe_cracker",
            title: "Safe Cracker",
            icon: "🔐",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "escape_artist",
            title: "Escape Artist",
            icon: "🎭",
            category: "crime",
            rarity: "uncommon",
            weight: 8,
            template: "investigation_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_deserter",
            title: "War Deserter",
            icon: "🏃",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_refugee",
            title: "War Refugee",
            icon: "🏚️",
            category: "war",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "military_recruiter",
            title: "Military Recruiter",
            icon: "🪖",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "spy_approach",
            title: "Spy Approach",
            icon: "🕵️",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_profiteer",
            title: "War Profiteer",
            icon: "💼",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "wounded_soldier",
            title: "Wounded Soldier",
            icon: "🩹",
            category: "war",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "enemy_prisoner",
            title: "Enemy Prisoner",
            icon: "🔓",
            category: "war",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "propaganda",
            title: "Propaganda",
            icon: "📣",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_tax",
            title: "War Tax",
            icon: "💰",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "supply_line_cut",
            title: "Supply Line Cut",
            icon: "⚔️",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "battle_news",
            title: "Battle News",
            icon: "⚔️",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "conscription_dodge",
            title: "Conscription Dodge",
            icon: "⚔️",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_memorial",
            title: "War Memorial",
            icon: "🪦",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "siege_preparation",
            title: "Siege Preparation",
            icon: "🏰",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "war_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "peace_rumor",
            title: "Peace Rumor",
            icon: "🕊️",
            category: "war",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "petition_gatherer",
            title: "Petition Gatherer",
            icon: "📜",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "noble_scandal",
            title: "Noble Scandal",
            icon: "🏰",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "royal_decree",
            title: "Royal Decree",
            icon: "👑",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "tax_protest",
            title: "Tax Protest",
            icon: "💰",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "corruption_witness",
            title: "Corruption Witness",
            icon: "📜",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "election_campaign",
            title: "Election Campaign",
            icon: "🗳️",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "land_dispute",
            title: "Land Dispute",
            icon: "📜",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "censorship",
            title: "Censorship",
            icon: "🚫",
            category: "political",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "treason_whisper",
            title: "Treason Whisper",
            icon: "🗡️",
            category: "political",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "diplomatic_visit",
            title: "Diplomatic Visit",
            icon: "🤝",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "court_summons",
            title: "Court Summons",
            icon: "⚖️",
            category: "political",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "succession_crisis",
            title: "Succession Crisis",
            icon: "👑",
            category: "political",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "law_debate",
            title: "Law Debate",
            icon: "📚",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "political_pamphlet",
            title: "Political Pamphlet",
            icon: "📄",
            category: "political",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "noble_feud",
            title: "Noble Feud",
            icon: "🏰",
            category: "political",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "fortune_teller",
            title: "Fortune Teller",
            icon: "🔮",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "cursed_item",
            title: "Cursed Item",
            icon: "🪬",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "wandering_monk",
            title: "Wandering Monk",
            icon: "🙏",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dream_vision",
            title: "Dream Vision",
            icon: "💤",
            category: "supernatural",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "ghost_sighting",
            title: "Ghost Sighting",
            icon: "👻",
            category: "supernatural",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "herbal_healer",
            title: "Herbal Healer",
            icon: "🔮",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "eclipse_omen",
            title: "Eclipse Omen",
            icon: "🌘",
            category: "supernatural",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "talking_beggar",
            title: "Talking Beggar",
            icon: "��",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "alchemist_experiment",
            title: "Alchemist Experiment",
            icon: "⚗️",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "ancient_ruin",
            title: "Ancient Ruin",
            icon: "🏛️",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "prophetic_child",
            title: "Prophetic Child",
            icon: "🧒",
            category: "supernatural",
            rarity: "epic",
            weight: 4,
            template: "long_omen",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "midnight_visitor",
            title: "Midnight Visitor",
            icon: "🚪",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "strange_animal",
            title: "Strange Animal",
            icon: "🦊",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "lucky_charm",
            title: "Lucky Charm",
            icon: "🍀",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "old_legend",
            title: "Old Legend",
            icon: "📖",
            category: "supernatural",
            rarity: "rare",
            weight: 6,
            template: "mystic_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "medical_emergency",
            title: "Medical Emergency",
            icon: "🩺",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "forgery_request",
            title: "Forgery Request",
            icon: "🖋️",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "alchemy_accident",
            title: "Alchemy Accident",
            icon: "⚗️",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "combat_training",
            title: "Combat Training",
            icon: "🌧️",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "lockpick_challenge",
            title: "Lockpick Challenge",
            icon: "🗝️",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "navigation_test",
            title: "Navigation Test",
            icon: "🧭",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "persuasion_test",
            title: "Persuasion Test",
            icon: "🗣️",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "appraisal_moment",
            title: "Appraisal Moment",
            icon: "💎",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "cooking_contest",
            title: "Cooking Contest",
            icon: "🍲",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "animal_taming",
            title: "Animal Taming",
            icon: "🦊",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "teaching_request",
            title: "Teaching Request",
            icon: "📚",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "architecture_opinion",
            title: "Architecture Opinion",
            icon: "📐",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "healing_herbs",
            title: "Healing Herbs",
            icon: "🌿",
            category: "skill",
            rarity: "common",
            weight: 10,
            template: "skill_test",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "instrument_found",
            title: "Instrument Found",
            icon: "🎻",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "sword_in_stone",
            title: "Sword In Stone",
            icon: "🪨",
            category: "skill",
            rarity: "uncommon",
            weight: 8,
            template: "skill_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "peasant_plea",
            title: "Peasant Plea",
            icon: "🧑‍🌾",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "merchant_rivalry",
            title: "Merchant Rivalry",
            icon: "💼",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "noble_duel",
            title: "Noble Duel",
            icon: "⚔️",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "court_gossip",
            title: "Court Gossip",
            icon: "🫖",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "tax_exemption_offer",
            title: "Tax Exemption Offer",
            icon: "💰",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "land_grant",
            title: "Land Grant",
            icon: "📜",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "royal_audience",
            title: "Royal Audience",
            icon: "👑",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "assassination_plot",
            title: "Assassination Plot",
            icon: "🗡️",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "noble_alliance",
            title: "Noble Alliance",
            icon: "🏰",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "commoner_uprising",
            title: "Commoner Uprising",
            icon: "🔥",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "inheritance_dispute",
            title: "Inheritance Dispute",
            icon: "👑",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "guild_leadership",
            title: "Guild Leadership",
            icon: "🏅",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "diplomatic_mission",
            title: "Diplomatic Mission",
            icon: "🤝",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "noble_banquet",
            title: "Noble Banquet",
            icon: "🏰",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "crown_counsel",
            title: "Crown Counsel",
            icon: "👂",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "political_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "quarantine_escape",
            title: "Quarantine Escape",
            icon: "☣️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "plague_healer",
            title: "Plague Healer",
            icon: "☣️",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "famine_hoarding",
            title: "Famine Hoarding",
            icon: "🥣",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "famine_soup_kitchen",
            title: "Famine Soup Kitchen",
            icon: "🥣",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "boom_town_investor",
            title: "Boom Town Investor",
            icon: "🏗️",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "boom_town_complaint",
            title: "Boom Town Complaint",
            icon: "🏗️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "crime_wave_vigilante",
            title: "Crime Wave Vigilante",
            icon: "🕵️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "crime_wave_victim",
            title: "Crime Wave Victim",
            icon: "🕵️",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "price_gouging",
            title: "Price Gouging",
            icon: "📉",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "depression_merchant",
            title: "Depression Merchant",
            icon: "📉",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "frontline_scout",
            title: "Frontline Scout",
            icon: "⚔️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "context_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "frontline_casualty",
            title: "Frontline Casualty",
            icon: "⚔️",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "war_orphan",
            title: "War Orphan",
            icon: "🧒",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "security_checkpoint",
            title: "Security Checkpoint",
            icon: "🛡️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "wealthy_tourist",
            title: "Wealthy Tourist",
            icon: "💎",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "windfall",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "drought_water",
            title: "Drought Water",
            icon: "🪣",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "bandit_warning",
            title: "Bandit Warning",
            icon: "⚠️",
            category: "context",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "refugee_camp",
            title: "Refugee Camp",
            icon: "🏚️",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "morale_boost",
            title: "Morale Boost",
            icon: "📣",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "harvest_festival",
            title: "Harvest Festival",
            icon: "🎪",
            category: "context",
            rarity: "common",
            weight: 10,
            template: "aid",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "fame_recognition",
            title: "Fame Recognition",
            icon: "🌟",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "old_rival_returns",
            title: "Old Rival Returns",
            icon: "👑",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "delayed_notice",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "legacy_challenge",
            title: "Legacy Challenge",
            icon: "👑",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "mentor_student",
            title: "Mentor Student",
            icon: "📚",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "wealth_display",
            title: "Wealth Display",
            icon: "💎",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "legend_in_making",
            title: "Legend In Making",
            icon: "📖",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "humble_origins",
            title: "Humble Origins",
            icon: "🌱",
            category: "rank",
            rarity: "uncommon",
            weight: 8,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "dynasty_founder",
            title: "Dynasty Founder",
            icon: "👑",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "master_trader",
            title: "Master Trader",
            icon: "👑",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: "notorious_reputation",
            title: "Notorious Reputation",
            icon: "☠️",
            category: "rank",
            rarity: "rare",
            weight: 6,
            template: "rank_chain",
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'noble_poison_wine',
            title: 'The Poisoned Chalice',
            icon: '🍷',
            category: 'crime',
            rarity: 'rare',
            weight: 5,
            template: 'poison_plot',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'perfumed_venom',
            title: 'Perfume and Venom',
            icon: '🧪',
            category: 'political',
            rarity: 'rare',
            weight: 4,
            template: 'poison_plot',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'funeral_toast_scheme',
            title: 'The Funeral Toast',
            icon: '⚰️',
            category: 'social',
            rarity: 'uncommon',
            weight: 6,
            template: 'poison_plot',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'guild_feud_banner',
            title: 'Choose a Banner',
            icon: '🏴',
            category: 'social',
            rarity: 'uncommon',
            weight: 8,
            template: 'alliance_offer',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'quarry_house_rivalry',
            title: 'Stone Against Silk',
            icon: '⚖️',
            category: 'political',
            rarity: 'uncommon',
            weight: 6,
            template: 'alliance_offer',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'blood_oath_patronage',
            title: 'A Patron\'s Side',
            icon: '🗡️',
            category: 'rank',
            rarity: 'rare',
            weight: 5,
            template: 'alliance_offer',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'ledger_of_lies',
            title: 'Ledger of Lies',
            icon: '📜',
            category: 'crime',
            rarity: 'rare',
            weight: 5,
            template: 'betrayal_chain',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'sealed_with_your_name',
            title: 'Sealed with Your Name',
            icon: '✉️',
            category: 'social',
            rarity: 'rare',
            weight: 5,
            template: 'betrayal_chain',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'friend_in_two_shadows',
            title: 'A Friend in Two Shadows',
            icon: '🕯️',
            category: 'political',
            rarity: 'rare',
            weight: 4,
            template: 'betrayal_chain',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'wax_seal_conspiracy',
            title: 'The Wax Seal Conspiracy',
            icon: '🕯️',
            category: 'political',
            rarity: 'rare',
            weight: 5,
            template: 'court_intrigue',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'silk_curtain_cabal',
            title: 'Behind the Silk Curtain',
            icon: '🎭',
            category: 'political',
            rarity: 'rare',
            weight: 4,
            template: 'court_intrigue',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'letters_to_the_crown',
            title: 'Letters for the Crown',
            icon: '👑',
            category: 'rank',
            rarity: 'rare',
            weight: 4,
            template: 'court_intrigue',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'drunken_property_deed',
            title: 'The Deed at Last Call',
            icon: '🍺',
            category: 'common',
            rarity: 'uncommon',
            weight: 8,
            template: 'tavern_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'goose_duel_wagers',
            title: 'The Goose Won the Argument',
            icon: '🪿',
            category: 'social',
            rarity: 'uncommon',
            weight: 7,
            template: 'tavern_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'one_boot_treaty',
            title: 'The One-Boot Treaty',
            icon: '👢',
            category: 'common',
            rarity: 'uncommon',
            weight: 7,
            template: 'tavern_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'royal_audit_mixup',
            title: 'Royal Audit Mix-Up',
            icon: '👑',
            category: 'political',
            rarity: 'uncommon',
            weight: 7,
            template: 'mistaken_identity',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'velvet_knife_mixup',
            title: 'The Wrong Outlaw',
            icon: '🗡️',
            category: 'crime',
            rarity: 'rare',
            weight: 4,
            template: 'mistaken_identity',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'moonlit_serenade_mixup',
            title: 'Moonlit Serenade Mix-Up',
            icon: '💌',
            category: 'social',
            rarity: 'uncommon',
            weight: 6,
            template: 'mistaken_identity',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'champion_in_disguise',
            title: 'Champion in Disguise',
            icon: '⚔️',
            category: 'skill',
            rarity: 'common',
            weight: 8,
            template: 'mistaken_identity',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'goat_versus_taxman',
            title: 'Goat Versus the Taxman',
            icon: '🐐',
            category: 'political',
            rarity: 'common',
            weight: 10,
            template: 'animal_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'parrot_of_state_secrets',
            title: 'Parrot of State Secrets',
            icon: '🦜',
            category: 'social',
            rarity: 'uncommon',
            weight: 8,
            template: 'animal_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'pig_in_the_courthouse',
            title: 'Pig in the Courthouse',
            icon: '🐖',
            category: 'common',
            rarity: 'common',
            weight: 10,
            template: 'animal_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'cat_inherits_a_shop',
            title: 'Cat Inherits a Shop',
            icon: '🐈',
            category: 'trade',
            rarity: 'uncommon',
            weight: 7,
            template: 'animal_chaos',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'alehouse_partnership',
            title: 'Alehouse Partnership',
            icon: '🍻',
            category: 'trade',
            rarity: 'common',
            weight: 9,
            template: 'drunken_deal',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'ceremonial_goose_contract',
            title: 'Ceremonial Goose Contract',
            icon: '📜',
            category: 'common',
            rarity: 'uncommon',
            weight: 7,
            template: 'drunken_deal',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'accidental_betrothal_merger',
            title: 'Accidental Betrothal Merger',
            icon: '💍',
            category: 'social',
            rarity: 'rare',
            weight: 4,
            template: 'drunken_deal',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'contraband_cheese_partnership',
            title: 'Contraband Cheese Partnership',
            icon: '🧀',
            category: 'crime',
            rarity: 'uncommon',
            weight: 6,
            template: 'drunken_deal',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'dragon_with_a_cheese_knife',
            title: 'Dragon with a Cheese Knife',
            icon: '🐉',
            category: 'skill',
            rarity: 'uncommon',
            weight: 7,
            template: 'rumor_spiral',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'duchess_engagement_rumor',
            title: 'Duchess Engagement Rumor',
            icon: '💍',
            category: 'social',
            rarity: 'uncommon',
            weight: 7,
            template: 'rumor_spiral',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'kings_horse_scandal',
            title: 'The King\'s Horse Scandal',
            icon: '🐎',
            category: 'political',
            rarity: 'rare',
            weight: 4,
            template: 'rumor_spiral',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'saint_of_the_turnip',
            title: 'Saint of the Turnip',
            icon: '🥕',
            category: 'common',
            rarity: 'common',
            weight: 9,
            template: 'rumor_spiral',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'eel_pie_showdown',
            title: 'Eel Pie Showdown',
            icon: '🥧',
            category: 'common',
            rarity: 'common',
            weight: 9,
            template: 'cooking_contest',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'turnip_terrine_trials',
            title: 'Turnip Terrine Trials',
            icon: '🥕',
            category: 'trade',
            rarity: 'uncommon',
            weight: 7,
            template: 'cooking_contest',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'duke_of_gravy_memorial_cup',
            title: 'Duke of Gravy Memorial Cup',
            icon: '🍲',
            category: 'political',
            rarity: 'uncommon',
            weight: 6,
            template: 'cooking_contest',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'black_garlic_blood_feud',
            title: 'Black Garlic Blood Feud',
            icon: '��',
            category: 'social',
            rarity: 'rare',
            weight: 4,
            template: 'cooking_contest',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'market_shadow',
            title: 'Market Shadow',
            icon: '🪙',
            category: 'trade',
            rarity: 'uncommon',
            weight: 8,
            template: 'rival_merchant',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'countinghouse_duel',
            title: 'Countinghouse Duel',
            icon: '📒',
            category: 'trade',
            rarity: 'rare',
            weight: 6,
            template: 'rival_merchant',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'gate_of_two_ledgers',
            title: 'Gate of Two Ledgers',
            icon: '🚪',
            category: 'social',
            rarity: 'rare',
            weight: 5,
            template: 'rival_merchant',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'favor_asked_softly',
            title: 'Favor Asked Softly',
            icon: '🤝',
            category: 'social',
            rarity: 'common',
            weight: 10,
            template: 'trusted_ally',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'ally_keeps_score',
            title: 'Ally Keeps Score',
            icon: '🕯️',
            category: 'context',
            rarity: 'uncommon',
            weight: 8,
            template: 'trusted_ally',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'gate_oath',
            title: 'Gate Oath',
            icon: '🛡️',
            category: 'social',
            rarity: 'rare',
            weight: 6,
            template: 'trusted_ally',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'dust_of_old_promises',
            title: 'Dust of Old Promises',
            icon: '📜',
            category: 'social',
            rarity: 'uncommon',
            weight: 8,
            template: 'old_debt',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'coin_between_you',
            title: 'Coin Between You',
            icon: '🧾',
            category: 'trade',
            rarity: 'uncommon',
            weight: 7,
            template: 'old_debt',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'the_road_remembers',
            title: 'The Road Remembers',
            icon: '🛤️',
            category: 'context',
            rarity: 'rare',
            weight: 5,
            template: 'old_debt',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'enemy_cup_of_wine',
            title: 'Enemy Cup of Wine',
            icon: '🍷',
            category: 'political',
            rarity: 'rare',
            weight: 6,
            template: 'forbidden_friendship',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'guilds_unquiet_whisper',
            title: 'Guild\'s Unquiet Whisper',
            icon: '🪡',
            category: 'trade',
            rarity: 'uncommon',
            weight: 7,
            template: 'forbidden_friendship',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'lantern_after_curfew',
            title: 'Lantern After Curfew',
            icon: '🏮',
            category: 'crime',
            rarity: 'rare',
            weight: 5,
            template: 'forbidden_friendship',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'when_they_send_for_you',
            title: 'When They Send for You',
            icon: '🚑',
            category: 'context',
            rarity: 'common',
            weight: 9,
            template: 'npc_in_trouble',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'rope_and_rain',
            title: 'Rope and Rain',
            icon: '⛓️',
            category: 'crime',
            rarity: 'rare',
            weight: 6,
            template: 'npc_in_trouble',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        },
        {
            id: 'the_last_good_name',
            title: 'The Last Good Name',
            icon: '🌧️',
            category: 'social',
            rarity: 'uncommon',
            weight: 7,
            template: 'npc_in_trouble',
            condition: function(ctx) { return _passesCondition(ctx, this); },
            generate: function(ctx) {
                var extra = _derivedExtra(this);
                var rng = ctx && ctx.rng;
                var base;
                var npc;
                var resourceId;
                var params;
                if (!ctx || !rng || !player || !ctx.town) return null;
                base = _rarityBase(this.rarity);
                npc = _pickNpc(ctx, extra.npcRole);
                var npc2 = _pickNpc(ctx, null);
                if (npc2 && npc && npc2.id === npc.id) npc2 = _pickNpc(ctx, null);
                resourceId = _chooseFromGroup(this, ctx);
                params = {
                    townName: ctx.townName,
                    kingdomName: ctx.kingdomName,
                    playerName: ctx.playerName,
                    npcName: npc ? (npc.firstName || 'a stranger') : 'a stranger',
                    npc2Name: (npc2 && npc2.firstName && (!npc || npc2.id !== npc.id)) ? npc2.firstName : 'a local merchant',
                    goldAmount: _roll(rng, base.gold),
                    repAmount: _roll(rng, base.rep),
                    relAmount: _roll(rng, base.rel),
                    energyAmount: _roll(rng, base.energy),
                    itemQty: _roll(rng, base.qty),
                    waitDays: _roll(rng, base.wait),
                    waitDays2: _roll(rng, [1, Math.max(2, base.wait[1])]),
                    resourceId: resourceId,
                    resourceName: RESOURCE_NAMES[resourceId] || resourceId,
                    costGold: Math.max(6, Math.floor(_roll(rng, base.gold) * 0.5)),
                    rewardGold: Math.max(10, Math.floor(_roll(rng, base.gold) * 1.2))
                };
                return {
                    id: 'ue_' + (player._nextUnsolicitedEventId++),
                    defId: this.id,
                    stepIndex: 0,
                    params: params,
                    generatedDay: ctx.day,
                    dueDay: ctx.day,
                    status: 'pending',
                    choiceHistory: [],
                    townId: ctx.town ? ctx.town.id : null,
                    kingdomId: ctx.kingdomId || null,
                    npcId: npc ? npc.id : null
                };
            },
            applyEffect: function(effectKey, params, ctx) { _applyUnsolicitedEffect(this, effectKey, params, ctx); }
        }
    ];

    var EVENT_DEF_MAP = {};
    var i;
    for (i = 0; i < EVENT_DEFS.length; i++) EVENT_DEF_MAP[EVENT_DEFS[i].id] = EVENT_DEFS[i];

    function _findActiveIndex(id) {
        var i;
        for (i = 0; i < player._activeUnsolicitedEvents.length; i++) {
            if (player._activeUnsolicitedEvents[i] && player._activeUnsolicitedEvents[i].id === id) return i;
        }
        return -1;
    }
    function _surfaceReadyActive() {
        var day = _getDay();
        var i, inst;
        if (player._pendingUnsolicitedEvent) return true;
        for (i = 0; i < player._activeUnsolicitedEvents.length; i++) {
            inst = player._activeUnsolicitedEvents[i];
            if (!inst || inst.status !== 'ready') continue;
            if (inst.dueDay > day) continue;
            if (inst.params && inst.params.dismissedDay === day) continue;
            player._pendingUnsolicitedEvent = _copy(inst);
            return true;
        }
        return false;
    }
    function _eligibleDefs(ctx) {
        var defs = [];
        var i, def, last, catLast;
        for (i = 0; i < EVENT_DEFS.length; i++) {
            def = EVENT_DEFS[i];
            last = player._unsolicitedEventCooldowns[def.id];
            catLast = player._unsolicitedEventCatCooldowns[def.category];
            if (last != null && (ctx.day - last) < PER_EVENT_COOLDOWN_DAYS) continue;
            if (catLast != null && (ctx.day - catLast) < (CATEGORY_COOLDOWNS[def.category] || 0)) continue;
            if (MULTI_TEMPLATES[def.template] && ctx.activeMulti >= MAX_ACTIVE_MULTI_STEP) continue;
            try {
                if (def.condition(ctx)) defs.push(def);
            } catch (e) {}
        }
        return defs;
    }
    function _weightedPick(defs, rng) {
        var total = 0;
        var i, roll;
        for (i = 0; i < defs.length; i++) total += defs[i].weight || 1;
        if (!total) return null;
        roll = rng.random() * total;
        for (i = 0; i < defs.length; i++) {
            roll -= defs[i].weight || 1;
            if (roll <= 0) return defs[i];
        }
        return defs.length ? defs[defs.length - 1] : null;
    }
    function _setTriggered(def, instance, day) {
        player._lastUnsolicitedEventDay = day;
        player._unsolicitedEventCooldowns[def.id] = day;
        player._unsolicitedEventCatCooldowns[def.category] = day;
        if (MULTI_TEMPLATES[def.template]) {
            instance.status = 'ready';
            player._activeUnsolicitedEvents.push(_copy(instance));
        }
        player._pendingUnsolicitedEvent = _copy(instance);
        _log(def.icon + ' ' + def.title + ' has found ' + _playerName() + '.', { type: 'unsolicited_event', defId: def.id }, 'my_actions');
    }
    function _tryGenerate(chance) {
        var ctx, defs, pool, def, instance;
        if (!_ensureState()) return false;
        tickUnsolicitedEvents();
        if (_suppressed() || player._pendingUnsolicitedEvent) return false;
        ctx = _buildContext();
        if (!ctx.rng || !ctx.town) return false;
        if ((ctx.day - player._lastUnsolicitedEventDay) < GLOBAL_COOLDOWN_DAYS) return false;
        if (!ctx.rng.chance(chance)) return false;
        defs = _eligibleDefs(ctx);
        pool = defs.slice();
        while (pool.length) {
            def = _weightedPick(pool, ctx.rng);
            if (!def) break;
            try { instance = def.generate(ctx); } catch (e) { instance = null; }
            if (instance) {
                _setTriggered(def, instance, ctx.day);
                return true;
            }
            pool.splice(pool.indexOf(def), 1);
        }
        return false;
    }

    function tryGenerateDailyUnsolicitedEvent() {
        if (!window._godUeBoost) return false;
        var ch = 0.50;
        return _tryGenerate(ch);
    }
    // God mode: force-fire an event, bypassing cooldowns and RNG
    function _godForceUnsolicitedEvent() {
        var ctx, defs, pool, def, instance;
        if (!_ensureState()) return { success: false, reason: 'no player state' };
        if (player._pendingUnsolicitedEvent) return { success: false, reason: 'pending event already exists (dismiss it first)' };
        ctx = _buildContext();
        if (!ctx.rng) return { success: false, reason: 'no RNG available' };
        if (!ctx.town) return { success: false, reason: 'player not in a town (townId=' + (player.townId || 'null') + ')' };
        defs = _eligibleDefs(ctx);
        if (!defs.length) return { success: false, reason: 'no eligible events (all on cooldown or conditions not met)' };
        pool = defs.slice();
        while (pool.length) {
            def = _weightedPick(pool, ctx.rng);
            if (!def) break;
            try { instance = def.generate(ctx); } catch (e) { instance = null; }
            if (instance) {
                _setTriggered(def, instance, ctx.day);
                return { success: true, reason: 'fired: ' + def.title + ' (' + def.id + ')' };
            }
            pool.splice(pool.indexOf(def), 1);
        }
        return { success: false, reason: defs.length + ' eligible defs but all generate() returned null' };
    }
    // God mode: diagnostic info
    function _godDiagUnsolicitedEvents() {
        if (!_ensureState()) return { state: false };
        var ctx = _buildContext();
        var suppressed = _suppressed();
        var hasPending = !!player._pendingUnsolicitedEvent;
        var hasTown = !!(ctx && ctx.town);
        var hasRng = !!(ctx && ctx.rng);
        var day = _getDay();
        var cooldownOk = (day - player._lastUnsolicitedEventDay) >= GLOBAL_COOLDOWN_DAYS;
        var eligible = 0;
        try { eligible = _eligibleDefs(ctx).length; } catch(e) {}
        return {
            state: true, day: day, suppressed: suppressed, hasPending: hasPending,
            hasTown: hasTown, townId: player.townId || null,
            hasRng: hasRng, cooldownOk: cooldownOk,
            lastEventDay: player._lastUnsolicitedEventDay,
            globalCooldown: GLOBAL_COOLDOWN_DAYS,
            eligibleDefs: eligible,
            totalDefs: EVENT_DEFS.length,
            activeMulti: (player._activeUnsolicitedEvents || []).length,
            boosted: !!window._godUeBoost
        };
    }
    function tryGenerateEntryUnsolicitedEvent(townId) {
        var day;
        if (!window._godUeBoost) return false;
        if (!_ensureState()) return false;
        if (townId && player.townId && townId !== player.townId) return false;
        day = _getDay();
        if (player._lastUnsolicitedEventEntryDay === day) return false;
        player._lastUnsolicitedEventEntryDay = day;
        return _tryGenerate(ENTRY_CHANCE);
    }

    function tickUnsolicitedEvents() {
        var day, i, inst, def, pendingIdx;
        if (!_ensureState()) return [];
        day = _getDay();
        for (i = player._activeUnsolicitedEvents.length - 1; i >= 0; i--) {
            inst = player._activeUnsolicitedEvents[i];
            def = inst ? EVENT_DEF_MAP[inst.defId] : null;
            if (!inst || !def || (day - inst.generatedDay) > ACTIVE_EXPIRY_DAYS) {
                if (inst && def) _log((def.icon || '⏳') + ' ' + (def.title || inst.defId) + ' expired before it could conclude.', { type: 'unsolicited_event_expired', defId: inst.defId }, 'my_actions');
                player._activeUnsolicitedEvents.splice(i, 1);
                continue;
            }
            if (inst.npcId) {
                var npc = _findPerson(inst.npcId);
                if (npc && npc.alive === false) {
                    _log((def.icon || '💀') + ' ' + (def.title || inst.defId) + ' ends because a key figure is gone.', { type: 'unsolicited_event_ended', defId: inst.defId }, 'my_actions');
                    player._activeUnsolicitedEvents.splice(i, 1);
                    continue;
                }
            }
            if (inst.status === 'waiting' && inst.dueDay <= day) inst.status = 'ready';
        }
        if (player._pendingUnsolicitedEvent) {
            if ((day - player._pendingUnsolicitedEvent.generatedDay) > ACTIVE_EXPIRY_DAYS || !EVENT_DEF_MAP[player._pendingUnsolicitedEvent.defId]) {
                player._pendingUnsolicitedEvent = null;
            } else if (MULTI_TEMPLATES[(EVENT_DEF_MAP[player._pendingUnsolicitedEvent.defId] || {}).template]) {
                pendingIdx = _findActiveIndex(player._pendingUnsolicitedEvent.id);
                if (pendingIdx < 0) player._pendingUnsolicitedEvent = null;
            }
        }
        _surfaceReadyActive();
        return getActiveUnsolicitedEvents();
    }

    function getPendingUnsolicitedEvent() {
        var ctx, inst, def, raw, out, i, reason;
        if (!_ensureState()) return null;
        _surfaceReadyActive();
        inst = player._pendingUnsolicitedEvent;
        if (!inst) return null;
        // Validate NPC is still alive — auto-dismiss if dead or missing
        if (inst.npcId) {
            var npcCheck = _findPerson(inst.npcId);
            if (!npcCheck || npcCheck.alive === false) {
                player._pendingUnsolicitedEvent = null;
                return null;
            }
        }
        def = EVENT_DEF_MAP[inst.defId];
        if (!def) return null;
        ctx = _buildContext();
        raw = _rawStep(def, inst, ctx);
        out = {
            instanceId: inst.id,
            defId: def.id,
            stepIndex: inst.stepIndex,
            title: _fill(raw.title || def.title, inst.params, ctx),
            icon: raw.icon || def.icon,
            text: _fill(raw.text, inst.params, ctx),
            npcId: inst.npcId || null,
            npcName: (inst.params && inst.params.npcName) || null,
            category: def.category || 'common',
            template: def.template || 'windfall',
            choices: []
        };
        for (i = 0; i < raw.choices.length; i++) {
            reason = _requireReason(raw.choices[i], inst.params);
            out.choices.push({
                id: raw.choices[i].id,
                label: _fill(raw.choices[i].label, inst.params, ctx),
                disabled: !!reason,
                disabledReason: reason || null
            });
        }
        return out;
    }

    function getActiveUnsolicitedEvents() {
        var list = [];
        var i, inst, def, ctx, raw;
        if (!_ensureState()) return list;
        ctx = _buildContext();
        for (i = 0; i < player._activeUnsolicitedEvents.length; i++) {
            inst = player._activeUnsolicitedEvents[i];
            def = inst ? EVENT_DEF_MAP[inst.defId] : null;
            if (!inst || !def) continue;
            raw = _rawStep(def, inst, ctx);
            list.push({
                id: inst.id,
                defId: inst.defId,
                title: def.title,
                icon: def.icon,
                category: def.category,
                stepIndex: inst.stepIndex,
                status: inst.status,
                dueDay: inst.dueDay,
                generatedDay: inst.generatedDay,
                townId: inst.townId,
                kingdomId: inst.kingdomId,
                npcId: inst.npcId,
                summary: _fill(raw.text, inst.params, ctx)
            });
        }
        return list;
    }

    function dismissPendingUnsolicitedEvent() {
        var inst, idx, day;
        if (!_ensureState()) return false;
        inst = player._pendingUnsolicitedEvent;
        if (!inst) return false;
        day = _getDay();
        idx = _findActiveIndex(inst.id);
        if (idx >= 0) {
            player._activeUnsolicitedEvents[idx].status = 'waiting';
            player._activeUnsolicitedEvents[idx].dueDay = day + 1;
            player._activeUnsolicitedEvents[idx].params.dismissedDay = day;
        }
        player._pendingUnsolicitedEvent = null;
        return true;
    }

    function handleUnsolicitedEventChoice(eventInstanceId, choiceIndex) {
        var inst, def, ctx, raw, choice, i, idx, delay, nextCopy, choiceId, reason;
        var narrative, effects, continuesInDays;
        if (!_ensureState()) return { success: false, message: 'No player state.' };
        inst = player._pendingUnsolicitedEvent;
        if (!inst) return { success: false, message: 'No pending unsolicited event.' };
        if (typeof choiceIndex === 'undefined') {
            choiceId = eventInstanceId;
            eventInstanceId = inst.id;
        } else if (typeof choiceIndex === 'number') {
            if (choiceIndex >= 0) choice = null;
        } else {
            choiceId = choiceIndex;
        }
        if (eventInstanceId && inst.id !== eventInstanceId) return { success: false, message: 'That event is no longer pending.' };
        def = EVENT_DEF_MAP[inst.defId];
        if (!def) {
            player._pendingUnsolicitedEvent = null;
            return { success: false, message: 'Event definition missing.' };
        }
        ctx = _buildContext();
        raw = _rawStep(def, inst, ctx);
        if (typeof choiceIndex === 'number') {
            choice = raw.choices[choiceIndex] || null;
        } else {
            for (i = 0; i < raw.choices.length; i++) {
                if (raw.choices[i].id === choiceId) { choice = raw.choices[i]; break; }
            }
        }
        if (!choice) return { success: false, message: 'Choice not found.' };
        reason = _requireReason(choice, inst.params);
        if (reason) return { success: false, message: reason };
        inst.choiceHistory.push({ day: ctx.day, stepIndex: inst.stepIndex, choiceId: choice.id });
        inst.params.kingdomId = inst.kingdomId;
        inst.params.npcId = inst.npcId;
        _outcome = [];
        try { def.applyEffect(choice.effectKey, inst.params, ctx); } catch (e) {}
        var rawNarr = RESULT_NARRATIVES[choice.effectKey];
        if (rawNarr && typeof rawNarr === 'object') {
            narrative = rawNarr[def.category] || rawNarr['default'] || 'The matter is settled.';
        } else {
            narrative = rawNarr || 'The matter is settled.';
        }
        narrative = _fill(narrative, inst.params, ctx);
        effects = _outcome ? _outcome.slice() : [];
        _outcome = null;
        continuesInDays = null;
        idx = _findActiveIndex(inst.id);
        if (choice.nextStepIndex == null) {
            if (idx >= 0) player._activeUnsolicitedEvents.splice(idx, 1);
            player._pendingUnsolicitedEvent = null;
            _log(def.icon + ' ' + def.title + ' resolves for ' + _playerName() + '.', { type: 'unsolicited_event_resolved', defId: def.id }, 'my_actions');
            _surfaceReadyActive();
        } else {
            inst.stepIndex = choice.nextStepIndex;
            delay = _stepDelay(def, inst, choice.nextStepIndex);
            continuesInDays = delay > 0 ? delay : 0;
            if (idx >= 0) {
                player._activeUnsolicitedEvents[idx] = _copy(inst);
                player._activeUnsolicitedEvents[idx].status = delay > 0 ? 'waiting' : 'ready';
                player._activeUnsolicitedEvents[idx].dueDay = ctx.day + delay;
                nextCopy = _copy(player._activeUnsolicitedEvents[idx]);
            } else {
                nextCopy = _copy(inst);
                nextCopy.status = delay > 0 ? 'waiting' : 'ready';
                nextCopy.dueDay = ctx.day + delay;
            }
            player._pendingUnsolicitedEvent = null;
            if (delay > 0) {
                _log(def.icon + ' ' + def.title + ' will return in ' + delay + ' days.', { type: 'unsolicited_event_waiting', defId: def.id }, 'my_actions');
            } else {
                player._pendingUnsolicitedEvent = _copy(nextCopy);
            }
        }
        return {
            success: true,
            title: def.title,
            icon: def.icon,
            narrative: narrative,
            effects: effects,
            continuesInDays: continuesInDays,
            message: continuesInDays > 0 ? 'The story continues in ' + continuesInDays + ' days.' : 'Choice resolved.'
        };
    }

    Player.tryGenerateDailyUnsolicitedEvent = tryGenerateDailyUnsolicitedEvent;
    Player.tryGenerateEntryUnsolicitedEvent = tryGenerateEntryUnsolicitedEvent;
    Player.tickUnsolicitedEvents = tickUnsolicitedEvents;
    Player.getPendingUnsolicitedEvent = getPendingUnsolicitedEvent;
    Player.handleUnsolicitedEventChoice = handleUnsolicitedEventChoice;
    Player.getActiveUnsolicitedEvents = getActiveUnsolicitedEvents;
    Player.dismissPendingUnsolicitedEvent = dismissPendingUnsolicitedEvent;
    Player._godForceUnsolicitedEvent = _godForceUnsolicitedEvent;
    Player._godDiagUnsolicitedEvents = _godDiagUnsolicitedEvents;
})(window.Player);
