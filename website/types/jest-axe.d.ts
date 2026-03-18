declare module "jest-axe" {
  export function axe(container: Element | DocumentFragment): Promise<{
    violations: Array<unknown>;
  }>;
}
