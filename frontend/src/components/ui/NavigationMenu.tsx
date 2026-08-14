import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { ChevronDown } from 'lucide-react';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cx('relative z-40 flex flex-1 items-center', className)}
    {...props}
  >
    {children}
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cx('group flex flex-1 list-none flex-wrap items-center gap-2', className)}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Item ref={ref} className={cx('relative', className)} {...props} />
));
NavigationMenuItem.displayName = NavigationMenuPrimitive.Item.displayName;

const navigationMenuTriggerStyle = (active?: boolean) =>
  cx(
    'inline-flex h-10 items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcane-gold-600)] disabled:pointer-events-none disabled:opacity-50',
    active
      ? 'bg-[var(--arcane-gold-500)] text-[var(--arcane-ink-950)]'
      : 'text-[var(--arcane-ivory)] hover:text-[var(--arcane-gold-300)] data-[state=open]:text-[var(--arcane-gold-300)]'
  );

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger> & { active?: boolean }
>(({ className, children, active, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cx(navigationMenuTriggerStyle(active), 'group', className)}
    {...props}
  >
    {children}
    <ChevronDown
      className="relative top-px h-3.5 w-3.5 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cx(
      'absolute left-0 top-full z-40 mt-2 w-max rounded-lg border border-[var(--arcane-gold-500)] bg-[var(--arcane-ink-900)] text-[var(--arcane-ivory)] shadow-lg',
      'data-[motion^=from-]:animate-fade-in data-[motion^=to-]:animate-fade-out',
      'data-[motion=from-end]:animate-enter-from-right data-[motion=from-start]:animate-enter-from-left',
      'data-[motion=to-end]:animate-exit-to-right data-[motion=to-start]:animate-exit-to-left',
      className
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
};
