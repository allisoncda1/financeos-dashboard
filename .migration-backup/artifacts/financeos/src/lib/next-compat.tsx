import { Link as WouterLink, useLocation } from "wouter";
import type { ComponentProps, ReactNode } from "react";

type LinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  children?: ReactNode;
};

export default function Link({ href, children, ...rest }: LinkProps) {
  return (
    <WouterLink href={href} {...rest}>
      {children}
    </WouterLink>
  );
}

export function usePathname(): string {
  const [location] = useLocation();
  return location;
}

export function useRouter() {
  const [, navigate] = useLocation();
  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true }),
    back: () => window.history.back(),
    prefetch: (_to: string) => {},
  };
}
