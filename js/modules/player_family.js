// ============================================================
// Merchant Realms - Player Family/Marriage Module
// Extracted from player.js sections 11.6, 8D, SPOUSE-TALK,
// 11.6B-D (lines ~13474-16742)
// Extends window.Player with family/marriage/spouse functions
// ============================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_family.js");

    // ── Alias Player.state for brevity ──
    // All reads/writes to the internal `player` object go through Player.state
    function ps() { return Player.state; }

    // ── Aliases for internal player.js functions (already exported) ──
    var getPlayerRankIndex   = Player.getPlayerRankIndex;
    var getNPCSocialRank     = Player.getNPCSocialRank;
    var getRelationship      = Player.getRelationship;
    var modifyRelationship   = Player.modifyRelationship;
    var hasSkill             = Player.hasSkill;
    var grantXP              = Player.grantXP;
    var unlockAchievement    = Player.unlockAchievement;
    var showRankCeremony     = Player.showRankCeremony;
    var _offerLordTownChoice = Player._offerLordTownChoice;
    var getMaxGuards         = Player.getMaxGuards;
    var getHospitalCost      = Player.getHospitalCost;
    var getNPCGiftPreferences = Player.getNPCGiftPreferences;

    // ── Aliases for internal functions that need NEW exports from player.js ──
    var autoJournalCapture   = Player.autoJournalCapture;
    var findResource         = Player.findResource;
    var _payHealthcareRevenue = Player._payHealthcareRevenue;
    var checkLevelUp         = Player.checkLevelUp;

    // ========================================================
    // §11.6 PLAYER MARRIAGE SYSTEM
    // ========================================================
    function canMarry() {
        var player = ps();
        return player.alive && !player.spouseId && player.age >= CONFIG.MARRIAGE_MIN_AGE;
    }

    function getMarriageCandidates(townId) {
        var player = ps();
        var tid = townId || player.townId;
        if (!tid) return [];
        var oppositeSex = player.sex === 'M' ? 'F' : 'M';
        var people;
        try { people = Engine.getPeople(tid); } catch (e) { return []; }
        if (!people) return [];

        var _forbiddenFamily = {};
        if (player.spouseId) _forbiddenFamily[player.spouseId] = true;
        if (player.childrenIds) {
            for (var _cfi = 0; _cfi < player.childrenIds.length; _cfi++) _forbiddenFamily[player.childrenIds[_cfi]] = true;
        }
        if (player.familyMembers) {
            for (var _ffi = 0; _ffi < player.familyMembers.length; _ffi++) {
                var _fm = player.familyMembers[_ffi];
                var _fid = (typeof _fm === 'string') ? _fm : (_fm && (_fm.npcId || _fm.id || _fm.personId));
                if (_fid) _forbiddenFamily[_fid] = true;
            }
        }

        return people.filter(function(p) {
            // v9p33river333: exclude close family/legacy family-member shapes from marriage pool.
            if (!p || _forbiddenFamily[p.id]) return false;
            if (p.parentIds && p.parentIds.indexOf('player') >= 0) return false;
            return p.alive &&
                !p.spouseId &&
                p.sex === oppositeSex &&
                p.age >= CONFIG.MARRIAGE_MIN_AGE &&
                p.age <= 45 &&
                !p.employerId &&
                p.occupation !== 'king' && p.occupation !== 'reigning_queen' && p.occupation !== 'queen' && p.occupation !== 'queens_lord';
        }).slice(0, 10);
    }

    function marry(personId) {
        var player = ps();
        // v9p33river332: defensive — legacy/inherited saves may lack
        // relationships. Initialize before for-in on line ~101.
        // (v331 had this BEFORE the `var player = ps()` line, which
        // hoisted as undefined and threw on the assignment.)
        if (!player.relationships) player.relationships = {};
        // Now starts the wedding planning phase instead of instant marriage
        if (!canMarry()) return { success: false, message: 'Cannot marry right now.' };
        if (player.weddingPlan) return { success: false, message: 'You are already planning a wedding!' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };
        if (!person.alive) return { success: false, message: 'Person is not alive.' };
        if (person.age < 18) return { success: false, message: 'Person is too young to marry.' };

        // King marriage is impossible for the player
        var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
        for (var ki = 0; ki < kingdoms.length; ki++) {
            if (kingdoms[ki].king === personId) {
                return { success: false, message: 'The ruler of ' + kingdoms[ki].name + ' is beyond your reach for marriage.' };
            }
        }

        if (person.spouseId) return { success: false, message: 'Person is already married.' };
        if (person.townId !== player.townId) return { success: false, message: 'Person is not in your town.' };

        // King's children marriage restriction
        var _isKingChild = false;
        var _kcKingdomId = null;
        for (var _kci2 = 0; _kci2 < kingdoms.length; _kci2++) {
            var _kcKing = Engine.findPerson ? Engine.findPerson(kingdoms[_kci2].king) : null;
            var _kcIsRoyalChild = false;
            if (_kcKing && _kcKing.childrenIds && _kcKing.childrenIds.indexOf(personId) >= 0) _kcIsRoyalChild = true;
            // v9p33river333: adopted/step royal children may only link back through parentIds.
            if (!_kcIsRoyalChild && _kcKing && person.parentIds && person.parentIds.indexOf(_kcKing.id) >= 0) _kcIsRoyalChild = true;
            if (_kcIsRoyalChild) {
                _isKingChild = true;
                _kcKingdomId = kingdoms[_kci2].id;
                break;
            }
        }
        if (_isKingChild) {
            var _pRankForKC = getPlayerRankIndex();
            if (_pRankForKC >= 4) {
                // Minor noble+ can marry king's children directly
            } else if (_pRankForKC >= 3) {
                var _hasNobleIntro = false;
                for (var _nIntId in player.relationships) {
                    if (player.relationships[_nIntId].level >= 50) {
                        var _nIntPerson = Engine.findPerson ? Engine.findPerson(_nIntId) : null;
                        if (_nIntPerson && getNPCSocialRank(_nIntPerson) >= 4) { _hasNobleIntro = true; break; }
                    }
                }
                if (!_hasNobleIntro) {
                    return { success: false, message: 'As a Guildmaster, you need a noble friend (relationship 50+) to introduce you to the king\'s children.' };
                }
            } else {
                return { success: false, message: 'You must be at least a Guildmaster to court the king\'s children.' };
            }
        }

        // Check courtship requirement
        var rel = getRelationship(personId);
        var minRel = person.occupation === 'noble' ? CONFIG.COURTSHIP_NOBLE_MIN_RELATIONSHIP : CONFIG.COURTSHIP_MIN_RELATIONSHIP;
        if (hasSkill('romantic')) minRel = Math.min(minRel, 50);
        if (rel.level < minRel) {
            return { success: false, message: 'Need relationship ' + minRel + '+ to propose (current: ' + Math.floor(rel.level) + '). Build through gifts and time.' };
        }

        // Housing affects marriage acceptance
        var bestHouse = null;
        var bestComfort = -1;
        for (var hi = 0; hi < (player.houses || []).length; hi++) {
            var ht = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === player.houses[hi].type; });
            if (ht && ht.comfort > bestComfort) { bestComfort = ht.comfort; bestHouse = ht; }
        }
        var housingAcceptMod = 0;
        if (!bestHouse || bestComfort <= 0) housingAcceptMod = -0.30;
        else if (bestComfort <= 15) housingAcceptMod = 0;
        else housingAcceptMod = Math.min(0.30, bestComfort / 100 * 0.30);
        var baseAcceptChance = 0.70 + housingAcceptMod;
        var rngMarriage = Engine.getRng();
        if (rngMarriage && !rngMarriage.chance(Math.min(0.95, Math.max(0.10, baseAcceptChance)))) {
            return { success: false, message: 'Your proposal was rejected.' + (housingAcceptMod < 0 ? ' Having a home might help.' : '') };
        }

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.petition_promotion || 10);

        // Proposal accepted! Start wedding planning phase
        var planDay = Engine.getDay();
        var weddingDay = planDay + (CONFIG.WEDDING_PLANNING_DAYS || 5);
        player.weddingPlan = {
            fianceId: personId,
            fianceName: person.firstName + ' ' + person.lastName,
            venue: null,
            feast: null,
            vows: null,
            planDay: planDay,
            weddingDay: weddingDay,
            guests: [],
        };

        Engine.logEvent(player.fullName + ' proposed to ' + person.firstName + ' ' + person.lastName + '! Wedding in ' + (CONFIG.WEDDING_PLANNING_DAYS || 5) + ' days.');
        return { success: true, message: person.firstName + ' accepted your proposal! 💍 Plan your wedding — it will be held in ' + (CONFIG.WEDDING_PLANNING_DAYS || 5) + ' days.', startPlanning: true };
    }

    function setWeddingChoice(choiceType, choiceId) {
        var player = ps();
        if (!player.weddingPlan) return { success: false, message: 'No wedding being planned.' };
        if (choiceType === 'venue') {
            var venue = (CONFIG.WEDDING_VENUES || []).find(function(v) { return v.id === choiceId; });
            if (!venue) return { success: false, message: 'Unknown venue.' };
            if (venue.minRank && getPlayerRankIndex() < venue.minRank) {
                return { success: false, message: 'You need a higher rank for this venue.' };
            }
            player.weddingPlan.venue = choiceId;
            return { success: true, message: venue.icon + ' Venue set: ' + venue.name };
        }
        if (choiceType === 'feast') {
            var feast = (CONFIG.WEDDING_FEASTS || []).find(function(f) { return f.id === choiceId; });
            if (!feast) return { success: false, message: 'Unknown feast option.' };
            player.weddingPlan.feast = choiceId;
            return { success: true, message: feast.icon + ' Feast set: ' + feast.name };
        }
        if (choiceType === 'vows') {
            var vow = (CONFIG.WEDDING_VOWS || []).find(function(v) { return v.id === choiceId; });
            if (!vow) return { success: false, message: 'Unknown vow style.' };
            player.weddingPlan.vows = choiceId;
            return { success: true, message: vow.icon + ' Vows set: ' + vow.name };
        }
        return { success: false, message: 'Unknown choice type.' };
    }

    function getWeddingPlan() {
        return ps().weddingPlan;
    }

    function finalizeWedding() {
        var player = ps();
        // v9p33river333: legacy saves may lack these rank maps during wedding finalization.
        if (!player.socialRank) player.socialRank = {};
        if (!player.rankSince) player.rankSince = {};
        var plan = player.weddingPlan;
        if (!plan) return { success: false, message: 'No wedding planned.' };
        var person = Engine.findPerson(plan.fianceId);
        if (!person || !person.alive) {
            player.weddingPlan = null;
            return { success: false, message: 'Your fiance is no longer available.' };
        }

        // Set defaults for any unchosen options
        if (!plan.venue) plan.venue = 'town_square';
        if (!plan.feast) plan.feast = 'simple';
        if (!plan.vows) plan.vows = 'practical';

        var _venues = CONFIG.WEDDING_VENUES || [];
        var _feasts = CONFIG.WEDDING_FEASTS || [];
        var _vows = CONFIG.WEDDING_VOWS || [];
        // v9p33river333: tolerate missing/empty wedding option arrays.
        var venue = _venues.find(function(v) { return v.id === plan.venue; }) || _venues[0] || { id: 'town_square', name: 'Town Square', icon: '💍', cost: 0 };
        var feast = _feasts.find(function(f) { return f.id === plan.feast; }) || _feasts[0] || { id: 'simple', name: 'simple feast', icon: '🍞', cost: 0, guests: 5 };
        var vow = _vows.find(function(v) { return v.id === plan.vows; }) || _vows[0] || { id: 'practical', name: 'Practical vows', description: 'We promised to build a steady life together.' };

        // v9p33river317: re-validate venue rank at finalization, not just
        // at selection. Player could pick a high-rank venue while noble
        // and then renounce/lose rank before the wedding fires. Fall
        // back to the default venue if no longer eligible.
        if (venue && venue.minRank && typeof getPlayerRankIndex === 'function' && getPlayerRankIndex() < venue.minRank) {
            var _defaultVenue = _venues.find(function(v) { return v.id === 'town_square'; }) || _venues[0] || venue;
            if (_defaultVenue) {
                Engine.logEvent('💍 Your rank has fallen since planning the wedding; the ' + venue.name + ' is no longer available. Using ' + _defaultVenue.name + ' instead.');
                venue = _defaultVenue;
                plan.venue = _defaultVenue.id;
            }
        }

        // Calculate total cost
        var totalCost = (CONFIG.WEDDING_COST_BASE || 50) + (venue.cost || 0) + (feast.cost || 0);
        if (player.gold < totalCost) {
            player.weddingPlan = null; // v9p33river329: failed finalization must not leave an impossible stuck plan.
            return { success: false, message: 'Cannot afford wedding! Need ' + totalCost + 'g (have ' + Math.floor(player.gold) + 'g). The wedding plan has been cancelled.' };
        }

        player.gold -= totalCost;

        // Finalize the marriage
        player.spouseId = plan.fianceId;
        person.spouseId = 'player';
        person.employerId = 'player';
        // v9p33river302: defensive — legacy/inherited states could lack the
        // employees array and crash on .includes(). Initialize if missing.
        if (!player.employees) player.employees = [];
        if (!player.employees.includes(plan.fianceId)) {
            player.employees.push(plan.fianceId);
        }

        // Spouse takes player's last name (unless keeps_maiden_name quirk)
        var _keepsMaidenName = false;
        if (person.quirks && Array.isArray(person.quirks)) {
            for (var _kmi = 0; _kmi < person.quirks.length; _kmi++) {
                if (person.quirks[_kmi] === 'keeps_maiden_name') { _keepsMaidenName = true; break; }
            }
        }
        // v9p33river312: spouse surname adoption was gated to female
        // spouses only. Comment said the rule is generic — now any
        // spouse without keeps_maiden_name adopts the player's surname.
        if (!_keepsMaidenName && player.lastName && person.lastName !== player.lastName) {
            person._maidenName = person.lastName;
            person.lastName = player.lastName;
            person.fullName = person.firstName + ' ' + player.lastName;
        } else if (_keepsMaidenName) {
            person._maidenName = person.lastName;
            Engine.logEvent('💁 ' + person.firstName + ' has chosen to keep their maiden name.');
        }

        // Relationship bonuses from choices
        var totalRelBonus = 20 + (venue.relBonus || 0) + (feast.relBonus || 0) + (vow.relBonus || 0);
        modifyRelationship(plan.fianceId, totalRelBonus, 'spouse');

        // Reputation bonus from venue
        if (venue.repBonus > 0 && player.citizenshipKingdomId) {
            var kingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < kingdoms.length; ki++) {
                if (kingdoms[ki].id === player.citizenshipKingdomId) {
                    player.reputation = player.reputation || {};
                    player.reputation[kingdoms[ki].id] = (player.reputation[kingdoms[ki].id] || 0) + venue.repBonus;
                    break;
                }
            }
        }

        // Loyalty bonus from feast and vows
        var loyaltyBonus = (feast.loyaltyBonus || 0) + (vow.loyaltyBonus || 0);
        if (person.personality && loyaltyBonus > 0) {
            person.personality.loyalty = Math.min(100, (person.personality.loyalty || 50) + loyaltyBonus);
        }

        // Vow trait affinity bonus
        if (vow.traitBonus && person.personality) {
            person.personality[vow.traitBonus] = Math.min(100, (person.personality[vow.traitBonus] || 50) + 5);
        }

        // Add spouse to familyMembers
        if (!player.familyMembers) player.familyMembers = [];
        var alreadyInFamily = false;
        for (var fi = 0; fi < player.familyMembers.length; fi++) {
            var _famEntry = player.familyMembers[fi];
            var _famId = (typeof _famEntry === 'string') ? _famEntry : (_famEntry && (_famEntry.npcId || _famEntry.id || _famEntry.personId));
            // v9p33river333: legacy familyMembers used multiple shapes; don't duplicate spouse.
            if (_famId === plan.fianceId) { alreadyInFamily = true; break; }
        }
        if (!alreadyInFamily) {
            player.familyMembers.push({ npcId: plan.fianceId, role: 'spouse', name: person.firstName + ' ' + person.lastName });
        }

        // Save wedding memory for spouse conversations
        player.weddingMemory = {
            venue: venue.name,
            venueIcon: venue.icon,
            feast: feast.name,
            vows: vow.name,
            vowText: vow.description,
            day: Engine.getDay(),
            fianceName: person.firstName,
            totalCost: totalCost,
            guests: feast.guests || 5,
        };

        // Generate wedding journal entry prose
        var journalText = 'Today I married ' + person.firstName + ' ' + person.lastName + '. ';
        if (plan.venue === 'church') journalText += 'We exchanged our vows in the church, blessed by the gods. ';
        else if (plan.venue === 'manor_hall') journalText += 'The manor hall was decorated with flowers and banners. A grand affair. ';
        else if (plan.venue === 'countryside') journalText += 'We stood among the wildflowers under an open sky. Just us and nature. ';
        else journalText += 'The town square was lively with well-wishers. A humble but joyous ceremony. ';

        if (plan.feast === 'grand') journalText += 'The feast was magnificent — imported wines, roasted boar, music that went into the night. ';
        else if (plan.feast === 'moderate') journalText += 'We shared roasted meats and good wine with friends. ';
        else journalText += 'We broke bread together — simple but meaningful. ';

        journalText += vow.description + ' A new chapter begins.';

        autoJournalCapture('wedding', journalText, { mood: 'triumphant' });
        Engine.logEvent(player.fullName + ' married ' + person.firstName + ' ' + person.lastName + '! ' + venue.icon + ' ' + feast.icon);
        grantXP(XP_REWARDS.MARRY, 'marry');

        // Clear wedding plan
        player.weddingPlan = null;

        // Check if married a king's child
        var _marriedKingChild = false;
        var _mkKingdomId = null;
        try {
            var _mkKingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            for (var _mki = 0; _mki < _mkKingdoms.length; _mki++) {
                var _mkKing = Engine.findPerson ? Engine.findPerson(_mkKingdoms[_mki].king) : null;
                var _mkIsRoyalChild = false;
                if (_mkKing && _mkKing.childrenIds && _mkKing.childrenIds.indexOf(plan.fianceId) >= 0) _mkIsRoyalChild = true;
                if (!_mkIsRoyalChild && _mkKing && person.parentIds && person.parentIds.indexOf(_mkKing.id) >= 0) _mkIsRoyalChild = true;
                if (_mkIsRoyalChild) {
                    _marriedKingChild = true;
                    _mkKingdomId = _mkKingdoms[_mki].id;
                    break;
                }
            }
        } catch(e) {}
        if (_marriedKingChild && _mkKingdomId) {
            player._marriedToRoyalChild = { kingdomId: _mkKingdomId, personId: plan.fianceId };
            Engine.logEvent('👑 ' + player.fullName + ' has married into the royal family of ' + (Engine.findKingdom(_mkKingdomId) ? Engine.findKingdom(_mkKingdomId).name : 'the kingdom') + '! +25% relationship gains with the king and kingdom.');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('👑 You married into the royal family! +25% king & kingdom relationship gains!', 'success', 'critical');
        }

        // ===== Marriage Rank System =====
        var spouseKingdom = person.kingdomId;
        var spouseRank = getNPCSocialRank(person);
        if (spouseRank === 0 && person.occupation) {
            if (person.wealthClass === 'upper' || person.occupation === 'guild_master') spouseRank = 3;
            else if (person.wealthClass === 'middle' || person.occupation === 'merchant' || person.occupation === 'master_craftsman') spouseRank = 2;
            else if (person.occupation === 'craftsman' || person.occupation === 'shopkeeper' || person.occupation === 'farmer') spouseRank = 1;
        }
        var playerKingdomForMarriage = spouseKingdom || player.citizenshipKingdomId;
        var playerCurrentRank = playerKingdomForMarriage ? (player.socialRank[playerKingdomForMarriage] || 0) : 0;

        if (spouseRank > 0 && playerKingdomForMarriage) {
            var marriageGrantRank = Math.max(0, spouseRank - 1);
            var newRank = playerCurrentRank;
            if (marriageGrantRank > playerCurrentRank) {
                newRank = marriageGrantRank;
            }

            if (newRank > playerCurrentRank) {
                player.socialRank[playerKingdomForMarriage] = newRank;
                player.rankSince[playerKingdomForMarriage] = Engine.getDay();
                var rankName = CONFIG.SOCIAL_RANKS[newRank] ? CONFIG.SOCIAL_RANKS[newRank].name : 'noble';
                Engine.logEvent('🏰 Through marriage, ' + player.fullName + ' has been elevated to ' + rankName + '!');

                // Grant noble benefits if reaching Minor Noble+ (rank 4+)
                if (newRank >= 4 && !player.isNoble) {
                    player.isNoble = true;
                    player.occupation = 'noble';
                    Engine.logEvent('🏰 ' + player.fullName + ' has entered the aristocracy!');
                    player.guards = player.guards || [];
                    var _mrng = Engine.getRng();
                    var _mTownPeople = Engine.getPeople ? Engine.getPeople(player.townId) : [];
                    var _mExisting = {};
                    for (var _mgi = 0; _mgi < player.guards.length; _mgi++) {
                        if (player.guards[_mgi].personId) _mExisting[player.guards[_mgi].personId] = true;
                    }
                    var _mCandidates = [];
                    for (var _mci = 0; _mci < _mTownPeople.length; _mci++) {
                        var _mc = _mTownPeople[_mci];
                        if (!_mc.alive || _mc.age < 18 || _mExisting[_mc.id] || _mc.id === player.spouseId || _mc.isPlayerGuard) continue;
                        _mCandidates.push(_mc);
                    }
                    var _mGuardsToGrant = Math.min(CONFIG.NOBLE_KINGDOM_GUARD_SLOTS || 4, getMaxGuards() - player.guards.length);
                    var _mGranted = 0;
                    for (var _mggi = 0; _mggi < _mGuardsToGrant && _mCandidates.length > 0; _mggi++) {
                        var _mPref = _mCandidates.filter(function(c) { return c.occupation === 'soldier' || c.occupation === 'guard' || c.occupation === 'unemployed' || !c.occupation; });
                        var _mPool = _mPref.length > 0 ? _mPref : _mCandidates;
                        var _mChosen = _mrng && _mrng.pick ? _mrng.pick(_mPool) : _mPool[Math.floor(Math.random() * _mPool.length)];
                        _mChosen.isPlayerGuard = true;
                        _mChosen.previousOccupation = _mChosen.occupation;
                        _mChosen.previousTownId = _mChosen.townId;
                        _mChosen.occupation = 'player_guard';
                        var _mgName = (_mChosen.firstName || '') + (_mChosen.lastName ? ' ' + _mChosen.lastName : '');
                        if (!_mgName.trim()) _mgName = 'Royal Guard ' + (player.guards.length + 1);
                        player.guards.push({
                            id: 'guard_' + Date.now() + '_' + (_mrng ? _mrng.randInt(0, 9999) : Math.floor(Math.random() * 9999)),
                            personId: _mChosen.id,
                            name: _mgName,
                            hiredDay: Engine.getDay(),
                            kingdomPaid: true
                        });
                        _mCandidates = _mCandidates.filter(function(c) { return c.id !== _mChosen.id; });
                        _mGranted++;
                    }
                    player.personalGuards = player.guards.length;
                    if (_mGranted > 0) {
                        var _mK = Engine.findKingdom(playerKingdomForMarriage);
                        if (_mK) _mK.gold = Math.max(0, (_mK.gold || 0) - _mGranted * (CONFIG.PLAYER_GUARD_HIRE_COST || 30));
                        Engine.logEvent('🛡️ As a new noble, ' + player.fullName + ' has been granted ' + _mGranted + ' personal guards by the kingdom!');
                    }
                }

                // Show rank ceremony UI
                grantXP(XP_REWARDS.NEW_RANK || 100, 'rank');
                showRankCeremony(newRank, playerKingdomForMarriage);

                // Lord (rank 5): offer town choice
                if (newRank === 5) {
                    _offerLordTownChoice(playerKingdomForMarriage);
                }

                // Royal Advisor (rank 6): grant RA benefits + enforce foreign rank cap
                if (newRank === 6) {
                    player.royalAdvisorKingdomId = playerKingdomForMarriage;
                    player.isRoyalAdvisorFromKing = true;
                    player.royalAdvisorBenefits = { noTaxes: true, immuneToLaws: true, kingdomNeverSeizes: true, swayOverKing: true };
                    for (var _raFk in player.socialRank) {
                        if (_raFk !== playerKingdomForMarriage && (player.socialRank[_raFk] || 0) > 2) {
                            var _foreignLevel = (player.socialRank[_raFk] >= 5) ? 2 : (player.socialRank[_raFk] >= 4) ? 1 : 0;
                            player.socialRank[_raFk] = _foreignLevel;
                        }
                    }
                }
            }
            player._marriageRankWaiver = player._marriageRankWaiver || {};
            player._marriageRankWaiver[playerKingdomForMarriage] = {
                rank: newRank,
                spouseRank: spouseRank,
                day: Engine.getDay()
            };
        }

        // ===== Reciprocal: Elevate spouse if player is higher rank =====
        if (playerKingdomForMarriage && person) {
            var finalPlayerRank = player.socialRank[playerKingdomForMarriage] || 0;
            var currentSpouseRank = (person.socialRank && person.socialRank[playerKingdomForMarriage]) ? person.socialRank[playerKingdomForMarriage] : 0;
            if (finalPlayerRank > 0 && finalPlayerRank - 1 > currentSpouseRank) {
                var spouseNewRank = finalPlayerRank - 1;
                if (!person.socialRank) person.socialRank = {};
                person.socialRank[playerKingdomForMarriage] = spouseNewRank;
                var spouseRankName = CONFIG.SOCIAL_RANKS[spouseNewRank] ? CONFIG.SOCIAL_RANKS[spouseNewRank].name : 'rank ' + spouseNewRank;
                Engine.logEvent('🏰 Through marriage to ' + player.fullName + ', ' + person.firstName + ' has been elevated to ' + spouseRankName + '!');
                person._marriageRankWaiver = { rank: spouseNewRank, spouseRank: finalPlayerRank, day: Engine.getDay() };
            }
        }
        var msg = '💒 You married ' + person.firstName + ' ' + person.lastName + '! ' + venue.icon + ' at ' + venue.name + ', ' + feast.icon + ' ' + feast.name + ' feast. (Cost: ' + totalCost + 'g)';
        if (spouseKingdom && spouseKingdom !== player.citizenshipKingdomId) {
            msg += ' Your spouse is from another kingdom — you may change citizenship.';
        }
        return { success: true, message: msg, spouseKingdomId: spouseKingdom };
    }

    // Check if wedding day has arrived and auto-prompt
    function tickWeddingPlan() {
        var player = ps();
        if (!player.weddingPlan) return;
        var day = Engine.getDay();
        if (day >= player.weddingPlan.weddingDay) {
            if (!player.weddingPlan.venue || !player.weddingPlan.feast || !player.weddingPlan.vows) {
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('💒 Your wedding day has arrived! Open the wedding planner to finalize.', 'info');
                }
            } else {
                var result = finalizeWedding();
                if (result.success) {
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast(result.message, 'success');
                    }
                }
            }
        }
    }

    // ========================================================
    // §SPOUSE-TALK: Meaningful Spouse Conversations
    // ========================================================

    function talkToSpouse(topic) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You are not married.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not here.' };
        if (spouse.townId !== player.townId) return { success: false, message: 'Your spouse is not in this town.' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(5);
        var rng = Engine.getRng();
        var rel = getRelationship(player.spouseId);
        var spousePersonality = spouse.personality || {};
        var convos = CONFIG.SPOUSE_CONVERSATIONS || {};
        var response = '';
        var relGain = 0;

        if (topic === 'ask_day') {
            var mood = 'neutral';
            var warmth = spousePersonality.warmth || 50;
            if (rel.level > 80 && warmth > 60) mood = 'happy';
            else if (rel.level < 40) mood = 'sad';
            else if (spouse.needs && spouse.needs.safety < 40) mood = 'worried';
            else if (rng && rng.chance(0.4)) mood = 'happy';

            var moodLines = (convos.askDay || []).find(function(m) { return m.mood === mood; });
            if (moodLines && moodLines.lines.length > 0) {
                response = moodLines.lines[rng ? rng.randInt(0, moodLines.lines.length - 1) : 0];
            } else {
                response = 'It was a quiet day.';
            }
            relGain = 2;

            var town = Engine.findTown(player.townId);
            if (town && rng && rng.chance(0.3)) {
                // v9p33river302: defensive — towns without a market (e.g.
                // outposts) lack .market.supply, which crashed the convo.
                var _aTownSupply = (town.market && town.market.supply) || null;
                if (town.happiness < 30) response += ' "The people here seem unhappy lately..."';
                else if (_aTownSupply && (_aTownSupply.bread || 0) < 5) response += ' "Have you noticed the baker has been running low on bread?"';
                else if (town.prosperity > 80) response += ' "The town is thriving! I feel proud to live here."';
            }
        }
        else if (topic === 'discuss_plans') {
            var plans = convos.discussPlans || {};
            var category = 'saving';
            if (player.buildings && player.buildings.length > 2) category = 'building';
            else if (player.traveling) category = 'trading';
            var kingdoms = Engine.getKingdoms();
            var playerK = kingdoms.find(function(k) { return k.id === player.citizenshipKingdomId; });
            // v9p33river295: Engine.getKingdoms() serializes atWar to an
            // array (engine.js:31826 `atWar: [...k.atWar]`), so `.size > 0`
            // was always false and the 'war' dialogue category was
            // unreachable. Check both Array.length and Set.size to be safe.
            var _famAtWar = playerK && playerK.atWar;
            var _famAtWarOn = _famAtWar && (
                (Array.isArray(_famAtWar) && _famAtWar.length > 0) ||
                (typeof _famAtWar.size === 'number' && _famAtWar.size > 0)
            );
            if (_famAtWarOn) category = 'war';
            else if (player.gold > 2000) category = 'building';

            var lines = plans[category] || plans.saving || ['We should plan carefully.'];
            response = lines[rng ? rng.randInt(0, lines.length - 1) : 0];

            if (response.indexOf('{nearbyTown}') >= 0) {
                var towns = Engine.getTowns();
                var nearby = towns.filter(function(t) { return t.id !== player.townId; });
                if (nearby.length > 0) {
                    var pick = nearby[rng ? rng.randInt(0, nearby.length - 1) : 0];
                    response = response.replace('{nearbyTown}', pick.name);
                } else {
                    response = response.replace('{nearbyTown}', 'a nearby town');
                }
            }
            if (response.indexOf('{scarceGood}') >= 0) {
                var scarceGoods = ['bread', 'iron', 'cloth', 'tools', 'wood'];
                response = response.replace('{scarceGood}', scarceGoods[rng ? rng.randInt(0, scarceGoods.length - 1) : 0]);
            }
            relGain = 3;
        }
        else if (topic === 'share_memory') {
            var memories = convos.shareMemory || {};
            var memoryPool = [];

            if (player.weddingMemory) {
                var venueMemory = 'The ' + player.weddingMemory.venue + ' was perfect.';
                memoryPool.push((memories.wedding || 'Our wedding was special.').replace('{venueMemory}', venueMemory));
            }
            if (player.childrenIds && player.childrenIds.length > 0) {
                var child = Engine.findPerson(player.childrenIds[0]);
                if (child) {
                    memoryPool.push((memories.child || 'I think about our children.').replace('{childName}', child.firstName || 'our child'));
                }
            }
            if (player.stats && player.stats.bestSingleTrade > 0) {
                memoryPool.push((memories.trade || 'That big trade was something.').replace('{profit}', Math.floor(player.stats.bestSingleTrade)));
            }
            if (player.stats && player.stats.townsVisited && player.stats.townsVisited.length > 1) {
                var visitedTown = player.stats.townsVisited[rng ? rng.randInt(0, player.stats.townsVisited.length - 1) : 0];
                memoryPool.push((memories.travel || 'Remember our travels.').replace('{townName}', visitedTown));
            }
            memoryPool.push(memories.early || 'Remember when we first met?');
            memoryPool.push(memories.hardship || 'We have been through a lot together.');

            response = memoryPool[rng ? rng.randInt(0, memoryPool.length - 1) : 0];
            relGain = 4;
        }
        else {
            return { success: false, message: 'Unknown conversation topic.' };
        }

        modifyRelationship(player.spouseId, relGain, 'spouse');

        return {
            success: true,
            message: spouse.firstName + ' says: "' + response + '"',
            relGain: relGain,
            topic: topic,
        };
    }

    // ========================================================
    // §8D  DYNASTY MARRIAGES — arrange child marriages
    // ========================================================
    function arrangeChildMarriage(childId, targetId) {
        var player = ps();
        // v9p33river332: defensive — childrenIds may be undefined on
        // legacy/inherited saves; the indexOf call would crash. (v331
        // had this BEFORE the `var player = ps()` line, which hoisted
        // as undefined and threw on the assignment.)
        if (!player.childrenIds) player.childrenIds = [];
        var child = Engine.findPerson(childId);
        var target = Engine.findPerson(targetId);
        if (!child || !child.alive) return { success: false, message: 'Child not found or not alive.' };
        if (!target || !target.alive) return { success: false, message: 'Target not found or not alive.' };
        if (child.age < 16) return { success: false, message: 'Your child must be at least 16.' };
        if (target.age < 16) return { success: false, message: 'Target must be at least 16.' };
        if (child.spouseId) return { success: false, message: 'Your child is already married.' };
        if (target.spouseId) return { success: false, message: 'Target is already married.' };
        if (child.sex === target.sex) return { success: false, message: 'Medieval tradition requires a man and a woman.' };

        if (player.childrenIds.indexOf(childId) < 0) return { success: false, message: 'Not your child.' };

        var eliteParent = null;
        if (target.parentIds) {
            for (var i = 0; i < target.parentIds.length; i++) {
                var par = Engine.findPerson(target.parentIds[i]);
                if (par && par.alive && par.isEliteMerchant) { eliteParent = par; break; }
            }
        }

        if (eliteParent) {
            // v9p33river302: defensive — legacy/inherited states could lack
            // reputation or relationships maps, crashing the marriage flow.
            if (!player.reputation) player.reputation = {};
            if (!player.relationships) player.relationships = {};
            var approvalScore = 0;
            var kId = eliteParent.citizenshipKingdomId || eliteParent.kingdomId;
            approvalScore += ((player.reputation[kId] || 0) - 40) * 0.5;
            approvalScore += (Player.getNetWorth() > (eliteParent.netWorth || 500) ? 15 : -10);
            var playerRank = getPlayerRankIndex();
            var emRank = Engine.getHighestRank(eliteParent.socialRank || {});
            approvalScore += (playerRank >= emRank ? 10 : -5);
            var rel = player.relationships[eliteParent.id];
            approvalScore += (rel ? (rel.level || 0) * 0.2 : 0);
            var social = (eliteParent.personality && eliteParent.personality.social) || 50;
            approvalScore += (social - 50) * 0.2;

            if (approvalScore < 10) {
                return { success: false, message: eliteParent.firstName + ' ' + (eliteParent.lastName || '') + ' rejected the marriage proposal. (Improve your standing, reputation, or relationship.)' };
            }
        }

        var weddingCost = 200;
        if (player.gold < weddingCost) return { success: false, message: 'Need ' + weddingCost + 'g for the wedding.' };
        player.gold -= weddingCost;

        child.spouseId = targetId;
        target.spouseId = childId;

        if (eliteParent) {
            // v9p33river302: same defensive init (above maps may be missing
            // even when the approval branch wasn't entered with an
            // eliteParent — they're referenced below regardless).
            if (!player.relationships) player.relationships = {};
            if (!player.relationships[eliteParent.id]) player.relationships[eliteParent.id] = { level: 0, type: 'acquaintance' };
            player.relationships[eliteParent.id].level = Math.min(100, (player.relationships[eliteParent.id].level || 0) + 15);
            if (player.relationships[eliteParent.id].level >= 60) player.relationships[eliteParent.id].type = 'friend';

            if (!player.familyAlliances) player.familyAlliances = [];
            player.familyAlliances.push({
                familyId: eliteParent.id,
                familyName: eliteParent.familyName || eliteParent.lastName || eliteParent.firstName,
                throughChildId: childId,
                partnerId: targetId,
                startDay: Engine.getDay(),
            });

            if (eliteParent.citizenshipKingdomId || eliteParent.kingdomId) {
                var allianceKId = eliteParent.citizenshipKingdomId || eliteParent.kingdomId;
                player.reputation[allianceKId] = Math.min(100, (player.reputation[allianceKId] || 0) + 2);
            }
        }

        Engine.logEvent(child.firstName + ' ' + (child.lastName || '') + ' married ' + target.firstName + ' ' + (target.lastName || '') + '!');
        return { success: true, message: child.firstName + ' married ' + target.firstName + '! (Cost: ' + weddingCost + 'g)' };
    }

    function getEligibleMarriageCandidates(childId) {
        var child = Engine.findPerson(childId);
        if (!child || !child.alive || child.age < 16 || child.spouseId) return [];
        var world = Engine.getWorld();
        if (!world) return [];
        return world.people.filter(function(c) {
            return c.alive && !c.spouseId && c.sex !== child.sex &&
                c.age >= 16 && c.age <= 50 && c.id !== childId &&
                c.townId === child.townId;
        }).slice(0, 20);
    }

    function respondToMarriageProposal(proposalId, accept) {
        var player = ps();
        if (!player._marriageProposals) return { success: false, message: 'No proposals.' };
        var proposal = player._marriageProposals.find(function(p) { return p.id === proposalId; });
        if (!proposal) return { success: false, message: 'Proposal not found.' };

        player._marriageProposals = player._marriageProposals.filter(function(p) { return p.id !== proposalId; });

        if (!accept) return { success: true, message: 'Proposal rejected.' };

        var child = Engine.findPerson(proposal.playerChildId);
        var target = Engine.findPerson(proposal.eliteChildId);
        if (!child || !child.alive || child.spouseId) return { success: false, message: 'Your child is no longer eligible.' };
        if (!target || !target.alive || target.spouseId) return { success: false, message: 'Their child is no longer eligible.' };

        return arrangeChildMarriage(proposal.playerChildId, proposal.eliteChildId);
    }

    function checkEliteMarriageProposals() {
        var player = ps();
        // v9p33river332: defensive — legacy/inherited saves may lack
        // childrenIds; the .map call would crash. (v331 had this
        // BEFORE the `var player = ps()` line — see marry() comment.)
        if (!player.childrenIds) player.childrenIds = [];
        if (!player.alive || !player.childrenIds || player.childrenIds.length === 0) return;
        if (!player._marriageProposals) player._marriageProposals = [];
        var day = Engine.getDay();
        if (day % 90 !== 0) return;

        var world = Engine.getWorld();
        if (!world) return;
        var rng = Engine.getRng();
        if (!rng) return;

        var eligibleChildren = player.childrenIds.map(function(cid) { return Engine.findPerson(cid); })
            .filter(function(c) { return c && c.alive && !c.spouseId && c.age >= 16; });
        if (eligibleChildren.length === 0) return;

        var elites = world.people.filter(function(p) { return p.alive && p.isEliteMerchant; });
        for (var i = 0; i < elites.length; i++) {
            var em = elites[i];
            if (!em.childrenIds || em.childrenIds.length === 0) continue;
            var emChildren = em.childrenIds.map(function(cid) { return Engine.findPerson(cid); })
                .filter(function(c) { return c && c.alive && !c.spouseId && c.age >= 16; });
            if (emChildren.length === 0) continue;

            var playerRank = getPlayerRankIndex();
            var emRank = Engine.getHighestRank(em.socialRank || {});
            if (Math.abs(playerRank - emRank) > 2) continue;

            var playerWorth = Player.getNetWorth();
            var emWorth = em.netWorth || 0;
            if (playerWorth < emWorth * 0.3 && emWorth > 1000) continue;

            if (!rng.chance(0.15)) continue;

            for (var pi2 = 0; pi2 < eligibleChildren.length; pi2++) {
                var pc = eligibleChildren[pi2];
                for (var ei2 = 0; ei2 < emChildren.length; ei2++) {
                    var ec = emChildren[ei2];
                    if (pc.sex === ec.sex) continue;
                    if (player._marriageProposals.some(function(pr) { return pr.playerChildId === pc.id && pr.eliteChildId === ec.id; })) continue;

                    player._marriageProposals.push({
                        // v9p33river312: include child IDs so multiple
                        // same-day proposals from the same EM (for
                        // different children) don't collide on id.
                        id: 'mp_' + day + '_' + em.id + '_' + pc.id + '_' + ec.id,
                        eliteMerchantId: em.id,
                        eliteMerchantName: em.firstName + ' ' + (em.lastName || ''),
                        familyName: em.familyName || em.lastName,
                        playerChildId: pc.id,
                        playerChildName: pc.firstName + ' ' + (pc.lastName || ''),
                        eliteChildId: ec.id,
                        eliteChildName: ec.firstName + ' ' + (ec.lastName || ''),
                        day: day,
                    });
                    Engine.logEvent(em.firstName + ' ' + (em.lastName || '') + ' proposes a marriage between ' + ec.firstName + ' and your child ' + pc.firstName + '!');
                    return;
                }
            }
        }
    }

    function getMarriageProposals() {
        return ps()._marriageProposals || [];
    }

    function getAllianceBenefits() {
        var player = ps();
        if (!player.familyAlliances || player.familyAlliances.length === 0) return { repBonus: 0, storageDiscount: 0, allianceCount: 0 };
        var repBonus = player.familyAlliances.length * 10;
        var storageDiscount = Math.min(0.3, player.familyAlliances.length * 0.1);
        return { repBonus: repBonus, storageDiscount: storageDiscount, allianceCount: player.familyAlliances.length };
    }

    function tickPlayerChildren() {
        var player = ps();
        // v9p33river332: defensive — childrenIds may be undefined on
        // legacy/inherited saves. tickPlayerChildren runs every tick,
        // so a missing array would crash the entire family system.
        // (v331 had this BEFORE the `var player = ps()` line — see
        // marry() comment.)
        if (!player.childrenIds) player.childrenIds = [];
        if (!player.alive) return;

        var currentDay = Engine.getDay();
        var rng = Engine.getRng();

        var spouse = player.spouseId ? Engine.findPerson(player.spouseId) : null;
        var spouseAlive = spouse && spouse.alive;

        // Age player's children based on birthDay and handle coming-of-age
        var daysPerYear = (CONFIG.DAYS_PER_SEASON || 90) * 4;
        for (var _ci = 0; _ci < player.childrenIds.length; _ci++) {
            var cid = player.childrenIds[_ci];
            var child = Engine.findPerson(cid);
            if (!child || !child.alive) continue;

            if (child.birthDay != null && child.birthDay > 0) {
                var expectedAge = Math.floor((currentDay - child.birthDay) / daysPerYear);
                if (expectedAge > child.age) {
                    var _wasUnder = child.age < (CONFIG.COMING_OF_AGE || 18);
                    child.age = expectedAge;
                    // v9p33river305: was `=== CONFIG.COMING_OF_AGE` — children
                    // who skip from below 18 to above 18 in one tick missed
                    // the event entirely. Fire on the first tick that crosses
                    // the threshold.
                    var _coa = CONFIG.COMING_OF_AGE || 18;
                    if (_wasUnder && child.age >= _coa && !child._cameOfAge) {
                        child._cameOfAge = true;
                        child.occupation = rng.pick(['farmer', 'laborer', 'craftsman', 'miner', 'woodcutter']);
                        child.skills = { farming: 10, mining: 10, crafting: 10, trading: 10, combat: 10 };
                        child.gold = (child.gold || 0) + 20;
                        Engine.logEvent(child.firstName + ' ' + child.lastName + ' has come of age!');
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('\u{1F389} ' + child.firstName + ' has come of age at 18!', 'success');
                        }
                    }
                }
            }
        }

        // Keep minor children at primary home
        if (!player.traveling) {
            var _kidHomeTown = null;
            var _kidHC2 = -1;
            for (var _khi = 0; _khi < (player.houses || []).length; _khi++) {
                var _kh = player.houses[_khi];
                var _kht = CONFIG.HOUSING_TYPES ? CONFIG.HOUSING_TYPES.find(function(t) { return t.id === _kh.type; }) : null;
                if (_kht && _kht.comfort > _kidHC2) { _kidHC2 = _kht.comfort; _kidHomeTown = _kh.townId; }
            }
            var _childTargetTown = _kidHomeTown || player.townId;
            for (var _ci2 = 0; _ci2 < player.childrenIds.length; _ci2++) {
                var child2 = Engine.findPerson(player.childrenIds[_ci2]);
                if (child2 && child2.alive && child2.age < CONFIG.COMING_OF_AGE && child2.townId !== _childTargetTown) {
                    child2.townId = _childTargetTown;
                }
            }
        }

        // Phase 2: Pregnancy in progress — check for birth
        if (player.pregnantDay > 0) {
            var elapsed = currentDay - player.pregnantDay;
            if (elapsed >= (CONFIG.PREGNANCY_DURATION || 270)) {
                var childSex = rng.chance(0.5) ? 'M' : 'F';
                var namePool = childSex === 'M' ? NAMES.male : NAMES.female;
                var existingNames = {};
                for (var _eni = 0; _eni < player.childrenIds.length; _eni++) {
                    var _enc = Engine.findPerson(player.childrenIds[_eni]);
                    if (_enc) existingNames[_enc.firstName] = true;
                }
                var childFirstName = rng.pick(namePool);
                var attempts = 0;
                while (existingNames[childFirstName] && attempts < 20) {
                    childFirstName = rng.pick(namePool);
                    attempts++;
                }
                var newChild = {
                    id: 'p_child_' + Date.now() + '_' + Math.floor(rng.random() * 10000),
                    firstName: childFirstName,
                    lastName: player.lastName,
                    age: 0,
                    birthDay: currentDay,
                    sex: childSex,
                    alive: true,
                    townId: player.townId,
                    kingdomId: (spouse ? spouse.kingdomId : null) || (Engine.findTown(player.townId) || {}).kingdomId,
                    occupation: 'none',
                    employerId: null,
                    needs: { food: 80, shelter: 80, safety: 80, wealth: 50, happiness: 80 },
                    gold: 0,
                    skills: { farming: 0, mining: 0, crafting: 0, trading: 0, combat: 0 },
                    spouseId: null,
                    childrenIds: [],
                    parentIds: ['player', player.spouseId],
                    personality: {
                        loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    },
                    quirks: (function () {
                        if (typeof SPOUSE_QUIRKS !== 'undefined' && SPOUSE_QUIRKS.length > 0) {
                            var n = rng.randInt(1, 2);
                            var s = SPOUSE_QUIRKS.slice();
                            rng.shuffle(s);
                            return s.slice(0, n).map(function(q) { return q.id; });
                        }
                        return [];
                    })(),
                };

                var w = Engine.getWorld();
                if (w && w.people) w.people.push(newChild);
                if (Engine.registerPerson) Engine.registerPerson(newChild);

                var parentMaxRank = 0;
                if (player.socialRank) {
                    for (var _prk in player.socialRank) {
                        if ((player.socialRank[_prk] || 0) > parentMaxRank) parentMaxRank = player.socialRank[_prk];
                    }
                }
                if (spouse && spouse.socialRank) {
                    for (var _srk in spouse.socialRank) {
                        if ((spouse.socialRank[_srk] || 0) > parentMaxRank) parentMaxRank = spouse.socialRank[_srk];
                    }
                }
                if (parentMaxRank >= 3) {
                    var childRank = parentMaxRank - 1;
                    var childKingdomId = newChild.kingdomId || (Engine.findTown(player.townId) || {}).kingdomId;
                    if (childKingdomId) {
                        newChild.socialRank = {};
                        newChild.socialRank[childKingdomId] = childRank;
                    }
                }

                player.childrenIds.push(newChild.id);
                if (spouse && spouse.childrenIds) {
                    spouse.childrenIds.push(newChild.id);
                }
                if (!player.familyMembers) player.familyMembers = [];
                player.familyMembers.push({ npcId: newChild.id, role: newChild.sex === 'M' ? 'son' : 'daughter', name: newChild.firstName + ' ' + newChild.lastName });

                var town = Engine.findTown(player.townId);
                if (town) town.population++;
                player.pregnantDay = 0;

                var _spouseNamesChild = false;
                var _spouseQuirks = spouse ? (spouse.quirks || []) : [];
                for (var _snci = 0; _snci < _spouseQuirks.length; _snci++) {
                    if (_spouseQuirks[_snci] === 'names_children') { _spouseNamesChild = true; break; }
                }

                if (_spouseNamesChild) {
                    Engine.logEvent('A child is born! ' + spouse.firstName + ' has named ' + (childSex === 'M' ? 'him' : 'her') + ' ' + childFirstName + ' ' + player.lastName + '.');
                    autoJournalCapture('child', spouse.firstName + ' insisted on naming our child ' + childFirstName + '. I had no say in the matter.', { mood: 'mixed' });
                    grantXP(XP_REWARDS.CHILD, 'child');
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast('\u{1F37C} ' + spouse.firstName + ' named your child ' + childFirstName + '!', 'info', 'my_actions');
                    }
                } else {
                    var spouseSuggestion = childFirstName;
                    var _sugPool = childSex === 'M' ? NAMES.male : NAMES.female;
                    var _sugAttempts = 0;
                    while (_sugAttempts < 20) {
                        var _sugName = rng.pick(_sugPool);
                        if (_sugName !== childFirstName && !existingNames[_sugName]) {
                            spouseSuggestion = _sugName;
                            break;
                        }
                        _sugAttempts++;
                    }
                    if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);
                    if (typeof UI !== 'undefined' && UI.showChildNamingDialog) {
                        UI.showChildNamingDialog(newChild.id, childSex, spouseSuggestion, spouse ? spouse.firstName : null);
                    } else {
                        Engine.logEvent('A child is born! ' + childFirstName + ' ' + player.lastName + ' joins the family.');
                        autoJournalCapture('child', 'Our child ' + childFirstName + ' has come into this world. I am overwhelmed with joy.', { mood: 'triumphant' });
                        grantXP(XP_REWARDS.CHILD, 'child');
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('\u{1F37C} A child is born! Welcome ' + childFirstName + '!', 'success', 'my_actions');
                        }
                    }
                }
            }
            return;
        }

        if (!spouseAlive) return;
        if (player.age >= 50 || spouse.age >= 45) return;
        if (spouse.townId !== player.townId) return;
        if (player.childrenIds.length >= (CONFIG.MAX_CHILDREN || 8)) return;

        var spouseQuirks = spouse.quirks || [];
        if (spouseQuirks.indexOf('infertile') >= 0) return;

        var fertilityMod = 1.0;
        if (spouseQuirks.indexOf('fertile') >= 0) fertilityMod = 1.5;
        else if (spouseQuirks.indexOf('low_fertility') >= 0) fertilityMod = 0.33;

        var bestHouseComfort = -1;
        for (var hci = 0; hci < (player.houses || []).length; hci++) {
            var htc = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === player.houses[hci].type; });
            if (htc && htc.comfort > bestHouseComfort) bestHouseComfort = htc.comfort;
        }
        if (bestHouseComfort < 0) fertilityMod *= 0.10;

        if (!rng || !rng.chance(CONFIG.CHILD_PROBABILITY * fertilityMod)) return;

        player.pregnantDay = currentDay;
        var dueDay = currentDay + (CONFIG.PREGNANCY_DURATION || 60);
        var dueSeason = CONFIG.SEASONS[Math.floor(dueDay / CONFIG.DAYS_PER_SEASON) % 4];
        var whoIsExpecting = player.sex === 'F' ? 'You are' : 'Your spouse is';
        Engine.logEvent('Wonderful news! ' + whoIsExpecting + ' expecting a child!');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('\u{1F930} ' + (player.sex === 'F' ? 'You are' : spouse.firstName + ' is') + ' expecting! Due in ' + dueSeason + '.', 'success', 'my_actions');
        }
    }


    // ========================================================
    // §11.6B PERSONALITY & DATING SYSTEM
    // ========================================================

    function getPersonalityImpression(person) {
        if (!person || !person.personality) return '';
        var traits = person.personality;
        var sorted = Object.entries(traits).sort(function(a, b) { return b[1] - a[1]; });
        var highest = sorted[0];
        var lowest = sorted[sorted.length - 1];
        var sexPronoun = person.sex === 'F' ? 'She' : 'He';
        var traitAdj = {
            loyalty: ['loyal', 'disloyal'], ambition: ['ambitious', 'unambitious'],
            frugality: ['frugal', 'spendthrift'], intelligence: ['intelligent', 'simple'],
            warmth: ['warm-hearted', 'cold'], honesty: ['honest', 'dishonest'],
        };
        var highAdj = traitAdj[highest[0]] ? traitAdj[highest[0]][0] : highest[0];
        var lowAdj = traitAdj[lowest[0]] ? traitAdj[lowest[0]][1] : 'lacking ' + lowest[0];
        if (highest[1] - lowest[1] < 15) {
            return sexPronoun + ' seems fairly well-balanced in temperament.';
        }
        return sexPronoun + ' seems ' + highAdj + ' but somewhat ' + lowAdj + '.';
    }

    function getRevealedInfo(personId) {
        return ps().revealedTraits[personId] || { traits: {}, quirks: [] };
    }

    function revealTrait(personId, level) {
        var player = ps();
        var person = Engine.findPerson(personId);
        if (!person || !person.personality) return null;
        if (!player.revealedTraits[personId]) {
            player.revealedTraits[personId] = { traits: {}, quirks: [] };
        }
        var revealed = player.revealedTraits[personId];
        var rng = Engine.getRng();

        if (level === 'none') return null;

        var allTraitNames = Object.keys(person.personality);
        var unrevealedTraits = allTraitNames.filter(function(t) { return !(t in revealed.traits); });
        var personQuirks = person.quirks || [];
        var unrevealedQuirks = personQuirks.filter(function(q) { return revealed.quirks.indexOf(q) < 0; });
        var canRevealTrait = unrevealedTraits.length > 0;
        var canRevealQuirk = unrevealedQuirks.length > 0;

        if (!canRevealTrait && !canRevealQuirk) return { type: 'nothing', message: 'You already know everything about this person.' };

        // Story mode: track trait discovery
        if (player.storyMode) {
            player.storyMode._discoveredTrait = true;
            if (typeof StoryMode !== 'undefined' && StoryMode.tick) StoryMode.tick(player);
        }

        var revealQuirk = canRevealQuirk && (!canRevealTrait || (level !== 'vague' && rng && rng.chance(0.5)));

        if (revealQuirk) {
            var quirkId = rng ? rng.pick(unrevealedQuirks) : unrevealedQuirks[0];
            revealed.quirks.push(quirkId);
            var quirkDef = (typeof SPOUSE_QUIRKS !== 'undefined') ? SPOUSE_QUIRKS.find(function(q) { return q.id === quirkId; }) : null;
            if (level === 'exact' && quirkDef) {
                return { type: 'quirk_exact', quirkId: quirkId, message: 'Discovered quirk: ' + quirkDef.icon + ' ' + quirkDef.name + ' \u2014 ' + quirkDef.effect };
            }
            return { type: 'quirk', quirkId: quirkId, message: quirkDef ? 'Discovered quirk: ' + quirkDef.icon + ' ' + quirkDef.name : 'Discovered a quirk.' };
        }

        var traitName = rng ? rng.pick(unrevealedTraits) : unrevealedTraits[0];
        var traitValue = person.personality[traitName];

        if (level === 'vague') {
            var vagueLevel = traitValue >= 65 ? 'high' : (traitValue <= 35 ? 'low' : 'moderate');
            revealed.traits[traitName] = vagueLevel;
            var adjMap = { loyalty: 'loyal', ambition: 'ambitious', frugality: 'frugal', intelligence: 'intelligent', warmth: 'warm', honesty: 'honest' };
            var adj = adjMap[traitName] || traitName;
            if (vagueLevel === 'high') return { type: 'trait_vague', traitName: traitName, message: 'They seem quite ' + adj + '.' };
            if (vagueLevel === 'low') return { type: 'trait_vague', traitName: traitName, message: 'They don\'t seem very ' + adj + '.' };
            return { type: 'trait_vague', traitName: traitName, message: 'They seem moderately ' + adj + '.' };
        }
        if (level === 'specific') {
            var cat = traitValue >= 65 ? 'High' : (traitValue <= 35 ? 'Low' : 'Medium');
            revealed.traits[traitName] = cat;
            return { type: 'trait_specific', traitName: traitName, message: traitName.charAt(0).toUpperCase() + traitName.slice(1) + ': ' + cat };
        }
        // exact
        revealed.traits[traitName] = traitValue;
        return { type: 'trait_exact', traitName: traitName, value: traitValue, message: traitName.charAt(0).toUpperCase() + traitName.slice(1) + ': ' + traitValue + '/100' };
    }

    function goOnDate(personId, activityId) {
        var player = ps();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };
        if (person.townId !== player.townId) return { success: false, message: 'Not in same town.' };

        if ((player.investigatorCaught[personId] || 0) >= 2) {
            return { success: false, message: 'This person will never speak to you again.' };
        }

        var today = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        if (!player._dateActionsToday) player._dateActionsToday = {};
        var key = personId + '_' + today;
        var count = player._dateActionsToday[key] || 0;
        if (count >= 2) {
            return { success: false, message: 'You can only court someone twice per day. Try again tomorrow.' };
        }

        var activity = (typeof DATING_ACTIVITIES !== 'undefined') ? DATING_ACTIVITIES.find(function(a) { return a.id === activityId; }) : null;
        if (!activity) return { success: false, message: 'Unknown activity.' };

        var rel = getRelationship(personId);
        if (activity.minRelationship && rel.level < activity.minRelationship) {
            return { success: false, message: 'Need relationship ' + activity.minRelationship + '+ (current: ' + Math.floor(rel.level) + ').' };
        }

        if (player.gold < activity.cost) {
            return { success: false, message: 'Need ' + activity.cost + 'g (have ' + player.gold + 'g).' };
        }

        player._dateActionsToday[key] = count + 1;
        for (var dk in player._dateActionsToday) {
            if (!dk.endsWith('_' + today)) delete player._dateActionsToday[dk];
        }

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.go_on_date || 15);

        if (activity.cost > 0) {
            player.gold -= activity.cost;
            player.stats.totalGoldSpent += activity.cost;
        }

        var relGain = activity.relationshipGain;
        if (person.quirks && person.quirks.indexOf('stubborn') >= 0) {
            relGain = Math.floor(relGain * 0.75);
        }
        modifyRelationship(personId, relGain, rel.type === 'spouse' ? 'spouse' : undefined);

        if (!player.dateProgress[personId]) {
            player.dateProgress[personId] = { traitProgress: 0, quirkProgress: 0 };
        }
        var dp = player.dateProgress[personId];
        var progress = activity.dateProgress || 0;

        if (person.quirks && person.quirks.indexOf('secretive') >= 0) {
            progress = Math.floor(progress / 2);
        }

        var revealed = player.revealedTraits[personId] || { traits: {}, quirks: [] };
        var allTraitNames = person.personality ? Object.keys(person.personality) : [];
        var unrevealedTraits = allTraitNames.filter(function(t) { return !(t in revealed.traits); });
        var personQuirks = person.quirks || [];
        var unrevealedQuirks = personQuirks.filter(function(q) { return revealed.quirks.indexOf(q) < 0; });
        var canRevealTrait = unrevealedTraits.length > 0;
        var canRevealQuirk = unrevealedQuirks.length > 0;

        var reveal = null;
        if (progress > 0 && (canRevealTrait || canRevealQuirk)) {
            var progressQuirk = canRevealQuirk && (!canRevealTrait || dp.quirkProgress >= 0 && dp.traitProgress > dp.quirkProgress);
            if (progressQuirk) {
                dp.quirkProgress += progress;
            } else if (canRevealTrait) {
                dp.traitProgress += progress;
            }

            if (dp.traitProgress >= 100 && canRevealTrait) {
                dp.traitProgress -= 100;
                reveal = revealTrait(personId, activity.revealsTraitLevel);
            } else if (dp.quirkProgress >= 100 && canRevealQuirk) {
                dp.quirkProgress -= 100;
                reveal = revealTrait(personId, activity.revealsTraitLevel);
            }
        }

        var hoursUsed = activity.timeHours || 0;
        var hungerCost = Math.floor(hoursUsed * (HUNGER_CONFIG.DECAY_PER_DAY / 24));
        player.hunger = Math.max(0, player.hunger - hungerCost);

        var totalProgress = dp.traitProgress + dp.quirkProgress;
        var msg = activity.name + ': Relationship +' + relGain + '.';
        if (activity.cost > 0) msg += ' Cost: ' + activity.cost + 'g.';
        if (reveal && reveal.message) {
            msg += ' ' + reveal.message;
        } else if (progress > 0 && (canRevealTrait || canRevealQuirk)) {
            msg += ' Getting to know them better... (progress: ' + Math.min(99, Math.max(dp.traitProgress, dp.quirkProgress)) + '%)';
        }
        grantXP(2, 'date');
        return { success: true, message: msg, reveal: reveal };
    }

    function spendTimeWithSpouse(activityId) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You are not married.' };
        // v9p33river311: goOnDate() (called below) already advances
        // CONFIG.ACTION_TICK_COSTS.go_on_date. The extra advanceTicks
        // here doubled the time cost. Now defer to goOnDate's own tick.
        return goOnDate(player.spouseId, activityId);
    }

    // ========================================================
    // §11.6B2 HIRE INVESTIGATOR
    // ========================================================

    function hireInvestigator(personId) {
        var player = ps();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };

        var rankIndex = 0;
        if (person.townId) {
            var town = Engine.findTown(person.townId);
            if (town && town.kingdomId) {
                var kingdom = Engine.findKingdom(town.kingdomId);
                if (kingdom) rankIndex = Math.min(6, Math.floor((person.age || 18) / 10));
            }
        }
        var cost = 200 * Math.pow(2, Math.min(rankIndex, 3));

        if (player.gold < cost) return { success: false, message: 'Cannot afford investigator (' + cost + 'g needed, have ' + player.gold + 'g).' };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.hire_investigator || 2);
        player.gold -= cost;
        player.stats.totalGoldSpent += cost;

        if (!player.investigatorCaught) player.investigatorCaught = {};
        var caught = player.investigatorCaught[personId] || 0;

        if (caught >= 2) return { success: false, message: 'She will never trust you again. Investigation impossible.' };

        if (Math.random() < 0.5) {
            player.investigatorCaught[personId] = caught + 1;
            modifyRelationship(personId, -20);
            if (caught + 1 >= 2) {
                return { success: false, message: 'Caught AGAIN! She discovered your investigator. She will NEVER marry you.', caught: true, permanent: true };
            }
            return { success: false, message: 'She discovered your investigator! Relationship -20. One more strike and she will never marry you.', caught: true, permanent: false };
        }

        var revealedInfo = revealTrait(personId, 'exact');
        var msg = revealedInfo && revealedInfo.message ? 'Investigator returned with information: ' + revealedInfo.message : 'Investigator found nothing new.';
        return { success: true, message: msg, reveal: revealedInfo };
    }

    // ========================================================
    // §11.6B3 DISCOVERY METHODS (Tavern, Observe, Ask Friend)
    // ========================================================

    function askTavernAbout(personId) {
        var player = ps();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        if (player.gold < 5) return { success: false, message: 'Need 5g for tavern gossip.' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_tavern || 3);

        player.gold -= 5;
        player.stats.totalGoldSpent += 5;

        if (!player.dateProgress[personId]) {
            player.dateProgress[personId] = { traitProgress: 0, quirkProgress: 0 };
        }
        player.dateProgress[personId].traitProgress += 10;

        var reveal = player.dateProgress[personId].traitProgress >= 100 ? revealTrait(personId, 'vague') : null;
        if (reveal) player.dateProgress[personId].traitProgress -= 100;

        var msg = 'The tavern patrons share what they know...';
        if (reveal && reveal.message) {
            msg += ' ' + reveal.message;
        } else {
            var impression = getPersonalityImpression(person);
            if (impression) msg += ' "' + impression + '"';
        }
        return { success: true, message: msg, reveal: reveal };
    }

    function observePerson(personId) {
        var player = ps();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        var person = Engine.findPerson(personId);
        if (!person) return { success: false, message: 'Person not found.' };
        if (person.townId !== player.townId) return { success: false, message: 'Not in same town.' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.observe_person || 30);

        var hungerCost = Math.floor(8 * (HUNGER_CONFIG.DECAY_PER_DAY / 24));
        player.hunger = Math.max(0, player.hunger - hungerCost);

        var rng = Engine.getRng();
        var personQuirks = person.quirks || [];
        if (!player.revealedTraits[personId]) {
            player.revealedTraits[personId] = { traits: {}, quirks: [] };
        }
        var unrevealedQuirks = personQuirks.filter(function(q) { return player.revealedTraits[personId].quirks.indexOf(q) < 0; });

        if (unrevealedQuirks.length > 0 && rng && rng.chance(0.3)) {
            var quirkId = rng.pick(unrevealedQuirks);
            player.revealedTraits[personId].quirks.push(quirkId);
            var qDef = (typeof SPOUSE_QUIRKS !== 'undefined') ? SPOUSE_QUIRKS.find(function(q) { return q.id === quirkId; }) : null;
            var msg = qDef ? 'You noticed something: ' + qDef.icon + ' ' + qDef.name : 'You noticed a peculiar behavior.';
            return { success: true, message: msg, noticed: true };
        }

        if (!player.dateProgress[personId]) {
            player.dateProgress[personId] = { traitProgress: 0, quirkProgress: 0 };
        }
        player.dateProgress[personId].quirkProgress += 8;

        // Small chance to discover gift preference during observation
        var _obsRng = Engine.getRng ? Engine.getRng() : null;
        if (_obsRng && _obsRng.chance(0.15)) {
            var _obsPrefs = getNPCGiftPreferences(personId);
            if (!player.discoveredGiftPrefs) player.discoveredGiftPrefs = {};
            if (!player.discoveredGiftPrefs[personId]) player.discoveredGiftPrefs[personId] = {};
            var _obsDisc = player.discoveredGiftPrefs[personId];
            var _obsDay = 0;
            try { _obsDay = Engine.getDay(); } catch(e) {}
            if (!_obsDisc.favorite && _obsRng.chance(0.5)) {
                _obsDisc.favorite = _obsPrefs.favoriteGift;
                _obsDisc.favoriteDay = _obsDay;
                var _ofRes = findResource(_obsPrefs.favoriteGift);
                return { success: true, message: '\u{1F4A1} While watching, you noticed ' + person.firstName + ' admiring some ' + (_ofRes ? _ofRes.name : _obsPrefs.favoriteGift) + '. They seem to love it!', noticed: true };
            } else if (!_obsDisc.hated) {
                _obsDisc.hated = _obsPrefs.hatedGift;
                _obsDisc.hatedDay = _obsDay;
                var _ohRes = findResource(_obsPrefs.hatedGift);
                return { success: true, message: '\u{1F4A1} While watching, you noticed ' + person.firstName + ' turning away from some ' + (_ohRes ? _ohRes.name : _obsPrefs.hatedGift) + '. They seem to hate it.', noticed: true };
            }
        }

        return { success: true, message: 'You spent the day watching from afar. Nothing obvious today.', noticed: false };
    }

    function askFriendAbout(personId, friendId) {
        var player = ps();
        if (!player.alive) return { success: false, message: 'You are not alive.' };
        var person = Engine.findPerson(personId);
        var friend = Engine.findPerson(friendId);
        if (!person || !friend) return { success: false, message: 'Person not found.' };

        var friendRel = getRelationship(friendId);
        if (friendRel.level < 40) return { success: false, message: 'Need 40+ relationship with ' + friend.firstName + ' (current: ' + Math.floor(friendRel.level) + ').' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.ask_friend || 3);

        modifyRelationship(friendId, -5);

        var reveal = revealTrait(personId, 'specific');
        var msg = friend.firstName + ' shares what they know about ' + person.firstName + '...';
        if (reveal && reveal.message) msg += ' ' + reveal.message;
        else msg += ' but has nothing new to share.';
        return { success: true, message: msg, reveal: reveal };
    }


    // ========================================================
    // §11.6B4 ONGOING SPOUSE EFFECTS
    // ========================================================

    function tickSpouseEffects() {
        var player = ps();
        // Reset modifiers each day
        player.spouseProdMod = 1.0;
        player.spouseCostMod = 1.0;
        player.spouseRepMod = 1.0;
        player.spouseHungerMod = 1.0;
        player.spouseLuckMod = 1.0;
        player.spouseProtectMod = 1.0;
        player.spouseFertilityMod = 1.0;

        if (!player.spouseId) return;
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return;
        var pers = spouse.personality || {};
        var quirks = spouse.quirks || [];

        if (pers.intelligence >= 70) player.spouseProdMod = 1.05;
        else if (pers.intelligence < 30) player.spouseProdMod = 0.95;

        if (pers.frugality >= 70) player.spouseCostMod = 0.90;
        else if (pers.frugality < 30) player.spouseCostMod = 1.10;

        if (pers.warmth >= 70) player.spouseRepMod = 1.10;
        else if (pers.warmth < 30) player.spouseRepMod = 0.90;

        if (pers.honesty < 30 && Math.random() < 0.02) {
            var skimmed = Math.floor(5 + Math.random() * 20);
            player.gold = Math.max(0, player.gold - skimmed);
            if (player.revealedTraits[player.spouseId] && player.revealedTraits[player.spouseId].traits && player.revealedTraits[player.spouseId].traits.honesty) {
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('You notice some gold missing... your spouse may be skimming.', 'warning', 'my_actions');
                }
            }
        }

        for (var _qi = 0; _qi < quirks.length; _qi++) {
            var q = quirks[_qi];
            switch(q) {
                case 'secret_gambler':
                    if (Math.random() < 0.025) {
                        var loss = 10 + Math.floor(Math.random() * 90);
                        player.gold = Math.max(0, player.gold - loss);
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('Your spouse lost ' + loss + 'g gambling...', 'warning', 'my_actions');
                        }
                    }
                    break;
                case 'spendthrift':
                    if (Math.random() < 0.033) {
                        var waste = Math.floor(player.gold * 0.01);
                        player.gold = Math.max(0, player.gold - waste);
                    }
                    break;
                case 'kleptomaniac':
                    if (Math.random() < 0.033) {
                        var stolen = 5 + Math.floor(Math.random() * 15);
                        player.gold = Math.max(0, player.gold - stolen);
                    }
                    break;
                case 'gossip':
                    if (player.notoriety > 20 && Math.random() < 0.01) {
                        player.notoriety = Math.min(100, player.notoriety + 3);
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('Your spouse has been gossiping about your activities...', 'warning', 'my_actions');
                        }
                    }
                    break;
                case 'vengeful':
                    if (getRelationship(player.spouseId).level < 30 && Math.random() < 0.02) {
                        var sabLoss = 20 + Math.floor(Math.random() * 80);
                        player.gold = Math.max(0, player.gold - sabLoss);
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('Your vengeful spouse damaged your business! Lost ' + sabLoss + 'g', 'danger', 'my_actions');
                        }
                    }
                    break;
                case 'drunkard':
                    if (Math.random() < 0.025) {
                        var drinkCost = 20 + Math.floor(Math.random() * 30);
                        player.gold = Math.max(0, player.gold - drinkCost);
                    }
                    break;
                case 'manipulative':
                    if (player.childrenIds) {
                        for (var _mci = 0; _mci < player.childrenIds.length; _mci++) {
                            if (Math.random() < 0.005) {
                                modifyRelationship(player.childrenIds[_mci], -2);
                            }
                        }
                    }
                    break;
                case 'night_terrors':
                    if (Math.random() < 0.01 && player.citizenshipKingdomId) {
                        player.reputation[player.citizenshipKingdomId] = Math.max(0,
                            (player.reputation[player.citizenshipKingdomId] || 50) - 0.15);
                    }
                    break;
                case 'clumsy':
                    if (Math.random() < 0.001) {
                        var invKeys = Object.keys(player.inventory).filter(function(k) { return player.inventory[k] > 0; });
                        if (invKeys.length > 0) {
                            var ik = invKeys[Math.floor(Math.random() * invKeys.length)];
                            var dmg = Math.min(player.inventory[ik], 1 + Math.floor(Math.random() * 3));
                            player.inventory[ik] -= dmg;
                            if (typeof UI !== 'undefined' && UI.toast) {
                                UI.toast('Your clumsy spouse damaged ' + dmg + ' ' + ik + '!', 'warning', 'my_actions');
                            }
                        }
                    }
                    break;
                case 'clingy':
                    break;
                case 'good_cook':
                    player.spouseHungerMod = 0.85;
                    break;
                case 'diplomatic':
                    player.spouseRepMod *= 1.10;
                    break;
                case 'lucky':
                    player.spouseLuckMod = 0.95;
                    break;
                case 'protective':
                    player.spouseProtectMod = 0.75;
                    break;
                case 'natural_leader':
                    player.spouseProdMod *= 1.10;
                    break;
                case 'thrifty':
                    player.spouseCostMod *= 0.90;
                    break;
                case 'generous_spirit':
                    player.spouseRepMod *= 1.05;
                    break;
                case 'fertile':
                    player.spouseFertilityMod = 1.5;
                    break;
                case 'low_fertility':
                    player.spouseFertilityMod = 0.25;
                    break;
                case 'infertile':
                    player.spouseFertilityMod = 0;
                    break;
            }
        }
    }

    // ========================================================
    // §11.6C SPOUSE RELATIONSHIP MAINTENANCE
    // ========================================================

    function tickSpouseRelationship() {
        var player = ps();
        if (!player.spouseId || !player.alive) return;
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return;

        // Spouse stays at primary home
        var _bestHomeTownForSpouse = null;
        var _bestHC = -1;
        for (var _shi = 0; _shi < (player.houses || []).length; _shi++) {
            var _sh = player.houses[_shi];
            var _sht = CONFIG.HOUSING_TYPES ? CONFIG.HOUSING_TYPES.find(function(t) { return t.id === _sh.type; }) : null;
            if (_sht && _sht.comfort > _bestHC) { _bestHC = _sht.comfort; _bestHomeTownForSpouse = _sh.townId; }
        }
        if (_bestHomeTownForSpouse) {
            if (spouse.townId !== _bestHomeTownForSpouse && !player.traveling) {
                if (player.pregnantDay > 0) {
                    spouse.townId = _bestHomeTownForSpouse;
                } else if (spouse.townId !== player.townId) {
                    spouse.townId = _bestHomeTownForSpouse;
                }
            }
        } else {
            if (spouse.townId !== player.townId && !player.traveling) {
                spouse.townId = player.townId;
            }
        }

        var rel = getRelationship(player.spouseId);
        var sameCity = spouse.townId === player.townId;

        if (sameCity) {
            modifyRelationship(player.spouseId, 0.05, 'spouse');
        } else {
            var decayRate = 0.3;
            if (spouse.quirks && spouse.quirks.indexOf('jealous') >= 0) decayRate *= 2;
            modifyRelationship(player.spouseId, -decayRate, 'spouse');
        }

        if (!sameCity) {
            modifyRelationship(player.spouseId, -0.1, 'spouse');
            if (spouse.quirks && spouse.quirks.indexOf('clingy') >= 0) {
                modifyRelationship(player.spouseId, -0.5, 'spouse');
            }
        }

        if (spouse.quirks && spouse.quirks.indexOf('violent_temper') >= 0) {
            var rng = Engine.getRng();
            if (rng && rng.chance(1 / 45)) {
                var drop = rng.randInt(5, 15);
                modifyRelationship(player.spouseId, -drop, 'spouse');
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('\u{1F4A2} Your spouse had a violent outburst! Relationship -' + drop + '.', 'warning', 'my_actions');
                }
            }
        }

        if (spouse.quirks && spouse.quirks.indexOf('forgiving') >= 0 && rel.level < 50) {
            modifyRelationship(player.spouseId, 0.3, 'spouse');
        }

        if (rel.level >= 90) {
            player.spouseRelHighDays = (player.spouseRelHighDays || 0) + 1;
            if (player.spouseRelHighDays >= 360) {
                unlockAchievement('devoted_spouse');
            }
        } else {
            player.spouseRelHighDays = 0;
        }

        if (spouse.quirks && spouse.quirks.indexOf('secret_gambler') >= 0) {
            var rng2 = Engine.getRng();
            if (rng2 && rng2.chance(1 / 30)) {
                var gloss = rng2.randInt(5, 50);
                if (player.gold >= gloss) {
                    player.gold -= gloss;
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast('\u{1F3B2} Your spouse gambled away ' + gloss + 'g!', 'warning', 'my_actions');
                    }
                }
            }
        }

        if (spouse.quirks && spouse.quirks.indexOf('devout') >= 0) {
            var donation = Math.floor(player.gold * 0.0017);
            if (donation > 0 && player.gold >= donation) {
                player.gold -= donation;
                if (player.citizenshipKingdomId) {
                    player.reputation[player.citizenshipKingdomId] = Math.min(100,
                        (player.reputation[player.citizenshipKingdomId] || 50) + 0.01);
                }
            }
        }
    }


    // ========================================================
    // §11.6C SPOUSE AI SYSTEM
    // ========================================================

    function initSpouseAI() {
        var player = ps();
        if (!player.spouseAI) {
            player.spouseAI = {
                gold: 0, health: 100, condition: 'healthy',
                activity: 'idle', activityEnd: 0, activityDetail: '',
                managedBuildingIdx: -1, stayTownId: null,
                lastActionDay: 0, totalEarned: 0,
                recentActions: [],
                assignedTask: null,
                daysSick: 0, daysInjured: 0, sickEndDay: 0,
                travelTarget: null, travelArrivalDay: null
            };
        }
    }

    // --------------------------------------------------------
    // Spouse Health Tick
    // --------------------------------------------------------

    function tickSpouseHealth(spouse) {
        var player = ps();
        // Story Mode: protect family from random health events
        if (player.storyMode && player.storyMode.active && player.storyMode.flags && player.storyMode.flags.protectFamily) return;
        var ai = player.spouseAI;
        var rng = Engine.getRng();
        var cfg = CONFIG.SPOUSE_AI;

        // Base sickness modifier
        var sickMod = 1.0;
        if (spouse.age > cfg.AGE_SICKNESS_THRESHOLD) {
            sickMod += (spouse.age - cfg.AGE_SICKNESS_THRESHOLD) * cfg.AGE_SICKNESS_MULTIPLIER / cfg.SICKNESS_DAILY_CHANCE;
        }
        // Quirk modifiers
        var quirks = spouse.quirks || [];
        if (quirks.indexOf('frail_health') >= 0) sickMod *= 2.0;
        if (quirks.indexOf('strong_constitution') >= 0) sickMod *= 0.5;

        // Injury multiplier based on activity
        var injuryMod = 1.0;
        if (ai.activity === 'working' || ai.activity === 'managing') injuryMod = 3.0;
        else if (ai.activity === 'trading') injuryMod = 1.0;
        else if (ai.activity === 'idle' || ai.activity === 'resting') injuryMod = 0.5;

        if (ai.condition === 'healthy') {
            // Roll for sickness
            if (rng.chance(cfg.SICKNESS_DAILY_CHANCE * sickMod)) {
                ai.condition = 'sick';
                ai.daysSick = 0;
                ai.sickEndDay = Engine.getDay() + rng.randInt(cfg.SICK_MIN_DAYS, cfg.SICK_MAX_DAYS);
                ai.health = Math.max(ai.health - rng.randInt(10, 25), 20);
                Engine.logEvent(spouse.firstName + ' has fallen ill.');
            }
            // Roll for injury
            if (rng.chance(cfg.INJURY_DAILY_CHANCE * injuryMod)) {
                ai.condition = 'injured';
                ai.daysInjured = 0;
                ai.health = Math.max(ai.health - rng.randInt(15, 35), 10);
                Engine.logEvent(spouse.firstName + ' has been injured.');
            }
        } else if (ai.condition === 'sick') {
            ai.daysSick++;
            // Check for severe illness
            if (rng.chance(cfg.SEVERE_ILLNESS_CHANCE)) {
                ai.condition = 'gravely_ill';
                ai.health = Math.max(ai.health - 20, 5);
                Engine.logEvent(spouse.firstName + ' has become gravely ill!');
            } else if (Engine.getDay() >= ai.sickEndDay) {
                // Recovery
                ai.condition = 'healthy';
                ai.daysSick = 0;
                ai.health = Math.min(ai.health + cfg.RECOVERY_RATE_HOME, cfg.HEALTH_MAX);
                Engine.logEvent(spouse.firstName + ' has recovered from illness.');
            } else {
                // Slow recovery while sick
                ai.health = Math.min(ai.health + 1, cfg.HEALTH_MAX);
            }
        } else if (ai.condition === 'gravely_ill') {
            ai.daysSick++;
            if (rng.chance(cfg.SEVERE_ILLNESS_DEATH_DAILY)) {
                // Death
                spouse.alive = false;
                spouse.causeOfDeath = 'severe illness';
                player.spouseId = null;
                Engine.logEvent(spouse.firstName + ' has died from a severe illness. You are devastated.');
                return;
            }
            // Chance of downgrade back to sick
            if (ai.daysSick > cfg.SICK_MAX_DAYS && rng.chance(0.15)) {
                ai.condition = 'sick';
                ai.sickEndDay = Engine.getDay() + rng.randInt(cfg.SICK_MIN_DAYS, cfg.SICK_MAX_DAYS);
                Engine.logEvent(spouse.firstName + '\'s condition has stabilized.');
            }
        } else if (ai.condition === 'injured') {
            ai.daysInjured++;
            ai.health = Math.min(ai.health + 2, cfg.HEALTH_MAX);
            if (ai.health > 50) {
                ai.condition = 'healthy';
                ai.daysInjured = 0;
                Engine.logEvent(spouse.firstName + ' has recovered from injuries.');
            }
        }

        // Passive health regeneration when resting
        if (ai.activity === 'resting') {
            var recoveryRate = cfg.RECOVERY_RATE_OUTSIDE;
            if (spouse.townId === player.townId) recoveryRate = cfg.RECOVERY_RATE_HOME;
            else if (spouse.townId) recoveryRate = cfg.RECOVERY_RATE_INN;
            ai.health = Math.min(ai.health + recoveryRate, cfg.HEALTH_MAX);
        }
    }

    // --------------------------------------------------------
    // Spouse Behavior Weights
    // --------------------------------------------------------

    function getSpouseBehaviorWeights(spouse) {
        var player = ps();
        var p = spouse.personality || {};
        var quirks = spouse.quirks || [];
        var ai = player.spouseAI;
        var ambition = p.ambition || 0;
        var intelligence = p.intelligence || 0;
        var warmth = p.warmth || 0;
        var frugality = p.frugality || 0;
        var cfg = CONFIG.SPOUSE_AI;

        // Determine spouse's social rank and occupation for status-appropriate behavior
        var spouseRank = getNPCSocialRank(spouse);
        var playerRank = 0;
        if (player.socialRank) {
            for (var _kId in player.socialRank) {
                if (player.socialRank[_kId] > playerRank) playerRank = player.socialRank[_kId];
            }
        }
        var effectiveRank = Math.max(spouseRank, playerRank); // spouse adopts player's rank
        var occupation = spouse.occupation || 'none';

        // --- Elite merchant-level base weights (smarter than before) ---
        var weights = {
            work: Math.max(8, ambition * 0.6 + intelligence * 0.4),
            trade: intelligence >= 25 ? (ambition * 0.4 + intelligence * 0.6 + 15) : 0, // lower int threshold, higher base
            manage: (ai.managedBuildingIdx >= 0 && intelligence >= 20) ? 90 : 0, // lower threshold, higher weight
            socialize: warmth * 0.6 + (100 - ambition) * 0.15 + 10,
            household: (100 - ambition) * 0.3 + warmth * 0.25,
            gatherIntel: intelligence * 0.6 * (ambition * 0.01 + 0.4) + 8, // boosted intel gathering
            rest: Math.max(5, (100 - ai.health) * 1.5),
            idle: Math.max(1, (100 - ambition) * 0.08 + (100 - intelligence) * 0.05) // less idle time
        };

        // --- Occupation-appropriate behavior ---
        if (occupation === 'merchant' || occupation === 'trader') {
            weights.trade *= 1.8;
            weights.gatherIntel *= 1.5;
            weights.work *= 0.6;
        } else if (occupation === 'noble') {
            weights.socialize *= 2.0;
            weights.gatherIntel *= 1.5;
            weights.work = 0; // nobles don't do manual labor
            weights.household *= 0.3;
        } else if (occupation === 'farmer' || occupation === 'laborer') {
            weights.work *= 1.5;
            weights.household *= 1.3;
        } else if (occupation === 'guard' || occupation === 'soldier') {
            weights.work *= 1.3;
            weights.gatherIntel *= 1.3;
        } else if (occupation === 'scholar' || occupation === 'doctor' || occupation === 'healer') {
            weights.gatherIntel *= 2.0;
            weights.trade *= 0.5;
        } else if (occupation === 'craftsman' || occupation === 'artisan' || occupation === 'blacksmith') {
            weights.work *= 1.4;
            weights.manage *= 1.3;
        }

        // --- Social rank adjustments (higher rank = more dignified activities) ---
        if (effectiveRank >= 4) { // Noble+
            weights.work *= 0.2;    // nobles rarely do manual work
            weights.household *= 0.4; // servants handle it
            weights.socialize *= 1.5;
            weights.gatherIntel *= 1.5;
            weights.manage *= 1.3;
        } else if (effectiveRank >= 3) { // Guildmaster
            weights.trade *= 1.4;
            weights.manage *= 1.3;
            weights.work *= 0.5;
        } else if (effectiveRank >= 2) { // Burgher
            weights.trade *= 1.2;
            weights.manage *= 1.2;
        }

        // --- Quirk adjustments ---
        if (quirks.indexOf('lazy') >= 0) weights.work *= 0.5;
        if (quirks.indexOf('adventurous') >= 0) weights.trade *= 2.0;
        if (quirks.indexOf('fearful') >= 0) weights.trade *= 0.5;
        if (quirks.indexOf('bookworm') >= 0) weights.gatherIntel *= 2.0;
        if (quirks.indexOf('prideful') >= 0 && ambition < 30) weights.work = 0;
        if (quirks.indexOf('good_cook') >= 0) weights.household += 15;

        // --- Homebody personality ---
        if (ambition < 30 && warmth > 60) weights.household += 20;

        // --- Home preference: boost household/manage/socialize when at player's primary home ---
        var atPrimaryHome = false;
        var bestHouseTown = null;
        var bestComfort = -1;
        for (var _hhi = 0; _hhi < (player.houses || []).length; _hhi++) {
            var _hh = player.houses[_hhi];
            var _ht = CONFIG.HOUSING_TYPES ? CONFIG.HOUSING_TYPES.find(function(t) { return t.id === _hh.type; }) : null;
            if (_ht && _ht.comfort > bestComfort) {
                bestComfort = _ht.comfort;
                bestHouseTown = _hh.townId;
            }
        }
        if (bestHouseTown && spouse.townId === bestHouseTown) {
            atPrimaryHome = true;
            weights.household += 15;
            weights.manage += 10;
            weights.socialize += 10;
        }

        // --- Health-based rest boost ---
        if (ai.health < 50) weights.rest += (50 - ai.health) * 2;
        if (ai.health < 30) weights.rest += 60;

        // --- High frugality = less risky trading ---
        if (frugality > 70) weights.trade *= 0.8;

        return weights;
    }

    // --------------------------------------------------------
    // Weighted Random Selection Helper
    // --------------------------------------------------------

    function selectWeightedAction(weights) {
        var player = ps();
        var rng = Engine.getRng();
        var total = 0;
        var key;
        for (key in weights) {
            if (weights.hasOwnProperty(key)) total += weights[key];
        }
        if (total <= 0) return 'idle';
        var roll = rng.random() * total;
        var cumulative = 0;
        for (key in weights) {
            if (weights.hasOwnProperty(key)) {
                cumulative += weights[key];
                if (roll < cumulative) return key;
            }
        }
        return 'idle';
    }

    // --------------------------------------------------------
    // Log Spouse Action
    // --------------------------------------------------------

    function logSpouseAction(day, action, detail, gold) {
        var player = ps();
        var ai = player.spouseAI;
        ai.recentActions.push({ day: day, action: action, detail: detail, gold: gold || 0 });
        if (ai.recentActions.length > 10) ai.recentActions.shift();
    }

    // --------------------------------------------------------
    // Execute Spouse Actions
    // --------------------------------------------------------

    function executeSpouseWork(spouse) {
        var player = ps();
        var rng = Engine.getRng();
        var cfg = CONFIG.SPOUSE_AI;
        var ai = player.spouseAI;
        var skills = spouse.skills || {};
        var intelligence = (spouse.personality && spouse.personality.intelligence) || 10;

        // Determine best skill for occupation pay
        var bestSkill = 10;
        var skillKeys = ['farming', 'mining', 'crafting', 'trading', 'combat'];
        for (var i = 0; i < skillKeys.length; i++) {
            if (skills[skillKeys[i]] && skills[skillKeys[i]] > bestSkill) {
                bestSkill = skills[skillKeys[i]];
            }
        }
        var pay = Math.floor(cfg.JOB_PAY_MIN + (intelligence / 100) * (cfg.JOB_PAY_MAX - cfg.JOB_PAY_MIN) + bestSkill * 0.1);
        pay = Math.max(cfg.JOB_PAY_MIN, Math.min(cfg.JOB_PAY_MAX, pay));
        ai.gold += pay;
        ai.totalEarned += pay;
        ai.activity = 'working';
        ai.activityDetail = 'Earning wages in town';
        return pay;
    }

    function executeSpouseTrade(spouse) {
        var player = ps();
        var rng = Engine.getRng();
        var cfg = CONFIG.SPOUSE_AI;
        var ai = player.spouseAI;
        var skills = spouse.skills || {};
        var tradingSkill = skills.trading || 10;
        var intelligence = (spouse.personality && spouse.personality.intelligence) || 10;
        var frugality = (spouse.personality && spouse.personality.frugality) || 50;

        // Elite merchant-level trading: smarter decisions, better margins
        var profitRange = cfg.TRADE_PROFIT_MAX - cfg.TRADE_PROFIT_MIN;
        var skillBonus = (tradingSkill / 100) * profitRange * 0.5;
        var intBonus = (intelligence / 100) * profitRange * 0.4; // boosted from 0.3
        var frugalBonus = (frugality / 100) * 8; // boosted from 5
        // Smart trading: rarely loses money with decent intelligence
        var baseFloor = intelligence > 50 ? 0 : cfg.TRADE_PROFIT_MIN;
        var profit = Math.floor(baseFloor + skillBonus + intBonus + frugalBonus + rng.randFloat(-3, 12));
        profit = Math.max(cfg.TRADE_PROFIT_MIN, Math.min(cfg.TRADE_PROFIT_MAX + 10, profit));

        ai.gold += profit;
        if (profit > 0) ai.totalEarned += profit;
        ai.activity = 'trading';
        ai.activityDetail = profit >= 0 ? 'Trading goods (profit: ' + profit + 'g)' : 'Trading goods (loss: ' + Math.abs(profit) + 'g)';
        return profit;
    }

    function executeSpouseManage(spouse) {
        var player = ps();
        var cfg = CONFIG.SPOUSE_AI;
        var ai = player.spouseAI;
        var idx = ai.managedBuildingIdx;
        if (idx < 0 || idx >= player.buildings.length) {
            ai.managedBuildingIdx = -1;
            ai.activity = 'idle';
            ai.activityDetail = 'No building to manage';
            return 0;
        }
        var building = player.buildings[idx];
        ai.activity = 'managing';
        ai.activityDetail = 'Managing ' + (building.type || 'building') + ' in town';
        // The bonus is applied externally via managedBuildingIdx check
        return 0;
    }

    function executeSpouseSocialize(spouse) {
        var player = ps();
        var rng = Engine.getRng();
        var ai = player.spouseAI;
        var warmth = (spouse.personality && spouse.personality.warmth) || 30;
        var relationBoost = rng.randInt(1, 3);

        // Spouse warmth no longer gives passive kingdom reputation
        // Marriage has social benefits (relationship, household) but not a rep farm

        ai.activity = 'socializing';
        ai.activityDetail = 'Socializing with townsfolk';
        modifyRelationship(player.spouseId, relationBoost);
        return 0;
    }

    function executeSpouseHousehold(spouse) {
        var player = ps();
        var ai = player.spouseAI;
        ai.activity = 'household';
        ai.activityDetail = 'Tending to household duties';
        // Reduces hunger drain — checked externally via activity === 'household'
        return 0;
    }

    function executeSpouseGatherIntel(spouse) {
        var player = ps();
        var rng = Engine.getRng();
        var ai = player.spouseAI;
        var intelligence = (spouse.personality && spouse.personality.intelligence) || 10;
        var town = Engine.findTown(spouse.townId || player.townId);
        var numGoods = intelligence > 60 ? 2 : 1;

        ai.activity = 'gathering_intel';
        if (town) {
            ai.activityDetail = 'Gathering market information in ' + (town.name || 'town') + ' (' + numGoods + ' goods)';
        } else {
            ai.activityDetail = 'Gathering market information (' + numGoods + ' goods)';
        }
        return 0;
    }

    function executeSpouseRest(spouse) {
        var player = ps();
        var cfg = CONFIG.SPOUSE_AI;
        var ai = player.spouseAI;
        var recoveryRate = cfg.RECOVERY_RATE_OUTSIDE;
        if (spouse.townId === player.townId) recoveryRate = cfg.RECOVERY_RATE_HOME;
        else if (spouse.townId) recoveryRate = cfg.RECOVERY_RATE_INN;
        ai.health = Math.min(ai.health + recoveryRate, cfg.HEALTH_MAX);
        ai.activity = 'resting';
        ai.activityDetail = 'Resting and recovering (health: ' + ai.health + ')';
        return 0;
    }

    // --------------------------------------------------------
    // Main Spouse AI Tick
    // --------------------------------------------------------

    function tickSpouseAI() {
        var player = ps();
        initSpouseAI();
        if (!player.spouseId) return;

        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) {
            player.spouseAI.activity = 'idle';
            player.spouseAI.activityDetail = '';
            return;
        }

        var ai = player.spouseAI;
        var cfg = CONFIG.SPOUSE_AI;
        var day = Engine.getDay();
        var rng = Engine.getRng();

        // Only tick once per interval
        if (day - ai.lastActionDay < cfg.TICK_INTERVAL) return;
        ai.lastActionDay = day;

        // Handle travel arrival
        if (ai.activity === 'traveling' && ai.travelTarget && ai.travelArrivalDay) {
            if (day >= ai.travelArrivalDay) {
                spouse.townId = ai.travelTarget;
                var arrTown = Engine.findTown(ai.travelTarget);
                ai.activity = 'idle';
                ai.activityDetail = 'Arrived in ' + (arrTown ? arrTown.name : 'town');
                Engine.logEvent('💍 ' + spouse.firstName + ' has arrived in ' + (arrTown ? arrTown.name : 'the destination') + '.', null, 'my_actions');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast(spouse.firstName + ' arrived in ' + (arrTown ? arrTown.name : 'town') + '.', 'info');
                logSpouseAction(day, 'travel', 'Arrived in ' + (arrTown ? arrTown.name : 'town'), 0);
                ai.travelTarget = null;
                ai.travelArrivalDay = null;
            } else {
                // Still traveling — skip other actions
                var daysLeft = ai.travelArrivalDay - day;
                ai.activityDetail = 'Traveling (' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' remaining)';
                return;
            }
        }

        // Health tick
        tickSpouseHealth(spouse);
        if (!spouse.alive) return; // died from illness

        // If too sick/injured to act, forced rest
        if ((ai.condition === 'sick' || ai.condition === 'gravely_ill' || ai.condition === 'injured') && ai.health < 30) {
            ai.activity = 'resting';
            ai.activityDetail = 'Too unwell to do anything — resting';
            logSpouseAction(day, 'rest', 'Forced rest due to poor health', 0);
            return;
        }

        // Auto-seek treatment: spouse goes to hospital if sick and has money
        if (ai.condition !== 'healthy' && !ai._seekingTreatment) {
            var _spTown = Engine.findTown(spouse.townId);
            if (_spTown) {
                var _spHasMed = false;
                if (_spTown.buildings) {
                    for (var _bmi = 0; _bmi < _spTown.buildings.length; _bmi++) {
                        if (_spTown.buildings[_bmi].type === 'hospital' || _spTown.buildings[_bmi].type === 'clinic') { _spHasMed = true; break; }
                    }
                }
                if (!_spHasMed && (_spTown.category === 'city' || _spTown.category === 'capital_city')) _spHasMed = true;
                if (_spHasMed) {
                    var _spSev = ai.condition === 'gravely_ill' ? 'severe' : 'moderate';
                    var _spCost = getHospitalCost({ productCost: 10 }, _spSev);
                    var _spGold = ai.savings || 0;
                    if (_spGold >= _spCost) {
                        ai.savings -= _spCost;
                        ai.condition = 'healthy';
                        ai.daysSick = 0;
                        ai.daysInjured = 0;
                        ai.health = Math.min(ai.health + 40, cfg.HEALTH_MAX || 100);
                        _payHealthcareRevenue(_spTown, _spCost);
                        ai.activity = 'recovering';
                        ai.activityDetail = 'Treated at hospital (' + _spCost + 'g)';
                        Engine.logEvent('🏥 ' + spouse.firstName + ' sought treatment at the hospital (' + _spCost + 'g from savings).');
                        logSpouseAction(day, 'hospital', 'Sought treatment', -_spCost);
                        return;
                    }
                }
            }
        }

        var goldEarned = 0;
        var actionTaken = 'idle';
        var actionDetail = '';

        // If player assigned a task, try that first
        if (ai.assignedTask) {
            var task = ai.assignedTask;
            if (task.type === 'work') {
                goldEarned = executeSpouseWork(spouse);
                actionTaken = 'work';
                actionDetail = ai.activityDetail;
            } else if (task.type === 'trade') {
                if ((spouse.personality && spouse.personality.intelligence || 0) >= cfg.TRADE_MIN_INTELLIGENCE) {
                    goldEarned = executeSpouseTrade(spouse);
                    actionTaken = 'trade';
                    actionDetail = ai.activityDetail;
                } else {
                    goldEarned = executeSpouseWork(spouse);
                    actionTaken = 'work';
                    actionDetail = 'Not skilled enough to trade — working instead';
                }
            } else if (task.type === 'manage') {
                executeSpouseManage(spouse);
                actionTaken = 'manage';
                actionDetail = ai.activityDetail;
            } else if (task.type === 'gather_intel') {
                executeSpouseGatherIntel(spouse);
                actionTaken = 'gatherIntel';
                actionDetail = ai.activityDetail;
            } else {
                // Unknown task, clear it
                ai.assignedTask = null;
            }
        }

        // If no assigned task (or it was cleared), autonomous behavior
        if (!ai.assignedTask) {
            // Pregnant spouse must stay at primary home — override all other behavior
            var _isPregnant = player.pregnantDay > 0;

            // Smart home preference: spouse strongly prefers being at primary home
            if (!ai.travelTarget) {
                var _bestHomeTown = null;
                var _bestHComfort = -1;
                for (var _bhi = 0; _bhi < (player.houses || []).length; _bhi++) {
                    var _bh = player.houses[_bhi];
                    var _bht = CONFIG.HOUSING_TYPES ? CONFIG.HOUSING_TYPES.find(function(t) { return t.id === _bh.type; }) : null;
                    if (_bht && _bht.comfort > _bestHComfort) {
                        _bestHComfort = _bht.comfort;
                        _bestHomeTown = _bh.townId;
                    }
                }
                // If pregnant, always go home immediately (no travel delay)
                if (_bestHomeTown && spouse.townId !== _bestHomeTown && _isPregnant) {
                    spouse.townId = _bestHomeTown;
                    ai.activity = 'resting';
                    ai.activityDetail = 'Resting at home during pregnancy';
                    logSpouseAction(day, 'rest', 'Resting at home during pregnancy', 0);
                    return;
                }
                // Otherwise, 80% chance to return home each tick if away (was 15%)
                if (_bestHomeTown && spouse.townId !== _bestHomeTown && rng.chance(0.80)) {
                    // Travel home autonomously
                    var homeTown = Engine.findTown(_bestHomeTown);
                    var fromTown = Engine.findTown(spouse.townId);
                    if (homeTown && fromTown) {
                        var dist = Math.sqrt(Math.pow(homeTown.x - fromTown.x, 2) + Math.pow(homeTown.y - fromTown.y, 2));
                        var travelDays = Math.max(1, Math.round(dist / 50));
                        ai.travelTarget = _bestHomeTown;
                        ai.travelArrivalDay = day + travelDays;
                        ai.activity = 'traveling';
                        ai.activityDetail = 'Returning home to ' + homeTown.name + ' (' + travelDays + ' days)';
                        logSpouseAction(day, 'travel', 'Returning home to ' + homeTown.name, 0);
                        return;
                    }
                }
            }

            var weights = getSpouseBehaviorWeights(spouse);
            var chosen = selectWeightedAction(weights);

            if (chosen === 'work') {
                goldEarned = executeSpouseWork(spouse);
                actionTaken = 'work';
            } else if (chosen === 'trade') {
                goldEarned = executeSpouseTrade(spouse);
                actionTaken = 'trade';
            } else if (chosen === 'manage') {
                executeSpouseManage(spouse);
                actionTaken = 'manage';
            } else if (chosen === 'socialize') {
                executeSpouseSocialize(spouse);
                actionTaken = 'socialize';
            } else if (chosen === 'household') {
                executeSpouseHousehold(spouse);
                actionTaken = 'household';
            } else if (chosen === 'gatherIntel') {
                executeSpouseGatherIntel(spouse);
                actionTaken = 'gatherIntel';
            } else if (chosen === 'rest') {
                executeSpouseRest(spouse);
                actionTaken = 'rest';
            } else {
                ai.activity = 'idle';
                ai.activityDetail = 'Relaxing at home';
                actionTaken = 'idle';
            }
            actionDetail = ai.activityDetail;
        }

        logSpouseAction(day, actionTaken, actionDetail, goldEarned);
    }

    // --------------------------------------------------------
    // Spouse Request Acceptance Calculation
    // --------------------------------------------------------

    function calcSpouseAcceptance(spouse) {
        var player = ps();
        var cfg = CONFIG.SPOUSE_AI;
        var p = spouse.personality || {};
        var rel = getRelationship(player.spouseId);
        var relLevel = rel ? rel.level : 50;
        var chance = cfg.REQUEST_BASE_ACCEPT
            + (p.loyalty || 0) * cfg.LOYALTY_ACCEPT_WEIGHT
            + relLevel * cfg.RELATIONSHIP_ACCEPT_WEIGHT / 100
            + (p.warmth || 0) * cfg.WARMTH_ACCEPT_WEIGHT
            - 50;
        return Math.max(10, Math.min(95, chance));
    }

    function getRefusalMessage(spouse) {
        var player = ps();
        var p = spouse.personality || {};
        var quirks = spouse.quirks || [];
        var rng = Engine.getRng();

        if (quirks.indexOf('lazy') >= 0 && rng.chance(0.5)) {
            return 'I\'d rather not... maybe tomorrow.';
        }
        if ((p.ambition || 0) > 70 && rng.chance(0.5)) {
            return 'I have my own plans today, perhaps another time.';
        }
        if (quirks.indexOf('fearful') >= 0 && rng.chance(0.5)) {
            return 'That sounds too risky for my liking.';
        }
        if ((p.warmth || 0) < 30 && rng.chance(0.4)) {
            return 'Why should I? You never consider what I want.';
        }
        if (quirks.indexOf('prideful') >= 0 && rng.chance(0.5)) {
            return 'That is beneath someone of my standing.';
        }
        if ((p.honesty || 0) > 70 && rng.chance(0.4)) {
            return 'I have to be honest — I don\'t think that\'s a good idea.';
        }

        var genericRefusals = [
            'Not today, I\'m afraid.',
            'I\'d prefer not to right now.',
            'Perhaps we can discuss this later.',
            'I need some time to think about it.',
            'I don\'t feel up to it at the moment.'
        ];
        return genericRefusals[rng.randInt(0, genericRefusals.length - 1)];
    }

    function trySpouseRequest(spouse, description) {
        var player = ps();
        var rng = Engine.getRng();
        var acceptance = calcSpouseAcceptance(spouse);
        if (rng.chance(acceptance / 100)) {
            return { success: true, accepted: true, message: spouse.firstName + ' agrees: "Of course, I\'ll take care of it."' };
        }
        return { success: true, accepted: false, message: spouse.firstName + ' declines: "' + getRefusalMessage(spouse) + '"' };
    }

    // --------------------------------------------------------
    // Player-Spouse Interaction Functions
    // --------------------------------------------------------

    function askSpouseToTrade(townId) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var cfg = CONFIG.SPOUSE_AI;
        if ((spouse.personality && spouse.personality.intelligence || 0) < cfg.TRADE_MIN_INTELLIGENCE) {
            return { success: false, message: spouse.firstName + ' lacks the intelligence for trading.' };
        }
        var result = trySpouseRequest(spouse, 'trade in another town');
        if (result.accepted) {
            player.spouseAI.assignedTask = { type: 'trade', target: townId, detail: 'Trading in town' };
            player.spouseAI.activity = 'trading';
            player.spouseAI.stayTownId = townId;
            var town = Engine.findTown(townId);
            player.spouseAI.activityDetail = 'Traveling to trade in ' + (town ? town.name : 'a distant town');
        }
        return result;
    }

    function askSpouseToManage(buildingIdx) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        buildingIdx = Number(buildingIdx);
        if (isNaN(buildingIdx)) return { success: false, message: 'Invalid building index.' };
        // -1 means unassign from building management
        if (buildingIdx === -1) {
            player.spouseAI.managedBuildingIdx = null;
            player.spouseAI.assignedTask = null;
            player.spouseAI.activity = 'idle';
            player.spouseAI.activityDetail = 'Unassigned from building management';
            return { success: true, accepted: true, message: spouse.firstName + ' is no longer managing a building.' };
        }
        var cfg = CONFIG.SPOUSE_AI;
        if ((spouse.personality && spouse.personality.intelligence || 0) < cfg.MANAGE_MIN_INTELLIGENCE) {
            return { success: false, message: spouse.firstName + ' is not capable of managing a building.' };
        }
        if (buildingIdx < 0 || buildingIdx >= player.buildings.length) {
            return { success: false, message: 'Invalid building.' };
        }
        var result = trySpouseRequest(spouse, 'manage a building');
        if (result.accepted) {
            player.spouseAI.managedBuildingIdx = buildingIdx;
            player.spouseAI.assignedTask = { type: 'manage', target: buildingIdx, detail: 'Managing building' };
            player.spouseAI.activity = 'managing';
            player.spouseAI.activityDetail = 'Managing ' + (player.buildings[buildingIdx].type || 'building');
        }
        return result;
    }

    function askSpouseToWork() {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'work for wages');
        if (result.accepted) {
            player.spouseAI.assignedTask = { type: 'work', target: null, detail: 'Working for wages' };
            player.spouseAI.activity = 'working';
            player.spouseAI.activityDetail = 'Working for wages as assigned';
        }
        return result;
    }

    function askSpouseToStay(townId) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'stay in a town');
        if (result.accepted) {
            player.spouseAI.stayTownId = townId;
            var town = Engine.findTown(townId);
            player.spouseAI.activityDetail = 'Staying in ' + (town ? town.name : 'town');
        }
        return result;
    }

    function askSpouseToTravel(townId) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        if (spouse.townId === townId) return { success: false, message: spouse.firstName + ' is already in that town.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'travel to a town');
        if (result.accepted) {
            var town = Engine.findTown(townId);
            var currentTown = Engine.findTown(spouse.townId);
            // Calculate travel time based on distance
            var travelDays = 3;
            if (currentTown && town) {
                var dist = Math.sqrt(Math.pow(town.x - currentTown.x, 2) + Math.pow(town.y - currentTown.y, 2));
                travelDays = Math.max(2, Math.min(10, Math.round(dist / 50)));
            }
            player.spouseAI.stayTownId = townId;
            player.spouseAI.activity = 'traveling';
            player.spouseAI.activityDetail = 'Traveling to ' + (town ? town.name : 'a distant town') + ' (~' + travelDays + ' days)';
            player.spouseAI.travelTarget = townId;
            player.spouseAI.travelArrivalDay = Engine.getDay() + travelDays;
            result.message = spouse.firstName + ' sets off for ' + (town ? town.name : 'the destination') + '. Expected arrival in ~' + travelDays + ' days.';
        }
        return result;
    }

    function askSpouseForMoney(amount) {
        var player = ps();
        amount = Number(amount);
        if (!amount || !isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid amount.' };
        amount = Math.floor(amount);
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var ai = player.spouseAI;
        var totalGold = (ai.gold || 0) + (spouse.gold || 0);
        if (totalGold < amount) {
            return { success: false, message: spouse.firstName + ' only has ' + Math.floor(totalGold) + ' gold.' };
        }
        // Generosity penalty: frugal spouses resist giving money
        var frugality = (spouse.personality && spouse.personality.frugality) || 50;
        var extraPenalty = frugality * 0.3;
        var acceptance = calcSpouseAcceptance(spouse) - extraPenalty;
        acceptance = Math.max(10, Math.min(95, acceptance));
        var rng = Engine.getRng();
        if (rng.chance(acceptance / 100)) {
            // Draw from AI gold first, then NPC gold
            var fromAi = Math.min(ai.gold || 0, amount);
            var fromNpc = amount - fromAi;
            ai.gold -= fromAi;
            if (fromNpc > 0 && spouse.gold >= fromNpc) spouse.gold -= fromNpc;
            player.gold += amount;
            modifyRelationship(player.spouseId, -2);
            return { success: true, accepted: true, message: spouse.firstName + ' hands over ' + amount + ' gold.' };
        }
        return { success: true, accepted: false, message: spouse.firstName + ' declines: "' + getRefusalMessage(spouse) + '"' };
    }

    function askSpouseToGatherIntel() {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'gather market intelligence');
        if (result.accepted) {
            player.spouseAI.assignedTask = { type: 'gather_intel', target: null, detail: 'Gathering market intel' };
            player.spouseAI.activity = 'gathering_intel';
            player.spouseAI.activityDetail = 'Gathering market price information';
        }
        return result;
    }

    function askSpouseToHireWorkers() {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'recruit workers');
        if (result.accepted) {
            player.spouseAI.activity = 'hiring';
            player.spouseAI.activityDetail = 'Recruiting workers for your buildings';
            Engine.logEvent(spouse.firstName + ' is recruiting workers on your behalf.');
        }
        return result;
    }

    function askSpouseToNegotiate(npcId) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var result = trySpouseRequest(spouse, 'negotiate with someone');
        if (result.accepted) {
            player.spouseAI.activity = 'negotiating';
            var npc = Engine.findPerson(npcId);
            player.spouseAI.activityDetail = 'Negotiating with ' + (npc ? npc.firstName : 'an NPC');
            // Negotiation success based on trading skill + intelligence
            var tradingSkill = (spouse.skills && spouse.skills.trading) || 10;
            var intelligence = (spouse.personality && spouse.personality.intelligence) || 10;
            var rng = Engine.getRng();
            var bonus = (tradingSkill + intelligence) / 200; // 0 to 1
            if (rng.chance(0.3 + bonus * 0.4) && npc) {
                modifyRelationship(npcId, rng.randInt(2, 5));
                result.message += ' The negotiation went well.';
            }
        }
        return result;
    }

    function spouseSpendTime() {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var rng = Engine.getRng();
        var boost = rng.randInt(3, 8);
        modifyRelationship(player.spouseId, boost);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.spend_time_spouse || 15);
        Engine.logEvent('You spend quality time with ' + spouse.firstName + '. Your bond grows stronger.');
        return { success: true, accepted: true, message: 'You and ' + spouse.firstName + ' enjoy time together. (Relationship +' + boost + ')' };
    }

    function giveSpouseGold(amount) {
        var player = ps();
        amount = Number(amount);
        if (!amount || !isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid amount.' };
        amount = Math.floor(amount);
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        if (player.gold < amount) return { success: false, message: 'You don\'t have enough gold.' };
        initSpouseAI();
        player.gold -= amount;
        player.spouseAI.gold += amount;
        var relBoost = Math.min(5, Math.floor(amount / 10) + 1);
        modifyRelationship(player.spouseId, relBoost);
        return { success: true, accepted: true, message: 'You give ' + amount + ' gold to ' + spouse.firstName + '. (Relationship +' + relBoost + ')' };
    }

    function askSpouseToGuardCaravan(caravanIdx) {
        var player = ps();
        if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { success: false, message: 'Your spouse is not available.' };
        initSpouseAI();
        var combatSkill = (spouse.skills && spouse.skills.combat) || 0;
        var quirks = spouse.quirks || [];
        var isBrave = quirks.indexOf('adventurous') >= 0 || quirks.indexOf('brave') >= 0;
        if (combatSkill < 20 && !isBrave) {
            return { success: false, message: spouse.firstName + ' lacks the combat ability or courage to guard a caravan.' };
        }
        var result = trySpouseRequest(spouse, 'guard a caravan');
        if (result.accepted) {
            player.spouseAI.activity = 'guarding_caravan';
            player.spouseAI.activityDetail = 'Guarding caravan #' + (caravanIdx + 1);
            Engine.logEvent(spouse.firstName + ' is guarding your caravan.', null, 'my_business');
        }
        return result;
    }

    // --------------------------------------------------------
    // Spouse Status for UI
    // --------------------------------------------------------

    function getSpouseStatus() {
        var player = ps();
        if (!player.spouseId) return null;
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return null;
        initSpouseAI();
        var ai = player.spouseAI;
        var npcGold = spouse.gold || 0;
        var aiGold = ai.gold || 0;

        // Pregnancy / fertility status
        var currentDay = 0;
        try { currentDay = Engine.getDay(); } catch(e) {}
        var isPregnant = player.pregnantDay > 0;
        var pregnancyDaysLeft = isPregnant ? Math.max(0, (CONFIG.PREGNANCY_DURATION || 270) - (currentDay - player.pregnantDay)) : 0;
        var canConceive = false;
        var fertilityReason = '';
        if (isPregnant) {
            fertilityReason = 'Currently expecting (due in ~' + pregnancyDaysLeft + ' days)';
        } else if (!spouse.alive) {
            fertilityReason = 'Spouse deceased';
        } else if (player.age >= 50) {
            fertilityReason = 'Player too old (50+)';
        } else if (spouse.age >= 45) {
            fertilityReason = 'Spouse too old (45+)';
        } else if (player.childrenIds && player.childrenIds.length >= (CONFIG.MAX_CHILDREN || 8)) {
            fertilityReason = 'Max children reached';
        } else if (spouse.quirks && spouse.quirks.indexOf('infertile') >= 0) {
            fertilityReason = 'Spouse is infertile';
        } else if (spouse.townId !== player.townId) {
            fertilityReason = 'Must be in same town as spouse';
            canConceive = false;
        } else {
            canConceive = true;
            var hasHouse = false;
            for (var _hi = 0; _hi < (player.houses || []).length; _hi++) {
                if (player.houses[_hi].townId === player.townId) { hasHouse = true; break; }
            }
            var fertQuirk = '';
            if (spouse.quirks && spouse.quirks.indexOf('fertile') >= 0) fertQuirk = 'Fertile quirk (+50%)';
            else if (spouse.quirks && spouse.quirks.indexOf('low_fertility') >= 0) fertQuirk = 'Low fertility (-67%)';
            fertilityReason = 'Can conceive' + (hasHouse ? '' : ' (no house — 90% reduced)') + (fertQuirk ? ' • ' + fertQuirk : '');
        }

        return {
            name: spouse.firstName + ' ' + spouse.lastName,
            age: spouse.age, sex: spouse.sex,
            occupation: spouse.occupation || 'none',
            health: ai.health, condition: ai.condition,
            gold: npcGold + aiGold,
            npcGold: npcGold,
            aiGold: aiGold,
            activity: ai.activity,
            activityDetail: ai.activityDetail,
            totalEarned: ai.totalEarned,
            managedBuilding: ai.managedBuildingIdx >= 0 ? player.buildings[ai.managedBuildingIdx] : null,
            recentActions: ai.recentActions,
            personality: spouse.personality,
            quirks: spouse.quirks || [],
            relationship: getRelationship(player.spouseId).level,
            isPregnant: isPregnant,
            pregnancyDaysLeft: pregnancyDaysLeft,
            canConceive: canConceive,
            fertilityReason: fertilityReason
        };
    }

    // ========================================================
    // §11.6C TRY FOR BABY + §11.6D REGENCY SYSTEM
    // ========================================================

    // ========================================================
    // §11.6C TRY FOR BABY
    // ========================================================

    /**
     * Confirm a child's name from the naming UI.
     * Called by UI.showChildNamingDialog when player picks or types a name.
     * @param {string} childId - The child NPC's ID
     * @param {string} chosenName - The name the player chose
     * @param {boolean} usedSpouseSuggestion - Whether the player used the spouse's suggestion
     */
    function confirmChildName(childId, chosenName, usedSpouseSuggestion) {
        var player = ps();
        if (!childId || !chosenName) return;
        var child = Engine.findPerson(childId);
        if (!child) return;

        // Sanitize and apply name
        chosenName = chosenName.trim();
        if (chosenName.length === 0) chosenName = child.firstName; // fallback to auto-generated
        if (chosenName.length > 20) chosenName = chosenName.substring(0, 20);

        child.firstName = chosenName;
        child.fullName = chosenName + ' ' + (child.lastName || player.lastName);

        // Update familyMembers entry
        if (player.familyMembers) {
            for (var i = 0; i < player.familyMembers.length; i++) {
                if (player.familyMembers[i].npcId === childId) {
                    player.familyMembers[i].name = child.fullName;
                    break;
                }
            }
        }

        // Spouse suggestion bonus: +10 relationship
        if (usedSpouseSuggestion && player.spouseId) {
            modifyRelationship(player.spouseId, 10, 'spouse');
            var spouse = Engine.findPerson(player.spouseId);
            var spouseName = spouse ? spouse.firstName : 'Your spouse';
            Engine.logEvent('❤️ ' + spouseName + ' is delighted you chose ' + (spouse && spouse.sex === 'F' ? 'her' : 'his') + ' suggested name!');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('❤️ ' + spouseName + ' loves the name! (+10 relationship)', 'success', 'my_actions');
        }

        Engine.logEvent('A child is born! ' + child.fullName + ' joins the family.');
        autoJournalCapture('child', 'Our child ' + chosenName + ' has come into this world. I am overwhelmed with joy.', { mood: 'triumphant' });
        grantXP(XP_REWARDS.CHILD, 'child');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('🍼 Welcome ' + child.fullName + '!', 'success', 'my_actions');
        }
        if (typeof UI !== 'undefined' && UI.update) UI.update();
    }

    /**
     * Calculate pregnancy chance and attempt conception.
     * Returns { success, chance, message, blocked, reason }
     */
    function tryForBaby() {
        var player = ps();
        var currentDay = 0;
        try { currentDay = Engine.getDay(); } catch(e) {}
        var rng = Engine.getRng();

        // Once per day limit
        if (player._lastTryForBabyDay && player._lastTryForBabyDay >= currentDay) {
            return { success: false, chance: 0, message: 'You can only try once per day.', blocked: true, reason: 'cooldown' };
        }

        if (!player.spouseId) {
            return { success: false, chance: 0, message: 'You have no spouse.', blocked: true, reason: 'no_spouse' };
        }
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) {
            return { success: false, chance: 0, message: 'Your spouse is not alive.', blocked: true, reason: 'dead' };
        }
        if (player.pregnantDay > 0) {
            return { success: false, chance: 0, message: 'Already expecting a child!', blocked: true, reason: 'pregnant' };
        }
        if (spouse.townId !== player.townId) {
            return { success: false, chance: 0, message: 'Must be in the same town as your spouse.', blocked: true, reason: 'different_town' };
        }
        if (player.childrenIds && player.childrenIds.length >= (CONFIG.MAX_CHILDREN || 8)) {
            return { success: false, chance: 0, message: 'You have reached the maximum number of children.', blocked: true, reason: 'max_children' };
        }

        // Determine who is female
        var femaleAge, maleAge;
        if (player.sex === 'F') {
            femaleAge = player.age || 20;
            maleAge = spouse.age || 20;
        } else {
            femaleAge = spouse.age || 20;
            maleAge = player.age || 20;
        }

        // Hard cutoffs
        if (femaleAge >= 55) {
            return { success: false, chance: 0, message: 'The woman is too old to conceive (55+).', blocked: true, reason: 'age' };
        }

        var chance = 0;
        if (femaleAge >= 50) {
            // Over 50: always 0.1%
            chance = 0.1;
        } else {
            // Age-based curve for the female (primary factor)
            // Under 25: up to 75%, 25-30: ~60-70%, 30-35: ~40-55%, 35-40: ~20-35%, 40-45: ~10-20%, 45-50: ~5-10%
            if (femaleAge < 25) {
                chance = 75;
            } else if (femaleAge < 30) {
                chance = 75 - (femaleAge - 25) * 2; // 75 → 65
            } else if (femaleAge < 35) {
                chance = 65 - (femaleAge - 30) * 4; // 65 → 45
            } else if (femaleAge < 40) {
                chance = 45 - (femaleAge - 35) * 5; // 45 → 20
            } else if (femaleAge < 45) {
                chance = 20 - (femaleAge - 40) * 2.5; // 20 → 7.5
            } else {
                chance = 7.5 - (femaleAge - 45) * 0.5; // 7.5 → 5
            }

            // Male age factor (slight reduction for older males)
            if (maleAge >= 50) {
                chance *= 0.6;
            } else if (maleAge >= 45) {
                chance *= 0.75;
            } else if (maleAge >= 40) {
                chance *= 0.85;
            }

            // Spouse quirks
            var spouseQuirks = spouse.quirks || [];
            if (spouseQuirks.indexOf('infertile') >= 0) {
                return { success: false, chance: 0, message: 'Your spouse is infertile.', blocked: true, reason: 'infertile' };
            }
            if (spouseQuirks.indexOf('fertile') >= 0) chance *= 1.5;
            if (spouseQuirks.indexOf('low_fertility') >= 0) chance *= 0.33;

            // Housing bonus
            var hasHouseHere = false;
            for (var _hhi = 0; _hhi < (player.houses || []).length; _hhi++) {
                if (player.houses[_hhi].townId === player.townId) { hasHouseHere = true; break; }
            }
            if (!hasHouseHere) chance *= 0.10; // 90% reduction with no house

            // Relationship modifier: higher relationship = small boost
            var relLevel = getRelationship(player.spouseId).level || 50;
            if (relLevel >= 80) chance *= 1.15;
            else if (relLevel < 30) chance *= 0.7;

            // Clamp
            chance = Math.max(0.1, Math.min(75, chance));
        }

        // Mark that we tried today
        player._lastTryForBabyDay = currentDay;

        // Advance time by 20 subticks
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(20);

        // Roll for conception
        var roll = rng.random() * 100;
        if (roll < chance) {
            // Conception!
            player.pregnantDay = currentDay;
            var dueDay = currentDay + (CONFIG.PREGNANCY_DURATION || 270);
            var who = player.sex === 'F' ? 'You are' : 'Your spouse is';
            Engine.logEvent('💕 Wonderful news! ' + who + ' expecting a child!');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🤰 ' + who + ' expecting a child!', 'success');
            return { success: true, chance: Math.round(chance * 10) / 10, message: who + ' expecting a child!' };
        } else {
            return { success: false, chance: Math.round(chance * 10) / 10, message: 'No conception this time. (' + (Math.round(chance * 10) / 10) + '% chance)' };
        }
    }

    /**
     * Get the current try-for-baby chance without actually trying.
     */
    function getTryForBabyChance() {
        var player = ps();
        if (!player.spouseId) return { chance: 0, reason: 'No spouse' };
        var spouse = Engine.findPerson(player.spouseId);
        if (!spouse || !spouse.alive) return { chance: 0, reason: 'Spouse deceased' };
        if (player.pregnantDay > 0) return { chance: 0, reason: 'Already pregnant' };
        if (spouse.townId !== player.townId) return { chance: 0, reason: 'Not in same town' };
        if (player.childrenIds && player.childrenIds.length >= (CONFIG.MAX_CHILDREN || 8)) return { chance: 0, reason: 'Max children' };

        var femaleAge, maleAge;
        if (player.sex === 'F') {
            femaleAge = player.age || 20;
            maleAge = spouse.age || 20;
        } else {
            femaleAge = spouse.age || 20;
            maleAge = player.age || 20;
        }

        if (femaleAge >= 55) return { chance: 0, reason: 'Woman over 55' };

        var chance = 0;
        if (femaleAge >= 50) {
            chance = 0.1;
        } else {
            if (femaleAge < 25) chance = 75;
            else if (femaleAge < 30) chance = 75 - (femaleAge - 25) * 2;
            else if (femaleAge < 35) chance = 65 - (femaleAge - 30) * 4;
            else if (femaleAge < 40) chance = 45 - (femaleAge - 35) * 5;
            else if (femaleAge < 45) chance = 20 - (femaleAge - 40) * 2.5;
            else chance = 7.5 - (femaleAge - 45) * 0.5;

            if (maleAge >= 50) chance *= 0.6;
            else if (maleAge >= 45) chance *= 0.75;
            else if (maleAge >= 40) chance *= 0.85;

            var spouseQuirks = spouse.quirks || [];
            if (spouseQuirks.indexOf('infertile') >= 0) return { chance: 0, reason: 'Spouse infertile' };
            if (spouseQuirks.indexOf('fertile') >= 0) chance *= 1.5;
            if (spouseQuirks.indexOf('low_fertility') >= 0) chance *= 0.33;

            var hasHouseHere = false;
            for (var _hhi = 0; _hhi < (player.houses || []).length; _hhi++) {
                if (player.houses[_hhi].townId === player.townId) { hasHouseHere = true; break; }
            }
            if (!hasHouseHere) chance *= 0.10;

            var relLevel = getRelationship(player.spouseId).level || 50;
            if (relLevel >= 80) chance *= 1.15;
            else if (relLevel < 30) chance *= 0.7;

            chance = Math.max(0.1, Math.min(75, chance));
        }

        var currentDay = 0;
        try { currentDay = Engine.getDay(); } catch(e) {}
        var canTryToday = !player._lastTryForBabyDay || player._lastTryForBabyDay < currentDay;

        return { chance: Math.round(chance * 10) / 10, canTryToday: canTryToday };
    }

    // ========================================================
    // §11.6D REGENCY SYSTEM
    // ========================================================

    function calculateRegencyScore(spouse, relationshipLevel) {
        var player = ps();
        if (!spouse || !spouse.personality) return 0;
        const relWeight = (relationshipLevel || 0) * 0.5;
        const loyaltyWeight = (spouse.personality.loyalty || 0) * 0.2;
        const warmthWeight = (spouse.personality.warmth || 0) * 0.15;
        const honestyWeight = (spouse.personality.honesty || 0) * 0.15;
        let score = relWeight + loyaltyWeight + warmthWeight + honestyWeight;
        // Loyal heart quirk: +20 regency score bonus
        if (spouse.quirks && spouse.quirks.includes('loyal_heart')) score += 20;
        return Math.floor(Math.min(100, Math.max(0, score)));
    }

    function getRegencyThreshold(score) {
        var player = ps();
        if (typeof REGENCY_THRESHOLDS === 'undefined') return null;
        for (const t of REGENCY_THRESHOLDS) {
            if (score >= t.min && score <= t.max) return t;
        }
        return REGENCY_THRESHOLDS[REGENCY_THRESHOLDS.length - 1];
    }

    function enterRegency(spouse, heir) {
        var player = ps();
        const rel = getRelationship(player.spouseId);
        const regencyScore = calculateRegencyScore(spouse, rel.level);
        const threshold = getRegencyThreshold(regencyScore);

        player.regencyMode = true;
        player.regencyData = {
            deadPlayerName: player.fullName,
            deadPlayerSex: player.sex,
            deadPlayerChildrenIds: structuredClone(player.childrenIds || []),
            previousFamilyMembers: structuredClone(player.familyMembers || []),
            spouseId: spouse.id,
            spouseName: spouse.firstName + ' ' + spouse.lastName,
            spouseAlive: true,
            spouseAge: spouse.age,
            spousePersonality: spouse.personality ? { ...spouse.personality } : {},
            spouseQuirks: spouse.quirks ? [...spouse.quirks] : [],
            heirId: heir.id,
            heirName: heir.firstName + ' ' + heir.lastName,
            heirAge: heir.age,
            heirSex: heir.sex,
            regencyScore,
            thresholdLabel: threshold ? threshold.label : 'Unknown',
            goldAtDeath: player.gold,
            buildingsAtDeath: player.buildings.length,
            buildingsCopy: structuredClone(player.buildings),
            reputationAtDeath: { ...player.reputation },
            monthlyUpdates: [],
            estateGold: player.gold,
            buildingsMaintained: player.buildings.length,
            dayStarted: Engine.getDay(),
            revealedAtDeath: player.revealedTraits[spouse.id] ? structuredClone(player.revealedTraits[spouse.id]) : { traits: {}, quirks: [] },
            parentSkills: player.skills ? { ...player.skills } : {},
        };

        // Clear previous character's illnesses/injuries — heir is healthy
        player.illnesses = [];
        player.injuries = [];
        player.health = 100;

        Engine.logEvent(`${player.fullName} has passed. ${spouse.firstName} serves as regent for young ${heir.firstName}.`);
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`⚰️ You have passed. ${spouse.firstName} will raise ${heir.firstName} until they come of age.`, 'warning', 'my_actions');
        }
    }

    function tickRegency() {
        var player = ps();
        if (!player.regencyMode || !player.regencyData) return;
        const rd = player.regencyData;
        const rng = Engine.getRng();
        const day = Engine.getDay();

        // Age the heir (1 year per season/90 game days)
        const daysSinceStart = day - rd.dayStarted;
        rd.heirAge = Math.floor((Engine.findPerson(rd.heirId) || {}).age || (rd.heirAge + daysSinceStart / CONFIG.DAYS_PER_SEASON));

        // Update heir age in the world
        const heir = Engine.findPerson(rd.heirId);
        if (heir) {
            rd.heirAge = heir.age;
        }

        // Check if heir is dead
        if (heir && !heir.alive && !window._godInvincible) {
            // All heirs dead — game over
            player.regencyMode = false;
            player.regencyData = null;
            player.deathCause = 'Heir died during regency — the legacy ends';
            Engine.logEvent('The heir has died during regency. The legacy ends.');
            player.alive = false;
            if (typeof Game !== 'undefined' && Game.setState) Game.setState('lost');
            if (typeof UI !== 'undefined' && UI.showLoseScreen) UI.showLoseScreen('No Heir');
            return;
        }

        // Check if spouse dies during regency
        if (rd.spouseAlive) {
            const spouse = Engine.findPerson(rd.spouseId);
            if (!spouse || !spouse.alive) {
                rd.spouseAlive = false;
                rd.regencyScore = Math.max(0, rd.regencyScore - 20);
                const threshold = getRegencyThreshold(rd.regencyScore);
                rd.thresholdLabel = threshold ? threshold.label : rd.thresholdLabel;
                rd.monthlyUpdates.push({ day, message: '⚰️ The regent has passed away. The heir is now orphaned.' });
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('⚰️ Your spouse has died during regency!', 'danger', 'my_actions');
                }
            } else {
                // Check for random spouse death (frail_health quirk increases chance)
                if (rng) {
                    let deathChance = 0.0001;
                    if (rd.spouseQuirks.includes('frail_health')) deathChance *= 3;
                    if (spouse.age > 50) deathChance += 0.0002 * (spouse.age - 50);
                    if (rng.chance(deathChance)) {
                        spouse.alive = false;
                        spouse.causeOfDeath = 'illness during regency';
                        rd.spouseAlive = false;
                        rd.regencyScore = Math.max(0, rd.regencyScore - 20);
                        const threshold = getRegencyThreshold(rd.regencyScore);
                        rd.thresholdLabel = threshold ? threshold.label : rd.thresholdLabel;
                        rd.monthlyUpdates.push({ day, message: '⚰️ The regent has passed away from illness.' });
                    }
                }
            }
        }

        // Monthly updates (every 30 days)
        if (daysSinceStart > 0 && daysSinceStart % 30 === 0) {
            const threshold = getRegencyThreshold(rd.regencyScore);
            if (!threshold) return;

            // Estate management based on threshold
            if (rd.regencyScore >= 80) {
                // Good management
                const income = Math.floor(rd.buildingsMaintained * 5 + 20);
                rd.estateGold += income;
                rd.monthlyUpdates.push({ day, message: `💰 ${rd.spouseName} maintained all businesses. Estate +${income}g.` });
            } else if (rd.regencyScore >= 60) {
                const income = Math.floor(rd.buildingsMaintained * 3 + 10);
                rd.estateGold += income;
                rd.monthlyUpdates.push({ day, message: `📊 ${rd.spouseName} managed the estate adequately. Estate +${income}g.` });
            } else if (rd.regencyScore >= 40) {
                // May sell buildings
                if (rng && rng.chance(0.15) && rd.buildingsMaintained > 0) {
                    rd.buildingsMaintained = Math.max(0, rd.buildingsMaintained - 1);
                    rd.estateGold += 50;
                    rd.monthlyUpdates.push({ day, message: `🏚️ ${rd.spouseName} sold one of the businesses.` });
                } else {
                    rd.monthlyUpdates.push({ day, message: `📊 ${rd.spouseName} reluctantly managed the household.` });
                }
            } else if (rd.regencyScore >= 20) {
                // Takes wealth
                const taken = Math.floor(rd.estateGold * 0.05);
                rd.estateGold = Math.max(0, rd.estateGold - taken);
                rd.monthlyUpdates.push({ day, message: `💸 ${rd.spouseName} took ${taken}g for personal expenses.` });
            } else {
                // Abandoned
                if (!rd._abandoned) {
                    rd._abandoned = true;
                    rd.estateGold = 0;
                    rd.buildingsMaintained = 0;
                    rd.monthlyUpdates.push({ day, message: `🚪 ${rd.spouseName} abandoned the child and left.` });
                }
            }

            // Quirk effects during regency
            if (rd.spouseAlive) {
                if (rd.spouseQuirks.includes('secret_gambler') && rng) {
                    const loss = rng.randInt(5, 50);
                    rd.estateGold = Math.max(0, rd.estateGold - loss);
                    rd.monthlyUpdates.push({ day, message: `🎲 ${rd.spouseName} gambled away ${loss}g.` });
                }
                if (rd.spouseQuirks.includes('devout')) {
                    const donation = Math.floor(rd.estateGold * 0.05);
                    rd.estateGold = Math.max(0, rd.estateGold - donation);
                    rd.monthlyUpdates.push({ day, message: `🙏 ${rd.spouseName} donated ${donation}g to the poor.` });
                }
            }

            // Heir learning messages
            if (heir && heir.alive) {
                const heirMsgs = [
                    `📖 ${rd.heirName} is learning to read.`,
                    `⚔️ ${rd.heirName} practices swordplay.`,
                    `🧮 ${rd.heirName} studies arithmetic.`,
                    `🐴 ${rd.heirName} learns to ride.`,
                    `📜 ${rd.heirName} studies the family ledgers.`,
                ];
                if (rng && rng.chance(0.3)) {
                    rd.monthlyUpdates.push({ day, message: rng.pick(heirMsgs) });
                }
            }
        }

        // Check if heir reaches COMING_OF_AGE
        if (heir && heir.alive && heir.age >= CONFIG.COMING_OF_AGE) {
            endRegency();
        }
    }

    function endRegency() {
        var player = ps();
        if (!player.regencyData) return;
        const rd = player.regencyData;
        const heir = Engine.findPerson(rd.heirId);
        if (!heir || !heir.alive) {
            if (!window._godInvincible) {
                player.deathCause = 'Heir died — the legacy ends';
                player.alive = false;
                player.regencyMode = false;
                player.regencyData = null;
                if (typeof Game !== 'undefined' && Game.setState) Game.setState('lost');
                if (typeof UI !== 'undefined' && UI.showLoseScreen) UI.showLoseScreen('No Heir');
                return;
            }
        }

        const threshold = getRegencyThreshold(rd.regencyScore);
        if (!threshold) {
            player.regencyMode = false;
            player.regencyData = null;
            return;
        }

        // Transfer to heir (similar to handlePlayerDeath heir transfer)
        const oldName = player.fullName;
        player.firstName = heir.firstName;
        player.lastName = heir.lastName;
        player.sex = heir.sex;
        player.fullName = heir.firstName + ' ' + heir.lastName;
        player.age = heir.age;
        player.alive = true;
        player.spouseId = null;
        player.childrenIds = [];
        player.weapon = null;
        player.armor = null;
        player.smugglingSkill = 0;
        player.jailedUntilDay = 0;
        player.horses = []; // Horses don't transfer through regency
        player.storageContainer = null; // Reset container since no horses to pull wagon

        // Gold based on regency outcome
        player.gold = Math.floor(rd.estateGold * threshold.goldPct);
        // Good Parent skill: +10% inherited gold and reputation
        if (rd.parentSkills && rd.parentSkills.good_parent) {
            player.gold = Math.floor(player.gold * 1.10);
        }

        // Buildings based on regency outcome
        if (threshold.buildingPct >= 1) {
            // Keep all buildings
        } else if (threshold.buildingPct > 0) {
            // Keep random fraction
            const rng = Engine.getRng();
            const keep = Math.ceil(player.buildings.length * threshold.buildingPct);
            if (rng) rng.shuffle(player.buildings);
            player.buildings = player.buildings.slice(0, keep);
        } else {
            player.buildings = [];
            player.employees = [];
        }

        // XP transfer
        const xpTransfer = Math.floor(player.xp / (XP_REWARDS.HEIR_TRANSFER_RATIO || 2));
        const prevGen = (player.achievementStats && player.achievementStats.generation) || 1;
        player.generation = prevGen + 1;
        if (player.achievementStats) player.achievementStats.generation = player.generation;
        player.xp = xpTransfer;
        player.totalXp = xpTransfer;
        player.level = 1;
        var dynastyBank3 = player.dynastySPBank || 0;
        player.dynastySPBank = 0;
        player.skills = { keen_eye: true };
        player.achievements = {};
        player.hunger = HUNGER_CONFIG.START;
        player.marketIntel = {};

        // Skill points: base + threshold bonus + spouse personality bonuses
        let bonusPoints = threshold.bonusSkillPoints;
        const sp = rd.spousePersonality || {};

        if (sp.intelligence >= 70) bonusPoints += 2;
        else if (sp.intelligence < 30) bonusPoints -= 1;
        if (sp.warmth >= 70) bonusPoints += 1;
        else if (sp.warmth < 30) bonusPoints -= 1;

        // Quirk heir effects
        const quirks = rd.spouseQuirks || [];
        for (const qId of quirks) {
            const qDef = (typeof SPOUSE_QUIRKS !== 'undefined') ? SPOUSE_QUIRKS.find(q => q.id === qId) : null;
            if (!qDef) continue;
            switch (qId) {
                // Positive quirk heir effects
                case 'bookworm': bonusPoints += 3; break;
                case 'merchant_family': bonusPoints += 2; break;
                case 'natural_leader': bonusPoints += 2; break;
                case 'animal_lover': bonusPoints += 1; break;
                case 'charming_smile': bonusPoints += 1; break;
                case 'silver_tongue': bonusPoints += 1; break;
                case 'musical': bonusPoints += 1; break;
                case 'patient': bonusPoints += 1; break;
                case 'quick_learner': bonusPoints += 2; break;
                // Negative quirk heir effects
                case 'secret_gambler': bonusPoints -= 1; break;
                case 'violent_temper': bonusPoints -= 1; break;
                case 'paranoid': bonusPoints -= 1; break;
                case 'lazy': bonusPoints -= 1; break;
                case 'hot_headed': bonusPoints -= 1; break;
                // Mixed
                case 'stubborn': bonusPoints += 1; break;
                case 'criminal_past': bonusPoints += 1; break;
            }
            // Track heir traits from quirks
            if (qDef.heirEffect && qDef.heirEffect !== 'No effect') {
                player.heirTraits.push(qId);
            }
        }

        player.skillPoints = Math.max(0, bonusPoints) + dynastyBank3;
        if (dynastyBank3 > 0) {
            Engine.logEvent('🏰 ' + player.fullName + ' inherited ' + dynastyBank3 + ' skill points from the dynasty bank!');
        }
        checkLevelUp();

        // Reputation
        for (const kId in player.reputation) {
            var repMult = threshold.repMult;
            if (rd.parentSkills && rd.parentSkills.good_parent) repMult *= 1.10;
            // Dynasty start: heirs begin with (parentRep - 50)/2 bonus above 50, max +25
            // This prevents heirs from starting with inflated reputation
            var _parentRepVal = (rd.reputationAtDeath[kId] || 50);
            var _heirBonus = Math.min(25, Math.max(0, (_parentRepVal - 50) / 2)) * repMult;
            player.reputation[kId] = Math.floor(50 + _heirBonus);
        }

        // Heir traits
        player.heirTraits = player.heirTraits || [];
        if (rd.regencyScore >= 80) {
            player.heirTraits.push('well_raised');
        }
        if (rd.regencyScore <= 19) {
            player.heirTraits.push('orphan');
        }

        // Noble blood quirk — heir starts one rank higher
        if (quirks.includes('noble_blood') && player.citizenshipKingdomId) {
            const currentRank = player.socialRank[player.citizenshipKingdomId] || 0;
            player.socialRank[player.citizenshipKingdomId] = Math.min(currentRank + 1, 3);
        }

        // Loyal heart quirk — +20 regency score bonus (already factored into score if present)

        // Thrifty quirk — heir starts with 10% more gold
        if (quirks.includes('thrifty')) {
            player.gold = Math.floor(player.gold * 1.10);
        }

        // Diplomatic quirk — +10 reputation
        if (quirks.includes('diplomatic')) {
            for (const kId in player.reputation) {
                player.reputation[kId] = Math.min(100, (player.reputation[kId] || 50) + 10);
            }
        }

        // Manipulative quirk — -10 starting relationships
        if (quirks.includes('manipulative')) {
            const people = Engine.getPeople(player.townId);
            if (people) {
                for (const p of people.slice(0, 10)) {
                    modifyRelationship(p.id, -10);
                }
            }
        }

        // Forgiving quirk — better starting NPC relationships
        if (quirks.includes('forgiving')) {
            const people = Engine.getPeople(player.townId);
            if (people) {
                for (const p of people.slice(0, 10)) {
                    modifyRelationship(p.id, 10);
                }
            }
        }

        // Devout quirk — higher reputation
        if (quirks.includes('devout')) {
            for (const kId in player.reputation) {
                player.reputation[kId] = Math.min(100, (player.reputation[kId] || 50) + 10);
            }
        }

        // Warmth effect on relationships
        if (sp.warmth >= 70) {
            // Start with some positive relationships
            const people = Engine.getPeople(player.townId);
            if (people) {
                for (const p of people.slice(0, 10)) {
                    modifyRelationship(p.id, 15);
                }
            }
        } else if (sp.warmth < 30) {
            player.relationships = {};
        }

        // Reset achievement stats
        player.achievementStats = {
            totalSells: {}, totalBuys: {}, giftsGiven: 0,
            smuggleSuccesses: 0, smuggleStreak: 0, smuggleGoldEarned: 0,
            bribesGiven: 0, seaVoyagesCompleted: 0,
            kingdomsTraded: {}, resourcesTraded: {},
            caravanDestinations: {}, dailyProfit: 0, dailyProfitPrevGold: 0,
            generation: prevGen + 1, wasExiled: false,
        };
        player._xpAccumulator = 0;
        player.warAllegiances = {};
        player.topMerchantDays = 0;
        player.victoriesAchieved = {};
        player.belowMarketSales = 0;
        player.smugglingTaxSaved = 0;
        player.revealedTraits = {};
        player.spouseRelHighDays = 0;
        player.dateProgress = {};
        player.investigatorCaught = {};
        player.weddingPlan = null;
        player.weddingMemory = null;
        player.spouseProdMod = 1.0;
        player.spouseCostMod = 1.0;
        player.spouseRepMod = 1.0;
        player.spouseHungerMod = 1.0;
        player.spouseLuckMod = 1.0;
        player.spouseProtectMod = 1.0;

        player.regencyMode = false;
        player.regencyData = null;

        // Rebuild familyMembers for the heir
        player.familyMembers = [];
        // Deceased parent (the previous player character)
        var _deadParentRole = (rd.deadPlayerSex === 'M') ? 'father' : 'mother';
        player.familyMembers.push({
            npcId: 'deceased_parent_' + (player.generation || 1),
            role: _deadParentRole,
            name: rd.deadPlayerName || 'Unknown'
        });
        // Regent (surviving parent/spouse)
        if (rd.spouseId) {
            var _regentNpc = Engine.findPerson(rd.spouseId);
            if (_regentNpc) {
                var _regentRole = (_regentNpc.sex === 'M') ? 'father' : 'mother';
                player.familyMembers.push({
                    npcId: _regentNpc.id,
                    role: _regentRole,
                    name: _regentNpc.firstName + ' ' + _regentNpc.lastName
                });
            }
        }
        // Siblings (other children of the deceased parent)
        var _siblingIds = rd.deadPlayerChildrenIds || [];
        for (var _si = 0; _si < _siblingIds.length; _si++) {
            if (_siblingIds[_si] === rd.heirId) continue; // skip self
            var _sib = Engine.findPerson(_siblingIds[_si]);
            if (_sib && _sib.alive) {
                player.familyMembers.push({
                    npcId: _sib.id,
                    role: _sib.sex === 'M' ? 'brother' : 'sister',
                    name: _sib.firstName + ' ' + _sib.lastName
                });
            }
        }
        // Previous generation becomes grandparents / great-grandparents
        var _prevFamily = rd.previousFamilyMembers || [];
        for (var _pf = 0; _pf < _prevFamily.length; _pf++) {
            var _fm = _prevFamily[_pf];
            var _newRole = _fm.role;
            if (_fm.role === 'father') _newRole = 'grandfather';
            else if (_fm.role === 'mother') _newRole = 'grandmother';
            else if (_fm.role === 'brother') _newRole = 'uncle';
            else if (_fm.role === 'sister') _newRole = 'aunt';
            else if (_fm.role === 'grandfather') _newRole = 'great-grandfather';
            else if (_fm.role === 'grandmother') _newRole = 'great-grandmother';
            else if (_fm.role === 'great-grandfather' || _fm.role === 'great-grandmother') continue;
            else if (_fm.role === 'uncle' || _fm.role === 'aunt') continue;
            else continue;
            player.familyMembers.push({
                npcId: _fm.npcId,
                role: _newRole,
                name: _fm.name
            });
        }

        // Remove self-relationship (heir had relationship with previous player)
        if (rd.heirId && player.relationships && player.relationships[rd.heirId]) {
            delete player.relationships[rd.heirId];
        }

        Engine.logEvent(`${player.fullName} has come of age and inherits the family legacy! (${threshold.label})`);
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`👑 ${player.fullName} comes of age! Regency outcome: ${threshold.label}`, 'success');
        }
    }
    // ========================================================
    // Register all functions on the Player namespace
    // ========================================================
    Player.canMarry = canMarry;
    Player.getMarriageCandidates = getMarriageCandidates;
    Player.marry = marry;
    Player.setWeddingChoice = setWeddingChoice;
    Player.getWeddingPlan = getWeddingPlan;
    Player.finalizeWedding = finalizeWedding;
    Player.tickWeddingPlan = tickWeddingPlan;
    Player.talkToSpouse = talkToSpouse;
    Player.arrangeChildMarriage = arrangeChildMarriage;
    Player.getEligibleMarriageCandidates = getEligibleMarriageCandidates;
    Player.respondToMarriageProposal = respondToMarriageProposal;
    Player.checkEliteMarriageProposals = checkEliteMarriageProposals;
    Player.getMarriageProposals = getMarriageProposals;
    Player.getAllianceBenefits = getAllianceBenefits;
    Player.tickPlayerChildren = tickPlayerChildren;
    Player.getPersonalityImpression = getPersonalityImpression;
    Player.getRevealedInfo = getRevealedInfo;
    Player.revealTrait = revealTrait;
    Player.goOnDate = goOnDate;
    Player.spendTimeWithSpouse = spendTimeWithSpouse;
    Player.hireInvestigator = hireInvestigator;
    Player.askTavernAbout = askTavernAbout;
    Player.observePerson = observePerson;
    Player.askFriendAbout = askFriendAbout;
    Player.tickSpouseEffects = tickSpouseEffects;
    Player.tickSpouseRelationship = tickSpouseRelationship;
    Player.initSpouseAI = initSpouseAI;
    Player.tickSpouseAI = tickSpouseAI;
    Player.getSpouseStatus = getSpouseStatus;
    Player.confirmChildName = confirmChildName;
    Player.tryForBaby = tryForBaby;
    Player.getTryForBabyChance = getTryForBabyChance;
    Player.askSpouseToTrade = askSpouseToTrade;
    Player.askSpouseToManage = askSpouseToManage;
    Player.askSpouseToWork = askSpouseToWork;
    Player.askSpouseToStay = askSpouseToStay;
    Player.askSpouseToTravel = askSpouseToTravel;
    Player.askSpouseForMoney = askSpouseForMoney;
    Player.askSpouseToGatherIntel = askSpouseToGatherIntel;
    Player.askSpouseToHireWorkers = askSpouseToHireWorkers;
    Player.askSpouseToNegotiate = askSpouseToNegotiate;
    Player.spouseSpendTime = spouseSpendTime;
    Player.giveSpouseGold = giveSpouseGold;
    Player.askSpouseToGuardCaravan = askSpouseToGuardCaravan;
    Player.calculateRegencyScore = calculateRegencyScore;
    Player.getRegencyThreshold = getRegencyThreshold;
    Player.enterRegency = enterRegency;
    Player.tickRegency = tickRegency;
    Player.endRegency = endRegency;

})(window.Player);
