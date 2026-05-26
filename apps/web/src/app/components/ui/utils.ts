import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Filter out Figma inspector props that shouldn't be passed to DOM elements
export function filterFigmaProps<T extends Record<string, any>>(props: T): T {
  const filtered = { ...props };
  const figmaProps = ['_fgT', '_fgt', '_fgS', '_fgs', '_fgB', '_fgb'];
  
  figmaProps.forEach(prop => {
    if (prop in filtered) {
      delete filtered[prop];
    }
  });
  
  return filtered;
}