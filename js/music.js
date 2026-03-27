// ============================================================
// Merchant Realms — Procedural Medieval Music System
// Web Audio API · No external files · Karplus-Strong synthesis
// ============================================================

window.Music = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let currentMood = null;
    let volume = 0.3;
    let muted = false;
    let playing = false;
    let _loopTimeout = null;
    let _scheduledSources = [];
    let _segmentGain = null;
    let _prevSegmentGain = null;
    let _moodSwitchCooldown = 0;

    const SCALES = {
        aeolian:    [0, 2, 3, 5, 7, 8, 10],
        dorian:     [0, 2, 3, 5, 7, 9, 10],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        pentatonic: [0, 2, 4, 7, 9],
        phrygian:   [0, 1, 3, 5, 7, 8, 10],
    };

    function noteFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    function degreeToSemitones(scale, degree) {
        var s = SCALES[scale];
        var oct = Math.floor(degree / s.length);
        var idx = ((degree % s.length) + s.length) % s.length;
        return s[idx] + oct * 12;
    }

    // ── Initialization ──

    function init() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            var savedVol = localStorage.getItem('merchantRealms_musicVolume');
            var savedMute = localStorage.getItem('merchantRealms_musicMuted');
            if (savedVol !== null) volume = parseFloat(savedVol);
            if (savedMute !== null) muted = savedMute === 'true';
            masterGain.gain.value = muted ? 0 : volume;
            masterGain.connect(ctx.destination);
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) {
            console.warn('Music: Web Audio not available', e);
            ctx = null;
        }
    }

    function ensureCtx() {
        if (!ctx) init();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(function () {
                // Re-trigger current mood after context resumes
                if (currentMood && !playing) {
                    playing = true;
                    scheduleLoop(currentMood);
                }
            });
        }
        return !!ctx;
    }

    // ── Sound Synthesis ──

    function trackSource(s) { _scheduledSources.push(s); }

    function pluck(freq, t, dur, vol, dest) {
        var sr = ctx.sampleRate;
        var bufLen = Math.round(sr / freq);
        if (bufLen < 2) return;
        var total = Math.ceil(sr * dur);
        var buf = ctx.createBuffer(1, total, sr);
        var d = buf.getChannelData(0);
        for (var i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
        var decay = 0.496 + Math.min(freq / 4000, 0.003);
        for (var i = bufLen; i < total; i++) d[i] = (d[i - bufLen] + d[i - bufLen + 1]) * decay;
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var g = ctx.createGain();
        g.gain.setValueAtTime(vol * 0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92);
        src.connect(g); g.connect(dest);
        src.start(t); trackSource(src);
    }

    function flute(freq, t, dur, vol, dest) {
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        var vib = ctx.createOscillator();
        vib.frequency.value = 4.5;
        var vg = ctx.createGain();
        vg.gain.value = freq * 0.007;
        vib.connect(vg); vg.connect(osc.frequency);
        vib.start(t); vib.stop(t + dur + 0.05);
        var g = ctx.createGain();
        var att = Math.min(0.2, dur * 0.2);
        var rel = Math.min(0.25, dur * 0.25);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol * 0.15, t + att);
        g.gain.setValueAtTime(vol * 0.15, t + dur - rel);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + dur + 0.05);
        trackSource(osc);
    }

    function drone(freq, t, dur, vol, dest) {
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var g = ctx.createGain();
        var fade = Math.min(3, dur * 0.15);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol * 0.055, t + fade);
        g.gain.setValueAtTime(vol * 0.055, t + dur - fade);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + dur + 0.1);
        trackSource(osc);
    }

    function tap(t, type, vol, dest) {
        var dur = type === 'low' ? 0.1 : 0.05;
        var n = Math.ceil(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        var rate = type === 'low' ? 0.022 : 0.01;
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * rate));
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter();
        f.type = type === 'low' ? 'lowpass' : 'highpass';
        f.frequency.value = type === 'low' ? 250 : 2500;
        var g = ctx.createGain();
        g.gain.value = (type === 'low' ? 0.1 : 0.035) * vol;
        src.connect(f); f.connect(g); g.connect(dest);
        src.start(t); trackSource(src);
    }

    // ── Motif-Based Melody Generation ──
    // Creates a short motif then repeats it with variation for musical coherence.

    function generateMotif(scale, len) {
        var s = SCALES[scale], motif = [0], deg = 0;
        for (var i = 1; i < len; i++) {
            var step = Math.random() < 0.8
                ? (Math.random() < 0.55 ? 1 : -1)
                : (Math.random() < 0.5 ? 2 : -2);
            deg = Math.max(-3, Math.min(s.length + 2, deg + step));
            motif.push(deg);
        }
        return motif;
    }

    function varyMotif(motif) {
        var v = motif.slice();
        var op = Math.random();
        if (op < 0.3) { // transpose up/down 1-2 degrees
            var shift = Math.random() < 0.5 ? 1 : -1;
            v = v.map(function(d) { return d + shift; });
        } else if (op < 0.6) { // invert last two notes
            if (v.length >= 2) { var tmp = v[v.length-1]; v[v.length-1] = v[v.length-2]; v[v.length-2] = tmp; }
        } else { // alter one note by a step
            var idx = 1 + Math.floor(Math.random() * (v.length - 1));
            v[idx] += Math.random() < 0.5 ? 1 : -1;
        }
        return v;
    }

    // Build a phrase: 4 bars of rhythm slots, using a motif with call-and-response.
    // Returns array of {degree, beatOffset, durBeats} or null for rests.
    function buildPhrase(scale, beatsPerBar, motifLen, restChance) {
        var motif = generateMotif(scale, motifLen);
        var answer = varyMotif(motif);
        var notes = [];
        var totalBeats = beatsPerBar * 4;
        // Call: bars 1-2; Answer: bars 3-4
        [motif, answer].forEach(function(m, half) {
            var offset = half * beatsPerBar * 2;
            var pos = 0;
            m.forEach(function(deg, i) {
                var beatPos = offset + pos;
                if (beatPos >= totalBeats) return;
                if (Math.random() < restChance) {
                    pos += 1;
                    return;
                }
                var dur = Math.random() < 0.6 ? 1 : 2;
                notes.push({ degree: deg, beat: beatPos, dur: dur });
                pos += dur;
            });
        });
        // End phrase on root or fifth
        if (notes.length > 0) {
            var last = notes[notes.length - 1];
            var s = SCALES[scale];
            last.degree = Math.random() < 0.7 ? 0 : Math.floor(s.length / 2);
        }
        return notes;
    }

    // Dynamics: gentle crescendo/decrescendo across a phrase
    function dynVol(beatInPhrase, totalBeats, baseVol) {
        var pos = beatInPhrase / totalBeats;
        var envelope = Math.sin(pos * Math.PI); // peaks in middle
        return baseVol * (0.6 + 0.4 * envelope);
    }

    // ── Segment Generators ──

    function genTitle(t0, dest) {
        var scale = 'aeolian', baseMidi = 50, bpm = 58; // D3=50
        var beat = 60 / bpm, bars = 16, segDur = bars * 4 * beat;
        drone(noteFreq(baseMidi - 12), t0, segDur, 0.9, dest);

        // Sparse melody: 2 four-bar phrases with long pauses between
        for (var p = 0; p < 2; p++) {
            var phraseStart = t0 + (p * 8) * 4 * beat;
            var phrase = buildPhrase(scale, 4, 4, 0.3);
            phrase.forEach(function(n) {
                var t = phraseStart + n.beat * beat * 2; // half-time: very slow
                var midi = baseMidi + degreeToSemitones(scale, n.degree);
                var v = dynVol(n.beat, 16, 0.5);
                pluck(noteFreq(midi), t, beat * n.dur * 2.5, v, dest);
            });
        }

        // Single flute echo in second half
        var ft = t0 + 10 * 4 * beat;
        var fMotif = generateMotif(scale, 3);
        fMotif.forEach(function(deg, i) {
            var midi = baseMidi + 12 + degreeToSemitones(scale, deg);
            flute(noteFreq(midi), ft + i * beat * 3, beat * 4, 0.35, dest);
        });

        // Bass: root on beat 1 every other bar
        for (var b = 0; b < bars; b += 2) {
            var bn = b % 4 === 0 ? baseMidi - 12 : baseMidi - 12 + 7;
            pluck(noteFreq(bn), t0 + b * 4 * beat, beat * 4, 0.25, dest);
        }
        return segDur;
    }

    function genPeaceful(t0, dest) {
        var scale = 'mixolydian', baseMidi = 55, bpm = 88; // G3=55
        var beat = 60 / bpm, bars = 16, segDur = bars * 4 * beat;

        // Four 4-bar phrases: play motif, repeat varied, play new motif, repeat varied
        var motifA = generateMotif(scale, 5);
        var motifB = generateMotif(scale, 5);
        var phrases = [motifA, varyMotif(motifA), motifB, varyMotif(motifB)];
        phrases.forEach(function(motif, pi) {
            var pStart = t0 + pi * 4 * 4 * beat;
            var pos = 0;
            motif.forEach(function(deg, ni) {
                var dur = [1, 1, 0.5, 1, 0.5][ni] || 1;
                var beatPos = pos;
                pos += dur;
                if (Math.random() < 0.15) return; // rest
                var midi = baseMidi + degreeToSemitones(scale, deg);
                var t = pStart + beatPos * beat;
                var v = dynVol(beatPos, 4, 0.55);
                pluck(noteFreq(midi), t, beat * dur * 1.2, v, dest);
            });
            // Repeat the motif a second time within same 4-bar block
            pos = 4; // start on bar 3
            varyMotif(motif).forEach(function(deg, ni) {
                var dur = [1, 0.5, 1, 1, 0.5][ni] || 1;
                var beatPos = pos;
                pos += dur;
                if (Math.random() < 0.2) return;
                var midi = baseMidi + degreeToSemitones(scale, deg);
                var t = pStart + beatPos * beat;
                pluck(noteFreq(midi), t, beat * dur * 1.2, dynVol(beatPos, 8, 0.5), dest);
            });
        });

        // Bass: root-fifth alternation on beats 1 & 3
        for (var b = 0; b < bars; b++) {
            var bt = t0 + b * 4 * beat;
            var root = baseMidi - 12;
            pluck(noteFreq(root), bt, beat * 2, 0.3, dest);
            pluck(noteFreq(root + 7), bt + beat * 2, beat * 2, 0.25, dest);
        }

        // Light tap on beat 1 only
        for (var b = 0; b < bars; b++) {
            tap(t0 + b * 4 * beat, 'low', 0.5, dest);
        }
        return segDur;
    }

    function genExploration(t0, dest) {
        var scale = 'pentatonic', baseMidi = 57, bpm = 68; // A3=57
        var beat = 60 / bpm, bars = 16, segDur = bars * 4 * beat;
        drone(noteFreq(baseMidi - 12), t0, segDur, 0.7, dest);

        // Two 8-bar phrases: very sparse, long notes with gaps
        for (var p = 0; p < 2; p++) {
            var pStart = t0 + p * 8 * 4 * beat;
            var motif = generateMotif(scale, 4);
            // Play motif with long durations and gaps
            motif.forEach(function(deg, i) {
                if (Math.random() < 0.25) return;
                var midi = baseMidi + degreeToSemitones(scale, deg);
                var t = pStart + i * beat * 4; // one note every bar
                var v = dynVol(i, 4, 0.45);
                pluck(noteFreq(midi), t, beat * 3.5, v, dest);
            });
            // Rest for 2 bars, then varied repeat
            var rStart = pStart + 5 * 4 * beat;
            varyMotif(motif).forEach(function(deg, i) {
                if (Math.random() < 0.3) return;
                var midi = baseMidi + degreeToSemitones(scale, deg);
                var t = rStart + i * beat * 4;
                pluck(noteFreq(midi), t, beat * 3, 0.35, dest);
            });
        }

        // No percussion for exploration
        return segDur;
    }

    function genTension(t0, dest) {
        var scale = 'phrygian', baseMidi = 52, bpm = 108; // E3=52
        var beat = 60 / bpm, bars = 16, segDur = bars * 4 * beat;
        drone(noteFreq(baseMidi - 12), t0, segDur, 1.0, dest);

        // Driving bass: steady eighth-note pulse on E2
        for (var b = 0; b < bars; b++) {
            var bt = t0 + b * 4 * beat;
            for (var e = 0; e < 8; e++) {
                var bn = e % 4 === 0 ? baseMidi - 12 : baseMidi - 12 + (e % 2 === 0 ? 7 : 0);
                pluck(noteFreq(bn), bt + e * beat * 0.5, beat * 0.6, 0.35, dest);
            }
        }

        // Melody: tense motifs with half-step motion, 4 four-bar phrases
        var motif = generateMotif(scale, 6);
        var pats = [motif, varyMotif(motif), generateMotif(scale, 6), varyMotif(motif)];
        pats.forEach(function(pat, pi) {
            var pStart = t0 + pi * 4 * 4 * beat;
            var pos = 0;
            pat.forEach(function(deg, ni) {
                var dur = Math.random() < 0.5 ? 0.5 : 1;
                var t = pStart + pos * beat;
                pos += dur;
                var midi = baseMidi + degreeToSemitones(scale, deg);
                pluck(noteFreq(midi), t, beat * dur * 0.9, dynVol(pos, 6, 0.6), dest);
            });
        });

        // Percussion on every beat
        for (var b = 0; b < bars; b++) {
            var bt = t0 + b * 4 * beat;
            for (var i = 0; i < 4; i++) {
                tap(bt + i * beat, 'low', i === 0 ? 0.7 : 0.45, dest);
            }
        }
        return segDur;
    }

    function genProsperity(t0, dest) {
        var scale = 'dorian', baseMidi = 60, bpm = 84; // C4=60
        var beat = 60 / bpm, bars = 16, segDur = bars * 4 * beat;

        // Two voices in counterpoint (melody + harmony a third apart)
        var motif = generateMotif(scale, 6);
        var pats = [motif, varyMotif(motif), generateMotif(scale, 6), varyMotif(motif)];
        pats.forEach(function(pat, pi) {
            var pStart = t0 + pi * 4 * 4 * beat;
            var pos = 0;
            pat.forEach(function(deg, ni) {
                var dur = [1, 1, 0.5, 1, 0.5, 1][ni] || 1;
                var t = pStart + pos * beat;
                pos += dur;
                if (Math.random() < 0.12) return;
                var midi1 = baseMidi + degreeToSemitones(scale, deg);
                var midi2 = baseMidi + degreeToSemitones(scale, deg + 2); // third above
                pluck(noteFreq(midi1), t, beat * dur * 1.1, dynVol(pos, 6, 0.5), dest);
                pluck(noteFreq(midi2), t + 0.03, beat * dur * 1.1, dynVol(pos, 6, 0.3), dest);
            });
        });

        // Flute countermelody in second half only
        var ft = t0 + 8 * 4 * beat;
        var fMotif = generateMotif(scale, 4);
        [fMotif, varyMotif(fMotif)].forEach(function(m, hi) {
            var start = ft + hi * 4 * 4 * beat;
            m.forEach(function(deg, i) {
                if (Math.random() < 0.25) return;
                var midi = baseMidi + 12 + degreeToSemitones(scale, deg);
                flute(noteFreq(midi), start + i * beat * 2, beat * 3, 0.3, dest);
            });
        });

        // Gentle bass: root-fifth movement
        for (var b = 0; b < bars; b++) {
            var bt = t0 + b * 4 * beat;
            var root = b % 4 < 2 ? baseMidi - 12 : baseMidi - 12 + 5;
            pluck(noteFreq(root), bt, beat * 2, 0.3, dest);
            if (b % 2 === 0) pluck(noteFreq(root + 7), bt + beat * 2, beat * 2, 0.22, dest);
        }

        // Soft percussion on beat 1
        for (var b = 0; b < bars; b++) {
            tap(t0 + b * 4 * beat, 'low', 0.4, dest);
            if (b % 2 === 0) tap(t0 + b * 4 * beat + beat * 2, 'low', 0.25, dest);
        }
        return segDur;
    }

    // ── Playback Control ──

    function cleanupSources() {
        if (_scheduledSources.length > 300)
            _scheduledSources = _scheduledSources.slice(-150);
    }

    function stopAllSources() {
        _scheduledSources.forEach(function(s) { try { s.stop(); } catch(e) {} });
        _scheduledSources = [];
    }

    function scheduleLoop(mood) {
        if (!ensureCtx()) return;
        cleanupSources();

        var newGain = ctx.createGain();
        newGain.gain.value = 1.0;
        newGain.connect(masterGain);

        if (_segmentGain) {
            _prevSegmentGain = _segmentGain;
            var ft = ctx.currentTime;
            try {
                _prevSegmentGain.gain.setValueAtTime(1.0, ft);
                _prevSegmentGain.gain.linearRampToValueAtTime(0.0, ft + 4);
            } catch(e) {}
            setTimeout(function() {
                try { if (_prevSegmentGain) _prevSegmentGain.disconnect(); } catch(e) {}
                _prevSegmentGain = null;
            }, 5000);
        }

        var fadeIn = (mood === 'title') ? 0.5 : 3;
        newGain.gain.setValueAtTime(0.0, ctx.currentTime);
        newGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + fadeIn);
        _segmentGain = newGain;

        var t0 = ctx.currentTime + 0.15;
        var segDur;
        switch (mood) {
            case 'title':       segDur = genTitle(t0, newGain); break;
            case 'exploration': segDur = genExploration(t0, newGain); break;
            case 'tension':     segDur = genTension(t0, newGain); break;
            case 'prosperity':  segDur = genProsperity(t0, newGain); break;
            default:            segDur = genPeaceful(t0, newGain); break;
        }

        if (_loopTimeout) clearTimeout(_loopTimeout);
        _loopTimeout = setTimeout(function() {
            if (playing && currentMood === mood) scheduleLoop(mood);
        }, Math.max(1000, (segDur - 4) * 1000));
    }

    function stopInternal() {
        if (_loopTimeout) { clearTimeout(_loopTimeout); _loopTimeout = null; }
        stopAllSources();
        try { if (_segmentGain) _segmentGain.disconnect(); } catch(e) {}
        try { if (_prevSegmentGain) _prevSegmentGain.disconnect(); } catch(e) {}
        _segmentGain = null; _prevSegmentGain = null;
        playing = false; currentMood = null;
    }

    function playTitleMusic() {
        if (!ensureCtx()) return;
        if (currentMood === 'title' && playing) return;
        stopInternal();
        currentMood = 'title'; playing = true;
        scheduleLoop('title');
    }

    function playGameMusic(mood) {
        if (!ensureCtx()) return;
        mood = mood || 'peaceful';
        if (currentMood === mood && playing) return;
        var now = Date.now();
        if (currentMood && currentMood !== 'title' && now - _moodSwitchCooldown < 60000) return;
        _moodSwitchCooldown = now;
        currentMood = mood; playing = true;
        scheduleLoop(mood);
    }

    function stop() { stopInternal(); }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (masterGain) masterGain.gain.value = muted ? 0 : volume;
        localStorage.setItem('merchantRealms_musicVolume', volume);
    }

    function toggleMute() {
        muted = !muted;
        if (masterGain) masterGain.gain.value = muted ? 0 : volume;
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
