import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

const CATEGORIES = 'categories'
const PRODUCTS = 'products'

export async function getAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from(CATEGORIES)
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await supabase
    .from(CATEGORIES)
    .insert({ name })
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const trimmed = name.trim()
  const { data: existing } = await supabase
    .from(CATEGORIES)
    .select('id, name')
    .neq('id', id)

  const nameExists = (existing ?? []).some(
    (c: { name: string }) => c.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (nameExists) {
    throw new Error('A category with this name already exists')
  }

  const { data, error } = await supabase
    .from(CATEGORIES)
    .update({ name: trimmed })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { data: inUse, error: checkError } = await supabase
    .from(PRODUCTS)
    .select('id')
    .eq('category_id', id)
    .limit(1)

  if (checkError) throw checkError
  if (inUse && inUse.length > 0) {
    throw new Error('Category is in use and cannot be deleted')
  }

  const { error: deleteError } = await supabase
    .from(CATEGORIES)
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError
}
