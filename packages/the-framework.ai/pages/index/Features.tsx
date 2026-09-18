import type { ReactNode } from 'react'
import { cardStyle, SectionHead, sectionStyle } from './ui'

const featureCardStyle = {
  ...cardStyle,
  padding: 'clamp(18px, 4vw, 26px) clamp(16px, 4.5vw, 28px)',
  display: 'flex',
  flexDirection: 'column',
} as const

function FeatureText({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: '#9da9a0' }}>{children}</p>
}

export function Features() {
  return (
    <section id="features" style={sectionStyle}>
      <SectionHead title="Features" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 18,
        }}
      >
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Bring your own subscription</h3>
          <FeatureText>
            Use your AI subscription — The Framework orchestrates agents via your Claude Code / Codex
            installation, like humans do.
          </FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Optimal quota usage</h3>
          <FeatureText>
            Stop wasting unused quota — The Framework drives AI autonomy for optimal quota usage:
            maximum daily usage while keeping enough quota space for manual prompts.
          </FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Bring your own prompts</h3>
          <FeatureText>
            Save and quickly re-use your favorite prompts. Share them with your teammates or keep them personal.
          </FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Dashboard</h3>
          <FeatureText>
            Pro-rata usage quota, current AI agents, queued AI tasks, queue of required reviews, "hot" tickets, and
            more.
          </FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Notifications</h3>
          <FeatureText>Get browser and/or Discord notifications when AI is finished or needs you.</FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Claude Code Web</h3>
          <FeatureText>Orchestrate agents via Claude Code Web for 0% local CPU usage.</FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Swarm of local computers</h3>
          <FeatureText>Orchestrate agents across multiple local computers.</FeatureText>
        </div>
        <div style={{ ...featureCardStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Discord bot</h3>
          <FeatureText>Use the discord bot for agentic team conversations.</FeatureText>
        </div>
      </div>
    </section>
  )
}
