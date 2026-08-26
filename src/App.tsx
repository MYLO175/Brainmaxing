import { FormEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, Binary, BrainCircuit, Check, ChevronRight,
  CircleDot, Clock3, Database, Eye, Flame, Gauge, Grid2X2, Home, Keyboard,
  Layers3, ListOrdered, Menu, Percent, Play, RotateCw, Route, Settings2, Shapes, Sigma,
  Sparkles, Target, TimerReset, TrendingUp, Trophy, X, Zap,
} from 'lucide-react'
import { balancedFamilyAt, generateExercise, generateVariedExercise, isCorrect } from './exercises'
import {
  COGNITIVE_FAMILIES, FAMILY_LABELS, LOGIC_FAMILIES, NUMBER_FAMILIES, isExerciseFamily,
  type AnswerValue, type Attempt, type Difficulty, type Exercise, type ExerciseFamily,
  type SessionConfig, type SessionResult, type SkillBreakdown, type Track,
  type CubeNetCell, type SpatialOptionVisual, type VisualSpec, type VisualToken,
} from './types'

type View = 'dashboard' | 'numbers' | 'logic' | 'cognitive' | 'session' | 'assessment' | 'results' | 'progress'

const STORAGE_KEY = 'brainmax-sessions-v2'
const LEGACY_STORAGE_KEY = 'brainmax-sessions-v1'
const PREFERENCES_KEY = 'brainmax-preferences-v2'
const DAILY_GOAL = 3
type Preferences = { difficulty: Difficulty; duration: number; reactionLeftKey: string; reactionRightKey: string }

const DIFFICULTIES: Difficulty[] = ['Warm-up', 'Standard', 'Hard', 'Adaptive']
const DURATION_OPTIONS = [30, 60, 120, 180, 300, 0] as const

const familyIcons: Record<ExerciseFamily, typeof Sigma> = {
  arithmetic: Sigma, percentages: Percent, fractions: CircleDot, ratios: Layers3,
  averages: BarChart3, rates: Gauge, powers: Zap, estimation: Target,
  sequences: TrendingUp, matrix: Grid2X2, 'rule-breaker': Eye, constraints: Binary,
  'data-sprint': Database, 'debug-scan': Target,
  'pattern-recall': Grid2X2, 'tile-sequence': ListOrdered, 'arrow-shift': Target, 'reaction-match': Zap, spatial: RotateCw, 'route-planner': Route,
}

