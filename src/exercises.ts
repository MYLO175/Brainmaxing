import type { AnswerValue, Exercise, ExerciseFamily, ExerciseOption, VisualToken } from './types'

export type RandomSource = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(items: T[]) => T
  shuffle: <T>(items: T[]) => T[]
}

export function createRng(seed: number): RandomSource {
  let state = seed >>> 0 || 1
  const next = () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
    shuffle: <T>(items: T[]) => {
      const shuffled = [...items]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1))
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
      }
      return shuffled
    },
  }
}

function id(family: ExerciseFamily, seed: number) {
  return `${family}-${seed}`
}

function uniqueNumberOptions(rng: RandomSource, answer: number, spread: number, format = (value: number) => `${value}`): ExerciseOption[] {
  const values = new Set<number>([answer])
  let attempts = 0
  while (values.size < 4 && attempts < 30) {
    attempts += 1
    const candidate = answer + rng.pick([-2, -1, 1, 2]) * spread * rng.int(1, 2)
    if (candidate >= 0) values.add(Number(candidate.toFixed(2)))
  }
  while (values.size < 4) values.add(Number((answer + values.size * Math.max(spread, 1)).toFixed(2)))
  return rng.shuffle([...values]).map((value) => ({ id: `${value}`, label: format(value) }))
}

function plausibleNumberOptions(rng: RandomSource, answer: number, candidates: number[]): ExerciseOption[] {
  const values = new Set<number>([answer])
  candidates.forEach((candidate) => {
    if (Number.isFinite(candidate) && candidate >= 0) values.add(Math.round(candidate))
  })
  const spread = Math.max(1, Math.round(Math.abs(answer) * .08))
  let offset = 1
  while (values.size < 4) {
    const direction = offset % 2 ? 1 : -1
    const candidate = answer + direction * Math.ceil(offset / 2) * spread
    if (candidate >= 0) values.add(candidate)
    offset += 1
  }
  return rng.shuffle([...values].slice(0, 4)).map((value) => ({ id: `${value}`, label: `${value}` }))
}

function choiceOptions(rng: RandomSource, answer: string, distractors: string[]): ExerciseOption[] {
  const values = [...new Set([answer, ...distractors])].slice(0, 4)
  return rng.shuffle(values).map((value) => ({ id: value, label: value }))
}

function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a)
}

function fractionLabel(numerator: number, denominator: number) {
  const divisor = gcd(numerator, denominator)
  return `${numerator / divisor}/${denominator / divisor}`
}

function levelBand(level: number) {
  if (level <= 2) return 0
  if (level <= 5) return 1
  if (level <= 8) return 2
  return 3
}

function arithmetic(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['addition', 'subtraction']
    : band === 1
      ? ['addition', 'subtraction', 'multiplication', 'division', 'decimal-arithmetic']
      : band === 2
        ? level >= 7
          ? ['multiplication', 'division', 'decimal-arithmetic', 'mixed-operations', 'bracketed-operations', 'missing-value']
          : ['addition', 'subtraction', 'multiplication', 'division', 'decimal-arithmetic', 'mixed-operations', 'bracketed-operations']
        : ['multiplication', 'division', 'decimal-arithmetic', 'mixed-operations', 'bracketed-operations', 'missing-value']
  const variant = rng.pick(available)

  if (variant === 'addition' || variant === 'subtraction') {
    let a = rng.int(band === 0 ? 8 : 40, 30 + level * (band === 0 ? 12 : 45))
    let b = rng.int(3, 15 + level * 16)
    if (variant === 'subtraction' && b > a) [a, b] = [b, a]
    const answer = variant === 'addition' ? a + b : a - b
    const operator = variant === 'addition' ? '+' : '−'
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Arithmetic', prompt: `${a} ${operator} ${b}`, difficulty: level, responseTargetMs: band === 0 ? 4200 : 5200, answer: { kind: 'number', value: answer }, explanation: `${a} ${operator} ${b} = ${answer}.` }
  }
  if (variant === 'multiplication') {
    const a = rng.int(band < 2 ? 3 : 12, band < 2 ? 12 + level : 25 + level * 4)
    const b = rng.int(3, band < 2 ? 12 + level : 14 + level * 2)
    const answer = a * b
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Multiplication', prompt: `${a} × ${b}`, difficulty: level, responseTargetMs: band < 2 ? 4800 : 6500, answer: { kind: 'number', value: answer }, explanation: `${a} × ${b} = ${answer}.` }
  }
  if (variant === 'division') {
    const divisor = rng.int(band < 2 ? 2 : 6, band < 2 ? 12 : 24)
    const answer = rng.int(band < 2 ? 3 : 12, band < 2 ? 12 + level : 30 + level * 6)
    const dividend = divisor * answer
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Division', prompt: `${dividend} ÷ ${divisor}`, difficulty: level, responseTargetMs: band < 2 ? 5000 : 6800, answer: { kind: 'number', value: answer }, explanation: `${divisor} × ${answer} = ${dividend}, so ${dividend} ÷ ${divisor} = ${answer}.` }
  }
  if (variant === 'decimal-arithmetic') {
    const operation = band >= 2 ? rng.pick(['+', '−', '×']) : rng.pick(['+', '−'])
    let a = band >= 3 ? rng.int(350, 2400) / 100 : rng.int(15, 80 + level * 10) / 10
    let b = band >= 3 ? (operation === '×' ? rng.int(2, 15) : rng.int(125, 950) / 100) : rng.int(5, 45 + level * 5) / 10
    if (operation === '−' && b > a) [a, b] = [b, a]
    let answer = operation === '+' ? a + b : operation === '−' ? a - b : a * b
    answer = rounded(answer, 3)
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Decimal arithmetic', prompt: `${a} ${operation} ${b}`, difficulty: level, responseTargetMs: band >= 3 ? 8000 : 6500, answer: { kind: 'number', value: answer }, explanation: `${a} ${operation} ${b} = ${answer}.` }
  }
  if (variant === 'mixed-operations') {
    const a = rng.int(8, 30 + level * 3); const b = rng.int(3, 10 + level); const c = rng.int(2, 9)
    const subtract = rng.next() < .5
    const answer = subtract ? a * b - c : a + b * c
    const prompt = subtract ? `${a} × ${b} − ${c}` : `${a} + ${b} × ${c}`
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Order of operations', prompt, instruction: 'Use the usual order of operations.', difficulty: level, responseTargetMs: band >= 3 ? 7600 : 7000, answer: { kind: 'number', value: answer }, explanation: subtract ? `Multiply first: ${a} × ${b} = ${a * b}; then subtract ${c} to get ${answer}.` : `Multiply first: ${b} × ${c} = ${b * c}; then add ${a} to get ${answer}.` }
  }
  if (variant === 'missing-value') {
    const multiplier = rng.int(4, 16); const answer = rng.int(8, 45); const offset = rng.int(12, 80); const total = multiplier * answer + offset
    return { id: id('arithmetic', seed), family: 'arithmetic', variant, label: 'Missing value', prompt: `${multiplier} × ? + ${offset} = ${total}`, instruction: 'Find the missing value.', difficulty: level, responseTargetMs: 9000, answer: { kind: 'number', value: answer }, explanation: `Undo the addition, then the multiplication: (${total} − ${offset}) ÷ ${multiplier} = ${answer}.` }
  }
  let a = rng.int(8, 20 + level * 2); let b = rng.int(3, 12); const c = rng.int(2, 8)
  const add = rng.next() < .5
  if (!add && b > a) [a, b] = [b, a]
  const inside = add ? a + b : a - b
  const answer = inside * c
  return { id: id('arithmetic', seed), family: 'arithmetic', variant: 'bracketed-operations', label: 'Bracketed arithmetic', prompt: `(${a} ${add ? '+' : '−'} ${b}) × ${c}`, difficulty: level, responseTargetMs: band >= 3 ? 7800 : 7200, answer: { kind: 'number', value: answer }, explanation: `Work inside the brackets first: ${a} ${add ? '+' : '−'} ${b} = ${inside}; then ${inside} × ${c} = ${answer}.` }
}

function percentages(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const percent = rng.pick(band === 0 ? [5, 10, 20, 25, 50] : band === 1 ? [5, 10, 12, 15, 20, 25, 30, 35, 40, 50, 75] : [6, 7.5, 12.5, 16, 18, 22.5, 32, 35, 45, 62.5])
  const base = rng.pick(band < 2 ? [40, 60, 80, 100, 120, 160, 200, 240, 300, 400] : [72, 96, 125, 144, 180, 225, 240, 320, 480, 640])
  const available = band === 0
    ? ['amount', 'increase', 'decrease']
    : band === 1
      ? ['amount', 'increase', 'decrease', 'change-rate', 'reverse-discount']
      : band === 2
        ? level >= 7
          ? ['change-rate', 'reverse-discount', 'reverse-markup', 'part-to-percent', 'successive-change', 'compound-reverse']
          : ['amount', 'change-rate', 'reverse-discount', 'reverse-markup', 'part-to-percent', 'successive-change', 'percentage-points']
        : ['change-rate', 'reverse-discount', 'reverse-markup', 'part-to-percent', 'successive-change', 'compound-reverse', 'profit-margin']
  const variant = rng.pick(available)
  const amount = rounded(percent * base / 100)

  if (variant === 'amount') {
    const context = rng.pick([
      { prompt: `${percent}% of ${base}`, instruction: undefined },
      { prompt: `${base} jobs; ${percent}% fail`, instruction: 'How many jobs fail?' },
      { prompt: `£${base} budget; ${percent}% for tools`, instruction: 'How much is allocated to tools?' },
    ])
    return { id: id('percentages', seed), family: 'percentages', variant: 'amount', label: 'Percentage amount', prompt: context.prompt, instruction: context.instruction, difficulty: level, responseTargetMs: 5200, answer: { kind: 'number', value: amount }, explanation: `${percent} ÷ 100 × ${base} = ${amount}.` }
  }
  if (variant === 'increase') {
    const answer = rounded(base + amount)
    const prompt = rng.pick([`Increase ${base} by ${percent}%`, `${base} daily users grow by ${percent}%`, `£${base} rises by ${percent}%`])
    return { id: id('percentages', seed), family: 'percentages', variant: 'increase', label: 'Percentage increase', prompt, instruction: prompt.startsWith('Increase') ? undefined : 'What is the new total?', difficulty: level, responseTargetMs: 6500, answer: { kind: 'number', value: answer }, explanation: `${percent}% of ${base} is ${amount}; ${base} + ${amount} = ${answer}.` }
  }
  if (variant === 'decrease') {
    const answer = rounded(base - amount)
    const prompt = rng.pick([`Reduce ${base} by ${percent}%`, `£${base} with a ${percent}% discount`, `${base} alerts reduced by ${percent}%`])
    return { id: id('percentages', seed), family: 'percentages', variant: 'decrease', label: 'Discount & decrease', prompt, instruction: prompt.startsWith('Reduce') ? undefined : 'What is the new value?', difficulty: level, responseTargetMs: 6500, answer: { kind: 'number', value: answer }, explanation: `${percent}% of ${base} is ${amount}; ${base} − ${amount} = ${answer}.` }
  }
  if (variant === 'change-rate') {
    const increase = rng.next() < .5
    const final = rounded(base * (1 + (increase ? percent : -percent) / 100))
    return { id: id('percentages', seed), family: 'percentages', variant: 'change-rate', label: 'Percentage change', prompt: `${base} → ${final}`, instruction: `What is the percentage ${increase ? 'increase' : 'decrease'}?`, difficulty: level, responseTargetMs: 7500, answer: { kind: 'number', value: percent }, explanation: `The change is ${rounded(Math.abs(final - base))}. ${rounded(Math.abs(final - base))} ÷ ${base} × 100 = ${percent}%.` }
  }
  if (variant === 'reverse-discount') {
    if (level >= 7) {
      const fee = rng.pick([3, 5, 8, 12]); const discounted = rounded(base * (1 - percent / 100)); const final = rounded(discounted + fee)
      return { id: id('percentages', seed), family: 'percentages', variant: 'reverse-discount', label: 'Reverse discount', prompt: `Checkout total £${final} after ${percent}% off, including a £${fee} delivery fee.`, instruction: 'What was the price before the discount and delivery fee?', difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: base }, explanation: `Remove the fee first: £${final} − £${fee} = £${discounted}. Then ${100 - percent}% remains, so ${discounted} ÷ ${(100 - percent) / 100} = ${base}.` }
    }
    const final = rounded(base * (1 - percent / 100))
    const prompt = rng.pick([`${final} after a ${percent}% discount`, `Sale price £${final} after ${percent}% off`, `${final} alerts remain after a ${percent}% reduction`])
    return { id: id('percentages', seed), family: 'percentages', variant: 'reverse-discount', label: 'Reverse discount', prompt, instruction: 'What was the original value?', difficulty: level, responseTargetMs: 8500, answer: { kind: 'number', value: base }, explanation: `${100 - percent}% remains, so ${final} ÷ ${(100 - percent) / 100} = ${base}.` }
  }
  if (variant === 'reverse-markup') {
    if (level >= 7) {
      const fee = rng.pick([4, 6, 10, 15]); const markedUp = rounded(base * (1 + percent / 100)); const final = rounded(markedUp + fee)
      return { id: id('percentages', seed), family: 'percentages', variant, label: 'Reverse mark-up', prompt: `Final invoice £${final} after a ${percent}% mark-up and a £${fee} fixed fee.`, instruction: 'What value was marked up?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: base }, explanation: `Remove the fixed fee: £${final} − £${fee} = £${markedUp}. Then divide by ${(100 + percent) / 100}: ${markedUp} ÷ ${(100 + percent) / 100} = ${base}.` }
    }
    const final = rounded(base * (1 + percent / 100))
    const prompt = rng.pick([`${final} after a ${percent}% mark-up`, `£${final} after a ${percent}% price rise`, `${final} users after ${percent}% growth`])
    return { id: id('percentages', seed), family: 'percentages', variant, label: 'Reverse mark-up', prompt, instruction: 'What was the original value?', difficulty: level, responseTargetMs: 9000, answer: { kind: 'number', value: base }, explanation: `${100 + percent}% of the original is ${final}, so ${final} ÷ ${(100 + percent) / 100} = ${base}.` }
  }
  if (variant === 'part-to-percent') {
    const total = rng.pick([120, 160, 200, 240, 320, 400, 480])
    const rate = rng.pick(band >= 3 ? [7.5, 12.5, 17.5, 22.5, 37.5, 62.5] : [10, 15, 20, 25, 35, 40])
    const part = rounded(total * rate / 100)
    const context = rng.pick([
      `${part} of ${total} test cases failed`,
      `${part} of ${total} applicants passed`,
      `£${part} of a £${total} budget was spent`,
    ])
    return { id: id('percentages', seed), family: 'percentages', variant, label: 'Find the percentage', prompt: context, instruction: 'What percentage is that?', difficulty: level, responseTargetMs: 8200, answer: { kind: 'number', value: rate }, explanation: `${part} ÷ ${total} × 100 = ${rate}%.` }
  }
  if (variant === 'successive-change') {
    const first = rng.pick([10, 12.5, 15, 20, 25, 30]); const second = rng.pick([5, 10, 12.5, 15, 20])
    const increaseFirst = rng.next() < .6
    const answer = rounded(base * (1 + (increaseFirst ? first : -first) / 100) * (1 - second / 100))
    return { id: id('percentages', seed), family: 'percentages', variant, label: 'Successive percentages', prompt: `${base} is ${increaseFirst ? 'increased' : 'reduced'} by ${first}%, then reduced by ${second}%.`, instruction: 'What is the final value?', difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: answer }, explanation: `${base} × ${rounded(1 + (increaseFirst ? first : -first) / 100, 3)} × ${rounded(1 - second / 100, 3)} = ${answer}. Apply each change to the updated value.` }
  }
  if (variant === 'percentage-points') {
    const start = rng.pick([12, 18, 24, 35, 42, 55]); const points = rng.pick([4, 6, 8, 12, 15]); const end = start + points
    return { id: id('percentages', seed), family: 'percentages', variant, label: 'Percentage points', prompt: `A pass rate rises from ${start}% to ${end}%.`, instruction: 'What is the increase in percentage points?', difficulty: level, responseTargetMs: 6500, answer: { kind: 'number', value: points }, explanation: `Percentage-point change is the difference between the rates: ${end} − ${start} = ${points} points.` }
  }
  if (variant === 'compound-reverse') {
    const growth = rng.pick([10, 12.5, 15, 20, 25]); const reduction = rng.pick([5, 10, 12.5, 15, 20]); const final = rounded(base * (1 + growth / 100) * (1 - reduction / 100))
    return { id: id('percentages', seed), family: 'percentages', variant, label: 'Reverse successive change', prompt: `A value rises by ${growth}%, then falls by ${reduction}%, ending at ${final}.`, instruction: 'What was the starting value?', difficulty: level, responseTargetMs: 12500, answer: { kind: 'number', value: base }, explanation: `The combined multiplier is ${(1 + growth / 100).toFixed(3)} × ${(1 - reduction / 100).toFixed(3)}. Divide ${final} by ${rounded((1 + growth / 100) * (1 - reduction / 100), 4)} to recover ${base}.` }
  }
  const cost = rng.pick([80, 100, 120, 160, 200, 240]); const profit = rng.pick([20, 30, 40, 50, 60]); const selling = cost + profit
  const answer = rounded(profit / selling * 100, 2)
  return { id: id('percentages', seed), family: 'percentages', variant: 'profit-margin', label: 'Profit margin', prompt: `An item costs £${cost} and sells for £${selling}.`, instruction: 'What is the profit as a percentage of the selling price?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: answer, tolerance: .01 }, explanation: `Profit is £${profit}. Margin uses the selling price: ${profit} ÷ ${selling} × 100 = ${answer}%.` }
}

