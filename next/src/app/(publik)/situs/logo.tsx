/** Wordmark Geofencing (resources/views/components/situs/logo.blade.php). */
export function Logo({ className = "" }: { className?: string }) {
    return (
        <span className={`s:inline-flex s:shrink-0 s:items-center s:gap-2.5 s:whitespace-nowrap ${className}`}>
            <svg className="s:size-8 s:shrink-0" viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false">
                <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 3H3v8M25 3h8v8M33 25v8h-8M11 33H3v-8" />
                    <path d="M26 15c0 6-8 13-8 13s-8-7-8-13a8 8 0 1 1 16 0Z" />
                    <circle cx="18" cy="15" r="2.75" />
                </g>
            </svg>
            <span className="s:text-[1.375rem] s:leading-none s:font-semibold s:tracking-[-0.045em] s:sm:text-[1.5rem]">
                Geofencing
            </span>
        </span>
    );
}
