'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

const groups: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Overview',
    links: [
      { href: '/', label: '🏠 Dashboard' },
      { href: '/live-map', label: '🗺️ Live Map' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { href: '/trips', label: '🚕 Trips' },
      { href: '/customers', label: '👥 Customers' },
      { href: '/drivers', label: '🚗 Drivers' },
      { href: '/vehicles', label: '🚘 Vehicles' },
      { href: '/deliveries', label: '📦 Deliveries' },
    ],
  },
  {
    title: 'Marketplace',
    links: [
      { href: '/cities', label: '📍 Cities & Zones' },
      { href: '/corporate', label: '🏢 Corporate' },
      { href: '/fleets', label: '🚐 Fleets' },
    ],
  },
  {
    title: 'Finance',
    links: [
      { href: '/payments', label: '💳 Payments' },
      { href: '/wallets', label: '👛 Wallets' },
      { href: '/payouts', label: '🏦 Payouts' },
      { href: '/promotions', label: '🎁 Promotions' },
    ],
  },
  {
    title: 'Engagement',
    links: [
      { href: '/ratings', label: '⭐ Ratings' },
      { href: '/notifications', label: '🔔 Notifications' },
      { href: '/support', label: '🎧 Support' },
    ],
  },
  {
    title: 'Trust & Safety',
    links: [
      { href: '/safety', label: '🆘 Safety Center' },
      { href: '/fraud', label: '🚨 Fraud & Risk' },
      { href: '/audit-logs', label: '🧾 Audit Logs' },
    ],
  },
  {
    title: 'Administration',
    links: [
      { href: '/admins', label: '👨‍💼 Admin Users' },
      { href: '/security', label: '🔐 Security / 2FA' },
      { href: '/pricing', label: '💰 Pricing' },
      { href: '/reports', label: '📤 Reports' },
    ],
  },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="layout">
      <div
        className={`sidebar-backdrop${menuOpen ? ' show' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <Link href="/" className="brand-logo">
          <img src="/logo.svg" alt="iSafeDrive" />
        </Link>
        {groups.map((g) => (
          <div key={g.title} className="navgroup">
            <div className="navtitle">{g.title}</div>
            {g.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch
                className={`navlink${pathname === l.href ? ' active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <button
          className="secondary"
          onClick={() => {
            window.localStorage.removeItem('isafedrive_admin_token');
            router.push('/login');
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="main">
        <div className="mobilebar">
          <button className="secondary" onClick={() => setMenuOpen(true)} aria-label="Menu">
            ☰
          </button>
          <img src="/logo.svg" alt="iSafeDrive" style={{ height: 26 }} />
        </div>
        <form className="globalsearch" onSubmit={submitSearch}>
          <input
            placeholder="Search phone, name, ride ID, payment reference, promo code..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        {children}
      </main>
    </div>
  );
}
