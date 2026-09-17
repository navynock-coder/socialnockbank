import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex items-center select-none touch-none w-full h-5', className)}
      {...props}
    >
      <SliderPrimitive.Track className="bg-gray-200 relative grow rounded-full h-1.5">
        <SliderPrimitive.Range className="absolute bg-orange-500 rounded-full h-full" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block w-4 h-4 rounded-full bg-white border-2 border-orange-500 shadow focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      ))}
    </SliderPrimitive.Root>
  )
}
