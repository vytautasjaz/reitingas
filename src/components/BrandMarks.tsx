/** TRItonas logo marks: dash · circle · chevron */
export function BrandMarks({
  className = "",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="0" y="7" width="16" height="4" rx="0.5" fill={color} />
      <circle cx="36" cy="9" r="6.5" stroke={color} strokeWidth="3.2" />
      <path
        d="M54 14.5 L62 3.5 L70 14.5 L70 16"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}
