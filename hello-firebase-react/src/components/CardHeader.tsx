import { CardHeader as NextUICardHeader } from "@nextui-org/react";
import type { ComponentProps } from "react";

export const CardHeader = (props: ComponentProps<typeof NextUICardHeader>) => {
  return (
    <NextUICardHeader {...props} className={`text-primary text-xl font-semibold mb-4 p-0 ${props.className || ''}`}>
      {props.children}
    </NextUICardHeader>
  );
}; 
