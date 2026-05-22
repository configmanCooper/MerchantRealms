'use strict';

function rawStepComedyTemplates(def, instance, ctx) {
    var step = instance.stepIndex || 0;
    var lead = _sceneLead(def);
    var lastChoiceId = null;

    if (instance && instance.choiceHistory && instance.choiceHistory.length) {
        lastChoiceId = instance.choiceHistory[instance.choiceHistory.length - 1].choiceId;
    }

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

    return null;
}

var NEW_COMEDY_EVENT_DEFS = [
    { id: 'royal_audit_mixup', title: 'Royal Audit Mix-Up', icon: '👑', category: 'political', rarity: 'uncommon', weight: 7, template: 'mistaken_identity' },
    { id: 'velvet_knife_mixup', title: 'The Wrong Outlaw', icon: '🗡️', category: 'crime', rarity: 'rare', weight: 4, template: 'mistaken_identity' },
    { id: 'moonlit_serenade_mixup', title: 'Moonlit Serenade Mix-Up', icon: '💌', category: 'social', rarity: 'uncommon', weight: 6, template: 'mistaken_identity' },
    { id: 'champion_in_disguise', title: 'Champion in Disguise', icon: '⚔️', category: 'skill', rarity: 'common', weight: 8, template: 'mistaken_identity' },

    { id: 'goat_versus_taxman', title: 'Goat Versus the Taxman', icon: '🐐', category: 'political', rarity: 'common', weight: 10, template: 'animal_chaos' },
    { id: 'parrot_of_state_secrets', title: 'Parrot of State Secrets', icon: '🦜', category: 'social', rarity: 'uncommon', weight: 8, template: 'animal_chaos' },
    { id: 'pig_in_the_courthouse', title: 'Pig in the Courthouse', icon: '🐖', category: 'common', rarity: 'common', weight: 10, template: 'animal_chaos' },
    { id: 'cat_inherits_a_shop', title: 'Cat Inherits a Shop', icon: '🐈', category: 'trade', rarity: 'uncommon', weight: 7, template: 'animal_chaos' },

    { id: 'alehouse_partnership', title: 'Alehouse Partnership', icon: '🍻', category: 'trade', rarity: 'common', weight: 9, template: 'drunken_deal' },
    { id: 'ceremonial_goose_contract', title: 'Ceremonial Goose Contract', icon: '📜', category: 'common', rarity: 'uncommon', weight: 7, template: 'drunken_deal' },
    { id: 'accidental_betrothal_merger', title: 'Accidental Betrothal Merger', icon: '💍', category: 'social', rarity: 'rare', weight: 4, template: 'drunken_deal' },
    { id: 'contraband_cheese_partnership', title: 'Contraband Cheese Partnership', icon: '🧀', category: 'crime', rarity: 'uncommon', weight: 6, template: 'drunken_deal' },

    { id: 'dragon_with_a_cheese_knife', title: 'Dragon with a Cheese Knife', icon: '🐉', category: 'skill', rarity: 'uncommon', weight: 7, template: 'rumor_spiral' },
    { id: 'duchess_engagement_rumor', title: 'Duchess Engagement Rumor', icon: '💍', category: 'social', rarity: 'uncommon', weight: 7, template: 'rumor_spiral' },
    { id: 'kings_horse_scandal', title: 'The King\'s Horse Scandal', icon: '🐎', category: 'political', rarity: 'rare', weight: 4, template: 'rumor_spiral' },
    { id: 'saint_of_the_turnip', title: 'Saint of the Turnip', icon: '🥕', category: 'common', rarity: 'common', weight: 9, template: 'rumor_spiral' },

    { id: 'eel_pie_showdown', title: 'Eel Pie Showdown', icon: '🥧', category: 'common', rarity: 'common', weight: 9, template: 'cooking_contest' },
    { id: 'turnip_terrine_trials', title: 'Turnip Terrine Trials', icon: '🥕', category: 'trade', rarity: 'uncommon', weight: 7, template: 'cooking_contest' },
    { id: 'duke_of_gravy_memorial_cup', title: 'Duke of Gravy Memorial Cup', icon: '🍲', category: 'political', rarity: 'uncommon', weight: 6, template: 'cooking_contest' },
    { id: 'black_garlic_blood_feud', title: 'Black Garlic Blood Feud', icon: '🧄', category: 'social', rarity: 'rare', weight: 4, template: 'cooking_contest' }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        rawStepComedyTemplates: rawStepComedyTemplates,
        NEW_COMEDY_EVENT_DEFS: NEW_COMEDY_EVENT_DEFS
    };
}
