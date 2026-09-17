import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex gap-1 rounded-lg bg-navy-50 p-1', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md text-navy-600 data-[state=active]:bg-navy-600 data-[state=active]:text-white transition-colors',
        className
      )}
      {...props}
    />
  )
}

export const TabsContent = TabsPrimitive.Content
