declare module "js-cookie" {
  export interface CookieAttributes {
    expires?: number | Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "Strict" | "lax" | "Lax" | "none" | "None";
    [property: string]: unknown;
  }

  interface CookiesStatic {
    get(name: string): string | undefined;
    set(name: string, value: string, options?: CookieAttributes): string | undefined;
    remove(name: string, options?: CookieAttributes): void;
  }

  const Cookies: CookiesStatic;
  export default Cookies;
}
