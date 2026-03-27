# Merchant Realms — Tutorial Audit

## Executive Summary

The tutorial has **14 chapters and 62 steps** covering basic gameplay through advanced systems. It does a solid job teaching the core loop (trade, travel, build, work) but has significant gaps in hands-on coverage of mid-to-late game systems. Many advanced features are described in text only — the player reads about them but never actually tries them. This audit identifies every gap, suggests interactive improvements, and flags bugs/inconsistencies.

---

## Current Tutorial Structure

### Part 1: Basics (Chapters 1–7)
| Ch | Title | Steps | Interactive | Text-Only |
|----|-------|-------|-------------|-----------|
| 1 | Welcome & Controls | 7 | 5 | 2 |
| 2 | Your First Trade | 5 | 4 | 1 |
| 3 | Traveling the World | 4 | 3 | 1 |
| 4 | Working & Earning | 3 | 1 | 2 |
| 5 | Your First Home | 3 | 1 | 2 |
| 6 | Marriage & Dynasty | 5 | 0 | 5 |
| 7 | Getting Help | 4 | 2 | 2 |

### Part 2: Advanced (Chapters 8–14)
| Ch | Title | Steps | Interactive | Text-Only |
|----|-------|-------|-------------|-----------|
| 8 | Buildings & Production | 5 | 4 | 1 |
| 9 | Skills & Progression | 4 | 2 | 2 |
| 10 | Kingdoms & Politics | 6 | 5 | 1 |
| 11 | War & Military | 4 | 0 | 4 |
| 12 | Ships & Sea Trade | 3 | 0 | 3 |
| 13 | Advanced Commerce | 4 | 2 | 2 |
| 14 | Mastery & Endgame | 5 | 1 | 4 |

**Totals: 62 steps — 30 interactive (48%), 32 text-only (52%)**

---

## Bugs & Issues Found

### 🔴 Critical
1. **Tutorial panel persists after leaving** — If the player clicks Main Menu or starts a new game during the tutorial, the tutorial info panel stays on screen. *(Fixed this session — added `Tutorial.cleanup()` calls to `showTitleScreen` and `startNewGame`)*

2. **Kingdom Orders step highlights wrong button** — Step points to `#btnKingdoms` (top bar) but Kingdom Orders are in the *town detail panel* under ⚒️ Actions. Player is told to click the Kingdoms button, but orders aren't there. *(Partially fixed this session — text now says to scroll down in town detail, but highlight still targets `#btnKingdoms`)*

3. **Royal Commissions step highlights wrong button** — Same issue. Commissions are in town detail, not the Kingdoms panel.

4. **Petitions step points to wrong location** — Text says "Click 👑 Kingdoms to open the kingdom panel" and look for Petitions there. But Petitions are actually accessed from the town detail panel under ⚒️ Actions.

### 🟡 Moderate
5. **Starting rank text says "Peasant"** — Line 385 still says "As a Peasant" but tutorial now starts player as Citizen. *(Needs text fix)*

6. **No hunger/thirst/food tutorial** — Player can starve to death and the tutorial never teaches about hunger, thirst, eating food, or drinking water. This is a survival-critical system.

7. **Chapter 6 (Marriage & Dynasty) is 100% text** — Five steps with zero interactivity. This is the longest non-interactive chapter and covers game-over mechanics (dying without heirs).

8. **Chapter 11 (War & Military) is 100% text** — Four steps covering a major game system with no hands-on demo.

9. **Chapter 12 (Ships & Sea Trade) is 100% text** — Three steps, no interaction at all.

### 🟢 Minor
10. **Ch 2 steps 3–4 are slightly redundant** — "Sell for Profit" and "Complete the Sale" could be combined into one step.

11. **No keyboard shortcut teaching** — The tutorial never teaches any keyboard shortcuts (T for trade, B for build, F to find yourself, Space to pause, etc.)

12. **Tutorial cheats only grant gold/SP** — The `giveGold`, `giveSkillPoints`, `giveItem` helpers exist but `giveItem` is barely used. Many interactive steps could benefit from pre-granting items.

---

## Feature Coverage Gap Analysis

