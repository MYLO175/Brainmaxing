export type InterviewArea = 'finance' | 'consulting' | 'technology' | 'product' | 'general'
export type InterviewQuestionKind = 'motivation' | 'behavioural' | 'judgement'

export type InterviewQuestion = {
  id: string
  area: InterviewArea | 'all'
  kind: InterviewQuestionKind
  competency: string
  prompt: string
  thinkingPrompt: string
}

export const INTERVIEW_AREAS: Array<{ id: InterviewArea; label: string; shortLabel: string; description: string }> = [
  { id: 'finance', label: 'Finance & banking', shortLabel: 'Finance', description: 'Markets, investment banking, asset management and commercial judgement.' },
  { id: 'consulting', label: 'Consulting & strategy', shortLabel: 'Consulting', description: 'Structured thinking, client judgement, influence and ambiguity.' },
  { id: 'technology', label: 'Technology & data', shortLabel: 'Technology', description: 'Problem solving, learning, teamwork and responsible use of data.' },
  { id: 'product', label: 'Product & operations', shortLabel: 'Product', description: 'Customer judgement, prioritisation, ownership and delivery.' },
  { id: 'general', label: 'General graduate', shortLabel: 'General', description: 'A balanced early-careers mix that works across industries.' },
]

const common: InterviewQuestion[] = [
  { id: 'c01', area: 'all', kind: 'motivation', competency: 'Motivation', prompt: 'Tell us about yourself and what has led you to apply for this opportunity.', thinkingPrompt: 'Present → relevant past → why this next step.' },
  { id: 'c02', area: 'all', kind: 'motivation', competency: 'Motivation', prompt: 'Why are you interested in this organisation, and why now?', thinkingPrompt: 'Connect specific research to your own direction.' },
  { id: 'c03', area: 'all', kind: 'motivation', competency: 'Role fit', prompt: 'What attracts you to this role, and what would you bring to it?', thinkingPrompt: 'Choose two role needs and prove your fit.' },
  { id: 'c04', area: 'all', kind: 'motivation', competency: 'Self-awareness', prompt: 'What is one strength you would rely on in this role, and one area you are actively developing?', thinkingPrompt: 'Use evidence and a genuine development plan.' },
  { id: 'c05', area: 'all', kind: 'motivation', competency: 'Ambition', prompt: 'What would you like to have learned or achieved by the end of your first year?', thinkingPrompt: 'Be ambitious, specific and realistic.' },
  { id: 'c06', area: 'all', kind: 'motivation', competency: 'Values', prompt: 'What matters most to you when choosing an employer?', thinkingPrompt: 'Name the value, then show why it matters.' },
  { id: 'c07', area: 'all', kind: 'behavioural', competency: 'Teamwork', prompt: 'Tell us about a time you worked with people who had different perspectives or backgrounds.', thinkingPrompt: 'Situation → your action → result → reflection.' },
  { id: 'c08', area: 'all', kind: 'behavioural', competency: 'Resilience', prompt: 'Describe a time something did not go to plan. How did you respond?', thinkingPrompt: 'Own the setback and focus on the recovery.' },
  { id: 'c09', area: 'all', kind: 'behavioural', competency: 'Influence', prompt: 'Tell us about a time you had to persuade someone who initially disagreed with you.', thinkingPrompt: 'Show listening as well as persuasion.' },
  { id: 'c10', area: 'all', kind: 'behavioural', competency: 'Ownership', prompt: 'Give an example of a time you took responsibility without being asked.', thinkingPrompt: 'Clarify what you noticed and the impact you made.' },
  { id: 'c11', area: 'all', kind: 'behavioural', competency: 'Prioritisation', prompt: 'Tell us about a time you had several competing deadlines. How did you decide what to do first?', thinkingPrompt: 'Explain criteria, communication and result.' },
  { id: 'c12', area: 'all', kind: 'behavioural', competency: 'Learning agility', prompt: 'Describe a time you had to learn something unfamiliar quickly.', thinkingPrompt: 'Show how you learned, checked and applied it.' },
  { id: 'c13', area: 'all', kind: 'behavioural', competency: 'Leadership', prompt: 'Tell us about a time you helped a group perform better.', thinkingPrompt: 'Leadership can be informal—focus on your actions.' },
  { id: 'c14', area: 'all', kind: 'behavioural', competency: 'Feedback', prompt: 'Describe a piece of difficult feedback you received and what you did with it.', thinkingPrompt: 'Avoid defensiveness; show a visible change.' },
  { id: 'c15', area: 'all', kind: 'behavioural', competency: 'Integrity', prompt: 'Tell us about a time you spoke up when it would have been easier to stay quiet.', thinkingPrompt: 'Explain the risk, your judgement and the outcome.' },
  { id: 'c16', area: 'all', kind: 'behavioural', competency: 'Achievement', prompt: 'What achievement are you most proud of, and what did it require from you?', thinkingPrompt: 'Make your personal contribution unmistakable.' },
  { id: 'c17', area: 'all', kind: 'judgement', competency: 'Judgement', prompt: 'You realise you may miss an important deadline. What would you do?', thinkingPrompt: 'Diagnose, communicate early, propose options.' },
  { id: 'c18', area: 'all', kind: 'judgement', competency: 'Collaboration', prompt: 'A teammate repeatedly contributes late and the group is being affected. How would you handle it?', thinkingPrompt: 'Start with curiosity, then agree clear action.' },
  { id: 'c19', area: 'all', kind: 'judgement', competency: 'Ambiguity', prompt: 'You receive an important task with unclear instructions and your manager is unavailable. What do you do?', thinkingPrompt: 'State assumptions, unblock safely, create checkpoints.' },
  { id: 'c20', area: 'all', kind: 'judgement', competency: 'Quality', prompt: 'You find a small error in work that has already been shared with senior colleagues. How would you respond?', thinkingPrompt: 'Assess impact, correct quickly, prevent recurrence.' },
  { id: 'c21', area: 'all', kind: 'judgement', competency: 'Communication', prompt: 'How would you explain a complicated idea to someone with no background in the subject?', thinkingPrompt: 'Lead with the point, use an analogy, check understanding.' },
  { id: 'c22', area: 'all', kind: 'judgement', competency: 'Adaptability', prompt: 'A project priority changes just before delivery. Talk us through how you would respond.', thinkingPrompt: 'Reconfirm the goal, trade off scope, align people.' },
]

