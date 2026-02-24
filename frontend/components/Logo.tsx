interface LogoProps {
  size?: number
  className?: string
}

/**
 * Reviewly logo — indigo rounded-square with three ascending bars
 * representing performance growth. Used in nav and auth pages.
 */
export default function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Reviewly logo"
    >
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <rect x="7" y="19" width="4" height="6" rx="1" fill="white" fillOpacity="0.7" />
      <rect x="14" y="14" width="4" height="11" rx="1" fill="white" />
      <rect x="21" y="9" width="4" height="16" rx="1" fill="white" fillOpacity="0.7" />
    </svg>
  )
}
