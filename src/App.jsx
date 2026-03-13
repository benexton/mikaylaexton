import React, { useState, useEffect, useCallback, useRef } from 'react'

const TOTAL_IMAGES = 9
const SLIDE_DURATION = 10000
const BG = '#d9d1c6'

function App() {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [contactStatus, setContactStatus] = useState('idle')
  const timerRef = useRef(null)

  const goTo = useCallback((index) => {
    if (transitioning) return
    const next = (index + TOTAL_IMAGES) % TOTAL_IMAGES
    if (next === current) return
    setTransitioning(true)
    setPrev(current)
    setCurrent(next)
    setTimeout(() => { setPrev(null); setTransitioning(false) }, 800)
  }, [current, transitioning])

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev_ = useCallback(() => goTo(current - 1), [current, goTo])

  useEffect(() => {
    if (!playing) { clearInterval(timerRef.current); return }
    timerRef.current = setInterval(next, SLIDE_DURATION)
    return () => clearInterval(timerRef.current)
  }, [playing, next])

  const manualNav = (fn) => {
    clearInterval(timerRef.current)
    fn()
    if (playing) timerRef.current = setInterval(next, SLIDE_DURATION)
  }

  const handleContact = async (e) => {
    e.preventDefault()
    setContactStatus('submitting')
    const data = new FormData(e.target)
    try {
      const res = await fetch('https://formspree.io/f/placeholder', {
        method: 'POST', body: data, headers: { Accept: 'application/json' }
      })
      if (res.ok) { setContactStatus('success'); e.target.reset() }
      else { setContactStatus('error'); setTimeout(() => setContactStatus('idle'), 4000) }
    } catch { setContactStatus('error'); setTimeout(() => setContactStatus('idle'), 4000) }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#2a2520' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .slide { position: absolute; inset: 0; }
        .fade-in { animation: fadeIn 0.8s ease forwards; }
        .fade-out { animation: fadeOut 0.8s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        .ctrl-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #2a2520;
          padding: 10px;
          opacity: 0.45;
          transition: opacity 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .ctrl-btn:hover { opacity: 0.9; }

        input, textarea {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid #b8b0a6;
          padding: 10px 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 17px;
          font-weight: 300;
          color: #2a2520;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus { border-bottom-color: #2a2520; }
        input::placeholder, textarea::placeholder { color: #a09890; }
        textarea { resize: none; }

        .submit-btn {
          background: #2a2520;
          color: #d9d1c6;
          border: none;
          padding: 14px 48px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 13px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .submit-btn:hover { opacity: 0.7; }
        .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        @media (max-width: 600px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ textAlign: 'center', paddingTop: '52px', paddingBottom: '40px' }}>
        <h1 style={{ fontWeight: 300, fontSize: 'clamp(26px, 4vw, 46px)', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2a2520' }}>
          Mikayla Exton
        </h1>
        <p style={{ fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#8a8078', marginTop: '10px', fontWeight: 300 }}>
          Photography
        </p>
      </header>

      {/* PHOTO */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px' }}>
        <div style={{ position: 'relative', width: '100%', paddingBottom: '66.67%', background: '#c8c0b5', overflow: 'hidden' }}>
          {prev !== null && (
            <div className="slide fade-out">
              <img src={`./${prev + 1}.jpg`} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <div className={`slide${transitioning ? ' fade-in' : ''}`}>
            <img src={`./${current + 1}.jpg`} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '36px', marginTop: '22px' }}>
          <button className="ctrl-btn" onClick={() => manualNav(prev_)} aria-label="Previous">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button className="ctrl-btn" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing
              ? <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <button className="ctrl-btn" onClick={() => manualNav(next)} aria-label="Next">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* DIVIDER */}
      <div style={{ maxWidth: '900px', margin: '72px auto 0', padding: '0 40px' }}>
        <div style={{ borderTop: '1px solid #c0b8b0' }} />
      </div>

      {/* ABOUT */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 40px 0' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#8a8078', marginBottom: '24px' }}>About</p>
        <p style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 300, lineHeight: 1.75, color: '#2a2520', maxWidth: '520px' }}>
          Come say hello if you'd like some photos.
        </p>
      </section>

      {/* DIVIDER */}
      <div style={{ maxWidth: '900px', margin: '64px auto 0', padding: '0 40px' }}>
        <div style={{ borderTop: '1px solid #c0b8b0' }} />
      </div>

      {/* CONTACT */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 40px 100px' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#8a8078', marginBottom: '24px' }}>Contact</p>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 300, letterSpacing: '-0.01em', marginBottom: '48px' }}>
          Let's work <em>together.</em>
        </h2>

        {contactStatus === 'success' ? (
          <p style={{ fontSize: '18px', fontWeight: 300, lineHeight: 1.7, color: '#5a5248' }}>
            Thank you — Mikayla will be in touch shortly.
          </p>
        ) : (
          <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '560px' }}>
            <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <label style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '8px' }}>Name</label>
                <input type="text" name="name" required placeholder="Your name" />
              </div>
              <div>
                <label style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '8px' }}>Email</label>
                <input type="email" name="email" required placeholder="your@email.com" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '8px' }}>Message</label>
              <textarea name="message" rows={4} required placeholder="Tell me about your project..." />
            </div>
            {contactStatus === 'error' && (
              <p style={{ fontSize: '13px', color: '#8b3a3a' }}>Something went wrong — please try again.</p>
            )}
            <div>
              <button type="submit" className="submit-btn" disabled={contactStatus === 'submitting'}>
                {contactStatus === 'submitting' ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #c0b8b0', padding: '28px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#a09890' }}>© 2026 Mikayla Exton Photography · Wanaka, New Zealand</p>
      </footer>

    </div>
  )
}

export default App
