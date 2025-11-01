export type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: number; // numeric(10,2) -> use number
  /**
   * Category stored in DB as text; we constrain admin input to a small enum.
   * Use lowercase canonical values to align with filtering utils.
   */
  category?: string | null;
  image_url?: string | null;
  whatsapp_number?: string | null;
  active: boolean;
  inserted_at?: string;
};

export type ProductImage = {
  id: number;
  product_id: number;
  image_url: string;
  alt?: string | null;
  position: number;
  inserted_at?: string;
};

export type Rating = {
  average: number;
  count: number;
};

// Admin-editable categories (focus for now)
export type AdminCategory = 'fashion' | 'beauty' | 'footwear';
export const ADMIN_CATEGORIES: readonly AdminCategory[] = ['fashion', 'beauty', 'footwear'] as const;