import type { NavItem } from './FloatingNav';
import './homeScreens.css';

type Props = {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
  onReturnHome: () => void;
  onOpenScan: () => void;
  onOpenManual: () => void;
  onOpenGroups: () => void;
};

export function AppNavigation({ items, activeId, onChange, onReturnHome, onOpenScan, onOpenManual, onOpenGroups }: Props) {
  return <>
    <aside className="ss-app-nav"><button className="ss-nav-logo" onClick={onReturnHome}><span>✦</span> Split<span>Smart</span></button><nav>{items.map(item => <button key={item.id} className={activeId === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.icon}<span>{item.label}</span>{item.badge != null && <small>{item.badge}</small>}</button>)}</nav><div className="ss-nav-actions"><button onClick={onOpenManual}>＋ Add expense</button><button onClick={onOpenScan}>▤ Scan receipt</button><button onClick={onOpenGroups}>◎ Switch group</button></div><div className="ss-nav-private">✓ <span><strong>Local & private</strong><small>Your data stays on this device.</small></span></div></aside>
    <header className="ss-mobile-header"><button className="ss-nav-logo" onClick={onReturnHome}><span>✦</span> Split<span>Smart</span></button><button onClick={onOpenGroups}>Groups</button></header>
    <nav className="ss-bottom-nav">{items.filter(item => ['dashboard','expenses','settlement','analytics','export'].includes(item.id)).map(item => <button key={item.id} className={activeId === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
  </>;
}
