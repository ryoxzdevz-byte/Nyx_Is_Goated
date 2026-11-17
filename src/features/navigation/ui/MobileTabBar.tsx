import { useLocation, useNavigate } from "react-router-dom";
import {
  DownloadLine,
  GridFill,
  MusicFill,
  PlayFill,
  Search3Fill,
} from "@mingcute/react";
import { useModalStore } from "@/features/library";
import { usePlayerStore } from "@/features/player";
import { cn } from "@/shared/lib";

export default function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchOpen = useModalStore((state) => state.searchOpen);
  const openSearch = useModalStore((state) => state.openSearch);
  const fullscreen = usePlayerStore((state) => state.fullscreen);
  const setFullscreen = usePlayerStore((state) => state.setFullscreen);

  if (searchOpen || fullscreen) return null;

  const tabs = [
    {
      key: "home",
      label: "Home",
      Icon: MusicFill,
      active: location.pathname === "/",
      onClick: () => navigate("/"),
    },
    {
      key: "search",
      label: "Search",
      Icon: Search3Fill,
      active: searchOpen,
      onClick: openSearch,
    },
    {
      key: "library",
      label: "Library",
      Icon: GridFill,
      active:
        (location.pathname.startsWith("/library") &&
          !location.pathname.startsWith("/library/saved")) ||
        location.pathname.startsWith("/collection"),
      onClick: () => navigate("/library"),
    },
    {
      key: "offline",
      label: "Offline",
      Icon: DownloadLine,
      active: location.pathname.startsWith("/library/saved"),
      onClick: () => navigate("/library/saved"),
    },
    {
      key: "player",
      label: "Player",
      Icon: PlayFill,
      active: false,
      onClick: () => setFullscreen(true),
    },
  ];

  return (
    <nav className="nyx-mobile-tabbar" aria-label="Main navigation">
      {tabs.map(({ key, label, Icon, active, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn("nyx-mobile-tab", active && "nyx-mobile-tab--active")}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
