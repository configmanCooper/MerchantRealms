// ============================================================
// Merchant Realms — Player Quests Module (extracted from player.js)
// Extends window.Player with Town Quests, Kingdom Quests,
// NPC Interactions, and Guild Membership functions
// ============================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_quests.js");

    var player;
    function _sync() { player = Player.state; }
    // ========================================================
    // §16B TOWN QUESTS SYSTEM
    // ========================================================

    var _nextQuestId = 1;

    Player._setNextQuestId = function(val) { _nextQuestId = val; };

    // Quest type definitions: ~50 types across categories
    var TOWN_QUEST_TYPES = [
        // ---- GENERIC (always available) ----
        { id: 'food_drive', category: 'generic', title: 'Food Drive', resources: ['bread','meat','eggs','poultry','fish','vegetables'], qtyRange: [8,30], timeRange: [20,40],
          descFn: function(t,r,q) { return 'Many in '+t.name+' are struggling to feed their families. The town council is calling for donations of '+q+' '+r.name+' to distribute to the needy.'; } },
        { id: 'fuel_supply', category: 'generic', title: 'Fuel for Hearths', resources: ['wood'], qtyRange: [15,50], timeRange: [20,45],
          descFn: function(t,r,q) { return 'Firewood stores in '+t.name+' are running low. Residents need '+q+' '+r.name+' to keep their hearths burning.'; } },
        { id: 'tool_request', category: 'generic', title: 'Tools for Craftsmen', resources: ['tools'], qtyRange: [3,12], timeRange: [25,45],
          descFn: function(t,r,q) { return 'Local craftsmen in '+t.name+' are in desperate need of '+q+' sets of '+r.name+'. Their old ones have worn out and workshops sit idle.'; } },
        { id: 'cloth_donation', category: 'generic', title: 'Clothing the Needy', resources: ['cloth','clothes'], qtyRange: [5,20], timeRange: [20,40],
          descFn: function(t,r,q) { return 'With the changing seasons, many in '+t.name+' lack proper attire. '+q+' units of '+r.name+' would help clothe those in need.'; } },
        { id: 'construction_aid', category: 'generic', title: 'Town Construction Project', resources: ['planks','stone','bricks'], qtyRange: [10,40], timeRange: [25,50],
          descFn: function(t,r,q) { return t.name+' has begun a public construction project but lacks materials. They need '+q+' '+r.name+' to proceed.'; } },
        { id: 'salt_preservation', category: 'generic', title: 'Salt for Preservation', resources: ['salt'], qtyRange: [8,25], timeRange: [20,40],
          descFn: function(t,r,q) { return 'Butchers and fishmongers in '+t.name+' need '+q+' '+r.name+' to preserve their stock before it spoils.'; } },
        { id: 'leather_goods', category: 'generic', title: 'Leather for the Cobbler', resources: ['leather','hide'], qtyRange: [5,18], timeRange: [20,40],
          descFn: function(t,r,q) { return 'The cobbler and saddlemaker in '+t.name+' are running low on materials. They need '+q+' '+r.name+' to fill orders.'; } },
        { id: 'tavern_restock', category: 'generic', title: 'Tavern Running Dry', resources: ['ale','wine','mead','cider'], qtyRange: [6,25], timeRange: [15,35],
          descFn: function(t,r,q) { return 'The tavern in '+t.name+' is nearly out of drinks! The tavernkeep urgently needs '+q+' '+r.name+' before patrons riot.'; } },
        { id: 'rope_needed', category: 'generic', title: 'Rope for the Docks', resources: ['rope','hemp'], qtyRange: [5,20], timeRange: [20,40],
          descFn: function(t,r,q) { return 'Workers in '+t.name+' need '+q+' '+r.name+' for construction and rigging. Can you supply them?'; } },
        { id: 'iron_request', category: 'generic', title: 'Iron for the Smith', resources: ['iron','iron_ore'], qtyRange: [5,18], timeRange: [25,45],
          descFn: function(t,r,q) { return 'The blacksmith in '+t.name+' has run out of raw materials. '+q+' '+r.name+' would get the forge roaring again.'; } },
        { id: 'honey_request', category: 'generic', title: 'Honey for the Healers', resources: ['honey'], qtyRange: [4,15], timeRange: [20,40],
          descFn: function(t,r,q) { return 'Apothecaries in '+t.name+' use honey in many remedies. They are requesting '+q+' '+r.name+' from any willing merchant.'; } },
        { id: 'furniture_needed', category: 'generic', title: 'Furnishing New Homes', resources: ['furniture'], qtyRange: [3,10], timeRange: [25,50],
          descFn: function(t,r,q) { return 'New families have moved to '+t.name+' and need furniture. '+q+' pieces of '+r.name+' are needed for their homes.'; } },

        // ---- WAR/CONFLICT ----
        { id: 'war_bandages', category: 'war', title: 'Bandages for the Wounded', resources: ['bandages'], qtyRange: [10,40], timeRange: [15,30],
          descFn: function(t,r,q) { return '⚔️ War rages and wounded soldiers pour into '+t.name+'. The healers desperately need '+q+' '+r.name+' to treat the injured.'; } },
        { id: 'war_weapons', category: 'war', title: 'Arms for the Militia', resources: ['swords','bows'], qtyRange: [4,15], timeRange: [20,40],
          descFn: function(t,r,q) { return '⚔️ With war threatening '+t.name+', the town guard needs '+q+' '+r.name+' to arm the local militia.'; } },
        { id: 'war_armor', category: 'war', title: 'Armor for Defenders', resources: ['armor'], qtyRange: [3,10], timeRange: [25,45],
          descFn: function(t,r,q) { return '⚔️ '+t.name+'\'s defenders lack proper protection. They urgently request '+q+' sets of '+r.name+'.'; } },
        { id: 'war_provisions', category: 'war', title: 'Provisions for Troops', resources: ['preserved_food','bread','meat'], qtyRange: [10,35], timeRange: [15,35],
          descFn: function(t,r,q) { return '⚔️ Soldiers stationed near '+t.name+' are running low on rations. Supply '+q+' '+r.name+' to feed the troops.'; } },
        { id: 'war_horses', category: 'war', title: 'Horses for the Cavalry', resources: ['horses'], qtyRange: [2,6], timeRange: [25,45],
          descFn: function(t,r,q) { return '⚔️ The cavalry is undermounted! '+t.name+' needs '+q+' war '+r.name+' to bolster the kingdom\'s mounted forces.'; } },
        { id: 'war_arrows', category: 'war', title: 'Arrows for the Archers', resources: ['arrows'], qtyRange: [15,50], timeRange: [15,30],
          descFn: function(t,r,q) { return '⚔️ Archers defending '+t.name+' are running low on ammunition. They need '+q+' bundles of '+r.name+' immediately.'; } },

        // ---- PLAGUE/ILLNESS ----
        { id: 'plague_medicine', category: 'plague', title: 'Medicine for the Sick', resources: ['herbal_remedy','healing_tonic'], qtyRange: [5,20], timeRange: [15,30],
          descFn: function(t,r,q) { return '🏥 A plague ravages '+t.name+'! Healers urgently need '+q+' '+r.name+' to treat the afflicted.'; } },
        { id: 'plague_bandages', category: 'plague', title: 'Bandages for Plague Victims', resources: ['bandages'], qtyRange: [10,35], timeRange: [15,30],
          descFn: function(t,r,q) { return '🏥 The plague in '+t.name+' has overwhelmed the infirmary. '+q+' '+r.name+' are desperately needed.'; } },
        { id: 'plague_tonics', category: 'plague', title: 'Fever Tonics Needed', resources: ['fever_tonic','healing_tonic'], qtyRange: [4,15], timeRange: [15,30],
          descFn: function(t,r,q) { return '🏥 Fever has gripped '+t.name+'. Apothecaries need '+q+' '+r.name+' before more people succumb.'; } },
        { id: 'plague_antidotes', category: 'plague', title: 'Antidotes Required', resources: ['antidote'], qtyRange: [3,10], timeRange: [20,35],
          descFn: function(t,r,q) { return '🏥 A mysterious ailment in '+t.name+' requires rare antidotes. '+q+' '+r.name+' could save dozens of lives.'; } },
        { id: 'plague_herbs', category: 'plague', title: 'Herbs for the Apothecary', resources: ['herbs'], qtyRange: [8,30], timeRange: [15,30],
          descFn: function(t,r,q) { return '🏥 The apothecary in '+t.name+' has exhausted their supply of herbs fighting the plague. '+q+' '+r.name+' are needed.'; } },

        // ---- BLIGHT/DROUGHT ----
        { id: 'blight_wheat', category: 'blight', title: 'Seed Grain Needed', resources: ['wheat'], qtyRange: [20,60], timeRange: [20,40],
          descFn: function(t,r,q) { return '🌾 A crop blight has destroyed harvests in '+t.name+'. Farmers need '+q+' '+r.name+' for replanting.'; } },
        { id: 'blight_food', category: 'blight', title: 'Famine Relief', resources: ['bread','meat','eggs','fish','vegetables'], qtyRange: [12,40], timeRange: [20,40],
          descFn: function(t,r,q) { return '🌾 With crops ruined by blight, '+t.name+' faces famine. '+q+' '+r.name+' would help feed the starving populace.'; } },
        { id: 'drought_water', category: 'drought', title: 'Water for the Thirsty', resources: ['water'], qtyRange: [20,60], timeRange: [20,40],
          descFn: function(t,r,q) { return '☀️ Drought has parched '+t.name+'. Wells are running dry and '+q+' '+r.name+' would bring much-needed relief.'; } },
        { id: 'drought_provisions', category: 'drought', title: 'Drought Emergency Rations', resources: ['preserved_food','bread'], qtyRange: [10,30], timeRange: [20,40],
          descFn: function(t,r,q) { return '☀️ The drought in '+t.name+' has ruined crops and livestock are dying. '+q+' '+r.name+' are needed to prevent starvation.'; } },

        // ---- FESTIVAL/CELEBRATION ----
        { id: 'festival_ale', category: 'festival', title: 'Ale for the Festival', resources: ['ale','mead'], qtyRange: [8,30], timeRange: [15,30],
          descFn: function(t,r,q) { return '🎉 A festival is coming to '+t.name+'! The organizers need '+q+' barrels of '+r.name+' to keep the celebrations flowing.'; } },
        { id: 'festival_wine', category: 'festival', title: 'Wine for the Feast', resources: ['wine'], qtyRange: [5,18], timeRange: [15,30],
          descFn: function(t,r,q) { return '🎉 '+t.name+' is preparing a grand feast! '+q+' bottles of '+r.name+' are needed for the banquet tables.'; } },
        { id: 'festival_food', category: 'festival', title: 'Feast Provisions', resources: ['meat','bread','poultry','fish'], qtyRange: [10,35], timeRange: [15,30],
          descFn: function(t,r,q) { return '🎉 The upcoming festival in '+t.name+' needs food! Bring '+q+' '+r.name+' for the community feast.'; } },
        { id: 'festival_decorations', category: 'festival', title: 'Festival Decorations', resources: ['cloth','tapestry','silk'], qtyRange: [3,12], timeRange: [15,30],
          descFn: function(t,r,q) { return '🎉 '+t.name+' is decorating for their festival. They need '+q+' '+r.name+' to adorn the town square.'; } },
        { id: 'festival_instruments', category: 'music_festival', title: 'Instruments for Musicians', resources: ['drum','flute','lute','harp','hurdy_gurdy'], qtyRange: [2,6], timeRange: [15,30],
          descFn: function(t,r,q) { return '🎵 A music festival in '+t.name+' needs instruments! Supply '+q+' '+r.name+' so more musicians can join the celebration.'; } },
        { id: 'festival_luxury', category: 'festival', title: 'Gifts for Visiting Dignitaries', resources: ['jewelry','perfume','silk','fine_clothes','gold_goblet'], qtyRange: [2,6], timeRange: [20,35],
          descFn: function(t,r,q) { return '🎉 Visiting dignitaries are expected in '+t.name+'! The town needs '+q+' '+r.name+' as welcoming gifts.'; } },

        // ---- MARKET/ECONOMIC ----
        { id: 'price_crisis', category: 'economic', title: 'Price Crisis', resources: null, qtyRange: [8,30], timeRange: [20,40],
          descFn: function(t,r,q) { return '📈 The price of '+r.name+' in '+t.name+' has skyrocketed! Bring '+q+' '+r.name+' to help stabilize the market and ease the burden on residents.'; } },
        { id: 'shortage_response', category: 'economic', title: 'Market Shortage', resources: null, qtyRange: [10,35], timeRange: [20,40],
          descFn: function(t,r,q) { return '📦 '+t.name+'\'s market has completely run out of '+r.name+'! Bring '+q+' units to restock the shelves.'; } },
        { id: 'prosperity_drive', category: 'economic', title: 'Prosperity Drive', resources: ['jewelry','wine','silk','fine_clothes','perfume','tapestry'], qtyRange: [3,10], timeRange: [25,45],
          descFn: function(t,r,q) { return '💰 '+t.name+' is trying to attract wealthier residents. Bring '+q+' '+r.name+' to establish a luxury market.'; } },
        { id: 'guild_supply', category: 'economic', title: 'Guild Supply Request', resources: ['iron','planks','leather','cloth','rope','tools'], qtyRange: [6,20], timeRange: [20,40],
          descFn: function(t,r,q) { return '🏛️ The local guild in '+t.name+' has a large order to fill. They need '+q+' '+r.name+' and will pay handsomely.'; } },

        // ---- BUILDING/INFRASTRUCTURE ----
        { id: 'road_materials', category: 'infrastructure', title: 'Road Repair Materials', resources: ['stone','bricks'], qtyRange: [12,40], timeRange: [25,45],
          descFn: function(t,r,q) { return '🛤️ Roads near '+t.name+' have fallen into disrepair. '+q+' '+r.name+' are needed for restoration work.'; } },
        { id: 'building_materials', category: 'infrastructure', title: 'Materials for New Building', resources: ['planks','bricks','stone','iron'], qtyRange: [10,35], timeRange: [25,50],
          descFn: function(t,r,q) { return '🏗️ A new building is being constructed in '+t.name+' but work has stalled. '+q+' '+r.name+' are needed to continue.'; } },
        { id: 'wall_repair', category: 'infrastructure', title: 'Repair the Town Walls', resources: ['stone','bricks'], qtyRange: [15,50], timeRange: [25,50],
          descFn: function(t,r,q) { return '🧱 The walls of '+t.name+' have crumbled in places. '+q+' '+r.name+' are needed to shore up defenses.'; } },
        { id: 'dock_repair', category: 'port', title: 'Dock Repairs Needed', resources: ['planks','rope'], qtyRange: [8,25], timeRange: [20,40],
          descFn: function(t,r,q) { return '⚓ The docks in '+t.name+' are rotting and dangerous. '+q+' '+r.name+' are needed for urgent repairs.'; } },

        // ---- CULTURAL/SOCIAL ----
        { id: 'noble_gift', category: 'cultural', title: 'Gift for a Noble Visitor', resources: ['jewelry','gold_goblet','pearl_jewelry','wine','silk'], qtyRange: [1,4], timeRange: [15,30],
          descFn: function(t,r,q) { return '👑 A noble is visiting '+t.name+' and the town wishes to present a gift. They need '+q+' '+r.name+' of fine quality.'; } },
        { id: 'church_supplies', category: 'cultural', title: 'Supplies for the Temple', resources: ['honey','wine','herbs'], qtyRange: [5,18], timeRange: [20,40],
          descFn: function(t,r,q) { return '⛪ The local temple in '+t.name+' needs supplies for their ceremonies. '+q+' '+r.name+' would be greatly appreciated.'; } },
        { id: 'fine_clothing_ceremony', category: 'cultural', title: 'Finery for a Ceremony', resources: ['fine_clothes','silk','cloth'], qtyRange: [3,10], timeRange: [20,40],
          descFn: function(t,r,q) { return '👗 A grand ceremony is being planned in '+t.name+'. '+q+' units of '+r.name+' are needed for ceremonial garments.'; } },

        // ---- SEASONAL ----
        { id: 'winter_prep', category: 'seasonal', title: 'Winter Preparations', resources: ['wood','wool','preserved_food'], qtyRange: [10,35], timeRange: [20,40],
          descFn: function(t,r,q) { return '❄️ Winter approaches '+t.name+' and stockpiles are thin. '+q+' '+r.name+' would help the town survive the cold months.'; } },
        { id: 'harvest_celebration', category: 'seasonal', title: 'Harvest Festival Supplies', resources: ['wheat','vegetables','ale','bread'], qtyRange: [10,30], timeRange: [20,35],
          descFn: function(t,r,q) { return '🍂 '+t.name+' is celebrating the harvest! Bring '+q+' '+r.name+' for the festivities.'; } },
        { id: 'spring_planting', category: 'seasonal', title: 'Seeds for Spring', resources: ['wheat','herbs','hemp'], qtyRange: [12,40], timeRange: [20,40],
          descFn: function(t,r,q) { return '🌱 Spring has come to '+t.name+' and farmers need seed stock. '+q+' '+r.name+' would get the fields planted.'; } },
        { id: 'summer_fair', category: 'seasonal', title: 'Summer Fair Goods', resources: ['wine','jewelry','perfume','silk','fine_clothes'], qtyRange: [3,10], timeRange: [20,35],
          descFn: function(t,r,q) { return '☀️ '+t.name+' is hosting a summer fair! Merchants are seeking '+q+' '+r.name+' to sell at the event.'; } },

        // ---- PERFORMANCE (music quests) ----
        { id: 'concert_performance', category: 'performance', title: 'Town Concert', resources: null, qtyRange: [0,0], timeRange: [15,30], isPerformance: true,
          skillReq: { min: 26 },
          descFn: function(t,r,q) { return '🎵 The people of '+t.name+' are in need of entertainment! Perform a concert in the town square. You\'ll need a musical instrument and at least Competent skill level.'; } },
        { id: 'tavern_show', category: 'performance', title: 'Tavern Entertainment', resources: null, qtyRange: [0,0], timeRange: [15,25], isPerformance: true,
          skillReq: { min: 0 },
          descFn: function(t,r,q) { return '🎵 The tavernkeep in '+t.name+' is looking for a bard to liven up the evenings. Bring any instrument and play for the patrons!'; } },
        { id: 'noble_recital', category: 'performance', title: 'Recital for the Nobility', resources: null, qtyRange: [0,0], timeRange: [20,35], isPerformance: true,
          skillReq: { min: 51 },
          descFn: function(t,r,q) { return '🎵 A local noble in '+t.name+' desires a private musical recital. You\'ll need an instrument and Expert-level skill to impress.'; } },
        { id: 'festival_bard', category: 'performance', title: 'Festival Bard', resources: null, qtyRange: [0,0], timeRange: [15,25], isPerformance: true,
          skillReq: { min: 26 },
          descFn: function(t,r,q) { return '🎵 The festival in '+t.name+' needs a bard! Bring your instrument and perform for the crowds. Competent skill or better required.'; } },
    ];

    function generateTownQuests(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town) return;
        var rng = Engine.getRng();
        var day = Engine.getDay();

        if (!player.townQuests) player.townQuests = {};
        if (!player.townQuests[townId]) player.townQuests[townId] = { available: [], lastGenDay: 0 };
        var tq = player.townQuests[townId];

        // Don't regenerate too often — at most once per day
        if (tq.lastGenDay >= day) return;
        tq.lastGenDay = day;

        // Remove expired available quests (unclaimed quests expire after 7 days)
        tq.available = tq.available.filter(function(q) {
            return q.status === 'available' && (day - q.postedDay) < 7;
        });

        // Target 3-6 available quests per town (scale with town size)
        var pop = town.population || 50;
        var maxQuests = pop >= 300 ? 6 : pop >= 150 ? 5 : pop >= 60 ? 4 : 3;
        if (tq.available.length >= maxQuests) return;

        var needed = maxQuests - tq.available.length;

        // Gather context for quest selection
        var kingdom = town.kingdomId ? Engine.findKingdom(town.kingdomId) : null;
        var isAtWar = kingdom && kingdom.atWar && kingdom.atWar.size > 0;
        var season = Engine.getSeason ? Engine.getSeason() : 'Summer';
        var seasonLower = season.toLowerCase();
        var activeEvents = [];
        try {
            var w = Engine.getWorld();
            if (w && w.events) {
                activeEvents = w.events.filter(function(ev) { return ev.active && ev.townId === townId; });
            }
        } catch(e) {}
        var hasPlague = activeEvents.some(function(ev) { return ev.type === 'plague' || ev.type === 'plague_disaster'; });
        var hasBlight = activeEvents.some(function(ev) { return ev.type === 'blight'; });
        var hasDrought = activeEvents.some(function(ev) { return ev.type === 'drought'; });
        var hasFestival = activeEvents.some(function(ev) { return ev.type === 'trade_festival' || ev.type === 'festival' || ev.type === 'grand_festival'; });
        var hasMusicFestival = activeEvents.some(function(ev) { return ev.type === 'instrument_festival'; });
        var isPort = town.isPort || false;
        var lowProsperity = (town.prosperity || 50) < 35;

        // Find market shortages and price spikes
        var shortages = [];
        var priceSpikes = [];
        if (town.market) {
            var supply = town.market.supply || {};
            var prices = town.market.prices || {};
            for (var rid in RESOURCE_TYPES) {
                if (!RESOURCE_TYPES.hasOwnProperty(rid)) continue;
                var res = RESOURCE_TYPES[rid];
                // v9p33river333: tolerate malformed resource entries in modded/partial configs.
                if (!res || typeof res !== 'object' || !res.id) continue;
                var resId = String(res.id);
                if (res.category === 'livestock' || res.category === 'contraband' || res.category === 'quest' || res.category === 'supplies') continue;
                var s = supply[resId] || 0;
                var bp = Number(res.basePrice) || 1;
                var mp = prices[resId] || bp;
                if (s <= 0 && (town.market.demand || {})[resId] > 0) shortages.push(resId);
                if (mp > bp * 2.5) priceSpikes.push(resId);
            }
        }

        // Build weighted candidate pool
        var candidates = [];
        var existingTypes = {};
        for (var ei = 0; ei < tq.available.length; ei++) existingTypes[tq.available[ei].typeId] = true;
        // Also exclude types from active quests
        var activeQuests = player.activeQuests || [];
        for (var ai = 0; ai < activeQuests.length; ai++) {
            var _aq = activeQuests[ai];
            // v9p33river333: malformed active quests with missing townId should not allow same-type duplicates.
            if (_aq && _aq.typeId && (_aq.townId === townId || _aq.townId == null)) existingTypes[_aq.typeId] = true;
        }

        for (var qi = 0; qi < TOWN_QUEST_TYPES.length; qi++) {
            var qt = TOWN_QUEST_TYPES[qi];
            if (existingTypes[qt.id]) continue;

            var weight = 0;
            switch (qt.category) {
                case 'generic': weight = 10; break;
                case 'war': weight = isAtWar ? 25 : 0; break;
                case 'plague': weight = hasPlague ? 30 : 0; break;
                case 'blight': weight = hasBlight ? 30 : 0; break;
                case 'drought': weight = hasDrought ? 30 : 0; break;
                case 'festival': weight = hasFestival ? 25 : 0; break;
                case 'music_festival': weight = hasMusicFestival ? 25 : 0; break;
                case 'economic':
                    if (qt.id === 'price_crisis') weight = priceSpikes.length > 0 ? 20 : 0;
                    else if (qt.id === 'shortage_response') weight = shortages.length > 0 ? 20 : 0;
                    else if (qt.id === 'prosperity_drive') weight = lowProsperity ? 15 : 3;
                    else weight = 8;
                    break;
                case 'infrastructure': weight = 6; break;
                case 'port': weight = isPort ? 12 : 0; break;
                case 'cultural': weight = 5; break;
                case 'seasonal':
                    if (qt.id === 'winter_prep' && seasonLower === 'autumn') weight = 20;
                    else if (qt.id === 'harvest_celebration' && seasonLower === 'autumn') weight = 18;
                    else if (qt.id === 'spring_planting' && seasonLower === 'spring') weight = 18;
                    else if (qt.id === 'summer_fair' && seasonLower === 'summer') weight = 18;
                    else weight = 0;
                    break;
                case 'performance':
                    weight = hasMusicFestival ? 15 : hasFestival ? 10 : 4;
                    break;
                default: weight = 5;
            }

            if (weight > 0) candidates.push({ qt: qt, weight: weight });
        }

        // Select quests using weighted random
        for (var gi = 0; gi < needed && candidates.length > 0; gi++) {
            var totalWeight = 0;
            for (var wi = 0; wi < candidates.length; wi++) totalWeight += candidates[wi].weight;
            var roll = rng.random() * totalWeight;
            var chosen = null;
            var chosenIdx = -1;
            var acc = 0;
            for (var ci = 0; ci < candidates.length; ci++) {
                acc += candidates[ci].weight;
                if (roll <= acc) { chosen = candidates[ci]; chosenIdx = ci; break; }
            }
            if (!chosen) break;
            candidates.splice(chosenIdx, 1);

            var quest = createQuestFromType(chosen.qt, town, rng, day, shortages, priceSpikes);
            if (quest) tq.available.push(quest);
        }
    }

    function createQuestFromType(qt, town, rng, day, shortages, priceSpikes) {
        var resource = null;
        var quantity = 0;

        if (qt.isPerformance) {
            // Performance quests don't need resources
            var timeLimit = rng.randInt(qt.timeRange[0], qt.timeRange[1]);
            var perfDifficulty = qt.skillReq ? Math.ceil(qt.skillReq.min / 25) + 1 : 1;
            perfDifficulty = Math.max(1, Math.min(10, perfDifficulty));
            var perfSmallBoost = Math.ceil(perfDifficulty / 2);
            var perfRelMin = Math.max(2, perfDifficulty);
            var perfRelMax = Math.min(20, perfDifficulty * 3);

            return {
                id: 'tq_' + (_nextQuestId++),
                typeId: qt.id,
                townId: town.id,
                title: qt.title,
                description: qt.descFn(town, {name:''}, 0),
                resource: null,
                quantity: 0,
                difficulty: perfDifficulty,
                timeLimit: timeLimit,
                postedDay: day,
                acceptedDay: null,
                expiresDay: null,
                smallRepBoost: perfSmallBoost,
                bigRepBoost: perfSmallBoost * 4,
                relGainMin: perfRelMin,
                relGainMax: perfRelMax,
                isPerformance: true,
                skillReq: qt.skillReq || { min: 0 },
                status: 'available',
                category: qt.category,
                reason: _getQuestReason(qt, town)
            };
        }

        // Determine resource
        var resPool = qt.resources;
        if (qt.id === 'price_crisis' && priceSpikes.length > 0) {
            resPool = priceSpikes;
        } else if (qt.id === 'shortage_response' && shortages.length > 0) {
            resPool = shortages;
        }
        if (!resPool || resPool.length === 0) return null;

        var resId = resPool[rng.randInt(0, resPool.length - 1)];
        var resObj = null;
        var _resKey = String(resId).toUpperCase();
        if (RESOURCE_TYPES[_resKey] && RESOURCE_TYPES[_resKey].id === resId) resObj = RESOURCE_TYPES[_resKey];
        for (var rk in RESOURCE_TYPES) {
            if (!resObj && RESOURCE_TYPES[rk] && RESOURCE_TYPES[rk].id === resId) { resObj = RESOURCE_TYPES[rk]; break; }
        }
        if (!resObj) return null; // v9p33river333: prefer canonical key when duplicate resource IDs exist.

        // Determine quantity (scale with town pop)
        var popScale = Math.max(0.5, Math.min(2.0, (town.population || 100) / 200));
        var minQty = Math.max(1, Math.round(qt.qtyRange[0] * popScale));
        var maxQty = Math.max(minQty, Math.round(qt.qtyRange[1] * popScale));
        quantity = rng.randInt(minQty, maxQty);

        // Calculate difficulty based on total cost
        var totalCost = quantity * (resObj.basePrice || 1);
        var difficulty;
        if (totalCost < 50) difficulty = rng.randInt(1, 2);
        else if (totalCost < 200) difficulty = rng.randInt(2, 4);
        else if (totalCost < 500) difficulty = rng.randInt(4, 6);
        else if (totalCost < 1000) difficulty = rng.randInt(6, 8);
        else difficulty = rng.randInt(8, 10);

        var smallRepBoost = Math.max(1, Math.ceil(difficulty / 2));
        var bigRepBoost = smallRepBoost * 4;
        var timeLimit = rng.randInt(qt.timeRange[0], qt.timeRange[1]);
        // More difficult quests get extra time
        if (difficulty >= 6) timeLimit = Math.round(timeLimit * 1.3);
        if (difficulty >= 8) timeLimit = Math.round(timeLimit * 1.2);

        var relGainMin = Math.max(3, Math.floor(difficulty * 1.5));
        var relGainMax = Math.min(30, Math.ceil(difficulty * 4));

        var description = qt.descFn(town, resObj, quantity);
        var reason = _getQuestReason(qt, town);

        // Check if resource is already in local market — donate only, easier quest
        var donateOnly = false;
        if (town && town.market && town.market.supply && (town.market.supply[resId] || 0) >= quantity) {
            donateOnly = true;
            var marketValue = quantity * (town.market.prices && town.market.prices[resId] ? town.market.prices[resId] : (resObj.basePrice || 1));
            difficulty = marketValue > 1000 ? 2 : 1;
            smallRepBoost = Math.max(1, Math.ceil(difficulty / 2));
            bigRepBoost = smallRepBoost * 4;
            relGainMin = Math.max(3, Math.floor(difficulty * 1.5));
            relGainMax = Math.min(30, Math.ceil(difficulty * 4));
        }

        return {
            id: 'tq_' + (_nextQuestId++),
            typeId: qt.id,
            townId: town.id,
            title: qt.title,
            description: description,
            resource: resId,
            quantity: quantity,
            difficulty: difficulty,
            timeLimit: timeLimit,
            postedDay: day,
            acceptedDay: null,
            expiresDay: null,
            smallRepBoost: smallRepBoost,
            bigRepBoost: bigRepBoost,
            relGainMin: relGainMin,
            relGainMax: relGainMax,
            isPerformance: false,
            donateOnly: donateOnly,
            skillReq: null,
            status: 'available',
            category: qt.category,
            reason: reason
        };
    }

    function _getQuestReason(qt, town) {
        switch (qt.category) {
            case 'war': return 'The kingdom is at war and ' + town.name + ' needs support.';
            case 'plague': return 'A plague is ravaging ' + town.name + '.';
            case 'blight': return 'A crop blight has struck the farms around ' + town.name + '.';
            case 'drought': return 'A drought has dried up water sources near ' + town.name + '.';
            case 'festival': case 'music_festival': return 'A festival is being held in ' + town.name + '.';
            case 'seasonal': return 'Seasonal needs in ' + town.name + '.';
            case 'port': return town.name + ' is a port town with maritime needs.';
            case 'economic':
                if (qt.id === 'price_crisis') return 'Market prices have spiked in ' + town.name + '.';
                if (qt.id === 'shortage_response') return 'A market shortage has hit ' + town.name + '.';
                if (qt.id === 'prosperity_drive') return town.name + '\'s prosperity is declining.';
                return 'Economic opportunity in ' + town.name + '.';
            default: return null;
        }
    }

    function acceptTownQuest(questId) {
        _sync();
        if (!player.townQuests) player.townQuests = {};
        if (!player.activeQuests) player.activeQuests = [];

        // Max 5 active quests
        if (player.activeQuests.length >= 5) {
            return { success: false, message: 'You can only have 5 active quests at a time. Complete or abandon one first.' };
        }

        // Check if already accepted
        for (var _aci = 0; _aci < player.activeQuests.length; _aci++) {
            if (player.activeQuests[_aci].id === questId) {
                return { success: false, message: 'You have already accepted this quest!' };
            }
        }

        // Find the quest in available pools
        var found = null;
        var foundTownId = null;
        for (var tid in player.townQuests) {
            if (!player.townQuests.hasOwnProperty(tid)) continue;
            var tqObj = player.townQuests[tid];
            if (!tqObj || !tqObj.available) continue;
            var avail = tqObj.available;
            for (var i = 0; i < avail.length; i++) {
                if (avail[i].id === questId) {
                    found = avail[i];
                    foundTownId = tid;
                    break;
                }
            }
            if (found) break;
        }
        if (!found) {
            console.warn('[QuestBug] acceptTownQuest failed for', questId, 'townQuests keys:', Object.keys(player.townQuests), 'activeQuests:', player.activeQuests.map(function(q) { return q.id; }));
            // v9p33river333: not-found can also mean another handler accepted/removed it.
            return { success: false, message: 'Quest not found — it may have expired, been accepted, or been removed. Try refreshing the quest panel.' };
        }

        var day = Engine.getDay();
        found.status = 'accepted';
        found.acceptedDay = day;
        found.expiresDay = day + found.timeLimit;

        // Move from available to active
        player.townQuests[foundTownId].available = player.townQuests[foundTownId].available.filter(function(q) { return q.id !== questId; });
        player.activeQuests.push(found);

        Engine.logEvent('📋 Accepted town quest: ' + found.title + ' in ' + (Engine.findTown(foundTownId) || {}).name);
        // Story mode: track quest accept
        if (player.storyMode) {
            player.storyMode._acceptedTownQuest = true;
        }
        return { success: true, message: 'Quest accepted! You have ' + found.timeLimit + ' days to complete it.', quest: found };
    }

    function completeTownQuest(questId, donate) {
        _sync();
        if (!player.activeQuests) return { success: false, message: 'No active quests.' };
        // v9p33river363: reject if traveling or not in quest town
        if (player.traveling) return { success: false, message: 'Cannot complete quests while traveling.' };
        var idx = -1;
        for (var i = 0; i < player.activeQuests.length; i++) {
            if (player.activeQuests[i].id === questId) { idx = i; break; }
        }
        if (idx === -1) return { success: false, message: 'Quest not found in active quests.' };

        var quest = player.activeQuests[idx];
        if (quest.townId && player.townId !== quest.townId) return { success: false, message: 'You must be in the quest town to turn this in.' };
        var town = null;
        try { town = Engine.findTown(quest.townId); } catch(e) { town = null; }
        if (!town) return { success: false, message: 'Quest town no longer exists; cannot complete this quest.' }; // v9p33river333: missing towns made rewards inconsistent.
        var rng = Engine.getRng();
        var day = Engine.getDay();
        if (!player.inventory) player.inventory = {}; // v9p33river333: old saves may lack inventory/townStorage containers.
        if (!player.townStorage) player.townStorage = {};

        // Force donate if quest is donate-only (item was in market when posted)
        if (quest.donateOnly && (!town.market || !town.market.supply || (town.market.supply[quest.resource] || 0) < quest.quantity)) {
            quest.donateOnly = false; // v9p33river333: market supply can change after posting; don't keep stale donate-only state.
        }
        if (quest.donateOnly) donate = true;

        // Check if expired
        if (quest.expiresDay && day > quest.expiresDay) {
            return { success: false, message: 'This quest has expired!' };
        }

        if (quest.isPerformance) {
            // Performance quest: check instrument and skill
            // v9p33river305: previously iterated only player.instrumentSkill —
            // owning an instrument with no skill entry yet (skill 0) could
            // never satisfy even min-0 quests. Iterate the instrument types
            // the player actually holds and treat missing skill as 0.
            var bestInst = null;
            var bestSkill = 0;
            var instSkill = player.instrumentSkill || {};
            // v9p33river310: real instruments are drum/flute/lute/
            // hurdy_gurdy/harp (config.js:5126-5133, exported as the
            // top-level INSTRUMENT_IDS const). The previous CONFIG.
            // INSTRUMENT_TYPES lookup didn't exist, so the fallback list
            // was always used — and it omitted hurdy_gurdy while listing
            // nonexistent 'fiddle' and 'bagpipe'.
            var _instTypes = (typeof INSTRUMENT_IDS !== 'undefined') ? INSTRUMENT_IDS : ['drum','flute','lute','hurdy_gurdy','harp'];
            var _minSkill = quest.skillReq ? quest.skillReq.min : 0;
            for (var _qiIdx = 0; _qiIdx < _instTypes.length; _qiIdx++) {
                var iid = _instTypes[_qiIdx];
                var _questTownStore = (player.townStorage && player.townStorage[player.townId]) || {}; // v9p33river329: townStorage can be absent on old/new players.
                var qty = (player.inventory[iid] || 0) + (_questTownStore[iid] || 0);
                if (qty <= 0) continue;
                var _curSkill = instSkill[iid] || 0;
                if (_curSkill >= _minSkill && _curSkill >= bestSkill) {
                    bestSkill = _curSkill;
                    bestInst = iid;
                }
            }
            if (!bestInst) {
                return { success: false, message: 'You need a musical instrument in your inventory and sufficient skill level (' + _minSkill + '+) to complete this quest.' };
            }

            // Advance time for performance
            if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(5);
        } else {
            // Resource quest: check inventory + town storage
            var questQty = Math.max(0, Math.floor(Number(quest.quantity) || 0));
            var questRes = quest.resource != null ? String(quest.resource) : '';
            if (!questRes || questQty <= 0) return { success: false, message: 'Quest requirements are malformed.' };
            var townStore = player.townStorage[quest.townId] || {};
            var invQty = Math.max(0, Number(player.inventory[questRes]) || 0);
            var tsQty = Math.max(0, Number(townStore[questRes]) || 0);
            var totalAvail = invQty + tsQty;

            if (totalAvail < questQty) {
                return { success: false, message: 'You need ' + questQty + ' ' + questRes + ' but only have ' + totalAvail + '. Check your inventory and town storage.' };
            }

            // Remove resources: prioritize town storage, then inventory
            var remaining = questQty;
            if (tsQty > 0 && remaining > 0) {
                var fromTs = Math.min(tsQty, remaining);
                if (!player.townStorage[quest.townId]) player.townStorage[quest.townId] = {};
                var curTs = Math.max(0, Number(player.townStorage[quest.townId][questRes]) || 0);
                player.townStorage[quest.townId][questRes] = Math.max(0, curTs - fromTs);
                if (player.townStorage[quest.townId][questRes] <= 0) delete player.townStorage[quest.townId][questRes];
                remaining -= fromTs;
            }
            if (remaining > 0) {
                // v9p33river333: sanitize quantity/resource so mutated quests cannot underflow/delete a wrong key.
                var curInv = Math.max(0, Number(player.inventory[questRes]) || 0);
                player.inventory[questRes] = Math.max(0, curInv - remaining);
                if (player.inventory[questRes] <= 0) delete player.inventory[questRes];
            }
        }

        // Calculate rewards
        var repBoost = donate ? quest.bigRepBoost : quest.smallRepBoost;
        var goldReward = 0;

        if (!donate && !quest.isPerformance) {
            // Sell at market price
            var resObj = null;
            for (var rk in RESOURCE_TYPES) { if (RESOURCE_TYPES[rk].id === quest.resource) { resObj = RESOURCE_TYPES[rk]; break; } }
            var marketPrice = resObj ? resObj.basePrice : 5;
            if (town && town.market && town.market.prices && town.market.prices[quest.resource]) {
                marketPrice = town.market.prices[quest.resource];
            }
            goldReward = Math.floor((Number(quest.quantity) || 0) * marketPrice);
            player.gold += goldReward;
        }

        // Apply town reputation boost
        Player.modifyTownReputation(quest.townId, repBoost);

        // Apply 1/8 kingdom reputation boost (town quests primarily boost town standing)
        if (town && town.kingdomId) {
            if (!player.reputation) player.reputation = {}; // v9p33river333: don't silently skip kingdom rep on old saves.
            var kingdomRepBoost = repBoost / 8;
            player.reputation[town.kingdomId] = Math.max(0, Math.min(100, (player.reputation[town.kingdomId] || 50) + kingdomRepBoost));
        }

        // Boost relationships with random NPCs in town
        var _relMin = Math.max(0, Math.floor(Number(quest.relGainMin) || 0));
        var _relMax = Math.max(_relMin, Math.floor(Number(quest.relGainMax) || _relMin));
        var relCount = rng.randInt(_relMin, _relMax); // v9p33river333: malformed ranges should not produce NaN.
        var townPeople = [];
        try {
            var w = Engine.getWorld();
            if (w && w.people) {
                townPeople = w.people.filter(function(p) { return p.alive && p.townId === quest.townId; });
            }
        } catch(e) {}
        // Shuffle and pick
        var shuffled = townPeople.slice();
        for (var si = shuffled.length - 1; si > 0; si--) {
            var sj = rng.randInt(0, si);
            var tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
        }
        var relBoostAmount = donate ? 8 : 4;
        var boosted = 0;
        for (var ri = 0; ri < Math.min(relCount, shuffled.length); ri++) {
            Player.modifyRelationship(shuffled[ri].id, relBoostAmount);
            boosted++;
        }

        // Remove from active
        player.activeQuests.splice(idx, 1);

        // Track completed
        if (!player.completedQuestCount) player.completedQuestCount = 0;
        player.completedQuestCount++;

        var resultMsg;
        if (quest.isPerformance) {
            if (donate) {
                resultMsg = '🎵 Your performance delighted the people of ' + (town ? town.name : 'the town') + '! Town reputation +' + repBoost + '. ' + boosted + ' people now think more highly of you.';
            } else {
                resultMsg = '🎵 You performed well in ' + (town ? town.name : 'the town') + '! Town reputation +' + repBoost + '. ' + boosted + ' people appreciated the show.';
            }
        } else if (donate) {
            resultMsg = '🎁 You generously donated ' + quest.quantity + ' ' + quest.resource + ' to ' + (town ? town.name : 'the town') + '! Town reputation +' + repBoost + '. ' + boosted + ' grateful residents think better of you.';
        } else {
            resultMsg = '💰 You sold ' + quest.quantity + ' ' + quest.resource + ' to ' + (town ? town.name : 'the town') + ' for ' + goldReward + 'g. Town reputation +' + repBoost + '. ' + boosted + ' residents noticed your help.';
        }

        Engine.logEvent('✅ Completed quest: ' + quest.title + (donate ? ' (donated)' : ' (sold)'));
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(resultMsg, 'success', 'critical');
        // Story mode: track quest completion
        if (player.storyMode) {
            player.storyMode._completedTownQuest = true;
        }

        return { success: true, message: resultMsg, goldReward: goldReward, repBoost: repBoost, boosted: boosted };
    }

    function _applyQuestFailurePenalty(quest, reason) {
        // Lose half the expected rep for this quest path.
        var _penaltyBase = quest && quest.donateOnly ? (quest.bigRepBoost || quest.smallRepBoost || 2) : (quest.smallRepBoost || quest.bigRepBoost || 2);
        var repPenalty = Math.ceil((Number(_penaltyBase) || 2) / 2); // v9p33river333: balance donate/non-donate penalties from actual reward path.
        Player.modifyTownReputation(quest.townId, -repPenalty);

        // Lose 1/4 kingdom reputation (mirrors the 1/4 kingdom rep bonus from completing)
        var town = Engine.findTown(quest.townId);
        if (town && town.kingdomId && player.reputation) {
            var kingdomRepPenalty = Math.ceil(repPenalty / 4);
            player.reputation[town.kingdomId] = Math.max(0, (player.reputation[town.kingdomId] || 50) - kingdomRepPenalty);
        }

        // Negative relationship with NPCs you would've helped
        var rng = Engine.getRng();
        var _failRelMin = Math.max(0, Math.floor(Number(quest.relGainMin) || 2));
        var _failRelMax = Math.max(_failRelMin, Math.floor(Number(quest.relGainMax) || 5));
        var relCount = rng.randInt(_failRelMin, _failRelMax);
        var townPeople = [];
        try {
            var w = Engine.getWorld();
            if (w && w.people) {
                townPeople = w.people.filter(function(p) { return p.alive && p.townId === quest.townId; });
            }
        } catch(e) {}
        var shuffled = townPeople.slice();
        for (var si = shuffled.length - 1; si > 0; si--) {
            var sj = rng.randInt(0, si);
            var tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
        }
        for (var ri = 0; ri < Math.min(relCount, shuffled.length); ri++) {
            Player.modifyRelationship(shuffled[ri].id, -2);
        }
    }

    function abandonTownQuest(questId) {
        _sync();
        if (!player.activeQuests) return { success: false, message: 'No active quests.' };
        var idx = -1;
        for (var i = 0; i < player.activeQuests.length; i++) {
            if (player.activeQuests[i].id === questId) { idx = i; break; }
        }
        if (idx === -1) return { success: false, message: 'Quest not found.' };

        var quest = player.activeQuests[idx];
        player.activeQuests.splice(idx, 1);

        _applyQuestFailurePenalty(quest, 'abandoned');

        Engine.logEvent('❌ Abandoned quest: ' + quest.title);
        var repLoss = Math.ceil((quest.bigRepBoost || 2) / 2);
        return { success: true, message: 'Quest abandoned. (-' + repLoss + ' town rep, -' + Math.ceil(repLoss / 4) + ' kingdom rep)' };
    }

    function tickTownQuests() {
        _sync();
        var day = Engine.getDay();
        if (!player.activeQuests) player.activeQuests = [];

        // Check for expired active quests
        var expiredQuests = [];
        for (var i = player.activeQuests.length - 1; i >= 0; i--) {
            var q = player.activeQuests[i];
            if (q && q.expiresDay && day > q.expiresDay) {
                expiredQuests.push(q);
                player.activeQuests.splice(i, 1);
            }
        }
        // v9p33river333: remove all expired quests first so failure side effects cannot disturb iteration.
        for (var _eqi = 0; _eqi < expiredQuests.length; _eqi++) {
            var _eq = expiredQuests[_eqi];
            var town = Engine.findTown(_eq.townId);
            var townName = town ? town.name : 'the town';
            _applyQuestFailurePenalty(_eq, 'expired');
            var _expBase = _eq.donateOnly ? (_eq.bigRepBoost || _eq.smallRepBoost || 2) : (_eq.smallRepBoost || _eq.bigRepBoost || 2);
            var _expRepLoss = Math.ceil((Number(_expBase) || 2) / 2);
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('⏰ Quest expired: ' + _eq.title + ' in ' + townName + ' (-' + _expRepLoss + ' rep)', 'warning');
            Engine.logEvent('⏰ Quest expired: ' + _eq.title + ' in ' + townName);
        }

        // Generate quests for current town
        if (player.townId && !player.traveling) {
            generateTownQuests(player.townId);
        }
    }

    function getTownQuestsForTown(townId) {
        _sync();
        if (!player.townQuests || !player.townQuests[townId]) return [];
        return player.townQuests[townId].available.filter(function(q) { return q.status === 'available'; });
    }

    function getActiveQuests() {
        _sync();
        return player.activeQuests || [];
    }

    function getCompletedQuestCount() {
        _sync();
        return player.completedQuestCount || 0;
    }

    // ============================================================
    // Kingdom Quests System
    // ============================================================

    function _getPlayerNobleRank() {
        var maxRank = 0;
        if (player.socialRank) {
            for (var k in player.socialRank) {
                if ((player.socialRank[k] || 0) > maxRank) maxRank = player.socialRank[k];
            }
        }
        return maxRank;
    }

    function _getPlayerKingdomId() {
        // v9p33river333: prefer explicit current allegiance over stale highest-rank data.
        if (player.isKing && player.kingState && player.kingState.kingdomId) return player.kingState.kingdomId;
        var citizenKingdomId = player.citizenshipKingdomId || '';
        if (citizenKingdomId) return citizenKingdomId;
        var maxRank = 0;
        var rankedKingdomId = '';
        if (player.socialRank) {
            for (var k in player.socialRank) {
                if ((player.socialRank[k] || 0) > maxRank) {
                    maxRank = player.socialRank[k];
                    rankedKingdomId = k;
                }
            }
        }
        return rankedKingdomId;
    }

    function _evaluateKingdomTriggers(kingdom) {
        var triggers = {};
        if (!kingdom) return triggers;
        var rng = Engine.getRng();
        var day = Engine.getDay();

        // War state
        var atWar = kingdom.atWar && (kingdom.atWar.size > 0 || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        triggers.war_active = atWar;
        if (atWar) {
            var warExh = kingdom.warExhaustion || 0;
            triggers.war_losing = warExh > 50;
            triggers.war_desperate = warExh > 75;
        }
        // Check recent war end
        var activeWars = [];
        try { activeWars = Engine.getActiveWars ? Engine.getActiveWars() : []; } catch(e) {}
        var recentPeace = false;
        if (!atWar && kingdom._lastWarEndDay && (day - kingdom._lastWarEndDay) < 60) recentPeace = true;
        triggers.war_ended = recentPeace;
        triggers.war_won = recentPeace && (kingdom._lastWarResult === 'won');
        triggers.war_exhausted = atWar && (kingdom.warExhaustion || 0) > 40;
        triggers.war_ending = atWar && (kingdom.warExhaustion || 0) > 60;
        triggers.war_threat = !atWar && _hasHostileNeighbor(kingdom);

        // Economy
        triggers.low_treasury = (kingdom.gold || 0) < 5000;
        triggers.low_prosperity = (kingdom.prosperity || 50) < 30;
        triggers.high_prosperity = (kingdom.prosperity || 50) > 70;
        triggers.low_happiness = (kingdom.happiness || 50) < 30;
        triggers.low_stability = (kingdom.stability || 50) < 30;
        triggers.unrest = (kingdom.unrest || 0) > 30;

        // Plague
        var towns = [];
        try {
            var w = Engine.getWorld();
            if (w && w.towns) towns = w.towns.filter(function(t) { return t.kingdomId === kingdom.id; });
        } catch(e) {}
        var plagueCount = 0;
        var foodShortage = false;
        for (var ti = 0; ti < towns.length; ti++) {
            if (towns[ti].plagueActive) plagueCount++;
            // v9p33river289: towns store goods under town.market.supply, not
            // town.marketSupply (which never existed). Old check never matched
            // a real shortage, so food-shortage royal directives never fired.
            var _mSup = towns[ti].market && towns[ti].market.supply;
            if (towns[ti].foodShortage || (_mSup && (_mSup.wheat || 0) < 10 && (_mSup.bread || 0) < 10)) foodShortage = true;
        }
        triggers.plague_active = plagueCount > 0;
        triggers.food_shortage = foodShortage;
        triggers.goods_shortage = foodShortage; // simplified

        // Diplomatic
        triggers.hostile_neighbor = _hasHostileNeighbor(kingdom);
        triggers.poor_relations = _hasPoorRelations(kingdom);
        triggers.neutral_relations = true; // always possible
        triggers.alliance_opportunity = _hasAllianceOpportunity(kingdom);
        triggers.embargo_active = _hasEmbargo(kingdom);
        triggers.poor_trade = triggers.low_prosperity;
        triggers.diplomatic_trade = !atWar;

        // King personality derived
        var kp = kingdom.kingPersonality || {};
        triggers.corrupt_king = kp.justice === 'corrupt' || kp.greed === 'corrupt';

        // General
        triggers.normal = true;
        triggers.disaster_recent = _hasRecentDisaster(kingdom, day);
        triggers.fire_recent = triggers.disaster_recent;
        triggers.infrastructure_damaged = triggers.disaster_recent;
        triggers.crime_wave = (kingdom.unrest || 0) > 20;
        triggers.high_crime = triggers.crime_wave;
        triggers.criminal_at_large = rng.chance(0.3);
        triggers.serious_criminal = rng.chance(0.15);
        triggers.banned_goods_detected = rng.chance(0.25);
        triggers.smuggling_detected = rng.chance(0.2);
        triggers.corruption_detected = rng.chance(0.2);
        triggers.corruption_suspected = rng.chance(0.15);
        triggers.corruption_exposed = triggers.corrupt_king && rng.chance(0.1);
        triggers.noble_dispute = rng.chance(0.25);
        triggers.noble_conflict = triggers.noble_dispute;
        triggers.noble_charged = rng.chance(0.1);
        triggers.noble_rivalry = rng.chance(0.2);
        triggers.vote_pending = rng.chance(0.15);
        triggers.trial_pending = rng.chance(0.1);
        triggers.bandit_activity = rng.chance(0.2);
        triggers.border_dispute = triggers.hostile_neighbor && rng.chance(0.2);
        triggers.price_spike = triggers.low_prosperity || rng.chance(0.1);
        triggers.towns_unconnected = rng.chance(0.1);
        triggers.coastal_town = rng.chance(0.3);
        triggers.drought = rng.chance(0.1);
        triggers.unmarried_nobles = rng.chance(0.2);
        triggers.heir_exists = rng.chance(0.4);
        triggers.king_old = rng.chance(0.15);

        return triggers;
    }

    function _hasHostileNeighbor(kingdom) {
        if (!kingdom.diplomaticRelations) return false;
        for (var kid in kingdom.diplomaticRelations) {
            if ((kingdom.diplomaticRelations[kid] || 0) < -30) return true;
        }
        return false;
    }

    function _hasPoorRelations(kingdom) {
        if (!kingdom.diplomaticRelations) return false;
        for (var kid in kingdom.diplomaticRelations) {
            if ((kingdom.diplomaticRelations[kid] || 0) < -10) return true;
        }
        return false;
    }

    function _hasAllianceOpportunity(kingdom) {
        if (!kingdom.diplomaticRelations) return false;
        for (var kid in kingdom.diplomaticRelations) {
            if ((kingdom.diplomaticRelations[kid] || 0) > 60) return true;
        }
        return false;
    }

    function _hasEmbargo(kingdom) {
        // Simplified check: if at war, embargoes likely exist
        var atWar = kingdom.atWar && (kingdom.atWar.size > 0 || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        return atWar;
    }

    function _hasRecentDisaster(kingdom, day) {
        try {
            var w = Engine.getWorld();
            var towns = w && w.towns ? w.towns.filter(function(t) { return t.kingdomId === kingdom.id; }) : [];
            for (var i = 0; i < towns.length; i++) {
                var t = towns[i];
                if (t.lastDisasterDay && (day - t.lastDisasterDay) < 60) return true;
                if (t.plagueActive) return true;
            }
        } catch(e) {}
        return false;
    }

    function _getPersonalityWeight(kp, traitReq) {
        // traitReq like 'militarism_high', 'justice_corrupt', 'temperament_kind'
        var parts = traitReq.split('_');
        var trait = parts[0];
        var val = parts.slice(1).join('_');
        if (!kp || !kp[trait]) return 0.5;

        var traitVal = kp[trait];
        // Map high/low to specific values
        if (val === 'high') {
            var highVals = {
                militarism: ['warlike','aggressive'], ambition: ['ambitious'], courage: ['brave'],
                intelligence: ['brilliant','clever'], greed: ['greedy','corrupt'],
                temperament: ['stern','cruel'], tradition: ['traditional']
            };
            return (highVals[trait] && highVals[trait].indexOf(traitVal) >= 0) ? 2.0 : 0.5;
        }
        if (val === 'low') {
            var lowVals = {
                greed: ['generous','fair'], militarism: ['peaceful','defensive'],
                temperament: ['kind','fair'], ambition: ['content','lazy']
            };
            return (lowVals[trait] && lowVals[trait].indexOf(traitVal) >= 0) ? 2.0 : 0.5;
        }
        // Exact match (e.g. 'justice_corrupt', 'temperament_kind')
        return traitVal === val ? 2.5 : 0.3;
    }

    function _kqRandRange(rng, arr) {
        if (!arr || !Array.isArray(arr) || arr.length < 2) {
            var n = Number(arr);
            return isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        }
        var min = Number(arr[0]);
        var max = Number(arr[1]);
        if (!isFinite(min) || !isFinite(max)) return 0;
        min = Math.max(0, Math.floor(min));
        max = Math.max(0, Math.floor(max));
        if (max < min) { var tmp = min; min = max; max = tmp; }
        return (rng && rng.randInt) ? rng.randInt(min, max) : min; // v9p33river333: malformed ranges should not create impossible quest requirements.
    }

    function generateKingdomQuests(kingdomId) {
        _sync();
        if (!kingdomId) return;
        var day = Engine.getDay();
        var rng = Engine.getRng();

        if (!player.kingdomQuests) player.kingdomQuests = {};
        if (!player.kingdomQuests[kingdomId]) {
            player.kingdomQuests[kingdomId] = { available: [], active: [], completed: [], lastGenDay: 0, personalAssignment: null };
        }
        var kqData = player.kingdomQuests[kingdomId];
        var playerRank = _getPlayerNobleRank();
        if (playerRank < 4) {
            // v9p33river333: demoted players should not keep stale visible royal directives.
            kqData.available = [];
            kqData.personalAssignment = null;
            return;
        }

        // Generate every 15 days in war, 30 days in peace
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom) return;

        var atWar = kingdom.atWar && (kingdom.atWar.size > 0 || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        var genInterval = atWar ? 15 : 30;
        if (kqData.lastGenDay > 0 && (day - kqData.lastGenDay) < genInterval) return;

        kqData.lastGenDay = day;
        var kp = kingdom.kingPersonality || {};
        var mood = (kingdom.kingMood && kingdom.kingMood.current) ? kingdom.kingMood.current : 'content';
        var moodCfg = CONFIG.KING_MOOD || {};
        var moodCatWeights = (moodCfg.questCatWeights && moodCfg.questCatWeights[mood]) || {};
        var moodUrgencyBias = (moodCfg.urgencyBias && moodCfg.urgencyBias[mood]) || 0;

        // Evaluate kingdom state triggers
        var triggers = _evaluateKingdomTriggers(kingdom);

        // Get pool
        if (typeof KINGDOM_QUEST_POOL === 'undefined') return;
        var pool = KINGDOM_QUEST_POOL;

        // Recently completed typeIds (cooldown 60 days)
        var recentTypeIds = {};
        for (var ci = 0; ci < kqData.completed.length; ci++) {
            var cq = kqData.completed[ci];
            if (cq.completedDay && (day - cq.completedDay) < 60) {
                recentTypeIds[cq.typeId] = true;
            }
        }
        // Also exclude currently active typeIds
        for (var ai = 0; ai < kqData.active.length; ai++) {
            recentTypeIds[kqData.active[ai].typeId] = true;
        }

        // Score each quest type
        var candidates = [];
        for (var typeId in pool) {
            var qt = pool[typeId];
            if (qt.rank > playerRank) continue;
            if (recentTypeIds[typeId]) continue;

            // Check at least one trigger matches
            var triggerMatch = false;
            for (var tri = 0; tri < (qt.triggers || []).length; tri++) {
                if (triggers[qt.triggers[tri]]) { triggerMatch = true; break; }
            }
            if (!triggerMatch) continue;

            // Corrupt quests only for corrupt kings
            if (qt.cat === 'corrupt' && !triggers.corrupt_king) continue;

            // Calculate weight
            var weight = 1.0;
            var persTraits = qt.personality || [];
            for (var pi = 0; pi < persTraits.length; pi++) {
                weight *= _getPersonalityWeight(kp, persTraits[pi]);
            }

            // State urgency multiplier
            if (qt.urgency === 'critical') weight *= 3.0;
            else if (qt.urgency === 'high') weight *= 2.0;
            else if (qt.urgency === 'low') weight *= 0.5;

            // King mood favors certain quest categories
            var catMoodW = moodCatWeights[qt.cat] || 1.0;
            weight *= catMoodW;

            candidates.push({ typeId: typeId, qt: qt, weight: Math.max(0.1, weight) });
        }

        // Pick 3-5 quests based on rank
        var questCount = playerRank >= 6 ? 5 : playerRank >= 5 ? 4 : 3;
        questCount = Math.min(questCount, candidates.length);

        // Weighted random selection
        var selected = [];
        var remaining = candidates.slice();
        for (var si = 0; si < questCount && remaining.length > 0; si++) {
            var totalWeight = 0;
            for (var wi = 0; wi < remaining.length; wi++) totalWeight += remaining[wi].weight;
            var roll = rng.random() * totalWeight;
            var cumulative = 0;
            for (var ri = 0; ri < remaining.length; ri++) {
                cumulative += remaining[ri].weight;
                if (roll <= cumulative) {
                    selected.push(remaining[ri]);
                    remaining.splice(ri, 1);
                    break;
                }
            }
        }

        // Build quest objects
        kqData.available = [];
        for (var qi = 0; qi < selected.length; qi++) {
            var sel = selected[qi];
            var quest = _buildKingdomQuest(sel.typeId, sel.qt, kingdomId, kingdom, day, rng, mood);
            kqData.available.push(quest);
        }

        // Personal assignment chance — skip if player IS the king (they assign directives, not receive them)
        var _isPlayerKingForQuests = false;
        try { _isPlayerKingForQuests = Player && Player.isPlayerKing && Player.isPlayerKing() && Player.state && Player.state.kingState && Player.state.kingState.kingdomId === kingdomId; } catch(e) {}
        kqData.personalAssignment = null;
        if (!_isPlayerKingForQuests) {
        var personalChance = playerRank >= 6 ? 0.30 : playerRank >= 5 ? 0.15 : 0.05;
        if (rng.chance(personalChance) && candidates.length > 0) {
            // Pick highest weight candidate not already selected
            var personalCands = candidates.filter(function(c) {
                return !selected.some(function(s) { return s.typeId === c.typeId; });
            });
            if (personalCands.length > 0) {
                personalCands.sort(function(a, b) { return b.weight - a.weight; });
                var pSel = personalCands[0];
                var pQuest = _buildKingdomQuest(pSel.typeId, pSel.qt, kingdomId, kingdom, day, rng, mood);
                pQuest.isPersonal = true;
                pQuest.urgency = 'critical';
                // Shorter deadline for personal assignments
                pQuest.expiresDay = day + Math.max(10, Math.floor((pQuest.expiresDay - day) * 0.6));
                kqData.personalAssignment = pQuest;
            }
        }
        } // end skip personal assignments when player is king

        return kqData;
    }

    function _buildVariableDelivery(kingdom, rng) {
        // Generate context-appropriate delivery based on kingdom needs
        var deliver = {};
        var needs = (kingdom && kingdom.procurement && kingdom.procurement.needs) || {};
        var needKeys = Object.keys(needs);
        if (needKeys.length > 0) {
            // Pick 2-3 items from actual kingdom procurement needs
            var count = rng.randInt(2, 3);
            var picked = rng.shuffle(needKeys.slice()).slice(0, count);
            for (var i = 0; i < picked.length; i++) {
                deliver[picked[i]] = rng.randInt(10, 30);
            }
        } else {
            // Fallback: generic useful goods
            var fallbackGoods = [
                { id: 'wheat', qty: [15, 35] }, { id: 'bread', qty: [10, 25] },
                { id: 'meat', qty: [10, 20] }, { id: 'wood', qty: [20, 40] },
                { id: 'stone', qty: [15, 30] }, { id: 'iron', qty: [10, 20] },
                { id: 'cloth', qty: [10, 20] }, { id: 'tools', qty: [10, 20] }
            ];
            var picks = rng.shuffle(fallbackGoods.slice()).slice(0, rng.randInt(2, 3));
            for (var j = 0; j < picks.length; j++) {
                deliver[picks[j].id] = rng.randInt(picks[j].qty[0], picks[j].qty[1]);
            }
        }
        return deliver;
    }

    function _buildKingdomQuest(typeId, qt, kingdomId, kingdom, day, rng, mood) {
        var moodCfg = CONFIG.KING_MOOD || {};
        mood = mood || 'content';
        var timeLimit = qt.diff === 'elite' ? 35 : qt.diff === 'hard' ? 30 : qt.diff === 'medium' ? 25 : 20;
        if (qt.urgency === 'critical') timeLimit = Math.max(10, timeLimit - 10);

        // Build delivery requirements with randomized quantities
        var deliverReq = null;
        if (qt.req && qt.req.deliver) {
            if (typeof qt.req.deliver === 'string') {
                // 'variable' delivery — generate contextual requirements based on kingdom needs
                deliverReq = _buildVariableDelivery(kingdom, rng);
            } else if (typeof qt.req.deliver === 'object' && qt.req.deliver !== null) {
                deliverReq = {};
                for (var resId in qt.req.deliver) {
                    if (!qt.req.deliver.hasOwnProperty(resId) || !resId) continue;
                    var range = qt.req.deliver[resId];
                    var qty = Array.isArray(range) ? _kqRandRange(rng, range) : _kqRandRange(rng, range);
                    // v9p33river333: ignore malformed delivery shapes and non-positive quantities.
                    if (qty > 0) deliverReq[String(resId)] = qty;
                }
                if (Object.keys(deliverReq).length === 0) deliverReq = null;
            }
        }

        var goldReq = 0;
        if (qt.req && qt.req.gold) {
            goldReq = Array.isArray(qt.req.gold) ? _kqRandRange(rng, qt.req.gold) : qt.req.gold;
        }

        var actionReq = null;
        if (qt.req && qt.req.action) {
            actionReq = {
                type: String(qt.req.action),
                count: qt.req.count ? Math.max(1, _kqRandRange(rng, qt.req.count)) : 1,
                goldTarget: qt.req.gold_target ? Math.max(0, _kqRandRange(rng, qt.req.gold_target)) : 0
            }; // v9p33river333: progress code expects normalized action/count/goldTarget fields.
        }

        // Build rewards — mood affects gold generosity
        var rewardGold = Array.isArray(qt.reward.gold) ? _kqRandRange(rng, qt.reward.gold) : (qt.reward.gold || 0);
        var moodRewardMod = (moodCfg.rewardMod && moodCfg.rewardMod[mood]) || 1.0;
        rewardGold = Math.round(rewardGold * moodRewardMod);
        var rewardRep = qt.reward.rep || 3;
        var rewardKingRel = qt.reward.kingRel || 5;
        var rewardXp = qt.reward.xp || 30;

        // Mood urgency bias — stressed/angry kings upgrade urgency
        var moodUrgBias = (moodCfg.urgencyBias && moodCfg.urgencyBias[mood]) || 0;
        var finalUrgency = qt.urgency || 'normal';
        if (moodUrgBias > 0 && rng.chance(moodUrgBias)) {
            if (finalUrgency === 'low') finalUrgency = 'normal';
            else if (finalUrgency === 'normal') finalUrgency = 'high';
            else if (finalUrgency === 'high') finalUrgency = 'critical';
        }

        // Special reward chance (10% for hard, 20% for elite)
        var special = null;
        var specialChance = qt.diff === 'elite' ? 0.20 : qt.diff === 'hard' ? 0.10 : 0.03;
        if (rng.chance(specialChance) && typeof KINGDOM_QUEST_SPECIAL_REWARDS !== 'undefined') {
            special = rng.pick(KINGDOM_QUEST_SPECIAL_REWARDS);
        }

        // Rejection penalty
        var rejBase = { rep: qt.diff === 'elite' ? 4 : qt.diff === 'hard' ? 3 : 2, kingRel: qt.diff === 'elite' ? 6 : qt.diff === 'hard' ? 4 : 3 };

        // Build description with dynamic details
        var desc = qt.desc || qt.title;
        if (deliverReq) {
            var deliverParts = [];
            for (var dr in deliverReq) {
                var resName = dr;
                try {
                    var rType = RESOURCE_TYPES[dr.toUpperCase()];
                    if (rType) resName = (rType.icon || '') + ' ' + rType.name;
                } catch(e) {}
                deliverParts.push(deliverReq[dr] + ' ' + resName);
            }
            desc += ' Deliver: ' + deliverParts.join(', ') + '.';
        }
        if (goldReq > 0 && !actionReq) {
            desc += ' Contribute ' + goldReq + 'g to the crown.';
        }
        if (actionReq && actionReq.goldTarget > 0) {
            desc += ' Raise ' + actionReq.goldTarget + 'g through this task.';
        }

        return {
            id: 'kq_' + typeId + '_' + day + '_' + rng.randInt(100, 999),
            typeId: typeId,
            kingdomId: kingdomId,
            title: qt.title,
            description: desc,
            category: qt.cat,
            difficulty: qt.diff,
            minRank: qt.rank,
            isPersonal: false,
            requirements: {
                deliver: deliverReq,
                gold: goldReq,
                action: actionReq
            },
            rewards: {
                gold: rewardGold,
                kingdomRep: rewardRep,
                kingRelationship: rewardKingRel,
                xp: rewardXp,
                special: special
            },
            rejectionPenalty: rejBase,
            postedDay: day,
            expiresDay: day + timeLimit,
            acceptedDay: null,
            status: 'available',
            urgency: finalUrgency,
            triggerCondition: (qt.triggers || [])[0] || 'normal',
            personalityDriver: (qt.personality || [])[0] || ''
        };
    }

    function acceptKingdomQuest(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) {
            return { success: false, message: 'No kingdom quests available.' };
        }
        var kqData = player.kingdomQuests[kingdomId];
        if (!Array.isArray(kqData.available)) kqData.available = [];
        if (!Array.isArray(kqData.active)) kqData.active = [];
        var playerRank = _getPlayerNobleRank();
        var day = Engine.getDay();

        // Max active quests by rank
        var maxActive = playerRank >= 6 ? 4 : playerRank >= 5 ? 3 : 2;
        if (kqData.active.length >= maxActive) {
            return { success: false, message: 'You already have ' + maxActive + ' active kingdom quests (max for your rank).' };
        }
        for (var _dupi = 0; _dupi < kqData.active.length; _dupi++) {
            if (kqData.active[_dupi] && kqData.active[_dupi].id === questId) {
                return { success: false, message: 'This kingdom quest is already active.' };
            }
        }

        // Find quest in available or personal assignment
        var quest = null;
        var fromPersonal = false;
        if (kqData.personalAssignment && kqData.personalAssignment.id === questId) {
            quest = kqData.personalAssignment;
            fromPersonal = true;
        } else {
            for (var i = 0; i < kqData.available.length; i++) {
                if (kqData.available[i].id === questId) {
                    quest = kqData.available[i];
                    kqData.available.splice(i, 1);
                    break;
                }
            }
        }

        if (!quest) {
            return { success: false, message: 'Quest not found.' };
        }
        for (var _ati = 0; _ati < kqData.active.length; _ati++) {
            if (kqData.active[_ati] && (kqData.active[_ati].id === quest.id || kqData.active[_ati].typeId === quest.typeId)) {
                if (fromPersonal) kqData.personalAssignment = null;
                return { success: false, message: 'A matching kingdom quest is already active.' };
            }
        }
        if (!fromPersonal && kqData.personalAssignment && (kqData.personalAssignment.id === quest.id || kqData.personalAssignment.typeId === quest.typeId)) {
            kqData.personalAssignment = null; // v9p33river333: accepting available copy clears duplicate personal assignment.
        }

        quest.status = 'active';
        quest.acceptedDay = day;
        kqData.active.push(quest);
        if (fromPersonal) kqData.personalAssignment = null;

        // Init tracking
        if (!player._kqVisitedTowns) player._kqVisitedTowns = {};
        if (!player._kqGoldSpent) player._kqGoldSpent = {};
        if (!player._kqActionDone) player._kqActionDone = {};

        player._kqVisitedTowns[quest.id] = [];
        player._kqGoldSpent[quest.id] = 0;
        player._kqActionDone[quest.id] = false;

        // Generate interactive data for the first step if applicable
        if (quest.requirements && quest.requirements.action && quest.requirements.action.type) {
            var msConf = (typeof MULTISTEP_ACTIONS !== 'undefined') ? MULTISTEP_ACTIONS[quest.requirements.action.type] : null;
            if (msConf && msConf.steps[0] && msConf.steps[0].interactive) {
                _generateInteractiveData(quest, 0);
            }
        }

        Engine.logEvent('📜 Accepted kingdom quest: ' + quest.title);
        return { success: true, message: 'Quest accepted: ' + quest.title };
    }

    function rejectKingdomQuest(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) {
            return { success: false, message: 'No quest data.' };
        }
        var kqData = player.kingdomQuests[kingdomId];
        var playerRank = _getPlayerNobleRank();
        var day = Engine.getDay();

        var quest = null;
        var fromPersonal = false;
        if (kqData.personalAssignment && kqData.personalAssignment.id === questId) {
            quest = kqData.personalAssignment;
            fromPersonal = true;
        } else {
            for (var i = 0; i < kqData.available.length; i++) {
                if (kqData.available[i].id === questId) {
                    quest = kqData.available[i];
                    kqData.available.splice(i, 1);
                    break;
                }
            }
        }
        if (!quest) return { success: false, message: 'Quest not found.' };

        // L1: Rejection cooldown — track rejections, double penalty after 2 in 30 days
        if (!player._kqRejections) player._kqRejections = [];
        // Prune old rejections (>30 days)
        var _now = Engine.getDay();
        player._kqRejections = player._kqRejections.filter(function(r) { return _now - r < 30; });
        var _rejectCount = player._kqRejections.length;
        var _cooldownMult = _rejectCount >= 2 ? 2.0 : 1.0;

        // Calculate rejection penalty
        var basePenalty = quest.rejectionPenalty || { rep: 2, kingRel: 3 };
        var rankMult = playerRank >= 6 ? 2.5 : playerRank >= 5 ? 1.5 : 1.0;
        var urgencyMult = quest.urgency === 'critical' ? 2.5 : quest.urgency === 'high' ? 1.5 : quest.urgency === 'low' ? 0.5 : 1.0;

        // King temperament
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        var kp = kingdom ? (kingdom.kingPersonality || {}) : {};
        var tempMult = kp.temperament === 'cruel' ? 2.0 : kp.temperament === 'stern' ? 1.5 : kp.temperament === 'kind' ? 0.7 : 1.0;

        var personalMult = fromPersonal ? 2.0 : 1.0;

        var repLoss = Math.ceil(basePenalty.rep * rankMult * urgencyMult * tempMult * personalMult * _cooldownMult);
        var relLoss = Math.ceil(basePenalty.kingRel * rankMult * urgencyMult * tempMult * personalMult * _cooldownMult);

        Player.modifyReputation(kingdomId, -repLoss);
        if (kingdom && kingdom.king) {
            Player.modifyRelationship(kingdom.king, -relLoss);
        }

        // Track this rejection
        player._kqRejections.push(_now);

        if (fromPersonal) kqData.personalAssignment = null;

        var _cooldownWarn = _rejectCount >= 1 ? ' ⚠️ Frequent rejections increase penalties!' : '';
        Engine.logEvent('❌ Rejected kingdom quest: ' + quest.title + ' (-' + repLoss + ' rep, -' + relLoss + ' king rel)');
        return { success: true, message: 'Quest rejected. (-' + repLoss + ' kingdom rep, -' + relLoss + ' king relationship)' + _cooldownWarn };
    }

    function abandonKingdomQuest(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) {
            return { success: false, message: 'No quest data.' };
        }
        var kqData = player.kingdomQuests[kingdomId];
        var idx = -1;
        for (var i = 0; i < kqData.active.length; i++) {
            if (kqData.active[i].id === questId) { idx = i; break; }
        }
        if (idx < 0) return { success: false, message: 'Quest not found in active quests.' };

        var quest = kqData.active[idx];
        kqData.active.splice(idx, 1);

        // Penalty same as failure
        var repLoss = Math.ceil((quest.rewards.kingdomRep || 3) * 0.5);
        var relLoss = Math.ceil((quest.rewards.kingRelationship || 5) * 0.5);
        if (quest.isPersonal) { repLoss *= 2; relLoss *= 2; }
        Player.modifyReputation(kingdomId, -repLoss);
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (kingdom && kingdom.king) Player.modifyRelationship(kingdom.king, -relLoss);

        // Clean up tracking
        if (player._kqVisitedTowns) delete player._kqVisitedTowns[questId];
        if (player._kqGoldSpent) delete player._kqGoldSpent[questId];
        if (player._kqActionDone) delete player._kqActionDone[questId];
        if (player._kqInteractiveData) delete player._kqInteractiveData[questId];
        if (player._kqStepProgress) delete player._kqStepProgress[questId];
        if (player._kqActionAttempts) delete player._kqActionAttempts[questId]; // v9p33river333: tracking containers may be absent on old saves.

        Engine.logEvent('❌ Abandoned kingdom quest: ' + quest.title);
        return { success: true, message: 'Quest abandoned. (-' + repLoss + ' rep, -' + relLoss + ' king rel)' };
    }

    function completeKingdomQuest(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) {
            return { success: false, message: 'No quest data.' };
        }
        var kqData = player.kingdomQuests[kingdomId];
        var idx = -1;
        for (var i = 0; i < kqData.active.length; i++) {
            if (kqData.active[i].id === questId) { idx = i; break; }
        }
        if (idx < 0) return { success: false, message: 'Quest not found in active quests.' };

        var quest = kqData.active[idx];

        // Verify all requirements are met
        var check = checkKingdomQuestProgress(questId, kingdomId);
        if (!check.complete) {
            return { success: false, message: 'Quest requirements not yet met. ' + (check.remaining || '') };
        }

        // Consume delivered goods from inventory (and town storage as fallback)
        // v9p33river320: previously consumed only from player.inventory.
        // Kingdom delivery quests can store goods in player.townStorage[townId]
        // (caravan deposits etc.) — consume from either pool.
        if (quest.requirements.deliver) {
            for (var resId in quest.requirements.deliver) {
                var qty = quest.requirements.deliver[resId];
                var fromInv = Math.min(qty, player.inventory[resId] || 0);
                if (fromInv > 0) {
                    player.inventory[resId] = (player.inventory[resId] || 0) - fromInv;
                    if (player.inventory[resId] <= 0) delete player.inventory[resId];
                    qty -= fromInv;
                }
                if (qty > 0 && player.townStorage && player.townStorage[player.townId]) {
                    var _ts = player.townStorage[player.townId];
                    var fromTown = Math.min(qty, _ts[resId] || 0);
                    if (fromTown > 0) {
                        _ts[resId] -= fromTown;
                        if (_ts[resId] <= 0) delete _ts[resId];
                        qty -= fromTown;
                    }
                }
            }
        }

        // Consume gold requirement
        if (quest.requirements.gold > 0) {
            player.gold -= quest.requirements.gold;
            // Give gold to kingdom treasury
            var kingdom = null;
            try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
            if (kingdom) kingdom.gold = (kingdom.gold || 0) + quest.requirements.gold;
        }

        // Grant rewards (kingdom rep reduced by 40% — quests shouldn't be the dominant rep source)
        var _bonusGold = 0;
        var _bonusRep = 0;
        var _bonusReasons = [];

        // M6: Scaled rewards — bonus for clean completion (no failed action attempts)
        var _attempts = player._kqActionAttempts ? (player._kqActionAttempts[questId] || 0) : 0;
        if (_attempts <= 1) {
            _bonusGold += Math.round(quest.rewards.gold * 0.25);
            _bonusRep += 1;
            _bonusReasons.push('🎯 Flawless execution (+25% gold, +1 rep)');
        }
        // Bonus for completing well before deadline (>50% time remaining)
        // v9p33river310: was reading quest.deadlineDay which doesn't exist —
        // kingdom quests track timeouts via quest.expiresDay (set in
        // player_quests.js:464, 1204, 1539). The swift-completion bonus
        // therefore never triggered.
        var _daysUsed = (Engine.getDay() - (quest.acceptedDay || quest.issuedDay || 0));
        var _totalDays = (quest.expiresDay || 0) - (quest.acceptedDay || quest.issuedDay || 0);
        if (_totalDays > 0 && _daysUsed < _totalDays * 0.5) {
            _bonusGold += Math.round(quest.rewards.gold * 0.15);
            _bonusRep += 1;
            _bonusReasons.push('⚡ Swift completion (+15% gold, +1 rep)');
        }

        player.gold += quest.rewards.gold + _bonusGold;
        var _nerfedRep = Math.max(1, Math.round(quest.rewards.kingdomRep * 0.6));
        Player.modifyReputation(kingdomId, _nerfedRep + _bonusRep);
        var kingdom2 = null;
        try { kingdom2 = Engine.findKingdom(kingdomId); } catch(e) {}
        if (kingdom2 && kingdom2.king) {
            Player.modifyRelationship(kingdom2.king, quest.rewards.kingRelationship);
        }
        if (quest.rewards.xp) player.xp = (player.xp || 0) + quest.rewards.xp;

        // Special rewards
        if (quest.rewards.special) {
            _applyKQSpecialReward(quest.rewards.special, kingdomId);
        }

        // Move to completed
        quest.status = 'completed';
        quest.completedDay = Engine.getDay();
        kqData.active.splice(idx, 1);
        kqData.completed.push(quest);
        // Keep only last 50 for history
        if (kqData.completed.length > 50) kqData.completed = kqData.completed.slice(-50);

        // Clean up tracking
        if (player._kqVisitedTowns) delete player._kqVisitedTowns[questId];
        if (player._kqGoldSpent) delete player._kqGoldSpent[questId];
        if (player._kqActionDone) delete player._kqActionDone[questId];
        if (player._kqInteractiveData) delete player._kqInteractiveData[questId];
        if (player._kqStepProgress) delete player._kqStepProgress[questId];
        if (player._kqActionAttempts) delete player._kqActionAttempts[questId];

        // Tracking for achievements
        player._kqCompletedTotal = (player._kqCompletedTotal || 0) + 1;

        // L6: Quest chains — completing certain quests unlocks follow-up directives
        var _chainFollowUp = _checkQuestChain(quest, kingdomId);

        Engine.logEvent('✅ Completed kingdom quest: ' + quest.title + ' (+' + (quest.rewards.gold + _bonusGold) + 'g, +' + (_nerfedRep + _bonusRep) + ' rep)');
        var _bonusMsg = _bonusReasons.length > 0 ? ' ' + _bonusReasons.join(' ') : '';
        return {
            success: true,
            message: '✅ Quest complete: ' + quest.title + '! Earned ' + (quest.rewards.gold + _bonusGold) + 'g, +' + (_nerfedRep + _bonusRep) + ' rep, +' + quest.rewards.kingRelationship + ' king rel' + (quest.rewards.special ? ', Special: ' + quest.rewards.special : '') + '.' + _bonusMsg + (_chainFollowUp ? ' 🔗 New follow-up directive available!' : '')
        };
    }

    // L6: Quest chain definitions — action type → follow-up action type
    var QUEST_CHAINS = {
        decode: 'intercept',                 // decode messages → intercept courier
        intercept: 'disinformation',         // intercept courier → spread disinformation
        investigate: 'capture_criminal',     // investigate → capture criminal
        capture_criminal: 'manhunt',         // capture → lead manhunt
        forge_evidence: 'frame_merchant',    // forge evidence → frame merchant
        eliminate_rival: 'silence_witness',  // eliminate rival → silence witness
        patrol_roads: 'escort_npc',          // patrol roads → escort VIP
        recruit_npcs: 'stay_location',       // recruit soldiers → defend position
        sabotage_enemy: 'disinformation',    // sabotage supply → spread disinfo
        diplomatic_mission: 'arrange_marriage', // diplomacy → broker marriage
    };

    function _checkQuestChain(completedQuest, kingdomId) {
        if (!completedQuest || !completedQuest.requirements || !completedQuest.requirements.action) return null;
        var actionType = completedQuest.requirements.action.type;
        if (!actionType || !QUEST_CHAINS[actionType]) return null;

        var nextActionType = QUEST_CHAINS[actionType];
        // Check if there's a pool entry for a quest using this action type
        if (typeof KINGDOM_QUEST_POOL === 'undefined') return null;
        var pool = KINGDOM_QUEST_POOL;
        var nextQuestType = null;
        for (var typeId in pool) {
            var qt = pool[typeId];
            // v9p33river310: pool defs store the action under qt.req.action
            // (config.js:2403-2436), not qt.action. Quest chains never
            // matched, so royal directive follow-ups were never offered.
            var _qtAction = (qt && qt.req && qt.req.action) || qt.action;
            if (_qtAction === nextActionType) { nextQuestType = { typeId: typeId, def: qt }; break; }
        }
        if (!nextQuestType) return null;

        // Generate the follow-up quest and add to available
        var kqData = player.kingdomQuests[kingdomId];
        if (!kqData) return null;

        // Don't add duplicates
        for (var ai = 0; ai < kqData.available.length; ai++) {
            if (kqData.available[ai].typeId === nextQuestType.typeId) return null;
        }
        for (var ac = 0; ac < kqData.active.length; ac++) {
            if (kqData.active[ac].typeId === nextQuestType.typeId) return null;
        }

        // Generate simplified follow-up quest
        var rng = Engine.getRng();
        var day = Engine.getDay();
        var qt2 = nextQuestType.def;
        var followUp = {
            id: 'kq_chain_' + nextQuestType.typeId + '_' + day,
            typeId: nextQuestType.typeId,
            title: '🔗 ' + (qt2.title || nextQuestType.typeId.replace(/_/g, ' ')),
            description: (qt2.description || '') + ' (Follow-up from ' + completedQuest.title + ')',
            category: qt2.category || completedQuest.category,
            difficulty: qt2.difficulty || completedQuest.difficulty,
            urgency: 'high',
            isPersonal: true,
            isChainQuest: true,
            chainFrom: completedQuest.typeId,
            expiresDay: day + (qt2.timeLimit || 30),
            timeLimit: qt2.timeLimit || 30,
            requirements: _buildQuestRequirements(qt2, rng),
            rewards: {
                gold: Math.round((qt2.baseGold || 100) * (rng ? (0.9 + rng.random() * 0.4) : 1)),
                kingdomRep: Math.round((qt2.baseRep || 5) * 1.2),
                kingRelationship: qt2.kingRel || 3,
                xp: qt2.xp || 10,
                special: qt2.special || null
            },
            rejectionPenalty: { rep: 1, kingRel: 1 }
        };
        kqData.available.push(followUp);
        Engine.logEvent('🔗 A follow-up directive is now available: ' + followUp.title);
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('🔗 Follow-up directive available: ' + followUp.title, 'info', 'my_actions');
        }
        return followUp;
    }

    function _buildQuestRequirements(questDef, rng) {
        var reqs = {};
        var srcReq = questDef.req || {};
        var actionType = questDef.action || srcReq.action;
        if (actionType) {
            reqs.action = {
                type: String(actionType),
                count: srcReq.count ? Math.max(1, _kqRandRange(rng, srcReq.count)) : (questDef.visitCount || 1),
                goldTarget: srcReq.gold_target ? Math.max(0, _kqRandRange(rng, srcReq.gold_target)) : 0
            };
            if (String(actionType).indexOf('visit') >= 0) {
                reqs.action.count = reqs.action.count || 3;
                reqs.action.townType = questDef.townType || 'any';
            }
        }
        var deliverSrc = srcReq.deliver || null;
        if (deliverSrc && typeof deliverSrc === 'object') {
            reqs.deliver = {};
            for (var resId in deliverSrc) {
                if (!deliverSrc.hasOwnProperty(resId) || !resId) continue;
                var qty = _kqRandRange(rng, deliverSrc[resId]);
                if (qty > 0) reqs.deliver[String(resId)] = qty;
            }
            if (Object.keys(reqs.deliver).length === 0) delete reqs.deliver;
        }
        if (questDef.deliverGoods) {
            if (!reqs.deliver) reqs.deliver = {};
            for (var di = 0; di < questDef.deliverGoods.length; di++) {
                var dg = questDef.deliverGoods[di];
                if (!dg || !dg.id) continue;
                var dgQty = dg.qty || (rng ? rng.randInt(dg.min || 5, dg.max || 20) : 10);
                if (dgQty > 0) reqs.deliver[dg.id] = dgQty;
            }
        }
        var goldReq = srcReq.gold || questDef.goldReq || 0;
        reqs.gold = Array.isArray(goldReq) ? _kqRandRange(rng, goldReq) : (Number(goldReq) || 0);
        // v9p33river333: chain quests must use the same requirement shape checkKingdomQuestProgress understands.
        return reqs;
    }

    function _applyKQSpecialReward(rewardType, kingdomId) {
        var day = Engine.getDay();
        switch (rewardType) {
            case 'production_permit':
                // v9p33river342: previously stored only in _kqSpecialRewards
                // which the production-ban check never reads. Also add a
                // wildcard entry to player.productionPermits keyed by
                // '__wildcard__' (a reserved sentinel) so the check at
                // player.js:2352 / 26162 / 26506 honors the kingdom-wide
                // permit. Stored separately too so expiry can be tracked.
                if (!player._kqSpecialRewards) player._kqSpecialRewards = [];
                player._kqSpecialRewards.push({ type: 'production_permit', kingdomId: kingdomId, expiresDay: day + 90 });
                if (!player.productionPermits) player.productionPermits = {};
                if (!player.productionPermits[kingdomId]) player.productionPermits[kingdomId] = [];
                if (player.productionPermits[kingdomId].indexOf('__wildcard__') < 0) {
                    player.productionPermits[kingdomId].push('__wildcard__');
                }
                if (!player._productionPermitExpiry) player._productionPermitExpiry = {};
                player._productionPermitExpiry[kingdomId] = day + 90;
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🏭 Granted: Production Permit (any banned good, 90 days)', 'success');
                break;
            case 'tax_exemption_30d':
                // v9p33river343: previously only pushed into _kqSpecialRewards
                // (read by nothing). Property tax at engine_kingdom_finances.js:194
                // reads Player.state.taxExemption[kingdomId], so the canonical
                // path must be written too. Track in _kqSpecialRewards for UI
                // surfacing, AND set the live exemption expiry.
                if (!player._kqSpecialRewards) player._kqSpecialRewards = [];
                player._kqSpecialRewards.push({ type: 'tax_exemption', kingdomId: kingdomId, expiresDay: day + 30 });
                if (!player.taxExemption) player.taxExemption = {};
                // Don't shorten an existing longer exemption (e.g. from king's
                // favor which grants a full year).
                if (!player.taxExemption[kingdomId] || player.taxExemption[kingdomId] < day + 30) {
                    player.taxExemption[kingdomId] = day + 30;
                }
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('💰 Granted: Tax Exemption (30 days)', 'success');
                break;
            case 'title_boost':
                // +3 toward next rank reputation
                Player.modifyReputation(kingdomId, 3);
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('👑 Title Boost: +3 kingdom reputation', 'success');
                break;
            case 'royal_decree':
                if (!player.guaranteedPetition) player.guaranteedPetition = {};
                player.guaranteedPetition[kingdomId] = true;
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('📜 Granted: Royal Decree (guaranteed petition)', 'success');
                break;
            case 'land_grant':
                // v9p33river342: previously only incremented _kqLandGrants
                // (read by nothing). The land check at player.js:2228 uses
                // player.landOwned[townId], so the promised free building
                // slot did nothing. Now adds an actual plot to the player's
                // current town's landOwned count.
                if (!player.landOwned) player.landOwned = {};
                var _grantTownId = player.townId;
                if (_grantTownId) {
                    player.landOwned[_grantTownId] = (player.landOwned[_grantTownId] || 0) + 1;
                }
                player._kqLandGrants = (player._kqLandGrants || 0) + 1;
                if (typeof UI !== 'undefined' && UI.toast) {
                    var _grantTown = _grantTownId ? Engine.findTown(_grantTownId) : null;
                    UI.toast('🏘️ Land Grant: +1 free plot in ' + (_grantTown ? _grantTown.name : 'your town'), 'success');
                }
                break;
            case 'kings_favor':
                var kingdom = null;
                try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
                if (kingdom && kingdom.king) Player.modifyRelationship(kingdom.king, 20);
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('👑 King\'s Favor: +20 king relationship', 'success');
                break;
            case 'military_equipment':
                player.inventory.swords = (player.inventory.swords || 0) + 10;
                player.inventory.armor = (player.inventory.armor || 0) + 5;
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ Military Equipment: 10 swords, 5 armor', 'success');
                break;
            case 'trade_monopoly':
                if (!player._kqSpecialRewards) player._kqSpecialRewards = [];
                player._kqSpecialRewards.push({ type: 'trade_monopoly', kingdomId: kingdomId, expiresDay: day + 60 });
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('📊 Trade Monopoly granted (60 days)', 'success');
                break;
            case 'noble_endorsement':
                Player.modifyReputation(kingdomId, 5);
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🏅 Noble Endorsement: +5 kingdom reputation', 'success');
                break;
            case 'crown_estate':
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🏰 Crown Estate: Property rights expanded', 'success');
                player._kqLandGrants = (player._kqLandGrants || 0) + 3;
                break;
        }
    }

    function checkKingdomQuestProgress(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) return { complete: false, remaining: 'No quest data.' };
        var kqData = player.kingdomQuests[kingdomId];
        var quest = null;
        for (var i = 0; i < kqData.active.length; i++) {
            if (kqData.active[i].id === questId) { quest = kqData.active[i]; break; }
        }
        if (!quest) return { complete: false, remaining: 'Quest not found.' };
        if (!quest.requirements || typeof quest.requirements !== 'object') {
            return { complete: false, remaining: 'Quest requirements are missing.', details: ['Quest requirements are missing.'] };
        }

        var allMet = true;
        var remaining = [];
        var hasRequirement = false;
        if (!player.inventory) player.inventory = {};
        if (!player.townStorage) player.townStorage = {};

        // Check delivery requirements
        if (quest.requirements.deliver) {
            var deliverKeys = Object.keys(quest.requirements.deliver);
            for (var dk = 0; dk < deliverKeys.length; dk++) {
                var resId = deliverKeys[dk];
                var needed = Math.max(0, Math.floor(Number(quest.requirements.deliver[resId]) || 0));
                if (!resId || needed <= 0) {
                    allMet = false;
                    remaining.push('Malformed delivery requirement');
                    continue;
                }
                hasRequirement = true;
                var townStore = (player.townStorage && player.townStorage[player.townId]) || {};
                var have = (Number(player.inventory[resId]) || 0) + (Number(townStore[resId]) || 0);
                if (have < needed) {
                    allMet = false;
                    remaining.push((needed - have) + ' more ' + resId);
                }
            }
        }

        // Check gold requirement
        var goldReq = Math.max(0, Math.floor(Number(quest.requirements.gold) || 0));
        if (goldReq > 0) {
            hasRequirement = true;
            if (player.gold < goldReq) {
                allMet = false;
                remaining.push('Need ' + (goldReq - Math.floor(player.gold)) + ' more gold');
            }
        }

        // Check action requirements
        if (quest.requirements.action) {
            hasRequirement = true;
            var action = quest.requirements.action;
            var actionType = action && action.type ? String(action.type) : '';
            var actionCount = Math.max(1, Math.floor(Number(action.count) || 1));
            var goldTarget = Math.max(0, Math.floor(Number(action.goldTarget) || 0));
            if (!actionType) {
                allMet = false;
                remaining.push('Malformed action requirement');
            } else if (actionType === 'visit_towns' || actionType === 'visit_foreign' || actionType === 'visit_enemy_towns') {
                var visited = player._kqVisitedTowns ? (player._kqVisitedTowns[questId] || []) : [];
                var visitedCount = Array.isArray(visited) ? visited.length : 0;
                if (visitedCount < actionCount) {
                    allMet = false;
                    remaining.push('Visit ' + (actionCount - visitedCount) + ' more towns');
                }
            } else if (goldTarget > 0) {
                var spent = player._kqGoldSpent ? (player._kqGoldSpent[questId] || 0) : 0;
                if (spent < goldTarget) {
                    allMet = false;
                    remaining.push('Raise ' + (goldTarget - spent) + ' more gold');
                }
            } else {
                // One-off action quests
                var done = player._kqActionDone ? (player._kqActionDone[questId] || false) : false;
                if (!done) {
                    allMet = false;
                    remaining.push('Complete the required action');
                }
            }
        }

        if (!hasRequirement) {
            allMet = false;
            remaining.push('Quest requirements are empty.');
        }
        // v9p33river333: never report complete without validated requirements/remaining text.
        return { complete: allMet, remaining: remaining.join(', '), details: remaining };
    }

    function getKingdomQuestData(kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) return null;
        return player.kingdomQuests[kingdomId];
    }

    function getActiveKingdomQuests(kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) return [];
        return player.kingdomQuests[kingdomId].active || [];
    }

    function trackKQTownVisit(questId, townId) {
        _sync();
        if (!player._kqVisitedTowns) player._kqVisitedTowns = {};
        if (!player._kqVisitedTowns[questId]) player._kqVisitedTowns[questId] = [];
        if (player._kqVisitedTowns[questId].indexOf(townId) < 0) {
            player._kqVisitedTowns[questId].push(townId);
        }
    }

    function trackKQGoldSpent(questId, amount) {
        _sync();
        if (!player._kqGoldSpent) player._kqGoldSpent = {};
        player._kqGoldSpent[questId] = (player._kqGoldSpent[questId] || 0) + amount;
    }

    // v9p33river342: trade-gold tracker called from sell/delivery paths.
    // Walks all active kingdom quests across all kingdoms and credits gold
    // toward any quest with a goldTarget requirement. Previously
    // trackKQGoldSpent() existed but was never called from gameplay code,
    // so "Raise X gold through trade" quests were impossible to progress.
    function trackKQTradeGold(amount) {
        _sync();
        if (!amount || amount <= 0) return;
        if (!player.kingdomQuests) return;
        for (var kqKid in player.kingdomQuests) {
            var kqData = player.kingdomQuests[kqKid];
            if (!kqData || !Array.isArray(kqData.active)) continue;
            for (var qi = 0; qi < kqData.active.length; qi++) {
                var aq = kqData.active[qi];
                if (!aq || aq.status !== 'active') continue;
                var reqs = aq.requirements || {};
                var goldTarget = reqs.gold || reqs.goldTarget || 0;
                if (goldTarget > 0) {
                    trackKQGoldSpent(aq.id, amount);
                }
            }
        }
    }

    function trackKQActionDone(questId) {
        _sync();
        if (!player._kqActionDone) player._kqActionDone = {};
        player._kqActionDone[questId] = true;
    }

    // ── Attempt a one-off action quest (replaces instant "Report Complete") ──
    function attemptKQAction(questId, kingdomId) {
        _sync();
        if (!kingdomId) kingdomId = _getPlayerKingdomId();
        if (!player.kingdomQuests || !player.kingdomQuests[kingdomId]) {
            return { success: false, message: 'No quest data.' };
        }
        var kqData = player.kingdomQuests[kingdomId];
        var quest = null;
        for (var qi = 0; qi < kqData.active.length; qi++) {
            if (kqData.active[qi].id === questId) { quest = kqData.active[qi]; break; }
        }
        if (!quest) return { success: false, message: 'Quest not found in active quests.' };

        // Get action type from quest requirements
        var actionType = quest.requirements.action ? quest.requirements.action.type : null;
        if (!actionType) return { success: false, message: 'Quest has no action requirement.' };

        // Look up mechanics config
        var mech = (typeof ACTION_QUEST_MECHANICS !== 'undefined') ? ACTION_QUEST_MECHANICS[actionType] : null;
        if (!mech) {
            return { success: false, message: '⚠️ No mechanic defined for action type: ' + actionType + '. This quest action is not yet available.' };
        }

        // Check location requirement
        if (mech.locationReq === 'capital') {
            var playerTown = null;
            try { playerTown = Engine.findTown(player.townId); } catch(e) {}
            if (!playerTown || !playerTown.isCapital) {
                return { success: false, message: '📍 You must be in the kingdom capital to attempt this action. Travel to the capital first.' };
            }
        }

        // H3: stay_location requires player to be in a town (not traveling)
        if (actionType === 'stay_location') {
            if (player.traveling) {
                return { success: false, message: '📍 You must be stationed in a town to defend it. Stop traveling first.' };
            }
            var _defTown = null;
            try { _defTown = Engine.findTown(player.townId); } catch(e) {}
            if (!_defTown) {
                return { success: false, message: '📍 You must be in a town to defend a position.' };
            }
        }

        // M5: Multi-step action logic
        var multiStep = MULTISTEP_ACTIONS[actionType] || null;
        var currentStep = null;
        var currentStepIdx = 0;
        var isMultiStep = false;
        if (multiStep) {
            isMultiStep = true;
            if (!player._kqStepProgress) player._kqStepProgress = {};
            currentStepIdx = player._kqStepProgress[questId] || 0;
            if (currentStepIdx >= multiStep.totalSteps) {
                // Already completed all steps
                trackKQActionDone(questId);
                return { success: true, actionSuccess: true, message: 'All steps already completed!', isMultiStep: true, stepCompleted: multiStep.totalSteps, totalSteps: multiStep.totalSteps };
            }
            currentStep = multiStep.steps[currentStepIdx];
            if (!currentStep) {
                return { success: false, message: '⚠️ Quest step configuration is incomplete.' }; // v9p33river333: corrupt multistep configs should fail safely.
            }
        }

        // Check gold — use step cost if multi-step, otherwise base mechanic
        var goldCost = isMultiStep ? (currentStep.goldCost || 0) : (mech.goldCost || 0);
        if (goldCost > 0 && player.gold < goldCost) {
            var stepLabel = isMultiStep ? (' (Step ' + (currentStepIdx + 1) + ': ' + currentStep.label + ')') : '';
            return { success: false, message: '💰 Not enough gold. This action costs ' + goldCost + 'g' + stepLabel + '. You have ' + Math.floor(player.gold) + 'g.' };
        }

        // Deduct gold
        if (goldCost > 0) {
            player.gold -= goldCost;
            player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + goldCost;
        }

        // Advance time (tickCost is in days, multiply by ticks per day)
        var tickCost = isMultiStep ? (currentStep.tickCost || 1) : (mech.tickCost || 5);
        var ticksPerDay = (typeof CONFIG !== 'undefined' && CONFIG.TICKS_PER_DAY) ? CONFIG.TICKS_PER_DAY : 60;
        if (typeof Game !== 'undefined' && Game.advanceTicks) {
            Game.advanceTicks(tickCost * ticksPerDay);
        }

        // Calculate success chance — use step values if multi-step
        var baseChance = isMultiStep ? (currentStep.successBase || 0.70) : (mech.successBase || 0.60);
        var skillBonus = 0;
        var skillBranch = isMultiStep ? (currentStep.skillKey || mech.skillKey || 'underworld') : (mech.skillKey || 'underworld');

        // Count skills in the relevant branch
        if (player.skills && typeof PLAYER_SKILLS !== 'undefined') {
            for (var skId in player.skills) {
                if (player.skills[skId]) {
                    var skDef = PLAYER_SKILLS[skId];
                    if (skDef && skDef.branch === skillBranch) {
                        skillBonus += 0.03; // +3% per skill in branch
                    }
                }
            }
        }

        // Specific high-value skill bonuses
        if (skillBranch === 'underworld') {
            if (Player.hasSkill('discrete')) skillBonus += 0.05;
            if (Player.hasSkill('master_smuggler')) skillBonus += 0.05;
            if (Player.hasSkill('shadow_dealings')) skillBonus += 0.05;
            if (Player.hasSkill('master_forger')) skillBonus += 0.05;
            if (Player.hasSkill('dark_connections')) skillBonus += 0.05;
            if (Player.hasSkill('ghost')) skillBonus += 0.05;
        } else if (skillBranch === 'social') {
            if (Player.hasSkill('court_etiquette')) skillBonus += 0.05;
            if (Player.hasSkill('political_connections')) skillBonus += 0.05;
            if (Player.hasSkill('charismatic')) skillBonus += 0.05;
            if (Player.hasSkill('court_informant')) skillBonus += 0.05;
            if (Player.hasSkill('royal_favor')) skillBonus += 0.05;
        } else if (skillBranch === 'survival') {
            if (Player.hasSkill('combat_proficiency')) skillBonus += 0.05;
            if (Player.hasSkill('wilderness_survival')) skillBonus += 0.05;
        }

        // Difficulty scaling — harder quests are harder to succeed
        var diffPenalty = quest.difficulty === 'elite' ? -0.15 : quest.difficulty === 'hard' ? -0.08 : 0;

        var finalChance = Math.min(0.95, Math.max(0.15, baseChance + skillBonus + diffPenalty));

        // Roll!
        var rng = Engine.getRng();
        var roll = rng ? rng.chance(finalChance) : (Math.random() < finalChance);

        // Track attempt count
        if (!player._kqActionAttempts) player._kqActionAttempts = {};
        player._kqActionAttempts[questId] = (player._kqActionAttempts[questId] || 0) + 1;
        var attemptNum = player._kqActionAttempts[questId];

        if (roll) {
            // Success!
            var successConsequences = [];

            // M5: Multi-step progression
            if (isMultiStep) {
                if (!player._kqStepProgress) player._kqStepProgress = {};
                player._kqStepProgress[questId] = currentStepIdx + 1;
                var isFinalStep = (currentStepIdx + 1) >= multiStep.totalSteps;
                if (isFinalStep) {
                    trackKQActionDone(questId);
                    Engine.logEvent('✅ ' + (mech.label || 'Action') + ' — all steps completed! (Step ' + (currentStepIdx + 1) + '/' + multiStep.totalSteps + ': ' + currentStep.label + ')');
                } else {
                    var nextStep = multiStep.steps[currentStepIdx + 1] || null;
                    var nextStepLabel = nextStep && nextStep.label ? nextStep.label : 'Continue';
                    // v9p33river333: corrupt multistep configs may omit the next step payload.
                    Engine.logEvent('✅ Step ' + (currentStepIdx + 1) + '/' + multiStep.totalSteps + ' complete: ' + currentStep.label + '. Next: ' + nextStepLabel);
                    // Generate interactive data for next step if applicable
                    if (nextStep && nextStep.interactive) {
                        _generateInteractiveData(quest, currentStepIdx + 1);
                    }
                }
            } else {
                trackKQActionDone(questId);
                Engine.logEvent('✅ ' + (mech.label || 'Action') + ' succeeded! (attempt #' + attemptNum + ')');
            }

            // M2: Corrupt quest success — gain corruption trait over time
            if (quest.category === 'corrupt') {
                if (!player._corruptionPoints) player._corruptionPoints = 0;
                player._corruptionPoints += 2;
                if (player._corruptionPoints >= 5 && !player._corruptionTrait) {
                    player._corruptionTrait = true;
                    successConsequences.push('🏴 Your reputation for corruption grows... (Corruption trait gained)');
                    Engine.logEvent('🏴 ' + player.fullName + ' has gained a reputation for corruption.');
                }
            }

            // Shake down / extort: award bonus gold on success
            if (actionType === 'shake_down' || actionType === 'extort') {
                var rngGold = Engine.getRng();
                var bonusGold = rngGold ? rngGold.randInt(50, 200) : 100;
                player.gold += bonusGold;
                successConsequences.push('💰 Extracted ' + bonusGold + 'g from the merchant!');
                Engine.logEvent('💰 ' + player.fullName + ' extracted ' + bonusGold + 'g from a merchant.');
            }

            // Create caravan: spawn a trade route that boosts kingdom prosperity
            if (actionType === 'create_caravan') {
                var _ccRng = Engine.getRng();
                var _ccWorld = Engine.getWorld ? Engine.getWorld() : null;
                if (_ccWorld && kingdomId) {
                    var _ccKingdom = null;
                    for (var _kci = 0; _kci < (_ccWorld.kingdoms || []).length; _kci++) {
                        if (_ccWorld.kingdoms[_kci].id === kingdomId) { _ccKingdom = _ccWorld.kingdoms[_kci]; break; }
                    }
                    if (_ccKingdom) {
                        if (!_ccKingdom.tradeRoutes) _ccKingdom.tradeRoutes = [];
                        var _routeIncome = _ccRng ? _ccRng.randInt(5, 15) : 10;
                        _ccKingdom.tradeRoutes.push({
                            id: 'route_' + _ccWorld.day + '_' + Math.floor(Math.random() * 1000),
                            createdDay: _ccWorld.day,
                            income: _routeIncome,
                            createdBy: 'player'
                        });
                        // Boost prosperity of 1-2 kingdom towns
                        var _ccTowns = (_ccWorld.towns || []).filter(function(t) { return t.kingdomId === kingdomId; });
                        for (var _cti = 0; _cti < Math.min(2, _ccTowns.length); _cti++) {
                            _ccTowns[_cti].prosperity = Math.min(100, (_ccTowns[_cti].prosperity || 50) + 3);
                        }
                        successConsequences.push('🛤️ New trade route established! Kingdom gains +' + _routeIncome + 'g/month income.');
                        Engine.logEvent('🛤️ ' + player.fullName + ' established a new trade route for the kingdom (+' + _routeIncome + 'g/month).');
                    }
                }
            }

            // Build building: place a building in a kingdom town
            if (actionType === 'build_building') {
                var _bbRng = Engine.getRng();
                var _bbWorld = Engine.getWorld ? Engine.getWorld() : null;
                if (_bbWorld && kingdomId) {
                    var _bbTowns = (_bbWorld.towns || []).filter(function(t) { return t.kingdomId === kingdomId; });
                    var _bbTown = null;
                    // Prefer player's current town, then pick a random kingdom town
                    for (var _bti = 0; _bti < _bbTowns.length; _bti++) {
                        if (_bbTowns[_bti].id === player.townId) { _bbTown = _bbTowns[_bti]; break; }
                    }
                    if (!_bbTown && _bbTowns.length > 0) _bbTown = _bbRng ? _bbRng.pick(_bbTowns) : _bbTowns[0];
                    if (_bbTown) {
                        if (!_bbTown.buildings) _bbTown.buildings = [];
                        var _bbTypes = ['workshop', 'warehouse', 'market_stall', 'tavern', 'smithy', 'mill'];
                        var _bbType = _bbRng ? _bbRng.pick(_bbTypes) : 'workshop';
                        _bbTown.buildings.push({
                            id: 'bld_' + _bbWorld.day + '_' + Math.floor(Math.random() * 1000),
                            type: _bbType,
                            ownerId: kingdomId,
                            // v9p33river290: condition is a state string per
                            // CONFIG.CONDITION_LEVELS, and the age field is
                            // `builtDay` (degradation tick keys off it) — the
                            // old numeric `condition: 100` and `built:` field
                            // were silently ignored.
                            condition: 'new',
                            builtDay: _bbWorld.day
                        });
                        _bbTown.prosperity = Math.min(100, (_bbTown.prosperity || 50) + 5);
                        successConsequences.push('🏗️ Built a new ' + _bbType.replace(/_/g, ' ') + ' in ' + _bbTown.name + '!');
                        Engine.logEvent('🏗️ ' + player.fullName + ' oversaw construction of a ' + _bbType.replace(/_/g, ' ') + ' in ' + _bbTown.name + '.');
                    }
                }
            }

            // Sell foreign: player earns bonus gold from foreign trade
            if (actionType === 'sell_foreign') {
                var _sfRng = Engine.getRng();
                var _sfGold = _sfRng ? _sfRng.randInt(100, 400) : 200;
                player.gold += _sfGold;
                player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + _sfGold;
                successConsequences.push('💰 Earned ' + _sfGold + 'g from foreign market sales!');
                Engine.logEvent('💰 ' + player.fullName + ' earned ' + _sfGold + 'g selling goods in foreign markets.');
            }

            // Escort NPC: relationship bonus with a random noble
            if (actionType === 'escort_npc') {
                var _enWorld = Engine.getWorld ? Engine.getWorld() : null;
                if (_enWorld && kingdomId) {
                    var _enNobles = (_enWorld.people || []).filter(function(p) {
                        return p.alive && p.socialRank && p.socialRank[kingdomId] >= 4 && p.id !== 'player';
                    });
                    if (_enNobles.length > 0) {
                        var _enRng = Engine.getRng();
                        var _enNoble = _enRng ? _enRng.pick(_enNobles) : _enNobles[0];
                        if (!_enNoble._playerRelationship) _enNoble._playerRelationship = 0;
                        _enNoble._playerRelationship = Math.min(100, _enNoble._playerRelationship + 15);
                        successConsequences.push('🤝 ' + _enNoble.firstName + ' ' + (_enNoble.lastName || '') + ' is grateful for the safe escort (+15 relationship).');
                        Engine.logEvent('🤝 ' + _enNoble.firstName + ' thanks ' + player.fullName + ' for the safe escort.');
                    }
                }
            }

            var successMsg = mech.successText || 'Action succeeded!';
            var successNarr = mech.narrative || '';
            if (isMultiStep) {
                var _isFinal = (currentStepIdx + 1) >= multiStep.totalSteps;
                if (_isFinal) {
                    successMsg = '🏆 Final step complete! ' + (currentStep.label || '') + ' — ' + (mech.successText || 'Mission accomplished!');
                } else {
                    var _nextS = multiStep.steps[currentStepIdx + 1] || null;
                    successMsg = '✅ Step ' + (currentStepIdx + 1) + '/' + multiStep.totalSteps + ': ' + currentStep.label + ' — Success! Next: ' + (_nextS && _nextS.label ? _nextS.label : 'Continue');
                }
                successNarr = currentStep.narrative || mech.narrative || '';
            }

            return {
                success: true,
                actionSuccess: isMultiStep ? ((currentStepIdx + 1) >= multiStep.totalSteps) : true,
                stepSuccess: true,
                message: successMsg,
                narrative: successNarr,
                goldSpent: goldCost,
                ticksSpent: tickCost,
                chance: Math.round(finalChance * 100),
                attempt: attemptNum,
                consequences: successConsequences,
                isMultiStep: isMultiStep,
                stepCompleted: isMultiStep ? (currentStepIdx + 1) : null,
                totalSteps: isMultiStep ? multiStep.totalSteps : null,
                nextStepLabel: (isMultiStep && (currentStepIdx + 1) < multiStep.totalSteps && multiStep.steps[currentStepIdx + 1]) ? (multiStep.steps[currentStepIdx + 1].label || 'Continue') : null
            };
        } else {
            // Failure — gold and time are lost, but can retry
            var failLabel = isMultiStep ? ('Step ' + (currentStepIdx + 1) + '/' + multiStep.totalSteps + ': ' + currentStep.label) : (mech.label || 'Action');
            Engine.logEvent('❌ ' + failLabel + ' failed (attempt #' + attemptNum + ', ' + Math.round(finalChance * 100) + '% chance)');

            var failConsequences = [];

            // M1: Espionage failure consequences
            if (quest.category === 'espionage') {
                var rng2 = Engine.getRng();
                // 25% chance of being discovered — rep loss with target kingdom
                if (rng2 && rng2.chance(0.25)) {
                    var repLoss = rng2.randInt(3, 8);
                    // Lose rep with player's own kingdom (king displeased at exposure)
                    if (kingdomId && player.reputation) {
                        player.reputation[kingdomId] = Math.max(0, (player.reputation[kingdomId] || 50) - repLoss);
                    }
                    failConsequences.push('🔍 Your involvement was discovered! (-' + repLoss + ' rep)');
                    Engine.logEvent('🔍 ' + player.fullName + '\'s espionage activities were discovered! Reputation damaged.');
                }
                // 10% chance of diplomatic incident
                if (rng2 && rng2.chance(0.10)) {
                    failConsequences.push('⚠️ A diplomatic incident has occurred! Both kingdoms are aware of the operation.');
                    Engine.logEvent('⚠️ Diplomatic incident: espionage operation exposed, straining relations.');
                }
            }

            // M2: Corrupt quest failure consequences
            if (quest.category === 'corrupt') {
                var rng3 = Engine.getRng();
                // 30% chance of being caught — major rep loss + corruption trait
                if (rng3 && rng3.chance(0.30)) {
                    var repLoss2 = rng3.randInt(5, 12);
                    if (kingdomId && player.reputation) {
                        player.reputation[kingdomId] = Math.max(0, (player.reputation[kingdomId] || 50) - repLoss2);
                    }
                    failConsequences.push('🚔 You were nearly caught! (-' + repLoss2 + ' rep)');
                    Engine.logEvent('🚔 ' + player.fullName + '\'s corrupt activities were nearly exposed!');
                }
                // Track corruption — accumulates over corrupt quest attempts
                if (!player._corruptionPoints) player._corruptionPoints = 0;
                player._corruptionPoints += 1;
                if (player._corruptionPoints >= 5 && !player._corruptionTrait) {
                    player._corruptionTrait = true;
                    failConsequences.push('🏴 Your reputation for corruption grows... (Corruption trait gained)');
                    Engine.logEvent('🏴 ' + player.fullName + ' has gained a reputation for corruption.');
                }
            }

            // Also add corruption points on SUCCESS for corrupt quests (M2)
            // (This is tracked here so it applies to both success and failure paths)

            var failMsg = mech.failText || 'The action failed. You can try again.';
            var failNarr = mech.narrative || '';
            if (isMultiStep) {
                failMsg = '❌ Step ' + (currentStepIdx + 1) + '/' + multiStep.totalSteps + ': ' + currentStep.label + ' — Failed! You can retry this step.';
                failNarr = currentStep.narrative || mech.narrative || '';
            }

            return {
                success: true,  // call succeeded (no error), but action failed
                actionSuccess: false,
                stepSuccess: false,
                message: failMsg,
                narrative: failNarr,
                goldSpent: goldCost,
                ticksSpent: tickCost,
                chance: Math.round(finalChance * 100),
                attempt: attemptNum,
                consequences: failConsequences,
                isMultiStep: isMultiStep,
                currentStep: isMultiStep ? (currentStepIdx + 1) : null,
                totalSteps: isMultiStep ? multiStep.totalSteps : null,
                stepLabel: isMultiStep ? currentStep.label : null
            };
        }
    }

    function tickKingdomQuests() {
        _sync();
        var day = Engine.getDay();
        var playerRank = _getPlayerNobleRank();
        if (playerRank < 4) {
            if (player.kingdomQuests) {
                for (var _staleKid in player.kingdomQuests) {
                    if (player.kingdomQuests[_staleKid]) {
                        player.kingdomQuests[_staleKid].available = [];
                        player.kingdomQuests[_staleKid].personalAssignment = null;
                    }
                }
            }
            return; // v9p33river333: keep stale royal directives hidden after demotion.
        }

        var kingdomId = _getPlayerKingdomId();
        if (!kingdomId) return;

        // Ensure data exists
        if (!player.kingdomQuests) player.kingdomQuests = {};
        if (!player.kingdomQuests[kingdomId]) {
            player.kingdomQuests[kingdomId] = { available: [], active: [], completed: [], lastGenDay: 0, personalAssignment: null };
        }
        var kqData = player.kingdomQuests[kingdomId];

        // Check for expired active quests
        for (var i = kqData.active.length - 1; i >= 0; i--) {
            var q = kqData.active[i];
            // v9p33river324: was `day > expiresDay` which gave an extra
            // completable day. Strict expiration on the day itself.
            if (q.expiresDay && day >= q.expiresDay) {
                // Failure penalty
                var repLoss = Math.ceil((q.rewards.kingdomRep || 3) * 0.6);
                var relLoss = Math.ceil((q.rewards.kingRelationship || 5) * 0.6);
                if (q.isPersonal) { repLoss *= 2; relLoss *= 2; }
                Player.modifyReputation(kingdomId, -repLoss);
                var kingdom = null;
                try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
                if (kingdom && kingdom.king) Player.modifyRelationship(kingdom.king, -relLoss);

                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⏰ Kingdom quest expired: ' + q.title + ' (-' + repLoss + ' rep)', 'warning');
                Engine.logEvent('⏰ Kingdom quest expired: ' + q.title);

                // Clean up tracking
                if (player._kqVisitedTowns) delete player._kqVisitedTowns[q.id];
                if (player._kqGoldSpent) delete player._kqGoldSpent[q.id];
                if (player._kqActionDone) delete player._kqActionDone[q.id];

                kqData.active.splice(i, 1);

                // Track failures for demotion
                player._kqFailCount = (player._kqFailCount || 0) + 1;
                player._kqLastFailDay = day;
            }
        }

        // Check expiration of available quests and personal assignment
        for (var j = kqData.available.length - 1; j >= 0; j--) {
            if (kqData.available[j].expiresDay && day > kqData.available[j].expiresDay) {
                kqData.available.splice(j, 1);
            }
        }
        if (kqData.personalAssignment && kqData.personalAssignment.expiresDay && day > kqData.personalAssignment.expiresDay) {
            // Expired personal assignment = rejection penalty
            var pa = kqData.personalAssignment;
            var paRepLoss = Math.ceil((pa.rejectionPenalty ? pa.rejectionPenalty.rep : 3) * 1.5);
            var paRelLoss = Math.ceil((pa.rejectionPenalty ? pa.rejectionPenalty.kingRel : 4) * 1.5);
            Player.modifyReputation(kingdomId, -paRepLoss);
            var k = null;
            try { k = Engine.findKingdom(kingdomId); } catch(e) {}
            if (k && k.king) Player.modifyRelationship(k.king, -paRelLoss);
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ Ignored royal assignment: ' + pa.title + ' (-' + paRepLoss + ' rep)', 'warning');
            kqData.personalAssignment = null;
        }

        // Track visit_towns progress for active quests
        if (player.townId && !player.traveling) {
            for (var qi = 0; qi < kqData.active.length; qi++) {
                var aq = kqData.active[qi];
                if (aq.requirements.action) {
                    var act = aq.requirements.action;
                    if (act.type === 'visit_towns' || act.type === 'visit_foreign' || act.type === 'visit_enemy_towns') {
                        var currentTown = Engine.findTown(player.townId);
                        if (currentTown) {
                            var validVisit = true;
                            if (act.type === 'visit_foreign' && currentTown.kingdomId === kingdomId) validVisit = false;
                            if (act.type === 'visit_enemy_towns') {
                                var kingdom3 = null;
                                try { kingdom3 = Engine.findKingdom(kingdomId); } catch(e) {}
                                var isEnemy = false;
                                if (kingdom3 && kingdom3.atWar) {
                                    var warSet = kingdom3.atWar instanceof Set ? kingdom3.atWar : new Set(kingdom3.atWar);
                                    if (currentTown.kingdomId && warSet.has(currentTown.kingdomId)) isEnemy = true;
                                }
                                if (!isEnemy) validVisit = false;
                            }
                            if (validVisit) trackKQTownVisit(aq.id, player.townId);
                        }
                    }
                }
            }
        }

        // Generate new quests if needed
        generateKingdomQuests(kingdomId);

        // Check demotion from quest failures (3+ failures in 180 days)
        if ((player._kqFailCount || 0) >= 3 && player._kqLastFailDay && (day - player._kqLastFailDay) < 180) {
            // Reset counter but warn
            player._kqFailCount = 0;
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ The king is displeased with your repeated quest failures!', 'warning');
            Player.modifyReputation(kingdomId, -5);
        }
    }

    function getAvailableInteractions(personId) {
        _sync();
        var person = Engine.findPerson(personId);
        if (!person) return [];
        var cooldownCount = Player.getInteractionCooldown(personId);
        var atLimit = cooldownCount >= (CONFIG.NPC_INTERACTION_DAILY_LIMIT || 3);
        var hasSocialInsight = Player.hasSkill('social_insight') || Player.hasSkill('charismatic');

        var interactions = [];
        var socialInteractions = (typeof SOCIAL_INTERACTIONS !== 'undefined') ? SOCIAL_INTERACTIONS : [];

        for (var i = 0; i < socialInteractions.length; i++) {
            var si = socialInteractions[i];
            var gain = Player.calculateInteractionGain(si, person);
            var canAfford = player.gold >= (si.cost || 0);

            var rating = 'neutral';
            if (gain >= 3) rating = 'great';
            else if (gain >= 1) rating = 'good';
            else if (gain >= 0) rating = 'neutral';
            else rating = 'bad';

            interactions.push({
                id: si.id,
                name: si.name,
                icon: si.icon,
                description: si.description,
                cost: si.cost || 0,
                gain: gain,
                rating: rating,
                showRating: hasSocialInsight,
                available: !atLimit && canAfford,
                atCooldownLimit: atLimit,
                dateProgress: si.dateProgress || 0,
                timeHours: si.timeHours || 1
            });
        }

        // Trait-reveal tailored interactions — appear when personality traits are known
        var traitInteractions = _getTraitBasedInteractions(personId, person);
        for (var ti = 0; ti < traitInteractions.length; ti++) {
            var tInt = traitInteractions[ti];
            interactions.push({
                id: tInt.id,
                name: tInt.name,
                icon: tInt.icon,
                description: tInt.description,
                cost: 0,
                gain: tInt.gain,
                rating: tInt.gain >= 3 ? 'great' : 'good',
                showRating: hasSocialInsight,
                available: !atLimit,
                atCooldownLimit: atLimit,
                dateProgress: tInt.dateProgress || 15,
                timeHours: 1,
                isTraitInteraction: true
            });
        }

        // NPC Gossip — available at relationship 20+ based on occupation
        var relLevel = player.relationships[personId] ? player.relationships[personId].level : 0;
        if (relLevel >= 20) {
            var day = 0;
            try { day = Engine.getDay(); } catch(e) {}
            if (!player._npcGossipCooldowns) player._npcGossipCooldowns = {};
            var gossipOnCooldown = (player._npcGossipCooldowns[personId] || 0) >= day;
            var gossipDesc = _getGossipDescription(person);
            if (gossipDesc) {
                interactions.push({
                    id: 'ask_gossip',
                    name: 'Ask for Information',
                    icon: '👂',
                    description: gossipDesc,
                    cost: 0,
                    gain: 0.5,
                    rating: 'good',
                    showRating: false,
                    available: !atLimit && !gossipOnCooldown,
                    atCooldownLimit: atLimit,
                    dateProgress: 5,
                    timeHours: 1,
                    isGossip: true,
                    gossipCooldown: gossipOnCooldown
                });
            }
        }

        // Relationship-gated jobs — available at occupation-specific thresholds
        var jobInteractions = _getRelationshipJobs(personId, person, relLevel);
        for (var ji = 0; ji < jobInteractions.length; ji++) {
            interactions.push(jobInteractions[ji]);
        }

        // Noble personality-based dialogue — different interactions based on noble personality
        var nobleDialogues = _getNoblePersonalityDialogue(personId, person, relLevel);
        for (var ndi = 0; ndi < nobleDialogues.length; ndi++) {
            interactions.push(nobleDialogues[ndi]);
        }

        // Noble favor requests — show if this noble has an active request
        if (relLevel >= 20 && (person.occupation === 'noble' || person.isNoble)) {
            var favorRequests = [];
            try { favorRequests = Player.getNobleFavorRequests ? Player.getNobleFavorRequests() : []; } catch(e) {}
            for (var fri = 0; fri < favorRequests.length; fri++) {
                var freq = favorRequests[fri];
                if (freq.nobleId === personId && freq.status === 'active') {
                    var fDay = 0;
                    try { fDay = Engine.getDay(); } catch(e) {}
                    var daysLeft = Math.max(0, freq.expiresDay - fDay);
                    var reqDesc = freq.description;
                    if (freq.resource) {
                        var reqRes = null;
                        try { reqRes = Player.findResource(freq.resource); } catch(e) {}
                        reqDesc += ' (Need: ' + freq.qty + ' ' + (reqRes ? reqRes.name : freq.resource) + ')';
                    } else if (freq.goldCost) {
                        reqDesc += ' (Need: ' + freq.goldCost + 'g)';
                    }
                    interactions.push({
                        id: 'fulfill_noble_favor',
                        name: '👑 ' + freq.title,
                        icon: '👑',
                        description: reqDesc + ' — ' + daysLeft + ' days remaining',
                        cost: 0,
                        gain: freq.rewardRel,
                        rating: 'great',
                        showRating: false,
                        available: true,
                        atCooldownLimit: false,
                        dateProgress: 0,
                        timeHours: 1,
                        isFavor: true
                    });
                }
            }
        }

        // v9p33river360: Secrets — keep secret (for NPCs whose secrets we know)
        if (Player.hasSecretsFor && Player.hasSecretsFor(personId) && relLevel >= 30) {
            interactions.push({
                id: 'keep_secret',
                name: 'Keep Secret',
                icon: '🤫',
                description: 'Promise to keep one of ' + (person.firstName || 'their') + '\'s secrets',
                cost: 0,
                gain: 4,
                rating: 'good',
                showRating: false,
                available: !atLimit,
                atCooldownLimit: atLimit,
                dateProgress: 5,
                timeHours: 1,
                isSecret: true
            });
        }

        // v9p33river360: Secrets — share secret (with any NPC, from any source)
        if (Player.hasAnySecrets && Player.hasAnySecrets() && relLevel >= 10) {
            interactions.push({
                id: 'share_secret',
                name: 'Share a Secret',
                icon: '🗣️',
                description: 'Tell ' + (person.firstName || 'them') + ' someone else\'s secret',
                cost: 0,
                gain: 8,
                rating: 'great',
                showRating: false,
                available: !atLimit,
                atCooldownLimit: atLimit,
                dateProgress: 10,
                timeHours: 1,
                isSecret: true
            });
        }

        return interactions;
    }

    // ── Noble Personality-Based Dialogue ────────────────────────
    function _getNoblePersonalityDialogue(personId, person, relLevel) {
        var dialogues = [];
        if (relLevel < 30) return dialogues;
        var occ = person.occupation || '';
        if (occ !== 'noble' && !person.isNoble) return dialogues;

        var pers = person.personality || {};
        var fn = person.firstName || 'Noble';
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}

        // Each noble personality type gets unique interaction options at relationship thresholds
        if ((pers.ambition || 50) > 55 && relLevel >= 30) {
            dialogues.push({
                id: 'noble_discuss_power',
                name: '⚔️ Discuss Power Plays',
                icon: '⚔️',
                description: fn + ' is ambitious — discuss strategies for gaining influence at court',
                cost: 0,
                gain: 3.0,
                rating: 'good',
                showRating: false,
                available: true,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 1,
                isNobleDialogue: true
            });
        }

        if ((pers.loyalty || 50) > 55 && relLevel >= 30) {
            dialogues.push({
                id: 'noble_discuss_duty',
                name: '🛡️ Discuss Duty to the Crown',
                icon: '🛡️',
                description: fn + ' is loyal — bond over shared devotion to the kingdom',
                cost: 0,
                gain: 3.0,
                rating: 'good',
                showRating: false,
                available: true,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 1,
                isNobleDialogue: true
            });
        }

        if ((pers.intelligence || 50) > 55 && relLevel >= 30) {
            dialogues.push({
                id: 'noble_discuss_strategy',
                name: '🧠 Discuss Kingdom Strategy',
                icon: '🧠',
                description: fn + ' is insightful — discuss economic and military strategies',
                cost: 0,
                gain: 3.0,
                rating: 'good',
                showRating: false,
                available: true,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 1,
                isNobleDialogue: true
            });
        }

        if ((pers.warmth || 50) > 55 && relLevel >= 30) {
            dialogues.push({
                id: 'noble_discuss_people',
                name: '❤️ Discuss the Commonfolk',
                icon: '❤️',
                description: fn + ' cares about people — discuss the welfare of the kingdom\'s citizens',
                cost: 0,
                gain: 3.0,
                rating: 'good',
                showRating: false,
                available: true,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 1,
                isNobleDialogue: true
            });
        }

        if ((pers.frugality || 50) > 55 && relLevel >= 30) {
            dialogues.push({
                id: 'noble_discuss_economy',
                name: '💰 Discuss Trade & Economy',
                icon: '💰',
                description: fn + ' is financially shrewd — discuss market trends and the kingdom treasury',
                cost: 0,
                gain: 3.0,
                rating: 'good',
                showRating: false,
                available: true,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 1,
                isNobleDialogue: true
            });
        }

        return dialogues;
    }

    // ── Trait-Based Interaction Helpers ──────────────────────
    function _getTraitBasedInteractions(personId, person) {
        var interactions = [];
        var revealed = player.revealedTraits[personId];
        if (!revealed || !revealed.traits) return interactions;
        var pers = person.personality || {};
        var knownTraits = revealed.traits;

        if (knownTraits.ambition && pers.ambition > 55) {
            interactions.push({
                id: 'trait_discuss_ambitions', name: 'Discuss Ambitions', icon: '🌟',
                description: 'You know they\'re ambitious — discuss their goals for a deeper bond',
                gain: 4.0, dateProgress: 20
            });
        }
        if (knownTraits.warmth && pers.warmth > 55) {
            interactions.push({
                id: 'trait_heartfelt_chat', name: 'Heartfelt Chat', icon: '❤️',
                description: 'You know they\'re warm-hearted — open up for a meaningful conversation',
                gain: 4.0, dateProgress: 20
            });
        }
        if (knownTraits.intelligence && pers.intelligence > 55) {
            interactions.push({
                id: 'trait_intellectual_debate', name: 'Intellectual Debate', icon: '📚',
                description: 'You know they\'re sharp — engage in stimulating discussion',
                gain: 3.5, dateProgress: 18
            });
        }
        if (knownTraits.honesty && pers.honesty > 55) {
            interactions.push({
                id: 'trait_honest_confession', name: 'Honest Confession', icon: '🤲',
                description: 'You know they value honesty — share something genuine about yourself',
                gain: 3.5, dateProgress: 18
            });
        }
        if (knownTraits.loyalty && pers.loyalty > 55) {
            interactions.push({
                id: 'trait_pledge_loyalty', name: 'Pledge Mutual Loyalty', icon: '🤝',
                description: 'You know they value loyalty — affirm your commitment to the friendship',
                gain: 4.0, dateProgress: 20
            });
        }
        if (knownTraits.frugality && pers.frugality > 55) {
            interactions.push({
                id: 'trait_share_savings_tips', name: 'Share Savings Tips', icon: '💰',
                description: 'You know they\'re frugal — bond over penny-pinching wisdom',
                gain: 3.0, dateProgress: 15
            });
        }
        return interactions;
    }

    // ── NPC Gossip System Helpers ─────────────────────────────
    function _getGossipDescription(person) {
        var occ = person.occupation || '';
        if (occ === 'farmer' || occ === 'fisher') return 'Ask about harvest forecasts, weather patterns, and rural gossip';
        if (occ === 'merchant' || occ === 'trader') return 'Ask about prices in other towns and trade opportunities';
        if (occ === 'guard' || occ === 'soldier') return 'Ask about security threats, bandit activity, and military movements';
        if (occ === 'innkeeper' || occ === 'barkeep' || occ === 'tavern_keeper') return 'Ask about town gossip, visiting travelers, and local rumors';
        if (occ === 'doctor' || occ === 'healer' || occ === 'herbalist') return 'Ask about disease outbreaks, medicinal herbs, and health concerns';
        if (occ === 'scholar' || occ === 'priest' || occ === 'teacher' || occ === 'monk') return 'Ask about historical knowledge, local lore, and scholarly news';
        if (occ === 'noble' || person.isNoble) return 'Ask about court politics, noble scandals, and kingdom affairs';
        if (occ === 'blacksmith' || occ === 'carpenter' || occ === 'baker' || occ === 'craftsman') return 'Ask about material availability, supply shortages, and craft guild news';
        return null;
    }

    function _generateGossipMessage(person) {
        var occ = person.occupation || '';
        var fn = person.firstName || 'Someone';
        var pers = person.personality || {};
        var relLevel = player.relationships[person.id] ? player.relationships[person.id].level : 0;
        var isHonest = (pers.honesty || 50) > 60;

        var rng = Engine.getRng ? Engine.getRng() : null;
        var townId = person.townId || player.townId;
        var town = null;
        try { town = Engine.getTown(townId); } catch(e) {}

        // Higher relationship = more useful info
        var detailLevel = relLevel >= 60 ? 'detailed' : relLevel >= 40 ? 'good' : 'vague';

        if (occ === 'farmer' || occ === 'fisher') {
            var seasonMsgs = {
                vague: [
                    fn + ' mutters something about the harvest — sounds like it could go either way.',
                    fn + ' mentions the weather has been unpredictable lately.'
                ],
                good: [
                    fn + ' says the harvest looks ' + (rng && rng.chance(0.5) ? 'promising this season' : 'worse than usual') + '.',
                    fn + ' warns about ' + (rng && rng.chance(0.5) ? 'possible flooding in the lowlands' : 'a dry spell coming') + '.'
                ],
                detailed: [
                    fn + ' shares that food prices will likely ' + (rng && rng.chance(0.5) ? 'rise significantly — stock up now while it\'s cheap' : 'drop soon — the harvest is bountiful') + '.',
                    fn + ' confides: "Between us, I\'ve heard the grain supply in neighboring towns is running low. Smart traders could profit."'
                ]
            };
            return (seasonMsgs[detailLevel] || seasonMsgs.vague)[rng ? Math.floor(rng.random() * 2) : 0];
        }

        if (occ === 'merchant' || occ === 'trader') {
            // Try to give actual useful price info
            var tradeMsgs = {
                vague: [
                    fn + ' mentions trade has been ' + (rng && rng.chance(0.5) ? 'slow' : 'brisk') + ' lately.',
                    fn + ' hints that some goods are overpriced in nearby towns.'
                ],
                good: [
                    fn + ' reveals: "I\'ve heard there\'s strong demand for ' + _getRandomTradableGood(rng) + ' a few towns over."',
                    fn + ' tips you off: "Prices for ' + _getRandomTradableGood(rng) + ' are ' + (rng && rng.chance(0.5) ? 'very low' : 'unusually high') + ' in the region right now."'
                ],
                detailed: [
                    fn + ' leans in: "A caravan just arrived from the east — they\'re practically giving away ' + _getRandomTradableGood(rng) + '. Buy now, sell south. Trust me."',
                    fn + ' whispers: "Word in the merchants\' circle is that ' + _getRandomTradableGood(rng) + ' supply is drying up. Anyone holding stock will make a fortune soon."'
                ]
            };
            return (tradeMsgs[detailLevel] || tradeMsgs.vague)[rng ? Math.floor(rng.random() * 2) : 0];
        }

        if (occ === 'guard' || occ === 'soldier') {
            var guardMsgs = {
                vague: [
                    fn + ' mentions something about increased patrols on the roads.',
                    fn + ' says the watch has been busy lately but won\'t go into details.'
                ],
                good: [
                    fn + ' warns: "Bandits have been spotted on the roads ' + (rng && rng.chance(0.5) ? 'to the north' : 'south of town') + '. Travel carefully."',
                    fn + ' shares: "' + (rng && rng.chance(0.5) ? 'The garrison is understaffed — could be trouble if there\'s an attack.' : 'We\'ve beefed up patrols. The roads should be safer for now.') + '"'
                ],
                detailed: [
                    fn + ' confides: "Between us? ' + (rng && rng.chance(0.5) ? 'There are rumors of war brewing. The king\'s been calling in soldiers from the countryside.' : 'I overheard the captain — a smuggling ring is operating in town. Watch your back.') + '"',
                    fn + ' whispers: "The military is moving troops ' + (rng && rng.chance(0.5) ? 'toward the border' : 'to fortify the capital') + '. Something big is coming. You didn\'t hear it from me."'
                ]
            };
            return (guardMsgs[detailLevel] || guardMsgs.vague)[rng ? Math.floor(rng.random() * 2) : 0];
        }

        if (occ === 'innkeeper' || occ === 'barkeep' || occ === 'tavern_keeper') {
            var innMsgs = {
                vague: [
                    fn + ' shares some local gossip, but it\'s nothing you haven\'t heard before.',
                    fn + ' mentions a few interesting travelers have passed through recently.'
                ],
                good: [
                    fn + ' leans over: "' + (rng && rng.chance(0.5) ? 'A wealthy merchant was bragging about huge profits from ' + _getRandomTradableGood(rng) + ' last night.' : 'I overheard some nobles arguing about the king\'s latest decision. Tensions are high.') + '"',
                    fn + ' shares: "A group of ' + (rng && rng.chance(0.5) ? 'mercenaries were recruiting here last night. Something\'s stirring.' : 'traders from a foreign kingdom just arrived. They\'re looking for local contacts.') + '"'
                ],
                detailed: [
                    fn + ' whispers urgently: "' + (rng && rng.chance(0.5) ? 'A spy was caught last week — the kingdom is on high alert. Be careful what you say in public.' : 'A noble was in here drunk, boasting about a scheme against another noble. Court intrigue at its finest.') + '"',
                    fn + ' confides: "' + (rng && rng.chance(0.5) ? 'Overheard a caravan master say the roads east are completely blocked by bandits. Big money in escorted convoys right now.' : 'Between us — the king is planning a festival soon. Smart merchants are already stockpiling luxury goods.') + '"'
                ]
            };
            return (innMsgs[detailLevel] || innMsgs.vague)[rng ? Math.floor(rng.random() * 2) : 0];
        }

        if (occ === 'noble' || person.isNoble) {
            var nobleMsgs = {
                vague: [
                    fn + ' makes vague comments about court politics. Hard to tell what\'s real.',
                    fn + ' mentions some dissatisfaction among the nobility but changes the subject.'
                ],
                good: [
                    fn + ' shares: "' + (rng && rng.chance(0.5) ? 'The king has been making unpopular decisions. Several nobles are... displeased.' : 'A new alliance is being discussed between two powerful noble houses. Watch that space.') + '"',
                    fn + ' reveals: "' + (rng && rng.chance(0.5) ? 'Taxes may change soon. The king is considering a new economic policy.' : 'A noble has been pushing for war. The court is divided on the matter.') + '"'
                ],
                detailed: [
                    fn + ' leans in conspiratorially: "' + (rng && rng.chance(0.5) ? 'I have it on good authority that the king plans to demote a certain noble. If you want their former position...' : 'There\'s a plot forming against the crown. I\'m telling you because I trust you — tread carefully.') + '"',
                    fn + ' confides quietly: "' + (rng && rng.chance(0.5) ? 'The king\'s health isn\'t what it was. Smart nobles are already positioning themselves for... succession.' : 'A foreign kingdom is secretly negotiating with one of our nobles. Treason, some would call it.') + '"'
                ]
            };
            return (nobleMsgs[detailLevel] || nobleMsgs.vague)[rng ? Math.floor(rng.random() * 2) : 0];
        }

        // Default gossip for other occupations
        var defaultMsgs = [
            fn + ' shares some local gossip: "' + (rng && rng.chance(0.5) ? 'Business has been good for most folks around here.' : 'People are worried about the economy lately.') + '"',
            fn + ' mentions: "' + (rng && rng.chance(0.5) ? 'The town feels busier than usual. Trade must be picking up.' : 'I heard someone important is visiting town soon.') + '"'
        ];
        return defaultMsgs[rng ? Math.floor(rng.random() * 2) : 0];
    }

    function _getRandomTradableGood(rng) {
        var goods = ['grain', 'wool', 'iron', 'leather', 'cloth', 'salt', 'spices', 'wine', 'ale', 'tools', 'fish', 'meat', 'pottery', 'rope', 'planks'];
        return goods[rng ? Math.floor(rng.random() * goods.length) : 0];
    }

    // ── Relationship-Gated Jobs ──────────────────────────────
    function _getRelationshipJobs(personId, person, relLevel) {
        var jobs = [];
        var occ = person.occupation || '';
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (!player._npcJobCooldowns) player._npcJobCooldowns = {};

        // Farmer 30+: Harvest help (seasonal)
        if ((occ === 'farmer' || occ === 'fisher') && relLevel >= 30) {
            var jobKey = personId + '_harvest_help';
            var onCooldown = (player._npcJobCooldowns[jobKey] || 0) > day;
            jobs.push({
                id: 'npc_job_harvest',
                name: '🌾 Help with Harvest',
                icon: '🌾',
                description: person.firstName + ' could use help bringing in the harvest. Good pay for a day\'s work.',
                cost: 0,
                gain: 2.0,
                rating: 'good',
                showRating: false,
                available: !onCooldown,
                atCooldownLimit: false,
                dateProgress: 10,
                timeHours: 4,
                isJob: true,
                jobType: 'harvest_help',
                jobCooldown: onCooldown
            });
        }

        // Merchant 40+: Trade caravan assistance
        if ((occ === 'merchant' || occ === 'trader') && relLevel >= 40) {
            var jobKey2 = personId + '_caravan_assist';
            var onCooldown2 = (player._npcJobCooldowns[jobKey2] || 0) > day;
            jobs.push({
                id: 'npc_job_caravan',
                name: '🐪 Join Trade Caravan',
                icon: '🐪',
                description: person.firstName + ' is sending a caravan and could use an extra hand. Travel and profit!',
                cost: 0,
                gain: 2.0,
                rating: 'good',
                showRating: false,
                available: !onCooldown2 && !player.traveling,
                atCooldownLimit: false,
                dateProgress: 15,
                timeHours: 8,
                isJob: true,
                jobType: 'caravan_assist',
                jobCooldown: onCooldown2
            });
        }

        // Guard 40+: Militia training
        if ((occ === 'guard' || occ === 'soldier') && relLevel >= 40) {
            var jobKey3 = personId + '_militia_training';
            var onCooldown3 = (player._npcJobCooldowns[jobKey3] || 0) > day;
            jobs.push({
                id: 'npc_job_militia',
                name: '⚔️ Militia Training',
                icon: '⚔️',
                description: person.firstName + ' offers to train you in combat. Builds fighting skill and earns respect.',
                cost: 0,
                gain: 2.5,
                rating: 'good',
                showRating: false,
                available: !onCooldown3,
                atCooldownLimit: false,
                dateProgress: 12,
                timeHours: 4,
                isJob: true,
                jobType: 'militia_training',
                jobCooldown: onCooldown3
            });
        }

        // Innkeeper 30+: Work the bar
        if ((occ === 'innkeeper' || occ === 'barkeep' || occ === 'tavern_keeper') && relLevel >= 30) {
            var jobKey4 = personId + '_bar_work';
            var onCooldown4 = (player._npcJobCooldowns[jobKey4] || 0) > day;
            jobs.push({
                id: 'npc_job_bar',
                name: '🍺 Work the Bar',
                icon: '🍺',
                description: person.firstName + ' needs help running the tavern tonight. Earn gold and meet people.',
                cost: 0,
                gain: 1.5,
                rating: 'good',
                showRating: false,
                available: !onCooldown4,
                atCooldownLimit: false,
                dateProgress: 10,
                timeHours: 4,
                isJob: true,
                jobType: 'bar_work',
                jobCooldown: onCooldown4
            });
        }

        return jobs;
    }

    function interactWithNPC(personId, interactionId) {
        _sync();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };
        if (person.townId !== player.townId) return { success: false, message: 'Not in same town.' };
        if (player.traveling) return { success: false, message: 'Cannot interact while traveling.' };

        // Noble access check
        var talkCheck = Player.canTalkTo(personId);
        if (!talkCheck.canTalk) return { success: false, message: talkCheck.reason };

        // Investigator rejection
        if ((player.investigatorCaught[personId] || 0) >= 2) {
            return { success: false, message: 'This person will never speak to you again.' };
        }

        // Cooldown check
        var cooldownCount = Player.getInteractionCooldown(personId);
        var limit = CONFIG.NPC_INTERACTION_DAILY_LIMIT || 3;
        if (cooldownCount >= limit) {
            return { success: false, message: person.firstName + ' says: "We\'ve talked enough for today. Come back tomorrow!"' };
        }

        // Find interaction config
        var socialInteractions = (typeof SOCIAL_INTERACTIONS !== 'undefined') ? SOCIAL_INTERACTIONS : [];
        var interaction = null;
        for (var i = 0; i < socialInteractions.length; i++) {
            if (socialInteractions[i].id === interactionId) { interaction = socialInteractions[i]; break; }
        }

        // Handle special interaction types: gossip, trait-based, jobs, noble dialogue, favors
        if (!interaction) {
            if (interactionId === 'ask_gossip') {
                return _handleGossipInteraction(personId, person);
            }
            if (interactionId && interactionId.indexOf('trait_') === 0) {
                return _handleTraitInteraction(personId, person, interactionId);
            }
            if (interactionId && interactionId.indexOf('npc_job_') === 0) {
                return _handleJobInteraction(personId, person, interactionId);
            }
            if (interactionId && interactionId.indexOf('noble_discuss_') === 0) {
                return _handleNobleDialogueInteraction(personId, person, interactionId);
            }
            if (interactionId === 'fulfill_noble_favor') {
                return Player.fulfillNobleFavor ? Player.fulfillNobleFavor(personId) : { success: false, message: 'Favor system unavailable.' };
            }
            // v9p33river360: secrets — these are intercepted by UI for
            // sub-modal selection, but we handle fallback here
            if (interactionId === 'keep_secret') {
                return { success: true, message: 'Select a secret to keep.', isSecretSelection: true, secretType: 'keep', personId: personId };
            }
            if (interactionId === 'share_secret') {
                return { success: true, message: 'Select a secret to share.', isSecretSelection: true, secretType: 'share', personId: personId };
            }
            return { success: false, message: 'Unknown interaction.' };
        }

        // Cost check
        if (player.gold < (interaction.cost || 0)) {
            return { success: false, message: 'Need ' + interaction.cost + 'g (have ' + player.gold + 'g).' };
        }

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) {
            Game.advanceTicks(Math.max(1, Math.ceil(interaction.timeHours * 2.5)));
        }

        // Pay cost
        if (interaction.cost > 0) {
            player.gold -= interaction.cost;
            player.stats.totalGoldSpent += interaction.cost;
        }

        // Calculate and apply relationship gain
        var gain = Player.calculateInteractionGain(interaction, person);
        var rel = Player.getRelationship(personId);
        Player.modifyRelationship(personId, gain, rel.type === 'spouse' ? 'spouse' : undefined);

        // Progress trait/quirk reveal
        var revealMsg = '';
        if (interaction.dateProgress > 0) {
            if (!player.dateProgress[personId]) {
                player.dateProgress[personId] = { traitProgress: 0, quirkProgress: 0 };
            }
            var dp = player.dateProgress[personId];
            var progress = interaction.dateProgress;
            if (person.quirks && person.quirks.includes('secretive')) progress = Math.floor(progress / 2);

            var revealed = player.revealedTraits[personId] || { traits: {}, quirks: [] };
            var allTraitNames = person.personality ? Object.keys(person.personality) : [];
            var unrevealedTraits = allTraitNames.filter(function(t) { return !(t in revealed.traits); });
            var personQuirks = person.quirks || [];
            var unrevealedQuirks = personQuirks.filter(function(q) { return !revealed.quirks.includes(q); });

            if (unrevealedTraits.length > 0 || unrevealedQuirks.length > 0) {
                var progressQuirk = unrevealedQuirks.length > 0 && (unrevealedTraits.length === 0 || dp.traitProgress > dp.quirkProgress);
                if (progressQuirk) dp.quirkProgress += progress;
                else dp.traitProgress += progress;

                if (dp.traitProgress >= 100 && unrevealedTraits.length > 0) {
                    dp.traitProgress -= 100;
                    var reveal = Player.revealTrait(personId, 'vague');
                    if (reveal && reveal.message) revealMsg = ' ' + reveal.message;
                } else if (dp.quirkProgress >= 100 && unrevealedQuirks.length > 0) {
                    dp.quirkProgress -= 100;
                    var reveal2 = Player.revealTrait(personId, 'vague');
                    if (reveal2 && reveal2.message) revealMsg = ' ' + reveal2.message;
                }
            }
        }

        // Small chance to discover gift preference during interaction (~10%)
        var giftDiscoverMsg = '';
        var _giftRng = Engine.getRng ? Engine.getRng() : null;
        if (_giftRng && _giftRng.chance(0.10)) {
            var _prefs = Player.getNPCGiftPreferences(personId);
            if (!player.discoveredGiftPrefs) player.discoveredGiftPrefs = {};
            if (!player.discoveredGiftPrefs[personId]) player.discoveredGiftPrefs[personId] = {};
            var _disc = player.discoveredGiftPrefs[personId];
            var _discDay = 0;
            try { _discDay = Engine.getDay(); } catch(e) {}
            if (!_disc.favorite && _giftRng.chance(0.5)) {
                _disc.favorite = _prefs.favoriteGift;
                _disc.favoriteDay = _discDay;
                var _fRes = Player.findResource(_prefs.favoriteGift);
                giftDiscoverMsg = ' 💡 You noticed ' + person.firstName + ' seems to really like ' + (_fRes ? _fRes.name : _prefs.favoriteGift) + '!';
            } else if (!_disc.hated) {
                _disc.hated = _prefs.hatedGift;
                _disc.hatedDay = _discDay;
                var _hRes = Player.findResource(_prefs.hatedGift);
                giftDiscoverMsg = ' 💡 You got the sense ' + person.firstName + ' dislikes ' + (_hRes ? _hRes.name : _prefs.hatedGift) + '.';
            }
        }

        // Track cooldown
        if (!player._npcInteractions) player._npcInteractions = {};
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
            player._npcInteractions[personId] = { day: day, count: 0 };
        }
        player._npcInteractions[personId].count++;

        var remainingToday = limit - player._npcInteractions[personId].count;

        // Build message
        var gainSign = gain >= 0 ? '+' : '';
        var gainColor = gain >= 2 ? '💚' : gain >= 0 ? '💛' : '❤️‍🩹';
        var msg = interaction.name + ': ' + gainColor + ' Relationship ' + gainSign + gain.toFixed(1) + '.';
        if (interaction.cost > 0) msg += ' Cost: ' + interaction.cost + 'g.';
        if (remainingToday > 0) msg += ' (' + remainingToday + ' interaction' + (remainingToday !== 1 ? 's' : '') + ' left today)';
        else msg += ' (No more interactions today)';
        msg += revealMsg;
        msg += giftDiscoverMsg;

        Player.grantXP(2, 'social_interaction');
        // v9p33river355: record this interaction as a memory on
        // elite merchants and nobles so it can surface in later
        // dialog. Sentiment is positive for >=1 gain, negative for
        // a clear loss, neutral otherwise.
        try {
            var _memSent = gain >= 1 ? 'positive' : (gain <= -1 ? 'negative' : 'neutral');
            recordNpcMemory(person, 'interaction', interaction.name, { sentiment: _memSent });
        } catch (_eMem) { /* defensive */ }

        // v9p33river360: secret discovery roll after each interaction
        var _secretMsg = null;
        try {
            if (Player.maybeDiscoverSecret) {
                _secretMsg = Player.maybeDiscoverSecret(personId);
            }
        } catch (_eSec) { /* defensive */ }
        if (_secretMsg) {
            msg += '\n\n🤫 ' + _secretMsg;
        }

        return { success: true, message: msg, gain: gain, interactionId: interactionId, secretDiscovered: !!_secretMsg };
    }

    // ── Special Interaction Handlers ─────────────────────────

    function _handleGossipInteraction(personId, person) {
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}

        // Check gossip cooldown (once per day per NPC)
        if (!player._npcGossipCooldowns) player._npcGossipCooldowns = {};
        if ((player._npcGossipCooldowns[personId] || 0) >= day) {
            return { success: false, message: person.firstName + ' says: "I\'ve told you everything I know for now. Try again tomorrow."' };
        }

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) {
            Game.advanceTicks(3);
        }

        // Set cooldown
        player._npcGossipCooldowns[personId] = day;

        // Generate gossip message
        var gossipMsg = _generateGossipMessage(person);

        // Small relationship gain
        Player.modifyRelationship(personId, 0.5);

        // Track interaction cooldown
        if (!player._npcInteractions) player._npcInteractions = {};
        if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
            player._npcInteractions[personId] = { day: day, count: 0 };
        }
        player._npcInteractions[personId].count++;

        Player.grantXP(2, 'gossip');
        return { success: true, message: '👂 ' + gossipMsg };
    }

    function _handleTraitInteraction(personId, person, interactionId) {
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}

        var traitInteractions = _getTraitBasedInteractions(personId, person);
        var matched = null;
        for (var i = 0; i < traitInteractions.length; i++) {
            if (traitInteractions[i].id === interactionId) { matched = traitInteractions[i]; break; }
        }
        if (!matched) return { success: false, message: 'That conversation topic is no longer available.' };

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) {
            Game.advanceTicks(3);
        }

        // Apply relationship gain
        var gain = matched.gain;
        Player.modifyRelationship(personId, gain);

        // Progress trait reveal
        if (matched.dateProgress > 0) {
            if (!player.dateProgress[personId]) {
                player.dateProgress[personId] = { traitProgress: 0, quirkProgress: 0 };
            }
            player.dateProgress[personId].traitProgress += matched.dateProgress;
        }

        // Track interaction cooldown
        if (!player._npcInteractions) player._npcInteractions = {};
        if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
            player._npcInteractions[personId] = { day: day, count: 0 };
        }
        player._npcInteractions[personId].count++;

        // Generate context-aware dialogue
        var fn = person.firstName || 'Someone';
        var rng = null;
        try { rng = Engine.getRng(); } catch(e) {}
        var pick = function(arr) { return rng ? rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]; };
        var dialogueMsg = '';

        switch (interactionId) {
            case 'trait_discuss_ambitions':
                dialogueMsg = pick([
                    fn + '\'s eyes light up: "You want to hear my plans? I aim to own the largest enterprise in this region. I will not rest until I do."',
                    fn + ' leans forward eagerly: "Most people think small. Not me. I see what this town could become — and I intend to build it."',
                    fn + ' grins: "Ambition is not a sin, it is a virtue. The world rewards those who reach for more."',
                    fn + ' speaks with fire: "Every morning I wake up and ask myself — what can I conquer today? That is how empires are built."',
                    fn + ' confides: "I was not born to greatness. I am carving my own path, stone by stone. And I will not stop."'
                ]);
                break;
            case 'trait_heartfelt_chat':
                dialogueMsg = pick([
                    fn + ' smiles gently: "Thank you for asking how I truly feel. So few people bother these days."',
                    fn + '\'s expression softens: "I worry about the families in town who are struggling. I wish I could do more for them."',
                    fn + ' takes a deep breath: "You know, some days the kindness of a friend is worth more than a bag of gold. Today is one of those days."',
                    fn + ' looks at you warmly: "I had a hard week. But talking to you... it reminds me that there are good people left in this world."',
                    fn + ' chuckles softly: "My mother always said the strongest thing a person can do is care. I try to live by that."'
                ]);
                break;
            case 'trait_intellectual_debate':
                dialogueMsg = pick([
                    fn + ' rubs their hands together: "Excellent! Let us debate — do you think trade tariffs help or harm the common folk? I have thoughts."',
                    fn + '\'s mind clearly races: "I have been reading about ancient irrigation techniques. The principles could transform how we farm here."',
                    fn + ' argues passionately: "The trouble with governance is that leaders confuse tradition with wisdom. Sometimes the old ways are simply the wrong ways."',
                    fn + ' challenges you: "Consider this — if every merchant paid a fair tax, would we even need noble patronage? Think carefully before you answer."',
                    fn + ' nods approvingly: "Finally, someone who can hold an intelligent conversation! Most people\'s eyes glaze over when I mention economics."'
                ]);
                break;
            case 'trait_honest_confession':
                dialogueMsg = pick([
                    fn + ' meets your eyes steadily: "I appreciate your honesty. Let me be honest too — I have made mistakes I am not proud of. But I own them."',
                    fn + ' speaks plainly: "The world would be better if more people said what they meant. I have always believed that truth, however uncomfortable, is the foundation of trust."',
                    fn + ' nods slowly: "I once lied to protect someone I loved. It haunts me still. Honesty is a harder path, but it is the right one."',
                    fn + ' looks relieved: "Thank you for being straightforward with me. I cannot abide flattery or manipulation. You are a rare sort."',
                    fn + ' pauses thoughtfully: "I will tell you something true — I am afraid of failing the people who depend on me. There. Now you know."'
                ]);
                break;
            case 'trait_pledge_loyalty':
                dialogueMsg = pick([
                    fn + ' clasps your hand firmly: "Loyalty is not given — it is earned. And you have earned mine. Whatever comes, I stand with you."',
                    fn + '\'s voice grows firm: "I do not throw that word around lightly. But you have been steadfast. I will not forget it."',
                    fn + ' looks you in the eye: "In my life, I can count my true allies on one hand. You are among them now."',
                    fn + ' nods solemnly: "My word is my bond. If you ever need me — truly need me — send word. I will come."',
                    fn + ' places a hand on your shoulder: "The world is full of fair-weather friends. I am not one of them. Remember that."'
                ]);
                break;
            case 'trait_share_savings_tips':
                dialogueMsg = pick([
                    fn + ' produces a small notebook: "Ah, a fellow penny-pincher! Let me show you — if you buy grain just after harvest, you save nearly forty percent."',
                    fn + ' grins knowingly: "The secret to wealth is not earning more. It is spending less. I have not paid full price for anything in years."',
                    fn + ' whispers conspiratorially: "Never buy tools on market day. Wait until Tuesday — the smiths are desperate to move inventory."',
                    fn + ' taps their nose: "I mend my own clothes, brew my own ale, and grow my own herbs. The gold I save goes to investments that pay dividends."',
                    fn + ' chuckles: "My neighbors think me miserly, but my pantry is full and my debts are zero. Who is laughing now?"'
                ]);
                break;
            default:
                dialogueMsg = fn + ' enjoys the conversation. Your shared understanding deepened the bond.';
        }

        var gainSign = gain >= 0 ? '+' : '';
        Player.grantXP(3, 'trait_interaction');
        return { success: true, message: dialogueMsg + ' 💚 Relationship ' + gainSign + gain.toFixed(1) };
    }

    function _handleJobInteraction(personId, person, interactionId) {
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (!player._npcJobCooldowns) player._npcJobCooldowns = {};
        var rng = Engine.getRng ? Engine.getRng() : null;

        var fn = person.firstName || 'Someone';
        var occ = person.occupation || '';

        if (interactionId === 'npc_job_harvest') {
            var jobKey = personId + '_harvest_help';
            if ((player._npcJobCooldowns[jobKey] || 0) > day) {
                return { success: false, message: fn + ' says: "I don\'t need help right now. Come back in a few days."' };
            }
            // Advance time (half a day)
            if (typeof Game !== 'undefined' && Game.advanceTicks) {
                Game.advanceTicks(10);
            }
            // Pay: 8-15g based on farming skill
            // v9p33river351: was checking 'farming' / 'advanced_farming'
            // which don't exist in SKILLS. Farming-adjacent player skills
            // are animal_husbandry (config.js:3545) and soil_knowledge
            // (config.js:3599). Use those — either grants the bonus pay.
            var farmSkill = Player.hasSkill('animal_husbandry') || Player.hasSkill('soil_knowledge');
            var harvestPay = farmSkill ? (12 + (rng ? Math.floor(rng.random() * 4) : 2)) : (8 + (rng ? Math.floor(rng.random() * 4) : 1));
            player.gold += harvestPay;
            Player.modifyRelationship(personId, 2.0);
            player._npcJobCooldowns[jobKey] = day + 7; // 7-day cooldown
            // Track cooldown
            if (!player._npcInteractions) player._npcInteractions = {};
            if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
                player._npcInteractions[personId] = { day: day, count: 0 };
            }
            player._npcInteractions[personId].count++;
            Player.grantXP(5, 'harvest_work');
            return { success: true, message: '🌾 You helped ' + fn + ' with the harvest! Earned ' + harvestPay + 'g. 💚 Relationship +2.0' };
        }

        if (interactionId === 'npc_job_caravan') {
            var jobKey2 = personId + '_caravan_assist';
            if ((player._npcJobCooldowns[jobKey2] || 0) > day) {
                return { success: false, message: fn + ' says: "No caravans going out right now. Check back later."' };
            }
            if (player.traveling) {
                return { success: false, message: 'You can\'t join a caravan while already traveling.' };
            }
            // Advance time (full day)
            if (typeof Game !== 'undefined' && Game.advanceTicks) {
                Game.advanceTicks(20);
            }
            // Pay: 15-25g + trade XP
            // v9p33river351: was checking 'merchant_discount' / 'trade_routes'
            // which don't exist. Real commerce-tree skills are haggler /
            // master_haggler (config.js:3487-3488) and trade_network
            // (config.js:3482). Use those — any of them grants the bonus.
            var merchantSkill = Player.hasSkill('haggler') || Player.hasSkill('master_haggler') || Player.hasSkill('trade_network');
            var caravanPay = merchantSkill ? (20 + (rng ? Math.floor(rng.random() * 6) : 3)) : (15 + (rng ? Math.floor(rng.random() * 6) : 2));
            player.gold += caravanPay;
            Player.modifyRelationship(personId, 2.0);
            player._npcJobCooldowns[jobKey2] = day + 14; // 14-day cooldown
            if (!player._npcInteractions) player._npcInteractions = {};
            if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
                player._npcInteractions[personId] = { day: day, count: 0 };
            }
            player._npcInteractions[personId].count++;
            Player.grantXP(8, 'caravan_assist');
            return { success: true, message: '🐪 You joined ' + fn + '\'s trade caravan! Earned ' + caravanPay + 'g and valuable trade experience. 💚 Relationship +2.0' };
        }

        if (interactionId === 'npc_job_militia') {
            var jobKey3 = personId + '_militia_training';
            if ((player._npcJobCooldowns[jobKey3] || 0) > day) {
                return { success: false, message: fn + ' says: "Rest up first. Training tomorrow."' };
            }
            // Advance time (half a day)
            if (typeof Game !== 'undefined' && Game.advanceTicks) {
                Game.advanceTicks(10);
            }
            // Combat XP + relationship
            Player.modifyRelationship(personId, 2.5);
            player._npcJobCooldowns[jobKey3] = day + 7; // 7-day cooldown
            if (!player._npcInteractions) player._npcInteractions = {};
            if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
                player._npcInteractions[personId] = { day: day, count: 0 };
            }
            player._npcInteractions[personId].count++;
            Player.grantXP(10, 'militia_training');
            // Slight combat skill boost (if skill system allows)
            player.stats.combatVictories = (player.stats.combatVictories || 0) + 0;
            return { success: true, message: '⚔️ ' + fn + ' put you through rigorous training! +10 XP and valuable combat experience. 💚 Relationship +2.5' };
        }

        if (interactionId === 'npc_job_bar') {
            var jobKey4 = personId + '_bar_work';
            if ((player._npcJobCooldowns[jobKey4] || 0) > day) {
                return { success: false, message: fn + ' says: "We\'re covered for tonight. Come back in a few days."' };
            }
            // Advance time (evening shift)
            if (typeof Game !== 'undefined' && Game.advanceTicks) {
                Game.advanceTicks(10);
            }
            // Pay: 5-10g + social bonuses
            var barPay = 5 + (rng ? Math.floor(rng.random() * 6) : 2);
            player.gold += barPay;
            Player.modifyRelationship(personId, 1.5);
            player._npcJobCooldowns[jobKey4] = day + 5; // 5-day cooldown

            // Bonus: meet 1-2 random people in town (small relationship gain)
            var _townPeople = [];
            try { _townPeople = Engine.getPeople(player.townId) || []; } catch(e) {}
            var _metCount = 0;
            var _metNames = [];
            if (_townPeople.length > 0 && rng) {
                var _shuffled = _townPeople.slice().sort(function() { return rng.random() - 0.5; });
                for (var _bp = 0; _bp < _shuffled.length && _metCount < 2; _bp++) {
                    var _bp2 = _shuffled[_bp];
                    if (_bp2.id === personId || _bp2.id === player.spouseId) continue;
                    if (!_bp2.alive) continue;
                    Player.modifyRelationship(_bp2.id, 1.0);
                    _metNames.push(_bp2.firstName);
                    _metCount++;
                }
            }

            if (!player._npcInteractions) player._npcInteractions = {};
            if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
                player._npcInteractions[personId] = { day: day, count: 0 };
            }
            player._npcInteractions[personId].count++;
            Player.grantXP(4, 'bar_work');
            var barMsg = '🍺 You worked the bar for ' + fn + '! Earned ' + barPay + 'g. 💚 Relationship +1.5';
            if (_metNames.length > 0) barMsg += '. Met ' + _metNames.join(' and ') + ' while serving drinks!';
            return { success: true, message: barMsg };
        }

        return { success: false, message: 'Unknown job.' };
    }

    function _handleNobleDialogueInteraction(personId, person, interactionId) {
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        var fn = person.firstName || 'Noble';
        var pers = person.personality || {};
        var relLevel = player.relationships[personId] ? player.relationships[personId].level : 0;

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) {
            Game.advanceTicks(3);
        }

        var gain = 3.0;

        // Gather context for rich dialogue
        var town = null, kingdom = null, kingName = '', atWar = false, kName = '';
        try {
            town = Engine.findTown(person.townId || player.townId);
            if (town && town.kingdomId) {
                kingdom = Engine.findKingdom(town.kingdomId);
                if (kingdom) {
                    kName = kingdom.name || 'the kingdom';
                    atWar = kingdom.atWar ? (Array.isArray(kingdom.atWar) ? kingdom.atWar.length > 0 : kingdom.atWar.size > 0) : false;
                    var kingPerson = kingdom.king ? Engine.findPerson(kingdom.king) : null;
                    kingName = kingPerson ? kingPerson.firstName : 'the king';
                }
            }
        } catch(e) {}
        var tName = town ? town.name : 'town';
        var highRel = relLevel >= 60;
        var veryHigh = relLevel >= 80;
        var rng = null;
        try { rng = Engine.getRng(); } catch(e) {}
        var pick = function(arr) { return rng ? rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]; };

        var dialogueMsg = '';

        switch (interactionId) {
            case 'noble_discuss_power': {
                if ((pers.ambition || 50) > 70) gain = 4.0;
                if ((pers.ambition || 50) > 80) gain = 4.5;
                var powerLines;
                if (atWar) {
                    powerLines = [
                        fn + ' glances around carefully: "War reshuffles the deck. Those who position themselves now will hold the cards when peace comes."',
                        fn + ' lowers their voice: "The war council is where the real power lies right now. I have been angling for a seat — perhaps we could help each other."',
                        fn + ' taps the table: "Every war creates vacancies at court. Lands are seized, titles forfeited. The bold will claim what the fallen leave behind."',
                        fn + '\'s eyes gleam: "' + kingName + ' relies heavily on those who fund the war. Gold buys influence that swords cannot."'
                    ];
                } else if (veryHigh) {
                    powerLines = [
                        fn + ' speaks freely: "Between us — I have been cultivating allies among the lesser nobles. When the time is right, we could propose reforms that benefit... our circle."',
                        fn + ' confides: "The royal court is a chessboard. ' + kingName + ' controls the center, but the flanks? Those belong to people like us."',
                        fn + ' meets your eyes: "I trust you enough to say this plainly — I intend to rise higher. And I want you beside me when I do."',
                        fn + ' smiles knowingly: "Real power is not the throne. It\'s the ear of the one who sits on it. Remember that."'
                    ];
                } else if (highRel) {
                    powerLines = [
                        fn + ' leans in: "I have been studying the court alliances. Three families hold most of the influence in ' + kName + '. We need to be the fourth."',
                        fn + ' speaks carefully: "Ambition without allies is just daydreaming. I think we understand each other — shall we be more... deliberate in our plans?"',
                        fn + ' nods approvingly: "You have the instinct for this. Most people flinch at the word \'power.\' You and I know it is simply the ability to shape what happens next."'
                    ];
                } else {
                    powerLines = [
                        fn + ' raises an eyebrow: "You wish to discuss influence? Good. Too many are content to let others decide their fate."',
                        fn + ' studies you: "Ambition is the first requirement. The second is patience. Do you have both?"',
                        fn + ' gestures broadly: "The court in ' + kName + ' is a web of favors and debts. Understanding who owes whom — that is where power begins."',
                        fn + ' tilts their head: "Every noble family started somewhere. The question is whether you have the stomach for the climb."',
                        fn + ' folds their arms: "' + kingName + ' rewards loyalty, yes — but competence more so. Show your value, and the doors will open."'
                    ];
                }
                dialogueMsg = pick(powerLines);
                break;
            }
            case 'noble_discuss_duty': {
                if ((pers.loyalty || 50) > 70) gain = 4.0;
                if ((pers.loyalty || 50) > 80) gain = 4.5;
                var dutyLines;
                if (atWar) {
                    dutyLines = [
                        fn + ' places a hand over their heart: "In times of war, duty is not a concept — it is a lifeline. Every grain we send, every coin we contribute, keeps ' + kName + ' alive."',
                        fn + '\'s expression hardens: "I have sent three of my household guard to the front. It tears at me, but ' + kingName + ' called, and we must answer."',
                        fn + ' looks toward the horizon: "Some nobles flee their obligations when war comes. I will not be among them, and I am glad you share that conviction."',
                        fn + ' straightens: "The soldiers fight with swords. We fight with supply lines, morale, and keeping the people fed. Our duty is no less vital."'
                    ];
                } else if (veryHigh) {
                    dutyLines = [
                        fn + ' speaks with quiet intensity: "You know why I remain loyal to the crown? Because without order, the common folk suffer most. That is the burden we carry."',
                        fn + ' clasps your shoulder: "There are nights I question whether ' + kingName + ' deserves our loyalty. Then I remember — it is not about the king. It is about ' + kName + '."',
                        fn + ' smiles sadly: "Duty and ambition pull in opposite directions, friend. I have chosen duty. I hope I have chosen wisely."'
                    ];
                } else if (highRel) {
                    dutyLines = [
                        fn + ' nods firmly: "I took an oath when I received my title. Some treat it as ceremony. I do not."',
                        fn + ' looks you in the eye: "Loyalty is tested not in prosperity but in hardship. I respect that you come to discuss this openly."',
                        fn + ' reflects: "My father served the crown faithfully for forty years. I intend to honor that legacy, whatever it costs me."'
                    ];
                } else {
                    dutyLines = [
                        fn + ' nods solemnly: "The crown demands much, but gives structure to our world. Without it, we would have only chaos."',
                        fn + ' straightens with pride: "Service to ' + kName + ' is the highest calling a noble can answer. I am glad you see that."',
                        fn + ' looks thoughtful: "Every day I ask myself — have I done enough for my people? The answer is always the same: not yet."',
                        fn + '\'s voice grows soft: "' + kingName + ' carries the weight of the kingdom. The least we can do is shoulder some of that burden."',
                        fn + ' speaks deliberately: "A noble who shirks their duty is no noble at all. I have seen too many forget that in ' + tName + '."'
                    ];
                }
                dialogueMsg = pick(dutyLines);
                break;
            }
            case 'noble_discuss_strategy': {
                if ((pers.intelligence || 50) > 70) gain = 4.0;
                if ((pers.intelligence || 50) > 80) gain = 4.5;
                var stratLines;
                if (atWar) {
                    stratLines = [
                        fn + ' pulls out a rough map: "Our supply lines are stretched thin. If the enemy targets ' + tName + ', we would have perhaps three weeks of reserves. We need contingencies."',
                        fn + ' taps their chin: "The war is winnable, but not by brute force alone. We need to disrupt their trade routes — starve their war machine."',
                        fn + ' muses: "I have been studying our enemy\'s movements. They commit heavily to the front, leaving their eastern flank exposed. If only ' + kingName + ' would listen..."',
                        fn + '\'s eyes sharpen: "The real battle is economic. Whoever runs out of gold first will sue for peace. Right now, that could be either side."'
                    ];
                } else if (veryHigh) {
                    stratLines = [
                        fn + ' unfolds their thoughts: "I have a theory — the kingdoms that thrive long-term are those that invest in infrastructure over military. Roads, wells, granaries. The boring things."',
                        fn + ' speaks candidly: "Between us, I believe ' + kName + '\'s biggest vulnerability is food dependency. If we diversified our agriculture, we would be nearly untouchable."',
                        fn + ' leans forward: "I have been quietly corresponding with scholars abroad. Their insights on governance could reshape how ' + kName + ' manages its territories."'
                    ];
                } else if (highRel) {
                    stratLines = [
                        fn + ' considers carefully: "The wisest strategy is one your opponent never sees coming. Subtlety over spectacle — that is my philosophy."',
                        fn + ' traces patterns on the table: "' + kName + '\'s strength lies in its natural resources, but we squander them with poor management. There is much room for improvement."',
                        fn + ' reflects: "Military might is a blunt instrument. Economic strength, alliances, intelligence networks — these are the true sinews of power."'
                    ];
                } else {
                    stratLines = [
                        fn + ' strokes their chin: "Few people think strategically. They react instead of planning. Tell me — when you look at ' + kName + ', what do you see? Strengths or vulnerabilities?"',
                        fn + ' raises an eyebrow: "Your strategic mind impresses me. Most who come to court think only of today\'s meal, not tomorrow\'s harvest."',
                        fn + ' gestures expansively: "A kingdom is like a merchant enterprise writ large. Revenue, expenses, investments, risks. Govern it with a ledger and a map, not just a scepter."',
                        fn + '\'s eyes light up: "Ah, someone who appreciates the long game! Tell me your thoughts on ' + tName + '\'s defensive position. I have some concerns."',
                        fn + ' nods approvingly: "Strategy begins with information. I make it my business to know the price of wheat in every town in ' + kName + '. Patterns reveal intentions."'
                    ];
                }
                dialogueMsg = pick(stratLines);
                break;
            }
            case 'noble_discuss_people': {
                if ((pers.warmth || 50) > 70) gain = 4.0;
                if ((pers.warmth || 50) > 80) gain = 4.5;
                var peopleLines;
                if (atWar) {
                    peopleLines = [
                        fn + '\'s expression falls: "The war hits the common folk hardest. Higher prices, sons marched off to fight, widows left to tend farms alone. It keeps me up at night."',
                        fn + ' sighs heavily: "I have been distributing grain from my personal stores. It is not enough, but what else can I do? The people of ' + tName + ' are suffering."',
                        fn + ' looks pained: "They cheer when the army marches through, but they weep when the tax collector follows. We owe them better than this."',
                        fn + ' speaks softly: "A child in the market yesterday asked me when her father would come home from the war. I had no answer. That haunts me."'
                    ];
                } else if (veryHigh) {
                    peopleLines = [
                        fn + ' takes your hand briefly: "I have been quietly funding a school in ' + tName + '. Education is the only ladder that lifts everyone, not just the privileged."',
                        fn + ' confides: "Most nobles see the commonfolk as numbers — labor, taxes, soldiers. I cannot. I see my nurse who raised me, the blacksmith who taught me patience, the farmers who feed us all."',
                        fn + ' wipes their eye: "Forgive me. I visited the poorest quarter of ' + tName + ' yesterday. The conditions... we must do better. We can afford to."'
                    ];
                } else if (highRel) {
                    peopleLines = [
                        fn + ' smiles warmly: "You know what I love about market days? Watching the children chase each other between the stalls. That is what we protect — those simple joys."',
                        fn + ' grows serious: "The gap between noble and common is not of worth, but of circumstance. Any of us could have been born on the other side."',
                        fn + ' nods: "I make a point to walk through ' + tName + ' without my sigil once a month. You learn more in an hour as a nobody than a year as a lord."'
                    ];
                } else {
                    peopleLines = [
                        fn + ' smiles softly: "It heartens me that someone of your station cares about the common folk. Too many nobles wall themselves away from reality."',
                        fn + ' looks out thoughtfully: "A kingdom is its people. Not its walls, not its throne — its people. Everything we do should serve them."',
                        fn + '\'s voice warms: "Do you know what the fishermen of ' + tName + ' told me last week? They said they feel forgotten by the court. That shames me."',
                        fn + ' shakes their head: "The harvest festival is the one day nobles and peasants sit at the same table. We should have more days like that."',
                        fn + ' reflects: "My grandmother used to say: \'The strength of a castle is not in its stones, but in the people willing to defend it.\' She was right."'
                    ];
                }
                dialogueMsg = pick(peopleLines);
                break;
            }
            case 'noble_discuss_economy': {
                if ((pers.frugality || 50) > 70) gain = 4.0;
                if ((pers.frugality || 50) > 80) gain = 4.5;
                var econLines;
                if (atWar) {
                    econLines = [
                        fn + ' frowns: "War is ruinously expensive. The treasury bleeds gold daily. If this drags on another season, ' + kingName + ' will need to raise taxes — and that never ends well."',
                        fn + ' lowers their voice: "I have been quietly converting some holdings to gold. When the war ends — and it will — the shrewd will buy land at desperate prices."',
                        fn + ' taps the table: "Iron and wheat are worth their weight in gold right now. Any merchant supplying the army is getting rich. The question is whether it lasts."',
                        fn + ' sighs: "Trade agreements are frozen during wartime. ' + kName + '\'s merchants are suffering, and that suffering flows downhill to every shop and stall."'
                    ];
                } else if (veryHigh) {
                    econLines = [
                        fn + ' speaks openly: "I will tell you something most nobles would never admit — I track every coin that enters and leaves my household. Discipline, not birth, builds lasting wealth."',
                        fn + ' confides: "The kingdom\'s books are... concerning. ' + kingName + ' spends lavishly on the court while infrastructure crumbles. It is not sustainable."',
                        fn + ' draws you close: "I have been experimenting with crop rotation on my estates. The yields are remarkable. If we could convince other landholders... ' + kName + ' could become a breadbasket."'
                    ];
                } else if (highRel) {
                    econLines = [
                        fn + ' nods knowingly: "The merchants in ' + tName + ' complain about taxes, but they never mention the roads those taxes built. A functioning economy needs both sides."',
                        fn + ' gestures: "I have been watching the price of timber closely. Three months ago it was stable. Now? Rising steadily. Something is shifting in the supply chains."',
                        fn + ' speaks firmly: "Prosperity is not found — it is built, stone by stone, trade by trade, harvest by harvest. ' + kName + ' has the potential if we manage wisely."'
                    ];
                } else {
                    econLines = [
                        fn + ' raises an eyebrow: "A fellow pragmatist! The economy is the heartbeat of ' + kName + '. When trade flows, everything thrives. When it stalls, even the crown suffers."',
                        fn + ' produces a small ledger: "I keep records of commodity prices across every town I visit. Patterns emerge — and patterns are profit."',
                        fn + ' speaks plainly: "Gold is not everything, but without it, everything else falls apart. The kingdom\'s finances must be sound before we dream of anything grand."',
                        fn + ' tilts their head: "Have you noticed how the price of grain fluctuates with the seasons? Most don\'t. But those who do can plan harvests — or exploit shortages."',
                        fn + '\'s expression sharpens: "There is a merchant in ' + tName + ' trying to corner the market on salt. I admire the ambition, but it will hurt the people. Someone should address it."'
                    ];
                }
                dialogueMsg = pick(econLines);
                break;
            }
            default:
                dialogueMsg = fn + ' enjoys the conversation.';
        }

        Player.modifyRelationship(personId, gain);

        // Track interaction cooldown
        if (!player._npcInteractions) player._npcInteractions = {};
        if (!player._npcInteractions[personId] || player._npcInteractions[personId].day !== day) {
            player._npcInteractions[personId] = { day: day, count: 0 };
        }
        player._npcInteractions[personId].count++;

        Player.grantXP(4, 'noble_dialogue');
        return { success: true, message: dialogueMsg + ' 💚 Relationship +' + gain.toFixed(1) };
    }

    // ── Guild Membership System ──────────────────────────────

    function getGuildForCategory(category) {
        _sync();
        if (!CONFIG.GUILDS) return null;
        for (var gId in CONFIG.GUILDS) {
            if (CONFIG.GUILDS[gId].categories.indexOf(category) >= 0) return CONFIG.GUILDS[gId];
        }
        return null;
    }

    function isGuildMember(guildId) {
        _sync();
        var membership = player.guildMemberships[guildId];
        if (!membership) return false;
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        // v9p33river324: was `expiresDay > day` which marked the
        // membership invalid ON the expiry day. Use >= so the member
        // gets perks through end of expiry day.
        return membership.expiresDay >= day;
    }

    function getGuildPrice(guildId, type) {
        _sync();
        // Merchants guild uses its own doubled base prices
        var base;
        if (guildId === 'merchants') {
            base = type === 'yearly' ? (CONFIG.MERCHANTS_GUILD_BASE_YEARLY || 400) : (CONFIG.MERCHANTS_GUILD_BASE_MONTHLY || 50);
        } else {
            base = type === 'yearly' ? (CONFIG.GUILD_BASE_YEARLY || 200) : (CONFIG.GUILD_BASE_MONTHLY || 25);
        }
        var guild = CONFIG.GUILDS[guildId];
        if (!guild) return base;
        try {
            var world = Engine.getWorld();
            var towns = world.towns || [];

            // Merchants guild: scale price with average world prosperity (cap at 3x starting base)
            if (guildId === 'merchants') {
                var totalProsperity = 0;
                var kingdomCount = 0;
                var kingdoms = world.kingdoms || [];
                for (var ki = 0; ki < kingdoms.length; ki++) {
                    if (kingdoms[ki].alive !== false) {
                        totalProsperity += (kingdoms[ki].prosperity || 50);
                        kingdomCount++;
                    }
                }
                var avgProsperity = kingdomCount > 0 ? totalProsperity / kingdomCount : 50;
                // Base prosperity is ~50 at game start. Scale linearly from 1.0x at 50 to cap at higher prosperity.
                // At prosperity 50 → 1.0x, at 100 → 2.0x, at 150+ → 3.0x (capped)
                var prosperityMultiplier = Math.max(1.0, Math.min(CONFIG.MERCHANTS_GUILD_PROSPERITY_CAP || 3.0, 1.0 + (avgProsperity - 50) / 50));
                base = Math.round(base * prosperityMultiplier);
            } else {
                // Other guilds: existing revenue-based scaling
                var totalRevenue = 0;
                var count = 0;
                for (var ti = 0; ti < towns.length; ti++) {
                    var buildings = towns[ti].buildings || [];
                    for (var bi = 0; bi < buildings.length; bi++) {
                        var bType = Engine.findBuildingType(buildings[bi].type);
                        if (bType && guild.categories.indexOf(bType.category) >= 0) {
                            totalRevenue += (buildings[bi].revenue || 0);
                            count++;
                        }
                    }
                }
                if (count > 0) {
                    var avgRevenue = totalRevenue / count;
                    var multiplier = Math.max(0.5, Math.min(3, 1 + avgRevenue / 100));
                    base = Math.round(base * multiplier);
                }
            }
        } catch(e) {}
        // Guild Negotiator skill: 20% reduced dues
        if (Player.hasSkill('guild_negotiator')) base = Math.round(base * 0.80);
        return base;
    }

    function joinGuild(guildId, type) {
        _sync();
        if (!CONFIG.GUILDS || !CONFIG.GUILDS[guildId]) return { success: false, message: 'Guild not found.' };
        var guild = CONFIG.GUILDS[guildId];
        var price = getGuildPrice(guildId, type);
        if (player.gold < price) return { success: false, message: 'Not enough gold. Need ' + price + 'g.' };

        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        var duration = type === 'yearly' ? CONFIG.DAYS_PER_SEASON : 30;

        // If already a member, extend from expiration
        var existing = player.guildMemberships[guildId];
        var currentExpiry = (existing && existing.expiresDay > day) ? existing.expiresDay : day;
        var prevAutoRenew = existing ? (existing.autoRenew || false) : false;

        player.gold -= price;
        Player.logFinance(-price, 'guild', 'Guild membership');
        player.stats.totalGoldSpent += price;
        player.guildMemberships[guildId] = {
            expiresDay: currentExpiry + duration,
            type: type,
            autoRenew: prevAutoRenew,
            lastPaidPrice: price
        };

        try { Engine.logEvent(guild.icon + ' Joined ' + guild.name + ' (' + type + ', ' + price + 'g)', 'my_actions'); } catch(e) {}

        // Journal — guild membership
        Player.recordJournalEntry('guild', 'Joined the ' + guild.name + ' as a ' + type + ' member for ' + price + 'g. New opportunities and connections await.', { mood: 'hopeful' });

        // Story Mode: notify of guild join
        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('join_guild', { guildId: guildId });
        }

        return { success: true, message: 'Joined ' + guild.name + '! Membership until Day ' + (currentExpiry + duration) + '.' };
    }

    function setGuildAutoRenew(guildId, enabled) {
        _sync();
        var membership = player.guildMemberships[guildId];
        if (!membership) return { success: false, message: 'Not a member of this guild.' };
        membership.autoRenew = !!enabled;
        var guild = CONFIG.GUILDS[guildId];
        var gName = guild ? guild.name : guildId;
        return { success: true, message: 'Auto-renew ' + (enabled ? 'enabled' : 'disabled') + ' for ' + gName + '.' };
    }

    // ============================================================
    // §16E  INTERACTIVE QUEST STEP SYSTEM
    // ============================================================
    // Building types valid as search targets for evidence-gathering
    var _SEARCHABLE_BUILDING_TYPES = ['warehouse', 'tavern', 'market_stall', 'blacksmith', 'smelter', 'tanner', 'bakery', 'winery', 'dock', 'guild_hall'];

    function _generateInteractiveData(quest, stepIndex) {
        _sync();
        var rng = Engine.getRng();
        if (!rng) return;
        var msConfig = MULTISTEP_ACTIONS[quest.requirements.action ? quest.requirements.action.type : ''];
        if (!msConfig) return;
        var step = msConfig.steps[stepIndex];
        if (!step || !step.interactive) return;

        if (!player._kqInteractiveData) player._kqInteractiveData = {};
        var kingdomId = quest.kingdomId;
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}

        // Get towns in this kingdom
        var kingdomTowns = [];
        try {
            var w = Engine.getWorld();
            if (w && w.towns) kingdomTowns = w.towns.filter(function(t) { return t.kingdomId === kingdomId; });
        } catch(e) {}
        if (kingdomTowns.length === 0) return;

        // Get living people in the kingdom with socialRank >= 1
        var kingdomPeople = [];
        try {
            var w2 = Engine.getWorld();
            if (w2 && w2.people) {
                kingdomPeople = w2.people.filter(function(p) {
                    if (!p.alive || p.id === 'player') return false;
                    if (p.townId) {
                        for (var ti = 0; ti < kingdomTowns.length; ti++) {
                            if (kingdomTowns[ti].id === p.townId) return true;
                        }
                    }
                    return false;
                });
            }
        } catch(e) {}

        var interactiveType = step.interactive;

        if (interactiveType === 'skip') {
            // Auto-complete: no interactive data needed, just advance the step
            if (!player._kqStepProgress) player._kqStepProgress = {};
            player._kqStepProgress[quest.id] = stepIndex + 1;
            // Check if this was the last step
            if (stepIndex + 1 >= msConfig.totalSteps) {
                trackKQActionDone(quest.id);
            } else {
                // Recursively generate for next step if also interactive
                var nextStep = msConfig.steps[stepIndex + 1];
                if (nextStep && nextStep.interactive) {
                    _generateInteractiveData(quest, stepIndex + 1);
                }
            }
            Engine.logEvent('📋 ' + step.label + ' — auto-completed.');
            return;
        }

        if (interactiveType === 'search_buildings') {
            var targetCount = 2 + (rng.chance(0.5) ? 1 : 0); // 2-3 targets
            var targets = [];
            var usedKeys = {};
            for (var si = 0; si < targetCount * 5 && targets.length < targetCount; si++) {
                var town = kingdomTowns[rng.randInt(0, kingdomTowns.length - 1)];
                if (!town || !town.buildings || town.buildings.length === 0) continue;
                // Find buildings of searchable types in this town
                var validBuildings = [];
                for (var bi = 0; bi < town.buildings.length; bi++) {
                    var bld = town.buildings[bi];
                    if (_SEARCHABLE_BUILDING_TYPES.indexOf(bld.type) !== -1) {
                        validBuildings.push(bld.type);
                    }
                }
                if (validBuildings.length === 0) continue;
                var bType = validBuildings[rng.randInt(0, validBuildings.length - 1)];
                var key = town.id + ':' + bType;
                if (usedKeys[key]) continue;
                usedKeys[key] = true;
                targets.push({
                    townId: town.id,
                    townName: town.name,
                    buildingType: bType,
                    searched: false,
                    foundEvidence: false
                });
            }
            if (targets.length < 2) {
                // Fallback: fill remaining with first available
                for (var ti2 = 0; ti2 < kingdomTowns.length && targets.length < 2; ti2++) {
                    var t2 = kingdomTowns[ti2];
                    if (!t2.buildings) continue;
                    for (var bi2 = 0; bi2 < t2.buildings.length && targets.length < 2; bi2++) {
                        var bt2 = t2.buildings[bi2].type;
                        if (_SEARCHABLE_BUILDING_TYPES.indexOf(bt2) === -1) continue;
                        var k2 = t2.id + ':' + bt2;
                        if (usedKeys[k2]) continue;
                        usedKeys[k2] = true;
                        targets.push({ townId: t2.id, townName: t2.name, buildingType: bt2, searched: false, foundEvidence: false });
                    }
                }
            }
            var evidenceNeeded = Math.max(1, targets.length - 1);
            player._kqInteractiveData[quest.id] = {
                type: 'search_buildings',
                stepIndex: stepIndex,
                targets: targets,
                evidenceFound: 0,
                evidenceNeeded: evidenceNeeded
            };
        } else if (interactiveType === 'interview_npcs') {
            var npcCount = 2 + (rng.chance(0.5) ? 1 : 0); // 2-3
            var npcTargets = [];
            var usedNpcs = {};
            // Prefer NPCs with socialRank >= 1 but accept any alive NPC
            var eligibleNpcs = kingdomPeople.filter(function(p) {
                if (p.socialRank) {
                    for (var sk in p.socialRank) {
                        if ((p.socialRank[sk] || 0) >= 1) return true;
                    }
                }
                return p.occupation && p.occupation !== 'none';
            });
            if (eligibleNpcs.length < npcCount) eligibleNpcs = kingdomPeople;

            for (var ni = 0; ni < npcCount * 5 && npcTargets.length < npcCount; ni++) {
                if (eligibleNpcs.length === 0) break;
                var npc = eligibleNpcs[rng.randInt(0, eligibleNpcs.length - 1)];
                if (usedNpcs[npc.id]) continue;
                usedNpcs[npc.id] = true;
                var npcTown = null;
                try { npcTown = Engine.findTown(npc.townId); } catch(e2) {}
                npcTargets.push({
                    npcId: npc.id,
                    npcName: (npc.firstName || '') + ' ' + (npc.lastName || ''),
                    townId: npc.townId,
                    townName: npcTown ? npcTown.name : 'Unknown',
                    interviewed: false,
                    hadInfo: false
                });
            }
            var infoNeeded = Math.max(1, npcTargets.length - 1);
            player._kqInteractiveData[quest.id] = {
                type: 'interview_npcs',
                stepIndex: stepIndex,
                targets: npcTargets,
                infoGathered: 0,
                infoNeeded: infoNeeded
            };
        } else if (interactiveType === 'ask_npcs') {
            // Bounty tracking: generate criminal name and NPC clues
            var firstNames = NAMES ? NAMES.male.concat(NAMES.female) : ['Unknown'];
            var lastNames = NAMES ? NAMES.surnames : ['Criminal'];
            var criminalName = firstNames[rng.randInt(0, firstNames.length - 1)] + ' ' + lastNames[rng.randInt(0, lastNames.length - 1)];

            // Pick 3 towns where criminal was "seen"
            var seenTowns = [];
            var townPool = kingdomTowns.slice();
            for (var sti = 0; sti < 3 && townPool.length > 0; sti++) {
                var idx = rng.randInt(0, townPool.length - 1);
                seenTowns.push(townPool[idx]);
                townPool.splice(idx, 1);
            }

            // Pick NPCs in those towns who might know something
            var clueNpcs = [];
            var usedClueNpcs = {};
            for (var cti = 0; cti < seenTowns.length; cti++) {
                var townNpcs = kingdomPeople.filter(function(p) { return p.townId === seenTowns[cti].id; });
                // Pick 1-2 NPCs per town
                var perTown = 1 + (rng.chance(0.4) ? 1 : 0);
                for (var cni = 0; cni < perTown && townNpcs.length > 0; cni++) {
                    var cidx = rng.randInt(0, townNpcs.length - 1);
                    var cNpc = townNpcs[cidx];
                    if (usedClueNpcs[cNpc.id]) { townNpcs.splice(cidx, 1); cni--; continue; }
                    usedClueNpcs[cNpc.id] = true;
                    clueNpcs.push({
                        npcId: cNpc.id,
                        npcName: (cNpc.firstName || '') + ' ' + (cNpc.lastName || ''),
                        townId: cNpc.townId,
                        townName: seenTowns[cti].name,
                        asked: false,
                        knowsLocation: false
                    });
                    townNpcs.splice(cidx, 1);
                }
            }

            // Mark 1-2 NPCs as knowing the location
            var knowCount = Math.min(2, Math.max(1, Math.floor(clueNpcs.length * 0.4)));
            var knowIndices = [];
            for (var ki = 0; ki < knowCount * 5 && knowIndices.length < knowCount; ki++) {
                var ridx = rng.randInt(0, clueNpcs.length - 1);
                if (knowIndices.indexOf(ridx) === -1) knowIndices.push(ridx);
            }
            for (var kwi = 0; kwi < knowIndices.length; kwi++) {
                clueNpcs[knowIndices[kwi]].knowsLocation = true;
            }

            // Criminal hides in one of the seen towns
            var crimTown = seenTowns[rng.randInt(0, seenTowns.length - 1)];
            var clueTexts = [
                'They were seen near the ' + (crimTown.name || 'town') + ' area',
                'A merchant mentioned dealing with them recently',
                'Someone matching their description was spotted at a tavern'
            ];

            player._kqInteractiveData[quest.id] = {
                type: 'ask_npcs',
                stepIndex: stepIndex,
                criminalName: criminalName,
                lastSeenTowns: seenTowns.map(function(t) { return { id: t.id, name: t.name }; }),
                clues: clueTexts,
                npcClues: clueNpcs,
                criminalFound: false,
                criminalTownId: crimTown.id,
                criminalTownName: crimTown.name,
                criminalNpcId: null
            };
        } else if (interactiveType === 'capture') {
            // Capture step: look for ask_npcs data from previous step to get criminal info
            var prevData = player._kqInteractiveData[quest.id];
            if (prevData && prevData.type === 'ask_npcs' && prevData.criminalFound) {
                player._kqInteractiveData[quest.id] = {
                    type: 'capture',
                    stepIndex: stepIndex,
                    targetName: prevData.criminalName,
                    targetTownId: prevData.criminalTownId,
                    targetTownName: prevData.criminalTownName,
                    targetNpcId: prevData.criminalNpcId
                };
            } else {
                // No previous ask data (manhunt path) — generate a criminal target
                var captTown = kingdomTowns[rng.randInt(0, kingdomTowns.length - 1)];
                var cFirstNames = NAMES ? NAMES.male.concat(NAMES.female) : ['Fugitive'];
                var cLastNames = NAMES ? NAMES.surnames : ['Unknown'];
                var capName = cFirstNames[rng.randInt(0, cFirstNames.length - 1)] + ' ' + cLastNames[rng.randInt(0, cLastNames.length - 1)];
                player._kqInteractiveData[quest.id] = {
                    type: 'capture',
                    stepIndex: stepIndex,
                    targetName: capName,
                    targetTownId: captTown.id,
                    targetTownName: captTown.name,
                    targetNpcId: null
                };
            }
        }
    }

    // Search a building for evidence (called from building detail UI)
    function searchBuildingForEvidence(questId, targetIndex) {
        _sync();
        if (!player._kqInteractiveData) return { success: false, message: 'No interactive data.' };
        var iData = player._kqInteractiveData[questId];
        if (!iData || iData.type !== 'search_buildings') return { success: false, message: 'No search data for this quest.' };
        if (targetIndex < 0 || targetIndex >= iData.targets.length) return { success: false, message: 'Invalid target.' };

        var target = iData.targets[targetIndex];
        if (target.searched) return { success: false, message: 'You already searched this building.' };

        // Validate player is in the right town
        if (player.townId !== target.townId || player.traveling) {
            return { success: false, message: 'You must be in ' + target.townName + ' to search this building.' };
        }

        target.searched = true;
        var rng = Engine.getRng();
        var found = rng ? rng.chance(0.70) : (Math.random() < 0.70);

        if (found) {
            target.foundEvidence = true;
            iData.evidenceFound = (iData.evidenceFound || 0) + 1;
            Engine.logEvent('🔍 Found evidence at ' + target.buildingType + ' in ' + target.townName + '!');

            // Check if we have enough evidence to complete the step
            if (iData.evidenceFound >= iData.evidenceNeeded) {
                _advanceInteractiveStep(questId);
                return { success: true, message: '🔍 Evidence found! You\'ve gathered enough evidence — step complete!' };
            }
            return { success: true, message: '🔍 You found useful evidence! (' + iData.evidenceFound + '/' + iData.evidenceNeeded + ')' };
        } else {
            Engine.logEvent('🔍 Searched ' + target.buildingType + ' in ' + target.townName + ' but found nothing useful.');
            // Check if all searched but not enough evidence
            var allSearched = iData.targets.every(function(t) { return t.searched; });
            if (allSearched && iData.evidenceFound < iData.evidenceNeeded) {
                return { success: true, message: '🔍 Nothing found here. All locations searched but not enough evidence — try the regular action button to proceed.' };
            }
            return { success: true, message: '🔍 You searched thoroughly but found nothing useful here.' };
        }
    }

    // Interview an NPC for quest info
    function interviewNpcForQuest(questId, targetIndex) {
        _sync();
        if (!player._kqInteractiveData) return { success: false, message: 'No interactive data.' };
        var iData = player._kqInteractiveData[questId];
        if (!iData || iData.type !== 'interview_npcs') return { success: false, message: 'No interview data for this quest.' };
        if (targetIndex < 0 || targetIndex >= iData.targets.length) return { success: false, message: 'Invalid target.' };

        var target = iData.targets[targetIndex];
        if (target.interviewed) return { success: false, message: 'You already interviewed ' + target.npcName + '.' };

        if (player.townId !== target.townId || player.traveling) {
            return { success: false, message: 'You must be in ' + target.townName + ' to interview ' + target.npcName + '.' };
        }

        target.interviewed = true;
        var rng = Engine.getRng();
        var hadInfo = rng ? rng.chance(0.60) : (Math.random() < 0.60);

        if (hadInfo) {
            target.hadInfo = true;
            iData.infoGathered = (iData.infoGathered || 0) + 1;
            Engine.logEvent('🗣️ ' + target.npcName + ' provided useful information!');

            if (iData.infoGathered >= iData.infoNeeded) {
                _advanceInteractiveStep(questId);
                return { success: true, message: '🗣️ ' + target.npcName + ' told you what you needed to know — step complete!' };
            }
            return { success: true, message: '🗣️ ' + target.npcName + ' had useful information! (' + iData.infoGathered + '/' + iData.infoNeeded + ')' };
        } else {
            Engine.logEvent('🗣️ ' + target.npcName + ' had nothing useful to share.');
            var allAsked = iData.targets.every(function(t) { return t.interviewed; });
            if (allAsked && iData.infoGathered < iData.infoNeeded) {
                return { success: true, message: '🗣️ ' + target.npcName + ' couldn\'t help. All contacts interviewed but not enough info — try the regular action button to proceed.' };
            }
            return { success: true, message: '🗣️ ' + target.npcName + ' didn\'t have any useful information.' };
        }
    }

    // Ask an NPC about a criminal (bounty tracking)
    function askNpcAboutCriminal(questId, targetIndex) {
        _sync();
        if (!player._kqInteractiveData) return { success: false, message: 'No interactive data.' };
        var iData = player._kqInteractiveData[questId];
        if (!iData || iData.type !== 'ask_npcs') return { success: false, message: 'No tracking data for this quest.' };
        if (targetIndex < 0 || targetIndex >= iData.npcClues.length) return { success: false, message: 'Invalid target.' };

        var target = iData.npcClues[targetIndex];
        if (target.asked) return { success: false, message: 'You already asked this person.' };

        if (player.townId !== target.townId || player.traveling) {
            return { success: false, message: 'You must be in ' + target.townName + ' to ask ' + target.npcName + '.' };
        }

        target.asked = true;

        if (target.knowsLocation) {
            iData.criminalFound = true;
            Engine.logEvent('🔎 ' + target.npcName + ' revealed that ' + iData.criminalName + ' is hiding in ' + iData.criminalTownName + '!');
            _advanceInteractiveStep(questId);
            return {
                success: true,
                message: '🔎 ' + target.npcName + ' knows where ' + iData.criminalName + ' is! They\'re in ' + iData.criminalTownName + '! Step complete!',
                revealedLocation: iData.criminalTownName
            };
        } else {
            Engine.logEvent('🔎 ' + target.npcName + ' doesn\'t know where ' + iData.criminalName + ' is.');
            var allAsked2 = iData.npcClues.every(function(n) { return n.asked; });
            if (allAsked2 && !iData.criminalFound) {
                return { success: true, message: '🔎 ' + target.npcName + ' doesn\'t know. All leads exhausted — try the regular action button to proceed.' };
            }
            return { success: true, message: '🔎 ' + target.npcName + ' hasn\'t seen ' + iData.criminalName + ' recently.' };
        }
    }

    // Attempt to capture a criminal
    function attemptCaptureCriminal(questId) {
        _sync();
        if (!player._kqInteractiveData) return { success: false, message: 'No interactive data.' };
        var iData = player._kqInteractiveData[questId];
        if (!iData || iData.type !== 'capture') return { success: false, message: 'No capture data for this quest.' };

        if (player.townId !== iData.targetTownId || player.traveling) {
            return { success: false, message: 'You must be in ' + iData.targetTownName + ' to attempt capture of ' + iData.targetName + '.' };
        }

        var rng = Engine.getRng();
        // Base 60% chance, boosted by combat skills
        var captureChance = 0.60;
        if (Player.hasSkill && Player.hasSkill('combat_proficiency')) captureChance += 0.10;
        if (Player.hasSkill && Player.hasSkill('wilderness_survival')) captureChance += 0.05;
        if (Player.hasSkill && Player.hasSkill('discrete')) captureChance += 0.05;
        captureChance = Math.min(0.95, captureChance);

        var success = rng ? rng.chance(captureChance) : (Math.random() < captureChance);

        if (success) {
            Engine.logEvent('🎯 You captured ' + iData.targetName + '!');
            _advanceInteractiveStep(questId);
            return { success: true, message: '🎯 You successfully captured ' + iData.targetName + '! Step complete!' };
        } else {
            Engine.logEvent('🎯 ' + iData.targetName + ' escaped your grasp!');
            // Criminal escapes — for capture_criminal quests, reset the ask_npcs data
            var actionType = '';
            try {
                var kingdomId = quest ? quest.kingdomId : _getPlayerKingdomId();
                var kqData = player.kingdomQuests[kingdomId];
                if (kqData) {
                    for (var qi = 0; qi < kqData.active.length; qi++) {
                        if (kqData.active[qi].id === questId) {
                            actionType = kqData.active[qi].requirements.action ? kqData.active[qi].requirements.action.type : '';
                            break;
                        }
                    }
                }
            } catch(e) {}

            if (actionType === 'capture_criminal') {
                // Reset to previous step — must find them again
                if (!player._kqStepProgress) player._kqStepProgress = {};
                var prevStep = Math.max(0, (player._kqStepProgress[questId] || 0) - 1);
                player._kqStepProgress[questId] = prevStep;

                // Find the quest and regenerate ask_npcs data
                var q = _findActiveQuest(questId);
                if (q) {
                    _generateInteractiveData(q, prevStep);
                }
                return { success: false, message: '🎯 ' + iData.targetName + ' escaped! You\'ll need to track them down again.' };
            }

            return { success: false, message: '🎯 ' + iData.targetName + ' escaped! Try again.' };
        }
    }

    // Helper to find an active quest by ID
    function _findActiveQuest(questId) {
        _sync();
        if (!player.kingdomQuests) return null;
        for (var kid in player.kingdomQuests) {
            var kqData = player.kingdomQuests[kid];
            if (!kqData || !kqData.active) continue;
            for (var qi = 0; qi < kqData.active.length; qi++) {
                if (kqData.active[qi].id === questId) return kqData.active[qi];
            }
        }
        return null;
    }

    // Advance from an interactive step to the next
    function _advanceInteractiveStep(questId) {
        _sync();
        if (!player._kqStepProgress) player._kqStepProgress = {};
        var currentStep = player._kqStepProgress[questId] || 0;
        player._kqStepProgress[questId] = currentStep + 1;

        // Find the quest to check total steps
        var quest = _findActiveQuest(questId);
        if (!quest) return;
        var actionType = quest.requirements.action ? quest.requirements.action.type : '';
        var msConfig = MULTISTEP_ACTIONS[actionType];
        if (!msConfig) return;

        if (currentStep + 1 >= msConfig.totalSteps) {
            // All steps done
            trackKQActionDone(questId);
            Engine.logEvent('✅ All steps completed for quest: ' + quest.title);
        } else {
            // Generate interactive data for next step if needed
            var nextStep = msConfig.steps[currentStep + 1] || null;
            if (nextStep && nextStep.interactive) {
                _generateInteractiveData(quest, currentStep + 1);
            }
            Engine.logEvent('✅ Step ' + (currentStep + 1) + '/' + msConfig.totalSteps + ' complete. Next: ' + (nextStep && nextStep.label ? nextStep.label : 'Continue'));
        }
    }

    // ── Export to Player ──────────────────────────────────────
    // Town Quests
    Player.generateTownQuests = generateTownQuests;
    Player.getTownQuestsForTown = getTownQuestsForTown;
    Player.getActiveQuests = getActiveQuests;
    Player.getCompletedQuestCount = getCompletedQuestCount;
    Player.acceptTownQuest = acceptTownQuest;
    Player.completeTownQuest = completeTownQuest;
    Player.abandonTownQuest = abandonTownQuest;
    Player.tickTownQuests = tickTownQuests;

    // Kingdom Quests
    Player.generateKingdomQuests = generateKingdomQuests;
    Player.acceptKingdomQuest = acceptKingdomQuest;
    Player.rejectKingdomQuest = rejectKingdomQuest;
    Player.abandonKingdomQuest = abandonKingdomQuest;
    Player.completeKingdomQuest = completeKingdomQuest;
    Player.checkKingdomQuestProgress = checkKingdomQuestProgress;
    Player.getKingdomQuestData = getKingdomQuestData;
    Player.getActiveKingdomQuests = getActiveKingdomQuests;
    Player.tickKingdomQuests = tickKingdomQuests;
    Player.trackKQTownVisit = trackKQTownVisit;
    Player.trackKQGoldSpent = trackKQGoldSpent;
    Player.trackKQTradeGold = trackKQTradeGold;
    Player.trackKQActionDone = trackKQActionDone;
    Player.attemptKQAction = attemptKQAction;
    Player.searchBuildingForEvidence = searchBuildingForEvidence;
    Player.interviewNpcForQuest = interviewNpcForQuest;
    Player.askNpcAboutCriminal = askNpcAboutCriminal;
    Player.attemptCaptureCriminal = attemptCaptureCriminal;

    // ────────────────────────────────────────────────────────
    // §NPC-MEM: Player Memory tracking for Elite Merchants & Nobles
    // Records significant interactions so they can be referenced
    // back to the player in later dialog. Capped per NPC to keep
    // saves small. Only stored on elite merchants and nobles —
    // ordinary townsfolk don't track this.
    // ────────────────────────────────────────────────────────
    var NPC_MEMORY_CAP = 20;

    function _npcQualifiesForMemory(person) {
        if (!person) return false;
        if (person.isEliteMerchant) return true;
        if (person.isKing) return true;
        if (person.socialRank) {
            for (var _kk in person.socialRank) {
                if ((person.socialRank[_kk] || 0) >= 4) return true;
            }
        }
        // v9p33river356: family members (parents, siblings, spouse,
        // children) also remember things now, so personal dialog can
        // reference shared history.
        try {
            var p = Player.state || {};
            if (p.spouseId && p.spouseId === person.id) return true;
            if (p.parentIds && p.parentIds.indexOf(person.id) >= 0) return true;
            if (p.siblingIds && p.siblingIds.indexOf(person.id) >= 0) return true;
            if (p.childrenIds && p.childrenIds.indexOf(person.id) >= 0) return true;
        } catch (e) {}
        return false;
    }

    function recordNpcMemory(personId, kind, summary, opts) {
        var person = (typeof personId === 'string') ? Engine.findPerson(personId) : personId;
        if (!_npcQualifiesForMemory(person)) return;
        if (!person._playerMemories) person._playerMemories = [];
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        person._playerMemories.push({
            kind: kind || 'event',
            day: day,
            summary: String(summary || ''),
            sentiment: (opts && opts.sentiment) || 'neutral'
        });
        // Cap to keep saves bounded
        while (person._playerMemories.length > NPC_MEMORY_CAP) {
            person._playerMemories.shift();
        }
    }

    function getNpcMemories(personId) {
        var person = (typeof personId === 'string') ? Engine.findPerson(personId) : personId;
        if (!person || !person._playerMemories) return [];
        return person._playerMemories.slice();
    }

    // ────────────────────────────────────────────────────────
    // v9p33river356: NPC question / player answer system
    // NPCs occasionally ask the player something during the
    // Interact modal. Each question has 3-4 answer options
    // (truth, lie, deflect, brag, etc.) with different
    // relationship effects + memory side-effects. Honest NPCs
    // are more likely to catch lies and react badly; cold or
    // selfish NPCs may reward bluster.
    // ────────────────────────────────────────────────────────
    function answerNpcQuestion(personId, qDef, optionIdx) {
        _sync();
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };
        if (!qDef || !qDef.options || optionIdx == null || optionIdx < 0 || optionIdx >= qDef.options.length) {
            return { success: false, message: 'Invalid answer.' };
        }
        var opt = qDef.options[optionIdx];

        // Personality-driven outcome: honest NPCs detect lies
        var pers = person.personality || {};
        var honest = (pers.honesty || 50);
        var intel = (pers.intelligence || 50);
        var caughtChance = 0;
        if (opt.kind === 'lie') {
            // Base 30% caught; +1% per point of honesty above 50; +0.7% per point of intelligence above 50
            caughtChance = 0.30 + Math.max(0, (honest - 50)) * 0.012 + Math.max(0, (intel - 50)) * 0.008;
            caughtChance = Math.min(0.85, caughtChance);
        }
        var caught = (opt.kind === 'lie') && Math.random() < caughtChance;

        var gain = (opt.relGain || 0);
        if (caught) gain = (opt.relIfCaught != null) ? opt.relIfCaught : Math.min(gain - 6, -3);

        // Apply
        if (gain !== 0) {
            try { Player.modifyRelationship(personId, gain); } catch (e) {}
        }
        // Record memory of the answer
        var memKind = caught ? 'caught_lying' : (opt.kind || 'answered_question');
        var memSent = caught ? 'negative' : (gain >= 1 ? 'positive' : (gain <= -1 ? 'negative' : 'neutral'));
        try { recordNpcMemory(person, memKind, qDef.summary || 'a question', { sentiment: memSent }); } catch (e) {}

        // Notoriety adjustment for serious lies caught
        if (caught && (opt.notorietyIfCaught || 0) > 0) {
            try { player.notoriety = (player.notoriety || 0) + opt.notorietyIfCaught; } catch (e) {}
        }

        var reactionPool = caught ? (opt.reactionsCaught || []) : (opt.reactions || []);
        var reaction = reactionPool.length ? reactionPool[Math.floor(Math.random() * reactionPool.length)] : '';

        // Q&A cooldown for this NPC: one question per 7 days
        if (!player._npcQuestionCooldowns) player._npcQuestionCooldowns = {};
        var day = 0; try { day = Engine.getDay(); } catch (e) {}
        player._npcQuestionCooldowns[personId] = day;

        return {
            success: true,
            caught: caught,
            gain: gain,
            reaction: reaction
        };
    }

    function npcQuestionCooldownDay(personId) {
        if (!player._npcQuestionCooldowns) return 0;
        return player._npcQuestionCooldowns[personId] || 0;
    }

    Player.answerNpcQuestion = answerNpcQuestion;
    Player.npcQuestionCooldownDay = npcQuestionCooldownDay;

    Player.recordNpcMemory = recordNpcMemory;
    Player.getNpcMemories = getNpcMemories;
    Player.npcQualifiesForMemory = _npcQualifiesForMemory;

    // NPC Interactions
    Player.getAvailableInteractions = getAvailableInteractions;
    Player.interactWithNPC = interactWithNPC;

    // Guild Membership
    Player.isGuildMember = isGuildMember;
    Player.joinGuild = joinGuild;
    Player.setGuildAutoRenew = setGuildAutoRenew;
    Player.getGuildPrice = getGuildPrice;
    Player.getGuildForCategory = getGuildForCategory;

})(window.Player);