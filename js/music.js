// ============================================================
// Merchant Realms — Music System (MP3 Tracks)
// HTML5 Audio · Looping MP3 tracks per mood
// ============================================================

window.Music = (function () {
    'use strict';

    var volume = 0.3;
    var muted = false;
    var currentMood = null;
    var playing = false;
    var initialized = false;
    var _moodSwitchCooldown = 0;

    // Track map: mood -> Audio element
    var tracks = {};
    var currentAudio = null;
    var FADE_MS = 2000;
    var _fadeInterval = null;

    // v9p33river537: iOS Safari ignores any attempt to set audio.volume
    // programmatically (it's effectively read-only — user controls volume
    // via hardware buttons only). The audio.muted property IS honored on
    // iOS though, so on iOS we route ALL volume/mute changes through
    // audio.muted and skip the crossfade volume animation entirely.
    var _isIOS = (function() {
        try {
            return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        } catch (e) { return false; }
    })();

    function _effectiveMuted() {
        // Treat volume=0 as muted so iOS users (who can't lower volume below
        // 100%) get an actual silent state when they drag the slider to 0.
        return muted || volume <= 0.001;
    }

    function _applyAudioState(audio) {
        if (!audio) return;
        try { audio.muted = _effectiveMuted(); } catch (e) {}
        try { audio.volume = _effectiveMuted() ? 0 : volume; } catch (e) {}
    }

    var TRACK_FILES = {
        title:       'music/Title.mp3',
        peaceful:    'music/Peaceful.mp3',
        exploration: 'music/Exploration.mp3',
        tension:     'music/Tension.mp3',
        prosperity:  'music/Prosperity.mp3'
    };

    function init() {
        if (initialized) return;
        initialized = true;
        // Load saved preferences
        var savedVol = localStorage.getItem('merchantRealms_musicVolume');
        var savedMute = localStorage.getItem('merchantRealms_musicMuted');
        if (savedVol !== null) volume = parseFloat(savedVol);
        if (savedMute !== null) muted = savedMute === 'true';
        // Preload all tracks
        for (var mood in TRACK_FILES) {
            var audio = new Audio(TRACK_FILES[mood]);
            audio.loop = true;
            audio.preload = 'auto';
            _applyAudioState(audio);
            tracks[mood] = audio;
        }
    }

    function crossfadeTo(mood) {
        if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }

        var newAudio = tracks[mood];
        if (!newAudio) { console.warn('Music: no track for mood', mood); return; }

        var oldAudio = currentAudio;
        currentAudio = newAudio;

        // Set up the new track
        var targetVol = _effectiveMuted() ? 0 : volume;
        // v9p33river537: iOS Safari ignores audio.volume changes, so the
        // crossfade animation does nothing visible there. Hard-cut instead:
        // pause old track, start new at target state.
        if (_isIOS) {
            if (oldAudio && oldAudio !== newAudio) { try { oldAudio.pause(); } catch (e) {} }
            _applyAudioState(newAudio);
            var p = newAudio.play();
            if (p && p.then) p.then(function() { console.log('Music: playing', mood); }).catch(function(e) {
                console.warn('Music: play blocked for', mood, e.message);
                playing = false;
            });
            return;
        }

        newAudio.volume = 0;
        newAudio.currentTime = 0;
        var playPromise = newAudio.play();
        if (playPromise && playPromise.then) {
            playPromise.then(function() {
                console.log('Music: playing', mood);
            }).catch(function(e) {
                console.warn('Music: play blocked for', mood, e.message);
                playing = false;
            });
        }

        // Crossfade
        var steps = 40;
        var stepMs = FADE_MS / steps;
        var step = 0;
        _fadeInterval = setInterval(function() {
            step++;
            var frac = step / steps;
            // Re-read targetVol each frame so mid-fade volume/mute changes apply
            var curTarget = _effectiveMuted() ? 0 : volume;
            // Fade new in
            newAudio.volume = Math.min(curTarget, curTarget * frac);
            // Fade old out
            if (oldAudio && oldAudio !== newAudio) {
                oldAudio.volume = Math.max(0, curTarget * (1 - frac));
            }
            if (step >= steps) {
                clearInterval(_fadeInterval);
                _fadeInterval = null;
                newAudio.volume = curTarget;
                if (oldAudio && oldAudio !== newAudio) {
                    oldAudio.pause();
                    oldAudio.volume = 0;
                }
            }
        }, stepMs);
    }

    function stopInternal() {
        if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.volume = 0;
        }
        currentAudio = null;
        playing = false;
        currentMood = null;
    }

    function playTitleMusic() {
        init();
        // Always retry play — browser may have blocked the first attempt
        if (currentMood === 'title' && playing && currentAudio && !currentAudio.paused) return;
        stopAllExcept(null);
        currentMood = 'title';
        playing = true;
        crossfadeTo('title');
    }

    function playGameMusic(mood) {
        init();
        mood = mood || 'peaceful';
        if (currentMood === mood && playing && currentAudio && !currentAudio.paused) return;
        var now = Date.now();
        if (currentMood && currentMood !== 'title' && now - _moodSwitchCooldown < 60000) return;
        _moodSwitchCooldown = now;
        currentMood = mood;
        playing = true;
        crossfadeTo(mood);
    }

    function stopAllExcept(keepMood) {
        for (var m in tracks) {
            if (m !== keepMood) {
                tracks[m].pause();
                tracks[m].volume = 0;
            }
        }
    }

    function stop() { stopInternal(); }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        localStorage.setItem('merchantRealms_musicVolume', volume);
        // v9p33river537: apply mute state to ALL preloaded tracks (not just
        // currentAudio) so the crossfade target gets the right state too.
        // On iOS this is the only way to silence playback since audio.volume
        // is read-only there.
        for (var m in tracks) { _applyAudioState(tracks[m]); }
        if (currentAudio) {
            // Resume playback if audio was paused and volume > 0
            if (!_effectiveMuted() && currentAudio.paused && currentMood) {
                var p = currentAudio.play();
                if (p && p.then) p.catch(function() {});
                playing = true;
            }
        }
    }

    function toggleMute() {
        muted = !muted;
        localStorage.setItem('merchantRealms_musicMuted', muted);
        // v9p33river537: apply to ALL tracks via audio.muted (works on iOS,
        // unlike audio.volume which is read-only). Without this the mute
        // button graphic flipped but actual audio kept playing on iPad.
        for (var m in tracks) { _applyAudioState(tracks[m]); }
        if (currentAudio) {
            // Resume playback if unmuting and audio was paused
            if (!_effectiveMuted() && currentAudio.paused && currentMood) {
                var p = currentAudio.play();
                if (p && p.then) p.catch(function() {});
                playing = true;
            }
        } else if (!_effectiveMuted() && currentMood) {
            // No current audio but we have a mood — restart it
            crossfadeTo(currentMood);
            playing = true;
        }
    }

    return {
        init: init,
        playTitleMusic: playTitleMusic,
        playGameMusic: playGameMusic,
        stop: stop,
        setVolume: setVolume,
        toggleMute: toggleMute,
        isMuted: function() { return muted; },
        getVolume: function() { return volume; },
        getMood: function() { return currentMood; },
    };
})();
