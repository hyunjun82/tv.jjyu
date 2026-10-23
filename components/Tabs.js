'use client';
import { useEffect } from 'react';
export default function Tabs() {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll('#tabs a'));
    const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
    const sync = () => { const y = window.scrollY + 140; let idx = 0; secs.forEach((s, i) => { if (s && s.offsetTop <= y) idx = i; }); links.forEach((a, i) => a.classList.toggle('on', i === idx)); };
    window.addEventListener('scroll', sync, { passive: true }); sync();
    return () => window.removeEventListener('scroll', sync);
  }, []);
  return null;
}
