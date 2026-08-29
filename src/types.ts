export type ExerciseFamily =
  | 'arithmetic'
  | 'percentages'
  | 'fractions'
  | 'ratios'
  | 'averages'
  | 'rates'
  | 'powers'
  | 'estimation'
  | 'sequences'
  | 'matrix'
  | 'rule-breaker'
  | 'constraints'
  | 'data-sprint'
  | 'debug-scan'
  | 'pattern-recall'
  | 'tile-sequence'
  | 'arrow-shift'
  | 'reaction-match'
  | 'arrow-focus'
  | 'spatial'
  | 'route-planner'

export type Track = 'numbers' | 'logic' | 'cognitive' | 'assessment'
export type Difficulty = 'Warm-up' | 'Standard' | 'Hard' | 'Adaptive'

export type VisualToken = {
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'arrow' | 'line'
  count?: number
  rotation?: number
  filled?: boolean
  position?: 'center' | 'top' | 'right' | 'bottom' | 'left'
}

export type SequenceCue = 'lime-circle' | 'violet-diamond'

export type ArrowGridItem = {
  cell: number
  direction: number
  cue: SequenceCue
}

export type ReactionShape = 'cog' | 'burst' | 'orb'

export type CubeNetCell = {
  x: number
  y: number
  label?: string
}

export type SpatialOptionVisual = {
  kind: 'cube-net'
  cells: CubeNetCell[]
}

export type VisualSpec =
  | { kind: 'matrix'; columns: number; cells: Array<VisualToken | null> }
  | { kind: 'tiles'; columns: number; cells: VisualToken[]; positionGuide?: boolean }
  | { kind: 'bars'; labels: string[]; values: number[]; suffix?: string }
  | { kind: 'table'; title?: string; columns: string[]; rows: Array<{ label: string; values: Array<string | number> }>; note?: string }
  | { kind: 'reference'; caption: string; lines: string[]; revealMs: number }
  | { kind: 'memory'; cells: number[]; size: number; revealMs: number }
  | { kind: 'sequence'; size: number; path: number[]; cues: SequenceCue[]; targetCue: SequenceCue; flashMs: number; gapMs: number }
  | { kind: 'arrow-shift'; size: 5; before: ArrowGridItem[]; after: ArrowGridItem[]; targetCue: SequenceCue; changedCells: number[]; targetCell: number; firstRevealMs: number; gapMs: number; secondRevealMs: number }
  | { kind: 'reaction-match'; leftColor: string; rightColor: string; targetSide: 'left' | 'right'; shape: ReactionShape; previewMs: number; responseWindowMs: number }
  | { kind: 'arrow-focus'; directions: Array<'left' | 'right'>; position: 'above' | 'below'; onsetDelayMs: number; responseWindowMs: number }
  | { kind: 'spatial-angle'; startAngle: number; endAngle?: number; clockwise: boolean; label?: string }
  | { kind: 'cube-net'; cells: CubeNetCell[] }
  | { kind: 'spatial-solid'; solid: 'cube' }
  | { kind: 'route'; size: number; blocked: number[]; start: number; end: number; checkpoints?: Array<{ cell: number; label: string }>; costs?: Array<{ cell: number; cost: number }> }

export type ExerciseOption = {
  id: string
  label: string
  visual?: VisualToken
  spatialVisual?: SpatialOptionVisual
}

export type AnswerSpec =
  | { kind: 'number'; value: number; tolerance?: number }
  | { kind: 'choice'; value: string }
  | { kind: 'cell'; value: number }
  | { kind: 'cells'; value: number[] }
  | { kind: 'sequence'; value: number[] }

export type AnswerValue = number | string | number[]

export type Exercise = {
  id: string
  family: ExerciseFamily
  variant?: string
  label: string
  prompt: string
  instruction?: string
  difficulty: number
  responseTargetMs: number
  answer: AnswerSpec
  options?: ExerciseOption[]
  visual?: VisualSpec
  explanation: string
}

export type Attempt = {
  exercise: Exercise
  given: AnswerValue | null
  correct: boolean
  skipped: boolean
  responseMs: number
  /** Speed-weighted points awarded by reaction exercises. */
  points?: number
}

export type SkillBreakdown = {
  attempted: number
  correct: number
  skipped: number
  medianMs: number
  maxLevel: number
}

export type SessionResult = {
  schemaVersion: 2
  id: number
  date: string
  track: Track
  label: string
  difficulty: Difficulty
  /** Selected timer in seconds. Zero identifies an untimed practice session. */
  configuredDuration?: number
  /** Actual time spent in the session, in seconds. */
  duration: number
  correct: number
  total: number
  skipped: number
  bestStreak: number
  averageMs: number
  medianMs: number
  score: number
  /** Total speed points from reaction exercises in this session. */
  points?: number
  breakdown: Partial<Record<ExerciseFamily, SkillBreakdown>>
}

export type SessionConfig = {
  track: Track
  label: string
  families: ExerciseFamily[]
  difficulty: Difficulty
  duration: number
  simulation?: boolean
  controls?: { leftKey: string; rightKey: string }
}

export const FAMILY_LABELS: Record<ExerciseFamily, string> = {
  arithmetic: 'Arithmetic',
  percentages: 'Percentages',
  fractions: 'Fractions',
  ratios: 'Ratios',
  averages: 'Averages',
  rates: 'Rates & units',
  powers: 'Powers & roots',
  estimation: 'Estimation',
  sequences: 'Sequence Lab',
  matrix: 'Matrix Logic',
  'rule-breaker': 'Rule Breaker',
  constraints: 'Constraint Logic',
  'data-sprint': 'Data Sprint',
  'debug-scan': 'Debug Scan',
  'pattern-recall': 'Pattern Recall',
  'tile-sequence': 'Sequence Flash',
  'arrow-shift': 'Arrow Shift',
  'reaction-match': 'Reflex Match',
  'arrow-focus': 'Arrow Focus',
  spatial: 'Spatial Lab',
  'route-planner': 'Route Planner',
}

export const NUMBER_FAMILIES: ExerciseFamily[] = [
  'arithmetic', 'percentages', 'fractions', 'ratios', 'averages', 'rates', 'powers', 'estimation',
]

export const LOGIC_FAMILIES: ExerciseFamily[] = [
  'sequences', 'matrix', 'rule-breaker', 'constraints',
]

export const COGNITIVE_FAMILIES: ExerciseFamily[] = [
  'data-sprint', 'debug-scan', 'pattern-recall', 'tile-sequence', 'arrow-shift', 'reaction-match', 'arrow-focus', 'spatial', 'route-planner',
]

export function isExerciseFamily(value: string): value is ExerciseFamily {
  return value in FAMILY_LABELS
}
