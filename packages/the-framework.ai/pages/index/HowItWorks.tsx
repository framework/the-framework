import { SectionHead, sectionStyle } from './ui'
import { Prompts } from './Prompts'
import { Queues } from './Queues'

export function HowItWorks() {
  return (
    <section id="how-it-works" style={sectionStyle}>
      <SectionHead title="How it works" sub="The Framework introduces one major building block:" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(44px, 8vw, 64px)' }}>
        <Queues />
        <Prompts />
      </div>
    </section>
  )
}
