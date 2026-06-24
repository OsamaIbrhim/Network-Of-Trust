import { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Card({ children, padding = 'md', hoverable = false, className = '', style = {} }: CardProps) {
  const paddingClass = styles[`padding-${padding}`];
  const hoverClass = hoverable ? styles.cardHover : '';

  return (
    <div className={`${styles.card} ${paddingClass} ${hoverClass} ${className}`} style={style}>
      {children}
    </div>
  );
}