### ❌ Not Covered At All (should be added)

| Feature | Game System | Suggested Tutorial Approach |
|---------|-------------|---------------------------|
| **Hunger & Thirst** | Survival | Interactive: give player food, show hunger bar, have them eat. Critical for new players |
| **Health Conditions & Injuries** | Health | Interactive: explain health bar, show hospital, demonstrate self-treatment |
| **Equipment (Weapons & Armor)** | Combat | Interactive: give player a weapon, show equip flow in Character panel |
| **NPC Quirks & Discovery** | Social | Interactive: have player Observe an NPC, reveal a quirk, show what it means |
| **Worker Quirk Effects** | Buildings | Text step after NPC quirks: explain how quirks affect building output |
| **Schemes** | Crime/Politics | Interactive: open Schemes panel, show the 5 categories, explain risk/reward |
| **Kingdom Laws** | Kingdoms | Interactive: open 📜 Laws in town detail, show current laws and their effects |
| **Street Trading** | Trading | Interactive: do one direct NPC trade via 🤝 button |
| **Trade Licenses** | Trading | Text: explain that some goods need licenses and where to buy them |
| **Home Crafting** | Housing | Interactive: if home has workshop, craft one item |
| **Ship Addons & Repair** | Ships | Interactive: show ship addon slots, explain hull health |
| **Resource Deposits** | Economy | Text: explain the ⛏ Deposits overlay (R key) and Regional Survey skill |
| **Outpost Founding** | Buildings | Interactive: explain cost/maintenance, show founding UI |
| **King Personality & Mood** | Kingdoms | Text: explain that king mood affects laws, taxes, and war decisions |
| **Conscription** | War | Text: explain draft mechanics and how to avoid |
| **Succession** | Kingdoms | Text: explain what happens when a king dies |
| **Town Prosperity & Happiness** | Economy | Text: explain what makes towns grow or shrink |
| **Keyboard Shortcuts** | Controls | Interactive: show shortcut list, have player try T, B, F, Space |

### ⚠️ Partially Covered (needs improvement)

| Feature | Current Coverage | What's Missing |
|---------|-----------------|----------------|
| **Housing** | Ch 5 mentions tiers | No hands-on buy, no crafting, no housing types explained |
| **Jobs/Work** | Ch 4 mentions jobs exist | No actual job acceptance, no job tier explanation |
| **Caravans** | Ch 13 highlights button | No actual caravan setup walkthrough |
| **Combat/Bandits** | Ch 11 mentions ambush risk | No weapon equip, no combat explanation |
| **Marriage** | Ch 6 describes courtship | Entirely text — should have interactive dating demo |
| **Petitions** | Ch 10 mentions them | Points to wrong UI location |
| **Savings/Loading** | Ch 1 highlights save button | Could have player actually save |
| **Sea Travel** | Ch 3 mentions it exists | Text only — could demo if tutorial injects a ship |
| **Elite Merchants** | Ch 13 mentions competition | No tracking demo, no interaction |

### ✅ Well Covered
- Camera/map controls (Ch 1)
- Market buy/sell loop (Ch 2)
- Road travel with demo (Ch 3)
- Building construction (Ch 8)
- Skill purchase (Ch 9)
- Social ranks overview (Ch 10)
- Kingdom Orders & Commissions (Ch 10, fixed this session)
- Leaderboard (Ch 14)
- Help & Game Guide (Ch 7)
- Notifications & Settings (Ch 7)

---

## Proposed New Interactive Steps

### Priority 1 — Essential for New Players

#### 1. Hunger & Thirst (add to Ch 4 or new Ch 4.5)
```
Step: "Staying Fed & Hydrated"
onEnter: giveItem('bread', 5); giveItem('water', 3);
text: "Your hunger and thirst bars drain over time. If hunger hits 0, 
       you START STARVING and lose health! Open your inventory and eat 
       some bread. Keep both bars above 20%."
highlight: character panel / inventory
waitFor: player.hunger > 50
```