const familyDescriptions: Record<ExerciseFamily, string> = {
  arithmetic: 'Operations, decimals and order-of-operations drills.',
  percentages: 'Changes, reversals, margins and successive percentages.',
  fractions: 'Conversions, mixed numbers and multi-stage fractions.',
  ratios: 'Sharing, mixtures, scaling and inverse proportion.',
  averages: 'Means, targets, weighted groups and removed values.',
  rates: 'Conversions, throughput, capacity and net-rate problems.',
  powers: 'Roots, exponent laws, divisibility and scientific notation.',
  estimation: 'Products, percentages and multi-step budget estimates.',
  sequences: 'Arithmetic, recursive, alternating and interleaved rules.',
  matrix: 'Combine shape, count, fill and rotation across grids.',
  'rule-breaker': 'Find the tile that violates the shared rule.',
  constraints: 'Ordering, dependencies, assignments and conditional logic.',
  'data-sprint': 'Derive answers from charts, tables, rates and filters.',
  'debug-scan': 'Recall identifiers, audit rules and reconstruct configurations.',
  'pattern-recall': 'Watch a flashed grid, then restore every highlighted tile.',
  'tile-sequence': 'Recall longer tile paths, then filter target flashes from distractors.',
  'arrow-shift': 'Compare two rapid arrow grids and isolate the relevant direction change.',
  'reaction-match': 'Wait for the centre object, then match it left or right as fast as possible.',
  spatial: 'Rotate changing shapes, compare directed angles and fold cube nets.',
  'route-planner': 'Optimise routes through walls, waypoints and weighted cells.',
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

function formatDurationSetting(seconds: number) {
  if (seconds === 0) return 'Practice'
  return formatTime(seconds)
}

function shortDurationSetting(seconds: number) {
  if (seconds === 0) return 'Practice'
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`
}

function formatControlKey(key: string) {
  const labels: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ' ': 'Space' }
  return labels[key] || (key.length === 1 ? key.toUpperCase() : key)
}

function resultDurationSetting(session: SessionResult) {
  return session.configuredDuration ?? session.duration
}

export function bestCorrectRecord(
  sessions: SessionResult[],
  track: Track,
  label: string,
  difficulty: Difficulty,
  duration: number,
) {
  const matching = sessions.filter((session) => (
    session.track === track
    && session.label === label
    && session.difficulty === difficulty
    && resultDurationSetting(session) === duration
  ))
  return matching.length ? Math.max(...matching.map((session) => session.correct)) : null
}

function levelName(level: number) {
  if (level <= 2) return 'Foundation'
  if (level <= 5) return 'Core'
  if (level <= 8) return 'Advanced'
  return 'Expert'
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function trainingStreak(sessions: SessionResult[]) {
  const dates = new Set(sessions.map((session) => dateKey(new Date(session.date))))
  const cursor = new Date()
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (dates.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function migrateLegacy(value: unknown): SessionResult[] {
  if (!Array.isArray(value)) return []
  return value.map((item): SessionResult => {
    const legacy = item as Record<string, unknown>
    const total = Number(legacy.total) || 0
    const correct = Number(legacy.correct) || 0
    const averageMs = Number(legacy.averageMs) || 0
    return {
      schemaVersion: 2,
      id: Number(legacy.id) || Date.now(), date: String(legacy.date || new Date().toISOString()),
      track: 'numbers', label: `${String(legacy.mode || 'Numbers')} sprint`,
      difficulty: (legacy.difficulty as Difficulty) || 'Adaptive',
      configuredDuration: Number(legacy.duration) || 0, duration: Number(legacy.duration) || 0,
      correct, total, skipped: 0, bestStreak: Number(legacy.bestStreak) || 0,
      averageMs, medianMs: averageMs, score: Number(legacy.score) || 0,
      breakdown: { arithmetic: { attempted: total, correct, skipped: 0, medianMs: averageMs, maxLevel: 1 } },
    }
  })
}

function loadSessions(): SessionResult[] {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return JSON.parse(current)
    return migrateLegacy(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'))
  } catch { return [] }
}

function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null')
    return {
      difficulty: DIFFICULTIES.includes(value?.difficulty) ? value.difficulty : 'Adaptive',
      duration: DURATION_OPTIONS.includes(value?.duration) ? value.duration : 60,
      reactionLeftKey: typeof value?.reactionLeftKey === 'string' ? value.reactionLeftKey : 'ArrowLeft',
      reactionRightKey: typeof value?.reactionRightKey === 'string' ? value.reactionRightKey : 'ArrowRight',
    }
  } catch { return { difficulty: 'Adaptive', duration: 60, reactionLeftKey: 'ArrowLeft', reactionRightKey: 'ArrowRight' } }
}

export function buildSessionResult(config: SessionConfig, attempts: Attempt[], elapsed: number): SessionResult {
  const completed = attempts.filter((attempt) => !attempt.skipped)
  const correct = attempts.filter((attempt) => attempt.correct).length
  let run = 0
  let bestStreak = 0
  attempts.forEach((attempt) => { run = attempt.correct ? run + 1 : 0; bestStreak = Math.max(bestStreak, run) })
  const responseTimes = completed.map((attempt) => attempt.responseMs).filter(Boolean)
  const breakdown: Partial<Record<ExerciseFamily, SkillBreakdown>> = {}
  config.families.forEach((family) => {
    const items = attempts.filter((attempt) => attempt.exercise.family === family)
    if (!items.length) return
    const answered = items.filter((attempt) => !attempt.skipped)
    breakdown[family] = {
      attempted: answered.length, correct: items.filter((attempt) => attempt.correct).length,
      skipped: items.filter((attempt) => attempt.skipped).length,
      medianMs: median(answered.map((attempt) => attempt.responseMs)),
      maxLevel: Math.max(...items.map((attempt) => attempt.exercise.difficulty)),
    }
  })
  const accuracy = attempts.length ? correct / attempts.length : 0
  const speed = completed.length
    ? completed.reduce((sum, attempt) => sum + (attempt.correct ? Math.min(1, attempt.exercise.responseTargetMs / Math.max(1, attempt.responseMs)) : 0), 0) / completed.length
    : 0
  const volumeTarget = config.simulation || config.duration === 0 ? Math.max(1, attempts.length) : Math.max(6, config.duration / 6)
  const volume = Math.min(1, completed.length / Math.max(1, volumeTarget))
  return {
    schemaVersion: 2, id: Date.now(), date: new Date().toISOString(), track: config.track,
    label: config.label, difficulty: config.difficulty, configuredDuration: config.duration,
    duration: Math.max(1, elapsed), correct,
    total: attempts.length, skipped: attempts.filter((attempt) => attempt.skipped).length, bestStreak,
    averageMs: responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
    medianMs: median(responseTimes), score: Math.round((accuracy * .65 + speed * .22 + volume * .13) * 100),
    points: attempts.reduce((sum, attempt) => sum + (attempt.points || 0), 0), breakdown,
  }
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><BrainCircuit size={19} /></span><span>brainmax</span></div>
}

function Sidebar({ view, onNavigate, open, onClose }: { view: View; onNavigate: (view: View) => void; open: boolean; onClose: () => void }) {
  const go = (next: View) => { onNavigate(next); onClose() }
  return <><button className={`nav-backdrop ${open ? 'visible' : ''}`} onClick={onClose} aria-label="Close menu" /><aside className={`sidebar ${open ? 'mobile-open' : ''}`}><div><div className="sidebar-brand-row"><Brand /><button className="icon-button sidebar-close" onClick={onClose}><X size={18} /></button></div><nav className="main-nav"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}><Home size={18} /> Home</button><button className={['numbers', 'logic', 'cognitive'].includes(view) ? 'active' : ''} onClick={() => go('numbers')}><Grid2X2 size={18} /> Practice</button><button className={view === 'progress' ? 'active' : ''} onClick={() => go('progress')}><BarChart3 size={18} /> Progress</button></nav><p className="nav-label">Your training</p><nav className="main-nav sub-nav"><button onClick={() => go('numbers')}><Zap size={18} /> Fast Numbers+ <span className="nav-dot" /></button><button onClick={() => go('logic')}><Binary size={18} /> Logic Lab <span className="nav-dot lavender-dot" /></button><button onClick={() => go('cognitive')}><BrainCircuit size={18} /> Cognitive Games <span className="nav-dot peach-dot" /></button></nav></div><div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={17} /></div><strong>Build assessment fluency.</strong><p>Short, deliberate practice compounds quickly.</p></div><div className="profile-row"><span className="avatar">MM</span><span><strong>My training</strong><small>Stored on this device</small></span><Settings2 size={16} /></div></div></aside></>
}

function Topbar({ title, streak, onMenu }: { title: string; streak: number; onMenu: () => void }) {
  return <header className="topbar"><button className="icon-button menu-button" onClick={onMenu}><Menu size={20} /></button><span className="topbar-title">{title}</span><div className="topbar-actions"><span className="day-streak"><Flame size={16} /> {streak} <span>day streak</span></span><span className="avatar compact">MM</span></div></header>
}

function MiniBars({ values }: { values: number[] }) {
  const shown = values.length ? values : [18, 24, 20, 33, 28, 38, 45, 51]
  const max = Math.max(...shown, 1)
  return <div className="mini-bars">{shown.map((value, index) => <span key={index} style={{ height: `${Math.max(12, value / max * 100)}%` }} />)}</div>
}

function Dashboard({ sessions, onNavigate, onStart }: { sessions: SessionResult[]; onNavigate: (view: View) => void; onStart: (config: SessionConfig) => void }) {
  const total = sessions.reduce((sum, session) => sum + session.total, 0)
  const correct = sessions.reduce((sum, session) => sum + session.correct, 0)
  const today = sessions.filter((session) => dateKey(new Date(session.date)) === dateKey(new Date())).length
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const warmupFamilies = useMemo(() => {
    const scores = [...NUMBER_FAMILIES, ...LOGIC_FAMILIES, ...COGNITIVE_FAMILIES].map((family) => {
      const data = sessions.flatMap((session) => session.breakdown[family] ? [session.breakdown[family]!] : [])
      const attempts = data.reduce((sum, item) => sum + item.attempted, 0)
      const accuracy = attempts ? data.reduce((sum, item) => sum + item.correct, 0) / attempts : .5
      return { family, accuracy, attempts }
    })
    return scores.sort((a, b) => a.accuracy - b.accuracy || a.attempts - b.attempts).slice(0, 5).map((item) => item.family)
  }, [sessions])
  return <div className="page dashboard-page"><section className="welcome-row"><div><p className="eyebrow">{todayLabel}</p><h1>Build a sharper mind.</h1><p>Original drills for the reasoning patterns behind technical assessments.</p></div><div className="daily-goal"><div className="goal-ring" style={{ background: `conic-gradient(var(--ink) ${Math.min(100, today / DAILY_GOAL * 100)}%, #dedcd2 0)` }}><span>{Math.min(today, DAILY_GOAL)}</span><small>/ {DAILY_GOAL}</small></div><div><strong>Daily goal</strong><p>{today >= DAILY_GOAL ? 'Goal complete' : `${DAILY_GOAL - today} drills left today`}</p></div></div></section><section className="hero-card"><div className="hero-grid" /><div className="hero-copy"><span className="live-badge"><span /> DAILY WARM-UP</span><h2>Five minutes.<br /><em>Fully switched on.</em></h2><p>An adaptive mix built from the skills that need the most attention.</p><div className="hero-actions"><button className="primary-button light" onClick={() => onStart({ track: 'cognitive', label: 'Daily warm-up', families: warmupFamilies, difficulty: 'Adaptive', duration: 300 })}><Play size={17} fill="currentColor" /> Start warm-up</button><button className="text-button light-text" onClick={() => onNavigate('numbers')}>Choose a drill <ArrowRight size={16} /></button></div></div><div className="hero-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="question-preview"><small>MIXED REASONING</small><span>3 · 7 · 13 · ?</span><div><i /><i /><i /></div></div><span className="float-stat accuracy-float"><Check size={14} /> adaptive level</span><span className="float-stat speed-float"><Zap size={14} /> 5 min</span></div></section><div className="section-heading"><div><p className="eyebrow">Training tracks</p><h3>Choose your focus</h3></div></div><section className="mode-grid"><button className="mode-card" onClick={() => onNavigate('numbers')}><span className="mode-icon chartreuse"><Sigma size={24} /></span><span className="mode-status">8 skill families</span><strong>Fast Numbers+</strong><p>Mental maths, ratios, rates, fractions and estimation.</p><span className="mode-meta"><Clock3 size={14} /> 30 sec–5 min <ChevronRight size={17} /></span></button><button className="mode-card" onClick={() => onNavigate('logic')}><span className="mode-icon lavender"><Shapes size={24} /></span><span className="mode-status neutral">Visual + deductive</span><strong>Logic Lab</strong><p>Sequences, matrices, rule breaking and constraints.</p><span className="mode-meta"><Clock3 size={14} /> 1–3 min <ChevronRight size={17} /></span></button><button className="mode-card" onClick={() => onNavigate('cognitive')}><span className="mode-icon peach"><BrainCircuit size={24} /></span><span className="mode-status neutral">{COGNITIVE_FAMILIES.length} game families</span><strong>Cognitive Games</strong><p>Data interpretation, precision, pattern memory, spatial thinking and planning.</p><span className="mode-meta"><Clock3 size={14} /> 30 sec–5 min <ChevronRight size={17} /></span></button></section><div className="section-heading stats-heading"><div><p className="eyebrow">Your performance</p><h3>At a glance</h3></div><button className="text-button" onClick={() => onNavigate('progress')}>Full progress <ArrowRight size={16} /></button></div><section className="stats-grid"><div className="stat-card"><span className="stat-icon"><Target size={18} /></span><p>Overall accuracy</p><strong>{total ? `${Math.round(correct / total * 100)}%` : '—'}</strong><small>{total ? `${correct} of ${total} correct` : 'Complete your first drill'}</small></div><div className="stat-card"><span className="stat-icon"><Flame size={18} /></span><p>Best streak</p><strong>{sessions.length ? Math.max(...sessions.map((s) => s.bestStreak)) : '—'}</strong><small>Correct answers in a row</small></div><div className="stat-card"><span className="stat-icon"><Gauge size={18} /></span><p>Median response</p><strong>{sessions[0]?.medianMs ? `${(sessions[0].medianMs / 1000).toFixed(1)}s` : '—'}</strong><small>Latest session</small></div><div className="stat-card trend-card"><div><span className="stat-icon"><BarChart3 size={18} /></span><p>Latest score</p><strong>{sessions[0]?.score ?? '—'}</strong></div><MiniBars values={sessions.slice(0, 8).reverse().map((s) => s.score)} /></div></section></div>
}

function PracticeLab({ track, families, preferences, sessions, onPreferences, onStart }: { track: Track; families: ExerciseFamily[]; preferences: Preferences; sessions: SessionResult[]; onPreferences: (value: Preferences) => void; onStart: (config: SessionConfig) => void }) {
  const [selected, setSelected] = useState<ExerciseFamily | 'mixed'>('mixed')
  const [bindingSide, setBindingSide] = useState<'left' | 'right' | null>(null)
  const title = track === 'numbers' ? 'Fast Numbers+' : track === 'logic' ? 'Logic Lab' : 'Cognitive Games'
  const description = track === 'numbers' ? 'Go beyond arithmetic. Build flexible numerical judgement.' : track === 'logic' ? 'Train the pattern and deduction skills used in abstract reasoning screens.' : 'Train data interpretation, precision, pattern memory, spatial reasoning and planning.'
  const activeFamilies = selected === 'mixed' ? families : [selected]
  const Icon = selected === 'mixed' ? BrainCircuit : familyIcons[selected]
  const recordLabel = selected === 'mixed' ? `${title} mix` : FAMILY_LABELS[selected]
  const currentBest = bestCorrectRecord(sessions, track, recordLabel, preferences.difficulty, preferences.duration)
  const untimed = preferences.duration === 0
  const bindReactionKey = (side: 'left' | 'right', event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (bindingSide !== side || ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Escape') { setBindingSide(null); return }
    const ownKey = side === 'left' ? preferences.reactionLeftKey : preferences.reactionRightKey
    const otherKey = side === 'left' ? preferences.reactionRightKey : preferences.reactionLeftKey
    onPreferences({
      ...preferences,
      reactionLeftKey: side === 'left' ? event.key : event.key === otherKey ? ownKey : preferences.reactionLeftKey,
      reactionRightKey: side === 'right' ? event.key : event.key === otherKey ? ownKey : preferences.reactionRightKey,
    })
    setBindingSide(null)
  }

  return <div className="page practice-page">
    <section className="page-intro">
      <p className="eyebrow">Practice lab</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
    <section className="builder-layout">
      <div className="builder-panel">
        <div className="builder-section">
          <div className="step-heading"><span>01</span><div><h3>Choose a drill</h3><p>Select one skill or run a balanced mix.</p></div></div>
          <div className="exercise-card-grid">
            <button className={`exercise-select ${selected === 'mixed' ? 'selected' : ''}`} onClick={() => setSelected('mixed')}><span><BrainCircuit size={20} /></span><div><strong>Balanced mix</strong><small>Cycle evenly through every skill</small></div>{selected === 'mixed' && <Check size={15} />}</button>
            {families.map((family) => { const FamilyIcon = familyIcons[family]; return <button key={family} className={`exercise-select ${selected === family ? 'selected' : ''}`} onClick={() => setSelected(family)}><span><FamilyIcon size={20} /></span><div><strong>{FAMILY_LABELS[family]}</strong><small>{familyDescriptions[family]}</small></div>{selected === family && <Check size={15} />}</button> })}
          </div>
        </div>
        <div className="builder-section">
          <div className="step-heading"><span>02</span><div><h3>Set the difficulty</h3><p>Adaptive responds separately to each skill.</p></div></div>
          <div className="segmented-control">{DIFFICULTIES.map((difficulty) => <button key={difficulty} className={preferences.difficulty === difficulty ? 'selected' : ''} onClick={() => onPreferences({ ...preferences, difficulty })}>{difficulty}{difficulty === 'Adaptive' && <Sparkles size={13} />}</button>)}</div>
        </div>
        <div className="builder-section">
          <div className="step-heading"><span>03</span><div><h3>Choose a timer</h3><p>Use a timed sprint or practise for as long as you like.</p></div></div>
          <div className="duration-options six-options">{DURATION_OPTIONS.map((duration) => <button key={duration} className={preferences.duration === duration ? 'selected' : ''} onClick={() => onPreferences({ ...preferences, duration })}><strong>{duration === 0 ? '∞' : duration < 60 ? duration : duration / 60}</strong><span>{duration === 0 ? 'practice' : duration < 60 ? 'sec' : 'min'}</span></button>)}</div>
        </div>
        {selected === 'reaction-match' && <div className="builder-section reaction-controls-builder">
          <div className="step-heading"><span>04</span><div><h3>Configure laptop keys</h3><p>Click a control, then press the key you want to use.</p></div></div>
          <div className="reaction-key-options">
            {(['left', 'right'] as const).map((side) => <button key={side} type="button" className={bindingSide === side ? 'listening' : ''} onClick={() => setBindingSide(side)} onKeyDown={(event) => bindReactionKey(side, event)}>
              <span>{side === 'left' ? 'Left match' : 'Right match'}</span>
              <kbd>{bindingSide === side ? 'Press a key…' : formatControlKey(side === 'left' ? preferences.reactionLeftKey : preferences.reactionRightKey)}</kbd>
            </button>)}
          </div>
        </div>}
      </div>
      <aside className="start-panel">
        <div className="start-panel-noise" />
        <p className="eyebrow light-eyebrow">Your drill</p>
        <div className="drill-symbol"><Icon size={32} /></div>
        <h2>{selected === 'mixed' ? title : FAMILY_LABELS[selected]}<br />{untimed ? 'practice' : 'sprint'}</h2>
        <p className="start-description">{untimed ? 'No countdown. Keep going until you choose to finish, with feedback after every answer.' : 'Coached practice with immediate feedback, concise explanations and adaptive progression.'}</p>
        <div className="drill-summary">
          <span><Clock3 size={16} /><i>Timer</i><strong>{formatDurationSetting(preferences.duration)}</strong></span>
          <span><Gauge size={16} /><i>Level</i><strong>{preferences.difficulty}</strong></span>
          <span><Trophy size={16} /><i>Best correct</i><strong>{currentBest ?? '—'}</strong></span>
        </div>
        <button className="primary-button light wide" onClick={() => onStart({ track, label: recordLabel, families: activeFamilies, difficulty: preferences.difficulty, duration: preferences.duration, controls: { leftKey: preferences.reactionLeftKey, rightKey: preferences.reactionRightKey } })}><Play size={17} fill="currentColor" /> {untimed ? 'Start practice' : 'Begin drill'}</button>
      </aside>
    </section>
    <section className="record-board">
      <div className="record-board-heading"><div><p className="eyebrow">Personal bests</p><h3>Correct answers by level and timer</h3></div><p>{recordLabel} · records count correct answers only</p></div>
      <div className="record-table-wrap">
        <div className="record-table" role="table" aria-label={`${recordLabel} correct-answer records`}>
          <div className="record-table-row record-table-head" role="row">
            <span role="columnheader">Level</span>
            {DURATION_OPTIONS.map((duration) => <span key={duration} role="columnheader">{shortDurationSetting(duration)}</span>)}
          </div>
          {DIFFICULTIES.map((difficulty) => <div className="record-table-row" role="row" key={difficulty}>
            <span role="rowheader">{difficulty}</span>
            {DURATION_OPTIONS.map((duration) => { const record = bestCorrectRecord(sessions, track, recordLabel, difficulty, duration); const current = preferences.difficulty === difficulty && preferences.duration === duration; return <span role="cell" key={duration} className={current ? 'current-record' : ''}><strong>{record ?? '—'}</strong><small>{record === null ? 'no run' : 'correct'}</small></span> })}
          </div>)}
        </div>
      </div>
    </section>
  </div>
}

function Glyph({ token, size = 64, positionGuide = false }: { token: VisualToken; size?: number; positionGuide?: boolean }) {
  const count = token.count || 1
  const edgeOffset = positionGuide ? 27 : 18
  const positionOffset: Record<NonNullable<VisualToken['position']>, [number, number]> = { center: [0, 0], top: [0, -edgeOffset], right: [edgeOffset, 0], bottom: [0, edgeOffset], left: [-edgeOffset, 0] }
  const [offsetX, offsetY] = positionOffset[token.position || 'center']
  const baseCenters = count === 1 ? [[50, 50]] : count === 2 ? [[34, 50], [66, 50]] : [[30, 55], [50, 32], [70, 55]]
  const centers = baseCenters.map(([x, y]) => [x + offsetX, y + offsetY])
  const fill = token.filled ? 'currentColor' : 'none'
  const common = { fill, stroke: 'currentColor', strokeWidth: 5, strokeLinejoin: 'round' as const }
  const anchors: Array<{ position: NonNullable<VisualToken['position']>; x: number; y: number }> = [
    { position: 'center', x: 50, y: 50 }, { position: 'top', x: 50, y: 23 }, { position: 'right', x: 77, y: 50 }, { position: 'bottom', x: 50, y: 77 }, { position: 'left', x: 23, y: 50 },
  ]
  return <svg className={`glyph ${positionGuide ? 'position-guided' : ''}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">{positionGuide && <g className="position-guide">
    <line x1="23" y1="50" x2="77" y2="50" /><line x1="50" y1="23" x2="50" y2="77" />
    {anchors.map((anchor) => <circle key={anchor.position} className={anchor.position === (token.position || 'center') ? 'active' : ''} cx={anchor.x} cy={anchor.y} r={anchor.position === (token.position || 'center') ? 4.8 : 2.8} />)}
  </g>}{centers.slice(0, count).map(([x, y], index) => <g key={index} transform={`rotate(${token.rotation || 0} ${x} ${y})`}>
    {token.shape === 'circle' ? <circle cx={x} cy={y} r="12" {...common} />
      : token.shape === 'square' ? <rect x={x - 12} y={y - 12} width="24" height="24" rx="2" {...common} />
        : token.shape === 'diamond' ? <rect x={x - 11} y={y - 11} width="22" height="22" transform={`rotate(45 ${x} ${y})`} {...common} />
          : token.shape === 'triangle' ? <path d={`M ${x} ${y - 14} L ${x + 14} ${y + 12} L ${x - 14} ${y + 12} Z`} {...common} />
            : token.shape === 'line' ? <line x1={x - 17} y1={y} x2={x + 17} y2={y} {...common} />
              : <path d={`M ${x - 18} ${y - 6} H ${x + 5} V ${y - 16} L ${x + 22} ${y} L ${x + 5} ${y + 16} V ${y + 6} H ${x - 18} Z`} {...common} />}
  </g>)}</svg>
}

function ArrowMark({ direction, cue }: { direction: number; cue: 'lime-circle' | 'violet-diamond' }) {
  return <span className={`arrow-mark ${cue}`} aria-hidden="true">
    <svg viewBox="0 0 44 44" style={{ transform: `rotate(${direction}deg)` }}>
      <path d="M3 15h20V5l19 17-19 17V29H3z" />
    </svg>
  </span>
}

function ReactionObject({ color, shape }: { color: string; shape: 'cog' | 'burst' | 'orb' }) {
  return <span className={`reaction-object shape-${shape}`} style={{ '--reaction-color': color } as CSSProperties} aria-hidden="true"><i /></span>
}

function CubeNetDiagram({ cells, compact = false }: { cells: CubeNetCell[]; compact?: boolean }) {
  const size = compact ? 24 : 34
  const minX = Math.min(...cells.map((cell) => cell.x)); const maxX = Math.max(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y)); const maxY = Math.max(...cells.map((cell) => cell.y))
  const width = (maxX - minX + 1) * size; const height = (maxY - minY + 1) * size
  return <svg className={`cube-net-diagram ${compact ? 'compact' : ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Six-square cube net">
    {cells.map((cell, index) => <g key={`${cell.x}-${cell.y}`}>
      <rect x={(cell.x - minX) * size + 1} y={(cell.y - minY) * size + 1} width={size - 2} height={size - 2} rx="2" />
      {cell.label && <text x={(cell.x - minX + .5) * size} y={(cell.y - minY + .5) * size} dominantBaseline="central" textAnchor="middle">{cell.label}</text>}
      {!cell.label && !compact && <circle cx={(cell.x - minX + .5) * size} cy={(cell.y - minY + .5) * size} r={index === 0 ? 2.6 : 1.7} />}
    </g>)}
  </svg>
}

function SpatialAngleDiagram({ visual }: { visual: Extract<VisualSpec, { kind: 'spatial-angle' }> }) {
  const centreX = 110; const centreY = 83; const radius = 56
  const pointAt = (angle: number, distance = radius) => ({ x: centreX + Math.sin(angle * Math.PI / 180) * distance, y: centreY - Math.cos(angle * Math.PI / 180) * distance })
  const start = pointAt(visual.startAngle); const end = visual.endAngle === undefined ? null : pointAt(visual.endAngle)
  const directedTurn = end ? (visual.clockwise ? (visual.endAngle! - visual.startAngle + 360) % 360 : (visual.startAngle - visual.endAngle! + 360) % 360) : 0
  const arcStart = pointAt(visual.startAngle, 34); const arcEnd = end ? pointAt(visual.endAngle!, 34) : null
  const arc = arcEnd ? `M ${arcStart.x} ${arcStart.y} A 34 34 0 ${directedTurn > 180 ? 1 : 0} ${visual.clockwise ? 1 : 0} ${arcEnd.x} ${arcEnd.y}` : ''
  return <svg className="spatial-angle-diagram" viewBox="0 0 220 148" role="img" aria-label={end ? `Ray A and ray B with an ${visual.clockwise ? 'clockwise' : 'anticlockwise'} directed turn` : `Ray A at ${visual.startAngle} degrees`}>
    <circle className="angle-dial" cx={centreX} cy={centreY} r={radius + 12} />
    {Array.from({ length: 8 }, (_, index) => { const inner = pointAt(index * 45, radius + 6); const outer = pointAt(index * 45, radius + 12); return <line className="angle-tick" key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} /> })}
    <circle className="angle-centre" cx={centreX} cy={centreY} r="4" />
    <line className="angle-ray start" x1={centreX} y1={centreY} x2={start.x} y2={start.y} />
    <circle className="angle-endpoint start" cx={start.x} cy={start.y} r="4" />
    <text className="angle-label" x={pointAt(visual.startAngle, radius + 24).x} y={pointAt(visual.startAngle, radius + 24).y}>A</text>
    {end && <><line className="angle-ray end" x1={centreX} y1={centreY} x2={end.x} y2={end.y} /><circle className="angle-endpoint end" cx={end.x} cy={end.y} r="4" /><text className="angle-label" x={pointAt(visual.endAngle!, radius + 24).x} y={pointAt(visual.endAngle!, radius + 24).y}>B</text><path className="angle-arc" d={arc} /></>}
    {visual.label && <text className="bearing-label" x={centreX} y="139">Starting bearing {visual.label}</text>}
  </svg>
}

function SpatialSolid() {
  return <svg className="spatial-solid" viewBox="0 0 180 140" role="img" aria-label="Cube">
    <path className="cube-top" d="M90 17 145 46 90 75 35 46Z" />
    <path className="cube-left" d="M35 46 90 75 90 128 35 98Z" />
    <path className="cube-right" d="M90 75 145 46 145 98 90 128Z" />
    <path className="cube-edge" d="M90 17 145 46 145 98 90 128 35 98 35 46Z M35 46 90 75 145 46 M90 75V128" />
  </svg>
}

function SpatialChoiceVisual({ visual }: { visual: SpatialOptionVisual }) {
  return visual.kind === 'cube-net' ? <CubeNetDiagram cells={visual.cells} compact /> : null
}

function VisualPrompt({ visual, hidden = false }: { visual: VisualSpec; hidden?: boolean }) {
  if (visual.kind === 'matrix' || visual.kind === 'tiles') return <div className={`visual-grid ${visual.kind} ${visual.kind === 'tiles' && visual.positionGuide ? 'position-guide-grid' : ''}`} style={{ gridTemplateColumns: `repeat(${visual.columns}, 1fr)` }}>{visual.cells.map((cell, index) => <div className="visual-cell" key={index}>{cell ? <Glyph token={cell} positionGuide={visual.kind === 'tiles' && visual.positionGuide} /> : <span className="missing-tile">?</span>}{visual.kind === 'tiles' && <small>{index + 1}</small>}</div>)}</div>
  if (visual.kind === 'bars') { const max = Math.max(...visual.values); return <div className="data-chart">{visual.values.map((value, index) => <div key={visual.labels[index]}><span style={{ height: `${Math.max(12, value / max * 100)}%` }}><i>{value}{visual.suffix}</i></span><small>{visual.labels[index]}</small></div>)}</div> }
  if (visual.kind === 'table') return <figure className="data-table-card">{visual.title && <figcaption>{visual.title}</figcaption>}<div><table><thead><tr><th scope="col">Item</th>{visual.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{visual.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={index}>{value}</td>)}</tr>)}</tbody></table></div>{visual.note && <small>{visual.note}</small>}</figure>
  if (visual.kind === 'reference') return <div className={`reference-card ${hidden ? 'hidden' : ''}`}><small>{hidden ? 'REFERENCE HIDDEN' : visual.caption}</small>{hidden ? <strong>Now answer from memory</strong> : visual.lines.map((line, index) => <code key={index}>{line}</code>)}</div>
  if (visual.kind === 'memory') return <div className="flash-grid" style={{ gridTemplateColumns: `repeat(${visual.size}, 1fr)` }}>{Array.from({ length: visual.size * visual.size }, (_, index) => <span key={index} className={!hidden && visual.cells.includes(index) ? 'lit' : ''} />)}</div>
  if (visual.kind === 'sequence') return <div className="sequence-board static" style={{ gridTemplateColumns: `repeat(${visual.size}, 1fr)` }}>{Array.from({ length: visual.size * visual.size }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
  if (visual.kind === 'arrow-shift') return <div className="arrow-board static">{Array.from({ length: 25 }, (_, index) => { const item = visual.after.find((candidate) => candidate.cell === index); return <span key={index}>{item && <ArrowMark direction={item.direction} cue={item.cue} />}</span> })}</div>
  if (visual.kind === 'reaction-match') return <div className="reaction-static"><ReactionObject color={visual.leftColor} shape={visual.shape} /><ReactionObject color={visual.targetSide === 'left' ? visual.leftColor : visual.rightColor} shape={visual.shape} /><ReactionObject color={visual.rightColor} shape={visual.shape} /></div>
  if (visual.kind === 'spatial-angle') return <SpatialAngleDiagram visual={visual} />
  if (visual.kind === 'cube-net') return <div className="cube-net-card"><CubeNetDiagram cells={visual.cells} /></div>
  if (visual.kind === 'spatial-solid') return <div className="spatial-solid-card"><SpatialSolid /></div>
  const checkpoints = new Map((visual.checkpoints || []).map((item) => [item.cell, item.label])); const costs = new Map((visual.costs || []).map((item) => [item.cell, item.cost]))
  return <div className="route-grid" style={{ gridTemplateColumns: `repeat(${visual.size}, 1fr)` }}>{Array.from({ length: visual.size * visual.size }, (_, index) => { const className = [visual.blocked.includes(index) ? 'blocked' : '', index === visual.start ? 'start' : '', index === visual.end ? 'goal' : '', checkpoints.has(index) ? 'checkpoint' : '', costs.has(index) ? 'cost' : ''].filter(Boolean).join(' '); return <span key={index} className={className}>{index === visual.start ? 'S' : index === visual.end ? 'G' : checkpoints.get(index) || costs.get(index) || ''}</span> })}</div>
}

type ReactionAnswer = (value: AnswerValue, responseMs?: number, points?: number) => void

function ReactionMatch({ exercise, onAnswer, feedback, disabled, controls }: { exercise: Exercise; onAnswer: ReactionAnswer; feedback?: 'correct' | 'incorrect' | null; disabled: boolean; controls?: { leftKey: string; rightKey: string } }) {
  if (exercise.visual?.kind !== 'reaction-match' || exercise.answer.kind !== 'choice') return null
  const { leftColor, rightColor, targetSide, shape, previewMs, responseWindowMs } = exercise.visual
  const leftKey = controls?.leftKey || 'ArrowLeft'
  const rightKey = controls?.rightKey || 'ArrowRight'
  const [phase, setPhase] = useState<'sides' | 'target'>('sides')
  const [outcome, setOutcome] = useState<'early' | 'timeout' | 'left' | 'right' | null>(null)
  const [reactionMs, setReactionMs] = useState<number | null>(null)
  const [points, setPoints] = useState(0)
  const revealAt = useRef(0)
  const responded = useRef(false)

  useEffect(() => {
    setPhase('sides')
    setOutcome(null)
    setReactionMs(null)
    setPoints(0)
    revealAt.current = 0
    responded.current = false
  }, [exercise.id])

  useEffect(() => {
    if (disabled || phase !== 'sides' || responded.current) return
    const timer = window.setTimeout(() => {
      revealAt.current = performance.now()
      setPhase('target')
    }, previewMs)
    return () => window.clearTimeout(timer)
  }, [disabled, phase, previewMs])

  const respond = useCallback((side: 'left' | 'right') => {
    if (disabled || responded.current) return
    responded.current = true
    if (phase !== 'target') {
      setOutcome('early')
      setReactionMs(0)
      onAnswer('early', 0, 0)
      return
    }
    const elapsed = Math.max(1, Math.round(performance.now() - revealAt.current))
    const correct = side === targetSide
    const awarded = correct ? Math.max(100, Math.round(1000 - Math.min(1, elapsed / responseWindowMs) * 900)) : 0
    setOutcome(side)
    setReactionMs(elapsed)
    setPoints(awarded)
    onAnswer(side, elapsed, awarded)
  }, [disabled, onAnswer, phase, responseWindowMs, targetSide])

  useEffect(() => {
    if (disabled || phase !== 'target' || responded.current) return
    revealAt.current = performance.now()
    const timer = window.setTimeout(() => {
      if (responded.current) return
      responded.current = true
      setOutcome('timeout')
      setReactionMs(responseWindowMs)
      onAnswer('timeout', responseWindowMs, 0)
    }, responseWindowMs)
    return () => window.clearTimeout(timer)
  }, [disabled, onAnswer, phase, responseWindowMs])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disabled || responded.current || event.repeat) return
      if (event.key !== leftKey && event.key !== rightKey) return
      event.preventDefault()
      respond(event.key === leftKey ? 'left' : 'right')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [disabled, leftKey, respond, rightKey])

  const targetColor = targetSide === 'left' ? leftColor : rightColor
  const status = feedback === 'correct'
    ? `+${points} points · ${reactionMs} ms`
    : feedback === 'incorrect'
      ? outcome === 'early' ? 'Too early · wait for the centre' : outcome === 'timeout' ? 'Too slow · time expired' : `${reactionMs} ms · wrong side`
      : phase === 'target' ? 'React now' : 'Wait for the centre'

  return <div className={`reaction-stage phase-${phase} ${feedback || ''}`} style={{ '--reaction-window': `${responseWindowMs}ms` } as CSSProperties}>
    <p className="reaction-status" aria-live="polite">{status}</p>
    <h1>{phase === 'target' || feedback ? 'Match the centre.' : 'Get ready.'}</h1>
    <div className="reaction-arena" aria-label="Reflex Match: choose the side whose colour matches the centre object.">
      <button type="button" className="reaction-side left" disabled={disabled} onPointerDown={() => respond('left')} onClick={() => respond('left')} aria-label={`Choose left. Keyboard: ${formatControlKey(leftKey)}`}>
        <ReactionObject color={leftColor} shape={shape} /><span>Left <kbd>{formatControlKey(leftKey)}</kbd></span>
      </button>
      <div className={`reaction-target ${phase === 'target' || feedback ? 'visible' : ''}`} aria-live="off"><ReactionObject color={targetColor} shape={shape} /><span>Match</span></div>
      <button type="button" className="reaction-side right" disabled={disabled} onPointerDown={() => respond('right')} onClick={() => respond('right')} aria-label={`Choose right. Keyboard: ${formatControlKey(rightKey)}`}>
        <ReactionObject color={rightColor} shape={shape} /><span>Right <kbd>{formatControlKey(rightKey)}</kbd></span>
      </button>
      {phase === 'target' && !feedback && <i className="reaction-deadline" aria-hidden="true" />}
    </div>
    <p className="reaction-help">On touch devices, tap anywhere in the left or right half. Pressing before the centre appears fails the round.</p>
  </div>
}

function PatternRecall({ exercise, onAnswer, feedback, disabled }: { exercise: Exercise; onAnswer: (value: AnswerValue) => void; feedback?: 'correct' | 'incorrect' | null; disabled: boolean }) {
  if (exercise.visual?.kind !== 'memory' || exercise.answer.kind !== 'cells') return null
  const { size, revealMs } = exercise.visual
  const expectedCells = exercise.answer.value
  const expected = useMemo(() => new Set(expectedCells), [expectedCells])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const recallReady = elapsedMs >= revealMs

  useEffect(() => {
    setElapsedMs(0)
    setSelected([])
    setSubmitted(false)
  }, [exercise.id])

  useEffect(() => {
    if (recallReady || disabled) return
    const timer = window.setInterval(() => setElapsedMs((current) => Math.min(revealMs, current + 32)), 32)
    return () => window.clearInterval(timer)
  }, [disabled, recallReady, revealMs])

  const toggle = useCallback((cell: number) => {
    if (!recallReady || disabled || submitted) return
    setSelected((current) => current.includes(cell) ? current.filter((item) => item !== cell) : [...current, cell])
  }, [disabled, recallReady, submitted])

  const clear = useCallback(() => {
    if (!recallReady || disabled || submitted) return
    setSelected([])
  }, [disabled, recallReady, submitted])

  const submitPattern = useCallback(() => {
    if (!recallReady || disabled || submitted || !selected.length) return
    setSubmitted(true)
    onAnswer([...selected].sort((a, b) => a - b))
  }, [disabled, onAnswer, recallReady, selected, submitted])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!recallReady || disabled || submitted) return
      const letterIndex = event.key.toLowerCase().charCodeAt(0) - 97
      if (event.key.length === 1 && letterIndex >= 0 && letterIndex < size * size) toggle(letterIndex)
      if (event.key === 'Enter' && selected.length) { event.preventDefault(); submitPattern() }
      if ((event.key === 'Backspace' || event.key === 'Delete') && selected.length) { event.preventDefault(); clear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clear, disabled, recallReady, selected.length, size, submitPattern, submitted, toggle])

  const status = feedback === 'correct' ? 'Pattern matched' : feedback === 'incorrect' ? 'Pattern missed' : recallReady ? `Recall · ${selected.length} selected` : 'Memorise the pattern'
  return <div className={`pattern-stage size-${size} ${feedback || ''}`}>
    <p className="pattern-status" aria-live="polite">{status}</p>
    <h1>{recallReady ? exercise.prompt : 'Memorise the highlighted tiles.'}</h1>
    <div className={`pattern-board size-${size}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-label={recallReady ? `Pattern input grid with ${size * size} tiles.` : 'Highlighted pattern'}>
      {Array.from({ length: size * size }, (_, index) => {
        const inPattern = expected.has(index)
        const isSelected = selected.includes(index)
        const resultClass = !recallReady && inPattern ? 'lit' : feedback && inPattern && isSelected ? 'correct' : feedback && inPattern ? 'missed' : feedback && isSelected ? 'wrong' : isSelected ? 'selected' : ''
        return <button
          type="button"
          key={index}
          className={resultClass}
          disabled={!recallReady || disabled || submitted}
          aria-pressed={recallReady ? isSelected : undefined}
          aria-label={recallReady ? `Tile ${index + 1}${isSelected ? ', selected' : ''}` : inPattern ? `Highlighted tile ${index + 1}` : `Tile ${index + 1}`}
          onClick={() => toggle(index)}
        ><span>{recallReady ? index + 1 : ''}</span>{feedback && isSelected && !inPattern ? <X size={18} aria-hidden="true" /> : recallReady && isSelected ? <Check size={18} aria-hidden="true" /> : <b aria-hidden="true" />}</button>
      })}
    </div>
    {recallReady
      ? <div className="pattern-controls"><p>{feedback ? 'The grid shows correct, missed and extra selections.' : `Toggle every remembered tile. Use A–${String.fromCharCode(64 + size * size)} in reading order or click.`}</p><div><button type="button" className="pattern-clear" onClick={clear} disabled={disabled || submitted || !selected.length}>Clear</button><button type="button" className="pattern-submit" onClick={submitPattern} disabled={disabled || submitted || !selected.length}>Submit pattern</button></div></div>
      : <p className="pattern-watch-copy">The highlights will disappear automatically.</p>}
  </div>
}

function SequenceRecall({ exercise, onAnswer, disabled }: { exercise: Exercise; onAnswer: (value: AnswerValue) => void; disabled: boolean }) {
  if (exercise.visual?.kind !== 'sequence' || exercise.answer.kind !== 'sequence') return null
  const { size, path, cues, targetCue, flashMs, gapMs } = exercise.visual
  const expectedPath = exercise.answer.value
  const answerLength = expectedPath.length
  const dualStream = cues.some((cue) => cue !== targetCue)
  const targetDescription = targetCue === 'lime-circle' ? 'lime circles' : 'violet diamonds'
  const distractorDescription = targetCue === 'lime-circle' ? 'violet diamonds' : 'lime circles'
  const readyMs = 650
  const cycleMs = flashMs + gapMs
  const playbackMs = readyMs + Math.max(0, path.length - 1) * cycleMs + flashMs
  const [elapsedMs, setElapsedMs] = useState(0)
  const [entered, setEntered] = useState<number[]>([])
  const [failedAt, setFailedAt] = useState<number | null>(null)
  const [expectedAtFailure, setExpectedAtFailure] = useState<number | null>(null)
  const submitTimer = useRef<number | null>(null)
  const inputReady = elapsedMs >= playbackMs
  const playbackOffset = elapsedMs - readyMs
  const playbackIndex = playbackOffset < 0 ? -1 : Math.floor(playbackOffset / cycleMs)
  const activeCell = playbackIndex >= 0 && playbackIndex < path.length && playbackOffset % cycleMs < flashMs ? path[playbackIndex] : -1
  const activeCue = activeCell >= 0 ? cues[playbackIndex] : null

  useEffect(() => {
    setElapsedMs(0)
    setEntered([])
    setFailedAt(null)
    setExpectedAtFailure(null)
    if (submitTimer.current !== null) window.clearTimeout(submitTimer.current)
    return () => { if (submitTimer.current !== null) window.clearTimeout(submitTimer.current) }
  }, [exercise.id])

  useEffect(() => {
    if (inputReady || disabled) return
    const timer = window.setInterval(() => setElapsedMs((current) => Math.min(playbackMs, current + 32)), 32)
    return () => window.clearInterval(timer)
  }, [disabled, inputReady, playbackMs])

  const choose = useCallback((cell: number) => {
    if (!inputReady || disabled || failedAt !== null || entered.length >= answerLength) return
    const next = [...entered, cell]
    setEntered(next)
    if (cell !== expectedPath[entered.length]) {
      setFailedAt(cell)
      setExpectedAtFailure(expectedPath[entered.length])
      onAnswer(next)
      return
    }
    if (next.length === answerLength) submitTimer.current = window.setTimeout(() => onAnswer(next), 150)
  }, [answerLength, disabled, entered, expectedPath, failedAt, inputReady, onAnswer])

  const clear = useCallback(() => {
    if (disabled || failedAt !== null || !inputReady) return
    if (submitTimer.current !== null) window.clearTimeout(submitTimer.current)
    setEntered([])
  }, [disabled, failedAt, inputReady])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!inputReady || disabled) return
      const number = Number(event.key)
      const letterIndex = event.key.toLowerCase().charCodeAt(0) - 97
      if (size === 3 && Number.isInteger(number) && number >= 1 && number <= 9) choose(number - 1)
      if (size === 5 && event.key.length === 1 && letterIndex >= 0 && letterIndex < 25) choose(letterIndex)
      if ((event.key === 'Backspace' || event.key === 'Delete') && entered.length) { event.preventDefault(); clear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choose, clear, disabled, entered.length, inputReady, size])

  const status = failedAt !== null
    ? `Incorrect · tile ${expectedAtFailure! + 1} was next`
    : elapsedMs < readyMs
    ? 'Get ready'
    : inputReady
      ? `Your turn · ${entered.length} of ${answerLength}`
      : `Watch · ${Math.min(path.length, playbackIndex + 1)} of ${path.length}`

  return <div className={`sequence-stage size-${size} ${failedAt !== null ? 'failed' : ''} ${inputReady ? 'recall' : 'playback'}`}>
    <p className="sequence-status" aria-live="polite">{status}</p>
    <h1>{inputReady ? exercise.prompt : dualStream ? 'Watch for the target stream.' : 'Watch the sequence.'}</h1>
    {dualStream && <div className="sequence-legend" aria-label={`Repeat ${targetDescription}. Ignore ${distractorDescription}.`}><span className={targetCue}><i aria-hidden="true" /><b>Repeat {targetDescription}</b></span><span className={targetCue === 'lime-circle' ? 'violet-diamond' : 'lime-circle'}><i aria-hidden="true" /><b>Ignore {distractorDescription}</b></span></div>}
    <div className="sequence-progress" aria-hidden="true">{Array.from({ length: inputReady ? answerLength : path.length }, (_, index) => <i key={index} className={`${index < (inputReady ? entered.length : Math.max(0, playbackIndex + 1)) ? 'filled' : ''} ${failedAt !== null && index === entered.length - 1 ? 'mistake' : ''}`} />)}</div>
    <div className={`sequence-board size-${size}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-label={inputReady ? `Sequence input grid. Choose tiles one through ${size * size}.` : 'Sequence playing'}>
      {Array.from({ length: size * size }, (_, index) => <button
        type="button"
        key={index}
        className={`${index === activeCell ? `active ${activeCue}` : ''} ${inputReady && entered.includes(index) ? 'used' : ''} ${failedAt === index ? 'mistake' : ''} ${expectedAtFailure === index ? 'expected' : ''}`}
        disabled={!inputReady || disabled || failedAt !== null || entered.length >= answerLength}
        aria-label={inputReady ? failedAt === index ? `Tile ${index + 1}, your incorrect choice` : expectedAtFailure === index ? `Tile ${index + 1}, correct next tile` : `Tile ${index + 1}` : index === activeCell ? `Flashing ${activeCue === 'lime-circle' ? 'lime circle' : 'violet diamond'} on tile ${index + 1}` : `Tile ${index + 1}`}
        onClick={() => choose(index)}
      ><span>{inputReady ? index + 1 : ''}</span>{failedAt === index ? <X size={18} aria-hidden="true" /> : expectedAtFailure === index ? <Check size={18} aria-hidden="true" /> : <b aria-hidden="true" />}</button>)}
    </div>
    {inputReady
      ? failedAt !== null
        ? <div className="sequence-correction" aria-live="polite"><span className="chosen"><X size={15} /> You chose <b>tile {failedAt + 1}</b></span><ArrowRight size={16} /><span className="should-be"><Check size={15} /> Next was <b>tile {expectedAtFailure! + 1}</b></span></div>
        : <div className="sequence-controls"><p>Select the tiles in order. {size === 5 ? 'Use A–Y in reading order or click.' : 'Use keys 1–9 or click.'}</p><button type="button" onClick={clear} disabled={disabled || !entered.length || entered.length >= answerLength}>Clear sequence</button></div>
      : <p className="sequence-watch-copy">{dualStream ? `Remember only the ${targetDescription}. The other shape and colour is a distractor.` : 'Keep the exact order in mind. Input unlocks after the final flash.'}</p>}
  </div>
}

function ArrowShift({ exercise, onAnswer, feedback, disabled }: { exercise: Exercise; onAnswer: (value: AnswerValue) => void; feedback?: 'correct' | 'incorrect' | null; disabled: boolean }) {
  if (exercise.visual?.kind !== 'arrow-shift' || exercise.answer.kind !== 'cell') return null
  const { before, after, targetCue, changedCells, targetCell, firstRevealMs, gapMs, secondRevealMs } = exercise.visual
  const readyMs = 600
  const firstEnd = readyMs + firstRevealMs
  const secondStart = firstEnd + gapMs
  const playbackMs = secondStart + secondRevealMs
  const [elapsedMs, setElapsedMs] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const recallReady = elapsedMs >= playbackMs
  const phase = elapsedMs < readyMs ? 'ready' : elapsedMs < firstEnd ? 'first' : elapsedMs < secondStart ? 'gap' : recallReady ? 'recall' : 'second'
  const hasDistractors = before.some((item) => item.cue !== targetCue)
  const targetDescription = targetCue === 'lime-circle' ? 'green' : 'purple'
  const distractorDescription = targetCue === 'lime-circle' ? 'purple' : 'green'
  const shownItems = feedback ? after : phase === 'first' ? before : phase === 'second' ? after : []
  const itemByCell = new Map(shownItems.map((item) => [item.cell, item]))

  useEffect(() => {
    setElapsedMs(0)
    setSelected(null)
  }, [exercise.id])

  useEffect(() => {
    if (recallReady || disabled) return
    const timer = window.setInterval(() => setElapsedMs((current) => Math.min(playbackMs, current + 32)), 32)
    return () => window.clearInterval(timer)
  }, [disabled, playbackMs, recallReady])

  const choose = useCallback((cell: number) => {
    if (!recallReady || disabled || selected !== null) return
    setSelected(cell)
    onAnswer(cell)
  }, [disabled, onAnswer, recallReady, selected])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!recallReady || disabled || selected !== null || event.key.length !== 1) return
      const cell = event.key.toLowerCase().charCodeAt(0) - 97
      if (cell >= 0 && cell < 25) choose(cell)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choose, disabled, recallReady, selected])

  const status = feedback === 'correct'
    ? `Correct · tile ${targetCell + 1} changed`
    : feedback === 'incorrect'
      ? `Incorrect · tile ${targetCell + 1} changed`
      : phase === 'ready'
        ? 'Get ready'
        : phase === 'first'
          ? 'Snapshot 1 of 2'
          : phase === 'gap'
            ? 'Hold the first grid'
            : phase === 'second'
              ? 'Snapshot 2 of 2'
              : 'Select the changed arrow'
  const heading = recallReady
    ? exercise.prompt
    : phase === 'ready'
      ? hasDistractors ? `Track the ${targetDescription} arrows.` : 'Track every arrow.'
      : phase === 'first'
        ? 'Memorise the first grid.'
        : phase === 'gap'
          ? 'Keep it in mind.'
          : 'Spot what changed.'
  const directionNames = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']

  return <div className={`arrow-shift-stage phase-${phase} ${feedback || ''}`}>
    <p className="arrow-shift-status" aria-live="polite">{status}</p>
    <h1>{heading}</h1>
    {hasDistractors && <div className="arrow-shift-legend" aria-label={`Track ${targetDescription} arrows. Ignore ${distractorDescription} arrows.`}>
      <span><ArrowMark direction={0} cue={targetCue} /><b>Track {targetDescription}</b></span>
      <span><ArrowMark direction={0} cue={targetCue === 'lime-circle' ? 'violet-diamond' : 'lime-circle'} /><b>Ignore {distractorDescription}</b></span>
    </div>}
    <div className="arrow-shift-progress" aria-hidden="true"><i className={phase !== 'ready' ? 'filled' : ''} /><i className={phase === 'second' || phase === 'recall' ? 'filled' : ''} /></div>
    <div className="arrow-board" aria-label={recallReady ? 'Arrow Shift answer grid. Choose one of 25 tiles.' : phase === 'first' ? 'First arrow snapshot' : phase === 'second' ? 'Second arrow snapshot' : 'Arrow grid hidden'}>
      {Array.from({ length: 25 }, (_, index) => {
        const item = itemByCell.get(index)
        const correct = !!feedback && index === targetCell
        const wrong = feedback === 'incorrect' && selected === index
        const ignoredChange = !!feedback && changedCells.includes(index) && index !== targetCell
        const className = [item ? `occupied ${item.cue}` : '', correct ? 'correct' : '', wrong ? 'wrong' : '', ignoredChange ? 'ignored-change' : ''].filter(Boolean).join(' ')
        const itemDescription = item ? `${item.cue === 'lime-circle' ? 'green' : 'purple'} arrow pointing ${directionNames[item.direction / 45]}` : 'empty'
        const resultDescription = correct ? ', correct changed arrow' : wrong ? ', your choice' : ignoredChange ? ', changed distractor to ignore' : ''
        return <button type="button" key={index} className={className} disabled={!recallReady || disabled || selected !== null} onClick={() => choose(index)} aria-label={recallReady ? `Tile ${index + 1}${resultDescription}` : `Tile ${index + 1}, ${itemDescription}`}>
          {item && <ArrowMark direction={item.direction} cue={item.cue} />}
          {correct ? <Check className="arrow-result-icon" size={17} aria-hidden="true" /> : wrong ? <X className="arrow-result-icon" size={17} aria-hidden="true" /> : ignoredChange ? <small>ignore</small> : null}
        </button>
      })}
    </div>
    {feedback
      ? <div className="arrow-shift-correction" aria-live="polite">{feedback === 'incorrect' && <span className="chosen"><X size={15} /> You chose <b>tile {(selected ?? 0) + 1}</b></span>}{feedback === 'incorrect' && <ArrowRight size={16} />}<span className="should-be"><Check size={15} /> Changed arrow <b>tile {targetCell + 1}</b></span></div>
      : recallReady
        ? <p className="arrow-shift-help">Select its remembered location. Use A–Y in reading order or click.</p>
        : <p className="arrow-shift-help">Both grids disappear automatically. Keep your eyes on the whole board.</p>}
  </div>
}

