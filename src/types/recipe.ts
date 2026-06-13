export type RecipeCategory = 'entree' | 'plat' | 'dessert' | 'aperitif' | 'cocktail'
export type RecipeCuisine = 'center' | 'north' | 'east' | 'west' | 'south'

export interface RealRecipe {
  name: string
  category: RecipeCategory
  cuisine: RecipeCuisine
  prepTimeMin: number
  cookTimeMin: number
  difficulty: 1 | 2 | 3
  servings: number
  ingredients: string[]
  steps: string[]
  tip?: string
}

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  entree:   '🥗 Entrée',
  plat:     '🍽️ Plat',
  dessert:  '🍮 Dessert',
  aperitif: '🥂 Apéritif',
  cocktail: '🍹 Cocktail',
}

export const CUISINE_LABELS: Record<RecipeCuisine, string> = {
  center: '🌍 Classique',
  north:  '❄️ Nordique',
  east:   '🌸 Asiatique',
  west:   '🏰 Médiéval',
  south:  '🌶️ Épicé',
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: '⭐ Facile',
  2: '⭐⭐ Moyen',
  3: '⭐⭐⭐ Difficile',
}
