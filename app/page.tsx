import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { Activity, BarChart3, Newspaper, ShieldCheck, Swords, Trophy, TrendingUp, Users } from 'lucide-react'

const features = [
  {
    icon: Newspaper,
    eyebrow: 'Newsroom',
    title: 'League stories that feel official',
    body: 'Publish previews, recaps, columns, breaking news, and weekly league drama in one polished home.'
  },
  {
    icon: Swords,
    eyebrow: 'Matchups',
    title: 'Live weeks with real context',
    body: 'Follow featured matchups, projected scores, win chances, and every roster in your league.'
  },
  {
    icon: TrendingUp,
    eyebrow: 'Rankings',
    title: 'Power rankings built for debate',
    body: 'Turn weekly rankings and dynasty values into a clean sports-media style presentation.'
  },
  {
    icon: Activity,
    eyebrow: 'Activity',
    title: 'Transactions and trades together',
    body: 'Track roster moves, trade trees, breaking moves, and your league history without digging through Sleeper.'
  },
]

export default function HomePage() {
  return (
    <main className="ll-page">
      <Navbar />

      <section className="ll-home-hero">
        <div className="ll-home-hero-glow" />
        <div className="ll-shell ll-home-hero-grid">
          <div className="ll-home-copy">
            <p className="ll-eyebrow">Fantasy football media hub</p>
            <h1>
              Your league deserves a <em>front page.</em>
            </h1>
            <p className="ll-hero-copy">
              League Letter turns a Sleeper league into a live command center for matchups,
              articles, trades, power rankings, drafts, trophies, and weekly league history.
            </p>

            <div className="ll-hero-actions">
              <Link href="/signup" className="ll-btn ll-btn-primary">Create account</Link>
              <Link href="/leagues/new" className="ll-btn ll-btn-secondary">Load Sleeper league</Link>
            </div>

            <div className="ll-home-proof">
              <span><Users size={16} /> Public league pages</span>
              <span><ShieldCheck size={16} /> Admin controls</span>
              <span><Activity size={16} /> Live data</span>
            </div>
          </div>

          <div className="ll-command-preview" aria-label="League Letter dashboard preview">
            <div className="ll-preview-topbar">
              <div>
                <p className="ll-eyebrow">Week 8 · 2026</p>
                <h2>League command center</h2>
              </div>
              <span className="ll-live-chip">Live</span>
            </div>

            <div className="ll-preview-scoreboard">
              <PreviewMatchup left="Gridiron Gang" right="Sunday Scaries" leftScore="124.8" rightScore="118.3" />
              <PreviewMatchup left="Fourth & Long" right="Waiver Kings" leftScore="101.4" rightScore="109.7" />
            </div>

            <div className="ll-preview-lower">
              <div className="ll-preview-panel">
                <div className="ll-preview-panel-title"><Trophy size={16} /> Power rankings</div>
                <ol className="ll-preview-ranking-list">
                  <li><span>1</span><b>Gridiron Gang</b><small>9-2</small></li>
                  <li><span>2</span><b>Waiver Kings</b><small>8-3</small></li>
                  <li><span>3</span><b>Sunday Scaries</b><small>7-4</small></li>
                </ol>
              </div>
              <div className="ll-preview-panel ll-preview-story">
                <span className="ll-eyebrow">Breaking</span>
                <h3>Trade deadline chaos hits the league</h3>
                <p>Three teams reshape the playoff race in one night.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ll-shell ll-feature-section">
        <div className="ll-section-heading">
          <div>
            <p className="ll-eyebrow">Everything in one place</p>
            <h2>Built like a sports site, not a spreadsheet.</h2>
          </div>
          <p>
            The same dark navy, blue, and orange visual language now runs across League Letter—
            from league pages and admin tools to forms, tables, filters, and live feeds.
          </p>
        </div>

        <div className="ll-feature-grid">
          {features.map(({ icon: Icon, eyebrow, title, body }) => (
            <article key={title} className="ll-card ll-feature-card">
              <span className="ll-feature-icon"><Icon size={20} /></span>
              <p className="ll-eyebrow">{eyebrow}</p>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ll-shell ll-home-footer-cta">
        <div className="ll-card ll-cta-card">
          <div>
            <p className="ll-eyebrow">Powered by Sleeper</p>
            <h2>Load a league and make it yours.</h2>
            <p>Your league stays public by URL while admins and writers get the tools they need behind the scenes.</p>
          </div>
          <Link href="/leagues/new" className="ll-btn ll-btn-primary">Get started</Link>
        </div>
      </section>
    </main>
  )
}

function PreviewMatchup({
  left,
  right,
  leftScore,
  rightScore,
}: {
  left: string
  right: string
  leftScore: string
  rightScore: string
}) {
  return (
    <div className="ll-preview-matchup">
      <div><b>{left}</b><strong>{leftScore}</strong></div>
      <span>LIVE</span>
      <div><b>{right}</b><strong>{rightScore}</strong></div>
    </div>
  )
}
