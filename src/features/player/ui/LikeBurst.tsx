import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HeartFill, HeartLine } from "@mingcute/react";

const PARTICLES = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 17,
    y: Math.sin(angle) * 17,
    delay: index * 0.012,
  };
});

interface LikeBurstProps {
  liked: boolean;
  size?: number;
  className?: string;
}

export function LikeBurst({ liked, size = 20, className }: LikeBurstProps) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(liked);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const becameLiked = liked && !previous.current;
    previous.current = liked;
    if (!becameLiked) return;
    setBurst((value) => value + 1);
    const timer = setTimeout(() => setBurst(0), 700);
    return () => clearTimeout(timer);
  }, [liked]);

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {burst > 0 && !reduceMotion && (
        <span
          key={burst}
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          {PARTICLES.map((particle, index) => (
            <motion.span
              key={index}
              className="absolute left-1/2 top-1/2 block h-[3px] w-[3px] rounded-full bg-current"
              style={{ marginLeft: -1.5, marginTop: -1.5 }}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: [0.4, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.55,
                delay: particle.delay,
                ease: "easeOut",
              }}
            />
          ))}
          <motion.span
            className="absolute inset-[-5px] rounded-full border border-current"
            initial={{ scale: 0.35, opacity: 0.65 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </span>
      )}
      <motion.span
        key={burst}
        className="inline-flex"
        initial={false}
        animate={
          burst > 0 && !reduceMotion
            ? { scale: [1, 1.32, 1], rotate: [0, -7, 0] }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 0.34, ease: [0.2, 0.9, 0.2, 1] }}
      >
        {liked ? <HeartFill size={size} /> : <HeartLine size={size} />}
      </motion.span>
    </span>
  );
}