const roleSpecific: InterviewQuestion[] = [
  { id: 'f01', area: 'finance', kind: 'motivation', competency: 'Industry motivation', prompt: 'Why financial services, and what have you done to test that interest?', thinkingPrompt: 'Use concrete exploration, not prestige alone.' },
  { id: 'f02', area: 'finance', kind: 'motivation', competency: 'Commercial awareness', prompt: 'Tell us about a recent business or market development that caught your attention.', thinkingPrompt: 'What happened → why it matters → your view.' },
  { id: 'f03', area: 'finance', kind: 'motivation', competency: 'Role fit', prompt: 'What appeals to you about working with clients on high-stakes financial decisions?', thinkingPrompt: 'Connect pace, responsibility and service to evidence.' },
  { id: 'f04', area: 'finance', kind: 'motivation', competency: 'Curiosity', prompt: 'Which part of the financial system would you most like to understand better, and why?', thinkingPrompt: 'Show genuine curiosity and a learning path.' },
  { id: 'f05', area: 'finance', kind: 'behavioural', competency: 'Accuracy', prompt: 'Tell us about a time your attention to detail prevented a mistake.', thinkingPrompt: 'Explain your checking process and the stakes.' },
  { id: 'f06', area: 'finance', kind: 'behavioural', competency: 'Pressure', prompt: 'Describe a time you delivered accurate work under significant time pressure.', thinkingPrompt: 'Show prioritisation without sacrificing controls.' },
  { id: 'f07', area: 'finance', kind: 'behavioural', competency: 'Client service', prompt: 'Tell us about a time you went beyond the obvious request to help someone reach a better outcome.', thinkingPrompt: 'Show how you understood the real need.' },
  { id: 'f08', area: 'finance', kind: 'behavioural', competency: 'Analysis', prompt: 'Give an example of a decision you improved by using data or evidence.', thinkingPrompt: 'Keep the analysis simple and decision-focused.' },
  { id: 'f09', area: 'finance', kind: 'behavioural', competency: 'Challenge', prompt: 'Tell us about a time you questioned an assumption made by someone more senior.', thinkingPrompt: 'Be respectful, evidence-led and outcome-focused.' },
  { id: 'f10', area: 'finance', kind: 'judgement', competency: 'Integrity', prompt: 'A colleague asks you to use a figure you cannot verify because a deadline is close. What would you do?', thinkingPrompt: 'Protect accuracy, communicate risk, offer a route forward.' },
  { id: 'f11', area: 'finance', kind: 'judgement', competency: 'Commercial judgement', prompt: 'A client wants a fast answer, but the available information is incomplete. How would you respond?', thinkingPrompt: 'Separate knowns, assumptions and next evidence.' },
  { id: 'f12', area: 'finance', kind: 'judgement', competency: 'Market thinking', prompt: 'When markets move sharply, what questions would you ask before forming a view?', thinkingPrompt: 'Drivers, horizon, evidence, alternatives, risk.' },
  { id: 'f13', area: 'finance', kind: 'judgement', competency: 'Risk awareness', prompt: 'You notice that a proposed recommendation has a downside nobody has discussed. What do you do?', thinkingPrompt: 'Surface it constructively and quantify where possible.' },
  { id: 'f14', area: 'finance', kind: 'judgement', competency: 'Stakeholders', prompt: 'Two senior stakeholders want conflicting outputs by the same deadline. How would you proceed?', thinkingPrompt: 'Clarify impact, align priorities, document the decision.' },

  { id: 'n01', area: 'consulting', kind: 'motivation', competency: 'Industry motivation', prompt: 'Why consulting, and what about the work suits you personally?', thinkingPrompt: 'Prove fit with evidence, not generic variety.' },
  { id: 'n02', area: 'consulting', kind: 'motivation', competency: 'Curiosity', prompt: 'What business problem would you most enjoy helping a client solve?', thinkingPrompt: 'Explain why it matters and how you would start.' },
  { id: 'n03', area: 'consulting', kind: 'motivation', competency: 'Role fit', prompt: 'Which experience best demonstrates that you would thrive in a client-service environment?', thinkingPrompt: 'Choose one detailed, relevant example.' },
  { id: 'n04', area: 'consulting', kind: 'behavioural', competency: 'Personal impact', prompt: 'Tell us about a challenging situation with someone whose opinion opposed yours.', thinkingPrompt: 'Show empathy, influence and a concrete outcome.' },
  { id: 'n05', area: 'consulting', kind: 'behavioural', competency: 'Entrepreneurial drive', prompt: 'Describe a time you achieved something outside your comfort zone in a limited period.', thinkingPrompt: 'Make the hurdle and your initiative clear.' },
  { id: 'n06', area: 'consulting', kind: 'behavioural', competency: 'Inclusive leadership', prompt: 'Give an example of how you enabled people with different strengths to work effectively together.', thinkingPrompt: 'Show how you adapted your leadership.' },
  { id: 'n07', area: 'consulting', kind: 'behavioural', competency: 'Problem solving', prompt: 'Tell us about a messy problem you made more manageable by structuring it.', thinkingPrompt: 'Explain the structure, not every detail.' },
  { id: 'n08', area: 'consulting', kind: 'behavioural', competency: 'Impact', prompt: 'Describe a recommendation you made that changed what a group decided to do.', thinkingPrompt: 'Evidence → recommendation → measurable change.' },
  { id: 'n09', area: 'consulting', kind: 'judgement', competency: 'Client judgement', prompt: 'A client strongly prefers an option your evidence does not support. How would you handle the conversation?', thinkingPrompt: 'Understand motives, share evidence, preserve trust.' },
  { id: 'n10', area: 'consulting', kind: 'judgement', competency: 'Problem solving', prompt: 'A client says sales are falling. What would you want to understand before suggesting action?', thinkingPrompt: 'Clarify metric, segments, causes, context and constraints.' },
  { id: 'n11', area: 'consulting', kind: 'judgement', competency: 'Synthesis', prompt: 'You have one minute to update a busy executive on a week of analysis. How would you structure it?', thinkingPrompt: 'Answer first → evidence → implication → next step.' },
  { id: 'n12', area: 'consulting', kind: 'judgement', competency: 'Prioritisation', prompt: 'Your analysis produces ten possible actions for a client. How would you decide which to recommend?', thinkingPrompt: 'Impact, feasibility, risk, dependencies and evidence.' },
  { id: 'n13', area: 'consulting', kind: 'judgement', competency: 'Adaptability', prompt: 'Halfway through a project, new evidence undermines your original hypothesis. What do you do?', thinkingPrompt: 'Update openly; avoid defending sunk work.' },

  { id: 't01', area: 'technology', kind: 'motivation', competency: 'Industry motivation', prompt: 'Why do you want to build a career in technology or data?', thinkingPrompt: 'Connect curiosity, impact and concrete experience.' },
  { id: 't02', area: 'technology', kind: 'motivation', competency: 'Product awareness', prompt: 'Tell us about a digital product you admire. What makes it effective?', thinkingPrompt: 'User need → design choice → trade-off.' },
  { id: 't03', area: 'technology', kind: 'motivation', competency: 'Learning', prompt: 'Which technology trend are you trying to understand better, and how are you approaching it?', thinkingPrompt: 'Keep it practical and show critical thinking.' },
  { id: 't04', area: 'technology', kind: 'behavioural', competency: 'Problem solving', prompt: 'Tell us about a difficult problem you diagnosed step by step.', thinkingPrompt: 'Symptoms → hypotheses → tests → resolution.' },
  { id: 't05', area: 'technology', kind: 'behavioural', competency: 'Communication', prompt: 'Describe a time you explained technical work to a non-technical audience.', thinkingPrompt: 'Show how you adapted and checked understanding.' },
  { id: 't06', area: 'technology', kind: 'behavioural', competency: 'Quality', prompt: 'Tell us about a time you found and fixed a flaw in something you had built.', thinkingPrompt: 'Own it; explain the prevention you added.' },
  { id: 't07', area: 'technology', kind: 'behavioural', competency: 'Collaboration', prompt: 'Give an example of working with someone whose approach to solving a problem differed from yours.', thinkingPrompt: 'Compare evidence and show what improved.' },
  { id: 't08', area: 'technology', kind: 'behavioural', competency: 'User focus', prompt: 'Tell us about a time user feedback changed your solution.', thinkingPrompt: 'Assumption → feedback → decision → result.' },
  { id: 't09', area: 'technology', kind: 'judgement', competency: 'Responsible technology', prompt: 'A technically impressive feature could create a poor outcome for some users. How would you approach the decision?', thinkingPrompt: 'Users, harms, evidence, safeguards, escalation.' },
  { id: 't10', area: 'technology', kind: 'judgement', competency: 'Delivery', prompt: 'A release date is fixed but the team cannot deliver every planned feature safely. What would you do?', thinkingPrompt: 'Protect quality, prioritise value, communicate trade-offs.' },
  { id: 't11', area: 'technology', kind: 'judgement', competency: 'Data judgement', prompt: 'A dashboard shows a surprising result that could influence an important decision. What do you do next?', thinkingPrompt: 'Validate definition, source, sample and alternative causes.' },
  { id: 't12', area: 'technology', kind: 'judgement', competency: 'Security mindset', prompt: 'You discover a potential security or privacy issue outside your assigned work. How would you respond?', thinkingPrompt: 'Contain safely, preserve evidence, escalate promptly.' },
  { id: 't13', area: 'technology', kind: 'judgement', competency: 'Ambiguity', prompt: 'You are asked to automate a process you do not yet understand. How would you begin?', thinkingPrompt: 'Observe users, map exceptions, define success, prototype.' },

  { id: 'p01', area: 'product', kind: 'motivation', competency: 'Role motivation', prompt: 'Why are you interested in product and operational problem solving?', thinkingPrompt: 'Connect users, systems and delivery to your experience.' },
  { id: 'p02', area: 'product', kind: 'motivation', competency: 'Customer focus', prompt: 'Tell us about a product or service you would improve and why.', thinkingPrompt: 'Specific user, unmet need, evidence, trade-off.' },
  { id: 'p03', area: 'product', kind: 'behavioural', competency: 'Delivery', prompt: 'Tell us about something you took from an idea through to delivery.', thinkingPrompt: 'Focus on decisions, obstacles and outcome.' },
  { id: 'p04', area: 'product', kind: 'behavioural', competency: 'Prioritisation', prompt: 'Describe a time you said no to a good idea so you could protect a more important goal.', thinkingPrompt: 'Explain the criteria and how you communicated.' },
  { id: 'p05', area: 'product', kind: 'behavioural', competency: 'Customer insight', prompt: 'Tell us about a time you uncovered what someone really needed rather than what they first requested.', thinkingPrompt: 'Show listening and how the solution changed.' },
  { id: 'p06', area: 'product', kind: 'behavioural', competency: 'Operations', prompt: 'Give an example of a process you made simpler or more reliable.', thinkingPrompt: 'Baseline → change → measurable improvement.' },
  { id: 'p07', area: 'product', kind: 'behavioural', competency: 'Stakeholders', prompt: 'Describe a time you aligned people who measured success differently.', thinkingPrompt: 'Find the shared outcome and surface trade-offs.' },
  { id: 'p08', area: 'product', kind: 'judgement', competency: 'Prioritisation', prompt: 'Three teams all say their request is urgent. How would you decide what the product team does first?', thinkingPrompt: 'Goal, impact, evidence, effort, risk, dependencies.' },
  { id: 'p09', area: 'product', kind: 'judgement', competency: 'Experimentation', prompt: 'A new feature gets strong opinions but little reliable evidence. What would you do?', thinkingPrompt: 'Form a hypothesis and find the cheapest valid test.' },
  { id: 'p10', area: 'product', kind: 'judgement', competency: 'Customer judgement', prompt: 'Usage rises after a launch, but customer complaints also increase. How would you assess success?', thinkingPrompt: 'Segment outcomes; balance quantity with quality.' },
  { id: 'p11', area: 'product', kind: 'judgement', competency: 'Trade-offs', prompt: 'Would you delay a launch to improve the experience? Talk us through your decision.', thinkingPrompt: 'Severity, reversibility, user promise and opportunity cost.' },

  { id: 'g01', area: 'general', kind: 'motivation', competency: 'Career motivation', prompt: 'What kind of work gives you energy, and what have you learned from doing it?', thinkingPrompt: 'Use one concrete example.' },
  { id: 'g02', area: 'general', kind: 'motivation', competency: 'Self-awareness', prompt: 'How would someone who has worked closely with you describe your contribution to a team?', thinkingPrompt: 'Choose credible traits and prove them.' },
  { id: 'g03', area: 'general', kind: 'behavioural', competency: 'Initiative', prompt: 'Tell us about a useful change you made even though it was not formally your responsibility.', thinkingPrompt: 'Need → initiative → buy-in → impact.' },
  { id: 'g04', area: 'general', kind: 'behavioural', competency: 'Resourcefulness', prompt: 'Describe a time you achieved a result with limited time, information or resources.', thinkingPrompt: 'Show smart constraints, not heroics.' },
  { id: 'g05', area: 'general', kind: 'behavioural', competency: 'Trust', prompt: 'Tell us about a time you had to rebuild trust after making a mistake.', thinkingPrompt: 'Own it, repair it, change the system.' },
  { id: 'g06', area: 'general', kind: 'judgement', competency: 'Customer focus', prompt: 'Someone is unhappy with work you believe meets the brief. How would you handle it?', thinkingPrompt: 'Listen, clarify outcome, close the gap.' },
  { id: 'g07', area: 'general', kind: 'judgement', competency: 'Ethics', prompt: 'You are asked to do something that feels inconsistent with the organisation’s values. What would you do?', thinkingPrompt: 'Verify facts, raise concern, use safe escalation.' },
  { id: 'g08', area: 'general', kind: 'judgement', competency: 'Decision making', prompt: 'How do you make a decision when there is no clearly correct answer?', thinkingPrompt: 'Criteria, evidence, downside, reversibility, review.' },
]

export const INTERVIEW_QUESTIONS = [...common, ...roleSpecific]

function hashSeed(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

function pickOne(pool: InterviewQuestion[], seed: number) {
  return pool[seed % pool.length]
}

export function buildInterview(area: InterviewArea, seed = Date.now()): InterviewQuestion[] {
  const eligible = INTERVIEW_QUESTIONS.filter((question) => question.area === 'all' || question.area === area)
  const kinds: InterviewQuestionKind[] = ['motivation', 'behavioural', 'judgement']
  return kinds.map((kind, index) => {
    const roleQuestions = eligible.filter((question) => question.kind === kind && question.area === area)
    const sharedQuestions = eligible.filter((question) => question.kind === kind && question.area === 'all')
    const pool = roleQuestions.length && index !== 1 ? [...roleQuestions, ...roleQuestions, ...sharedQuestions] : [...roleQuestions, ...sharedQuestions]
    return pickOne(pool, hashSeed(`${area}-${seed}-${kind}`))
  })
}
