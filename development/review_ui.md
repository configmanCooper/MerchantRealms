### [CRITICAL] Pending event can be marked "shown" even when no popup appears
**Location:** `js\ui.js:2039-2044`, `js\ui.js:2241-2286`
**Current behavior:** `_checkPendingUnsolicitedEvent()` stores `_lastShownUnsolicitedEventId` before it calls `openUnsolicitedEventPopup()`. `openModal()` can refuse to open during funeral/encounter/bankruptcy/conquest locks, and any render exception is swallowed.
**Problem:** A pending unsolicited event can become permanently invisible until its step/id changes. The player may only see a generic warning toast—or nothing at all—and has no reliable recovery path.
**Suggested fix:** Make `openUnsolicitedEventPopup()`/`openModal()` report whether the popup actually opened, and only update `_lastShownUnsolicitedEventId` after a successful display. Also skip UE surfacing while lock states are active.

### [CRITICAL] Failed choice attempts close the modal and can orphan the pending event
**Location:** `js\modules\ui_actions.js:4918-4928`, `js\ui.js:2039-2042`
**Current behavior:** Any unsuccessful result from `handleUnsolicitedEventChoice()` shows a toast and immediately closes the unsolicited-event popup.
**Problem:** Failure responses such as `Choice not found`, stale-instance mismatches, or transient validation failures do not necessarily clear `player._pendingUnsolicitedEvent`. Once the popup closes, `_lastShownUnsolicitedEventId` prevents it from reopening, so the player can no longer answer the event.
**Suggested fix:** Only close on success, or when the backend explicitly confirms the pending event was cleared. Otherwise keep the modal open and refresh/disable the affected controls.

### [CRITICAL] Zero-delay chain steps can disappear behind the result modal
**Location:** `js\modules\player_unsolicited_events.js:26423-26440`, `js\modules\ui_actions.js:4923-4924`, `js\ui.js:1272-1273`, `js\ui.js:2039-2043`
**Current behavior:** A successful choice can queue the next step immediately (`delay === 0`) before the result modal opens 80 ms later.
**Problem:** The update loop can surface the next unsolicited-event popup before the result modal, mark that new step as already shown, and then have the result modal replace it. After the player clicks OK, the next step never reopens.
**Suggested fix:** Suppress `_checkPendingUnsolicitedEvent()` while an unsolicited-event result modal is active, or chain the next step from the result modal's OK handler instead of the global update loop.

### [CRITICAL] Choice/effect rendering assumes perfect data and can crash the flow
**Location:** `js\modules\player_unsolicited_events.js:26318-26325`, `js\ui.js:1988-1995`, `js\ui.js:2010-2022`
**Current behavior:** The code directly reads `raw.choices.length`, `ch.disabled`, and `eff.type` without normalizing the arrays or skipping null entries.
**Problem:** A missing `raw.choices`, a null choice, or a null effect can throw during popup/result rendering. In the popup path, `_checkPendingUnsolicitedEvent()` swallows the exception, so the event silently stops appearing.
**Suggested fix:** Normalize with `Array.isArray(...) ? ... : []`, skip falsy entries, and fall back to a generic badge/message instead of hard-failing the render.

### [HIGH] Unsolicited events can hijack unrelated modals
**Location:** `js\ui.js:1261-1273`, `js\ui.js:2241-2294`
**Current behavior:** Every UI update tick can call `openUnsolicitedEventPopup()` even if the player is already using trade, character, settings, or other modal-driven UI.
**Problem:** Because the game reuses one modal shell, the unsolicited-event popup can overwrite the player's current modal instead of queuing. This is a flow break even when no hard lock is active.
**Suggested fix:** If `modalOverlay` is already visible (or another known modal workflow is active), queue the event and show it after the current modal closes.

### [HIGH] The quest tracker has no recovery action for ready events
**Location:** `js\ui.js:7727-7754`
**Current behavior:** Ready multi-step events only show status text: `✨ Ready — check now`.
**Problem:** If the popup was blocked, lost, or missed, the tracker offers no way to reopen it. The wording sounds actionable, but there is no action.
**Suggested fix:** Add a `Resume Event` / `Open Event` button for `status === 'ready'` that surfaces the pending step directly.

### [MEDIUM] A missing/stale npcId removes the speaker header even when npcName exists
**Location:** `js\ui.js:1961-1986`, `js\modules\player_unsolicited_events.js:26312-26313`
**Current behavior:** The unsolicited-event popup only renders the speaker block when `Engine.getPerson(evt.npcId)` succeeds.
**Problem:** If `npcId` is null, stale, or no longer resolvable, the player loses who approached them, their social context, and the clickable identity affordance even though `npcName` is already provided by the API.
**Suggested fix:** Always render a fallback header from `evt.npcName`; only add the portrait, relationship line, rank, and person-detail link when the NPC object resolves.

### [MEDIUM] God-mode UE controls give delayed or weak feedback
**Location:** `js\ui.js:747-748`, `js\ui.js:19179-19180`
**Current behavior:** `_godToggleUeBoost` only shows a toast; the button label/color stays stale until the panel refreshes. `_godForceUe` only toasts a raw reason string.
**Problem:** Testers can think the buttons did nothing or are unsure which event was forced.
**Suggested fix:** Update the clicked UE toggle button immediately (matching the other god-mode toggles), and make the force-event toast include the spawned event title/status or open the popup immediately after a successful force.

### [MEDIUM] Clicking the NPC name in the popup can feel like nothing happened
**Location:** `js\ui.js:1978-1980`, `js\ui.js:798`, `js\modules\ui_actions.js:1362-1369`
**Current behavior:** The UE popup uses `showPersonDetailById`, which opens the right-side person panel but leaves the modal itself on screen.
**Problem:** The modal still dominates the viewport, so many players will miss the side-panel change. This is inconsistent with nearby unsolicited-offer UI, which closes the modal first before opening NPC details.
**Suggested fix:** Either switch to `showPersonDetailAndCloseModal`, or make the affordance explicit (for example, “View in side panel”) and ensure the event is easy to reopen afterward.