function fractions(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const denominators = band === 0 ? [2, 4, 5, 10] : band === 1 ? [2, 3, 4, 5, 6, 8, 10] : [3, 6, 7, 8, 9, 12, 16, 20, 25]
  const denominator = rng.pick(denominators)
  const numerator = rng.int(1, denominator - 1)
  const percent = rounded(numerator / denominator * 100)
  const available = band === 0
    ? ['fraction-to-percent', 'decimal-to-percent']
    : band === 1
      ? ['fraction-to-percent', 'decimal-to-percent', 'percent-to-fraction', 'fraction-of-quantity']
      : band === 2
        ? level >= 7
          ? ['compare-forms', 'compound-fraction', 'fraction-remaining', 'mixed-number-arithmetic', 'fraction-equation']
          : ['fraction-to-percent', 'percent-to-fraction', 'fraction-of-quantity', 'compare-forms', 'compound-fraction', 'fraction-remaining']
        : ['compare-forms', 'compound-fraction', 'fraction-remaining', 'mixed-number-arithmetic', 'fraction-equation']
  const variant = rng.pick(available)

  if (variant === 'fraction-to-percent') {
    const options = uniqueNumberOptions(rng, percent, denominator < 7 ? 5 : 2.5, (value) => `${value}%`)
    return { id: id('fractions', seed), family: 'fractions', variant: 'fraction-to-percent', label: 'Fraction → percentage', prompt: `Convert ${numerator}/${denominator} to a percentage`, difficulty: level, responseTargetMs: 6200, answer: { kind: 'choice', value: `${percent}` }, options, explanation: `${numerator} ÷ ${denominator} × 100 = ${percent}%.` }
  }
  if (variant === 'decimal-to-percent') {
    const decimal = rounded(numerator / denominator, 3)
    const decimalPercent = rounded(decimal * 100, 1)
    const options = uniqueNumberOptions(rng, decimalPercent, 5, (value) => `${value}%`)
    return { id: id('fractions', seed), family: 'fractions', variant: 'decimal-to-percent', label: 'Decimal → percentage', prompt: `Convert ${decimal} to a percentage`, difficulty: level, responseTargetMs: 5200, answer: { kind: 'choice', value: `${decimalPercent}` }, options, explanation: `${decimal} × 100 = ${decimalPercent}%.` }
  }
  if (variant === 'percent-to-fraction') {
    const exactDenominator = rng.pick([2, 4, 5, 8, 10, 20, 25])
    const exactNumerator = rng.int(1, exactDenominator - 1)
    const exactPercent = exactNumerator / exactDenominator * 100
    const simplified = fractionLabel(exactNumerator, exactDenominator)
    const [simpleNumerator, simpleDenominator] = simplified.split('/').map(Number)
    const options = choiceOptions(rng, simplified, [
      fractionLabel(simpleNumerator + 1, simpleDenominator),
      fractionLabel(simpleNumerator, simpleDenominator + 1),
      fractionLabel(simpleNumerator + 1, simpleDenominator + 1),
    ])
    return { id: id('fractions', seed), family: 'fractions', variant: 'percent-to-fraction', label: 'Percentage → fraction', prompt: `Write ${exactPercent}% as a simplest fraction`, difficulty: level, responseTargetMs: 7200, answer: { kind: 'choice', value: simplified }, options, explanation: `${exactPercent}% = ${exactPercent}/100, which simplifies to ${simplified}.` }
  }
  if (variant === 'fraction-of-quantity') {
    const multiplier = rng.int(2, 8 + level)
    const quantity = denominator * multiplier
    const answer = numerator * multiplier
    return { id: id('fractions', seed), family: 'fractions', variant: 'fraction-of-quantity', label: 'Fraction of a quantity', prompt: `${numerator}/${denominator} of ${quantity}`, difficulty: level, responseTargetMs: 6200, answer: { kind: 'number', value: answer }, explanation: `${quantity} ÷ ${denominator} = ${multiplier}; ${multiplier} × ${numerator} = ${answer}.` }
  }
  if (variant === 'fraction-equation') {
    const multiplier = rng.int(5, 18); const quantity = denominator * multiplier; const result = numerator * multiplier
    return { id: id('fractions', seed), family: 'fractions', variant, label: 'Reverse fraction', prompt: `${numerator}/${denominator} of a number is ${result}.`, instruction: 'What is the number?', difficulty: level, responseTargetMs: 9000, answer: { kind: 'number', value: quantity }, explanation: `If ${numerator}/${denominator} equals ${result}, one ${denominator}-th is ${result} ÷ ${numerator} = ${multiplier}. The whole is ${multiplier} × ${denominator} = ${quantity}.` }
  }
  if (variant === 'compare-forms') {
    const pool = band >= 3
      ? rng.pick([
          [{ label: '7/12', value: 7 / 12 }, { label: '0.59', value: .59 }, { label: '58.5%', value: .585 }, { label: '3/5', value: .6 }],
          [{ label: '11/16', value: 11 / 16 }, { label: '0.695', value: .695 }, { label: '69%', value: .69 }, { label: '7/10', value: .7 }],
          [{ label: '5/8', value: .625 }, { label: '0.63', value: .63 }, { label: '62%', value: .62 }, { label: '13/20', value: .65 }],
        ])
      : rng.shuffle([
          { label: '1/2', value: .5 }, { label: '3/5', value: .6 }, { label: '5/8', value: .625 },
          { label: '0.55', value: .55 }, { label: '58%', value: .58 }, { label: '2/3', value: 2 / 3 },
          { label: '0.72', value: .72 }, { label: '70%', value: .7 },
        ]).slice(0, 4)
    const largest = pool.reduce((best, item) => item.value > best.value ? item : best)
    const options = rng.shuffle(pool).map((item) => ({ id: item.label, label: item.label }))
    return { id: id('fractions', seed), family: 'fractions', variant, label: 'Compare number forms', prompt: band >= 3 ? 'Which closely matched value is largest?' : 'Which value is largest?', difficulty: level, responseTargetMs: band >= 3 ? 9000 : 7500, answer: { kind: 'choice', value: largest.label }, options, explanation: `As decimals, the options are ${pool.map((item) => `${item.label} = ${rounded(item.value, 3)}`).join(', ')}. ${largest.label} is largest.` }
  }
  if (variant === 'compound-fraction') {
    const firstDenominator = rng.pick([3, 4, 5, 6]); const firstNumerator = rng.int(1, firstDenominator - 1)
    const secondDenominator = rng.pick([2, 3, 4, 5]); const secondNumerator = rng.int(1, secondDenominator - 1)
    const quantity = firstDenominator * secondDenominator * rng.int(4, 12)
    const answer = quantity * firstNumerator / firstDenominator * secondNumerator / secondDenominator
    return { id: id('fractions', seed), family: 'fractions', variant, label: 'Fractions in stages', prompt: `${firstNumerator}/${firstDenominator} of ${secondNumerator}/${secondDenominator} of ${quantity}`, difficulty: level, responseTargetMs: 9500, answer: { kind: 'number', value: answer }, explanation: `${quantity} × ${secondNumerator}/${secondDenominator} × ${firstNumerator}/${firstDenominator} = ${answer}.` }
  }
  if (variant === 'fraction-remaining') {
    const firstDenominator = rng.pick([3, 4, 5]); const firstNumerator = rng.int(1, firstDenominator - 1)
    const secondDenominator = rng.pick([2, 3, 4]); const secondNumerator = rng.int(1, secondDenominator - 1)
    const total = firstDenominator * secondDenominator * rng.int(5, 14)
    const afterFirst = total * (firstDenominator - firstNumerator) / firstDenominator
    const answer = afterFirst * (secondDenominator - secondNumerator) / secondDenominator
    const context = rng.pick(['tasks', 'tickets', 'data records', 'battery charge units'])
    return { id: id('fractions', seed), family: 'fractions', variant, label: 'Fraction remaining', prompt: `Start with ${total} ${context}. Use ${firstNumerator}/${firstDenominator}, then use ${secondNumerator}/${secondDenominator} of what remains.`, instruction: `How many ${context} remain?`, difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: answer }, explanation: `After the first use, ${total} × ${firstDenominator - firstNumerator}/${firstDenominator} = ${afterFirst}. Then ${afterFirst} × ${secondDenominator - secondNumerator}/${secondDenominator} = ${answer} remain.` }
  }
  const wholeA = rng.int(1, 4); const wholeB = rng.int(1, 4); const denominatorA = rng.pick([2, 3, 4, 5]); const denominatorB = rng.pick([2, 3, 4, 5])
  const numeratorA = rng.int(1, denominatorA - 1); const numeratorB = rng.int(1, denominatorB - 1)
  const resultNumerator = (wholeA * denominatorA + numeratorA) * denominatorB + (wholeB * denominatorB + numeratorB) * denominatorA
  const resultDenominator = denominatorA * denominatorB
  const answer = fractionLabel(resultNumerator, resultDenominator)
  const distractors = [
    fractionLabel(resultNumerator - denominatorA, resultDenominator),
    fractionLabel(resultNumerator + denominatorB, resultDenominator),
    fractionLabel(resultNumerator + resultDenominator, resultDenominator),
  ]
  return { id: id('fractions', seed), family: 'fractions', variant: 'mixed-number-arithmetic', label: 'Mixed-number arithmetic', prompt: `${wholeA} ${numeratorA}/${denominatorA} + ${wholeB} ${numeratorB}/${denominatorB}`, instruction: 'Choose the answer as an improper fraction.', difficulty: level, responseTargetMs: 11500, answer: { kind: 'choice', value: answer }, options: choiceOptions(rng, answer, distractors), explanation: `Convert to improper fractions and add: ${wholeA * denominatorA + numeratorA}/${denominatorA} + ${wholeB * denominatorB + numeratorB}/${denominatorB} = ${answer}.` }
}

function ratios(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const left = rng.int(2, 5 + Math.floor(level / 2))
  const right = rng.int(2, 6 + Math.floor(level / 2))
  const scale = rng.int(3, 5 + level)
  const available = band === 0
    ? ['equivalent', 'share-total']
    : band === 1
      ? ['equivalent', 'share-total', 'scaling', 'direct-proportion']
      : band === 2
        ? level >= 7
          ? ['direct-proportion', 'three-part-share', 'inverse-proportion', 'mixture', 'ratio-adjustment']
          : ['share-total', 'scaling', 'direct-proportion', 'three-part-share', 'inverse-proportion', 'mixture']
        : ['direct-proportion', 'three-part-share', 'inverse-proportion', 'mixture', 'ratio-adjustment']
  const variant = rng.pick(available)
  if (variant === 'equivalent') {
    const answer = right * scale
    return { id: id('ratios', seed), family: 'ratios', variant: 'equivalent', label: 'Equivalent ratio', prompt: `${left}:${right} = ${left * scale}:?`, difficulty: level, responseTargetMs: 5200, answer: { kind: 'number', value: answer }, explanation: `${left} became ${left * scale}, so both sides were multiplied by ${scale}. ${right} × ${scale} = ${answer}.` }
  }
  if (variant === 'share-total') {
    const unit = rng.int(4, 10 + level)
    const total = (left + right) * unit
    const answer = right * unit
    const items = rng.pick(['tickets', 'servers', 'credits', 'tasks'])
    return { id: id('ratios', seed), family: 'ratios', variant: 'share-total', label: 'Share a total', prompt: `Split ${total} ${items} in the ratio ${left}:${right}`, instruction: 'How much is the second share?', difficulty: level, responseTargetMs: 7000, answer: { kind: 'number', value: answer }, explanation: `There are ${left + right} parts, so each part is ${total} ÷ ${left + right} = ${unit}. The second share is ${right} × ${unit} = ${answer}.` }
  }
  if (variant === 'scaling') {
    const originalUnits = rng.int(2, 5)
    const originalAmount = left * originalUnits
    const targetUnits = originalUnits + rng.int(2, 5 + level)
    const answer = left * targetUnits
    const context = rng.pick([
      { amount: 'GB', unit: 'users', verb: 'serves' },
      { amount: 'tickets', unit: 'teams', verb: 'supports' },
      { amount: 'litres', unit: 'walls', verb: 'covers' },
      { amount: 'cores', unit: 'workers', verb: 'supports' },
    ])
    return { id: id('ratios', seed), family: 'ratios', variant: 'scaling', label: 'Ratio scaling', prompt: `${originalAmount} ${context.amount} ${context.verb} ${originalUnits} ${context.unit}`, instruction: `How many ${context.amount} for ${targetUnits} ${context.unit} at the same ratio?`, difficulty: level, responseTargetMs: 7200, answer: { kind: 'number', value: answer }, explanation: `${originalAmount} ÷ ${originalUnits} = ${left} ${context.amount} per ${context.unit.replace(/s$/, '')}. ${left} × ${targetUnits} = ${answer}.` }
  }
  if (variant === 'direct-proportion') {
    const machines = rng.int(2, 5); const perMachine = rng.int(15, 35 + level * 3); const targetMachines = machines + rng.int(2, 6)
    const answer = perMachine * targetMachines
    const actors = rng.pick(['workers', 'servers', 'printers', 'pipelines']); const outputs = rng.pick(['items', 'jobs', 'pages', 'records'])
    return { id: id('ratios', seed), family: 'ratios', variant, label: 'Direct proportion', prompt: `${machines} ${actors} process ${machines * perMachine} ${outputs}`, instruction: `At the same rate, how many do ${targetMachines} process?`, difficulty: level, responseTargetMs: 7800, answer: { kind: 'number', value: answer }, explanation: `${machines * perMachine} ÷ ${machines} = ${perMachine} each. ${perMachine} × ${targetMachines} = ${answer}.` }
  }
  if (variant === 'three-part-share') {
    const third = rng.int(2, 8); const unit = rng.int(4, 14); const total = (left + right + third) * unit
    const requested = rng.pick([0, 1, 2]); const parts = [left, right, third]; const answer = parts[requested] * unit
    return { id: id('ratios', seed), family: 'ratios', variant, label: 'Three-part ratio', prompt: `Divide ${total} credits in the ratio ${left}:${right}:${third}.`, instruction: `How many credits are in share ${requested + 1}?`, difficulty: level, responseTargetMs: 9000, answer: { kind: 'number', value: answer }, explanation: `There are ${left + right + third} parts, worth ${total} ÷ ${left + right + third} = ${unit} each. Share ${requested + 1} is ${parts[requested]} × ${unit} = ${answer}.` }
  }
  if (variant === 'inverse-proportion') {
    const workers = rng.pick([4, 6, 8, 10, 12]); const days = rng.pick([6, 8, 10, 12, 15]); const totalWork = workers * days
    const possibleWorkers = [3, 4, 5, 6, 8, 10, 12, 15, 16, 20].filter((value) => value !== workers && totalWork % value === 0)
    const targetWorkers = rng.pick(possibleWorkers); const answer = totalWork / targetWorkers
    return { id: id('ratios', seed), family: 'ratios', variant, label: 'Inverse proportion', prompt: `${workers} engineers finish a migration in ${days} days.`, instruction: `At the same productivity, how many days would ${targetWorkers} engineers take?`, difficulty: level, responseTargetMs: 9800, answer: { kind: 'number', value: answer }, explanation: `The work is ${workers} × ${days} = ${totalWork} engineer-days. ${totalWork} ÷ ${targetWorkers} = ${answer} days.` }
  }
  if (variant === 'mixture') {
    const concentrate = rng.int(1, 5); const water = rng.int(concentrate + 1, 9); const unit = rng.int(3, 12); const total = (concentrate + water) * unit
    const answer = concentrate * unit
    const liquid = rng.pick(['coolant', 'cleaning solution', 'fruit concentrate'])
    return { id: id('ratios', seed), family: 'ratios', variant, label: 'Mixture ratio', prompt: `${liquid.charAt(0).toUpperCase() + liquid.slice(1)} is mixed with water in the ratio ${concentrate}:${water}. There are ${total} litres altogether.`, instruction: `How many litres are ${liquid}?`, difficulty: level, responseTargetMs: 9200, answer: { kind: 'number', value: answer }, explanation: `${concentrate + water} parts total means ${total} ÷ ${concentrate + water} = ${unit} litres per part. ${concentrate} × ${unit} = ${answer}.` }
  }
  const unit = rng.int(4, 12); const initialLeft = left * unit; const initialRight = right * unit
  const targetLeftParts = left + rng.int(1, 4); const answer = targetLeftParts * unit - initialLeft
  return { id: id('ratios', seed), family: 'ratios', variant: 'ratio-adjustment', label: 'Adjust a ratio', prompt: `A queue has ${initialLeft} priority and ${initialRight} standard jobs (${left}:${right}).`, instruction: `How many priority jobs must be added to make the ratio ${targetLeftParts}:${right}?`, difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: answer }, explanation: `The standard side stays at ${right} × ${unit}. The new priority count is ${targetLeftParts} × ${unit} = ${targetLeftParts * unit}; add ${targetLeftParts * unit} − ${initialLeft} = ${answer}.` }
}

function averages(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const target = rng.int(8, 20 + level * 2)
  const available = band === 0
    ? ['mean', 'missing-value']
    : band === 1
      ? ['mean', 'missing-value', 'updated-mean']
      : band === 2
        ? level >= 7
          ? ['weighted-mean', 'target-average', 'removed-value', 'combined-group-average']
          : ['mean', 'missing-value', 'updated-mean', 'weighted-mean', 'target-average', 'removed-value']
        : ['weighted-mean', 'target-average', 'removed-value', 'combined-group-average']
  const variant = rng.pick(available)
  if (variant === 'mean') {
    const gapA = rng.int(1, 5 + level); const gapB = rng.int(1, 4 + level); const gapC = rng.int(1, 5 + level)
    const values = band < 2 ? [target - gapA, target + gapA, target - gapB, target + gapB] : [target - gapA, target + gapA, target - gapB, target + gapB, target - gapC, target + gapC]
    const noun = rng.pick(['scores', 'latencies', 'task counts', 'response times'])
    return { id: id('averages', seed), family: 'averages', variant, label: 'Quick average', prompt: `${noun}: ${values.join(', ')}`, instruction: 'What is the average?', difficulty: level, responseTargetMs: band < 2 ? 6200 : 7600, answer: { kind: 'number', value: target }, explanation: `The values total ${target * values.length}; ${target * values.length} ÷ ${values.length} = ${target}.` }
  }
  if (variant === 'missing-value') {
    const count = band === 0 ? 4 : band === 1 ? 5 : 6
    const offset = rng.int(1, Math.min(5, target - 1)); const pairOffset = rng.int(1, Math.min(6, target - 1))
    const missing = target + offset
    const values = count === 4
      ? [target - offset, target - pairOffset, target + pairOffset]
      : count === 5
        ? [target - offset, target - pairOffset, target + pairOffset, target]
        : [target - offset, target - pairOffset, target + pairOffset, target - 2, target + 2]
    return { id: id('averages', seed), family: 'averages', variant, label: 'Missing average', prompt: `Average ${target}: ${values.join(', ')}, ?`, instruction: 'Find the missing value', difficulty: level, responseTargetMs: band < 2 ? 7800 : 9000, answer: { kind: 'number', value: missing }, explanation: `The total must be ${target} × ${count} = ${target * count}. The shown values total ${values.reduce((a, b) => a + b, 0)}, leaving ${missing}.` }
  }
  if (variant === 'updated-mean') {
    const count = rng.int(3, 8)
    const newValue = rng.int(5, 30 + level * 3)
    const answer = rounded((target * count + newValue) / (count + 1))
    const noun = rng.pick(['results', 'sprints', 'tests', 'response times'])
    return { id: id('averages', seed), family: 'averages', variant, label: 'Updated average', prompt: `${count} ${noun} average ${target}; next is ${newValue}`, instruction: 'What is the new average?', difficulty: level, responseTargetMs: 8200, answer: { kind: 'number', value: answer, tolerance: .001 }, explanation: `Old total ${target} × ${count} = ${target * count}. Add ${newValue}, then divide ${target * count + newValue} by ${count + 1} to get ${answer}.` }
  }
  if (variant === 'weighted-mean') {
    const countA = rng.int(2, band >= 3 ? 12 : 6); const countB = rng.int(2, band >= 3 ? 12 : 6)
    const averageA = target; const averageB = target + rng.int(3, 9)
    const answer = rounded((countA * averageA + countB * averageB) / (countA + countB))
    return { id: id('averages', seed), family: 'averages', variant, label: 'Weighted average', prompt: `${countA} tests average ${averageA}; ${countB} tests average ${averageB}`, instruction: 'What is the combined average?', difficulty: level, responseTargetMs: band >= 3 ? 10500 : 9000, answer: { kind: 'number', value: answer, tolerance: .001 }, explanation: `Combined total: ${countA} × ${averageA} + ${countB} × ${averageB} = ${countA * averageA + countB * averageB}. Divide by ${countA + countB} to get ${answer}.` }
  }
  if (variant === 'target-average') {
    const count = rng.int(3, 8); const currentAverage = rng.int(12, 30 + level); const targetAverage = currentAverage + rng.int(1, 5)
    const answer = targetAverage * (count + 1) - currentAverage * count
    return { id: id('averages', seed), family: 'averages', variant, label: 'Target average', prompt: `${count} interview scores average ${currentAverage}.`, instruction: `What next score is needed to raise the average to ${targetAverage}?`, difficulty: level, responseTargetMs: 9800, answer: { kind: 'number', value: answer }, explanation: `The target total is ${targetAverage} × ${count + 1} = ${targetAverage * (count + 1)}. The current total is ${currentAverage * count}, so the next score must be ${answer}.` }
  }
  if (variant === 'removed-value') {
    const count = rng.int(4, 9); const remainingAverage = rng.int(12, 35); const difference = rng.int(2, 7)
    const originalAverage = remainingAverage + difference; const removed = remainingAverage + count * difference
    return { id: id('averages', seed), family: 'averages', variant, label: 'Removed value', prompt: `${count} results average ${originalAverage}. After one result is removed, the remaining ${count - 1} average ${remainingAverage}.`, instruction: 'What result was removed?', difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: removed }, explanation: `Original total: ${count} × ${originalAverage} = ${count * originalAverage}. Remaining total: ${count - 1} × ${remainingAverage} = ${(count - 1) * remainingAverage}. The difference is ${removed}.` }
  }
  const countA = rng.int(4, 12); const countB = rng.int(4, 12); const averageA = rng.int(15, 35); const averageB = averageA + rng.int(4, 12)
  const combined = rounded((countA * averageA + countB * averageB) / (countA + countB))
  return { id: id('averages', seed), family: 'averages', variant: 'combined-group-average', label: 'Combined groups', prompt: `Team A: ${countA} people averaging ${averageA}. Team B: ${countB} people averaging ${averageB}.`, instruction: 'What is the overall average?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: combined, tolerance: .001 }, explanation: `Use group totals, not the mean of the two averages: (${countA} × ${averageA} + ${countB} × ${averageB}) ÷ ${countA + countB} = ${combined}.` }
}