#### 2. Keyboard Shortcuts (add to Ch 1 after Speed Controls)
```
Step: "Keyboard Shortcuts"
text: "Speed up your play with shortcuts: T=Trade, B=Build, H=Hire, 
       C=Caravans, F=Find Me, Space=Pause, M=Map. Try pressing T now!"
waitFor: trade panel opens
```

#### 3. Street Trading (add to Ch 2 after Trading Tips)
```
Step: "Street Trading"
text: "You can trade directly with NPCs on the street! Click 🤝 Street 
       Trading to see what townspeople want to buy or sell."
highlight: street trading button
waitFor: modal opens
```

#### 4. Actually Accept a Job (replace Ch 4 text with interactive)
```
Step: "Take Your First Job"
text: "Open the Work panel (💼) and accept any available job."
highlight: #btnWork or work panel
waitFor: player is working
```

#### 5. Buy Your First Home (make Ch 5 interactive)
```
Step: "Buy a Home"
onEnter: giveGold(500);
text: "Open Housing (🏡) and buy a home. Even a tent is better than sleeping outside!"
highlight: housing button
waitFor: player owns a home
```

### Priority 2 — Important Game Systems

#### 6. NPC Quirks Discovery (new step in Ch 10 or separate chapter)
```
Step: "Investigating NPCs"
text: "Every NPC has hidden quirks that affect how they work. Click any 
       person and try 'Observe' to discover their traits. This costs 8 hours 
       but may reveal useful info about potential workers!"
waitFor: player has revealedTraits on any NPC
```

#### 7. Equipment (add to Ch 11 War & Military)
```
Step: "Arm Yourself"
onEnter: giveItem('iron_sword', 1); giveItem('leather_armor', 1);
text: "Open Character and equip your weapon and armor. Equipment improves 
       your combat rating for bandit encounters and military service."
highlight: character panel
waitFor: player has weapon or armor equipped
```

#### 8. Kingdom Laws (add to Ch 10 after Petitions)
```
Step: "Kingdom Laws"
text: "Every kingdom has laws set by the king. Find the 📜 Laws button 
       in the town detail to see current taxes, trade restrictions, and 
       special policies."
waitFor: laws modal opens
```

#### 9. Schemes Overview (add to Ch 14 or new chapter)
```
Step: "Dark Deeds"
text: "The Schemes panel lets you plot sabotage, political schemes, tax 
       evasion, and more. High risk, high reward. Hover over each category 
       to learn what's available."
highlight: schemes button
waitFor: schemes modal opens
```

#### 10. Sea Travel Demo (make Ch 12 interactive)
```
Step: "Your First Voyage"
onEnter: // inject a basic ship for the player
text: "You now have a ship! Click a port town and choose 'Travel by Sea' 
       to sail there."
waitFor: player traveling by sea
```

### Priority 3 — Nice to Have

#### 11. Caravan Setup Walkthrough
Have the player actually configure and send a one-way caravan with pre-loaded goods.

#### 12. Outpost Founding Demo
Give the player enough gold and have them click the map to found an outpost.

#### 13. Marriage/Courtship Demo
Inject an NPC with high relationship, have player go on a date or give a gift.

#### 14. Home Crafting
If player has a home with workshop, walk them through crafting a bandage.

#### 15. Ship Addon Installation
Walk player through installing a cargo hold or fishing nets addon.

---

## Tutorial Start() Setup Improvements

### Currently Injected
- ✅ Player starts as Citizen (rank 1)
- ✅ Starting town + adjacent towns stocked with building materials
- ✅ 3 procurement orders injected
- ✅ 2 royal commissions injected
- ✅ Startup toasts/notifications cleared

### Should Also Inject
- **Food & water** in player inventory (5 bread, 3 water) — prevents starvation during tutorial
- **A horse** — makes travel demo smoother and teaches horse mechanics
- **A basic weapon/armor** — for the equipment tutorial step
- **An NPC with pre-set high relationship** — for marriage demo
- **A basic ship** (if starting town is a port) — for sea travel demo
- **Extra gold buffer** (500g starting) — so player can afford housing, food, basic things
- **Ensure starting town has available jobs** — so work step isn't blocked
- **Inject at least one fashion trend** — so trending goods can be shown
- **Set a kingdom law or two** — so laws panel has interesting content

