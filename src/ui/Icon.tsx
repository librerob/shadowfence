const paths = {
  image: "M4 4h16v16H4z M4 15l5-5 4 4 3-3 4 4 M15 8h.01",
  text: "M4 5h16M12 5v15M8 20h8",
  identities:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  home: "M3 10l9-7 9 7v11H3z M9 21v-8h6v8",
  settings:
    "M9 3h6l1 4 4 1v8l-4 1-1 4H9l-1-4-4-1V8l4-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  lock: "M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3 M12 15v2",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l4 4L19 6",
  warning: "M12 3L2 21h20z M12 9v5 M12 17h.01",
  info: "M12 8h.01 M12 11v6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  close: "M6 6l12 12M18 6L6 18",
  edit: "M4 16L16 4l4 4L8 20H4z M13 7l4 4",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <img src="icons/icon.svg" alt="" width="32" height="32" />
      <span>ShadowFence</span>
    </span>
  );
}
