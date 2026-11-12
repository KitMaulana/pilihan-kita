/**
 * Penerimaan berkas gambar di sisi peramban.
 *
 * Diterima: JPG/JPEG, PNG, WebP, GIF, BMP, AVIF, ICO, dan HEIC/HEIF (foto iPhone/Android baru) — apa pun yang
 * dapat didekode peramban, ditambah HEIC lewat pustaka `heic-to` yang dimuat MALAS (hanya saat ada berkas HEIC,
 * sehingga tidak membebani halaman kiosk/publik). Varian `heic-to/csp` dipakai karena CSP produksi melarang eval.
 *
 * Semua pengolahan terjadi di peramban; berkas tidak dikirim ke mana pun hanya untuk dikonversi.
 */

export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.hif,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.avif';
export const IMAGE_NAME = /\.(jpe?g|jfif|png|webp|gif|bmp|ico|avif|heic|heif|hif)$/i;
export const IMAGE_LABEL = 'JPG, PNG, WebP, HEIC, dan format gambar lain';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

export class ImageFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ImageFormatError';
    }
}

/** HEIC/HEIF dikenali dari kepala berkas (kotak "ftyp"), bukan hanya ekstensi — tipe MIME sering kosong di Windows. */
export async function isHeicFile(file) {
    if (/\.(heic|heif|hif)$/i.test(file.name) || /heic|heif/i.test(file.type)) return true;
    try {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        if (head.length < 12) return false;
        const box = String.fromCharCode(...head.slice(4, 8));
        const brand = String.fromCharCode(...head.slice(8, 12)).toLowerCase();

        return box === 'ftyp' && HEIC_BRANDS.has(brand);
    } catch {
        return false;
    }
}

/** Apakah berkas ini gambar yang bisa kita proses? (ekstensi, tipe MIME, atau isi HEIC). */
export async function isImageFile(file) {
    return IMAGE_NAME.test(file.name) || (file.type || '').startsWith('image/') || (await isHeicFile(file));
}

async function bitmapFromBlob(blob) {
    if ('createImageBitmap' in window) {
        try {
            return await createImageBitmap(blob, { imageOrientation: 'from-image' });
        } catch {
            /* lanjut ke elemen <img> */
        }
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();

        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Mendekode berkas gambar apa pun menjadi ImageBitmap (orientasi EXIF sudah diterapkan).
 * @throws {ImageFormatError} bila format tidak dikenali / berkas rusak
 */
export async function decodeImage(file) {
    try {
        if (await isHeicFile(file)) {
            const { heicTo } = await import('heic-to/csp'); // dimuat malas: ±3 MB, hanya bila ada HEIC
            try {
                return await heicTo({ blob: file, type: 'bitmap' });
            } catch {
                // Beberapa peramban gagal membuat bitmap langsung; ubah ke JPEG dulu.
                const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });

                return await bitmapFromBlob(jpeg);
            }
        }

        return await bitmapFromBlob(file);
    } catch (e) {
        if (e instanceof ImageFormatError) throw e;
        const heic = await isHeicFile(file).catch(() => false);
        throw new ImageFormatError(
            heic
                ? 'Foto HEIC tidak dapat dibaca (berkas rusak atau memakai pengodean yang belum didukung). Coba ekspor ulang sebagai JPG.'
                : `Berkas "${file.name}" bukan gambar yang dapat dibaca. Gunakan JPG, PNG, WebP, atau HEIC.`,
        );
    }
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal menyandikan gambar.'))), type, quality));
}

/**
 * Menyiapkan gambar untuk DIUNGGAH ke server (mis. foto kandidat; server menerima JPG/PNG/WebP ≤ batas ukuran).
 *  - JPG/PNG/WebP yang sudah ≤ maxBytes → dikirim apa adanya (tanpa kehilangan kualitas).
 *  - HEIC, format lain, atau foto terlalu besar → dikonversi ke JPEG dan dikecilkan (sisi terpanjang ≤ maxSide).
 * @returns {Promise<{file: File, converted: boolean, from: string}>}
 */
export async function prepareUpload(file, { maxBytes = 2 * 1024 * 1024, maxSide = 1600 } = {}) {
    const heic = await isHeicFile(file);
    const nativeOk = !heic && /^image\/(jpeg|png|webp)$/.test(file.type);
    if (nativeOk && file.size <= maxBytes) return { file, converted: false, from: file.type };

    const bitmap = await decodeImage(file);
    try {
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // PNG/WebP transparan → latar putih (JPEG tidak mengenal transparansi)
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);

        let blob = null;
        for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
            blob = await canvasToBlob(canvas, 'image/jpeg', q);
            if (blob.size <= maxBytes) break;
        }
        if (blob.size > maxBytes) throw new ImageFormatError(`Foto masih terlalu besar setelah dikecilkan (${(blob.size / 1048576).toFixed(1)} MB). Gunakan foto yang lebih kecil.`);

        const name = `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`;

        return { file: new File([blob], name, { type: 'image/jpeg' }), converted: true, from: heic ? 'HEIC' : file.type || 'gambar' };
    } finally {
        bitmap.close?.();
    }
}
