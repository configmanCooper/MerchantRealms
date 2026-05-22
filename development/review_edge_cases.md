### [CRITICAL] Normal unsolicited events never fire unless god-boost is enabled
**Location:** `js/modules/player_unsolicited_events.js:26198-26202`, `js/modules/player_unsolicited_events.js:26250-26258`, `js/engine.js:32174-32175`, `js/player.js:5955-5956`
**Scenario:** Play normally with `window._godUeBoost` unset/false.
**Current behavior:** Both generation entry points return immediately before calling `_tryGenerate()`. Daily events never use `DAILY_CHANCE`, and entry events never run at all unless the debug boost flag is on.
**Expected behavior:** Normal play should still roll unsolicited events at the configured base chances, with god-boost only increasing the odds.
**Suggested fix:** Remove the early `if (!window._godUeBoost) return false;` gates. Use `window._godUeBoost ? 0.50 : DAILY_CHANCE` for the daily roll, and let entry generation call `_tryGenerate(ENTRY_CHANCE)` regardless of boost.

### [HIGH] Pending events can become permanently hidden if the popup is closed or blocked
**Location:** `js/ui.js:1036-1039`, `js/ui.js:13722-13728`, `js/ui.js:2035-2044`, `js/ui.js:2241-2286`, `js/modules/player_unsolicited_events.js:26167-26172`, `js/modules/player_unsolicited_events.js:26330-26356`
**Scenario:** An unsolicited event popup appears, then the player presses Escape, clicks the overlay/X, or the popup is blocked by an encounter/funeral/bankruptcy/conquest modal lock.
**Current behavior:** `_checkPendingUnsolicitedEvent()` marks the event as already shown before it knows the popup actually stayed open. The pending event remains in player state, but the render loop will not reopen it because `_lastShownUnsolicitedEventId` is already set. For one-step events there is no quest-tracker recovery path, so that hidden pending event also blocks future unsolicited events from spawning.
**Expected behavior:** An unresolved pending event should either stay on screen, reopen automatically, or remain accessible from another UI path.
**Suggested fix:** Only set `_lastShownUnsolicitedEventId` after `openUnsolicitedEventPopup()` successfully displays the modal, and clear/reset that key when the modal closes without a choice or dismissal. Alternatively, prevent generic modal close paths for unresolved unsolicited events.

### [HIGH] The render loop can overwrite unrelated modals with an unsolicited-event popup
**Location:** `js/ui.js:1272-1273`, `js/ui.js:2035-2044`, `js/ui.js:2241-2294`
**Scenario:** The player already has a normal modal open when `_checkPendingUnsolicitedEvent()` runs in the UI update loop.
**Current behavior:** There is no guard for “another modal is already open.” `openModal()` simply rewrites the shared modal title/body/footer, so the unsolicited event can stomp the current modal and discard its context or unsaved input.
**Expected behavior:** Unsolicited events should wait until the current modal is finished, or be queued/notified without replacing the active dialog.
**Suggested fix:** In `_checkPendingUnsolicitedEvent()`, bail out while the modal overlay is already visible (unless the visible modal is this same unsolicited-event popup), or add a queue so the event is shown after the current modal closes.

### [HIGH] Role-specific events stay eligible even when no matching NPC exists
**Location:** `js/modules/player_unsolicited_events.js:202-212`, `js/modules/player_unsolicited_events.js:251-285`, `js/modules/player_unsolicited_events.js:323-357`
**Scenario:** A town has no nobles/royal NPCs, but a political or rank event derives `extra.npcRole = 'noble'` or `'king'`.
**Current behavior:** `_pickNpc()` filters for the requested role, but if that list is empty it falls back to any adult in town (`280-283`). `_passesCondition()` treats that fallback as success, so events that are supposed to require a noble or royal contact can generate anyway and attach to a random commoner.
**Expected behavior:** If an event requires a specific NPC role, it should fail eligibility when no such NPC is available, or explicitly degrade to a generic no-NPC version.
**Suggested fix:** Remove the adult fallback for strict roles like `noble` and `king` (and any other roles meant to be semantically required), or add an explicit per-event flag that allows fallback only where it is intentional.

### [HIGH] Pending events are not invalidated when their NPC becomes unavailable
**Location:** `js/modules/player_unsolicited_events.js:607-608`, `js/modules/player_unsolicited_events.js:26163-26172`, `js/modules/player_unsolicited_events.js:26273-26289`, `js/modules/player_unsolicited_events.js:26295-26313`, `js/modules/player_unsolicited_events.js:26375-26412`, `js/player.js:24530-24533`
**Scenario:** An event is generated, then its NPC dies or otherwise stops being a valid actor before the player resolves it.
**Current behavior:** The cleanup pass only removes active events when `findPerson(inst.npcId)` returns an object with `alive === false`; it does not clear ordinary pending events at all, and it does not treat a missing lookup as fatal. The popup can still be shown and resolved, and `_rel(pid, ...)` can create/update `player.relationships[staleNpcId]` for an NPC that no longer exists.
**Expected behavior:** Events tied to a missing/dead NPC should auto-cancel or gracefully resolve without applying NPC-specific effects.
**Suggested fix:** Revalidate `npcId` for both pending and active events before surfacing or resolving them. If the NPC is missing/dead, clear the event (or swap to a generic fallback outcome) and skip relationship effects for nonexistent people.
