interface AvatarProps {
  displayName?: string;
  avatarUrl?: string | null;
  size?: number;
}

export function Avatar({ displayName, avatarUrl, size = 32 }: AvatarProps) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? "Profile"}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <span
      style={style}
      className="flex items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700"
    >
      {displayName?.charAt(0).toUpperCase()}
    </span>
  );
}
