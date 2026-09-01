import { describe, expect, it } from 'vitest'
import { buildInterview, INTERVIEW_AREAS, INTERVIEW_QUESTIONS } from './interviewQuestions'

describe('interview question bank', () => {
  it('contains a substantial role-spanning bank', () => {
    expect(INTERVIEW_QUESTIONS.length).toBeGreaterThanOrEqual(70)
    INTERVIEW_AREAS.forEach((area) => {
      expect(INTERVIEW_QUESTIONS.filter((question) => question.area === area.id).length).toBeGreaterThanOrEqual(8)
    })
  })

  it('builds a three-question interview with one question of each kind', () => {
    const interview = buildInterview('finance', 12345)
    expect(interview).toHaveLength(3)
    expect(new Set(interview.map((question) => question.id)).size).toBe(3)
    expect(interview.map((question) => question.kind)).toEqual(['motivation', 'behavioural', 'judgement'])
    expect(interview.every((question) => question.area === 'finance' || question.area === 'all')).toBe(true)
  })

  it('varies questions with the seed while remaining deterministic', () => {
    expect(buildInterview('consulting', 91)).toEqual(buildInterview('consulting', 91))
    expect(buildInterview('consulting', 91)).not.toEqual(buildInterview('consulting', 92))
  })
})
