(function() {
    'use strict';

    // Assumes npc2Name is present in instance.params for these multi-NPC scenes.
    // Copy the if-blocks from buildRawStepSnippet into _rawStep().
    // Append NEW_DRAMA_EVENT_DEFS into EVENT_DEFS.

    function buildRawStepSnippet(def, instance, ctx, _sceneLead) {
        var step = instance.stepIndex || 0;
        var lead = _sceneLead(def);

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

        return null;
    }

    var NEW_DRAMA_EVENT_DEFS = [
        { id: 'noble_poison_wine', title: 'The Poisoned Chalice', icon: '🍷', category: 'crime', rarity: 'rare', weight: 5, template: 'poison_plot' },
        { id: 'perfumed_venom', title: 'Perfume and Venom', icon: '🧪', category: 'political', rarity: 'rare', weight: 4, template: 'poison_plot' },
        { id: 'funeral_toast_scheme', title: 'The Funeral Toast', icon: '⚰️', category: 'social', rarity: 'uncommon', weight: 6, template: 'poison_plot' },

        { id: 'guild_feud_banner', title: 'Choose a Banner', icon: '🏴', category: 'social', rarity: 'uncommon', weight: 8, template: 'alliance_offer' },
        { id: 'quarry_house_rivalry', title: 'Stone Against Silk', icon: '⚖️', category: 'political', rarity: 'uncommon', weight: 6, template: 'alliance_offer' },
        { id: 'blood_oath_patronage', title: 'A Patron\'s Side', icon: '🗡️', category: 'rank', rarity: 'rare', weight: 5, template: 'alliance_offer' },

        { id: 'ledger_of_lies', title: 'Ledger of Lies', icon: '📜', category: 'crime', rarity: 'rare', weight: 5, template: 'betrayal_chain' },
        { id: 'sealed_with_your_name', title: 'Sealed with Your Name', icon: '✉️', category: 'social', rarity: 'rare', weight: 5, template: 'betrayal_chain' },
        { id: 'friend_in_two_shadows', title: 'A Friend in Two Shadows', icon: '🕯️', category: 'political', rarity: 'rare', weight: 4, template: 'betrayal_chain' },

        { id: 'wax_seal_conspiracy', title: 'The Wax Seal Conspiracy', icon: '🕯️', category: 'political', rarity: 'rare', weight: 5, template: 'court_intrigue' },
        { id: 'silk_curtain_cabal', title: 'Behind the Silk Curtain', icon: '🎭', category: 'political', rarity: 'rare', weight: 4, template: 'court_intrigue' },
        { id: 'letters_to_the_crown', title: 'Letters for the Crown', icon: '👑', category: 'rank', rarity: 'rare', weight: 4, template: 'court_intrigue' },

        { id: 'drunken_property_deed', title: 'The Deed at Last Call', icon: '🍺', category: 'common', rarity: 'uncommon', weight: 8, template: 'tavern_chaos' },
        { id: 'goose_duel_wagers', title: 'The Goose Won the Argument', icon: '🪿', category: 'social', rarity: 'uncommon', weight: 7, template: 'tavern_chaos' },
        { id: 'one_boot_treaty', title: 'The One-Boot Treaty', icon: '👢', category: 'common', rarity: 'uncommon', weight: 7, template: 'tavern_chaos' }
    ];

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            buildRawStepSnippet: buildRawStepSnippet,
            NEW_DRAMA_EVENT_DEFS: NEW_DRAMA_EVENT_DEFS
        };
    } else if (typeof window !== 'undefined') {
        window.buildRawStepSnippet = buildRawStepSnippet;
        window.NEW_DRAMA_EVENT_DEFS = NEW_DRAMA_EVENT_DEFS;
    }
}());
