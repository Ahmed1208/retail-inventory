import { supabase } from '@/lib/supabase'
import type { Brand } from '@/types'

const BRANDS = 'brands'
const PRODUCTS = 'products'

export async function getAllBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from(BRANDS)
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as Brand[]
}

export async function createBrand(name: string): Promise<Brand> {
  const { data, error } = await supabase
    .from(BRANDS)
    .insert({ name })
    .select()
    .single()

  if (error) throw error
  return data as Brand
}

export async function updateBrand(id: string, name: string): Promise<Brand> {
  const trimmed = name.trim()
  const { data: existing } = await supabase
    .from(BRANDS)
    .select('id, name')
    .neq('id', id)

  const nameExists = (existing ?? []).some(
    (b: { name: string }) => b.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (nameExists) {
    throw new Error('A brand with this name already exists')
  }

  const { data, error } = await supabase
    .from(BRANDS)
    .update({ name: trimmed })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Brand
}

export async function deleteBrand(id: string): Promise<void> {
  const { data: inUse, error: checkError } = await supabase
    .from(PRODUCTS)
    .select('id')
    .eq('brand_id', id)
    .limit(1)

  if (checkError) throw checkError
  if (inUse && inUse.length > 0) {
    throw new Error('Brand is in use and cannot be deleted')
  }

  const { error: deleteError } = await supabase
    .from(BRANDS)
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError
}
