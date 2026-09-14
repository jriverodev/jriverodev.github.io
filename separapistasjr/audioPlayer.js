/**
 * audioPlayer.js
 * Reproductor Multipista Sincronizado para Web Audio API.
 * Gestiona la decodificación y reproducción de 4 stems (Voces, Batería, Bajo, Otros)
 * con precisión de milisegundos, control de ganancia individual, silenciar (mute) y solo.
 */

export class MultiTrackPlayer {
  constructor() {
    this.audioCtx = null;
    this.masterGainNode = null;
    this.tracks = {
      vocals: { label: 'Voces', buffer: null, gainNode: null, volume: 1.0, isMuted: false, isSolo: false },
      drums: { label: 'Batería', buffer: null, gainNode: null, volume: 1.0, isMuted: false, isSolo: false },
      bass: { label: 'Bajo', buffer: null, gainNode: null, volume: 1.0, isMuted: false, isSolo: false },
      other: { label: 'Otros', buffer: null, gainNode: null, volume: 1.0, isMuted: false, isSolo: false }
    };

    this.sources = {};
    this.isPlaying = false;
    this.duration = 0;
    this.offset = 0; // Posición actual en segundos
    this.startTime = 0; // Timestamp en el que comenzó la reproducción actual
    this.masterVolume = 1.0;

    this.animFrameId = null;
    this.onTimeUpdateCallback = null;
    this.onEndCallback = null;
    this.onStateChangeCallback = null;
  }

  /**
   * Inicializa el Contexto de Audio Web Audio API
   */
  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = this.masterVolume;
      this.masterGainNode.connect(this.audioCtx.destination);

      // Crear nodos de ganancia independientes para cada pista
      Object.keys(this.tracks).forEach(key => {
        const trackGain = this.audioCtx.createGain();
        trackGain.gain.value = this.tracks[key].volume;
        trackGain.connect(this.masterGainNode);
        this.tracks[key].gainNode = trackGain;
      });
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Carga los Blobs de audio de las 4 pistas y las decodifica en AudioBuffers
   * @param {Object} stemBlobs - Objeto con { vocals, drums, bass, other } Blobs o ArrayBuffers
   */
  async loadStems(stemBlobs) {
    this.stop();
    this.initContext();

    this.duration = 0;
    this.offset = 0;

    const trackKeys = Object.keys(this.tracks);
    const loadPromises = trackKeys.map(async (key) => {
      const blobOrBuffer = stemBlobs[key];
      if (!blobOrBuffer) {
        this.tracks[key].buffer = null;
        return;
      }

      let arrayBuffer;
      if (blobOrBuffer instanceof ArrayBuffer) {
        arrayBuffer = blobOrBuffer.slice(0);
      } else if (blobOrBuffer instanceof Blob) {
        arrayBuffer = await blobOrBuffer.arrayBuffer();
      } else {
        throw new Error(`Formato no soportado para la pista ${key}`);
      }

      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      this.tracks[key].buffer = audioBuffer;

      if (audioBuffer.duration > this.duration) {
        this.duration = audioBuffer.duration;
      }
    });

    await Promise.all(loadPromises);
    this.updateGains();
    this._notifyTimeUpdate();
    return this.duration;
  }

  /**
   * Inicia la reproducción sincronizada de todas las pistas disponibles
   */
  async play() {
    this.initContext();

    if (this.isPlaying) return;

    // Verificar si se alcanzó el final
    if (this.offset >= this.duration) {
      this.offset = 0;
    }

    this.startTime = this.audioCtx.currentTime - this.offset;
    this.sources = {};

    Object.keys(this.tracks).forEach(key => {
      const track = this.tracks[key];
      if (track.buffer) {
        const source = this.audioCtx.createBufferSource();
        source.buffer = track.buffer;
        source.connect(track.gainNode);
        source.start(0, this.offset);
        this.sources[key] = source;
      }
    });

    this.isPlaying = true;
    this._startProgressLoop();
    if (this.onStateChangeCallback) this.onStateChangeCallback(true);
  }