function ExercisePrompt({ exercise, onAnswer, value, onValue, feedback, disabled = false, controls }: { exercise: Exercise; onAnswer: ReactionAnswer; value: string; onValue: (value: string) => void; feedback?: 'correct' | 'incorrect' | null; disabled?: boolean; controls?: { leftKey: string; rightKey: string } }) {
  const [memoryHidden, setMemoryHidden] = useState(false)
  useEffect(() => { setMemoryHidden(false); if (exercise.visual?.kind !== 'memory' && exercise.visual?.kind !== 'reference') return; const timeout = window.setTimeout(() => setMemoryHidden(true), exercise.visual.revealMs); return () => window.clearTimeout(timeout) }, [exercise])
  const submit = (event: FormEvent) => { event.preventDefault(); if (value.trim()) onAnswer(Number(value)) }
  const delayedRecall = exercise.visual?.kind === 'memory' || exercise.visual?.kind === 'reference'
  const promptClass = [exercise.prompt.length > 42 ? 'long-prompt' : ''].filter(Boolean).join(' ')
  const choiceClass = [
    'choice-grid',
    exercise.options?.some((option) => option.visual || option.spatialVisual) ? 'visual-options' : '',
    exercise.options?.some((option) => option.spatialVisual) ? 'spatial-net-options' : '',
    exercise.family === 'constraints' ? 'logic-text-options' : '',
    exercise.family === 'rule-breaker' ? 'tile-index-options' : '',
    exercise.family === 'debug-scan' ? 'debug-options' : '',
  ].filter(Boolean).join(' ')
  if (exercise.answer.kind === 'cells') return <PatternRecall exercise={exercise} onAnswer={onAnswer} feedback={feedback} disabled={disabled} />
  if (exercise.answer.kind === 'sequence') return <SequenceRecall exercise={exercise} onAnswer={onAnswer} disabled={disabled} />
  if (exercise.answer.kind === 'cell') return <ArrowShift exercise={exercise} onAnswer={onAnswer} feedback={feedback} disabled={disabled} />
  if (exercise.visual?.kind === 'reaction-match') return <ReactionMatch exercise={exercise} onAnswer={onAnswer} feedback={feedback} disabled={disabled} controls={controls} />
  if (delayedRecall && !memoryHidden) return <>{exercise.visual && <VisualPrompt visual={exercise.visual} />}<p className="recall-status">Memorise the information. The question will appear when it is hidden.</p></>
  return <>{exercise.visual && <VisualPrompt visual={exercise.visual} hidden={memoryHidden} />}<p className="exercise-instruction">{exercise.instruction}</p><h1 className={promptClass}>{exercise.prompt}</h1>{exercise.answer.kind === 'number' ? <form className="answer-form" onSubmit={submit}><div className="answer-wrap"><input autoFocus value={value} disabled={disabled} inputMode="decimal" onChange={(event) => onValue(event.target.value.replace(/[^0-9.\-]/g, ''))} placeholder="?" />{feedback && <span className="answer-feedback-icon">{feedback === 'correct' ? <Check size={26} /> : <X size={26} />}</span>}</div><button disabled={!value.trim() || disabled}>Submit <span>↵</span></button></form> : <div className={choiceClass}>{exercise.options?.map((option, index) => <button key={option.id} disabled={disabled} onClick={() => onAnswer(option.id)}>{option.visual ? <Glyph token={option.visual} size={54} positionGuide={exercise.family === 'spatial'} /> : option.spatialVisual ? <SpatialChoiceVisual visual={option.spatialVisual} /> : <span>{option.label}</span>}<kbd>{index + 1}</kbd></button>)}</div>}</>
}

