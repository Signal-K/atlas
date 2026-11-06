import { useState } from 'react'
import { useEffect } from 'react'
import { completedLessons, setWorkspaceValue } from '../lib/workspaceSync'
import { trackEvent } from '../lib/analytics'
const lessons = [
  { id: 'dark-adaptation', title: 'Let your eyes adjust', text: 'Give your eyes about 20–30 minutes away from bright lights. A dim red light helps preserve dark adaptation. Start with a bright star, then try fainter stars nearby.', question: 'What helps you see fainter stars?', answers: ['Keep checking a bright phone screen', 'Spend time away from bright lights'], correct: 1 },
  { id: 'altitude', title: 'Read a direction in the sky', text: 'Direction tells you where to face: north, east, south or west. Altitude tells you how high to look: 0° is the horizon, 90° is straight overhead. At 45°, look halfway between them.', question: 'A target at 45° altitude is…', answers: ['Halfway from the horizon to overhead', 'Below the horizon'], correct: 0 },
  { id: 'equipment', title: 'Start wide, then zoom in', text: 'Find a target with your eyes first. Binoculars reveal a wider field than most telescopes. With a telescope, start with your lowest-power eyepiece, centre the target, then increase magnification if the view stays clear.', question: 'How should you begin with a telescope?', answers: ['At the highest possible magnification', 'With the lowest-power eyepiece'], correct: 1 },
]
export function Lessons({ userId }: { userId: string }) {
  const storageKey = `atlas-lessons:${userId}`
  const [completed, setCompleted] = useState<string[]>(() => completedLessons(userId))
  useEffect(() => {
    const refresh = () => setCompleted(completedLessons(userId))
    window.addEventListener('atlas:workspace-state', refresh)
    return () => window.removeEventListener('atlas:workspace-state', refresh)
  }, [userId])
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  function answer(id: string, index: number, correct: number) {
    const passed = index === correct
    trackEvent('Lesson answer submitted', { lesson_id: id, correct: passed })
    setFeedback(current => ({ ...current, [id]: passed ? 'Correct. Try this on your next night outside.' : 'Not quite. Read the explanation and try again.' }))
    if (passed && !completed.includes(id)) {
      const next = [...completed, id]
      setCompleted(next)
      localStorage.setItem(storageKey, JSON.stringify(next))
      setWorkspaceValue(userId, `lesson:${id}`, true)
      trackEvent('Lesson completed', { lesson_id: id })
    }
  }
  return <section aria-label="Learn the sky"><h2>Learn the sky</h2><p className="data-note">{completed.length} of {lessons.length} short lessons completed · saved locally and synced when signed in</p>{lessons.map(lesson => <details className="lesson" key={lesson.id} onToggle={event => { if (event.currentTarget.open) trackEvent('Lesson opened', { lesson_id: lesson.id }) }}><summary>{lesson.title}{completed.includes(lesson.id) ? ' · Completed' : ''}</summary><p>{lesson.text}</p><fieldset><legend>{lesson.question}</legend>{lesson.answers.map((option, index) => <button type="button" className="lesson-answer" key={option} onClick={() => answer(lesson.id, index, lesson.correct)}>{option}</button>)}</fieldset>{feedback[lesson.id] && <p role="status" className="lesson-feedback">{feedback[lesson.id]}</p>}</details>)}</section>
}
