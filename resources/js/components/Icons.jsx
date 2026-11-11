/** Koleksi ikon SVG geometris ringan (tanpa ketergantungan eksternal). */

function Icon({ children, className = 'size-5', ...props }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true" {...props}>
            {children}
        </svg>
    );
}

export function IconShieldCheck(props) {
    return (
        <Icon {...props}>
            <path d="M12 3l7 3v5c0 4.97-3.05 9.18-7 10-3.95-.82-7-5.03-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
        </Icon>
    );
}

export function IconFaceScan(props) {
    return (
        <Icon {...props}>
            <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M4 16v2a2 2 0 0 0 2 2h2M16 20h2a2 2 0 0 0 2-2v-2" />
            <path d="M9 10v.5M15 10v.5M9.5 15a3.5 3.5 0 0 0 5 0" />
        </Icon>
    );
}

export function IconVoteBox(props) {
    return (
        <Icon {...props}>
            <path d="M9 5h6l2 4H7l2-4z" />
            <path d="M9 9l2 2 4-4" />
            <rect x="4" y="9" width="16" height="11" rx="2.5" />
            <path d="M8 14h8" />
        </Icon>
    );
}

export function IconTicket(props) {
    return (
        <Icon {...props}>
            <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
            <path d="M10 9h4M10 15h4M10 12h4" />
        </Icon>
    );
}

export function IconChartBar(props) {
    return (
        <Icon {...props}>
            <path d="M4 20h16" />
            <rect x="6" y="11" width="3" height="6" rx="1" />
            <rect x="10.5" y="6" width="3" height="11" rx="1" />
            <rect x="15" y="9" width="3" height="8" rx="1" />
        </Icon>
    );
}

export function IconUsers(props) {
    return (
        <Icon {...props}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
            <circle cx="16.5" cy="9" r="2.2" />
            <path d="M16.5 13.5a4 4 0 0 1 4 4" />
        </Icon>
    );
}

export function IconCamera(props) {
    return (
        <Icon {...props}>
            <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
            <circle cx="12" cy="12.5" r="3.5" />
        </Icon>
    );
}

export function IconDeviceTablet(props) {
    return (
        <Icon {...props}>
            <rect x="5" y="3" width="14" height="18" rx="2.5" />
            <path d="M11 18h2" />
        </Icon>
    );
}

export function IconCalendarClock(props) {
    return (
        <Icon {...props}>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9.5h17" />
            <circle cx="12" cy="14.5" r="2.5" />
        </Icon>
    );
}

export function IconActivity(props) {
    return (
        <Icon {...props}>
            <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
        </Icon>
    );
}

export function IconUserCheck(props) {
    return (
        <Icon {...props}>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19a6 6 0 0 1 12 0" />
            <path d="M16 11l2 2 3.5-3.5" />
        </Icon>
    );
}

export function IconLock(props) {
    return (
        <Icon {...props}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </Icon>
    );
}

export function IconKey(props) {
    return (
        <Icon {...props}>
            <circle cx="8" cy="14" r="3.5" />
            <path d="M11 11.5L19 4m-2.5 2.5L19 9m-4-1l2 2" />
        </Icon>
    );
}

export function IconLogOut(props) {
    return (
        <Icon {...props}>
            <path d="M10 17l5-5-5-5M15 12H4" />
            <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        </Icon>
    );
}

export function IconMenu(props) {
    return (
        <Icon {...props}>
            <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
    );
}

export function IconClose(props) {
    return (
        <Icon {...props}>
            <path d="M6 6l12 12M18 6L6 18" />
        </Icon>
    );
}

export function IconCheckCircle(props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </Icon>
    );
}

export function IconAlertTriangle(props) {
    return (
        <Icon {...props}>
            <path d="M10.3 4.3L2.6 17.5A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.5L13.7 4.3a1.9 1.9 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 16.5h.01" />
        </Icon>
    );
}

export function IconInfoCircle(props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
        </Icon>
    );
}

export function IconFullscreen(props) {
    return (
        <Icon {...props}>
            <path d="M4 9V5h4M16 5h4v4M4 15v4h4M16 19h4v-4" />
        </Icon>
    );
}

export function IconArrowRight(props) {
    return (
        <Icon {...props}>
            <path d="M5 12h14M13 6l6 6-6 6" />
        </Icon>
    );
}

export function IconExternal(props) {
    return (
        <Icon {...props}>
            <path d="M14 4h6v6M10 14L20 4M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
        </Icon>
    );
}

export function IconEye({ off = false, ...props }) {
    return off ? (
        <Icon {...props}>
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.4 16.4 0 0 1-3.3 4.3M6.6 6.6C4.1 8.3 2.5 12 2.5 12s3.5 7 9.5 7c1.6 0 3-.4 4.2-1" />
        </Icon>
    ) : (
        <Icon {...props}>
            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
            <circle cx="12" cy="12" r="2.8" />
        </Icon>
    );
}

export function IconUpload(props) {
    return (
        <Icon {...props}>
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 4v11M7.5 8.5L12 4l4.5 4.5" />
        </Icon>
    );
}

export function IconCopy(props) {
    return (
        <Icon {...props}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </Icon>
    );
}

export function IconPrinter(props) {
    return (
        <Icon {...props}>
            <path d="M7 9V4h10v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="7" y="14" width="10" height="6" rx="1" />
        </Icon>
    );
}

export function IconSparkles(props) {
    return (
        <Icon {...props}>
            <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
        </Icon>
    );
}

export function IconDashboard(props) {
    return (
        <Icon {...props}>
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="5" rx="2" />
            <rect x="13" y="10" width="8" height="11" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
        </Icon>
    );
}

export function IconAward(props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="9" r="5" />
            <path d="M9.5 13.5L8 21l4-2 4 2-1.5-7.5" />
        </Icon>
    );
}

export function IconRefresh(props) {
    return (
        <Icon {...props}>
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M19.5 11A8 8 0 0 0 6.2 6.8L4 9m16 6l-2.2 2.2A8 8 0 0 1 4.5 13" />
        </Icon>
    );
}

export function IconSchool(props) {
    return (
        <Icon {...props}>
            <path d="M3 21h18" />
            <path d="M5 21V10l7-5 7 5v11" />
            <path d="M10 21v-5h4v5" />
            <path d="M12 9.5v.01" />
        </Icon>
    );
}

export function IconChevronDown(props) {
    return (
        <Icon {...props}>
            <path d="M6 9l6 6 6-6" />
        </Icon>
    );
}

export function IconPlus(props) {
    return (
        <Icon {...props}>
            <path d="M12 5v14M5 12h14" />
        </Icon>
    );
}