function PracticeSession({ config, onFinish, onExit }: { config: SessionConfig; onFinish: (config: SessionConfig, attempts: Attempt[], elapsed: number) => void; onExit: () => void }) {
  const untimed = config.duration === 0
  const initialLevel = config.difficulty === 'Warm-up' ? 2 : config.difficulty === 'Standard' ? 4 : config.difficulty === 'Hard' ? 9 : 3
  const sessionSeed = useRef(Date.now()).current
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(config.families.map((family) => [family, initialLevel])))
  const [counter, setCounter] = useState(0)
  const [exercise, setExercise] = useState(() => generateExercise(balancedFamilyAt(config.families, 0, sessionSeed), initialLevel, sessionSeed))
  const recentVariants = useRef<Record<string, string[]>>({ [exercise.family]: exercise.variant ? [exercise.variant] : [] })
  const recentPrompts = useRef<string[]>([exercise.prompt])
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const attemptsRef = useRef<Attempt[]>([])
  const [remaining, setRemaining] = useState(config.duration)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [streak, setStreak] = useState(0)
  const questionStartedAt = useRef(Date.now()); const finished = useRef(false)
  const finish = useCallback(() => { if (finished.current) return; finished.current = true; onFinish(config, attemptsRef.current, Math.max(1, elapsedRef.current)) }, [config, onFinish])
  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (!untimed) setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          window.setTimeout(finish, 0)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finish, paused, untimed])
  const next = useCallback((nextLevels: Record<string, number>) => {
    const nextCounter = counter + 1
    const family = balancedFamilyAt(config.families, nextCounter, sessionSeed)
    const familyVariants = recentVariants.current[family] || []
    const candidate = generateVariedExercise(family, nextLevels[family], sessionSeed + nextCounter * 7919, familyVariants, recentPrompts.current)
    recentVariants.current[family] = [...familyVariants, ...(candidate.variant ? [candidate.variant] : [])].slice(-4)
    recentPrompts.current = [...recentPrompts.current, candidate.prompt].slice(-12)
    setCounter(nextCounter)
    setExercise(candidate)
    setValue('')
    setFeedback(null)
    questionStartedAt.current = Date.now()
  }, [config.families, counter, sessionSeed])
  const answer: ReactionAnswer = (given, responseMsOverride, points) => { if (feedback || paused) return; const correct = isCorrect(exercise, given); const responseMs = responseMsOverride ?? Date.now() - questionStartedAt.current; const attempt: Attempt = { exercise, given, correct, skipped: false, responseMs, points }; const updated = [...attemptsRef.current, attempt]; attemptsRef.current = updated; setAttempts(updated); setFeedback(correct ? 'correct' : 'incorrect'); setStreak((current) => correct ? current + 1 : 0); const nextLevels = { ...levels }; if (config.difficulty === 'Adaptive') { if (correct && responseMs < exercise.responseTargetMs) nextLevels[exercise.family] = Math.min(10, levels[exercise.family] + 1); if (!correct) nextLevels[exercise.family] = Math.max(1, levels[exercise.family] - 1); setLevels(nextLevels) } const feedbackMs = exercise.answer.kind === 'sequence' && !correct ? 950 : exercise.answer.kind === 'cell' ? 1100 : exercise.family === 'reaction-match' ? correct ? 850 : 1050 : correct ? 650 : 1200; window.setTimeout(() => next(nextLevels), feedbackMs) }
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (exercise.answer.kind !== 'choice' || exercise.visual?.kind === 'reaction-match' || feedback || paused) return; const option = exercise.options?.[Number(event.key) - 1]; if (option) answer(option.id) }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) })
  const correctCount = attempts.filter((attempt) => attempt.correct).length
  const reactionOnly = config.families.length === 1 && config.families[0] === 'reaction-match'
  const reactionPoints = attempts.reduce((sum, attempt) => sum + (attempt.points || 0), 0)
  return <div className="session-screen">
    {!untimed && <div className="session-progress" style={{ width: `${(config.duration - remaining) / config.duration * 100}%` }} />}
    <header className="session-header"><Brand /><div className="session-label"><span className="pulse-dot" /> {config.label} · {config.difficulty}{untimed ? ' · Practice' : ''}</div><div className="session-header-actions">{untimed && <button className="finish-practice-button" aria-label="Finish practice" disabled={!attempts.length} onClick={finish}><Check size={14} /><span>Finish practice</span></button>}<button className="pause-button" onClick={() => setPaused((current) => !current)}>{paused ? <Play size={14} /> : 'Ⅱ'} {paused ? 'Resume' : 'Pause'}</button><button className="icon-button" onClick={onExit}><X size={20} /></button></div></header>
    <main className={`session-main ${feedback || ''}`}><div className="session-metric left-metric"><span><Flame size={18} /> Streak</span><strong>{streak}</strong><small>{streak >= 5 ? 'On fire' : 'Build momentum'}</small></div><div className="session-metric right-metric">{reactionOnly ? <><span><Zap size={18} /> Points</span><strong>{reactionPoints}</strong><small>Speed-weighted total</small></> : <><span><Target size={18} /> Accuracy</span><strong>{attempts.length ? Math.round(correctCount / attempts.length * 100) : 100}%</strong><small>{correctCount} of {attempts.length} correct</small></>}</div><section className="question-area exercise-question-area"><div className={`timer-display ${untimed ? 'practice-timer' : ''}`}><Clock3 size={18} /><span>{formatTime(untimed ? elapsed : remaining)}</span>{untimed && <small>elapsed</small>}</div><p className="question-count">{exercise.label} <span>·</span> Level {levels[exercise.family]} <span>·</span> {levelName(levels[exercise.family])}</p><ExercisePrompt key={exercise.id} exercise={exercise} onAnswer={answer} value={value} onValue={setValue} feedback={feedback} disabled={paused || !!feedback} controls={config.controls} /><div className={`feedback-copy explanation ${feedback ? 'show' : ''}`}>{feedback === 'correct' ? `Correct. ${exercise.explanation}` : feedback === 'incorrect' ? `Not quite. ${exercise.explanation}` : ''}</div></section><div className="session-footer-note"><Keyboard size={15} /> {exercise.family === 'reaction-match' ? `Use ${formatControlKey(config.controls?.leftKey || 'ArrowLeft')} / ${formatControlKey(config.controls?.rightKey || 'ArrowRight')} or tap a side` : 'Use the keyboard or click an answer'}</div></main>
    {paused && <div className="pause-overlay"><div className="pause-card"><TimerReset size={28} /><p>Session paused</p><h2>Catch your breath.</h2><button className="primary-button dark" onClick={() => { setPaused(false); questionStartedAt.current = Date.now() }}>Resume drill <Play size={16} /></button></div></div>}
  </div>
}

