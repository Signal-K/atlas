import { useState } from 'react'
import { Link } from 'react-router-dom'
import { awardFireballSpotter } from '../lib/eventBadges'
import { useAuth } from '../lib/auth'
import {
  FIREBALL_QUIZ,
  FIREBALLS_SOURCE_URL,
  LANDNAM_ORIONIDS_URL,
  badgeLabel,
  FIREBALL_EVENT_ID,
} from '../lib/spacetober.mjs'

export function OrionidsPage() {
  const { user } = useAuth()
  const [read, setRead] = useState(false)
  const [answers, setAnswers] = useState<number[]>(() => FIREBALL_QUIZ.map(() => -1))
  const [minutes, setMinutes] = useState('')
  const [meteors, setMeteors] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function finish() {
    setBusy(true)
    setStatus(null)
    const watchMinutes = minutes.trim() === '' ? null : Number(minutes)
    const meteorCount = meteors.trim() === '' ? null : Number(meteors)
    try {
      const result = await awardFireballSpotter({ read, answers, watchMinutes, meteorCount })
      if ('error' in result) setStatus(result.error)
      else setStatus(`Badge kept: ${badgeLabel(FIREBALL_EVENT_ID, result.tier)}. Meteorite Mastery is level 1.`)
    } catch {
      setStatus('The badge could not be saved. Try again once you are online.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="az-page orionids-article">
      <p className="az-kicker">Orionids · citizen science</p>
      <h1 className="az-h1">Fireballs in the Sky</h1>
      <p className="az-muted">
        A short read on the Australian fireball network, then a three-question check or a 10-minute sky watch. Doing
        both the reading and one activity earns Fireball Spotter.
      </p>

      <section>
        <h2>Meteors, fireballs, meteorites</h2>
        <p>
          A meteor is the streak of light when a meteoroid hits the atmosphere and burns. A fireball is an unusually
          bright meteor, brighter than Venus, about magnitude −4 or brighter. A meteorite is the piece of rock that
          survives and reaches the ground. Most meteors leave nothing to pick up.
        </p>
        <h2>The network</h2>
        <p>
          <a href={FIREBALLS_SOURCE_URL}>Fireballs in the Sky</a> is the public project of the Desert Fireball Network,
          led from Curtin University. Autonomous cameras across the Australian outback watch the sky all night. When
          more than one camera records the same fireball, the team triangulates the path through the atmosphere, works
          out the orbit the rock had in space, and calculates whether anything reached the ground and where to look.
          That predicted ground track is the fall line. Searching it has recovered meteorites, including Bunburra
          Rockhole, Mason Gully, Murrili and Dingle Dell.
        </p>
        <h2>How to report one</h2>
        <p>
          Note the time as closely as you can, how many seconds it lasted, the direction it came from and went to,
          whether it changed colour or broke apart, and any sound. Send that through the Fireballs in the Sky app or
          the website. A photo or video that includes a landmark helps the team match your sighting to the cameras. If
          you think you have found the rock, photograph it where it lies and contact the network rather than treating
          it as a souvenir. Source:{' '}
          <a href={FIREBALLS_SOURCE_URL}>fireballsinthesky.com.au</a>.
        </p>
      </section>

      <label className="orionids-read">
        <input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} />
        I have read this
      </label>

      <section className="orionids-activity" aria-label="Fireball check">
        <h2>Three-question check</h2>
        {FIREBALL_QUIZ.map((question, questionIndex) => (
          <fieldset key={question.prompt}>
            <legend>{question.prompt}</legend>
            {question.choices.map((choice, choiceIndex) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`fireball-q-${questionIndex}`}
                  checked={answers[questionIndex] === choiceIndex}
                  onChange={() =>
                    setAnswers((current) => current.map((value, index) => (index === questionIndex ? choiceIndex : value)))
                  }
                />
                {choice}
              </label>
            ))}
          </fieldset>
        ))}
      </section>

      <section className="orionids-activity" aria-label="Sky watch log">
        <h2>Or log a 10-minute sky watch</h2>
        <p className="az-muted">Either the check above or this log counts. A meteor count of zero is a real result.</p>
        <label>
          Minutes watched
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <label>
          Meteors counted
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={meteors}
            onChange={(event) => setMeteors(event.target.value)}
          />
        </label>
      </section>

      {user ? (
        <button type="button" className="az-btn az-btn-primary" disabled={busy} onClick={() => void finish()}>
          {busy ? 'Saving…' : 'Finish and claim Fireball Spotter'}
        </button>
      ) : (
        <p className="az-muted">
          You can read this as a guest. <Link to="/app/profile">Create a free account</Link> to keep the badge.
        </p>
      )}
      {status && (
        <p role="status" className="orionids-status">
          {status}
        </p>
      )}

      <p className="orionids-banner-links">
        <a href={LANDNAM_ORIONIDS_URL}>Play the Orionids in Landnam</a>
        <Link to="/app/hub">Back to tonight</Link>
      </p>
    </article>
  )
}
