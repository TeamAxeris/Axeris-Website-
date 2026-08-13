export function AxerisLogo({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradientId = `axeris-mark-${size}`;
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Axeris"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, flex: "0 0 auto" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7878ff" />
          <stop offset="0.52" stopColor="#3535e8" />
          <stop offset="1" stopColor="#17178f" />
        </linearGradient>
      </defs>
      <path d="M8 49 27 12c1.8-3.5 6.8-3.7 8.9-.3L55 49H43.5L31.7 25.6 19.8 49H8Z" fill={`url(#${gradientId})`} />
      <path d="m18.7 53 28.9-30.3H60L31.1 53H18.7Z" fill="#17140d" />
      <path d="m34.1 35.2 7.7-8.1 6.2 6.5-7.7 8.1-6.2-6.5Z" fill="#4fc3e8" />
    </svg>
  );
}
