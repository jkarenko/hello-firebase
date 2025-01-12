import { Card as NextUICard } from "@nextui-org/react";
import type { ComponentProps } from "react";
import { cardStyles } from "../theme/constants";

export const Card = (props: ComponentProps<typeof NextUICard>) => {
  return (
    <NextUICard {...props} className={`${cardStyles.base} ${props.className || ''}`}>
      {props.children}
    </NextUICard>
  );
}; 