function rates(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? [0, 1, 3, 5, 7]
    : band === 1
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : band === 2
        ? level >= 7
          ? [4, 6, 7, 8, 9, 10, 11, 12, 13, 14]
          : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [4, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const variant = rng.pick(available)

  if (variant === 0) {
    const rate = rng.int(4, 10 + level * 2); const time = rng.int(3, 8 + level)
    const answer = rate * time
    const context = rng.pick([
      { subject: 'A scanner', verb: 'checks', unit: 'files' },
      { subject: 'A test runner', verb: 'completes', unit: 'tests' },
      { subject: 'An import job', verb: 'loads', unit: 'records' },
      { subject: 'A support agent', verb: 'closes', unit: 'tickets' },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'throughput', label: 'Throughput', prompt: `${context.subject} ${context.verb} ${rate} ${context.unit} each minute. It runs for ${time} minutes.`, instruction: `How many ${context.unit} are completed?`, difficulty: level, responseTargetMs: 6200, answer: { kind: 'number', value: answer }, explanation: `${rate} per minute × ${time} minutes = ${answer} ${context.unit}.` }
  }
  if (variant === 1) {
    const speed = rng.int(30, 70 + level * 5); const time = band >= 2 ? rng.pick([1.25, 1.5, 1.75, 2.5, 3.5]) : rng.int(2, 6)
    const answer = rounded(speed * time)
    const vehicle = rng.pick(['train', 'van', 'drone', 'research boat'])
    return { id: id('rates', seed), family: 'rates', variant: 'speed-distance', label: 'Speed & distance', prompt: `A ${vehicle} travels at ${speed} km/h for ${time} hours.`, instruction: 'How far does it travel?', difficulty: level, responseTargetMs: 6500, answer: { kind: 'number', value: answer }, explanation: `Distance = speed × time: ${speed} × ${time} = ${answer} km.` }
  }
  if (variant === 2) {
    const speed = rng.int(4, 12) * 10; const time = band >= 2 ? rng.pick([1.25, 1.5, 1.75, 2.5, 3.5]) : rng.int(2, 7); const distance = speed * time
    return { id: id('rates', seed), family: 'rates', variant: 'travel-time', label: 'Travel time', prompt: `A service vehicle covers ${distance} km at ${speed} km/h.`, instruction: 'How many hours does the journey take?', difficulty: level, responseTargetMs: 7000, answer: { kind: 'number', value: time }, explanation: `Time = distance ÷ speed: ${distance} ÷ ${speed} = ${time} hours.` }
  }
  if (variant === 3) {
    const conversion = rng.pick([
      { amount: rng.int(2, 15), from: 'km', to: 'metres', factor: 1000 },
      { amount: rng.int(2, 12), from: 'hours', to: 'minutes', factor: 60 },
      { amount: rng.int(2, 20), from: 'minutes', to: 'seconds', factor: 60 },
      { amount: rng.int(2, 16), from: 'GB', to: 'MB (decimal)', factor: 1000 },
    ])
    const answer = conversion.amount * conversion.factor
    return { id: id('rates', seed), family: 'rates', variant: 'unit-conversion-forward', label: 'Unit conversion', prompt: `${conversion.amount} ${conversion.from}`, instruction: `Convert to ${conversion.to}.`, difficulty: level, responseTargetMs: 5400, answer: { kind: 'number', value: answer }, explanation: `Multiply by ${conversion.factor}: ${conversion.amount} × ${conversion.factor} = ${answer} ${conversion.to}.` }
  }
  if (variant === 4) {
    const conversion = rng.pick([
      { from: 'miles', to: 'km', factor: 1.6, amount: rng.int(8, 30) },
      { from: 'kg', to: 'lb', factor: 2.2, amount: rng.int(5, 25) },
      { from: 'gallons', to: 'litres', factor: 4.5, amount: rng.int(3, 16) },
      { from: 'inches', to: 'cm', factor: 2.54, amount: rng.int(4, 20) },
    ])
    const converted = rounded(conversion.amount * conversion.factor, 2)
    return { id: id('rates', seed), family: 'rates', variant: 'unit-conversion-reverse', label: 'Reverse conversion', prompt: `Use 1 ${conversion.from.replace(/s$/, '')} = ${conversion.factor} ${conversion.to}.`, instruction: `How many ${conversion.from} is ${converted} ${conversion.to}?`, difficulty: level, responseTargetMs: 7600, answer: { kind: 'number', value: conversion.amount }, explanation: `${converted} ÷ ${conversion.factor} = ${conversion.amount} ${conversion.from}.` }
  }
  if (variant === 5) {
    const units = rng.int(3, 12); const unitPrice = rng.int(2, 15); const total = units * unitPrice
    const item = rng.pick([
      { plural: 'licenses', singular: 'license' },
      { plural: 'notebooks', singular: 'notebook' },
      { plural: 'adapters', singular: 'adapter' },
      { plural: 'meal boxes', singular: 'meal box' },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'unit-price', label: 'Price per unit', prompt: `${units} ${item.plural} cost £${total}.`, instruction: `What is the cost per ${item.singular}?`, difficulty: level, responseTargetMs: 6500, answer: { kind: 'number', value: unitPrice }, explanation: `£${total} ÷ ${units} = £${unitPrice} per ${item.singular}.` }
  }
  if (variant === 6) {
    const workers = rng.int(2, 6); const perWorker = rng.int(8, 20); const targetWorkers = workers + rng.int(2, 5)
    const answer = perWorker * targetWorkers
    const context = rng.pick([
      { actors: 'servers', outputs: 'jobs/min', verb: 'handle' },
      { actors: 'analysts', outputs: 'cases/day', verb: 'review' },
      { actors: 'machines', outputs: 'parts/hour', verb: 'produce' },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'scaled-rate', label: 'Scale a rate', prompt: `${workers} ${context.actors} ${context.verb} ${workers * perWorker} ${context.outputs}.`, instruction: `At the same rate, how many with ${targetWorkers} ${context.actors}?`, difficulty: level, responseTargetMs: 7600, answer: { kind: 'number', value: answer }, explanation: `${workers * perWorker} ÷ ${workers} = ${perWorker} per ${context.actors.replace(/s$/, '')}. ${perWorker} × ${targetWorkers} = ${answer}.` }
  }
  if (variant === 7) {
    const groups = rng.int(3, 10); const membersPerGroup = rng.int(2, 7); const resourcesPerMember = rng.int(2, 6)
    const answer = groups * membersPerGroup * resourcesPerMember
    const context = rng.pick([
      { group: 'people', member: 'dogs', resource: 'bones', link: `${membersPerGroup} dogs per person`, need: `${resourcesPerMember} bones per dog` },
      { group: 'teams', member: 'developers', resource: 'monitors', link: `${membersPerGroup} developers per team`, need: `${resourcesPerMember} monitors per developer` },
      { group: 'racks', member: 'servers', resource: 'drives', link: `${membersPerGroup} servers per rack`, need: `${resourcesPerMember} drives per server` },
      { group: 'pallets', member: 'boxes', resource: 'items', link: `${membersPerGroup} boxes per pallet`, need: `${resourcesPerMember} items per box` },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'resource-chain', label: 'Resource chain', prompt: `${groups} ${context.group}; ${context.link}; ${context.need}.`, instruction: `How many ${context.resource} are needed altogether?`, difficulty: level, responseTargetMs: 8200, answer: { kind: 'number', value: answer }, explanation: `${groups} × ${membersPerGroup} × ${resourcesPerMember} = ${answer} ${context.resource}.` }
  }
  if (variant === 8) {
    const groups = rng.int(3, 10); const membersPerGroup = rng.int(2, 7); const resourcesPerMember = rng.int(2, 6)
    const total = groups * membersPerGroup * resourcesPerMember
    const context = rng.pick([
      { groups: 'people', group: 'person', members: 'dogs', member: 'dog', resources: 'bones' },
      { groups: 'teams', group: 'team', members: 'developers', member: 'developer', resources: 'monitors' },
      { groups: 'racks', group: 'rack', members: 'servers', member: 'server', resources: 'drives' },
      { groups: 'pallets', group: 'pallet', members: 'boxes', member: 'box', resources: 'items' },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'resource-chain-reverse', label: 'Reverse resource chain', prompt: `${total} ${context.resources}; ${resourcesPerMember} per ${context.member}; ${membersPerGroup} ${context.members} per ${context.group}.`, instruction: `How many ${context.groups} can be supplied?`, difficulty: level, responseTargetMs: 9000, answer: { kind: 'number', value: groups }, explanation: `${total} ÷ ${resourcesPerMember} ÷ ${membersPerGroup} = ${groups} ${context.groups}.` }
  }
  if (variant === 9) {
    const machines = rng.int(2, 7); const perMinute = rng.int(3, 12); const minutes = rng.int(3, 9)
    const answer = machines * perMinute * minutes
    const context = rng.pick([
      { machines: 'printers', verb: 'print', output: 'pages' },
      { machines: 'workers', verb: 'pack', output: 'orders' },
      { machines: 'pipelines', verb: 'process', output: 'records' },
    ])
    return { id: id('rates', seed), family: 'rates', variant: 'parallel-throughput', label: 'Parallel throughput', prompt: `${machines} ${context.machines} each ${context.verb} ${perMinute} ${context.output} per minute for ${minutes} minutes.`, instruction: `How many ${context.output} in total?`, difficulty: level, responseTargetMs: 8500, answer: { kind: 'number', value: answer }, explanation: `${machines} × ${perMinute} × ${minutes} = ${answer} ${context.output}.` }
  }
  if (variant === 10) {
    const outboundSpeed = rng.pick([40, 48, 60, 72, 80]); const returnSpeed = rng.pick([30, 45, 50, 64, 90]); const distance = rng.pick([120, 180, 240, 360])
    const totalTime = distance / outboundSpeed + distance / returnSpeed
    const answer = rounded(distance * 2 / totalTime, 2)
    return { id: id('rates', seed), family: 'rates', variant: 'average-speed', label: 'Average speed', prompt: `A vehicle travels ${distance} km out at ${outboundSpeed} km/h and the same distance back at ${returnSpeed} km/h.`, instruction: 'What is its average speed for the whole journey?', difficulty: level, responseTargetMs: 12000, answer: { kind: 'number', value: answer, tolerance: .01 }, explanation: `Total distance is ${distance * 2} km. Total time is ${rounded(distance / outboundSpeed, 3)} + ${rounded(distance / returnSpeed, 3)} hours, so average speed is ${answer} km/h.` }
  }
  if (variant === 11) {
    const rate = rng.int(12, 35); const totalMinutes = rng.pick([45, 60, 75, 90, 120]); const paused = rng.pick([5, 10, 15, 20]); const active = totalMinutes - paused
    const answer = rate * active
    const output = rng.pick(['records', 'components', 'test cases', 'orders'])
    return { id: id('rates', seed), family: 'rates', variant: 'downtime-throughput', label: 'Throughput with downtime', prompt: `A process handles ${rate} ${output} per minute during a ${totalMinutes}-minute window, but is paused for ${paused} minutes.`, instruction: `How many ${output} does it handle?`, difficulty: level, responseTargetMs: 9800, answer: { kind: 'number', value: answer }, explanation: `Active time is ${totalMinutes} − ${paused} = ${active} minutes. ${rate} × ${active} = ${answer} ${output}.` }
  }
  if (variant === 12) {
    const perMachine = rng.int(6, 18); const minutes = rng.int(4, 10); const machines = rng.int(3, 9); const spare = rng.int(1, perMachine * minutes - 1)
    const required = machines * perMachine * minutes - spare
    return { id: id('rates', seed), family: 'rates', variant: 'capacity-planning', label: 'Capacity planning', prompt: `Each server handles ${perMachine} jobs per minute. ${required} jobs must finish within ${minutes} minutes.`, instruction: 'What is the minimum number of servers needed?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: machines }, explanation: `One server handles ${perMachine} × ${minutes} = ${perMachine * minutes} jobs. ${required} ÷ ${perMachine * minutes} = ${rounded(required / (perMachine * minutes), 2)}, so round up to ${machines} servers.` }
  }
  if (variant === 13) {
    const fillRate = rng.int(12, 30); const drainRate = rng.int(3, fillRate - 4); const minutes = rng.int(8, 20); const start = rng.int(20, 80)
    const answer = start + (fillRate - drainRate) * minutes
    return { id: id('rates', seed), family: 'rates', variant: 'net-rate', label: 'Net rate', prompt: `A tank starts with ${start} litres. It fills at ${fillRate} L/min while ${drainRate} L/min drains out for ${minutes} minutes.`, instruction: 'How many litres are in the tank at the end?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: answer }, explanation: `Net flow is ${fillRate} − ${drainRate} = ${fillRate - drainRate} L/min. Add ${fillRate - drainRate} × ${minutes} = ${(fillRate - drainRate) * minutes} litres to the starting ${start}, giving ${answer}.` }
  }
  const speed = rng.pick([40, 48, 50, 55, 60, 65, 72]); const time = rng.pick([1.25, 1.5, 1.75, 2.5]); const miles = rounded(speed * time, 2); const answer = rounded(miles * 1.6, 2)
  return { id: id('rates', seed), family: 'rates', variant: 'converted-distance', label: 'Distance conversion', prompt: `A vehicle travels at ${speed} miles/hour for ${time} hours. Use 1 mile = 1.6 km.`, instruction: 'How far does it travel in kilometres?', difficulty: level, responseTargetMs: 11000, answer: { kind: 'number', value: answer, tolerance: .01 }, explanation: `First find the distance: ${speed} × ${time} = ${miles} miles. Then convert: ${miles} × 1.6 = ${answer} km.` }
}

function powers(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['square', 'square-root']
    : band === 1
      ? ['square', 'cube', 'square-root', 'cube-root', 'powers-of-ten', 'remainder']
      : band === 2
        ? level >= 7
          ? ['powers-of-ten', 'divisibility', 'exponent-product', 'combined-root-power', 'last-digit-power']
          : ['cube', 'cube-root', 'powers-of-ten', 'remainder', 'divisibility', 'exponent-product', 'combined-root-power']
        : ['powers-of-ten', 'divisibility', 'exponent-product', 'exponent-quotient', 'scientific-multiplication', 'combined-root-power', 'last-digit-power']
  const variant = rng.pick(available)
  if (variant === 'square' || variant === 'cube') {
    const exponent = variant === 'square' ? 2 : 3; const base = rng.int(2, variant === 'cube' ? 12 : Math.min(20, 7 + level * 2)); const answer = base ** exponent
    return { id: id('powers', seed), family: 'powers', variant, label: variant === 'square' ? 'Squares' : 'Cubes', prompt: `${base}${exponent === 2 ? '²' : '³'}`, difficulty: level, responseTargetMs: band === 0 ? 4200 : 5200, answer: { kind: 'number', value: answer }, explanation: `${base} multiplied by itself ${exponent} times is ${answer}.` }
  }
  if (variant === 'square-root' || variant === 'cube-root') {
    const cube = variant === 'cube-root'; const root = rng.int(3, cube ? 12 : Math.min(22, 8 + level * 2)); const value = cube ? root ** 3 : root ** 2
    return { id: id('powers', seed), family: 'powers', variant, label: cube ? 'Cube roots' : 'Square roots', prompt: `${cube ? '∛' : '√'}${value}`, difficulty: level, responseTargetMs: band === 0 ? 4400 : 5400, answer: { kind: 'number', value: root }, explanation: `${root}${cube ? '³' : '²'} = ${value}, so the root is ${root}.` }
  }
  if (variant === 'powers-of-ten') {
    const coefficient = rng.pick(band >= 3 ? [.045, .72, 1.25, 3.6, 8.04] : [1.2, 2.5, 4.5, 6.4, 7.5]); const exponent = rng.int(2, band >= 3 ? 6 : 4)
    const answer = rounded(coefficient * 10 ** exponent, 3)
    return { id: id('powers', seed), family: 'powers', variant, label: 'Powers of ten', prompt: `${coefficient} × 10^${exponent}`, difficulty: level, responseTargetMs: band >= 3 ? 6500 : 5000, answer: { kind: 'number', value: answer }, explanation: `Move the decimal ${exponent} places right: ${answer}.` }
  }
  if (variant === 'remainder') {
    const divisor = rng.int(3, band >= 2 ? 19 : 11); const quotient = rng.int(5, 20 + level * 3); const remainder = rng.int(1, divisor - 1); const dividend = divisor * quotient + remainder
    return { id: id('powers', seed), family: 'powers', variant, label: 'Remainders', prompt: `${dividend} ÷ ${divisor}`, instruction: 'What is the remainder?', difficulty: level, responseTargetMs: band >= 2 ? 7200 : 6000, answer: { kind: 'number', value: remainder }, explanation: `${divisor} × ${quotient} = ${divisor * quotient}; ${dividend} − ${divisor * quotient} = ${remainder}.` }
  }
  if (variant === 'divisibility') {
    const divisor = rng.pick([3, 4, 6, 8, 9, 11]); const multiple = divisor * rng.int(12, 45)
    const values = rng.shuffle([multiple, multiple + 1, multiple - 1, multiple + Math.max(2, divisor - 2)])
    const options = values.map((value) => ({ id: `${value}`, label: `${value}` }))
    return { id: id('powers', seed), family: 'powers', variant, label: 'Divisibility', prompt: `Which number is divisible by ${divisor}?`, difficulty: level, responseTargetMs: 7000, answer: { kind: 'choice', value: `${multiple}` }, options, explanation: `${multiple} ÷ ${divisor} = ${multiple / divisor} with no remainder.` }
  }
  if (variant === 'exponent-product' || variant === 'exponent-quotient') {
    const base = rng.int(2, 9); const first = rng.int(3, 8); const second = variant === 'exponent-product' ? rng.int(2, 7) : rng.int(1, first - 1)
    const answer = variant === 'exponent-product' ? first + second : first - second
    return { id: id('powers', seed), family: 'powers', variant, label: 'Exponent laws', prompt: `${base}^${first} ${variant === 'exponent-product' ? '×' : '÷'} ${base}^${second} = ${base}^?`, instruction: 'Find the missing exponent.', difficulty: level, responseTargetMs: 7600, answer: { kind: 'number', value: answer }, explanation: `With the same base, ${variant === 'exponent-product' ? 'add' : 'subtract'} the exponents: ${first} ${variant === 'exponent-product' ? '+' : '−'} ${second} = ${answer}.` }
  }
  if (variant === 'scientific-multiplication') {
    const coefficientA = rng.int(2, 8); const coefficientB = rng.int(2, 8); const exponentA = rng.int(2, 5); const exponentB = rng.int(1, 4)
    const answer = coefficientA * coefficientB * 10 ** (exponentA + exponentB)
    return { id: id('powers', seed), family: 'powers', variant, label: 'Scientific notation', prompt: `(${coefficientA} × 10^${exponentA}) × (${coefficientB} × 10^${exponentB})`, difficulty: level, responseTargetMs: 10500, answer: { kind: 'number', value: answer }, explanation: `${coefficientA} × ${coefficientB} = ${coefficientA * coefficientB}, and add the exponents: ${exponentA} + ${exponentB} = ${exponentA + exponentB}. The value is ${answer}.` }
  }
  if (variant === 'last-digit-power') {
    const base = rng.pick([2, 3, 4, 7, 8, 9]); const exponent = rng.int(5, 18)
    const cycles: Record<number, number[]> = { 2: [2, 4, 8, 6], 3: [3, 9, 7, 1], 4: [4, 6], 7: [7, 9, 3, 1], 8: [8, 4, 2, 6], 9: [9, 1] }
    const cycle = cycles[base]; const answer = cycle[(exponent - 1) % cycle.length]
    return { id: id('powers', seed), family: 'powers', variant, label: 'Power cycles', prompt: `What is the final digit of ${base}^${exponent}?`, difficulty: level, responseTargetMs: 9500, answer: { kind: 'number', value: answer }, explanation: `The final digits of powers of ${base} repeat as ${cycle.join(', ')}. Position ${exponent} in that cycle gives ${answer}.` }
  }
  const root = rng.int(8, 18); const base = rng.int(3, 9); const answer = root + base ** 2
  return { id: id('powers', seed), family: 'powers', variant: 'combined-root-power', label: 'Combined powers', prompt: `√${root ** 2} + ${base}²`, difficulty: level, responseTargetMs: 8500, answer: { kind: 'number', value: answer }, explanation: `√${root ** 2} = ${root} and ${base}² = ${base ** 2}; ${root} + ${base ** 2} = ${answer}.` }
}

function estimation(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['product', 'sum-difference']
    : band === 1
      ? ['product', 'sum-difference', 'quotient']
      : band === 2
        ? level >= 7
          ? ['order-of-magnitude', 'percentage-estimate', 'multi-step-estimate', 'budget-estimate']
          : ['product', 'quotient', 'order-of-magnitude', 'percentage-estimate', 'multi-step-estimate']
        : ['order-of-magnitude', 'percentage-estimate', 'multi-step-estimate', 'budget-estimate']
  const variant = rng.pick(available)
  if (variant === 'product') {
    const a = rng.int(12, 70 + level * 8); const b = rng.int(12, 60 + level * 7)
    const exact = a * b; const rounding = level < 4 ? 100 : 10; const nearest = Math.round(exact / rounding) * rounding
    const options = uniqueNumberOptions(rng, nearest, rounding)
    return { id: id('estimation', seed), family: 'estimation', variant: 'product', label: 'Estimate a product', prompt: `Best estimate for ${a} × ${b}`, difficulty: level, responseTargetMs: 5000, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `${a} × ${b} = ${exact}, which rounds to ${nearest}.` }
  }
  if (variant === 'sum-difference') {
    const a = rng.int(120, 700 + level * 50); const b = rng.int(80, a - 10); const subtract = rng.next() < .5
    const exact = subtract ? a - b : a + b; const nearest = Math.round(exact / 100) * 100
    const options = uniqueNumberOptions(rng, nearest, 100)
    return { id: id('estimation', seed), family: 'estimation', variant: subtract ? 'difference' : 'sum', label: subtract ? 'Estimate a difference' : 'Estimate a sum', prompt: `Best estimate for ${a} ${subtract ? '−' : '+'} ${b}`, difficulty: level, responseTargetMs: 4800, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `The exact result is ${exact}, which is closest to ${nearest}.` }
  }
  if (variant === 'quotient') {
    const divisor = rng.int(6, 18); const quotient = rng.int(12, 60 + level * 3); const dividend = divisor * quotient + rng.int(-Math.floor(divisor / 2), Math.floor(divisor / 2))
    const exact = dividend / divisor; const nearest = Math.round(exact / 5) * 5
    const options = uniqueNumberOptions(rng, nearest, 5)
    return { id: id('estimation', seed), family: 'estimation', variant: 'quotient', label: 'Estimate a quotient', prompt: `Best estimate for ${dividend} ÷ ${divisor}`, difficulty: level, responseTargetMs: 5500, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `${dividend} ÷ ${divisor} ≈ ${rounded(exact, 1)}, which is closest to ${nearest}.` }
  }
  if (variant === 'order-of-magnitude') {
    const exponent = rng.int(2, 6); const value = rng.int(2, 8) * 10 ** exponent
    const answer = 10 ** Math.round(Math.log10(value))
    const candidates = [10 ** Math.max(0, exponent - 1), 10 ** exponent, 10 ** (exponent + 1), 10 ** (exponent + 2)]
    const options = rng.shuffle([...new Set(candidates)]).map((candidate) => ({ id: `${candidate}`, label: candidate.toLocaleString('en-GB') }))
    return { id: id('estimation', seed), family: 'estimation', variant, label: 'Order of magnitude', prompt: `Closest power of 10 to ${value.toLocaleString('en-GB')}`, difficulty: level, responseTargetMs: 6000, answer: { kind: 'choice', value: `${answer}` }, options, explanation: `${value.toLocaleString('en-GB')} is closest to ${answer.toLocaleString('en-GB')}.` }
  }
  if (variant === 'percentage-estimate') {
    const percent = rng.pick([7, 11, 14, 19, 23, 31, 48, 62]); const base = rng.int(145, 680)
    const exact = percent * base / 100; const rounding = exact >= 100 ? 10 : 5; const nearest = Math.round(exact / rounding) * rounding
    const options = uniqueNumberOptions(rng, nearest, rounding)
    return { id: id('estimation', seed), family: 'estimation', variant, label: 'Estimate a percentage', prompt: `Best estimate for ${percent}% of ${base}`, difficulty: level, responseTargetMs: 7200, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `${percent}% of ${base} is ${rounded(exact, 2)}, closest to ${nearest}. A useful mental estimate is ${Math.round(percent / 5) * 5}% of about ${Math.round(base / 50) * 50}.` }
  }
  if (variant === 'multi-step-estimate') {
    const units = rng.int(24, 85); const price = rng.int(14, 68); const extra = rng.int(180, 760); const exact = units * price + extra
    const nearest = Math.round(exact / 100) * 100
    const options = uniqueNumberOptions(rng, nearest, 100)
    return { id: id('estimation', seed), family: 'estimation', variant, label: 'Multi-step estimate', prompt: `${units} items at £${price} each, plus £${extra} setup`, instruction: 'Choose the best estimate of the total.', difficulty: level, responseTargetMs: 8200, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `The exact total is ${units} × ${price} + ${extra} = £${exact}, which rounds to £${nearest}.` }
  }
  const licenses = rng.int(35, 85); const unitPrice = rng.int(145, 295); const feePercent = rng.pick([6, 8, 12, 15]); const exact = licenses * unitPrice * (1 + feePercent / 100)
  const nearest = Math.round(exact / 1000) * 1000
  const options = uniqueNumberOptions(rng, nearest, 1000, (value) => `£${value.toLocaleString('en-GB')}`)
  return { id: id('estimation', seed), family: 'estimation', variant: 'budget-estimate', label: 'Budget estimate', prompt: `${licenses} licences at £${unitPrice}, plus a ${feePercent}% implementation fee`, instruction: 'Choose the closest total budget.', difficulty: level, responseTargetMs: 10000, answer: { kind: 'choice', value: `${nearest}` }, options, explanation: `The exact total is £${rounded(exact, 2)}, which is closest to £${nearest.toLocaleString('en-GB')}.` }
}

function sequences(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['arithmetic', 'geometric', 'alternating-gaps']
    : band === 1
      ? ['arithmetic', 'geometric', 'alternating-gaps', 'growing-gaps', 'square-offset', 'interleaved']
      : band === 2
        ? level >= 7
          ? ['growing-gaps', 'square-offset', 'interleaved', 'multiply-add', 'alternating-operations', 'gap-cycle', 'recurrence']
          : ['geometric', 'alternating-gaps', 'growing-gaps', 'square-offset', 'interleaved', 'multiply-add', 'alternating-operations']
        : ['interleaved', 'multiply-add', 'alternating-operations', 'gap-cycle', 'recurrence', 'paired-products']
  const variant = rng.pick(available)
  let values: number[] = []
  let explanation = ''
  let distractors: number[] = []

  if (variant === 'arithmetic') {
    const start = rng.int(2, 28); const step = rng.int(2, 6 + level)
    values = Array.from({ length: 7 }, (_, index) => start + step * index)
    distractors = [values[5], values[5] + step * 2, values[5] - step]
    explanation = `Every term increases by ${step}. The next term is ${values[5]} + ${step} = ${values[6]}.`
  } else if (variant === 'geometric') {
    const start = rng.int(1, 4); const factor = rng.int(2, band >= 2 ? 4 : 3)
    values = Array.from({ length: 7 }, (_, index) => start * factor ** index)
    distractors = [values[5] + factor, values[5] * Math.max(1, factor - 1), values[6] + start * factor]
    explanation = `Each term is multiplied by ${factor}. ${values[5]} × ${factor} = ${values[6]}.`
  } else if (variant === 'alternating-gaps') {
    const start = rng.int(2, 15); const first = rng.int(2, 6); const second = first + rng.int(2, 7)
    values = [start]
    for (let index = 0; index < 6; index += 1) values.push(values[index] + (index % 2 === 0 ? first : second))
    distractors = [values[5] + first, values[5] + first + second, values[6] + second - first]
    explanation = `The gaps alternate +${first}, +${second}. The next gap is +${second}, giving ${values[6]}.`
  } else if (variant === 'growing-gaps') {
    const start = rng.int(1, 12); const firstGap = rng.int(2, 6); const growth = rng.int(1, band >= 3 ? 4 : 3)
    values = [start]
    for (let index = 0; index < 6; index += 1) values.push(values[index] + firstGap + index * growth)
    const gaps = Array.from({ length: 6 }, (_, index) => firstGap + index * growth)
    distractors = [values[5] + gaps[4], values[6] - growth, values[6] + growth]
    explanation = `The gaps are ${gaps.slice(0, 5).join(', ')}, increasing by ${growth}. The next gap is ${gaps[5]}, so the answer is ${values[6]}.`
  } else if (variant === 'square-offset') {
    const firstBase = rng.int(1, 5); const offset = rng.int(1, 12)
    values = Array.from({ length: 7 }, (_, index) => (firstBase + index) ** 2 + offset)
    distractors = [(firstBase + 6) ** 2, values[5] + (values[5] - values[4]), (firstBase + 7) ** 2 + offset]
    explanation = `The terms are consecutive squares plus ${offset}. ${firstBase + 6}² + ${offset} = ${values[6]}.`
  } else if (variant === 'interleaved') {
    const firstStart = rng.int(2, 12); const secondStart = rng.int(18, 38); const firstStep = rng.int(3, 9); let secondMagnitude = rng.int(2, 7); const secondDirection = rng.next() < .5 ? 1 : -1
    if (secondDirection > 0 && secondMagnitude === firstStep) secondMagnitude = secondMagnitude === 7 ? 2 : secondMagnitude + 1
    const secondStep = secondMagnitude * secondDirection
    values = Array.from({ length: 7 }, (_, index) => index % 2 === 0 ? firstStart + Math.floor(index / 2) * firstStep : secondStart + Math.floor(index / 2) * secondStep)
    distractors = [values[5] + firstStep, values[5] + secondStep, values[4] + secondStep]
    explanation = `Odd-position terms rise by ${firstStep}; even-position terms ${secondStep >= 0 ? 'rise' : 'fall'} by ${Math.abs(secondStep)}. The next odd-position term is ${values[6]}.`
  } else if (variant === 'multiply-add') {
    const start = rng.int(1, 5); const factor = rng.int(2, 3); const offset = rng.int(1, 6)
    values = [start]
    for (let index = 0; index < 6; index += 1) values.push(values[index] * factor + offset)
    distractors = [values[5] * factor, values[5] + offset, values[6] - offset]
    explanation = `Apply ×${factor}, then +${offset} each time. ${values[5]} × ${factor} + ${offset} = ${values[6]}.`
  } else if (variant === 'alternating-operations') {
    const start = rng.int(2, 7); const factor = rng.int(2, 3); const addition = rng.int(3, 9)
    values = [start]
    for (let index = 0; index < 6; index += 1) values.push(index % 2 === 0 ? values[index] * factor : values[index] + addition)
    distractors = [values[5] * factor, values[5] + addition * 2, values[6] - addition]
    explanation = `The operations alternate ×${factor}, +${addition}. The sixth-to-seventh step is +${addition}, so ${values[5]} becomes ${values[6]}.`
  } else if (variant === 'gap-cycle') {
    const start = rng.int(3, 14); const gaps = rng.shuffle([rng.int(2, 5), rng.int(7, 11), rng.int(13, 18)])
    values = [start]
    for (let index = 0; index < 6; index += 1) values.push(values[index] + gaps[index % 3])
    distractors = [values[5] + gaps[0], values[5] + gaps[1], values[5] + gaps[2] + gaps[0]]
    explanation = `The three gaps repeat: +${gaps.join(', +')}. After the second full cycle, the next term is ${values[6]}.`
  } else if (variant === 'recurrence') {
    const first = rng.int(1, 5); const second = rng.int(3, 8); const offset = rng.int(0, 3)
    values = [first, second]
    while (values.length < 7) values.push(values.at(-1)! + values.at(-2)! + offset)
    distractors = [values[5] + values[4], values[5] * 2 + offset, values[6] + values[3]]
    explanation = `Each term is the previous two added together${offset ? `, then +${offset}` : ''}. ${values[4]} + ${values[5]}${offset ? ` + ${offset}` : ''} = ${values[6]}.`
  } else {
    const firstBase = rng.int(2, 5); const offset = rng.int(2, 6)
    values = Array.from({ length: 7 }, (_, index) => { const base = firstBase + index; return base * (base + offset) })
    distractors = [(firstBase + 6) ** 2, (firstBase + 5) * (firstBase + 6 + offset), (firstBase + 6) * (firstBase + 5 + offset)]
    explanation = `Each term has the form n × (n + ${offset}). Next, ${firstBase + 6} × ${firstBase + 6 + offset} = ${values[6]}.`
  }

  const answer = values[6]
  const options = plausibleNumberOptions(rng, answer, distractors)
  return { id: id('sequences', seed), family: 'sequences', variant, label: 'Sequence Lab', prompt: `${values.slice(0, 6).join('   ·   ')}   ·   ?`, instruction: 'What comes next?', difficulty: level, responseTargetMs: [6500, 8500, 10500, 12500][band], answer: { kind: 'choice', value: `${answer}` }, options, explanation }
}

function token(shape: VisualToken['shape'], rotation: number, count: number, filled: boolean): VisualToken {
  return { shape, rotation: ((rotation % 360) + 360) % 360, count, filled, position: 'center' }
}

function visualTokenKey(value: VisualToken) {
  return `${value.shape}:${value.rotation ?? 0}:${value.count ?? 1}:${value.filled ? 1 : 0}:${value.position ?? 'center'}`
}

function visualChoices(rng: RandomSource, answer: VisualToken, distractors: VisualToken[], prefix: string) {
  const unique = new Map<string, VisualToken>()
  ;[answer, ...distractors].forEach((value) => unique.set(visualTokenKey(value), value))
  const fallbackShapes: VisualToken['shape'][] = ['arrow', 'triangle', 'diamond', 'square', 'circle']
  let fallback = 0
  while (unique.size < 4) {
    const value = token(fallbackShapes[fallback % fallbackShapes.length], (answer.rotation ?? 0) + 45 * (fallback + 1), ((answer.count ?? 1) + fallback) % 3 + 1, fallback % 2 === 0 ? !answer.filled : !!answer.filled)
    unique.set(visualTokenKey(value), value)
    fallback += 1
  }
  const values = rng.shuffle([...unique.values()].slice(0, 4))
  const options = values.map((visual, index) => ({ id: `${prefix}${index}`, label: `Option ${index + 1}`, visual }))
  return { options, answerId: options.find((option) => visualTokenKey(option.visual!) === visualTokenKey(answer))!.id }
}

function matrix(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['rotation-2x2', 'fill-2x2']
    : band === 1
      ? ['rotation-2x2', 'fill-2x2', 'count-cycle', 'shape-cycle', 'row-rotation']
      : band === 2
        ? level >= 7 ? ['count-cycle', 'shape-cycle', 'row-rotation', 'dual-axis', 'attribute-latin', 'row-composition'] : ['fill-2x2', 'count-cycle', 'shape-cycle', 'row-rotation', 'dual-axis']
        : ['dual-axis', 'attribute-latin', 'row-composition', 'column-composition', 'combined-transform']
  const variant = rng.pick(available)
  const shape = rng.pick<VisualToken['shape']>(['triangle', 'arrow', 'diamond'])
  let columns = variant.endsWith('2x2') ? 2 : 3
  let cells: VisualToken[] = []
  let explanation = ''
  let instruction = 'Choose the tile that completes every row and column.'

  if (variant === 'rotation-2x2') {
    const start = rng.pick([0, 45, 90, 180]); const across = rng.pick([90, 180]); const down = rng.pick([45, 90])
    cells = [token(shape, start, 1, false), token(shape, start + across, 1, false), token(shape, start + down, 1, false), token(shape, start + down + across, 1, false)]
    explanation = `Moving right rotates ${across}°; moving down rotates ${down}°. Both transformations lead to the missing orientation.`
  } else if (variant === 'fill-2x2') {
    const firstFilled = rng.next() < .5
    cells = [token(shape, 0, 1, firstFilled), token(shape, 0, 1, !firstFilled), token(shape, 0, 1, !firstFilled), token(shape, 0, 1, firstFilled)]
    explanation = 'Fill alternates both across and down, so diagonal tiles match.'
  } else if (variant === 'count-cycle') {
    const offset = rng.int(0, 2)
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, row * 45, (row + column + offset) % 3 + 1, row % 2 === 0) })
    explanation = 'Counts cycle 1 → 2 → 3 across each row, shifted one place in the next row. Fill stays consistent within each row.'
  } else if (variant === 'shape-cycle') {
    const shapes = rng.shuffle<VisualToken['shape']>(['circle', 'square', 'diamond'])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], column * 45, 1, row === column) })
    explanation = 'The three shapes shift one position left on each row; diagonal cells are filled.'
  } else if (variant === 'row-rotation') {
    const start = rng.pick([0, 45, 90]); const across = rng.pick([45, 90]); const down = rng.pick([45, 90])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, start + row * down + column * across, row + 1, column % 2 === 0) })
    explanation = `Across each row the symbol rotates ${across}° and fill alternates; moving down adds ${down}° and one symbol.`
  } else if (variant === 'dual-axis') {
    const across = rng.pick([45, 90]); const down = rng.pick([90, 135])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, row * down + column * across, (row + column) % 3 + 1, (row + column) % 2 === 0) })
    explanation = `Rows rotate ${across}° per step; columns add ${down}°. Count cycles 1–2–3 and fill follows a checkerboard pattern.`
  } else if (variant === 'attribute-latin') {
    const shapes = rng.shuffle<VisualToken['shape']>(['circle', 'triangle', 'diamond'])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], (row * 90 + column * 45), (row * 2 + column) % 3 + 1, row === column) })
    explanation = 'Shape and count each cycle through three values with a row shift; only the main diagonal is filled.'
  } else if (variant === 'row-composition' || variant === 'column-composition') {
    const rows = [
      [token(shape, 0, 1, true), token(shape, 90, 1, false)],
      [token(shape, 90, 1, false), token(shape, 90, 2, true)],
      [token(shape, 0, 2, true), token(shape, 180, 1, false)],
    ]
    const composed = rows.map(([first, second]) => token(shape, (first.rotation ?? 0) + (second.rotation ?? 0), (first.count ?? 1) + (second.count ?? 1), !!first.filled !== !!second.filled))
    cells = variant === 'row-composition'
      ? rows.flatMap((row, index) => [...row, composed[index]])
      : [rows[0][0], rows[1][0], rows[2][0], rows[0][1], rows[1][1], rows[2][1], composed[0], composed[1], composed[2]]
    instruction = `In each ${variant === 'row-composition' ? 'row' : 'column'}, the third tile combines the first two.`
    explanation = `The third tile adds the symbol counts and rotations; it is filled only when exactly one source tile is filled.`
  } else {
    const shapes = rng.shuffle<VisualToken['shape']>(['arrow', 'triangle', 'diamond'])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], row * 45 + column * 90, (row + column * 2) % 3 + 1, (row * 2 + column) % 2 === 0) })
    explanation = 'Moving across changes shape, adds 90° and advances count by two; moving down changes shape, adds 45° and advances count by one.'
  }

  const answerToken = cells.at(-1)!
  const distractors = [
    token(answerToken.shape, (answerToken.rotation ?? 0) + 45, answerToken.count ?? 1, !!answerToken.filled),
    token(answerToken.shape, answerToken.rotation ?? 0, answerToken.count ?? 1, !answerToken.filled),
    token(answerToken.shape, answerToken.rotation ?? 0, (answerToken.count ?? 1) % 3 + 1, !!answerToken.filled),
    token(answerToken.shape === 'diamond' ? 'triangle' : 'diamond', answerToken.rotation ?? 0, answerToken.count ?? 1, !!answerToken.filled),
  ]
  const choices = visualChoices(rng, answerToken, distractors, 'm')
  const visibleCells: Array<VisualToken | null> = [...cells]
  visibleCells[visibleCells.length - 1] = null
  const prompt = rng.pick([
    variant.endsWith('2x2') ? 'Complete the 2×2 matrix' : 'Complete the 3×3 matrix',
    'Which tile belongs in the empty cell?',
    'Find the missing tile',
    'Continue the row-and-column pattern',
  ])
  return { id: id('matrix', seed), family: 'matrix', variant, label: 'Matrix Logic', prompt, instruction, difficulty: level, responseTargetMs: [8500, 11000, 14000, 17000][band], answer: { kind: 'choice', value: choices.answerId }, options: choices.options, visual: { kind: 'matrix', columns, cells: visibleCells }, explanation }
}

