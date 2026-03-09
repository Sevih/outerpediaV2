// Progress Tracker types for Outerplane daily/weekly/monthly tasks

export type DailyTaskType = string

export type WeeklyTaskType = string

export type MonthlyTaskType = string

export interface TaskProgress {
  id: string
  completed: boolean
  count?: number // For tasks with counters (e.g., 3/3 dungeons)
  maxCount?: number
  lastUpdated: number
}

export interface PreciseCraftProgress {
  completedAt: number | null // Timestamp when last crafted, null if never
}

export interface UserProgress {
  daily: Record<DailyTaskType, TaskProgress>
  weekly: Record<WeeklyTaskType, TaskProgress>
  monthly: Record<MonthlyTaskType, TaskProgress>
  preciseCraft: PreciseCraftProgress
  lastDailyReset: number
  lastWeeklyReset: number
  lastMonthlyReset: number
  version: number // For future migrations
}

export type TaskCategory = 'task' | 'recurring' | 'craft' | 'shop'

export interface TaskDefinition {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  category: TaskCategory // task = normal, recurring = special cycle (e.g., 3-day), shop = purchases
  labelKey: string // i18n key
  maxCount?: number
  icon?: string // Optional icon path
  permanent: boolean // If true, always enabled and cannot be disabled
  resetIntervalDays?: number // For recurring tasks: number of days between resets (default 1 for daily)
  // Shop-specific fields (only for category: 'shop')
  shopCategory?: string // i18n key for shop category
  shopSubcategory?: string // i18n key for shop subcategory
  shopTab?: string // Optional i18n key for shop tab
  shopItemKey?: string // Item key from items.json for ItemInlineDisplay
  shopItemQuantity?: number // Quantity to display
  // Progressive unlock (VHT-style: phases unlock on specific days of the month)
  hasProgressiveUnlock?: boolean // If true, count is limited by current unlocked phase
}

export interface UserSettings {
  enabledTasks: {
    daily: string[] // List of enabled daily task IDs
    weekly: string[] // List of enabled weekly task IDs
    monthly: string[] // List of enabled monthly task IDs
  }
  hasTerminusSupportPack: boolean // If true, Terminus Isle maxCount is 2 instead of 1
  hasVeronicaPremiumPack: boolean // If true, Bounty Hunter/Bandit Chase/Upgrade Stone Retrieval maxCount is 4 instead of 3
  adventureLicenseCombatsPerStage: 2 | 3 | 4 // Number of combats per stage (2/3/4) × 3 stages = 6/9/12 total
  hasCompletedElementalTower: boolean // If true, Elemental Tower is hidden (permanent content, never resets)
  displayMode: 'tabs' | 'single-page' // How to display daily/weekly/monthly tasks
}
