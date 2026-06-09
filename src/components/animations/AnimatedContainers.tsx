import { ReactNode } from "react";

interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const FadeUp = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <div
    className={className}
    style={{
      opacity: 0,
      animation: `fadeUp 0.5s ${delay}s ease-out forwards`,
    }}
  >
    {children}
  </div>
);

export const FadeIn = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <div
    className={className}
    style={{
      opacity: 0,
      animation: `fadeIn 0.4s ${delay}s ease-out forwards`,
    }}
  >
    {children}
  </div>
);

export const ScaleIn = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <div
    className={className}
    style={{
      opacity: 0,
      animation: `scaleIn 0.3s ${delay}s ease-out forwards`,
    }}
  >
    {children}
  </div>
);

export const SlideInRight = ({ children, className, delay = 0 }: AnimatedContainerProps) => (
  <div
    className={className}
    style={{
      opacity: 0,
      animation: `slideInRight 0.4s ${delay}s ease-out forwards`,
    }}
  >
    {children}
  </div>
);

export const StaggerContainer = ({ children, className, staggerDelay = 0.1 }: StaggerContainerProps) => (
  <div className={className}>
    {children}
  </div>
);

export const StaggerItem = ({ children, className }: Omit<AnimatedContainerProps, "delay">) => (
  <div
    className={className}
    style={{
      opacity: 0,
      animation: `fadeUp 0.4s ease-out forwards`,
      animationFillMode: "both",
    }}
  >
    {children}
  </div>
);
