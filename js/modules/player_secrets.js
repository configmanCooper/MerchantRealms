// ──────────────────────────────────────────────────────────
// player_secrets.js — NPC secrets mechanic
// v9p33river360
//
// NPCs with 80+ relationship may reveal secrets during
// interactions (2% base). Lovers (60+ rel, 3+ courtship
// actions) reveal at double rate. Secrets can be kept
// (relationship boost) or shared with others (complex
// social effects). Noble / king secrets have unique
// political consequences.
//
// Exports:
//   Player.maybeDiscoverSecret(personId) → string|null
//   Player.getSecretsForNPC(personId) → array
//   Player.getAllKnownSecrets() → array
//   Player.hasSecretsFor(personId) → bool
//   Player.hasAnySecrets() → bool
//   Player.keepSecret(personId, secretIdx) → result
//   Player.shareSecret(listenerPersonId, secretIdx) → result
// ──────────────────────────────────────────────────────────
(function(Player) {
    'use strict';
    if (!Player) return;

    var player;
    function _ensureState() { player = Player.state; }
    function _getDay() { try { return Engine.getDay(); } catch(e) { return 0; } }
    function _getWorld() { try { return Engine.getWorld(); } catch(e) { return null; } }
    function _findPerson(id) { try { return Engine.findPerson(id); } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown(id); } catch(e) { return null; } }
    function _logEvent(msg, d, c) { try { Engine.logEvent(msg, d, c); } catch(e) {} }
    function _toast(msg, type) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type); }
    function _findKingdom(id) { try { return Engine.getKingdom(id); } catch(e) { return null; } }

    // ── Constants ──────────────────────────────────────────
    var DISCOVER_BASE_CHANCE = 0.02;
    var DISCOVER_LOVER_MULT = 2.0;
    var COOLDOWN_DAYS = 30;
    var MAX_SECRETS_PER_NPC = 3;
    var LOVER_REL_THRESHOLD = 60;
    var BASE_REL_THRESHOLD = 80;
    var LOVER_DATE_PROGRESS_THRESHOLD = 50;
    var KEEP_REL_BOOST = 4;
    var SHARE_REL_LISTENER = 8;
    var SHARE_REL_OWNER = -15;

    // ── Secret templates ──────────────────────────────────
    // {name} {town} {kingdom} are replaced at discovery time.
    // category: normal | elite_merchant | noble | king
    // type: personal | criminal | financial | conspiracy | political
    // uniqueEffect: null or string id for special share consequences
    var NORMAL_SECRETS = [
        { id: 'debt_hidden', type: 'financial', text: '{name} confided, "I owe a fortune to dangerous people. If word got out, I would be finished."', keepRel: 4, shareL: 8, shareO: -15 },
        { id: 'affair_past', type: 'personal', text: '{name} admitted, "Years ago I had a secret affair. My family would disown me if they knew."', keepRel: 5, shareL: 10, shareO: -20 },
        { id: 'theft_minor', type: 'criminal', text: '{name} whispered, "I once stole goods from a merchant in {town}. Nobody ever found out."', keepRel: 4, shareL: 8, shareO: -15 },
        { id: 'lie_about_past', type: 'personal', text: '{name} revealed, "I am not really from {town}. I fled my homeland under a different name."', keepRel: 5, shareL: 10, shareO: -18 },
        { id: 'gambling_problem', type: 'personal', text: '{name} sighed, "I have a terrible gambling habit. I have lost more gold than I care to admit."', keepRel: 3, shareL: 7, shareO: -12 },
        { id: 'secret_child', type: 'personal', text: '{name} confessed, "I have a child in another town that no one here knows about."', keepRel: 5, shareL: 12, shareO: -25 },
        { id: 'bribe_guard', type: 'criminal', text: '{name} said quietly, "I bribed a guard in {town} to look the other way while I did something I should not have."', keepRel: 4, shareL: 8, shareO: -15 },
        { id: 'fake_skills', type: 'personal', text: '{name} admitted, "My skills are not what I claim. I have been bluffing my way through for years."', keepRel: 3, shareL: 8, shareO: -12 },
        { id: 'witnessed_crime', type: 'criminal', text: '{name} lowered their voice, "I witnessed a murder in {town} and said nothing. I was too afraid."', keepRel: 5, shareL: 10, shareO: -18 },
        { id: 'hidden_gold', type: 'financial', text: '{name} told you, "I have gold buried outside {town}. A fortune that nobody knows about."', keepRel: 4, shareL: 10, shareO: -15 },
        { id: 'disloyal', type: 'political', text: '{name} whispered, "I do not truly support {kingdom}. If a better kingdom offered me a place, I would leave."', keepRel: 4, shareL: 10, shareO: -20 },
        { id: 'family_shame', type: 'personal', text: '{name} confided, "My family was once caught stealing. We changed our name and moved to {town} to escape the shame."', keepRel: 4, shareL: 8, shareO: -15 },
        { id: 'craft_secret', type: 'financial', text: '{name} revealed, "I know a secret recipe that would ruin my competitor if I shared it."', keepRel: 3, shareL: 8, shareO: -12 },
        { id: 'illness_hidden', type: 'personal', text: '{name} whispered, "I have a condition I hide from everyone. If they knew, they would treat me differently."', keepRel: 5, shareL: 8, shareO: -15 },
        { id: 'false_identity', type: 'criminal', text: '{name} confessed, "I am living under a false name. My real identity would get me arrested."', keepRel: 5, shareL: 12, shareO: -25, uniqueEffect: 'may_arrest' },
        { id: 'tax_evasion', type: 'criminal', text: '{name} admitted, "I have been hiding gold from the tax collectors for years. I owe the crown a fortune."', keepRel: 4, shareL: 10, shareO: -18 },
        { id: 'smuggling_route', type: 'criminal', text: '{name} leaned close, "I know a smuggling route that bypasses the kingdom checkpoints entirely."', keepRel: 4, shareL: 10, shareO: -15 },
        { id: 'forbidden_love', type: 'personal', text: '{name} blushed, "I am in love with someone I should not be. If anyone found out, it would be a scandal."', keepRel: 5, shareL: 10, shareO: -20 },
        { id: 'paid_spy', type: 'conspiracy', text: '{name} revealed, "I was once paid to spy on someone important in {town}. I still have the information."', keepRel: 5, shareL: 12, shareO: -20 },
        { id: 'arson', type: 'criminal', text: '{name} confessed, "I set fire to a building in {town} years ago. It was ruled an accident, but it was me."', keepRel: 4, shareL: 10, shareO: -20, uniqueEffect: 'may_arrest' },
        { id: 'theft_employer', type: 'criminal', text: '{name} whispered, "I have been skimming gold from my employer for months. They have no idea."', keepRel: 4, shareL: 10, shareO: -18 },
        { id: 'debt_collector', type: 'criminal', text: '{name} admitted, "I have threatened people for gold. I am not proud of it, but I needed the money."', keepRel: 3, shareL: 8, shareO: -15 },
        { id: 'inheritance_fraud', type: 'financial', text: '{name} confided, "I cheated my own siblings out of our inheritance. They still do not know."', keepRel: 4, shareL: 10, shareO: -20 },
        { id: 'false_testimony', type: 'criminal', text: '{name} said quietly, "I lied during a trial. An innocent person suffered because of my words."', keepRel: 5, shareL: 12, shareO: -22, uniqueEffect: 'may_arrest' },
        { id: 'hidden_talent', type: 'personal', text: '{name} revealed, "I have a talent that nobody knows about. I keep it hidden because people would expect too much of me."', keepRel: 3, shareL: 6, shareO: -10 },
        { id: 'abandoned_family', type: 'personal', text: '{name} said sadly, "I left a family behind in another land. They think I am dead."', keepRel: 5, shareL: 10, shareO: -18 },
        { id: 'knows_poison', type: 'criminal', text: '{name} whispered, "I know how to make deadly poisons. I learned from someone who should not have taught me."', keepRel: 4, shareL: 10, shareO: -18 },
        { id: 'deserted_army', type: 'political', text: '{name} confessed, "I deserted from military service in {kingdom}. If the crown found out, I would be hanged."', keepRel: 5, shareL: 12, shareO: -22, uniqueEffect: 'may_arrest' },
        { id: 'blackmail_victim', type: 'conspiracy', text: '{name} trembled, "Someone is blackmailing me. They know something terrible about my past."', keepRel: 5, shareL: 8, shareO: -15 },
        { id: 'stolen_heirloom', type: 'criminal', text: '{name} admitted, "I stole a family heirloom from someone in {town}. It is the most valuable thing I own."', keepRel: 4, shareL: 9, shareO: -16 }
    ];

    var EM_SECRETS = [
        { id: 'em_price_fixing', type: 'criminal', text: '{name} confided, "Several of us merchants collude to fix prices in {town}. We control the market."', keepRel: 5, shareL: 12, shareO: -20, uniqueEffect: 'market_scandal' },
        { id: 'em_smuggling', type: 'criminal', text: '{name} revealed, "I run a smuggling operation through {town}. The profits are enormous."', keepRel: 5, shareL: 12, shareO: -22, uniqueEffect: 'may_arrest' },
        { id: 'em_counterfeit', type: 'criminal', text: '{name} whispered, "Some of my goods are counterfeits sold as genuine. My customers have no idea."', keepRel: 4, shareL: 10, shareO: -20 },
        { id: 'em_bribery', type: 'criminal', text: '{name} admitted, "I bribe officials in {kingdom} for trade advantages. It costs a fortune but is worth every coin."', keepRel: 5, shareL: 12, shareO: -22 },
        { id: 'em_tax_fraud', type: 'financial', text: '{name} confessed, "I underreport my earnings by half. The crown has no idea how wealthy I truly am."', keepRel: 4, shareL: 10, shareO: -18, uniqueEffect: 'may_fine' },
        { id: 'em_spy_network', type: 'conspiracy', text: '{name} leaned in, "I pay spies inside my competitors businesses. I know every deal they make before they make it."', keepRel: 5, shareL: 12, shareO: -20 },
        { id: 'em_stolen_goods', type: 'criminal', text: '{name} said quietly, "A good portion of my inventory is stolen. I buy from thieves at a fraction of the cost."', keepRel: 4, shareL: 10, shareO: -18, uniqueEffect: 'may_arrest' },
        { id: 'em_monopoly', type: 'financial', text: '{name} whispered, "I am systematically buying out all competition for {good}. Soon I will control the entire supply."', keepRel: 4, shareL: 12, shareO: -18, uniqueEffect: 'market_scandal' },
        { id: 'em_noble_debt', type: 'financial', text: '{name} revealed, "A powerful noble owes me a fortune. I hold their debt like a leash."', keepRel: 5, shareL: 14, shareO: -22 },
        { id: 'em_enemy_trade', type: 'political', text: '{name} confided, "I secretly trade with enemy kingdoms through intermediaries. The profits are too good to ignore."', keepRel: 5, shareL: 14, shareO: -25, uniqueEffect: 'treason_accusation' },
        { id: 'em_forced_labor', type: 'criminal', text: '{name} admitted, "Some of my workers are not free. I keep them in debt so they can never leave."', keepRel: 5, shareL: 14, shareO: -25, uniqueEffect: 'reputation_scandal' },
        { id: 'em_royal_bribe', type: 'political', text: '{name} whispered, "I have paid off members of the royal court in {kingdom}. They do my bidding."', keepRel: 5, shareL: 15, shareO: -25, uniqueEffect: 'court_scandal' }
    ];

    var NOBLE_SECRETS = [
        { id: 'nb_illegitimate', type: 'personal', text: '{name} confessed, "I have a bastard child hidden away. If the court found out, my reputation would be destroyed."', keepRel: 6, shareL: 14, shareO: -25 },
        { id: 'nb_embezzle', type: 'criminal', text: '{name} admitted, "I have been siphoning gold from the kingdom treasury for years. The king trusts me completely."', keepRel: 6, shareL: 15, shareO: -30, uniqueEffect: 'king_punish' },
        { id: 'nb_secret_alliance', type: 'conspiracy', text: '{name} revealed, "I have a secret pact with nobles in an enemy kingdom. If war comes, I know which side I will be on."', keepRel: 6, shareL: 15, shareO: -30, uniqueEffect: 'treason_accusation' },
        { id: 'nb_assassination_plot', type: 'conspiracy', text: '{name} whispered, "I know about a plot to assassinate a prominent figure in {kingdom}. I have said nothing."', keepRel: 7, shareL: 15, shareO: -28, uniqueEffect: 'king_punish' },
        { id: 'nb_coup_thoughts', type: 'conspiracy', text: '{name} said carefully, "The king is weak. I have considered what it would take to seize the throne myself."', keepRel: 7, shareL: 18, shareO: -30, uniqueEffect: 'king_punish' },
        { id: 'nb_bribe_king', type: 'political', text: '{name} confided, "I have bribed the king directly for favors. We have an arrangement that benefits us both."', keepRel: 6, shareL: 14, shareO: -25 },
        { id: 'nb_murder_covered', type: 'criminal', text: '{name} trembled, "I covered up a murder. The victim was someone who threatened to expose my family."', keepRel: 7, shareL: 15, shareO: -30, uniqueEffect: 'may_arrest' },
        { id: 'nb_treason_letters', type: 'conspiracy', text: '{name} revealed, "I correspond secretly with enemy nobles. We exchange intelligence about our kingdoms."', keepRel: 6, shareL: 15, shareO: -28, uniqueEffect: 'treason_accusation' },
        { id: 'nb_rigged_tourney', type: 'criminal', text: '{name} laughed, "I rigged the last tournament. Paid the fighters to throw their matches."', keepRel: 4, shareL: 10, shareO: -18 },
        { id: 'nb_false_lineage', type: 'political', text: '{name} confessed, "My noble bloodline is fabricated. My grandfather forged the documents."', keepRel: 7, shareL: 18, shareO: -30, uniqueEffect: 'strip_title' },
        { id: 'nb_overtax', type: 'criminal', text: '{name} admitted, "I overtax my subjects and pocket the difference. They suffer while I prosper."', keepRel: 5, shareL: 12, shareO: -22, uniqueEffect: 'reputation_scandal' },
        { id: 'nb_poison_plot', type: 'conspiracy', text: '{name} whispered, "I have acquired poison. There is someone I need removed, and I am running out of patience."', keepRel: 7, shareL: 15, shareO: -28, uniqueEffect: 'may_arrest' },
        { id: 'nb_private_army', type: 'conspiracy', text: '{name} revealed, "I am secretly building a private military force. When the time comes, I will be ready."', keepRel: 7, shareL: 18, shareO: -30, uniqueEffect: 'king_punish' },
        { id: 'nb_lover_commoner', type: 'personal', text: '{name} blushed, "I am in love with a commoner. If the court knew, I would be the laughingstock of {kingdom}."', keepRel: 5, shareL: 10, shareO: -20 },
        { id: 'nb_blackmail', type: 'conspiracy', text: '{name} confided, "I am blackmailing another noble. I have evidence of their crimes, and they pay me to stay silent."', keepRel: 6, shareL: 14, shareO: -25 },
        { id: 'nb_stolen_title', type: 'political', text: '{name} admitted, "I obtained my title through fraud and bribery. The rightful heir was pushed aside."', keepRel: 7, shareL: 18, shareO: -30, uniqueEffect: 'strip_title' },
        { id: 'nb_spy_enemy', type: 'conspiracy', text: '{name} trembled, "I have been passing military information to an enemy kingdom. They pay me handsomely."', keepRel: 7, shareL: 18, shareO: -30, uniqueEffect: 'treason_accusation' },
        { id: 'nb_heresy', type: 'personal', text: '{name} whispered, "I follow forbidden beliefs in secret. The priests would have me burned if they knew."', keepRel: 5, shareL: 10, shareO: -18 },
        { id: 'nb_hoarding_food', type: 'criminal', text: '{name} admitted, "I am hoarding food while the people go hungry. I profit from their desperation."', keepRel: 5, shareL: 14, shareO: -25, uniqueEffect: 'reputation_scandal' },
        { id: 'nb_debt_merchant', type: 'financial', text: '{name} confessed, "I owe an enormous debt to an elite merchant. They practically own me."', keepRel: 5, shareL: 12, shareO: -20 },
        { id: 'nb_affair_royal', type: 'personal', text: '{name} whispered, "I had an affair with someone in the royal family. It would tear the court apart if it came to light."', keepRel: 7, shareL: 18, shareO: -28, uniqueEffect: 'court_scandal' },
        { id: 'nb_land_theft', type: 'criminal', text: '{name} admitted, "I seized land through forged documents. The original owners were driven out."', keepRel: 5, shareL: 12, shareO: -22, uniqueEffect: 'may_arrest' },
        { id: 'nb_corrupt_judge', type: 'conspiracy', text: '{name} revealed, "I have bribed judges to imprison my rivals. Justice in {kingdom} is a farce."', keepRel: 6, shareL: 14, shareO: -25, uniqueEffect: 'king_punish' },
        { id: 'nb_hidden_wealth', type: 'financial', text: '{name} confided, "I have hidden wealth far beyond what I declare. Enough to buy a small kingdom."', keepRel: 5, shareL: 12, shareO: -18 }
    ];

    var KING_SECRETS = [
        { id: 'king_murdered', type: 'conspiracy', text: '{name} whispered, "My predecessor did not die of natural causes. I made sure the throne was empty for me."', keepRel: 8, shareL: 20, shareO: -30, uniqueEffect: 'revolt_seed' },
        { id: 'king_embezzle', type: 'criminal', text: '{name} admitted, "I divert treasury funds for my own pleasures. The kingdom suffers while I indulge."', keepRel: 7, shareL: 18, shareO: -28, uniqueEffect: 'revolt_seed' },
        { id: 'king_enemy_deal', type: 'conspiracy', text: '{name} revealed, "I have a secret agreement with an enemy kingdom. We profit while our people bleed."', keepRel: 8, shareL: 20, shareO: -30, uniqueEffect: 'revolt_seed' },
        { id: 'king_illegitimate', type: 'political', text: '{name} confessed, "My claim to the throne is illegitimate. I was not the rightful heir."', keepRel: 8, shareL: 22, shareO: -30, uniqueEffect: 'succession_crisis' },
        { id: 'king_spy_nobles', type: 'conspiracy', text: '{name} said coldly, "I have spies watching every noble in {kingdom}. I know all their secrets."', keepRel: 6, shareL: 15, shareO: -22 },
        { id: 'king_poisoned', type: 'criminal', text: '{name} whispered, "I poisoned a rival claimant to the throne. They never knew what struck them."', keepRel: 8, shareL: 18, shareO: -28, uniqueEffect: 'revolt_seed' },
        { id: 'king_merchant_bribe', type: 'criminal', text: '{name} admitted, "I take bribes from wealthy merchants. They buy my decrees like goods at market."', keepRel: 6, shareL: 15, shareO: -25, uniqueEffect: 'reputation_scandal' },
        { id: 'king_hidden_heir', type: 'conspiracy', text: '{name} revealed, "There is a legitimate heir I have been suppressing. They live in hiding, unaware of their birthright."', keepRel: 8, shareL: 22, shareO: -30, uniqueEffect: 'succession_crisis' },
        { id: 'king_war_profit', type: 'political', text: '{name} confided, "I started the last war for personal profit. Thousands died so I could fill my coffers."', keepRel: 8, shareL: 20, shareO: -30, uniqueEffect: 'revolt_seed' },
        { id: 'king_puppet', type: 'conspiracy', text: '{name} trembled, "A foreign power has influence over my decisions. I am not as free as my people think."', keepRel: 8, shareL: 22, shareO: -30, uniqueEffect: 'revolt_seed' },
        { id: 'king_fake_faith', type: 'personal', text: '{name} whispered, "I do not believe in the faith I enforce. It is merely a tool to control the masses."', keepRel: 6, shareL: 15, shareO: -22 },
        { id: 'king_conquest', type: 'political', text: '{name} said quietly, "I am secretly planning to invade a neighboring kingdom. The preparations are already underway."', keepRel: 7, shareL: 18, shareO: -25 }
    ];

    // ── State init ─────────────────────────────────────────
    function _initState() {
        if (player._knownSecrets === undefined) player._knownSecrets = [];
        if (player._secretCooldowns === undefined) player._secretCooldowns = {};
        if (player._keptSecretIds === undefined) player._keptSecretIds = [];
    }

    // ── Helpers ────────────────────────────────────────────
    function _isLover(personId) {
        var rel = player.relationships && player.relationships[personId];
        if (!rel || (rel.level || 0) < LOVER_REL_THRESHOLD) return false;
        var dp = player.dateProgress && player.dateProgress[personId];
        if (!dp) return false;
        return ((dp.traitProgress || 0) + (dp.quirkProgress || 0)) >= LOVER_DATE_PROGRESS_THRESHOLD;
    }

    function _getRelLevel(personId) {
        var rel = player.relationships && player.relationships[personId];
        return rel ? (rel.level || 0) : 0;
    }

    function _getSecretPool(person) {
        if (person.isKing) return KING_SECRETS;
        if (person.isNoble || person.occupation === 'noble') return NOBLE_SECRETS;
        if (person.isEliteMerchant) return EM_SECRETS;
        return NORMAL_SECRETS;
    }

    function _fillTemplate(text, person) {
        var name = person.firstName || 'They';
        var town = '';
        try { var t = _findTown(person.townId); if (t) town = t.name; } catch(e) {}
        town = town || 'the town';
        var kingdom = '';
        try {
            var t2 = _findTown(person.townId);
            if (t2 && t2.kingdomId) { var k = _findKingdom(t2.kingdomId); if (k) kingdom = k.name; }
        } catch(e) {}
        kingdom = kingdom || 'the realm';
        // Pick a random trade good name
        var goodName = 'grain';
        try {
            if (typeof RESOURCE_TYPES !== 'undefined') {
                var rtArr = Object.values(RESOURCE_TYPES);
                if (rtArr.length > 0) {
                    var ri = Math.floor(Math.random() * rtArr.length);
                    goodName = rtArr[ri].name || 'goods';
                }
            }
        } catch(e) {}
        return text.replace(/\{name\}/g, name)
                   .replace(/\{town\}/g, town)
                   .replace(/\{kingdom\}/g, kingdom)
                   .replace(/\{good\}/g, goodName);
    }

    function _alreadyKnowsFromNPC(personId, templateId) {
        for (var i = 0; i < player._knownSecrets.length; i++) {
            if (player._knownSecrets[i].npcId === personId &&
                player._knownSecrets[i].templateId === templateId) return true;
        }
        return false;
    }

    function _countSecretsFrom(personId) {
        var c = 0;
        for (var i = 0; i < player._knownSecrets.length; i++) {
            if (player._knownSecrets[i].npcId === personId) c++;
        }
        return c;
    }

    // ── Discovery ──────────────────────────────────────────
    function maybeDiscoverSecret(personId) {
        _ensureState();
        _initState();
        var person = _findPerson(personId);
        if (!person || person.alive === false) return null;

        var relLevel = _getRelLevel(personId);
        var isLov = _isLover(personId);

        // Must meet minimum relationship threshold
        if (relLevel < LOVER_REL_THRESHOLD) return null;
        if (!isLov && relLevel < BASE_REL_THRESHOLD) return null;

        // Cooldown check
        var day = _getDay();
        if (player._secretCooldowns[personId] && (day - player._secretCooldowns[personId]) < COOLDOWN_DAYS) return null;

        // Max secrets per NPC
        if (_countSecretsFrom(personId) >= MAX_SECRETS_PER_NPC) return null;

        // Roll for discovery
        var chance = DISCOVER_BASE_CHANCE;
        if (isLov) chance *= DISCOVER_LOVER_MULT;
        // Slight bonus for very high relationship
        if (relLevel >= 90) chance += 0.01;

        if (Math.random() >= chance) return null;

        // Pick a secret template
        var pool = _getSecretPool(person);
        // Filter out already-known templates for this NPC
        var available = [];
        for (var i = 0; i < pool.length; i++) {
            if (!_alreadyKnowsFromNPC(personId, pool[i].id)) {
                available.push(pool[i]);
            }
        }
        if (!available.length) return null;

        var template = available[Math.floor(Math.random() * available.length)];
        var secretText = _fillTemplate(template.text, person);

        var secret = {
            npcId: personId,
            npcName: ((person.firstName || '') + ' ' + (person.lastName || '')).trim(),
            templateId: template.id,
            type: template.type,
            category: person.isKing ? 'king' : (person.isNoble || person.occupation === 'noble') ? 'noble' : person.isEliteMerchant ? 'elite_merchant' : 'normal',
            text: secretText,
            keepRel: template.keepRel || KEEP_REL_BOOST,
            shareL: template.shareL || SHARE_REL_LISTENER,
            shareO: template.shareO || SHARE_REL_OWNER,
            uniqueEffect: template.uniqueEffect || null,
            discoveredDay: day,
            kept: false,
            shared: false
        };

        player._knownSecrets.push(secret);
        player._secretCooldowns[personId] = day;

        _logEvent('🤫 ' + person.firstName + ' shared a secret with you.', null, 'my_actions');

        return secret.text;
    }

    // ── Query functions ────────────────────────────────────
    function getSecretsForNPC(personId) {
        _ensureState();
        _initState();
        var results = [];
        for (var i = 0; i < player._knownSecrets.length; i++) {
            if (player._knownSecrets[i].npcId === personId) {
                results.push({ index: i, secret: player._knownSecrets[i] });
            }
        }
        return results;
    }

    function getAllKnownSecrets() {
        _ensureState();
        _initState();
        var results = [];
        for (var i = 0; i < player._knownSecrets.length; i++) {
            results.push({ index: i, secret: player._knownSecrets[i] });
        }
        return results;
    }

    function hasSecretsFor(personId) {
        _ensureState();
        _initState();
        for (var i = 0; i < player._knownSecrets.length; i++) {
            if (player._knownSecrets[i].npcId === personId && !player._knownSecrets[i].kept) return true;
        }
        return false;
    }

    function hasAnySecrets() {
        _ensureState();
        _initState();
        return player._knownSecrets.length > 0;
    }

    // ── Keep Secret ────────────────────────────────────────
    function keepSecret(personId, secretIdx) {
        _ensureState();
        _initState();
        secretIdx = Number(secretIdx);
        if (!Number.isInteger(secretIdx) || secretIdx < 0 || secretIdx >= player._knownSecrets.length) {
            return { success: false, message: 'Invalid secret.' };
        }
        var secret = player._knownSecrets[secretIdx];
        if (secret.npcId !== personId) {
            return { success: false, message: 'This secret does not belong to this person.' };
        }
        if (secret.kept) {
            return { success: false, message: 'You have already promised to keep this secret.' };
        }

        secret.kept = true;
        if (!player._keptSecretIds) player._keptSecretIds = [];
        player._keptSecretIds.push(secret.templateId + '_' + personId);

        // Relationship boost with the secret owner
        try { Player.modifyRelationship(personId, secret.keepRel); } catch(e) {}

        var person = _findPerson(personId);
        var pName = person ? person.firstName : 'They';
        var dialog = '"Thank you for keeping my trust. It means more than you know." — ' + pName;

        _logEvent('🤝 You promised ' + pName + ' to keep their secret.', null, 'my_actions');

        return {
            success: true,
            message: dialog,
            gain: secret.keepRel
        };
    }

    // ── Share Secret ───────────────────────────────────────
    function shareSecret(listenerPersonId, secretIdx) {
        _ensureState();
        _initState();
        secretIdx = Number(secretIdx);
        if (!Number.isInteger(secretIdx) || secretIdx < 0 || secretIdx >= player._knownSecrets.length) {
            return { success: false, message: 'Invalid secret.' };
        }
        var secret = player._knownSecrets[secretIdx];
        if (secret.npcId === listenerPersonId) {
            return { success: false, message: 'You cannot share someone\'s secret with themselves.' };
        }
        if (secret.shared) {
            return { success: false, message: 'You have already shared this secret.' };
        }

        var listener = _findPerson(listenerPersonId);
        var owner = _findPerson(secret.npcId);
        if (!listener) return { success: false, message: 'Person not found.' };

        secret.shared = true;

        // Base relationship effects
        try { Player.modifyRelationship(listenerPersonId, secret.shareL); } catch(e) {}
        try { Player.modifyRelationship(secret.npcId, secret.shareO); } catch(e) {}

        // Listener's relationship with owner drops too
        // (simulated — set a flag the AI can pick up)
        if (owner && listener) {
            try {
                if (!listener._npcRelationships) listener._npcRelationships = {};
                if (!listener._npcRelationships[owner.id]) listener._npcRelationships[owner.id] = 50;
                listener._npcRelationships[owner.id] = Math.max(0, (listener._npcRelationships[owner.id] || 50) - 15);
            } catch(e) {}
        }

        var lName = listener.firstName || 'They';
        var oName = secret.npcName || 'someone';
        var consequences = [];
        consequences.push(lName + ' now knows ' + oName + '\'s secret.');
        consequences.push('+' + secret.shareL + ' relationship with ' + lName + '.');
        consequences.push(secret.shareO + ' relationship with ' + oName + '.');

        // Unique effects
        var uniqueResult = _applyUniqueShareEffect(secret, listener, owner);
        if (uniqueResult) consequences.push(uniqueResult);

        _logEvent('🗣️ You shared ' + oName + '\'s secret with ' + lName + '.', null, 'my_actions');

        return {
            success: true,
            message: consequences.join(' '),
            gain: secret.shareL,
            consequences: consequences
        };
    }

    function _applyUniqueShareEffect(secret, listener, owner) {
        if (!secret.uniqueEffect) return null;
        var day = _getDay();

        switch (secret.uniqueEffect) {
            case 'may_arrest':
                // If shared with a noble or the king, owner may get arrested
                if (listener.isNoble || listener.isKing || listener.occupation === 'noble') {
                    if (Math.random() < 0.4 && owner) {
                        owner._jailedUntilDay = day + 30;
                        return '⚖️ ' + (owner.firstName || 'The secret owner') + ' has been arrested!';
                    }
                }
                return null;

            case 'king_punish':
                // If shared with the king, the noble owner gets punished
                if (listener.isKing && owner) {
                    // Heavy relationship hit between king and noble
                    try {
                        if (listener._npcRelationships) {
                            if (!listener._npcRelationships[owner.id]) listener._npcRelationships[owner.id] = 50;
                            listener._npcRelationships[owner.id] = Math.max(0, (listener._npcRelationships[owner.id] || 50) - 40);
                        }
                    } catch(e) {}
                    // May jail the noble
                    if (Math.random() < 0.5) {
                        owner._jailedUntilDay = day + 60;
                        return '👑 The king has ordered ' + (owner.firstName || 'the noble') + ' imprisoned for their crimes!';
                    }
                    // May strip rank
                    if (owner.socialRank && typeof owner.socialRank === 'object') {
                        for (var k in owner.socialRank) {
                            if ((owner.socialRank[k] || 0) >= 4) {
                                owner.socialRank[k] = Math.max(1, (owner.socialRank[k] || 0) - 2);
                            }
                        }
                        return '👑 The king has stripped ' + (owner.firstName || 'the noble') + ' of rank!';
                    }
                    return '👑 The king is furious with ' + (owner.firstName || 'the noble') + '.';
                }
                // If shared with another noble, they lose trust in the owner
                if ((listener.isNoble || listener.occupation === 'noble') && owner) {
                    return '🏰 ' + (listener.firstName || 'The noble') + ' will not forget what you told them about ' + (owner.firstName || 'them') + '.';
                }
                return null;

            case 'treason_accusation':
                // Sharing with king or noble — owner faces treason charges
                if ((listener.isKing || listener.isNoble || listener.occupation === 'noble') && owner) {
                    if (Math.random() < 0.3) {
                        owner._jailedUntilDay = day + 90;
                        try { Player.modifyRelationship(secret.npcId, -20); } catch(e) {} // additional hit
                        return '⚖️ ' + (owner.firstName || 'They') + ' has been accused of treason and imprisoned!';
                    }
                    return '⚖️ Rumors of ' + (owner.firstName || 'their') + ' treason are spreading.';
                }
                return null;

            case 'strip_title':
                // If shared with king — noble may lose their title
                if (listener.isKing && owner && owner.socialRank && typeof owner.socialRank === 'object') {
                    for (var sk in owner.socialRank) {
                        if ((owner.socialRank[sk] || 0) >= 4) {
                            owner.socialRank[sk] = 0;
                        }
                    }
                    owner.isNoble = false;
                    owner.occupation = 'citizen';
                    return '👑 The king has stripped ' + (owner.firstName || 'them') + ' of their noble title entirely!';
                }
                return null;

            case 'revolt_seed':
                // King secrets shared with nobles — may cause unrest
                if ((listener.isNoble || listener.occupation === 'noble') && owner && owner.isKing) {
                    // Lower noble's loyalty to the kingdom
                    try {
                        var t = _findTown(listener.townId);
                        if (t && t.kingdomId) {
                            var kd = _findKingdom(t.kingdomId);
                            if (kd) {
                                kd.unrest = Math.min(100, (kd.unrest || 0) + 10);
                                return '🔥 Unrest grows in ' + kd.name + ' as the king\'s secrets spread among the nobility.';
                            }
                        }
                    } catch(e) {}
                }
                return null;

            case 'succession_crisis':
                // King's legitimacy secret shared with anyone important
                if ((listener.isNoble || listener.occupation === 'noble' || listener.isEliteMerchant) && owner && owner.isKing) {
                    try {
                        var t2 = _findTown(listener.townId);
                        if (t2 && t2.kingdomId) {
                            var kd2 = _findKingdom(t2.kingdomId);
                            if (kd2) {
                                kd2.unrest = Math.min(100, (kd2.unrest || 0) + 20);
                                return '👑🔥 A succession crisis looms! The king\'s legitimacy is questioned across ' + kd2.name + '.';
                            }
                        }
                    } catch(e) {}
                }
                return null;

            case 'market_scandal':
                // EM market manipulation exposed — prices may shift
                if (owner && owner.townId) {
                    try {
                        var t3 = _findTown(owner.townId);
                        if (t3 && t3.kingdomId) {
                            // Reputation hit for the owner
                            try { Player.modifyRelationship(secret.npcId, -10); } catch(e) {} // additional hit
                            return '📊 News of ' + (owner.firstName || 'the merchant') + '\'s market manipulation spreads through ' + t3.name + '.';
                        }
                    } catch(e) {}
                }
                return null;

            case 'reputation_scandal':
                // General reputation damage
                if (owner && owner.townId) {
                    try {
                        var t4 = _findTown(owner.townId);
                        if (t4 && t4.kingdomId) {
                            // Player gains reputation for exposing wrongdoing
                            try { Player.modifyReputation(t4.kingdomId, 3); } catch(e) {}
                            return '📢 Your revelation about ' + (owner.firstName || 'them') + ' earns you respect in ' + (t4.name || 'the town') + '.';
                        }
                    } catch(e) {}
                }
                return null;

            case 'court_scandal':
                // Royal court scandal — all nobles in kingdom lose relationship with owner
                if (owner && owner.townId) {
                    var w = _getWorld();
                    if (w && w.people) {
                        var t5 = _findTown(owner.townId);
                        var kId = t5 ? t5.kingdomId : null;
                        if (kId) {
                            var count = 0;
                            for (var pi = 0; pi < w.people.length && count < 10; pi++) {
                                var p = w.people[pi];
                                if (p && p.alive && (p.isNoble || p.occupation === 'noble') && p.id !== owner.id) {
                                    var pt = _findTown(p.townId);
                                    if (pt && pt.kingdomId === kId) {
                                        if (!p._npcRelationships) p._npcRelationships = {};
                                        p._npcRelationships[owner.id] = Math.max(0, (p._npcRelationships[owner.id] || 50) - 10);
                                        count++;
                                    }
                                }
                            }
                            return '👑 The court scandal rocks ' + ((t5 && t5.name) || 'the kingdom') + '. Multiple nobles turn against ' + (owner.firstName || 'the accused') + '.';
                        }
                    }
                }
                return null;

            case 'may_fine':
                // Tax fraud — fine may be imposed
                if ((listener.isNoble || listener.isKing) && owner) {
                    var fineAmount = 200 + Math.floor(Math.random() * 300);
                    owner.gold = Math.max(0, (owner.gold || 0) - fineAmount);
                    return '💰 ' + (owner.firstName || 'They') + ' has been fined ' + fineAmount + 'g for tax fraud.';
                }
                return null;
        }
        return null;
    }

    // ── Exports ────────────────────────────────────────────
    Player.maybeDiscoverSecret = maybeDiscoverSecret;
    Player.getSecretsForNPC = getSecretsForNPC;
    Player.getAllKnownSecrets = getAllKnownSecrets;
    Player.hasSecretsFor = hasSecretsFor;
    Player.hasAnySecrets = hasAnySecrets;
    Player.keepSecret = keepSecret;
    Player.shareSecret = shareSecret;

})(window.Player);
