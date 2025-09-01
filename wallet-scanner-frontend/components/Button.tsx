// components/Button.tsx
import styles from './Button.module.scss';
import type { FC, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

const Button: FC<ButtonProps> = ({ label, ...props }) => {
  return (
    <button className={styles.primary} {...props}>
      {label}
    </button>
  );
};

export default Button;

