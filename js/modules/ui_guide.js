// ============================================================
// Merchant Realms — UI Game Guide Module (extracted from ui.js)
// Extends window.UI with game guide functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_guide.js");

    // Aliases for UI utilities used by extracted code
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
    var calculateRouteDist = UI.calculateRouteDist;

    // ═══════════════════════════════════════════════════════════
    //  GAME GUIDE
    // ═══════════════════════════════════════════════════════════

    var gameGuideData = [
        // GETTING STARTED
        { cat: 'Getting Started', title: 'Welcome to Merchant Realms', text: 'You are a medieval merchant trying to build wealth and influence. Start by taking jobs, trading goods, and building a reputation. Your goal is to climb the social ranks, build a merchant empire, and establish a dynasty.' },
        { cat: 'Getting Started', title: 'Your First Steps', text: 'Take a job at a local building to earn starting gold. Visit the market to buy cheap goods and sell at higher prices. Rest when your energy is low. Talk to NPCs to build relationships.' },
        { cat: 'Getting Started', title: 'Energy & Rest', text: 'Every action costs energy. When you run low, rest at an inn, your home, or sleep outside. Having a home improves rest quality. Better housing provides more energy per rest. Eating food restores hunger, which prevents energy drain.' },
        { cat: 'Getting Started', title: 'Hunger & Thirst', text: 'Hunger and thirst decrease over time. When hunger hits 0 you begin starving, losing health each tick. Buy food (wheat, bread, meat, fish) from the market and eat it. Water is cheapest to buy and restores thirst. Keep both bars above 20 to be safe.' },
        { cat: 'Getting Started', title: 'Origin Stories', text: 'When starting a new game, you can choose from 10 different origin stories. Each gives a different starting situation — some start with debt, others with special skills or connections. Experiment to find your favorite start.' },
        { cat: 'Getting Started', title: 'The Indentured Start', text: 'The Indentured Servant origin starts you in debt to the kingdom. You must work to pay off your debt before you gain full freedom. Escape attempts are possible but risky — success depends on your skills and luck.' },
        { cat: 'Getting Started', title: 'Game Speed', text: 'Use the speed buttons (1×, 4×, 16×, 60×) to control how fast time passes. Pause with ⏸ or Space. Higher speeds are useful for waiting, but slow down during important moments like combat or trading decisions.' },
        { cat: 'Getting Started', title: 'Saving Your Game', text: 'Click the 💾 icon or press Ctrl+S to save. There are 5 save slots available. Save regularly — especially before risky activities like traveling dangerous roads or making big investments.' },
        // TRADING
        { cat: 'Trading', title: 'Market Basics', text: 'Each town has a market where goods are bought and sold. Prices change based on supply and demand. Buy low in towns with surplus, sell high in towns with shortage.' },
        { cat: 'Trading', title: 'Supply & Demand', text: 'Prices drop when supply is high and rise when supply is low. Towns produce goods based on their buildings — a town with farms produces cheaper food. Your purchases reduce supply and push prices up.' },
        { cat: 'Trading', title: 'Terrain & Prices', text: 'Town location affects base prices. Coastal towns have cheaper fish and salt. Mountain towns have cheaper ore and stone. Forest towns have cheaper wood and herbs. Plains have cheaper wheat and meat.' },
        { cat: 'Trading', title: 'Taxes & Discounts', text: 'All market purchases include a kingdom tax. Citizens of a kingdom receive a discount on purchases. The tax rate varies by kingdom — check the Kingdoms panel to compare. Some kings raise or lower taxes over time.' },
        { cat: 'Trading', title: 'Trade Licenses', text: 'Some luxury goods require a trade license to buy or sell. Licenses cost gold and are available in the Trade panel. Without a license, you cannot trade restricted goods at the market.' },
        { cat: 'Trading', title: 'Seasonal Demand', text: 'Some goods have seasonal price changes. Winter increases demand for wool, wood, and warm clothing. Summer boosts demand for water and light fabrics. Watch for 📈 seasonal demand markers in the trade panel.' },
        { cat: 'Trading', title: 'Trending Goods', text: 'Fashion trends cause certain goods to become popular, marked with 🔥 Trending in the market. Trending goods sell at higher prices — capitalize on these surges while they last.' },
        { cat: 'Trading', title: 'Street Trading', text: 'The Street Trading button (🤝) lets you buy and sell directly to NPCs on the street, sometimes at better prices than the market. This includes both legal goods and (if unlocked) banned goods.' },
        { cat: 'Trading', title: 'Banned Goods', text: 'Banned items are illegal to make or sell, but legal to buy or own in small amounts. Selling banned goods — whether personally or via caravan — carries risk. You may be caught and fined or jailed. Higher underworld skills reduce detection chance. The reward can be enormous. Caravans will show a 🚫 BANNED warning on sell orders for banned goods.' },
        { cat: 'Trading', title: 'Restricted Goods', text: 'Restricted goods are legal to buy, but illegal to sell or produce without a license. Purchase a license from the Kingdom menu. Licenses expire after a set period and must be renewed. Selling restricted goods without a license — personally or via caravan — carries smuggling risk similar to banned goods.' },
        { cat: 'Trading', title: 'Carrying Capacity', text: 'You can only carry a limited weight of goods. Your base capacity is 20 weight units. Horses, carts, and ships increase your carrying capacity. The trade panel shows your current load.' },
        { cat: 'Trading', title: 'Caravans', text: 'Hire caravans to automatically transport goods between towns. Caravans can be one-way, round-trip, or continuous. Guards protect your goods from bandits on dangerous routes. Selling banned or restricted goods via caravan carries the same smuggling risk as selling them yourself — your caravan crew may be caught, resulting in fines and jail time for you.' },
        { cat: 'Trading', title: 'Horse Transport', text: 'Road caravans can transport horses at no weight cost — horses walk alongside the carriers. Each carrier can handle up to 4 horses. Sea caravans treat horses as deck cargo at 15 weight each, taking up valuable ship capacity.' },
        { cat: 'Trading', title: 'Price Convergence', text: 'Connected towns slowly equalize prices over time through background trade. Isolated towns may have extreme price differences — these are the best trading opportunities.' },
        // SKILLS
        { cat: 'Skills', title: 'Skill Points', text: 'Earn skill points (SP) by leveling up through experience. Spend them in the Skills panel (📚) to unlock new abilities. Each skill costs 1-5 SP depending on power.' },
        { cat: 'Skills', title: 'Skill Branches', text: 'Skills are organized into 6 branches: Commerce, Industry, Transport, Social, Survival, and Underworld. Each branch unlocks different gameplay options. Some skills have prerequisites.' },
        { cat: 'Skills', title: 'Commerce Skills', text: 'Commerce skills improve your trading: Keen Eye shows price colors, Bulk Trader gives discounts on large purchases, Market Manipulator doubles your supply impact, and Tax Attorney reduces your tax burden.' },
        { cat: 'Skills', title: 'Industry Skills', text: 'Industry skills boost production: Efficient Logistics reduces building material costs, Property Magnate lets you own more buildings, and Herbalist doubles your herb gathering yield.' },
        { cat: 'Skills', title: 'Transport Skills', text: 'Transport skills improve travel: Cartographer speeds up road and off-road travel, Horse Mastery increases horse capacity and speed, and Regional Survey reveals nearby town information.' },
        { cat: 'Skills', title: 'Social Skills', text: 'Social skills help with relationships and politics: Court Etiquette improves petition success, Guild Negotiator helps with business deals, and Shrewd Negotiator gives better prices from NPCs.' },
        { cat: 'Skills', title: 'Survival Skills', text: 'Survival skills help you endure: First Aid lets you self-treat minor injuries, Field Medic lets you treat others for gold, Wilderness Survival improves foraging and rest outdoors, and Combat Proficiency helps in fights.' },
        { cat: 'Skills', title: 'Underworld Skills', text: 'Underworld skills enable risky but lucrative activities: Smugglers Run lets you cross closed borders, Blockade Runner lets you pass naval blockades, and Dark Connections opens access to shady deals.' },
        { cat: 'Skills', title: 'Merchant Tracker', text: 'A special skill that lets you track Elite Merchants on the map with a ⭐ star. Costs 1 skill point. The advanced version (Elite Tracker, 5 SP) gives you notifications about their activities.' },
        { cat: 'Skills', title: 'Medicine Skills', text: 'The Medicine branch includes First Aid (self-treat minor injuries), Herbalist (better herb yield), Field Medic (treat NPCs for gold), and Doctor (treat all injury severities). Medicine skills are especially useful in war-torn areas.' },
        // BUILDINGS
        { cat: 'Buildings', title: 'Owning Buildings', text: 'As you gain wealth and rank, you can buy and build buildings: farms, mines, workshops, shops, and more. Buildings generate income and produce goods that supply the local market.' },
        { cat: 'Buildings', title: 'Material Costs', text: 'Buildings require specific materials to construct: wood, planks, stone, bricks, iron, cloth, and rope. Costs are dynamic based on local market prices. If materials are unavailable, you cannot build.' },
        { cat: 'Buildings', title: 'Employees', text: 'Your buildings need workers. Hire NPCs from the town to work in your buildings. Better-skilled workers produce more. Pay fair wages to attract the best employees.' },
        { cat: 'Buildings', title: 'Production Buildings', text: 'Farms grow wheat and raise livestock. Mines extract ore and stone. Sawmills process logs into planks. Tanneries turn hides into leather. Each production chain creates value from raw materials.' },
        { cat: 'Buildings', title: 'Workshops & Crafting', text: 'Workshops and smithies process raw materials into finished goods. A smithy turns iron ore into weapons and tools. A weaving shop turns wool into cloth. These produce the most valuable goods.' },
        { cat: 'Buildings', title: 'Shops & Retail', text: 'General stores and specialty shops sell goods directly to townspeople. Stock them with goods from your inventory or warehouse. Retail prices include a markup above market price for profit.' },
        { cat: 'Buildings', title: 'Building Degradation', text: 'Buildings degrade over time and need repairs. Neglected buildings produce less and may eventually become unusable. Check your Buildings panel regularly and repair when condition drops.' },
        { cat: 'Buildings', title: 'Warehouses', text: 'Warehouses store goods safely. Without a warehouse, your goods are limited to what you can carry. Upgrade warehouse security to protect against theft. Some buildings come with built-in storage.' },
        // HOUSING
        { cat: 'Housing', title: 'Buying a Home', text: 'Homes provide better rest quality and storage space. Open the Housing panel (🏡) to see available housing in your current town. Better homes require higher ranks and more gold.' },
        { cat: 'Housing', title: 'Housing Types', text: 'From cheapest to most expensive: Tent, Shack, Cottage, Townhouse, Manor, Estate, Fortress, Castle. Each provides different rest quality, storage, and special features. Some require minimum social ranks.' },
        { cat: 'Housing', title: 'Housing Features', text: 'Homes can have special features: stables (improve horse rest), gardens (grow herbs and vegetables weekly), workshops (home crafting), and more. Better homes have more features.' },
        { cat: 'Housing', title: 'Home Crafting', text: 'If your home has a workshop, you can craft items like bandages, herbal remedies, rope, leather, and preserved food. Open the Housing panel and click Craft to see available recipes. You can craft once per day.' },
        { cat: 'Housing', title: 'Farmstead', text: 'The Farmstead housing type is affordable and grows food weekly. Great for self-sufficiency. Includes a garden that produces herbs and vegetables automatically.' },
        { cat: 'Housing', title: 'Harbor House', text: 'The Harbor House is available in port towns and gives a 10% discount on ship purchases and repairs. Ideal for seafaring merchants.' },
        { cat: 'Housing', title: 'Caravan Wagon', text: 'A portable home that lets you rest while traveling. Provides modest rest quality (4.5 energy per tick) anywhere on the map. Great for merchants who spend most of their time on the road.' },
        { cat: 'Housing', title: 'Upgrading Homes', text: 'You can upgrade your current home to a better type without buying a completely new one. The upgrade cost is the price difference. This preserves your stored items and home garden.' },
        // SHIPS
        { cat: 'Ships', title: 'Ship Overview', text: 'Ships let you travel between port towns by sea. They vary in speed, cargo capacity, combat defense, and addon slots. Buy ships from port towns using the Character panel.' },
        { cat: 'Ships', title: 'Ship Types', text: 'There are 10 ship types from the humble Rowboat to the mighty Man-o\'-War. Sloops and caravels are good for trading. Frigates and warships excel in combat. Choose based on your needs and budget.' },
        { cat: 'Ships', title: 'Ship Addons', text: 'Ships have addon slots for upgrades: Cabin (better rest), Cargo Hold (more storage), Armory (combat bonus), Medical Bay (heal at sea), Navigation (speed boost), Smuggling Hold (hidden cargo), and Fishing Nets (catch fish while sailing).' },
        { cat: 'Ships', title: 'Hull Health', text: 'Ships have hull health (0-100). Damage from storms, combat, or neglect reduces hull health. At 0, the ship sinks and cargo is lost. Repair your ship regularly at port towns.' },
        { cat: 'Ships', title: 'Ship Fishing', text: 'Fishing boats and ships with Fishing Nets addon can catch fish. Fishing boats catch fish automatically when docked. Nets catch fish while traveling by sea — a great passive income source.' },
        { cat: 'Ships', title: 'Naval Combat', text: 'Pirates may attack on sea routes. Your ship\'s defense, cannons, and hull health determine survival. Hiring guards and having an Armory addon improve your chances. Losing means cargo loss or ship damage.' },
        // TRAVEL
        { cat: 'Travel', title: 'Moving Between Towns', text: 'Click a town or use roads to travel. Travel takes time and energy. Roads are faster than off-road travel. Dangerous roads may have bandits.' },
        { cat: 'Travel', title: 'Roads & Safety', text: 'Roads connect towns and enable trade. Some roads are dangerous (☠️ on the map). Toll roads cost gold but are usually safer and faster. You can build toll roads at Guildmaster rank.' },
        { cat: 'Travel', title: 'Sea Travel', text: 'If you own a ship, you can travel between port towns via sea routes (yellow dashed lines on map). Sea travel can be faster for distant ports but requires a ship purchase.' },
        { cat: 'Travel', title: 'Free Travel', text: 'Right-click anywhere on the map to travel off-road to that location. This is slower than using roads but lets you reach any point on the map. Useful for reaching remote areas without roads.' },
        { cat: 'Travel', title: 'Kingdom Borders', text: 'Some kingdoms close their borders during wartime. Closed borders block travel through that kingdom unless you have the Smugglers Run skill to sneak across. Check kingdom status before planning routes.' },
        { cat: 'Travel', title: 'Kingdom Transport', text: 'Some kingdoms offer public transport between their towns. This costs a small fare but is convenient and safe. Check if the kingdom has a transport law enabled.' },
        { cat: 'Travel', title: 'Travel Rest', text: 'While traveling, your energy depletes. You can stop and rest on the road. Sleeping outside restores less energy than an inn. A Caravan Wagon home lets you rest comfortably anywhere.' },
        { cat: 'Travel', title: 'Horses', text: 'Horses increase your travel speed and carrying capacity. Buy them at the market. Horse Mastery skill further improves horse benefits. Horses with stables at home recover stamina faster.' },
        // WORK & JOBS
        { cat: 'Work', title: 'Finding Work', text: 'Open the Work panel (💼) to see available jobs in your current town. Jobs pay gold and grant experience. Different jobs require different minimum ranks and skills. Job duration varies from 5 to 60 ticks.' },
        { cat: 'Work', title: 'Building Jobs', text: 'Work at local buildings like farms, mines, and workshops. These are the most common jobs and are available to all ranks. Pay depends on the building type and local economy.' },
        { cat: 'Work', title: 'Apprentice Jobs', text: 'Work as an apprentice to learn a trade. Apprenticeships are longer but provide skill experience in addition to gold. Good for building up your abilities early in the game.' },
        { cat: 'Work', title: 'Merchant Jobs', text: 'At higher ranks, you can take merchant contracts: delivering goods between towns, negotiating deals, and managing trade agreements. These pay well but require travel.' },
        { cat: 'Work', title: 'Kingdom Jobs', text: 'Work directly for the kingdom: military service, tax collection, road building, and diplomatic missions. These build reputation and provide steady income. Available at Citizen rank and above.' },
        { cat: 'Work', title: 'Royal Court Jobs', text: 'At the highest ranks (Minor Noble+), you can work at the royal court: advising the king, managing state affairs, and conducting diplomatic missions. These pay the most and build political capital.' },
        { cat: 'Work', title: 'Odd Jobs', text: 'Quick jobs that are always available regardless of rank: street sweeping, message delivery, and manual labor. Low pay but good for emergencies when you need gold immediately.' },
        // KINGDOMS
        { cat: 'Kingdoms', title: 'Kingdom Overview', text: 'The world is divided into 4 kingdoms, each ruled by a king with unique personality. Kingdoms have their own taxes, laws, and military. Your social rank is tracked per kingdom.' },
        { cat: 'Kingdoms', title: 'King Personality', text: 'Kings have moods that affect their decisions: Jubilant kings lower taxes and build. Paranoid kings raise security. Wrathful kings may start wars. Ambitious kings expand territory. A king\'s mood changes based on events.' },
        { cat: 'Kingdoms', title: 'King Travel', text: 'Kings may embark on Royal Progress tours to visit their own towns (boosting happiness and prosperity) or Diplomatic Visits to foreign capitals (improving relations). Travel frequency depends on personality — ambitious/brave kings travel more, while paranoid/fearful kings stay home. Kings always return for tournaments and wars.' },
        { cat: 'Kingdoms', title: 'Laws & Taxes', text: 'Kings set tax rates and enact laws: price controls, immigration policy, inheritance tax, draft animals, and female succession. Laws affect your daily life — check the Kingdom Laws panel to see active laws.' },
        { cat: 'Kingdoms', title: 'War & Peace', text: 'Kingdoms can declare war on each other. War affects trade (prices spike, roads become dangerous), and towns in the frontline zone are marked with ⚔️. Caravans crossing war zones are at risk.' },
        { cat: 'Kingdoms', title: 'Conscription', text: 'During wartime, kingdoms may conscript citizens into military service. If conscripted, you must serve or face penalties. Higher social rank and political connections can help you avoid the draft.' },
        { cat: 'Kingdoms', title: 'Royal Commissions', text: 'Kings issue commissions — requests for specific goods to be delivered to the kingdom. Fulfilling commissions earns gold, reputation, and royal favor. Check the Royal Commissions panel.' },
        { cat: 'Kingdoms', title: 'Succession', text: 'When a king dies, succession follows: children first, then siblings, then royal advisors. Sometimes succession fails, creating a crisis period. You may be able to influence who takes the throne.' },
        { cat: 'Kingdoms', title: 'Citizenship', text: 'You can hold citizenship in multiple kingdoms simultaneously. Citizens get trade discounts and can access kingdom services. To gain citizenship, petition in a town of that kingdom with 40+ reputation, 90+ days residency, and the citizenship fee. Some kings enact an Exclusive Citizenship law that forbids dual citizenship — you must renounce other citizenships first, or wait for the law to be repealed. Your primary citizenship determines your home kingdom for tax purposes.' },
        { cat: 'Kingdoms', title: 'Petitions', text: 'You can petition the king for various favors: road construction, law changes, trade agreements. Petitions cost political capital and have a chance of success based on your rank and the king\'s mood.' },
        { cat: 'Kingdoms', title: 'Royal Court', text: 'At high social ranks, you gain access to the royal court. You can petition the king, spy for other kingdoms, or work toward becoming a Royal Advisor — the highest non-royal rank.' },
        { cat: 'Kingdoms', title: 'Kingdom Laws', text: 'Each kingdom has unique laws enacted by their king. Laws include: Guild Monopoly (rank required to build), Open Market (no tariffs), Closed Borders (foreigners restricted), Price Controls, Exclusive Citizenship (no dual citizenship), Female Succession, Inheritance Tax, Draft Animal Permits, and more. Kings may enact or repeal laws based on their personality and mood.' },
        // OUTPOSTS
        { cat: 'Outposts', title: 'Founding Outposts', text: 'At higher ranks, you can found outposts in the wilderness. Outposts cost 500g to establish and 3g/day to maintain. They serve as small trading posts and can grow into full towns if population reaches 15+.' },
        { cat: 'Outposts', title: 'Outpost Growth', text: 'Outposts attract settlers over time. When population reaches 15+, a nearby kingdom may annex the outpost into a village. This is how new towns are born in the world — you can shape the map!' },
        { cat: 'Outposts', title: 'Outpost Risks', text: 'Outposts face several dangers: 🦹 Bandit Raids (~3%/day) steal goods and injure workers — walls, guards, and a watchtower reduce risk dramatically. 🔥 Building Fires (~2%/day per building) damage condition and destroy inventory — a well reduces fire chance by 80%, and a watchtower helps spot fires early. 😞 Worker Desertion — workers leave without a tavern, chapel, or food hall. Upgrade housing from tents to cabins/cottages to improve retention. 🤒 Disease Outbreaks (~1%/day) infect multiple workers — a clinic and well nearly eliminate outbreaks. Build a well first, then walls and guards, then a tavern and clinic for a safe, productive outpost.' },
        // SOCIAL RANKS
        { cat: 'Ranks', title: 'Climbing the Ranks', text: 'Social rank determines what you can do. Start as a Peasant, work up through Citizen, Burgher, Guildmaster, Minor Noble, Lord, and Royal Advisor. Each rank requires gold, reputation, and skill thresholds.' },
        { cat: 'Ranks', title: 'Rank Benefits', text: 'Higher ranks unlock: property ownership (Citizen), processing buildings (Burgher), toll roads (Guildmaster), court access (Minor Noble), militia rights (Lord), and legislative power (Royal Advisor).' },
        { cat: 'Ranks', title: 'Peasant', text: 'Starting rank. Can work basic jobs, trade at markets, and rest at inns. Must earn enough gold and reputation to petition for Citizen rank.' },
        { cat: 'Ranks', title: 'Citizen', text: 'Can own basic buildings (farms, market stalls), hire workers, and access kingdom jobs. Getting here is your first major milestone.' },
        { cat: 'Ranks', title: 'Burgher', text: 'Can own processing buildings (workshops, smithies) and access merchant contracts. At this rank you can begin building a real trade empire.' },
        { cat: 'Ranks', title: 'Guildmaster', text: 'Can build toll roads and sea routes, own luxury buildings, and influence local politics. Guildmasters are respected members of the merchant community.' },
        { cat: 'Ranks', title: 'Minor Noble & Above', text: 'Minor Noble gives access to the royal court. Lord rank grants militia command. Royal Advisor is the pinnacle — you can advise the king and shape kingdom policy.' },
        // FAMILY & DYNASTY
        { cat: 'Family', title: 'Marriage', text: 'Find a spouse through courtship — build relationship to 20+, then Propose Courtship. Once accepted, unlock courtship activities (walks, meals, etc.). At relationship 60+, Propose Marriage to see acceptance odds, known traits, and risks before committing. Marriage provides companionship bonuses and the ability to have children.' },
        { cat: 'Family', title: 'Spouse Interactions', text: 'Interact with your spouse through 12 different actions: spend time together, give gifts, go on dates, ask for advice, and more. Keep your spouse happy — neglect damages the relationship.' },
        { cat: 'Family', title: 'Spouse Health', text: 'Your spouse has their own health, mood, and needs. They age over time and may develop health conditions. Keeping them well-fed and providing a good home improves their wellbeing.' },
        { cat: 'Family', title: 'Children & Heirs', text: 'Children grow up over time. When they reach adulthood (18), they become active members of society. Your eldest eligible child becomes your heir — if you die, you continue playing as them.' },
        { cat: 'Family', title: 'Teaching Children', text: 'You can teach your children skills and pass on knowledge. Teaching builds their abilities for when they eventually inherit. Invest in your children early for a stronger next generation.' },
        { cat: 'Family', title: 'Inheritance', text: 'When your character dies, you inherit as your heir. Your accumulated wealth, buildings, and reputation carry forward with some inheritance tax. Skills are partially inherited through XP bank.' },
        { cat: 'Family', title: 'Dynasty', text: 'Build a lasting dynasty! The game tracks your family across generations. Each successor carries the family name and legacy forward. The dynasty score combines all generations\' achievements.' },
        // ELITE MERCHANTS
        { cat: 'Elite Merchants', title: 'Who Are They?', text: 'Elite Merchants are the wealthiest and most powerful traders in the world. They have unique heraldry (house flags), travel between towns, and control significant market share. They are your main competitors.' },
        { cat: 'Elite Merchants', title: 'EM Strategies', text: 'Each EM has a strategy: trade_network (multi-town trading), luxury_trader (high-value goods), land_baron (property focused), military_supplier (weapons/armor), food_monopoly (food markets), political_climber (influence), or war_profiteer (exploits conflict).' },
        { cat: 'Elite Merchants', title: 'Interacting with EMs', text: 'You can talk to Elite Merchants, trade with them, track their movements (with the right skill), and compete for the same goods. Building relationships with EMs can open up opportunities.' },
        { cat: 'Elite Merchants', title: 'EM Caravans', text: 'Elite Merchants hire their own caravans to transport goods. These caravans follow profitable routes and can affect market prices in towns they visit. Watch their movements for trade intelligence.' },
        { cat: 'Elite Merchants', title: 'Becoming an EM', text: 'With enough wealth, buildings, and influence, you may eventually rival the Elite Merchants in power. Your gold and business empire are tracked on the leaderboard alongside theirs.' },
        // HEALTH & DANGER
        { cat: 'Health', title: 'Health Conditions', text: 'You may contract illnesses from poor housing, contaminated water, or plague events. Conditions reduce your effectiveness. Better housing provides disease resistance. Visit a hospital or clinic for treatment. Illnesses require medicines: Herbal Remedy (minor), Fever Tonic (moderate), Healing Tonic (serious), Antidote (severe). Higher-tier medicines can substitute for lower-tier.' },
        { cat: 'Health', title: 'Injuries', text: 'Combat and dangerous travel can cause injuries. Injuries require physical supplies: Bandages (all severities), Splint (moderate+), Herbal Poultice (serious+), Healing Tonic (severe). The First Aid skill lets you self-treat minor injuries; Field Medic handles moderate; Doctor handles all.' },
        { cat: 'Health', title: 'Medical Supplies', text: 'Injuries and illnesses use different supplies. Injuries: bandages + splint + poultice. Illnesses: herbal remedy → fever tonic → healing tonic → antidote (ranked by tier, higher can substitute lower). Healing Tonics require Apothecary Lv3+ to produce. Antidotes can only be made at an Advanced Apothecary.' },
        { cat: 'Health', title: 'Starvation', text: 'If hunger drops to 0, you begin starving. Starvation drains health every tick and can be fatal. Always carry emergency food. Bread and preserved food are lightweight and prevent starvation.' },
        { cat: 'Health', title: 'Plague Events', text: 'Plagues can sweep through towns, killing population and disrupting trade. During a plague, town happiness drops and prices for medicine spike. Stay away from plagued towns or stock up on medicine.' },
        // COMBAT & DANGER
        { cat: 'Combat', title: 'Bandits', text: 'Roads marked with ☠️ have bandit presence. Traveling these roads risks ambush. Higher combat skill and caravan guards reduce the danger.' },
        { cat: 'Combat', title: 'Combat System', text: 'Combat considers your weapons, armor, combat skills, and health. Equip weapons and armor from the Character panel. Hire guards for caravans. Combat Proficiency skill improves your chances.' },
        { cat: 'Combat', title: 'Weapons & Armor', text: 'Buy weapons (swords, bows) and armor from the market or smithies. Equipped items improve your combat rating. Higher quality equipment is more expensive but much more effective.' },
        { cat: 'Combat', title: 'Military Service', text: 'You can enlist as a soldier in a kingdom\'s army. Military service provides steady pay, combat experience, and reputation. But you must follow orders — desertion has consequences.' },
        // ECONOMY
        { cat: 'Economy', title: 'Town Prosperity', text: 'Each town has a prosperity score (0-100) based on buildings, population, food supply, and safety. Higher prosperity means better prices, more goods, and happier citizens. You can improve prosperity by building and trading.' },
        { cat: 'Economy', title: 'Town Happiness', text: 'Citizens\' happiness depends on food supply, security, taxation, and events. Unhappy towns have fewer workers and lower production. Extremely unhappy towns may see population exodus.' },
        { cat: 'Economy', title: 'Price Factors', text: 'Prices are affected by: base supply/demand, terrain type, seasonal demand, fashion trends, kingdom taxes, war disruption, trade convergence with nearby towns, and your citizen discount.' },
        { cat: 'Economy', title: 'Population Growth', text: 'Towns grow naturally when well-fed and safe. New settlements can be founded by kingdoms when existing towns are prosperous. Your outposts can also grow into new towns.' },
        // TIPS
        { cat: 'Tips', title: 'Making Money Fast', text: 'Buy goods where they are cheap (surplus towns) and sell where they are expensive (shortage towns). Coastal towns have cheap fish; mountain towns have cheap ore. Check multiple towns before committing to a trade route.' },
        { cat: 'Tips', title: 'Reputation Matters', text: 'Reputation in each kingdom determines what opportunities are available. Work for the kingdom, complete commissions, and avoid crimes to build reputation. High reputation unlocks rank promotions.' },
        { cat: 'Tips', title: 'Watch the Map', text: 'The minimap shows kingdom territories (colored regions), trade routes (yellow dashes), and danger zones. Towns with ⚠️ are unsafe. The ⚔️ symbol between territories means war.' },
        { cat: 'Tips', title: 'Diversify Income', text: 'Don\'t rely on just one income source. Combine trading, building production, toll roads, caravans, and jobs for a resilient income. When war disrupts trade, your buildings still produce.' },
        { cat: 'Tips', title: 'War Profiteering', text: 'Wars create trading opportunities. Military goods (weapons, arrows, armor) spike in price near war zones. Medical supplies become valuable. But travel near frontlines is dangerous — weigh risk vs reward.' },
        { cat: 'Tips', title: 'Early Game Strategy', text: 'Focus on: 1) Take odd jobs for initial gold, 2) Buy cheap goods and sell in the next town, 3) Save up for Citizen rank, 4) Buy your first building, 5) Hire workers and build passive income.' },
        { cat: 'Tips', title: 'Notification Filters', text: 'Too many notifications? Open Settings (⚙️) and filter by category. You can show only important notifications while hiding routine messages. Customize to focus on what matters to you.' },
        { cat: 'Tips', title: 'Check the Leaderboard', text: 'The Rankings panel shows how you compare to Elite Merchants and other powerful figures. Track your progress and aim to climb the ranks. Your dynasty score is cumulative across generations.' },
        // KINGDOM ORDERS & COMMISSIONS
        { cat: 'Kingdoms', title: 'Kingdom Procurement Orders', text: 'Kingdoms post procurement orders — contracts to supply specific goods at fixed prices (often above market rate). Find the <b>📋 Kingdom Orders</b> button in the town detail under <b>⚒️ Actions</b> (scroll down past Market Prices). You must be a <b>Citizen</b> of that kingdom and physically present in the town to see and bid on orders. Open Orders, My Orders, My Deals, and History tabs organize your procurement activity.' },
        { cat: 'Kingdoms', title: 'Commissions vs Orders', text: 'Royal Commissions (📦) are one-off requests from the king with gold + reputation rewards — great for building rep early. Kingdom Orders (📋) are formal procurement contracts you bid on and fulfill for guaranteed sales. Both are found in the <b>town detail panel</b> — Commissions button is above Market Prices, Orders is under ⚒️ Actions.' },
        { cat: 'Kingdoms', title: 'Finding Kingdom Features', text: 'Most kingdom features are in the <b>town detail panel</b> (click a town on the map). You\'ll find: 📜 Laws, 👑 King Actions, 📦 Commissions (always visible), and 📋 Kingdom Orders, 📜 Petitions (under ⚒️ Actions, requires citizenship). The Kingdoms button (👑) in the top bar shows a high-level overview of all kingdoms.' },
        // SCHEMES
        { cat: 'Kingdoms', title: 'Schemes', text: 'Open the Schemes panel to plot against rivals. Five categories: <b>Sabotage</b> (damage buildings/caravans), <b>Political</b> (slander, bribe officials), <b>Assassination</b> (eliminate rivals — very risky), <b>Tax Evasion</b> (hide income), and <b>Market Manipulation</b> (corner markets, spread rumors). Each scheme requires gold, skill, and sometimes specific ranks. Hover over scheme buttons for details.' },
        // NPC QUIRKS & SOCIAL ACTIONS
        { cat: 'Family', title: 'NPC Quirks & Traits', text: 'Every NPC has hidden <b>quirks</b> (personality traits like Ambitious, Lazy, Kleptomaniac, Thrifty). Quirks affect NPCs as workers in your buildings — boosting or reducing productivity, loyalty, material efficiency, and more. Quirks apply whether or not you\'ve discovered them, so investigating NPCs before hiring is a smart strategy.' },
        { cat: 'Family', title: 'Discovering Quirks', text: 'Use social actions on any NPC to uncover their quirks: <b>Observe</b> (8 hrs, 30% chance — spot behavioral quirks), <b>Ask Around</b> (4 hrs, 25% — learn reputation traits from others), <b>Investigate</b> (costs gold, 50% — deep background check). Discovered info appears in the NPC\'s detail panel under 🔍 Discovered Info.' },
        { cat: 'Family', title: 'Worker Quirk Effects', text: 'When an NPC works at your building, their quirks silently affect output. Effects include: production bonuses/penalties, material savings or waste, theft, breakage chance, quality modifiers for military goods, and loyalty (quit chance). Check an NPC\'s quirks before assigning them as workers to optimize your business.' },
        // RESOURCE DEPOSITS
        { cat: 'Economy', title: 'Resource Deposits', text: 'Towns have natural resource deposits (ore, stone, clay, etc.) that affect local supply and prices. With the <b>Regional Survey</b> skill, press <b>R</b> or click the <b>⛏ Deposits</b> button to toggle deposit icons above towns on the map. This helps you find the best locations for production buildings.' }
    ];

    function openGameGuide() {
        var overlay = document.createElement('div');
        overlay.id = 'game-guide-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;';

        var panel = document.createElement('div');
        panel.style.cssText = 'background:#1a1a2e; border:2px solid #FFD700; border-radius:8px; width:700px; max-height:80vh; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;';

        var header = '<div style="padding:12px 16px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">';
        header += '<span style="color:#FFD700; font-size:18px; font-weight:bold;">📖 Game Guide</span>';
        header += '<button data-action="removeOverlay" data-id="game-guide-overlay" style="background:#600; color:#fff; border:1px solid #a00; padding:4px 12px; cursor:pointer; border-radius:4px;">✖ Close</button>';
        header += '</div>';

        header += '<div style="padding:8px 16px; border-bottom:1px solid #333; display:flex; flex-wrap:wrap; align-items:center;">';
        header += '<input id="guide-search" type="text" placeholder="Search guide..." oninput="window._filterGuide()" style="width:200px; background:#2a2a3e; color:#fff; border:1px solid #555; padding:6px 10px; border-radius:4px; margin-right:8px; margin-bottom:4px;" />';
        var cats = ['All', 'Getting Started', 'Trading', 'Skills', 'Buildings', 'Housing', 'Ships', 'Travel', 'Work', 'Kingdoms', 'Outposts', 'Ranks', 'Family', 'Elite Merchants', 'Health', 'Combat', 'Economy', 'Tips'];
        for (var ci = 0; ci < cats.length; ci++) {
            header += '<button data-action="filterGuide" data-val="' + cats[ci] + '" style="margin:2px; padding:3px 8px; background:' + (ci === 0 ? '#FFD700' : '#2a2a3e') + '; color:' + (ci === 0 ? '#000' : '#ddd') + '; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;" id="guide-cat-' + cats[ci].replace(/ /g, '-') + '">' + cats[ci] + '</button>';
        }
        header += '</div>';

        panel.innerHTML = header + '<div id="guide-list" style="padding:8px 16px; overflow-y:auto; flex:1;"></div>';
        overlay.appendChild(panel);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        document.body.appendChild(overlay);

        window._gameGuideData = gameGuideData;
        window._guideCat = 'All';
        window._filterGuide();
    }

    window._filterGuide = function () {
        var search = (document.getElementById('guide-search') ? document.getElementById('guide-search').value : '').toLowerCase();
        var cat = window._guideCat || 'All';
        var list = document.getElementById('guide-list');
        if (!list) return;

        var html = '';
        var data = window._gameGuideData || [];
        var shown = 0;
        var lastCat = '';
        for (var i = 0; i < data.length; i++) {
            var d = data[i];
            if (cat !== 'All' && d.cat !== cat) continue;
            if (search && d.title.toLowerCase().indexOf(search) === -1 && d.text.toLowerCase().indexOf(search) === -1 && d.cat.toLowerCase().indexOf(search) === -1) continue;
            if (d.cat !== lastCat) {
                if (lastCat) html += '<div style="height:8px;"></div>';
                html += '<div style="color:#FFD700; font-size:13px; font-weight:bold; padding:8px 0 4px; border-bottom:1px solid #444; text-transform:uppercase; letter-spacing:1px;">' + d.cat + '</div>';
                lastCat = d.cat;
            }
            html += '<div style="padding:8px 0; border-bottom:1px solid #222;">';
            html += '<div style="color:#FFD700; font-size:14px; font-weight:bold; margin-bottom:4px;">' + d.title + '</div>';
            html += '<div style="color:#ccc; font-size:13px; line-height:1.5;">' + d.text + '</div>';
            html += '</div>';
            shown++;
        }
        if (shown === 0) html = '<div style="color:#888; padding:20px; text-align:center;">No guide entries match your search</div>';
        list.innerHTML = html;

        var cats = ['All', 'Getting Started', 'Trading', 'Skills', 'Buildings', 'Housing', 'Ships', 'Travel', 'Work', 'Kingdoms', 'Outposts', 'Ranks', 'Family', 'Elite Merchants', 'Health', 'Combat', 'Economy', 'Tips'];
        for (var ci = 0; ci < cats.length; ci++) {
            var btn = document.getElementById('guide-cat-' + cats[ci].replace(/ /g, '-'));
            if (btn) {
                btn.style.background = cats[ci] === cat ? '#FFD700' : '#2a2a3e';
                btn.style.color = cats[ci] === cat ? '#000' : '#ddd';
            }
        }
    };

    // ========================================================
    // GOODS GUIDE
    // ========================================================
    function openGoodsGuide() {
        var overlay = document.createElement('div');
        overlay.id = 'goods-guide-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;';

        var panel = document.createElement('div');
        panel.style.cssText = 'background:#1a1a2e; border:2px solid #FFD700; border-radius:8px; width:750px; max-height:85vh; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;';

        // Build goods data from CONFIG
        var goodsData = [];
        var BT = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES : (typeof CONFIG !== 'undefined' ? CONFIG.BUILDING_TYPES : {});
        var RT = typeof RESOURCE_TYPES !== 'undefined' ? RESOURCE_TYPES : (typeof CONFIG !== 'undefined' ? CONFIG.RESOURCE_TYPES : {});

        // Build producer/consumer lookup
        var producedBy = {};  // good -> [building names]
        var consumedBy = {};  // good -> [building names]
        var madeFrom = {};    // good -> [{ ingredients: { id: qty }, buildings: [name] }]
        var usedToMake = {};  // good -> [{ output, building }] (downstream products)

        // Helper: add recipe to madeFrom, grouping identical ingredient sets
        function _addRecipe(outputId, consumes, buildingName) {
            if (!madeFrom[outputId]) madeFrom[outputId] = [];
            var sig = JSON.stringify(consumes);
            for (var ri = 0; ri < madeFrom[outputId].length; ri++) {
                if (JSON.stringify(madeFrom[outputId][ri].ingredients) === sig) {
                    if (madeFrom[outputId][ri].buildings.indexOf(buildingName) === -1)
                        madeFrom[outputId][ri].buildings.push(buildingName);
                    return;
                }
            }
            madeFrom[outputId].push({ ingredients: Object.assign({}, consumes), buildings: [buildingName] });
        }

        for (var bk in BT) {
            var b = BT[bk];
            // Default recipe
            if (b.produces) {
                if (!producedBy[b.produces]) producedBy[b.produces] = [];
                producedBy[b.produces].push(b.name);
                if (b.consumes) {
                    _addRecipe(b.produces, b.consumes, b.name);
                    for (var ci3a in b.consumes) {
                        if (!usedToMake[ci3a]) usedToMake[ci3a] = [];
                        usedToMake[ci3a].push({ output: b.produces, building: b.name });
                    }
                }
            }
            if (b.consumes) {
                for (var cId in b.consumes) {
                    if (!consumedBy[cId]) consumedBy[cId] = [];
                    consumedBy[cId].push(b.name);
                }
            }
            // Alternative recipes
            if (b.availableProducts) {
                for (var apk in b.availableProducts) {
                    var ap = b.availableProducts[apk];
                    var _apOut = ap.produces || apk;
                    if (!producedBy[_apOut]) producedBy[_apOut] = [];
                    producedBy[_apOut].push(b.name);
                    if (ap.consumes) {
                        _addRecipe(_apOut, ap.consumes, b.name);
                        for (var acId in ap.consumes) {
                            if (!usedToMake[acId]) usedToMake[acId] = [];
                            usedToMake[acId].push({ output: _apOut, building: b.name });
                            if (!consumedBy[acId]) consumedBy[acId] = [];
                            consumedBy[acId].push(b.name);
                        }
                    }
                }
            }
            if (b.materials) {
                for (var mId in b.materials) {
                    if (!consumedBy[mId]) consumedBy[mId] = [];
                    consumedBy[mId].push(b.name + ' (construction)');
                }
            }
        }

        // Helper: resource name lookup
        var resName = {};
        for (var rnk in RT) { resName[RT[rnk].id] = (RT[rnk].icon || '') + ' ' + RT[rnk].name; }

        // Build use descriptions per good
        for (var rk in RT) {
            var r = RT[rk];
            var lines = [];
            // Category description
            var desc = '';
            if (r.category === 'food') desc = 'Consumed by population for sustenance.';
            else if (r.category === 'beverage') desc = 'Consumed for thirst and morale.';
            else if (r.category === 'military') desc = 'Used to equip garrisons and armies.';
            else if (r.category === 'luxury') desc = 'Boosts town prosperity and happiness.';
            else if (r.category === 'contraband') desc = 'Illegal in most kingdoms — high risk, high reward.';
            else if (r.category === 'livestock') desc = 'Livestock for breeding and production.';
            else if (r.category === 'supplies') desc = 'Travel and camping supplies.';
            else if (r.category === 'raw') desc = 'Raw material for processing and construction.';
            else if (r.category === 'processed') desc = 'Processed material for crafting and building.';
            else if (r.category === 'finished') desc = 'Finished goods for sale to population.';
            else if (r.category === 'medical') desc = 'Medical supplies for treating injuries and illness.';
            else if (r.category === 'quest') desc = 'Rare quest item.';

            // Supply chain section
            var chainHtml = '<div style="margin-top:4px; padding:4px 8px; background:rgba(255,255,255,0.04); border-radius:4px; font-size:11px; line-height:1.6;">';
            var hasChain = false;

            // Ingredients (what this good is made from)
            if (madeFrom[r.id] && madeFrom[r.id].length > 0) {
                hasChain = true;
                if (madeFrom[r.id].length === 1) {
                    var _rec = madeFrom[r.id][0];
                    var ingList = [];
                    for (var ik in _rec.ingredients) {
                        ingList.push((resName[ik] || ik) + ' ×' + _rec.ingredients[ik]);
                    }
                    chainHtml += '<div>📥 <span style="color:#7cb342;">Made from:</span> ' + ingList.join(', ') + '</div>';
                } else {
                    for (var ri2 = 0; ri2 < madeFrom[r.id].length; ri2++) {
                        var _rec2 = madeFrom[r.id][ri2];
                        var ingList2 = [];
                        for (var ik2 in _rec2.ingredients) {
                            ingList2.push((resName[ik2] || ik2) + ' ×' + _rec2.ingredients[ik2]);
                        }
                        var bldNames = _rec2.buildings.filter(function(v,i,a){return a.indexOf(v)===i;}).join(', ');
                        chainHtml += '<div>📥 <span style="color:#7cb342;">Recipe ' + (ri2 + 1) + ':</span> ' + ingList2.join(', ') + ' <span style="color:#888;">(' + bldNames + ')</span></div>';
                    }
                }
            } else if (producedBy[r.id] && producedBy[r.id].length > 0) {
                hasChain = true;
                chainHtml += '<div>📥 <span style="color:#7cb342;">Source:</span> Gathered/harvested (no inputs)</div>';
            }

            // Produced at
            if (producedBy[r.id] && producedBy[r.id].length > 0) {
                hasChain = true;
                var unique = producedBy[r.id].filter(function(v,i,a){return a.indexOf(v)===i;});
                chainHtml += '<div>🏭 <span style="color:#64b5f6;">Produced at:</span> ' + unique.join(', ') + '</div>';
            }

            // Used to make (downstream goods)
            if (usedToMake[r.id] && usedToMake[r.id].length > 0) {
                hasChain = true;
                var outputs = {};
                for (var ui2 = 0; ui2 < usedToMake[r.id].length; ui2++) {
                    var out = usedToMake[r.id][ui2].output;
                    if (!outputs[out]) outputs[out] = [];
                    outputs[out].push(usedToMake[r.id][ui2].building);
                }
                var outList = [];
                for (var ok in outputs) {
                    var uniqueB = outputs[ok].filter(function(v,i,a){return a.indexOf(v)===i;});
                    outList.push((resName[ok] || ok) + ' <span style="color:#888;">(' + uniqueB.join(', ') + ')</span>');
                }
                chainHtml += '<div>📤 <span style="color:#ffb74d;">Used to make:</span> ' + outList.join(' · ') + '</div>';
            }

            // Consumed by buildings (non-production uses like construction)
            var buildConsumers = consumedBy[r.id] ? consumedBy[r.id].filter(function(v,i,a){return a.indexOf(v)===i;}) : [];
            var constructionUses = buildConsumers.filter(function(n){ return n.indexOf('(construction)') >= 0; });
            if (constructionUses.length > 0) {
                hasChain = true;
                chainHtml += '<div>🏗️ <span style="color:#ba68c8;">Construction:</span> ' + constructionUses.slice(0, 8).join(', ') + (constructionUses.length > 8 ? ' +' + (constructionUses.length - 8) + ' more' : '') + '</div>';
            }

            chainHtml += '</div>';

            // Medical treatment usage — show which conditions each medical good treats
            if (r.category === 'medical') {
                var _medUsage = {
                    bandages:        '🩹 Treats all injury severities. Basic wound care supply.',
                    splint:          '🦴 Treats moderate+ injuries. Stabilizes fractures.',
                    herbal_poultice: '🌱 Treats serious+ injuries. Reduces swelling and infection.',
                    herbal_remedy:   '🧪 Treats minor illness. Lowest-tier medicine.',
                    fever_tonic:     '🌡️ Treats moderate illness. Can substitute for Herbal Remedy.',
                    healing_tonic:   '⚗️ Treats serious illness and severe injuries. Requires Apothecary Lv3+ or Advanced Apothecary to produce. Can substitute for Fever Tonic or Herbal Remedy.',
                    antidote:        '💊 Treats severe illness (plagues). Only produced at Advanced Apothecary. Can substitute for any lower-tier medicine.',
                };
                var _medSub = {
                    antidote:      'Can replace: Healing Tonic, Fever Tonic, Herbal Remedy',
                    healing_tonic: 'Can replace: Fever Tonic, Herbal Remedy',
                    fever_tonic:   'Can replace: Herbal Remedy',
                };
                if (_medUsage[r.id]) {
                    hasChain = true;
                    chainHtml = chainHtml.replace('</div><!--med-->', '');
                    var _medHtml = '<div style="margin-top:4px; padding:4px 8px; background:rgba(100,255,100,0.04); border-left:2px solid #55a868; border-radius:4px; font-size:11px; line-height:1.6;">';
                    _medHtml += '<div>💉 <span style="color:#55a868;">Treatment use:</span> ' + _medUsage[r.id] + '</div>';
                    if (_medSub[r.id]) {
                        _medHtml += '<div>🔄 <span style="color:#64b5f6;">Substitution:</span> ' + _medSub[r.id] + '</div>';
                    }
                    _medHtml += '</div>';
                    desc += _medHtml;
                }
            }

            // Quality crafting info for tier goods
            if (r.tier === 'basic' && !r.baseItem) {
                // Base item that has quality variants — add a note
                var _qc0 = typeof CONFIG !== 'undefined' && CONFIG.QUALITY_CRAFTING ? CONFIG.QUALITY_CRAFTING : null;
                if (_qc0) {
                    var _hasVariants = false;
                    for (var _rvk in RT) { if (RT[_rvk].baseItem === r.id) { _hasVariants = true; break; } }
                    if (_hasVariants) {
                        hasChain = true;
                        var _bInfo = '<div style="margin-top:4px; padding:4px 8px; background:rgba(255,255,255,0.04); border-left:2px solid #aaa; border-radius:4px; font-size:11px; line-height:1.6;">';
                        _bInfo += '<div>⚪ <span style="color:#aaa;">Basic Tier</span> — standard quality. Set building recipe to Good or Excellent to attempt higher tiers (RNG-based, higher material cost).</div>';
                        _bInfo += '</div>';
                        desc += _bInfo;
                    }
                }
            } else if (r.tier && r.baseItem) {
                hasChain = true;
                var _qc = typeof CONFIG !== 'undefined' && CONFIG.QUALITY_CRAFTING ? CONFIG.QUALITY_CRAFTING : null;
                var _qt = typeof CONFIG !== 'undefined' && CONFIG.QUALITY_TIERS ? CONFIG.QUALITY_TIERS : null;
                var _eqm = typeof CONFIG !== 'undefined' ? CONFIG.SOLDIER_EQUIPMENT_QUALITY_MULT : null;
                var _tierInfo = '';
                if (r.tier === 'good' && _qc && _qc.good) {
                    var _bc = Math.round(_qc.good.baseChance * 100);
                    var _mc = Math.round(_qc.good.maxChance * 100);
                    var _ps = Math.round(_qc.good.playerSkillBonus * 100);
                    var _isWeapon = _qc.WEAPON_BASE_ITEMS && _qc.WEAPON_BASE_ITEMS.indexOf(r.baseItem) >= 0;
                    var _skillName = _isWeapon ? 'Good Weaponcraft' : 'Good Armorcraft';
                    var _eqMult = _eqm && _eqm.good ? _eqm.good + '×' : '';
                    _tierInfo += '<div style="margin-top:4px; padding:4px 8px; background:rgba(80,160,255,0.06); border-left:2px solid #64b5f6; border-radius:4px; font-size:11px; line-height:1.6;">';
                    _tierInfo += '<div>🔵 <span style="color:#64b5f6;">Good Quality Tier</span> — uses higher material cost, RNG chance to craft.</div>';
                    _tierInfo += '<div>🎲 <span style="color:#7cb342;">Chance:</span> ' + _bc + '% base (max ' + _mc + '%). Increased by worker skill and <b>' + _skillName + '</b> player skill (+' + _ps + '%).</div>';
                    _tierInfo += '<div>⚔️ <span style="color:#ffb74d;">Benefits:</span> +10% combat effectiveness. Sells for 3× base price.';
                    if (_eqMult) _tierInfo += ' Soldiers equipped: ' + _eqMult + ' effectiveness.';
                    _tierInfo += '</div>';
                    _tierInfo += '<div>🔄 <span style="color:#aaa;">On failure:</span> Produces basic version instead (materials still consumed at higher cost).</div>';
                    _tierInfo += '</div>';
                } else if (r.tier === 'excellent' && _qc && _qc.excellent) {
                    var _bc2 = Math.round(_qc.excellent.baseChance * 100);
                    var _mc2 = Math.round(_qc.excellent.maxChance * 100);
                    var _ps2 = Math.round(_qc.excellent.playerSkillBonus * 100);
                    var _isWeapon2 = _qc.WEAPON_BASE_ITEMS && _qc.WEAPON_BASE_ITEMS.indexOf(r.baseItem) >= 0;
                    var _skillName2 = _isWeapon2 ? 'Excellent Weaponcraft' : 'Excellent Armorcraft';
                    var _eqMult2 = _eqm && _eqm.excellent ? _eqm.excellent + '×' : '';
                    _tierInfo += '<div style="margin-top:4px; padding:4px 8px; background:rgba(160,80,255,0.06); border-left:2px solid #ba68c8; border-radius:4px; font-size:11px; line-height:1.6;">';
                    _tierInfo += '<div>🟣 <span style="color:#ba68c8;">Excellent Quality Tier</span> — highest material cost, lowest craft chance.</div>';
                    _tierInfo += '<div>🎲 <span style="color:#7cb342;">Chance:</span> ' + _bc2 + '% base (max ' + _mc2 + '%). Requires <b>' + _skillName2 + '</b> player skill (+' + _ps2 + '%).</div>';
                    _tierInfo += '<div>🔄 <span style="color:#64b5f6;">Cascade:</span> If excellent roll fails → rolls for good quality → if that also fails → produces basic.</div>';
                    _tierInfo += '<div>⚔️ <span style="color:#ffb74d;">Benefits:</span> +20% combat effectiveness. Sells for 9× base price.';
                    if (_eqMult2) _tierInfo += ' Soldiers equipped: ' + _eqMult2 + ' effectiveness.';
                    _tierInfo += '</div>';
                    _tierInfo += '</div>';
                }
                desc += _tierInfo;
            }

            desc += (hasChain ? chainHtml : '');

            goodsData.push({ id: r.id, name: r.name, icon: r.icon || '', category: r.category || '?', basePrice: r.basePrice || 0, weight: r.weight || 1, desc: desc });
        }

        // Sort by category then name
        var catOrder = ['raw', 'processed', 'food', 'beverage', 'finished', 'military', 'luxury', 'medical', 'supplies', 'livestock', 'contraband', 'quest'];
        goodsData.sort(function(a, b) {
            var ai = catOrder.indexOf(a.category); if (ai < 0) ai = 99;
            var bi = catOrder.indexOf(b.category); if (bi < 0) bi = 99;
            if (ai !== bi) return ai - bi;
            return a.name.localeCompare(b.name);
        });

        // Header
        var header = '<div style="padding:12px 16px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">';
        header += '<span style="color:#FFD700; font-size:18px; font-weight:bold;">📦 Goods Guide</span>';
        header += '<button data-action="removeOverlay" data-id="goods-guide-overlay" style="background:#600; color:#fff; border:1px solid #a00; padding:4px 12px; cursor:pointer; border-radius:4px;">✖ Close</button>';
        header += '</div>';

        // Filter bar
        header += '<div style="padding:8px 16px; border-bottom:1px solid #333; display:flex; flex-wrap:wrap; align-items:center;">';
        header += '<input id="goods-search" type="text" placeholder="Search goods..." style="width:200px; background:#2a2a3e; color:#fff; border:1px solid #555; padding:6px 10px; border-radius:4px; margin-right:8px;" />';
        var catLabels = { raw: '🪨 Raw', processed: '⚙️ Processed', food: '🍞 Food', beverage: '🍺 Beverage', finished: '🏭 Finished', military: '⚔️ Military', luxury: '💎 Luxury', medical: '🩹 Medical', supplies: '🏕️ Supplies', livestock: '🐄 Livestock', contraband: '☠️ Contraband', quest: '🏆 Quest' };
        header += '<button data-action="filterGoods" data-val="all" style="margin:2px; padding:3px 8px; background:#FFD700; color:#000; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;" id="goods-cat-all">All</button>';
        for (var ci2 = 0; ci2 < catOrder.length; ci2++) {
            var cat = catOrder[ci2];
            header += '<button data-action="filterGoods" data-val="' + cat + '" style="margin:2px; padding:3px 8px; background:#2a2a3e; color:#ddd; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;" id="goods-cat-' + cat + '">' + (catLabels[cat] || cat) + '</button>';
        }
        header += '</div>';

        panel.innerHTML = header + '<div id="goods-list" style="padding:8px 16px; overflow-y:auto; flex:1;"></div>';
        overlay.appendChild(panel);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        window._goodsData = goodsData;
        window._goodsCat = 'all';

        // Search handler
        var searchEl = document.getElementById('goods-search');
        if (searchEl) searchEl.addEventListener('input', function() { window._filterGoods(); });

        window._filterGoods();
    }

    window._filterGoods = function() {
        var search = (document.getElementById('goods-search') ? document.getElementById('goods-search').value : '').toLowerCase();
        var cat = window._goodsCat || 'all';
        var list = document.getElementById('goods-list');
        if (!list) return;

        var data = window._goodsData || [];
        var html = '';
        var lastCat = '';
        var shown = 0;
        var catLabels = { raw: '🪨 Raw Materials', processed: '⚙️ Processed Materials', food: '🍞 Food', beverage: '🍺 Beverages', finished: '🏭 Finished Goods', military: '⚔️ Military', luxury: '💎 Luxury', medical: '🩹 Medical', supplies: '🏕️ Supplies', livestock: '🐄 Livestock', contraband: '☠️ Contraband', quest: '🏆 Quest Items' };

        for (var i = 0; i < data.length; i++) {
            var g = data[i];
            if (cat !== 'all' && g.category !== cat) continue;
            if (search && g.name.toLowerCase().indexOf(search) === -1 && g.desc.toLowerCase().indexOf(search) === -1 && g.id.toLowerCase().indexOf(search) === -1) continue;
            if (g.category !== lastCat) {
                if (lastCat) html += '<div style="height:8px;"></div>';
                html += '<div style="color:#FFD700; font-size:13px; font-weight:bold; padding:8px 0 4px; border-bottom:1px solid #444; text-transform:uppercase; letter-spacing:1px;">' + (catLabels[g.category] || g.category) + '</div>';
                lastCat = g.category;
            }
            html += '<div style="padding:6px 0; border-bottom:1px solid #222; display:flex; align-items:flex-start; gap:8px;">';
            html += '<span style="font-size:20px; min-width:28px; text-align:center;">' + g.icon + '</span>';
            html += '<div style="flex:1;">';
            html += '<span style="color:#FFD700; font-weight:bold;">' + g.name + '</span>';
            html += ' <span style="color:#888; font-size:11px;">(' + g.id + ')</span>';
            html += ' <span style="color:#aaa; font-size:11px;">| Base: ' + g.basePrice + 'g | Wt: ' + g.weight + '</span>';
            html += '<div style="color:#ccc; font-size:12px; line-height:1.4; margin-top:2px;">' + g.desc + '</div>';
            html += '</div></div>';
            shown++;
        }
        if (shown === 0) html = '<div style="color:#888; padding:20px; text-align:center;">No goods match your search</div>';
        list.innerHTML = html;

        // Update category button highlights
        var allCats = ['all', 'raw', 'processed', 'food', 'beverage', 'finished', 'military', 'luxury', 'medical', 'supplies', 'livestock', 'contraband', 'quest'];
        for (var ci3 = 0; ci3 < allCats.length; ci3++) {
            var btn = document.getElementById('goods-cat-' + allCats[ci3]);
            if (btn) {
                btn.style.background = allCats[ci3] === cat ? '#FFD700' : '#2a2a3e';
                btn.style.color = allCats[ci3] === cat ? '#000' : '#ddd';
            }
        }
    };

    // ========================================================
    // ADVISE THE KING DIALOG
    // ========================================================
    function openAdviseKingDialog(kingdomId) {
        if (typeof Player === 'undefined' || !Player.royalAdvisorBenefits) return;

        let kingdom;
        try { kingdom = Engine.getKingdom(kingdomId); } catch (e) { return; }
        if (!kingdom) return;

        const capital = Player.politicalCapital || 0;
        let html = `<div class="detail-section">
            <p>As Royal Advisor, you may counsel the King of ${kingdom.name}.</p>
            <p><b>Political Capital:</b> ${capital} / ${CONFIG.ADVISE_KING_POLITICAL_CAPITAL_MAX} uses remaining this season</p>
            ${capital <= 0 ? '<p style="color:var(--danger)">No political capital remaining. Wait until next season.</p>' : ''}
        </div>`;

        if (capital > 0) {
            html += `<div class="detail-section"><h3>Counsel Options</h3>`;

            html += `<div class="detail-row" style="cursor:pointer" data-action="executeAdvice" data-kingdom="${kingdomId}" data-type="lower_taxes">
                <span class="label">📉 Lower Taxes</span>
                <span class="value text-dim">Suggest reducing kingdom tax rate</span>
            </div>`;
            html += `<div class="detail-row" style="cursor:pointer" data-action="executeAdvice" data-kingdom="${kingdomId}" data-type="raise_taxes">
                <span class="label">📈 Raise Taxes</span>
                <span class="value text-dim">Suggest increasing kingdom tax rate</span>
            </div>`;
            html += `<div class="detail-row" style="cursor:pointer" data-action="executeAdvice" data-kingdom="${kingdomId}" data-type="build_walls">
                <span class="label">🏰 Fortify Towns</span>
                <span class="value text-dim">Suggest building fortifications</span>
            </div>`;

            // War/Peace options
            let kingdoms;
            try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
            const enemies = kingdoms.filter(k => k.id !== kingdomId && kingdom.atWar && (kingdom.atWar.has ? kingdom.atWar.has(k.id) : kingdom.atWar.includes(k.id)));
            const potentials = kingdoms.filter(k => k.id !== kingdomId && (!kingdom.atWar || !(kingdom.atWar.has ? kingdom.atWar.has(k.id) : kingdom.atWar.includes(k.id))));

            if (enemies.length > 0) {
                for (const enemy of enemies) {
                    html += `<div class="detail-row" style="cursor:pointer" data-action="executeAdvice" data-kingdom="${kingdomId}" data-type="make_peace" data-val="${enemy.id}">
                        <span class="label">🕊️ Seek Peace with ${enemy.name}</span>
                        <span class="value text-dim">End the war diplomatically</span>
                    </div>`;
                }
            }
            if (potentials.length > 0) {
                for (const pot of potentials.slice(0, 3)) {
                    html += `<div class="detail-row" style="cursor:pointer" data-action="executeAdvice" data-kingdom="${kingdomId}" data-type="declare_war" data-val="${pot.id}">
                        <span class="label">⚔ Provoke ${pot.name}</span>
                        <span class="value text-dim">Worsen relations (may lead to war)</span>
                    </div>`;
                }
            }

            html += `</div>`;
        }

        openModal('👑 Advise the King', html);
    }

    function executeAdvice(kingdomId, adviceType, adviceValue) {
        if (typeof Player === 'undefined' || !Player.adviseKing) return;
        const result = Player.adviseKing(kingdomId, adviceType, adviceValue);
        if (result && result.success) {
            toast(result.reason, 'success');
        } else {
            toast(result ? result.reason : 'Advice failed.', 'warning');
        }
        closeModal();
    }

    // ========================================================
    // KING DIRECTED COMMISSION UI
    // ========================================================
    function openKingCommissionDialog(kingdomId) {
        if (typeof Player === 'undefined') return;
        if (!kingdomId) {
            var ps = Player.state;
            if (ps) kingdomId = ps.citizenshipKingdomId;
        }
        if (!kingdomId) { toast('No kingdom.', 'warning'); return; }

        var comm = Player.getActiveKingCommission(kingdomId);
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        var kName = kingdom ? kingdom.name : 'the kingdom';

        var html = '<div class="detail-section">';
        html += '<h3 style="color:var(--gold);">👑 Royal Commission from ' + kName + '</h3>';

        if (!comm) {
            html += '<p style="color:var(--text-secondary);">No active commission from the king at this time.</p>';
            html += '<p class="text-dim">The king may assign you a commission based on your production capabilities.</p>';
            html += '</div>';
            openModal('👑 King\'s Commission', html);
            return;
        }

        // Urgency colors
        var urgColor = comm.urgency === 'desperate' ? 'var(--danger)' : (comm.urgency === 'urgent' ? '#ffa500' : 'var(--text-secondary)');
        var urgLabel = comm.urgency === 'desperate' ? '🔴 DESPERATE' : (comm.urgency === 'urgent' ? '🟠 URGENT' : '🟢 Normal');
        var daysLeft = comm.deadlineDay - (Engine.getDay ? Engine.getDay() : 0);

        html += '<div style="margin:10px 0;padding:10px;background:rgba(0,0,0,0.3);border-radius:6px;">';
        html += '<div style="font-size:1.1em;font-weight:bold;">' + comm.description + '</div>';
        html += '<div style="margin-top:8px;">';
        html += '<span style="color:' + urgColor + ';">' + urgLabel + '</span> | ';
        html += '<span style="color:#ffd700;">💰 Reward: ' + comm.reward + 'g</span> | ';
        html += '<span style="color:#6bff6b;">⭐ Rep: +' + comm.repReward + '</span>';
        html += '</div>';
        html += '<div style="margin-top:5px;color:var(--text-secondary);">⏳ ' + (daysLeft > 0 ? daysLeft + ' days remaining' : '<span style="color:var(--danger);">OVERDUE!</span>') + '</div>';
        if (comm.matchesProduction) {
            html += '<div style="margin-top:5px;color:#6bff6b;">✅ Matches your production capabilities</div>';
        }
        html += '</div>';

        if (comm.status === 'pending') {
            // Player needs to accept or refuse
            if (comm.lordMandatory) {
                html += '<div style="margin:10px 0;padding:8px;background:rgba(255,0,0,0.1);border:1px solid var(--danger);border-radius:4px;">';
                html += '⚠️ <b>As a Lord, this commission is mandatory.</b> Refusing will result in immediate demotion to Minor Noble and -20 reputation.';
                html += '</div>';
            } else {
                html += '<div style="margin:10px 0;color:var(--text-secondary);">';
                html += 'As a Minor Noble, you may refuse this commission, but your reputation will suffer.';
                html += '</div>';
            }
            html += '<div style="display:flex;gap:10px;margin-top:10px;">';
            html += '<button class="btn-medieval" style="flex:1;background:var(--accent-green,#2a7a2a);" data-action="acceptCommissionUI" data-id="' + kingdomId + '">✅ Accept Commission</button>';
            html += '<button class="btn-medieval" style="flex:1;background:var(--danger,#8a2a2a);" data-action="refuseCommissionUI" data-id="' + kingdomId + '">❌ Refuse</button>';
            html += '</div>';
        } else if (comm.status === 'accepted') {
            // v9p33river515: progress now counts inventory + town storage +
            // player-owned building storage at current town (kingdom-matched).
            var _availInfo = null;
            try { _availInfo = Engine.getDirectedCommissionAvailableQty(kingdomId); } catch (e) {}
            var has, _carried = 0, _stored = 0, _bldgQty = 0, _locOK = false;
            if (_availInfo) {
                has = _availInfo.total;
                _carried = _availInfo.carried;
                _stored = _availInfo.townStorage;
                _bldgQty = _availInfo.buildingStorage;
                _locOK = _availInfo.locationOK;
            } else {
                var inv = Player.state ? Player.state.inventory || {} : {};
                has = comm.resourceId ? (inv[comm.resourceId] || 0) : 0;
                _carried = has;
            }
            var pct = comm.quantity > 0 ? Math.min(100, Math.floor((has / comm.quantity) * 100)) : 0;
            var canDeliver = has >= comm.quantity;

            html += '<div style="margin:10px 0;">';
            html += '<div style="margin-bottom:5px;"><b>Progress:</b> ' + has + ' / ' + comm.quantity + ' (' + pct + '%)</div>';
            // Breakdown of sources contributing to progress
            var _parts = [];
            _parts.push('🎒 ' + _carried + ' carried');
            if (_stored > 0) _parts.push('🏪 ' + _stored + ' in town storage');
            if (_locOK && _bldgQty > 0) _parts.push('🏭 ' + _bldgQty + ' in your buildings here');
            html += '<div style="font-size:0.8em;color:var(--text-secondary);margin-bottom:5px;">' + _parts.join(' &middot; ') + '</div>';
            if (!_locOK) {
                html += '<div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:5px;font-style:italic;">Travel to a town in ' + kName + ' to also count goods stored in your buildings there.</div>';
            }
            html += '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:12px;overflow:hidden;">';
            html += '<div style="background:' + (canDeliver ? '#4caf50' : '#ffa500') + ';height:100%;width:' + pct + '%;transition:width 0.3s;"></div>';
            html += '</div>';
            html += '</div>';

            if (canDeliver) {
                html += '<button class="btn-medieval" style="width:100%;background:var(--accent-green,#2a7a2a);" data-action="deliverCommissionUI" data-id="' + kingdomId + '">📦 Deliver Commission</button>';
            } else {
                html += '<p style="color:var(--text-secondary);">Gather the required goods and return to deliver.</p>';
            }
        } else {
            html += '<p style="color:var(--text-secondary);">Status: ' + (comm.status || 'unknown') + '</p>';
        }
        html += '</div>';
        openModal('👑 King\'s Commission', html);
    }

    function acceptCommissionUI(kingdomId) {
        var result = Player.acceptKingCommission(kingdomId);
        if (result && result.success) {
            closeModal();
            openKingCommissionDialog(kingdomId);
        }
    }

    function refuseCommissionUI(kingdomId) {
        var result = Player.refuseKingCommission(kingdomId);
        closeModal();
    }

    function deliverCommissionUI(kingdomId) {
        var result = Player.deliverKingCommission(kingdomId);
        if (result && result.success) {
            // Track for platinum achievements
            if (typeof Player !== 'undefined' && Player.state) {
                var pt = Player.state._platinumTracking;
                if (pt) {
                    pt.commissionsCompleted = (pt.commissionsCompleted || 0) + 1;
                    // v9p33river323: deliverKingCommission returns result.qty
                    // (see player.js:12686), not result.quantity. Was always
                    // adding 0 to commissionGoodsTotal.
                    pt.commissionGoodsTotal = (pt.commissionGoodsTotal || 0) + (result.qty || result.quantity || 0);
                }
            }
            closeModal();
        }
    }

    // ========================================================
    // ROYAL ADVISOR — PROPOSE LAWS UI
    // ========================================================
    // ========================================================
    // KINGDOM BUILDING CONSTRUCTION DIALOG
    // ========================================================
    function openKingdomBuildDialog(townId, kingdomId) {
        if (typeof Player === 'undefined' || !Player.getKingdomBuildableTypes || !Player.requestKingdomBuilding) {
            toast('Kingdom construction not available.', 'warning'); return;
        }
        var buildable = Player.getKingdomBuildableTypes(townId);
        if (!buildable || buildable.length === 0) {
            toast('No kingdom buildings available for this town.', 'info'); return;
        }
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        var treasuryStr = kingdom ? Math.floor(kingdom.gold) + 'g' : '?';

        var body = '<div style="padding:10px;max-height:400px;overflow-y:auto;">';
        body += '<p style="color:#aaa;margin-bottom:10px;">Request the king to fund a construction project. Higher contribution and reputation improve approval chances.</p>';
        body += '<p style="color:#d4a017;font-size:0.85rem;">Kingdom Treasury: ' + treasuryStr + '</p>';

        for (var bi = 0; bi < buildable.length; bi++) {
            var b = buildable[bi];
            body += '<div style="background:rgba(100,200,150,0.08);border:1px solid rgba(100,200,150,0.2);border-radius:8px;padding:10px;margin-bottom:8px;">';
            body += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            body += '<strong style="color:#b3e5c8;">' + b.name + '</strong>';
            body += '<span style="color:#aaa;font-size:0.8rem;">Cost: ' + b.cost + 'g</span>';
            body += '</div>';
            body += '<p style="color:#999;font-size:0.8rem;margin:4px 0;">' + (b.description || b.effect || '') + '</p>';
            body += '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">';
            body += '<label style="color:#aaa;font-size:0.8rem;">Your contribution:</label>';
            body += '<input type="range" id="kb-contrib-' + b.id + '" min="0" max="' + b.cost + '" value="' + Math.floor(b.cost * 0.3) + '" step="10" style="flex:1;" oninput="document.getElementById(\'kb-val-' + b.id + '\').textContent=this.value+\'g (\'+Math.round(this.value/' + b.cost + '*100)+\'%)\'"/>';
            body += '<span id="kb-val-' + b.id + '" style="color:#d4a017;font-size:0.8rem;min-width:80px;">' + Math.floor(b.cost * 0.3) + 'g (30%)</span>';
            body += '</div>';
            body += '<button class="btn-medieval" data-action="_submitKingdomBuild" data-id="' + townId + '" data-val="' + b.id + '" style="margin-top:6px;font-size:0.8rem;padding:4px 16px;">🏗️ Request</button>';
            body += '</div>';
        }
        body += '</div>';

        openModal('🏗️ Kingdom Construction', body, '<button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    function _submitKingdomBuild(townId, buildingType) {
        var slider = document.getElementById('kb-contrib-' + buildingType);
        var contribution = slider ? parseInt(slider.value) : 0;
        var result = Player.requestKingdomBuilding(townId, buildingType, contribution);
        if (result && result.success) {
            toast('✅ ' + result.message, 'success');
            closeModal();
        } else {
            toast('❌ ' + (result ? result.message : 'Request failed.'), 'warning');
        }
    }

    // ========================================================
    // KING'S FAVOR (RA SPECIAL FAVOR) DIALOG
    // ========================================================
    function openKingFavorDialog(kingdomId) {
        if (typeof Player === 'undefined' || !Player.getKingFavor) return;
        var favor = Player.getKingFavor(kingdomId);
        if (!favor) { toast('No pending request from the king.', 'info'); return; }

        var daysLeft = favor.expiresDay - (Engine.getDay ? Engine.getDay() : 0);
        var body = '<div style="padding:15px;">';
        body += '<p style="color:#d4a017;font-size:1.1rem;">👑 The King requests your service:</p>';
        body += '<p style="color:#e8d8b8;font-size:1rem;margin:12px 0;padding:10px;background:rgba(255,215,0,0.1);border-radius:8px;border:1px solid rgba(255,215,0,0.2);">"' + favor.description.charAt(0).toUpperCase() + favor.description.slice(1) + '"</p>';
        if (favor.goldCost > 0) {
            body += '<p style="color:#ffcc44;">💰 Cost: <strong>' + favor.goldCost + 'g</strong></p>';
        }
        body += '<p style="color:#88cc88;">✅ Accept: +' + (favor.repGain || 3) + ' kingdom reputation, +' + (favor.relGain || 5) + ' king relationship</p>';
        body += '<p style="color:#cc8888;">❌ Decline: -5 king relationship</p>';
        body += '<p style="color:#aaa;font-size:0.85rem;">⏰ Expires in ' + Math.max(0, daysLeft) + ' days (ignored = -8 relationship)</p>';
        body += '</div>';

        var footer = '<button class="btn-medieval" data-action="_respondKingFavor" data-id="' + kingdomId + '" data-val="true" style="background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);">✅ Accept</button>';
        footer += '<button class="btn-medieval" data-action="_respondKingFavor" data-id="' + kingdomId + '" data-val="false" style="background:rgba(200,100,100,0.2);border-color:rgba(200,100,100,0.4);margin-left:8px;">❌ Decline</button>';
        footer += '<button class="btn-medieval" data-action="closeModal" style="margin-left:8px;">Later</button>';

        openModal('👑 King\'s Request', body, footer);
    }

    function _respondKingFavor(kingdomId, accept) {
        if (typeof Player === 'undefined' || !Player.respondToKingFavor) return;
        var result = Player.respondToKingFavor(kingdomId, accept);
        if (result && result.success) {
            toast(result.message, accept ? 'success' : 'warning');
        } else {
            toast(result ? result.message : 'Failed.', 'danger');
        }
        closeModal();
    }

    function openProposeLawsDialog(kingdomId) {
        if (typeof Player === 'undefined') return;
        if (!kingdomId) {
            var ps = Player.state;
            if (ps) kingdomId = ps.royalAdvisorKingdomId || ps.citizenshipKingdomId;
        }
        if (!kingdomId) { toast('No kingdom.', 'warning'); return; }

        var pState = Player.state;
        if (!pState || (pState.socialRank[kingdomId] || 0) < 6) {
            toast('Only Royal Advisors can propose laws.', 'warning');
            return;
        }

        var laws = Player.getProposableLaws(kingdomId);
        var capital = (pState.politicalCapital !== undefined) ? pState.politicalCapital : 0;
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        var kName = kingdom ? kingdom.name : 'the kingdom';

        var html = '<div class="detail-section">';
        html += '<p>As Royal Advisor, you can propose new laws and policies to the King of ' + kName + '.</p>';
        html += '<p><b>Political Capital:</b> ' + capital + ' remaining this season</p>';
        if (capital <= 0) {
            html += '<p style="color:var(--danger);">No political capital remaining. Wait until next season.</p>';
        }
        html += '</div>';

        // Group by category
        var categories = {};
        for (var i = 0; i < laws.length; i++) {
            var law = laws[i];
            if (!categories[law.category]) categories[law.category] = [];
            categories[law.category].push(law);
        }

        var catNames = {
            taxation: '💰 Taxation',
            trade: '🌍 Trade & Commerce',
            economy: '📊 Economic Policy',
            security: '🛡️ Security',
            social: '🏠 Social Policy',
            succession: '👑 Succession',
            military: '⚔️ Military'
        };

        for (var cat in categories) {
            html += '<div class="detail-section">';
            html += '<h3>' + (catNames[cat] || cat) + '</h3>';
            var catLaws = categories[cat];
            for (var ci = 0; ci < catLaws.length; ci++) {
                var cl = catLaws[ci];
                var chanceColor = cl.chance >= 70 ? '#6bff6b' : (cl.chance >= 40 ? '#ffa500' : 'var(--danger)');
                var disabled = capital <= 0 || !cl.canAfford;
                var disabledStyle = disabled ? 'opacity:0.5;pointer-events:none;' : 'cursor:pointer;';
                html += '<div class="detail-row" style="' + disabledStyle + 'padding:8px;margin:4px 0;border-radius:4px;background:rgba(255,255,255,0.03);" ' +
                    (disabled ? '' : 'data-action="executeProposeLaw" data-id="' + kingdomId + '" data-val="' + cl.id + '"') + '>';
                html += '<div style="flex:1;">';
                html += '<span class="label">' + cl.icon + ' ' + cl.name + '</span>';
                html += '<div style="color:var(--text-secondary);font-size:0.85em;">' + cl.description + '</div>';
                if (cl.requiresGold > 0) {
                    html += '<div style="font-size:0.8em;color:' + (cl.canAfford ? '#ffd700' : 'var(--danger)') + ';">Treasury cost: ' + cl.requiresGold + 'g' + (cl.canAfford ? '' : ' (insufficient)') + '</div>';
                }
                html += '</div>';
                html += '<div style="text-align:right;min-width:60px;">';
                html += '<div style="color:' + chanceColor + ';font-weight:bold;">' + cl.chance + '%</div>';
                html += '<div style="font-size:0.75em;color:var(--text-secondary);">approval</div>';
                html += '</div>';
                html += '</div>';
            }
            html += '</div>';
        }

        openModal('📜 Propose Laws', html);
    }

    function executeProposeLaw(kingdomId, lawId) {
        if (typeof Player === 'undefined' || !Player.proposeLaw) return;
        var result = Player.proposeLaw(kingdomId, lawId);
        if (result && result.success) {
            if (result.accepted) {
                toast('📜 Law enacted: ' + result.law + '! (' + result.chance + '% chance)', 'success');
            } else {
                toast('📜 Law rejected: ' + result.law + '. (' + result.chance + '% chance)', 'warning');
            }
        } else {
            toast(result ? result.message : 'Failed to propose law.', 'danger');
        }
        closeModal();
        // Reopen to show updated state
        setTimeout(function() { openProposeLawsDialog(kingdomId); }, 300);
    }

    // ========================================================
    // ROYAL CONSULTATION DIALOG — Respond to king's pending decisions
    // ========================================================
    function openKingConsultationDialog(kingdomId, decisionId) {
        if (typeof Player === 'undefined' || !Player.getPendingKingDecisions) return;
        var decisions = Player.getPendingKingDecisions();
        var decision = null;
        for (var i = 0; i < decisions.length; i++) {
            if (decisions[i].id === decisionId) { decision = decisions[i]; break; }
        }
        if (!decision) {
            // Try showing all pending decisions
            if (decisions.length === 0) {
                toast('No pending decisions from the king.', 'info');
                return;
            }
            decision = decisions[0];
        }

        var kingdom;
        try { kingdom = Engine.getKingdom(kingdomId || Player.royalAdvisorKingdomId); } catch (e) { return; }
        if (!kingdom) return;

        var convictionLabel = decision.conviction >= 0.8 ? '🔴 Very Determined' :
                              decision.conviction >= 0.6 ? '🟠 Determined' :
                              decision.conviction >= 0.4 ? '🟡 Moderate' : '🟢 Open to persuasion';

        var typeIcons = {
            tax_change: '💰',
            declare_war: '⚔️',
            surrender: '🏳️',
            trade_ban: '🚫',
            health_policy: '🏥',
            peace: '🕊️',
            policy: '📜'
        };
        var icon = typeIcons[decision.type] || '📜';

        var html = '<div class="detail-section">';
        html += '<p style="font-size:1.1rem;margin-bottom:12px;">' + icon + ' <b>The King proposes:</b></p>';
        html += '<div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.3);border-radius:6px;padding:12px;margin-bottom:12px;">';
        html += '<p style="font-size:1.05rem;margin:0 0 8px 0;"><b>' + decision.description + '</b></p>';
        if (decision.details) {
            html += '<p style="color:var(--text-dim);margin:0;font-size:0.9rem;">' + decision.details + '</p>';
        }
        html += '</div>';
        html += '<p><b>King\'s conviction:</b> ' + convictionLabel + ' (' + Math.round(decision.conviction * 100) + '%)</p>';
        html += '<p style="color:var(--text-dim);font-size:0.85rem;">If you do nothing, the king will proceed on Day ' + decision.deadlineDay + '.</p>';
        html += '</div>';

        // Show all pending decisions if more than one
        if (decisions.length > 1) {
            html += '<div class="detail-section"><h3>Other Pending Decisions (' + (decisions.length - 1) + ')</h3>';
            for (var oi = 0; oi < decisions.length; oi++) {
                if (decisions[oi].id === decision.id) continue;
                var od = decisions[oi];
                html += '<div class="detail-row" style="cursor:pointer" data-action="openKingConsultationDialog" data-id="' + kingdom.id + '" data-val="' + od.id + '">';
                html += '<span class="label">' + (typeIcons[od.type] || '📜') + ' ' + od.description + '</span>';
                html += '<span class="value text-dim">Deadline: Day ' + od.deadlineDay + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        var footer = '<button class="btn-medieval" style="background:rgba(0,180,0,0.2);border-color:rgba(0,180,0,0.5);margin-right:8px;" data-action="respondToKingDecision" data-id="' + kingdom.id + '" data-val="' + decision.id + '" data-type="agree">✅ Agree</button>';
        footer += '<button class="btn-medieval" style="background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.5);margin-right:8px;" data-action="respondToKingDecision" data-id="' + kingdom.id + '" data-val="' + decision.id + '" data-type="oppose">🛡️ Oppose</button>';
        footer += '<button class="btn-medieval" data-action="closeModal">Decide Later</button>';

        openModal('👑 Royal Consultation — ' + kingdom.name, html, footer);
    }

    function respondToKingDecisionUI(kingdomId, decisionId, response) {
        if (typeof Player === 'undefined' || !Player.respondToKingDecision) return;
        var result = Player.respondToKingDecision(decisionId, response);
        if (result && result.success) {
            if (result.swayed) {
                toast('🛡️ ' + result.message, 'success');
            } else if (response === 'agree') {
                toast('✅ ' + result.message, 'success');
            } else {
                toast('❌ ' + result.message, 'warning');
            }
        } else {
            toast(result ? result.message : 'Failed to respond.', 'warning');
        }
        closeModal();

        // Check if there are more pending decisions
        var remaining = Player.getPendingKingDecisions ? Player.getPendingKingDecisions() : [];
        if (remaining.length > 0) {
            setTimeout(function() {
                openKingConsultationDialog(kingdomId, remaining[0].id);
            }, 500);
        }
    }

    function showKingSuccessionPopup(kingdomName, newKingName, cause) {
        const html = `<div class="detail-section">
            <p>The ruler of <b>${kingdomName}</b> has ${cause === 'old_age' ? 'died of old age' : cause === 'coup' ? 'been overthrown in a coup' : cause === 'war' ? 'fallen in battle' : 'died'}.</p>
            <p><b>${newKingName}</b> has ascended to the throne!</p>
            <p>Diplomatic relations may shift under the new ruler.</p>
        </div>`;
        openModal('👑 Royal Succession', html, '<button class="btn-medieval" data-action="closeModal">Acknowledge</button>');
    }

    // ── Degradation Repair Handlers ──
    function repairBuildingUI(buildingId) {
        if (typeof Player === 'undefined' || !Player.repairBuilding) return;
        const result = Player.repairBuilding(buildingId);
        if (result && result.success) {
            toast(result.message, 'success');
            UI.openBuildingManagement();
        } else {
            toast(result ? result.message : 'Repair failed.', 'warning');
        }
    }

    function repairShipUI(shipId) {
        if (typeof Player === 'undefined' || !Player.repairShip) return;
        const result = Player.repairShip(shipId);
        if (result && result.success) {
            toast(result.message, 'success');
            UI.openCharacterDialog();
        } else {
            toast(result ? result.message : 'Repair failed.', 'warning');
        }
    }

    // ── Toll Route UI Functions ──

    function showTollRoutesPanel() {
        let html = '<div style="padding:15px;max-height:500px;overflow-y:auto;">';

        // ===== TOLL ROUTES SECTION =====
        html += '<h3 style="color:#ffd700;margin-bottom:10px;">🛤️ Your Toll Routes</h3>';

        const owned = Player.getPlayerOwnedRoutes();
        if (owned.length === 0) {
            html += '<p style="color:#aaa;">You don\'t own any toll routes yet. Build roads or sea routes to start earning toll revenue!</p>';
        } else {
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr style="border-bottom:1px solid #555;"><th style="text-align:left;padding:5px;">Route</th><th>Type</th><th>Toll</th><th>Revenue</th><th>Action</th></tr>';
            for (const r of owned) {
                html += '<tr style="border-bottom:1px solid #333;">';
                html += '<td style="padding:5px;">' + r.fromName + ' \u2194 ' + r.toName + '</td>';
                html += '<td style="text-align:center;">' + (r.type === 'sea' ? '\u2693' : '\uD83D\uDEE4\uFE0F') + ' ' + r.type + '</td>';
                html += '<td style="text-align:center;">' + r.tollRate + 'g</td>';
                html += '<td style="text-align:center;color:#ffd700;">' + Math.floor(r.tollRevenue || 0) + 'g</td>';
                html += '<td style="text-align:center;">';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;" data-action="changeTollRate" data-id="' + r.type + '" data-val="' + r.fromTownId + '" data-type="' + r.toTownId + '">Set Rate</button>';
                html += '</td></tr>';
            }
            html += '</table>';
        }

        html += '<div style="margin-top:15px;">';
        html += '<button class="btn-medieval" data-action="collectTolls" style="padding:8px 20px;">💰 Collect All Revenue</button>';
        html += '</div>';
        html += '</div>'; // outer container

        openModal('🛤️ Toll Routes', html);
    }

    function showTravelPanel() {
        let html = '<div style="padding:15px;max-height:500px;overflow-y:auto;">';

        // ===== TRAVEL DESTINATIONS SECTION =====
        html += '<h3 style="color:#c9a96e;margin-bottom:10px;">🗺️ Travel Destinations</h3>';

        const playerTownId = Player.townId;
        const currentTown = Engine.findTown(playerTownId);
        const isTraveling = Player.traveling;

        if (!currentTown) {
            html += '<p style="color:#aaa;">Cannot determine your location.</p>';
        } else if (isTraveling) {
            html += '<p style="color:#aaa;">You are currently traveling.</p>';
        } else {
            // Gather connected towns via roads
            const roads = Engine.getRoads ? Engine.getRoads() : [];
            const seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
            const connected = {}; // townId -> { type: 'road'|'sea'|'both', town, road/seaRoute }

            for (let i = 0; i < roads.length; i++) {
                const rd = roads[i];
                let otherId = null;
                if (rd.fromTownId === playerTownId) otherId = rd.toTownId;
                else if (rd.toTownId === playerTownId) otherId = rd.fromTownId;
                if (!otherId) continue;
                const t = Engine.findTown(otherId);
                if (!t) continue;
                if (!connected[otherId]) connected[otherId] = { town: t, landRoute: rd, seaRoute: null };
                else connected[otherId].landRoute = rd;
            }

            for (let i = 0; i < seaRoutes.length; i++) {
                const sr = seaRoutes[i];
                let otherId = null;
                if (sr.fromTownId === playerTownId) otherId = sr.toTownId;
                else if (sr.toTownId === playerTownId) otherId = sr.fromTownId;
                if (!otherId) continue;
                const t = Engine.findTown(otherId);
                if (!t) continue;
                if (!connected[otherId]) connected[otherId] = { town: t, landRoute: null, seaRoute: sr };
                else connected[otherId].seaRoute = sr;
            }

            // If at a junction, BFS through connected junctions to find real towns
            var _atJunction = currentTown.isJunction;
            if (_atJunction) {
                var _jVisited = {};
                _jVisited[playerTownId] = true;
                var _jFrontier = [playerTownId];
                while (_jFrontier.length > 0) {
                    var _jCur = _jFrontier.shift();
                    for (let i = 0; i < roads.length; i++) {
                        const rd = roads[i];
                        let _jOther = null;
                        if (rd.fromTownId === _jCur) _jOther = rd.toTownId;
                        else if (rd.toTownId === _jCur) _jOther = rd.fromTownId;
                        if (!_jOther || _jVisited[_jOther]) continue;
                        _jVisited[_jOther] = true;
                        const _jt = Engine.findTown(_jOther);
                        if (!_jt) continue;
                        if (_jt.isJunction) {
                            _jFrontier.push(_jOther);
                        } else {
                            if (!connected[_jOther]) connected[_jOther] = { town: _jt, landRoute: rd, seaRoute: null };
                        }
                    }
                }
            }

            const destinations = Object.values(connected);

            if (destinations.length === 0) {
                html += '<p style="color:#aaa;">No routes lead from ' + currentTown.name + '.</p>';
            } else {
                // Sort: same kingdom first, then alphabetical
                destinations.sort(function(a, b) {
                    const aOwn = a.town.kingdomId === currentTown.kingdomId ? 0 : 1;
                    const bOwn = b.town.kingdomId === currentTown.kingdomId ? 0 : 1;
                    if (aOwn !== bOwn) return aOwn - bOwn;
                    return (a.town.name || '').localeCompare(b.town.name || '');
                });

                const hasHorse = Player.horses && Player.horses.length > 0;
                const hasSaddle = Player.inventory && (Player.inventory.saddles || 0) > 0;
                const hasShip = Player.ships && Player.ships.length > 0;
                const baseSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5;
                const kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];

                for (let di = 0; di < destinations.length; di++) {
                    const dest = destinations[di];
                    const t = dest.town;
                    if (t.isJunction) continue; // Skip road junctions
                    const isLand = !!dest.landRoute;
                    const isSea = !!dest.seaRoute;
                    const destKingdom = kingdoms.find(function(k) { return k.id === t.kingdomId; });
                    const sameKingdom = t.kingdomId === currentTown.kingdomId;
                    const kColor = destKingdom ? (destKingdom.color || '#888') : '#888';

                    // Compute travel days estimate
                    let landDays = null;
                    if (isLand) {
                        try {
                            const route = Engine.findPath(playerTownId, t.id);
                            if (route && route.length > 0) {
                                const dist = calculateRouteDist(route);
                                landDays = Math.max(1, Math.ceil(dist / baseSpeed));
                                if (hasHorse) {
                                    let horseSpeed = baseSpeed * (1 + (CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3));
                                    if (hasSaddle) horseSpeed *= CONFIG.SADDLE_BONUS_MULTIPLIER || 2;
                                    landDays = Math.max(1, Math.ceil(dist / horseSpeed));
                                }
                            }
                        } catch (e) { /* ignore */ }
                    }

                    let seaDays = null;
                    let seaCost = CONFIG.SEA_PASSAGE_COST || 50;
                    if (isSea) {
                        const seaDist = dest.seaRoute.distance || 500;
                        const seaSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5;
                        seaDays = Math.max(1, Math.ceil(seaDist / seaSpeed));
                        if (hasShip) seaCost = 0;
                    }

                    // Naval threat for sea routes
                    let navalThreat = 0;
                    if (isSea && Engine.getNavalThreat) {
                        try { navalThreat = Engine.getNavalThreat(playerTownId, t.id); } catch (e) { /* ignore */ }
                    }

                    // Road quality / danger
                    let banditThreat = 0;
                    if (isLand && dest.landRoute) {
                        banditThreat = dest.landRoute.banditThreat || 0;
                    }

                    // Blockade check
                    let isBlockaded = false;
                    if (isSea && Engine.isPortBlockaded) {
                        try { isBlockaded = Engine.isPortBlockaded(t.id); } catch (e) { /* ignore */ }
                    }

                    // Build destination card
                    const borderCol = sameKingdom ? 'rgba(196,163,90,0.3)' : 'rgba(150,150,150,0.2)';
                    html += '<div style="border:1px solid ' + borderCol + ';border-left:3px solid ' + kColor + ';background:rgba(255,255,255,0.03);border-radius:6px;padding:10px;margin-bottom:8px;">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';

                    // Left: town info
                    html += '<div style="flex:1;">';
                    html += '<div style="font-size:1rem;font-weight:bold;color:#e8d48b;">' + t.name + '</div>';
                    html += '<div style="font-size:0.75rem;color:#999;margin-top:2px;">';
                    html += (destKingdom ? destKingdom.name : 'Unknown') + (sameKingdom ? '' : ' 🌐');
                    if (t.isPort) html += ' ⚓';
                    html += ' · Pop: ' + (t.population || '?');
                    html += '</div>';

                    // Route type badges
                    html += '<div style="margin-top:4px;">';
                    if (isLand) {
                        const roadQuality = dest.landRoute.quality || 1;
                        const qualLabel = roadQuality >= 3 ? 'Paved' : roadQuality >= 2 ? 'Improved' : 'Dirt';
                        html += '<span style="font-size:0.7rem;background:rgba(106,170,80,0.2);color:#8c8;padding:2px 6px;border-radius:3px;margin-right:4px;">🛤️ ' + qualLabel + ' Road</span>';
                    }
                    if (isSea) {
                        html += '<span style="font-size:0.7rem;background:rgba(42,100,150,0.3);color:#8bf;padding:2px 6px;border-radius:3px;">⛵ Sea Route</span>';
                    }
                    html += '</div>';

                    // Danger indicators
                    if (banditThreat > (CONFIG.BANDIT_THREAT_DANGER_THRESHOLD || 30)) {
                        const dangerColor = banditThreat >= 60 ? '#c44e52' : '#ccb974';
                        html += '<div style="font-size:0.7rem;color:' + dangerColor + ';margin-top:3px;">⚠️ Bandit Threat: ' + Math.round(banditThreat) + '%</div>';
                    }
                    if (navalThreat > 0) {
                        const threatColor = navalThreat >= 50 ? '#c44e52' : '#ccb974';
                        html += '<div style="font-size:0.7rem;color:' + threatColor + ';margin-top:2px;">⚠️ Naval Threat: ' + navalThreat + '%</div>';
                    }
                    if (isBlockaded) {
                        html += '<div style="font-size:0.7rem;color:#c44e52;margin-top:2px;">🚫 PORT BLOCKADED</div>';
                    }
                    html += '</div>';

                    // Right: travel info + button
                    html += '<div style="text-align:right;min-width:100px;">';
                    if (isLand && landDays !== null) {
                        html += '<div style="font-size:0.8rem;color:var(--gold);">' + (hasHorse ? '🐴' : '🚶') + ' ~' + landDays + 'd</div>';
                    }
                    if (isSea && seaDays !== null) {
                        html += '<div style="font-size:0.8rem;color:#8bf;">⛵ ~' + seaDays + 'd' + (seaCost > 0 ? ' · ' + seaCost + 'g' : '') + '</div>';
                    }
                    html += '<button class="btn-medieval" style="margin-top:6px;padding:5px 12px;font-size:0.8rem;" data-action="openTravelOptions" data-id="' + t.id + '">🗺️ Travel</button>';
                    html += '</div>';

                    html += '</div>'; // flex row
                    html += '</div>'; // card
                }
            }
        }

        html += '</div>'; // outer container

        openModal('🗺️ Travel Destinations', html);
    }

    function changeTollRate(routeType, fromTownId, toTownId) {
        var rate = prompt('Set toll rate (' + CONFIG.TOLL_MIN_RATE + '-' + CONFIG.TOLL_MAX_RATE + ' gold per use):', CONFIG.TOLL_DEFAULT_RATE);
        if (rate === null) return;
        var numRate = parseInt(rate);
        if (isNaN(numRate)) return;
        var result = Player.setTollRate(routeType, fromTownId, toTownId, numRate);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showTollRoutesPanel();
    }

    function collectTollsUI() {
        var amount = Player.collectTollRevenue();
        if (amount > 0) {
            toast('\uD83D\uDCB0 Collected ' + Math.floor(amount) + 'g in toll revenue!', 'success');
        } else {
            toast('No toll revenue to collect.', 'info');
        }
        showTollRoutesPanel();
    }

    function showBuildRouteSelector(type) {
        var towns = Engine.getTowns();
        var currentTown = Engine.findTown(Player.townId);
        if (!currentTown) return;

        var roads = Engine.getRoads();
        var seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
        var candidates = [];

        if (type === 'toll_road' || type === 'petition') {
            candidates = towns.filter(function(t) {
                if (t.id === Player.townId) return false;
                if (t.destroyed) return false;
                var d = Math.hypot(currentTown.x - t.x, currentTown.y - t.y);
                if (d > 3000) return false;
                if (type === 'petition' && t.kingdomId !== currentTown.kingdomId) return false;
                var hasRoad = roads.some(function(r) {
                    return (r.fromTownId === Player.townId && r.toTownId === t.id) ||
                           (r.fromTownId === t.id && r.toTownId === Player.townId);
                });
                return !hasRoad;
            });
        } else if (type === 'sea_route') {
            if (!currentTown.isPort) { toast('Must be in a port town!', 'warning'); return; }
            candidates = towns.filter(function(t) {
                if (t.id === Player.townId) return false;
                if (t.destroyed) return false;
                if (!t.isPort) return false;
                var hasRoute = seaRoutes.some(function(r) {
                    return (r.fromTownId === Player.townId && r.toTownId === t.id) ||
                           (r.fromTownId === t.id && r.toTownId === Player.townId);
                });
                return !hasRoute;
            });
        }

        if (candidates.length === 0) {
            toast('No valid destinations available.', 'info');
            return;
        }

        candidates.sort(function(a, b) {
            var da = Math.hypot(currentTown.x - a.x, currentTown.y - a.y);
            var db = Math.hypot(currentTown.x - b.x, currentTown.y - b.y);
            return da - db;
        });

        var titles = { toll_road: '\uD83D\uDEE4\uFE0F Build Toll Road To...', sea_route: '\u2693 Build Sea Route To...', petition: '\uD83D\uDC51 Petition King to Build Road To...' };
        var html = '<div style="padding:15px;max-height:400px;overflow-y:auto;">';
        html += '<h3 style="color:#ffd700;margin-bottom:10px;">' + titles[type] + '</h3>';

        for (var i = 0; i < candidates.length; i++) {
            var t = candidates[i];
            var d = Math.hypot(currentTown.x - t.x, currentTown.y - t.y);
            var kingdom = Engine.findKingdom(t.kingdomId);
            var costEstimate = '';

            if (type === 'toll_road') {
                var waterFrac = Engine.checkWaterFraction(currentTown.x, currentTown.y, t.x, t.y);
                var cost = CONFIG.TOLL_ROAD_BASE_COST + Math.floor(d * CONFIG.TOLL_ROAD_DIST_COST) + (waterFrac > 0 ? Math.floor(CONFIG.TOLL_ROAD_BASE_COST * waterFrac * CONFIG.TOLL_ROAD_WATER_MULTIPLIER) : 0);
                var timberNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_TIMBER_PER_100;
                var stoneNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_STONE_PER_100;
                var ironNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_IRON_PER_100;
                if (waterFrac > CONFIG.TOLL_ROAD_MAX_WATER_FRACTION) {
                    costEstimate = '<span style="color:#f44;">Too much water \u2014 impassable</span>';
                } else {
                    costEstimate = '<span style="color:#ccc;">~' + cost.toLocaleString() + 'g + ' + timberNeeded + ' timber, ' + stoneNeeded + ' stone, ' + ironNeeded + ' iron</span>';
                }
            } else if (type === 'sea_route') {
                var seaCost = CONFIG.TOLL_SEA_BASE_COST + CONFIG.TOLL_SEA_DOCK_COST * 2 + Math.floor(d * 5);
                costEstimate = '<span style="color:#ccc;">~' + seaCost.toLocaleString() + 'g + ' + CONFIG.TOLL_SEA_TIMBER_NEEDED + ' timber, ' + CONFIG.TOLL_SEA_STONE_NEEDED + ' stone, ' + CONFIG.TOLL_SEA_IRON_NEEDED + ' iron</span>';
            } else if (type === 'petition') {
                var fullCost = CONFIG.TOLL_ROAD_BASE_COST + Math.floor(d * CONFIG.TOLL_ROAD_DIST_COST);
                var playerCost = Math.floor(fullCost * CONFIG.KING_INFLUENCE_COST_FRACTION);
                costEstimate = '<span style="color:#ccc;">~' + playerCost.toLocaleString() + 'g (your 10% share)</span>';
            }

            var btnActionAttr = '';
            if (type === 'toll_road') btnActionAttr = 'data-action="buildTollRoad" data-id="' + t.id + '"';
            else if (type === 'sea_route') btnActionAttr = 'data-action="buildSeaRoute" data-id="' + t.id + '"';
            else if (type === 'petition') btnActionAttr = 'data-action="petitionKingForRoad" data-id="' + t.id + '"';

            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #333;">';
            html += '<div><strong>' + t.name + '</strong> (' + (kingdom ? kingdom.name : '?') + ') \u2014 ' + Math.floor(d) + ' dist<br>' + costEstimate + '</div>';
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 12px;white-space:nowrap;" ' + btnActionAttr + '>Select</button>';
            html += '</div>';
        }
        html += '</div>';
        openModal(titles[type], html);
    }

    function buildTollRoad(targetTownId) {
        var result = Player.playerBuildTollRoad(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    function buildSeaRoute(targetTownId) {
        var result = Player.playerBuildSeaRoute(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    function petitionKingForRoad(targetTownId) {
        var result = Player.influenceKingToBuildRoad(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    // ── Exports ──
    UI.openGameGuide = openGameGuide;
    UI.openGoodsGuide = openGoodsGuide;
    UI.openAdviseKingDialog = openAdviseKingDialog;
    UI.executeAdvice = executeAdvice;
    UI.showKingSuccessionPopup = showKingSuccessionPopup;
    UI.openKingConsultationDialog = openKingConsultationDialog;
    UI.respondToKingDecision = respondToKingDecisionUI;
    UI.openKingCommissionDialog = openKingCommissionDialog;
    UI.acceptCommissionUI = acceptCommissionUI;
    UI.refuseCommissionUI = refuseCommissionUI;
    UI.deliverCommissionUI = deliverCommissionUI;
    UI.openProposeLawsDialog = openProposeLawsDialog;
    UI.executeProposeLaw = executeProposeLaw;
    UI.openKingdomBuildDialog = openKingdomBuildDialog;
    UI._submitKingdomBuild = _submitKingdomBuild;
    UI.openKingFavorDialog = openKingFavorDialog;
    UI._respondKingFavor = _respondKingFavor;
    UI.repairBuilding = repairBuildingUI;
    UI.repairShip = repairShipUI;
    UI.showTollRoutesPanel = showTollRoutesPanel;
    UI.showTravelPanel = showTravelPanel;
    UI.changeTollRate = changeTollRate;
    UI.collectTolls = collectTollsUI;
    UI.showBuildRouteSelector = showBuildRouteSelector;
    UI.buildTollRoad = buildTollRoad;
    UI.buildSeaRoute = buildSeaRoute;
    UI.petitionKingForRoad = petitionKingForRoad;

    // ── Action delegation registrations ──
    UI.registerAction('removeOverlay', function(_t, d) {
        var el = document.getElementById(d.id);
        if (el) el.remove();
    });

    UI.registerAction('filterGuide', function(_t, d) {
        window._guideCat = d.val;
        window._filterGuide();
    });

    UI.registerAction('filterGoods', function(_t, d) {
        window._goodsCat = d.val;
        window._filterGoods();
    });

    UI.registerAction('executeAdvice', function(_t, d) {
        UI.executeAdvice(d.kingdom, d.type, d.val);
    });

    UI.registerAction('acceptCommissionUI', function(_t, d) {
        UI.acceptCommissionUI(d.id);
    });

    UI.registerAction('refuseCommissionUI', function(_t, d) {
        UI.refuseCommissionUI(d.id);
    });

    UI.registerAction('deliverCommissionUI', function(_t, d) {
        UI.deliverCommissionUI(d.id);
    });

    UI.registerAction('_submitKingdomBuild', function(_t, d) {
        UI._submitKingdomBuild(d.id, d.val);
    });

    UI.registerAction('_respondKingFavor', function(_t, d) {
        UI._respondKingFavor(d.id, d.val === 'true');
    });

    UI.registerAction('executeProposeLaw', function(_t, d) {
        UI.executeProposeLaw(d.id, d.val);
    });

    UI.registerAction('openKingConsultationDialog', function(_t, d) {
        UI.openKingConsultationDialog(d.id, d.val);
    });

    UI.registerAction('respondToKingDecision', function(_t, d) {
        UI.respondToKingDecision(d.id, d.val, d.type);
    });

    UI.registerAction('openTravelOptions', function(_t, d) {
        UI.openTravelOptions(d.id);
    });

    UI.registerAction('changeTollRate', function(_t, d) {
        UI.changeTollRate(d.id, d.val, d.type);
    });

    UI.registerAction('collectTolls', function() {
        UI.collectTolls();
    });

    UI.registerAction('buildTollRoad', function(_t, d) {
        UI.buildTollRoad(d.id);
    });

    UI.registerAction('buildSeaRoute', function(_t, d) {
        UI.buildSeaRoute(d.id);
    });

    UI.registerAction('petitionKingForRoad', function(_t, d) {
        UI.petitionKingForRoad(d.id);
    });
})(window.UI);