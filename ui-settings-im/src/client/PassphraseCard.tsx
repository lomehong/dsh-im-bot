/**
 * Confirmed-login hint: tells the user to send `/bind` in the IM chat to
 * finish binding this scan to a harness session.
 */
import css from './BotChannelTab.module.css'

export interface PassphraseCardProps {
  t: (key: string) => string
}

export function PassphraseCard({ t }: PassphraseCardProps) {
  return (
    <div className={css.passphraseCard}>
      <span className={css.passphraseTitle}>{t('bind.commandTitle')}</span>
      <span className={css.passphraseHint}>{t('bind.commandHint')}</span>
      <code className={css.passphraseCommand}>/bind</code>
    </div>
  )
}