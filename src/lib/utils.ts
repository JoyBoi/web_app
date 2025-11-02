import type { Product } from './types'

export const formatPrice = (value: number): string => {
  // Always format in Indian Rupees with Indian digit grouping
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

export const applyDiscount = (price: number, discountPct?: number): { final: number; pct: number } => {
  const pct = Math.max(0, Math.min(100, discountPct ?? 0))
  const final = Number((price * (1 - pct / 100)).toFixed(2))
  return { final, pct }
}

export const whatsappLinkFor = (product: Product, phone?: string, productUrl?: string): string => {
  // Prefer public default for UI consistency; server-only DEFAULT_WA_NUMBER remains available for scripts
  const defaultPhone = (import.meta.env.PUBLIC_DEFAULT_WA_NUMBER as string | undefined) || (import.meta.env.DEFAULT_WA_NUMBER as string | undefined)
  const number = (phone || product.whatsapp_number || defaultPhone || '').replace(/\D/g, '')
  const baseText = `Hi! I am interested in ${product.name}`
  const text = productUrl ? `${baseText}\n${productUrl}` : baseText
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

// Basic categories we allow to appear in the header (ordered)
export const BASIC_CATEGORIES: string[] = ['fashion', 'beauty', 'footwear']

// Map specialized/raw categories to one of the basic categories
export const canonicalCategory = (raw?: string): string => {
  const s = (raw || '').trim().toLowerCase()
  if (!s) return 'other'
  // fashion
  if (
    /^(fashion|clothing|apparel|men|women|kids)$/.test(s) ||
    /(fashion|clothes|apparel|wear)/.test(s)
  ) return 'fashion'
  // footwear
  if (
    /^(footwear|shoes|sneakers|sandals|boots)$/.test(s)
  ) return 'footwear'
  // beauty
  if (
    /^(beauty|cosmetics|skincare|makeup|personal care)$/.test(s) ||
    /(cosmetic|skin|make\s?up|care)/.test(s)
  ) return 'beauty'
  // ornaments
  if (
    /^(ornaments|jewelry|jewellery|accessories)$/.test(s)
  ) return 'ornaments'
  // electronics
  if (
    /^(electronics|gadgets|mobile|phone|laptop|accessories)$/.test(s)
  ) return 'electronics'
  // home
  if (
    /^(home|kitchen|decor|furnishing|household)$/.test(s)
  ) return 'home'
  return 'other'
}