function ruleBreaker(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['fill-alternation', 'rotation-grid']
    : band === 1
      ? ['fill-alternation', 'rotation-grid', 'count-cycle', 'shape-cycle', 'row-signature']
      : band === 2
        ? level >= 7 ? ['count-cycle', 'shape-cycle', 'row-signature', 'column-signature', 'dual-attribute'] : ['rotation-grid', 'count-cycle', 'shape-cycle', 'row-signature', 'column-signature']
        : ['row-signature', 'column-signature', 'dual-attribute', 'triple-attribute', 'diagonal-rule']
  const variant = rng.pick(available)
  const shape = rng.pick<VisualToken['shape']>(['triangle', 'arrow', 'diamond'])
  const shapes: VisualToken['shape'][] = ['circle', 'triangle', 'diamond']
  const breaker = rng.int(0, 8)
  let cells: VisualToken[] = []
  let explanation = ''

  if (variant === 'fill-alternation') {
    cells = Array.from({ length: 9 }, (_, index) => token(shape, 0, 1, index % 2 === 0))
    cells[breaker] = { ...cells[breaker], filled: !cells[breaker].filled }
    explanation = 'Fill should alternate outline/filled from one numbered tile to the next.'
  } else if (variant === 'rotation-grid') {
    const step = rng.pick([45, 90])
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, (row + column) * step, 1, row % 2 === 0) })
    cells[breaker] = { ...cells[breaker], rotation: ((cells[breaker].rotation ?? 0) + step) % 360 }
    explanation = `Orientation should advance ${step}° both across and down the grid.`
  } else if (variant === 'count-cycle') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, row * 45, (row + column) % 3 + 1, column % 2 === 0) })
    cells[breaker] = { ...cells[breaker], count: (cells[breaker].count ?? 1) % 3 + 1 }
    explanation = 'Counts should cycle 1–2–3 across each row, shifting one place on the next row.'
  } else if (variant === 'shape-cycle') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], column * 45, row + 1, row === column) })
    const expected = cells[breaker].shape
    cells[breaker] = { ...cells[breaker], shape: shapes[(shapes.indexOf(expected) + 1) % shapes.length] }
    explanation = 'Circle, triangle and diamond should each appear once per row and column.'
  } else if (variant === 'row-signature') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[row], column * 90, column + 1, row % 2 === 0) })
    cells[breaker] = { ...cells[breaker], shape: shapes[(Math.floor(breaker / 3) + 1) % 3] }
    explanation = 'Each row should use one shape while count rises 1–2–3 and rotation advances 90°.'
  } else if (variant === 'column-signature') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, column * 45, column + 1, row % 2 === 0) })
    cells[breaker] = { ...cells[breaker], rotation: ((cells[breaker].rotation ?? 0) + 45) % 360 }
    explanation = 'Every column should share its count and orientation while fill alternates down the rows.'
  } else if (variant === 'dual-attribute') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shape, row * 45 + column * 90, (row + column) % 3 + 1, (row + column) % 2 === 0) })
    cells[breaker] = { ...cells[breaker], filled: !cells[breaker].filled }
    explanation = 'Rotation is determined by row and column, count cycles diagonally, and fill should form a checkerboard. One fill state breaks that combined rule.'
  } else if (variant === 'triple-attribute') {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], row * 90 + column * 45, (row * 2 + column) % 3 + 1, row === column) })
    cells[breaker] = { ...cells[breaker], count: (cells[breaker].count ?? 1) % 3 + 1 }
    explanation = 'Shape, orientation and count each follow their own shifted cycle; the incorrect tile advances count one place too far.'
  } else {
    cells = Array.from({ length: 9 }, (_, index) => { const row = Math.floor(index / 3); const column = index % 3; return token(shapes[(row + column) % 3], column * 90, row + 1, row === column) })
    cells[breaker] = { ...cells[breaker], filled: !cells[breaker].filled }
    explanation = 'Only the main diagonal should be filled; shape cycles across columns and count identifies the row.'
  }

  const options = cells.map((_, index) => ({ id: `r${index}`, label: `${index + 1}` }))
  const prompt = rng.pick([
    'Which tile breaks the grid rule?',
    'Find the single inconsistent tile',
    'One tile violates the pattern—which one?',
    'Identify the odd tile',
  ])
  return { id: id('rule-breaker', seed), family: 'rule-breaker', variant, label: 'Rule Breaker', prompt, instruction: 'Tiles are numbered left to right, top to bottom.', difficulty: level, responseTargetMs: [7500, 10000, 12500, 15000][band], answer: { kind: 'choice', value: `r${breaker}` }, options, visual: { kind: 'tiles', columns: 3, cells }, explanation: `Tile ${breaker + 1} is inconsistent. ${explanation}` }
}

