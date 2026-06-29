import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-0.5',
        {
          'bg-[#f0f0f0] text-[#555]': variant === 'default',
          'bg-emerald-50 text-emerald-700': variant === 'success',
          'bg-yellow-50 text-yellow-700': variant === 'warning',
          'bg-red-50 text-red-700': variant === 'danger',
          'border border-[#e5e5e5] text-[#555]': variant === 'outline',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
