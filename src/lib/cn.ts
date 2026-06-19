import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Helper estándar shadcn: combina clases condicionales + resuelve conflictos de Tailwind.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
