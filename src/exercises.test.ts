import { describe, expect, it } from 'vitest'
import { balancedFamilyAt, generateExercise, generateVariedExercise, isCorrect } from './exercises'
import { COGNITIVE_FAMILIES, LOGIC_FAMILIES, NUMBER_FAMILIES, type ExerciseFamily } from './types'

const families: ExerciseFamily[] = [...NUMBER_FAMILIES, ...LOGIC_FAMILIES, ...COGNITIVE_FAMILIES]

describe('exercise generators', () => {
  it.each(families)('%s creates deterministic, answerable exercises at every level', (family) => {
    for (let level = 1; level <= 10; level += 1) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const exercise = generateExercise(family, level, seed)
        expect(generateExercise(family, level, seed)).toEqual(exercise)
        expect(exercise.family).toBe(family)
        expect(exercise.difficulty).toBe(level)
        expect(exercise.prompt.length).toBeGreaterThan(0)
        expect(exercise.explanation.length).toBeGreaterThan(0)
        expect(exercise.responseTargetMs).toBeGreaterThan(0)
        if (exercise.answer.kind === 'number') {
          expect(Number.isFinite(exercise.answer.value)).toBe(true)
          expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
        } else if (exercise.answer.kind === 'choice') {
          const ids = exercise.options?.map((option) => option.id) || []
          expect(ids).toContain(exercise.answer.value)
          expect(new Set(ids).size).toBe(ids.length)
          const presentations = exercise.options?.map((option) => JSON.stringify([option.label, option.visual])) || []
          expect(new Set(presentations).size).toBe(presentations.length)
          expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
        } else if (exercise.answer.kind === 'cells') {
          expect(exercise.visual?.kind).toBe('memory')
          expect(exercise.answer.value.length).toBeGreaterThanOrEqual(3)
          expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
        } else {
          expect(exercise.visual?.kind).toBe('sequence')
          expect(exercise.answer.value.length).toBeGreaterThanOrEqual(3)
          expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
        }
      }
    }
  })

  it('clamps difficulty to the supported range', () => {
    expect(generateExercise('arithmetic', -10, 4).difficulty).toBe(1)
    expect(generateExercise('arithmetic', 99, 4).difficulty).toBe(10)
  })

  const numberVariants: Record<ExerciseFamily, string[]> = {
    arithmetic: ['addition', 'subtraction', 'multiplication', 'division', 'decimal-arithmetic', 'mixed-operations', 'bracketed-operations', 'missing-value'],
    percentages: ['amount', 'increase', 'decrease', 'change-rate', 'reverse-discount', 'reverse-markup', 'part-to-percent', 'successive-change', 'percentage-points', 'compound-reverse', 'profit-margin'],
    fractions: ['fraction-to-percent', 'decimal-to-percent', 'percent-to-fraction', 'fraction-of-quantity', 'compare-forms', 'compound-fraction', 'fraction-remaining', 'mixed-number-arithmetic', 'fraction-equation'],
    ratios: ['equivalent', 'share-total', 'scaling', 'direct-proportion', 'three-part-share', 'inverse-proportion', 'mixture', 'ratio-adjustment'],
    averages: ['mean', 'missing-value', 'updated-mean', 'weighted-mean', 'target-average', 'removed-value', 'combined-group-average'],
    rates: ['throughput', 'speed-distance', 'travel-time', 'unit-conversion-forward', 'unit-conversion-reverse', 'unit-price', 'scaled-rate', 'resource-chain', 'resource-chain-reverse', 'parallel-throughput', 'average-speed', 'downtime-throughput', 'capacity-planning', 'net-rate', 'converted-distance'],
    powers: ['square', 'cube', 'square-root', 'cube-root', 'powers-of-ten', 'remainder', 'divisibility', 'exponent-product', 'exponent-quotient', 'scientific-multiplication', 'combined-root-power', 'last-digit-power'],
    estimation: ['product', 'sum', 'difference', 'quotient', 'order-of-magnitude', 'percentage-estimate', 'multi-step-estimate', 'budget-estimate'],
    sequences: [], matrix: [], 'rule-breaker': [], constraints: [], 'data-sprint': [],
    'debug-scan': [], 'memory-grid': [], 'pattern-recall': [], 'tile-sequence': [], spatial: [], 'route-planner': [],
  }

  const logicVariants: Partial<Record<ExerciseFamily, string[]>> = {
    sequences: ['arithmetic', 'geometric', 'alternating-gaps', 'growing-gaps', 'square-offset', 'interleaved', 'multiply-add', 'alternating-operations', 'gap-cycle', 'recurrence', 'paired-products'],
    matrix: ['rotation-2x2', 'fill-2x2', 'count-cycle', 'shape-cycle', 'row-rotation', 'dual-axis', 'attribute-latin', 'row-composition', 'column-composition', 'combined-transform'],
    'rule-breaker': ['fill-alternation', 'rotation-grid', 'count-cycle', 'shape-cycle', 'row-signature', 'column-signature', 'dual-attribute', 'triple-attribute', 'diagonal-rule'],
    constraints: ['direct-chain', 'must-be-true', 'branch-order', 'fixed-slot', 'dependency-chain', 'assignment', 'conditional-chain', 'exclusive-branch'],
  }

  it.each(NUMBER_FAMILIES)('%s exposes every planned Fast Numbers+ variant', (family) => {
    const found = new Set<string>()
    for (const level of [2, 5, 6, 9]) {
      for (let seed = 1; seed <= 800; seed += 1) {
        const variant = generateExercise(family, level, seed).variant
        if (variant) found.add(variant)
      }
    }
    expect([...found].sort()).toEqual([...numberVariants[family]].sort())
  })

  it.each(LOGIC_FAMILIES)('%s exposes its full difficulty-banded rule library', (family) => {
    const found = new Set<string>()
    for (const level of [2, 5, 7, 9]) {
      for (let seed = 1; seed <= 1200; seed += 1) {
        const variant = generateExercise(family, level, seed).variant
        if (variant) found.add(variant)
      }
    }
    expect([...found].sort()).toEqual([...logicVariants[family]!].sort())
  })

  it.each(LOGIC_FAMILIES)('%s reserves multi-rule structures for upper levels', (family) => {
    const foundationOnly: Partial<Record<ExerciseFamily, string[]>> = {
      sequences: ['arithmetic', 'geometric'],
      matrix: ['rotation-2x2', 'fill-2x2'],
      'rule-breaker': ['fill-alternation', 'rotation-grid'],
      constraints: ['direct-chain', 'must-be-true'],
    }
    const expertOnly: Partial<Record<ExerciseFamily, string[]>> = {
      sequences: ['recurrence', 'paired-products'],
      matrix: ['attribute-latin', 'row-composition', 'column-composition', 'combined-transform'],
      'rule-breaker': ['dual-attribute', 'triple-attribute', 'diagonal-rule'],
      constraints: ['conditional-chain', 'exclusive-branch'],
    }
    const foundation = new Set(Array.from({ length: 1200 }, (_, seed) => generateExercise(family, 2, seed + 1).variant))
    const expert = new Set(Array.from({ length: 1200 }, (_, seed) => generateExercise(family, 9, seed + 1).variant))
    for (const variant of foundationOnly[family] || []) {
      expect(foundation).toContain(variant)
      expect(expert).not.toContain(variant)
    }
    for (const variant of expertOnly[family] || []) {
      expect(foundation).not.toContain(variant)
      expect(expert).toContain(variant)
    }
  })

  it.each(LOGIC_FAMILIES)('%s gives expert rules more reasoning time than foundation rules', (family) => {
    const averageTarget = (level: number) => Array.from({ length: 600 }, (_, seed) => generateExercise(family, level, seed + 1).responseTargetMs).reduce((sum, value) => sum + value, 0) / 600
    expect(averageTarget(9)).toBeGreaterThan(averageTarget(2))
  })

  it.each(LOGIC_FAMILIES)('%s avoids either of the two most recent rule structures', (family) => {
    const variants: string[] = []
    const prompts: string[] = []
    for (let index = 0; index < 45; index += 1) {
      const recentVariants = variants.slice(-4)
      const exercise = generateVariedExercise(family, 9, 12000 + index * 7919, recentVariants, prompts.slice(-12))
      expect(recentVariants.slice(-2)).not.toContain(exercise.variant)
      variants.push(exercise.variant || '')
      prompts.push(exercise.prompt)
    }
  })

  it('varies expert constraint scenarios and question forms substantially', () => {
    const exercises = Array.from({ length: 800 }, (_, seed) => generateExercise('constraints', 9, seed + 1))
    expect(new Set(exercises.map((exercise) => exercise.prompt)).size).toBeGreaterThan(180)
    expect(exercises.some((exercise) => exercise.variant === 'conditional-chain' && exercise.instruction?.includes('conclusion'))).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'exclusive-branch' && exercise.prompt.includes('Exactly one'))).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'assignment' && exercise.prompt.includes('exactly one area'))).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'fixed-slot' && exercise.prompt.includes('slot 3'))).toBe(true)
  })

  const cognitiveVariants: Partial<Record<ExerciseFamily, string[]>> = {
    'data-sprint': ['bar-maximum', 'bar-difference', 'bar-total', 'bar-percentage-change', 'table-error-rate', 'table-success-volume', 'table-conditional-total', 'table-projection', 'table-weighted-cost'],
    'debug-scan': ['identifier-recall', 'field-recall', 'config-recall', 'incident-recall', 'mapping-recall', 'rule-audit'],
    'memory-grid': ['membership', 'highlighted-cell', 'row-count', 'column-count', 'fullest-row', 'pair-recall', 'quadrant-count', 'missing-from-row'],
    'pattern-recall': ['sparse-scatter', 'short-chain', 'cluster', 'split-groups', 'edge-centre', 'broken-symmetry', 'dense-scatter', 'multi-cluster'],
    'tile-sequence': ['short-unique', 'corner-centre', 'wide-jumps', 'revisit', 'interleaved-return', 'large-grid-scan', 'target-filter', 'target-filter-return', 'target-filter-rapid'],
    spatial: ['rotation', 'double-rotation', 'positioned-rotation', 'reflection', 'reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform', 'three-step-transform'],
    'route-planner': ['open-grid', 'light-obstacles', 'single-wall', 'checkpoint', 'ordered-checkpoints', 'choose-order', 'double-wall', 'weighted-route'],
  }

  it.each(COGNITIVE_FAMILIES)('%s exposes its complete cognitive task library', (family) => {
    const found = new Set<string>()
    for (const level of [2, 5, 7, 9]) {
      for (let seed = 1; seed <= 1400; seed += 1) {
        const variant = generateExercise(family, level, seed).variant
        if (variant) found.add(variant)
      }
    }
    expect([...found].sort()).toEqual([...cognitiveVariants[family]!].sort())
  })

  it.each(COGNITIVE_FAMILIES)('%s replaces introductory mechanics with expert cognitive load', (family) => {
    const foundationOnly: Partial<Record<ExerciseFamily, string[]>> = {
      'data-sprint': ['bar-maximum', 'bar-difference', 'bar-total'],
      'debug-scan': ['identifier-recall', 'field-recall'],
      'memory-grid': ['membership', 'highlighted-cell'],
      'pattern-recall': ['sparse-scatter', 'short-chain'],
      'tile-sequence': ['short-unique', 'corner-centre'],
      spatial: ['rotation', 'double-rotation'],
      'route-planner': ['open-grid', 'light-obstacles'],
    }
    const expertOnly: Partial<Record<ExerciseFamily, string[]>> = {
      'data-sprint': ['table-success-volume', 'table-conditional-total', 'table-projection', 'table-weighted-cost'],
      'debug-scan': ['incident-recall', 'mapping-recall', 'rule-audit'],
      'memory-grid': ['fullest-row', 'pair-recall', 'quadrant-count', 'missing-from-row'],
      'pattern-recall': ['dense-scatter', 'multi-cluster', 'broken-symmetry'],
      'tile-sequence': ['target-filter', 'target-filter-return', 'target-filter-rapid'],
      spatial: ['reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform', 'three-step-transform'],
      'route-planner': ['double-wall', 'ordered-checkpoints', 'choose-order', 'weighted-route'],
    }
    const foundation = new Set(Array.from({ length: 1200 }, (_, seed) => generateExercise(family, 2, seed + 1).variant))
    const expert = new Set(Array.from({ length: 1200 }, (_, seed) => generateExercise(family, 9, seed + 1).variant))
    for (const variant of foundationOnly[family] || []) expect(expert).not.toContain(variant)
    for (const variant of expertOnly[family] || []) {
      expect(foundation).not.toContain(variant)
      expect(expert).toContain(variant)
    }
  })

  it.each(COGNITIVE_FAMILIES)('%s gives expert tasks more calibrated working time', (family) => {
    const averageTarget = (level: number) => Array.from({ length: 700 }, (_, seed) => generateExercise(family, level, seed + 1).responseTargetMs).reduce((sum, value) => sum + value, 0) / 700
    expect(averageTarget(9)).toBeGreaterThan(averageTarget(2))
  })

  it.each(COGNITIVE_FAMILIES)('%s avoids either of the two most recent expert mechanics', (family) => {
    const variants: string[] = []
    const prompts: string[] = []
    for (let index = 0; index < 45; index += 1) {
      const recent = variants.slice(-4)
      const exercise = generateVariedExercise(family, 9, 18000 + index * 7919, recent, prompts.slice(-12))
      expect(recent.slice(-2)).not.toContain(exercise.variant)
      variants.push(exercise.variant || '')
      prompts.push(exercise.prompt)
    }
  })

  it('makes expert Data Sprint questions derived table problems rather than answer lookups', () => {
    const exercises = Array.from({ length: 1000 }, (_, seed) => generateExercise('data-sprint', 9, seed + 1))
    expect(exercises.every((exercise) => exercise.visual?.kind === 'table')).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'table-weighted-cost')).toBe(true)
    for (const exercise of exercises) {
      if (exercise.visual?.kind !== 'table') continue
      expect(exercise.visual.columns).not.toContain('Projected')
      expect(exercise.visual.columns).not.toContain('Net cost')
      expect(exercise.visual.columns).not.toContain('Successful')
    }
  })

  it('uses delayed recall or rule application for expert Debug Scan', () => {
    const exercises = Array.from({ length: 800 }, (_, seed) => generateExercise('debug-scan', 9, seed + 1))
    expect(exercises.every((exercise) => exercise.visual?.kind === 'reference' || exercise.visual?.kind === 'table')).toBe(true)
    expect(exercises.some((exercise) => exercise.visual?.kind === 'reference' && exercise.visual.lines.length === 4)).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'rule-audit')).toBe(true)
  })

  it('scales Memory Grid capacity and reveal time materially', () => {
    const foundation = generateExercise('memory-grid', 2, 41)
    const expert = generateExercise('memory-grid', 9, 41)
    expect(foundation.visual?.kind).toBe('memory')
    expect(expert.visual?.kind).toBe('memory')
    if (foundation.visual?.kind !== 'memory' || expert.visual?.kind !== 'memory') return
    expect(expert.visual.size).toBeGreaterThan(foundation.visual.size)
    expect(expert.visual.revealMs).toBeLessThan(foundation.visual.revealMs)
  })

  it('scales Pattern Recall from 4×4 to 5×5 with shorter flashes and denser targets', () => {
    const foundation = generateExercise('pattern-recall', 2, 41)
    const firstFiveByFive = generateExercise('pattern-recall', 4, 41)
    const expert = generateExercise('pattern-recall', 9, 41)
    expect(foundation.visual?.kind).toBe('memory')
    expect(firstFiveByFive.visual?.kind).toBe('memory')
    expect(expert.visual?.kind).toBe('memory')
    expect(foundation.answer.kind).toBe('cells')
    expect(expert.answer.kind).toBe('cells')
    if (foundation.visual?.kind !== 'memory' || firstFiveByFive.visual?.kind !== 'memory' || expert.visual?.kind !== 'memory' || foundation.answer.kind !== 'cells' || expert.answer.kind !== 'cells') return
    expect(foundation.visual.size).toBe(4)
    expect(firstFiveByFive.visual.size).toBe(5)
    expect(expert.visual.size).toBe(5)
    expect(expert.visual.revealMs).toBeLessThan(foundation.visual.revealMs)
    expect(expert.answer.value.length).toBeGreaterThan(foundation.answer.value.length + 5)
  })

  it('scores Pattern Recall as an exact unordered tile set', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const exercise = generateExercise('pattern-recall', 9, seed)
      expect(exercise.visual?.kind).toBe('memory')
      expect(exercise.answer.kind).toBe('cells')
      if (exercise.visual?.kind !== 'memory' || exercise.answer.kind !== 'cells') continue
      const cells = exercise.answer.value
      expect(exercise.visual.cells).toEqual(cells)
      expect(new Set(cells).size).toBe(cells.length)
      expect(cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 25)).toBe(true)
      expect(isCorrect(exercise, [...cells].reverse())).toBe(true)
      expect(isCorrect(exercise, cells.slice(1))).toBe(false)
      const extra = Array.from({ length: 25 }, (_, index) => index).find((cell) => !cells.includes(cell))!
      expect(isCorrect(exercise, [...cells, extra])).toBe(false)
    }
  })

  it('scales Sequence Flash length and playback speed while keeping every path valid', () => {
    const foundation = Array.from({ length: 500 }, (_, seed) => generateExercise('tile-sequence', 2, seed + 1))
    const expert = Array.from({ length: 500 }, (_, seed) => generateExercise('tile-sequence', 9, seed + 1))
    const averageLength = (items: typeof foundation) => items.reduce((sum, exercise) => sum + (exercise.answer.kind === 'sequence' ? exercise.answer.value.length : 0), 0) / items.length
    expect(averageLength(expert)).toBeGreaterThan(averageLength(foundation) + 5)
    for (const exercise of [...foundation, ...expert]) {
      expect(exercise.visual?.kind).toBe('sequence')
      expect(exercise.answer.kind).toBe('sequence')
      if (exercise.visual?.kind !== 'sequence' || exercise.answer.kind !== 'sequence') continue
      const visual = exercise.visual
      expect(visual.cues).toHaveLength(visual.path.length)
      expect(visual.path.filter((_, index) => visual.cues[index] === visual.targetCue)).toEqual(exercise.answer.value)
      expect(visual.path.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < visual.size * visual.size)).toBe(true)
      expect(visual.path.every((cell, index, path) => index === 0 || cell !== path[index - 1])).toBe(true)
    }
    if (foundation[0].visual?.kind !== 'sequence' || expert[0].visual?.kind !== 'sequence') return
    expect(expert[0].visual.flashMs).toBeLessThan(foundation[0].visual.flashMs)
    expect(expert[0].visual.gapMs).toBeLessThan(foundation[0].visual.gapMs)
  })

  it('moves upper Sequence Flash levels to 5×5 and adds a two-stream selective-recall rule', () => {
    const standard = generateExercise('tile-sequence', 6, 19)
    const large = generateExercise('tile-sequence', 7, 19)
    expect(standard.visual?.kind === 'sequence' && standard.visual.size).toBe(3)
    expect(large.visual?.kind === 'sequence' && large.visual.size).toBe(5)

    const expert = Array.from({ length: 300 }, (_, seed) => generateExercise('tile-sequence', 9, seed + 1))
    const targetCues = new Set<string>()
    for (const exercise of expert) {
      expect(exercise.visual?.kind).toBe('sequence')
      expect(exercise.answer.kind).toBe('sequence')
      if (exercise.visual?.kind !== 'sequence' || exercise.answer.kind !== 'sequence') continue
      const visual = exercise.visual
      expect(visual.size).toBe(5)
      expect(new Set(visual.cues)).toEqual(new Set(['lime-circle', 'violet-diamond']))
      expect(visual.path).toHaveLength(13)
      expect(exercise.answer.value).toHaveLength(10)
      expect(visual.path.filter((_, index) => visual.cues[index] === visual.targetCue)).toEqual(exercise.answer.value)
      targetCues.add(visual.targetCue)
    }
    expect(targetCues).toEqual(new Set(['lime-circle', 'violet-diamond']))
  })

  it('requires the exact Sequence Flash order, including delayed revisits', () => {
    const exercise = generateExercise('tile-sequence', 9, 47)
    expect(exercise.answer.kind).toBe('sequence')
    if (exercise.answer.kind !== 'sequence') return
    const changed = [...exercise.answer.value]
    changed[0] = (changed[0] + 1) % 25
    expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
    expect(isCorrect(exercise, changed)).toBe(false)
    expect(isCorrect(exercise, exercise.answer.value.slice(0, -1))).toBe(false)
  })

  it('produces varied route answers and genuinely constrained expert routes', () => {
    const exercises = Array.from({ length: 1200 }, (_, seed) => generateExercise('route-planner', 9, seed + 1))
    const answers = exercises.map((exercise) => Number(exercise.answer.value))
    expect(new Set(answers).size).toBeGreaterThan(8)
    expect(answers.some((answer) => answer !== 8)).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'double-wall' && exercise.visual?.kind === 'route' && exercise.visual.blocked.length >= 8)).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'choose-order' && exercise.visual?.kind === 'route' && exercise.visual.checkpoints?.length === 2)).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'weighted-route' && exercise.visual?.kind === 'route' && exercise.visual.costs?.length)).toBe(true)
  })

  it.each(NUMBER_FAMILIES)('%s keeps numeric answers precise and number choices unambiguous', (family) => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const exercise = generateExercise(family, 9, seed)
      if (exercise.answer.kind === 'number') {
        const decimals = Number.isInteger(exercise.answer.value) ? 0 : `${exercise.answer.value}`.split('.')[1]?.length || 0
        expect(exercise.answer.value).toBeGreaterThanOrEqual(0)
        expect(decimals).toBeLessThanOrEqual(3)
      } else {
        expect(exercise.options).toHaveLength(4)
      }
    }
  })

  it('balances mixed drills without repeating a family inside a cycle', () => {
    const firstCycle = NUMBER_FAMILIES.map((_, index) => balancedFamilyAt(NUMBER_FAMILIES, index, 1234))
    const secondCycle = NUMBER_FAMILIES.map((_, index) => balancedFamilyAt(NUMBER_FAMILIES, NUMBER_FAMILIES.length + index, 1234))
    expect(new Set(firstCycle)).toEqual(new Set(NUMBER_FAMILIES))
    expect(new Set(secondCycle)).toEqual(new Set(NUMBER_FAMILIES))
    expect(firstCycle).not.toEqual(secondCycle)
    expect(NUMBER_FAMILIES.map((_, index) => balancedFamilyAt(NUMBER_FAMILIES, index, 1234))).toEqual(firstCycle)
  })

  it('avoids recent rate templates and prompts deterministically', () => {
    const buildSequence = () => {
      const variants: string[] = []
      const prompts: string[] = []
      const sequence = []
      for (let index = 0; index < 40; index += 1) {
        const recentPrompts = prompts.slice(-12)
        const exercise = generateVariedExercise('rates', 9, 9000 + index * 7919, variants.slice(-4), recentPrompts)
        expect(recentPrompts).not.toContain(exercise.prompt)
        if (variants.length) expect(exercise.variant).not.toBe(variants[variants.length - 1])
        variants.push(exercise.variant || '')
        prompts.push(exercise.prompt)
        sequence.push(exercise)
      }
      return sequence
    }

    expect(buildSequence()).toEqual(buildSequence())
  })

  it('includes chained-resource stories and stated-factor conversions', () => {
    const exercises = Array.from({ length: 2000 }, (_, index) => generateExercise('rates', 9, index + 1))
    expect(exercises.some((exercise) => exercise.prompt.includes('dogs per person') && exercise.prompt.includes('bones per dog'))).toBe(true)
    expect(exercises.some((exercise) => exercise.prompt.includes('1 mile = 1.6 km') && exercise.instruction?.includes('miles'))).toBe(true)
  })

  it.each(NUMBER_FAMILIES)('%s replaces foundation structures with advanced structures at expert levels', (family) => {
    const foundationOnly: Partial<Record<ExerciseFamily, string[]>> = {
      arithmetic: ['addition', 'subtraction'],
      percentages: ['amount', 'increase', 'decrease'],
      fractions: ['fraction-to-percent', 'decimal-to-percent'],
      ratios: ['equivalent', 'share-total'],
      averages: ['mean', 'missing-value'],
      rates: ['throughput', 'unit-conversion-forward', 'unit-price'],
      powers: ['square', 'square-root'],
      estimation: ['product', 'sum', 'difference'],
    }
    const advancedOnly: Partial<Record<ExerciseFamily, string[]>> = {
      arithmetic: ['mixed-operations', 'bracketed-operations'],
      percentages: ['successive-change', 'compound-reverse', 'profit-margin'],
      fractions: ['compound-fraction', 'fraction-remaining', 'mixed-number-arithmetic'],
      ratios: ['inverse-proportion', 'mixture', 'ratio-adjustment'],
      averages: ['target-average', 'removed-value', 'combined-group-average'],
      rates: ['average-speed', 'downtime-throughput', 'capacity-planning', 'net-rate'],
      powers: ['exponent-product', 'exponent-quotient', 'scientific-multiplication', 'combined-root-power'],
      estimation: ['percentage-estimate', 'multi-step-estimate', 'budget-estimate'],
    }
    const foundation = new Set(Array.from({ length: 1000 }, (_, seed) => generateExercise(family, 2, seed + 1).variant))
    const expert = new Set(Array.from({ length: 1000 }, (_, seed) => generateExercise(family, 9, seed + 1).variant))
    for (const variant of foundationOnly[family] || []) {
      expect(foundation).toContain(variant)
      expect(expert).not.toContain(variant)
    }
    for (const variant of advancedOnly[family] || []) {
      expect(foundation).not.toContain(variant)
      expect(expert).toContain(variant)
    }
  })

  it.each(NUMBER_FAMILIES)('%s gives advanced questions more working time than foundation questions', (family) => {
    const averageTarget = (level: number) => Array.from({ length: 500 }, (_, seed) => generateExercise(family, level, seed + 1).responseTargetMs).reduce((sum, value) => sum + value, 0) / 500
    expect(averageTarget(9)).toBeGreaterThan(averageTarget(2))
  })

  it.each(NUMBER_FAMILIES)('%s does not fall back to one-step foundation structures at level 7', (family) => {
    const excludedAtUpperLevel: Partial<Record<ExerciseFamily, string[]>> = {
      arithmetic: ['addition', 'subtraction'],
      percentages: ['amount', 'increase', 'decrease', 'percentage-points'],
      fractions: ['fraction-to-percent', 'decimal-to-percent', 'percent-to-fraction', 'fraction-of-quantity'],
      ratios: ['equivalent', 'share-total', 'scaling'],
      averages: ['mean', 'missing-value', 'updated-mean'],
      rates: ['throughput', 'speed-distance', 'travel-time', 'unit-conversion-forward', 'unit-price'],
      powers: ['square', 'cube', 'square-root', 'cube-root', 'remainder'],
      estimation: ['product', 'sum', 'difference', 'quotient'],
    }
    const upperVariants = new Set(Array.from({ length: 1500 }, (_, seed) => generateExercise(family, 7, seed + 1).variant))
    for (const variant of excludedAtUpperLevel[family] || []) expect(upperVariants).not.toContain(variant)
  })

  it('makes upper-level reverse percentages multi-step', () => {
    const reverseQuestions = Array.from({ length: 2000 }, (_, seed) => generateExercise('percentages', 7, seed + 1)).filter((exercise) => exercise.variant === 'reverse-discount' || exercise.variant === 'reverse-markup')
    expect(reverseQuestions.length).toBeGreaterThan(100)
    expect(reverseQuestions.every((exercise) => exercise.prompt.includes('fee'))).toBe(true)
  })
})