  /**
   * Pausa la reproducción reteniendo la posición actual
   */
  pause() {
    if (!this.isPlaying) return;

    this._stopSources();
    this.offset = Math.min(this.audioCtx.currentTime - this.startTime, this.duration);
    this.isPlaying = false;
    this._stopProgressLoop();

    this._notifyTimeUpdate();
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  /**
   * Detiene la reproducción y reinicia el tiempo al inicio (0)
   */
  stop() {
    this._stopSources();
    this.isPlaying = false;
    this.offset = 0;
    this._stopProgressLoop();

    this._notifyTimeUpdate();
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  /**
   * Navega a un segundo específico en la línea de tiempo
   * @param {number} targetTime - Tiempo objetivo en segundos
   */
  seek(targetTime) {
    const clampedTime = Math.max(0, Math.min(targetTime, this.duration));
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this._stopSources();
    }

    this.offset = clampedTime;
    this._notifyTimeUpdate();

    if (wasPlaying) {
      this.isPlaying = false;
      this.play();
    }
  }

  /**
   * Define el volumen de una pista específica
   * @param {string} trackKey - 'vocals', 'drums', 'bass', 'other'
   * @param {number} volume - Nivel de 0.0 a 1.0
   */
  setTrackVolume(trackKey, volume) {
    if (this.tracks[trackKey]) {
      this.tracks[trackKey].volume = Math.max(0, Math.min(1, volume));
      this.updateGains();
    }
  }

  /**
   * Alterna el estado Silenciar (Mute) de una pista
   */
  toggleTrackMute(trackKey) {
    if (this.tracks[trackKey]) {
      this.tracks[trackKey].isMuted = !this.tracks[trackKey].isMuted;
      this.updateGains();
      return this.tracks[trackKey].isMuted;
    }
    return false;
  }

  /**
   * Alterna el estado Solo de una pista
   */
  toggleTrackSolo(trackKey) {
    if (this.tracks[trackKey]) {
      this.tracks[trackKey].isSolo = !this.tracks[trackKey].isSolo;
      this.updateGains();
      return this.tracks[trackKey].isSolo;
    }
    return false;
  }

  /**
   * Ajusta el volumen maestro general
   * @param {number} volume - Nivel de 0.0 a 1.0
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.audioCtx.currentTime, 0.02);
    }
  }

  /**
   * Recalcula la ganancia de cada pista evaluando Mute y Solo
   */
  updateGains() {
    if (!this.audioCtx) return;

    const anySolo = Object.values(this.tracks).some(t => t.isSolo);

    Object.keys(this.tracks).forEach(key => {
      const track = this.tracks[key];
      if (!track.gainNode) return;

      let targetGain = 0;
      if (anySolo) {
        targetGain = (track.isSolo && !track.isMuted) ? track.volume : 0;
      } else {
        targetGain = track.isMuted ? 0 : track.volume;
      }

      track.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.02);
    });
  }

  /**
   * Detiene todas las fuentes activas
   * @private
   */
  _stopSources() {
    Object.keys(this.sources).forEach(key => {
      try {
        this.sources[key].stop();
        this.sources[key].disconnect();
      } catch (e) {
        // Ignorar errores si la fuente ya había finalizado
      }
    });
    this.sources = {};
  }

  /**
   * Bucle de animación para actualizar la posición en tiempo real
   * @private
   */
  _startProgressLoop() {
    this._stopProgressLoop();

    const loop = () => {
      if (this.isPlaying && this.audioCtx) {
        this.offset = this.audioCtx.currentTime - this.startTime;

        if (this.offset >= this.duration) {
          this.offset = this.duration;
          this.stop();
          if (this.onEndCallback) this.onEndCallback();
          return;
        }

        this._notifyTimeUpdate();
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * @private
   */
  _stopProgressLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * @private
   */
  _notifyTimeUpdate() {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.getCurrentTime(), this.duration);
    }
  }

  getCurrentTime() {
    if (this.isPlaying && this.audioCtx) {
      return Math.min(this.audioCtx.currentTime - this.startTime, this.duration);
    }
    return this.offset;
  }

  /**
   * Registra los callbacks para la UI
   */
  setOnTimeUpdate(fn) { this.onTimeUpdateCallback = fn; }
  setOnEnd(fn) { this.onEndCallback = fn; }
  setOnStateChange(fn) { this.onStateChangeCallback = fn; }

  /**
   * Libera los recursos del contexto de audio
   */
  destroy() {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
