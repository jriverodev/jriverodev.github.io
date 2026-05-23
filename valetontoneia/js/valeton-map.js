/**
 * @fileoverview valeton-map.js
 * @description Base de conocimiento y motor de inferencia heurística DSP para mapear 
 * firmas espectrales y dinámicas a bloques de la cadena de señal de la Valeton GP-200.
 */

// ============================================================================
// 1. DICCIONARIO DE DATOS Y MAPEO DE HARDWARE (VALETON GP-200 MANUAL SPEC)
// ============================================================================

export const VALETON_CATALOG = {
    PRE: [
        { id: "T_SCREAM", name: "Green Drive", type: "Overdrive", gainRange: { min: 0, max: 40 }, midFocus: 720 },
        { id: "DIST_B", name: "Black RAT", type: "Distortion", gainRange: { min: 35, max: 75 }, midFocus: 1000 },
        { id: "FUZZ_M", name: "Fuzz Muff", type: "Fuzz", gainRange: { min: 60, max: 100 }, midFocus: 400 }
    ],
    AMP: [
        { 
            id: "JC_120", 
            name: "Jazz Twin", 
            category: "Clean", 
            headroom: 0.9, 
            thdThreshold: 0.1,
            optimalCab: "120_CAB",
            eqDefaults: { BASS: 50, MIDDLE: 50, TREBLE: 50, PRESENCE: 40 }
        },
        { 
            id: "PLEXI_50", 
            name: "British Plexi", 
            category: "Crunch", 
            headroom: 0.5, 
            thdThreshold: 0.4,
            optimalCab: "UK_412",
            eqDefaults: { BASS: 45, MIDDLE: 65, TREBLE: 55, PRESENCE: 50 }
        },
        { 
            id: "RECTO_H", 
            name: "Dual Recto", 
            category: "High-Gain", 
            headroom: 0.1, 
            thdThreshold: 0.85,
            optimalCab: "RECTO_412",
            eqDefaults: { BASS: 65, MIDDLE: 40, TREBLE: 60, PRESENCE: 65 }
        }
    ],
    CAB: [
        { id: "120_CAB", name: "Jazz Twin 2x12", lowResonance: 80, highCutoff: 6000 },
        { id: "UK_412", name: "Greenback 4x12", lowResonance: 110, highCutoff: 5500 },
        { id: "RECTO_412", name: "V30 Recto 4x12", lowResonance: 95, highCutoff: 5000 }
    ],
    EQ: {
        PARAMETRIC: {
            LOW: { freq: 100, q: 0.7 },
            LOW_MID: { freq: 400, q: 1.0 },
            HIGH_MID: { freq: 1600, q: 1.0 },
            HIGH: { freq: 4000, q: 0.7 }
        }
    }
};

// ============================================================================
// 2. MOTOR DE INFERENCIA MATEMÁTICA Y DSP HÍBRIDO
// ============================================================================

