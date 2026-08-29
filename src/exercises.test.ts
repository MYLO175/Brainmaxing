import { describe, expect, it } from 'vitest'
import { balancedFamilyAt, exerciseFingerprint, generateExercise, generateVariedExercise, isCorrect, visualTokenAppearanceKey } from './exercises'
import { COGNITIVE_FAMILIES, LOGIC_FAMILIES, NUMBER_FAMILIES, type ExerciseFamily, type VisualToken } from './types'

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
          const presentations = exercise.options?.map((option) => JSON.stringify([option.label, option.visual, option.spatialVisual])) || []
          expect(new Set(presentations).size).toBe(presentations.length)
          expect(isCorrect(exercise, exercise.answer.value)).toBe(true)
        } else if (exercise.answer.kind === 'cell') {
          expect(exercise.visual?.kind).toBe('arrow-shift')
          expect(Number.isInteger(exercise.answer.value)).toBe(true)
          expect(exercise.answer.value).toBeGreaterThanOrEqual(0)
          expect(exercise.answer.value).toBeLessThan(25)
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
    'debug-scan': [], 'pattern-recall': [], 'tile-sequence': [], 'arrow-shift': [], 'reaction-match': [], 'arrow-focus': [], spatial: [], 'route-planner': [],
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

  it('treats visually symmetric rotations as the same answer presentation', () => {
    const shown = (shape: VisualToken['shape'], rotation: number) => visualTokenAppearanceKey({ shape, rotation, count: 1, filled: false })
    expect(shown('circle', 0)).toBe(shown('circle', 225))
    expect(shown('square', 0)).toBe(shown('square', 90))
    expect(shown('diamond', 45)).toBe(shown('diamond', 135))
    expect(shown('line', 0)).toBe(shown('line', 180))
    expect(shown('triangle', 0)).not.toBe(shown('triangle', 90))
    expect(shown('arrow', 0)).not.toBe(shown('arrow', 90))
  })

  it('gives every matrix question four visibly distinct answer choices', () => {
    for (let level = 1; level <= 10; level += 1) {
      for (let seed = 1; seed <= 1200; seed += 1) {
        const exercise = generateExercise('matrix', level, seed)
        const appearanceKeys = exercise.options?.map((option) => visualTokenAppearanceKey(option.visual!)) || []
        expect(appearanceKeys).toHaveLength(4)
        expect(new Set(appearanceKeys).size).toBe(4)
        const correct = exercise.options?.find((option) => option.id === exercise.answer.value)
        expect(correct?.visual).toBeDefined()
      }
    }
  })

  it('creates exactly one rule violation in every 3×3 Rule Breaker grid', () => {
    const violations = (variant: string, cells: VisualToken[], explanation: string) => cells.flatMap((cell, index) => {
      const row = Math.floor(index / 3); const column = index % 3
      let violates = false
      if (variant === 'fill-alternation' || variant === 'dual-attribute') violates = !!cell.filled !== ((row + column) % 2 === 0)
      else if (variant === 'rotation-grid') {
        const step = Number(explanation.match(/advance (\d+)°/)?.[1])
        violates = cell.rotation !== ((row + column) * step) % 360
      } else if (variant === 'count-cycle') violates = cell.count !== (row + column) % 3 + 1
      else if (variant === 'shape-cycle') violates = cell.shape !== ['circle', 'triangle', 'diamond'][(row + column) % 3]
      else if (variant === 'row-signature') violates = cell.shape !== ['circle', 'triangle', 'diamond'][row]
      else if (variant === 'column-signature') violates = cell.rotation !== column * 45
      else if (variant === 'triple-attribute') violates = cell.count !== (row * 2 + column) % 3 + 1
      else if (variant === 'diagonal-rule') violates = !!cell.filled !== (row === column)
      return violates ? [index] : []
    })

    for (let level = 1; level <= 10; level += 1) {
      for (let seed = 1; seed <= 1200; seed += 1) {
        const exercise = generateExercise('rule-breaker', level, seed)
        expect(exercise.visual?.kind).toBe('tiles')
        if (exercise.visual?.kind !== 'tiles') continue
        const answerIndex = Number(`${exercise.answer.value}`.slice(1))
        expect(violations(exercise.variant!, exercise.visual.cells, exercise.explanation)).toEqual([answerIndex])
      }
    }
  })

  it.each(['matrix', 'rule-breaker'] as const)('%s avoids recently seen visual grids', (family) => {
    const variants: string[] = []
    const recentQuestions: string[] = []
    for (let index = 0; index < 50; index += 1) {
      const exercise = generateVariedExercise(family, 9, 32000 + index * 7919, variants.slice(-4), recentQuestions.slice(-48))
      const fingerprint = exerciseFingerprint(exercise)
      expect(recentQuestions).not.toContain(fingerprint)
      variants.push(exercise.variant || '')
      recentQuestions.push(exercise.prompt, fingerprint)
      if (recentQuestions.length > 48) recentQuestions.splice(0, recentQuestions.length - 48)
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
    'data-sprint': ['bar-maximum', 'bar-difference', 'bar-total', 'bar-percentage-change', 'table-error-rate', 'table-success-volume', 'table-conditional-total', 'table-projection', 'table-budget-variance', 'table-conversion-yield', 'table-weighted-average', 'table-threshold-performance', 'table-compound-forecast', 'table-efficiency-index', 'table-weighted-cost'],
    'debug-scan': ['identifier-recall', 'field-recall', 'config-recall', 'incident-recall', 'mapping-recall', 'rule-audit'],
    'pattern-recall': ['sparse-scatter', 'short-chain', 'cluster', 'split-groups', 'edge-centre', 'broken-symmetry', 'dense-scatter', 'multi-cluster'],
    'tile-sequence': ['short-unique', 'corner-centre', 'wide-jumps', 'revisit', 'interleaved-return', 'large-grid-scan', 'target-filter', 'target-filter-return', 'target-filter-rapid'],
    'arrow-shift': ['cardinal-shift', 'mixed-angle-shift', 'dense-shift', 'colour-filter', 'colour-filter-multiple', 'colour-filter-rapid'],
    'reaction-match': ['cog-match', 'burst-match', 'orb-match', 'cog-rush', 'burst-rush', 'orb-rush'],
    'arrow-focus': ['aligned-above', 'aligned-below', 'middle-opposite-above', 'middle-opposite-below'],
    spatial: ['double-rotation', 'positioned-rotation', 'reflection', 'reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform', 'three-step-transform', 'angle-between', 'angle-composition', 'cube-net', 'opposite-face'],
    'route-planner': ['open-grid', 'light-obstacles', 'single-wall', 'checkpoint', 'ordered-checkpoints', 'choose-order', 'double-wall', 'weighted-route'],
  }

  it.each(COGNITIVE_FAMILIES)('%s exposes its complete cognitive task library', (family) => {
    const found = new Set<string>()
    for (const level of [2, 4, 5, 7, 8, 9, 10]) {
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
      'pattern-recall': ['sparse-scatter', 'short-chain'],
      'tile-sequence': ['short-unique', 'corner-centre'],
      'arrow-shift': ['cardinal-shift'],
      spatial: ['double-rotation', 'positioned-rotation', 'reflection', 'angle-between'],
      'route-planner': ['open-grid', 'light-obstacles'],
    }
    const expertOnly: Partial<Record<ExerciseFamily, string[]>> = {
      'data-sprint': ['table-weighted-cost', 'table-compound-forecast', 'table-efficiency-index', 'table-conversion-yield'],
      'debug-scan': ['incident-recall', 'mapping-recall', 'rule-audit'],
      'pattern-recall': ['dense-scatter', 'multi-cluster', 'broken-symmetry'],
      'tile-sequence': ['target-filter', 'target-filter-return', 'target-filter-rapid'],
      'arrow-shift': ['colour-filter-multiple', 'colour-filter-rapid'],
      spatial: ['reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform', 'three-step-transform', 'angle-composition', 'cube-net', 'opposite-face'],
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
    if (family === 'reaction-match' || family === 'arrow-focus') expect(averageTarget(9)).toBeLessThan(averageTarget(2))
    else expect(averageTarget(9)).toBeGreaterThan(averageTarget(2))
  })

  it('tightens the Reflex Match reveal and response windows as difficulty rises', () => {
    const foundation = generateExercise('reaction-match', 2, 41)
    const expert = generateExercise('reaction-match', 9, 41)
    expect(foundation.visual?.kind).toBe('reaction-match')
    expect(expert.visual?.kind).toBe('reaction-match')
    if (foundation.visual?.kind !== 'reaction-match' || expert.visual?.kind !== 'reaction-match') return
    expect(expert.visual.previewMs).toBeLessThan(foundation.visual.previewMs)
    expect(expert.visual.responseWindowMs).toBeLessThan(foundation.visual.responseWindowMs)
    expect(foundation.visual.leftColor).not.toBe(foundation.visual.rightColor)
    expect(['left', 'right']).toContain(expert.visual.targetSide)
  })

  it('uses only the fixed pink and blue Reflex Match colours while swapping their sides', () => {
    const rounds = Array.from({ length: 80 }, (_, seed) => generateExercise('reaction-match', 5, seed + 1))
    const allowed = new Set(['#ff2664', '#31b8e8'])
    const sidePairs = new Set<string>()
    for (const round of rounds) {
      expect(round.visual?.kind).toBe('reaction-match')
      if (round.visual?.kind !== 'reaction-match') continue
      expect(allowed.has(round.visual.leftColor)).toBe(true)
      expect(allowed.has(round.visual.rightColor)).toBe(true)
      expect(round.visual.leftColor).not.toBe(round.visual.rightColor)
      sidePairs.add(`${round.visual.leftColor}/${round.visual.rightColor}`)
    }
    expect(sidePairs.size).toBe(2)
  })

  it('limits Arrow Focus to aligned rows or a single opposite middle arrow', () => {
    const rounds = Array.from({ length: 500 }, (_, seed) => generateExercise('arrow-focus', 7, seed + 1))
    const positions = new Set<string>()
    const configurations = new Set<string>()
    for (const round of rounds) {
      expect(round.visual?.kind).toBe('arrow-focus')
      expect(round.answer.kind).toBe('choice')
      if (round.visual?.kind !== 'arrow-focus' || round.answer.kind !== 'choice') continue
      const { directions, position } = round.visual
      expect(directions).toHaveLength(5)
      expect(directions[2]).toBe(round.answer.value)
      const allAligned = directions.every((direction) => direction === directions[2])
      const onlyMiddleOpposite = directions.every((direction, index) => index === 2 || direction !== directions[2])
      expect(allAligned || onlyMiddleOpposite).toBe(true)
      positions.add(position)
      configurations.add(allAligned ? 'aligned' : 'middle-opposite')
    }
    expect(positions).toEqual(new Set(['above', 'below']))
    expect(configurations).toEqual(new Set(['aligned', 'middle-opposite']))
  })

  it('tightens the Arrow Focus response window as difficulty rises', () => {
    const foundation = generateExercise('arrow-focus', 2, 41)
    const expert = generateExercise('arrow-focus', 9, 41)
    expect(foundation.visual?.kind).toBe('arrow-focus')
    expect(expert.visual?.kind).toBe('arrow-focus')
    if (foundation.visual?.kind !== 'arrow-focus' || expert.visual?.kind !== 'arrow-focus') return
    expect(expert.visual.responseWindowMs).toBeLessThan(foundation.visual.responseWindowMs)
  })

  it('starts Spatial Lab with directed angles or off-centre transforms instead of single centred turns', () => {
    const foundation = Array.from({ length: 800 }, (_, seed) => generateExercise('spatial', 1, seed + 1))
    expect(new Set(foundation.map((exercise) => exercise.variant))).toEqual(new Set(['positioned-rotation', 'angle-between']))
    const transformQuestions = foundation.filter((exercise) => exercise.visual?.kind === 'tiles')
    expect(transformQuestions.length).toBeGreaterThan(200)
    expect(new Set(transformQuestions.flatMap((exercise) => exercise.visual?.kind === 'tiles' ? exercise.visual.cells.map((cell) => cell.shape) : []))).toEqual(new Set(['arrow', 'triangle']))
    expect(transformQuestions.every((exercise) => exercise.visual?.kind === 'tiles' && exercise.visual.cells.every((cell) => cell.position !== 'center'))).toBe(true)
    const angleQuestions = foundation.filter((exercise) => exercise.variant === 'angle-between')
    expect(angleQuestions.every((exercise) => exercise.visual?.kind === 'spatial-angle' && [135, 180, 225, 270].includes(Number(`${exercise.answer.value}`.replace('°', ''))))).toBe(true)
  })

  it('reflects arrows and triangles using their own base direction while moving only across the chosen axis', () => {
    const reflections = Array.from({ length: 5000 }, (_, seed) => generateExercise('spatial', 4, seed + 1))
      .filter((exercise) => exercise.variant === 'reflection' && exercise.visual?.kind === 'tiles')
    expect(reflections.length).toBeGreaterThan(500)
    expect(new Set(reflections.flatMap((exercise) => exercise.visual?.kind === 'tiles' ? exercise.visual.cells.map((cell) => cell.shape) : []))).toEqual(new Set(['arrow', 'triangle']))

    for (const exercise of reflections) {
      if (exercise.visual?.kind !== 'tiles' || exercise.answer.kind !== 'choice') continue
      const shown = exercise.visual.cells[0]
      const correct = exercise.options?.find((option) => option.id === exercise.answer.value)?.visual
      expect(correct).toBeDefined()
      if (!correct) continue
      const horizontal = exercise.prompt.includes('horizontal')
      const expectedPosition = horizontal
        ? shown.position === 'top' ? 'bottom' : shown.position === 'bottom' ? 'top' : shown.position
        : shown.position === 'left' ? 'right' : shown.position === 'right' ? 'left' : shown.position
      const rotation = shown.rotation || 0
      const expectedRotation = shown.shape === 'triangle'
        ? ((horizontal ? 180 - rotation : -rotation) + 360) % 360
        : ((horizontal ? -rotation : 180 - rotation) + 360) % 360
      expect(correct.position).toBe(expectedPosition)
      expect(correct.rotation).toBe(expectedRotation)
    }
  })

  it('offers the correct answer for a right-facing triangle reflected top-to-bottom then rotated clockwise', () => {
    const exercise = Array.from({ length: 10000 }, (_, seed) => generateExercise('spatial', 9, seed + 1))
      .find((candidate) => candidate.variant === 'reflect-then-rotate'
        && candidate.prompt.includes('horizontal centre line')
        && candidate.prompt.includes('90° clockwise')
        && candidate.visual?.kind === 'tiles'
        && candidate.visual.cells[0].shape === 'triangle'
        && candidate.visual.cells[0].rotation === 90
        && candidate.visual.cells[0].position === 'left')

    expect(exercise).toBeDefined()
    expect(exercise?.answer.kind).toBe('choice')
    if (!exercise || exercise.answer.kind !== 'choice') return
    const correct = exercise.options?.find((option) => option.id === exercise.answer.value)?.visual
    expect(correct).toMatchObject({ shape: 'triangle', position: 'top', rotation: 180 })
  })

  it('describes every Spatial Lab reflection by its centre line and positional effect', () => {
    const exercises = [4, 7, 9].flatMap((level) => Array.from({ length: 1800 }, (_, seed) => generateExercise('spatial', level, seed + 1)))
      .filter((exercise) => exercise.variant?.includes('reflect') || exercise.variant === 'reflection' || exercise.variant === 'three-step-transform')
    expect(exercises.length).toBeGreaterThan(500)
    expect(exercises.every((exercise) => !exercise.prompt.includes('Reflect horizontal') && !exercise.prompt.includes('Reflect vertical'))).toBe(true)
    for (const exercise of exercises) {
      if (exercise.prompt.includes('horizontal')) expect(`${exercise.prompt} ${exercise.explanation}`).toContain('top ↔ bottom')
      if (exercise.prompt.includes('vertical')) expect(`${exercise.prompt} ${exercise.explanation}`).toContain('left ↔ right')
    }
  })

  it('uses real net and face-folding question structures at upper Spatial Lab levels', () => {
    const expert = Array.from({ length: 1600 }, (_, seed) => generateExercise('spatial', 9, seed + 1))
    const variants = new Set(expert.map((exercise) => exercise.variant))
    expect(variants).toContain('cube-net')
    expect(variants).toContain('opposite-face')
    expect(variants).toContain('angle-composition')

    for (const exercise of expert.filter((item) => item.variant === 'cube-net')) {
      expect(exercise.visual?.kind).toBe('spatial-solid')
      expect(exercise.options).toHaveLength(4)
      expect(exercise.options?.every((option) => option.spatialVisual?.kind === 'cube-net' && option.spatialVisual.cells.length === 6)).toBe(true)
      for (const option of exercise.options || []) {
        const cells = option.spatialVisual?.cells || []
        expect(new Set(cells.map((cell) => `${cell.x},${cell.y}`)).size).toBe(6)
      }
    }

    for (const exercise of expert.filter((item) => item.variant === 'opposite-face')) {
      expect(exercise.visual?.kind).toBe('cube-net')
      if (exercise.visual?.kind !== 'cube-net') continue
      const labels = exercise.visual.cells.map((cell) => cell.label)
      expect(new Set(labels).size).toBe(6)
      expect(labels).toContain(exercise.answer.value)
    }
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

  it('gives Data Sprint materially distinct one-step, intermediate and multi-step level pools', () => {
    const variantsAt = (level: number) => new Set(Array.from({ length: 1000 }, (_, seed) => generateExercise('data-sprint', level, seed + 1).variant))
    expect(variantsAt(2)).toEqual(new Set(['bar-maximum', 'bar-difference', 'bar-total']))
    expect(variantsAt(5)).toEqual(new Set(['table-success-volume', 'table-conditional-total', 'table-projection']))
    expect(variantsAt(8)).toEqual(new Set(['table-threshold-performance', 'table-compound-forecast', 'table-efficiency-index']))
    const expert = variantsAt(10)
    expect([...expert].every((variant) => variant?.startsWith('table-'))).toBe(true)
    expect([...expert].some((variant) => variant === 'table-weighted-average')).toBe(true)
    expect([...expert].some((variant) => variant === 'table-threshold-performance')).toBe(true)
  })

  it('uses delayed recall or rule application for expert Debug Scan', () => {
    const exercises = Array.from({ length: 800 }, (_, seed) => generateExercise('debug-scan', 9, seed + 1))
    expect(exercises.every((exercise) => exercise.visual?.kind === 'reference' || exercise.visual?.kind === 'table')).toBe(true)
    expect(exercises.some((exercise) => exercise.visual?.kind === 'reference' && exercise.visual.lines.length === 4)).toBe(true)
    expect(exercises.some((exercise) => exercise.variant === 'rule-audit')).toBe(true)
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

  it('scales Arrow Shift density and exposure while keeping one valid target change', () => {
    const foundation = generateExercise('arrow-shift', 2, 41)
    const expert = generateExercise('arrow-shift', 9, 41)
    expect(foundation.visual?.kind).toBe('arrow-shift')
    expect(expert.visual?.kind).toBe('arrow-shift')
    expect(foundation.answer.kind).toBe('cell')
    expect(expert.answer.kind).toBe('cell')
    if (foundation.visual?.kind !== 'arrow-shift' || expert.visual?.kind !== 'arrow-shift' || foundation.answer.kind !== 'cell' || expert.answer.kind !== 'cell') return
    expect(foundation.visual.size).toBe(5)
    expect(expert.visual.size).toBe(5)
    expect(foundation.visual.before).toHaveLength(3)
    expect(foundation.visual.firstRevealMs).toBeGreaterThanOrEqual(1900)
    expect(foundation.visual.before.every((item) => [0, 90, 180, 270].includes(item.direction))).toBe(true)
    expect(expert.visual.before.length).toBeGreaterThan(foundation.visual.before.length + 8)
    expect(expert.visual.firstRevealMs).toBeLessThan(foundation.visual.firstRevealMs)
    expect(expert.visual.secondRevealMs).toBeLessThan(foundation.visual.secondRevealMs)
    expect(new Set(foundation.visual.before.map((item) => item.cue))).toEqual(new Set(['lime-circle']))
    expect(new Set(expert.visual.before.map((item) => item.cue))).toEqual(new Set(['lime-circle', 'violet-diamond']))
  })

  it('changes exactly one target-colour Arrow Shift arrow while expert distractors may also rotate', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const exercise = generateExercise('arrow-shift', 9, seed)
      expect(exercise.visual?.kind).toBe('arrow-shift')
      expect(exercise.answer.kind).toBe('cell')
      if (exercise.visual?.kind !== 'arrow-shift' || exercise.answer.kind !== 'cell') continue
      const visual = exercise.visual
      const beforeByCell = new Map(visual.before.map((item) => [item.cell, item]))
      const afterByCell = new Map(visual.after.map((item) => [item.cell, item]))
      expect(new Set(beforeByCell.keys())).toEqual(new Set(afterByCell.keys()))
      expect(visual.before.every((item) => afterByCell.get(item.cell)?.cue === item.cue)).toBe(true)
      const actualChanges = visual.before.filter((item) => afterByCell.get(item.cell)?.direction !== item.direction).map((item) => item.cell)
      expect(new Set(actualChanges)).toEqual(new Set(visual.changedCells))
      const targetChanges = actualChanges.filter((cell) => beforeByCell.get(cell)?.cue === visual.targetCue)
      const distractorChanges = actualChanges.filter((cell) => beforeByCell.get(cell)?.cue !== visual.targetCue)
      expect(targetChanges).toEqual([visual.targetCell])
      expect(distractorChanges).toHaveLength(2)
      expect(exercise.answer.value).toBe(visual.targetCell)
      expect(isCorrect(exercise, visual.targetCell)).toBe(true)
      expect(isCorrect(exercise, distractorChanges[0])).toBe(false)
    }
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

  it.each(NUMBER_FAMILIES)('%s never exposes floating-point artefacts in question copy', (family) => {
    for (let level = 1; level <= 10; level += 1) {
      for (let seed = 1; seed <= 500; seed += 1) {
        const exercise = generateExercise(family, level, seed)
        const visibleCopy = [
          exercise.prompt,
          exercise.instruction,
          exercise.explanation,
          ...(exercise.options?.map((option) => option.label) || []),
        ].filter(Boolean).join(' ')
        expect(visibleCopy).not.toMatch(/\d+\.\d{5,}/)
        expect(visibleCopy).not.toMatch(/\b(?:NaN|Infinity)\b/)
      }
    }
  })

  it('keeps core division meaningful and foundation arithmetic appropriate', () => {
    const foundation = Array.from({ length: 1000 }, (_, seed) => generateExercise('arithmetic', 2, seed + 1))
    expect(foundation.every((exercise) => exercise.variant === 'addition' || exercise.variant === 'subtraction')).toBe(true)

    const coreDivisions = [3, 4, 5].flatMap((level) => Array.from({ length: 1000 }, (_, seed) => generateExercise('arithmetic', level, seed + 1)))
      .filter((exercise) => exercise.variant === 'division')
    expect(coreDivisions.length).toBeGreaterThan(300)
    for (const exercise of coreDivisions) {
      const [dividend, divisor] = exercise.prompt.split(' ÷ ').map(Number)
      expect(dividend).toBeGreaterThanOrEqual(24)
      expect(divisor).toBeGreaterThanOrEqual(4)
      expect(exercise.answer.value).toBeGreaterThanOrEqual(6)
    }

    const foundationSubtractions = foundation.filter((exercise) => exercise.variant === 'subtraction')
    for (const exercise of foundationSubtractions) expect(exercise.answer.value).toBeGreaterThanOrEqual(10)
  })

  it('uses clean mental-maths answers for average questions', () => {
    const exercises = [3, 5, 7, 9].flatMap((level) => Array.from({ length: 2000 }, (_, seed) => generateExercise('averages', level, seed + 1)))
      .filter((exercise) => ['updated-mean', 'weighted-mean', 'combined-group-average'].includes(exercise.variant || ''))
    expect(exercises.length).toBeGreaterThan(1000)
    for (const exercise of exercises) {
      expect(exercise.answer.kind).toBe('number')
      if (exercise.answer.kind === 'number') {
        const decimals = Number.isInteger(exercise.answer.value) ? 0 : `${exercise.answer.value}`.split('.')[1]?.length || 0
        expect(decimals).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps mixed-number questions simplified and genuinely fractional', () => {
    const exercises = Array.from({ length: 4000 }, (_, seed) => generateExercise('fractions', 9, seed + 1))
      .filter((exercise) => exercise.variant === 'mixed-number-arithmetic')
    expect(exercises.length).toBeGreaterThan(300)
    for (const exercise of exercises) {
      const fractions = [...exercise.prompt.matchAll(/(\d+)\/(\d+)/g)]
      expect(fractions).toHaveLength(2)
      for (const match of fractions) {
        const numerator = Number(match[1]); const denominator = Number(match[2])
        expect(numerator).toBeLessThan(denominator)
        expect(Array.from({ length: Math.max(0, numerator - 1) }, (_, index) => index + 2).some((factor) => numerator % factor === 0 && denominator % factor === 0)).toBe(false)
      }
      expect(`${exercise.answer.value}`).not.toMatch(/\/1$/)
    }
  })

  it.each(NUMBER_FAMILIES)('%s avoids recent repeated calculations as well as repeated wording', (family) => {
    const variants: string[] = []
    const recentQuestions: string[] = []
    for (let index = 0; index < 40; index += 1) {
      const exercise = generateVariedExercise(family, 9, 24000 + index * 7919, variants.slice(-4), recentQuestions.slice(-48))
      expect(recentQuestions).not.toContain(exercise.prompt)
      expect(recentQuestions).not.toContain(exerciseFingerprint(exercise))
      variants.push(exercise.variant || '')
      recentQuestions.push(exercise.prompt, exerciseFingerprint(exercise))
      if (recentQuestions.length > 48) recentQuestions.splice(0, recentQuestions.length - 48)
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
