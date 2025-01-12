export const cardStyles = {
  base: "bg-background p-8 rounded-xl shadow-sm",
  header: "text-primary text-xl font-semibold mb-4 p-0",
  body: "text-foreground-50 p-0",
} as const;

export const buttonStyles = {
  base: "inline-block px-8 py-4 rounded-lg font-semibold transition transform hover:-translate-y-0.5",
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-background text-primary",
} as const;
