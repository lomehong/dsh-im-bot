/**
 * Operation steps panel: a numbered list of platform-specific instructions +
 * an optional per-platform note (e.g. wechat verifycode fallback).
 */
import type { Kind } from './store.ts'
import css from './BotChannelTab.module.css'

const STEP_NUMBERS = ['1', '2', '3', '4'] as const

export interface StepsPanelProps {
  kind: Kind
  t: (key: string) => string
}

export function StepsPanel({ kind, t }: StepsPanelProps) {
  const stepKeys = STEP_NUMBERS.map(n => `step.${kind}.${n}` as const)
  return (
    <div className={css.stepsPanel}>
      <h3 className={css.stepsTitle}>{t(`steps.title.${kind}`)}</h3>
      <ol className={css.steps}>
        {stepKeys.map(key => (
          <li key={key} className={css.step}>
            <span className={css.stepNumber} aria-hidden="true" />
            <span className={css.stepBody}>
              <span className={css.stepText}>{t(key)}</span>
            </span>
          </li>
        ))}
      </ol>
      {kind === 'wechat' && <p className={css.stepNote}>{t('note.wechat.verifycode')}</p>}
    </div>
  )
}