---

## Text Quality Issues

1. **Line 385: "As a Peasant"** — Should say "As a Citizen" since tutorial now starts at Citizen rank
2. **Ch 10 Kingdom Orders** — Text says "Check the 👑 Kingdoms panel" but orders are in town detail
3. **Ch 10 Petitions** — Same misdirection to Kingdoms button
4. **Ch 2 "Trading Tips"** — Mentions "rank-based tax discount" but doesn't explain what rank you need
5. **Ch 3 "Sea Travel"** — Mentions ships but tutorial doesn't provide one
6. **Ch 6 all steps** — Very text-heavy, could use condensing or splitting into interactive + summary
7. **Ch 11 all steps** — Same issue, wall of text about war systems
8. **Ch 13 "Outposts & Expansion"** — Highlights build button and waits for modal, but player probably can't actually found an outpost at tutorial rank

---

## Structural Recommendations

### 1. Reorder Chapters for Better Flow
Current order has some awkward jumps. Suggested reorder:
- Ch 1: Welcome & Controls *(keep)*
- Ch 2: Your First Trade *(keep)*
- Ch 3: Working & Earning *(move up — earning money is more urgent than travel)*
- Ch 4: Survival (hunger/thirst/health) *(NEW — critical early)*
- Ch 5: Traveling the World *(move after earning, player has money for travel)*
- Ch 6: Your First Home *(keep position, make interactive)*
- Ch 7: Marriage & Dynasty *(keep but add interactivity)*
- Ch 8: Getting Help *(move down — player knows enough to need help)*
- Ch 9: Buildings & Production *(keep)*
- Ch 10: Skills & Progression *(keep)*
- Ch 11: Kingdoms & Politics *(keep)*
- Ch 12: War & Military + Equipment *(add equipment)*
- Ch 13: Ships & Sea Trade *(make interactive)*
- Ch 14: Advanced Commerce *(keep)*
- Ch 15: Crime & Endgame *(keep)*

### 2. Add Chapter Progress Indicators
Show "Chapter 3/14" and a progress bar in the tutorial panel so the player knows how much is left.

### 3. Add "Try It Yourself" Prompts
After text-only steps, add a small prompt like "💡 Try it: Open the Housing panel to see what's available!" — not a full interactive step, but a nudge.

### 4. Add Skip-to-Chapter
Let advanced players skip to specific chapters or jump to Part 2 directly.

### 5. Tutorial Completion Reward
Give a small gold bonus or cosmetic badge for completing the full tutorial.

---

## Summary of Priorities

| Priority | Item | Effort |
|----------|------|--------|
| 🔴 P0 | Fix highlight targets for Orders/Commissions/Petitions steps | Small |
| 🔴 P0 | Fix "As a Peasant" text | Trivial |
| 🔴 P0 | Add hunger/thirst tutorial step | Small |
| 🟡 P1 | Add keyboard shortcuts step | Small |
| 🟡 P1 | Make Ch 5 Housing interactive | Small |
| 🟡 P1 | Make Ch 4 Work interactive (accept a job) | Small |
| 🟡 P1 | Add street trading step | Small |
| 🟡 P1 | Add NPC quirks discovery step | Medium |
| 🟡 P1 | Add equipment/combat step to Ch 11 | Medium |
| 🟡 P1 | Add Kingdom Laws step | Small |
| 🟢 P2 | Add Schemes overview step | Small |
| 🟢 P2 | Make Ch 12 Ships interactive (inject a ship) | Medium |
| 🟢 P2 | Add caravan setup walkthrough | Medium |
| 🟢 P2 | Make Ch 6 Marriage partially interactive | Medium |
| 🟢 P2 | Add resource deposits/map overlay step | Small |
| 🔵 P3 | Reorder chapters for better flow | Medium |
| 🔵 P3 | Add skip-to-chapter feature | Medium |
| 🔵 P3 | Add tutorial completion reward | Small |
| 🔵 P3 | Add outpost founding demo | Medium |
| 🔵 P3 | Add home crafting demo | Small |
