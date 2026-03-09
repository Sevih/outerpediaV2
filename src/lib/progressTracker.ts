// Progress Tracker - Client-side storage service for daily/weekly/monthly task tracking
// Uses localStorage only - no tracking, no invasive data collection

import type { UserProgress, DailyTaskType, WeeklyTaskType, MonthlyTaskType, TaskProgress, UserSettings } from '@/types/progress'
import {
  DAILY_TASK_DEFINITIONS,
  WEEKLY_TASK_DEFINITIONS,
  MONTHLY_TASK_DEFINITIONS,
  getPermanentDailyTaskIds,
  getPermanentWeeklyTaskIds,
  getPermanentMonthlyTaskIds,
  getDefaultCraftTaskIds,
  getDefaultShopTaskIds,
} from './taskDefinitions'

const STORAGE_KEY = 'outerplane:progress'
const SETTINGS_KEY = 'outerplane:settings'
const CURRENT_VERSION = 1

// Outerplane reset times (aligned with game server resets)
// Daily reset: 00:00 UTC
// Weekly reset: Monday 00:00 UTC
const DAILY_RESET_HOUR_UTC = 0
const WEEKLY_RESET_DAY = 1 // Monday

export const ProgressTracker = {
  getProgress(): UserProgress {
    if (typeof window === 'undefined') {
      return this.createEmptyProgress()
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return this.createEmptyProgress()

    try {
      const progress: UserProgress = JSON.parse(stored)

      if (!progress.preciseCraft) {
        progress.preciseCraft = { completedAt: null }
      }

      const settings = this.getSettings()
      this.syncProgressWithSettings(progress, settings)

      return this.checkAndResetProgress(progress)
    } catch {
      return this.createEmptyProgress()
    }
  },

  getSettings(): UserSettings {
    if (typeof window === 'undefined') {
      return this.createDefaultSettings()
    }

    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return this.createDefaultSettings()

    try {
      const settings = JSON.parse(stored) as UserSettings

      const permanentDaily = getPermanentDailyTaskIds()
      const permanentWeekly = getPermanentWeeklyTaskIds()
      const permanentMonthly = getPermanentMonthlyTaskIds()

      let needsUpdate = false

      if (!settings.enabledTasks.monthly) {
        settings.enabledTasks.monthly = []
        needsUpdate = true
      }

      permanentDaily.forEach((taskId) => {
        if (!settings.enabledTasks.daily.includes(taskId)) {
          settings.enabledTasks.daily.push(taskId)
          needsUpdate = true
        }
      })

      permanentWeekly.forEach((taskId) => {
        if (!settings.enabledTasks.weekly.includes(taskId)) {
          settings.enabledTasks.weekly.push(taskId)
          needsUpdate = true
        }
      })

      permanentMonthly.forEach((taskId) => {
        if (!settings.enabledTasks.monthly.includes(taskId)) {
          settings.enabledTasks.monthly.push(taskId)
          needsUpdate = true
        }
      })

      // Remove obsolete tasks
      const validDailyIds = Object.keys(DAILY_TASK_DEFINITIONS)
      const validWeeklyIds = Object.keys(WEEKLY_TASK_DEFINITIONS)
      const validMonthlyIds = Object.keys(MONTHLY_TASK_DEFINITIONS)

      const filteredDaily = settings.enabledTasks.daily.filter((id) => validDailyIds.includes(id))
      if (filteredDaily.length !== settings.enabledTasks.daily.length) {
        settings.enabledTasks.daily = filteredDaily
        needsUpdate = true
      }

      const filteredWeekly = settings.enabledTasks.weekly.filter((id) => validWeeklyIds.includes(id))
      if (filteredWeekly.length !== settings.enabledTasks.weekly.length) {
        settings.enabledTasks.weekly = filteredWeekly
        needsUpdate = true
      }

      const filteredMonthly = settings.enabledTasks.monthly.filter((id) => validMonthlyIds.includes(id))
      if (filteredMonthly.length !== settings.enabledTasks.monthly.length) {
        settings.enabledTasks.monthly = filteredMonthly
        needsUpdate = true
      }

      if (settings.hasTerminusSupportPack === undefined) {
        settings.hasTerminusSupportPack = false
        needsUpdate = true
      }
      if (settings.hasVeronicaPremiumPack === undefined) {
        settings.hasVeronicaPremiumPack = false
        needsUpdate = true
      }
      if (settings.adventureLicenseCombatsPerStage === undefined) {
        settings.adventureLicenseCombatsPerStage = 2
        needsUpdate = true
      }
      if (settings.hasCompletedElementalTower === undefined) {
        settings.hasCompletedElementalTower = false
        needsUpdate = true
      }
      if (settings.displayMode === undefined) {
        settings.displayMode = 'tabs'
        needsUpdate = true
      }

      if (needsUpdate) {
        this.saveSettings(settings)
      }

      return settings
    } catch {
      return this.createDefaultSettings()
    }
  },

  createDefaultSettings(): UserSettings {
    const craftIds = getDefaultCraftTaskIds()
    const shopIds = getDefaultShopTaskIds()

    const dailyCraftShop = [...craftIds, ...shopIds].filter((id) => DAILY_TASK_DEFINITIONS[id])
    const weeklyCraftShop = [...craftIds, ...shopIds].filter((id) => WEEKLY_TASK_DEFINITIONS[id])
    const monthlyCraftShop = [...craftIds, ...shopIds].filter((id) => MONTHLY_TASK_DEFINITIONS[id])

    return {
      enabledTasks: {
        daily: [...getPermanentDailyTaskIds(), ...dailyCraftShop],
        weekly: [...getPermanentWeeklyTaskIds(), ...weeklyCraftShop],
        monthly: [...getPermanentMonthlyTaskIds(), ...monthlyCraftShop],
      },
      hasTerminusSupportPack: false,
      hasVeronicaPremiumPack: false,
      adventureLicenseCombatsPerStage: 2,
      hasCompletedElementalTower: false,
      displayMode: 'tabs',
    }
  },

  saveSettings(settings: UserSettings): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  },

  toggleTaskEnabled(taskId: string, type: 'daily' | 'weekly' | 'monthly'): void {
    const settings = this.getSettings()
    const taskList = type === 'daily'
      ? settings.enabledTasks.daily
      : type === 'weekly'
      ? settings.enabledTasks.weekly
      : settings.enabledTasks.monthly
    const index = taskList.indexOf(taskId)

    if (index >= 0) {
      taskList.splice(index, 1)
    } else {
      taskList.push(taskId)
    }

    this.saveSettings(settings)

    const progress = this.getProgress()
    this.syncProgressWithSettings(progress, settings)
    this.saveProgress(progress)
  },

  toggleTerminusSupportPack(): void {
    const settings = this.getSettings()
    settings.hasTerminusSupportPack = !settings.hasTerminusSupportPack
    this.saveSettings(settings)

    const progress = this.getProgress()
    if (progress.daily['terminus-isle']) {
      const newMaxCount = settings.hasTerminusSupportPack ? 2 : 1
      progress.daily['terminus-isle'].maxCount = newMaxCount
      if (progress.daily['terminus-isle'].count !== undefined && progress.daily['terminus-isle'].count! > newMaxCount) {
        progress.daily['terminus-isle'].count = newMaxCount
      }
      progress.daily['terminus-isle'].completed = (progress.daily['terminus-isle'].count ?? 0) >= newMaxCount
      this.saveProgress(progress)
    }
  },

  toggleVeronicaPremiumPack(): void {
    const settings = this.getSettings()
    settings.hasVeronicaPremiumPack = !settings.hasVeronicaPremiumPack
    this.saveSettings(settings)

    const progress = this.getProgress()
    const affectedTasks = ['bounty-hunter', 'bandit-chase', 'upgrade-stone-retrieval']
    const newMaxCount = settings.hasVeronicaPremiumPack ? 4 : 3

    affectedTasks.forEach((taskId) => {
      if (progress.daily[taskId]) {
        progress.daily[taskId].maxCount = newMaxCount
        if (progress.daily[taskId].count !== undefined && progress.daily[taskId].count! > newMaxCount) {
          progress.daily[taskId].count = newMaxCount
        }
        progress.daily[taskId].completed = (progress.daily[taskId].count ?? 0) >= newMaxCount
      }
    })

    this.saveProgress(progress)
  },

  setAdventureLicenseCombatsPerStage(combatsPerStage: 2 | 3 | 4): void {
    const settings = this.getSettings()
    settings.adventureLicenseCombatsPerStage = combatsPerStage
    this.saveSettings(settings)

    const progress = this.getProgress()
    if (progress.daily['adventure-license']) {
      const newMaxCount = combatsPerStage * 3
      progress.daily['adventure-license'].maxCount = newMaxCount
      if (progress.daily['adventure-license'].count !== undefined && progress.daily['adventure-license'].count! > newMaxCount) {
        progress.daily['adventure-license'].count = newMaxCount
      }
      progress.daily['adventure-license'].completed = (progress.daily['adventure-license'].count ?? 0) >= newMaxCount
      this.saveProgress(progress)
    }
  },

  toggleElementalTowerCompletion(): void {
    const settings = this.getSettings()
    settings.hasCompletedElementalTower = !settings.hasCompletedElementalTower
    this.saveSettings(settings)

    const progress = this.getProgress()
    this.syncProgressWithSettings(progress, settings)
    this.saveProgress(progress)
  },

  setDisplayMode(mode: 'tabs' | 'single-page'): void {
    const settings = this.getSettings()
    settings.displayMode = mode
    this.saveSettings(settings)
  },

  toggleAllSweepContent(): void {
    const progress = this.getProgress()
    const sweepableTasks = [
      'bounty-hunter',
      'bandit-chase',
      'upgrade-stone-retrieval',
      'defeat-doppelganger',
      'special-request-ecology',
      'special-request-identification',
      'memorial-match',
      'story-hard',
    ]

    const existingTasks = sweepableTasks.filter((taskId) => progress.daily[taskId])
    const allCompleted = existingTasks.length > 0 && existingTasks.every((taskId) => progress.daily[taskId].completed)

    sweepableTasks.forEach((taskId) => {
      if (progress.daily[taskId]) {
        if (allCompleted) {
          progress.daily[taskId].count = 0
          progress.daily[taskId].completed = false
        } else {
          const maxCount = progress.daily[taskId].maxCount ?? 0
          progress.daily[taskId].count = maxCount
          progress.daily[taskId].completed = true
        }
        progress.daily[taskId].lastUpdated = Date.now()
      }
    })

    this.saveProgress(progress)
  },

  toggleAllShopPurchases(type: 'daily' | 'weekly' | 'monthly'): void {
    const progress = this.getProgress()
    const definitions = type === 'daily'
      ? DAILY_TASK_DEFINITIONS
      : type === 'weekly'
      ? WEEKLY_TASK_DEFINITIONS
      : MONTHLY_TASK_DEFINITIONS
    const taskProgress = type === 'daily'
      ? progress.daily
      : type === 'weekly'
      ? progress.weekly
      : progress.monthly

    const shopTaskIds = Object.entries(definitions)
      .filter(([, def]) => def.category === 'shop')
      .map(([taskId]) => taskId)
      .filter((taskId) => taskProgress[taskId])

    const allCompleted = shopTaskIds.length > 0 && shopTaskIds.every((taskId) => taskProgress[taskId].completed)

    shopTaskIds.forEach((taskId) => {
      if (allCompleted) {
        taskProgress[taskId].count = 0
        taskProgress[taskId].completed = false
      } else {
        const maxCount = taskProgress[taskId].maxCount ?? 0
        taskProgress[taskId].count = maxCount
        taskProgress[taskId].completed = true
      }
      taskProgress[taskId].lastUpdated = Date.now()
    })

    this.saveProgress(progress)
  },

  toggleAllCraftItems(type: 'daily' | 'weekly' | 'monthly'): void {
    const progress = this.getProgress()
    const definitions = type === 'daily'
      ? DAILY_TASK_DEFINITIONS
      : type === 'weekly'
      ? WEEKLY_TASK_DEFINITIONS
      : MONTHLY_TASK_DEFINITIONS
    const taskProgress = type === 'daily'
      ? progress.daily
      : type === 'weekly'
      ? progress.weekly
      : progress.monthly

    const craftTaskIds = Object.entries(definitions)
      .filter(([, def]) => def.category === 'craft')
      .map(([taskId]) => taskId)
      .filter((taskId) => taskProgress[taskId])

    const allCompleted = craftTaskIds.length > 0 && craftTaskIds.every((taskId) => taskProgress[taskId].completed)

    craftTaskIds.forEach((taskId) => {
      if (allCompleted) {
        taskProgress[taskId].count = 0
        taskProgress[taskId].completed = false
      } else {
        const maxCount = taskProgress[taskId].maxCount ?? 0
        taskProgress[taskId].count = maxCount
        taskProgress[taskId].completed = true
      }
      taskProgress[taskId].lastUpdated = Date.now()
    })

    this.saveProgress(progress)
  },

  togglePreciseCraft(): void {
    const progress = this.getProgress()
    if (progress.preciseCraft.completedAt === null) {
      progress.preciseCraft.completedAt = Date.now()
    } else {
      progress.preciseCraft.completedAt = null
    }
    this.saveProgress(progress)
  },

  isPreciseCraftAvailable(): boolean {
    const progress = this.getProgress()
    if (progress.preciseCraft.completedAt === null) {
      return true
    }
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    return Date.now() >= progress.preciseCraft.completedAt + thirtyDaysMs
  },

  getNextPreciseCraftTime(): number | null {
    const progress = this.getProgress()
    if (progress.preciseCraft.completedAt === null) {
      return null
    }
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const nextAvailable = progress.preciseCraft.completedAt + thirtyDaysMs
    if (Date.now() >= nextAvailable) {
      return null
    }
    return nextAvailable
  },

  setPreciseCraftTimer(daysRemaining: number): void {
    const progress = this.getProgress()
    if (daysRemaining <= 0) {
      progress.preciseCraft.completedAt = null
    } else {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      const daysRemainingMs = daysRemaining * 24 * 60 * 60 * 1000
      progress.preciseCraft.completedAt = Date.now() + daysRemainingMs - thirtyDaysMs
    }
    this.saveProgress(progress)
  },

  getTaskMaxCount(taskId: string, type: 'daily' | 'weekly' | 'monthly'): number | undefined {
    const def = type === 'daily'
      ? DAILY_TASK_DEFINITIONS[taskId]
      : type === 'weekly'
      ? WEEKLY_TASK_DEFINITIONS[taskId]
      : MONTHLY_TASK_DEFINITIONS[taskId]
    if (!def?.maxCount) return undefined

    const settings = this.getSettings()

    if (taskId === 'terminus-isle') {
      return settings.hasTerminusSupportPack ? 2 : 1
    }

    if (['bounty-hunter', 'bandit-chase', 'upgrade-stone-retrieval'].includes(taskId)) {
      return settings.hasVeronicaPremiumPack ? 4 : 3
    }

    if (taskId === 'adventure-license') {
      return settings.adventureLicenseCombatsPerStage * 3
    }

    return def.maxCount
  },

  syncProgressWithSettings(progress: UserProgress, settings: UserSettings): void {
    const now = Date.now()

    // Sync daily tasks
    const currentDailyIds = Object.keys(progress.daily)
    const enabledDailyIds = settings.enabledTasks.daily.filter(
      (id) => {
        if (id === 'elemental-tower' && settings.hasCompletedElementalTower) return false
        return true
      }
    )

    currentDailyIds.forEach((id) => {
      if (!enabledDailyIds.includes(id)) {
        delete progress.daily[id]
      }
    })

    enabledDailyIds.forEach((id) => {
      if (!progress.daily[id]) {
        const maxCount = this.getTaskMaxCount(id, 'daily')
        progress.daily[id] = {
          id,
          completed: false,
          lastUpdated: now,
          maxCount,
          count: maxCount ? 0 : undefined,
        }
      } else {
        const maxCount = this.getTaskMaxCount(id, 'daily')
        if (maxCount !== undefined) {
          progress.daily[id].maxCount = maxCount
          if (progress.daily[id].count !== undefined && progress.daily[id].count! > maxCount) {
            progress.daily[id].count = maxCount
          }
          progress.daily[id].completed = (progress.daily[id].count ?? 0) >= maxCount
        }
      }
    })

    // Sync weekly tasks
    const currentWeeklyIds = Object.keys(progress.weekly)
    const enabledWeeklyIds = settings.enabledTasks.weekly

    currentWeeklyIds.forEach((id) => {
      if (!enabledWeeklyIds.includes(id)) {
        delete progress.weekly[id]
      }
    })

    enabledWeeklyIds.forEach((id) => {
      if (!progress.weekly[id]) {
        const maxCount = this.getTaskMaxCount(id, 'weekly')
        progress.weekly[id] = {
          id,
          completed: false,
          lastUpdated: now,
          maxCount,
          count: maxCount ? 0 : undefined,
        }
      } else {
        const maxCount = this.getTaskMaxCount(id, 'weekly')
        if (maxCount !== undefined) {
          progress.weekly[id].maxCount = maxCount
          if (progress.weekly[id].count !== undefined && progress.weekly[id].count! > maxCount) {
            progress.weekly[id].count = maxCount
          }
          progress.weekly[id].completed = (progress.weekly[id].count ?? 0) >= maxCount
        }
      }
    })

    // Ensure monthly tasks object exists
    if (!progress.monthly) {
      progress.monthly = {}
    }

    // Sync monthly tasks
    const currentMonthlyIds = Object.keys(progress.monthly)
    const enabledMonthlyIds = settings.enabledTasks.monthly

    currentMonthlyIds.forEach((id) => {
      if (!enabledMonthlyIds.includes(id)) {
        delete progress.monthly[id]
      }
    })

    enabledMonthlyIds.forEach((id) => {
      if (!progress.monthly[id]) {
        const maxCount = this.getTaskMaxCount(id, 'monthly')
        progress.monthly[id] = {
          id,
          completed: false,
          lastUpdated: now,
          maxCount,
          count: maxCount ? 0 : undefined,
        }
      } else {
        const maxCount = this.getTaskMaxCount(id, 'monthly')
        if (maxCount !== undefined) {
          progress.monthly[id].maxCount = maxCount
          if (progress.monthly[id].count !== undefined && progress.monthly[id].count! > maxCount) {
            progress.monthly[id].count = maxCount
          }
          progress.monthly[id].completed = (progress.monthly[id].count ?? 0) >= maxCount
        }
      }
    })
  },

  createEmptyProgress(): UserProgress {
    const now = Date.now()
    const settings = this.getSettings()

    const enabledDailyIds = settings.enabledTasks.daily.filter(
      (id) => {
        if (id === 'elemental-tower' && settings.hasCompletedElementalTower) return false
        return true
      }
    )

    const daily: Record<string, TaskProgress> = {}
    enabledDailyIds.forEach((id) => {
      const maxCount = this.getTaskMaxCount(id, 'daily')
      daily[id] = {
        id,
        completed: false,
        lastUpdated: now,
        maxCount,
        count: maxCount ? 0 : undefined,
      }
    })

    const weekly: Record<string, TaskProgress> = {}
    settings.enabledTasks.weekly.forEach((id) => {
      const maxCount = this.getTaskMaxCount(id, 'weekly')
      weekly[id] = {
        id,
        completed: false,
        lastUpdated: now,
        maxCount,
        count: maxCount ? 0 : undefined,
      }
    })

    const monthly: Record<string, TaskProgress> = {}
    settings.enabledTasks.monthly.forEach((id) => {
      const maxCount = this.getTaskMaxCount(id, 'monthly')
      monthly[id] = {
        id,
        completed: false,
        lastUpdated: now,
        maxCount,
        count: maxCount ? 0 : undefined,
      }
    })

    return {
      daily: daily as Record<DailyTaskType, TaskProgress>,
      weekly: weekly as Record<WeeklyTaskType, TaskProgress>,
      monthly: monthly as Record<MonthlyTaskType, TaskProgress>,
      preciseCraft: { completedAt: null },
      lastDailyReset: now,
      lastWeeklyReset: now,
      lastMonthlyReset: now,
      version: CURRENT_VERSION,
    }
  },

  checkAndResetProgress(progress: UserProgress): UserProgress {
    const now = new Date()
    let needsSave = false

    const todayResetTime = new Date(now)
    todayResetTime.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)

    if (now >= todayResetTime && progress.lastDailyReset < todayResetTime.getTime()) {
      Object.entries(progress.daily).forEach(([taskId, task]) => {
        const def = DAILY_TASK_DEFINITIONS[taskId]

        if (def?.resetIntervalDays && task.completed) {
          const completedTime = task.lastUpdated
          const resetAfterTime = new Date(completedTime)
          resetAfterTime.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
          resetAfterTime.setUTCDate(resetAfterTime.getUTCDate() + def.resetIntervalDays)

          if (now.getTime() >= resetAfterTime.getTime()) {
            task.completed = false
            task.count = task.maxCount ? 0 : undefined
          }
        } else {
          task.completed = false
          task.count = task.maxCount ? 0 : undefined
        }
      })
      progress.lastDailyReset = Date.now()
      needsSave = true
    }

    // Weekly reset (Monday 00:00 UTC)
    const currentWeekMonday = new Date(now)
    currentWeekMonday.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
    const currentDay = currentWeekMonday.getUTCDay()
    const daysToSubtract = (currentDay - WEEKLY_RESET_DAY + 7) % 7
    currentWeekMonday.setUTCDate(currentWeekMonday.getUTCDate() - daysToSubtract)

    if (now >= currentWeekMonday && progress.lastWeeklyReset < currentWeekMonday.getTime()) {
      Object.values(progress.weekly).forEach((task) => {
        task.completed = false
        task.count = task.maxCount ? 0 : undefined
      })
      progress.lastWeeklyReset = Date.now()
      needsSave = true
    }

    if (!progress.lastMonthlyReset) {
      progress.lastMonthlyReset = Date.now()
      needsSave = true
    }

    // Monthly reset (1st of month at 00:00 UTC)
    const currentMonthReset = new Date(now)
    currentMonthReset.setUTCDate(1)
    currentMonthReset.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)

    if (now >= currentMonthReset && progress.lastMonthlyReset < currentMonthReset.getTime()) {
      Object.values(progress.monthly || {}).forEach((task) => {
        task.completed = false
        task.count = task.maxCount ? 0 : undefined
      })
      progress.lastMonthlyReset = Date.now()
      needsSave = true
    }

    if (needsSave) {
      this.saveProgress(progress)
    }

    return progress
  },

  getNextDailyReset(): number {
    const now = new Date()
    const next = new Date(now)
    next.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1)
    }
    return next.getTime()
  },

  getNextWeeklyReset(): number {
    const now = new Date()
    const next = new Date(now)
    const currentDay = now.getUTCDay()
    let daysUntilMonday = (WEEKLY_RESET_DAY - currentDay + 7) % 7

    if (daysUntilMonday === 0) {
      const todayReset = new Date(now)
      todayReset.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
      if (now < todayReset) {
        return todayReset.getTime()
      } else {
        daysUntilMonday = 7
      }
    }

    next.setUTCDate(next.getUTCDate() + daysUntilMonday)
    next.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
    return next.getTime()
  },

  getNextMonthlyReset(): number {
    const now = new Date()
    const next = new Date(now)
    next.setUTCDate(1)
    next.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
    if (next.getTime() <= now.getTime()) {
      next.setUTCMonth(next.getUTCMonth() + 1)
    }
    return next.getTime()
  },

  getNextRecurringTaskReset(taskId: string): number | null {
    const progress = this.getProgress()
    const task = progress.daily[taskId]
    const def = DAILY_TASK_DEFINITIONS[taskId]

    if (!task || !def?.resetIntervalDays || !task.completed) {
      return null
    }

    const completedTime = task.lastUpdated
    const resetAfterTime = new Date(completedTime)
    resetAfterTime.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)
    resetAfterTime.setUTCDate(resetAfterTime.getUTCDate() + def.resetIntervalDays)

    return resetAfterTime.getTime()
  },

  getVHTCurrentUnlockedPhase(): number {
    const now = new Date()
    const dayOfMonth = now.getUTCDate()
    if (dayOfMonth >= 22) return 4
    if (dayOfMonth >= 15) return 3
    if (dayOfMonth >= 8) return 2
    return 1
  },

  getNextVHTPhaseUnlockTime(): number | null {
    const now = new Date()
    const currentPhase = this.getVHTCurrentUnlockedPhase()
    if (currentPhase >= 4) return null

    const unlockDays = [1, 8, 15, 22]
    const nextUnlockDay = unlockDays[currentPhase]

    const nextUnlock = new Date(now)
    nextUnlock.setUTCDate(nextUnlockDay)
    nextUnlock.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0)

    if (nextUnlock.getTime() <= now.getTime()) return null

    return nextUnlock.getTime()
  },

  getVHTPhaseLabel(phase: number): string {
    const labels = ['1-5', '6-10', '11-15', '16-20']
    return labels[phase - 1] || ''
  },

  formatTimeUntil(timestamp: number): string {
    const diff = timestamp - Date.now()
    if (diff <= 0) return '0h 0m'

    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    }
    return `${hours}h ${minutes}m`
  },

  toggleTask(taskId: string, type: 'daily' | 'weekly'): void {
    const progress = this.getProgress()
    if (type === 'daily') {
      const task = progress.daily[taskId as DailyTaskType]
      if (task) {
        task.completed = !task.completed
        task.lastUpdated = Date.now()
        this.saveProgress(progress)
      }
    } else {
      const task = progress.weekly[taskId as WeeklyTaskType]
      if (task) {
        task.completed = !task.completed
        task.lastUpdated = Date.now()
        this.saveProgress(progress)
      }
    }
  },

  updateTaskCount(taskId: string, type: 'daily' | 'weekly' | 'monthly', count: number): void {
    const progress = this.getProgress()
    if (type === 'daily') {
      const task = progress.daily[taskId as DailyTaskType]
      if (task && task.maxCount !== undefined) {
        task.count = Math.max(0, Math.min(count, task.maxCount))
        task.completed = task.count >= task.maxCount
        task.lastUpdated = Date.now()
        this.saveProgress(progress)
      }
    } else if (type === 'weekly') {
      const task = progress.weekly[taskId as WeeklyTaskType]
      if (task && task.maxCount !== undefined) {
        task.count = Math.max(0, Math.min(count, task.maxCount))
        task.completed = task.count >= task.maxCount
        task.lastUpdated = Date.now()
        this.saveProgress(progress)
      }
    } else {
      const task = progress.monthly[taskId as MonthlyTaskType]
      if (task && task.maxCount !== undefined) {
        task.count = Math.max(0, Math.min(count, task.maxCount))
        task.completed = task.count >= task.maxCount
        task.lastUpdated = Date.now()
        this.saveProgress(progress)
      }
    }
  },

  incrementTaskCount(taskId: string, type: 'daily' | 'weekly' | 'monthly'): void {
    const progress = this.getProgress()
    if (type === 'daily') {
      const task = progress.daily[taskId as DailyTaskType]
      if (task && task.maxCount !== undefined) {
        const newCount = (task.count ?? 0) + 1
        this.updateTaskCount(taskId, type, newCount)
      }
    } else if (type === 'weekly') {
      const task = progress.weekly[taskId as WeeklyTaskType]
      if (task && task.maxCount !== undefined) {
        const newCount = (task.count ?? 0) + 1
        this.updateTaskCount(taskId, type, newCount)
      }
    } else {
      const task = progress.monthly[taskId as MonthlyTaskType]
      if (task && task.maxCount !== undefined) {
        const newCount = (task.count ?? 0) + 1
        this.updateTaskCount(taskId, type, newCount)
      }
    }
  },

  saveProgress(progress: UserProgress): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  },

  exportProgress(): string {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(STORAGE_KEY) || ''
  },

  importProgress(data: string): boolean {
    try {
      const progress = JSON.parse(data) as UserProgress
      if (!progress.daily || !progress.weekly || !progress.version) {
        return false
      }
      this.saveProgress(progress)
      return true
    } catch {
      return false
    }
  },

  resetAll(): void {
    const empty = this.createEmptyProgress()
    this.saveProgress(empty)
  },

  getStats(progress: UserProgress): {
    dailyCompleted: number
    dailyTotal: number
    weeklyCompleted: number
    weeklyTotal: number
    monthlyCompleted: number
    monthlyTotal: number
    dailyPercent: number
    weeklyPercent: number
    monthlyPercent: number
  } {
    const dailyTasks = Object.values(progress.daily)
    const weeklyTasks = Object.values(progress.weekly)
    const monthlyTasks = Object.values(progress.monthly || {})

    const dailyCompleted = dailyTasks.filter((t) => t.completed).length
    const dailyTotal = dailyTasks.length

    const weeklyCompleted = weeklyTasks.filter((t) => t.completed).length
    const weeklyTotal = weeklyTasks.length

    const preciseCraftCompleted = !this.isPreciseCraftAvailable() ? 1 : 0
    const monthlyCompleted = monthlyTasks.filter((t) => t.completed).length + preciseCraftCompleted
    const monthlyTotal = monthlyTasks.length + 1

    return {
      dailyCompleted,
      dailyTotal,
      weeklyCompleted,
      weeklyTotal,
      monthlyCompleted,
      monthlyTotal,
      dailyPercent: dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
      weeklyPercent: weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0,
      monthlyPercent: monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0,
    }
  },
}
