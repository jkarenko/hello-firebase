import { CardBody as NextUICardBody } from "@nextui-org/react";
import type { ComponentProps } from "react";

export const CardBody = (props: ComponentProps<typeof NextUICardBody>) => {
  return (
    <NextUICardBody {...props} className={`text-foreground-50 p-0 ${props.className || ''}`}>
      {props.children}
    </NextUICardBody>
  );
}; 
