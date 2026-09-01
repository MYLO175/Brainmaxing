import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Camera, Check, ChevronRight,
  Clock3, Download, Lightbulb, Mic, Play, RefreshCw, ShieldCheck, Square, Video, X,
} from 'lucide-react'
import { buildInterview, INTERVIEW_AREAS, INTERVIEW_QUESTIONS, type InterviewArea, type InterviewQuestion } from './interviewQuestions'

type Stage = 'landing' | 'device' | 'prep' | 'recording' | 'review' | 'complete'
type Recording = { question: InterviewQuestion; url: string; blob: Blob; seconds: number }

const PREP_OPTIONS = [30, 45, 60]
const ANSWER_OPTIONS = [90, 120, 180]

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function getRecorderOptions(): MediaRecorderOptions | undefined {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  const mimeType = options.find((type) => MediaRecorder.isTypeSupported(type))
  return mimeType ? { mimeType } : undefined
}

function CameraFeed({ stream, muted = true }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className="hirevue-camera-feed" />
}

function InterviewSetup({
  area, prepSeconds, answerSeconds, requesting, onArea, onPrep, onAnswer, onStart,
}: {
  area: InterviewArea
  prepSeconds: number
  answerSeconds: number
  requesting: boolean
  onArea: (area: InterviewArea) => void
  onPrep: (seconds: number) => void
  onAnswer: (seconds: number) => void
  onStart: () => void
}) {
  const selectedArea = INTERVIEW_AREAS.find((item) => item.id === area)!
  return <div className="page hirevue-page">
    <section className="hirevue-landing-hero">
      <div className="hirevue-hero-copy">
        <span className="live-badge"><span /> VIDEO INTERVIEW PRACTICE</span>
        <h1>Think clearly.<br /><em>Answer naturally.</em></h1>
        <p>A realistic three-question, one-way interview. See the prompt, use your preparation time, then answer to camera and review every recording.</p>
        <div className="hirevue-hero-actions">
          <button className="primary-button light" disabled={requesting} onClick={onStart}><Camera size={17} /> {requesting ? 'Requesting access…' : 'Check camera & microphone'}</button>
          <span><ShieldCheck size={15} /> Recordings stay in this session</span>
        </div>
      </div>
      <div className="hirevue-hero-visual" aria-hidden="true">
        <div className="mock-camera-frame"><div className="mock-person"><span /><i /></div><span className="mock-rec"><i /> REC</span><span className="mock-time">01:42</span></div>
        <div className="mock-question-card"><small>QUESTION 2 OF 3</small><strong>Tell us about a time you changed someone’s mind.</strong><span>30 seconds to prepare</span></div>
      </div>
    </section>

    <section className="hirevue-builder">
      <div className="hirevue-builder-main">
        <div className="step-heading"><span>01</span><div><h3>Choose your interview area</h3><p>The questions stay broad, behavioural and realistic for early-careers screening.</p></div></div>
        <div className="hirevue-area-grid">
          {INTERVIEW_AREAS.map((item) => <button key={item.id} className={area === item.id ? 'selected' : ''} onClick={() => onArea(item.id)}>
            <span><BriefcaseBusiness size={19} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div>{area === item.id && <Check size={15} />}
          </button>)}
        </div>
        <div className="hirevue-timing-grid">
          <div><div className="step-heading"><span>02</span><div><h3>Preparation time</h3><p>The prompt stays visible.</p></div></div><div className="segmented-control">{PREP_OPTIONS.map((seconds) => <button key={seconds} className={prepSeconds === seconds ? 'selected' : ''} onClick={() => onPrep(seconds)}>{seconds}s</button>)}</div></div>
          <div><div className="step-heading"><span>03</span><div><h3>Answer time</h3><p>Recording stops automatically.</p></div></div><div className="segmented-control">{ANSWER_OPTIONS.map((seconds) => <button key={seconds} className={answerSeconds === seconds ? 'selected' : ''} onClick={() => onAnswer(seconds)}>{seconds / 60 % 1 ? `${seconds}s` : `${seconds / 60} min`}</button>)}</div></div>
        </div>
      </div>
      <aside className="hirevue-summary">
        <p className="eyebrow light-eyebrow">Your simulation</p>
        <div className="hirevue-summary-icon"><Video size={30} /></div>
        <h2>{selectedArea.shortLabel}<br />screening</h2>
        <p>One motivation question, one experience question and one judgement question.</p>
        <div className="hirevue-summary-rows">
          <span><i>Questions</i><strong>3</strong></span>
          <span><i>Prep per question</i><strong>{prepSeconds}s</strong></span>
          <span><i>Answer per question</i><strong>{formatClock(answerSeconds)}</strong></span>
          <span><i>Question bank</i><strong>{INTERVIEW_QUESTIONS.length}</strong></span>
        </div>
        <button className="primary-button light wide" disabled={requesting} onClick={onStart}><Camera size={17} /> {requesting ? 'Requesting access…' : 'Enter interview room'}</button>
      </aside>
    </section>

    <section className="hirevue-research-note">
      <span><Lightbulb size={20} /></span><div><strong>Built around how one-way interviews actually feel</strong><p>Short preparation, a fixed response window and questions about motivation, past behaviour and practical judgement. Prompts are deliberately not deeply technical.</p></div>
    </section>
  </div>
}

