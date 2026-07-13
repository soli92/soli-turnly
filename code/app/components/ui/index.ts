/**
 * components/ui — shadcn/ui component barrel.
 *
 * I componenti completi vengono aggiunti progressivamente via shadcn CLI:
 *   npx shadcn@latest add button input select table card badge dialog
 *                           dropdown-menu tabs toast skeleton avatar
 *                           calendar popover separator tooltip alert-dialog
 *
 * Componenti disponibili:
 */

// Button (TSK-001)
export { Button, buttonVariants } from './button';
export type { ButtonProps } from './button';

// Label (TSK-003)
export { Label } from './label';

// Dialog (TSK-005)
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog';

// Tooltip (TSK-005)
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

// AlertDialog (TSK-005)
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';

// Select (TSK-005)
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

// Input (TSK-005)
export { Input } from './input';
export type { InputProps } from './input';

// Textarea (TSK-005)
export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

// Badge (TSK-005)
export { Badge, badgeVariants } from './badge';
export type { BadgeProps } from './badge';

// Form — React Hook Form + Radix Label (TSK-007)
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from './form';

// Componenti in arrivo (TSK-008):
// export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
// export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
// export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
// export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
// export { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";
// export { Skeleton } from "./skeleton";
// export { Avatar, AvatarFallback, AvatarImage } from "./avatar";
// export { Calendar } from "./calendar";
// export { Popover, PopoverContent, PopoverTrigger } from "./popover";
// export { Separator } from "./separator";
