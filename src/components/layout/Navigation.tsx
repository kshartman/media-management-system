'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    <nav className={`${className}`}>
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${isActive 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                }
              `}
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