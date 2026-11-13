// One outline icon set (1.5px stroke, 16px) and the product mark.

const paths = {
  list: "M4 6h12M4 10h12M4 14h8M2 6h.01M2 10h.01M2 14h.01",
  send: "M17 3 9 11M17 3l-5 14-3-6-6-3 14-5Z",
  star: "m10 2.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1L10 14.2 5.4 16.7l.9-5.1L2.5 8l5.2-.8L10 2.5Z",
  upload: "M10 13V3m0 0L6 7m4-4 4 4M3 13v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3",
  search: "m17 17-3.5-3.5M15 9A6 6 0 1 1 3 9a6 6 0 0 1 12 0Z",
  x: "M5 5l10 10M15 5 5 15",
  arrow: "M4 10h12m0 0-4-4m4 4-4 4",
  copy: "M7 7V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3M4 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
  external: "M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3m-5-8h5m0 0v5m0-5L9 11",
  check: "m4 10.5 4 4 8-9",
  out: "M8 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4m5 4 4 3-4 3m4-3H8",
  trash: "M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10M8.5 9v4.5M11.5 9v4.5",
  clock: "M10 6v4l2.5 1.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
};

export function Icon({ name, size = 16, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Three bars climbing the colour ladder: first contact, follow-up, response. */
export function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="14" width="5.5" height="9" rx="1.5" fill="#f2bcd3" />
      <rect x="10.25" y="8.5" width="5.5" height="14.5" rx="1.5" fill="#d4618f" />
      <rect x="17.5" y="3" width="5.5" height="20" rx="1.5" fill="#b8336a" />
    </svg>
  );
}
