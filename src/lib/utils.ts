import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency }).format(amount)
}

const TZ = "Europe/Bratislava"

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "short", timeZone: TZ }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("sk-SK", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(date))
}
