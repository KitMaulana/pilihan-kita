// Perhitungan akurasi Fase 3: distribusi skor genuine vs impostor, FAR/FRR, dan simulasi aturan 1:N.
import { cosine } from './faceEngine';

/** samples: [{ label, embedding }] → { genuine: number[], impostor: number[] } */
export function pairScores(samples) {
    const genuine = [];
    const impostor = [];
    for (let i = 0; i < samples.length; i++) {
        for (let j = i + 1; j < samples.length; j++) {
            const s = cosine(samples[i].embedding, samples[j].embedding);
            (samples[i].label === samples[j].label ? genuine : impostor).push(s);
        }
    }
    return { genuine, impostor };
}

export function rates(genuine, impostor, t) {
    const frr = genuine.length ? genuine.filter((s) => s < t).length / genuine.length : 0;
    const far = impostor.length ? impostor.filter((s) => s >= t).length / impostor.length : 0;
    return { far, frr };
}

/** Peluang salah-cocok terhadap SALAH SATU dari N template (1:N) dari FAR per-pembanding. */
export function farOneToN(far, n) {
    return 1 - Math.pow(1 - far, n);
}

export function histogram(values, min = -0.2, max = 1.0, step = 0.05) {
    const bins = [];
    for (let x = min; x < max - 1e-9; x += step) bins.push({ from: x, to: x + step, count: 0 });
    for (const v of values) {
        const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((v - min) / step)));
        bins[idx].count++;
    }
    return bins;
}

function percentile(arr, p) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/**
 * Simulasi aturan keputusan server (§6.3): galeri = sampel pertama tiap label,
 * probe = sampel sisanya. Mengembalikan statistik untuk (threshold, margin).
 */
export function simulateIdentification(samples, threshold, margin) {
    const gallery = new Map();
    const probes = [];
    for (const s of samples) {
        if (!gallery.has(s.label)) gallery.set(s.label, s);
        else probes.push(s);
    }
    const g = [...gallery.values()];
    let correct = 0, wrong = 0, rejected = 0;
    const margins = [];
    for (const p of probes) {
        let s1 = -1, s2 = -1, best = null;
        for (const t of g) {
            const s = cosine(p.embedding, t.embedding);
            if (s > s1) {
                s2 = s1;
                s1 = s;
                best = t.label;
            } else if (s > s2) s2 = s;
        }
        if (best === p.label) margins.push(s1 - (s2 < 0 ? 0 : s2));
        if (s1 >= threshold && s1 - s2 >= margin) {
            best === p.label ? correct++ : wrong++;
        } else rejected++;
    }
    return { probes: probes.length, gallery: g.length, correct, wrong, rejected, marginP10: percentile(margins, 0.1), marginMedian: percentile(margins, 0.5) };
}

/**
 * Rekomendasi: ambang = maks(skor impostor tertinggi + 0.05, titik FAR 1:N ≤ 1%), dibatasi agar
 * FRR tidak berlebihan; margin = 0.08 atau lebih kecil bila margin genuine P10 rendah.
 */
export function recommend(samples, populationN = 1800) {
    const { genuine, impostor } = pairScores(samples);
    if (genuine.length < 5 || impostor.length < 20) return null;

    const maxImpostor = Math.max(...impostor);
    let threshold = null;
    for (let t = 0.25; t <= 0.9; t += 0.01) {
        const { far } = rates(genuine, impostor, t);
        if (farOneToN(far, populationN) <= 0.01 && t > maxImpostor + 0.05) {
            threshold = Math.round(t * 100) / 100;
            break;
        }
    }
    threshold ??= Math.round(Math.min(0.9, maxImpostor + 0.05) * 100) / 100;

    const sim = simulateIdentification(samples, threshold, 0);
    const margin = sim.marginP10 != null ? Math.round(Math.min(0.1, Math.max(0.04, sim.marginP10 * 0.5)) * 100) / 100 : 0.08;
    const r = rates(genuine, impostor, threshold);

    return {
        threshold,
        margin,
        far: r.far,
        frr: r.frr,
        far1N: farOneToN(r.far, populationN),
        maxImpostor,
        minGenuine: Math.min(...genuine),
        genuineCount: genuine.length,
        impostorCount: impostor.length,
    };
}
