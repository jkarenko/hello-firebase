import { Button as NextUIButton } from "@nextui-org/react";
import type { ComponentProps } from "react";
import { buttonStyles } from "../theme/constants";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<ComponentProps<typeof NextUIButton>, "variant"> & {
  variant?: ButtonVariant;
};

export const Button = ({ variant = "primary", className, ...props }: ButtonProps) => {
  return (
    <NextUIButton 
      {...props} 
      variant="solid"
      className={`${buttonStyles.base} ${buttonStyles[variant]} ${className || ''}`}
    >
      {props.children}
    </NextUIButton>
  );
}; 