const assessmentSections: Array<{ label: string; families: ExerciseFamily[]; seconds: number }> = [
  { label: 'Quantitative', families: NUMBER_FAMILIES, seconds: 240 },
  { label: 'Abstract patterns', families: ['sequences', 'matrix', 'rule-breaker'], seconds: 240 },
  { label: 'Deductive logic', families: ['constraints'], seconds: 240 },
  { label: 'Checking accuracy', families: ['debug-scan'], seconds: 180 },
]

function AssessmentSession({ onFinish, onExit }: { onFinish: (config: SessionConfig, attempts: Attempt[], elapsed: number) => void; onExit: () => void }) {
  const [sectionIndex, setSectionIndex] = useState(0); const [remaining, setRemaining] = useState(assessmentSections[0].seconds); const [questionIndex, setQuestionIndex] = useState(0); const [answers, setAnswers] = useState<Record<string, Attempt>>({}); const [value, setValue] = useState(''); const questionStarted = useRef(Date.now()); const assessmentStarted = useRef(Date.now()); const finished = useRef(false)
  const sections = useMemo(() => assessmentSections.map((section, sIndex) => ({ ...section, exercises: Array.from({ length: 12 }, (_, index) => generateExercise(section.families[index % section.families.length], Math.min(8, 4 + Math.floor(index / 3)), 900001 + sIndex * 1000 + index * 17)) })), [])
  const section = sections[sectionIndex]; const exercise = section.exercises[questionIndex]
  const config = useMemo<SessionConfig>(() => ({ track: 'assessment', label: 'General Technical Screen', families: [...new Set(assessmentSections.flatMap((item) => item.families))], difficulty: 'Standard', duration: 900, simulation: true }), [])
  const finishAssessment = useCallback((finalAnswers: Record<string, Attempt>) => { if (finished.current) return; finished.current = true; const allExercises = sections.flatMap((item) => item.exercises); const attempts = allExercises.map((item) => finalAnswers[item.id] || { exercise: item, given: null, correct: false, skipped: true, responseMs: 0 }); onFinish(config, attempts, Math.min(900, Math.max(1, Math.round((Date.now() - assessmentStarted.current) / 1000)))) }, [config, onFinish, sections])
  const advanceSection = useCallback(() => { if (sectionIndex >= sections.length - 1) { finishAssessment(answers); return } setSectionIndex((index) => index + 1); setQuestionIndex(0); setRemaining(sections[sectionIndex + 1].seconds); setValue(''); questionStarted.current = Date.now() }, [answers, finishAssessment, sectionIndex, sections])
  useEffect(() => { const timer = window.setInterval(() => setRemaining((current) => { if (current <= 1) { window.clearInterval(timer); window.setTimeout(advanceSection, 0); return 0 } return current - 1 }), 1000); return () => window.clearInterval(timer) }, [advanceSection])
  const go = (index: number) => { setQuestionIndex(Math.max(0, Math.min(section.exercises.length - 1, index))); setValue(''); questionStarted.current = Date.now() }
  const answer = (given: AnswerValue) => { const attempt: Attempt = { exercise, given, correct: isCorrect(exercise, given), skipped: false, responseMs: Date.now() - questionStarted.current }; setAnswers((current) => ({ ...current, [exercise.id]: attempt })); window.setTimeout(() => go(questionIndex < section.exercises.length - 1 ? questionIndex + 1 : questionIndex), 140) }
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (exercise.answer.kind !== 'choice') return; const option = exercise.options?.[Number(event.key) - 1]; if (option) answer(option.id) }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) })
  return <div className="session-screen assessment-screen"><div className="session-progress" style={{ width: `${((assessmentSections.slice(0, sectionIndex).reduce((sum, item) => sum + item.seconds, 0) + section.seconds - remaining) / 900) * 100}%` }} /><header className="session-header"><Brand /><div className="session-label"><span className="pulse-dot" /> Mock assessment · Section {sectionIndex + 1}/4</div><button className="icon-button" onClick={onExit}><X size={20} /></button></header><main className="assessment-main"><aside className="assessment-sidebar"><p className="eyebrow">Current section</p><h2>{section.label}</h2><div className="assessment-time"><Clock3 size={18} /> {formatTime(remaining)}</div><div className="question-nav">{section.exercises.map((item, index) => <button key={item.id} className={`${index === questionIndex ? 'current' : ''} ${answers[item.id] ? 'answered' : ''}`} onClick={() => go(index)}>{index + 1}</button>)}</div><p>You can skip and revisit any question in this section. Answers are revealed only after the full assessment.</p></aside><section className="assessment-question"><p className="question-count">Question {questionIndex + 1} of {section.exercises.length}</p><ExercisePrompt key={exercise.id} exercise={exercise} onAnswer={answer} value={value} onValue={setValue} /><div className="assessment-controls"><button className="text-button" disabled={questionIndex === 0} onClick={() => go(questionIndex - 1)}><ArrowLeft size={15} /> Previous</button><button className="text-button" onClick={() => go(questionIndex + 1)}>Skip / next <ArrowRight size={15} /></button><button className="primary-button dark" onClick={advanceSection}>{sectionIndex === 3 ? 'Finish assessment' : 'Next section'} <ArrowRight size={15} /></button></div></section></main></div>
}

