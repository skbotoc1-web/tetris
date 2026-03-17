// MIT License - Copyright (c) 2026 Stefan Kaiser
// https://github.com/skbotoc1-web/tetris
/**
 * tetris-sound.js
 * 
 * Ein vollständig synthetisches Audio-System für Tetris via Web Audio API.
 * Kein externe Audio-Dateien erforderlich.
 * 
 * Features:
 * - Wavetable-Synthese (Oszillatoren)
 * - ADSR-ähnliche Envelopes für perkussive Sounds
 * - Hintergrundmusik: Korobeiniki (Tetris Theme)
 * - Polyphone Synthese (mehrere Sounds gleichzeitig möglich)
 */

class TetrisSoundEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.isPlayingMusic = false;
        this.musicTimeoutId = null;
        this.isMuted = false;
        
        // Master Volume (0.0 - 1.0)
        this.volume = 0.3; 
        
        // Konfiguration für Synthese
        this.config = {
            baseTempo: 65, // ms pro Achtelnote im Tetris-Theme
            sfxVolume: 0.5
        };

        // Melodie: Korobeiniki (Tetris Theme A-Theme)
        // Format: { freq: FrequenzHz, type: Oszillator-Typ, duration: ms }
        // Tonarten: E5, B4, C5, D5...
        this.tetrisTheme = [
            // Intro
            { freq: 659.25, type: 'square', duration: 200 }, // E5
            { freq: 493.88, type: 'square', duration: 100 }, // B4
            { freq: 523.25, type: 'square', duration: 100 }, // C5
            { freq: 587.33, type: 'square', duration: 100 }, // D5
            { freq: 523.25, type: 'square', duration: 100 }, // C5
            { freq: 493.88, type: 'square', duration: 100 }, // B4
            
            // Thema Teil 1
            { freq: 440.00, type: 'square', duration: 150 }, // A4
            { freq: 440.00, type: 'square', duration: 50 },  // A4 (korte Pause/Anschlageffekt)
            
            { freq: 523.25, type: 'square', duration: 150 }, // C5
            { freq: 659.25, type: 'square', duration: 100 }, // E5
            { freq: 587.33, type: 'square', duration: 100 }, // D5
            { freq: 523.25, type: 'square', duration: 100 }, // C5
            { freq: 493.88, type: 'square', duration: 150 }, // B4
            
            // Thema Teil 2
            { freq: 440.00, type: 'square', duration: 150 }, // A4
            { freq: 493.88, type: 'square', duration: 100 }, // B4
            { freq: 523.25, type: 'square', duration: 100 }, // C5
            { freq: 587.33, type: 'square', duration: 100 }, // D5
            { freq: 659.25, type: 'square', duration: 400 }, // E5 (Ende Phrase)
            
            // Wiederholung Logic wird im playMusic-Loop gehandhabt
        ];
    }

    /**
     * Initialisiert den AudioContext.
     * Muss nach einer User-Gesture (Klick/Touch) aufgerufen werden.
     */
    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.audioCtx.destination);
            
            console.log("Tetris Sound Engine: AudioContext initiiert.");
        } else if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
            console.log("Tetris Sound Engine: AudioContext wiederaufgenommen.");
        }
    }

    /**
     * Erstellt einen einzelnen Ton (Note) mit ADSR-Envelope.
     */
    playNote(freq, duration, type = 'sine', startTime = null) {
        if (!this.audioCtx || this.isMuted) return;

        const osc = this.audioCtx.createOscillator();
        const noteGain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        // ADSR Envelope (Simuliert)
        const now = startTime || this.audioCtx.currentTime;
        const attack = 0.01;
        const release = 0.05;

        // Volume Start bei 0
        noteGain.gain.setValueAtTime(0, now);
        // Attack auf max volume
        noteGain.gain.linearRampToValueAtTime(1, now + attack);
        // Release auf 0 am Ende der Dauer
        noteGain.gain.setValueAtTime(1, now + duration - release);
        noteGain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(noteGain);
        noteGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Spielt Soundeffekte (SFX) ab.
     * @param {string} type - 'move', 'rotate', 'land', 'clear', 'gameover'
     */
    playSfx(type) {
        if (!this.audioCtx || this.isMuted) return;

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Basis Volume für SFX
        const sfxVol = 0.3;

        switch (type) {
            case 'move':
                // Kurzer "Bip"
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(200, now + 0.1);
                
                gainNode.gain.setValueAtTime(sfxVol, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'rotate':
                // "Pling" (höherer Ton)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(800, now + 0.05);
                
                gainNode.gain.setValueAtTime(sfxVol, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'land':
                // Dumpfer "Thud"
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                
                gainNode.gain.setValueAtTime(sfxVol, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'clear':
                // Harmonischer Akkord für Linienlöscher (C-E-G)
                const clearFreqs = [523.25, 659.25, 783.99]; // C5, E5, G5
                clearFreqs.forEach((f, i) => {
                    const tOsc = this.audioCtx.createOscillator();
                    const tGain = this.audioCtx.createGain();
                    tOsc.type = 'square';
                    tOsc.frequency.value = f;
                    tOsc.connect(tGain);
                    tGain.connect(this.masterGain);
                    
                    tGain.gain.setValueAtTime(sfxVol, now);
                    tGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    
                    tOsc.start(now);
                    tOsc.stop(now + 0.4);
                });
                break;
                
            case 'gameover':
                // Fallender Ton (Sireneneffekt)
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 1.5);
                
                gainNode.gain.setValueAtTime(sfxVol, now);
                gainNode.gain.linearRampToValueAtTime(0, now + 1.5);
                
                osc.start(now);
                osc.stop(now + 1.5);
                break;
                
            default:
                break;
        }
    }

    /**
     * Startet die Hintergrundmusik (Tetris Theme Loop).
     */
    playMusic() {
        if (this.isPlayingMusic || !this.audioCtx || this.isMuted) return;
        this.isPlayingMusic = true;
        this._playNextNote(0);
    }

    /**
     * Rekursive Methode zum Abspiele der Noten.
     * @param {number} noteIndex - Index der aktuellen Note im Array
     */
    _playNextNote(index) {
        if (!this.isPlayingMusic || !this.audioCtx) return;

        const note = this.tetrisTheme[index % this.tetrisTheme.length];
        
        // Note abspielen
        this.playNote(note.freq, (note.duration / 1000), note.type);

        // Nächste Note planen
        const nextDelay = note.duration / 1000; // Sekunden zu Millisekunden
        
        this.musicTimeoutId = setTimeout(() => {
            this._playNextNote(index + 1);
        }, nextDelay * 1000);
    }

    /**
     * Stoppt die Musik.
     */
    stopMusic() {
        this.isPlayingMusic = false;
        if (this.musicTimeoutId) {
            clearTimeout(this.musicTimeoutId);
            this.musicTimeoutId = null;
        }
    }

    /**
     * Mute umschalten.
     */
    toggleMute() {
        if (!this.audioCtx) return;
        
        this.isMuted = !this.isMuted;
        
        if (this.masterGain) {
            // Weiche Drosselung für UX
            const now = this.audioCtx.currentTime;
            if (this.isMuted) {
                this.masterGain.gain.setValueAtTime(this.volume, now);
                this.masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
            } else {
                this.masterGain.gain.setValueAtTime(0, now);
                this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.1);
            }
        }
        
        // Musik bei Mute automatisch stoppen, um Stille zu vermeiden? 
        // Oder Musik weiterlaufen lassen, aber leise. Hier: weiterlaufen lassen.
        return this.isMuted;
    }

    /**
     * Volume setzen (0.0 - 1.0).
     */
    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            // Falls gemutet, wird das Volumen gespeichert, aber Gain ist 0.
            // Wenn nicht gemutet, setze Gain direkt.
            if (!this.isMuted) {
                this.masterGain.gain.setValueAtTime(this.volume, now);
            }
        }
    }
}

// Export für Module oder globaler Zugriff
window.TetrisSound = new TetrisSoundEngine();