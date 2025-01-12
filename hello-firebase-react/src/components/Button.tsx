import { Button as NextUIButton } from "@nextui-org/react";
import type { ComponentProps } from "react";
import { buttonStyles } from "../theme/constants";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ComponentProps<typeof NextUIButton> {
  variant?: ButtonVariant;
}

export const Button = ({ variant = "primary", className = "", color, ...props }: ButtonProps) => {
  return (
    <NextUIButton 
      {...props} 
      color={color || undefined}
      variant="solid"
      className={`${buttonStyles.base} ${buttonStyles[variant]} ${className}`}
    >
      {props.children}
    </NextUIButton>
  );
}; 