type OrderEdge = [string, string]

function orderIsValid(order: string[], edges: OrderEdge[]) {
  return edges.every(([before, after]) => order.indexOf(before) < order.indexOf(after))
}

function orderOptions(rng: RandomSource, correctOrder: string[], edges: OrderEdge[]) {
  const correct = correctOrder.join(' → ')
  const invalid = new Set<string>()
  for (const [before, after] of edges) {
    const candidate = [...correctOrder]
    const first = candidate.indexOf(before); const second = candidate.indexOf(after)
    ;[candidate[first], candidate[second]] = [candidate[second], candidate[first]]
    if (!orderIsValid(candidate, edges)) invalid.add(candidate.join(' → '))
  }
  for (let attempt = 0; invalid.size < 3 && attempt < 80; attempt += 1) {
    const candidate = rng.shuffle(correctOrder)
    if (!orderIsValid(candidate, edges)) invalid.add(candidate.join(' → '))
  }
  return choiceOptions(rng, correct, [...invalid].slice(0, 3))
}

const constraintContexts = [
  { label: 'release pipeline', items: ['Compile', 'Unit tests', 'Security scan', 'Package', 'Deploy', 'Smoke test'] },
  { label: 'service startup', items: ['Database', 'Cache', 'Auth', 'API', 'Worker', 'Gateway'] },
  { label: 'incident response', items: ['Logs', 'Trace', 'Reproduce', 'Patch', 'Review', 'Release'] },
  { label: 'data workflow', items: ['Ingest', 'Validate', 'Transform', 'Index', 'Publish', 'Monitor'] },
  { label: 'change request', items: ['Scope', 'Design', 'Build', 'Test', 'Approve', 'Rollout'] },
]

function constraints(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['direct-chain', 'must-be-true']
    : band === 1
      ? ['direct-chain', 'must-be-true', 'branch-order', 'fixed-slot']
      : band === 2
        ? level >= 7 ? ['branch-order', 'fixed-slot', 'dependency-chain', 'assignment', 'conditional-chain'] : ['must-be-true', 'branch-order', 'fixed-slot', 'dependency-chain', 'assignment']
        : ['branch-order', 'fixed-slot', 'dependency-chain', 'assignment', 'conditional-chain', 'exclusive-branch']
  const variant = rng.pick(available)
  const context = rng.pick(constraintContexts)
  const items = rng.shuffle(context.items)

  if (variant === 'direct-chain') {
    const [a, b, c, d] = items
    const edges: OrderEdge[] = [[a, b], [b, c], [c, d]]
    const options = orderOptions(rng, [a, b, c, d], edges)
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `${a} must finish before ${b}.\n${c} cannot start until ${b} finishes.\n${d} is scheduled after ${c}.`, instruction: `Which ${context.label} order satisfies every rule?`, difficulty: level, responseTargetMs: 7500, answer: { kind: 'choice', value: [a, b, c, d].join(' → ') }, options, explanation: `The dependencies form one chain: ${a} → ${b} → ${c} → ${d}.` }
  }

  if (variant === 'must-be-true') {
    const [a, b, c, d, e] = items
    const correct = `${c} is before ${e}`
    const options = choiceOptions(rng, correct, [`${e} is before ${b}`, `${c} is before ${a}`, `${a} is before ${b}`])
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `${a} and ${b} both precede ${c}.\n${d} is scheduled after ${b}.\n${e} cannot begin until ${c} is complete.`, instruction: 'Which statement must be true?', difficulty: level, responseTargetMs: band === 0 ? 8000 : 9500, answer: { kind: 'choice', value: correct }, options, explanation: `${c} must precede ${e}; the relative order of ${a}, ${b} and ${d} is not fully fixed.` }
  }

  if (variant === 'branch-order') {
    const [a, b, c, d, e] = items
    const edges: OrderEdge[] = [[a, c], [b, c], [c, e], [d, e]]
    const correctOrder = [a, b, c, d, e]
    const options = orderOptions(rng, correctOrder, edges)
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `Before ${c}: ${a} and ${b} must both finish.\nBefore ${e}: ${c} and ${d} must both finish.\nIndependent steps may run in either order.`, instruction: `Which ${context.label} order could be valid?`, difficulty: level, responseTargetMs: band >= 3 ? 13500 : 11000, answer: { kind: 'choice', value: correctOrder.join(' → ') }, options, explanation: `${a} and ${b} must precede ${c}; both ${c} and ${d} must precede ${e}. The selected order respects all four dependencies.` }
  }

  if (variant === 'fixed-slot') {
    const [a, b, c, d, e] = items
    const edges: OrderEdge[] = [[a, b], [a, c], [c, d], [d, e]]
    const correctOrder = [a, b, c, d, e]
    const options = orderOptions(rng, correctOrder, edges)
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `${b} occupies the slot immediately after ${a}.\n${c} occupies slot 3.\n${d} is scheduled after ${c}, and ${e} after ${d}.`, instruction: 'Which five-slot schedule could be correct?', difficulty: level, responseTargetMs: band >= 2 ? 13000 : 11000, answer: { kind: 'choice', value: correctOrder.join(' → ') }, options, explanation: `${a} and ${b} fill slots 1–2, ${c} is fixed in slot 3, and ${d} must precede ${e}.` }
  }

  if (variant === 'dependency-chain') {
    const dependencySets = [
      { target: 'Gateway', direct: 'API', intermediate: 'Auth', root: 'Identity store', extras: ['Queue', 'Metrics', 'Worker'] },
      { target: 'Dashboard', direct: 'Query API', intermediate: 'Search index', root: 'Ingest job', extras: ['Mailer', 'Cache warmer', 'Feature flags'] },
      { target: 'Release', direct: 'Package', intermediate: 'Test suite', root: 'Build', extras: ['Analytics', 'Docs', 'Backups'] },
    ]
    const set = rng.pick(dependencySets)
    const correct = `${set.root} must be ready`
    const options = choiceOptions(rng, correct, set.extras.map((extra) => `${extra} must be ready`))
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `${set.target} requires ${set.direct}.\n${set.direct} requires ${set.intermediate}.\n${set.intermediate} requires ${set.root}.`, instruction: `If ${set.target} is available, which condition is guaranteed?`, difficulty: level, responseTargetMs: 11500, answer: { kind: 'choice', value: correct }, options, explanation: `Follow the dependency chain backwards: ${set.target} → ${set.direct} → ${set.intermediate} → ${set.root}.` }
  }

  if (variant === 'assignment') {
    const people = rng.shuffle(['Ava', 'Ben', 'Chen'])
    const work = rng.shuffle(['API', 'UI', 'Database'])
    const [ava, ben, chen] = people; const [api, ui, database] = work
    const correct = `${ava}: ${ui} · ${ben}: ${api} · ${chen}: ${database}`
    const distractors = [
      `${ava}: ${database} · ${ben}: ${api} · ${chen}: ${ui}`,
      `${ava}: ${api} · ${ben}: ${ui} · ${chen}: ${database}`,
      `${ava}: ${ui} · ${ben}: ${database} · ${chen}: ${api}`,
    ]
    const options = choiceOptions(rng, correct, distractors)
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `${chen} owns ${database}.\n${ava} cannot own ${database} or ${api}.\n${ben} cannot own ${ui}.\nEach person owns exactly one area.`, instruction: 'Which assignment satisfies every constraint?', difficulty: level, responseTargetMs: band >= 3 ? 14000 : 12000, answer: { kind: 'choice', value: correct }, options, explanation: `${chen} is fixed to ${database}; that leaves ${ui} for ${ava} and ${api} for ${ben}.` }
  }

  if (variant === 'conditional-chain') {
    const chains = [
      { first: 'the feature flag is enabled', firstFalse: 'The feature flag is not enabled', second: 'the canary deploy runs', third: 'the health check passes' },
      { first: 'production access is granted', firstFalse: 'Production access is not granted', second: 'MFA succeeds', third: 'the device check passes' },
      { first: 'the migration starts', firstFalse: 'The migration did not start', second: 'the backup completes', third: 'the integrity check passes' },
    ]
    const chain = rng.pick(chains)
    const correct = chain.firstFalse
    const options = choiceOptions(rng, correct, [`${chain.first}`, `${chain.second}`, `${chain.third}`])
    return { id: id('constraints', seed), family: 'constraints', variant, label: 'Constraint Logic', prompt: `If ${chain.first}, then ${chain.second}.\nIf ${chain.second}, then ${chain.third}.\nThe statement “${chain.third}” is false.`, instruction: 'Which conclusion follows logically?', difficulty: level, responseTargetMs: 14500, answer: { kind: 'choice', value: correct }, options, explanation: `Work backwards by contrapositive: because “${chain.third}” is false, ${chain.second} cannot be true; therefore ${chain.first} cannot be true.` }
  }

  const branches = rng.shuffle(['blue deployment', 'green deployment'])
  const outcomes = rng.shuffle(['cache warm-up', 'schema check'])
  const correct = `The ${branches[1]} runs`
  const options = choiceOptions(rng, correct, [`The ${branches[0]} runs`, 'Neither deployment runs', `The ${outcomes[0]} completes`])
  return { id: id('constraints', seed), family: 'constraints', variant: 'exclusive-branch', label: 'Constraint Logic', prompt: `Exactly one of the ${branches[0]} and ${branches[1]} runs.\nIf the ${branches[0]} runs, the ${outcomes[0]} must complete.\nThe ${outcomes[0]} did not complete.`, instruction: 'What must be true?', difficulty: level, responseTargetMs: 15000, answer: { kind: 'choice', value: correct }, options, explanation: `The failed ${outcomes[0]} rules out the ${branches[0]}. Because exactly one deployment runs, the ${branches[1]} must run.` }
}

