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
  const [showContact, setShowContact] = useState(false)
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
    <div style={{
      background: BG,
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      color: '#2a2520',
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .slide { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .fade-in { animation: fadeIn 0.8s ease forwards; }
        .fade-out { animation: fadeOut 0.8s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        .ctrl-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #2a2520;
          padding: 8px 12px;
          opacity: 0.4;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ctrl-btn:hover { opacity: 0.9; }

        input, textarea {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid #b8b0a6;
          padding: 8px 0;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 14px;
          font-weight: 300;
          color: #2a2520;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus { border-bottom-color: #2a2520; }
        input::placeholder, textarea::placeholder { color: #a09890; font-size: 13px; }
        textarea { resize: none; }

        .submit-btn {
          background: #2a2520;
          color: #d9d1c6;
          border: none;
          padding: 11px 36px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .submit-btn:hover { opacity: 0.7; }
        .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .contact-overlay {
          position: fixed;
          inset: 0;
          background: rgba(217, 209, 198, 0.97);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          animation: fadeIn 0.3s ease forwards;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #2a2520;
          opacity: 0.5;
          transition: opacity 0.2s;
          padding: 4px;
        }
        .close-btn:hover { opacity: 1; }
      `}</style>

      {/* CONTACT OVERLAY */}
      {showContact && (
        <div className="contact-overlay">
          <div style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 300, fontSize: '28px', letterSpacing: '-0.02em' }}>
                Get in touch
              </h2>
              <button className="close-btn" onClick={() => setShowContact(false)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/>
                </svg>
              </button>
            </div>

            {contactStatus === 'success' ? (
              <p style={{ fontSize: '16px', fontWeight: 300, lineHeight: 1.7, color: '#5a5248' }}>
                Thank you — Mikayla will be in touch shortly.
              </p>
            ) : (
              <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '6px' }}>Name</label>
                    <input type="text" name="name" required placeholder="Your name" />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '6px' }}>Email</label>
                    <input type="email" name="email" required placeholder="your@email.com" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8078', display: 'block', marginBottom: '6px' }}>Message</label>
                  <textarea name="message" rows={4} required placeholder="Tell me about your project..." />
                </div>
                {contactStatus === 'error' && (
                  <p style={{ fontSize: '12px', color: '#8b3a3a' }}>Something went wrong — please try again.</p>
                )}
                <div>
                  <button type="submit" className="submit-btn" disabled={contactStatus === 'submitting'}>
                    {contactStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ textAlign: 'center', padding: '32px 40px 20px', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontWeight: 300,
          fontSize: 'clamp(22px, 3vw, 38px)',
          letterSpacing: '-0.01em',
          color: '#2a2520',
        }}>
          Mikayla Exton
        </h1>
      </header>

      {/* PHOTO — fills remaining vertical space */}
      <div style={{ flex: 1, padding: '0 40px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Fixed-height image frame — height set by CSS, width adjusts per photo */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}>
          {prev !== null && (
            <div className="slide fade-out">
              <img src={`./${prev + 1}.jpg`} alt=""
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            </div>
          )}
          <div className={`slide${transitioning ? ' fade-in' : ''}`}>
            <img src={`./${current + 1}.jpg`} alt=""
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', padding: '12px 0 4px', flexShrink: 0 }}>
          <button className="ctrl-btn" onClick={() => manualNav(prev_)} aria-label="Previous">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button className="ctrl-btn" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing
              ? <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <button className="ctrl-btn" onClick={() => manualNav(next)} aria-label="Next">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* FOOTER — about + contact in one line */}
      <footer style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 40px 24px',
      }}>
        <p style={{ fontSize: '12px', color: '#7a7268', letterSpacing: '0.02em', fontWeight: 300 }}>
          Come say hello if you'd like some photos.
        </p>
        <button
          onClick={() => setShowContact(true)}
          style={{
            background: 'none',
            border: '1px solid #a09890',
            cursor: 'pointer',
            color: '#2a2520',
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '8px 20px',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2a2520'; e.currentTarget.style.color = BG }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#2a2520' }}>
          Contact
        </button>
      </footer>

    </div>
  )
}

export default App
