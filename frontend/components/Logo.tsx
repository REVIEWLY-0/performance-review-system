interface LogoProps {
  size?: number
  className?: string
}

/**
 * Reviewly logo — primary-coloured rounded square containing a white
 * filled speech-bubble with a star cutout (matches Stitch rate_review icon).
 * Used in DashboardNav and anywhere a standalone logo badge is needed.
 */
export default function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Reviewly logo"
    >
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <path
        fill="white"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 6L12.88 8.29L15.33 8.42L13.43 9.96L14.05 12.33L12 11L9.95 12.33L10.57 9.96L8.67 8.42L11.12 8.29Z"
      />
    </svg>
  )
}