function dataSprint(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['bar-maximum', 'bar-difference', 'bar-total']
    : band === 1
      ? ['bar-difference', 'bar-total', 'bar-percentage-change', 'table-error-rate']
      : band === 2
        ? ['bar-percentage-change', 'table-error-rate', 'table-success-volume', 'table-conditional-total', 'table-projection']
        : ['table-success-volume', 'table-conditional-total', 'table-projection', 'table-weighted-cost']
  const variant = rng.pick(available)
  const dayLabels = rng.pick([
    ['Mon', 'Tue', 'Wed', 'Thu'],
    ['Q1', 'Q2', 'Q3', 'Q4'],
    ['Node A', 'Node B', 'Node C', 'Node D'],
  ])

  if (variant === 'bar-maximum') {
    const values = rng.shuffle([0, 1, 2, 3]).map((offset) => 80 + rng.int(0, 4) * 10 + offset * 50)
    const best = Math.max(...values); const correct = dayLabels[values.indexOf(best)]
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: 'Which category has the highest value?', instruction: 'Read the chart, then select one answer.', difficulty: level, responseTargetMs: 6500, answer: { kind: 'choice', value: correct }, options: rng.shuffle(dayLabels).map((label) => ({ id: label, label })), visual: { kind: 'bars', labels: dayLabels, values }, explanation: `${correct} is highest at ${best}.` }
  }

  if (variant === 'bar-difference') {
    const values = dayLabels.map(() => rng.int(9, 28) * 20)
    const first = rng.int(0, 2); const second = rng.int(first + 1, 3)
    const answer = Math.abs(values[first] - values[second])
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: `What is the difference between ${dayLabels[first]} and ${dayLabels[second]}?`, instruction: 'Use the values shown above each bar.', difficulty: level, responseTargetMs: band === 0 ? 7500 : 8500, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 20), visual: { kind: 'bars', labels: dayLabels, values }, explanation: `|${values[first]} − ${values[second]}| = ${answer}.` }
  }

  if (variant === 'bar-total') {
    const values = dayLabels.map(() => rng.int(4, 16) * 25)
    const selected = rng.shuffle([0, 1, 2, 3]).slice(0, band === 0 ? 2 : 3).sort()
    const answer = selected.reduce((sum, index) => sum + values[index], 0)
    const names = selected.map((index) => dayLabels[index]).join(', ')
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: `What is the combined total for ${names}?`, instruction: 'Add only the requested categories.', difficulty: level, responseTargetMs: band === 0 ? 8000 : 9500, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 25), visual: { kind: 'bars', labels: dayLabels, values }, explanation: `${selected.map((index) => values[index]).join(' + ')} = ${answer}.` }
  }

  if (variant === 'bar-percentage-change') {
    const before = rng.pick([120, 160, 200, 240, 320, 400])
    const percent = rng.pick([10, 20, 25, 40, 50])
    const increase = rng.next() < .7
    const after = increase ? before * (100 + percent) / 100 : before * (100 - percent) / 100
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: `What was the percentage ${increase ? 'increase' : 'decrease'} from Baseline to Current?`, instruction: 'Calculate the change relative to the baseline.', difficulty: level, responseTargetMs: band >= 2 ? 11500 : 10000, answer: { kind: 'choice', value: `${percent}` }, options: uniqueNumberOptions(rng, percent, 5, (value) => `${value}%`), visual: { kind: 'bars', labels: ['Baseline', 'Current'], values: [before, after] }, explanation: `The change is ${Math.abs(after - before)}; ${Math.abs(after - before)} ÷ ${before} × 100 = ${percent}%.` }
  }

  const services = rng.shuffle(['API', 'Search', 'Worker', 'Billing'])
  if (variant === 'table-error-rate') {
    const rates = rng.shuffle([2, 3, 5, 8])
    const rows = services.map((label, index) => { const requests = rng.int(8, 24) * 100; return { label, values: [requests, requests * rates[index] / 100] } })
    const maxRate = Math.max(...rates); const correct = services[rates.indexOf(maxRate)]
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: 'Which service has the highest error rate?', instruction: 'Compare errors as a proportion of requests—not the error count alone.', difficulty: level, responseTargetMs: band >= 2 ? 12500 : 11000, answer: { kind: 'choice', value: correct }, options: rng.shuffle(services).map((label) => ({ id: label, label })), visual: { kind: 'table', title: 'Last hour', columns: ['Requests', 'Errors'], rows }, explanation: `${correct} has the highest rate: ${maxRate}%.` }
  }

  if (variant === 'table-success-volume') {
    const requests = rng.shuffle([1200, 1500, 1800, 2100])
    const failureRates = rng.shuffle([2, 4, 6, 10])
    const successful = requests.map((value, index) => value * (100 - failureRates[index]) / 100)
    const best = Math.max(...successful); const correct = services[successful.indexOf(best)]
    const rows = services.map((label, index) => ({ label, values: [requests[index], `${failureRates[index]}%`] }))
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: 'Which service completed the most successful requests?', instruction: 'Convert each failure rate into a successful-request total.', difficulty: level, responseTargetMs: band === 3 ? 15500 : 14000, answer: { kind: 'choice', value: correct }, options: rng.shuffle(services).map((label) => ({ id: label, label })), visual: { kind: 'table', title: 'Request summary', columns: ['Requests', 'Failed'], rows }, explanation: `${correct} completed ${best} successful requests, the largest derived total.` }
  }

  if (variant === 'table-conditional-total') {
    const volumes = services.map(() => rng.int(8, 28) * 100)
    const uptime = rng.shuffle([97.5, 98.5, 99, 99.5])
    const threshold = rng.pick([98.5, 99])
    const answer = volumes.reduce((sum, value, index) => sum + (uptime[index] >= threshold ? value : 0), 0)
    const included = services.filter((_, index) => uptime[index] >= threshold)
    const rows = services.map((label, index) => ({ label, values: [volumes[index], `${uptime[index]}%`] }))
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: `How many requests came from services with uptime of at least ${threshold}%?`, instruction: 'Filter the rows first, then total their request volumes.', difficulty: level, responseTargetMs: band === 3 ? 17000 : 15000, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 100), visual: { kind: 'table', title: 'Service reliability', columns: ['Requests', 'Uptime'], rows }, explanation: `${included.join(' and ')} meet the threshold; their volumes total ${answer}.` }
  }

  if (variant === 'table-projection') {
    const current = services.map(() => rng.int(8, 24) * 100)
    const growth = rng.shuffle([5, 10, 15, 20])
    const projected = current.map((value, index) => value * (100 + growth[index]) / 100)
    const chosen = rng.int(0, services.length - 1); const answer = projected[chosen]
    const rows = services.map((label, index) => ({ label, values: [current[index], `${growth[index]}%`] }))
    return { id: id('data-sprint', seed), family: 'data-sprint', variant, label: 'Data Sprint', prompt: `What is ${services[chosen]}'s projected next-period volume?`, instruction: 'Apply the stated growth rate to the current volume.', difficulty: level, responseTargetMs: band === 3 ? 15500 : 13500, answer: { kind: 'choice', value: `${answer}` }, options: plausibleNumberOptions(rng, answer, [current[chosen], answer - current[chosen], current[chosen] * growth[chosen]]), visual: { kind: 'table', title: 'Capacity forecast', columns: ['Current', 'Growth'], rows }, explanation: `${current[chosen]} × ${100 + growth[chosen]}% = ${answer}.` }
  }

  const profiles = rng.shuffle([
    { units: rng.int(10, 12) * 10, unitCost: 8, discount: 0 },
    { units: rng.int(7, 9) * 10, unitCost: 6, discount: 5 },
    { units: rng.int(5, 8) * 10, unitCost: 4, discount: 10 },
    { units: rng.int(4, 7) * 10, unitCost: 3, discount: 20 },
  ])
  const units = profiles.map((profile) => profile.units)
  const unitCost = profiles.map((profile) => profile.unitCost)
  const discounts = profiles.map((profile) => profile.discount)
  const costs = units.map((value, index) => value * unitCost[index] * (100 - discounts[index]) / 100)
  const highest = Math.max(...costs); const correct = services[costs.indexOf(highest)]
  const rows = services.map((label, index) => ({ label, values: [units[index], `£${unitCost[index]}`, `${discounts[index]}%`] }))
  return { id: id('data-sprint', seed), family: 'data-sprint', variant: 'table-weighted-cost', label: 'Data Sprint', prompt: 'Which service has the highest net compute cost?', instruction: 'For each row: units × unit cost, then apply the discount.', difficulty: level, responseTargetMs: 19000, answer: { kind: 'choice', value: correct }, options: rng.shuffle(services).map((label) => ({ id: label, label })), visual: { kind: 'table', title: 'Compute allocation', columns: ['Units', 'Per unit', 'Discount'], rows }, explanation: `${correct} has the largest net cost at £${highest}.` }
}

function mutateIdentifier(value: string, rng: RandomSource) {
  const positions = rng.shuffle(Array.from({ length: value.length }, (_, index) => index).filter((index) => /[A-Za-z0-9]/.test(value[index])))
  const position = positions[0]
  const current = value[position]
  const replacement = /\d/.test(current) ? `${(Number(current) + rng.int(1, 8)) % 10}` : current === current.toUpperCase() ? rng.pick(['Q', 'V', 'X', 'Z']) : rng.pick(['q', 'v', 'x', 'z'])
  return `${value.slice(0, position)}${replacement === current ? '7' : replacement}${value.slice(position + 1)}`
}

function recallOptions(rng: RandomSource, correct: string) {
  const values = new Set([correct])
  while (values.size < 4) values.add(mutateIdentifier(correct, rng))
  return choiceOptions(rng, correct, [...values].filter((value) => value !== correct))
}

function debugScan(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['identifier-recall', 'field-recall']
    : band === 1
      ? ['identifier-recall', 'field-recall', 'config-recall']
      : band === 2
        ? ['config-recall', 'incident-recall', 'mapping-recall', 'rule-audit']
        : ['config-recall', 'incident-recall', 'mapping-recall', 'rule-audit']
  const variant = rng.pick(available)
  const revealMs = band === 0 ? 3300 : band === 1 ? 2800 : band === 2 ? 2300 : 1900

  if (variant === 'identifier-recall') {
    const reference = band === 0
      ? `svc-${rng.int(120, 989)}-${rng.pick(['EU', 'US', 'AP'])}`
      : `svc-${rng.int(120, 989)}-${rng.pick(['EU', 'US', 'AP'])}-${rng.pick(['P', 'R', 'S'])}${rng.int(10, 99)}-${rng.pick(['a7', 'b4', 'f9'])}`
    return { id: id('debug-scan', seed), family: 'debug-scan', variant, label: 'Debug Scan', prompt: 'Which identifier exactly matches the reference?', instruction: 'Choose from memory; punctuation and case both matter.', difficulty: level, responseTargetMs: band === 0 ? 7500 : 9500, answer: { kind: 'choice', value: reference }, options: recallOptions(rng, reference), visual: { kind: 'reference', caption: 'Memorise this identifier', lines: [reference], revealMs }, explanation: `The exact identifier was ${reference}.` }
  }

  if (variant === 'field-recall') {
    const fields = [
      { label: 'REGION', value: rng.pick(['EU-2', 'US-1', 'AP-3']) },
      { label: 'PORT', value: `${rng.pick([443, 8443, 9443])}` },
      { label: 'SHARDS', value: `${rng.int(3, 9)}` },
      { label: 'TIER', value: rng.pick(['SILVER', 'GOLD', 'PLATINUM']) },
    ]
    const shown = fields.slice(0, band === 0 ? 3 : 4); const asked = rng.pick(shown)
    const distractors = asked.label === 'PORT' ? ['443', '7443', '8443', '9443'] : asked.label === 'SHARDS' ? ['3', '5', '7', '9'] : asked.label === 'REGION' ? ['EU-2', 'US-1', 'AP-3', 'EU-3'] : ['SILVER', 'GOLD', 'PLATINUM', 'BRONZE']
    return { id: id('debug-scan', seed), family: 'debug-scan', variant, label: 'Debug Scan', prompt: `What was the ${asked.label} value?`, instruction: 'Recall the requested field after the reference disappears.', difficulty: level, responseTargetMs: band === 0 ? 8000 : 10000, answer: { kind: 'choice', value: asked.value }, options: choiceOptions(rng, asked.value, distractors.filter((value) => value !== asked.value)), visual: { kind: 'reference', caption: 'Memorise this configuration', lines: shown.map((field) => `${field.label.padEnd(7)} ${field.value}`), revealMs }, explanation: `${asked.label} was set to ${asked.value}.` }
  }

  if (variant === 'config-recall') {
    const lines = [
      `cluster = ${rng.pick(['atlas-07', 'nova-12', 'ember-24'])}`,
      `region  = ${rng.pick(['eu-west-2', 'us-east-1', 'ap-south-1'])}`,
      `replica = ${rng.int(3, 8)}`,
      `mode    = ${rng.pick(['active', 'standby', 'drain'])}`,
    ].slice(0, band === 1 ? 3 : 4)
    const reference = lines.join('\n')
    const distractors = lines.map((_, index) => lines.map((line, lineIndex) => lineIndex === index ? mutateIdentifier(line, rng) : line).join('\n')).slice(0, 3)
    return { id: id('debug-scan', seed), family: 'debug-scan', variant, label: 'Debug Scan', prompt: 'Which configuration block is an exact match?', instruction: 'Select the whole block that matches the hidden reference.', difficulty: level, responseTargetMs: band === 3 ? 15500 : 13000, answer: { kind: 'choice', value: reference }, options: choiceOptions(rng, reference, distractors), visual: { kind: 'reference', caption: 'Memorise this configuration', lines, revealMs }, explanation: `The matching block preserves every value and character:\n${reference}` }
  }

  if (variant === 'incident-recall') {
    const events = rng.shuffle([
      { service: 'API', code: 'E17', state: 'RETRY' },
      { service: 'Cache', code: 'W04', state: 'HOLD' },
      { service: 'Queue', code: 'E31', state: 'DROP' },
      { service: 'Auth', code: 'W12', state: 'PASS' },
    ])
    const asked = rng.pick(events); const correct = `${asked.service} · ${asked.code} · ${asked.state}`
    const distractors = events.filter((event) => event !== asked).map((event, index) => `${asked.service} · ${event.code} · ${events[(index + 1) % events.length].state}`)
    return { id: id('debug-scan', seed), family: 'debug-scan', variant, label: 'Debug Scan', prompt: `Which entry correctly describes ${asked.service}?`, instruction: 'Reconstruct the service, code and state from memory.', difficulty: level, responseTargetMs: band === 3 ? 15000 : 13500, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, distractors), visual: { kind: 'reference', caption: 'Incident snapshot', lines: events.map((event) => `${event.service.padEnd(6)} ${event.code}  ${event.state}`), revealMs }, explanation: `${asked.service} was paired with ${asked.code} and ${asked.state}.` }
  }

  if (variant === 'mapping-recall') {
    const keys = rng.shuffle(['ALPHA', 'BRAVO', 'DELTA', 'SIGMA'])
    const values = rng.shuffle(['EU-17', 'US-42', 'AP-08', 'CA-31'])
    const asked = rng.int(0, 3); const correct = `${keys[asked]} → ${values[asked]}`
    const distractors = [1, 2, 3].map((offset) => `${keys[asked]} → ${values[(asked + offset) % 4]}`)
    return { id: id('debug-scan', seed), family: 'debug-scan', variant, label: 'Debug Scan', prompt: `Which mapping for ${keys[asked]} was shown?`, instruction: 'Recall the correct association.', difficulty: level, responseTargetMs: band === 3 ? 14500 : 13000, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, distractors), visual: { kind: 'reference', caption: 'Routing map', lines: keys.map((key, index) => `${key.padEnd(6)} → ${values[index]}`), revealMs }, explanation: `${keys[asked]} mapped to ${values[asked]}.` }
  }

  const environments = ['Prod A', 'Prod B', 'Stage', 'Preview']
  const rows = [
    { label: environments[0], values: [443, 2, 'Signed'] },
    { label: environments[1], values: [443, 2, 'Signed'] },
    { label: environments[2], values: [8443, 1, 'Signed'] },
    { label: environments[3], values: [8080, 0, 'Unsigned'] },
  ]
  const wrong = rng.int(0, rows.length - 1)
  if (wrong < 2) rows[wrong] = { ...rows[wrong], values: [8443, 2, 'Signed'] }
  else if (wrong === 2) rows[wrong] = { ...rows[wrong], values: [8443, 0, 'Signed'] }
  else rows[wrong] = { ...rows[wrong], values: [8080, 1, 'Unsigned'] }
  const correct = environments[wrong]
  return { id: id('debug-scan', seed), family: 'debug-scan', variant: 'rule-audit', label: 'Debug Scan', prompt: 'Which row violates its environment policy?', instruction: 'Prod: port 443 + 2 approvals. Stage: port 8443 + 1. Preview: port 8080 + 0.', difficulty: level, responseTargetMs: 16500, answer: { kind: 'choice', value: correct }, options: rng.shuffle(environments).map((label) => ({ id: label, label })), visual: { kind: 'table', title: 'Deployment manifest', columns: ['Port', 'Approvals', 'Signature'], rows }, explanation: `${correct} violates the stated port or approval rule.` }
}

function coordinate(cell: number, size: number) {
  return `R${Math.floor(cell / size) + 1}C${cell % size + 1}`
}