function Results({ result, attempts, onHome, onRetry }: { result: SessionResult; attempts: Attempt[]; onHome: () => void; onRetry: () => void }) {
  const accuracy = result.total ? Math.round(result.correct / result.total * 100) : 0
  const reactionOnlyResult = Object.keys(result.breakdown).length === 1 && !!result.breakdown['reaction-match']
  const missed = attempts.filter((attempt) => !attempt.correct).slice(0, 5)
  const formatGiven = (attempt: Attempt) => Array.isArray(attempt.given) ? attempt.given.map((cell) => cell + 1).join(attempt.exercise.answer.kind === 'cells' ? ', ' : ' → ') : attempt.exercise.answer.kind === 'cell' && typeof attempt.given === 'number' ? `Tile ${attempt.given + 1}` : attempt.given
  return <div className="results-screen"><header className="results-header"><Brand /><button className="text-button" onClick={onHome}>Back to home <X size={16} /></button></header><main className="results-content"><div className="results-kicker"><span><Trophy size={18} /></span> {result.track === 'assessment' ? 'Assessment complete' : result.configuredDuration === 0 ? 'Practice complete' : 'Drill complete'}</div><h1>{accuracy >= 85 ? 'Exceptionally sharp.' : accuracy >= 70 ? 'Strong work.' : accuracy >= 50 ? 'Momentum built.' : 'Baseline captured.'}</h1><p>{result.track === 'assessment' ? 'This is a personal practice score, not a commercial assessment percentile.' : 'Immediate feedback turns each rep into useful practice.'}</p><section className="score-panel"><div className="score-main"><p>Performance score</p><div><strong>{result.score}</strong><span>/100</span></div><small>Personal training metric</small></div><div className="score-metrics"><div><span className="result-icon mint"><Target size={19} /></span><p>Accuracy</p><strong>{accuracy}%</strong><small>{result.correct} / {result.total} correct</small></div><div><span className="result-icon yellow"><Zap size={19} /></span><p>Median response</p><strong>{result.medianMs ? reactionOnlyResult ? `${result.medianMs}ms` : `${(result.medianMs / 1000).toFixed(1)}s` : '—'}</strong><small>Answered items</small></div><div><span className="result-icon pink">{reactionOnlyResult ? <Gauge size={19} /> : <ArrowRight size={19} />}</span><p>{reactionOnlyResult ? 'Reaction points' : 'Skipped'}</p><strong>{reactionOnlyResult ? result.points || 0 : result.skipped}</strong><small>{reactionOnlyResult ? 'Speed-weighted total' : 'Unanswered'}</small></div></div></section><section className="breakdown-panel"><div className="panel-heading"><div><p className="eyebrow">Skill breakdown</p><h3>Where the session landed</h3></div></div><div className="breakdown-grid">{Object.entries(result.breakdown).map(([family, raw]) => { const item = raw as SkillBreakdown; return <div key={family}><strong>{FAMILY_LABELS[family as ExerciseFamily]}</strong><span>{item.attempted ? Math.round(item.correct / item.attempted * 100) : 0}%</span><small>{item.correct}/{item.attempted} correct · {item.medianMs ? family === 'reaction-match' ? `${item.medianMs}ms` : `${(item.medianMs / 1000).toFixed(1)}s` : '—'} median</small></div> })}</div></section><div className="results-lower"><section className="review-panel"><div className="panel-heading"><div><p className="eyebrow">Quick review</p><h3>{missed.length ? 'Worth another look' : 'A perfect run'}</h3></div><span>{missed.length} shown</span></div><div className="missed-list rich-review">{missed.map((attempt) => <div key={attempt.exercise.id}><span>{attempt.exercise.prompt.replace('\n', ' / ')}</span><i>{attempt.skipped ? 'Skipped' : `Your answer: ${formatGiven(attempt)}`}</i><strong>{attempt.exercise.explanation}</strong></div>)}</div></section><section className="next-panel"><p className="eyebrow">Next move</p><h3>Lock it in with one more.</h3><p>Repeat the same configuration or return to choose another skill.</p><button className="primary-button dark wide" onClick={onRetry}><TimerReset size={17} /> Run it again</button><button className="text-button centered" onClick={onHome}>Finish for now</button></section></div></main></div>
}

