import { ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const FadeUp = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

export const FadeIn = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const ScaleIn = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SlideInRight = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <motion.div
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerContainer = ({ children, className, staggerDelay = 0.1 }: StaggerContainerProps) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className }: Omit<AnimatedContainerProps, "delay">) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    }}
    className={className}
  >
    {children}
  </motion.div>
);