function memoryGrid(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const size = band < 2 ? 4 : band === 2 ? 5 : 6
  const available = band === 0
    ? ['membership', 'highlighted-cell']
    : band === 1
      ? ['membership', 'highlighted-cell', 'row-count', 'column-count']
      : band === 2
        ? ['highlighted-cell', 'row-count', 'column-count', 'fullest-row', 'pair-recall']
        : ['fullest-row', 'pair-recall', 'quadrant-count', 'missing-from-row']
  const variant = rng.pick(available)
  const revealMs = band === 0 ? 2800 : band === 1 ? 2400 : band === 2 ? 2100 : 1800
  const all = Array.from({ length: size * size }, (_, index) => index)
  const targetCount = band === 0 ? 4 : band === 1 ? 6 : band === 2 ? 9 : 13
  let cells = rng.shuffle(all).slice(0, targetCount).sort((a, b) => a - b)
  const base = { id: id('memory-grid', seed), family: 'memory-grid' as const, variant, label: 'Memory Grid', difficulty: level, visual: { kind: 'memory' as const, cells, size, revealMs } }

  if (variant === 'membership') {
    const present = rng.next() < .5; const pool = present ? cells : all.filter((cell) => !cells.includes(cell)); const asked = rng.pick(pool)
    return { ...base, prompt: `Was ${coordinate(asked, size)} highlighted?`, instruction: 'Recall whether that exact location was lit.', responseTargetMs: band === 0 ? 7000 : 8500, answer: { kind: 'choice', value: present ? 'yes' : 'no' }, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], explanation: present ? `Yes—${coordinate(asked, size)} was highlighted.` : `No—${coordinate(asked, size)} was not highlighted.` }
  }

  if (variant === 'highlighted-cell') {
    const correctCell = rng.pick(cells); const distractors = rng.shuffle(all.filter((cell) => !cells.includes(cell))).slice(0, 3).map((cell) => coordinate(cell, size)); const correct = coordinate(correctCell, size)
    return { ...base, prompt: 'Which location was highlighted?', instruction: 'Only one option belonged to the flashed pattern.', responseTargetMs: band === 0 ? 7500 : band === 1 ? 9000 : 10500, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, distractors), explanation: `${correct} was part of the highlighted pattern.` }
  }

  if (variant === 'row-count' || variant === 'column-count') {
    const index = rng.int(0, size - 1)
    const answer = cells.filter((cell) => variant === 'row-count' ? Math.floor(cell / size) === index : cell % size === index).length
    const axis = variant === 'row-count' ? 'row' : 'column'
    return { ...base, prompt: `How many highlighted cells were in ${axis} ${index + 1}?`, instruction: 'Recall and count only the requested line.', responseTargetMs: band === 1 ? 9500 : 11000, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 1), explanation: `${axis[0].toUpperCase()}${axis.slice(1)} ${index + 1} contained ${answer} highlighted cell${answer === 1 ? '' : 's'}.` }
  }

  if (variant === 'fullest-row') {
    const targetRow = rng.int(0, size - 1); const maxCount = band === 3 ? 5 : 4
    const selected = new Set<number>()
    rng.shuffle(Array.from({ length: size }, (_, column) => targetRow * size + column)).slice(0, maxCount).forEach((cell) => selected.add(cell))
    for (let row = 0; row < size; row += 1) {
      if (row === targetRow) continue
      rng.shuffle(Array.from({ length: size }, (_, column) => row * size + column)).slice(0, rng.int(0, maxCount - 1)).forEach((cell) => selected.add(cell))
    }
    cells = [...selected].sort((a, b) => a - b); base.visual.cells = cells
    const correct = `Row ${targetRow + 1}`
    return { ...base, prompt: 'Which row contained the most highlighted cells?', instruction: 'Compare the remembered row totals.', responseTargetMs: band === 3 ? 13000 : 11500, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, Array.from({ length: size }, (_, row) => `Row ${row + 1}`).filter((value) => value !== correct)), explanation: `${correct} contained ${maxCount}, more than every other row.` }
  }

  if (variant === 'pair-recall') {
    const pair = rng.shuffle(cells).slice(0, 2); const correct = pair.map((cell) => coordinate(cell, size)).sort().join(' + ')
    const distractors = new Set<string>()
    while (distractors.size < 3) {
      const candidate = rng.shuffle(all).slice(0, 2); if (candidate.every((cell) => cells.includes(cell))) continue
      distractors.add(candidate.map((cell) => coordinate(cell, size)).sort().join(' + '))
    }
    return { ...base, prompt: 'Which pair were both highlighted?', instruction: 'Both locations in the selected option must belong to the pattern.', responseTargetMs: band === 3 ? 14000 : 12000, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, [...distractors]), explanation: `${correct.replace(' + ', ' and ')} were both highlighted.` }
  }

  if (variant === 'quadrant-count') {
    const quadrant = rng.pick(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
    const answer = cells.filter((cell) => { const row = Math.floor(cell / size); const column = cell % size; return (quadrant.includes('top') ? row < size / 2 : row >= size / 2) && (quadrant.includes('left') ? column < size / 2 : column >= size / 2) }).length
    return { ...base, prompt: `How many highlighted cells were in the ${quadrant} quadrant?`, instruction: 'Divide the grid into four equal 3×3 regions.', responseTargetMs: 14500, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 1), explanation: `The ${quadrant} quadrant contained ${answer} highlighted cells.` }
  }

  const targetRow = rng.int(0, size - 1); const missingColumn = rng.int(0, size - 1)
  const rowCells = Array.from({ length: size }, (_, column) => targetRow * size + column).filter((cell) => cell % size !== missingColumn)
  const outside = rng.shuffle(all.filter((cell) => Math.floor(cell / size) !== targetRow)).slice(0, 8)
  cells = [...rowCells, ...outside].sort((a, b) => a - b); base.visual.cells = cells
  const correct = coordinate(targetRow * size + missingColumn, size)
  return { ...base, prompt: `Which location in row ${targetRow + 1} was not highlighted?`, instruction: 'That row was almost complete; identify its single gap.', responseTargetMs: 14000, answer: { kind: 'choice', value: correct }, options: choiceOptions(rng, correct, Array.from({ length: size }, (_, column) => coordinate(targetRow * size + column, size)).filter((value) => value !== correct)), explanation: `${correct} was the only unlit location in row ${targetRow + 1}.` }
}

