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
            audio.volume = muted ? 0 : volume;
            audio.preload = 'auto';
            tracks[mood] = audio;
        }
    }

    function crossfadeTo(mood) {
        if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }

        var newAudio = tracks[mood];
        if (!newAudio) return;

        var oldAudio = currentAudio;
        currentAudio = newAudio;

        // Set up the new track
        var targetVol = muted ? 0 : volume;
        newAudio.volume = 0;
        newAudio.currentTime = 0;
        var playPromise = newAudio.play();
        if (playPromise && playPromise.catch) playPromise.catch(function() {});

        // Crossfade
        var steps = 40;
        var stepMs = FADE_MS / steps;
        var step = 0;
        _fadeInterval = setInterval(function() {
            step++;
            var frac = step / steps;
            // Fade new in
            newAudio.volume = Math.min(targetVol, targetVol * frac);
            // Fade old out
            if (oldAudio && oldAudio !== newAudio) {
                oldAudio.volume = Math.max(0, targetVol * (1 - frac));
            }
            if (step >= steps) {
                clearInterval(_fadeInterval);
                _fadeInterval = null;
                newAudio.volume = targetVol;
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
        if (currentMood === 'title' && playing) return;
        stopAllExcept(null);
        currentMood = 'title';
        playing = true;
        crossfadeTo('title');
    }

    function playGameMusic(mood) {
        init();
        mood = mood || 'peaceful';
        if (currentMood === mood && playing) return;
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
        if (currentAudio) currentAudio.volume = muted ? 0 : volume;
        localStorage.setItem('merchantRealms_musicVolume', volume);
    }

    function toggleMute() {
        muted = !muted;
        if (currentAudio) currentAudio.volume = muted ? 0 : volume;
        localStorage.setItem('merchantRealms_musicMuted', muted);
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
