'use client';
import { useEffect } from 'react';

export default function LandingPage() {
  useEffect(() => {
    // Redirect to the premium landing page served from public/
    window.location.href = '/landing.html';
  }, []);

  return null;
}
