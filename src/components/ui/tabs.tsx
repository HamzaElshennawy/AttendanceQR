"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  orientation: "horizontal" | "vertical"
  value?: string
  variant: "default" | "line"
}

const TabsContext = React.createContext<TabsContextValue>({
  orientation: "horizontal",
  variant: "default",
})

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value ?? internalValue

  return (
    <TabsContext.Provider
      value={{ orientation, value: currentValue, variant: "default" }}
    >
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        orientation={orientation}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => {
          if (value === undefined) {
            setInternalValue(nextValue)
          }
          onValueChange?.(nextValue)
        }}
        className={cn(
          "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
          className
        )}
        {...props}
      />
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center rounded-2xl border border-border/60 bg-card/70 p-1 group-data-[orientation=horizontal]/tabs:min-h-11 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none data-[variant=line]:border-none data-[variant=line]:bg-transparent data-[variant=line]:p-0",
  {
    variants: {
      variant: {
        default: "",
        line: "gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const { orientation, value } = React.useContext(TabsContext)
  const listRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List>>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>()

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !value) return

    const activeTab = list.querySelector<HTMLElement>('[data-state="active"]')
    if (!activeTab) return

    if (orientation === "vertical") {
      setIndicatorStyle({
        transform: `translateY(${activeTab.offsetTop}px)`,
        height: activeTab.offsetHeight,
        width: "calc(100% - 0.5rem)",
      })
      return
    }

    setIndicatorStyle({
      transform: `translateX(${activeTab.offsetLeft}px)`,
      width: activeTab.offsetWidth,
      height: "calc(100% - 0.5rem)",
    })
  }, [orientation, value, className])

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return

    const updateIndicator = () => {
      const activeTab = list.querySelector<HTMLElement>('[data-state="active"]')
      if (!activeTab) return

      if (orientation === "vertical") {
        setIndicatorStyle({
          transform: `translateY(${activeTab.offsetTop}px)`,
          height: activeTab.offsetHeight,
          width: "calc(100% - 0.5rem)",
        })
        return
      }

      setIndicatorStyle({
        transform: `translateX(${activeTab.offsetLeft}px)`,
        width: activeTab.offsetWidth,
        height: "calc(100% - 0.5rem)",
      })
    }

    updateIndicator()

    const resizeObserver = new ResizeObserver(updateIndicator)
    resizeObserver.observe(list)
    Array.from(list.children).forEach((child) => resizeObserver.observe(child))
    window.addEventListener("resize", updateIndicator)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateIndicator)
    }
  }, [orientation, value])

  return (
    <TabsContext.Provider value={{ orientation, value, variant: variant ?? "default" }}>
      <TabsPrimitive.List
        ref={listRef}
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          tabsListVariants({ variant: variant ?? "default" }),
          "relative isolate overflow-hidden",
          className
        )}
        {...props}
      >
        {variant === "default" ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-1 top-1 z-0 rounded-xl border border-primary/12 bg-primary/8 shadow-[0_10px_24px_-18px_rgb(29_78_216_/_0.34)] transition-[transform,width,height] duration-300 ease-out",
              orientation === "vertical" ? "left-1 right-1 top-1" : "bottom-1"
            )}
            style={indicatorStyle}
          />
        ) : null}
        {props.children}
      </TabsPrimitive.List>
    </TabsContext.Provider>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { variant } = React.useContext(TabsContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:border-ring focus-visible:outline-ring relative z-10 inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold tracking-[-0.01em] whitespace-nowrap text-muted-foreground transition-[color,transform,box-shadow] duration-300 ease-out group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "hover:text-foreground data-[state=active]:text-primary group-data-[variant=default]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:text-soft group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground",
        "after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-2 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-1 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:after:bg-primary group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        variant === "default" ? "data-[state=active]:translate-y-[-1px]" : "",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=active]:fade-in-0 data-[state=inactive]:fade-out-0 data-[state=active]:slide-in-from-bottom-1 data-[state=inactive]:slide-out-to-bottom-1 duration-300",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
