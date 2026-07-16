import { useEffect, useRef } from 'react';
import Logo from '../components/Logo';

export default function LandingPage() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) entry.target.classList.add('reveal');
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div id="landing-container" className="panel">
      <section id="hero">
        <div className="hero-content">
          <div className="logo">
            <Logo size={32} />
            <span className="logo-text">FocusFlow</span>
          </div>

          <h1 className="hero-title">Your personal agent that delivers relevance from the digital noise.</h1>
          <p className="hero-subtitle">
            FocusFlow reads your custom interests profile, curates subreddits, RSS feeds, and developer updates, and uses Gemini AI to filter out all the noise.
          </p>

          <div className="cta-actions">
            <a href="/api/auth/discord/login" className="btn btn-discord btn-lg">
              <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.88,6.83,77.19,77.19,0,0,0,49.58,0,105.15,105.15,0,0,0,19.14,8.07C-1.64,39.15-7.25,69.5,4.72,95.91A105.73,105.73,0,0,0,32,77.58a74.32,74.32,0,0,0,6.43-10.45,69.31,69.31,0,0,1-10.15-4.87c.86-.63,1.72-1.3,2.54-2a67.88,67.88,0,0,0,76.54,0c.82.7,1.68,1.37,2.54,2a69.31,69.31,0,0,1-10.15,4.87,74.32,74.32,0,0,0,6.43,10.45,105.73,105.73,0,0,0,27.3-18.33C135.46,62.38,127.87,32.41,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
              </svg>
              Continue with Discord
            </a>
          </div>
        </div>
      </section>

      <section id="meet-tob">
        <div className="agent-info-card" ref={cardRef}>
          <div className="agent-logo-container">
            <img src="/tob.png" alt="Tob" className="agent-logo" />
          </div>
          <div className="agent-details">
            <h2>Meet Tob</h2>
            <p>
              Tob is your dedicated background assistant in FocusFlow. When a high-priority article passes through our filter rules, Tob immediately sends it as a direct message directly to your Discord chat, ensuring you get the updates instantly without having to check the dashboard.
            </p>
          </div>
        </div>

        <footer className="global-footer landing-footer">
          <div className="footer-content">
            Copyright 2026, developed by <a href="https://github.com/adchad90" target="_blank" className="footer-link" rel="noreferrer">aditya chavan</a>, all rights reserved.
          </div>
        </footer>
      </section>
    </div>
  );
}
