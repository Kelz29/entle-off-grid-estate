import Image from "next/image";

const MARK_SRC = "/brand/entle-mark.png";

/** Real brand “E” mark — use for ornaments & watermarks. */
export function EntleMark({
  className,
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={MARK_SRC}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  );
}

export { MARK_SRC as ENTLE_MARK_SRC };
