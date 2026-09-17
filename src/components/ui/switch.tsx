import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'w-11 h-6 rounded-full bg-gray-300 data-[state=checked]:bg-orange-500 relative transition-colors outline-none',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block w-5 h-5 bg-white rounded-full shadow translate-x-0.5 data-[state=checked]:translate-x-[22px] transition-transform" />
    </SwitchPrimitive.Root>
  )
}
