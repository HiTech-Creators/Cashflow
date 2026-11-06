import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a consistent color for transaction categories
 * Uses predefined colors for common categories, falls back to hash-based color generation
 */
export function getCategoryColor(category: string): string {
  // Predefined colors for backend categories (matching flowback/src/constants.py)
  const predefinedColors: Record<string, string> = {
    'operating': '#f59e0b', // amber
    'investing': '#3b82f6', // blue
    'financing': '#8b5cf6', // violet
    'revenue': '#10b981', // green
    'expenses': '#ef4444', // red
    'assets': '#06b6d4', // cyan
    'equipment': '#f97316', // orange
    'loans': '#a855f7', // purple
    'equity': '#84cc16', // lime
    // Legacy support
    'Operating Expenses': '#ef4444',
    'Revenue': '#10b981',
    'Operating': '#f59e0b',
    'Investing': '#3b82f6',
    'Financing': '#8b5cf6',
    'Marketing': '#ec4899',
    'Salaries': '#06b6d4',
    'Rent': '#84cc16',
    'Equipment': '#f97316',
  };

  // Return predefined color if available
  if (predefinedColors[category]) {
    return predefinedColors[category];
  }

  // Generate consistent color based on category name hash
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use a palette of vibrant colors
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];

  return colors[Math.abs(hash) % colors.length];
}
