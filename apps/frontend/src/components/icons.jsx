/** Inline icons, so the app pulls in no icon font or sprite. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ children, className = 'h-5 w-5', filled = false, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...(filled ? { fill: 'currentColor' } : base)}
      {...props}
    >
      {children}
    </svg>
  );
}

export const VideoIcon = (props) => (
  <Icon {...props}>
    <rect x="2" y="6" width="13" height="12" rx="2.5" />
    <path d="M15 10.5 21 7v10l-6-3.5z" />
  </Icon>
);

export const VideoOffIcon = (props) => (
  <Icon {...props}>
    <path d="M2 6h10a2.5 2.5 0 0 1 2.5 2.5V15" />
    <path d="M14.5 13.5 21 17V7l-6.5 3.5" />
    <path d="m3 3 18 18" />
    <path d="M12.5 18H4.5A2.5 2.5 0 0 1 2 15.5V8" />
  </Icon>
);

export const MicIcon = (props) => (
  <Icon {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Icon>
);

export const MicOffIcon = (props) => (
  <Icon {...props}>
    <path d="M9 9V6a3 3 0 0 1 5.9-.7" />
    <path d="M15 11v-1" />
    <path d="M5 11a7 7 0 0 0 11.3 5.5" />
    <path d="M9 13.5A3 3 0 0 0 12 15" />
    <path d="M12 18v3" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const ScreenIcon = (props) => (
  <Icon {...props}>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
);

export const UsersIcon = (props) => (
  <Icon {...props}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
  </Icon>
);

export const ChatIcon = (props) => (
  <Icon {...props}>
    <path d="M20 14.5A2.5 2.5 0 0 1 17.5 17H9l-4 3.5V6.5A2.5 2.5 0 0 1 7.5 4h10A2.5 2.5 0 0 1 20 6.5z" />
  </Icon>
);

export const HomeIcon = (props) => (
  <Icon {...props}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M9.5 20.5V14h5v6.5" />
  </Icon>
);

export const CalendarIcon = (props) => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3.5V6M16 3.5V6" />
  </Icon>
);

export const SettingsIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7.2l1.9 1.1M17.9 15.7l1.9 1.1M4.2 16.8l1.9-1.1M17.9 8.3l1.9-1.1" />
  </Icon>
);

export const FileIcon = (props) => (
  <Icon {...props}>
    <path d="M13.5 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
    <path d="M13.5 3.5V9H19" />
  </Icon>
);

export const InfoIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.6v.5" />
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const BellIcon = (props) => (
  <Icon {...props}>
    <path d="M18 16V11a6 6 0 1 0-12 0v5l-1.5 2.5h15z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ArrowRightIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

export const MoreIcon = (props) => (
  <Icon {...props} filled>
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </Icon>
);

export const HandIcon = (props) => (
  <Icon {...props}>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-2a1.5 1.5 0 0 1 3 0" />
    <path d="M9 11V9.5a1.5 1.5 0 0 0-3 0V14" />
  </Icon>
);

export const PhoneOffIcon = (props) => (
  <Icon {...props}>
    <path d="M3 10.5c5-4 13-4 18 0v3l-4 .8-1-3.2a12 12 0 0 0-8 0l-1 3.2-4-.8z" />
  </Icon>
);

export const MenuIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const SendIcon = (props) => (
  <Icon {...props}>
    <path d="M4.5 12 20 5l-6 15-2.5-6z" />
  </Icon>
);

export const StarIcon = ({ filled = false, ...props }) => (
  <Icon {...props} filled={filled}>
    <path
      d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.5 9.6l5.2-.7z"
      {...(filled ? {} : base)}
    />
  </Icon>
);

export const UploadIcon = (props) => (
  <Icon {...props}>
    <path d="M12 16V5M8 9l4-4 4 4" />
    <path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
  </Icon>
);

export const LogoutIcon = (props) => (
  <Icon {...props}>
    <path d="M14.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h7a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
    <path d="M9.5 12h11M17 8.5l3.5 3.5-3.5 3.5" />
  </Icon>
);

export const EyeIcon = (props) => (
  <Icon {...props}>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);

export const EyeOffIcon = (props) => (
  <Icon {...props}>
    <path d="M4 5.5 20 19" />
    <path d="M9.6 9.7A2.8 2.8 0 0 0 12 14.8" />
    <path d="M6.3 7.3C4 8.9 2.5 12 2.5 12S6 18 12 18a9.4 9.4 0 0 0 4.2-1" />
    <path d="M18.4 15.2c1.9-1.5 3.1-3.2 3.1-3.2S18 6 12 6a9 9 0 0 0-2 .2" />
  </Icon>
);

export const CopyIcon = (props) => (
  <Icon {...props}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);