function patternRecall(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const size = level <= 3 ? 4 : 5
  const variants = band === 0
    ? ['sparse-scatter', 'short-chain']
    : band === 1
      ? ['short-chain', 'cluster', 'split-groups']
      : band === 2
        ? ['split-groups', 'edge-centre', 'broken-symmetry', 'dense-scatter']
        : ['dense-scatter', 'multi-cluster', 'broken-symmetry']
  const variant = rng.pick(variants)
  const targetCounts = [0, 3, 4, 5, 5, 6, 7, 8, 9, 10, 11]
  const revealTimes = [0, 2200, 1900, 1650, 1500, 1350, 1200, 1050, 900, 760, 650]
  const targetCount = targetCounts[level]
  const revealMs = revealTimes[level]
  const all = Array.from({ length: size * size }, (_, index) => index)
  const distance = (a: number, b: number) => Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs(a % size - b % size)
  let cells: number[] = []

  if (variant === 'short-chain') {
    const selected = new Set<number>()
    let current = rng.pick(all)
    selected.add(current)
    while (selected.size < targetCount) {
      const row = Math.floor(current / size); const column = current % size
      const neighbours = [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
        .filter(([nextRow, nextColumn]) => nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size)
        .map(([nextRow, nextColumn]) => nextRow * size + nextColumn)
        .filter((cell) => !selected.has(cell))
      const unused = all.filter((cell) => !selected.has(cell))
      current = neighbours.length ? rng.pick(neighbours) : rng.pick(unused)
      selected.add(current)
    }
    cells = [...selected]
  } else if (variant === 'cluster') {
    const anchor = rng.pick(all)
    cells = rng.shuffle(all).sort((a, b) => distance(a, anchor) - distance(b, anchor)).slice(0, targetCount)
  } else if (variant === 'split-groups') {
    const first = rng.pick(all)
    const second = rng.pick(all.filter((cell) => distance(cell, first) >= size - 1))
    cells = rng.shuffle(all).sort((a, b) => Math.min(distance(a, first), distance(a, second)) - Math.min(distance(b, first), distance(b, second))).slice(0, targetCount)
  } else if (variant === 'multi-cluster') {
    const anchors = rng.shuffle(all).reduce<number[]>((chosen, cell) => chosen.length < 3 && chosen.every((anchor) => distance(cell, anchor) >= 3) ? [...chosen, cell] : chosen, [])
    while (anchors.length < 3) anchors.push(rng.pick(all.filter((cell) => !anchors.includes(cell))))
    cells = rng.shuffle(all).sort((a, b) => Math.min(...anchors.map((anchor) => distance(a, anchor))) - Math.min(...anchors.map((anchor) => distance(b, anchor)))).slice(0, targetCount)
  } else if (variant === 'broken-symmetry') {
    const selected = new Set<number>()
    const pairStarts = rng.shuffle(all.filter((cell) => cell <= size * size - 1 - cell))
    for (const cell of pairStarts) {
      if (selected.size + 2 > targetCount) break
      selected.add(cell)
      selected.add(size * size - 1 - cell)
    }
    while (selected.size < targetCount) selected.add(rng.pick(all.filter((cell) => !selected.has(cell))))
    cells = [...selected]
  } else if (variant === 'edge-centre') {
    const edge = all.filter((cell) => { const row = Math.floor(cell / size); const column = cell % size; return row === 0 || column === 0 || row === size - 1 || column === size - 1 })
    const inner = all.filter((cell) => !edge.includes(cell))
    const edgeCount = Math.ceil(targetCount / 2)
    cells = [...rng.shuffle(edge).slice(0, edgeCount), ...rng.shuffle(inner).slice(0, targetCount - edgeCount)]
  } else {
    cells = rng.shuffle(all).slice(0, targetCount)
  }

  cells = [...new Set(cells)].sort((a, b) => a - b)
  const prompts: Record<string, string> = {
    'sparse-scatter': 'Select every tile that was highlighted.',
    'short-chain': 'Rebuild the flashed tile pattern.',
    cluster: 'Mark every location that lit up.',
    'split-groups': 'Restore both groups from the flash.',
    'edge-centre': 'Tick all remembered edge and centre tiles.',
    'broken-symmetry': 'Recreate the hidden near-symmetrical pattern.',
    'dense-scatter': 'Select the complete highlighted pattern.',
    'multi-cluster': 'Restore every tile from the three flashed groups.',
  }
  return {
    id: id('pattern-recall', seed), family: 'pattern-recall', variant, label: 'Pattern Recall',
    prompt: prompts[variant], instruction: 'The pattern appears briefly. Once it disappears, select every tile that was highlighted and submit.',
    difficulty: level, responseTargetMs: revealMs + 3800 + targetCount * 700,
    answer: { kind: 'cells', value: cells }, visual: { kind: 'memory', cells, size, revealMs },
    explanation: `The highlighted locations were ${cells.map((cell) => coordinate(cell, size)).join(', ')}.`,
  }
}

function tileSequence(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const variants = band === 0
    ? ['short-unique', 'corner-centre']
    : band === 1
      ? ['short-unique', 'corner-centre', 'wide-jumps']
      : band === 2
        ? level >= 7
          ? ['wide-jumps', 'revisit', 'interleaved-return', 'large-grid-scan']
          : ['wide-jumps', 'revisit', 'interleaved-return']
        : ['target-filter', 'target-filter-return', 'target-filter-rapid']
  const variant = rng.pick(variants)
  const baseLengths = [0, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11]
  const targetLength = Math.min(11, baseLengths[level] + (level < 9 && rng.next() < .28 ? 1 : 0))
  const distractorCount = level >= 9 ? level === 9 ? 3 : 4 : 0
  const flashCount = targetLength + distractorCount
  const flashMs = Math.max(310, 730 - level * 42)
  const gapMs = Math.max(70, 205 - level * 13)
  const size = level >= 7 ? 5 : 3
  const all = Array.from({ length: size * size }, (_, index) => index)
  const corners = [0, size - 1, size * (size - 1), size * size - 1]
  const path: number[] = []

  for (let index = 0; index < flashCount; index += 1) {
    const previous = path.at(-1)
    let forced: number | undefined
    if (variant === 'corner-centre' && index === 0) forced = rng.pick(corners)
    if (variant === 'corner-centre' && index === 2) forced = Math.floor(size * size / 2)
    if ((variant === 'revisit' || variant === 'target-filter-return') && index >= 4 && index % 3 === 1) forced = path[index - 3]
    if (variant === 'interleaved-return' && index >= 3 && index % 4 === 3) forced = path[0]
    if (forced === previous) forced = undefined

    let candidates = all.filter((cell) => cell !== previous)
    if ((variant === 'short-unique' || variant === 'corner-centre') && path.length < all.length) {
      const unused = candidates.filter((cell) => !path.includes(cell))
      if (unused.length) candidates = unused
    }
    if (variant === 'wide-jumps' || variant === 'large-grid-scan' || (variant === 'target-filter-rapid' && index % 2 === 1)) {
      const distant = candidates.filter((cell) => {
        if (previous === undefined) return true
        const minimumDistance = size === 5 ? 3 : 2
        return Math.abs(Math.floor(cell / size) - Math.floor(previous / size)) + Math.abs(cell % size - previous % size) >= minimumDistance
      })
      if (distant.length) candidates = distant
    }
    path.push(forced ?? rng.pick(candidates))
  }

  const targetCue = level >= 9 ? rng.pick(['lime-circle', 'violet-diamond'] as const) : 'lime-circle'
  const distractorCue = targetCue === 'lime-circle' ? 'violet-diamond' : 'lime-circle'
  const cues = Array.from({ length: flashCount }, () => targetCue)
  if (distractorCount) {
    const eligiblePositions = Array.from({ length: Math.max(0, flashCount - 2) }, (_, index) => index + 1)
    for (const position of rng.shuffle(eligiblePositions).slice(0, distractorCount)) cues[position] = distractorCue
  }
  const answerPath = path.filter((_, index) => cues[index] === targetCue)
  const targetDescription = targetCue === 'lime-circle' ? 'lime circle' : 'violet diamond'
  const distractorDescription = distractorCue === 'lime-circle' ? 'lime circle' : 'violet diamond'
  const playbackMs = 650 + Math.max(0, path.length - 1) * (flashMs + gapMs) + flashMs
  const responseTargetMs = playbackMs + 2800 + answerPath.length * 620
  return {
    id: id('tile-sequence', seed), family: 'tile-sequence', variant, label: 'Sequence Flash',
    prompt: distractorCount ? `Repeat the ${answerPath.length} ${targetDescription} flashes in order.` : `Repeat the ${answerPath.length}-tile sequence in the same order.`,
    instruction: distractorCount ? `Track only ${targetDescription} flashes. Ignore every ${distractorDescription} flash.` : 'Watch each flash. When the board unlocks, select the tiles in exactly the same order.',
    difficulty: level, responseTargetMs,
    answer: { kind: 'sequence', value: answerPath },
    visual: { kind: 'sequence', size, path, cues, targetCue, flashMs, gapMs },
    explanation: `${distractorCount ? `The ${targetDescription} sequence` : 'The sequence'} was ${answerPath.map((cell) => cell + 1).join(' → ')}${distractorCount ? `; the ${distractorDescription} flashes were distractors.` : '.'}`,
  }
}

function arrowShift(level: number, seed: number, rng: RandomSource): Exercise {
  const size = 5 as const
  const variant = level <= 2
    ? 'cardinal-shift'
    : level <= 4
      ? 'mixed-angle-shift'
      : level <= 6
        ? rng.pick(['mixed-angle-shift', 'dense-shift'])
        : level <= 8
          ? rng.pick(['colour-filter', 'colour-filter-rapid'])
          : rng.pick(['colour-filter', 'colour-filter-multiple', 'colour-filter-rapid'])
  const arrowCounts = [0, 4, 5, 6, 7, 8, 9, 11, 13, 15, 17]
  const firstRevealTimes = [0, 1450, 1320, 1190, 1070, 960, 860, 800, 730, 660, 590]
  const secondRevealTimes = [0, 1320, 1200, 1080, 970, 870, 780, 720, 650, 590, 530]
  const gapTimes = [0, 360, 340, 320, 300, 280, 260, 235, 215, 195, 175]
  const totalCount = arrowCounts[level]
  const distractorCount = level < 7 ? 0 : level === 7 ? 3 : level === 8 ? 4 : level === 9 ? 5 : 6
  const distractorChanges = level < 7 ? 0 : level <= 8 ? 1 : level === 9 ? 2 : 3
  const allCells = Array.from({ length: size * size }, (_, index) => index)
  const occupied = rng.shuffle(allCells).slice(0, totalCount).sort((a, b) => a - b)
  const targetCue = distractorCount ? rng.pick(['lime-circle', 'violet-diamond'] as const) : 'lime-circle'
  const distractorCue = targetCue === 'lime-circle' ? 'violet-diamond' : 'lime-circle'
  const distractorCells = new Set(distractorCount ? rng.shuffle(occupied).slice(0, distractorCount) : [])
  const targetCells = occupied.filter((cell) => !distractorCells.has(cell))
  const targetCell = rng.pick(targetCells)
  const directions = level <= 2 ? [0, 90, 180, 270] : [0, 45, 90, 135, 180, 225, 270, 315]
  const before = occupied.map((cell) => ({
    cell,
    direction: rng.pick(directions),
    cue: distractorCells.has(cell) ? distractorCue : targetCue,
  }))
  const changedDistractors = rng.shuffle([...distractorCells]).slice(0, distractorChanges)
  const changedCells = [targetCell, ...changedDistractors]
  const after = before.map((item) => {
    if (!changedCells.includes(item.cell)) return { ...item }
    const differentDirections = directions.filter((direction) => direction !== item.direction)
    return { ...item, direction: rng.pick(differentDirections) }
  })
  const targetDescription = targetCue === 'lime-circle' ? 'lime circle' : 'violet diamond'
  const distractorDescription = distractorCue === 'lime-circle' ? 'lime circle' : 'violet diamond'
  const firstRevealMs = firstRevealTimes[level]
  const secondRevealMs = secondRevealTimes[level]
  const gapMs = gapTimes[level]
  const playbackMs = 600 + firstRevealMs + gapMs + secondRevealMs
  const responseTargetMs = playbackMs + 2300 + level * 440 + distractorChanges * 650
  return {
    id: id('arrow-shift', seed), family: 'arrow-shift', variant, label: 'Arrow Shift',
    prompt: distractorCount ? `Which ${targetDescription} arrow changed direction?` : 'Which arrow changed direction?',
    instruction: distractorCount
      ? `Track only ${targetDescription} arrows. ${distractorDescription} arrows may also rotate, but they are distractors.`
      : 'Compare the two brief snapshots, then select the changed arrow.',
    difficulty: level, responseTargetMs,
    answer: { kind: 'cell', value: targetCell },
    visual: { kind: 'arrow-shift', size, before, after, targetCue, changedCells, targetCell, firstRevealMs, gapMs, secondRevealMs },
    explanation: distractorCount
      ? `${coordinate(targetCell, size)} was the ${targetDescription} arrow that changed. ${changedDistractors.length} ${distractorDescription} arrow${changedDistractors.length === 1 ? '' : 's'} also changed and had to be ignored.`
      : `${coordinate(targetCell, size)} was the only arrow that changed direction.`,
  }
}

type SpatialPosition = NonNullable<VisualToken['position']>

function normalRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function rotatePosition(position: SpatialPosition, degrees: number): SpatialPosition {
  if (position === 'center') return position
  const positions: SpatialPosition[] = ['top', 'right', 'bottom', 'left']
  return positions[(positions.indexOf(position) + normalRotation(degrees) / 90) % 4]
}

function rotateSpatialToken(value: VisualToken, degrees: number): VisualToken {
  return { ...value, rotation: normalRotation((value.rotation || 0) + degrees), position: rotatePosition(value.position || 'center', degrees) }
}

function reflectSpatialToken(value: VisualToken, axis: 'vertical' | 'horizontal'): VisualToken {
  const position = value.position || 'center'; const rotation = value.rotation || 0
  const reflectedPosition: SpatialPosition = axis === 'vertical'
    ? position === 'left' ? 'right' : position === 'right' ? 'left' : position
    : position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : position
  return { ...value, position: reflectedPosition, rotation: axis === 'vertical' ? normalRotation(180 - rotation) : normalRotation(-rotation) }
}

function spatialOptions(rng: RandomSource, answer: VisualToken) {
  const answerPosition = answer.position || 'center'; const answerRotation = normalRotation(answer.rotation || 0)
  const candidates = rng.shuffle((['center', 'top', 'right', 'bottom', 'left'] as SpatialPosition[]).flatMap((position) => [0, 90, 180, 270].map((rotation) => ({ ...answer, position, rotation }))))
  const chosen = [answer, ...candidates.filter((candidate) => (candidate.position || 'center') !== answerPosition || normalRotation(candidate.rotation || 0) !== answerRotation).slice(0, 3)]
  const shuffled = rng.shuffle(chosen)
  const options = shuffled.map((visual, index) => ({ id: `spatial-${index}`, label: `Option ${index + 1}`, visual }))
  const correct = options.find((option) => (option.visual.position || 'center') === answerPosition && normalRotation(option.visual.rotation || 0) === answerRotation)!.id
  return { options, correct }
}

function spatial(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['rotation', 'double-rotation']
    : band === 1
      ? ['rotation', 'positioned-rotation', 'reflection']
      : band === 2
        ? ['positioned-rotation', 'reflection', 'reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform']
        : ['reflect-then-rotate', 'rotate-then-reflect', 'inverse-transform', 'three-step-transform']
  const variant = rng.pick(available)
  const start: VisualToken = { shape: 'arrow', count: 1, filled: rng.next() < .5, rotation: rng.pick([0, 90, 180, 270]), position: band === 0 ? 'center' : rng.pick<SpatialPosition>(['top', 'right', 'bottom', 'left']) }
  let shown = start; let answer = start; let prompt = ''; let explanation = ''; let responseTargetMs = 7500

  if (variant === 'rotation') {
    const degrees = rng.pick([90, 180, 270]); answer = rotateSpatialToken(start, degrees); prompt = `Rotate the symbol ${degrees}° clockwise.`; explanation = `Both its direction and location rotate ${degrees}° clockwise.`
  } else if (variant === 'double-rotation') {
    const first = rng.pick([90, 180, 270]); const second = rng.pick([90, 180, 270]); answer = rotateSpatialToken(rotateSpatialToken(start, first), second); prompt = `Rotate ${first}° clockwise, then ${second}° clockwise.`; explanation = `The two rotations combine to ${normalRotation(first + second)}° clockwise.`; responseTargetMs = 8500
  } else if (variant === 'positioned-rotation') {
    const degrees = rng.pick([90, 180, 270]); answer = rotateSpatialToken(start, degrees); prompt = `Rotate the entire tile ${degrees}° clockwise.`; explanation = `The arrow and its off-centre position both rotate ${degrees}°.`; responseTargetMs = 10000
  } else if (variant === 'reflection') {
    const axis = rng.pick<'vertical' | 'horizontal'>(['vertical', 'horizontal']); answer = reflectSpatialToken(start, axis); prompt = `Reflect the entire tile across its ${axis} axis.`; explanation = `A ${axis} reflection flips both the arrow direction and its position.`; responseTargetMs = 10500
  } else if (variant === 'reflect-then-rotate') {
    const axis = rng.pick<'vertical' | 'horizontal'>(['vertical', 'horizontal']); const degrees = rng.pick([90, 270]); answer = rotateSpatialToken(reflectSpatialToken(start, axis), degrees); prompt = `Reflect across the ${axis} axis, then rotate ${degrees}° clockwise.`; explanation = `Apply the reflection first, then rotate the reflected result ${degrees}°.`; responseTargetMs = band === 3 ? 14500 : 12500
  } else if (variant === 'rotate-then-reflect') {
    const degrees = rng.pick([90, 270]); const axis = rng.pick<'vertical' | 'horizontal'>(['vertical', 'horizontal']); answer = reflectSpatialToken(rotateSpatialToken(start, degrees), axis); prompt = `Rotate ${degrees}° clockwise, then reflect across the ${axis} axis.`; explanation = `Order matters: rotate first, then reflect that result.`; responseTargetMs = band === 3 ? 14500 : 12500
  } else if (variant === 'inverse-transform') {
    const degrees = rng.pick([90, 180, 270]); shown = rotateSpatialToken(start, degrees); answer = start; prompt = `The shown tile is the result of a ${degrees}° clockwise rotation. Which tile was the original?`; explanation = `Undo the change with a ${normalRotation(360 - degrees)}° clockwise rotation.`; responseTargetMs = band === 3 ? 15000 : 13000
  } else {
    const axis = rng.pick<'vertical' | 'horizontal'>(['vertical', 'horizontal']); const first = rng.pick([90, 270]); const second = rng.pick([90, 180]); answer = reflectSpatialToken(rotateSpatialToken(reflectSpatialToken(start, axis), first), axis); answer = rotateSpatialToken(answer, second); prompt = `Reflect ${axis}, rotate ${first}° clockwise, reflect ${axis} again, then rotate ${second}°.`; explanation = 'Track the position and arrow direction after each of the four transformations.'; responseTargetMs = 17500
  }
  const { options, correct } = spatialOptions(rng, answer)
  return { id: id('spatial', seed), family: 'spatial', variant, label: 'Spatial Lab', prompt, instruction: 'Track both orientation and off-centre position.', difficulty: level, responseTargetMs, answer: { kind: 'choice', value: correct }, options, visual: { kind: 'tiles', columns: 1, cells: [shown] }, explanation }
}

function routeNeighbours(cell: number, size: number) {
  const row = Math.floor(cell / size); const column = cell % size; const result: number[] = []
  if (row > 0) result.push(cell - size)
  if (row < size - 1) result.push(cell + size)
  if (column > 0) result.push(cell - 1)
  if (column < size - 1) result.push(cell + 1)
  return result
}

function shortestRoute(size: number, blocked: number[], start: number, end: number) {
  if (start === end) return 0
  const forbidden = new Set(blocked); const queue: Array<[number, number]> = [[start, 0]]; const seen = new Set([start])
  for (let index = 0; index < queue.length; index += 1) {
    const [cell, distance] = queue[index]
    for (const next of routeNeighbours(cell, size)) {
      if (forbidden.has(next) || seen.has(next)) continue
      if (next === end) return distance + 1
      seen.add(next); queue.push([next, distance + 1])
    }
  }
  return Infinity
}

function weightedRoute(size: number, blocked: number[], start: number, end: number, costs: Array<{ cell: number; cost: number }>) {
  const forbidden = new Set(blocked); const costMap = new Map(costs.map((item) => [item.cell, item.cost])); const distances = new Map<number, number>([[start, 0]]); const open = new Set([start])
  while (open.size) {
    const cell = [...open].reduce((best, candidate) => (distances.get(candidate) || Infinity) < (distances.get(best) || Infinity) ? candidate : best)
    open.delete(cell); const distance = distances.get(cell) || 0
    if (cell === end) return distance
    for (const next of routeNeighbours(cell, size)) {
      if (forbidden.has(next)) continue
      const candidate = distance + (costMap.get(next) || 1)
      if (candidate < (distances.get(next) ?? Infinity)) { distances.set(next, candidate); open.add(next) }
    }
  }
  return Infinity
}

function openRouteEndpoints(size: number, rng: RandomSource) {
  const cells = Array.from({ length: size * size }, (_, index) => index)
  let start = rng.pick(cells); let end = rng.pick(cells)
  while (start === end || Math.abs(Math.floor(start / size) - Math.floor(end / size)) + Math.abs(start % size - end % size) < 3) end = rng.pick(cells)
  return { start, end }
}

function routePlanner(level: number, seed: number, rng: RandomSource): Exercise {
  const band = levelBand(level)
  const available = band === 0
    ? ['open-grid', 'light-obstacles']
    : band === 1
      ? ['light-obstacles', 'single-wall', 'checkpoint']
      : band === 2
        ? ['single-wall', 'checkpoint', 'ordered-checkpoints', 'weighted-route']
        : ['double-wall', 'ordered-checkpoints', 'choose-order', 'weighted-route']
  const variant = rng.pick(available)
  const size = band === 0 ? 4 : band < 3 ? 5 : 6
  let blocked: number[] = []; let checkpoints: Array<{ cell: number; label: string }> = []; let costs: Array<{ cell: number; cost: number }> = []
  let { start, end } = openRouteEndpoints(size, rng)
  let answer = 0; let instruction = 'Move horizontally or vertically. Each normal cell costs one move.'; let explanation = ''; let responseTargetMs = 8500

  if (variant === 'open-grid') {
    answer = shortestRoute(size, blocked, start, end); explanation = `The shortest open-grid route takes ${answer} moves.`
  } else if (variant === 'light-obstacles') {
    const candidates = rng.shuffle(Array.from({ length: size * size }, (_, index) => index).filter((cell) => cell !== start && cell !== end))
    for (const cell of candidates.slice(0, 5 + band)) {
      const trial = [...blocked, cell]
      if (Number.isFinite(shortestRoute(size, trial, start, end))) blocked = trial
      if (blocked.length >= 2 + band) break
    }
    answer = shortestRoute(size, blocked, start, end); explanation = `Checking the available corridors gives a shortest route of ${answer} moves.`; responseTargetMs = 10000
  } else if (variant === 'single-wall' || (variant === 'checkpoint' && band >= 2)) {
    const startRow = rng.int(0, size - 1); const endRow = rng.int(0, size - 1); const wallColumn = rng.int(1, size - 2); const gap = rng.int(0, size - 1)
    start = startRow * size; end = endRow * size + size - 1
    blocked = Array.from({ length: size }, (_, row) => row * size + wallColumn).filter((cell) => Math.floor(cell / size) !== gap)
    if (variant === 'single-wall') {
      answer = shortestRoute(size, blocked, start, end); explanation = `The route must cross the wall at row ${gap + 1}; the shortest valid route is ${answer} moves.`; responseTargetMs = band === 2 ? 12500 : 11000
    }
  }

  if (variant === 'checkpoint') {
    const candidates = rng.shuffle(Array.from({ length: size * size }, (_, index) => index).filter((cell) => cell !== start && cell !== end && !blocked.includes(cell)))
    const waypoint = candidates.find((cell) => Number.isFinite(shortestRoute(size, blocked, start, cell)) && Number.isFinite(shortestRoute(size, blocked, cell, end)))!
    checkpoints = [{ cell: waypoint, label: 'A' }]
    answer = shortestRoute(size, blocked, start, waypoint) + shortestRoute(size, blocked, waypoint, end)
    instruction = 'Reach G via checkpoint A. Move horizontally or vertically; avoid blocked cells.'; explanation = `The shortest S→A and A→G paths total ${answer} moves.`; responseTargetMs = band >= 2 ? 13500 : 11500
  }

  if (variant === 'ordered-checkpoints' || variant === 'choose-order') {
    const candidates = rng.shuffle(Array.from({ length: size * size }, (_, index) => index).filter((cell) => cell !== start && cell !== end))
    const [a, b] = candidates.slice(0, 2); checkpoints = [{ cell: a, label: 'A' }, { cell: b, label: 'B' }]
    const ab = shortestRoute(size, blocked, start, a) + shortestRoute(size, blocked, a, b) + shortestRoute(size, blocked, b, end)
    const ba = shortestRoute(size, blocked, start, b) + shortestRoute(size, blocked, b, a) + shortestRoute(size, blocked, a, end)
    answer = variant === 'ordered-checkpoints' ? ab : Math.min(ab, ba)
    instruction = variant === 'ordered-checkpoints' ? 'Visit A, then B, then G.' : 'Visit both checkpoints in whichever order is shortest.'
    explanation = variant === 'ordered-checkpoints' ? `The shortest S→A→B→G route is ${answer} moves.` : `Comparing S→A→B→G (${ab}) with S→B→A→G (${ba}) gives ${answer}.`
    responseTargetMs = band === 3 ? 16500 : 14500
  }

  if (variant === 'double-wall') {
    const startRow = rng.int(0, size - 1); const endRow = rng.int(0, size - 1); const firstGap = rng.int(0, size - 1); const secondGap = rng.int(0, size - 1)
    start = startRow * size; end = endRow * size + size - 1
    blocked = [2, 4].flatMap((column, wallIndex) => Array.from({ length: size }, (_, row) => row * size + column).filter((cell) => Math.floor(cell / size) !== (wallIndex ? secondGap : firstGap)))
    answer = shortestRoute(size, blocked, start, end); explanation = `The route must use the two wall gaps; the shortest valid path is ${answer} moves.`; responseTargetMs = 17000
  }

  if (variant === 'weighted-route') {
    const candidates = rng.shuffle(Array.from({ length: size * size }, (_, index) => index).filter((cell) => cell !== start && cell !== end))
    costs = candidates.slice(0, band === 3 ? 8 : 5).map((cell, index) => ({ cell, cost: index % 3 === 0 ? 3 : 2 }))
    answer = weightedRoute(size, blocked, start, end, costs)
    instruction = 'Minimise total cost. Normal cells cost 1; numbered cells cost the value shown when entered.'; explanation = `The least-cost route totals ${answer}; the fewest-step route is not always cheapest.`; responseTargetMs = band === 3 ? 18000 : 15000
  }

  const prompts: Record<string, string> = {
    'open-grid': 'How many moves are needed on the shortest route?',
    'light-obstacles': 'What is the shortest valid path length?',
    'single-wall': 'How many moves does the best route through the wall require?',
    checkpoint: 'What is the minimum number of moves via checkpoint A?',
    'ordered-checkpoints': 'What is the minimum for S → A → B → G?',
    'choose-order': 'What is the minimum while visiting both checkpoints?',
    'double-wall': 'What is the shortest route through both wall gaps?',
    'weighted-route': 'What is the minimum total route cost?',
  }
  return { id: id('route-planner', seed), family: 'route-planner', variant, label: 'Route Planner', prompt: prompts[variant], instruction, difficulty: level, responseTargetMs, answer: { kind: 'choice', value: `${answer}` }, options: uniqueNumberOptions(rng, answer, 1), visual: { kind: 'route', size, blocked, start, end, checkpoints, costs }, explanation }
}

const generators: Record<ExerciseFamily, (level: number, seed: number, rng: RandomSource) => Exercise> = {
  arithmetic,
  percentages,
  fractions,
  ratios,
  averages,
  rates,
  powers,
  estimation,
  sequences,
  matrix,
  'rule-breaker': ruleBreaker,
  constraints,
  'data-sprint': dataSprint,
  'debug-scan': debugScan,
  'memory-grid': memoryGrid,
  'pattern-recall': patternRecall,
  'tile-sequence': tileSequence,
  'arrow-shift': arrowShift,
  spatial,
  'route-planner': routePlanner,
}

export function generateExercise(family: ExerciseFamily, level: number, seed: number): Exercise {
  const safeLevel = Math.max(1, Math.min(10, Math.round(level)))
  return generators[family](safeLevel, seed, createRng(seed))
}

export function generateVariedExercise(
  family: ExerciseFamily,
  level: number,
  seed: number,
  recentVariants: string[] = [],
  recentPrompts: string[] = [],
): Exercise {
  const blockedVariants = new Set(recentVariants.slice(-2))
  const blockedPrompts = new Set(recentPrompts)
  let firstCandidate: Exercise | undefined
  let promptUniqueCandidate: Exercise | undefined
  let differentFromLastCandidate: Exercise | undefined
  let freshVariantCandidate: Exercise | undefined
  const lastVariant = recentVariants.at(-1)

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = generateExercise(family, level, seed + attempt * 1543)
    firstCandidate ||= candidate
    const promptIsNew = !blockedPrompts.has(candidate.prompt)
    const variantIsFresh = !candidate.variant || !blockedVariants.has(candidate.variant)
    if (promptIsNew && variantIsFresh) return candidate
    if (variantIsFresh) freshVariantCandidate ||= candidate
    if (promptIsNew && candidate.variant !== lastVariant) differentFromLastCandidate ||= candidate
    if (promptIsNew) promptUniqueCandidate ||= candidate
  }

  return freshVariantCandidate || differentFromLastCandidate || promptUniqueCandidate || firstCandidate!
}

export function balancedFamilyAt(families: ExerciseFamily[], index: number, seed: number): ExerciseFamily {
  if (!families.length) throw new Error('At least one exercise family is required')
  const safeIndex = Math.max(0, Math.floor(index))
  const cycle = Math.floor(safeIndex / families.length)
  const order = createRng(seed + cycle * 104729).shuffle(families)
  return order[safeIndex % families.length]
}

export function isCorrect(exercise: Exercise, given: AnswerValue | null) {
  if (given === null) return false
  if (exercise.answer.kind === 'choice') return `${given}` === exercise.answer.value
  if (exercise.answer.kind === 'cell') return Number(given) === exercise.answer.value
  if (exercise.answer.kind === 'cells') {
    if (!Array.isArray(given)) return false
    const expected = new Set(exercise.answer.value)
    const selected = new Set(given)
    return selected.size === expected.size && [...selected].every((cell) => expected.has(cell))
  }
  if (exercise.answer.kind === 'sequence') {
    const expected = exercise.answer.value
    return Array.isArray(given) && given.length === expected.length && given.every((value, index) => value === expected[index])
  }
  const numeric = Number(given)
  return Number.isFinite(numeric) && Math.abs(numeric - exercise.answer.value) <= (exercise.answer.tolerance ?? .001)
}
