/**
 * Logo resmi CiptaKita.id (`/ciptakita-logo.png`).
 * Berkas sumber berukuran 1024×682 dengan ruang transparan di sekelilingnya;
 * komponen ini memangkas ruang kosong secara presisi agar tampil tajam dan proporsional.
 */
const FULL_CROP = {
    aspectRatio: '860 / 312',
    imgStyle: {
        width: '119.07%',
        height: '218.59%',
        left: '-10.70%',
        top: '-55.77%',
        maxWidth: 'none',
    },
};

const MARK_CROP = {
    aspectRatio: '274 / 308',
    imgStyle: {
        width: '373.72%',
        height: '221.43%',
        left: '-33.58%',
        top: '-57.14%',
        maxWidth: 'none',
    },
};

const HEIGHT_CLASS = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
    xl: 'h-16',
};

const SURFACE_CLASS = {
    none: '',
    light: '',
    pill: 'inline-flex items-center rounded-xl bg-white/95 px-2.5 py-1 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm',
    card: 'inline-flex items-center rounded-2xl bg-white px-3.5 py-2 shadow-md ring-1 ring-slate-900/5',
};

export function BrandLogo({ variant = 'full', size = 'sm', surface = 'none', className = '', alt = 'CiptaKita.id' }) {
    const crop = variant === 'mark' ? MARK_CROP : FULL_CROP;
    const h = HEIGHT_CLASS[size] || HEIGHT_CLASS.sm;
    const box = (
        <span className={`relative inline-block shrink-0 overflow-hidden select-none ${h}`} style={{ aspectRatio: crop.aspectRatio }}>
            <img
                src="/ciptakita-logo.png"
                alt={alt}
                draggable={false}
                className="pointer-events-none absolute block select-none"
                style={crop.imgStyle}
            />
        </span>
    );

    if (surface === 'none' || surface === 'light') {
        return <span className={`inline-flex items-center ${className}`}>{box}</span>;
    }

    return <span className={`${SURFACE_CLASS[surface] || ''} ${className}`}>{box}</span>;
}

/**
 * Lockup identitas gabungan: Logo CiptaKita.id + nama aplikasi Pilihan Kita.
 */
export function BrandLockup({ dark = false, size = 'sm', subtitle = 'OSIS SMAN 1 Ciruas', className = '' }) {
    return (
        <span className={`inline-flex min-w-0 items-center gap-2 sm:gap-3 ${className}`}>
            <BrandLogo variant="full" size={size} surface={dark ? 'pill' : 'none'} />
            <span className={`h-5 w-px shrink-0 sm:h-6 ${dark ? 'bg-white/25' : 'bg-slate-300'}`} aria-hidden="true" />
            <span className="min-w-0 leading-tight">
                <span className={`block truncate text-xs font-extrabold tracking-tight sm:text-sm ${dark ? 'text-white' : 'text-brand-900'}`}>Pilihan Kita</span>
                {subtitle && <span className={`block truncate text-[10px] font-medium sm:text-[11px] ${dark ? 'text-brand-200' : 'text-slate-500'}`}>{subtitle}</span>}
            </span>
        </span>
    );
}
