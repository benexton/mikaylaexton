import React, { useState, useEffect, useCallback, useRef } from 'react'

const TOTAL_IMAGES = 9
const SLIDE_DURATION = 10000
const BG = '#BEC6C8'
const TEXT = '#5e2418'

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
      const res = await fetch('https://mikaylaexton.benexton.workers.dev', {
        method: 'POST', body: data, headers: { Accept: 'application/json' }
      })
      if (res.ok) { setContactStatus('success'); e.target.reset() }
      else { setContactStatus('error'); setTimeout(() => setContactStatus('idle'), 4000) }
    } catch { setContactStatus('error'); setTimeout(() => setContactStatus('idle'), 4000) }
  }

  useEffect(() => {
    if (showContact && window.turnstile) {
      setTimeout(() => window.turnstile.render('.cf-turnstile-mikayla'), 100)
    }
  }, [showContact])

  return (
    <div style={{
      background: BG,
      height: '100dvh',
      minHeight: '-webkit-fill-available',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      color: TEXT,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Staatliches&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500&display=swap');

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
          color: ${TEXT};
          padding: 14px 16px;
          opacity: 0.7;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ctrl-btn:hover { opacity: 1; }

        .contact-link {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Staatliches', cursive;
          font-size: inherit;
          font-weight: 400;
          color: ${TEXT};
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 0;
          transition: opacity 0.2s;
          letter-spacing: 0.06em;
        }
        .contact-link:hover { opacity: 0.6; }

        input, textarea {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(57, 18, 18, 0.35);
          padding: 8px 0;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 14px;
          font-weight: 300;
          color: ${TEXT};
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus { border-bottom-color: ${TEXT}; }
        input::placeholder, textarea::placeholder { color: rgba(57,18,18,0.4); font-size: 13px; }
        textarea { resize: none; }

        .submit-btn {
          background: ${TEXT};
          color: ${BG};
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
          background: rgba(190, 198, 200, 0.97);
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
          color: ${TEXT};
          opacity: 0.5;
          transition: opacity 0.2s;
          padding: 4px;
        }
        .close-btn:hover { opacity: 1; }

        label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(57,18,18,0.55);
          display: block;
          margin-bottom: 6px;
        }
      `}</style>

      {/* CONTACT OVERLAY */}
      {showContact && (
        <div className="contact-overlay">
          <div style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
              <h2 style={{ fontFamily: "'Staatliches', cursive", fontWeight: 400, fontSize: '36px', letterSpacing: '0.04em', color: TEXT }}>
                Get in touch
              </h2>
              <button className="close-btn" onClick={() => { setShowContact(false); setContactStatus('idle') }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/>
                </svg>
              </button>
            </div>

            {contactStatus === 'success' ? (
              <p style={{ fontSize: '16px', fontWeight: 300, lineHeight: 1.7, color: TEXT, opacity: 0.7 }}>
                Thank you — Mikayla will be in touch shortly.
              </p>
            ) : (
              <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="Your name" />
                  </div>
                  <div>
                    <label>Email</label>
                    <input type="email" name="email" required placeholder="your@email.com" />
                  </div>
                </div>
                <div>
                  <label>Message</label>
                  <textarea name="message" rows={4} required placeholder="Tell me about your project..." />
                </div>
                {contactStatus === 'error' && (
                  <p style={{ fontSize: '12px', color: TEXT, opacity: 0.6 }}>Something went wrong — please try again.</p>
                )}
                <div>
                  <div
                    className="cf-turnstile-mikayla"
                    data-sitekey="0x4AAAAAACrgI5LxDZueJqhg"
                    data-theme="light"
                    style={{ marginBottom: '16px' }}
                  />
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
      <header style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 44px) 40px clamp(16px, 3vw, 36px)', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: "'Staatliches', cursive",
          fontWeight: 400,
          fontSize: 'clamp(32px, 5vw, 58px)',
          letterSpacing: '0.06em',
          color: TEXT,
          lineHeight: 1,
        }}>
          Mikayla Exton
        </h1>
        <p style={{
          fontFamily: "'Staatliches', cursive",
          fontWeight: 400,
          fontSize: 'clamp(18px, 2.4vw, 30px)',
          letterSpacing: '0.06em',
          color: TEXT,
          fontStyle: 'italic',
          marginTop: '2px',
          lineHeight: 1,
        }}>
          Photography
        </p>
      </header>

      {/* PHOTO */}
      <div style={{ flex: 1, padding: '0 40px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '10px 0 0', flexShrink: 0 }}>
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

      {/* FOOTER */}
      <footer style={{
        flexShrink: 0,
        textAlign: 'center',
        padding: 'clamp(12px, 2vw, 20px) 40px clamp(16px, 3vw, 32px)',
      }}>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 20px)', fontFamily: "'Staatliches', cursive", letterSpacing: '0.06em', color: TEXT, fontWeight: 400 }}>
          Say{' '}
          <button className="contact-link" onClick={() => setShowContact(true)}>
            hello
          </button>
          {' '}if you'd like some photos
        </p>
      </footer>

    </div>
  )
}

export default App