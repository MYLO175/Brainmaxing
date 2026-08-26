import { describe, expect, it } from 'vitest'
import { bestCorrectRecord, buildSessionResult, migrateLegacy } from './App'
import { generateExercise } from './exercises'
import type { Attempt, SessionConfig } from './types'

describe('session data', () => {
  const config: SessionConfig = {
    track: 'numbers', label: 'Test mix', families: ['arithmetic', 'ratios'],
    difficulty: 'Adaptive', duration: 60,
  }

  it('builds per-family results using median speed and skipped counts', () => {
    const arithmetic = generateExercise('arithmetic', 3, 10)
    const ratio = generateExercise('ratios', 4, 20)
    const attempts: Attempt[] = [
      { exercise: arithmetic, given: arithmetic.answer.kind === 'number' ? arithmetic.answer.value : null, correct: true, skipped: false, responseMs: 2000 },
      { exercise: ratio, given: null, correct: false, skipped: true, responseMs: 0 },
      { exercise: arithmetic, given: -999, correct: false, skipped: false, responseMs: 6000 },
    ]
    const result = buildSessionResult(config, attempts, 45)
    expect(result.schemaVersion).toBe(2)
    expect(result.configuredDuration).toBe(60)
    expect(result.duration).toBe(45)
    expect(result.correct).toBe(1)
    expect(result.total).toBe(3)
    expect(result.skipped).toBe(1)
    expect(result.medianMs).toBe(4000)
    expect(result.breakdown.arithmetic).toMatchObject({ attempted: 2, correct: 1, skipped: 0, medianMs: 4000 })
    expect(result.breakdown.ratios).toMatchObject({ attempted: 0, correct: 0, skipped: 1 })
  })

  it('migrates v1 session history without discarding scores', () => {
    const migrated = migrateLegacy([{ id: 12, date: '2025-01-01', mode: 'Mixed', difficulty: 'Hard', duration: 60, correct: 8, total: 10, bestStreak: 5, averageMs: 3200, score: 77 }])
    expect(migrated).toHaveLength(1)
    expect(migrated[0]).toMatchObject({ schemaVersion: 2, id: 12, track: 'numbers', configuredDuration: 60, correct: 8, total: 10, score: 77 })
    expect(migrated[0].breakdown.arithmetic?.attempted).toBe(10)
  })

  it('stores untimed practice separately from actual elapsed time', () => {
    const practiceConfig: SessionConfig = { ...config, duration: 0 }
    const exercise = generateExercise('arithmetic', 3, 101)
    const attempt: Attempt = { exercise, given: 1, correct: true, skipped: false, responseMs: 1800 }
    const result = buildSessionResult(practiceConfig, [attempt], 125)

    expect(result.configuredDuration).toBe(0)
    expect(result.duration).toBe(125)
  })

  it('keeps correct-answer records separate by drill, difficulty and timer', () => {
    const base = buildSessionResult(config, [], 60)
    const sessions = [
      { ...base, id: 1, label: 'Fast Numbers+ mix', difficulty: 'Adaptive' as const, configuredDuration: 0, correct: 14 },
      { ...base, id: 2, label: 'Fast Numbers+ mix', difficulty: 'Adaptive' as const, configuredDuration: 0, correct: 19 },
      { ...base, id: 3, label: 'Fast Numbers+ mix', difficulty: 'Hard' as const, configuredDuration: 0, correct: 23 },
      { ...base, id: 4, label: 'Fast Numbers+ mix', difficulty: 'Adaptive' as const, configuredDuration: 60, correct: 11 },
      { ...base, id: 5, label: 'Ratios', difficulty: 'Adaptive' as const, configuredDuration: 0, correct: 30 },
    ]

    expect(bestCorrectRecord(sessions, 'numbers', 'Fast Numbers+ mix', 'Adaptive', 0)).toBe(19)
    expect(bestCorrectRecord(sessions, 'numbers', 'Fast Numbers+ mix', 'Hard', 0)).toBe(23)
    expect(bestCorrectRecord(sessions, 'numbers', 'Fast Numbers+ mix', 'Adaptive', 60)).toBe(11)
    expect(bestCorrectRecord(sessions, 'numbers', 'Ratios', 'Adaptive', 0)).toBe(30)
    expect(bestCorrectRecord(sessions, 'numbers', 'Arithmetic', 'Adaptive', 0)).toBeNull()
  })
})
