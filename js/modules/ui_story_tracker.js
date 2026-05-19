// ============================================================
// Merchant Realms — Story Quest Tracker UI Module
// Floating panel showing current chapter, objectives with
// checkboxes, progress indicator, and collapse toggle.
// ============================================================
(function() {
    'use strict';
    if (!window.UI) throw new Error("UI must be loaded before ui_story_tracker.js");

    // ── State ────────────────────────────────────────────────

    var _container = null;
    var _collapsed = false;
    var _currentChapter = null;
    var _currentObjectives = [];
    var _styleInjected = false;
    var _notificationPip = null;

    // ── Constants ────────────────────────────────────────────

    // v9p33river312: was a static 28 that overstated total chapters and
    // mis-rendered branch chapters. We now derive both from the live
    // chapter list when StoryMode is available, and preserve branch
    // suffixes (e.g. ch10b, ch17a) in the displayed chapter label.
    var TOTAL_CHAPTERS = 28;
    function _getTotalChapters() {
        try {
            if (typeof StoryMode !== 'undefined' && StoryMode.getChapters) {
                var chs = StoryMode.getChapters();
                if (chs && chs.length) return chs.length;
            }
        } catch (_e) {}
        return TOTAL_CHAPTERS;
    }
    function _parseChapterRef(chapterId) {
        // v9p33river333: normalize malformed/string chapter refs before numeric comparisons.
        if (typeof chapterId !== 'string') {
            var n = Number(chapterId);
            return { num: isFinite(n) ? n : 0, suffix: '' };
        }
        var m = chapterId.match(/(\d+)([a-zA-Z]*)/);
        if (!m) return { num: 0, suffix: '' };
        return { num: parseInt(m[1], 10) || 0, suffix: m[2] || '' };
    }
    var PANEL_ID = 'storyTrackerPanel';

    var ACT_RANGES = [
        { label: 'Act I',   min: 1,  max: 6  },
        { label: 'Act II',  min: 7,  max: 12 },
        { label: 'Act III', min: 13, max: 18 },
        // v9p33river315: Act IV originally capped at chapter 19 (single-
        // chapter act), so anything past chapter 19 rendered without an
        // act label. Story chapters can extend past 19 (ch17a/b, ch18,
        // ch19, ch20+). Widen Act IV and add a catch-all Act V.
        { label: 'Act IV',  min: 19, max: 24 },
        { label: 'Act V',   min: 25, max: 99 }
    ];

    // ── CSS ──────────────────────────────────────────────────

    function _injectStyles() {
        if (_styleInjected) return;
        _styleInjected = true;

        var css = '' +
            '#' + PANEL_ID + ' {' +
            '  position: fixed;' +
            '  right: 16px;' +
            '  top: 120px;' +
            '  width: 300px;' +
            '  background: rgba(25, 20, 15, 0.95);' +
            '  border: 2px solid rgba(180, 160, 120, 0.5);' +
            '  border-radius: 8px;' +
            '  box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(180,160,120,0.15);' +
            '  z-index: 800;' +
            '  font-family: "Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif;' +
            '  color: #d4c8a0;' +
            '  overflow: hidden;' +
            '  transition: height 0.3s ease, opacity 0.3s ease;' +
            '}' +

            '#' + PANEL_ID + '.st-collapsed {' +
            '  height: 38px !important;' +
            '}' +

            '#' + PANEL_ID + '.st-hidden {' +
            '  display: none;' +
            '}' +

            /* Header */
            '.st-header {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: space-between;' +
            '  padding: 8px 12px;' +
            '  background: linear-gradient(135deg, rgba(60,45,25,0.9), rgba(40,30,18,0.95));' +
            '  border-bottom: 1px solid rgba(180,160,120,0.3);' +
            '  cursor: pointer;' +
            '  user-select: none;' +
            '  min-height: 22px;' +
            '  position: relative;' +
            '}' +

            '.st-header-title {' +
            '  font-size: 13px;' +
            '  font-weight: 700;' +
            '  color: #e8d8a0;' +
            '  white-space: nowrap;' +
            '  overflow: hidden;' +
            '  text-overflow: ellipsis;' +
            '  flex: 1;' +
            '}' +

            '.st-collapse-btn {' +
            '  background: none;' +
            '  border: 1px solid rgba(180,160,120,0.4);' +
            '  color: #b4a078;' +
            '  font-size: 12px;' +
            '  width: 22px;' +
            '  height: 22px;' +
            '  border-radius: 3px;' +
            '  cursor: pointer;' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  margin-left: 8px;' +
            '  flex-shrink: 0;' +
            '  transition: background 0.2s;' +
            '}' +

            '.st-collapse-btn:hover {' +
            '  background: rgba(180,160,120,0.2);' +
            '}' +

            /* Notification pip */
            '.st-pip {' +
            '  display: none;' +
            '  width: 8px;' +
            '  height: 8px;' +
            '  background: #d4a843;' +
            '  border-radius: 50%;' +
            '  position: absolute;' +
            '  right: 40px;' +
            '  top: 50%;' +
            '  transform: translateY(-50%);' +
            '  box-shadow: 0 0 6px #d4a843;' +
            '  animation: stPipPulse 1.5s infinite;' +
            '}' +

            '.st-pip.st-pip-show {' +
            '  display: block;' +
            '}' +

            '@keyframes stPipPulse {' +
            '  0%, 100% { opacity: 1; box-shadow: 0 0 6px #d4a843; }' +
            '  50% { opacity: 0.6; box-shadow: 0 0 12px #d4a843; }' +
            '}' +

            /* Body */
            '.st-body {' +
            '  padding: 10px 12px 6px;' +
            '}' +

            /* Objectives list */
            '.st-objectives {' +
            '  list-style: none;' +
            '  margin: 0;' +
            '  padding: 0;' +
            '}' +

            '.st-objective {' +
            '  display: flex;' +
            '  align-items: flex-start;' +
            '  padding: 5px 0;' +
            '  font-size: 13px;' +
            '  line-height: 1.4;' +
            '  transition: background 0.3s;' +
            '  border-radius: 4px;' +
            '  padding-left: 4px;' +
            '  padding-right: 4px;' +
            '}' +

            '.st-objective-check {' +
            '  flex-shrink: 0;' +
            '  margin-right: 8px;' +
            '  font-size: 14px;' +
            '  line-height: 1.4;' +
            '}' +

            '.st-objective-done .st-objective-check {' +
            '  color: #5cb85c;' +
            '}' +

            '.st-objective-done .st-objective-desc {' +
            '  color: #7a7560;' +
            '  text-decoration: line-through;' +
            '  text-decoration-color: rgba(122,117,96,0.4);' +
            '}' +

            '.st-objective-desc {' +
            '  flex: 1;' +
            '}' +

            '.st-optional-tag {' +
            '  font-size: 10px;' +
            '  color: #8a8060;' +
            '  font-style: italic;' +
            '  margin-left: 4px;' +
            '}' +

            '.st-objective-optional .st-objective-desc {' +
            '  font-style: italic;' +
            '  color: #b0a880;' +
            '}' +

            /* Gold glow for completable objectives */
            '.st-objective-glow {' +
            '  animation: stGoldGlow 2s ease-in-out infinite;' +
            '}' +

            '@keyframes stGoldGlow {' +
            '  0%, 100% { background: transparent; }' +
            '  50% { background: rgba(212,168,67,0.1); }' +
            '}' +

            /* Green flash for completion */
            '.st-objective-flash {' +
            '  animation: stGreenFlash 1.5s ease-out;' +
            '}' +

            '@keyframes stGreenFlash {' +
            '  0% { background: rgba(92,184,92,0.4); }' +
            '  100% { background: transparent; }' +
            '}' +

            /* Divider */
            '.st-divider {' +
            '  border: none;' +
            '  border-top: 1px solid rgba(180,160,120,0.25);' +
            '  margin: 8px 0 6px;' +
            '}' +

            /* Footer */
            '.st-footer {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: space-between;' +
            '  padding: 4px 12px 10px;' +
            '  font-size: 11px;' +
            '  color: #8a8060;' +
            '}' +

            '.st-progress-text {' +
            '  flex: 1;' +
            '}' +

            '.st-act-label {' +
            '  font-size: 10px;' +
            '  color: #6a6050;' +
            '  margin-left: 8px;' +
            '}' +

            /* Progress bar */
            '.st-progress-bar-wrap {' +
            '  width: 60px;' +
            '  height: 4px;' +
            '  background: rgba(180,160,120,0.15);' +
            '  border-radius: 2px;' +
            '  overflow: hidden;' +
            '  margin-left: 8px;' +
            '}' +

            '.st-progress-bar-fill {' +
            '  height: 100%;' +
            '  background: linear-gradient(90deg, #b4a078, #d4a843);' +
            '  border-radius: 2px;' +
            '  transition: width 0.5s ease;' +
            '}' +

            /* New objective notification glow on header */
            '.st-header-glow {' +
            '  animation: stHeaderGlow 2s ease-out;' +
            '}' +

            '@keyframes stHeaderGlow {' +
            '  0% { box-shadow: inset 0 0 15px rgba(212,168,67,0.4); }' +
            '  100% { box-shadow: none; }' +
            '}' +

            /* Mobile responsive */
            '@media (max-width: 600px) {' +
            '  #' + PANEL_ID + ' {' +
            '    right: 0;' +
            '    left: 0;' +
            '    top: auto;' +
            '    bottom: 70px;' +
            '    width: 100%;' +
            '    border-radius: 8px 8px 0 0;' +
            '    border-left: none;' +
            '    border-right: none;' +
            '    border-bottom: none;' +
            '  }' +
            '  #' + PANEL_ID + '.st-collapsed {' +
            '    height: 36px !important;' +
            '  }' +
            '}';

        var style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'storyTrackerStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── Helpers ──────────────────────────────────────────────

    function _getActLabel(chapterId) {
        var parsed = _parseChapterRef(chapterId);
        var chNum = parsed.num;
        for (var i = 0; i < ACT_RANGES.length; i++) {
            if (chNum >= ACT_RANGES[i].min && chNum <= ACT_RANGES[i].max) {
                return ACT_RANGES[i].label;
            }
        }
        return '';
    }

    // ── DOM Construction ─────────────────────────────────────

    function _ensureContainer() {
        if (_container) return _container;
        _injectStyles();

        _container = document.createElement('div');
        _container.id = PANEL_ID;
        _container.classList.add('st-hidden');

        // Header
        var header = document.createElement('div');
        header.className = 'st-header';
        header.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('.st-collapse-btn')) return;
            _toggleCollapse();
        });

        var title = document.createElement('span');
        title.className = 'st-header-title';
        title.textContent = '\u{1F4D6} STORY';
        header.appendChild(title);

        // Notification pip
        _notificationPip = document.createElement('span');
        _notificationPip.className = 'st-pip';
        header.appendChild(_notificationPip);

        var collapseBtn = document.createElement('button');
        collapseBtn.className = 'st-collapse-btn';
        collapseBtn.textContent = '_';
        collapseBtn.title = 'Collapse';
        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            _toggleCollapse();
        });
        header.appendChild(collapseBtn);

        _container.appendChild(header);

        // Body
        var body = document.createElement('div');
        body.className = 'st-body';

        var objectives = document.createElement('ul');
        objectives.className = 'st-objectives';
        body.appendChild(objectives);

        _container.appendChild(body);

        // Divider + Footer
        var footer = document.createElement('div');
        footer.className = 'st-footer';

        var divider = document.createElement('hr');
        divider.className = 'st-divider';

        var footerWrap = document.createElement('div');
        footerWrap.style.cssText = 'padding: 0 12px 10px;';
        footerWrap.appendChild(divider);

        var footerContent = document.createElement('div');
        footerContent.className = 'st-footer';
        footerContent.style.padding = '0';

        var progressText = document.createElement('span');
        progressText.className = 'st-progress-text';

        var actLabel = document.createElement('span');
        actLabel.className = 'st-act-label';

        var barWrap = document.createElement('div');
        barWrap.className = 'st-progress-bar-wrap';

        var barFill = document.createElement('div');
        barFill.className = 'st-progress-bar-fill';
        barFill.style.width = '0%';
        barWrap.appendChild(barFill);

        footerContent.appendChild(progressText);
        footerContent.appendChild(actLabel);
        footerContent.appendChild(barWrap);

        footerWrap.appendChild(footerContent);
        _container.appendChild(footerWrap);

        document.body.appendChild(_container);
        return _container;
    }

    // ── Collapse ─────────────────────────────────────────────

    function _toggleCollapse() {
        _collapsed = !_collapsed;
        if (_collapsed) {
            _container.classList.add('st-collapsed');
        } else {
            _container.classList.remove('st-collapsed');
            _hidePip();
        }
    }

    function _showPip() {
        if (_notificationPip) {
            _notificationPip.classList.add('st-pip-show');
        }
    }

    function _hidePip() {
        if (_notificationPip) {
            _notificationPip.classList.remove('st-pip-show');
        }
    }

    // ── Rendering ────────────────────────────────────────────

    function _renderObjectives(objectives) {
        var list = _container.querySelector('.st-objectives');
        if (!list) return;
        list.innerHTML = '';
        objectives = Array.isArray(objectives) ? objectives : [];
        var seenIds = {};

        for (var i = 0; i < objectives.length; i++) {
            var obj = objectives[i] && typeof objectives[i] === 'object' ? objectives[i] : {};
            var li = document.createElement('li');
            li.className = 'st-objective';
            var objId = (obj.id != null && obj.id !== '') ? String(obj.id) : 'objective-' + i;
            if (seenIds[objId]) objId = objId + '-' + i;
            seenIds[objId] = true;
            // v9p33river333: setAttribute is safe, but IDs must be non-empty and unique for flashing.
            li.setAttribute('data-obj-id', objId);

            if (obj.done) {
                li.classList.add('st-objective-done');
            }
            if (obj.optional) {
                li.classList.add('st-objective-optional');
            }

            var check = document.createElement('span');
            check.className = 'st-objective-check';
            check.textContent = obj.done ? '\u2705' : '\u2610';
            li.appendChild(check);

            var desc = document.createElement('span');
            desc.className = 'st-objective-desc';
            desc.textContent = obj.desc != null ? String(obj.desc) : 'Objective';
            li.appendChild(desc);

            if (obj.hint && !obj.done) {
                var hint = document.createElement('span');
                hint.className = 'st-objective-hint';
                hint.style.cssText = 'display:block;font-size:0.65rem;color:#b0a080;font-style:italic;margin-top:1px;margin-left:4px;';
                hint.textContent = '\u{1F4A1} ' + String(obj.hint);
                li.appendChild(hint);
            }

            if (obj.optional) {
                var tag = document.createElement('span');
                tag.className = 'st-optional-tag';
                tag.textContent = '(optional)';
                li.appendChild(tag);
            }

            list.appendChild(li);
        }
    }

    function _renderFooter(chapterId) {
        var progressText = _container.querySelector('.st-progress-text');
        var actLabel = _container.querySelector('.st-act-label');
        var barFill = _container.querySelector('.st-progress-bar-fill');

        // v9p33river312: preserve branch suffix (a/b) and use dynamic
        // chapter total so ch10b/ch17a render correctly and progress
        // bars don't underreport completion.
        var parsed = _parseChapterRef(chapterId);
        var total = Math.max(1, _getTotalChapters());
        var chNum = Math.max(0, Math.min(total - 1, Number(parsed.num) || 0));
        var chLabel = String(chNum + 1) + (parsed.suffix || '');

        if (progressText) {
            progressText.textContent = 'Chapter ' + chLabel + ' of ' + total;
        }
        if (actLabel) {
            actLabel.textContent = _getActLabel(chNum);
        }
        if (barFill) {
            var pct = Math.max(0, Math.min(100, Math.round(((chNum + 1) / total) * 100)));
            // v9p33river333: clamp chapter progress so unusual IDs cannot overflow the bar.
            barFill.style.width = pct + '%';
        }
    }

    // ── Public API ───────────────────────────────────────────

    function updateStoryTracker(chapter, objectives) {
        _ensureContainer();
        _currentChapter = chapter;
        _currentObjectives = Array.isArray(objectives) ? objectives : [];

        // Update header title
        var titleEl = _container.querySelector('.st-header-title');
        if (titleEl && chapter) {
            titleEl.textContent = '\u{1F4D6} STORY: ' + (chapter.title || '');
        }

        _renderObjectives(_currentObjectives);

        // Render chapter note/subnote if present
        var oldNotes = _container.querySelectorAll('.st-chapter-note');
        for (var _ni = 0; _ni < oldNotes.length; _ni++) oldNotes[_ni].remove();
        if (chapter && chapter.note) {
            var noteEl = document.createElement('div');
            noteEl.className = 'st-chapter-note';
            noteEl.style.cssText = 'font-size:0.75rem;color:#b0a080;font-style:italic;padding:4px 8px 0;margin-top:2px;';
            noteEl.textContent = '\u{1F4AC} ' + String(chapter.note);
            var list = _container.querySelector('.st-objectives');
            if (list && list.parentNode) list.parentNode.insertBefore(noteEl, list.nextSibling);
        }

        // v9p33river333: missing chapter.id should not fall back to chapter 2/progress for the wrong chapter.
        _renderFooter(chapter && chapter.id != null ? chapter.id : 0);
    }

    function showStoryTracker() {
        _ensureContainer();
        _container.classList.remove('st-hidden');
    }

    function hideStoryTracker() {
        if (_container) {
            _container.classList.add('st-hidden');
        }
    }

    function flashObjectiveComplete(objectiveId) {
        if (!_container) return;

        var items = _container.querySelectorAll('.st-objective');
        for (var i = 0; i < items.length; i++) {
            if (String(items[i].getAttribute('data-obj-id')) === String(objectiveId)) {
                var el = items[i];

                // Update visual state to done
                el.classList.add('st-objective-done');
                el.classList.remove('st-objective-glow');
                var check = el.querySelector('.st-objective-check');
                if (check) check.textContent = '\u2705';

                // Green flash animation
                el.classList.add('st-objective-flash');
                setTimeout(function(target) {
                    target.classList.remove('st-objective-flash');
                }, 1500, el);

                // Show pip if collapsed
                if (_collapsed) {
                    _showPip();
                }
                break;
            }
        }
    }

    function notifyNewObjective(desc) {
        _ensureContainer();

        // Show pip if collapsed
        if (_collapsed) {
            _showPip();
        }

        // Glow effect on header
        var header = _container.querySelector('.st-header');
        if (header) {
            header.classList.remove('st-header-glow');
            // Force reflow to restart animation
            void header.offsetWidth;
            header.classList.add('st-header-glow');
            setTimeout(function() {
                header.classList.remove('st-header-glow');
            }, 2000);
        }

        // Add gold glow to the matching objective row if it exists
        if (desc) {
            var matchId = (typeof desc === 'object' && desc.id != null) ? String(desc.id) : null;
            var matchDesc = (typeof desc === 'object' && desc.desc != null) ? String(desc.desc) : String(desc);
            var items = _container.querySelectorAll('.st-objective');
            var glowTarget = null;
            for (var i = 0; i < items.length; i++) {
                var descEl = items[i].querySelector('.st-objective-desc');
                if ((matchId && String(items[i].getAttribute('data-obj-id')) === matchId) || (!matchId && descEl && descEl.textContent === matchDesc)) {
                    // v9p33river333: duplicate descriptions should prefer an unfinished row instead of an arbitrary completed one.
                    glowTarget = items[i];
                    if (!items[i].classList.contains('st-objective-done')) break;
                }
            }
            if (glowTarget) glowTarget.classList.add('st-objective-glow');
        }
    }

    // ── Attach to UI ─────────────────────────────────────────

    UI.updateStoryTracker = updateStoryTracker;
    UI.showStoryTracker = showStoryTracker;
    UI.hideStoryTracker = hideStoryTracker;
    UI.flashObjectiveComplete = flashObjectiveComplete;
    UI.notifyNewObjective = notifyNewObjective;

})();
