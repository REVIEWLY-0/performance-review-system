'use client'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export default function Avatar({ name, avatarUrl, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (avatarUrl) {
    // If the URL is a relative path (starts with /uploads), prepend the API base URL
    const src = avatarUrl.startsWith('/') && !avatarUrl.startsWith('//')
      ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? ''}${avatarUrl}`
      : avatarUrl

    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-outline-variant shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-primary flex items-center justify-center shrink-0 border border-primary/20 ${className}`}
      aria-label={name}
    >
      <span className="font-bold text-on-primary leading-none">{getInitials(name)}</span>
    </div>
  )
}
