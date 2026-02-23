'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getHeaderColor } from '@/config';

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className = '' }) => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'All', icon: '📂' },
    { href: '/images', label: 'Images', icon: '🖼️' },
    { href: '/posts', label: 'Posts', icon: '📱' },
    { href: '/reels', label: 'Reels', icon: '🎬' },
    { href: '/help', label: 'Help', icon: '❓' },
  ];

  return (
    <nav
      className={`${className}`}
      style={{
        '--nav-hover-text': getHeaderColor('navHoverText'),
        '--nav-hover-bg': getHeaderColor('navHoverBg'),
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-1 ml-2 mr-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-tab=""
              {...(isActive ? { 'data-active': '' } : {})}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border"
              style={
                isActive
                  ? {
                      backgroundColor: getHeaderColor('navActiveBg'),
                      color: getHeaderColor('navActiveText'),
                      borderColor: getHeaderColor('navActiveBorder'),
                    }
                  : {
                      color: getHeaderColor('navInactiveText'),
                      borderColor: 'transparent',
                    }
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
