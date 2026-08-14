export function AxerisLogo({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logos/axeris-logo.png"
      aria-label="Axeris"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, flex: "0 0 auto", objectFit: "contain" }}
    />
  );
}
