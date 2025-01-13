export const cardStyles = {
  base: "bg-background-content p-3 rounded-xl",
  header: "text-primary text-xl font-semibold mb-4 p-0",
  body: "text-foreground-50 p-0",
} as const;

export const buttonStyles = {
  base: "inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold transition-all duration-200 gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5",
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-background-content text-primary border border-primary hover:bg-primary/10",
} as const;
