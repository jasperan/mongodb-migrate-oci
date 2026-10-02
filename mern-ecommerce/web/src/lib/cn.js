import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

// clsx + tailwind-merge: later utilities win over conflicting earlier ones, so a
// caller's `className` (or an invalid state) can override a component default.
export const cn = (...inputs) => twMerge(clsx(inputs))
