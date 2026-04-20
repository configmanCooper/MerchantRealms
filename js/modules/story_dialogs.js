(function() {
    'use strict';

    window.STORY_DIALOGS = {

        // =====================================================================
        // CHAPTER 0: PROLOGUE
        // =====================================================================

        ch0_intro: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "Welcome to Merchant Realms — Story Mode.",
                "You are about to begin a tale of trade, family, and war in the medieval kingdom of Valdren.",
                "You are the child of Edmund, a blacksmith in the small town of Ashford. Today is your 18th birthday.",
                "Pay attention to the quest tracker in the top-right corner — it will guide you through each chapter of your story.",
                "Your journey begins now..."
            ]
        },

        // =====================================================================
        // CHAPTER 1: "A Birthday Gift"
        // =====================================================================

        ch1_birthday_mother: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "Rise and shine, my darling! Do you know what day it is?",
                "Eighteen years ago today, you came screaming into this world, and what a blessing it was.",
                "Here — take these coins. Your father and I saved them for you. Go to the market and buy us something to eat and drink.",
                "It's time you learned to fend for yourself, {son|daughter}. The market square is just outside. Go see what the merchants have to offer!"
            ]
        },

        ch1_birthday_father: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Happy birthday, {son|daughter}! Eighteen already — where did the years go?",
                "Your mother's got you running errands already, has she? Good. A {man|woman} who can't feed {him|her}self is no {man|woman} at all.",
                "But mark my words — buying bread is just the beginning. There are bigger things ahead for you. I can feel it in my bones."
            ]
        },

        ch1_complete: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "You did it! A fine meal and drink — you've got a good eye for the market already.",
                "I knew you could take care of yourself. Your father and I raised you well, if I do say so myself."
            ]
        },

        // =====================================================================
        // CHAPTER 2: "The Forge"
        // =====================================================================

        ch2_forge_father: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Enough lounging about, {son|daughter}. Today you work the forge for real.",
                "This anvil has fed our family for three generations. Your grandfather built it with his own hands.",
                "Go to the blacksmith shop and take a shift. Work the bellows, shape the iron, earn an honest wage.",
                "When you work at a building, you trade your time for coin and experience. That's how the world turns."
            ]
        },

        ch2_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Let me see those hands. Ha! Blisters already — but good blisters. Honest ones.",
                "You have your grandfather's hands, {son|daughter}. Strong and steady. The forge suits you."
            ]
        },

        // =====================================================================
        // CHAPTER 3: "The Delivery"
        // =====================================================================

        ch3_delivery_father: {
            speaker: "father",
            portrait: "father",
            lines: [
                "I've finished a set of tools for old Harlan over in Ferrowdale. Plowshares and sickles — the miners and smiths depend on them.",
                "I need you to deliver them for me. Ferrowdale is a fair journey from here.",
                "Sell the tools at the Ferrowdale market — Harlan will pay a fair price. Then bring the coin back to me.",
                "But first, get some rest before you set out. It's a long journey and you'll need your strength."
            ]
        },

        ch3_harlan_intro: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "In Ferrowdale, you seek out Harlan — an old friend of your father's and a fellow tradesman. He's been buying Edmund's tools for years.",
                "You find him near the market square, inspecting a cartload of iron ore with a practiced eye."
            ]
        },

        ch3_harlan_meet: {
            speaker: "harlan",
            portrait: "harlan",
            lines: [
                "{son|daughter} of Edmund, is it? I'd know that craftsmanship anywhere. Fine tools, these — your father's best work.",
                "Sell them here at the market — you'll get a good price. Tools are always in demand in Ferrowdale."
            ]
        },

        ch3_father_takes_gold: {
            speaker: "father",
            portrait: "father",
            lines: [
                "You're back! Let me see... aye, that's a fair price Harlan paid.",
                "I'll take my half — that covers the iron and coal. The rest is yours to keep, {son|daughter}. You've earned it.",
                "Well done. You've proven you can handle a real delivery. Perhaps there's a merchant in you after all."
            ]
        },

        ch3_father_admonish: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Where's the coin? Those tools were worth good gold, and you come back with barely a copper to show for it?",
                "I don't know what you did with the money, but I'm taking what's left. That iron doesn't pay for itself.",
                "You'll work an extra shift at the forge — unpaid — to make up for it. Consider it a lesson in responsibility."
            ]
        },

        ch3_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Harlan sent word that you arrived safe and the tools were in perfect order.",
                "Well done, {son|daughter}. You've proven you can be trusted with more than just the bellows."
            ]
        },

        // =====================================================================
        // CHAPTER 4: "The Art of the Deal"
        // =====================================================================

        ch4_harlan_teaches: {
            speaker: "harlan",
            portrait: "harlan",
            lines: [
                "Back again, eh? Good. I've been meaning to show you something.",
                "Every town has different prices, {boy|girl}. Flour is cheap in farming towns but dear in the cities. Iron is plentiful near the mines but scarce on the coast.",
                "Buy where it's cheap, sell where it's not — that's the oldest trick in the merchant's book. That's where the real coin is.",
                "Try it yourself. Buy something here in Ferrowdale and sell it back in Ashford. You'll see what I mean."
            ]
        },

        ch4_complete: {
            speaker: "harlan",
            portrait: "harlan",
            lines: [
                "Ha! You turned a profit, did you? I can see it in your eyes.",
                "You've got a merchant's eye, {boy|girl}. Not everyone can spot an opportunity. Keep at it — there's a fortune waiting for those who know where to look."
            ]
        },

        // =====================================================================
        // CHAPTER 5: "A Place to Call Home"
        // =====================================================================

        ch5_mother_housing: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "We need to talk, {son|daughter}. You're eighteen now, earning your own coin, making your own way.",
                "It's time to find lodging of your own. I love having you here, but a grown {man|woman} needs {his|her} own roof.",
                "You'll need to buy a plot of land first, then build a home on it. Save up your gold — you just proved you know how to do it. You can do it!"
            ]
        },

        ch5_complete: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "A roof of your own! Oh, I'm so proud of you, {son|daughter}!",
                "You'll always have a place at our table, but it does my heart good to see you standing on your own two feet."
            ]
        },

        // =====================================================================
        // CHAPTER 6: "The Apprentice"
        // =====================================================================

        ch6_father_skills: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Listen well, {son|daughter}. Raw strength means nothing without skill. A smith without training is just a {man|woman} with a hammer.",
                "You need to learn properly — join a guild, find masters who can teach you. The guilds open doors that coin alone cannot.",
                "Start with something you know. The Smithing Guild would welcome you, given our family name."
            ]
        },

        ch6_guild_intro: {
            speaker: "guild_keeper",
            portrait: "guild_keeper",
            lines: [
                "Welcome, aspirant. So you wish to join our ranks? The guilds of Valdren are ancient and proud institutions.",
                "As a member, you'll gain access to training, knowledge, and connections that no amount of wandering can provide.",
                "Prove your dedication through honest work, and the guild will reward you in kind."
            ]
        },

        ch6_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "A guild member! Your mother and I couldn't be more proud.",
                "The Forge's legacy continues through you, {son|daughter}. Your grandfather would have wept with joy to see this day."
            ]
        },

        // =====================================================================
        // CHAPTER 7: "Drums of War"
        // =====================================================================

        ch7_war_crier: {
            speaker: "town_crier",
            portrait: "town_crier",
            lines: [
                "Hear ye! Hear ye! By royal decree of His Majesty King Aldric of Valdren!",
                "A state of war now exists between the Kingdom of Valdren and the Kingdom of Korvath!",
                "All trade with Korvath is hereby suspended! Korvathi merchants are to leave Valdren soil within a fortnight!",
                "May the gods protect the realm. Long live the King!"
            ]
        },

        ch7_father_worried: {
            speaker: "father",
            portrait: "father",
            lines: [
                "This is bad, {son|daughter}. Very bad. Korvath was our iron supplier — the best iron in the known world came through Viktor's caravans.",
                "Viktor won't be coming anymore. No more Korvathi iron means no more Korvathi steel.",
                "Without iron, the forge goes cold. Without the forge... I don't know what we'll do."
            ]
        },

        ch7_mother_comfort: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "I know you're both frightened. War is a terrible thing — I remember the last one, when I was just a girl.",
                "But we've survived hard times before, and we'll survive this. We have each other, and that's what matters.",
                "Be strong, {son|daughter}. Your father needs you now more than ever."
            ]
        },

        ch7_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "We can't sit here waiting for the war to end. If Korvath won't sell us iron, we'll find it elsewhere.",
                "I've heard tell of iron deposits to the north, near Ferrowdale. It won't be easy, but it's our best hope."
            ]
        },

        // =====================================================================
        // CHAPTER 8: "Fire and Iron"
        // =====================================================================

        ch8_father_plan: {
            speaker: "father",
            portrait: "father",
            lines: [
                "I've been thinking, {son|daughter}. There are iron deposits up near Ferrowdale — raw ore, just waiting to be pulled from the earth.",
                "If we can't buy iron, we'll mine it ourselves. It's backbreaking work, but it beats starving.",
                "Head to Ferrowdale and see what you can find. Buy iron from the miners, or work the deposits yourself if you must."
            ]
        },

        ch8_ferrowdale_arrive: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "The road to Ferrowdale winds through rocky hills scarred with mine shafts and smelting pits.",
                "The air tastes of ash and iron. Miners with blackened faces trudge along the paths, pickaxes over their shoulders.",
                "There is iron here — mountains of it. Enough to keep every forge in Valdren burning for a hundred years."
            ]
        },

        ch8_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Our own iron! By the gods, {son|daughter}, you've done it!",
                "The forge will never go dark — not as long as you're out there keeping the iron flowing. I'm proud of you."
            ]
        },

        // =====================================================================
        // CHAPTER 9: "Roads of Fortune"
        // =====================================================================

        ch9_father_caravan: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Iron sitting in Ferrowdale does us no good here in Ashford. We need to move it — and move it regular.",
                "You need a caravan, {son|daughter}. Hire guards, buy wagons, set up a route between Ferrowdale and home.",
                "A steady supply line is worth more than any single deal. Keep the iron flowing, and the coin will follow."
            ]
        },

        ch9_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "A caravan of your own! Now the iron flows like a river to our forge!",
                "You're not just a merchant anymore, {son|daughter}. You're a trader of consequence. The town depends on you."
            ]
        },

        // =====================================================================
        // CHAPTER 10: "Bread and Butter"
        // =====================================================================

        ch10_mother_bread: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "Have you seen the bakers' stalls, {son|daughter}? Half of them are empty. With the war, the flour shipments have dried up.",
                "People are going hungry. Children are crying for bread, and their mothers have none to give.",
                "You've proven you can move goods across the kingdom. Can you bring food to those who need it? Please, {son|daughter}."
            ]
        },

        ch10_complete: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "You've fed the town! The bakers are working again, and the children have full bellies!",
                "Oh, {son|daughter}, your father would burst with pride if he could see you now. You've done a truly good thing."
            ]
        },

        // =====================================================================
        // CHAPTER 11: "Fever and Steel"
        // =====================================================================

        ch11_father_injury: {
            speaker: "father",
            portrait: "father",
            lines: [
                "The hammer... slipped. Caught my hand against the anvil. I can't feel my fingers, {son|daughter}.",
                "Don't look at me like that — I've had worse. But I won't be swinging a hammer for a while.",
                "The forge needs tending. You'll have to manage things until I'm back on my feet. If I get back on my feet."
            ]
        },

        ch11_mother_illness: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "*cough* Don't worry about me, dear. Just a chill — the autumn air, nothing more.",
                "I'll be right as rain in a day or two. You just focus on your father and the forge.",
                "Promise me you won't fuss, {son|daughter}. I'm tougher than I look."
            ]
        },

        ch11_treat_father: {
            speaker: "father",
            portrait: "father",
            lines: [
                "You brought medicine? You didn't have to... but thank you, {son|daughter}. The pain is bearable now.",
                "I keep thinking about the forge. All those orders, all that iron waiting to be shaped. Who's going to do it if I can't?",
                "You, I suppose. Ha. My {son|daughter}, the blacksmith. Your grandfather would be amused."
            ]
        },

        ch11_treat_mother: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "You brought me remedies? Oh, you shouldn't have spent the coin, love.",
                "I'm more worried about you than about myself, truth be told. You're carrying too much on those young shoulders.",
                "But... thank you. You're a good {son|daughter}. The best a mother could ask for."
            ]
        },

        ch11_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Your mother's fever has broken, and the feeling is coming back to my hand. We're going to be all right.",
                "You carried us through this, {son|daughter}. The forge, the medicine, everything. Together, we can weather any storm.",
                "I love you, {boy|girl}. Don't ever forget that."
            ]
        },

        // =====================================================================
        // CHAPTER 12: "The Grand Festival"
        // =====================================================================

        ch12_festival_start: {
            speaker: "town_crier",
            portrait: "town_crier",
            lines: [
                "Hear ye! Hear ye! By order of His Majesty, a Grand Festival shall be held across the realm!",
                "Merchants, craftsmen, and nobles from every corner of Valdren are invited to display their finest wares!",
                "Let the festivities begin! May Valdren's prosperity shine even in these times of war!"
            ]
        },

        ch12_lord_calder_meet: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "Well, well. So you're the young merchant I've been hearing about. The one who kept Ashford's forges burning when the iron dried up.",
                "I've been watching you for some time, {boy|girl}. You have ambition — and more importantly, you have results.",
                "I am Lord Calder, advisor to the crown. I think we can be of great use to one another.",
                "Come see me in the capital when you're ready. I can open doors for you that coin alone cannot unlock."
            ]
        },

        ch12_seraphine_meet: {
            speaker: "seraphine",
            portrait: "seraphine",
            lines: [
                "You must be Edmund's {son|daughter}. Your reputation precedes you... as does the scent of forge smoke on your clothes.",
                "I am Seraphine. I trade in many things — goods, secrets, and occasionally, warnings.",
                "The war is not what it seems, child. Powerful people profit from the bloodshed, on both sides of the border.",
                "Keep your eyes open and your ledgers close. Dark times are coming, and you'll need every advantage you can get."
            ]
        },

        ch12_complete: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "You've made quite the impression at the festival, {boy|girl}. The other nobles are talking about you.",
                "I meant what I said — come to the capital. With my patronage, you could rise higher than you ever dreamed."
            ]
        },

        // =====================================================================
        // CHAPTER 13: "The Fall of Ashford"
        // =====================================================================

        ch13_invasion: {
            speaker: "korvathi_commander",
            portrait: "korvathi_commander",
            lines: [
                "People of Ashford! By order of King Malachar of Korvath, this town is now under Korvathi occupation!",
                "Lay down your arms and submit peacefully. Any resistance will be met with the sword.",
                "Your so-called King Aldric cannot protect you. Valdren's strength is broken. Surrender, and you may yet live."
            ]
        },

        ch13_father_captured: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "They took your father! The soldiers broke down the forge door and dragged him away in chains!",
                "They said he was an enemy supplier — that his swords and tools armed Valdren's soldiers against Korvath!",
                "Oh gods, Edmund... my Edmund..."
            ]
        },

        ch13_mother_escape: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "Listen to me, {son|daughter}. Listen carefully. You cannot stay here — they'll come for you next.",
                "Find Lord Calder. He has influence with the crown. If anyone can help free your father, it's him.",
                "Go now! Take what you can carry and run! Don't look back — and don't you dare let them catch you!",
                "I'll be fine. They have no quarrel with an old woman. Now GO!"
            ]
        },

        ch13_escape_complete: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "The fires of Ashford fade behind you as you flee into the night. Your father in chains, your mother alone, your home in enemy hands.",
                "But grief gives way to resolve. You will find Lord Calder. You will free your father.",
                "No matter the cost."
            ]
        },

        // =====================================================================
        // CHAPTER 14: "A Petition to the Crown"
        // =====================================================================

        ch14_calder_plan: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "I heard about Ashford, {boy|girl}. I'm sorry — truly. Your father is a good man, and he doesn't deserve a Korvathi dungeon.",
                "But to free him, you need more than courage. You need influence. And influence requires rank.",
                "A commoner's voice carries no weight at court. But a Burgher — a merchant of standing — can petition the crown directly.",
                "Build your reputation, grow your wealth, and petition for promotion. That is the path to your father's freedom."
            ]
        },

        ch14_climb_ranks: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "The social ladder in Valdren is climbed one rung at a time. Petition for a higher rank when you've proven yourself.",
                "Show the crown that you are a {man|woman} of substance — a provider, a leader, someone worthy of the title Burgher.",
                "I'll put in a good word for you, but the work is yours to do."
            ]
        },

        ch14_complete: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "Burgher! You've done it, {boy|girl}! The crown recognizes your standing!",
                "Now you have a voice — but we need it louder still. The path ahead is long, but your father's freedom draws nearer."
            ]
        },

        // =====================================================================
        // CHAPTER 15: "Master of the Guild"
        // =====================================================================

        ch15_calder_wealth: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "Rank alone won't save your father. You need wealth — real wealth. The kind that makes kings listen.",
                "Expand your trade empire. Dominate the guilds. Become so wealthy and so essential that the crown cannot ignore you.",
                "When you control the flow of goods, you control the flow of power. Remember that."
            ]
        },

        ch15_seraphine_hint: {
            speaker: "seraphine",
            portrait: "seraphine",
            lines: [
                "We meet again, {son|daughter} of Edmund. I've heard about your father. A tragedy — but not an irreversible one.",
                "Korvath's supply lines are stretched thin. Their armies eat through provisions faster than they can replace them.",
                "That is their weakness. Remember it well — it may prove useful when the time comes."
            ]
        },

        ch15_complete: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "Look at you. Wealthy, influential, a master of your guild. You've come a long way from that frightened {boy|girl} who fled Ashford.",
                "Now you have the coin. Next, you need the crown's ear. It's time to enter the halls of power."
            ]
        },

        // =====================================================================
        // CHAPTER 16: "Halls of Power"
        // =====================================================================

        ch16_calder_nobility: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "The time has come. I'll sponsor you for nobility — vouch for your character before the court.",
                "But my word alone won't suffice. You must prove yourself worthy at court. Attend the royal feast, meet the nobles, make your case.",
                "Be warned: the court is full of vipers. Smile at everyone, trust no one."
            ]
        },

        ch16_feast_arrival: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "The great hall blazes with a thousand candles. Silk banners of Valdren's noble houses hang from vaulted ceilings.",
                "Lords and ladies in velvet and gold turn to regard the newcomer — the blacksmith's {son|daughter} who dared to climb so high.",
                "The air smells of roasted pheasant, spiced wine, and ambition."
            ]
        },

        ch16_court_intro: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "Stay close and follow my lead. I'll introduce you to the people who matter.",
                "Remember: at court, every word is a weapon and every smile is a shield. Choose both carefully."
            ]
        },

        ch16_king_meeting: {
            speaker: "king_aldric",
            portrait: "king_aldric",
            lines: [
                "So this is the merchant Lord Calder speaks so highly of. The one who kept the forges burning and the people fed.",
                "Valdren needs more subjects like you, {boy|girl}. Your service to the realm has not gone unnoticed.",
                "Rise. You have my attention — and my respect."
            ]
        },

        ch16_complete: {
            speaker: "lord_calder",
            portrait: "lord_calder",
            lines: [
                "You've done it. By royal decree, you are now a noble of Valdren. You're one of us.",
                "And now — now we can talk about saving your father and ending this wretched war."
            ]
        },

        // =====================================================================
        // CHAPTER 17: "The War Effort" (BRANCHING)
        // =====================================================================

        ch17_choice: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "Two paths lie before you. Two allies offer their counsel, each with a different vision for ending the war.",
                "Lady Elowen believes in the power of diplomacy — turning Korvath's allies against them with gold and promises.",
                "General Theron believes in the power of steel — crushing Korvath's armies with superior arms and strategy.",
                "The choice is yours, and it will shape the fate of the realm."
            ],
            choices: [
                { label: "Pursue Diplomacy with Lady Elowen", action: "path_diplomacy" },
                { label: "Pursue Military Victory with General Theron", action: "path_military" }
            ]
        },

        ch17_elowen_intro: {
            speaker: "lady_elowen",
            portrait: "lady_elowen",
            lines: [
                "War is a blunt instrument, {boy|girl}. The sharpest blade is one that never needs to be drawn.",
                "Count Rask of the Borderlands supplies Korvath with grain and timber. Without him, their war machine starves.",
                "Convince Rask to switch sides — show him that Valdren is the winning bet — and we end this war without another drop of blood.",
                "It will require gifts, trade agreements, and no small amount of charm. Are you ready?"
            ]
        },

        ch17_theron_intro: {
            speaker: "general_theron",
            portrait: "general_theron",
            lines: [
                "Diplomacy is for cowards and fools. Korvath understands one language: steel.",
                "We need weapons — swords, shields, armor, siege equipment. More than our forges can currently produce.",
                "Build outposts along the border. Establish forward supply lines. Arm our soldiers to the teeth.",
                "You're a merchant, {boy|girl}. Supply me with what I need, and I'll deliver you a victory."
            ]
        },

        // Chapter 17A: Diplomacy Path
        ch17a_rask_meeting: {
            speaker: "count_rask",
            portrait: "count_rask",
            lines: [
                "A Valdren noble? In my court? You have courage, I'll grant you that. Or perhaps just foolishness.",
                "What can Valdren offer that Korvath cannot? King Malachar pays well for my loyalty.",
                "Convince me, merchant. Show me why I should risk everything to change sides."
            ]
        },

        ch17a_diplomatic_progress: {
            speaker: "lady_elowen",
            portrait: "lady_elowen",
            lines: [
                "Rask is wavering — I can feel it. But he needs more convincing. He's a practical man above all else.",
                "Send luxuries to his court. Fine wines, exotic spices, Valdren silk. Show him that peace with us is profitable.",
                "And keep the trade flowing. Nothing speaks louder than a steady stream of gold."
            ]
        },

        ch17a_complete: {
            speaker: "lady_elowen",
            portrait: "lady_elowen",
            lines: [
                "Rask has declared for Valdren! Without his grain and timber, Korvath's armies will wither on the vine!",
                "You did it, {boy|girl}. You ended a war with ledgers and handshakes instead of swords and graves.",
                "History will remember this day — and your name will be written large upon it."
            ]
        },

        // Chapter 17B: Military Path
        ch17b_weapons_production: {
            speaker: "general_theron",
            portrait: "general_theron",
            lines: [
                "We need steel. Lots of it. Swords, pikes, armor plates — enough to outfit three regiments.",
                "Your forges and your supply lines are the backbone of this campaign. Don't let me down, merchant.",
                "Every blade you forge is a life saved on our side and a life taken on theirs. Get to work."
            ]
        },

        ch17b_outpost_built: {
            speaker: "general_theron",
            portrait: "general_theron",
            lines: [
                "A forward outpost! Well done! You think like a general, {boy|girl} — always securing the next position.",
                "From here, we can stage raids, intercept supply convoys, and keep Korvath guessing.",
                "Keep building. Every outpost is a nail in Korvath's coffin."
            ]
        },

        ch17b_battle_victory: {
            speaker: "general_theron",
            portrait: "general_theron",
            lines: [
                "Victory! The Korvathi line has broken! They're retreating across the border!",
                "Your supply lines won this fight, merchant. My soldiers had full bellies and sharp swords while the enemy had neither.",
                "I've fought a hundred battles, and never once has a merchant mattered as much as you did today."
            ]
        },

        ch17b_complete: {
            speaker: "general_theron",
            portrait: "general_theron",
            lines: [
                "Korvath has sued for peace! Their armies are shattered, their supply lines cut, their will to fight broken!",
                "This victory belongs to you as much as any soldier on the field. You forged the weapons that won this war.",
                "General Theron does not forget {his|her} allies. You'll have my sword whenever you need it."
            ]
        },

        // =====================================================================
        // CHAPTER 18: "Reunion"
        // =====================================================================

        ch18_ashford_liberated: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "The banners of Valdren fly over Ashford once more. The Korvathi garrison has surrendered, and the townspeople flood the streets with tears of joy.",
                "Homes are damaged, the market square is scarred with battle wounds, but the spirit of Ashford endures.",
                "Somewhere in this liberated town, your father waits."
            ]
        },

        ch18_father_freed: {
            speaker: "father",
            portrait: "father",
            lines: [
                "{son|daughter}? Is it truly you? I... I thought I'd never see your face again.",
                "They kept me in the dark for so long. But I never lost hope. I knew you'd come for me.",
                "Look at you. You've changed — grown. You left here a {boy|girl} and returned a {man|woman} of the realm.",
                "I am so proud of you. So very proud."
            ]
        },

        ch18_mother_reunion: {
            speaker: "mother",
            portrait: "mother",
            lines: [
                "My family! My whole family, together again! Oh, I swore I wouldn't cry, but — come here, both of you!",
                "I prayed every night, {son|daughter}. Every single night. And the gods answered.",
                "We're together. That's all that matters. We're together."
            ]
        },

        ch18_forge_restored: {
            speaker: "father",
            portrait: "father",
            lines: [
                "The forge is still standing. Damaged, but standing. Like us, I suppose.",
                "I want you to have it, {son|daughter}. The blacksmith shop — it's yours now.",
                "I'm too old and too broken to swing a hammer the way I used to. But you... you've built something greater than I ever could.",
                "Take the forge. It's where our family's story began, and it's fitting that it should be part of yours."
            ]
        },

        ch18_complete: {
            speaker: "father",
            portrait: "father",
            lines: [
                "Home. I never thought that word could sound so sweet.",
                "Whatever comes next, we face it together. As a family. Always."
            ]
        },

        // =====================================================================
        // CHAPTER 19: "A New Dawn"
        // =====================================================================

        ch19_ceremony_start: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "The throne room of Valdren's capital gleams with polished marble and gilded columns. A hundred nobles stand in attendance.",
                "Trumpets sound a royal fanfare as the great doors open. King Aldric sits upon the Throne of Stars, crown gleaming.",
                "And before him stands the {son|daughter} of Ashford — a blacksmith's child who changed the fate of a kingdom."
            ]
        },

        ch19_king_speech: {
            speaker: "king_aldric",
            portrait: "king_aldric",
            lines: [
                "People of Valdren! We gather today to honor one who has served the realm with extraordinary courage and devotion.",
                "When war threatened to consume us, this {man|woman} kept our forges burning, our soldiers armed, and our people fed.",
                "When {his|her} own family was torn apart by the enemy, {he|she} rose from the ashes and helped us secure victory.",
                "By my authority as King of Valdren, I hereby grant you the title and lands befitting a Lord of the Realm. Rise, and take your place among the great."
            ]
        },

        ch19_father_proud: {
            speaker: "father",
            portrait: "father",
            lines: [
                "From a blacksmith's {son|daughter} to a lord of the realm. Can you believe it?",
                "Your mother is crying again — happy tears, she insists. And I... well, I'm not far behind.",
                "We couldn't be prouder of you, {son|daughter}. Everything you've done, everything you've become... it's more than we ever dreamed.",
                "Go on, then. The world is waiting for you, my lord."
            ]
        },

        ch19_narrator_end: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "And so the {son|daughter} of Ashford became a lord of Valdren — a blacksmith's child who forged {his|her} destiny on the anvil of war.",
                "But the world is vast, the trade routes are long, and there are always new horizons to chase.",
                "The story is far from over. The sandbox awaits."
            ]
        },

        ch19_sandbox_unlock: {
            speaker: "narrator",
            portrait: "narrator",
            lines: [
                "Congratulations! You have completed the Story of Valdren!",
                "All protections have been removed. All features are unlocked. Every town, every trade route, every opportunity — the world is yours.",
                "Build your empire. Forge your legacy. The realm of MerchantRealms is yours to conquer."
            ]
        }
    };
})();