export class ToneMapperEngine {
    /**
     * @param {number} sampleRate - Frecuencia de muestreo del audio analizado (ej. 44100).
     */
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
    }

    /**
     * Mapea los bins de la FFT a bandas de audio musical estándar de guitarra.
     * @param {Uint8Array} fftData - Datos de magnitud espectral nativos de Web Audio API.
     * @returns {Object} Energía normalizada por banda (0.0 - 1.0)
     */
    _extractBands(fftData) {
        const binCount = fftData.length;
        const nyquist = this.sampleRate / 2;
        const binHz = nyquist / binCount;

        let bands = { low: 0, midLow: 0, midHigh: 0, high: 0, presence: 0 };
        let counts = { low: 0, midLow: 0, midHigh: 0, high: 0, presence: 0 };

        for (let i = 0; i < binCount; i++) {
            const freq = i * binHz;
            const magnitude = fftData[i] / 255.0; // Normalización a rango lineal [0,1]

            if (freq >= 80 && freq < 250) { bands.low += magnitude; counts.low++; }
            else if (freq >= 250 && freq < 1200) { bands.midLow += magnitude; counts.midLow++; }
            else if (freq >= 1200 && freq < 3000) { bands.midHigh += magnitude; counts.midHigh++; }
            else if (freq >= 3000 && freq < 6000) { bands.high += magnitude; counts.high++; }
            else if (freq >= 6000 && freq <= 10000) { bands.presence += magnitude; counts.presence++; }
        }

        // Promediado y soft-limiting para evitar clipping matemático en el cálculo
        return {
            low: counts.low ? bands.low / counts.low : 0,
            midLow: counts.midLow ? bands.midLow / counts.midLow : 0,
            midHigh: counts.midHigh ? bands.midHigh / counts.midHigh : 0,
            high: counts.high ? bands.high / counts.high : 0,
            presence: counts.presence ? bands.presence / counts.presence : 0
        };
    }

    /**
     * Estima la distorsión armónica total aparente (Crest Factor invertido como proxy de THD)
     * @param {Object} dynamics - Datos de la envolvente analizados en el frontend.
     * @param {number} dynamics.crestFactor - Relación pico-promedio (dB). Un valor bajo implica alta compresión/saturación.
     * @returns {number} Factor de ganancia estimado [0.0 - 1.0]
     */
    _estimateGainRequirement(crestFactor) {
        // En guitarras, un Crest Factor < 6dB denota saturación extrema (onda cuadrada implícita)
        // Un Crest Factor > 15dB denota una señal limpia y altamente dinámica.
        const maxCrest = 15;
        const minCrest = 5;
        const boundedCrest = Math.max(minCrest, Math.min(maxCrest, crestFactor));
        
        // Inversión lineal: menor Crest Factor = mayor ganancia requerida
        return 1.0 - ((boundedCrest - minCrest) / (maxCrest - minCrest));
    }

    /**
     * Ejecuta la heurística de emparejamiento para generar la cadena de bloques óptima.
     * @param {Uint8Array} fftData - Array espectral de la Web Audio API.
     * @param {Object} dynamics - Métricas analíticas de la envolvente de amplitud.
     * @param {number} dynamics.crestFactor - Factor de cresta calculado del stream de audio.
     * @returns {Object} JSON estructurado con el estado de la cadena de señal de la GP-200.
     */
    inferTargetPreset(fftData, dynamics) {
        try {
            if (!fftData || fftData.length === 0) throw new Error("Dataset FFT inválido o vacío.");
            
            const spectralBands = this._extractBands(fftData);
            const targetGain = this._estimateGainRequirement(dynamics.crestFactor);

            // 1. Selección del bloque AMP basado en el Target Gain (Saturación/THD)
            let selectedAmp = VALETON_CATALOG.AMP[0]; // Default Clean
            for (const amp of VALETON_CATALOG.AMP) {
                if (targetGain >= (1.0 - amp.headroom)) {
                    selectedAmp = amp;
                }
            }

            // 2. Selección y cálculo del bloque PRE (Overdrive/Distorsión de empuje)
            let preBlock = { enabled: false, id: "NONE", name: "Bypass", settings: { Gain: 0, Tone: 50, Volume: 50 } };
            if (targetGain > 0.4) {
                const optimalPre = VALETON_CATALOG.PRE.find(p => targetGain * 100 <= p.gainRange.max) || VALETON_CATALOG.PRE[1];
                const calculatedDrive = Math.round(((targetGain - 0.4) / 0.6) * 100);
                
                preBlock = {
                    enabled: true,
                    id: optimalPre.id,
                    name: optimalPre.name,
                    settings: {
                        Gain: Math.max(10, Math.min(99, calculatedDrive)),
                        Tone: Math.round(spectralBands.midHigh * 100),
                        Volume: 60
                    }
                };
            }

            // 3. Mapeo adaptativo del bloque de Ecualización (EQ Nativo del Amplificador)
            // Se calcula aplicando la desviación espectral sobre los valores por defecto del modelo clonado.
            const totalEnergy = spectralBands.low + spectralBands.midLow + spectralBands.midHigh + spectralBands.high;
            const meanEnergy = totalEnergy / 4;

            const calculateParam = (bandEnergy, defaultVal) => {
                const variance = bandEnergy - meanEnergy;
                // Escalado de desviación: añade o sustrae hasta 30 unidades paramétricas en la escala Valeton (0-100)
                return Math.max(0, Math.min(100, Math.round(defaultVal + (variance * 40))));
            };

            const ampSettings = {
                Gain: Math.round(targetGain * 100),
                Bass: calculateParam(spectralBands.low, selectedAmp.eqDefaults.BASS),
                Middle: calculateParam((spectralBands.midLow + spectralBands.midHigh) / 2, selectedAmp.eqDefaults.MIDDLE),
                Treble: calculateParam(spectralBands.high, selectedAmp.eqDefaults.TREBLE),
                Presence: calculateParam(spectralBands.presence, selectedAmp.eqDefaults.PRESENCE),
                Volume: 70
            };

            // 4. Selección automática del gabinete acoplado (CAB)
            const selectedCab = VALETON_CATALOG.CAB.find(c => c.id === selectedAmp.optimalCab);

            // 5. Configuración del bloque EQ Paramétrico Dedicado (Atenuación/Refuerzo Quirúrgico)
            // Se asume corrector si la varianza espectral local es muy abrupta
            const parametricEqBlock = {
                enabled: Math.abs(spectralBands.midLow - spectralBands.midHigh) > 0.2,
                id: "PARAMETRIC_EQ",
                settings: {
                    Low_Gain: Math.round((spectralBands.low - meanEnergy) * 24),        // Escalado a dB relativos (-12 a +12) representado de 0-100
                    Mid_Freq: VALETON_CATALOG.EQ.PARAMETRIC.LOW_MID.freq,
                    Mid_Gain: Math.round((spectralBands.midLow - meanEnergy) * 24),
                    High_Gain: Math.round((spectralBands.high - meanEnergy) * 24)
                }
            };

            // COMPOSICIÓN DEL REPORTE DE SALIDA JSON (ESTADO DE LA CADENA DE SEÑAL)
            return {
                timestamp: Date.now(),
                meta: {
                    estimatedGainProfile: targetGain.toFixed(4),
                    targetCategory: selectedAmp.category
                },
                signalChain: {
                    NR: { enabled: targetGain > 0.6, id: "SMART_GATE", settings: { Thresh: Math.round(targetGain * 60), Attack: 2 } },
                    PRE: preBlock,
                    AMP: {
                        enabled: true,
                        id: selectedAmp.id,
                        name: selectedAmp.name,
                        settings: ampSettings
                    },
                    CAB: {
                        enabled: true,
                        id: selectedCab.id,
                        name: selectedCab.name,
                        settings: { Mic_Position: 35, Mic_Distance: 20, Volume: 80 }
                    },
                    EQ: parametricEqBlock
                }
            };

        } catch (error) {
            return {
                error: true,
                message: `Fail execution on ToneMapperEngine: ${error.message}`
            };
        }
    }
          }
  