export default function HireVue({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('landing')
  const [area, setArea] = useState<InterviewArea>('finance')
  const [prepSeconds, setPrepSeconds] = useState(30)
  const [answerSeconds, setAnswerSeconds] = useState(120)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [remaining, setRemaining] = useState(30)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [deviceError, setDeviceError] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedAt = useRef(0)
  const recordingsRef = useRef<Recording[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => { recordingsRef.current = recordings }, [recordings])
  useEffect(() => { streamRef.current = stream }, [stream])
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recordingsRef.current.forEach((recording) => URL.revokeObjectURL(recording.url))
  }, [])

  const close = () => {
    stream?.getTracks().forEach((track) => track.stop())
    onExit()
  }

  const requestDevices = async () => {
    setIsRequesting(true)
    setDeviceError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported')
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
      setStream(mediaStream)
      setStage('device')
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
      setDeviceError(denied ? 'Camera or microphone access was blocked. Allow access in your browser settings, then try again.' : 'Video recording is not available in this browser or app shell. Try the web version in a current browser.')
    } finally { setIsRequesting(false) }
  }

  const beginPrep = useCallback((index: number) => {
    setQuestionIndex(index)
    setRemaining(prepSeconds)
    setStage('prep')
  }, [prepSeconds])

  const startInterview = () => {
    setQuestions(buildInterview(area))
    setRecordings([])
    beginPrep(0)
  }

  const startRecording = useCallback(() => {
    if (!stream || !questions[questionIndex]) return
    try {
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, getRecorderOptions())
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
        const url = URL.createObjectURL(blob)
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt.current) / 1000))
        setRecordings((current) => [...current.filter((_, index) => index !== questionIndex), { question: questions[questionIndex], url, blob, seconds }].sort((a, b) => questions.indexOf(a.question) - questions.indexOf(b.question)))
        setStage('review')
      }
      recordingStartedAt.current = Date.now()
      recorder.start(250)
      setRemaining(answerSeconds)
      setStage('recording')
    } catch {
      setDeviceError('The recording could not start. Check that no other app is using your camera or microphone.')
      setStage('device')
    }
  }, [answerSeconds, questionIndex, questions, stream])

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
  }, [])

  useEffect(() => {
    if (stage !== 'prep' && stage !== 'recording') return
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current > 1) return current - 1
        window.clearInterval(timer)
        if (stage === 'prep') window.setTimeout(startRecording, 0)
        else window.setTimeout(finishRecording, 0)
        return 0
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finishRecording, stage, startRecording])

  const retake = () => {
    const previous = recordings.find((recording) => recording.question.id === questions[questionIndex]?.id)
    if (previous) URL.revokeObjectURL(previous.url)
    setRecordings((current) => current.filter((recording) => recording.question.id !== questions[questionIndex]?.id))
    beginPrep(questionIndex)
  }

  const accept = () => {
    if (questionIndex < questions.length - 1) beginPrep(questionIndex + 1)
    else {
      stream?.getTracks().forEach((track) => track.stop())
      setStream(null)
      setStage('complete')
    }
  }

  const restart = () => {
    recordings.forEach((recording) => URL.revokeObjectURL(recording.url))
    setRecordings([])
    setQuestions([])
    setQuestionIndex(0)
    setStage('landing')
  }

  const downloadRecording = (recording: Recording, index: number) => {
    const anchor = document.createElement('a')
    anchor.href = recording.url
    anchor.download = `brainmax-interview-answer-${index + 1}.${recording.blob.type.includes('mp4') ? 'mp4' : 'webm'}`
    anchor.click()
  }

  const question = questions[questionIndex]
  const currentRecording = recordings.find((recording) => recording.question.id === question?.id)
  const progress = questions.length ? ((questionIndex + (stage === 'review' || stage === 'complete' ? 1 : 0)) / questions.length) * 100 : 0

  if (stage === 'landing') return <>
    <InterviewSetup area={area} prepSeconds={prepSeconds} answerSeconds={answerSeconds} requesting={isRequesting} onArea={setArea} onPrep={setPrepSeconds} onAnswer={setAnswerSeconds} onStart={requestDevices} />
    {deviceError && <div className="hirevue-toast" role="alert"><X size={16} /><span>{deviceError}</span><button onClick={() => setDeviceError('')}>Dismiss</button></div>}
  </>

  if (stage === 'complete') return <div className="hirevue-complete">
    <header className="hirevue-room-header"><div className="hirevue-room-brand"><Video size={19} /><strong>Interview Studio</strong></div><button className="icon-button" onClick={close}><X size={20} /></button></header>
    <main>
      <div className="hirevue-complete-heading"><span><Check size={20} /></span><p className="eyebrow">Simulation complete</p><h1>Three answers. One useful playback.</h1><p>Watch for structure, specificity, pace and whether your own contribution is clear.</p></div>
      <div className="hirevue-recording-grid">{recordings.map((recording, index) => <article key={recording.question.id}>
        <div className="hirevue-recording-video"><video src={recording.url} controls playsInline preload="metadata" /><span>{formatClock(recording.seconds)}</span></div>
        <div><small>{recording.question.competency} · Answer {index + 1}</small><strong>{recording.question.prompt}</strong><button onClick={() => downloadRecording(recording, index)}><Download size={14} /> Save video</button></div>
      </article>)}</div>
      <section className="hirevue-self-review"><div><Lightbulb size={20} /><span><strong>A quick review lens</strong><small>Could a stranger understand the context? Did you spend most of the answer on your actions? Did you land a result and reflection?</small></span></div><div><button className="text-button" onClick={close}><ArrowLeft size={15} /> Back to Brainmax</button><button className="primary-button dark" onClick={restart}><RefreshCw size={15} /> New question set</button></div></section>
    </main>
  </div>

  return <div className="hirevue-room">
    <div className="hirevue-room-progress" style={{ width: `${progress}%` }} />
    <header className="hirevue-room-header"><div className="hirevue-room-brand"><Video size={19} /><strong>Interview Studio</strong><span>Practice simulation</span></div><div className="hirevue-room-step">{stage === 'device' ? 'Device check' : `Question ${questionIndex + 1} of 3`}</div><button className="icon-button" onClick={close}><X size={20} /></button></header>

    {stage === 'device' ? <main className="hirevue-device-stage">
      <section className="hirevue-device-preview"><CameraFeed stream={stream} /><div className="hirevue-live-chip"><span /> LIVE PREVIEW</div><div className="hirevue-preview-guide" /></section>
      <aside className="hirevue-device-panel"><p className="eyebrow">Before you begin</p><h1>You’re on camera.</h1><p>Frame yourself at eye level, face a light source and make sure your voice is clear. The real simulation begins when you continue.</p><div className="hirevue-device-checks"><span><Camera size={17} /><i>Camera</i><strong><Check size={15} /> Ready</strong></span><span><Mic size={17} /><i>Microphone</i><strong><Check size={15} /> Ready</strong></span></div><div className="hirevue-room-facts"><span><strong>3</strong><small>questions</small></span><span><strong>{prepSeconds}s</strong><small>to prepare</small></span><span><strong>{formatClock(answerSeconds)}</strong><small>to answer</small></span></div>{deviceError && <p className="hirevue-inline-error">{deviceError}</p>}<button className="primary-button dark wide" onClick={startInterview}>Begin interview <ArrowRight size={16} /></button><button className="text-button centered" onClick={() => { stream?.getTracks().forEach((track) => track.stop()); setStream(null); setStage('landing') }}>Change setup</button></aside>
    </main> : stage === 'review' && currentRecording ? <main className="hirevue-review-stage">
      <section className="hirevue-review-video"><video src={currentRecording.url} controls autoPlay playsInline /><span className="hirevue-playback-label"><Play size={12} fill="currentColor" /> PLAYBACK</span></section>
      <aside className="hirevue-review-panel"><p className="eyebrow">Answer {questionIndex + 1} recorded</p><h2>{question.prompt}</h2><div className="hirevue-review-meta"><span><Clock3 size={15} /> {formatClock(currentRecording.seconds)} recorded</span><span><Check size={15} /> Saved for this session</span></div><div className="hirevue-review-tip"><Lightbulb size={18} /><p><strong>Listen for a clear spine.</strong>{question.thinkingPrompt}</p></div><button className="primary-button dark wide" onClick={accept}>{questionIndex === questions.length - 1 ? 'Finish interview' : 'Use this answer'} <ArrowRight size={16} /></button><button className="text-button centered" onClick={retake}><RefreshCw size={14} /> Record this answer again</button></aside>
    </main> : <main className="hirevue-answer-stage">
      <section className="hirevue-question-panel">
        <div className={`hirevue-phase-badge ${stage}`}><span /> {stage === 'prep' ? 'PREPARATION TIME' : 'RECORDING'}</div>
        <p>{question?.competency}</p><h1>{question?.prompt}</h1>
        <div className="hirevue-thinking-prompt"><Lightbulb size={15} /><span>{question?.thinkingPrompt}</span></div>
        {stage === 'prep' && <button className="text-button hirevue-start-early" onClick={startRecording}>I’m ready — record now <ChevronRight size={15} /></button>}
      </section>
      <aside className="hirevue-camera-panel"><div className="hirevue-camera-wrap"><CameraFeed stream={stream} /><div className={`hirevue-camera-state ${stage}`}><span /> {stage === 'recording' ? 'REC' : 'PREVIEW'}</div><span className="hirevue-camera-timer">{formatClock(remaining)}</span></div><div className="hirevue-timer-copy"><strong>{stage === 'prep' ? 'Recording starts automatically' : 'Answer in progress'}</strong><small>{stage === 'prep' ? 'Use the time to form a simple structure.' : 'Speak naturally. The question remains visible.'}</small></div>{stage === 'recording' && <button className="hirevue-stop-button" onClick={finishRecording}><Square size={14} fill="currentColor" /> Finish answer</button>}</aside>
    </main>}
  </div>
}
