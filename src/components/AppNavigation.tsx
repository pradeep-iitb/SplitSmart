import type { NavItem } from './FloatingNav';
import './homeScreens.css';

type Props = {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
  onReturnHome: () => void;
};

export function AppNavigation({ items, activeId, onChange, onReturnHome }: Props) {
  return (
    <>
      <aside className="ss-app-nav">
        <button className="ss-nav-logo" onClick={onReturnHome}>
          <span>✦</span> Split<span>Smart</span>
        </button>
        <nav>
          {items.map((item) => (
            <button
              key={item.id}
              className={activeId === item.id ? 'active' : ''}
              onClick={() => onChange(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge != null && <small>{item.badge}</small>}
            </button>
          ))}
        </nav>
        <div className="ss-nav-private">
          ✓{' '}
          <span>
            <strong>Local & private</strong>
            <small>Your data stays on this device.</small>
          </span>
        </div>
      </aside>
      <header className="ss-mobile-header">
        <button className="ss-nav-logo" onClick={onReturnHome}>
          <span>✦</span> Split<span>Smart</span>
        </button>
        <button
          className="ss-mobile-settings"
          onClick={() => onChange('settings')}
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>
      <nav className="ss-bottom-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={activeId === item.id ? 'active' : ''}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
