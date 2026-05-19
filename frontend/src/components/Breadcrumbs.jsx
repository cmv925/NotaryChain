import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4" data-testid="breadcrumbs">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isFirst = i === 0;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
            {isLast ? (
              <span className="text-slate-500 font-medium truncate" data-testid={`breadcrumb-current`}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 flex-shrink-0"
                data-testid={`breadcrumb-${i}`}
              >
                {isFirst && <Home className="w-3.5 h-3.5" />}
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
