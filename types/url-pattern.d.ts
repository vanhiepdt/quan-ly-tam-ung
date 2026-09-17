interface URLPatternInput { baseURL?: string; protocol?: string; username?: string; password?: string; hostname?: string; port?: string; pathname?: string; search?: string; hash?: string; }
interface URLPatternOptions { ignoreCase?: boolean }
declare class URLPattern { constructor(input?: string | URLPatternInput, baseURL?: string, options?: URLPatternOptions); test(input?: string | URL, baseURL?: string): boolean }
