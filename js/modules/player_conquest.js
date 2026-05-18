// ========================================================
// player_conquest.js
// §13B CONQUEST SERVITUDE (player) — extracted from player.js
// Pilgrim, Shipwrecked, Musician, Military Leader, Scholar,
// Family actions, and related helpers
// ========================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_conquest.js");

    var player;
    function _sync() { player = Player.state; }

    // ── Player helpers (defined in player.js, accessed via Player) ──
    var grantXP = function(amount, reason) { return Player.grantXP(amount, reason); };
    var hasSkill = function(skillId) { return Player.hasSkill(skillId); };
    var inflictRandomInjury = function(source) { return Player.inflictRandomInjury(source); };
    var modifyRelationship = function(personId, amount, type) { return Player.modifyRelationship(personId, amount, type); };
    var findResource = function(resId) { return Player.findResource(resId); };

    function tickConquestServitude() {
        _sync();
        if (!player.conquestServitude || !player.conquestServitude.active) return;

        var day = Engine.getDay();

        // Auto-free after servitude period ends
        if (day >= player.conquestServitude.servitudeEndDay) {
            freeFromConquestServitude('Your period of servitude has ended. You are a free citizen!');
            return;
        }
    }

    function freeFromConquestServitude(message) {
        player.conquestServitude.active = false;
        Engine.logEvent(message || (player.fullName + ' has been freed from conquest servitude!'));
        grantXP(50, 'freedom');
    }

    function buyFreedom() {
        _sync();
        if (!player.conquestServitude || !player.conquestServitude.active) {
            return { success: false, message: 'You are not indentured.' };
        }
        var cost = player.conquestServitude.freedomCost || CONFIG.SERVITUDE_FREEDOM_COST;
        if (player.gold < cost) {
            return { success: false, message: 'You need ' + cost + 'g to buy your freedom. You have ' + Math.floor(player.gold) + 'g.' };
        }

        player.gold -= cost;
        // Pay the kingdom
        var kingdom = Engine.findKingdom(player.conquestServitude.kingdomId);
        if (kingdom) kingdom.gold += cost;

        freeFromConquestServitude(player.fullName + ' has purchased their freedom for ' + cost + ' gold!');
        return { success: true, message: 'You have bought your freedom for ' + cost + 'g!' };
    }

    function tickPilgrim() {
        _sync();
        var day = Engine.getDay();
        // Followers give tithe monthly
        if (day % 30 === 0 && player.pilgrim.followers > 0) {
            var tithe = player.pilgrim.followers;
            player.gold += tithe;
            player.stats.totalGoldEarned += tithe;
        }

        // Rival faith grows
        if (!player.pilgrim.rivalDefeated && player.pilgrim.rivalFaith) {
            var rival = player.pilgrim.rivalFaith;
            if (day % 15 === 0) {
                // Rival gains followers
                rival.followers += Math.floor(Math.random() * 3) + 1;
                rival.strength = Math.min(100, rival.strength + 1);
                
                // Rival steals your followers if in the same town
                if (rival.townId === player.townId && player.pilgrim.followers > 0) {
                    var stolen = Math.min(player.pilgrim.followers, Math.floor(Math.random() * 2) + 1);
                    player.pilgrim.followers -= stolen;
                    rival.followers += stolen;
                    Engine.logEvent('⚡ ' + rival.preacherName + ' of ' + rival.name + ' has converted ' + stolen + ' of your followers!', null, 'my_actions');
                }
                
                // Rival moves to a new town every 45 days
                if (day % 45 === 0) {
                    var towns = Engine.getTowns();
                    var moveTowns = towns.filter(function(t) { return t.id !== rival.townId; });
                    if (moveTowns.length > 0) {
                        rival.townId = moveTowns[Math.floor(Math.random() * moveTowns.length)].id;
                    }
                }
            }
            
            // If rival gets too strong, they take over holy sites you haven't visited
            if (rival.strength >= 60 && day % 60 === 0) {
                var unvisitedSites = player.pilgrim.holySites.filter(function(sId) {
                    return player.pilgrim.visitedSites.indexOf(sId) === -1;
                });
                if (unvisitedSites.length > 0) {
                    var contestedSite = unvisitedSites[Math.floor(Math.random() * unvisitedSites.length)];
                    var contestedTown = Engine.findTown(contestedSite);
                    if (contestedTown) {
                        Engine.logEvent('⚠️ ' + rival.name + ' is claiming the holy site in ' + contestedTown.name + '! Visit it before they desecrate it!');
                    }
                }
            }
        }

        // Check goal completion
        checkPilgrimGoals();
    }

    function checkPilgrimGoals(){
        var p = player.pilgrim;
        var completed = 0;
        for (var gi = 0; gi < p.goals.length; gi++) {
            var g = p.goals[gi];
            if (g === 'visit_all_sites' && p.visitedSites.length >= p.holySites.length) completed++;
            else if (g === 'convert_50_followers' && p.followers >= 50) completed++;
            else if (g === 'build_temple' && p.templeBuilt) completed++;
        }
        p.goalsCompleted = completed;

        if (completed >= 2 && p.active) {
            p.active = false;
            player.skills.divine_favor = true;
            player.skills.blessed_merchant = true;
            player.skills.prophets_tongue = true;
            Engine.logEvent(player.fullName + ' has completed their holy pilgrimage! Divine powers unlocked.');
            grantXP(100, 'pilgrimage complete');
            // Clear bankruptcy state if this was a priest-path bankruptcy
            if (player.bankruptcy && player.bankruptcy.active && player.bankruptcy.type === 'priest') {
                player.bankruptcy.active = false;
                player.bankruptcy.completedDay = Engine.getDay();
                Engine.logEvent('📜 ' + player.fullName + '\'s bankruptcy debt forgiven through completion of the holy pilgrimage.');
            }
        }
    }

    function tickShipwrecked() {
        _sync();
        var day = Engine.getDay();
        
        // Language growth from daily interactions
        if (day % 5 === 0 && player.shipwrecked.languageSkill < 100) {
            player.shipwrecked.languageSkill = Math.min(100, player.shipwrecked.languageSkill + 1);
        }
        
        // Artifact pulses when near a resonance site (same town)
        if (player.shipwrecked.artifactKept && player.shipwrecked.resonanceSites) {
            var pulsing = false;
            for (var si = 0; si < player.shipwrecked.resonanceSites.length; si++) {
                var site = player.shipwrecked.resonanceSites[si];
                if (!site.visited && site.townId === player.townId) {
                    pulsing = true;
                    break;
                }
            }
            player.shipwrecked.artifactPulsing = pulsing;
        }
        
        // Check final choice availability
        if (player.shipwrecked.active && !player.shipwrecked.finalChoiceAvailable) {
            if (player.shipwrecked.languageSkill >= 100 && player.shipwrecked.resonanceSitesVisited >= 5) {
                player.shipwrecked.finalChoiceAvailable = true;
                Engine.logEvent('🌟 The artifact thrums with power. All sea chart fragments assembled. ' + player.fullName + ' must now choose: OPEN the artifact or SEAL its power within.');
            }
        }
        
        // Embassy tick (if opened)
        if (player.shipwrecked.embassy && player.shipwrecked.finalChoice === 'open') {
            var emb = player.shipwrecked.embassy;
            // Generate 10 potions per day
            if (day % 1 === 0) {
                emb.potionStockRed = Math.min(50, (emb.potionStockRed || 0) + 3);
                emb.potionStockGreen = Math.min(50, (emb.potionStockGreen || 0) + 3);
                emb.potionStockBlue = Math.min(50, (emb.potionStockBlue || 0) + 4);
                player.shipwrecked.embassyPotionsGenerated += 10;
            }
            // Embassy sells potions daily (auto-sell from stock)
            if (day % 3 === 0) {
                var rng = Engine.getRng();
                var potionTypes = ['red', 'green', 'blue'];
                for (var pi = 0; pi < potionTypes.length; pi++) {
                    var stockKey = 'potionStock' + potionTypes[pi].charAt(0).toUpperCase() + potionTypes[pi].slice(1);
                    var stock = emb[stockKey] || 0;
                    if (stock > 0) {
                        var sold = Math.min(stock, rng.randInt(1, 3));
                        var basePrice = 500;
                        // Dynamic pricing: +/- 20%
                        var price = Math.floor(basePrice * (0.8 + rng.random() * 0.4));
                        var income = sold * price;
                        player.shipwrecked.embassyBankAccount += income;
                        emb[stockKey] -= sold;
                    }
                }
            }
            // Embassy buys from local market (items sent to homeland = deleted)
            if (day % 7 === 0 && player.shipwrecked.embassyBankAccount > 100) {
                var embTown = Engine.findTown(emb.townId);
                if (embTown && embTown.market) {
                    var marketKeys = Object.keys(embTown.market);
                    if (marketKeys.length > 0) {
                        var rng2 = Engine.getRng();
                        var buyRes = rng2.pick(marketKeys);
                        var mEntry = embTown.market[buyRes];
                        var mPrice = typeof mEntry === 'object' ? (mEntry.price || 10) : (mEntry || 10);
                        var buyQty = Math.min(5, Math.floor(player.shipwrecked.embassyBankAccount / mPrice));
                        if (buyQty > 0) {
                            var cost = buyQty * mPrice;
                            player.shipwrecked.embassyBankAccount -= cost;
                            // Items are "sent to homeland" — removed from market supply
                            if (typeof mEntry === 'object' && mEntry.supply !== undefined) {
                                mEntry.supply = Math.max(0, mEntry.supply - buyQty);
                            }
                        }
                    }
                }
            }
        }
        
        // Seal bonuses tick
        if (player.shipwrecked.sealBonuses && player.shipwrecked.finalChoice === 'seal') {
            // +25% relationship/reputation gains are applied in the gain functions
            // Disease/injury reduction applied in inflict functions
            // Speed bonus applied in travel functions
            // These are checked via player.shipwrecked.sealBonuses existing
        }
        
        // Integration completion (old behavior kept for backward compat, but now also triggers with resonance)
        if (player.shipwrecked.languageSkill >= 100 && player.shipwrecked.active && player.shipwrecked.finalChoice) {
            player.shipwrecked.active = false;
            player.skills.world_traveler = true;
            player.skills.diplomatic_immunity = true;
            player.skills.exotic_knowledge = true;
            Engine.logEvent(player.fullName + ' has fully integrated into society! Unique abilities unlocked.');
            grantXP(80, 'full integration');
        }
    }

    function tickMusician() {
        _sync();
        var day = Engine.getDay();
        // Passive fame spread from fans
        var kingdoms = Engine.getKingdoms();
        for (var ki = 0; ki < kingdoms.length; ki++) {
            var kId = kingdoms[ki].id;
            var fansInKingdom = 0;
            for (var fId in player.musician.fans) {
                if (player.musician.fans[fId]) {
                    var fanPerson = Engine.findPerson(fId);
                    if (fanPerson && fanPerson.alive) {
                        var fanTown = Engine.findTown(fanPerson.townId);
                        if (fanTown && fanTown.kingdomId === kId) fansInKingdom++;
                    }
                }
            }
            if (fansInKingdom > 0) {
                player.musician.fame[kId] = Math.min(100, (player.musician.fame[kId] || 0) + fansInKingdom * 0.01);
            }
        }

        // Fan gifts monthly
        if (day % 30 === 0) {
            var totalFans = Object.keys(player.musician.fans).length;
            if (totalFans > 0) {
                player.gold += totalFans;
                player.stats.totalGoldEarned += totalFans;
            }
        }

        // Rival musicians grow and move
        if (player.musician.rivals && day % 20 === 0) {
            for (var ri2 = 0; ri2 < player.musician.rivals.length; ri2++) {
                var rival = player.musician.rivals[ri2];
                if (rival.defeated) continue;
                rival.skill = Math.min(95, rival.skill + 1);
                rival.fans += Math.floor(Math.random() * 3) + 1;
                // Move to random town every 60 days
                if (day % 60 === 0) {
                    var allTowns = Engine.getTowns();
                    rival.townId = allTowns[Math.floor(Math.random() * allTowns.length)].id;
                }
                // Rival steals fans if in same town
                if (rival.townId === player.townId) {
                    var stolenFans = 0;
                    var tPeople = Engine.getPeople(player.townId);
                    for (var sf = 0; sf < tPeople.length && stolenFans < 2; sf++) {
                        if (player.musician.fans[tPeople[sf].id] && Math.random() < 0.1) {
                            delete player.musician.fans[tPeople[sf].id];
                            stolenFans++;
                        }
                    }
                    if (stolenFans > 0) {
                        rival.fans += stolenFans;
                        Engine.logEvent('🎵 ' + rival.name + ' performed in your town and stole ' + stolenFans + ' of your fans!');
                    }
                }
            }
        }

        // Music school passive income
        if (player.musician.legacyChoice === 'music_school' && player.musician.musicSchoolTownId && day % 7 === 0) {
            var schoolIncome = 30 + Object.keys(player.musician.fans).length;
            schoolIncome = Math.min(150, schoolIncome);
            player.gold += schoolIncome;
            player.stats.totalGoldEarned += schoolIncome;
            player.musician.musicSchoolIncome = (player.musician.musicSchoolIncome || 0) + schoolIncome;
        }

        // Legendary bard income boost (applied in performance functions via skill check)
        // Legendary bards: fame doesn't decay

        // Check fame milestone — offer legacy choice at 80+ fame
        if (player.musician.active && !player.musician.legacyChoice) {
            for (var mk = 0; mk < kingdoms.length; mk++) {
                if ((player.musician.fame[kingdoms[mk].id] || 0) >= 80) {
                    player.musician.legacyOffered = true;
                    Engine.logEvent('🌟 ' + player.fullName + ' has reached legendary fame in ' + kingdoms[mk].name + '! A choice awaits: retire and build a Music School, or continue as a Legendary Bard.');
                    break;
                }
            }
        }
    }

    function tickMilitaryLeader() {
        _sync();
        var ml = player.militaryLeader;
        var day = Engine.getDay();

        // Check for General retirement (held for 360 days)
        if (ml.rank === 'general' && ml.generalSinceDay > 0) {
            if (day - ml.generalSinceDay >= 360 && ml.active) {
                ml.active = false;
                player.skills.hero_of_ages = true;
                player.skills.legendary_commander = true;
                player.skills.battle_scarred = true;
                player.skills.war_council = true;
                // Permanent rep boost
                var kingdoms = Engine.getKingdoms();
                for (var ki = 0; ki < kingdoms.length; ki++) {
                    player.reputation[kingdoms[ki].id] = Math.min(100, (player.reputation[kingdoms[ki].id] || 50) + 50);
                }
                Engine.logEvent(player.fullName + ' retires as Hero of Ages! Legendary status achieved.');
                grantXP(200, 'hero of ages');
            }
        }

        // Update war council access based on rank
        var milRanks = CONFIG.MILITARY_LEADER_RANKS || [];
        var milRankIdx = milRanks.findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        player.militaryLeader.warCouncilAccess = milRankIdx >= 4; // captain+
        
        // Check decisive battle availability
        if (milRankIdx >= 5 && (player.militaryLeader.victoriesAsLeader || 0) >= 10) {
            if (!player.militaryLeader.decisiveBattleAvailable) {
                player.militaryLeader.decisiveBattleAvailable = true;
                Engine.logEvent('⚔️ ' + player.fullName + ' is now eligible for the DECISIVE BATTLE — the path to becoming Hero of the Ages!');
            }
        }
    }

    function tickScholar() {
        _sync();
        var day = Engine.getDay();
        var s = player.scholar;

        // Knowledge fades if not written
        if (day % 30 === 0 && s.totalKnowledge > 0 && (day - (s.lastWriteDay || 0)) > 30) {
            s.totalKnowledge = Math.max(0, s.totalKnowledge - 1);
        }

        // Royalties from Great Book
        if (s.royaltiesActive && s.greatBookWritten && day % 7 === 0) {
            // Check if current player is the author (royalties end on death/inheritance)
            var currentGen = player.generation || 1;
            if (currentGen !== (s.royaltiesGeneration || 1)) {
                s.royaltiesActive = false;
                Engine.logEvent('📖 The royalties from the Great Book have ended with the passing of its author.');
            } else {
                // Weekly royalties: base 20g + 5g per specialization knowledge (capped at 100g/week)
                var baseRoyalty = 20;
                var specBonus = Math.floor((s.specializationKnowledge || 0) / 10);
                var royalty = Math.min(100, baseRoyalty + specBonus);
                player.gold += royalty;
                player.stats.totalGoldEarned += royalty;
                s.totalRoyaltiesEarned = (s.totalRoyaltiesEarned || 0) + royalty;

                // Monthly reputation boost across all kingdoms
                if (day % 30 === 0) {
                    var kingdoms = Engine.getKingdoms();
                    for (var ki = 0; ki < kingdoms.length; ki++) {
                        player.reputation[kingdoms[ki].id] = Math.min(100, (player.reputation[kingdoms[ki].id] || 50) + 1);
                    }
                }
            }
        }
    }

    // ── Special Start Actions ──

    // Pilgrim actions
    function giveSermon(townId) {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'You are not on a pilgrimage.' };
        var rng = Engine.getRng();
        // Sermon quality scales with experience
        var sermonSkill = Math.min(100, player.pilgrim.sermonsGiven * 2);  // 0-100 based on practice
        var minConverts = sermonSkill >= 80 ? 3 : (sermonSkill >= 40 ? 2 : 1);
        var maxConverts = sermonSkill >= 80 ? 8 : (sermonSkill >= 40 ? 5 : 3);
        var converts = rng.randInt(minConverts, maxConverts);
        var minDonations = sermonSkill >= 60 ? 8 : (sermonSkill >= 30 ? 4 : 2);
        var maxDonations = sermonSkill >= 60 ? 25 : (sermonSkill >= 30 ? 15 : 10);
        var donations = rng.randInt(minDonations, maxDonations);
        player.pilgrim.sermonsGiven++;
        player.pilgrim.followers += converts;
        player.gold += donations;
        player.stats.totalGoldEarned += donations;
        player.pilgrim.donations += donations;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.give_sermon || 5);
        var sermonQuality = sermonSkill >= 80 ? 'powerful' : (sermonSkill >= 40 ? 'compelling' : 'modest');
        Engine.logEvent(player.fullName + ' gave a ' + sermonQuality + ' sermon. ' + converts + ' new followers! ' + donations + 'g in donations.');
        grantXP(3, 'sermon');
        return { success: true, message: sermonQuality.charAt(0).toUpperCase() + sermonQuality.slice(1) + ' sermon! ' + converts + ' converts, ' + donations + 'g donations. (Skill: ' + sermonSkill + '%)' };
    }

    function visitHolySite(townId) {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'You are not on a pilgrimage.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        var town = Engine.findTown(townId);
        if (!town || !town.holySite) return { success: false, message: 'This town has no holy site.' };
        if (player.pilgrim.visitedSites.indexOf(townId) !== -1) return { success: false, message: 'Already visited this holy site.' };
        player.pilgrim.visitedSites.push(townId);
        var rng = Engine.getRng();
        if (town.kingdomId) {
            player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 5);
        }
        // Holy site unique event
        var siteIndex = player.pilgrim.visitedSites.length; // Which site number is this
        var eventRoll = rng.random();
        var eventMsg = '';
        if (eventRoll < 0.25) {
            // Test of faith — donate gold for bonus followers
            var donationCost = 50 + siteIndex * 20;
            if (player.gold >= donationCost) {
                player.gold -= donationCost;
                player.stats.totalGoldSpent += donationCost;
                var bonusFollowers = rng.randInt(3, 8);
                player.pilgrim.followers += bonusFollowers;
                eventMsg = ' 🙏 Test of Faith: You donated ' + donationCost + 'g to the shrine and gained ' + bonusFollowers + ' devoted followers!';
            } else {
                eventMsg = ' 🙏 The shrine asked for a ' + donationCost + 'g donation, but you couldn\'t afford it.';
            }
        } else if (eventRoll < 0.5) {
            // Vision — bonus XP and knowledge (if scholar too)
            grantXP(15, 'holy vision');
            eventMsg = ' ✨ Vision: You experienced a divine vision! The path ahead is clearer. +15 XP.';
            if (town.kingdomId) {
                player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 5);
                eventMsg += ' +5 rep.';
            }
        } else if (eventRoll < 0.7) {
            // Ancient relic — permanent bonus
            var relicGold = rng.randInt(20, 60);
            player.gold += relicGold;
            player.stats.totalGoldEarned += relicGold;
            eventMsg = ' 🏺 Ancient Relic: You discovered a sacred relic worth ' + relicGold + 'g!';
        } else if (eventRoll < 0.85) {
            // Challenge — bandits at the site
            var lostGold = Math.min(player.gold, rng.randInt(10, 30));
            player.gold -= lostGold;
            player.pilgrim.followers += 2; // Sympathy followers
            eventMsg = ' ⚔️ Bandits! Robbed of ' + lostGold + 'g at the site, but 2 locals join you in sympathy.';
        } else {
            // Miracle — big follower boost
            var miracleFollowers = rng.randInt(5, 12);
            player.pilgrim.followers += miracleFollowers;
            eventMsg = ' ⭐ Miracle! A sign appeared at the shrine — ' + miracleFollowers + ' people witnessed it and joined your faith!';
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.visit_holy_site || 10);
        Engine.logEvent(player.fullName + ' visited the holy site in ' + town.name + '.');
        grantXP(20, 'holy site');
        checkPilgrimGoals();
        return { success: true, message: 'Holy site visited! +20 XP, +5 rep. Sites: ' + player.pilgrim.visitedSites.length + '/' + player.pilgrim.holySites.length + eventMsg };
    }

    function convertNPC(npcId) {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'You are not on a pilgrimage.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Person not found.' };
        if (person.townId !== player.townId) return { success: false, message: 'Not in the same town.' };
        if (player.pilgrim.followerNpcs[npcId]) return { success: false, message: 'Already a follower.' };
        var rng = Engine.getRng();
        var rel = (player.relationships[npcId] && player.relationships[npcId].level) || 0;
        var warmth = (person.personality && person.personality.warmth) || 50;
        var chance = (rel + warmth) / 300;
        player.pilgrim.conversionAttempts++;
        if (rng.random() < chance) {
            player.pilgrim.followers++;
            player.pilgrim.followerNpcs[npcId] = true;
            if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.convert_npc || 3);
            grantXP(5, 'convert');
            checkPilgrimGoals();
            return { success: true, message: person.firstName + ' has been converted! Total followers: ' + player.pilgrim.followers };
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.convert_npc || 3);
        return { success: false, message: person.firstName + ' was not convinced.' };
    }

    function blessNPC(npcId) {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'You are not on a pilgrimage.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Person not found.' };
        player.relationships[npcId] = player.relationships[npcId] || { level: 0, type: 'acquaintance' };
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + 10);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.bless_npc || 2);
        return { success: true, message: 'You blessed ' + person.firstName + '. +10 relationship.' };
    }

    function buildTemple(townId) {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'You are not on a pilgrimage.' };
        if (player.pilgrim.templeBuilt) return { success: false, message: 'You have already built a temple.' };
        var tid = townId || player.townId;
        var town = Engine.findTown(tid);
        if (!town) return { success: false, message: 'Town not found.' };
        if (player.townId !== tid) return { success: false, message: 'You must be in this town.' };
        var cost = 500;
        if (player.gold < cost) return { success: false, message: 'You need ' + cost + 'g to build a temple.' };
        if (player.pilgrim.followers < 20) return { success: false, message: 'You need at least 20 followers to build a temple.' };
        player.gold -= cost;
        player.stats.totalGoldSpent += cost;
        player.pilgrim.templeBuilt = true;
        player.pilgrim.templeTownId = tid;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.build_temple || 30);
        Engine.logEvent(player.fullName + ' built a temple in ' + town.name + '!');
        grantXP(50, 'build temple');
        checkPilgrimGoals();
        return { success: true, message: 'Temple built in ' + town.name + '! 🏛️' };
    }

    function challengeRivalFaith() {
        _sync();
        if (!player.pilgrim || !player.pilgrim.active) return { success: false, message: 'Not on a pilgrimage.' };
        if (player.pilgrim.rivalDefeated) return { success: false, message: 'The rival faith has already been defeated.' };
        var rival = player.pilgrim.rivalFaith;
        if (!rival || rival.townId !== player.townId) {
            var rivalTown = rival ? Engine.findTown(rival.townId) : null;
            return { success: false, message: 'The rival preacher is not in this town.' + (rivalTown ? ' They were last seen in ' + rivalTown.name + '.' : '') };
        }
        
        // Theological debate! Player strength based on followers, sermons given, and reputation
        var playerStr = player.pilgrim.followers * 2 + player.pilgrim.sermonsGiven * 3;
        var town = Engine.findTown(player.townId);
        if (town && town.kingdomId) playerStr += (player.reputation[town.kingdomId] || 0);
        var rivalStr = rival.followers * 2 + rival.strength;
        
        var rng = Engine.getRng();
        // Add some randomness
        playerStr += rng.randInt(0, 30);
        rivalStr += rng.randInt(0, 30);
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.challenge_rival || 10);
        
        if (playerStr > rivalStr) {
            // Victory — steal their followers, weaken them
            var stolenBack = Math.floor(rival.followers * 0.5);
            player.pilgrim.followers += stolenBack;
            rival.followers = Math.max(0, rival.followers - stolenBack);
            rival.strength = Math.max(0, rival.strength - 25);
            
            if (rival.strength <= 0) {
                player.pilgrim.rivalDefeated = true;
                Engine.logEvent('🏆 ' + player.fullName + ' has defeated ' + rival.preacherName + ' in a great theological debate! ' + rival.name + ' disbands!');
                grantXP(50, 'defeated rival faith');
                return { success: true, message: 'You defeated ' + rival.preacherName + '! Their followers (' + stolenBack + ') join your cause. ' + rival.name + ' is no more!' };
            }
            
            Engine.logEvent('⚡ ' + player.fullName + ' won a theological debate against ' + rival.preacherName + '! Gained ' + stolenBack + ' followers.');
            grantXP(20, 'won debate');
            return { success: true, message: 'You won the debate! Gained ' + stolenBack + ' followers. Rival weakened to ' + rival.strength + ' strength.' };
        } else {
            // Loss — lose some followers
            var lost = Math.min(player.pilgrim.followers, Math.floor(Math.random() * 5) + 2);
            player.pilgrim.followers = Math.max(0, player.pilgrim.followers - lost);
            rival.strength = Math.min(100, rival.strength + 10);
            Engine.logEvent('😔 ' + rival.preacherName + ' bested ' + player.fullName + ' in debate. Lost ' + lost + ' followers.');
            return { success: false, message: 'You lost the debate. -' + lost + ' followers. The rival grows stronger.' };
        }
    }

    // Shipwrecked actions
    function tellExoticStory(townId) {
        _sync();
        if (!player.shipwrecked) return { success: false, message: 'Not available.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        var rng = Engine.getRng();
        var gold = rng.randInt(5, 15);
        player.gold += gold;
        player.stats.totalGoldEarned += gold;
        player.shipwrecked.storiesTold++;
        player.shipwrecked.languageSkill = Math.min(100, player.shipwrecked.languageSkill + 2);
        var town = Engine.findTown(townId);
        if (town && town.kingdomId) {
            player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 3);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.tell_exotic_story || 3);
        grantXP(3, 'story');
        return { success: true, message: 'You told an exotic story! Earned ' + gold + 'g. Language +2.' };
    }

    function teachForeignCraft() {
        _sync();
        if (!player.shipwrecked) return { success: false, message: 'Not available.' };
        var recipes = ['exotic_spice_blend', 'foreign_medicine', 'ornate_jewelry'];
        var newRecipes = recipes.filter(function(r) { return player.shipwrecked.exoticRecipes.indexOf(r) === -1; });
        if (newRecipes.length === 0) return { success: false, message: 'No more recipes to teach.' };
        var recipe = newRecipes[0];
        player.shipwrecked.exoticRecipes.push(recipe);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.teach_foreign_craft || 10);
        grantXP(10, 'foreign craft');
        return { success: true, message: 'You taught the technique for ' + recipe.replace(/_/g, ' ') + '!' };
    }

    function sellExoticArtifact() {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.artifactKept) return { success: false, message: 'No artifact to sell.' };
        if (!player.inventory.exotic_artifact || player.inventory.exotic_artifact < 1) return { success: false, message: 'No artifact.' };
        player.inventory.exotic_artifact = 0;
        player.gold += 800;
        player.stats.totalGoldEarned += 800;
        player.shipwrecked.artifactKept = false;
        return { success: true, message: 'Sold the exotic artifact for 800g. The luck bonus is gone forever.' };
    }

    function visitResonanceSite() {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.artifactKept) return { success: false, message: 'You need the artifact.' };
        if (!player.shipwrecked.resonanceSites) return { success: false, message: 'No resonance sites.' };
        var site = null;
        for (var i = 0; i < player.shipwrecked.resonanceSites.length; i++) {
            if (!player.shipwrecked.resonanceSites[i].visited && player.shipwrecked.resonanceSites[i].townId === player.townId) {
                site = player.shipwrecked.resonanceSites[i];
                break;
            }
        }
        if (!site) return { success: false, message: 'No resonance site here. The artifact is quiet.' };
        
        site.visited = true;
        player.shipwrecked.resonanceSitesVisited++;
        player.shipwrecked.seaChartFragments++;
        player.shipwrecked.languageSkill = Math.min(100, player.shipwrecked.languageSkill + 10);
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.visit_resonance || 20);
        grantXP(25, 'resonance site');
        Engine.logEvent('✨ ' + player.fullName + ' discovered ' + site.name + '! Vision: "' + site.vision + '"');
        
        var remaining = 5 - player.shipwrecked.resonanceSitesVisited;
        return { success: true, message: '✨ ' + site.name + '! Vision: "' + site.vision + '" Sea chart fragment ' + player.shipwrecked.seaChartFragments + '/5.' + (remaining > 0 ? ' ' + remaining + ' sites remain.' : ' All fragments collected!') };
    }
    
    function openArtifact(embassyTownId) {
        _sync();
        if (!player.shipwrecked) return { success: false, message: 'Not shipwrecked start.' };
        if (!player.shipwrecked.finalChoiceAvailable) return { success: false, message: 'Not ready. Need language 100 + all 5 resonance sites.' };
        if (player.shipwrecked.finalChoice) return { success: false, message: 'Choice already made: ' + player.shipwrecked.finalChoice };
        
        var town = Engine.findTown(embassyTownId || player.townId);
        if (!town) return { success: false, message: 'Town not found.' };
        if (!town.isPort) return { success: false, message: 'Embassy must be in a seaport town.' };
        
        player.shipwrecked.finalChoice = 'open';
        player.inventory.exotic_artifact = 0;
        
        // Create embassy
        var embassyData = {
            townId: town.id,
            townName: town.name,
            kingdomId: town.kingdomId,
            builtDay: Engine.getDay(),
            potionStockRed: 5,
            potionStockGreen: 5,
            potionStockBlue: 5
        };
        player.shipwrecked.embassy = embassyData;
        
        // Place building in town
        town.buildings = town.buildings || [];
        town.buildings.push({
            type: 'embassy',
            level: 1,
            ownerId: 'player',
            builtDay: Engine.getDay(),
            // v9p33river294: condition is a state string per
            // CONFIG.CONDITION_LEVELS — numeric 100 fell through every
            // string check (degradation tick, efficiency, repair UI).
            condition: 'new',
            lastRepairDay: Engine.getDay()
        });
        
        // Town becomes indestructible
        town.indestructible = true;
        
        // +2 social ranks
        player.socialRank = player.socialRank || {};
        var currentRank = player.socialRank[town.kingdomId] || 0;
        player.socialRank[town.kingdomId] = Math.min(6, currentRank + 2);
        
        // Diplomatic immunity
        player.shipwrecked.diplomaticImmunityTownId = town.id;
        
        // Generate homeland NPCs
        var homelandNames = [
            { first: 'Kael', last: 'Stormborn', role: 'healer', dialog: [
                'I remember you from the Council chambers. We thought you were lost forever.',
                'This land is... different. The air tastes of salt and old stone.',
                'Back home, the healers work with crystals. Here they use herbs. Both work, I suppose.',
                'I will heal your wounds for free, always. You are family.'
            ]},
            { first: 'Liara', last: 'Tidecaller', role: 'merchant', dialog: [
                'The markets here are chaotic but fascinating. No fixed prices!',
                'In our homeland, the Merchant Guild sets all prices. Here, it is... wild.',
                'You were the youngest council member in a generation. Did you know that?',
                'These people brew a drink called ale. We have nothing like it back home.'
            ]},
            { first: 'Tormund', last: 'Ironveil', role: 'guard', dialog: [
                'I volunteered to come through. Someone has to keep you safe.',
                'Their weapons are crude but effective. I could learn a thing or two.',
                'The storms between our worlds are growing weaker. The artifact did that.',
                'Back home, we have no kings. Only the Council of Tides rules.'
            ]},
            { first: 'Yua', last: 'Dawnweaver', role: 'scholar', dialog: [
                'Remarkable! Their written language uses individual symbols for sounds. Ours uses whole concepts.',
                'I have been cataloging the local flora. Three species unknown to our world!',
                'You were carrying the Artifact of Bridges when you washed ashore. That was no accident.',
                'The people here fear the sea. For us, it was home. How strange.'
            ]},
            { first: 'Ren', last: 'Shellsong', role: 'worker', dialog: [
                'I can fix anything. Point me at a broken wall and I will have it right.',
                'The food here is heavy and rich. I miss the light seafood from home.',
                'We heard your signal across the storm-wall. It took us months to find a passage.',
                'Working for free? Of course. You opened the path. We owe you everything.'
            ]}
        ];
        player.shipwrecked.homelandNPCs = homelandNames;
        
        // Grant skills
        player.skills.embassy_founder = true;
        player.skills.bridge_between_worlds = true;
        
        grantXP(150, 'opened artifact');
        Engine.logEvent('🏛️ ' + player.fullName + ' OPENED the artifact and founded an Embassy in ' + town.name + '! A bridge between two worlds!');
        
        return { success: true, message: '🏛️ Embassy founded in ' + town.name + '! 10 potions/day, own bank, +2 social rank, town is indestructible, diplomatic immunity, homeland NPCs arrived. Warp available (30-day cooldown).' };
    }
    
    function sealArtifact() {
        _sync();
        if (!player.shipwrecked) return { success: false, message: 'Not shipwrecked start.' };
        if (!player.shipwrecked.finalChoiceAvailable) return { success: false, message: 'Not ready. Need language 100 + all 5 resonance sites.' };
        if (player.shipwrecked.finalChoice) return { success: false, message: 'Choice already made: ' + player.shipwrecked.finalChoice };
        
        player.shipwrecked.finalChoice = 'seal';
        player.inventory.exotic_artifact = 0;
        
        // Permanent bonuses
        player.shipwrecked.sealBonuses = {
            speedBonus: 0.25,       // +25% travel speed
            skillPoints: 20,        // one-time
            repBonus: 0.25,         // +25% relationship/rep gains
            diseaseReduction: 0.25, // -25% disease/injury/death
            lifespanBonus: 10,      // +10 years
            deathReversal: true     // one-time death reversal
        };
        player.shipwrecked.deathReversalAvailable = true;
        
        // Grant 20 skill points (as XP equivalent)
        grantXP(500, 'artifact absorption'); // Large XP dump
        
        // Increase max age
        player.maxAge = (player.maxAge || 70) + 10;
        
        // Grant skills
        player.skills.artifact_bearer = true;
        player.skills.seal_of_ages = true;
        player.skills.world_traveler = true;
        
        Engine.logEvent('⚡ ' + player.fullName + ' SEALED the artifact and absorbed its power! +25% speed, +25% rep gains, -25% disease/death risk, +10 year lifespan, one-time death reversal.');
        
        return { success: true, message: '⚡ POWER ABSORBED! +25% travel speed, +500 XP, +25% relationship gains, -25% disease/injury/death, +10 year lifespan. If you die, you may reverse death ONCE (bonuses removed except skills).' };
    }
    
    function warpToEmbassy() {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.embassy) return { success: false, message: 'No embassy.' };
        var day = Engine.getDay();
        var cooldown = 30;
        if (day - (player.shipwrecked.lastWarpDay || -9999) < cooldown) {
            var remaining = cooldown - (day - player.shipwrecked.lastWarpDay);
            return { success: false, message: 'Warp on cooldown. ' + remaining + ' days remaining.' };
        }
        
        player.shipwrecked.lastWarpDay = day;
        player.townId = player.shipwrecked.embassy.townId;
        player.traveling = false;
        // Move companions to new location
        if (player.travelCompanions && player.travelCompanions.length > 0) {
            for (var _sci = 0; _sci < player.travelCompanions.length; _sci++) {
                var _scn = Engine.findPerson(player.travelCompanions[_sci].npcId);
                if (_scn && _scn.alive) _scn.townId = player.townId;
            }
            player.travelCompanions = [];
        }
        
        // Update coordinates
        var embTown = Engine.findTown(player.shipwrecked.embassy.townId);
        if (embTown) {
            player.worldX = embTown.x;
            player.worldY = embTown.y;
        }
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(5);
        Engine.logEvent('🌀 ' + player.fullName + ' warped to the Embassy in ' + (player.shipwrecked.embassy.townName || 'embassy town') + '!');
        return { success: true, message: '🌀 Warped to Embassy in ' + (player.shipwrecked.embassy.townName || 'embassy town') + '! Next warp in 30 days.' };
    }
    
    function claimFreePotion(type) {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.embassy) return { success: false, message: 'No embassy.' };
        var validTypes = ['red', 'green', 'blue'];
        if (validTypes.indexOf(type) === -1) return { success: false, message: 'Choose red, green, or blue.' };
        
        var day = Engine.getDay();
        if (day - (player.shipwrecked.lastFreePotionDay || -9999) < 30) {
            var remaining = 30 - (day - player.shipwrecked.lastFreePotionDay);
            return { success: false, message: 'Free potion available in ' + remaining + ' days.' };
        }
        
        player.shipwrecked.lastFreePotionDay = day;
        player.shipwrecked.freePotion = { type: type, claimedDay: day, expiresDay: day + 30 };
        
        // Apply potion effect
        var effectMsg = '';
        if (type === 'red') {
            player.shipwrecked.freePotion.effect = 'strength';
            effectMsg = '💪 Crimson Vigor: +25% combat strength, +15% work output for 30 days.';
        } else if (type === 'green') {
            player.shipwrecked.freePotion.effect = 'productivity';
            effectMsg = '⚡ Emerald Swiftness: +25% travel speed, +15% skill gain rate for 30 days.';
        } else if (type === 'blue') {
            player.shipwrecked.freePotion.effect = 'immunity';
            effectMsg = '🛡️ Azure Ward: Immune to disease and injury for 30 days.';
        }
        
        grantXP(5, 'potion claimed');
        return { success: true, message: 'Free potion claimed! ' + effectMsg + ' You can sell it instead or use it.' };
    }
    
    function talkToHomelandNPC(npcIndex) {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.homelandNPCs) return { success: false, message: 'No homeland NPCs.' };
        if (!player.shipwrecked.embassy || player.townId !== player.shipwrecked.embassy.townId) {
            return { success: false, message: 'You must be at the Embassy to talk to homeland NPCs.' };
        }
        var npc = player.shipwrecked.homelandNPCs[npcIndex];
        if (!npc) return { success: false, message: 'NPC not found.' };
        
        var rng = Engine.getRng();
        var dialog = npc.dialog[rng.randInt(0, npc.dialog.length - 1)];
        
        // Healer heals for free
        if (npc.role === 'healer') {
            if (player.injuries && player.injuries.length > 0) {
                player.injuries = [];
                dialog += ' (All injuries healed!)';
            }
            if (player.illnesses && player.illnesses.length > 0) {
                player.illnesses = [];
                dialog += ' (All illnesses cured!)';
            }
        }
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(2);
        return { success: true, message: npc.first + ' ' + npc.last + ' (' + npc.role + '): "' + dialog + '"' };
    }
    
    function reverseShipwreckedDeath() {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.deathReversalAvailable) return { success: false, message: 'No death reversal available.' };
        if (player.shipwrecked.deathReversalUsed) return { success: false, message: 'Already used death reversal.' };
        
        player.shipwrecked.deathReversalUsed = true;
        player.shipwrecked.deathReversalAvailable = false;
        player.alive = true;
        player.energy = 50;
        
        // Remove seal bonuses except skill points already spent
        if (player.shipwrecked.sealBonuses) {
            player.shipwrecked.sealBonuses.speedBonus = 0;
            player.shipwrecked.sealBonuses.repBonus = 0;
            player.shipwrecked.sealBonuses.diseaseReduction = 0;
            player.shipwrecked.sealBonuses.lifespanBonus = 0;
            player.maxAge = (player.maxAge || 80) - 10;
        }
        
        Engine.logEvent('💫 ' + player.fullName + ' has been brought back from death by the artifact\'s residual power! But the power is spent — bonuses removed.');
        return { success: true, message: '💫 Death reversed! You live again, but artifact bonuses are gone. Only your earned skills remain.' };
    }

    // Musician actions
    function performAtTavern(townId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        var rng = Engine.getRng();
        var gold = Math.floor(5 + (player.musician.musicSkill / 100) * 15);
        if (hasSkill('musician')) gold = Math.floor(gold * 1.5);
        player.gold += gold;
        player.stats.totalGoldEarned += gold;
        player.musician.totalPerformances++;
        player.musician.musicSkill = Math.min(100, player.musician.musicSkill + 1);
        // Gain fans
        var newFans = rng.randInt(1, 3);
        var townPeople = Engine.getPeople(townId);
        var potentialFans = townPeople.filter(function(p) { return !player.musician.fans[p.id]; });
        for (var fi = 0; fi < Math.min(newFans, potentialFans.length); fi++) {
            player.musician.fans[potentialFans[fi].id] = true;
        }
        // Fame boost
        var town = Engine.findTown(townId);
        if (town && town.kingdomId) {
            var fameGain = hasSkill('musician') ? 0.15 : 0.12;
            player.musician.fame[town.kingdomId] = Math.min(100, (player.musician.fame[town.kingdomId] || 0) + fameGain);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.perform_tavern || 8);
        grantXP(3, 'performance');
        return { success: true, message: 'Tavern performance! Earned ' + gold + 'g. Music skill: ' + player.musician.musicSkill };
    }

    function streetPerformance(townId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        var rng = Engine.getRng();
        var gold = rng.randInt(2, 8);
        if (hasSkill('musician')) gold = Math.floor(gold * 1.5);
        player.gold += gold;
        player.stats.totalGoldEarned += gold;
        player.musician.totalPerformances++;
        var newFans = rng.randInt(2, 5);
        var townPeople = Engine.getPeople(townId);
        var potentialFans = townPeople.filter(function(p) { return !player.musician.fans[p.id]; });
        for (var fi = 0; fi < Math.min(newFans, potentialFans.length); fi++) {
            player.musician.fans[potentialFans[fi].id] = true;
        }
        var town = Engine.findTown(townId);
        if (town && town.kingdomId) {
            var streetFameGain = hasSkill('musician') ? 0.08 : 0.06;
            player.musician.fame[town.kingdomId] = Math.min(100, (player.musician.fame[town.kingdomId] || 0) + streetFameGain);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.street_performance || 5);
        grantXP(2, 'street performance');
        return { success: true, message: 'Street performance! Earned ' + gold + 'g.' };
    }

    function hostConcert(townId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (player.musician.musicSkill < 40) return { success: false, message: 'Music skill must be 40+.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        // Count fans in town
        var fansInTown = 0;
        var townPeople = Engine.getPeople(townId);
        for (var ti = 0; ti < townPeople.length; ti++) {
            if (player.musician.fans[townPeople[ti].id]) fansInTown++;
        }
        if (fansInTown < 20) return { success: false, message: 'Need 20+ fans in this town. Current: ' + fansInTown };
        if (player.gold < 50) return { success: false, message: 'Need 50g for venue rental.' };
        player.gold -= 50;
        var earnings = fansInTown * 5;
        player.gold += earnings;
        player.stats.totalGoldEarned += earnings;
        var town = Engine.findTown(townId);
        if (town && town.kingdomId) {
            player.musician.fame[town.kingdomId] = Math.min(100, (player.musician.fame[town.kingdomId] || 0) + 0.5);
        }
        player.musician.totalPerformances++;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.host_concert || 30);
        grantXP(15, 'concert');
        return { success: true, message: 'Concert! Earned ' + earnings + 'g from ' + fansInTown + ' fans!' };
    }

    function composeSong(theme) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        var validThemes = ['love', 'war', 'comedy', 'tragedy', 'nature', 'epic'];
        if (validThemes.indexOf(theme) === -1) theme = 'love';
        var day = Engine.getDay();
        var rng = Engine.getRng();
        player.musician.songsComposed.push({ theme: theme, day: day, quality: player.musician.musicSkill });
        
        // Theme-specific fame bonuses
        var kingdoms = Engine.getKingdoms();
        var fameBonus = 0.25 + Math.floor(player.musician.musicSkill / 50) * 0.1;
        for (var ki = 0; ki < kingdoms.length; ki++) {
            var k = kingdoms[ki];
            var bonus = fameBonus;
            // War songs boost more in kingdoms at war
            if (theme === 'war' && k.atWar && (Array.isArray(k.atWar) ? k.atWar.length > 0 : k.atWar.size > 0)) {
                bonus = Math.floor(bonus * 2);
            }
            // Love songs popular in peaceful kingdoms
            if (theme === 'love' && (!k.atWar || (k.atWar instanceof Set ? k.atWar.size === 0 : (Array.isArray(k.atWar) ? k.atWar.length === 0 : true)))) {
                bonus = Math.floor(bonus * 1.5);
            }
            // Comedy popular everywhere (slight universal bonus)
            if (theme === 'comedy') bonus = Math.floor(bonus * 1.3);
            // Epic songs boost in large kingdoms
            if (theme === 'epic') bonus = Math.floor(bonus * 1.4);
            player.musician.fame[k.id] = Math.min(100, (player.musician.fame[k.id] || 0) + bonus);
        }
        
        player.musician.musicSkill = Math.min(100, player.musician.musicSkill + 2);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.compose_song || 10);
        grantXP(5, 'compose');
        var themeLabels = { love: '❤️ Love Ballad', war: '⚔️ War Anthem', comedy: '😂 Comedy', tragedy: '😢 Tragedy', nature: '🌿 Nature Hymn', epic: '⭐ Epic Tale' };
        return { success: true, message: 'Composed: ' + (themeLabels[theme] || theme) + '! Fame boosted across all kingdoms. Total songs: ' + player.musician.songsComposed.length };
    }

    function performAtCourt(kingdomId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if ((player.musician.fame[kingdomId] || 0) < 30) return { success: false, message: 'Need 30+ fame in this kingdom.' };
        var day = Engine.getDay();
        if (player.musician.lastCourtPerformance[kingdomId] && day - player.musician.lastCourtPerformance[kingdomId] < 30) {
            return { success: false, message: 'Must wait 30 days between court performances.' };
        }
        var rng = Engine.getRng();
        var gold = rng.randInt(50, 200);
        player.gold += gold;
        player.stats.totalGoldEarned += gold;
        player.reputation[kingdomId] = Math.min(100, (player.reputation[kingdomId] || 50) + 15);
        player.musician.lastCourtPerformance[kingdomId] = day;
        player.musician.totalPerformances++;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.perform_court || 15);
        grantXP(10, 'court performance');
        return { success: true, message: 'Performed at court! Earned ' + gold + 'g, +15 reputation.' };
    }

    function privatePerformance(npcId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Person not found.' };
        var rng = Engine.getRng();
        var gold = rng.randInt(10, 50);
        player.gold += gold;
        player.stats.totalGoldEarned += gold;
        player.relationships[npcId] = player.relationships[npcId] || { level: 0, type: 'acquaintance' };
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + 15);
        player.musician.totalPerformances++;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.private_performance || 5);
        grantXP(3, 'private performance');
        return { success: true, message: 'Private performance for ' + person.firstName + '! ' + gold + 'g, +15 relationship.' };
    }

    function grandConcert(townId) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (player.musician.musicSkill < 70) return { success: false, message: 'Music skill must be 70+ for a Grand Concert.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        var avgFame = 0;
        var kingdoms = Engine.getKingdoms();
        for (var ki = 0; ki < kingdoms.length; ki++) {
            avgFame += (player.musician.fame[kingdoms[ki].id] || 0);
        }
        avgFame = kingdoms.length > 0 ? avgFame / kingdoms.length : 0;
        if (avgFame < 50) return { success: false, message: 'Need 50+ average fame across kingdoms. Current: ' + Math.floor(avgFame) };
        if (player.gold < 200) return { success: false, message: 'Need 200g for Grand Concert venue and marketing.' };
        
        player.gold -= 200;
        var rng = Engine.getRng();
        var skill = player.musician.musicSkill;
        var songCount = player.musician.songsComposed.length;
        
        // Success chance based on skill, songs composed, and luck
        var successChance = 0.3 + (skill / 200) + (songCount * 0.02);
        successChance = Math.min(0.85, successChance);
        var roll = rng.random();
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.grand_concert || 60);
        player.musician.totalPerformances++;
        
        if (roll < successChance * 0.4) {
            // LEGENDARY performance
            var earnings = rng.randInt(500, 1000);
            player.gold += earnings;
            player.stats.totalGoldEarned += earnings;
            // Massive fame boost
            for (var ki2 = 0; ki2 < kingdoms.length; ki2++) {
                player.musician.fame[kingdoms[ki2].id] = Math.min(100, (player.musician.fame[kingdoms[ki2].id] || 0) + 2);
            }
            // Tons of new fans
            var townPeople = Engine.getPeople(townId);
            var newFanCount = Math.min(townPeople.length, rng.randInt(20, 40));
            var potentialFans = townPeople.filter(function(p) { return !player.musician.fans[p.id]; });
            for (var fi = 0; fi < Math.min(newFanCount, potentialFans.length); fi++) {
                player.musician.fans[potentialFans[fi].id] = true;
            }
            if (town.kingdomId) {
                player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 20);
            }
            grantXP(50, 'legendary concert');
            Engine.logEvent('🌟 ' + player.fullName + ' gave a LEGENDARY Grand Concert in ' + town.name + '! The crowd erupted in pure joy!');
            return { success: true, message: '🌟 LEGENDARY! Earned ' + earnings + 'g, +2 fame everywhere, ' + Math.min(newFanCount, potentialFans.length) + ' new fans!' };
        } else if (roll < successChance) {
            // Good performance
            var earnings2 = rng.randInt(200, 500);
            player.gold += earnings2;
            player.stats.totalGoldEarned += earnings2;
            for (var ki3 = 0; ki3 < kingdoms.length; ki3++) {
                player.musician.fame[kingdoms[ki3].id] = Math.min(100, (player.musician.fame[kingdoms[ki3].id] || 0) + 1);
            }
            var townPeople2 = Engine.getPeople(townId);
            var potentialFans2 = townPeople2.filter(function(p) { return !player.musician.fans[p.id]; });
            var fanGain = Math.min(potentialFans2.length, rng.randInt(10, 20));
            for (var fi2 = 0; fi2 < fanGain; fi2++) {
                player.musician.fans[potentialFans2[fi2].id] = true;
            }
            grantXP(25, 'grand concert');
            return { success: true, message: 'Grand Concert was a hit! Earned ' + earnings2 + 'g, +1 fame, ' + fanGain + ' new fans!' };
        } else {
            // FLOP
            var fameLoss = rng.randInt(1, 3);
            if (town.kingdomId) {
                player.musician.fame[town.kingdomId] = Math.max(0, (player.musician.fame[town.kingdomId] || 0) - fameLoss);
                player.reputation[town.kingdomId] = Math.max(0, (player.reputation[town.kingdomId] || 50) - 5);
            }
            Engine.logEvent('😬 ' + player.fullName + '\'s Grand Concert in ' + town.name + ' was a disaster. The crowd booed.');
            grantXP(5, 'flop concert');
            return { success: false, message: 'Concert flopped! Lost ' + fameLoss + ' fame in ' + (town.name || 'this kingdom') + ', -5 rep. 200g wasted.' };
        }
    }

    function musicDuel(rivalIndex) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (!player.musician.rivals || !player.musician.rivals[rivalIndex]) return { success: false, message: 'Rival not found.' };
        var rival = player.musician.rivals[rivalIndex];
        if (rival.defeated) return { success: false, message: rival.name + ' has already been defeated.' };
        if (rival.townId !== player.townId) {
            var rivalTown = Engine.findTown(rival.townId);
            return { success: false, message: rival.name + ' is not in this town.' + (rivalTown ? ' Last seen in ' + rivalTown.name + '.' : '') };
        }
        var day = Engine.getDay();
        if (day - (player.musician.lastDuelDay || 0) < 7) {
            return { success: false, message: 'Must wait 7 days between duels. (' + (7 - (day - player.musician.lastDuelDay)) + ' days left)' };
        }
        
        player.musician.lastDuelDay = day;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.music_duel || 10);
        
        // 3-round duel — each round, pick a different instrument
        var instruments = ['lute', 'flute', 'drum', 'harp', 'fiddle', 'pipes'];
        var rng = Engine.getRng();
        var playerWins = 0;
        var rivalWins = 0;
        var roundLog = [];
        var usedByPlayer = [];
        var usedByRival = [];
        
        for (var round = 0; round < 3; round++) {
            var playerPool = instruments.filter(function(i) { return usedByPlayer.indexOf(i) === -1; });
            var rivalPool = instruments.filter(function(i) { return usedByRival.indexOf(i) === -1; });
            var playerPick = rng.pick(playerPool);
            var rivalPick = rng.pick(rivalPool);
            usedByPlayer.push(playerPick);
            usedByRival.push(rivalPick);
            
            // Score: skill + instrument affinity + crowd taste + randomness
            var playerScore = player.musician.musicSkill + rng.randInt(0, 25);
            var rivalScore = rival.skill + rng.randInt(0, 25);
            
            // Bonus for matching the crowd's taste (random per round)
            var crowdPreference = rng.pick(instruments);
            if (playerPick === crowdPreference) playerScore += 15;
            if (rivalPick === crowdPreference) rivalScore += 15;
            
            // Bonus if player's main instrument matches
            if (playerPick === (player.musician.instrument || 'lute')) playerScore += 10;
            if (rivalPick === rival.instrument) rivalScore += 10;
            
            if (playerScore > rivalScore) {
                playerWins++;
                roundLog.push('Round ' + (round + 1) + ': You (' + playerPick + ') beat ' + rival.name + ' (' + rivalPick + ')!');
            } else {
                rivalWins++;
                roundLog.push('Round ' + (round + 1) + ': ' + rival.name + ' (' + rivalPick + ') won with the crowd!');
            }
        }
        
        var resultMsg = roundLog.join(' ');
        
        if (playerWins > rivalWins) {
            // WIN — steal their fans
            var stolenFans2 = Math.floor(rival.fans * 0.4);
            rival.fans = Math.max(0, rival.fans - stolenFans2);
            rival.skill = Math.max(5, rival.skill - 5);
            
            // Convert stolen fans to actual player fans
            var townPeople3 = Engine.getPeople(player.townId);
            var potFans = townPeople3.filter(function(p) { return !player.musician.fans[p.id]; });
            var actualGained = Math.min(stolenFans2, potFans.length);
            for (var fg = 0; fg < actualGained; fg++) {
                player.musician.fans[potFans[fg].id] = true;
            }
            
            player.musician.duelsWon = (player.musician.duelsWon || 0) + 1;
            player.musician.musicSkill = Math.min(100, player.musician.musicSkill + 3);
            
            // If rival has no fans left, they're defeated
            if (rival.fans <= 0) {
                rival.defeated = true;
                Engine.logEvent('🏆 ' + player.fullName + ' defeated ' + rival.name + ' in a legendary music duel! The rival has retired in shame.');
                grantXP(30, 'defeated rival musician');
                return { success: true, message: '🏆 VICTORY! ' + resultMsg + ' ' + rival.name + ' is defeated and retires! +' + actualGained + ' fans.' };
            }
            
            var town = Engine.findTown(player.townId);
            if (town && town.kingdomId) {
                player.musician.fame[town.kingdomId] = Math.min(100, (player.musician.fame[town.kingdomId] || 0) + 0.5);
            }
            grantXP(15, 'won duel');
            Engine.logEvent('🎵 ' + player.fullName + ' won a music duel against ' + rival.name + '!');
            return { success: true, message: 'You won! ' + resultMsg + ' Gained ' + actualGained + ' fans, +0.5 fame.' };
        } else {
            // LOSE — lose fame in this town's kingdom
            var town2 = Engine.findTown(player.townId);
            var fameLoss2 = rng.randInt(1, 3);
            if (town2 && town2.kingdomId) {
                player.musician.fame[town2.kingdomId] = Math.max(0, (player.musician.fame[town2.kingdomId] || 0) - fameLoss2);
            }
            player.musician.duelsLost = (player.musician.duelsLost || 0) + 1;
            rival.skill = Math.min(95, rival.skill + 3);
            rival.fans += 3;
            grantXP(5, 'lost duel');
            return { success: false, message: 'You lost! ' + resultMsg + ' -' + fameLoss2 + ' fame in ' + (town2 ? town2.name : 'this kingdom') + '.' };
        }
    }

    function chooseMusicianLegacy(choice) {
        _sync();
        if (!player.musician) return { success: false, message: 'Not a musician.' };
        if (!player.musician.legacyOffered) return { success: false, message: 'You haven\'t reached legendary fame yet.' };
        if (player.musician.legacyChoice) return { success: false, message: 'You already chose: ' + player.musician.legacyChoice };
        
        if (choice === 'music_school') {
            player.musician.legacyChoice = 'music_school';
            player.musician.active = false;
            player.musician.musicSchoolTownId = player.townId;
            player.musician.musicSchoolIncome = 0;
            // Grant business skills
            player.skills.bards_immunity = true;
            player.skills.crowd_control = true;
            player.skills.royal_performer = true;
            player.skills.song_of_prosperity = true;
            player.skills.music_school_owner = true;
            // Place unique building
            var town = Engine.findTown(player.townId);
            if (town) {
                town.buildings = town.buildings || [];
                town.buildings.push({
                    type: 'music_school',
                    level: 1,
                    ownerId: 'player',
                    builtDay: Engine.getDay(),
                    // v9p33river294: condition is a state string, not numeric.
                    condition: 'new',
                    lastRepairDay: Engine.getDay()
                });
            }
            Engine.logEvent('🎵 ' + player.fullName + ' founded a legendary Music School in ' + (town ? town.name : 'town') + '! Students flock from across the land.');
            grantXP(100, 'music school');
            return { success: true, message: '🏫 Music School founded in ' + (town ? town.name : 'town') + '! Earns passive income. You can send children here for instrument skills. Merchant career unlocked!' };
        } else if (choice === 'legendary_bard') {
            player.musician.legacyChoice = 'legendary_bard';
            // Stay active but with enhanced abilities
            player.skills.bards_immunity = true;
            player.skills.crowd_control = true;
            player.skills.royal_performer = true;
            player.skills.song_of_prosperity = true;
            player.skills.legendary_bard = true;
            // Legendary bards get: free inn stays, +50% all performance income, can perform at any court regardless of fame
            player.musician.musicSkill = 100;
            Engine.logEvent('🌟 ' + player.fullName + ' chose the life of a Legendary Bard! Their music echoes across all kingdoms.');
            grantXP(100, 'legendary bard');
            return { success: true, message: '🌟 You are now a Legendary Bard! 100 music skill, +50% income, court access everywhere, free inn stays. Continue your endless journey!' };
        }
        return { success: false, message: 'Choose music_school or legendary_bard.' };
    }

    // Military Leader actions
    function trainTroops(townId) {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        var tid = townId || player.townId;
        var town = Engine.findTown(tid);
        if (!town) return { success: false, message: 'Town not found.' };
        var kingdom = Engine.findKingdom(town.kingdomId);
        if (kingdom) {
            kingdom.militaryStrength = (kingdom.militaryStrength || 0) + 5;
        }
        player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 2);
        player.militaryLeader.trainingsDone = (player.militaryLeader.trainingsDone || 0) + 1;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.train_troops || 10);
        grantXP(5, 'train troops');
        // Check for promotion based on training milestones
        checkMilitaryPromotion();
        return { success: true, message: 'Trained troops! +5 kingdom military strength, +2 reputation.' };
    }

    function planBattle() {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.plan_battle || 5);
        grantXP(3, 'plan battle');
        player.militaryLeader.battlePlanReady = true;
        return { success: true, message: 'Battle plan prepared! +20% success on next battle.' };
    }

    function inspireArmy() {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.inspire_army || 3);
        grantXP(2, 'inspire');
        player.militaryLeader.armyInspired = true;
        return { success: true, message: 'Army inspired! Soldiers -5% death chance in next battle.' };
    }

    function fortifyPosition(townId) {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        if (player.gold < 100) return { success: false, message: 'Need 100g for materials.' };
        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        player.gold -= 100;
        player.stats.totalGoldSpent += 100;
        town.garrison = (town.garrison || 0) + 10;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.fortify_position || 15);
        grantXP(5, 'fortify');
        return { success: true, message: 'Position fortified! +10 town defense.' };
    }

    function scoutEnemy() {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scout_enemy || 8);
        grantXP(3, 'scout');
        var rng = Engine.getRng();
        var kingdoms = Engine.getKingdoms();
        var enemyKingdom = null;
        if (player.militaryKingdomId) {
            var playerK = Engine.findKingdom(player.militaryKingdomId);
            if (playerK && playerK.atWar) {
                var atWarArr = Array.isArray(playerK.atWar) ? playerK.atWar : [...playerK.atWar];
                if (atWarArr.length > 0) {
                    var eid = atWarArr[0];
                    enemyKingdom = Engine.findKingdom(eid);
                }
            }
        }
        if (enemyKingdom) {
            return { success: true, message: 'Scouted enemy: ' + enemyKingdom.name + ' has ~' + (enemyKingdom.militaryStrength || 0) + ' military strength.' };
        }
        return { success: true, message: 'No active enemies detected.' };
    }

    function engageBattle(tactic) {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        var validTactics = ['aggressive', 'defensive', 'flanking'];
        if (validTactics.indexOf(tactic) === -1) return { success: false, message: 'Choose a tactic: aggressive, defensive, or flanking.' };
        
        var playerK = null;
        if (player.militaryKingdomId) {
            playerK = Engine.findKingdom(player.militaryKingdomId);
        }
        if (!playerK || !playerK.atWar || (playerK.atWar instanceof Set ? playerK.atWar.size === 0 : (Array.isArray(playerK.atWar) ? playerK.atWar.length === 0 : true))) {
            return { success: false, message: 'Your kingdom is not at war. No battles available.' };
        }
        
        var day = Engine.getDay();
        if (day - (player.militaryLeader.lastBattleDay || 0) < 10) {
            return { success: false, message: 'Troops need rest. Wait ' + (10 - (day - player.militaryLeader.lastBattleDay)) + ' more days.' };
        }
        
        var rng = Engine.getRng();
        var atWarArr = playerK.atWar instanceof Set ? [...playerK.atWar] : (Array.isArray(playerK.atWar) ? playerK.atWar : [playerK.atWar]);
        var enemyId = atWarArr[rng.randInt(0, atWarArr.length - 1)];
        var enemyK = Engine.findKingdom(enemyId);
        if (!enemyK) return { success: false, message: 'Enemy kingdom not found.' };
        
        player.militaryLeader.lastBattleDay = day;
        player.militaryLeader.tacticsUsed = player.militaryLeader.tacticsUsed || {};
        player.militaryLeader.tacticsUsed[tactic] = (player.militaryLeader.tacticsUsed[tactic] || 0) + 1;
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.engage_battle || 30);
        
        // Calculate battle score
        var playerMil = playerK.militaryStrength || 50;
        var enemyMil = enemyK.militaryStrength || 50;
        var trainings = player.militaryLeader.trainingsDone || 0;
        var rankIdx = (CONFIG.MILITARY_LEADER_RANKS || []).findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        
        var playerScore = playerMil + (trainings * 0.5) + (rankIdx * 10) + rng.randInt(0, 30);
        var enemyScore = enemyMil + rng.randInt(0, 30);
        
        // Tactic modifiers
        if (tactic === 'aggressive') {
            playerScore += 20; // Big attack bonus
            // But if enemy is strong, risky
            if (enemyMil > playerMil * 1.5) playerScore -= 15;
        } else if (tactic === 'defensive') {
            playerScore += 10;
            // Reduces enemy score — safe option
            enemyScore -= 10;
        } else if (tactic === 'flanking') {
            // High risk, high reward — requires higher skill
            if (trainings > 20) {
                playerScore += 30;
            } else {
                playerScore -= 10; // Badly executed flank
            }
        }
        
        // Plan battle bonus (if planBattle was recently used)
        if (player.militaryLeader.battlePlanReady) {
            playerScore += 15;
            player.militaryLeader.battlePlanReady = false;
        }
        
        // Inspire bonus
        if (player.militaryLeader.armyInspired) {
            playerScore += 10;
            player.militaryLeader.armyInspired = false;
        }
        
        player.militaryLeader.battlesAsLeader = (player.militaryLeader.battlesAsLeader || 0) + 1;
        
        var isSiege = rng.random() < 0.3; // 30% chance it's a siege
        var isNaval = rng.random() < 0.15; // 15% chance it's naval
        var battleType = isNaval ? 'naval battle' : (isSiege ? 'siege' : 'field battle');
        
        if (playerScore > enemyScore) {
            // VICTORY
            player.militaryLeader.victoriesAsLeader = (player.militaryLeader.victoriesAsLeader || 0) + 1;
            if (isSiege) player.militaryLeader.siegesWon = (player.militaryLeader.siegesWon || 0) + 1;
            if (isNaval) player.militaryLeader.navalBattlesWon = (player.militaryLeader.navalBattlesWon || 0) + 1;
            
            playerK.militaryStrength = (playerK.militaryStrength || 50) + 5;
            enemyK.militaryStrength = Math.max(10, (enemyK.militaryStrength || 50) - 5);
            
            var goldReward = rng.randInt(50, 150) + (rankIdx * 25);
            player.gold += goldReward;
            player.stats.totalGoldEarned += goldReward;
            
            player.reputation[player.militaryKingdomId] = Math.min(100, (player.reputation[player.militaryKingdomId] || 50) + 5);
            
            checkMilitaryPromotion();
            grantXP(20, 'battle victory');
            
            var victoryMsg = '⚔️ VICTORY in ' + battleType + ' against ' + enemyK.name + '! Tactic: ' + tactic + '. Earned ' + goldReward + 'g, +5 kingdom strength.';
            Engine.logEvent(player.fullName + ' won a ' + battleType + ' against ' + enemyK.name + ' using ' + tactic + ' tactics!');
            
            // Check decisive battle eligibility
            if (rankIdx >= 5 && (player.militaryLeader.victoriesAsLeader || 0) >= 10) {
                player.militaryLeader.decisiveBattleAvailable = true;
            }
            
            return { success: true, message: victoryMsg };
        } else {
            // DEFEAT
            playerK.militaryStrength = Math.max(10, (playerK.militaryStrength || 50) - 3);
            
            // Injury risk
            var injuryChance = tactic === 'aggressive' ? 0.3 : (tactic === 'flanking' ? 0.2 : 0.1);
            if (rng.random() < injuryChance && typeof inflictRandomInjury === 'function') {
                inflictRandomInjury('battle');
            }
            
            grantXP(8, 'battle defeat');
            Engine.logEvent(player.fullName + ' lost a ' + battleType + ' against ' + enemyK.name + '.');
            return { success: false, message: '💀 DEFEAT in ' + battleType + ' against ' + enemyK.name + '. Tactic: ' + tactic + '. Kingdom lost 3 military strength.' + (injuryChance > 0.15 ? ' You were injured!' : '') };
        }
    }

    function attendWarCouncil() {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        var ranks = CONFIG.MILITARY_LEADER_RANKS || [];
        var rankIdx = ranks.findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        if (rankIdx < 4) return { success: false, message: 'Must be Captain or higher to attend War Council. Current rank: ' + (ranks[rankIdx] ? ranks[rankIdx].name : player.militaryLeader.rank) };
        
        var playerK = Engine.findKingdom(player.militaryKingdomId);
        if (!playerK || !playerK.atWar || (playerK.atWar instanceof Set ? playerK.atWar.size === 0 : (Array.isArray(playerK.atWar) ? playerK.atWar.length === 0 : true))) {
            return { success: false, message: 'No active wars. War council not in session.' };
        }
        
        var day = Engine.getDay();
        if (player.militaryLeader.lastCouncilDay && day - player.militaryLeader.lastCouncilDay < 30) {
            return { success: false, message: 'War council meets monthly. Next in ' + (30 - (day - player.militaryLeader.lastCouncilDay)) + ' days.' };
        }
        
        player.militaryLeader.lastCouncilDay = day;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.war_council || 15);
        
        var rng = Engine.getRng();
        var atWarArr = playerK.atWar instanceof Set ? [...playerK.atWar] : (Array.isArray(playerK.atWar) ? playerK.atWar : [playerK.atWar]);
        var enemyId = atWarArr[rng.randInt(0, atWarArr.length - 1)];
        var enemyK = Engine.findKingdom(enemyId);
        
        // Present 3 strategic options, each with different outcomes
        var strategies = [
            { name: 'Full Offensive', effect: 'boost_attack', desc: '+15 kingdom military, enemy -10, but costs 200g in war taxes' },
            { name: 'Fortify Borders', effect: 'fortify', desc: '+20 all town garrisons, +5 kingdom military, slower but safe' },
            { name: 'Economic Blockade', effect: 'blockade', desc: 'Enemy loses 10% treasury each month, your traders earn +20% in war zones' }
        ];
        
        var chosen = strategies[rng.randInt(0, strategies.length - 1)];
        
        // Apply the council strategy
        if (chosen.effect === 'boost_attack') {
            playerK.militaryStrength = (playerK.militaryStrength || 50) + 15;
            if (enemyK) enemyK.militaryStrength = Math.max(10, (enemyK.militaryStrength || 50) - 10);
        } else if (chosen.effect === 'fortify') {
            playerK.militaryStrength = (playerK.militaryStrength || 50) + 5;
            var kTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === player.militaryKingdomId; });
            for (var kt = 0; kt < kTowns.length; kt++) {
                kTowns[kt].garrison = (kTowns[kt].garrison || 0) + 20;
            }
        } else if (chosen.effect === 'blockade') {
            if (enemyK) {
                enemyK.gold = Math.floor((enemyK.gold || 0) * 0.9);
            }
        }
        
        player.militaryLeader.warCouncilDecisions = (player.militaryLeader.warCouncilDecisions || 0) + 1;
        player.reputation[player.militaryKingdomId] = Math.min(100, (player.reputation[player.militaryKingdomId] || 50) + 8);
        grantXP(20, 'war council');
        
        Engine.logEvent(player.fullName + ' advised the War Council: ' + chosen.name + ' against ' + (enemyK ? enemyK.name : 'the enemy') + '!');
        return { success: true, message: '📋 War Council: Advised "' + chosen.name + '" — ' + chosen.desc + '. +8 reputation.' };
    }

    function fightDecisiveBattle() {
        _sync();
        if (!player.militaryLeader || !player.militaryLeader.active) return { success: false, message: 'Not a military leader.' };
        if (player.militaryLeader.heroOfAgesEarned) return { success: false, message: 'You have already earned the Hero of the Ages title!' };
        
        var ranks = CONFIG.MILITARY_LEADER_RANKS || [];
        var rankIdx = ranks.findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        if (rankIdx < 5) return { success: false, message: 'Must be General to attempt the decisive battle. Current: ' + (ranks[rankIdx] ? ranks[rankIdx].name : player.militaryLeader.rank) };
        
        if ((player.militaryLeader.victoriesAsLeader || 0) < 10) {
            return { success: false, message: 'Need 10+ victories as leader. Current: ' + (player.militaryLeader.victoriesAsLeader || 0) };
        }
        
        var playerK = Engine.findKingdom(player.militaryKingdomId);
        if (!playerK || !playerK.atWar || (playerK.atWar instanceof Set ? playerK.atWar.size === 0 : (Array.isArray(playerK.atWar) ? playerK.atWar.length === 0 : true))) {
            return { success: false, message: 'Your kingdom must be at war for the decisive battle.' };
        }
        
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.decisive_battle || 60);
        
        var rng = Engine.getRng();
        var atWarArr = playerK.atWar instanceof Set ? [...playerK.atWar] : (Array.isArray(playerK.atWar) ? playerK.atWar : [playerK.atWar]);
        var enemyId = atWarArr[rng.randInt(0, atWarArr.length - 1)];
        var enemyK = Engine.findKingdom(enemyId);
        
        // Epic multi-phase battle
        var playerScore = 0;
        var enemyScore = 0;
        var phases = ['Opening Charge', 'Main Engagement', 'Flanking Maneuver', 'Final Stand'];
        var phaseLog = [];
        
        for (var phase = 0; phase < phases.length; phase++) {
            var pScore = (playerK.militaryStrength || 50) + (player.militaryLeader.trainingsDone || 0) * 0.3 + rng.randInt(0, 40);
            var eScore = (enemyK ? enemyK.militaryStrength || 50 : 50) + rng.randInt(0, 40);
            
            // Council decisions help
            pScore += (player.militaryLeader.warCouncilDecisions || 0) * 2;
            // Tactic versatility bonus
            var tacticsUsed = player.militaryLeader.tacticsUsed || {};
            if (Object.keys(tacticsUsed).length >= 3) pScore += 15;
            
            if (pScore > eScore) {
                playerScore++;
                phaseLog.push(phases[phase] + ': ✓');
            } else {
                enemyScore++;
                phaseLog.push(phases[phase] + ': ✗');
            }
        }
        
        player.militaryLeader.battlesAsLeader = (player.militaryLeader.battlesAsLeader || 0) + 1;
        
        if (playerScore >= 3) {
            // DECISIVE VICTORY — Hero of the Ages!
            player.militaryLeader.victoriesAsLeader = (player.militaryLeader.victoriesAsLeader || 0) + 1;
            player.militaryLeader.heroOfAgesEarned = true;
            player.militaryLeader.heroOfAgesDay = Engine.getDay();
            
            // Massive rewards
            var heroGold = rng.randInt(1000, 2000);
            player.gold += heroGold;
            player.stats.totalGoldEarned += heroGold;
            
            // Max reputation in your kingdom
            player.reputation[player.militaryKingdomId] = 100;
            
            // Social rank boost
            player.socialRank = player.socialRank || {};
            var currentRank = player.socialRank[player.militaryKingdomId] || 0;
            player.socialRank[player.militaryKingdomId] = Math.min(6, currentRank + 2);
            
            // Grant military skills
            player.skills.hero_of_ages = true;
            player.skills.master_tactician = true;
            player.skills.iron_will = true;
            player.skills.legendary_commander = true;
            
            // End the military quest
            player.militaryLeader.active = false;
            
            if (enemyK) {
                enemyK.militaryStrength = Math.max(5, (enemyK.militaryStrength || 50) - 30);
            }
            playerK.militaryStrength = (playerK.militaryStrength || 50) + 30;
            
            grantXP(200, 'Hero of the Ages');
            Engine.logEvent('⚔️👑 ' + player.fullName + ' won a DECISIVE BATTLE against ' + (enemyK ? enemyK.name : 'the enemy') + ' and earned the legendary title: HERO OF THE AGES!');
            
            return { success: true, message: '⚔️👑 HERO OF THE AGES! ' + phaseLog.join(', ') + '. Won ' + playerScore + '-' + enemyScore + '! Earned ' + heroGold + 'g, +2 social rank, 4 legendary skills, max reputation. Your name will echo through history!' };
        } else {
            // Failed — can try again
            grantXP(20, 'decisive battle attempt');
            
            // Injury risk on failure
            if (rng.random() < 0.4 && typeof inflictRandomInjury === 'function') {
                inflictRandomInjury('decisive battle');
            }
            
            Engine.logEvent(player.fullName + ' attempted a decisive battle against ' + (enemyK ? enemyK.name : 'the enemy') + ' but was repelled.');
            return { success: false, message: '💀 Decisive battle FAILED. ' + phaseLog.join(', ') + '. Lost ' + playerScore + '-' + enemyScore + '. Regroup and try again when ready.' };
        }
    }

    function checkMilitaryPromotion() {
        if (!player.militaryLeader || !player.militaryLeader.active) return;
        var ranks = CONFIG.MILITARY_LEADER_RANKS;
        var currentIdx = ranks.findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        if (currentIdx >= ranks.length - 1) return; // already max rank
        var trainings = player.militaryLeader.trainingsDone || 0;
        var battles = player.militaryLeader.battlesAsLeader || 0;
        var victories = player.militaryLeader.victoriesAsLeader || 0;
        // Promotion thresholds per rank (trainings needed + battles/victories)
        var thresholds = [
            { trainings: 5, battles: 0 },   // recruit -> footman
            { trainings: 15, battles: 1 },   // footman -> sergeant
            { trainings: 30, battles: 3 },   // sergeant -> knight
            { trainings: 50, battles: 5 },   // knight -> captain
            { trainings: 80, battles: 10 },  // captain -> commander
            { trainings: 120, battles: 15, victories: 5 }, // commander -> general
        ];
        var req = thresholds[currentIdx] || { trainings: 999 };
        if (trainings >= req.trainings && battles >= (req.battles || 0) && victories >= (req.victories || 0)) {
            promoteMilitaryLeader();
        }
    }

    function promoteMilitaryLeader() {
        if (!player.militaryLeader || !player.militaryLeader.active) return;
        var ranks = CONFIG.MILITARY_LEADER_RANKS;
        var currentIdx = ranks.findIndex(function(r) { return r.id === player.militaryLeader.rank; });
        if (currentIdx < ranks.length - 1) {
            player.militaryLeader.rank = ranks[currentIdx + 1].id;
            if (player.militaryLeader.rank === 'general') {
                player.militaryLeader.generalSinceDay = Engine.getDay();
            }
            Engine.logEvent(player.fullName + ' has been promoted to ' + ranks[currentIdx + 1].name + '!');
        }
    }

    // Scholar actions
    function studyTown(townId) {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        if (player.scholar.townsVisited[townId]) return { success: false, message: 'Already studied this town.' };
        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        var pop = town.population || 50;
        var knowledge = pop >= 200 ? 40 : (pop >= 100 ? 20 : (pop >= 50 ? 10 : 5));
        // Specialization bonus
        if (player.scholar.specialization === 'history') {
            // History scholars gain extra from old/large towns
            var historyBonus = pop >= 200 ? 15 : (pop >= 100 ? 8 : 3);
            knowledge += historyBonus;
            player.scholar.specializationKnowledge += historyBonus;
        }
        player.scholar.townsVisited[townId] = true;
        player.scholar.totalKnowledge += knowledge;
        if (town.kingdomId) {
            player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + 3);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.study_town || 20);
        grantXP(10, 'study town');
        return { success: true, message: 'Studied ' + town.name + '! +' + knowledge + ' knowledge. Total: ' + player.scholar.totalKnowledge };
    }

    function learnFromNPC(npcId) {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Person not found.' };
        if (player.scholar.npcsTaughtBy.indexOf(npcId) !== -1) return { success: false, message: 'Already learned from this person.' };
        var rng = Engine.getRng();
        var intelligence = (person.personality && person.personality.intelligence) || 50;
        var rel = (player.relationships[npcId] && player.relationships[npcId].level) || 0;
        var knowledge = Math.floor(2 + (intelligence + rel) / 30);
        // Specialization bonus
        if (player.scholar.specialization === 'natural_science') {
            var sciBonus = Math.floor(1 + intelligence / 25);
            knowledge += sciBonus;
            player.scholar.specializationKnowledge += sciBonus;
        }
        player.scholar.npcsTaughtBy.push(npcId);
        player.scholar.totalKnowledge += knowledge;
        player.relationships[npcId] = player.relationships[npcId] || { level: 0, type: 'acquaintance' };
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + 3);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.learn_from_npc || 5);
        grantXP(3, 'learn from NPC');
        return { success: true, message: 'Learned from ' + person.firstName + '! +' + knowledge + ' knowledge.' };
    }

    function studyAtLibrary(townId) {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        if (player.townId !== townId) return { success: false, message: 'You must be in this town.' };
        if (player.scholar.knowledgeGathered[townId]) return { success: false, message: 'Already studied the library here.' };
        var rng = Engine.getRng();
        var knowledge = rng.randInt(10, 20);
        // Specialization bonus
        if (player.scholar.specialization === 'economics') {
            var econBonus = rng.randInt(5, 12);
            knowledge += econBonus;
            player.scholar.specializationKnowledge += econBonus;
        }
        player.scholar.knowledgeGathered[townId] = true;
        player.scholar.totalKnowledge += knowledge;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.study_library || 15);
        grantXP(8, 'library study');
        return { success: true, message: 'Studied at the library! +' + knowledge + ' knowledge.' };
    }

    function writeNotes() {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        var townCount = Object.keys(player.scholar.townsVisited).length;
        var prevProgress = player.scholar.bookProgress;
        player.scholar.bookProgress = Math.floor(player.scholar.totalKnowledge / 50);
        player.scholar.lastWriteDay = Engine.getDay();
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.write_notes || 5);
        return { success: true, message: 'Notes compiled. Book progress: ' + player.scholar.bookProgress + '. Knowledge preserved.' };
    }

    function writeGreatBook() {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        var totalTowns = Engine.getTowns().length;
        var visitedCount = Object.keys(player.scholar.townsVisited).length;
        if (visitedCount < totalTowns) return { success: false, message: 'Must visit all towns first. ' + visitedCount + '/' + totalTowns };
        var required = totalTowns * 15;
        if (player.scholar.totalKnowledge < required) return { success: false, message: 'Need ' + required + ' knowledge. Have ' + player.scholar.totalKnowledge };
        if (player.gold < 200) return { success: false, message: 'Need 200g for materials.' };
        player.gold -= 200;
        player.stats.totalGoldSpent += 200;
        player.scholar.greatBookWritten = true;
        player.scholar.active = false;
        player.skills.master_scholar = true;
        player.skills.wisdom_of_ages = true;
        player.skills.polyglot = true;
        player.skills.sage_advisor = true;
        // Specialization-specific bonuses
        if (player.scholar.specialization === 'history') {
            player.skills.historian = true;
            // History book: +25 rep in all kingdoms
            var kingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < kingdoms.length; ki++) {
                player.reputation[kingdoms[ki].id] = Math.min(100, (player.reputation[kingdoms[ki].id] || 50) + 25);
            }
        } else if (player.scholar.specialization === 'economics') {
            player.skills.economic_theorist = true;
            // Economics book: -10% buy prices permanently (applied via skill check elsewhere)
        } else if (player.scholar.specialization === 'natural_science') {
            player.skills.natural_philosopher = true;
            // Science book: +25% disease resistance, +10 max age
            player.maxAgeBonus = (player.maxAgeBonus || 0) + 10;
        }
        player.scholar.royaltiesActive = true;
        player.scholar.royaltiesStartDay = Engine.getDay();
        player.scholar.royaltiesGeneration = player.generation || 1;
        player.scholar.totalRoyaltiesEarned = 0;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.write_great_book || 60);
        Engine.logEvent(player.fullName + ' has written the Great Book! Scholar\'s journey complete.', null, 'my_actions');
        grantXP(200, 'great book');
        return { success: true, message: 'The Great Book is written! Master Scholar abilities unlocked!' };
    }

    function chooseScholarSpecialization(spec) {
        _sync();
        if (!player.scholar || !player.scholar.active) return { success: false, message: 'Not a scholar.' };
        if (player.scholar.specialization) return { success: false, message: 'Already chose specialization: ' + player.scholar.specialization };
        var valid = ['history', 'economics', 'natural_science'];
        if (valid.indexOf(spec) === -1) return { success: false, message: 'Invalid specialization. Choose: history, economics, or natural_science.' };
        player.scholar.specialization = spec;
        var labels = { history: 'History', economics: 'Economics', natural_science: 'Natural Science' };
        Engine.logEvent('📚 ' + player.fullName + ' has chosen to specialize in ' + labels[spec] + '!');
        grantXP(15, 'specialization');
        return { success: true, message: 'You now specialize in ' + labels[spec] + '! Related studies give bonus knowledge.' };
    }

    // ── Family Interaction Actions ──
    function askFamilyForMoney(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        var rel = (player.relationships[npcId] && player.relationships[npcId].level) || 0;
        if (rel < 30) return { success: false, message: member.name + ' refuses. "We\'re not that close..."' };
        var day = Engine.getDay();
        if (person._lastFamilyMoneyDay && day - person._lastFamilyMoneyDay < 60) {
            var daysLeft = 60 - (day - person._lastFamilyMoneyDay);
            return { success: false, message: 'You already asked recently. Wait ' + daysLeft + ' more days.' };
        }
        // RNG: chance of agreeing based on relationship
        var rng = Engine.getRng();
        var agreeChance = Math.min(0.95, rel / 100); // rel 30 = 30%, rel 80 = 80%, rel 95 = 95%
        if (!rng.chance(agreeChance)) {
            // Refused — still costs relationship and sets cooldown
            modifyRelationship(npcId, -5);
            person._lastFamilyMoneyDay = day;
            if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_family_money || 2);
            return { success: false, message: member.name + ' says: "I\'m sorry, I just can\'t right now." (-5 relationship)' };
        }
        var pct = rel >= 75 ? 0.50 : (rel >= 60 ? 0.30 : 0.10);
        var amount = Math.floor((person.gold || 0) * pct);
        if (amount <= 0) return { success: false, message: member.name + ' says: "You know I\'d help you if I could..."' };
        person.gold -= amount;
        player.gold += amount;
        player.stats.totalGoldEarned += amount;
        person._lastFamilyMoneyDay = day;
        // Asking for money strains the relationship
        var relPenalty = amount > 100 ? -10 : (amount > 50 ? -7 : -3);
        modifyRelationship(npcId, relPenalty);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_family_money || 2);
        return { success: true, message: member.name + ' gave you ' + amount + 'g. (' + relPenalty + ' relationship)' };
    }

    function askFamilyToWork(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        if (person.age < 14) return { success: false, message: member.name + ' is too young to work (must be at least 14).' };
        var rel = (player.relationships[npcId] && player.relationships[npcId].level) || 0;
        if (rel < 60) return { success: false, message: 'Relationship must be 60+ to ask for work.' };
        // Check if already your employee
        if (player.employees.includes(npcId)) return { success: false, message: member.name + ' is already working for you.' };
        // Check if any family already working
        var alreadyWorking = player.familyMembers.some(function(m) {
            return player.employees.includes(m.npcId);
        });
        if (alreadyWorking) return { success: false, message: 'A family member is already working for you.' };
        person.employerId = 'player';
        player.employees.push(person.id);
        person._familyWorkStartDay = Engine.getDay();
        person._isFamilyWorker = true;
        var effPct = person.age < 18 ? 30 : 50;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_family_work || 2);
        return { success: true, message: member.name + ' agrees to work for you for 30 days (' + effPct + '% efficiency, free).' };
    }

    function familyDinner() {
        _sync();
        if (!player.houses || player.houses.length === 0) return { success: false, message: 'You need a house to host dinner.' };
        var houseInTown = player.houses.find(function(h) { return h.townId === player.townId && !h.isRental; });
        if (!houseInTown) return { success: false, message: 'No non-rental house in this town.' };
        var familyInTown = player.familyMembers.filter(function(m) {
            var p = Engine.findPerson(m.npcId);
            return p && p.alive && p.townId === player.townId;
        });
        if (familyInTown.length === 0) return { success: false, message: 'No family members in this town.' };
        for (var fi = 0; fi < familyInTown.length; fi++) {
            var fId = familyInTown[fi].npcId;
            player.relationships[fId] = player.relationships[fId] || { level: 0, type: 'family' };
            player.relationships[fId].level = Math.min(100, player.relationships[fId].level + 5);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.family_dinner || 10);
        return { success: true, message: 'Family dinner! +5 relationship with ' + familyInTown.length + ' family members.' };
    }

    function teachFamilyTrade(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        person._familyTrainingSessions = (person._familyTrainingSessions || 0) + 1;
        person.workerSkill = Math.min(100, (person.workerSkill || 0) + 5);
        if (person._familyTrainingSessions >= 10) {
            person._familyTrained = true;
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.teach_family_trade || 5);
        return { success: true, message: 'Teaching session with ' + member.name + '. Skill: ' + person.workerSkill + ' (' + person._familyTrainingSessions + '/10 sessions).' };
    }

    function askFamilyAdvice() {
        _sync();
        if (player.familyMembers.length === 0) return { success: false, message: 'No family.' };
        var tips = [
            'Buy low in farming towns, sell high in cities.',
            'The king values merchants who supply the military.',
            'Building a warehouse early saves money on storage fees.',
            'Reputation opens doors that gold cannot.',
            'Watch the seasonal price changes — winter wheat is expensive!',
            'Making friends with the tavern keeper reveals trade secrets.',
            'Don\'t carry too much gold when traveling through bandit territory.',
            'A good spouse can boost your business significantly.'
        ];
        var rng = Engine.getRng();
        var tip = tips[rng.randInt(0, tips.length - 1)];
        var parent = player.familyMembers.find(function(m) { return m.role === 'father' || m.role === 'mother'; });
        var name = parent ? parent.name : 'Your family';
        if (parent) {
            player.relationships[parent.npcId] = player.relationships[parent.npcId] || { level: 0, type: 'family' };
            player.relationships[parent.npcId].level = Math.min(100, player.relationships[parent.npcId].level + 2);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_family_advice || 2);
        return { success: true, message: name + ' says: "' + tip + '"' };
    }

    function borrowFamilyConnections(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        var day = Engine.getDay();
        if (person._lastConnectionDay && day - person._lastConnectionDay < 60) {
            return { success: false, message: 'Must wait 60 days between connection requests.' };
        }
        // Find an NPC the family member knows well
        var townPeople = Engine.getPeople(person.townId);
        var candidates = townPeople.filter(function(p) {
            return p.id !== npcId && !player.relationships[p.id] && (p.isEliteMerchant || p.occupation === 'merchant');
        });
        if (candidates.length === 0) return { success: false, message: 'No useful connections available.' };
        var rng = Engine.getRng();
        var target = rng.pick(candidates);
        player.relationships[target.id] = { level: 15, type: 'introduction' };
        person._lastConnectionDay = day;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.borrow_family_connections || 3);
        return { success: true, message: member.name + ' introduced you to ' + target.firstName + '! +15 relationship.' };
    }

    function familyCelebration() {
        _sync();
        if (!player.houses || player.houses.length === 0) return { success: false, message: 'Need a house.' };
        var houseInTown = player.houses.find(function(h) { return h.townId === player.townId && !h.isRental; });
        if (!houseInTown) return { success: false, message: 'No non-rental house in this town.' };
        var ht = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === houseInTown.type; });
        var cost = ht ? Math.floor(20 + (ht.comfort || 0)) : 50;
        if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g for celebration.' };
        player.gold -= cost;
        player.stats.totalGoldSpent += cost;
        for (var fi = 0; fi < player.familyMembers.length; fi++) {
            var fId = player.familyMembers[fi].npcId;
            player.relationships[fId] = player.relationships[fId] || { level: 0, type: 'family' };
            player.relationships[fId].level = Math.min(100, player.relationships[fId].level + 10);
        }
        var town = Engine.findTown(player.townId);
        if (town) {
            player.townReputation = player.townReputation || {};
            player.townReputation[player.townId] = Math.min(100, (player.townReputation[player.townId] || 0) + 5);
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.family_celebration || 15);
        return { success: true, message: 'Family celebration! +10 family relationship, +5 town reputation. Cost: ' + cost + 'g.' };
    }

    function giveFamilyGift(npcId, resourceId, qty) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };

        // Limit 1 gift per NPC per day
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (!player._giftCooldowns) player._giftCooldowns = {};
        if (player._giftCooldowns[npcId] === day) {
            return { success: false, message: 'You already gave ' + member.name + ' a gift today. Wait until tomorrow.' };
        }

        if (!player.inventory[resourceId] || player.inventory[resourceId] < qty) return { success: false, message: 'Not enough resources.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };

        player._giftCooldowns[npcId] = day;
        player.inventory[resourceId] -= qty;
        var res = findResource(resourceId);
        var value = res ? res.basePrice * qty : qty;
        var relBoost = Math.min(20, Math.floor(value / 10));
        player.relationships[npcId] = player.relationships[npcId] || { level: 0, type: 'family' };
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + relBoost);

        // Auto-equip weapons/armor given to family members
        var autoEquipMsg = '';
        if (res && res.category === 'military') {
            var _weapDef = null, _armDef = null;
            for (var _wei = 0; _wei < EQUIPMENT_TYPES.weapons.length; _wei++) {
                if (EQUIPMENT_TYPES.weapons[_wei].resource === resourceId) {
                    if (!_weapDef || EQUIPMENT_TYPES.weapons[_wei].combatBonus > _weapDef.combatBonus) _weapDef = EQUIPMENT_TYPES.weapons[_wei];
                }
            }
            for (var _ari = 0; _ari < EQUIPMENT_TYPES.armor.length; _ari++) {
                if (EQUIPMENT_TYPES.armor[_ari].resource === resourceId) {
                    if (!_armDef || EQUIPMENT_TYPES.armor[_ari].combatBonus > _armDef.combatBonus) _armDef = EQUIPMENT_TYPES.armor[_ari];
                }
            }
            if (_weapDef) {
                var oldWeapon = person.weapon;
                person.weapon = { id: _weapDef.id, name: _weapDef.name, quality: _weapDef.quality, combatBonus: _weapDef.combatBonus };
                autoEquipMsg = ' ' + member.name + ' equipped the ' + _weapDef.name + '!';
                if (oldWeapon) autoEquipMsg += ' (replaced ' + oldWeapon.name + ')';
            }
            if (_armDef) {
                var oldArmor = person.armor;
                person.armor = { id: _armDef.id, name: _armDef.name, quality: _armDef.quality, combatBonus: _armDef.combatBonus };
                autoEquipMsg = ' ' + member.name + ' equipped the ' + _armDef.name + '!';
                if (oldArmor) autoEquipMsg += ' (replaced ' + oldArmor.name + ')';
            }
        }

        // Auto-learn instruments given to family members
        var _instIds2 = ['drum', 'flute', 'lute', 'hurdy_gurdy', 'harp'];
        if (_instIds2.indexOf(resourceId) !== -1) {
            if (!person._familyInstruments) person._familyInstruments = {};
            if (!person._familyInstrumentSkill) person._familyInstrumentSkill = {};
            person._familyInstruments[resourceId] = true;
            var _instConf = typeof INSTRUMENTS !== 'undefined' ? INSTRUMENTS[resourceId] : null;
            var _instNm = _instConf ? _instConf.name : resourceId;
            if (!person._familyInstrumentSkill[resourceId]) {
                person._familyInstrumentSkill[resourceId] = 1;
                autoEquipMsg += ' ' + member.name + ' started learning the ' + _instNm + '!';
            } else {
                autoEquipMsg += ' ' + member.name + ' already plays the ' + _instNm + '.';
            }
        }

        // Auto-assign horse if given horses resource
        if (resourceId === 'horses' && !person.horse) {
            person.horse = { name: 'Horse', stamina: 100 };
            autoEquipMsg += ' ' + member.name + ' mounted the horse! 🐴';
        }

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.give_family_gift || 2);
        return { success: true, message: 'Gave ' + qty + 'x ' + (res ? res.name : resourceId) + ' to ' + member.name + '. +' + relBoost + ' relationship.' + autoEquipMsg };
    }

    function giveFamilyGold(npcId, amount) {
        _sync();
        amount = Math.floor(Number(amount));
        if (!amount || !isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid amount.' };
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        if (player.gold < amount) return { success: false, message: 'Not enough gold.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        player.gold -= amount;
        person.gold = (person.gold || 0) + amount;
        player.relationships[npcId] = player.relationships[npcId] || { level: 0, type: 'family' };
        var relBoost = Math.min(15, Math.floor(amount / 20));
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + relBoost);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.give_family_gift || 2);
        return { success: true, message: 'Gave ' + amount + 'g to ' + member.name + '. They now have ' + person.gold + 'g. +' + relBoost + ' relationship.' };
    }

    function inviteFamilyToLive(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        var houseInTown = player.houses.find(function(h) { return h.townId === player.townId && !h.isRental; });
        if (!houseInTown) return { success: false, message: 'No non-rental house in this town.' };
        var ht = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === houseInTown.type; });
        var maxOcc = ht ? ht.maxOccupants : 2;
        if (houseInTown.occupants.length >= maxOcc) return { success: false, message: 'House is full.' };
        person.townId = player.townId;
        houseInTown.occupants.push(npcId);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.invite_family_live || 2);
        return { success: true, message: member.name + ' has moved to your town!' };
    }

    function familyBusiness(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId && (m.role === 'brother' || m.role === 'sister'); });
        if (!member) return { success: false, message: 'Must be a sibling.' };
        var person = Engine.findPerson(npcId);
        if (!person || !person.alive) return { success: false, message: 'Family member not found.' };
        if (person._familyBusinessActive) return { success: false, message: 'Already in a family business partnership.' };
        var sibGold = Math.floor((person.gold || 0) * 0.5);
        person.gold -= sibGold;
        person._familyBusinessActive = true;
        person._familyBusinessInvestment = sibGold;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.family_business || 5);
        return { success: true, message: 'Business partnership with ' + member.name + '! They invested ' + sibGold + 'g. Profits split 60/40.' };
    }

    function confideInFamily(npcId) {
        _sync();
        var member = player.familyMembers.find(function(m) { return m.npcId === npcId; });
        if (!member) return { success: false, message: 'Not a family member.' };
        var rel = (player.relationships[npcId] && player.relationships[npcId].level) || 0;
        if (rel < 70) return { success: false, message: 'Need 70+ relationship to confide.' };
        player.relationships[npcId].level = Math.min(100, player.relationships[npcId].level + 3);
        var rng = Engine.getRng();
        var secrets = [
            'I heard the market for wheat is about to surge.',
            'The king is planning new taxes on luxury goods.',
            'A new trade route may open soon.',
            'Watch out for bandits on the southern road.',
            'The harvest looks poor this season.',
            'A wealthy merchant is looking for business partners.'
        ];
        var secret = secrets[rng.randInt(0, secrets.length - 1)];
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.confide_family || 3);
        return { success: true, message: member.name + ' shares: "' + secret + '" +3 relationship.' };
    }

    function askFamilyToCaretake() {
        _sync();
        if (player.familyMembers.length === 0) return { success: false, message: 'No family.' };
        var available = player.familyMembers.find(function(m) {
            var p = Engine.findPerson(m.npcId);
            return p && p.alive && p.townId === player.townId;
        });
        if (!available) return { success: false, message: 'No family member in town.' };
        var rel = (player.relationships[available.npcId] && player.relationships[available.npcId].level) || 0;
        var cost = rel >= 60 ? 0 : 5;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_family_caretake || 2);
        return { success: true, message: available.name + ' agrees to caretake.' + (cost > 0 ? ' Cost: ' + cost + 'g/day.' : ' Free!') };
    }

    // Shipwrecked price modifier (called from trade functions)
    function getShipwreckedPriceModifier() {
        _sync();
        if (!player.shipwrecked || !player.shipwrecked.active) return 1.0;
        var lang = player.shipwrecked.languageSkill;
        if (lang < 30) return 1.40;
        if (lang < 60) return 1.20;
        if (lang < 90) return 1.10;
        return 1.0;
    }

    // Artifact luck bonus check
    function hasArtifactLuckBonus() {
        _sync();
        return player.shipwrecked && player.shipwrecked.artifactKept && player.inventory.exotic_artifact > 0;
    }

    // ── Export to Player ──
    Player.tickConquestServitude = tickConquestServitude;
    Player.freeFromConquestServitude = freeFromConquestServitude;
    Player.buyFreedom = buyFreedom;
    Player.tickPilgrim = tickPilgrim;
    Player.checkPilgrimGoals = checkPilgrimGoals;
    Player.tickShipwrecked = tickShipwrecked;
    Player.tickMusician = tickMusician;
    Player.tickMilitaryLeader = tickMilitaryLeader;
    Player.tickScholar = tickScholar;
    Player.giveSermon = giveSermon;
    Player.visitHolySite = visitHolySite;
    Player.convertNPC = convertNPC;
    Player.blessNPC = blessNPC;
    Player.buildTemple = buildTemple;
    Player.challengeRivalFaith = challengeRivalFaith;
    Player.tellExoticStory = tellExoticStory;
    Player.teachForeignCraft = teachForeignCraft;
    Player.sellExoticArtifact = sellExoticArtifact;
    Player.visitResonanceSite = visitResonanceSite;
    Player.openArtifact = openArtifact;
    Player.sealArtifact = sealArtifact;
    Player.warpToEmbassy = warpToEmbassy;
    Player.claimFreePotion = claimFreePotion;
    Player.talkToHomelandNPC = talkToHomelandNPC;
    Player.reverseShipwreckedDeath = reverseShipwreckedDeath;
    Player.performAtTavern = performAtTavern;
    Player.streetPerformance = streetPerformance;
    Player.hostConcert = hostConcert;
    Player.composeSong = composeSong;
    Player.performAtCourt = performAtCourt;
    Player.privatePerformance = privatePerformance;
    Player.grandConcert = grandConcert;
    Player.musicDuel = musicDuel;
    Player.chooseMusicianLegacy = chooseMusicianLegacy;
    Player.trainTroops = trainTroops;
    Player.planBattle = planBattle;
    Player.inspireArmy = inspireArmy;
    Player.fortifyPosition = fortifyPosition;
    Player.scoutEnemy = scoutEnemy;
    Player.engageBattle = engageBattle;
    Player.attendWarCouncil = attendWarCouncil;
    Player.fightDecisiveBattle = fightDecisiveBattle;
    Player.checkMilitaryPromotion = checkMilitaryPromotion;
    Player.promoteMilitaryLeader = promoteMilitaryLeader;
    Player.studyTown = studyTown;
    Player.learnFromNPC = learnFromNPC;
    Player.studyAtLibrary = studyAtLibrary;
    Player.writeNotes = writeNotes;
    Player.writeGreatBook = writeGreatBook;
    Player.chooseScholarSpecialization = chooseScholarSpecialization;
    Player.askFamilyForMoney = askFamilyForMoney;
    Player.askFamilyToWork = askFamilyToWork;
    Player.familyDinner = familyDinner;
    Player.teachFamilyTrade = teachFamilyTrade;
    Player.askFamilyAdvice = askFamilyAdvice;
    Player.borrowFamilyConnections = borrowFamilyConnections;
    Player.familyCelebration = familyCelebration;
    Player.giveFamilyGift = giveFamilyGift;
    Player.giveFamilyGold = giveFamilyGold;
    Player.inviteFamilyToLive = inviteFamilyToLive;
    Player.familyBusiness = familyBusiness;
    Player.confideInFamily = confideInFamily;
    Player.askFamilyToCaretake = askFamilyToCaretake;
    Player.getShipwreckedPriceModifier = getShipwreckedPriceModifier;
    Player.hasArtifactLuckBonus = hasArtifactLuckBonus;

})(window.Player);