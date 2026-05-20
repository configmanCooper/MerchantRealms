// ============================================================
// Merchant Realms — Player Childcare Module
// v9p33river358: Player children under 12 need supervision.
// Care providers in priority order:
//   1. Spouse (unless they have the `negligent_parent` quirk)
//   2. Active nanny (player._activeNanny, 100g/week, withdrawn
//      automatically — leaves if player cannot pay)
//   3. Family-care arrangement (player._familyChildArrangement,
//      30 days, requires relationship >= 60 with the caretaker)
//   4. Player themselves IF they are in the same town as the kids
//      OR are escorting the kids (player._childrenTravelWith == true)
// If none of the above for a sustained period, kids may die at a
// low daily rate. The system emits notifications as conditions
// degrade.
//
// Public API:
//   Player.getChildcareStatus()
//   Player.hireNanny()
//   Player.dismissNanny()
//   Player.toggleChildrenTravelWith()
//   Player.askFamilyToCareForKids(npcId)
//   Player.pickupKidsFromFamily()
//   Player.tickChildcare()
// ============================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error('Player must be loaded before player_childcare.js');

    var player;
    function _sync() { player = Player.state; }
    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }
    function _findPerson(id) { try { return Engine.findPerson ? Engine.findPerson(id) : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _toast(msg, type) { try { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type || 'info'); } catch(e) {} }
    function _logEvent(msg, data, cat) { try { Engine.logEvent && Engine.logEvent(msg, data || null, cat || 'my_actions'); } catch(e) {} }
    function _hasQuirk(p, q) {
        if (!p || !p.quirks) return false;
        return p.quirks.indexOf(q) >= 0;
    }

    var DEPENDENT_AGE = 12;
    var NANNY_WEEKLY_COST = 100;
    var NANNY_DAILY_COST = NANNY_WEEKLY_COST / 7;
    var FAMILY_ARRANGEMENT_DAYS = 30;
    var FAMILY_ARRANGEMENT_MIN_REL = 60;
    var FAMILY_DEGRADE_REL_THRESHOLD = 30;
    var KID_DEATH_CHANCE_PER_DAY = 0.02; // when fully neglected

    function _ensureState() {
        _sync();
        if (player._activeNanny === undefined) player._activeNanny = null;
        if (player._familyChildArrangement === undefined) player._familyChildArrangement = null;
        if (player._childrenTravelWith === undefined) player._childrenTravelWith = false;
        if (player._lastNannyChargeDay == null) player._lastNannyChargeDay = 0;
        if (player._kidsAtRiskSince === undefined) player._kidsAtRiskSince = null;
    }

    function _livingDependentChildren() {
        _ensureState();
        var out = [];
        if (!player.childrenIds) return out;
        for (var i = 0; i < player.childrenIds.length; i++) {
            var c = _findPerson(player.childrenIds[i]);
            if (!c || c.alive === false) continue;
            if ((c.age || 0) >= DEPENDENT_AGE) continue;
            out.push(c);
        }
        return out;
    }

    // ──────────────────────────────────────────────────────────
    // Caregiver detection
    // ──────────────────────────────────────────────────────────
    function _spouseCaregiver() {
        if (!player.spouseId) return null;
        var sp = _findPerson(player.spouseId);
        if (!sp || sp.alive === false) return null;
        // Negligent spouses won't take care of kids
        if (_hasQuirk(sp, 'negligent_parent')) return null;
        // Spouse must be in the same town as the kids (i.e., where the
        // player lives). If kids are with the player and spouse is
        // elsewhere, spouse isn't covering them.
        // Use player.townId as the canonical "home" town.
        // If kids are with a family member elsewhere, spouse isn't covering them
        var fArr = player._familyChildArrangement;
        if (fArr && fArr.npcId && fArr.townId && fArr.townId !== sp.townId) return null;
        if (player.townId && sp.townId && sp.townId === player.townId) return sp;
        return null;
    }

    function _nannyCaregiver() {
        if (!player._activeNanny) return null;
        // Nanny doesn't cover kids who are with family elsewhere
        var fArr = player._familyChildArrangement;
        if (fArr && fArr.npcId && fArr.townId && !fArr.abandoned) return null;
        var n = player._activeNanny;
        if (!n.townId || !player.townId) return null;
        if (n.townId !== player.townId) return null;
        return n;
    }

    function _familyCaregiver() {
        var arr = player._familyChildArrangement;
        if (!arr) return null;
        var day = _getDay();
        if (arr.endDay && day > arr.endDay + 60) return null; // long-gone arrangement
        var fam = _findPerson(arr.npcId);
        if (!fam || fam.alive === false) return null;
        // Read current relationship
        var rel = 50;
        try { var _r = Player.getRelationship && Player.getRelationship(arr.npcId); rel = _r && _r.level !== undefined ? _r.level : 50; } catch(e) {}
        if (rel < FAMILY_DEGRADE_REL_THRESHOLD) return null;
        return fam;
    }

    function _playerSelfCovers() {
        // Player covers if children are in the same town as them, OR
        // children are travelling with them.
        if (player._childrenTravelWith) return true;
        // If kids' townId matches player.townId
        var kids = _livingDependentChildren();
        if (!kids.length) return true; // nothing to cover
        for (var i = 0; i < kids.length; i++) {
            if (kids[i].townId !== player.townId) return false;
        }
        return true;
    }

    function getChildcareStatus() {
        _ensureState();
        var kids = _livingDependentChildren();
        if (!kids.length) return { hasKids: false };
        var spouse = _spouseCaregiver();
        var nanny = _nannyCaregiver();
        var family = _familyCaregiver();
        var playerHere = _playerSelfCovers();
        var anyCare = !!(spouse || nanny || family || playerHere);
        var primary = spouse ? 'spouse' : nanny ? 'nanny' : family ? 'family' : (playerHere ? 'player' : 'none');
        return {
            hasKids: true,
            count: kids.length,
            kidNames: kids.map(function(k) { return ((k.firstName||'') + ' ' + (k.lastName||'')).trim(); }),
            primaryCaregiver: primary,
            spouse: spouse ? ((spouse.firstName||'') + ' ' + (spouse.lastName||'')).trim() : null,
            nanny: nanny ? nanny.name : null,
            family: family ? ((family.firstName||'') + ' ' + (family.lastName||'')).trim() : null,
            arrangement: player._familyChildArrangement || null,
            kidsAtRisk: !anyCare
        };
    }

    function hireNanny() {
        _ensureState();
        if (player._activeNanny) return { success: false, message: 'You already have a nanny.' };
        var town = _findTown(player.townId);
        if (!town) return { success: false, message: 'You must be in a town to hire a nanny.' };
        if ((player.gold || 0) < NANNY_WEEKLY_COST) {
            return { success: false, message: 'You need at least ' + NANNY_WEEKLY_COST + 'g for the first week.' };
        }
        // Charge the first week up front
        player.gold = Math.max(0, (player.gold || 0) - NANNY_WEEKLY_COST);
        player._activeNanny = {
            name: 'Nanny ' + (town.name ? town.name + 'er' : ''),
            townId: player.townId,
            hiredDay: _getDay()
        };
        player._lastNannyChargeDay = _getDay();
        _logEvent('👶 Hired a nanny in ' + town.name + ' for ' + NANNY_WEEKLY_COST + 'g/week.', null, 'my_actions');
        _toast('Nanny hired in ' + town.name + '.', 'success');
        return { success: true, message: 'Nanny hired.' };
    }

    function dismissNanny() {
        _ensureState();
        if (!player._activeNanny) return { success: false, message: 'You have no nanny.' };
        player._activeNanny = null;
        _logEvent('Dismissed the nanny.', null, 'my_actions');
        return { success: true, message: 'Nanny dismissed.' };
    }

    function toggleChildrenTravelWith() {
        _ensureState();
        // Can't toggle travel if kids are with family
        var fArr = player._familyChildArrangement;
        if (fArr && fArr.npcId && !fArr.abandoned) {
            return { success: false, message: 'Pick up your children from ' + (fArr.npcName || 'family') + ' first.' };
        }
        player._childrenTravelWith = !player._childrenTravelWith;
        // Move kids' townId to follow the player when toggled on
        if (player._childrenTravelWith) {
            var kids = _livingDependentChildren();
            for (var i = 0; i < kids.length; i++) {
                kids[i].townId = player.townId;
            }
            _toast('Your children will now travel with you.', 'info');
        } else {
            _toast('Your children will remain wherever they are now.', 'info');
        }
        return { success: true, travelWith: player._childrenTravelWith };
    }

    function askFamilyToCareForKids(npcId) {
        _ensureState();
        var kids = _livingDependentChildren();
        if (!kids.length) return { success: false, message: 'No dependent children.' };
        if (player._familyChildArrangement) return { success: false, message: 'You already have a family arrangement.' };
        var fam = _findPerson(npcId);
        if (!fam || fam.alive === false) return { success: false, message: 'Family member not available.' };
        if ((fam.age || 0) < 18) return { success: false, message: 'This person is too young.' };
        // Must be actual family
        var isFamily = false;
        if (player.spouseId === npcId) isFamily = true;
        if (player.parentIds && player.parentIds.indexOf(npcId) >= 0) isFamily = true;
        if (player.siblingIds && player.siblingIds.indexOf(npcId) >= 0) isFamily = true;
        if (player.childrenIds && player.childrenIds.indexOf(npcId) >= 0) {
            // Adult player child can take younger siblings
            if ((fam.age || 0) >= 18) isFamily = true;
        }
        if (!isFamily) return { success: false, message: 'They are not close enough family to ask.' };
        var rel = 50;
        try { var _ar = Player.getRelationship(npcId); rel = _ar && _ar.level !== undefined ? _ar.level : 50; } catch(e) {}
        if (rel < FAMILY_ARRANGEMENT_MIN_REL) {
            return { success: false, message: 'Relationship too low (need ' + FAMILY_ARRANGEMENT_MIN_REL + '+).' };
        }
        var day = _getDay();
        player._childrenTravelWith = false;
        player._familyChildArrangement = {
            npcId: npcId,
            npcName: ((fam.firstName||'') + ' ' + (fam.lastName||'')).trim(),
            townId: fam.townId,
            startDay: day,
            endDay: day + FAMILY_ARRANGEMENT_DAYS,
            pickupReminderSent: false,
            degradeStartDay: null
        };
        // Move kids to family member's town
        var kk = _livingDependentChildren();
        for (var i = 0; i < kk.length; i++) {
            kk[i].townId = fam.townId;
        }
        try { Player.modifyRelationship(npcId, -3); } catch(e) {} // small "owe one" decrement
        _logEvent('👨‍👩‍👧 Your children will stay with ' + player._familyChildArrangement.npcName + ' for 30 days.', null, 'my_actions');
        _toast('Children sent to stay with ' + player._familyChildArrangement.npcName + '.', 'success');
        return { success: true };
    }

    function pickupKidsFromFamily() {
        _ensureState();
        var arr = player._familyChildArrangement;
        if (!arr) return { success: false, message: 'No active family arrangement.' };
        if (player.townId !== arr.townId) {
            var t = _findTown(arr.townId);
            return { success: false, message: 'You must travel to ' + (t ? t.name : 'their town') + ' to pick up the children.' };
        }
        // Bring kids back to player's town
        var kk = _livingDependentChildren();
        for (var i = 0; i < kk.length; i++) {
            kk[i].townId = player.townId;
        }
        player._familyChildArrangement = null;
        // Recover the small rel decrement plus a bit
        try { Player.modifyRelationship(arr.npcId, 4); } catch(e) {}
        _logEvent('Picked up the children from ' + arr.npcName + '.', null, 'my_actions');
        _toast('You picked up your children.', 'success');
        return { success: true };
    }

    // ──────────────────────────────────────────────────────────
    // Daily tick
    // ──────────────────────────────────────────────────────────
    function tickChildcare() {
        _ensureState();
        var day = _getDay();
        var kids = _livingDependentChildren();
        if (!kids.length) return;

        // Nanny: weekly auto-charge; if cannot pay, nanny leaves
        if (player._activeNanny) {
            // v9p33river366: a nanny hired on day 0 should not be charged again on day 1.
            if (player._lastNannyChargeDay == null || day - player._lastNannyChargeDay >= 7) {
                if ((player.gold || 0) >= NANNY_WEEKLY_COST) {
                    player.gold = Math.max(0, (player.gold || 0) - NANNY_WEEKLY_COST);
                    player._lastNannyChargeDay = day;
                } else {
                    // Nanny leaves
                    var nName = player._activeNanny.name || 'The nanny';
                    player._activeNanny = null;
                    _logEvent('👶 ' + nName + ' has left — you could not afford their wages.', null, 'critical');
                    _toast(nName + ' left because you could not pay. Your children are unattended!', 'warning');
                }
            }
        }

        // Family arrangement bookkeeping
        var arr = player._familyChildArrangement;
        if (arr) {
            // Reminder when 30 days reach
            if (!arr.pickupReminderSent && day >= arr.endDay) {
                arr.pickupReminderSent = true;
                _logEvent('👨‍👩‍👧 Your 30 days with ' + arr.npcName + ' are up — come pick up the children.', null, 'critical');
                _toast(arr.npcName + ' is expecting you to pick up the children.', 'warning');
            }
            // After endDay, relationship decays 1/day
            if (day > arr.endDay) {
                try { Player.modifyRelationship(arr.npcId, -1); } catch(e) {}
                if (!arr.degradeStartDay) arr.degradeStartDay = day;
                // If relationship has fallen below threshold, family stops
                var rel = 50;
                try { var _dr = Player.getRelationship(arr.npcId); rel = _dr && _dr.level !== undefined ? _dr.level : 50; } catch(e) {}
                if (rel < FAMILY_DEGRADE_REL_THRESHOLD) {
                    if (!arr.abandoned) {
                        arr.abandoned = true;
                        _logEvent('👨‍👩‍👧 ' + arr.npcName + ' refuses to watch your children any longer. They are now unattended!', null, 'critical');
                        _toast(arr.npcName + ' has stopped watching your children!', 'warning');
                    }
                }
            }
        }

        // Determine current caregiver
        var spouse = _spouseCaregiver();
        var nanny = _nannyCaregiver();
        var family = (arr && !arr.abandoned) ? _familyCaregiver() : null;
        var playerHere = _playerSelfCovers();
        var anyCare = !!(spouse || nanny || family || playerHere);

        if (anyCare) {
            // Reset at-risk timer
            player._kidsAtRiskSince = null;
            return;
        }

        // Kids are at risk
        // v9p33river366: preserve a day-0 risk timestamp so abandonment time accumulates correctly.
        if (player._kidsAtRiskSince == null) {
            player._kidsAtRiskSince = day;
            _logEvent('⚠️ Your children are UNATTENDED. Get to them or arrange care.', null, 'critical');
            _toast('Your children are unattended!', 'warning');
        }

        // Daily death roll once kids are clearly abandoned (>3 days)
        var atRiskDays = day - player._kidsAtRiskSince;
        if (atRiskDays < 3) return;
        var deathRoll = Math.random();
        if (deathRoll < KID_DEATH_CHANCE_PER_DAY * Math.min(5, Math.max(1, atRiskDays - 2))) {
            // Pick one child to lose
            var unfortunate = kids[Math.floor(Math.random() * kids.length)];
            try { Engine.killPerson && Engine.killPerson(unfortunate, 'neglect'); } catch(e) {}
            _logEvent('💀 Your unattended child ' + (unfortunate.firstName||'') + ' has died.', null, 'critical');
            _toast('💀 Your child ' + (unfortunate.firstName||'') + ' died of neglect.', 'warning');
        }
    }

    Player.getChildcareStatus = getChildcareStatus;
    Player.hireNanny = hireNanny;
    Player.dismissNanny = dismissNanny;
    Player.toggleChildrenTravelWith = toggleChildrenTravelWith;
    Player.askFamilyToCareForKids = askFamilyToCareForKids;
    Player.pickupKidsFromFamily = pickupKidsFromFamily;
    Player.tickChildcare = tickChildcare;
})(window.Player);