function ProgressPage({ sessions, onStart }: { sessions: SessionResult[]; onStart: () => void }) {
  const total = sessions.reduce((sum, session) => sum + session.total, 0); const correct = sessions.reduce((sum, session) => sum + session.correct, 0)
  const trainedSeconds = sessions.reduce((sum, session) => sum + session.duration, 0)
  const aggregate = useMemo(() => { const map = new Map<ExerciseFamily, { attempts: number; correct: number; medians: number[]; level: number }>(); sessions.forEach((session) => Object.entries(session.breakdown).forEach(([key, raw]) => { if (!isExerciseFamily(key)) return; const family = key; const item = raw as SkillBreakdown; const current = map.get(family) || { attempts: 0, correct: 0, medians: [], level: 0 }; current.attempts += item.attempted; current.correct += item.correct; if (item.medianMs) current.medians.push(item.medianMs); if (item.attempted > 0 && item.correct / item.attempted >= .7) current.level = Math.max(current.level, item.maxLevel); map.set(family, current) })); return [...map.entries()].sort((a, b) => (a[1].correct / Math.max(1, a[1].attempts)) - (b[1].correct / Math.max(1, b[1].attempts))) }, [sessions])
  const recordScopes = useMemo(() => {
    const seen = new Map<string, { track: Track; label: string }>()
    sessions.filter((session) => session.label !== 'General Technical Screen').forEach((session) => {
      const key = `${session.track}\u0000${session.label}`
      if (!seen.has(key)) seen.set(key, { track: session.track, label: session.label })
    })
    return [...seen.values()]
  }, [sessions])
  const [recordScopeIndex, setRecordScopeIndex] = useState(0)
  const recordScope = recordScopes[Math.min(recordScopeIndex, Math.max(0, recordScopes.length - 1))]
  const trendFor = (family: ExerciseFamily) => {
    const accuracyFor = (items: SessionResult[]) => {
      const data = items.flatMap((session) => session.breakdown[family] ? [session.breakdown[family]!] : [])
      const attempts = data.reduce((sum, item) => sum + item.attempted, 0)
      return attempts ? data.reduce((sum, item) => sum + item.correct, 0) / attempts * 100 : null
    }
    const recent = accuracyFor(sessions.slice(0, 5)); const previous = accuracyFor(sessions.slice(5, 10))
    if (recent === null || previous === null) return 'baseline'
    const delta = Math.round(recent - previous)
    return `${delta >= 0 ? '+' : ''}${delta} pts recent`
  }
  if (!sessions.length) return <div className="page"><section className="page-intro"><p className="eyebrow">Progress</p><h1>Your training history.</h1><p>Everything stays on this device.</p></section><div className="empty-progress"><span><BarChart3 size={28} /></span><h2>No sessions yet.</h2><p>Complete a drill to establish your first personal baseline.</p><button className="primary-button dark" onClick={onStart}>Start training</button></div></div>
  return <div className="page"><section className="page-intro"><p className="eyebrow">Progress</p><h1>Your reasoning profile.</h1><p>Personal trends by skill, without invented population rankings.</p></section><section className="progress-hero"><div><p>Sessions completed</p><strong>{sessions.length}</strong><span>{trainedSeconds < 60 ? '<1 min trained' : `${Math.round(trainedSeconds / 60)} min trained`}</span></div><div><p>Overall accuracy</p><strong>{total ? Math.round(correct / total * 100) : 0}%</strong><span>{correct} correct answers</span></div><div><p>Most correct</p><strong>{Math.max(...sessions.map((s) => s.correct))}</strong><span>In one session</span></div></section>{recordScope && <section className="record-board progress-record-board"><div className="record-board-heading"><div><p className="eyebrow">Personal bests</p><h3>Correct answers by level and timer</h3></div><label>Drill<select value={recordScopeIndex} onChange={(event) => setRecordScopeIndex(Number(event.target.value))}>{recordScopes.map((scope, index) => <option key={`${scope.track}-${scope.label}`} value={index}>{scope.label}</option>)}</select></label></div><div className="record-table-wrap"><div className="record-table" role="table" aria-label={`${recordScope.label} correct-answer records`}><div className="record-table-row record-table-head" role="row"><span role="columnheader">Level</span>{DURATION_OPTIONS.map((duration) => <span key={duration} role="columnheader">{shortDurationSetting(duration)}</span>)}</div>{DIFFICULTIES.map((difficulty) => <div className="record-table-row" role="row" key={difficulty}><span role="rowheader">{difficulty}</span>{DURATION_OPTIONS.map((duration) => { const record = bestCorrectRecord(sessions, recordScope.track, recordScope.label, difficulty, duration); return <span role="cell" key={duration}><strong>{record ?? '—'}</strong><small>{record === null ? 'no run' : 'correct'}</small></span> })}</div>)}</div></div></section>}<div className="section-heading"><div><p className="eyebrow">Skills</p><h3>Needs practice first</h3></div></div><section className="skill-progress-grid">{aggregate.map(([family, item]) => { const Icon = familyIcons[family]; const accuracy = Math.round(item.correct / Math.max(1, item.attempts) * 100); return <div className="skill-progress-card" key={family}><span><Icon size={18} /></span><div><strong>{FAMILY_LABELS[family]}</strong><small>{item.attempts} attempted · stable level {item.level || '—'}</small></div><b>{accuracy}%</b><div className="skill-meter"><i style={{ width: `${accuracy}%` }} /></div><em>{median(item.medians) ? `${(median(item.medians) / 1000).toFixed(1)}s median · ${trendFor(family)}` : trendFor(family)}</em></div> })}</section><section className="history-panel"><div className="panel-heading"><div><p className="eyebrow">History</p><h3>Recent sessions</h3></div></div><div className="history-list">{sessions.slice(0, 10).map((session) => <div key={session.id}><span className="history-icon"><BrainCircuit size={17} /></span><span><strong>{session.label}</strong><small>{new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><span><strong>{session.correct}</strong><small>correct</small></span><span><strong>{session.total ? Math.round(session.correct / session.total * 100) : 0}%</strong><small>accuracy</small></span><span><strong>{session.medianMs ? `${(session.medianMs / 1000).toFixed(1)}s` : '—'}</strong><small>median</small></span></div>)}</div></section></div>
}

export default function App() {
  const [view, setView] = useState<View>('dashboard'); const [sessions, setSessions] = useState<SessionResult[]>(loadSessions); const [preferences, setPreferences] = useState<Preferences>(loadPreferences); const [config, setConfig] = useState<SessionConfig | null>(null); const [lastResult, setLastResult] = useState<SessionResult | null>(null); const [lastAttempts, setLastAttempts] = useState<Attempt[]>([]); const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) }, [sessions]); useEffect(() => { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)) }, [preferences])
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const start = (nextConfig: SessionConfig) => { setConfig(nextConfig); setView('session') }
  const finish = useCallback((finishedConfig: SessionConfig, attempts: Attempt[], elapsed: number) => { const result = buildSessionResult(finishedConfig, attempts, elapsed); setLastAttempts(attempts); setLastResult(result); if (attempts.some((attempt) => !attempt.skipped)) setSessions((current) => [result, ...current].slice(0, 500)); setView('results') }, [])
  const retry = () => config?.simulation ? setView('assessment') : setView('session')
  if (view === 'session' && config) return <PracticeSession key={`${config.label}-${Date.now()}`} config={config} onFinish={finish} onExit={() => setView('dashboard')} />
  if (view === 'assessment') return <AssessmentSession onFinish={(assessmentConfig, attempts, elapsed) => { setConfig(assessmentConfig); finish(assessmentConfig, attempts, elapsed) }} onExit={() => setView('cognitive')} />
  if (view === 'results' && lastResult) return <Results result={lastResult} attempts={lastAttempts} onHome={() => setView('dashboard')} onRetry={retry} />
  const titles: Record<View, string> = { dashboard: 'Home', numbers: 'Fast Numbers+', logic: 'Logic Lab', cognitive: 'Cognitive Games', progress: 'Progress', session: 'Session', assessment: 'Assessment', results: 'Results' }
  return <div className="app-shell"><Sidebar view={view} onNavigate={setView} open={mobileOpen} onClose={() => setMobileOpen(false)} /><div className="main-shell"><Topbar title={titles[view]} streak={trainingStreak(sessions)} onMenu={() => setMobileOpen(true)} /><main>{view === 'dashboard' && <Dashboard sessions={sessions} onNavigate={setView} onStart={start} />}{view === 'numbers' && <PracticeLab track="numbers" families={NUMBER_FAMILIES} preferences={preferences} sessions={sessions} onPreferences={setPreferences} onStart={start} />}{view === 'logic' && <PracticeLab track="logic" families={LOGIC_FAMILIES} preferences={preferences} sessions={sessions} onPreferences={setPreferences} onStart={start} />}{view === 'cognitive' && <PracticeLab track="cognitive" families={COGNITIVE_FAMILIES} preferences={preferences} sessions={sessions} onPreferences={setPreferences} onStart={start} />}{view === 'progress' && <ProgressPage sessions={sessions} onStart={() => setView('numbers')} />}</main></div></div>
}
